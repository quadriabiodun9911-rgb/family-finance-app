// Supabase Edge Function: statement-scan
//
// Lets a household member photograph or upload a bank statement, till
// receipt, invoice, or payment-app screenshot (Alipay/WeChat Pay/mobile
// banking) and get back structured transaction rows, instead of only being
// able to import a text-based CSV export (see ImportStatementScreen.tsx,
// which has no path for a photo or a scanned/flattened PDF with no text
// layer).
//
// Two-tier provider strategy:
//   1. Azure AI Document Intelligence (free F0 tier, no credit card) --
//      tried first. Its prebuilt-receipt and prebuilt-bankStatement.us
//      models are purpose-built, reliable, and don't share Gemini's
//      free-tier "high demand" 503s. They only understand their own
//      trained document shape though (US-formatted statements, typical
//      retail/till receipts) -- a payment-app screenshot or a non-US
//      statement won't extract anything useful from them.
//   2. Google Gemini -- used whenever Azure isn't configured, isn't
//      confident this is a statement/receipt it recognizes, or errors.
//      This is what actually reads a screenshot like Alipay's transaction
//      history, translates non-English text, and follows the business
//      rules below (skipping top-ups, pending orders, etc.) since it's a
//      general vision+language model rather than a fixed extraction
//      schema.
//
// Most real receipts/US statements resolve for free via Azure; anything
// unusual still works via Gemini when Gemini's free tier has capacity.
//
// DEPLOYMENT (not done from this environment -- no Supabase CLI
// credentials here): from a machine with the project linked,
//   supabase functions deploy statement-scan
//   supabase secrets set GEMINI_API_KEY=...
//   supabase secrets set AZURE_DOC_INTEL_ENDPOINT=... AZURE_DOC_INTEL_KEY=...
// Gemini free-tier key: https://aistudio.google.com/apikey (no card).
// Azure Document Intelligence free (F0) resource: create a "Document
// Intelligence" resource in the Azure Portal, pricing tier F0; its "Keys
// and Endpoint" page has both values. AZURE_DOC_INTEL_ENDPOINT is only
// required if you want the free Azure path -- omitting it just means
// every scan goes straight to Gemini, same as before.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

const MAX_BASE64_LEN = 8_000_000; // ~6MB binary -- Gemini's path
// Azure's free (F0) tier caps uploads at 4MB and only reads the first two
// pages. A file within Gemini's ceiling but over this one skips straight to
// Gemini rather than being rejected by Azure.
const AZURE_MAX_BASE64_LEN = 5_000_000; // ~3.75MB binary
const MAX_TRANSACTIONS = 300;

const ALLOWED_MEDIA_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf',
]);

interface DraftTransaction {
  date?: string;
  description?: string;
  amount?: number;
  direction?: 'income' | 'expense';
}

type FinalTransaction = { date: string; description: string; amount: number; direction: 'income' | 'expense' };

function finalizeTransactions(drafts: DraftTransaction[]): FinalTransaction[] {
  const today = new Date().toISOString().slice(0, 10);
  const out: FinalTransaction[] = [];
  for (const d of drafts) {
    if (typeof d.amount !== 'number' || !isFinite(d.amount) || d.amount <= 0) continue;
    out.push({
      date: d.date || today,
      description: d.description || 'Transaction',
      amount: d.amount,
      direction: d.direction === 'income' ? 'income' : 'expense',
    });
  }
  return out.slice(0, MAX_TRANSACTIONS);
}

// ---------------------------------------------------------------------
// Azure AI Document Intelligence
// ---------------------------------------------------------------------

async function azureAnalyze(
  endpoint: string,
  key: string,
  modelId: string,
  base64: string,
): Promise<Record<string, any> | null> {
  const base = endpoint.replace(/\/+$/, '');
  const analyzeUrl = `${base}/documentintelligence/documentModels/${modelId}:analyze?api-version=2024-07-31`;

  const postRes = await fetch(analyzeUrl, {
    method: 'POST',
    headers: { 'Ocp-Apim-Subscription-Key': key, 'Content-Type': 'application/json' },
    body: JSON.stringify({ base64Source: base64 }),
  });

  if (postRes.status !== 202) {
    console.error('[statement-scan][azure]', modelId, 'analyze POST failed', postRes.status, await postRes.text().catch(() => ''));
    return null;
  }

  const opLocation = postRes.headers.get('Operation-Location') || postRes.headers.get('operation-location');
  if (!opLocation) {
    console.error('[statement-scan][azure]', modelId, 'no Operation-Location header');
    return null;
  }

  const POLL_INTERVAL_MS = 1000;
  const MAX_POLLS = 15;
  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
    const pollRes = await fetch(opLocation, { headers: { 'Ocp-Apim-Subscription-Key': key } });
    if (!pollRes.ok) {
      console.error('[statement-scan][azure]', modelId, 'poll failed', pollRes.status, await pollRes.text().catch(() => ''));
      return null;
    }
    const pollBody = await pollRes.json();
    if (pollBody.status === 'succeeded') return pollBody.analyzeResult ?? null;
    if (pollBody.status === 'failed') {
      console.error('[statement-scan][azure]', modelId, 'analysis failed', JSON.stringify(pollBody).slice(0, 500));
      return null;
    }
    // status is "running" or "notStarted" -- keep polling
  }
  console.error('[statement-scan][azure]', modelId, 'timed out waiting for result');
  return null;
}

function extractReceiptTransactions(fields: Record<string, any>): DraftTransaction[] {
  const merchant = fields?.MerchantName?.valueString as string | undefined;
  const txDate = fields?.TransactionDate?.valueDate as string | undefined;
  const items = fields?.Items?.valueArray;
  const out: DraftTransaction[] = [];

  if (Array.isArray(items)) {
    for (const item of items) {
      const obj = item?.valueObject;
      if (!obj) continue;
      const amount = obj.TotalPrice?.valueCurrency?.amount ?? obj.TotalPrice?.valueNumber ?? obj.Price?.valueCurrency?.amount;
      if (typeof amount !== 'number') continue;
      out.push({
        date: txDate,
        description: obj.Description?.valueString || merchant || 'Receipt item',
        amount,
        direction: 'expense',
      });
    }
  }

  if (out.length === 0) {
    const total = fields?.Total?.valueCurrency?.amount ?? fields?.Total?.valueNumber;
    if (typeof total === 'number') {
      out.push({ date: txDate, description: merchant || 'Receipt', amount: total, direction: 'expense' });
    }
  }

  return out;
}

// Azure's bank-statement schema groups transactions under each account and
// isn't fully pinned down here (no reachable docs from this environment to
// confirm the exact nesting). Instead of hardcoding a guessed path, this
// walks the whole fields tree looking for any object that has a date-like,
// an amount-like, and a description-like key together -- which is exactly
// what a transaction row looks like regardless of exactly how deep it's
// nested under Accounts/Transactions. If Azure's real shape differs from
// this, the raw fields get logged below so a mismatch is fixable from the
// Supabase Function Logs in one pass rather than guessed at blindly again.
function looksLikeTransaction(obj: Record<string, any>): boolean {
  const keys = Object.keys(obj).map((k) => k.toLowerCase());
  const hasDate = keys.some((k) => k.includes('date'));
  const hasAmount = keys.some((k) => k.includes('amount') || k.includes('deposit') || k.includes('withdrawal'));
  const hasDesc = keys.some((k) => k.includes('description') || k.includes('memo') || k.includes('payee'));
  return hasDate && hasAmount && hasDesc;
}

function fieldObjectToTransaction(obj: Record<string, any>): DraftTransaction {
  const draft: DraftTransaction = {};
  for (const [key, value] of Object.entries(obj)) {
    const lower = key.toLowerCase();
    const f = value as any;
    if (draft.date === undefined && lower.includes('date')) {
      draft.date = f?.valueDate || (typeof f?.content === 'string' ? f.content : undefined);
    } else if (draft.description === undefined && (lower.includes('description') || lower.includes('memo') || lower.includes('payee'))) {
      draft.description = f?.valueString || (typeof f?.content === 'string' ? f.content : undefined);
    } else if (lower.includes('deposit') || lower.includes('credit')) {
      const amt = f?.valueCurrency?.amount ?? f?.valueNumber;
      if (typeof amt === 'number' && amt !== 0) { draft.amount = Math.abs(amt); draft.direction = 'income'; }
    } else if (lower.includes('withdrawal') || lower.includes('debit')) {
      const amt = f?.valueCurrency?.amount ?? f?.valueNumber;
      if (typeof amt === 'number' && amt !== 0) { draft.amount = Math.abs(amt); draft.direction = 'expense'; }
    } else if (draft.amount === undefined && lower.includes('amount')) {
      const amt = f?.valueCurrency?.amount ?? f?.valueNumber;
      if (typeof amt === 'number') { draft.amount = Math.abs(amt); draft.direction = amt < 0 ? 'expense' : 'income'; }
    }
  }
  return draft;
}

function walkForTransactions(node: any, out: DraftTransaction[], depth = 0) {
  if (!node || typeof node !== 'object' || depth > 6) return;
  if (node.type === 'array' && Array.isArray(node.valueArray)) {
    for (const item of node.valueArray) {
      if (item?.type === 'object' && item.valueObject && looksLikeTransaction(item.valueObject)) {
        out.push(fieldObjectToTransaction(item.valueObject));
      } else {
        walkForTransactions(item, out, depth + 1);
      }
    }
    return;
  }
  if (node.type === 'object' && node.valueObject) {
    for (const v of Object.values(node.valueObject)) walkForTransactions(v, out, depth + 1);
    return;
  }
  if (!('type' in node)) {
    for (const [k, v] of Object.entries(node)) {
      if (k === 'content' || k === 'confidence' || k === 'boundingRegions' || k === 'spans') continue;
      walkForTransactions(v, out, depth + 1);
    }
  }
}

function extractBankStatementTransactions(fields: Record<string, any>): DraftTransaction[] {
  const out: DraftTransaction[] = [];
  walkForTransactions(fields, out);
  return out;
}

async function tryAzure(base64: string): Promise<{ documentType: 'receipt' | 'bank_statement'; transactions: FinalTransaction[] } | null> {
  const endpoint = Deno.env.get('AZURE_DOC_INTEL_ENDPOINT');
  const key = Deno.env.get('AZURE_DOC_INTEL_KEY');
  if (!endpoint || !key) return null;
  if (base64.length > AZURE_MAX_BASE64_LEN) return null;

  try {
    const receiptResult = await azureAnalyze(endpoint, key, 'prebuilt-receipt', base64);
    const receiptFields = receiptResult?.documents?.[0]?.fields;
    if (receiptFields) {
      const drafts = extractReceiptTransactions(receiptFields);
      const finalized = finalizeTransactions(drafts);
      if (finalized.length > 0) return { documentType: 'receipt', transactions: finalized };
    }
  } catch (e) {
    console.error('[statement-scan][azure] receipt attempt threw', e);
  }

  try {
    const statementResult = await azureAnalyze(endpoint, key, 'prebuilt-bankStatement.us', base64);
    const statementFields = statementResult?.documents?.[0]?.fields;
    if (statementFields) {
      const drafts = extractBankStatementTransactions(statementFields);
      const finalized = finalizeTransactions(drafts);
      if (finalized.length > 0) return { documentType: 'bank_statement', transactions: finalized };
      console.error('[statement-scan][azure] bankStatement produced no transactions, raw fields:', JSON.stringify(statementFields).slice(0, 2000));
    }
  } catch (e) {
    console.error('[statement-scan][azure] bankStatement attempt threw', e);
  }

  return null;
}

// ---------------------------------------------------------------------
// Google Gemini (fallback)
// ---------------------------------------------------------------------

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
// 'gemini-flash-latest' is Google's own alias for whichever Flash model is
// currently their recommended default -- not a pinned version, so this
// doesn't go stale the way a dated model string eventually does.
const MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-flash-latest';

const SYSTEM_PROMPT = `You extract transaction line items from an image or PDF for a household's personal finance app. The document may be a bank statement, a till receipt, an invoice, or a screenshot of a payment app's transaction history (e.g. Alipay, WeChat Pay, a mobile banking app).

Rules:
- Only report rows you can actually read in the document. Never invent a transaction, date, or amount that isn't visibly present.
- If a figure is blurry, cut off, or ambiguous, either omit that row or include it and say so in "warning" -- do not guess a value to fill the gap.
- Skip non-transaction lines: running/opening/closing balance summaries, headers, footers, account numbers, page numbers.
- Skip wallet top-ups, balance recharges, and transfers between the same person's own accounts (e.g. "Balance Recharge," "Top-up," moving money from a bank card into the app's wallet). These move money between places the household already has it, not new income or a real expense -- reporting them as income would double-count money tracked elsewhere.
- Skip orders that are still pending, processing, or awaiting confirmation (e.g. "Waiting confirmation of receipt," "Pending," "Processing") -- only report transactions that have actually completed. An order that later completes will appear in a future statement/screenshot instead.
- For a refund: if its amount reads as zero or isn't legible, skip that row rather than reporting a zero-amount transaction. A refund with a real amount is income (money came back).
- "amount" is always a positive number; put the direction (money in vs out) in "direction".
- If the document is in a language other than English, translate "description" into a short, clear English phrase -- keep recognizable merchant/brand names as-is (e.g. "Starbucks delivery" not a transliteration).
- "date" should be YYYY-MM-DD. If the year isn't printed on the page, infer it from context (e.g. a visible statement period) rather than guessing a specific day wrong; if you truly cannot determine a date, use today's date and mention it in "warning".
- If the image contains no legible, completed transactions at all, return an empty transactions array and explain why in "warning".`;

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    documentType: { type: 'STRING', enum: ['bank_statement', 'receipt', 'invoice', 'app_screenshot', 'unknown'] },
    transactions: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          date: { type: 'STRING', description: 'YYYY-MM-DD' },
          description: { type: 'STRING' },
          amount: { type: 'NUMBER', description: 'Always positive' },
          direction: { type: 'STRING', enum: ['income', 'expense'] },
        },
        required: ['date', 'description', 'amount', 'direction'],
      },
    },
    warning: { type: 'STRING', description: 'Any caveat about image quality, illegible rows, or uncertain dates. Omit if none.' },
  },
  required: ['documentType', 'transactions'],
};

async function tryGemini(base64: string, mediaType: string): Promise<{ status: number; body: Record<string, unknown> }> {
  const apiKey = Deno.env.get('GEMINI_API_KEY');
  if (!apiKey) return { status: 503, body: { error: 'Statement scanning is not configured yet.' } };

  const geminiBody = JSON.stringify({
    system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
    contents: [{
      role: 'user',
      parts: [
        { inline_data: { mime_type: mediaType, data: base64 } },
        { text: 'Extract every transaction line item from this document.' },
      ],
    }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA, maxOutputTokens: 8192 },
  });

  // The free tier genuinely does return 503 ("high demand") and 429 (rate
  // limited) under normal use -- both mean "back off and retry", not a
  // real failure.
  const RETRY_DELAYS_MS = [500, 1500];
  let geminiRes: Response;
  let lastErrBody = '';
  for (let attempt = 0; ; attempt++) {
    geminiRes = await fetch(`${GEMINI_API_BASE}/${MODEL}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: geminiBody,
    });
    if (geminiRes.ok) break;
    if ((geminiRes.status !== 503 && geminiRes.status !== 429) || attempt >= RETRY_DELAYS_MS.length) break;
    lastErrBody = await geminiRes.text();
    console.error('[statement-scan][gemini] retrying after', geminiRes.status, lastErrBody);
    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
  }

  if (!geminiRes.ok) {
    const errBody = await geminiRes.text().catch(() => lastErrBody);
    console.error('[statement-scan][gemini]', geminiRes.status, errBody);
    const busy = geminiRes.status === 503 || geminiRes.status === 429;
    return {
      status: 502,
      body: { error: busy ? "Google's AI service is busy right now — please try again in a minute." : 'Could not read this document right now — try again shortly.' },
    };
  }

  const data = await geminiRes.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== 'string' || !text) {
    console.error('[statement-scan][gemini] no text in response', JSON.stringify(data).slice(0, 500));
    return { status: 502, body: { error: 'Could not read this document — try a clearer photo.' } };
  }

  let parsed: { documentType?: string; transactions?: unknown; warning?: string };
  try {
    parsed = JSON.parse(text);
  } catch {
    return { status: 502, body: { error: 'Could not read this document — try a clearer photo.' } };
  }

  const transactions = Array.isArray(parsed.transactions) ? parsed.transactions.slice(0, MAX_TRANSACTIONS) : [];
  return {
    status: 200,
    body: {
      documentType: parsed.documentType ?? 'unknown',
      transactions,
      warning: typeof parsed.warning === 'string' ? parsed.warning : undefined,
    },
  };
}

// ---------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return json({ error: 'Missing Authorization header' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    // getUser() with NO argument relies on the client's own internal
    // session state, which a freshly-created client here never has -- it
    // silently fails even with a valid token sitting in the Authorization
    // header. Passing the token explicitly is what actually verifies it.
    const { data: { user }, error: authError } = await callerClient.auth.getUser(authHeader.replace(/^Bearer\s+/i, ''));
    if (authError || !user) return json({ error: 'Not authenticated' }, 401);

    const body = await req.json().catch(() => null);
    const base64 = body?.base64;
    const mediaType = body?.mediaType;

    if (typeof base64 !== 'string' || !base64) {
      return json({ error: 'Missing image/PDF data.' }, 400);
    }
    if (base64.length > MAX_BASE64_LEN) {
      return json({ error: 'File is too large. Try a smaller photo or a lower-resolution scan.' }, 400);
    }
    if (typeof mediaType !== 'string' || !ALLOWED_MEDIA_TYPES.has(mediaType)) {
      return json({ error: 'Unsupported file type. Use a JPG, PNG, or PDF.' }, 400);
    }

    const azureResult = await tryAzure(base64);
    if (azureResult) {
      return json({ documentType: azureResult.documentType, transactions: azureResult.transactions }, 200);
    }

    const geminiResult = await tryGemini(base64, mediaType);
    return json(geminiResult.body, geminiResult.status);
  } catch (e) {
    console.error('[statement-scan]', e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

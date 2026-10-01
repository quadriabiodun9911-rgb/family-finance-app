// Supabase Edge Function: statement-scan
//
// Lets a household member photograph or upload a bank statement, till
// receipt, invoice, or payment-app screenshot (Alipay/WeChat Pay/mobile
// banking) and get back structured transaction rows, instead of only being
// able to import a text-based CSV export (see ImportStatementScreen.tsx,
// which previously had no path for a photo or a scanned/flattened PDF with
// no text layer).
//
// Uses Google's Gemini API (not Anthropic) specifically because Gemini's
// free tier needs no payment method to start -- this is the no-cost path
// for a personal/household app. Gemini reads the image/PDF directly (no
// separate OCR provider) and returns transactions via a forced JSON
// response schema, which is far more reliable than asking it to emit raw
// JSON in a free-text reply.
//
// DEPLOYMENT (not done from this environment -- no Supabase CLI
// credentials here): from a machine with the project linked,
//   supabase functions deploy statement-scan
//   supabase secrets set GEMINI_API_KEY=...
// Get a free-tier key at https://aistudio.google.com/apikey (no card
// required to start; check current free-tier limits there, since they
// change over time).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
// Flash, not Pro -- the free tier is built around the Flash models.
const MODEL = Deno.env.get('GEMINI_MODEL') || 'gemini-2.0-flash';

// Gemini's inline-data request limit is far more generous than this, but a
// single scanned statement has no business exceeding what Anthropic's
// vision limit used to cap this at either -- keeping the same ceiling here
// means switching providers again later doesn't also mean re-tuning this.
const MAX_BASE64_LEN = 8_000_000; // ~6MB binary
const MAX_TRANSACTIONS = 300;

const ALLOWED_MEDIA_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf',
]);

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

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

// Gemini's structured-output schema format: a constrained subset of OpenAPI
// 3.0, with UPPERCASE type names (its own Type enum, not JSON Schema's
// lowercase "string"/"number"). Passed as generationConfig.responseSchema
// below, alongside responseMimeType: "application/json", to force the
// reply to actually match this shape instead of free text.
const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    documentType: {
      type: 'STRING',
      enum: ['bank_statement', 'receipt', 'invoice', 'app_screenshot', 'unknown'],
    },
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
    warning: {
      type: 'STRING',
      description: 'Any caveat about image quality, illegible rows, or uncertain dates. Omit if none.',
    },
  },
  required: ['documentType', 'transactions'],
};

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
    // silently fails with "Auth session missing!" even though a perfectly
    // valid token is sitting right there in the Authorization header.
    // Passing the token explicitly is what actually verifies it.
    const { data: { user }, error: authError } = await callerClient.auth.getUser(authHeader.replace(/^Bearer\s+/i, ''));
    if (authError || !user) return json({ error: 'Not authenticated' }, 401);

    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) return json({ error: 'Statement scanning is not configured yet.' }, 503);

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

    const geminiRes = await fetch(`${GEMINI_API_BASE}/${MODEL}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{
          role: 'user',
          parts: [
            { inline_data: { mime_type: mediaType, data: base64 } },
            { text: 'Extract every transaction line item from this document.' },
          ],
        }],
        generationConfig: {
          responseMimeType: 'application/json',
          responseSchema: RESPONSE_SCHEMA,
          maxOutputTokens: 8192,
        },
      }),
    });

    if (!geminiRes.ok) {
      const errBody = await geminiRes.text();
      console.error('[statement-scan]', geminiRes.status, errBody);
      return json({ error: 'Could not read this document right now — try again shortly.' }, 502);
    }

    const data = await geminiRes.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof text !== 'string' || !text) {
      console.error('[statement-scan] no text in response', JSON.stringify(data).slice(0, 500));
      return json({ error: 'Could not read this document — try a clearer photo.' }, 502);
    }

    let parsed: { documentType?: string; transactions?: unknown; warning?: string };
    try {
      parsed = JSON.parse(text);
    } catch {
      return json({ error: 'Could not read this document — try a clearer photo.' }, 502);
    }

    const transactions = Array.isArray(parsed.transactions) ? parsed.transactions.slice(0, MAX_TRANSACTIONS) : [];

    return json({
      documentType: parsed.documentType ?? 'unknown',
      transactions,
      warning: typeof parsed.warning === 'string' ? parsed.warning : undefined,
    }, 200);
  } catch (e) {
    console.error('[statement-scan]', e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

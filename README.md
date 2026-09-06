# Family Finance — Personal & Family Financial Intelligence

A local-first React Native (Expo) app that goes beyond budgeting: it continuously
analyzes a household's cash flow, spending, budgets, goals, net worth, and
income to explain what's happening and recommend what to do next.

## Intelligence areas

- **Cash Flow Intelligence** — income, expenses, surplus/deficit, upcoming
  bills, committed vs. discretionary cash (`src/intelligence/cashFlow.ts`).
- **Income & Expense Intelligence** — category trend detection: consecutive
  months rising, % vs. your own target, projected annual overage
  (`src/intelligence/spending.ts`).
- **Budget & Planning Intelligence** — Planned → Actual → Forecast per
  category, with mid-month pace warnings, not end-of-month surprises
  (`src/intelligence/budgetPlan.ts`).
- **Goals** — house deposit, emergency fund, education, debt payoff,
  investment portfolio, each with pace-vs-deadline forecasting and a
  "increase by $X/month to get back on track" recommendation
  (`src/intelligence/goalPace.ts`).
- **Savings & Investment / Net Worth** — a real assets/liabilities statement,
  tracked monthly (`src/intelligence/netWorth.ts`).
- **Daily / Weekly / Monthly reports** — a generated Daily Pulse, Weekly
  Review, and Monthly Report, in the Reports tab (`src/intelligence/reports.ts`).
- **Income Intelligence** — income concentration risk, surplus-driven
  opportunity, and detection of irregular income that looks recurring
  (`src/intelligence/income.ts`).
- **Coach** — a deterministic financial-health summary and an affordability
  scenario calculator ("can we afford a $X/month payment?")
  (`src/intelligence/coach.ts`).

Every insight above is computed from data you enter — there's no external AI
or bank-feed call. The engine is deliberately rule-based so every number is
traceable to what's in your household's ledger.

## Household model

A household has members with roles (`owner`, `partner`, `teen`, `child`) and
a permission level (`full`, `shared`, `own`) — see `src/types/index.ts` and
`src/screens/HouseholdScreen.tsx`. Transactions can be tagged `shared` or
`individual` so "my money / your money / our money" stays distinguishable.

## Not in this build yet (by design)

- Real bank-feed / card sync — transactions are entered manually or via any
  future import you add. The data model (`Transaction`, `Account`) is shaped
  so a sync job can populate it later without changes.
- A WhatsApp / push delivery channel for the Daily Pulse — the report is
  generated in-app today (`Reports` tab); wiring it to a notification or
  messaging channel is a follow-up.
- An open-ended natural-language coach — `CoachScreen` is a structured,
  deterministic summary + calculator, not a free-form chat. Wiring it to an
  LLM API is a natural next step once there's a backend to hold the key.

## Setup

```
npm install
npx expo start
```

Data is stored locally on-device via AsyncStorage — nothing leaves the
device in this build.

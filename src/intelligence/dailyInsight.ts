import { Insight } from '../types';

// Deterministic per-day pick so everyone in the household sees the same
// insight on a given day and it rotates automatically tomorrow, without
// needing to persist which one was shown. Insights that need attention
// (watch/warning) are preferred over 'good' ones so the card stays useful.
export function pickDailyInsight(insights: Insight[], dateISO: string): Insight | null {
    if (insights.length === 0) return null;
    const needsAttention = insights.filter((i) => i.severity !== 'good');
    const pool = needsAttention.length > 0 ? needsAttention : insights;
    const seed = Number(dateISO.replace(/-/g, ''));
    const index = seed % pool.length;
    return pool[index];
}

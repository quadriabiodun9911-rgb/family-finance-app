export function toISODate(d: Date): string {
    return d.toISOString().slice(0, 10);
}

export function todayISO(): string {
    return toISODate(new Date());
}

export function nowTimeHHMM(): string {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

// "14:05" -> "2:05 PM". Returns null for anything that isn't a plain HH:MM
// string, so callers can fall back to omitting the time rather than
// displaying garbage for imported/legacy transactions that never got one.
export function formatTimeLabel(time?: string): string | null {
    if (!time) return null;
    const match = /^(\d{1,2}):(\d{2})$/.exec(time.trim());
    if (!match) return null;
    let hours = parseInt(match[1], 10);
    const minutes = match[2];
    if (hours > 23 || hours < 0) return null;
    const period = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${hours}:${minutes} ${period}`;
}

export function currentPeriod(): string {
    return todayISO().slice(0, 7); // YYYY-MM
}

export function periodLabel(period: string): string {
    const [y, m] = period.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function shiftPeriod(period: string, deltaMonths: number): string {
    const [y, m] = period.split('-').map(Number);
    const d = new Date(y, m - 1 + deltaMonths, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function daysInMonth(period: string): number {
    const [y, m] = period.split('-').map(Number);
    return new Date(y, m, 0).getDate();
}

export function dayOfMonth(dateISO: string): number {
    return Number(dateISO.slice(8, 10));
}

export function daysRemainingInPeriod(period: string): number {
    const total = daysInMonth(period);
    const isCurrent = period === currentPeriod();
    if (!isCurrent) return 0;
    const today = new Date().getDate();
    return Math.max(0, total - today);
}

export function startOfWeekISO(d: Date = new Date()): string {
    const date = new Date(d);
    const day = date.getDay(); // 0 = Sunday
    date.setDate(date.getDate() - day);
    date.setHours(0, 0, 0, 0);
    return toISODate(date);
}

export function addDaysISO(dateISO: string, days: number): string {
    const d = new Date(dateISO + 'T00:00:00');
    d.setDate(d.getDate() + days);
    return toISODate(d);
}

export function daysBetween(fromISO: string, toISO: string): number {
    const from = new Date(fromISO + 'T00:00:00').getTime();
    const to = new Date(toISO + 'T00:00:00').getTime();
    return Math.round((to - from) / 86_400_000);
}

export function monthsBetween(fromISO: string, toISO: string): number {
    const from = new Date(fromISO + 'T00:00:00');
    const to = new Date(toISO + 'T00:00:00');
    return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}

export function last6Periods(): string[] {
    const periods: string[] = [];
    for (let i = 5; i >= 0; i--) periods.push(shiftPeriod(currentPeriod(), -i));
    return periods;
}

export function shortWeekday(dateISO: string): string {
    return new Date(dateISO + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short' });
}

export function shortDate(dateISO: string): string {
    return new Date(dateISO + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

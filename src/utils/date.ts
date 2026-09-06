export function toISODate(d: Date): string {
    return d.toISOString().slice(0, 10);
}

export function todayISO(): string {
    return toISODate(new Date());
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

export function formatMoney(amount: number, symbol: string): string {
    const negative = amount < 0;
    const abs = Math.abs(Math.round(amount));
    const withCommas = abs.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return `${negative ? '-' : ''}${symbol}${withCommas}`;
}

export function formatCompactMoney(amount: number, symbol: string): string {
    const abs = Math.abs(amount);
    const sign = amount < 0 ? '-' : '';
    if (abs >= 1_000_000) return `${sign}${symbol}${(abs / 1_000_000).toFixed(1)}M`;
    if (abs >= 1_000) return `${sign}${symbol}${(abs / 1_000).toFixed(1)}k`;
    return formatMoney(amount, symbol);
}

export function formatPct(value: number, digits = 0): string {
    return `${value >= 0 ? '' : '-'}${Math.abs(value).toFixed(digits)}%`;
}

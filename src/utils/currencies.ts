export interface CurrencyOption {
    code: string;
    symbol: string;
}

export const CURRENCIES: CurrencyOption[] = [
    { code: 'NGN', symbol: '₦' },
    { code: 'USD', symbol: '$' },
    { code: 'GBP', symbol: '£' },
    { code: 'EUR', symbol: '€' },
];

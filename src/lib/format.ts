let currency = 'GBP';
export function setCurrency(c: string) {
  currency = c || 'GBP';
}
export function money(n: number | undefined, opts: { decimals?: boolean } = {}): string {
  const v = Number(n) || 0;
  const decimals = opts.decimals ?? true;
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency,
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  }).format(v);
}

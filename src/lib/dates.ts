// All dates are local calendar dates stored as 'YYYY-MM-DD' strings.
export type ISODate = string;

const pad = (n: number) => String(n).padStart(2, '0');

export function toISO(d: Date): ISODate {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseISO(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function today(): ISODate {
  return toISO(new Date());
}

export function addDays(s: ISODate, n: number): ISODate {
  const d = parseISO(s);
  d.setDate(d.getDate() + n);
  return toISO(d);
}

export function daysInMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate();
}

/** Add months keeping the anchor day, clamped to the month's last day (31 Jan + 1 month = 28/29 Feb). */
export function addMonths(s: ISODate, n: number, anchorDay?: number): ISODate {
  const d = parseISO(s);
  const day = anchorDay ?? d.getDate();
  const total = d.getFullYear() * 12 + d.getMonth() + n;
  const y = Math.floor(total / 12);
  const m = total - y * 12;
  return toISO(new Date(y, m, Math.min(day, daysInMonth(y, m))));
}

export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((parseISO(a).getTime() - parseISO(b).getTime()) / 86400000);
}

export function monthKey(s: ISODate): string {
  return s.slice(0, 7);
}

export function formatDate(s: ISODate | undefined): string {
  if (!s) return '';
  return parseISO(s).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export function relativeLabel(s: ISODate, ref: ISODate = today()): string {
  const n = diffDays(s, ref);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  if (n < 0) return `${-n} days overdue`;
  if (n < 7) return `In ${n} days`;
  return formatDate(s);
}

/** "today", "yesterday", "5 days ago" for past dates. */
export function agoLabel(s: ISODate, ref: ISODate = today()): string {
  const n = diffDays(ref, s);
  if (n <= 0) return 'today';
  if (n === 1) return 'yesterday';
  if (n < 60) return `${n} days ago`;
  return `on ${formatDate(s)}`;
}

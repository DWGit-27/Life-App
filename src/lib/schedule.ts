import { addDays, addMonths, parseISO, type ISODate } from './dates';

export type Freq = 'once' | 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface Schedule {
  freq: Freq;
  /** every N units (e.g. every 2 weeks) */
  interval: number;
  /** first occurrence */
  start: ISODate;
  /** optional last date (inclusive) */
  until?: ISODate;
}

export const FREQ_LABEL: Record<Freq, string> = {
  once: 'One-off',
  daily: 'Day',
  weekly: 'Week',
  monthly: 'Month',
  yearly: 'Year',
};

export function describeSchedule(s: Schedule | undefined): string {
  if (!s) return '';
  if (s.freq === 'once') return 'One-off';
  const unit = FREQ_LABEL[s.freq].toLowerCase();
  return s.interval > 1 ? `Every ${s.interval} ${unit}s` : `Every ${unit}`;
}

/** The nth occurrence (0-based) of a schedule. */
export function nthOccurrence(s: Schedule, n: number): ISODate {
  const i = Math.max(1, s.interval || 1);
  switch (s.freq) {
    case 'once':
      return s.start;
    case 'daily':
      return addDays(s.start, n * i);
    case 'weekly':
      return addDays(s.start, n * i * 7);
    case 'monthly':
      return addMonths(s.start, n * i, parseISO(s.start).getDate());
    case 'yearly':
      return addMonths(s.start, n * i * 12, parseISO(s.start).getDate());
  }
}

/** All occurrences between from and to (inclusive). */
export function occurrences(s: Schedule, from: ISODate, to: ISODate, max = 500): ISODate[] {
  if (!s?.start) return [];
  const out: ISODate[] = [];
  if (s.freq === 'once') {
    if (s.start >= from && s.start <= to) out.push(s.start);
    return out;
  }
  // Skip ahead roughly for daily/weekly schedules that started long ago.
  let n = 0;
  if ((s.freq === 'daily' || s.freq === 'weekly') && s.start < from) {
    const step = (s.freq === 'daily' ? 1 : 7) * Math.max(1, s.interval || 1);
    const gap = Math.round((parseISO(from).getTime() - parseISO(s.start).getTime()) / 86400000);
    n = Math.max(0, Math.floor(gap / step) - 1);
  }
  for (let guard = 0; guard < 100000 && out.length < max; guard++, n++) {
    const d = nthOccurrence(s, n);
    if (d > to || (s.until && d > s.until)) break;
    if (d >= from) out.push(d);
  }
  return out;
}

export function nextOccurrence(s: Schedule, onOrAfter: ISODate): ISODate | undefined {
  return occurrences(s, onOrAfter, addDays(onOrAfter, 366 * 30), 1)[0];
}

/** How many times per year a schedule fires (for budgeting). */
export function perYear(s: Schedule | undefined): number {
  if (!s) return 0;
  const i = Math.max(1, s.interval || 1);
  switch (s.freq) {
    case 'once':
      return 0;
    case 'daily':
      return 365 / i;
    case 'weekly':
      return 52 / i;
    case 'monthly':
      return 12 / i;
    case 'yearly':
      return 1 / i;
  }
}

import { addDays, toISO, type ISODate } from './dates';
import type { Area } from '../db';

const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const AREA_TAGS: Record<string, Area> = { work: 'Work', home: 'Home', house: 'Home', money: 'Money', health: 'Health', gym: 'Health', personal: 'Personal', me: 'Personal' };

export interface Parsed {
  title: string;
  date?: ISODate;
  area?: Area;
  priority?: 'high' | 'low';
  focus?: boolean;
  anytime?: boolean;
}

/**
 * Understands: today, tomorrow/tmr, mon…sun (next one), "in 3 days", "next week", 25/12 or 2026-12-25,
 * !high / !! / !low, #work #home #money #health #personal, * (focus), "someday" (no date).
 */
export function parseQuickAdd(input: string, todayISO: ISODate): Parsed {
  let s = ` ${input} `;
  const out: Parsed = { title: '' };
  const take = (re: RegExp, fn: (m: RegExpMatchArray) => void) => {
    const m = s.match(re);
    if (m) {
      fn(m);
      s = s.replace(re, ' ');
    }
  };
  take(/\s(!high|!!)\s/i, () => (out.priority = 'high'));
  take(/\s!low\s/i, () => (out.priority = 'low'));
  take(/\s\*\s/, () => (out.focus = true));
  take(/\s#(\w+)\s/i, (m) => (out.area = AREA_TAGS[m[1].toLowerCase()]));
  take(/\s(someday|anytime)\s/i, () => (out.anytime = true));
  take(/\s(today|tonight)\s/i, () => (out.date = todayISO));
  take(/\s(tomorrow|tmr|tmrw)\s/i, () => (out.date = addDays(todayISO, 1)));
  take(/\sin (\d+) days?\s/i, (m) => (out.date = addDays(todayISO, Number(m[1]))));
  take(/\snext week\s/i, () => (out.date = addDays(todayISO, 7)));
  take(/\s(?:on )?(sun|mon|tue|wed|thu|fri|sat)[a-z]*\s/i, (m) => {
    const target = DAYS.indexOf(m[1].toLowerCase());
    const now = new Date(todayISO + 'T00:00').getDay();
    out.date = addDays(todayISO, ((target - now + 7) % 7) || 7);
  });
  take(/\s(\d{4}-\d{2}-\d{2})\s/, (m) => (out.date = m[1]));
  take(/\s(\d{1,2})\/(\d{1,2})\s/, (m) => {
    const y = Number(todayISO.slice(0, 4));
    let d = toISO(new Date(y, Number(m[2]) - 1, Number(m[1])));
    if (d < todayISO) d = toISO(new Date(y + 1, Number(m[2]) - 1, Number(m[1])));
    out.date = d;
  });
  out.title = s.replace(/\s+/g, ' ').trim();
  return out;
}

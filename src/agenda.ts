import type { Bill, Completion, HouseJob, Loan, Policy, SourceType, Task, Area } from './db';
import { addDays, formatDate, type ISODate } from './lib/dates';
import { occurrences, type Schedule } from './lib/schedule';
import { amortise } from './lib/mortgage';

export interface AgendaItem {
  key: string;
  source: SourceType;
  sourceId: string;
  date: ISODate;
  title: string;
  detail?: string;
  area: Area;
  amount?: number;
  priority?: string;
  /** earlier missed occurrences folded into this one */
  missed: ISODate[];
  done: boolean;
}

export interface Sources {
  tasks: Task[];
  bills: Bill[];
  policies: Policy[];
  house: HouseJob[];
  loans: Loan[];
  completions: Completion[];
}

interface Raw {
  source: SourceType;
  id: string;
  title: string;
  detail?: string;
  area: Area;
  amount?: number;
  priority?: string;
  schedule: Schedule;
  /** bills/loan payments with autopay are not "overdue" — they just happen */
  auto?: boolean;
  /** if true, every missed occurrence matters (shown separately rather than folded) */
  foldMissed: boolean;
}

function raws(s: Sources): Raw[] {
  const out: Raw[] = [];
  for (const t of s.tasks)
    if (t.schedule?.start)
      out.push({ source: 'task', id: t.id, title: t.title, detail: t.project, area: t.area, priority: t.priority, schedule: t.schedule, foldMissed: t.schedule.freq !== 'once' });
  for (const b of s.bills)
    if (b.schedule?.start)
      out.push({ source: 'bill', id: b.id, title: `Pay ${b.name}`, detail: [b.provider, b.autopay ? 'Direct debit' : b.paymentMethod].filter(Boolean).join(' · '), area: 'Money', amount: b.amount, schedule: b.schedule, auto: b.autopay, foldMissed: false });
  for (const p of s.policies) {
    if (p.renewalDate) {
      const before = p.remindDaysBefore ?? 30;
      out.push({ source: 'policy', id: p.id, title: `Renew ${p.name}`, detail: [p.insurer, `renews ${formatDate(p.renewalDate)}, compare quotes`].filter(Boolean).join(' · '), area: 'Money', amount: p.premium, schedule: { freq: 'yearly', interval: 1, start: addDays(p.renewalDate, -before) }, foldMissed: true });
    }
  }
  for (const h of s.house)
    if (h.schedule?.start)
      out.push({ source: 'house', id: h.id, title: h.title, detail: [h.kind === 'cleaning' ? 'Cleaning' : 'Maintenance', h.room, h.assignee].filter(Boolean).join(' · '), area: 'Home', amount: h.estCost, schedule: h.schedule, foldMissed: true });
  for (const l of s.loans) {
    if (!l.firstPayment) continue;
    const rows = amortise({ principal: l.principal, annualRate: l.annualRate, termMonths: l.termMonths, firstPayment: l.firstPayment, extraMonthly: l.extraMonthly });
    const last = rows[rows.length - 1]?.date;
    out.push({ source: 'loan', id: l.id, title: `${l.name} payment`, detail: l.lender, area: 'Money', amount: rows[0]?.payment, schedule: { freq: 'monthly', interval: 1, start: l.firstPayment, until: last }, auto: true, foldMissed: true });
    if (l.fixedUntil)
      out.push({ source: 'loan', id: l.id + ':fix', title: `${l.name}: fixed rate ends, remortgage`, detail: 'Start shopping around 3 to 6 months before', area: 'Money', schedule: { freq: 'once', interval: 1, start: addDays(l.fixedUntil, -120) }, foldMissed: false });
  }
  return out;
}

/**
 * Build the agenda from every module.
 * - Upcoming: occurrences between today and today+horizonDays.
 * - Overdue: uncompleted occurrences in the last lookbackDays (autopay items are skipped).
 *   Recurring chores fold missed occurrences into the latest one.
 */
export function buildAgenda(s: Sources, todayISO: ISODate, horizonDays = 14, lookbackDays = 60, includeDone = false): AgendaItem[] {
  const done = new Set(s.completions.filter((c) => !c.deleted).map((c) => `${c.source}|${c.sourceId}|${c.date}`));
  const from = addDays(todayISO, -lookbackDays);
  const to = addDays(todayISO, horizonDays);
  const items: AgendaItem[] = [];
  for (const r of raws(s)) {
    const occ = occurrences(r.schedule, r.auto ? todayISO : from, to);
    const pending: ISODate[] = [];
    for (const d of occ) {
      const isDone = done.has(`${r.source}|${r.id}|${d}`);
      if (isDone) {
        if (includeDone) items.push(mk(r, d, [], true));
        continue;
      }
      if (d < todayISO) {
        pending.push(d);
        continue;
      }
      // first upcoming occurrence absorbs folded missed ones only if nothing overdue is shown
      items.push(mk(r, d, [], false));
    }
    if (pending.length) {
      if (r.foldMissed) {
        const latest = pending[pending.length - 1];
        items.push(mk(r, latest, pending.slice(0, -1), false));
      } else for (const d of pending) items.push(mk(r, d, [], false));
    }
  }
  const prio = (p?: string) => (p === 'high' ? 0 : p === 'low' ? 2 : 1);
  return items.sort((a, b) => a.date.localeCompare(b.date) || prio(a.priority) - prio(b.priority) || a.title.localeCompare(b.title));
}

function mk(r: Raw, date: ISODate, missed: ISODate[], done: boolean): AgendaItem {
  return { key: `${r.source}|${r.id}|${date}`, source: r.source, sourceId: r.id, date, title: r.title, detail: r.detail, area: r.area, amount: r.amount, priority: r.priority, missed, done };
}

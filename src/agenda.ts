import type { Area, Bill, Completion, HouseJob, InventoryItem, Loan, Policy, Snooze, SourceType, Task, WorkoutPlan } from './db';
import { addDays, type ISODate } from './lib/dates';
import { occurrences, type Schedule } from './lib/schedule';
import { amortise } from './lib/mortgage';

export interface AgendaItem {
  key: string;
  source: SourceType;
  /** id of the record this came from (suffixes like ':fix' stripped) */
  recordId: string;
  sourceId: string;
  /** the date it shows on (after any snooze) */
  date: ISODate;
  /** the scheduled occurrence date (used to mark it done) */
  occurrence: ISODate;
  snoozed: boolean;
  title: string;
  detail?: string;
  area: Area;
  amount?: number;
  priority?: string;
  checklist?: { done: number; total: number };
  /** for heads-up reminders: the real deadline (renewal, warranty end, fixed rate end) */
  target?: ISODate;
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
  plans?: WorkoutPlan[];
  inventory?: InventoryItem[];
  snoozes?: Snooze[];
}

interface Raw {
  source: SourceType;
  id: string;
  title: string;
  detail?: string;
  area: Area;
  amount?: number;
  priority?: string;
  checklist?: { done: number; total: number };
  /** days between the reminder and the real deadline */
  lead?: number;
  schedule: Schedule;
  /** paid automatically: never overdue */
  auto?: boolean;
  /** fold missed occurrences into the latest one (chores) rather than listing each (bills) */
  foldMissed: boolean;
}

function raws(s: Sources): Raw[] {
  const out: Raw[] = [];
  for (const t of s.tasks)
    if (t.schedule?.start)
      out.push({
        source: 'task',
        id: t.id,
        title: t.title,
        detail: t.project,
        area: t.area,
        priority: t.priority,
        checklist: t.checklist?.length ? { done: t.checklist.filter((c) => c.done).length, total: t.checklist.length } : undefined,
        schedule: t.schedule,
        foldMissed: t.schedule.freq !== 'once',
      });
  for (const b of s.bills)
    if (b.schedule?.start)
      out.push({ source: 'bill', id: b.id, title: `Pay ${b.name}`, detail: [b.provider, b.autopay ? 'Direct debit' : b.paymentMethod].filter(Boolean).join(' · '), area: 'Money', amount: b.amount, schedule: b.schedule, auto: b.autopay, foldMissed: false });
  for (const p of s.policies) {
    if (p.renewalDate) {
      const before = p.remindDaysBefore ?? 30;
      out.push({ source: 'policy', id: p.id, title: `Renew ${p.name}`, detail: [p.insurer, 'compare quotes'].filter(Boolean).join(' · '), area: 'Money', amount: p.premium, lead: before, schedule: { freq: 'yearly', interval: 1, start: addDays(p.renewalDate, -before) }, foldMissed: true });
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
      out.push({ source: 'loan', id: l.id + ':fix', title: `${l.name}: fixed rate ends, remortgage`, detail: 'Start shopping around for a new deal', area: 'Money', lead: 120, schedule: { freq: 'once', interval: 1, start: addDays(l.fixedUntil, -120) }, foldMissed: false });
  }
  for (const p of s.plans ?? [])
    if (p.schedule?.start)
      out.push({ source: 'workout', id: p.id, title: `Workout: ${p.name}`, detail: p.exercises.length ? `${p.exercises.length} exercises` : undefined, area: 'Health', schedule: p.schedule, foldMissed: true });
  for (const i of s.inventory ?? [])
    if (i.warrantyUntil)
      out.push({ source: 'warranty', id: i.id, title: `Warranty ending: ${i.name}`, detail: 'check it works properly', area: 'Home', lead: 30, schedule: { freq: 'once', interval: 1, start: addDays(i.warrantyUntil, -30) }, foldMissed: false });
  return out;
}

/**
 * Build the agenda from every module.
 * - Upcoming: occurrences between today and today+horizonDays.
 * - Overdue: uncompleted occurrences in the last lookbackDays (automatic payments are skipped).
 *   Recurring chores fold missed occurrences into the latest one.
 * - Snoozed occurrences move to their new date.
 */
export function buildAgenda(s: Sources, todayISO: ISODate, horizonDays = 14, lookbackDays = 60, includeDone = false): AgendaItem[] {
  const done = new Set(s.completions.filter((c) => !c.deleted).map((c) => `${c.source}|${c.sourceId}|${c.date}`));
  const snoozed = new Map<string, ISODate>();
  for (const z of s.snoozes ?? []) if (!z.deleted) snoozed.set(`${z.source}|${z.sourceId}|${z.date}`, z.to);
  const from = addDays(todayISO, -lookbackDays);
  const to = addDays(todayISO, horizonDays);
  const items: AgendaItem[] = [];
  for (const r of raws(s)) {
    const occ = occurrences(r.schedule, r.auto ? todayISO : from, to);
    const pending: ISODate[] = [];
    for (const d of occ) {
      const k = `${r.source}|${r.id}|${d}`;
      if (done.has(k)) {
        if (includeDone) items.push(mk(r, d, d, [], true));
        continue;
      }
      const moved = snoozed.get(k);
      if (moved) {
        if (moved <= to) items.push(mk(r, d, moved, [], false));
        continue;
      }
      if (d < todayISO) pending.push(d);
      else items.push(mk(r, d, d, [], false));
    }
    if (pending.length) {
      if (r.foldMissed) {
        const latest = pending[pending.length - 1];
        items.push(mk(r, latest, latest, pending.slice(0, -1), false));
      } else for (const d of pending) items.push(mk(r, d, d, [], false));
    }
  }
  const prio = (p?: string) => (p === 'high' ? 0 : p === 'low' ? 2 : 1);
  return items.sort((a, b) => a.date.localeCompare(b.date) || prio(a.priority) - prio(b.priority) || a.title.localeCompare(b.title));
}

function mk(r: Raw, occurrence: ISODate, date: ISODate, missed: ISODate[], done: boolean): AgendaItem {
  return {
    key: `${r.source}|${r.id}|${occurrence}`,
    source: r.source,
    sourceId: r.id,
    recordId: r.id.split(':')[0],
    date,
    occurrence,
    snoozed: date !== occurrence,
    title: r.title,
    detail: r.detail,
    area: r.area,
    amount: r.amount,
    priority: r.priority,
    checklist: r.checklist,
    target: r.lead ? addDays(occurrence, r.lead) : undefined,
    missed,
    done,
  };
}

import { useMemo, useState } from 'react';
import { db, save, uid, type Area, type Bill, type Completion, type HouseJob, type InventoryItem, type Loan, type Policy, type Snooze, type Task, type WorkoutPlan } from '../db';
import { useRows } from './Crud';
import { buildAgenda, type AgendaItem, type Sources } from '../agenda';
import { addDays, diffDays, parseISO, relativeLabel, today } from '../lib/dates';
import { money } from '../lib/format';
import { openEdit, SOURCE_TABLE } from '../registry';

export function useSources(): Sources {
  const tasks = useRows<Task>('tasks');
  const bills = useRows<Bill>('bills');
  const policies = useRows<Policy>('policies');
  const house = useRows<HouseJob>('house');
  const loans = useRows<Loan>('loans');
  const completions = useRows<Completion>('completions');
  const plans = useRows<WorkoutPlan>('plans');
  const inventory = useRows<InventoryItem>('inventory');
  const snoozes = useRows<Snooze>('snoozes');
  return useMemo(
    () => ({ tasks, bills, policies, house, loans, completions, plans, inventory, snoozes }),
    [tasks, bills, policies, house, loans, completions, plans, inventory, snoozes],
  );
}

export function useAgenda(horizon = 14) {
  const s = useSources();
  const t = today();
  return useMemo(() => buildAgenda(s, t, horizon), [s, t, horizon]);
}

export async function complete(item: AgendaItem) {
  const t = today();
  for (const date of [...item.missed, item.occurrence]) {
    await save<Completion>('completions', { id: uid(), source: item.source, sourceId: item.sourceId, date, completedOn: t });
  }
  return item;
}

export async function undoComplete(item: AgendaItem) {
  const all = await db.completions.where('[source+sourceId]').equals([item.source, item.sourceId]).toArray();
  const dates = new Set([...item.missed, item.occurrence]);
  for (const c of all) if (dates.has(c.date) && !c.deleted) await db.completions.update(c.id, { deleted: 1, updatedAt: Date.now() });
}

export async function snooze(item: AgendaItem, to: string) {
  // Snoozing a folded chore moves the latest occurrence; the older missed ones are marked done.
  const t = today();
  for (const date of item.missed) await save<Completion>('completions', { id: uid(), source: item.source, sourceId: item.sourceId, date, completedOn: t });
  const existing = (await db.snoozes.where('[source+sourceId]').equals([item.source, item.sourceId]).toArray()).find((z) => z.date === item.occurrence && !z.deleted);
  await save<Snooze>('snoozes', { id: existing?.id ?? uid(), createdAt: existing?.createdAt, source: item.source, sourceId: item.sourceId, date: item.occurrence, to });
}

const AREA_ICON: Record<Area, string> = { Personal: '🙂', Work: '💼', Home: '🏠', Money: '💷', Health: '💪' };

function SnoozeMenu({ item, onClose }: { item: AgendaItem; onClose: () => void }) {
  const t = today();
  const base = item.date > t ? item.date : t;
  const nextMon = addDays(t, ((8 - new Date().getDay()) % 7) || 7);
  const opts: [string, string][] = [
    ['Tomorrow', addDays(t, 1)],
    ['In 3 days', addDays(base, 3)],
    ['Next Monday', nextMon],
    ['In a week', addDays(base, 7)],
  ];
  return (
    <div className="snooze" onClick={(e) => e.stopPropagation()}>
      <span className="muted">Move to:</span>
      {opts.map(([label, d]) => (
        <button
          key={label}
          onClick={async () => {
            await snooze(item, d);
            onClose();
          }}
        >
          {label}
        </button>
      ))}
      <input
        type="date"
        aria-label="Pick a date"
        min={addDays(t, 1)}
        onChange={async (e) => {
          if (!e.target.value) return;
          await snooze(item, e.target.value);
          onClose();
        }}
      />
    </div>
  );
}

export function AgendaList({ items, emptyText, onDone }: { items: AgendaItem[]; emptyText?: string; onDone?: (i: AgendaItem) => void }) {
  const [snoozing, setSnoozing] = useState<string | null>(null);
  if (!items.length) return <div className="empty">{emptyText ?? 'Nothing here.'}</div>;
  const t = today();
  return (
    <ul className="agenda">
      {items.map((i) => {
        const overdue = isOverdue(i, t);
        return (
          <li key={i.key} className={overdue ? 'overdue' : ''}>
            <div className="agenda-row">
              <button
                className="tick"
                aria-label={`Mark ${i.title} done`}
                onClick={async (e) => {
                  e.stopPropagation();
                  onDone?.(await complete(i));
                }}
              />
              <button className="agenda-body" onClick={() => openEdit({ table: SOURCE_TABLE[i.source], id: i.recordId })}>
                <div className="title">
                  <span className="area" title={i.area}>
                    {AREA_ICON[i.area]}
                  </span>{' '}
                  {i.title}
                  {i.priority === 'high' && <span className="pill hot">High</span>}
                </div>
                <div className="meta">
                  {i.target ? (
                    <span className={overdue ? 'warn' : 'heads'}>{deadlineLabel(i.target, t)}</span>
                  ) : (
                    <span className={overdue ? 'warn' : ''}>{relativeLabel(i.date, t)}</span>
                  )}
                  {i.snoozed && <span> · moved</span>}
                  {i.missed.length > 0 && <span className="warn"> · missed {i.missed.length} more before</span>}
                  {i.checklist && (
                    <span>
                      {' '}
                      · ☑ {i.checklist.done}/{i.checklist.total}
                    </span>
                  )}
                  {i.detail && <span> · {i.detail}</span>}
                </div>
              </button>
              {i.amount ? <div className="amount">{money(i.amount)}</div> : null}
              <button className="icon snooze-btn" aria-label={`Move ${i.title} to another day`} title="Move to another day" onClick={() => setSnoozing(snoozing === i.key ? null : i.key)}>
                ⏰
              </button>
            </div>
            {snoozing === i.key && <SnoozeMenu item={i} onClose={() => setSnoozing(null)} />}
          </li>
        );
      })}
    </ul>
  );
}

export function useUndo() {
  const [last, setLast] = useState<AgendaItem | null>(null);
  const toast = last && (
    <div className="toast">
      Done: {last.title}
      <button
        onClick={async () => {
          await undoComplete(last);
          setLast(null);
        }}
      >
        Undo
      </button>
      <button className="icon" onClick={() => setLast(null)} aria-label="Dismiss">
        ✕
      </button>
    </div>
  );
  return { onDone: (i: AgendaItem) => setLast(i), toast };
}

/** Heads-up reminders (renewals, warranties) are only overdue once the real deadline passes. */
export function isOverdue(i: AgendaItem, t: string) {
  return i.target ? i.target < t : i.date < t;
}

function deadlineLabel(target: string, t: string) {
  const n = diffDays(target, t);
  if (n < 0) return `deadline passed ${-n} days ago`;
  if (n === 0) return 'deadline today';
  return `deadline in ${n} days (${parseISO(target).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })})`;
}

export function groupAgenda(items: AgendaItem[]) {
  const t = today();
  return {
    overdue: items.filter((i) => isOverdue(i, t)),
    today: items.filter((i) => i.date === t || (i.date < t && !isOverdue(i, t))),
    week: items.filter((i) => i.date > t && diffDays(i.date, t) <= 7),
    later: items.filter((i) => diffDays(i.date, t) > 7),
  };
}

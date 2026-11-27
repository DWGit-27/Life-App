import { useMemo, useState } from 'react';
import { db, save, uid, type Area, type Bill, type Completion, type HouseJob, type Loan, type Policy, type Task } from '../db';
import { useRows } from './Crud';
import { buildAgenda, type AgendaItem, type Sources } from '../agenda';
import { diffDays, relativeLabel, today } from '../lib/dates';
import { money } from '../lib/format';

export function useSources(): Sources {
  const tasks = useRows<Task>('tasks');
  const bills = useRows<Bill>('bills');
  const policies = useRows<Policy>('policies');
  const house = useRows<HouseJob>('house');
  const loans = useRows<Loan>('loans');
  const completions = useRows<Completion>('completions');
  return { tasks, bills, policies, house, loans, completions };
}

export function useAgenda(horizon = 14) {
  const s = useSources();
  const t = today();
  return useMemo(() => buildAgenda(s, t, horizon), [s, t, horizon]);
}

export async function complete(item: AgendaItem) {
  const t = today();
  for (const date of [...item.missed, item.date]) {
    await save<Completion>('completions', { id: uid(), source: item.source, sourceId: item.sourceId, date, completedOn: t });
  }
  return item;
}

export async function undoComplete(item: AgendaItem) {
  const all = await db.completions.where('[source+sourceId]').equals([item.source, item.sourceId]).toArray();
  const dates = new Set([...item.missed, item.date]);
  for (const c of all) if (dates.has(c.date) && !c.deleted) await db.completions.update(c.id, { deleted: 1, updatedAt: Date.now() });
}

const AREA_ICON: Record<Area, string> = { Personal: '🙂', Work: '💼', Home: '🏠', Money: '💷', Health: '💪' };

export function AgendaList({ items, emptyText, onDone }: { items: AgendaItem[]; emptyText?: string; onDone?: (i: AgendaItem) => void }) {
  if (!items.length) return <div className="empty">{emptyText ?? 'Nothing here.'}</div>;
  const t = today();
  return (
    <ul className="agenda">
      {items.map((i) => {
        const overdue = i.date < t;
        return (
          <li key={i.key} className={overdue ? 'overdue' : ''}>
            <button className="tick" aria-label={`Mark ${i.title} done`} onClick={async () => onDone?.(await complete(i))} />
            <div className="grow">
              <div className="title">
                <span className="area" title={i.area}>
                  {AREA_ICON[i.area]}
                </span>{' '}
                {i.title}
                {i.priority === 'high' && <span className="pill hot">High</span>}
              </div>
              <div className="meta">
                <span className={overdue ? 'warn' : ''}>{relativeLabel(i.date, t)}</span>
                {i.missed.length > 0 && <span className="warn"> · missed {i.missed.length} more before</span>}
                {i.detail && <span> · {i.detail}</span>}
              </div>
            </div>
            {i.amount ? <div className="amount">{money(i.amount)}</div> : null}
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

export function groupAgenda(items: AgendaItem[]) {
  const t = today();
  return {
    overdue: items.filter((i) => i.date < t),
    today: items.filter((i) => i.date === t),
    week: items.filter((i) => i.date > t && diffDays(i.date, t) <= 7),
    later: items.filter((i) => diffDays(i.date, t) > 7),
  };
}

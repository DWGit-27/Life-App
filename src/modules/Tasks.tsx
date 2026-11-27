import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AgendaList, groupAgenda, useSources, useUndo } from '../components/Agenda';
import { CrudList, useRows } from '../components/Crud';
import { AREAS, save, type Area, type Objective, type Task } from '../db';
import { buildAgenda } from '../agenda';
import { describeSchedule } from '../lib/schedule';
import { agoLabel, diffDays, formatDate, relativeLabel, today } from '../lib/dates';
import { openEdit } from '../registry';
import { parseQuickAdd } from '../lib/quickadd';
import { showToast } from '../toast';
import { db, type Completion } from '../db';
import { useRows as useRows2 } from '../components/Crud';

function QuickPreview({ text }: { text: string }) {
  const q = parseQuickAdd(text, today());
  const bits = [q.anytime ? 'Anytime' : q.date ? relativeLabel(q.date) : 'Today', q.area, q.priority === 'high' && 'High priority', q.priority === 'low' && 'Low priority', q.focus && '⭐ Focus'].filter(Boolean);
  return (
    <p className="muted small-text quick-preview">
      → <b>{q.title || '…'}</b> · {bits.join(' · ')}
    </p>
  );
}

const SOURCE_LABEL: Record<string, string> = { task: 'Task', bill: 'Bill', policy: 'Insurance', house: 'House', loan: 'Loan', workout: 'Workout', warranty: 'Warranty', investment: 'Investment' };

/** Recently completed items, newest first, with undo. */
function Done() {
  const completions = useRows2<Completion>('completions');
  const tasks = useRows2<Task>('tasks');
  const names = useLiveQuery(async () => {
    const m = new Map<string, string>();
    for (const b of await db.bills.toArray()) m.set(b.id, `Pay ${b.name}`);
    for (const p of await db.policies.toArray()) m.set(p.id, `Renew ${p.name}`);
    for (const h of await db.house.toArray()) m.set(h.id, h.title);
    for (const l of await db.loans.toArray()) m.set(l.id, `${l.name} payment`);
    for (const p of await db.plans.toArray()) m.set(p.id, `Workout: ${p.name}`);
    for (const i of await db.inventory.toArray()) m.set(i.id, `Warranty: ${i.name}`);
    return m;
  }, []);
  for (const t of tasks) names?.set(t.id, t.title);
  const recent = [...completions].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 50);
  if (!recent.length) return <div className="empty">Things you tick off show up here, so you can undo them.</div>;
  return (
    <ul className="cards">
      {recent.map((c) => (
        <li key={c.id} className="card">
          <div className="row">
            <div className="grow">
              <b>✓ {names?.get(c.sourceId.split(':')[0]) ?? 'Item'}</b>
              <div className="meta">
                {SOURCE_LABEL[c.source]} · done {agoLabel(c.completedOn)}
                {c.date !== 'anytime' && c.date !== c.completedOn && ` · was due ${formatDate(c.date)}`}
              </div>
            </div>
            <button onClick={() => db.completions.update(c.id, { deleted: 1, updatedAt: Date.now() })}>Undo</button>
          </div>
        </li>
      ))}
    </ul>
  );
}

type Tab = 'due' | 'mine' | 'objectives' | 'done';

export function objectiveProgress(o: Objective, tasks: Task[], doneIds: Set<string>) {
  const linked = tasks.filter((t) => t.objectiveId === o.id);
  const finite = linked.filter((t) => !t.schedule?.start || t.schedule.freq === 'once');
  return { linked, done: finite.filter((t) => doneIds.has(t.id)).length, total: finite.length };
}

export default function Tasks({ sub, setSub }: { sub?: string; setSub: (s: string) => void }) {
  const tab: Tab = sub === 'mine' || sub === 'objectives' || sub === 'done' ? sub : 'due';
  const s = useSources();
  const objectives = useRows<Objective>('objectives');
  const [horizon, setHorizon] = useState(14);
  const [area, setArea] = useState<Area | ''>('');
  const [quick, setQuick] = useState('');
  const t = today();
  const items = useMemo(() => buildAgenda(s, t, horizon).filter((i) => !area || i.area === area), [s, t, horizon, area]);
  const g = groupAgenda(items);
  const { onDone, toast } = useUndo();
  const doneIds = new Set(s.completions.filter((c) => c.source === 'task').map((c) => c.sourceId));
  const open = s.tasks.filter((x) => !(x.schedule?.freq === 'once' && doneIds.has(x.id)) && !(!x.schedule && doneIds.has(x.id)));
  const mine = open.filter((x) => !area || x.area === area);
  const objName = new Map(objectives.map((o) => [o.id, o.title]));

  return (
    <div className="page">
      <h1>Tasks & objectives</h1>
      <form
        className="quick"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!quick.trim()) return;
          const q = parseQuickAdd(quick, t);
          if (!q.title) return;
          await save<Task>('tasks', {
            title: q.title,
            area: (q.area || area || 'Personal') as Area,
            priority: q.priority ?? 'normal',
            focus: q.focus,
            schedule: q.anytime ? undefined : { freq: 'once', interval: 1, start: q.date ?? t },
          });
          showToast(`Added "${q.title}"${q.anytime ? ' (anytime)' : q.date && q.date !== t ? ` for ${relativeLabel(q.date, t).toLowerCase()}` : ' for today'}`);
          setQuick('');
        }}
      >
        <input id="quick-add" value={quick} onChange={(e) => setQuick(e.target.value)} placeholder="Quick add… e.g. Call plumber tomorrow !high #home" />
        <button className="primary">Add</button>
      </form>
      {quick && <QuickPreview text={quick} />}
      <div className="tabs">
        <button className={tab === 'due' ? 'on' : ''} onClick={() => setSub('due')}>
          Everything due
        </button>
        <button className={tab === 'mine' ? 'on' : ''} onClick={() => setSub('mine')}>
          My tasks
        </button>
        <button className={tab === 'objectives' ? 'on' : ''} onClick={() => setSub('objectives')}>
          Objectives
        </button>
        <button className={tab === 'done' ? 'on' : ''} onClick={() => setSub('done')}>
          Done
        </button>
        <span className="grow" />
        {(tab === 'due' || tab === 'mine') && (
          <select value={area} onChange={(e) => setArea(e.target.value as Area | '')} aria-label="Filter by area">
            <option value="">All areas</option>
            {AREAS.map((a) => (
              <option key={a}>{a}</option>
            ))}
          </select>
        )}
        {tab === 'due' && (
          <select value={horizon} onChange={(e) => setHorizon(Number(e.target.value))} aria-label="How far ahead">
            <option value={7}>Next 7 days</option>
            <option value={14}>Next 2 weeks</option>
            <option value={31}>Next month</option>
            <option value={92}>Next 3 months</option>
            <option value={366}>Next year</option>
          </select>
        )}
      </div>
      {tab === 'due' && (
        <>
          <p className="muted">Everything from your tasks, bills, insurance, house, loans and workouts. Tap an item to edit it, ⏰ to move it.</p>
          {g.overdue.length > 0 && (
            <>
              <h2 className="warn">Overdue</h2>
              <AgendaList items={g.overdue} onDone={onDone} />
            </>
          )}
          <h2>Today</h2>
          <AgendaList items={g.today} emptyText="Nothing due today." onDone={onDone} />
          <h2>This week</h2>
          <AgendaList items={g.week} emptyText="Nothing this week." onDone={onDone} />
          {g.later.length > 0 && (
            <>
              <h2>Later</h2>
              <AgendaList items={g.later} onDone={onDone} />
            </>
          )}
          <Anytime tasks={mine.filter((x) => !x.schedule?.start)} />
        </>
      )}
      {tab === 'mine' && (
        <CrudList<Task>
          table="tasks"
          rows={mine}
          defaults={() => ({ area: (area || 'Personal') as Area, priority: 'normal' })}
          sort={(a, b) => (objName.get(a.objectiveId ?? '') ?? a.project ?? '~').localeCompare(objName.get(b.objectiveId ?? '') ?? b.project ?? '~') || (a.schedule?.start ?? '~').localeCompare(b.schedule?.start ?? '~')}
          empty="No tasks yet. Use quick add above, or add one with a schedule and steps."
          renderRow={(x) => (
            <div className="row">
              <div className="grow">
                <b>{x.title}</b>
                <div className="meta">
                  {[
                    x.area,
                    objName.get(x.objectiveId ?? '') && `🎯 ${objName.get(x.objectiveId!)}`,
                    x.project,
                    x.schedule?.start ? (x.schedule.freq === 'once' ? relativeLabel(x.schedule.start) : describeSchedule(x.schedule)) : 'Anytime',
                    x.checklist?.length && `☑ ${x.checklist.filter((c) => c.done).length}/${x.checklist.length}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </div>
              </div>
              {x.priority === 'high' && <span className="pill hot">High</span>}
            </div>
          )}
        />
      )}
      {tab === 'done' && <Done />}
      {tab === 'objectives' && <Objectives objectives={objectives} tasks={s.tasks} doneIds={doneIds} />}
      {toast}
    </div>
  );
}

function Anytime({ tasks }: { tasks: Task[] }) {
  if (!tasks.length) return null;
  return (
    <>
      <h2>Anytime</h2>
      <ul className="agenda">
        {tasks.map((x) => (
          <li key={x.id}>
            <div className="agenda-row">
              <button className="tick" aria-label={`Mark ${x.title} done`} onClick={() => save('completions', { source: 'task', sourceId: x.id, date: 'anytime', completedOn: today() } as any)} />
              <button className="agenda-body" onClick={() => openEdit({ table: 'tasks', id: x.id })}>
                <div className="title">{x.title}</div>
                <div className="meta">{[x.area, x.project].filter(Boolean).join(' · ')}</div>
              </button>
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function Objectives({ objectives, tasks, doneIds }: { objectives: Objective[]; tasks: Task[]; doneIds: Set<string> }) {
  const t = today();
  const order = { active: 0, paused: 1, done: 2 } as const;
  return (
    <CrudList<Objective>
      table="objectives"
      rows={objectives}
      sort={(a, b) => order[a.status] - order[b.status] || (a.targetDate ?? '~').localeCompare(b.targetDate ?? '~')}
      empty="Objectives are bigger goals, like 'Run a 10k by June' or 'Pay off the car loan'. Link tasks to them to track progress."
      renderRow={(o) => {
        const p = objectiveProgress(o, tasks, doneIds);
        const pct = p.total ? (p.done / p.total) * 100 : o.status === 'done' ? 100 : 0;
        const days = o.targetDate ? diffDays(o.targetDate, t) : undefined;
        return (
          <div>
            <div className="row">
              <b className="grow">
                🎯 {o.title}
                {o.status !== 'active' && <span className="pill">{o.status === 'done' ? 'Done' : 'Paused'}</span>}
              </b>
              <span className="muted">{o.area}</span>
            </div>
            {o.why && <div className="meta">{o.why}</div>}
            <div className="bar">
              <i style={{ width: `${pct}%` }} />
            </div>
            <div className="meta">
              {p.total ? `${p.done} of ${p.total} tasks done` : 'No tasks linked yet'}
              {o.targetDate && ` · target ${formatDate(o.targetDate)}`}
              {days !== undefined && o.status === 'active' && (days < 0 ? <span className="warn"> · {-days} days past target</span> : ` · ${days} days left`)}
            </div>
            <button
              className="link"
              onClick={(e) => {
                e.stopPropagation();
                openEdit({ table: 'tasks', initial: { area: o.area, priority: 'normal', objectiveId: o.id } });
              }}
            >
              + Add a task to this
            </button>
          </div>
        );
      }}
    />
  );
}

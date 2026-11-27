import { useMemo, useState } from 'react';
import { AgendaList, groupAgenda, useSources, useUndo } from '../components/Agenda';
import { CrudList, useRows } from '../components/Crud';
import { AREAS, save, type Area, type Objective, type Task } from '../db';
import { buildAgenda } from '../agenda';
import { describeSchedule } from '../lib/schedule';
import { diffDays, formatDate, relativeLabel, today } from '../lib/dates';
import { openEdit } from '../registry';

type Tab = 'due' | 'mine' | 'objectives';

export function objectiveProgress(o: Objective, tasks: Task[], doneIds: Set<string>) {
  const linked = tasks.filter((t) => t.objectiveId === o.id);
  const finite = linked.filter((t) => !t.schedule?.start || t.schedule.freq === 'once');
  return { linked, done: finite.filter((t) => doneIds.has(t.id)).length, total: finite.length };
}

export default function Tasks({ sub, setSub }: { sub?: string; setSub: (s: string) => void }) {
  const tab: Tab = sub === 'mine' || sub === 'objectives' ? sub : 'due';
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
          await save<Task>('tasks', { title: quick.trim(), area: (area || 'Personal') as Area, schedule: { freq: 'once', interval: 1, start: t } });
          setQuick('');
        }}
      >
        <input value={quick} onChange={(e) => setQuick(e.target.value)} placeholder="Quick add a task for today…" />
        <button className="primary">Add</button>
      </form>
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
        <span className="grow" />
        {tab !== 'objectives' && (
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

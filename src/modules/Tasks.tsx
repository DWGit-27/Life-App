import { useMemo, useState } from 'react';
import { AgendaList, groupAgenda, useSources, useUndo } from '../components/Agenda';
import { CrudList } from '../components/Crud';
import type { FieldSpec } from '../components/Form';
import { AREAS, save, type Area, type Task } from '../db';
import { buildAgenda } from '../agenda';
import { describeSchedule } from '../lib/schedule';
import { relativeLabel, today } from '../lib/dates';

export const taskFields: FieldSpec[] = [
  { key: 'title', label: 'Task', type: 'text', required: true },
  { key: 'area', label: 'Area', type: 'select', options: AREAS, required: true },
  { key: 'project', label: 'Project', type: 'text', placeholder: 'e.g. Q1 report', hint: 'Group work tasks by project' },
  { key: 'schedule', label: 'When', type: 'schedule', optional: true, hint: 'Leave the date empty for an "anytime" task' },
  { key: 'priority', label: 'Priority', type: 'select', options: ['low', 'normal', 'high'] },
  { key: 'notes', label: 'Notes', type: 'textarea' },
];

export default function Tasks() {
  const s = useSources();
  const [horizon, setHorizon] = useState(14);
  const [area, setArea] = useState<Area | ''>('');
  const [tab, setTab] = useState<'agenda' | 'mine'>('agenda');
  const [quick, setQuick] = useState('');
  const t = today();
  const items = useMemo(() => buildAgenda(s, t, horizon).filter((i) => !area || i.area === area), [s, t, horizon, area]);
  const g = groupAgenda(items);
  const { onDone, toast } = useUndo();
  const mine = s.tasks.filter((x) => !area || x.area === area);
  const doneOnce = new Set(s.completions.filter((c) => c.source === 'task').map((c) => c.sourceId));
  const projects = [...new Set(s.tasks.filter((x) => x.project).map((x) => x.project!))];

  return (
    <div className="page">
      <h1>Tasks</h1>
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
        <button className={tab === 'agenda' ? 'on' : ''} onClick={() => setTab('agenda')}>
          Everything due
        </button>
        <button className={tab === 'mine' ? 'on' : ''} onClick={() => setTab('mine')}>
          My tasks & projects
        </button>
        <span className="grow" />
        <select value={area} onChange={(e) => setArea(e.target.value as Area | '')} aria-label="Filter by area">
          <option value="">All areas</option>
          {AREAS.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
        {tab === 'agenda' && (
          <select value={horizon} onChange={(e) => setHorizon(Number(e.target.value))} aria-label="How far ahead">
            <option value={7}>Next 7 days</option>
            <option value={14}>Next 2 weeks</option>
            <option value={31}>Next month</option>
            <option value={92}>Next 3 months</option>
            <option value={366}>Next year</option>
          </select>
        )}
      </div>
      {tab === 'agenda' ? (
        <>
          <p className="muted">Pulled from your tasks, bills, insurance renewals, house jobs and loan payments.</p>
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
        </>
      ) : (
        <CrudList<Task>
          table="tasks"
          rows={mine.filter((x) => !(x.schedule?.freq === 'once' && doneOnce.has(x.id)))}
          noun="task"
          fields={taskFields.map((f) => (f.key === 'project' ? { ...f, placeholder: projects.length ? projects.join(', ') : f.placeholder } : f))}
          defaults={() => ({ area: (area || 'Personal') as Area, priority: 'normal' })}
          sort={(a, b) => (a.project ?? '~').localeCompare(b.project ?? '~') || (a.schedule?.start ?? '~').localeCompare(b.schedule?.start ?? '~')}
          empty="No tasks yet. Use quick add above, or add one with a schedule."
          renderRow={(x) => (
            <div className="row">
              <div className="grow">
                <b>{x.title}</b>
                <div className="meta">
                  {x.area}
                  {x.project && ` · ${x.project}`}
                  {x.schedule?.start ? ` · ${x.schedule.freq === 'once' ? relativeLabel(x.schedule.start) : describeSchedule(x.schedule)}` : ' · Anytime'}
                </div>
              </div>
              {x.priority === 'high' && <span className="pill hot">High</span>}
            </div>
          )}
        />
      )}
      {toast}
    </div>
  );
}

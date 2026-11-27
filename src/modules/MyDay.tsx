import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AgendaList, groupAgenda, useAgenda, useSources, useUndo } from '../components/Agenda';
import { useRows } from '../components/Crud';
import { db, type BudgetLine, type Investment, type Objective, type WorkoutPlan } from '../db';
import { monthlyTotals } from './Money';
import { objectiveProgress } from './Tasks';
import { logFromPlan } from './Health';
import { addDays, diffDays, parseISO, today } from '../lib/dates';
import { money } from '../lib/format';
import type { Page } from '../App';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

export default function MyDay({ go }: { go: (p: Page, sub?: string) => void }) {
  const items = useAgenda(7);
  const [day, setDay] = useState<string | null>(null);
  const g = groupAgenda(items);
  const { onDone, toast } = useUndo();
  const s = useSources();
  const budget = useRows<BudgetLine>('budget');
  const investments = useRows<Investment>('investments');
  const objectives = useRows<Objective>('objectives');
  const plans = useRows<WorkoutPlan>('plans');
  const lastBackup = useLiveQuery(() => db.settings.get('lastBackup'), [])?.value as number | undefined;
  const m = monthlyTotals(budget, s.bills, s.loans, investments);
  const t = today();
  const hasAny = s.tasks.length + s.bills.length + s.policies.length + s.house.length + s.loans.length + plans.length > 0;
  const doneIds = new Set(s.completions.filter((c) => c.source === 'task').map((c) => c.sourceId));
  const active = objectives.filter((o) => o.status === 'active').slice(0, 3);
  const todaysWorkouts = items.filter((i) => i.source === 'workout' && i.date <= t);
  const backupDays = lastBackup ? Math.floor((Date.now() - lastBackup) / 86400000) : undefined;

  // week strip: today + 6 days
  const days = Array.from({ length: 7 }, (_, i) => addDays(t, i));
  const counts = new Map<string, number>();
  for (const i of items) {
    const d = i.date < t ? t : i.date;
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  const selected = day ? items.filter((i) => i.date === day || (day === t && i.date < t)) : null;

  return (
    <div className="page">
      <p className="muted hello">{greeting()}</p>
      <h1>{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</h1>
      {!hasAny && (
        <div className="card intro">
          <p>
            <b>Welcome.</b> Add your bills, insurance, house jobs, loans, workouts and tasks, and everything that needs doing shows up here. You can also load some
            example data in Settings to try it out.
          </p>
          <button className="primary" onClick={() => go('settings')}>
            Open Settings
          </button>
        </div>
      )}
      <div className="week" role="tablist" aria-label="This week">
        {days.map((d) => {
          const n = counts.get(d) ?? 0;
          const dt = parseISO(d);
          return (
            <button key={d} role="tab" aria-selected={day === d} className={`${day === d ? 'on' : ''} ${d === t ? 'today' : ''}`} onClick={() => setDay(day === d ? null : d)}>
              <span>{dt.toLocaleDateString('en-GB', { weekday: 'short' })}</span>
              <b>{dt.getDate()}</b>
              <i className={n ? 'dots' : 'dots none'}>{n || '·'}</i>
            </button>
          );
        })}
      </div>
      {selected ? (
        <>
          <h2>
            {day === t ? 'Today' : parseISO(day!).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })}{' '}
            <button className="link" onClick={() => setDay(null)}>
              show all
            </button>
          </h2>
          <AgendaList items={selected} emptyText="Nothing on this day." onDone={onDone} />
        </>
      ) : (
        <>
          <div className="stats">
            <button className="stat" onClick={() => go('tasks')}>
              <span>Overdue</span>
              <b className={g.overdue.length ? 'warn' : ''}>{g.overdue.length}</b>
            </button>
            <button className="stat" onClick={() => go('tasks')}>
              <span>Due today</span>
              <b>{g.today.length}</b>
            </button>
            <button className="stat" onClick={() => go('money')}>
              <span>Left this month</span>
              <b className={m.left < 0 ? 'warn' : ''}>{money(m.left, { decimals: false })}</b>
            </button>
          </div>
          {backupDays !== undefined ? (
            backupDays >= 14 && (
              <div className="card nudge">
                💾 Last backup was {backupDays} days ago.{' '}
                <button className="link" onClick={() => go('settings')}>
                  Back up now
                </button>
              </div>
            )
          ) : (
            hasAny && (
              <div className="card nudge">
                💾 Your data lives on this device only, so download a backup now and then.{' '}
                <button className="link" onClick={() => go('settings')}>
                  Back up now
                </button>
              </div>
            )
          )}
          {todaysWorkouts.length > 0 && (
            <div className="card workout-today">
              <div className="row wrap">
                <span className="grow">
                  💪 Today's workout: <b>{todaysWorkouts.map((w) => w.title.replace('Workout: ', '')).join(', ')}</b>
                </span>
                {todaysWorkouts.map((w) => {
                  const plan = plans.find((p) => p.id === w.recordId);
                  return plan ? (
                    <button key={w.key} className="primary" onClick={() => logFromPlan(plan)}>
                      Log {plan.name}
                    </button>
                  ) : null;
                })}
              </div>
            </div>
          )}
          {g.overdue.length > 0 && (
            <>
              <h2 className="warn">Overdue</h2>
              <AgendaList items={g.overdue} onDone={onDone} />
            </>
          )}
          <h2>Today</h2>
          <AgendaList items={g.today} emptyText="Nothing due today. 🎉" onDone={onDone} />
          <h2>Next 7 days</h2>
          <AgendaList items={g.week} emptyText="Nothing in the next week." onDone={onDone} />
          {active.length > 0 && (
            <>
              <h2>Objectives</h2>
              <ul className="cards">
                {active.map((o) => {
                  const p = objectiveProgress(o, s.tasks, doneIds);
                  return (
                    <li key={o.id} className="card clickable" onClick={() => go('tasks', 'objectives')}>
                      <div className="row">
                        <b className="grow">🎯 {o.title}</b>
                        <span className="muted">{p.total ? `${p.done}/${p.total}` : ''}</span>
                      </div>
                      <div className="bar">
                        <i style={{ width: `${p.total ? (p.done / p.total) * 100 : 0}%` }} />
                      </div>
                      {o.targetDate && <div className="meta">{diffDays(o.targetDate, t)} days to target</div>}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </>
      )}
      {toast}
    </div>
  );
}

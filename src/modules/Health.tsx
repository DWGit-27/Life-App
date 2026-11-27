import { CrudList, useRows } from '../components/Crud';
import type { WorkoutLog, WorkoutPlan } from '../db';
import { describeSchedule, nextOccurrence } from '../lib/schedule';
import { addDays, diffDays, formatDate, parseISO, relativeLabel, toISO, today } from '../lib/dates';
import { openEdit } from '../registry';

const FEEL = ['', '😫', '😕', '🙂', '😀', '🔥'];

/** Monday of the week containing d. */
function weekStart(d: string) {
  const x = parseISO(d);
  const dow = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - dow);
  return toISO(x);
}

/** Consecutive weeks (ending this week or last) with at least one workout. */
export function weekStreak(logs: WorkoutLog[], t: string) {
  const weeks = new Set(logs.map((l) => weekStart(l.date)));
  let w = weekStart(t);
  if (!weeks.has(w)) w = addDays(w, -7);
  let n = 0;
  while (weeks.has(w)) {
    n++;
    w = addDays(w, -7);
  }
  return n;
}

export function logFromPlan(p: WorkoutPlan) {
  openEdit({ table: 'workouts', initial: { name: p.name, planId: p.id, date: today(), entries: p.exercises.map((e) => ({ ...e })) } });
}

type Tab = 'plans' | 'log' | 'records';

export default function Health({ sub, setSub }: { sub?: string; setSub: (s: string) => void }) {
  const tab: Tab = sub === 'log' || sub === 'records' ? sub : 'plans';
  const plans = useRows<WorkoutPlan>('plans');
  const logs = useRows<WorkoutLog>('workouts');
  const t = today();
  const thisWeek = logs.filter((l) => l.date >= weekStart(t)).length;
  const last30 = logs.filter((l) => diffDays(t, l.date) < 30);
  const minutes30 = last30.reduce((a, l) => a + (l.minutes || 0), 0);
  const streak = weekStreak(logs, t);

  // personal bests: heaviest weight per exercise
  const pbs = new Map<string, { weight: number; date: string; reps?: string }>();
  for (const l of logs)
    for (const e of l.entries ?? [])
      if (e.name && e.weight) {
        const k = e.name.trim().toLowerCase();
        const cur = pbs.get(k);
        if (!cur || e.weight > cur.weight) pbs.set(k, { weight: e.weight, date: l.date, reps: e.reps });
      }

  return (
    <div className="page">
      <h1>Health</h1>
      <div className="stats">
        <div className="stat">
          <span>This week</span>
          <b>{thisWeek} workouts</b>
        </div>
        <div className="stat">
          <span>Weekly streak</span>
          <b className={streak ? 'good' : ''}>{streak ? `🔥 ${streak} wk` : '—'}</b>
        </div>
        <div className="stat">
          <span>Last 30 days</span>
          <b>
            {last30.length} · {Math.round(minutes30 / 60)}h
          </b>
        </div>
      </div>
      <div className="tabs">
        <button className={tab === 'plans' ? 'on' : ''} onClick={() => setSub('plans')}>
          Gym planner
        </button>
        <button className={tab === 'log' ? 'on' : ''} onClick={() => setSub('log')}>
          Workout log
        </button>
        <button className={tab === 'records' ? 'on' : ''} onClick={() => setSub('records')}>
          Personal bests
        </button>
      </div>
      {tab === 'plans' && (
        <CrudList<WorkoutPlan>
          table="plans"
          rows={plans}
          defaults={() => ({ exercises: [], schedule: { freq: 'weekly', interval: 1, start: t } })}
          sort={(a, b) => (a.schedule ? nextOccurrence(a.schedule, t) ?? '~' : '~').localeCompare(b.schedule ? nextOccurrence(b.schedule, t) ?? '~' : '~')}
          empty="Plan your sessions (e.g. Push, Pull, Legs, 5k run) with exercises, sets and weights. Scheduled ones show up in My Day."
          renderRow={(p) => {
            const next = p.schedule && nextOccurrence(p.schedule, t);
            return (
              <div className="row">
                <div className="grow">
                  <b>{p.name}</b>
                  <div className="meta">{[p.schedule && describeSchedule(p.schedule), next && `next ${relativeLabel(next, t).toLowerCase()}`].filter(Boolean).join(' · ')}</div>
                  {p.exercises.length > 0 && (
                    <div className="meta">
                      {p.exercises
                        .slice(0, 4)
                        .map((e) => `${e.name}${e.sets ? ` ${e.sets}×${e.reps ?? ''}` : ''}${e.weight ? ` @${e.weight}kg` : ''}`)
                        .join(' · ')}
                      {p.exercises.length > 4 && ` +${p.exercises.length - 4}`}
                    </div>
                  )}
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    logFromPlan(p);
                  }}
                >
                  Log it
                </button>
              </div>
            );
          }}
        />
      )}
      {tab === 'log' && (
        <CrudList<WorkoutLog>
          table="workouts"
          rows={logs}
          noun="workout"
          defaults={() => ({ date: t, entries: [] })}
          sort={(a, b) => b.date.localeCompare(a.date)}
          empty="Log a workout here, or tap Log it on a plan to start from its exercises."
          renderRow={(l) => (
            <div className="row">
              <div className="grow">
                <b>{l.name}</b> {l.feeling ? FEEL[l.feeling] : ''}
                <div className="meta">{[formatDate(l.date), l.minutes && `${l.minutes} min`, l.entries?.length && `${l.entries.length} exercises`].filter(Boolean).join(' · ')}</div>
              </div>
            </div>
          )}
        />
      )}
      {tab === 'records' &&
        (pbs.size === 0 ? (
          <div className="empty">Log workouts with weights and your heaviest lift per exercise shows up here.</div>
        ) : (
          <ul className="cards">
            {[...pbs.entries()]
              .sort((a, b) => a[0].localeCompare(b[0]))
              .map(([k, v]) => (
                <li key={k} className="card">
                  <div className="row">
                    <b className="grow" style={{ textTransform: 'capitalize' }}>
                      {k}
                    </b>
                    <span className="amount">{v.weight} kg</span>
                  </div>
                  <div className="meta">
                    {v.reps && `${v.reps} reps · `}
                    {formatDate(v.date)}
                  </div>
                </li>
              ))}
          </ul>
        ))}
    </div>
  );
}

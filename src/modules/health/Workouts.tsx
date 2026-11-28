import { useState } from 'react';
import { CrudList, useRows } from '../../components/Crud';
import { BarChart, Heatmap, LineChart } from '../../components/Charts';
import { save, type WorkoutLog, type WorkoutPlan } from '../../db';
import { addDays, diffDays, formatDate, parseISO, relativeLabel, today } from '../../lib/dates';
import { describeSchedule, nextOccurrence, occurrences } from '../../lib/schedule';
import { exerciseHistory, exKey, muscleOf, MUSCLES, pace, personalBests, PROGRAMMES, volume, weeklyTotals, weekStart, type Programme } from '../../lib/fitness';
import { openEdit } from '../../registry';
import { showToast } from '../../toast';
import { startWorkout } from './LiveWorkout';
import { setGoals, useGoals } from './Food';

const FEEL = ['', '😫', '😕', '🙂', '😀', '🔥'];

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

export function quickLog(p: WorkoutPlan) {
  openEdit({ table: 'workouts', initial: { name: p.name, planId: p.id, date: today(), entries: p.exercises.map((e) => ({ ...e })), kind: p.exercises.some((e) => muscleOf(e.name) === 'Cardio') ? 'cardio' : 'strength' } });
}

/* ---------------- This week ---------------- */
export function WorkoutWeek() {
  const plans = useRows<WorkoutPlan>('plans');
  const logs = useRows<WorkoutLog>('workouts');
  const goals = useGoals();
  const t = today();
  const ws = weekStart(t);
  const thisWeek = logs.filter((l) => l.date >= ws);
  const streak = weekStreak(logs, t);
  const mins = thisWeek.reduce((a, l) => a + (l.minutes || 0), 0);
  const vol = thisWeek.reduce((a, l) => a + volume(l.entries ?? []), 0);
  const pct = Math.min(100, (thisWeek.length / goals.workoutsPerWeek) * 100);
  const upcoming = plans
    .flatMap((p) => (p.schedule ? occurrences(p.schedule, t, addDays(t, 6)).map((d) => ({ p, d })) : []))
    .filter(({ p, d }) => !(d === t && thisWeek.some((l) => l.planId === p.id && l.date === t)))
    .sort((a, b) => a.d.localeCompare(b.d));
  const perDay = new Map<string, number>();
  for (const l of logs) perDay.set(l.date, (perDay.get(l.date) ?? 0) + 1);

  return (
    <>
      <section className="card goal-card">
        <div className="ring" style={{ ['--p' as any]: `${pct}%` }} role="img" aria-label={`${thisWeek.length} of ${goals.workoutsPerWeek} workouts this week`}>
          <b>{thisWeek.length}</b>
          <span>of {goals.workoutsPerWeek}</span>
        </div>
        <div className="grow">
          <h2>This week</h2>
          <p className="muted">
            {thisWeek.length >= goals.workoutsPerWeek ? '🎉 Weekly goal hit!' : `${goals.workoutsPerWeek - thisWeek.length} more to hit your goal`}
            {streak > 0 && ` · 🔥 ${streak}-week streak`}
          </p>
          <p className="muted small-text">
            {mins} min{vol ? ` · ${Math.round(vol).toLocaleString('en-GB')} kg lifted` : ''}
          </p>
          <div className="row wrap">
            <span className="muted small-text">Goal per week:</span>
            {[2, 3, 4, 5, 6].map((n) => (
              <button key={n} className={`small ${goals.workoutsPerWeek === n ? 'primary' : ''}`} onClick={() => setGoals({ workoutsPerWeek: n })}>
                {n}
              </button>
            ))}
          </div>
        </div>
      </section>
      <div className="row wrap toolbar">
        <button className="primary" onClick={() => startWorkout()}>
          ▶ Start an empty workout
        </button>
        <button onClick={() => openEdit({ table: 'workouts', initial: { date: t, entries: [], kind: 'cardio', name: 'Run' } })}>🏃 Log cardio</button>
      </div>
      <h2>Coming up</h2>
      {upcoming.length === 0 ? (
        <div className="empty">Nothing planned this week. Add a plan or pick a ready-made programme in Plans.</div>
      ) : (
        <ul className="cards">
          {upcoming.map(({ p, d }) => (
            <li key={p.id + d} className="card">
              <div className="row wrap">
                <div className="grow">
                  <b>{p.name}</b>
                  <div className="meta">
                    {relativeLabel(d, t)} · {p.exercises.length} exercises
                    {p.exercises.length > 0 && ` · ${[...new Set(p.exercises.map((e) => muscleOf(e.name)).filter(Boolean))].slice(0, 3).join(', ')}`}
                  </div>
                </div>
                {d === t ? (
                  <button className="primary" onClick={() => startWorkout(p)}>
                    ▶ Start
                  </button>
                ) : (
                  <button onClick={() => startWorkout(p)}>▶ Start now</button>
                )}
                <button onClick={() => quickLog(p)}>Quick log</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <h2>Last 12 weeks</h2>
      <section className="card">
        <Heatmap end={t} weeks={12} values={perDay} label={(d, v) => `${formatDate(d)}: ${v ? `${v} workout${v > 1 ? 's' : ''}` : 'rest day'}`} />
      </section>
    </>
  );
}

/* ---------------- Plans + programmes ---------------- */
async function addProgramme(pr: Programme) {
  const t = today();
  const dow = ((parseISO(t).getDay() + 6) % 7) + 1; // 1=Mon
  for (const d of pr.days) {
    const start = addDays(t, (d.weekday - dow + 7) % 7);
    await save<WorkoutPlan>('plans', { name: d.name, schedule: { freq: 'weekly', interval: 1, start }, exercises: d.exercises, notes: `From the ${pr.name} programme` });
  }
  showToast(`Added ${pr.days.length} sessions from ${pr.name}`);
}

export function WorkoutPlans() {
  const plans = useRows<WorkoutPlan>('plans');
  const t = today();
  const [showProg, setShowProg] = useState(plans.length === 0);
  return (
    <>
      <CrudList<WorkoutPlan>
        table="plans"
        rows={plans}
        defaults={() => ({ exercises: [], schedule: { freq: 'weekly', interval: 1, start: t } })}
        sort={(a, b) => (a.schedule ? nextOccurrence(a.schedule, t) ?? '~' : '~').localeCompare(b.schedule ? nextOccurrence(b.schedule, t) ?? '~' : '~')}
        empty="Plan your sessions with exercises, sets and weights, or start from a programme below."
        renderRow={(p) => {
          const next = p.schedule && nextOccurrence(p.schedule, t);
          return (
            <div className="row wrap">
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
                className="primary small"
                onClick={(e) => {
                  e.stopPropagation();
                  startWorkout(p);
                }}
              >
                ▶ Start
              </button>
            </div>
          );
        }}
      />
      <div className="row h2row">
        <h2 className="grow">Ready-made programmes</h2>
        <button className="small" onClick={() => setShowProg(!showProg)}>
          {showProg ? 'Hide' : 'Show'}
        </button>
      </div>
      {showProg && (
        <div className="prog-grid">
          {PROGRAMMES.map((pr) => (
            <section key={pr.name} className="card">
              <b>{pr.name}</b>
              <p className="meta">{pr.about}</p>
              <ul className="meta prog-days">
                {pr.days.map((d) => (
                  <li key={d.name}>
                    <b>{d.name}</b>: {d.exercises.map((e) => e.name).join(', ')}
                  </li>
                ))}
              </ul>
              <button onClick={() => addProgramme(pr)}>+ Add to my plans</button>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

/* ---------------- Log ---------------- */
export function WorkoutLogList() {
  const logs = useRows<WorkoutLog>('workouts');
  const t = today();
  const byMonth = (l: WorkoutLog) => parseISO(l.date).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  return (
    <CrudList<WorkoutLog>
      table="workouts"
      rows={logs}
      noun="workout"
      defaults={() => ({ date: t, entries: [], kind: 'strength' })}
      sort={(a, b) => b.date.localeCompare(a.date)}
      groupBy={byMonth}
      groupExtra={(rs) => <span className="muted">{rs.length} workouts</span>}
      empty="Workouts you finish or log show up here."
      renderRow={(l) => {
        const vol = volume(l.entries ?? []);
        return (
          <div className="row">
            <div className="grow">
              <b>{l.name}</b> {l.feeling ? FEEL[l.feeling] : ''}
              <div className="meta">
                {[
                  formatDate(l.date),
                  l.minutes && `${l.minutes} min`,
                  l.distanceKm && `${l.distanceKm} km`,
                  pace(l.minutes, l.distanceKm),
                  l.entries?.length && `${l.entries.length} exercises`,
                  vol && `${Math.round(vol).toLocaleString('en-GB')} kg`,
                ]
                  .filter(Boolean)
                  .join(' · ')}
              </div>
            </div>
          </div>
        );
      }}
    />
  );
}

/* ---------------- Progress ---------------- */
export function WorkoutProgress() {
  const logs = useRows<WorkoutLog>('workouts');
  const t = today();
  const names = [...new Map(logs.flatMap((l) => l.entries ?? []).filter((e) => e.name?.trim() && (e.weight || e.setsDone?.length)).map((e) => [exKey(e.name), e.name.trim()])).values()].sort();
  const [pick, setPick] = useState<string>('');
  const name = pick || names[0] || '';
  const hist = name ? exerciseHistory(logs, name) : [];
  const weeks = weeklyTotals(logs, t, 12);
  const wkLabel = (d: string) => parseISO(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  const cardio = logs.filter((l) => l.distanceKm).sort((a, b) => a.date.localeCompare(b.date));
  return (
    <>
      <section className="card">
        <h2>Workouts per week</h2>
        <BarChart ariaLabel="Workouts per week, last 12 weeks" data={weeks.map((w) => ({ label: wkLabel(w.week), value: w.count, tip: `${w.count} workouts, ${w.minutes} min · week of ${wkLabel(w.week)}` }))} height={110} />
      </section>
      <section className="card">
        <h2>Weight lifted per week</h2>
        <BarChart ariaLabel="Total kg lifted per week" data={weeks.map((w) => ({ label: wkLabel(w.week), value: w.volume, tip: `${Math.round(w.volume).toLocaleString('en-GB')} kg · week of ${wkLabel(w.week)}` }))} unit=" kg" height={110} />
      </section>
      <section className="card">
        <div className="row wrap">
          <h2 className="grow">Exercise progress</h2>
          {names.length > 0 && (
            <select value={name} onChange={(e) => setPick(e.target.value)} aria-label="Exercise" className="auto">
              {names.map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          )}
        </div>
        {!names.length ? (
          <p className="muted">Log a few workouts with weights to see your strength trend.</p>
        ) : (
          <>
            <p className="muted small-text">Estimated one-rep max (Epley formula), from your best set each session.</p>
            <LineChart ariaLabel={`${name} estimated one-rep max`} unit=" kg" points={hist.map((h) => ({ label: wkLabel(h.date), value: h.best1rm }))} />
            {hist.length > 0 && (
              <div className="stats">
                <div className="stat">
                  <span>Latest top set</span>
                  <b>
                    {hist[hist.length - 1].topWeight} kg × {hist[hist.length - 1].topReps}
                  </b>
                </div>
                <div className="stat">
                  <span>Est. 1RM</span>
                  <b>{hist[hist.length - 1].best1rm} kg</b>
                </div>
                {hist.length > 1 && (
                  <div className="stat">
                    <span>Change since first</span>
                    <b className={hist[hist.length - 1].best1rm >= hist[0].best1rm ? 'good' : 'warn'}>
                      {hist[hist.length - 1].best1rm >= hist[0].best1rm ? '+' : ''}
                      {Math.round((hist[hist.length - 1].best1rm - hist[0].best1rm) * 10) / 10} kg
                    </b>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </section>
      {cardio.length > 0 && (
        <section className="card">
          <h2>Cardio</h2>
          <ul className="mini">
            {cardio
              .slice(-6)
              .reverse()
              .map((l) => (
                <li key={l.id}>
                  <span className="grow">
                    {l.name} <span className="muted">· {diffDays(t, l.date) < 7 ? relativeLabel(l.date, t) : formatDate(l.date)}</span>
                  </span>
                  <span className="muted">{pace(l.minutes, l.distanceKm)}</span>
                  <span className="amount">{l.distanceKm} km</span>
                </li>
              ))}
          </ul>
        </section>
      )}
    </>
  );
}

/* ---------------- Records ---------------- */
export function WorkoutRecords() {
  const logs = useRows<WorkoutLog>('workouts');
  const pbs = personalBests(logs).filter((p) => p.heaviest.weight > 0 || p.mostReps.reps > 0);
  if (!pbs.length) return <div className="empty">Log workouts with weights and reps, and your records show up here.</div>;
  const groups = [...MUSCLES, 'Other'] as string[];
  return (
    <>
      {groups.map((g) => {
        const list = pbs.filter((p) => (muscleOf(p.name) ?? 'Other') === g);
        if (!list.length) return null;
        return (
          <div key={g} className="group">
            <h3 className="group-head">{g}</h3>
            <ul className="cards pb-grid">
              {list.map((p) => (
                <li key={p.name} className="card">
                  <b>🏆 {p.name}</b>
                  <div className="pb-row">
                    <span>Heaviest</span>
                    <b>
                      {p.heaviest.weight} kg × {p.heaviest.reps}
                    </b>
                  </div>
                  <div className="pb-row">
                    <span>Est. 1RM</span>
                    <b>{p.best1rm.value} kg</b>
                  </div>
                  <div className="pb-row">
                    <span>Most reps</span>
                    <b>
                      {p.mostReps.reps}
                      {p.mostReps.weight ? ` @ ${p.mostReps.weight} kg` : ''}
                    </b>
                  </div>
                  <div className="meta">
                    {p.sessions} sessions · best on {formatDate(p.best1rm.date)}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </>
  );
}

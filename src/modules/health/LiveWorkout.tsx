import { useEffect, useState, useSyncExternalStore } from 'react';
import { db, save, type Completion, type Exercise, type SetDone, type WorkoutLog, type WorkoutPlan } from '../../db';
import { addDays, diffDays, today } from '../../lib/dates';
import { exKey, LIBRARY, newPBs, parseReps, setsOf } from '../../lib/fitness';
import { occurrences } from '../../lib/schedule';
import { buzz, showToast } from '../../toast';

/** A workout in progress. Kept in localStorage so it survives closing the app mid-session. */
interface Live {
  name: string;
  planId?: string;
  startedAt: number;
  exercises: (Exercise & { setsDone: SetDone[] })[];
  restUntil?: number;
  restSecs: number;
  minimised?: boolean;
}

const KEY = 'live-workout';
const load = (): Live | null => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || 'null');
  } catch {
    return null;
  }
};
let live: Live | null = load();
const listeners = new Set<() => void>();
function put(next: Live | null) {
  live = next;
  try {
    if (next) localStorage.setItem(KEY, JSON.stringify(next));
    else localStorage.removeItem(KEY);
  } catch {
    /* private mode: keep in memory */
  }
  listeners.forEach((l) => l());
}
export const useLive = () =>
  useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => live,
  );

export function startWorkout(plan?: WorkoutPlan) {
  if (live) {
    // One at a time: bring the running workout back instead of replacing it.
    put({ ...live, minimised: false });
    showToast('You already have a workout in progress');
    return;
  }
  put({
    name: plan?.name ?? 'Workout',
    planId: plan?.id,
    startedAt: Date.now(),
    restSecs: 90,
    exercises: (plan?.exercises ?? []).map((e) => ({
      ...e,
      setsDone: Array.from({ length: Math.max(1, e.sets ?? 1) }, () => ({ reps: parseReps(e.reps) || undefined, weight: e.weight, done: false })),
    })),
  });
}
const fmt = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
};

function useTick(on: boolean) {
  const [, set] = useState(0);
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => set((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, [on]);
}

export function LiveWorkout({ history }: { history: WorkoutLog[] }) {
  const w = useLive();
  const [adding, setAdding] = useState('');
  const [confirmQuit, setConfirmQuit] = useState(false);
  useTick(!!w);
  const restLeft = w?.restUntil ? w.restUntil - Date.now() : 0;
  useEffect(() => {
    if (w?.restUntil && restLeft <= 0) {
      buzz(300);
      put({ ...w, restUntil: undefined });
    }
  });
  if (!w) return null;

  const update = (fn: (x: Live) => void) => {
    const next: Live = JSON.parse(JSON.stringify(w));
    fn(next);
    put(next);
  };
  const last = (name: string) => {
    const prev = [...history].sort((a, b) => b.date.localeCompare(a.date)).find((l) => l.entries?.some((e) => exKey(e.name) === exKey(name)));
    const e = prev?.entries?.find((x) => exKey(x.name) === exKey(name));
    if (!prev || !e) return null;
    const sets = setsOf(e);
    const top = sets.reduce((a, s) => (s.weight > a.weight ? s : a), sets[0] ?? { weight: 0, reps: 0 });
    return `Last time: ${sets.length} sets${top?.weight ? `, best ${top.weight} kg × ${top.reps}` : ''} (${diffDays(today(), prev.date)} days ago)`;
  };
  const doneSets = w.exercises.reduce((a, e) => a + e.setsDone.filter((s) => s.done).length, 0);
  const totalSets = w.exercises.reduce((a, e) => a + e.setsDone.length, 0);

  const finish = async () => {
    const t = today();
    const entries: Exercise[] = w.exercises
      .filter((e) => e.name.trim() && e.setsDone.some((s) => s.done))
      .map((e) => {
        const done = e.setsDone.filter((s) => s.done);
        const top = done.reduce((a, s) => ((s.weight ?? 0) > (a?.weight ?? 0) ? s : a), done[0]);
        return { name: e.name, sets: done.length || e.sets, reps: top?.reps !== undefined ? String(top.reps) : e.reps, weight: top?.weight ?? e.weight, setsDone: e.setsDone };
      });
    const log = { name: w.name, planId: w.planId, date: t, minutes: Math.max(1, Math.round((Date.now() - w.startedAt) / 60000)), entries, kind: 'strength' as const };
    const pbs = newPBs(log, history);
    await save<WorkoutLog>('workouts', log);
    if (w.planId) {
      const plan = await db.plans.get(w.planId);
      const occ = plan?.schedule ? occurrences(plan.schedule, addDays(t, -6), t).pop() : undefined;
      if (occ) await save<Completion>('completions', { source: 'workout', sourceId: w.planId, date: occ, completedOn: t });
    }
    put(null);
    buzz(80);
    showToast(pbs.length ? `🏆 New personal best: ${pbs.join(', ')}!` : `Workout saved: ${doneSets} sets in ${log.minutes} min`);
  };

  if (w.minimised)
    return (
      <button className="live-pill" onClick={() => put({ ...w, minimised: false })}>
        🏋️ {w.name} · {fmt(Date.now() - w.startedAt)}
        {w.restUntil ? ` · rest ${fmt(restLeft)}` : ''}
      </button>
    );

  return (
    <div className="live" role="dialog" aria-label="Workout in progress">
      <header className="live-head">
        <button className="icon" aria-label="Minimise" onClick={() => put({ ...w, minimised: true })}>
          ⌄
        </button>
        <div className="grow">
          <input className="live-name" value={w.name} onChange={(e) => update((x) => void (x.name = e.target.value))} aria-label="Workout name" />
          <div className="meta">
            ⏱ {fmt(Date.now() - w.startedAt)} · {doneSets}/{totalSets} sets
          </div>
        </div>
        <button className="primary" onClick={finish} disabled={!doneSets}>
          Finish
        </button>
      </header>
      {w.restUntil && (
        <div className="rest">
          <span className="grow">
            Rest <b>{fmt(restLeft)}</b>
          </span>
          <button className="small" onClick={() => update((x) => void (x.restUntil = (x.restUntil ?? Date.now()) + 15000))}>
            +15s
          </button>
          <button className="small" onClick={() => update((x) => void (x.restUntil = undefined))}>
            Skip
          </button>
          <div className="rest-bar">
            <i style={{ width: `${Math.max(0, Math.min(100, (restLeft / (w.restSecs * 1000)) * 100))}%` }} />
          </div>
        </div>
      )}
      <div className="live-body">
        {w.exercises.map((e, ei) => (
          <section key={ei} className="card live-ex">
            <div className="row">
              <b className="grow">{e.name || 'Exercise'}</b>
              <button className="icon" aria-label={`Remove ${e.name}`} onClick={() => update((x) => void x.exercises.splice(ei, 1))}>
                ✕
              </button>
            </div>
            {last(e.name) && <div className="meta">{last(e.name)}</div>}
            <div className="set-head muted">
              <span>Set</span>
              <span>kg</span>
              <span>Reps</span>
              <span>Done</span>
            </div>
            {e.setsDone.map((s, si) => (
              <div key={si} className={`set-row ${s.done ? 'done' : ''}`}>
                <span className="set-n">{si + 1}</span>
                <input type="number" inputMode="decimal" step="0.5" value={s.weight ?? ''} aria-label={`Set ${si + 1} weight`} onChange={(ev) => update((x) => void (x.exercises[ei].setsDone[si].weight = ev.target.value === '' ? undefined : Number(ev.target.value)))} />
                <input type="number" inputMode="numeric" value={s.reps ?? ''} aria-label={`Set ${si + 1} reps`} onChange={(ev) => update((x) => void (x.exercises[ei].setsDone[si].reps = ev.target.value === '' ? undefined : Number(ev.target.value)))} />
                <button
                  className={`set-tick ${s.done ? 'on' : ''}`}
                  aria-label={`Set ${si + 1} done`}
                  aria-pressed={s.done}
                  onClick={() =>
                    update((x) => {
                      const st = x.exercises[ei].setsDone[si];
                      st.done = !st.done;
                      if (st.done) {
                        buzz();
                        x.restUntil = Date.now() + x.restSecs * 1000;
                      }
                    })
                  }
                >
                  ✓
                </button>
              </div>
            ))}
            <div className="row">
              <button
                className="small"
                onClick={() =>
                  update((x) => {
                    const sd = x.exercises[ei].setsDone;
                    const prev = sd[sd.length - 1];
                    sd.push({ reps: prev?.reps, weight: prev?.weight, done: false });
                  })
                }
              >
                + Set
              </button>
              {e.setsDone.length > 1 && (
                <button className="small" onClick={() => update((x) => void x.exercises[ei].setsDone.pop())}>
                  − Set
                </button>
              )}
            </div>
          </section>
        ))}
        <form
          className="quick"
          onSubmit={(ev) => {
            ev.preventDefault();
            if (!adding.trim()) return;
            update((x) => void x.exercises.push({ name: adding.trim(), sets: 3, setsDone: [{ done: false }, { done: false }, { done: false }] }));
            setAdding('');
          }}
        >
          <input list="ex-lib" value={adding} onChange={(ev) => setAdding(ev.target.value)} placeholder="Add an exercise…" aria-label="Add an exercise" />
          <button>Add</button>
        </form>
        <div className="row wrap rest-pick">
          <span className="muted">Rest timer:</span>
          {[60, 90, 120, 180].map((s) => (
            <button key={s} className={`small ${w.restSecs === s ? 'primary' : ''}`} onClick={() => update((x) => void (x.restSecs = s))}>
              {s < 120 ? `${s}s` : `${s / 60} min`}
            </button>
          ))}
        </div>
        {confirmQuit ? (
          <div className="confirm-bar">
            <span className="grow">Throw this workout away?</span>
            <button onClick={() => setConfirmQuit(false)}>Keep going</button>
            <button className="danger" onClick={() => put(null)}>
              Discard
            </button>
          </div>
        ) : (
          <button className="link danger-link" onClick={() => setConfirmQuit(true)}>
            Discard workout
          </button>
        )}
      </div>
    </div>
  );
}

export function ExerciseDatalist() {
  return (
    <datalist id="ex-lib">
      {LIBRARY.map(([n]) => (
        <option key={n} value={n} />
      ))}
    </datalist>
  );
}

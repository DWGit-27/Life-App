import type { Exercise, WorkoutLog } from '../db';
import { addDays, parseISO, toISO, type ISODate } from './dates';

/** Epley estimated one-rep max. */
export function e1rm(weight: number, reps: number): number {
  if (!weight || !reps) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

export const parseReps = (r: string | number | undefined): number => {
  if (typeof r === 'number') return r;
  const m = String(r ?? '').match(/\d+/);
  return m ? Number(m[0]) : 0;
};

/** The sets actually done for an exercise: live-mode sets if present, else the planned sets × reps × weight. */
export function setsOf(e: Exercise): { reps: number; weight: number }[] {
  if (e.setsDone?.length) return e.setsDone.filter((s) => s.done).map((s) => ({ reps: s.reps ?? 0, weight: s.weight ?? 0 }));
  const n = e.sets ?? (e.weight || e.reps ? 1 : 0);
  return Array.from({ length: n }, () => ({ reps: parseReps(e.reps), weight: e.weight ?? 0 }));
}

export function volume(entries: Exercise[]): number {
  return entries.reduce((a, e) => a + setsOf(e).reduce((b, s) => b + s.reps * s.weight, 0), 0);
}

export const exKey = (name: string) => name.trim().toLowerCase();

export interface ExercisePoint {
  date: ISODate;
  best1rm: number;
  topWeight: number;
  topReps: number;
  volume: number;
}

/** History for one exercise across all logs, oldest first. */
export function exerciseHistory(logs: WorkoutLog[], name: string): ExercisePoint[] {
  const k = exKey(name);
  const out: ExercisePoint[] = [];
  for (const l of [...logs].sort((a, b) => a.date.localeCompare(b.date))) {
    const ex = (l.entries ?? []).filter((e) => exKey(e.name) === k);
    if (!ex.length) continue;
    const sets = ex.flatMap(setsOf);
    if (!sets.length) continue;
    const top = sets.reduce((a, s) => (s.weight > a.weight || (s.weight === a.weight && s.reps > a.reps) ? s : a), sets[0]);
    out.push({ date: l.date, best1rm: Math.max(...sets.map((s) => e1rm(s.weight, s.reps))), topWeight: top.weight, topReps: top.reps, volume: sets.reduce((a, s) => a + s.reps * s.weight, 0) });
  }
  return out;
}

export interface PB {
  name: string;
  heaviest: { weight: number; reps: number; date: ISODate };
  best1rm: { value: number; date: ISODate };
  mostReps: { reps: number; weight: number; date: ISODate };
  sessions: number;
}

export function personalBests(logs: WorkoutLog[]): PB[] {
  const map = new Map<string, PB>();
  for (const l of logs)
    for (const e of l.entries ?? []) {
      if (!e.name?.trim()) continue;
      const k = exKey(e.name);
      let pb = map.get(k);
      if (!pb) {
        pb = { name: e.name.trim(), heaviest: { weight: 0, reps: 0, date: l.date }, best1rm: { value: 0, date: l.date }, mostReps: { reps: 0, weight: 0, date: l.date }, sessions: 0 };
        map.set(k, pb);
      }
      pb.sessions++;
      for (const s of setsOf(e)) {
        if (s.weight > pb.heaviest.weight || (s.weight === pb.heaviest.weight && s.reps > pb.heaviest.reps)) pb.heaviest = { ...s, date: l.date };
        const r = e1rm(s.weight, s.reps);
        if (r > pb.best1rm.value) pb.best1rm = { value: r, date: l.date };
        if (s.reps > pb.mostReps.reps) pb.mostReps = { ...s, date: l.date };
      }
    }
  return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/** Names of exercises in `log` that beat the previous best e1RM from earlier logs. */
export function newPBs(log: Pick<WorkoutLog, 'entries' | 'date'>, previous: WorkoutLog[]): string[] {
  const before = personalBests(previous.filter((p) => p.date <= log.date));
  const prev = new Map(before.map((b) => [exKey(b.name), b.best1rm.value]));
  const out: string[] = [];
  for (const e of log.entries ?? []) {
    const best = Math.max(0, ...setsOf(e).map((s) => e1rm(s.weight, s.reps)));
    const p = prev.get(exKey(e.name));
    if (best > 0 && p !== undefined && best > p) out.push(e.name);
  }
  return out;
}

export function weekStart(d: ISODate): ISODate {
  const x = parseISO(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return toISO(x);
}

/** Workouts and minutes per week for the last n weeks (oldest first). */
export function weeklyTotals(logs: WorkoutLog[], t: ISODate, n = 8) {
  const start = addDays(weekStart(t), -7 * (n - 1));
  return Array.from({ length: n }, (_, i) => {
    const ws = addDays(start, 7 * i);
    const we = addDays(ws, 6);
    const inW = logs.filter((l) => l.date >= ws && l.date <= we);
    return { week: ws, count: inW.length, minutes: inW.reduce((a, l) => a + (l.minutes || 0), 0), volume: inW.reduce((a, l) => a + volume(l.entries ?? []), 0) };
  });
}

export function pace(minutes?: number, km?: number): string {
  if (!minutes || !km) return '';
  const per = minutes / km;
  const m = Math.floor(per);
  const s = Math.round((per - m) * 60);
  return `${m}:${String(s).padStart(2, '0')} /km`;
}

/* ---------- exercise library ---------- */
export const MUSCLES = ['Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Glutes', 'Core', 'Cardio', 'Full body'] as const;
export const LIBRARY: [string, (typeof MUSCLES)[number]][] = [
  ['Bench press', 'Chest'], ['Incline dumbbell press', 'Chest'], ['Push-ups', 'Chest'], ['Chest fly', 'Chest'], ['Dips', 'Chest'],
  ['Deadlift', 'Back'], ['Pull-ups', 'Back'], ['Lat pulldown', 'Back'], ['Barbell row', 'Back'], ['Seated cable row', 'Back'], ['Dumbbell row', 'Back'],
  ['Overhead press', 'Shoulders'], ['Shoulder press', 'Shoulders'], ['Lateral raise', 'Shoulders'], ['Face pull', 'Shoulders'], ['Rear delt fly', 'Shoulders'],
  ['Bicep curl', 'Arms'], ['Hammer curl', 'Arms'], ['Tricep pushdown', 'Arms'], ['Skull crushers', 'Arms'], ['Overhead tricep extension', 'Arms'],
  ['Squat', 'Legs'], ['Front squat', 'Legs'], ['Leg press', 'Legs'], ['Lunges', 'Legs'], ['Romanian deadlift', 'Legs'], ['Leg curl', 'Legs'], ['Leg extension', 'Legs'], ['Calf raise', 'Legs'], ['Bulgarian split squat', 'Legs'],
  ['Hip thrust', 'Glutes'], ['Glute bridge', 'Glutes'], ['Cable kickback', 'Glutes'],
  ['Plank', 'Core'], ['Hanging leg raise', 'Core'], ['Cable crunch', 'Core'], ['Russian twist', 'Core'], ['Ab wheel', 'Core'],
  ['Run', 'Cardio'], ['Cycle', 'Cardio'], ['Row (machine)', 'Cardio'], ['Swim', 'Cardio'], ['Walk', 'Cardio'], ['Skipping', 'Cardio'],
  ['Kettlebell swing', 'Full body'], ['Burpees', 'Full body'], ['Clean and press', 'Full body'], ['Farmer\'s carry', 'Full body'],
];
export const muscleOf = (name: string) => LIBRARY.find(([n]) => exKey(n) === exKey(name))?.[1];

/* ---------- ready-made programmes ---------- */
export interface Programme {
  name: string;
  about: string;
  days: { name: string; weekday: number; exercises: Exercise[] }[]; // weekday 1=Mon … 7=Sun
}
const ex = (name: string, sets: number, reps: string, weight?: number): Exercise => ({ name, sets, reps, weight });
export const PROGRAMMES: Programme[] = [
  {
    name: 'Full body, 3 days',
    about: 'Mon / Wed / Fri. Great for beginners and busy weeks.',
    days: [
      { name: 'Full body A', weekday: 1, exercises: [ex('Squat', 3, '8'), ex('Bench press', 3, '8'), ex('Barbell row', 3, '8'), ex('Plank', 3, '45s')] },
      { name: 'Full body B', weekday: 3, exercises: [ex('Deadlift', 3, '5'), ex('Overhead press', 3, '8'), ex('Lat pulldown', 3, '10'), ex('Lunges', 3, '10')] },
      { name: 'Full body C', weekday: 5, exercises: [ex('Front squat', 3, '8'), ex('Incline dumbbell press', 3, '10'), ex('Seated cable row', 3, '10'), ex('Hanging leg raise', 3, '10')] },
    ],
  },
  {
    name: 'Push / Pull / Legs',
    about: 'Mon / Wed / Fri, each muscle group once a week with more volume.',
    days: [
      { name: 'Push', weekday: 1, exercises: [ex('Bench press', 4, '6-8'), ex('Overhead press', 3, '8'), ex('Incline dumbbell press', 3, '10'), ex('Lateral raise', 3, '12'), ex('Tricep pushdown', 3, '12')] },
      { name: 'Pull', weekday: 3, exercises: [ex('Deadlift', 3, '5'), ex('Pull-ups', 3, '8'), ex('Barbell row', 3, '8'), ex('Face pull', 3, '15'), ex('Bicep curl', 3, '12')] },
      { name: 'Legs', weekday: 5, exercises: [ex('Squat', 4, '6-8'), ex('Romanian deadlift', 3, '10'), ex('Leg press', 3, '12'), ex('Leg curl', 3, '12'), ex('Calf raise', 4, '15')] },
    ],
  },
  {
    name: 'Upper / Lower, 4 days',
    about: 'Mon / Tue / Thu / Fri for steady strength gains.',
    days: [
      { name: 'Upper 1', weekday: 1, exercises: [ex('Bench press', 4, '6'), ex('Barbell row', 4, '6'), ex('Overhead press', 3, '8'), ex('Pull-ups', 3, '8')] },
      { name: 'Lower 1', weekday: 2, exercises: [ex('Squat', 4, '6'), ex('Romanian deadlift', 3, '8'), ex('Lunges', 3, '10'), ex('Calf raise', 3, '15')] },
      { name: 'Upper 2', weekday: 4, exercises: [ex('Incline dumbbell press', 3, '10'), ex('Seated cable row', 3, '10'), ex('Lateral raise', 3, '15'), ex('Bicep curl', 3, '12'), ex('Tricep pushdown', 3, '12')] },
      { name: 'Lower 2', weekday: 5, exercises: [ex('Deadlift', 3, '5'), ex('Leg press', 3, '12'), ex('Leg curl', 3, '12'), ex('Hanging leg raise', 3, '12')] },
    ],
  },
  {
    name: 'Run 5k',
    about: 'Three runs a week, building up gradually. Log distance and time.',
    days: [
      { name: 'Easy run', weekday: 2, exercises: [ex('Run', 1, '20-30 min')] },
      { name: 'Intervals', weekday: 4, exercises: [ex('Run', 6, '2 min fast, 2 min walk')] },
      { name: 'Long run', weekday: 7, exercises: [ex('Run', 1, '30-45 min')] },
    ],
  },
];

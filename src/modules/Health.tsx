import { useRows } from '../components/Crud';
import type { MealEntry, Water, WorkoutLog, WorkoutPlan } from '../db';
import { agoLabel, relativeLabel, today } from '../lib/dates';
import { sumMacros } from '../lib/nutrition';
import { nextOccurrence } from '../lib/schedule';
import { weekStart } from '../lib/fitness';
import { openEdit } from '../registry';
import { Body, Foods, MealPlanner, useTargets } from './Nutrition';
import { addWater, FoodToday, FoodTrends, loggingStreak, useGoals } from './health/Food';
import { quickLog, weekStreak, WorkoutLogList, WorkoutPlans, WorkoutProgress, WorkoutRecords, WorkoutWeek } from './health/Workouts';
import { startWorkout, useLive } from './health/LiveWorkout';

export { weekStreak };
export const logFromPlan = quickLog;

type Section = 'workouts' | 'food';
const TABS: Record<Section, [string, string][]> = {
  workouts: [
    ['week', 'This week'],
    ['plans', 'Plans'],
    ['log', 'Log'],
    ['progress', 'Progress'],
    ['records', 'Records'],
  ],
  food: [
    ['today', 'Diary'],
    ['plan', 'Meal plan'],
    ['foods', 'My foods'],
    ['trends', 'Trends'],
    ['body', 'Body & targets'],
  ],
};
// Links from before the split (#/health/food, #/health/plans …)
const LEGACY: Record<string, [Section, string]> = {
  food: ['food', 'today'],
  meals: ['food', 'plan'],
  foods: ['food', 'foods'],
  body: ['food', 'body'],
  plans: ['workouts', 'plans'],
  log: ['workouts', 'log'],
  records: ['workouts', 'records'],
};

function parse(sub?: string): [Section | null, string] {
  const [a, b] = (sub ?? '').split('/');
  if (a === 'workouts' || a === 'food') return [a, TABS[a].some(([k]) => k === b) ? b : TABS[a][0][0]];
  if (LEGACY[a]) return LEGACY[a];
  return [null, ''];
}

export default function Health({ sub, setSub }: { sub?: string; setSub: (s: string) => void }) {
  const [section, tab] = parse(sub);
  if (!section) return <HealthHome open={(s, t) => setSub(t ? `${s}/${t}` : s)} />;
  return (
    <div className="page">
      <button className="link back" onClick={() => setSub('home')}>
        ‹ Health
      </button>
      <h1>{section === 'workouts' ? '🏋️ Workouts' : '🍽 Food'}</h1>
      <div className="tabs scroll">
        {TABS[section].map(([k, label]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setSub(`${section}/${k}`)}>
            {label}
          </button>
        ))}
      </div>
      {section === 'workouts' && tab === 'week' && <WorkoutWeek />}
      {section === 'workouts' && tab === 'plans' && <WorkoutPlans />}
      {section === 'workouts' && tab === 'log' && <WorkoutLogList />}
      {section === 'workouts' && tab === 'progress' && <WorkoutProgress />}
      {section === 'workouts' && tab === 'records' && <WorkoutRecords />}
      {section === 'food' && tab === 'today' && <FoodToday />}
      {section === 'food' && tab === 'plan' && <MealPlanner />}
      {section === 'food' && tab === 'foods' && <Foods />}
      {section === 'food' && tab === 'trends' && <FoodTrends />}
      {section === 'food' && tab === 'body' && <Body />}
    </div>
  );
}

function HealthHome({ open }: { open: (s: Section, tab?: string) => void }) {
  const t = today();
  const logs = useRows<WorkoutLog>('workouts');
  const plans = useRows<WorkoutPlan>('plans');
  const meals = useRows<MealEntry>('meals');
  const water = useRows<Water>('water');
  const tg = useTargets();
  const goals = useGoals();
  const live = useLive();
  const thisWeek = logs.filter((l) => l.date >= weekStart(t)).length;
  const streak = weekStreak(logs, t);
  const next = plans
    .map((p) => ({ p, d: p.schedule ? nextOccurrence(p.schedule, t) : undefined }))
    .filter((x) => x.d && !(x.d === t && logs.some((l) => l.planId === x.p.id && l.date === t)))
    .sort((a, b) => a.d!.localeCompare(b.d!))[0];
  const eaten = sumMacros(meals.filter((m) => m.date === t));
  const ml = water.filter((w) => w.date === t).reduce((a, w) => a + w.ml, 0);
  const foodStreak = loggingStreak(meals, t);
  const last = [...logs].sort((a, b) => b.date.localeCompare(a.date))[0];
  const pct = (v: number, of: number) => `${Math.min(100, of ? (v / of) * 100 : 0)}%`;

  return (
    <div className="page">
      <h1>Health</h1>
      <div className="big-sections">
        <button className="big-section workouts" onClick={() => open('workouts')}>
          <span className="big-icon">🏋️</span>
          <span className="big-title">Workouts</span>
          <span className="big-stat">
            <b>{thisWeek}</b> of {goals.workoutsPerWeek} this week
          </span>
          <span className="bar">
            <i style={{ width: pct(thisWeek, goals.workoutsPerWeek) }} />
          </span>
          <span className="big-meta">
            {live ? `In progress: ${live.name}` : next ? `Next: ${next.p.name}, ${relativeLabel(next.d!, t).toLowerCase()}` : 'No sessions planned'}
            {streak > 0 && ` · 🔥 ${streak} wk`}
          </span>
          {last && (
            <span className="big-meta">
              Last: {last.name}, {agoLabel(last.date, t)}
            </span>
          )}
        </button>
        <button className="big-section food" onClick={() => open('food')}>
          <span className="big-icon">🍽</span>
          <span className="big-title">Food</span>
          <span className="big-stat">
            {tg ? (
              <>
                <b>{Math.round(Math.max(0, tg.kcal - eaten.kcal))}</b> kcal left today
              </>
            ) : (
              <>
                <b>{Math.round(eaten.kcal)}</b> kcal today
              </>
            )}
          </span>
          <span className="bar">
            <i style={{ width: pct(eaten.kcal, tg?.kcal ?? 0) }} className={tg && eaten.kcal > tg.kcal * 1.05 ? 'over' : ''} />
          </span>
          <span className="big-meta">
            💧 {(ml / 1000).toFixed(1)} of {goals.waterMl / 1000} L · {Math.round(eaten.protein)} g protein
            {foodStreak > 1 && ` · 🔥 ${foodStreak} days`}
          </span>
        </button>
      </div>
      <h2>Quick actions</h2>
      <div className="quick-actions">
        <button onClick={() => (next && next.d === t ? startWorkout(next.p) : startWorkout())}>
          ▶<span>{next && next.d === t ? `Start ${next.p.name}` : 'Start a workout'}</span>
        </button>
        <button onClick={() => open('food', 'today')}>
          🍽<span>Log food</span>
        </button>
        <button onClick={() => addWater(t, 250)}>
          💧<span>+ Glass of water</span>
        </button>
        <button onClick={() => openEdit({ table: 'weights', initial: { date: t } })}>
          ⚖️<span>Weigh in</span>
        </button>
        <button onClick={() => openEdit({ table: 'workouts', initial: { date: t, entries: [], kind: 'cardio', name: 'Run' } })}>
          🏃<span>Log a run</span>
        </button>
        <button onClick={() => open('food', 'plan')}>
          🛒<span>Meal plan & shopping</span>
        </button>
      </div>
      <p className="muted small-text">Longer trends live in Food → Trends and Workouts → Progress.</p>
    </div>
  );
}

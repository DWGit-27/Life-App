import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useRows } from '../../components/Crud';
import { Modal } from '../../components/Form';
import { BarChart, LineChart, MacroDonut } from '../../components/Charts';
import { db, MEAL_SLOTS, save, type Food, type MealEntry, type MealPlan, type MealSlot, type Water, type Weight } from '../../db';
import { addDays, parseISO, today } from '../../lib/dates';
import { sumMacros } from '../../lib/nutrition';
import { COMMON_FOODS } from '../../lib/foods';
import { openEdit, slotNow } from '../../registry';
import { buzz, showToast } from '../../toast';
import { dayLabel, MacroBar, SLOT_ICON, useTargets } from '../Nutrition';

export interface HealthGoals {
  workoutsPerWeek: number;
  waterMl: number;
}
export const DEFAULT_GOALS: HealthGoals = { workoutsPerWeek: 3, waterMl: 2000 };
export function useGoals(): HealthGoals {
  const v = useLiveQuery(() => db.settings.get('healthGoals'), [])?.value as Partial<HealthGoals> | undefined;
  return { ...DEFAULT_GOALS, ...v };
}
export const setGoals = async (patch: Partial<HealthGoals>) => {
  const cur = ((await db.settings.get('healthGoals'))?.value as Partial<HealthGoals>) ?? {};
  await db.settings.put({ key: 'healthGoals', value: { ...DEFAULT_GOALS, ...cur, ...patch } });
};

export async function addWater(date: string, ml: number) {
  buzz();
  const id = await save<Water>('water', { date, ml });
  showToast(`${ml > 0 ? '+' : ''}${ml} ml water`, () => db.water.update(id, { deleted: 1, updatedAt: Date.now() }));
}

/** Consecutive days (ending today or yesterday) with at least one diary entry. */
export function loggingStreak(meals: MealEntry[], t: string) {
  const days = new Set(meals.map((m) => m.date));
  let d = days.has(t) ? t : addDays(t, -1);
  let n = 0;
  while (days.has(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

/* ---------------- Picker: recent, my foods, common foods ---------------- */
interface Pickable {
  key: string;
  name: string;
  serving?: string;
  kcal: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  foodId?: string;
  group: string;
}

function FoodPicker({ date, slot, onClose }: { date: string; slot: MealSlot; onClose: () => void }) {
  const meals = useRows<MealEntry>('meals');
  const foods = useRows<Food>('foods');
  const [q, setQ] = useState('');
  const [servings, setServings] = useState(1);
  const items = useMemo(() => {
    const seen = new Set<string>();
    const out: Pickable[] = [];
    const push = (p: Pickable) => {
      const k = p.name.toLowerCase();
      if (seen.has(k)) return;
      seen.add(k);
      out.push(p);
    };
    for (const m of [...meals].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 60))
      push({ key: 'r' + m.id, name: m.name, kcal: m.kcal, protein: m.protein, carbs: m.carbs, fat: m.fat, foodId: m.foodId, group: 'Recent' });
    for (const f of [...foods].sort((a, b) => Number(!!b.favourite) - Number(!!a.favourite) || a.name.localeCompare(b.name)))
      push({ key: 'f' + f.id, name: f.name, serving: f.serving, kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat, foodId: f.id, group: 'My foods' });
    for (const c of COMMON_FOODS) push({ key: 'c' + c.name, ...c, group: 'Common foods (approx.)' });
    return out;
  }, [meals, foods]);
  const words = q.toLowerCase().split(/\s+/).filter(Boolean);
  const shown = items.filter((i) => words.every((w) => i.name.toLowerCase().includes(w)));
  const groups = ['Recent', 'My foods', 'Common foods (approx.)'];
  const log = async (p: Pickable) => {
    buzz();
    const id = await save<MealEntry>('meals', { date, slot, name: p.name, servings, kcal: p.kcal, protein: p.protein, carbs: p.carbs, fat: p.fat, foodId: p.foodId });
    showToast(`Logged ${p.name}${servings !== 1 ? ` ×${servings}` : ''}`, () => db.meals.update(id, { deleted: 1, updatedAt: Date.now() }));
    onClose();
  };
  return (
    <Modal title={`Add to ${slot}`} onClose={onClose}>
      <div className="picker-top">
        <input autoFocus type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search foods…" aria-label="Search foods" />
        <label className="servings">
          <span>Servings</span>
          <div className="stepper">
            <button type="button" aria-label="Fewer servings" onClick={() => setServings(Math.max(0.5, servings - 0.5))}>
              −
            </button>
            <b>{servings}</b>
            <button type="button" aria-label="More servings" onClick={() => setServings(servings + 0.5)}>
              +
            </button>
          </div>
        </label>
      </div>
      <div className="picker-list">
        {groups.map((g) => {
          const list = shown.filter((i) => i.group === g).slice(0, g === 'Recent' && !words.length ? 8 : 40);
          if (!list.length) return null;
          return (
            <section key={g}>
              <h3>{g}</h3>
              <ul>
                {list.map((i) => (
                  <li key={i.key}>
                    <button onClick={() => log(i)}>
                      <span className="grow">
                        {i.name}
                        {i.serving && <span className="muted small-text"> · {i.serving}</span>}
                      </span>
                      <span className="amount">{Math.round(i.kcal * servings)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
        {!shown.length && <p className="muted">No matches.</p>}
      </div>
      <div className="row wrap picker-foot">
        <button
          onClick={() => {
            onClose();
            openEdit({ table: 'meals', initial: { date, slot, servings, name: q } });
          }}
        >
          Enter it myself
        </button>
        <button
          onClick={() => {
            onClose();
            openEdit({ table: 'foods', initial: { name: q } });
          }}
        >
          Save a new food
        </button>
      </div>
    </Modal>
  );
}

/* ---------------- Water ---------------- */
function WaterCard({ date }: { date: string }) {
  const water = useRows<Water>('water');
  const goals = useGoals();
  const ml = water.filter((w) => w.date === date).reduce((a, w) => a + w.ml, 0);
  const glasses = Math.ceil(goals.waterMl / 250);
  const filled = Math.floor(ml / 250);
  return (
    <section className="card water">
      <div className="row wrap">
        <h3 className="grow">💧 Water</h3>
        <span className="muted">
          {(ml / 1000).toFixed(2).replace(/0$/, '')} / {goals.waterMl / 1000} L
        </span>
      </div>
      <div className="glasses" aria-label={`${filled} of ${glasses} glasses`}>
        {Array.from({ length: Math.max(glasses, filled) }, (_, i) => (
          <span key={i} className={i < filled ? 'full' : ''} />
        ))}
      </div>
      <div className="row wrap">
        <button className="primary small" onClick={() => addWater(date, 250)}>
          + Glass (250 ml)
        </button>
        <button className="small" onClick={() => addWater(date, 500)}>
          + Bottle (500 ml)
        </button>
        {ml > 0 && (
          <button className="small" onClick={() => addWater(date, -250)}>
            − 250 ml
          </button>
        )}
      </div>
    </section>
  );
}

/* ---------------- Diary ---------------- */
export function FoodToday() {
  const t = today();
  const [date, setDate] = useState(t);
  const [picking, setPicking] = useState<MealSlot | null>(null);
  const meals = useRows<MealEntry>('meals');
  const foods = useRows<Food>('foods');
  const plans = useRows<MealPlan>('mealplans');
  const tg = useTargets();
  const day = meals.filter((m) => m.date === date);
  const tot = sumMacros(day);
  const left = tg ? tg.kcal - tot.kcal : undefined;
  const favs = foods.filter((f) => f.favourite).slice(0, 8);
  const planned = plans.filter((p) => p.date === date && !day.some((m) => m.name === p.name && m.slot === p.slot));
  const streak = loggingStreak(meals, t);
  const curSlot = (date === t ? slotNow() : 'Snacks') as MealSlot;

  const copyFrom = async (from: string) => {
    const src = meals.filter((m) => m.date === from);
    if (!src.length) return showToast('Nothing logged that day');
    const ids: string[] = [];
    for (const m of src) {
      const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = m;
      ids.push(await save<MealEntry>('meals', { ...rest, date }));
    }
    showToast(`Copied ${src.length} entries`, async () => {
      for (const id of ids) await db.meals.update(id, { deleted: 1, updatedAt: Date.now() });
    });
  };
  const logFood = async (f: Food) => {
    buzz();
    const id = await save<MealEntry>('meals', { date, slot: curSlot, name: f.name, servings: 1, kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat, foodId: f.id });
    showToast(`Logged ${f.name}`, () => db.meals.update(id, { deleted: 1, updatedAt: Date.now() }));
  };

  return (
    <>
      <div className="date-nav">
        <button aria-label="Previous day" onClick={() => setDate(addDays(date, -1))}>
          ‹
        </button>
        <b className="grow">{date === t ? 'Today' : dayLabel(date)}</b>
        {date !== t && (
          <button className="link" onClick={() => setDate(t)}>
            Today
          </button>
        )}
        <button aria-label="Next day" onClick={() => setDate(addDays(date, 1))}>
          ›
        </button>
      </div>
      <div className="food-top">
        <section className="card kcal-card">
          <div className="kcal-head">
            <div>
              <span className="muted">Eaten</span>
              <b>{Math.round(tot.kcal)}</b>
            </div>
            <div>
              <span className="muted">Target</span>
              <b>{tg?.kcal ?? '—'}</b>
            </div>
            <div>
              <span className="muted">{left !== undefined && left < 0 ? 'Over' : 'Left'}</span>
              <b className={left !== undefined && left < 0 ? 'warn' : 'good'}>{left !== undefined ? Math.abs(Math.round(left)) : '—'}</b>
            </div>
          </div>
          <MacroBar label="Calories" value={tot.kcal} target={tg?.kcal} unit="kcal" />
          <div className="macros3">
            <MacroBar label="Protein" value={tot.protein} target={tg?.protein} />
            <MacroBar label="Carbs" value={tot.carbs} target={tg?.carbs} />
            <MacroBar label="Fat" value={tot.fat} target={tg?.fat} />
          </div>
          {tot.kcal > 0 && <MacroDonut protein={tot.protein} carbs={tot.carbs} fat={tot.fat} />}
          {!tg && <p className="muted">Set your daily target in the Body tab.</p>}
          {streak > 1 && <p className="muted small-text">🔥 Logged {streak} days in a row</p>}
        </section>
        <WaterCard date={date} />
      </div>
      {planned.length > 0 && (
        <div className="card nudge">
          🗓 Planned for this day: {planned.map((p) => p.name).join(', ')}.{' '}
          <button
            className="link"
            onClick={async () => {
              for (const p of planned) await save<MealEntry>('meals', { date, slot: p.slot, name: p.name, servings: 1, kcal: p.kcal || 0, protein: p.protein, carbs: p.carbs, fat: p.fat, foodId: p.foodId });
              showToast(`Logged ${planned.length} planned meals`);
            }}
          >
            Log them
          </button>
        </div>
      )}
      {favs.length > 0 && (
        <>
          <h3>Quick add to {curSlot}</h3>
          <div className="chips">
            {favs.map((f) => (
              <button key={f.id} className="chip" onClick={() => logFood(f)}>
                + {f.name} <span className="muted">{f.kcal}</span>
              </button>
            ))}
          </div>
        </>
      )}
      {MEAL_SLOTS.map((slot) => {
        const list = day.filter((m) => m.slot === slot);
        const k = sumMacros(list).kcal;
        return (
          <section key={slot} className="slot">
            <div className="row">
              <h3 className="grow">
                {SLOT_ICON[slot]} {slot}
              </h3>
              <span className="muted">{k ? `${Math.round(k)} kcal` : ''}</span>
              <button className="small" onClick={() => setPicking(slot)}>
                + Add
              </button>
            </div>
            {list.length > 0 && (
              <ul className="mini">
                {list.map((m) => (
                  <li key={m.id} className="clickable" onClick={() => openEdit({ table: 'meals', id: m.id })}>
                    <span className="grow">
                      {m.name}
                      {m.servings !== 1 && <span className="muted"> ×{m.servings}</span>}
                    </span>
                    <span className="muted">{m.protein ? `${Math.round(m.protein * m.servings)}g P` : ''}</span>
                    <span className="amount">{Math.round(m.kcal * m.servings)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
      <div className="row wrap">
        <button onClick={() => copyFrom(addDays(date, -1))}>Copy the day before</button>
      </div>
      {picking && <FoodPicker date={date} slot={picking} onClose={() => setPicking(null)} />}
    </>
  );
}

/* ---------------- Trends ---------------- */
export function FoodTrends() {
  const t = today();
  const [range, setRange] = useState(7);
  const meals = useRows<MealEntry>('meals');
  const water = useRows<Water>('water');
  const weights = useRows<Weight>('weights').sort((a, b) => a.date.localeCompare(b.date));
  const tg = useTargets();
  const goals = useGoals();
  const days = Array.from({ length: range }, (_, i) => addDays(t, i - range + 1));
  const perDay = days.map((d) => ({ d, ...sumMacros(meals.filter((m) => m.date === d)), water: water.filter((w) => w.date === d).reduce((a, w) => a + w.ml, 0) }));
  const logged = perDay.filter((x) => x.kcal > 0);
  const avg = (k: 'kcal' | 'protein' | 'carbs' | 'fat' | 'water', rows = logged) => (rows.length ? rows.reduce((a, x) => a + x[k], 0) / rows.length : 0);
  const onTarget = tg ? logged.filter((x) => Math.abs(x.kcal - tg.kcal) <= tg.kcal * 0.1).length : 0;
  const wIn = weights.filter((w) => w.date >= days[0]);
  const wChange = wIn.length > 1 ? wIn[wIn.length - 1].kg - wIn[0].kg : undefined;
  const short = (d: string) => parseISO(d).toLocaleDateString('en-GB', range <= 7 ? { weekday: 'short' } : { day: 'numeric', month: 'short' });
  // most-eaten foods
  const counts = new Map<string, { n: number; kcal: number }>();
  for (const m of meals.filter((m) => m.date >= days[0])) {
    const c = counts.get(m.name) ?? { n: 0, kcal: 0 };
    c.n++;
    c.kcal += m.kcal * m.servings;
    counts.set(m.name, c);
  }
  const top = [...counts.entries()].sort((a, b) => b[1].kcal - a[1].kcal).slice(0, 5);

  return (
    <>
      <div className="seg range" role="radiogroup" aria-label="Range">
        {[7, 14, 30].map((n) => (
          <button key={n} role="radio" aria-checked={range === n} className={range === n ? 'on' : ''} onClick={() => setRange(n)}>
            {n} days
          </button>
        ))}
      </div>
      <section className="card report">
        <h2>{range === 7 ? 'Weekly report' : `Last ${range} days`}</h2>
        <div className="stats">
          <div className="stat">
            <span>Avg calories</span>
            <b>{logged.length ? Math.round(avg('kcal')) : '—'}</b>
          </div>
          <div className="stat">
            <span>Days on target (±10%)</span>
            <b>{tg ? `${onTarget} / ${logged.length}` : '—'}</b>
          </div>
          <div className="stat">
            <span>Avg protein</span>
            <b>{logged.length ? `${Math.round(avg('protein'))} g` : '—'}</b>
          </div>
          <div className="stat">
            <span>Avg water</span>
            <b className={avg('water', perDay) >= goals.waterMl ? 'good' : ''}>{(avg('water', perDay) / 1000).toFixed(1)} L</b>
          </div>
          <div className="stat">
            <span>Weight change</span>
            <b className={wChange !== undefined && wChange < 0 ? 'good' : ''}>{wChange !== undefined ? `${wChange > 0 ? '+' : ''}${wChange.toFixed(1)} kg` : '—'}</b>
          </div>
          <div className="stat">
            <span>Days logged</span>
            <b>
              {logged.length} / {range}
            </b>
          </div>
        </div>
      </section>
      <section className="card">
        <h2>Calories per day</h2>
        <BarChart ariaLabel="Calories per day" data={perDay.map((x) => ({ label: short(x.d), value: x.kcal, tip: `${Math.round(x.kcal)} kcal · ${dayLabel(x.d)}` }))} target={tg?.kcal} unit=" kcal" />
      </section>
      <section className="card">
        <h2>Average macros vs target</h2>
        <MacroBar label="Protein" value={avg('protein')} target={tg?.protein} />
        <MacroBar label="Carbs" value={avg('carbs')} target={tg?.carbs} />
        <MacroBar label="Fat" value={avg('fat')} target={tg?.fat} />
      </section>
      <section className="card">
        <h2>Water per day</h2>
        <BarChart ariaLabel="Water per day" data={perDay.map((x) => ({ label: short(x.d), value: x.water, tip: `${(x.water / 1000).toFixed(2)} L · ${dayLabel(x.d)}` }))} target={goals.waterMl} unit=" ml" height={100} />
      </section>
      {weights.length > 1 && (
        <section className="card">
          <h2>Weight</h2>
          <LineChart ariaLabel="Weight trend" unit=" kg" points={weights.slice(-30).map((w) => ({ label: parseISO(w.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }), value: w.kg }))} />
        </section>
      )}
      {top.length > 0 && (
        <section className="card">
          <h2>Biggest calorie sources</h2>
          <ul className="mini">
            {top.map(([name, c]) => (
              <li key={name}>
                <span className="grow">{name}</span>
                <span className="muted">×{c.n}</span>
                <span className="amount">{Math.round(c.kcal)} kcal</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

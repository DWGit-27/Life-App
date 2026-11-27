import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CrudList, useRows } from '../components/Crud';
import { db, MEAL_SLOTS, save, type Food, type MealEntry, type MealPlan, type MealSlot, type Weight } from '../db';
import { addDays, formatDate, parseISO, toISO, today } from '../lib/dates';
import { ACTIVITY, shoppingList, sumMacros, targets, type Profile, type Targets } from '../lib/nutrition';
import { openEdit, slotNow } from '../registry';
import { showToast, buzz } from '../toast';

const SLOT_ICON: Record<MealSlot, string> = { Breakfast: '🥣', Lunch: '🥪', Dinner: '🍝', Snacks: '🍎' };

export function useTargets(): Targets | undefined {
  return useLiveQuery(() => db.settings.get('nutrition'), [])?.value as Targets | undefined;
}

function weekStart(d: string) {
  const x = parseISO(d);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return toISO(x);
}

const dayLabel = (d: string, opts: Intl.DateTimeFormatOptions = { weekday: 'long', day: 'numeric', month: 'short' }) => parseISO(d).toLocaleDateString('en-GB', opts);

function MacroBar({ label, value, target, unit = 'g' }: { label: string; value: number; target?: number; unit?: string }) {
  const pct = target ? Math.min(100, (value / target) * 100) : 0;
  const over = !!target && value > target * 1.05;
  return (
    <div className="macro">
      <div className="row">
        <span className="grow">{label}</span>
        <span className={over ? 'warn' : ''}>
          {Math.round(value)}
          {target ? ` / ${target}` : ''} {unit}
        </span>
      </div>
      <div className="bar">
        <i style={{ width: `${pct}%` }} className={over ? 'over' : ''} />
      </div>
    </div>
  );
}

/* ---------------- Food diary ---------------- */
export function FoodDiary() {
  const t = today();
  const [date, setDate] = useState(t);
  const meals = useRows<MealEntry>('meals');
  const foods = useRows<Food>('foods');
  const plans = useRows<MealPlan>('mealplans');
  const tg = useTargets();
  const day = meals.filter((m) => m.date === date);
  const tot = sumMacros(day);
  const left = tg ? tg.kcal - tot.kcal : undefined;
  const favs = foods.filter((f) => f.favourite).slice(0, 8);
  const planned = plans.filter((p) => p.date === date && !day.some((m) => m.name === p.name && m.slot === p.slot));
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
  const logFood = async (f: Food, slot: MealSlot) => {
    buzz();
    const id = await save<MealEntry>('meals', { date, slot, name: f.name, servings: 1, kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat, foodId: f.id });
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
        {!tg && <p className="muted">Set your daily target in the Body tab.</p>}
      </section>
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
          <h3>Quick add to {slotNow()}</h3>
          <div className="chips">
            {favs.map((f) => (
              <button key={f.id} className="chip" onClick={() => logFood(f, date === t ? (slotNow() as MealSlot) : 'Snacks')}>
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
              <button className="small" onClick={() => openEdit({ table: 'meals', initial: { date, slot, servings: 1 } })}>
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
    </>
  );
}

/* ---------------- Meal planner + shopping list ---------------- */
interface ShopState {
  checked: string[];
  extra: string[];
}

export function MealPlanner() {
  const t = today();
  const [ws, setWs] = useState(weekStart(t));
  const plans = useRows<MealPlan>('mealplans');
  const tg = useTargets();
  const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const week = plans.filter((p) => p.date >= ws && p.date <= days[6]);
  const shopKey = `shop:${ws}`;
  const shop = (useLiveQuery(() => db.settings.get(shopKey), [shopKey])?.value as ShopState | undefined) ?? { checked: [], extra: [] };
  const setShop = (s: ShopState) => db.settings.put({ key: shopKey, value: s });
  const list = [...shoppingList(week.map((p) => p.ingredients)), ...shop.extra.map((item) => ({ item, count: 1 }))];
  const [extra, setExtra] = useState('');
  const remaining = list.filter((x) => !shop.checked.includes(x.item.toLowerCase())).length;
  const [showShop, setShowShop] = useState(false);

  const copyLastWeek = async () => {
    const prev = plans.filter((p) => p.date >= addDays(ws, -7) && p.date < ws);
    if (!prev.length) return showToast('Nothing planned last week');
    for (const p of prev) {
      const { id: _i, createdAt: _c, updatedAt: _u, ...rest } = p;
      await save<MealPlan>('mealplans', { ...rest, date: addDays(p.date, 7) });
    }
    showToast(`Copied ${prev.length} meals from last week`);
  };

  const shareShop = async () => {
    const text = list.filter((x) => !shop.checked.includes(x.item.toLowerCase())).map((x) => `• ${x.item}${x.count > 1 ? ` ×${x.count}` : ''}`).join('\n');
    try {
      if (navigator.share) await navigator.share({ title: 'Shopping list', text });
      else {
        await navigator.clipboard.writeText(text);
        showToast('Shopping list copied');
      }
    } catch {
      /* cancelled */
    }
  };

  return (
    <>
      <div className="date-nav">
        <button aria-label="Previous week" onClick={() => setWs(addDays(ws, -7))}>
          ‹
        </button>
        <b className="grow">
          Week of {dayLabel(ws, { day: 'numeric', month: 'short' })}
          {ws === weekStart(t) && ' (this week)'}
        </b>
        <button aria-label="Next week" onClick={() => setWs(addDays(ws, 7))}>
          ›
        </button>
      </div>
      <div className="row wrap toolbar">
        <button onClick={copyLastWeek}>Copy last week</button>
        <button className={showShop ? 'primary' : ''} onClick={() => setShowShop(!showShop)}>
          🛒 Shopping list{list.length ? ` (${remaining})` : ''}
        </button>
      </div>
      {showShop && (
        <section className="card shop">
          <div className="row">
            <h2 className="grow">Shopping list</h2>
            {list.length > 0 && <button onClick={shareShop}>Share</button>}
          </div>
          {list.length === 0 ? (
            <p className="muted">Add ingredients to this week's meals (or your saved recipes) and they'll appear here.</p>
          ) : (
            <ul className="shop-list">
              {list.map((x) => {
                const k = x.item.toLowerCase();
                const on = shop.checked.includes(k);
                return (
                  <li key={k}>
                    <label className="row">
                      <input type="checkbox" checked={on} onChange={() => setShop({ ...shop, checked: on ? shop.checked.filter((c) => c !== k) : [...shop.checked, k] })} />
                      <span className={`grow ${on ? 'struck' : ''}`}>
                        {x.item}
                        {x.count > 1 && <span className="muted"> ×{x.count}</span>}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
          <form
            className="quick"
            onSubmit={(e) => {
              e.preventDefault();
              if (!extra.trim()) return;
              setShop({ ...shop, extra: [...shop.extra, extra.trim()] });
              setExtra('');
            }}
          >
            <input value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="Add something else…" />
            <button>Add</button>
          </form>
          {shop.checked.length > 0 && (
            <button className="link" onClick={() => setShop({ checked: [], extra: shop.extra.filter((x) => !shop.checked.includes(x.toLowerCase())) })}>
              Clear ticked items
            </button>
          )}
        </section>
      )}
      <div className="plan-week">
        {days.map((d) => {
          const dayPlans = week.filter((p) => p.date === d);
          const k = sumMacros(dayPlans).kcal;
          return (
            <section key={d} className={`card plan-day ${d === t ? 'is-today' : ''}`}>
              <div className="row">
                <b className="grow">{dayLabel(d, { weekday: 'short', day: 'numeric' })}</b>
                {k > 0 && <span className={`muted small-text ${tg && k > tg.kcal * 1.05 ? 'warn' : ''}`}>{Math.round(k)} kcal</span>}
              </div>
              {MEAL_SLOTS.map((slot) => {
                const p = dayPlans.filter((x) => x.slot === slot);
                return (
                  <div key={slot} className="plan-slot">
                    <span className="slot-icon" title={slot}>
                      {SLOT_ICON[slot]}
                    </span>
                    <div className="grow">
                      {p.map((x) => (
                        <button key={x.id} className="plan-meal" onClick={() => openEdit({ table: 'mealplans', id: x.id })}>
                          {x.name}
                        </button>
                      ))}
                      {p.length === 0 && (
                        <button className="plan-add" onClick={() => openEdit({ table: 'mealplans', initial: { date: d, slot } })} aria-label={`Plan ${slot} on ${dayLabel(d)}`}>
                          + {slot.toLowerCase()}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>
    </>
  );
}

/* ---------------- My foods ---------------- */
export function Foods() {
  const foods = useRows<Food>('foods');
  return (
    <>
      <p className="muted">Save foods and recipes once, then log or plan them in one tap. Favourites show as quick-add buttons in the diary.</p>
      <CrudList<Food>
        table="foods"
        rows={foods}
        defaults={() => ({})}
        sort={(a, b) => Number(!!b.favourite) - Number(!!a.favourite) || a.name.localeCompare(b.name)}
        empty="No saved foods yet."
        renderRow={(f) => (
          <div className="row">
            <div className="grow">
              <b>
                {f.favourite && '★ '}
                {f.name}
              </b>
              <div className="meta">{[f.serving, f.protein && `${f.protein}g protein`, f.carbs && `${f.carbs}g carbs`, f.fat && `${f.fat}g fat`].filter(Boolean).join(' · ')}</div>
            </div>
            <div className="amount">{f.kcal} kcal</div>
          </div>
        )}
      />
    </>
  );
}

/* ---------------- Body: weight + targets ---------------- */
function Sparkline({ points }: { points: { date: string; kg: number }[] }) {
  if (points.length < 2) return null;
  const w = 600,
    h = 120,
    pad = 6;
  const xs = points.map((p) => parseISO(p.date).getTime());
  const ys = points.map((p) => p.kg);
  const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
  const [y0, y1] = [Math.min(...ys) - 0.5, Math.max(...ys) + 0.5];
  const X = (x: number) => pad + ((x - x0) / (x1 - x0 || 1)) * (w - 2 * pad);
  const Y = (y: number) => h - pad - ((y - y0) / (y1 - y0 || 1)) * (h - 2 * pad);
  const d = points.map((p, i) => `${i ? 'L' : 'M'}${X(xs[i]).toFixed(1)},${Y(p.kg).toFixed(1)}`).join(' ');
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label="Weight trend">
      <path d={d} fill="none" stroke="var(--accent)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
      {points.map((p, i) => (
        <circle key={i} cx={X(xs[i])} cy={Y(p.kg)} r="3" fill="var(--accent)" vectorEffect="non-scaling-stroke" />
      ))}
    </svg>
  );
}

export function Body() {
  const weights = useRows<Weight>('weights').sort((a, b) => a.date.localeCompare(b.date));
  const stored = useLiveQuery(() => db.settings.get('profile'), [])?.value as Profile | undefined;
  const tg = useTargets();
  const latest = weights[weights.length - 1];
  const [p, setP] = useState<Profile | null>(null);
  const prof: Profile = p ?? stored ?? { sex: 'male', age: 35, heightCm: 178, weightKg: latest?.kg ?? 80, activity: 1.375, goal: 'maintain' };
  const calc = targets(prof);
  const [manual, setManual] = useState<Targets | null>(null);
  const shown = manual ?? tg ?? calc;
  const month = weights.filter((w) => w.date >= addDays(today(), -30));
  const change = month.length > 1 ? month[month.length - 1].kg - month[0].kg : 0;
  const set = (patch: Partial<Profile>) => setP({ ...prof, ...patch });

  return (
    <>
      <div className="stats">
        <button className="stat" onClick={() => openEdit({ table: 'weights', initial: { date: today(), kg: latest?.kg } })}>
          <span>Weight</span>
          <b>{latest ? `${latest.kg} kg` : 'Add'}</b>
        </button>
        <div className="stat">
          <span>30-day change</span>
          <b className={change < 0 ? 'good' : ''}>{month.length > 1 ? `${change > 0 ? '+' : ''}${change.toFixed(1)} kg` : '—'}</b>
        </div>
        <div className="stat">
          <span>Daily target</span>
          <b>{tg ? `${tg.kcal} kcal` : 'Not set'}</b>
        </div>
      </div>
      {weights.length > 1 && (
        <section className="card">
          <Sparkline points={weights.slice(-30)} />
          <p className="muted small-text">
            Last {Math.min(30, weights.length)} weigh-ins, from {formatDate(weights.slice(-30)[0].date)}
          </p>
        </section>
      )}
      <div className="toolbar">
        <h2 className="grow">Weigh-ins</h2>
        <button className="primary" onClick={() => openEdit({ table: 'weights', initial: { date: today(), kg: latest?.kg } })}>
          + Add weigh-in
        </button>
      </div>
      {weights.length === 0 ? (
        <div className="empty">Log your weight now and then to see the trend.</div>
      ) : (
        <ul className="mini card">
          {weights
            .slice(-6)
            .reverse()
            .map((w) => (
              <li key={w.id} className="clickable" onClick={() => openEdit({ table: 'weights', id: w.id })}>
                <span className="grow">{formatDate(w.date)}</span>
                <span className="amount">{w.kg} kg</span>
              </li>
            ))}
        </ul>
      )}
      <section className="card targets">
        <h2>Daily calorie target</h2>
        <p className="muted">Worked out from your details using the Mifflin–St Jeor formula. It's an estimate, so adjust it after a few weeks based on your weight trend.</p>
        <div className="grid-form">
          <label>
            <span>Sex</span>
            <select value={prof.sex} onChange={(e) => set({ sex: e.target.value as Profile['sex'] })}>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </label>
          <label>
            <span>Age</span>
            <input type="number" inputMode="numeric" value={prof.age} onChange={(e) => set({ age: Number(e.target.value) })} />
          </label>
          <label>
            <span>Height (cm)</span>
            <input type="number" inputMode="numeric" value={prof.heightCm} onChange={(e) => set({ heightCm: Number(e.target.value) })} />
          </label>
          <label>
            <span>Weight (kg)</span>
            <input type="number" inputMode="decimal" value={prof.weightKg} onChange={(e) => set({ weightKg: Number(e.target.value) })} />
          </label>
          <label className="wide">
            <span>Activity</span>
            <select value={prof.activity} onChange={(e) => set({ activity: Number(e.target.value) })}>
              {ACTIVITY.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
          <label className="wide">
            <span>Goal</span>
            <select value={prof.goal} onChange={(e) => set({ goal: e.target.value as Profile['goal'] })}>
              <option value="lose">Lose weight (about 0.5 kg a week)</option>
              <option value="maintain">Stay the same</option>
              <option value="gain">Build muscle / gain</option>
            </select>
          </label>
        </div>
        <p>
          Suggested: <b>{calc.kcal} kcal</b> · {calc.protein} g protein · {calc.carbs} g carbs · {calc.fat} g fat
        </p>
        <div className="grid-form four">
          {(['kcal', 'protein', 'carbs', 'fat'] as const).map((k) => (
            <label key={k}>
              <span>{k === 'kcal' ? 'kcal' : `${k} (g)`}</span>
              <input type="number" inputMode="numeric" value={shown[k]} onChange={(e) => setManual({ ...shown, [k]: Number(e.target.value) })} />
            </label>
          ))}
        </div>
        <div className="row wrap">
          <button
            className="primary"
            onClick={async () => {
              await db.settings.put({ key: 'profile', value: prof });
              await db.settings.put({ key: 'nutrition', value: manual ?? calc });
              setManual(null);
              setP(null);
              showToast('Daily target saved');
            }}
          >
            Save target
          </button>
          {manual && <button onClick={() => setManual(null)}>Use suggested</button>}
        </div>
      </section>
    </>
  );
}

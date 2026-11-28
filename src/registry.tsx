import { useSyncExternalStore } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { AREAS, MEAL_SLOTS, db, remove, save, type Completion, type DataTable, type SourceType } from './db';
import { showToast } from './toast';
import { occurrences } from './lib/schedule';
import { EditorModal, type FieldSpec } from './components/Form';
import { addDays, today } from './lib/dates';
import { money } from './lib/format';
import { monthlyPayment } from './lib/mortgage';
import { newPBs, pace } from './lib/fitness';

/* ---------- option lists ---------- */
export const BILL_CATEGORIES = ['Housing', 'Council tax', 'Energy', 'Water', 'Phone & internet', 'TV & streaming', 'Insurance', 'Transport', 'Subscriptions', 'Childcare', 'Other'];
export const SPEND_CATEGORIES = ['Salary', 'Other income', 'Groceries', 'Eating out', 'Transport', 'Fuel', 'Shopping', 'Health', 'Fitness', 'Gifts', 'Holidays', 'Savings', 'Kids', 'Pets', 'Home', ...BILL_CATEGORIES];
export const POLICY_KINDS = ['Home (buildings)', 'Home (contents)', 'Car', 'Life', 'Health', 'Travel', 'Pet', 'Income protection', 'Gadget', 'Other'];
export const INVESTMENT_KINDS = ['Cash ISA', 'Stocks & Shares ISA', 'Lifetime ISA', 'Pension', 'Workplace pension', 'Shares / funds', 'Savings account', 'Premium Bonds', 'Crypto', 'Property', 'Other'];
export const ROOMS = ['Whole house', 'Kitchen', 'Living room', 'Dining room', 'Bathroom', 'Bedroom', 'Office', 'Hallway', 'Garden', 'Garage', 'Exterior', 'Loft'];
export const INVENTORY_CATEGORIES = ['Appliance', 'Electronics', 'Furniture', 'Tools', 'Garden', 'Jewellery', 'Documents', 'Sports', 'Other'];

/* ---------- field specs per table ---------- */
export const FIELDS: Partial<Record<DataTable, FieldSpec[]>> = {
  tasks: [
    { key: 'title', label: 'Task', type: 'text', required: true },
    { key: 'area', label: 'Area', type: 'select', options: AREAS, required: true },
    { key: 'objectiveId', label: 'Objective', type: 'select', options: [], hint: 'Link it to a bigger goal to track progress' },
    { key: 'project', label: 'Project', type: 'text', placeholder: 'e.g. Q1 report', hint: 'Group work tasks by project' },
    { key: 'schedule', label: 'When', type: 'schedule', optional: true, hint: 'Leave the date empty for an "anytime" task' },
    { key: 'priority', label: 'Priority', type: 'select', options: ['low', 'normal', 'high'] },
    { key: 'focus', label: '⭐ Focus: pin to the top of My Day', type: 'checkbox' },
    { key: 'checklist', label: 'Steps', type: 'checklist' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ],
  objectives: [
    { key: 'title', label: 'Objective', type: 'text', required: true, placeholder: 'e.g. Run a 10k, Clear the credit card' },
    { key: 'area', label: 'Area', type: 'select', options: AREAS, required: true },
    { key: 'why', label: 'Why it matters', type: 'text' },
    { key: 'targetDate', label: 'Target date', type: 'date' },
    { key: 'status', label: 'Status', type: 'select', options: [{ value: 'active', label: 'Active' }, { value: 'paused', label: 'Paused' }, { value: 'done', label: 'Done' }], required: true },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ],
  bills: [
    { key: 'name', label: 'Bill', type: 'text', required: true, placeholder: 'e.g. Electricity' },
    { key: 'provider', label: 'Provider', type: 'text' },
    { key: 'category', label: 'Category', type: 'select', options: BILL_CATEGORIES },
    { key: 'amount', label: 'Amount (£)', type: 'money', required: true },
    { key: 'schedule', label: 'Due', type: 'schedule', recurringOnly: true, required: true },
    { key: 'autopay', label: 'Paid automatically (direct debit / standing order)', type: 'checkbox' },
    { key: 'paymentMethod', label: 'Payment method', type: 'text', placeholder: 'e.g. Card, bank transfer', when: (v) => !v.autopay },
    { key: 'account', label: 'Paid from account', type: 'text' },
    { key: 'reference', label: 'Account / customer number', type: 'text' },
    { key: 'contact', label: 'Contact (phone, website)', type: 'text', hint: "Don't store passwords here" },
    { key: 'contractEnd', label: 'Contract / fixed deal ends', type: 'date' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ],
  policies: [
    { key: 'name', label: 'Policy name', type: 'text', required: true, placeholder: 'e.g. Home insurance' },
    { key: 'kind', label: 'Type', type: 'select', options: POLICY_KINDS },
    { key: 'insurer', label: 'Insurer', type: 'text' },
    { key: 'policyNumber', label: 'Policy number', type: 'text' },
    { key: 'cover', label: 'What it covers', type: 'textarea' },
    { key: 'excess', label: 'Excess (£)', type: 'money' },
    { key: 'premium', label: 'Premium per payment (£)', type: 'money' },
    { key: 'premiumSchedule', label: 'Premium paid', type: 'schedule', optional: true, hint: 'Leave empty if paid once a year at renewal' },
    { key: 'renewalDate', label: 'Renewal date', type: 'date', required: true },
    { key: 'remindDaysBefore', label: 'Remind me this many days before', type: 'number', placeholder: '30' },
    { key: 'phone', label: 'Claims phone', type: 'text' },
    { key: 'website', label: 'Website', type: 'text' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ],
  house: [
    { key: 'title', label: 'Job', type: 'text', required: true },
    { key: 'kind', label: 'Type', type: 'select', options: [{ value: 'cleaning', label: 'Cleaning' }, { value: 'maintenance', label: 'Maintenance' }], required: true },
    { key: 'room', label: 'Room / area', type: 'select', options: ROOMS },
    { key: 'schedule', label: 'How often', type: 'schedule', required: true },
    { key: 'assignee', label: 'Who does it', type: 'text', placeholder: 'e.g. Me, plumber' },
    { key: 'estCost', label: 'Typical cost (£)', type: 'money' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ],
  loans: [
    { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g. Mortgage' },
    { key: 'kind', label: 'Type', type: 'select', options: [{ value: 'mortgage', label: 'Mortgage' }, { value: 'loan', label: 'Loan' }, { value: 'credit', label: 'Car finance / credit' }], required: true },
    { key: 'lender', label: 'Lender', type: 'text' },
    { key: 'principal', label: 'Amount borrowed (£)', type: 'money', required: true, hint: 'Or the balance when the current deal started' },
    { key: 'annualRate', label: 'Interest rate (% per year)', type: 'number', required: true },
    {
      key: 'termMonths',
      label: 'Term (months)',
      type: 'number',
      required: true,
      hint: '25 years = 300 months',
      extra: (v) => (v.principal && v.termMonths ? <small className="muted">Monthly payment ≈ {money(monthlyPayment(v.principal, v.annualRate || 0, v.termMonths))}</small> : null),
    },
    { key: 'firstPayment', label: 'First payment date', type: 'date', required: true },
    { key: 'extraMonthly', label: 'Overpayment each month (£)', type: 'money' },
    { key: 'fixedUntil', label: 'Fixed rate ends', type: 'date', hint: "You'll get a remortgage reminder 4 months before" },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ],
  budget: [
    { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g. Salary, Groceries' },
    { key: 'kind', label: 'Type', type: 'select', options: [{ value: 'income', label: 'Income' }, { value: 'expense', label: 'Planned spending' }], required: true },
    { key: 'category', label: 'Category', type: 'select', options: SPEND_CATEGORIES },
    { key: 'amount', label: 'Amount (£)', type: 'money', required: true },
    { key: 'schedule', label: 'How often', type: 'schedule', recurringOnly: true, required: true },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ],
  txns: [
    { key: 'date', label: 'Date', type: 'date', required: true },
    { key: 'kind', label: 'Type', type: 'select', options: [{ value: 'expense', label: 'Spent' }, { value: 'income', label: 'Received' }], required: true },
    { key: 'amount', label: 'Amount (£)', type: 'money', required: true },
    { key: 'category', label: 'Category', type: 'select', options: SPEND_CATEGORIES },
    { key: 'note', label: 'Note', type: 'text' },
  ],
  investments: [
    { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g. Vanguard S&S ISA' },
    { key: 'kind', label: 'Type', type: 'select', options: INVESTMENT_KINDS, required: true },
    { key: 'provider', label: 'Provider', type: 'text' },
    { key: 'value', label: 'Current value (£)', type: 'money', required: true, hint: 'Changing this saves the old value in the history' },
    { key: 'valueDate', label: 'Value as of', type: 'date', required: true },
    { key: 'contribution', label: 'Regular contribution (£)', type: 'money' },
    { key: 'contributionSchedule', label: 'Contribution paid', type: 'schedule', optional: true },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ],
  inventory: [
    { key: 'name', label: 'Item', type: 'text', required: true, placeholder: 'e.g. Washing machine' },
    { key: 'category', label: 'Category', type: 'select', options: INVENTORY_CATEGORIES },
    { key: 'room', label: 'Room', type: 'select', options: ROOMS },
    { key: 'brand', label: 'Brand', type: 'text' },
    { key: 'model', label: 'Model', type: 'text' },
    { key: 'serial', label: 'Serial number', type: 'text' },
    { key: 'purchaseDate', label: 'Bought on', type: 'date' },
    { key: 'price', label: 'Price (£)', type: 'money' },
    { key: 'warrantyUntil', label: 'Warranty ends', type: 'date', hint: "You'll get a reminder 30 days before" },
    { key: 'where', label: 'Receipt / manual kept at', type: 'text', placeholder: 'e.g. Email, drawer in office' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ],
  plans: [
    { key: 'name', label: 'Workout', type: 'text', required: true, placeholder: 'e.g. Upper body, 5k run' },
    { key: 'schedule', label: 'When', type: 'schedule', optional: true, hint: 'e.g. every week from Monday. Shows up in My Day' },
    { key: 'exercises', label: 'Exercises', type: 'exercises' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ],
  workouts: [
    { key: 'name', label: 'Workout', type: 'text', required: true },
    { key: 'date', label: 'Date', type: 'date', required: true },
    { key: 'kind', label: 'Type', type: 'select', options: [{ value: 'strength', label: 'Strength / gym' }, { value: 'cardio', label: 'Cardio (run, cycle, swim…)' }, { value: 'other', label: 'Other (sport, yoga, class…)' }] },
    { key: 'minutes', label: 'Duration (minutes)', type: 'number', half: true },
    { key: 'distanceKm', label: 'Distance (km)', type: 'number', half: true, when: (v) => v.kind === 'cardio', extra: (v) => (v.minutes && v.distanceKm ? <small className="muted">Pace {pace(v.minutes, v.distanceKm)}</small> : null) },
    { key: 'entries', label: 'What you did', type: 'exercises', when: (v) => v.kind !== 'cardio' },
    { key: 'feeling', label: 'How did it feel?', type: 'select', options: [{ value: '1', label: '😫 Rough' }, { value: '2', label: '😕 Hard' }, { value: '3', label: '🙂 OK' }, { value: '4', label: '😀 Good' }, { value: '5', label: '🔥 Great' }] },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ],
  foods: [
    { key: 'name', label: 'Food or recipe', type: 'text', required: true, placeholder: 'e.g. Porridge with banana' },
    { key: 'serving', label: 'Serving', type: 'text', placeholder: 'e.g. 1 bowl, 100 g' },
    { key: 'kcal', label: 'Calories (kcal) per serving', type: 'number', required: true },
    { key: 'protein', label: 'Protein (g)', type: 'number', half: true },
    { key: 'carbs', label: 'Carbs (g)', type: 'number', half: true },
    { key: 'fat', label: 'Fat (g)', type: 'number', half: true },
    { key: 'ingredients', label: 'Ingredients (one per line)', type: 'textarea', hint: 'Used to build your shopping list from the meal plan' },
    { key: 'favourite', label: '★ Favourite (shown first)', type: 'checkbox' },
  ],
  meals: [
    { key: 'foodId', label: 'From my foods', type: 'select', options: [], hint: 'Pick a saved food to fill in the numbers' },
    { key: 'name', label: 'What you ate', type: 'text', required: true },
    { key: 'slot', label: 'Meal', type: 'select', options: MEAL_SLOTS, required: true },
    { key: 'date', label: 'Date', type: 'date', required: true },
    { key: 'servings', label: 'Servings', type: 'number', required: true },
    { key: 'kcal', label: 'Calories (kcal) per serving', type: 'number', required: true },
    { key: 'protein', label: 'Protein (g)', type: 'number', half: true },
    { key: 'carbs', label: 'Carbs (g)', type: 'number', half: true },
    { key: 'fat', label: 'Fat (g)', type: 'number', half: true },
  ],
  mealplans: [
    { key: 'foodId', label: 'From my foods', type: 'select', options: [], hint: 'Pick a saved recipe to fill in calories and ingredients' },
    { key: 'name', label: 'Meal', type: 'text', required: true },
    { key: 'slot', label: 'Slot', type: 'select', options: MEAL_SLOTS, required: true },
    { key: 'date', label: 'Day', type: 'date', required: true },
    { key: 'kcal', label: 'Calories (kcal)', type: 'number' },
    { key: 'protein', label: 'Protein (g)', type: 'number', half: true },
    { key: 'carbs', label: 'Carbs (g)', type: 'number', half: true },
    { key: 'fat', label: 'Fat (g)', type: 'number', half: true },
    { key: 'ingredients', label: 'Ingredients (one per line)', type: 'textarea' },
    { key: 'notes', label: 'Notes', type: 'textarea' },
  ],
  weights: [
    { key: 'date', label: 'Date', type: 'date', required: true },
    { key: 'kg', label: 'Weight (kg)', type: 'number', required: true, half: true },
    { key: 'waistCm', label: 'Waist (cm)', type: 'number', half: true },
    { key: 'bodyFat', label: 'Body fat %', type: 'number', half: true },
    { key: 'notes', label: 'Notes', type: 'text' },
  ],
};

export const NOUN: Partial<Record<DataTable, string>> = {
  tasks: 'task',
  objectives: 'objective',
  bills: 'bill',
  policies: 'policy',
  house: 'house job',
  loans: 'loan',
  budget: 'budget line',
  txns: 'spending entry',
  investments: 'investment',
  inventory: 'household item',
  plans: 'workout plan',
  workouts: 'workout',
  foods: 'food',
  meals: 'diary entry',
  mealplans: 'planned meal',
  weights: 'weigh-in',
};

export const SOURCE_TABLE: Record<SourceType, DataTable> = {
  task: 'tasks',
  bill: 'bills',
  policy: 'policies',
  house: 'house',
  loan: 'loans',
  workout: 'plans',
  warranty: 'inventory',
  investment: 'investments',
};

export function defaultsFor(table: DataTable): Record<string, any> {
  const t = today();
  switch (table) {
    case 'tasks':
      return { area: 'Personal', priority: 'normal' };
    case 'objectives':
      return { area: 'Personal', status: 'active' };
    case 'bills':
      return { autopay: true, schedule: { freq: 'monthly', interval: 1, start: t } };
    case 'policies':
      return { remindDaysBefore: 30 };
    case 'house':
      return { kind: 'cleaning', schedule: { freq: 'weekly', interval: 1, start: t } };
    case 'loans':
      return { kind: 'mortgage', termMonths: 300 };
    case 'budget':
      return { kind: 'expense', schedule: { freq: 'monthly', interval: 1, start: t } };
    case 'txns':
      return { date: t, kind: 'expense' };
    case 'investments':
      return { valueDate: t, kind: 'Stocks & Shares ISA' };
    case 'plans':
      return { exercises: [] };
    case 'workouts':
      return { date: t, entries: [] };
    case 'meals':
      return { date: t, slot: slotNow(), servings: 1 };
    case 'mealplans':
      return { date: t, slot: 'Dinner' };
    case 'weights':
      return { date: t };
    default:
      return {};
  }
}

export function slotNow() {
  const h = new Date().getHours();
  return h < 11 ? 'Breakfast' : h < 15 ? 'Lunch' : h < 21 ? 'Dinner' : 'Snacks';
}

/* ---------- global editor (open any record from anywhere) ---------- */
export interface EditRequest {
  table: DataTable;
  id?: string;
  initial?: Record<string, any>;
}
let current: EditRequest | null = null;
const listeners = new Set<() => void>();
export function openEdit(req: EditRequest) {
  current = req;
  listeners.forEach((l) => l());
}
function closeEdit() {
  current = null;
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

export function GlobalEditor() {
  const req = useSyncExternalStore(subscribe, () => current);
  // Tag the result with its request so a stale result from a previous request is never used.
  const res = useLiveQuery(async () => ({ req, rec: req?.id ? ((await (db[req.table] as any).get(req.id)) ?? null) : null }), [req]);
  const objectives = useLiveQuery(() => db.objectives.toArray(), []) ?? [];
  const foods = useLiveQuery(() => db.foods.toArray(), []) ?? [];
  if (!req || res?.req !== req) return null; // nothing open, or still loading
  const rec = res.rec;
  const initial = rec ?? { ...defaultsFor(req.table), ...req.initial };
  let fields = FIELDS[req.table] ?? [];
  if (req.table === 'tasks') {
    const opts = objectives.filter((o) => !o.deleted && o.status !== 'done').map((o) => ({ value: o.id, label: o.title }));
    fields = fields.map((f) => (f.key === 'objectiveId' ? { ...f, options: opts, when: () => opts.length > 0 } : f));
  }
  if (req.table === 'meals' || req.table === 'mealplans') {
    const live = foods.filter((f) => !f.deleted).sort((a, b) => Number(!!b.favourite) - Number(!!a.favourite) || a.name.localeCompare(b.name));
    const opts = live.map((f) => ({ value: f.id, label: `${f.favourite ? '★ ' : ''}${f.name} (${f.kcal} kcal)` }));
    fields = fields.map((f) =>
      f.key === 'foodId'
        ? {
            ...f,
            options: opts,
            when: () => opts.length > 0,
            apply: (id: string) => {
              const food = live.find((x) => x.id === id);
              if (!food) return {};
              return { name: food.name, kcal: food.kcal, protein: food.protein, carbs: food.carbs, fat: food.fat, ...(req.table === 'mealplans' ? { ingredients: food.ingredients } : {}) };
            },
          }
        : f,
    );
  }
  const noun = NOUN[req.table] ?? 'item';
  return (
    <EditorModal
      key={`${req.table}:${req.id ?? 'new'}`}
      title={rec ? `Edit ${noun}` : `New ${noun}`}
      fields={fields}
      initial={initial}
      onClose={closeEdit}
      onSave={async (v) => {
        const out = { ...v };
        if (req.table === 'investments' && rec && rec.value !== v.value) {
          out.history = [...(rec.history ?? []), { date: rec.valueDate, value: rec.value }];
        }
        if (req.table === 'bills' && rec && rec.amount !== v.amount) {
          out.history = [...(rec.history ?? []), { date: today(), amount: rec.amount }];
        }
        if (req.table === 'workouts' && out.feeling) out.feeling = Number(out.feeling);
        const pbs = req.table === 'workouts' && !rec ? newPBs(out as any, (await db.workouts.toArray()).filter((w) => !w.deleted)) : [];
        await save(req.table, out as any);
        if (pbs.length) showToast(`🏆 New personal best: ${pbs.join(', ')}!`);
        // Logging a planned workout ticks off that plan's session in the agenda.
        if (req.table === 'workouts' && !rec && out.planId) {
          const plan = await db.plans.get(out.planId);
          const occ = plan?.schedule ? occurrences(plan.schedule, addDays(out.date, -6), out.date).pop() : undefined;
          if (occ) await save<Completion>('completions', { source: 'workout', sourceId: out.planId, date: occ, completedOn: today() });
        }
      }}
      onDelete={
        rec
          ? async () => {
              await remove(req.table, rec.id);
              showToast(`Deleted ${noun}`, () => (db[req.table] as any).update(rec.id, { deleted: 0, updatedAt: Date.now() }));
            }
          : undefined
      }
      onDuplicate={
        rec
          ? (v) => {
              const { id: _id, createdAt: _c, updatedAt: _u, history: _h, ...copy } = v;
              const name = copy.title !== undefined ? 'title' : 'name';
              if (typeof copy[name] === 'string') copy[name] = `${copy[name]} (copy)`;
              openEdit({ table: req.table, initial: copy });
            }
          : undefined
      }
    />
  );
}

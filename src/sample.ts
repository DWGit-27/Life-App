import { db, save, uid, type Food, type MealEntry, type MealPlan, type Weight, type Bill, type BudgetLine, type HouseJob, type InventoryItem, type Investment, type Loan, type Objective, type Policy, type Task, type Txn, type WorkoutLog, type WorkoutPlan } from './db';
import { addDays, addMonths, today } from './lib/dates';

/** Example data so the app can be tried out. All marked with notes "example". */
export async function loadSample() {
  const t = today();
  const m1 = t.slice(0, 8) + '01';
  const month = (d: number) => addMonths(m1, t.slice(8) > String(d).padStart(2, '0') ? 1 : 0, d);
  const monthly = (d: number) => ({ freq: 'monthly' as const, interval: 1, start: month(d) });
  const bills: Partial<Bill>[] = [
    { name: 'Council tax', provider: 'Local council', category: 'Council tax', amount: 182, schedule: monthly(1), autopay: true },
    { name: 'Energy', provider: 'Energy supplier', category: 'Energy', amount: 145, schedule: monthly(15), autopay: true, contractEnd: addMonths(t, 5) },
    { name: 'Water', provider: 'Water company', category: 'Water', amount: 42, schedule: monthly(5), autopay: true },
    { name: 'Broadband', provider: 'ISP', category: 'Phone & internet', amount: 32, schedule: monthly(20), autopay: true, contractEnd: addMonths(t, 9) },
    { name: 'TV licence', category: 'TV & streaming', amount: 174.5, schedule: { freq: 'yearly', interval: 1, start: addMonths(t, 2) }, autopay: false, paymentMethod: 'Card' },
  ];
  for (const b of bills) await save<Bill>('bills', { ...(b as Bill), notes: 'example' });
  const policies: Partial<Policy>[] = [
    { name: 'Home insurance', kind: 'Home (buildings)', insurer: 'Insurer A', policyNumber: 'HM-123456', premium: 28, premiumSchedule: monthly(10), renewalDate: addDays(t, 25), remindDaysBefore: 30, excess: 250 },
    { name: 'Car insurance', kind: 'Car', insurer: 'Insurer B', policyNumber: 'CAR-98765', premium: 540, renewalDate: addMonths(t, 4), remindDaysBefore: 30, excess: 350 },
    { name: 'Life insurance', kind: 'Life', insurer: 'Insurer C', premium: 18, premiumSchedule: monthly(1), renewalDate: addMonths(t, 11) },
  ];
  for (const p of policies) await save<Policy>('policies', { ...(p as Policy), notes: 'example' });
  const house: Partial<HouseJob>[] = [
    { kind: 'cleaning', title: 'Hoover', room: 'Whole house', schedule: { freq: 'weekly', interval: 1, start: addDays(t, -3) } },
    { kind: 'cleaning', title: 'Clean bathroom', room: 'Bathroom', schedule: { freq: 'weekly', interval: 1, start: addDays(t, 1) } },
    { kind: 'cleaning', title: 'Change bedding', room: 'Bedroom', schedule: { freq: 'weekly', interval: 2, start: t } },
    { kind: 'maintenance', title: 'Boiler service', room: 'Whole house', schedule: { freq: 'yearly', interval: 1, start: addDays(t, 10) }, estCost: 95, assignee: 'Gas engineer' },
    { kind: 'maintenance', title: 'Test smoke alarms', room: 'Whole house', schedule: { freq: 'monthly', interval: 1, start: addDays(t, 4) } },
  ];
  for (const h of house) await save<HouseJob>('house', { ...(h as HouseJob), notes: 'example' });
  await save<Loan>('loans', { name: 'Mortgage', kind: 'mortgage', lender: 'Building society', principal: 220000, annualRate: 4.29, termMonths: 300, firstPayment: addMonths(m1, -26, 1), fixedUntil: addMonths(t, 10), notes: 'example' });
  const budget: Partial<BudgetLine>[] = [
    { name: 'Salary', kind: 'income', category: 'Salary', amount: 3400, schedule: monthly(25) },
    { name: 'Groceries', kind: 'expense', category: 'Groceries', amount: 90, schedule: { freq: 'weekly', interval: 1, start: t } },
    { name: 'Fuel', kind: 'expense', category: 'Fuel', amount: 120, schedule: monthly(1) },
    { name: 'Eating out', kind: 'expense', category: 'Eating out', amount: 150, schedule: monthly(1) },
    { name: 'Savings', kind: 'expense', category: 'Savings', amount: 300, schedule: monthly(26) },
  ];
  for (const b of budget) await save<BudgetLine>('budget', { ...(b as BudgetLine), notes: 'example' });
  const tx: [number, string, number][] = [[-1, 'Groceries', 84.3], [-4, 'Eating out', 46], [-6, 'Fuel', 62.1], [-8, 'Groceries', 91.75]];
  for (const [d, category, amount] of tx) {
    const date = addDays(t, d);
    if (date.slice(0, 7) === t.slice(0, 7)) await save<Txn>('txns', { date, kind: 'expense', category, amount, note: 'example' });
  }
  const objWork = uid();
  const obj10k = uid();
  await save<Objective>('objectives', { id: objWork, title: 'Deliver the Q4 review', area: 'Work', why: 'Sets next year\'s budget', targetDate: addDays(t, 20), status: 'active', notes: 'example' });
  await save<Objective>('objectives', { id: obj10k, title: 'Run a 10k', area: 'Health', targetDate: addMonths(t, 4), status: 'active', notes: 'example' });
  const tasks: Partial<Task>[] = [
    { title: 'Prepare quarterly report', area: 'Work', project: 'Q4 review', objectiveId: objWork, priority: 'high', schedule: { freq: 'once', interval: 1, start: addDays(t, 2) }, checklist: [{ text: 'Pull numbers', done: true }, { text: 'Draft slides', done: false }, { text: 'Review with manager', done: false }] },
    { title: 'Book review meeting', area: 'Work', objectiveId: objWork, schedule: { freq: 'once', interval: 1, start: t } },
    { title: 'Sign up for a 10k race', area: 'Health', objectiveId: obj10k },
    { title: 'Team 1:1s', area: 'Work', schedule: { freq: 'weekly', interval: 1, start: addDays(t, 1) } },
    { title: 'Book dentist', area: 'Health', priority: 'normal' },
  ];
  for (const x of tasks) await save<Task>('tasks', { ...(x as Task), notes: 'example' });
  const investments: Partial<Investment>[] = [
    { name: 'Stocks & Shares ISA', kind: 'Stocks & Shares ISA', provider: 'Platform A', value: 18450, valueDate: t, contribution: 250, contributionSchedule: monthly(28), history: [{ date: addMonths(t, -3), value: 17200 }] },
    { name: 'Workplace pension', kind: 'Workplace pension', provider: 'Pension co.', value: 42300, valueDate: addDays(t, -20) },
    { name: 'Home', kind: 'Property', value: 295000, valueDate: addMonths(t, -2), notes: 'Estimated from local sold prices' },
    { name: 'Easy access savings', kind: 'Savings account', provider: 'Bank', value: 6200, valueDate: t },
  ];
  for (const i of investments) await save<Investment>('investments', { ...(i as Investment), notes: 'example' });
  const inventory: Partial<InventoryItem>[] = [
    { name: 'Washing machine', category: 'Appliance', room: 'Kitchen', brand: 'Brand W', model: 'WM-800', serial: 'SN12345', purchaseDate: addMonths(t, -23), price: 449, warrantyUntil: addDays(t, 20), where: 'Email receipt' },
    { name: 'Laptop', category: 'Electronics', room: 'Office', brand: 'Brand L', price: 1199, purchaseDate: addMonths(t, -8), warrantyUntil: addMonths(t, 16) },
    { name: 'Sofa', category: 'Furniture', room: 'Living room', price: 899, purchaseDate: addMonths(t, -30) },
  ];
  for (const i of inventory) await save<InventoryItem>('inventory', { ...(i as InventoryItem), notes: 'example' });
  const push = uid();
  await save<WorkoutPlan>('plans', { id: push, name: 'Upper body', schedule: { freq: 'weekly', interval: 1, start: t }, exercises: [{ name: 'Bench press', sets: 4, reps: '8', weight: 60 }, { name: 'Pull-ups', sets: 3, reps: '8' }, { name: 'Shoulder press', sets: 3, reps: '10', weight: 30 }], notes: 'example' });
  await save<WorkoutPlan>('plans', { name: 'Legs', schedule: { freq: 'weekly', interval: 1, start: addDays(t, 2) }, exercises: [{ name: 'Squat', sets: 4, reps: '6', weight: 80 }, { name: 'Romanian deadlift', sets: 3, reps: '10', weight: 60 }], notes: 'example' });
  await save<WorkoutPlan>('plans', { name: '5k run', schedule: { freq: 'weekly', interval: 1, start: addDays(t, 4) }, exercises: [], notes: 'example' });
  const logs: Partial<WorkoutLog>[] = [
    { name: 'Upper body', planId: push, date: addDays(t, -7), minutes: 55, feeling: 4, entries: [{ name: 'Bench press', sets: 4, reps: '8', weight: 57.5 }, { name: 'Shoulder press', sets: 3, reps: '10', weight: 27.5 }] },
    { name: 'Legs', date: addDays(t, -5), minutes: 50, feeling: 3, entries: [{ name: 'Squat', sets: 4, reps: '6', weight: 77.5 }] },
    { name: '5k run', date: addDays(t, -14), minutes: 29, feeling: 5, entries: [] },
  ];
  for (const l of logs) await save<WorkoutLog>('workouts', { ...(l as WorkoutLog), notes: 'example' });

  // nutrition
  const foods: Partial<Food>[] = [
    { name: 'Porridge with banana', serving: '1 bowl', kcal: 350, protein: 11, carbs: 62, fat: 7, favourite: true, ingredients: 'Oats\nMilk\nBananas' },
    { name: 'Chicken salad wrap', serving: '1 wrap', kcal: 480, protein: 35, carbs: 42, fat: 18, favourite: true, ingredients: 'Tortilla wraps\nChicken breast\nSalad leaves' },
    { name: 'Spaghetti bolognese', serving: '1 plate', kcal: 650, protein: 38, carbs: 78, fat: 20, ingredients: 'Spaghetti\nBeef mince\nChopped tomatoes\nOnion\nGarlic' },
    { name: 'Salmon, rice & greens', serving: '1 plate', kcal: 620, protein: 40, carbs: 60, fat: 22, ingredients: 'Salmon fillets\nRice\nBroccoli' },
    { name: 'Greek yoghurt & berries', serving: '1 pot', kcal: 180, protein: 15, carbs: 18, fat: 5, favourite: true, ingredients: 'Greek yoghurt\nBerries' },
    { name: 'Coffee with milk', serving: '1 mug', kcal: 40, protein: 2, carbs: 4, fat: 2, favourite: true },
  ];
  const foodIds: string[] = [];
  for (const f of foods) foodIds.push(await save<Food>('foods', { ...(f as Food) }));
  const [porridge, wrap, bolognese, salmon, yoghurt] = foods as Food[];
  const log: [MealEntry['slot'], Food, number][] = [['Breakfast', porridge, 1], ['Lunch', wrap, 1], ['Snacks', yoghurt, 1]];
  for (const [slot, f, n] of log) await save<MealEntry>('meals', { date: t, slot, name: f.name, servings: n, kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat });
  const ws = addDays(t, -((new Date(t + 'T00:00').getDay() + 6) % 7));
  const dinners = [bolognese, salmon, bolognese, salmon, wrap, salmon, bolognese];
  for (let i = 0; i < 7; i++) {
    const f = dinners[i];
    await save<MealPlan>('mealplans', { date: addDays(ws, i), slot: 'Dinner', name: f.name, kcal: f.kcal, protein: f.protein, carbs: f.carbs, fat: f.fat, ingredients: f.ingredients });
    await save<MealPlan>('mealplans', { date: addDays(ws, i), slot: 'Breakfast', name: porridge.name, kcal: porridge.kcal, protein: porridge.protein, carbs: porridge.carbs, fat: porridge.fat, ingredients: porridge.ingredients });
  }
  const kg = [82.4, 82.1, 82.3, 81.8, 81.6, 81.7, 81.2, 81.0];
  for (let i = 0; i < kg.length; i++) await save<Weight>('weights', { date: addDays(t, -7 * (kg.length - 1 - i)), kg: kg[i] });
  if (!(await db.settings.get('nutrition'))) await db.settings.put({ key: 'nutrition', value: { kcal: 2200, protein: 160, carbs: 230, fat: 70 } });
  // a focus task
  await save<Task>('tasks', { title: 'Book boiler service', area: 'Home', focus: true, priority: 'high', notes: 'example' });
}

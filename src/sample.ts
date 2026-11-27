import { save, type Bill, type BudgetLine, type HouseJob, type Loan, type Policy, type Task, type Txn } from './db';
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
  const tasks: Partial<Task>[] = [
    { title: 'Prepare quarterly report', area: 'Work', project: 'Q4 review', priority: 'high', schedule: { freq: 'once', interval: 1, start: addDays(t, 2) } },
    { title: 'Team 1:1s', area: 'Work', schedule: { freq: 'weekly', interval: 1, start: addDays(t, 1) } },
    { title: 'Book dentist', area: 'Health', priority: 'normal' },
    { title: 'Gym: upper body', area: 'Health', schedule: { freq: 'weekly', interval: 1, start: t } },
  ];
  for (const x of tasks) await save<Task>('tasks', { ...(x as Task), notes: 'example' });
}

import Dexie, { type EntityTable } from 'dexie';
import type { Schedule } from './lib/schedule';
import type { ISODate } from './lib/dates';

/** Every record carries these so it can be synced between devices/users later. */
export interface Base {
  id: string;
  createdAt: number;
  updatedAt: number;
  deleted?: 0 | 1;
}

export type Area = 'Personal' | 'Work' | 'Home' | 'Money' | 'Health';
export const AREAS: Area[] = ['Personal', 'Work', 'Home', 'Money', 'Health'];

export interface CheckItem {
  text: string;
  done: boolean;
}

export interface Task extends Base {
  title: string;
  area: Area;
  objectiveId?: string;
  checklist?: CheckItem[];
  schedule?: Schedule; // freq 'once' for a one-off task with a due date
  priority?: 'low' | 'normal' | 'high';
  /** starred as one of today's focus tasks */
  focus?: boolean;
  project?: string;
  notes?: string;
}

/** Marks one occurrence of any source (task, bill, policy, house job, loan) as done. */
export interface Completion extends Base {
  source: SourceType;
  sourceId: string;
  date: ISODate; // the occurrence date that was completed
  completedOn: ISODate;
}

export interface Bill extends Base {
  name: string;
  provider?: string;
  category?: string;
  amount: number;
  schedule: Schedule;
  account?: string;
  paymentMethod?: string;
  autopay?: boolean;
  reference?: string;
  contact?: string;
  contractEnd?: ISODate;
  /** previous amounts, newest last */
  history?: { date: ISODate; amount: number }[];
  notes?: string;
}

export interface Policy extends Base {
  name: string;
  insurer?: string;
  kind?: string;
  policyNumber?: string;
  cover?: string;
  excess?: number;
  premium?: number;
  premiumSchedule?: Schedule;
  renewalDate?: ISODate;
  remindDaysBefore?: number;
  phone?: string;
  website?: string;
  notes?: string;
}

export interface HouseJob extends Base {
  kind: 'maintenance' | 'cleaning';
  title: string;
  room?: string;
  schedule: Schedule;
  assignee?: string;
  estCost?: number;
  notes?: string;
}

export interface Loan extends Base {
  name: string;
  kind: 'mortgage' | 'loan' | 'credit';
  lender?: string;
  principal: number;
  annualRate: number;
  termMonths: number;
  firstPayment: ISODate;
  extraMonthly?: number;
  fixedUntil?: ISODate;
  notes?: string;
}

export interface BudgetLine extends Base {
  name: string;
  kind: 'income' | 'expense';
  category?: string;
  amount: number;
  schedule: Schedule;
  notes?: string;
}

export interface Txn extends Base {
  date: ISODate;
  kind: 'income' | 'expense';
  amount: number;
  category?: string;
  note?: string;
}

export interface Objective extends Base {
  title: string;
  area: Area;
  why?: string;
  targetDate?: ISODate;
  status: 'active' | 'done' | 'paused';
  notes?: string;
}

export interface Investment extends Base {
  name: string;
  kind: string; // ISA, Pension, Shares, Savings, Premium Bonds, Crypto, Property, Other
  provider?: string;
  value: number;
  valueDate: ISODate;
  contribution?: number;
  contributionSchedule?: Schedule;
  history?: { date: ISODate; value: number }[];
  notes?: string;
}

export interface InventoryItem extends Base {
  name: string;
  room?: string;
  category?: string;
  brand?: string;
  model?: string;
  serial?: string;
  purchaseDate?: ISODate;
  price?: number;
  warrantyUntil?: ISODate;
  where?: string; // where the receipt/manual is
  notes?: string;
}

export interface Exercise {
  name: string;
  sets?: number;
  reps?: string;
  weight?: number;
}

export interface WorkoutPlan extends Base {
  name: string;
  schedule?: Schedule;
  exercises: Exercise[];
  notes?: string;
}

export interface WorkoutLog extends Base {
  date: ISODate;
  planId?: string;
  name: string;
  minutes?: number;
  entries: Exercise[];
  feeling?: number; // 1-5
  notes?: string;
}

/** Moves one occurrence of a source to another date. */
export interface Snooze extends Base {
  source: SourceType;
  sourceId: string;
  date: ISODate;
  to: ISODate;
}

export type MealSlot = 'Breakfast' | 'Lunch' | 'Dinner' | 'Snacks';
export const MEAL_SLOTS: MealSlot[] = ['Breakfast', 'Lunch', 'Dinner', 'Snacks'];

export interface Macros {
  kcal: number;
  protein?: number;
  carbs?: number;
  fat?: number;
}

/** A saved food or recipe, per serving. */
export interface Food extends Base, Macros {
  name: string;
  serving?: string; // e.g. "1 bowl", "100 g"
  ingredients?: string; // one per line, used for the shopping list
  favourite?: boolean;
}

/** One entry in the food diary. Macros are per serving. */
export interface MealEntry extends Base, Macros {
  date: ISODate;
  slot: MealSlot;
  name: string;
  servings: number;
  foodId?: string;
}

/** A planned meal on a day. */
export interface MealPlan extends Base, Macros {
  date: ISODate;
  slot: MealSlot;
  name: string;
  foodId?: string;
  ingredients?: string;
  notes?: string;
}

export interface Weight extends Base {
  date: ISODate;
  kg: number;
  notes?: string;
}

export interface Setting {
  key: string;
  value: unknown;
}

export type SourceType = 'task' | 'bill' | 'policy' | 'house' | 'loan' | 'workout' | 'warranty' | 'investment';

export class LifeDB extends Dexie {
  tasks!: EntityTable<Task, 'id'>;
  completions!: EntityTable<Completion, 'id'>;
  bills!: EntityTable<Bill, 'id'>;
  policies!: EntityTable<Policy, 'id'>;
  house!: EntityTable<HouseJob, 'id'>;
  loans!: EntityTable<Loan, 'id'>;
  budget!: EntityTable<BudgetLine, 'id'>;
  txns!: EntityTable<Txn, 'id'>;
  settings!: EntityTable<Setting, 'key'>;
  objectives!: EntityTable<Objective, 'id'>;
  investments!: EntityTable<Investment, 'id'>;
  inventory!: EntityTable<InventoryItem, 'id'>;
  plans!: EntityTable<WorkoutPlan, 'id'>;
  workouts!: EntityTable<WorkoutLog, 'id'>;
  snoozes!: EntityTable<Snooze, 'id'>;
  foods!: EntityTable<Food, 'id'>;
  meals!: EntityTable<MealEntry, 'id'>;
  mealplans!: EntityTable<MealPlan, 'id'>;
  weights!: EntityTable<Weight, 'id'>;

  constructor() {
    super('life-app');
    this.version(1).stores({
      tasks: 'id, area, updatedAt',
      completions: 'id, [source+sourceId], date, updatedAt',
      bills: 'id, updatedAt',
      policies: 'id, renewalDate, updatedAt',
      house: 'id, kind, updatedAt',
      loans: 'id, updatedAt',
      budget: 'id, kind, updatedAt',
      txns: 'id, date, updatedAt',
      settings: 'key',
    });
    this.version(2).stores({
      objectives: 'id, updatedAt',
      investments: 'id, updatedAt',
      inventory: 'id, updatedAt',
      plans: 'id, updatedAt',
      workouts: 'id, date, updatedAt',
      snoozes: 'id, [source+sourceId], updatedAt',
    });
    this.version(3).stores({
      foods: 'id, updatedAt',
      meals: 'id, date, updatedAt',
      mealplans: 'id, date, updatedAt',
      weights: 'id, date, updatedAt',
    });
  }
}

export const db = new LifeDB();

export const DATA_TABLES = ['tasks', 'completions', 'bills', 'policies', 'house', 'loans', 'budget', 'txns', 'objectives', 'investments', 'inventory', 'plans', 'workouts', 'snoozes', 'foods', 'meals', 'mealplans', 'weights'] as const;
export type DataTable = (typeof DATA_TABLES)[number];

export function uid(): string {
  return crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

type Rec = Base & Record<string, unknown>;

export async function save<T extends Base>(table: DataTable, rec: Omit<T, keyof Base> & Partial<Base>): Promise<string> {
  const now = Date.now();
  const full = { ...rec, id: rec.id ?? uid(), createdAt: rec.createdAt ?? now, updatedAt: now, deleted: 0 } as Rec;
  await (db[table] as unknown as Dexie.Table<Rec, string>).put(full);
  return full.id;
}

/** Soft delete, so the deletion can sync to other devices. */
export async function remove(table: DataTable, id: string): Promise<void> {
  await (db[table] as unknown as Dexie.Table<Rec, string>).update(id, { deleted: 1, updatedAt: Date.now() });
}

export const live = <T extends Base>(rows: T[] | undefined): T[] => (rows ?? []).filter((r) => !r.deleted);

export async function exportAll(): Promise<string> {
  const out: Record<string, unknown> = { app: 'life-app', version: 1, exportedAt: new Date().toISOString() };
  for (const t of DATA_TABLES) out[t] = await db[t].toArray();
  out.settings = await db.settings.toArray();
  return JSON.stringify(out, null, 2);
}

/** Merge a backup in: newer updatedAt wins per record. */
export async function importAll(json: string): Promise<number> {
  const data = JSON.parse(json);
  if (data?.app !== 'life-app') throw new Error('This file is not a Life App backup.');
  let count = 0;
  await db.transaction('rw', [...DATA_TABLES.map((t) => db[t]), db.settings], async () => {
    for (const t of DATA_TABLES) {
      const table = db[t] as unknown as Dexie.Table<Rec, string>;
      for (const rec of (data[t] ?? []) as Rec[]) {
        const cur = await table.get(rec.id);
        if (!cur || (rec.updatedAt ?? 0) > (cur.updatedAt ?? 0)) {
          await table.put(rec);
          count++;
        }
      }
    }
    for (const s of (data.settings ?? []) as Setting[]) await db.settings.put(s);
  });
  return count;
}

export interface Profile {
  sex: 'male' | 'female';
  age: number;
  heightCm: number;
  weightKg: number;
  activity: number; // multiplier 1.2 … 1.9
  goal: 'lose' | 'maintain' | 'gain';
}

export const ACTIVITY: { value: number; label: string }[] = [
  { value: 1.2, label: 'Mostly sitting' },
  { value: 1.375, label: 'Light exercise 1–3 days/week' },
  { value: 1.55, label: 'Moderate exercise 3–5 days/week' },
  { value: 1.725, label: 'Hard exercise 6–7 days/week' },
  { value: 1.9, label: 'Very hard exercise or physical job' },
];

/** Mifflin–St Jeor basal metabolic rate (kcal/day). */
export function bmr(p: Pick<Profile, 'sex' | 'age' | 'heightCm' | 'weightKg'>): number {
  return 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === 'male' ? 5 : -161);
}

export interface Targets {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

/** Daily calorie and macro targets. Lose = -500 kcal (~0.5 kg/week), gain = +300. */
export function targets(p: Profile): Targets {
  const tdee = bmr(p) * p.activity;
  const kcal = Math.round((tdee + (p.goal === 'lose' ? -500 : p.goal === 'gain' ? 300 : 0)) / 10) * 10;
  const protein = Math.round(p.weightKg * (p.goal === 'maintain' ? 1.6 : 2)); // g
  const fat = Math.round((kcal * 0.28) / 9); // g
  const carbs = Math.max(0, Math.round((kcal - protein * 4 - fat * 9) / 4)); // g
  return { kcal, protein, carbs, fat };
}

export interface MacroLike {
  kcal?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  servings?: number;
}

export function sumMacros(items: MacroLike[]) {
  const t = { kcal: 0, protein: 0, carbs: 0, fat: 0 };
  for (const i of items) {
    const n = i.servings ?? 1;
    t.kcal += (i.kcal || 0) * n;
    t.protein += (i.protein || 0) * n;
    t.carbs += (i.carbs || 0) * n;
    t.fat += (i.fat || 0) * n;
  }
  return t;
}

/** Merge ingredient lines from several meals into one shopping list. "2 eggs" twice → "2 eggs ×2". */
export function shoppingList(ingredientBlocks: (string | undefined)[]): { item: string; count: number }[] {
  const map = new Map<string, { item: string; count: number }>();
  for (const block of ingredientBlocks)
    for (const raw of (block ?? '').split(/\n|,/)) {
      const item = raw.trim().replace(/^[-•*]\s*/, '');
      if (!item) continue;
      const k = item.toLowerCase();
      const cur = map.get(k);
      if (cur) cur.count++;
      else map.set(k, { item, count: 1 });
    }
  return [...map.values()].sort((a, b) => a.item.localeCompare(b.item));
}

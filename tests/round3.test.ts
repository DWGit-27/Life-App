import { describe, expect, it } from 'vitest';
import { bmr, shoppingList, sumMacros, targets } from '../src/lib/nutrition';
import { parseQuickAdd } from '../src/lib/quickadd';

describe('nutrition', () => {
  it('Mifflin-St Jeor', () => {
    expect(bmr({ sex: 'male', age: 30, heightCm: 180, weightKg: 80 })).toBe(1780);
    expect(bmr({ sex: 'female', age: 30, heightCm: 165, weightKg: 60 })).toBeCloseTo(1320.25, 2);
  });
  it('targets add up', () => {
    const t = targets({ sex: 'male', age: 30, heightCm: 180, weightKg: 80, activity: 1.55, goal: 'lose' });
    expect(t.kcal).toBe(2260);
    expect(Math.abs(t.protein * 4 + t.carbs * 4 + t.fat * 9 - t.kcal)).toBeLessThan(15);
  });
  it('sums servings', () => {
    expect(sumMacros([{ kcal: 100, protein: 10, servings: 2 }, { kcal: 50 }])).toEqual({ kcal: 250, protein: 20, carbs: 0, fat: 0 });
  });
  it('merges shopping list', () => {
    expect(shoppingList(['Eggs\n- Milk', 'eggs, bread'])).toEqual([
      { item: 'bread', count: 1 },
      { item: 'Eggs', count: 2 },
      { item: 'Milk', count: 1 },
    ]);
  });
});

describe('quick add', () => {
  const t = '2026-11-27'; // Friday
  it('parses date words, priority and area', () => {
    expect(parseQuickAdd('Call plumber tomorrow !high #home', t)).toEqual({ title: 'Call plumber', date: '2026-11-28', priority: 'high', area: 'Home' });
    expect(parseQuickAdd('Report mon #work', t)).toMatchObject({ title: 'Report', date: '2026-11-30', area: 'Work' });
    expect(parseQuickAdd('Gym fri', t).date).toBe('2026-12-04');
    expect(parseQuickAdd('Dentist 3/1', t).date).toBe('2027-01-03');
    expect(parseQuickAdd('Renew passport in 10 days *', t)).toMatchObject({ title: 'Renew passport', date: '2026-12-07', focus: true });
    expect(parseQuickAdd('Learn piano someday', t)).toMatchObject({ title: 'Learn piano', anytime: true });
  });
});

import { describe, expect, it } from 'vitest';
import { addMonths } from '../src/lib/dates';
import { occurrences, perYear } from '../src/lib/schedule';
import { amortise, monthlyPayment, summarise } from '../src/lib/mortgage';
import { buildAgenda, type Sources } from '../src/agenda';

const base = { createdAt: 0, updatedAt: 0 };
const empty: Sources = { tasks: [], bills: [], policies: [], house: [], loans: [], completions: [] };

describe('dates', () => {
  it('clamps month ends and keeps anchor day', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29');
    expect(addMonths('2026-01-31', 2, 31)).toBe('2026-03-31');
    expect(addMonths('2026-11-15', 2)).toBe('2027-01-15');
  });
});

describe('schedule', () => {
  it('monthly on 31st keeps landing on month end', () => {
    expect(occurrences({ freq: 'monthly', interval: 1, start: '2026-01-31' }, '2026-01-01', '2026-04-30')).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30']);
  });
  it('fortnightly from long ago', () => {
    const o = occurrences({ freq: 'weekly', interval: 2, start: '2020-01-06' }, '2026-11-01', '2026-11-30');
    expect(o.length).toBeGreaterThanOrEqual(2);
    expect(o.every((d) => new Date(d + 'T00:00').getDay() === 1)).toBe(true);
  });
  it('respects until and once', () => {
    expect(occurrences({ freq: 'daily', interval: 1, start: '2026-01-01', until: '2026-01-03' }, '2026-01-01', '2026-02-01')).toHaveLength(3);
    expect(occurrences({ freq: 'once', interval: 1, start: '2026-05-05' }, '2026-01-01', '2026-12-31')).toEqual(['2026-05-05']);
  });
  it('perYear', () => {
    expect(perYear({ freq: 'monthly', interval: 1, start: '2026-01-01' })).toBe(12);
    expect(perYear({ freq: 'weekly', interval: 2, start: '2026-01-01' })).toBe(26);
  });
});

describe('mortgage', () => {
  it('matches standard repayment formula', () => {
    // £200,000 over 25 years at 4.5% ≈ £1,111.66 a month
    expect(monthlyPayment(200000, 4.5, 300)).toBeCloseTo(1111.66, 1);
    const rows = amortise({ principal: 200000, annualRate: 4.5, termMonths: 300, firstPayment: '2026-01-01' });
    expect(rows).toHaveLength(300);
    expect(rows[rows.length - 1].balance).toBe(0);
  });
  it('overpayments shorten the term', () => {
    const rows = amortise({ principal: 200000, annualRate: 4.5, termMonths: 300, firstPayment: '2026-01-01', extraMonthly: 300 });
    expect(rows.length).toBeLessThan(230);
  });
  it('zero rate', () => {
    expect(monthlyPayment(1200, 0, 12)).toBe(100);
  });
  it('summary as of date', () => {
    const s = summarise({ principal: 12000, annualRate: 0, termMonths: 12, firstPayment: '2026-01-15' }, '2026-03-20');
    expect(s.balanceNow).toBe(9000);
    expect(s.paymentsLeft).toBe(9);
    expect(s.nextPayment?.date).toBe('2026-04-15');
  });
});

describe('agenda', () => {
  it('pulls from all modules and folds missed chores', () => {
    const s: Sources = {
      ...empty,
      tasks: [{ ...base, id: 't1', title: 'Report', area: 'Work', schedule: { freq: 'once', interval: 1, start: '2026-11-28' } }],
      bills: [{ ...base, id: 'b1', name: 'Council tax', amount: 180, schedule: { freq: 'monthly', interval: 1, start: '2026-04-01' } }],
      house: [{ ...base, id: 'h1', kind: 'cleaning', title: 'Hoover', schedule: { freq: 'weekly', interval: 1, start: '2026-11-02' } }],
      policies: [{ ...base, id: 'p1', name: 'Home insurance', renewalDate: '2026-12-20', remindDaysBefore: 21 }],
    };
    const a = buildAgenda(s, '2026-11-27', 14, 60);
    const hoover = a.filter((i) => i.sourceId === 'h1');
    // overdue Nov 2,9,16,23 folded into Nov 23, plus upcoming Nov 30, Dec 7
    expect(hoover.map((i) => i.date)).toEqual(['2026-11-23', '2026-11-30', '2026-12-07']);
    expect(hoover[0].missed).toHaveLength(3);
    // council tax: Oct 1 and Nov 1 overdue (not folded), Dec 1 upcoming
    expect(a.filter((i) => i.sourceId === 'b1').map((i) => i.date)).toEqual(['2026-10-01', '2026-11-01', '2026-12-01']);
    expect(a.find((i) => i.sourceId === 'p1')?.date).toBe('2026-11-29');
    expect(a.find((i) => i.sourceId === 't1')).toBeTruthy();
  });
  it('completions hide items', () => {
    const s: Sources = {
      ...empty,
      bills: [{ ...base, id: 'b1', name: 'Water', amount: 40, schedule: { freq: 'monthly', interval: 1, start: '2026-11-01' } }],
      completions: [{ ...base, id: 'c', source: 'bill', sourceId: 'b1', date: '2026-11-01', completedOn: '2026-11-01' }],
    };
    expect(buildAgenda(s, '2026-11-27').map((i) => i.date)).toEqual(['2026-12-01']);
  });
});

describe('agenda extras', () => {
  it('snoozes move an occurrence and workouts/warranties appear', () => {
    const s: Sources = {
      ...empty,
      house: [{ ...base, id: 'h1', kind: 'cleaning', title: 'Hoover', schedule: { freq: 'weekly', interval: 1, start: '2026-11-27' } }],
      snoozes: [{ ...base, id: 'z', source: 'house', sourceId: 'h1', date: '2026-11-27', to: '2026-11-29' }],
      plans: [{ ...base, id: 'w1', name: 'Legs', exercises: [], schedule: { freq: 'weekly', interval: 1, start: '2026-11-28' } }],
      inventory: [{ ...base, id: 'i1', name: 'Washing machine', warrantyUntil: '2026-12-20' }],
    };
    const a = buildAgenda(s, '2026-11-27', 7);
    const h = a.find((i) => i.sourceId === 'h1')!;
    expect(h.date).toBe('2026-11-29');
    expect(h.occurrence).toBe('2026-11-27');
    expect(h.snoozed).toBe(true);
    expect(a.find((i) => i.source === 'workout')?.area).toBe('Health');
    // warranty reminder 30 days before: 2026-11-20 -> overdue but within lookback
    expect(a.find((i) => i.source === 'warranty')?.date).toBe('2026-11-20');
    expect(a.find((i) => i.source === 'warranty')?.target).toBe('2026-12-20');
  });
});

import { describe, expect, it } from 'vitest';
import { e1rm, exerciseHistory, newPBs, pace, personalBests, setsOf, volume, weeklyTotals } from '../src/lib/fitness';
import type { WorkoutLog } from '../src/db';

const base = { createdAt: 0, updatedAt: 0 };
const log = (id: string, date: string, entries: WorkoutLog['entries'], minutes = 50): WorkoutLog => ({ ...base, id, date, name: 'x', entries, minutes });

describe('fitness', () => {
  it('epley', () => {
    expect(e1rm(100, 1)).toBe(100);
    expect(e1rm(100, 5)).toBeCloseTo(116.7, 1);
  });
  it('uses live sets when present, planned otherwise', () => {
    expect(setsOf({ name: 'Squat', sets: 3, reps: '8-10', weight: 60 })).toHaveLength(3);
    expect(setsOf({ name: 'Squat', sets: 3, reps: '8', weight: 60, setsDone: [{ reps: 8, weight: 60, done: true }, { reps: 6, weight: 60, done: false }] })).toEqual([{ reps: 8, weight: 60 }]);
    expect(volume([{ name: 'Squat', sets: 3, reps: '10', weight: 50 }])).toBe(1500);
  });
  it('history, PBs and new PB detection', () => {
    const logs = [log('a', '2026-11-01', [{ name: 'Bench press', sets: 3, reps: '8', weight: 60 }]), log('b', '2026-11-08', [{ name: 'bench press ', sets: 3, reps: '8', weight: 62.5 }])];
    const h = exerciseHistory(logs, 'Bench Press');
    expect(h.map((p) => p.topWeight)).toEqual([60, 62.5]);
    const pb = personalBests(logs)[0];
    expect(pb.heaviest.weight).toBe(62.5);
    expect(pb.sessions).toBe(2);
    expect(newPBs({ date: '2026-11-15', entries: [{ name: 'Bench press', sets: 1, reps: '8', weight: 65 }] }, logs)).toEqual(['Bench press']);
    expect(newPBs({ date: '2026-11-15', entries: [{ name: 'Bench press', sets: 1, reps: '5', weight: 60 }] }, logs)).toEqual([]);
  });
  it('weekly totals and pace', () => {
    const w = weeklyTotals([log('a', '2026-11-23', []), log('b', '2026-11-27', []), log('c', '2026-11-16', [])], '2026-11-28', 3);
    expect(w.map((x) => x.count)).toEqual([0, 1, 2]);
    expect(pace(27.5, 5)).toBe('5:30 /km');
  });
});

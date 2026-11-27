import { useState } from 'react';
import { CrudList, useRows } from '../components/Crud';
import type { FieldSpec } from '../components/Form';
import { save, type HouseJob } from '../db';
import { describeSchedule, nextOccurrence } from '../lib/schedule';
import { relativeLabel, today } from '../lib/dates';
import { money } from '../lib/format';

const ROOMS = ['Whole house', 'Kitchen', 'Living room', 'Bathroom', 'Bedroom', 'Hallway', 'Garden', 'Garage', 'Exterior', 'Loft'];

const fields: FieldSpec[] = [
  { key: 'title', label: 'Job', type: 'text', required: true },
  { key: 'kind', label: 'Type', type: 'select', options: [{ value: 'maintenance', label: 'Maintenance' }, { value: 'cleaning', label: 'Cleaning' }], required: true },
  { key: 'room', label: 'Room / area', type: 'select', options: ROOMS },
  { key: 'schedule', label: 'How often', type: 'schedule', required: true },
  { key: 'assignee', label: 'Who does it', type: 'text', placeholder: 'e.g. Me, plumber' },
  { key: 'estCost', label: 'Typical cost (£)', type: 'money' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
];

const SUGGEST: Record<HouseJob['kind'], [string, string, number, 'weekly' | 'monthly' | 'yearly'][]> = {
  maintenance: [
    ['Boiler service', 'Whole house', 1, 'yearly'],
    ['Test smoke & CO alarms', 'Whole house', 1, 'monthly'],
    ['Bleed radiators', 'Whole house', 1, 'yearly'],
    ['Clear gutters', 'Exterior', 1, 'yearly'],
    ['Clean extractor fan filter', 'Kitchen', 3, 'monthly'],
  ],
  cleaning: [
    ['Hoover', 'Whole house', 1, 'weekly'],
    ['Clean bathroom', 'Bathroom', 1, 'weekly'],
    ['Change bedding', 'Bedroom', 1, 'weekly'],
    ['Clean oven', 'Kitchen', 3, 'monthly'],
    ['Defrost freezer', 'Kitchen', 6, 'monthly'],
  ],
};

export default function House() {
  const rows = useRows<HouseJob>('house');
  const [kind, setKind] = useState<HouseJob['kind']>('cleaning');
  const t = today();
  const list = rows.filter((r) => r.kind === kind);
  const add = async (title: string, room: string, interval: number, freq: 'weekly' | 'monthly' | 'yearly') => {
    await save<HouseJob>('house', { kind, title, room, schedule: { freq, interval, start: t } });
  };
  const missing = SUGGEST[kind].filter(([title]) => !list.some((r) => r.title.toLowerCase() === title.toLowerCase()));
  return (
    <div className="page">
      <h1>House</h1>
      <div className="tabs">
        <button className={kind === 'cleaning' ? 'on' : ''} onClick={() => setKind('cleaning')}>
          Cleaning rota
        </button>
        <button className={kind === 'maintenance' ? 'on' : ''} onClick={() => setKind('maintenance')}>
          Maintenance
        </button>
      </div>
      <CrudList<HouseJob>
        table="house"
        rows={list}
        noun={kind === 'cleaning' ? 'cleaning job' : 'maintenance job'}
        fields={fields}
        defaults={() => ({ kind, schedule: { freq: kind === 'cleaning' ? 'weekly' : 'yearly', interval: 1, start: t } })}
        sort={(a, b) => (nextOccurrence(a.schedule, t) ?? '~').localeCompare(nextOccurrence(b.schedule, t) ?? '~')}
        renderRow={(r) => {
          const next = nextOccurrence(r.schedule, t);
          return (
            <div className="row">
              <div className="grow">
                <b>{r.title}</b>
                <div className="meta">{[r.room, describeSchedule(r.schedule), r.assignee].filter(Boolean).join(' · ')}</div>
                {next && <div className="meta">Next: {relativeLabel(next, t)}</div>}
              </div>
              {r.estCost ? <div className="amount">{money(r.estCost)}</div> : null}
            </div>
          );
        }}
      />
      {missing.length > 0 && (
        <>
          <h2>Suggestions</h2>
          <div className="chips">
            {missing.map(([title, room, n, f]) => (
              <button key={title} className="chip" onClick={() => add(title, room, n, f)}>
                + {title} <span className="muted">({describeSchedule({ freq: f, interval: n, start: t }).toLowerCase()})</span>
              </button>
            ))}
          </div>
        </>
      )}
      <p className="muted">Inventory (items, warranties, receipts) is coming in the next phase.</p>
    </div>
  );
}

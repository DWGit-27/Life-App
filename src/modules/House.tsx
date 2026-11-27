import { CrudList, useRows } from '../components/Crud';
import { save, type HouseJob, type InventoryItem } from '../db';
import { describeSchedule, nextOccurrence } from '../lib/schedule';
import { diffDays, formatDate, relativeLabel, today } from '../lib/dates';
import { money } from '../lib/format';

const SUGGEST: Record<HouseJob['kind'], [string, string, number, 'weekly' | 'monthly' | 'yearly'][]> = {
  maintenance: [
    ['Boiler service', 'Whole house', 1, 'yearly'],
    ['Test smoke & CO alarms', 'Whole house', 1, 'monthly'],
    ['Bleed radiators', 'Whole house', 1, 'yearly'],
    ['Clear gutters', 'Exterior', 1, 'yearly'],
    ['Clean extractor fan filter', 'Kitchen', 3, 'monthly'],
    ['Descale kettle & shower heads', 'Kitchen', 2, 'monthly'],
  ],
  cleaning: [
    ['Hoover', 'Whole house', 1, 'weekly'],
    ['Clean bathroom', 'Bathroom', 1, 'weekly'],
    ['Change bedding', 'Bedroom', 1, 'weekly'],
    ['Mop floors', 'Whole house', 2, 'weekly'],
    ['Clean oven', 'Kitchen', 3, 'monthly'],
    ['Defrost freezer', 'Kitchen', 6, 'monthly'],
  ],
};

type Tab = 'cleaning' | 'maintenance' | 'inventory';

export default function House({ sub, setSub }: { sub?: string; setSub: (s: string) => void }) {
  const tab: Tab = sub === 'maintenance' || sub === 'inventory' ? sub : 'cleaning';
  return (
    <div className="page">
      <h1>House</h1>
      <div className="tabs">
        <button className={tab === 'cleaning' ? 'on' : ''} onClick={() => setSub('cleaning')}>
          Cleaning rota
        </button>
        <button className={tab === 'maintenance' ? 'on' : ''} onClick={() => setSub('maintenance')}>
          Maintenance
        </button>
        <button className={tab === 'inventory' ? 'on' : ''} onClick={() => setSub('inventory')}>
          Inventory
        </button>
      </div>
      {tab === 'inventory' ? <Inventory /> : <Jobs kind={tab} />}
    </div>
  );
}

function Jobs({ kind }: { kind: HouseJob['kind'] }) {
  const rows = useRows<HouseJob>('house');
  const t = today();
  const list = rows.filter((r) => r.kind === kind);
  const missing = SUGGEST[kind].filter(([title]) => !list.some((r) => r.title.toLowerCase() === title.toLowerCase()));
  return (
    <>
      <CrudList<HouseJob>
        table="house"
        rows={list}
        noun={kind === 'cleaning' ? 'cleaning job' : 'maintenance job'}
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
              <button key={title} className="chip" onClick={() => save<HouseJob>('house', { kind, title, room, schedule: { freq: f, interval: n, start: t } })}>
                + {title} <span className="muted">({describeSchedule({ freq: f, interval: n, start: t }).toLowerCase()})</span>
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}

function Inventory() {
  const rows = useRows<InventoryItem>('inventory');
  const t = today();
  const total = rows.reduce((a, i) => a + (i.price || 0), 0);
  const underWarranty = rows.filter((i) => i.warrantyUntil && i.warrantyUntil >= t).length;
  const rooms = [...new Set(rows.map((r) => r.room || 'Unassigned'))].sort();
  return (
    <>
      <div className="stats">
        <div className="stat">
          <span>Items</span>
          <b>{rows.length}</b>
        </div>
        <div className="stat">
          <span>Total value</span>
          <b>{money(total, { decimals: false })}</b>
        </div>
        <div className="stat">
          <span>Under warranty</span>
          <b>{underWarranty}</b>
        </div>
      </div>
      <p className="muted">Handy for insurance claims and warranty repairs. Compare the total value with your contents insurance cover.</p>
      <CrudList<InventoryItem>
        table="inventory"
        rows={rows}
        sort={(a, b) => (a.room ?? '~').localeCompare(b.room ?? '~') || a.name.localeCompare(b.name)}
        empty="Add appliances, electronics and valuables, with serial numbers and warranty dates."
        header={rooms.length > 1 ? <span className="muted">{rooms.join(' · ')}</span> : undefined}
        renderRow={(i) => {
          const left = i.warrantyUntil ? diffDays(i.warrantyUntil, t) : undefined;
          return (
            <div className="row">
              <div className="grow">
                <b>{i.name}</b>
                <div className="meta">{[i.room, i.brand, i.model, i.serial && `S/N ${i.serial}`].filter(Boolean).join(' · ')}</div>
                {i.warrantyUntil && (
                  <div className={`meta ${left !== undefined && left >= 0 && left <= 30 ? 'warn' : ''}`}>
                    {left !== undefined && left < 0 ? `Warranty ended ${formatDate(i.warrantyUntil)}` : `Warranty until ${formatDate(i.warrantyUntil)}`}
                  </div>
                )}
              </div>
              {i.price ? <div className="amount">{money(i.price, { decimals: false })}</div> : null}
            </div>
          );
        }}
      />
    </>
  );
}

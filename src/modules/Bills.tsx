import { CrudList, useRows } from '../components/Crud';
import type { Bill } from '../db';
import { describeSchedule, nextOccurrence, perYear } from '../lib/schedule';
import { formatDate, relativeLabel, today } from '../lib/dates';
import { money } from '../lib/format';



export default function Bills() {
  const bills = useRows<Bill>('bills');
  const t = today();
  const yearly = bills.reduce((a, b) => a + (b.amount || 0) * perYear(b.schedule), 0);
  return (
    <>
      <div className="stats">
        <div className="stat">
          <span>Per month</span>
          <b>{money(yearly / 12)}</b>
        </div>
        <div className="stat">
          <span>Per year</span>
          <b>{money(yearly, { decimals: false })}</b>
        </div>
        <div className="stat">
          <span>Bills</span>
          <b>{bills.length}</b>
        </div>
      </div>
      <CrudList<Bill>
        table="bills"
        rows={bills}
        noun="bill"
        defaults={() => ({ autopay: true, schedule: { freq: 'monthly', interval: 1, start: t } })}
        sort={(a, b) => (nextOccurrence(a.schedule, t) ?? '').localeCompare(nextOccurrence(b.schedule, t) ?? '')}
        empty="No bills yet. Add rent or mortgage, council tax, energy, water, phone and so on."
        renderRow={(b) => {
          const next = nextOccurrence(b.schedule, t);
          const prev = b.history?.[b.history.length - 1];
          return (
            <div className="row">
              <div className="grow">
                <b>{b.name}</b>
                {b.autopay && <span className="pill">DD</span>}
                <div className="meta">
                  {[b.provider, describeSchedule(b.schedule), next && `next ${relativeLabel(next, t).toLowerCase()}`].filter(Boolean).join(' · ')}
                </div>
                {b.contractEnd && b.contractEnd >= t && <div className="meta">Deal ends {relativeLabel(b.contractEnd, t).toLowerCase()}</div>}
                {prev && (
                  <div className={`meta ${b.amount > prev.amount ? 'warn' : 'good'}`}>
                    {b.amount > prev.amount ? '▲' : '▼'} was {money(prev.amount)} until {formatDate(prev.date)}
                  </div>
                )}
              </div>
              <div className="amount-stack">
                <div className="amount">{money(b.amount)}</div>
                {b.schedule.freq !== 'yearly' && <div className="meta">{money(b.amount * perYear(b.schedule), { decimals: false })}/yr</div>}
              </div>
            </div>
          );
        }}
      />
    </>
  );
}

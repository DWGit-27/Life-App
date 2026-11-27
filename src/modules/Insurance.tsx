import { CrudList, useRows } from '../components/Crud';
import { save, type Policy } from '../db';
import { showToast } from '../toast';
import { addMonths, diffDays, formatDate, today } from '../lib/dates';
import { money } from '../lib/format';
import { perYear } from '../lib/schedule';



export default function Insurance() {
  const rows = useRows<Policy>('policies');
  const t = today();
  const yearly = rows.reduce((a, p) => a + (p.premium || 0) * (p.premiumSchedule ? perYear(p.premiumSchedule) : 1), 0);
  return (
    <>
      <div className="stats">
        <div className="stat">
          <span>Policies</span>
          <b>{rows.length}</b>
        </div>
        <div className="stat">
          <span>Premiums per year</span>
          <b>{money(yearly, { decimals: false })}</b>
        </div>
      </div>
      <CrudList<Policy>
        table="policies"
        rows={rows}
        noun="policy"
        defaults={() => ({ remindDaysBefore: 30 })}
        sort={(a, b) => (a.renewalDate ?? '~').localeCompare(b.renewalDate ?? '~')}
        empty="No policies yet."
        renderRow={(p) => {
          const days = p.renewalDate ? diffDays(p.renewalDate, t) : undefined;
          return (
            <div className="row">
              <div className="grow">
                <b>{p.name}</b>
                <div className="meta">{[p.kind, p.insurer, p.policyNumber && `No. ${p.policyNumber}`].filter(Boolean).join(' · ')}</div>
                {p.renewalDate && (
                  <div className={`meta ${days !== undefined && days <= (p.remindDaysBefore ?? 30) ? 'warn' : ''}`}>
                    Renews {formatDate(p.renewalDate)}
                    {days !== undefined && days >= 0 && ` (${days} days)`}
                    {days !== undefined && days < 0 && ' (passed, update the date)'}
                  </div>
                )}
              </div>
              <div className="amount-stack">
                {p.premium ? <div className="amount">{money(p.premium)}</div> : null}
                {days !== undefined && days <= (p.remindDaysBefore ?? 30) && (
                  <button
                    className="small"
                    title="Bump the renewal date on by a year"
                    onClick={async (e) => {
                      e.stopPropagation();
                      const old = p.renewalDate!;
                      await save<Policy>('policies', { ...p, renewalDate: addMonths(old, 12) });
                      showToast(`${p.name} renewed to ${formatDate(addMonths(old, 12))}`, () => save<Policy>('policies', { ...p, renewalDate: old }));
                    }}
                  >
                    ✓ Renewed
                  </button>
                )}
              </div>
            </div>
          );
        }}
      />
    </>
  );
}

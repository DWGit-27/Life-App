import { CrudList, useRows } from '../components/Crud';
import type { FieldSpec } from '../components/Form';
import type { Policy } from '../db';
import { diffDays, formatDate, today } from '../lib/dates';
import { money } from '../lib/format';
import { perYear } from '../lib/schedule';

const KINDS = ['Home (buildings)', 'Home (contents)', 'Car', 'Life', 'Health', 'Travel', 'Pet', 'Income protection', 'Gadget', 'Other'];

const fields: FieldSpec[] = [
  { key: 'name', label: 'Policy name', type: 'text', required: true, placeholder: 'e.g. Home insurance' },
  { key: 'kind', label: 'Type', type: 'select', options: KINDS },
  { key: 'insurer', label: 'Insurer', type: 'text' },
  { key: 'policyNumber', label: 'Policy number', type: 'text' },
  { key: 'cover', label: 'What it covers', type: 'textarea' },
  { key: 'excess', label: 'Excess (£)', type: 'money' },
  { key: 'premium', label: 'Premium per payment (£)', type: 'money' },
  { key: 'premiumSchedule', label: 'Premium paid', type: 'schedule', optional: true, hint: 'Add the premium as a bill too if you want it in your budget' },
  { key: 'renewalDate', label: 'Renewal date', type: 'date', required: true },
  { key: 'remindDaysBefore', label: 'Remind me this many days before', type: 'number', placeholder: '30' },
  { key: 'phone', label: 'Claims phone', type: 'text' },
  { key: 'website', label: 'Website', type: 'text' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
];

export default function Insurance() {
  const rows = useRows<Policy>('policies');
  const t = today();
  const yearly = rows.reduce((a, p) => a + (p.premium || 0) * (p.premiumSchedule ? perYear(p.premiumSchedule) : 1), 0);
  return (
    <div className="page">
      <h1>Insurance</h1>
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
        fields={fields}
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
              {p.premium ? <div className="amount">{money(p.premium)}</div> : null}
            </div>
          );
        }}
      />
    </div>
  );
}

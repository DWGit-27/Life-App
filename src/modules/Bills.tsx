import { CrudList, useRows } from '../components/Crud';
import type { FieldSpec } from '../components/Form';
import type { Bill } from '../db';
import { describeSchedule, nextOccurrence, perYear } from '../lib/schedule';
import { relativeLabel, today } from '../lib/dates';
import { money } from '../lib/format';

export const BILL_CATEGORIES = ['Housing', 'Council tax', 'Energy', 'Water', 'Phone & internet', 'TV & streaming', 'Insurance', 'Transport', 'Subscriptions', 'Childcare', 'Other'];

const fields: FieldSpec[] = [
  { key: 'name', label: 'Bill', type: 'text', required: true, placeholder: 'e.g. Electricity' },
  { key: 'provider', label: 'Provider', type: 'text' },
  { key: 'category', label: 'Category', type: 'select', options: BILL_CATEGORIES },
  { key: 'amount', label: 'Amount (£)', type: 'money', required: true },
  { key: 'schedule', label: 'Due', type: 'schedule', recurringOnly: true, required: true },
  { key: 'autopay', label: 'Paid automatically (direct debit / standing order)', type: 'checkbox' },
  { key: 'paymentMethod', label: 'Payment method', type: 'text', placeholder: 'e.g. Card, bank transfer', when: (v) => !v.autopay },
  { key: 'account', label: 'Paid from account', type: 'text' },
  { key: 'reference', label: 'Account / customer number', type: 'text' },
  { key: 'contact', label: 'Contact (phone, website, login)', type: 'text', hint: "Don't store passwords here" },
  { key: 'contractEnd', label: 'Contract / fixed deal ends', type: 'date' },
  { key: 'notes', label: 'Notes', type: 'textarea' },
];

export default function Bills() {
  const bills = useRows<Bill>('bills');
  const t = today();
  const yearly = bills.reduce((a, b) => a + (b.amount || 0) * perYear(b.schedule), 0);
  return (
    <div className="page">
      <h1>Bills</h1>
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
        fields={fields}
        defaults={() => ({ autopay: true, schedule: { freq: 'monthly', interval: 1, start: t } })}
        sort={(a, b) => (nextOccurrence(a.schedule, t) ?? '').localeCompare(nextOccurrence(b.schedule, t) ?? '')}
        empty="No bills yet. Add rent or mortgage, council tax, energy, water, phone and so on."
        renderRow={(b) => {
          const next = nextOccurrence(b.schedule, t);
          return (
            <div className="row">
              <div className="grow">
                <b>{b.name}</b>
                {b.autopay && <span className="pill">DD</span>}
                <div className="meta">
                  {[b.provider, describeSchedule(b.schedule), next && `next ${relativeLabel(next, t).toLowerCase()}`].filter(Boolean).join(' · ')}
                </div>
                {b.contractEnd && b.contractEnd >= t && <div className="meta">Deal ends {relativeLabel(b.contractEnd, t).toLowerCase()}</div>}
              </div>
              <div className="amount">{money(b.amount)}</div>
            </div>
          );
        }}
      />
    </div>
  );
}

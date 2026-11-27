import { useState } from 'react';
import { CrudList, useRows } from '../components/Crud';
import type { FieldSpec } from '../components/Form';
import type { Bill, BudgetLine, Loan, Txn } from '../db';
import { perYear, describeSchedule } from '../lib/schedule';
import { formatDate, monthKey, today } from '../lib/dates';
import { money } from '../lib/format';
import { amortise } from '../lib/mortgage';
import { BILL_CATEGORIES } from './Bills';

const CATEGORIES = ['Salary', 'Other income', 'Groceries', 'Eating out', 'Transport', 'Fuel', 'Shopping', 'Health', 'Fitness', 'Gifts', 'Holidays', 'Savings', 'Kids', 'Pets', 'Home', ...BILL_CATEGORIES];

const lineFields: FieldSpec[] = [
  { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g. Salary, Groceries' },
  { key: 'kind', label: 'Type', type: 'select', options: [{ value: 'income', label: 'Income' }, { value: 'expense', label: 'Planned spending' }], required: true },
  { key: 'category', label: 'Category', type: 'select', options: CATEGORIES },
  { key: 'amount', label: 'Amount (£)', type: 'money', required: true },
  { key: 'schedule', label: 'How often', type: 'schedule', recurringOnly: true, required: true },
  { key: 'notes', label: 'Notes', type: 'textarea' },
];

const txnFields: FieldSpec[] = [
  { key: 'date', label: 'Date', type: 'date', required: true },
  { key: 'kind', label: 'Type', type: 'select', options: [{ value: 'expense', label: 'Spent' }, { value: 'income', label: 'Received' }], required: true },
  { key: 'amount', label: 'Amount (£)', type: 'money', required: true },
  { key: 'category', label: 'Category', type: 'select', options: CATEGORIES },
  { key: 'note', label: 'Note', type: 'text' },
];

/** Monthly view of the plan: income vs planned spending + bills + loan repayments. */
export function monthlyTotals(budget: BudgetLine[], bills: Bill[], loans: Loan[]) {
  const pm = (amt: number, s: Parameters<typeof perYear>[0]) => ((amt || 0) * perYear(s)) / 12;
  const income = budget.filter((b) => b.kind === 'income').reduce((a, b) => a + pm(b.amount, b.schedule), 0);
  const planned = budget.filter((b) => b.kind === 'expense').reduce((a, b) => a + pm(b.amount, b.schedule), 0);
  const billTotal = bills.reduce((a, b) => a + pm(b.amount, b.schedule), 0);
  const t = today();
  const loanTotal = loans.reduce((a, l) => {
    const rows = amortise(l);
    const last = rows[rows.length - 1];
    return a + (last && last.date >= t ? rows[0].payment : 0);
  }, 0);
  return { income, planned, bills: billTotal, loans: loanTotal, left: income - planned - billTotal - loanTotal };
}

export default function Money() {
  const budget = useRows<BudgetLine>('budget');
  const bills = useRows<Bill>('bills');
  const loans = useRows<Loan>('loans');
  const txns = useRows<Txn>('txns');
  const [tab, setTab] = useState<'plan' | 'spending'>('plan');
  const t = today();
  const [month, setMonth] = useState(monthKey(t));
  const m = monthlyTotals(budget, bills, loans);
  const monthTx = txns.filter((x) => monthKey(x.date) === month);
  const spent = monthTx.filter((x) => x.kind === 'expense').reduce((a, x) => a + x.amount, 0);
  const received = monthTx.filter((x) => x.kind === 'income').reduce((a, x) => a + x.amount, 0);
  const byCat = new Map<string, { spent: number; planned: number }>();
  for (const x of monthTx.filter((x) => x.kind === 'expense')) {
    const c = byCat.get(x.category || 'Other') ?? { spent: 0, planned: 0 };
    c.spent += x.amount;
    byCat.set(x.category || 'Other', c);
  }
  for (const b of budget.filter((b) => b.kind === 'expense')) {
    const c = byCat.get(b.category || 'Other') ?? { spent: 0, planned: 0 };
    c.planned += ((b.amount || 0) * perYear(b.schedule)) / 12;
    byCat.set(b.category || 'Other', c);
  }
  const months = [...new Set([monthKey(t), ...txns.map((x) => monthKey(x.date))])].sort().reverse();

  return (
    <div className="page">
      <h1>Money</h1>
      <div className="stats">
        <div className="stat">
          <span>Income / month</span>
          <b>{money(m.income, { decimals: false })}</b>
        </div>
        <div className="stat">
          <span>Bills / month</span>
          <b>{money(m.bills, { decimals: false })}</b>
        </div>
        <div className="stat">
          <span>Loans / month</span>
          <b>{money(m.loans, { decimals: false })}</b>
        </div>
        <div className="stat">
          <span>Planned spending</span>
          <b>{money(m.planned, { decimals: false })}</b>
        </div>
        <div className="stat">
          <span>Left over</span>
          <b className={m.left < 0 ? 'warn' : 'good'}>{money(m.left, { decimals: false })}</b>
        </div>
      </div>
      <div className="tabs">
        <button className={tab === 'plan' ? 'on' : ''} onClick={() => setTab('plan')}>
          Monthly plan
        </button>
        <button className={tab === 'spending' ? 'on' : ''} onClick={() => setTab('spending')}>
          Spending log
        </button>
      </div>
      {tab === 'plan' ? (
        <>
          <p className="muted">Bills and loan repayments are included automatically from their own pages. Add income and everyday spending you plan for here.</p>
          <CrudList<BudgetLine>
            table="budget"
            rows={budget}
            noun="budget line"
            fields={lineFields}
            defaults={() => ({ kind: 'expense', schedule: { freq: 'monthly', interval: 1, start: t } })}
            sort={(a, b) => a.kind.localeCompare(b.kind) || b.amount - a.amount}
            empty="Add your salary and planned spending (groceries, fuel, eating out…)."
            renderRow={(b) => (
              <div className="row">
                <div className="grow">
                  <b>{b.name}</b>
                  <div className="meta">{[b.kind === 'income' ? 'Income' : 'Spending', b.category, describeSchedule(b.schedule)].filter(Boolean).join(' · ')}</div>
                </div>
                <div className={`amount ${b.kind === 'income' ? 'good' : ''}`}>{money(b.amount)}</div>
              </div>
            )}
          />
        </>
      ) : (
        <>
          <div className="toolbar">
            <select value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Month">
              {months.map((mo) => (
                <option key={mo} value={mo}>
                  {new Date(mo + '-01T00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
                </option>
              ))}
            </select>
            <span className="muted">
              Spent {money(spent)} · received {money(received)}
            </span>
          </div>
          {byCat.size > 0 && (
            <ul className="bars">
              {[...byCat.entries()]
                .sort((a, b) => b[1].spent - a[1].spent)
                .map(([cat, v]) => {
                  const pct = v.planned ? Math.min(100, (v.spent / v.planned) * 100) : v.spent ? 100 : 0;
                  return (
                    <li key={cat}>
                      <div className="row">
                        <span className="grow">{cat}</span>
                        <span className={v.planned && v.spent > v.planned ? 'warn' : ''}>
                          {money(v.spent, { decimals: false })}
                          {v.planned ? ` of ${money(v.planned, { decimals: false })}` : ''}
                        </span>
                      </div>
                      <div className="bar">
                        <i style={{ width: `${pct}%` }} className={v.planned && v.spent > v.planned ? 'over' : ''} />
                      </div>
                    </li>
                  );
                })}
            </ul>
          )}
          <CrudList<Txn>
            table="txns"
            rows={monthTx}
            noun="entry"
            fields={txnFields}
            defaults={() => ({ date: t, kind: 'expense' })}
            sort={(a, b) => b.date.localeCompare(a.date)}
            empty="Nothing logged this month."
            renderRow={(x) => (
              <div className="row">
                <div className="grow">
                  <b>{x.category || 'Uncategorised'}</b>
                  <div className="meta">{[formatDate(x.date), x.note].filter(Boolean).join(' · ')}</div>
                </div>
                <div className={`amount ${x.kind === 'income' ? 'good' : ''}`}>
                  {x.kind === 'income' ? '+' : '−'}
                  {money(x.amount)}
                </div>
              </div>
            )}
          />
        </>
      )}
    </div>
  );
}

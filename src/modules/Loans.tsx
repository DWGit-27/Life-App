import { useState } from 'react';
import { CrudList, useRows } from '../components/Crud';
import type { FieldSpec } from '../components/Form';
import type { Loan } from '../db';
import { summarise } from '../lib/mortgage';
import { formatDate, today } from '../lib/dates';
import { money } from '../lib/format';

const fields: FieldSpec[] = [
  { key: 'name', label: 'Name', type: 'text', required: true, placeholder: 'e.g. Mortgage' },
  { key: 'kind', label: 'Type', type: 'select', options: [{ value: 'mortgage', label: 'Mortgage' }, { value: 'loan', label: 'Loan' }, { value: 'credit', label: 'Car finance / credit' }], required: true },
  { key: 'lender', label: 'Lender', type: 'text' },
  { key: 'principal', label: 'Amount borrowed (£)', type: 'money', required: true, hint: 'Or the balance when the current deal started' },
  { key: 'annualRate', label: 'Interest rate (% per year)', type: 'number', required: true },
  { key: 'termMonths', label: 'Term (months)', type: 'number', required: true, hint: '25 years = 300 months' },
  { key: 'firstPayment', label: 'First payment date', type: 'date', required: true },
  { key: 'extraMonthly', label: 'Overpayment each month (£)', type: 'money' },
  { key: 'fixedUntil', label: 'Fixed rate ends', type: 'date', hint: "You'll get a remortgage reminder 4 months before" },
  { key: 'notes', label: 'Notes', type: 'textarea' },
];

function LoanDetail({ loan }: { loan: Loan }) {
  const [extra, setExtra] = useState(loan.extraMonthly ?? 0);
  const t = today();
  const s = summarise(loan, t);
  const what = summarise({ ...loan, extraMonthly: extra }, t);
  const years = new Map<string, { interest: number; principal: number; balance: number }>();
  for (const r of s.rows) {
    const y = r.date.slice(0, 4);
    const v = years.get(y) ?? { interest: 0, principal: 0, balance: 0 };
    v.interest += r.interest;
    v.principal += r.principal;
    v.balance = r.balance;
    years.set(y, v);
  }
  const repaidPct = loan.principal ? ((loan.principal - s.balanceNow) / loan.principal) * 100 : 0;
  return (
    <div className="card detail">
      <h2>{loan.name}</h2>
      <div className="stats">
        <div className="stat">
          <span>Balance now</span>
          <b>{money(s.balanceNow, { decimals: false })}</b>
        </div>
        <div className="stat">
          <span>Monthly payment</span>
          <b>{money(s.monthly)}</b>
        </div>
        <div className="stat">
          <span>Paid off</span>
          <b>{formatDate(s.payoffDate)}</b>
        </div>
        <div className="stat">
          <span>Total interest</span>
          <b>{money(s.totalInterest, { decimals: false })}</b>
        </div>
      </div>
      <div className="bar big">
        <i style={{ width: `${repaidPct}%` }} />
      </div>
      <p className="muted">
        {repaidPct.toFixed(1)}% repaid · {s.paymentsLeft} payments left · interest paid so far {money(s.interestSoFar, { decimals: false })}
        {loan.fixedUntil && ` · fixed rate ends ${formatDate(loan.fixedUntil)}`}
      </p>
      <h3>What if I overpay?</h3>
      <label className="row">
        <span>Extra each month £</span>
        <input type="number" className="narrow" min={0} step={50} value={extra} onChange={(e) => setExtra(Math.max(0, Number(e.target.value) || 0))} />
      </label>
      {extra !== (loan.extraMonthly ?? 0) && (
        <p>
          Paid off <b>{formatDate(what.payoffDate)}</b>, saving <b className="good">{money(s.totalInterest - what.totalInterest, { decimals: false })}</b> in interest.
        </p>
      )}
      <p className="muted">Check overpayment limits with your lender (often 10% a year on a fixed deal).</p>
      <details>
        <summary>Year by year</summary>
        <table>
          <thead>
            <tr>
              <th>Year</th>
              <th>Interest</th>
              <th>Capital</th>
              <th>Balance</th>
            </tr>
          </thead>
          <tbody>
            {[...years.entries()].map(([y, v]) => (
              <tr key={y} className={y === t.slice(0, 4) ? 'hl' : ''}>
                <td>{y}</td>
                <td>{money(v.interest, { decimals: false })}</td>
                <td>{money(v.principal, { decimals: false })}</td>
                <td>{money(v.balance, { decimals: false })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

export default function Loans() {
  const loans = useRows<Loan>('loans');
  const t = today();
  const [sel, setSel] = useState<string | null>(null);
  const current = loans.find((l) => l.id === sel) ?? loans[0];
  const total = loans.reduce((a, l) => a + summarise(l, t).balanceNow, 0);
  return (
    <div className="page">
      <h1>Loans & mortgage</h1>
      {loans.length > 0 && (
        <div className="stats">
          <div className="stat">
            <span>Total owed</span>
            <b>{money(total, { decimals: false })}</b>
          </div>
        </div>
      )}
      <CrudList<Loan>
        table="loans"
        rows={loans}
        noun="loan"
        fields={fields}
        defaults={() => ({ kind: 'mortgage', termMonths: 300 })}
        empty="Add your mortgage to see the balance, payoff date and how overpaying helps."
        renderRow={(l) => {
          const s = summarise(l, t);
          return (
            <div className="row">
              <div className="grow">
                <b>{l.name}</b>
                <div className="meta">
                  {[l.lender, `${l.annualRate}%`, `${money(s.monthly)}/month`].filter(Boolean).join(' · ')}
                </div>
              </div>
              <div className="amount">{money(s.balanceNow, { decimals: false })}</div>
            </div>
          );
        }}
      />
      {loans.length > 1 && (
        <div className="tabs">
          {loans.map((l) => (
            <button key={l.id} className={current?.id === l.id ? 'on' : ''} onClick={() => setSel(l.id)}>
              {l.name}
            </button>
          ))}
        </div>
      )}
      {current && <LoanDetail key={current.id + current.updatedAt} loan={current} />}
      <p className="muted">Investments tracking is coming in the next phase.</p>
    </div>
  );
}

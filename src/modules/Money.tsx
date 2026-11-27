import { useState } from 'react';
import { CrudList, useRows } from '../components/Crud';
import type { Bill, BudgetLine, Investment, Loan, Policy, Txn } from '../db';
import { describeSchedule, occurrences, perYear } from '../lib/schedule';
import { addDays, diffDays, formatDate, monthKey, parseISO, relativeLabel, today } from '../lib/dates';
import { money } from '../lib/format';
import { amortise, summarise } from '../lib/mortgage';
import { openEdit } from '../registry';
import Bills from './Bills';
import Insurance from './Insurance';
import Loans from './Loans';

/** Monthly view of the plan: income vs planned spending + bills + loan repayments. */
export function monthlyTotals(budget: BudgetLine[], bills: Bill[], loans: Loan[], investments: Investment[] = []) {
  const pm = (amt: number | undefined, s: Parameters<typeof perYear>[0]) => ((amt || 0) * perYear(s)) / 12;
  const income = budget.filter((b) => b.kind === 'income').reduce((a, b) => a + pm(b.amount, b.schedule), 0);
  const planned = budget.filter((b) => b.kind === 'expense').reduce((a, b) => a + pm(b.amount, b.schedule), 0);
  const billTotal = bills.reduce((a, b) => a + pm(b.amount, b.schedule), 0);
  const saving = investments.reduce((a, i) => a + pm(i.contribution, i.contributionSchedule), 0);
  const t = today();
  const loanTotal = loans.reduce((a, l) => {
    const rows = amortise(l);
    const last = rows[rows.length - 1];
    return a + (last && last.date >= t ? rows[0].payment : 0);
  }, 0);
  return { income, planned, bills: billTotal, loans: loanTotal, saving, left: income - planned - billTotal - loanTotal - saving };
}

type Tab = 'overview' | 'bills' | 'insurance' | 'loans' | 'investments' | 'budget' | 'spending';
const TABS: [Tab, string][] = [
  ['overview', 'Overview'],
  ['bills', 'Bills'],
  ['insurance', 'Insurance'],
  ['loans', 'Loans'],
  ['investments', 'Investments'],
  ['budget', 'Budget'],
  ['spending', 'Spending'],
];

export default function Money({ sub, setSub }: { sub?: string; setSub: (s: string) => void }) {
  const tab = (TABS.some(([k]) => k === sub) ? sub : 'overview') as Tab;
  return (
    <div className="page">
      <h1>Money</h1>
      <div className="tabs scroll">
        {TABS.map(([k, label]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setSub(k)}>
            {label}
          </button>
        ))}
      </div>
      {tab === 'overview' && <Overview go={setSub} />}
      {tab === 'bills' && <Bills />}
      {tab === 'insurance' && <Insurance />}
      {tab === 'loans' && <Loans />}
      {tab === 'investments' && <Investments />}
      {tab === 'budget' && <Budget />}
      {tab === 'spending' && <Spending />}
    </div>
  );
}

function Overview({ go }: { go: (s: string) => void }) {
  const budget = useRows<BudgetLine>('budget');
  const bills = useRows<Bill>('bills');
  const loans = useRows<Loan>('loans');
  const policies = useRows<Policy>('policies');
  const investments = useRows<Investment>('investments');
  const t = today();
  const m = monthlyTotals(budget, bills, loans, investments);
  const assets = investments.reduce((a, i) => a + (i.value || 0), 0);
  const debts = loans.reduce((a, l) => a + summarise(l, t).balanceNow, 0);

  // Next 30 days of money going out
  const end = addDays(t, 30);
  const out: { date: string; name: string; amount: number; kind: string; go: string }[] = [];
  for (const b of bills) for (const d of occurrences(b.schedule, t, end)) out.push({ date: d, name: b.name, amount: b.amount, kind: b.autopay ? 'Direct debit' : 'Bill', go: 'bills' });
  for (const l of loans) for (const r of amortise(l).filter((r) => r.date >= t && r.date <= end)) out.push({ date: r.date, name: l.name, amount: r.payment, kind: 'Loan', go: 'loans' });
  for (const p of policies) {
    if (p.premiumSchedule) for (const d of occurrences(p.premiumSchedule, t, end)) out.push({ date: d, name: p.name, amount: p.premium ?? 0, kind: 'Premium', go: 'insurance' });
    else if (p.renewalDate && p.renewalDate >= t && p.renewalDate <= end && p.premium) out.push({ date: p.renewalDate, name: p.name, amount: p.premium, kind: 'Renewal', go: 'insurance' });
  }
  for (const i of investments)
    if (i.contributionSchedule) for (const d of occurrences(i.contributionSchedule, t, end)) out.push({ date: d, name: i.name, amount: i.contribution ?? 0, kind: 'Saving', go: 'investments' });
  out.sort((a, b) => a.date.localeCompare(b.date));
  const outTotal = out.reduce((a, x) => a + x.amount, 0);

  const rows: [string, number, string][] = [
    ['Income', m.income, 'budget'],
    ['Bills', -m.bills, 'bills'],
    ['Loan repayments', -m.loans, 'loans'],
    ['Saving & investing', -m.saving, 'investments'],
    ['Planned spending', -m.planned, 'budget'],
  ];
  return (
    <>
      <div className="stats">
        <button className="stat" onClick={() => go('investments')}>
          <span>Assets</span>
          <b className="good">{money(assets, { decimals: false })}</b>
        </button>
        <button className="stat" onClick={() => go('loans')}>
          <span>Owed</span>
          <b>{money(debts, { decimals: false })}</b>
        </button>
        <div className="stat">
          <span>Net worth</span>
          <b className={assets - debts < 0 ? 'warn' : 'good'}>{money(assets - debts, { decimals: false })}</b>
        </div>
      </div>
      {loans.some((l) => l.kind === 'mortgage') && !investments.some((i) => i.kind === 'Property') && (
        <p className="muted">
          Your mortgage counts as a debt here, but your home isn't counted yet.{' '}
          <button className="link" onClick={() => openEdit({ table: 'investments', initial: { kind: 'Property', name: 'Home', valueDate: t } })}>
            Add your home's value
          </button>
        </p>
      )}
      <div className="grid2">
        <section className="card">
          <h2>Each month</h2>
          <table className="plain">
            <tbody>
              {rows.map(([label, v, g]) => (
                <tr key={label} className="clickable" onClick={() => go(g)}>
                  <td>{label}</td>
                  <td className={v > 0 ? 'good' : ''}>{v ? money(v, { decimals: false }) : '—'}</td>
                </tr>
              ))}
              <tr className="total">
                <td>Left over</td>
                <td className={m.left < 0 ? 'warn' : 'good'}>{money(m.left, { decimals: false })}</td>
              </tr>
            </tbody>
          </table>
          {m.income === 0 && <p className="muted">Add your income in Budget to see what's left over.</p>}
        </section>
        <section className="card">
          <h2>Going out in the next 30 days</h2>
          {out.length === 0 ? (
            <p className="muted">Nothing scheduled.</p>
          ) : (
            <>
              <ul className="mini">
                {out.slice(0, 12).map((x, i) => (
                  <li key={i} className="clickable" onClick={() => go(x.go)}>
                    <span className="date">{diffDays(x.date, t) < 7 ? relativeLabel(x.date, t) : parseISO(x.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</span>
                    <span className="grow">
                      {x.name} <span className="muted">· {x.kind}</span>
                    </span>
                    <span className="amount">{money(x.amount)}</span>
                  </li>
                ))}
              </ul>
              {out.length > 12 && <p className="muted">and {out.length - 12} more</p>}
              <div className="row total">
                <span className="grow">Total</span>
                <b>{money(outTotal)}</b>
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}

function Investments() {
  const rows = useRows<Investment>('investments');
  const total = rows.reduce((a, i) => a + (i.value || 0), 0);
  const monthly = rows.reduce((a, i) => a + ((i.contribution || 0) * perYear(i.contributionSchedule)) / 12, 0);
  return (
    <>
      <div className="stats">
        <div className="stat">
          <span>Total value</span>
          <b>{money(total, { decimals: false })}</b>
        </div>
        <div className="stat">
          <span>Paying in / month</span>
          <b>{money(monthly, { decimals: false })}</b>
        </div>
      </div>
      <CrudList<Investment>
        table="investments"
        rows={rows}
        sort={(a, b) => b.value - a.value}
        empty="Add ISAs, pensions, savings accounts, shares or Premium Bonds. Update the value now and then to see how it grows."
        renderRow={(i) => {
          const prev = i.history?.[i.history.length - 1];
          const change = prev ? i.value - prev.value : 0;
          return (
            <div className="row">
              <div className="grow">
                <b>{i.name}</b>
                <div className="meta">
                  {[i.kind, i.provider, i.contribution && i.contributionSchedule ? `${money(i.contribution)} ${describeSchedule(i.contributionSchedule).toLowerCase()}` : ''].filter(Boolean).join(' · ')}
                </div>
                <div className="meta">
                  Value as of {formatDate(i.valueDate)}
                  {prev && (
                    <span className={change >= 0 ? 'good' : 'warn'}>
                      {' '}
                      · {change >= 0 ? '▲' : '▼'} {money(Math.abs(change), { decimals: false })} since {formatDate(prev.date)}
                    </span>
                  )}
                </div>
              </div>
              <div className="amount">{money(i.value, { decimals: false })}</div>
            </div>
          );
        }}
      />
      <p className="muted">Tip: open an investment and change its value to record a new valuation. The old one is kept in its history.</p>
    </>
  );
}

function Budget() {
  const budget = useRows<BudgetLine>('budget');
  const t = today();
  return (
    <>
      <p className="muted">Income and everyday spending you plan for. Bills, loan repayments and investment contributions are added automatically from their own tabs.</p>
      <CrudList<BudgetLine>
        table="budget"
        rows={budget}
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
  );
}

function exportCsv(rows: Txn[], month: string) {
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = ['Date,Type,Category,Amount,Note', ...[...rows].sort((a, b) => a.date.localeCompare(b.date)).map((x) => [x.date, x.kind, x.category, x.amount.toFixed(2), x.note].map(esc).join(','))];
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }));
  a.download = `spending-${month}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function Spending() {
  const budget = useRows<BudgetLine>('budget');
  const txns = useRows<Txn>('txns');
  const t = today();
  const [month, setMonth] = useState(monthKey(t));
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
  // most-used categories first, so logging is one tap
  const freq = new Map<string, number>();
  for (const x of txns) if (x.category) freq.set(x.category, (freq.get(x.category) ?? 0) + 1);
  const quickCats = [...new Set([...[...freq.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c), 'Groceries', 'Eating out', 'Fuel', 'Shopping'])].slice(0, 6);
  return (
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
              const over = v.planned > 0 && v.spent > v.planned;
              return (
                <li key={cat}>
                  <div className="row">
                    <span className="grow">{cat}</span>
                    <span className={over ? 'warn' : ''}>
                      {money(v.spent, { decimals: false })}
                      {v.planned ? ` of ${money(v.planned, { decimals: false })}` : ''}
                    </span>
                  </div>
                  <div className="bar">
                    <i style={{ width: `${pct}%` }} className={over ? 'over' : ''} />
                  </div>
                </li>
              );
            })}
        </ul>
      )}
      <div className="chips quick-cats">
        {quickCats.map((c) => (
          <button key={c} className="chip" onClick={() => openEdit({ table: 'txns', initial: { date: month === monthKey(t) ? t : `${month}-01`, kind: 'expense', category: c } })}>
            + {c}
          </button>
        ))}
        {monthTx.length > 0 && (
          <button className="chip" onClick={() => exportCsv(monthTx, month)}>
            ⬇ CSV
          </button>
        )}
      </div>
      <CrudList<Txn>
        table="txns"
        rows={monthTx}
        noun="entry"
        defaults={() => ({ date: month === monthKey(t) ? t : `${month}-01`, kind: 'expense' })}
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
      <button className="fab" aria-label="Log spending" onClick={() => openEdit({ table: 'txns', initial: { date: t, kind: 'expense' } })}>
        +£
      </button>
    </>
  );
}

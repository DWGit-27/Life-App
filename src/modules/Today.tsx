import { AgendaList, groupAgenda, useAgenda, useSources, useUndo } from '../components/Agenda';
import { useRows } from '../components/Crud';
import type { BudgetLine } from '../db';
import { monthlyTotals } from './Money';
import { summarise } from '../lib/mortgage';
import { formatDate, today } from '../lib/dates';
import { money } from '../lib/format';
import type { Page } from '../App';

export default function Today({ go }: { go: (p: Page) => void }) {
  const items = useAgenda(7);
  const g = groupAgenda(items);
  const { onDone, toast } = useUndo();
  const s = useSources();
  const budget = useRows<BudgetLine>('budget');
  const m = monthlyTotals(budget, s.bills, s.loans);
  const t = today();
  const mortgage = s.loans.find((l) => l.kind === 'mortgage');
  const ms = mortgage && summarise(mortgage, t);
  const renewals = s.policies.filter((p) => p.renewalDate && p.renewalDate >= t).sort((a, b) => a.renewalDate!.localeCompare(b.renewalDate!));
  const hasAny = s.tasks.length + s.bills.length + s.policies.length + s.house.length + s.loans.length > 0;

  return (
    <div className="page">
      <h1>{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}</h1>
      {!hasAny && (
        <div className="card intro">
          <p>
            <b>Welcome.</b> Add your bills, insurance, house jobs, loans and tasks, and everything that needs doing shows up here. You can also load some
            example data in Settings to try it out.
          </p>
          <button className="primary" onClick={() => go('settings')}>
            Open Settings
          </button>
        </div>
      )}
      <div className="stats">
        <button className="stat" onClick={() => go('tasks')}>
          <span>Overdue</span>
          <b className={g.overdue.length ? 'warn' : ''}>{g.overdue.length}</b>
        </button>
        <button className="stat" onClick={() => go('tasks')}>
          <span>Due today</span>
          <b>{g.today.length}</b>
        </button>
        <button className="stat" onClick={() => go('money')}>
          <span>Left this month</span>
          <b className={m.left < 0 ? 'warn' : ''}>{money(m.left, { decimals: false })}</b>
        </button>
        {ms && (
          <button className="stat" onClick={() => go('loans')}>
            <span>Mortgage balance</span>
            <b>{money(ms.balanceNow, { decimals: false })}</b>
          </button>
        )}
      </div>
      {g.overdue.length > 0 && (
        <>
          <h2 className="warn">Overdue</h2>
          <AgendaList items={g.overdue} onDone={onDone} />
        </>
      )}
      <h2>Today</h2>
      <AgendaList items={g.today} emptyText="Nothing due today." onDone={onDone} />
      <h2>Next 7 days</h2>
      <AgendaList items={g.week} emptyText="Nothing in the next week." onDone={onDone} />
      {renewals.length > 0 && (
        <>
          <h2>Upcoming renewals</h2>
          <ul className="cards">
            {renewals.slice(0, 3).map((p) => (
              <li key={p.id} className="card clickable" onClick={() => go('insurance')}>
                <div className="row">
                  <b className="grow">{p.name}</b>
                  <span>{formatDate(p.renewalDate)}</span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
      {toast}
    </div>
  );
}

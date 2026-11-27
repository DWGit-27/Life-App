import { addMonths, type ISODate } from './dates';

export interface LoanTerms {
  principal: number;
  /** annual interest rate in percent, e.g. 4.5 */
  annualRate: number;
  termMonths: number;
  /** date of first monthly payment */
  firstPayment: ISODate;
  /** optional overpayment each month */
  extraMonthly?: number;
}

export interface AmortRow {
  n: number;
  date: ISODate;
  payment: number;
  interest: number;
  principal: number;
  balance: number;
}

export function monthlyPayment(principal: number, annualRate: number, termMonths: number): number {
  if (termMonths <= 0) return 0;
  const r = annualRate / 100 / 12;
  if (r === 0) return principal / termMonths;
  return (principal * r) / (1 - Math.pow(1 + r, -termMonths));
}

const round2 = (x: number) => Math.round(x * 100) / 100;

export function amortise(t: LoanTerms): AmortRow[] {
  const r = t.annualRate / 100 / 12;
  const base = round2(monthlyPayment(t.principal, t.annualRate, t.termMonths));
  const extra = t.extraMonthly ?? 0;
  const rows: AmortRow[] = [];
  let bal = t.principal;
  for (let n = 1; bal > 0.005 && n <= t.termMonths + 1; n++) {
    const interest = round2(bal * r);
    let payment = base + extra;
    if (payment > bal + interest || n === t.termMonths) payment = round2(bal + interest);
    const principal = round2(payment - interest);
    bal = round2(bal - principal);
    rows.push({ n, date: addMonths(t.firstPayment, n - 1), payment: round2(payment), interest, principal, balance: Math.max(0, bal) });
  }
  return rows;
}

export interface LoanSummary {
  monthly: number;
  totalInterest: number;
  payoffDate?: ISODate;
  balanceNow: number;
  paidSoFar: number;
  interestSoFar: number;
  paymentsLeft: number;
  nextPayment?: AmortRow;
  rows: AmortRow[];
}

export function summarise(t: LoanTerms, asOf: ISODate): LoanSummary {
  const rows = amortise(t);
  const past = rows.filter((r) => r.date <= asOf);
  const last = past[past.length - 1];
  return {
    monthly: rows[0]?.payment ?? 0,
    totalInterest: round2(rows.reduce((a, r) => a + r.interest, 0)),
    payoffDate: rows[rows.length - 1]?.date,
    balanceNow: last ? last.balance : t.principal,
    paidSoFar: round2(past.reduce((a, r) => a + r.payment, 0)),
    interestSoFar: round2(past.reduce((a, r) => a + r.interest, 0)),
    paymentsLeft: rows.length - past.length,
    nextPayment: rows[past.length],
    rows,
  };
}

# Life App

One place for everything that needs doing: tasks and work projects, bills, insurance, house maintenance and cleaning, budget and spending, and loans/mortgage. Every module feeds a single **Today / Tasks** agenda.

It is an installable web app (PWA). Open it in Chrome on Android or desktop and choose **Install** / **Add to Home screen**. It works offline. Data is stored on the device (IndexedDB); use **Settings → Download backup** to back up or move data. Sync between devices is planned.

## Modules (MVP)

| Module | What it holds | What it adds to the agenda |
|---|---|---|
| Tasks | One-off, recurring and "anytime" tasks; work projects | Each due date |
| Bills | Amount, schedule, provider, account, reference, direct debit, contract end | Each payment |
| Insurance | Insurer, policy no., cover, excess, premium, renewal date | Renewal reminder (N days before) |
| House | Cleaning rota and maintenance jobs | Each occurrence (missed ones fold together) |
| Money | Income and planned spending; spending log by month | — |
| Loans | Mortgage/loans with amortisation, overpayment what-if, fixed-rate end | Monthly payment, remortgage reminder |

Next: sync and sharing, workouts, house inventory, investments, Android APK.

## Development

```bash
npm install
npm run dev      # local dev server
npm test         # unit tests (schedules, mortgage maths, agenda)
npm run build    # production build in dist/
```

Pushing to `main` runs the tests and deploys to GitHub Pages (`.github/workflows/deploy.yml`).

## Code map

- `src/lib/schedule.ts` recurring schedules (month-end safe)
- `src/lib/mortgage.ts` repayment and amortisation maths
- `src/agenda.ts` builds the combined agenda from every module
- `src/db.ts` Dexie (IndexedDB) schema; records carry `id/updatedAt/deleted` ready for sync
- `src/modules/*` one screen per module

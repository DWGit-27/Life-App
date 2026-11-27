# Life App

One place for everything that needs doing: tasks and work projects, bills, insurance, house maintenance and cleaning, budget and spending, and loans/mortgage. Every module feeds a single **Today / Tasks** agenda.

It is an installable web app (PWA). Open it in Chrome on Android or desktop and choose **Install** / **Add to Home screen**. It works offline. Data is stored on the device (IndexedDB); use **Settings → Download backup** to back up or move data. Sync between devices is planned.

## Tabs

| Tab | What it holds | Feeds My Day with |
|---|---|---|
| My Day | Week strip, overdue / today / next 7 days, today's workout, objectives, backup reminder | |
| Tasks & objectives | One-off, recurring and anytime tasks with steps; objectives with progress | Task due dates |
| Money | Overview (net worth, monthly plan, next 30 days going out), Bills, Insurance, Loans, Investments, Budget, Spending | Bill payments, renewal heads-ups, loan payments, remortgage reminder |
| House | Cleaning rota, maintenance, inventory (serials, receipts, warranties) | Chores, warranty-ending heads-ups |
| Health | Food diary (calories & macros), meal planner with shopping list, saved foods, body weight & calorie target; gym planner, workout log, streaks, personal bests | Planned workouts |

Tap anything in a list to edit it. ⏰ moves an item to another day. 🔍 (or `/`) searches everything. Press `?` for keyboard shortcuts. Quick add understands `tomorrow`, `fri`, `in 3 days`, `25/12`, `!high`, `#work`, `*` (focus) and `someday`.

Next: sync and sharing, phone notifications, Android APK.

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

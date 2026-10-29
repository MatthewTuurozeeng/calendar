# Matthew's Calendar

A personal calendar and planner for events, tasks, recurring routines, reminders and an academic timetable. It's an installable Progressive Web App (PWA) that works on a laptop and a phone.

**Live:** https://calendar-two-gold.vercel.app

It connects *what I need to do*, *when I'll do it* and *how the day went*. It's built around one person's workflow, not as a Google Calendar clone.

**Principles**
- **Personal first:** build what the owner actually uses.
- **Modular:** optional planners sit on the core calendar and task engine and never fork it.
- **Reliable:** editing an event always updates its reminders, and recurring schedules behave predictably.
- **Private:** authentication plus row-level security on every table.
- **Calm:** generous whitespace and restrained pastel colors.

**Non-goals:** sharing and collaboration, two-way sync with other calendars, native apps, a custom backend server, time tracking.

## Features

| Area | What it does |
| --- | --- |
| **Today page** | The day's intention and note, the next event with a countdown, progress so far (tasks done, events finished, focus time), tasks due and overdue, today's schedule, and free time between events. Each section can be turned off. |
| **Calendar** | Day, Week, Month and Agenda views. Drag to create, move or resize events. Timed and all-day events, categories, locations, and overlap warnings. Agenda is the default on phones. |
| **Recurrence** | Daily, weekly, monthly ("the 15th" or "2nd Tuesday"), yearly, every N, until a date or N times. Edits apply to *this event*, *this and following* or *all*. Safe across daylight-saving changes. |
| **Tasks** | Today, Upcoming, Overdue and Completed (the last 20). Priority, due date or time, estimate, subtasks and reminders. |
| **Time-blocking** | Schedule a task onto the calendar; completing the block completes the task. |
| **Reminders** | Push notifications to phone and laptop, even with the app closed. Several reminders per event or task, with a default time for all-day items. |
| **Academic Planner** | Optional module. Covers semesters, courses, weekly class times (generated as repeating events), quizzes, exams and assignments (as tasks), plus timetable clash warnings. Turning it off keeps the data. |
| **Settings** | Name, appearance, time zone, week start, 12- or 24-hour time, default view, weekends and week numbers, day start, event length, notifications, categories, Today page sections, modules, password and sign-out. |
| **Appearance** | Light, Dark or System, chosen per device, with no flash on load. |
| **Install and offline** | Installs on Android, iOS and desktop. Recently viewed pages still show their data offline, with a banner. Saving needs a connection. |
| **Accounts** | Landing page at `/welcome`, sign-in and sign-up (password entered twice), email confirmation, and *Forgot password?* |

## Stack

React 19, TypeScript, Vite, Tailwind CSS v4, React Router, FullCalendar, date-fns and date-fns-tz, `rrule` · Supabase (Postgres with row-level security, Auth, Edge Functions on Deno, `pg_cron`, `pg_net`, Vault) · Web Push (VAPID) · Vercel · Vitest

## Project structure

```text
client/                 frontend; run npm scripts here
  public/               sw.js (service worker), manifest, icons
  src/app/              routes, providers
  src/components/       layout (shell, sidebar, bottom nav), ui (dialog, icons…)
  src/features/         one folder per feature:
                        auth, landing, dashboard (Today), calendar, events, recurrence,
                        tasks, reminders, academic, categories, settings, pwa
  src/lib/              supabase client, dates, validation, theme, offline
  src/types/database.ts generated from Supabase
  tests/unit/           Vitest
server/supabase/
  migrations/           the schema (source of truth)
  functions/            sync-reminders, send-reminders, _shared/reminder-plan.ts
```

Keep components, hooks and queries inside their feature folder.

## Development

```bash
cd client
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests
npm run lint
npm run build      # type-checks first
```

`client/.env.local` needs `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (the `sb_publishable_…` key) and `VITE_VAPID_PUBLIC_KEY`.

Database changes go in a new migration under `server/supabase/migrations/`. Run `supabase db push` from `server/`, then regenerate the types:

```bash
cd server && supabase gen types typescript --linked > ../client/src/types/database.ts
```

## How it works

**Data**
- Every table has `user_id` and row-level security. Child tables use composite foreign keys `(user_id, parent_id)`, so a row can never point at another user's data.
- Timed values are UTC `timestamptz`; all-day values are `date`. Every event stores its IANA time zone.
- Sign-up creates the profile and default categories (`handle_new_user` trigger).

**Recurrence**
- A series is one event row with an RRULE.
- Occurrences are expanded on the client for the visible range, in the event's own time zone, and never stored.
- Single-occurrence edits and cancellations are rows in `event_exceptions`.

**Academic Planner**
- It adds data, not a second engine.
- Classes are weekly series with `course_id` and `kind = 'class'`, ending on the semester's last day.
- Quizzes and exams are one-off events. Assignments are tasks with `course_id`.

**Reminders**

```text
save event/task ─► trigger cancels its pending reminders
               └─► sync-reminders (called by the app): plans the next 14 days and upserts reminders by idempotency key
cron hourly    ─► sync-reminders for everyone (rolls the window forward)
cron 1/min     ─► send-reminders: claims due rows (SKIP LOCKED), sends Web Push,
                  retries up to 3 times, drops anything over 60 min late, revokes dead subscriptions
```

Cron reaches the functions through `invoke_edge_function()`, using Vault secrets. Clients can only read `reminders`.

**Offline**
- The service worker caches the app shell and keeps copies of database reads (up to 300).
- Reads go network-first, falling back to the saved copy offline.
- Signing out deletes the saved copies.

**Design ("Sunset Cloud")**
- Colors are tokens in `src/styles/index.css`; dark mode redefines the neutrals.
- Pastels: dusty orange `#F08D7E`, warm peach `#EFA18A`, soft rose `#E2BAB1`, periwinkle `#ACAEC5`, rose pink `#DDA6B9`.
- Text on pastels is always dark.
- Never use color alone to convey meaning; tap targets are about 44px or larger.

## Deploying

Do this once per Supabase project.

1. **Push keys:** `npx web-push generate-vapid-keys`. Keep the private key out of the repo.
2. **Backend** (from `server/`):
   ```bash
   supabase db push
   supabase secrets set VAPID_PUBLIC_KEY=<public> VAPID_PRIVATE_KEY=<private> VAPID_SUBJECT=mailto:<email>
   supabase functions deploy sync-reminders
   supabase functions deploy send-reminders
   ```
   Check that both functions are listed: `supabase functions list`.
3. **Cron secrets.** Run in the SQL editor, using the `default` secret key:
   ```sql
   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
   select vault.create_secret('<sb_secret_…>', 'edge_functions_secret_key');
   ```
4. **Vercel.**
   - Import the repo with Root Directory `client`.
   - Add the three `VITE_` variables with type **Config**. Keep the prefix and paste the full keys.
   - Redeploy after changing any variable, because the values are built into the app.
5. **Auth URLs.** In Supabase → Authentication → URL Configuration:
   - Site URL: the Vercel URL.
   - Redirect URLs: `https://<app>.vercel.app/**` and `http://localhost:5173/**`.
6. **Phone.** Open the site and sign in, then install it (Settings → Install app, or Chrome's *Add to home screen*; on iPhone, Share → *Add to Home Screen*). Then go to Settings → Notifications and send a test.

**Troubleshooting**

| Symptom | Cause and fix |
| --- | --- |
| `401 Invalid API key` on sign-in | Vercel's `VITE_SUPABASE_ANON_KEY` is wrong or truncated. Fix it and redeploy. |
| `400 invalid_credentials` | Wrong email or password, often a stale saved password. Use *Forgot password?* |
| CORS error on `functions/v1/send-reminders`, no notifications | The function isn't deployed (a 404 shows up as a CORS error). Deploy it. |
| Reminders still missing | Check `select status, last_error, remind_at from reminders order by remind_at desc limit 20;` and `cron.job_run_details`. |
| No confirmation or reset email | Check spam. Supabase's built-in sender only sends a few emails an hour. |

Free Supabase projects pause after a period of inactivity, and reminders stop while paused.

## Testing

`npm test` runs 94 Vitest tests:
- recurrence rules, expansion and edit scopes (including DST)
- reminder planning
- task views
- event timing
- Today page summary and free time
- academic timetable and clashes
- preferences
- validation

Not automated yet:
- Playwright end-to-end tests
- database tests proving a second account can't see your data

Check notifications by hand: permission denied, app closed, offline then back online, several devices, iOS installed app.

## Roadmap

| Release | Status |
| --- | --- |
| v0.1 Core: calendar, tasks, recurrence, time-blocking, Today page | Built. A database export procedure is still to be documented and tried. |
| v0.2 Reminders and PWA | Built. Confirm on a real phone: notifications arrive with the app closed, never stale, never duplicated. |
| v0.3 Academic Planner | Built. |
| v0.4 Hardening | Offline reading done. Still to do: JSON and `.ics` export, an accessibility pass, Playwright tests in CI, and a backup restore test. |

**Smaller gaps:** a to-do list in the Day view and a mini-calendar in the sidebar.

**Ideas for later:** weekly review, habit tracking, year view, `.ics` import, natural-language quick-add, offline editing.

## Security and budget

- Row-level security plus composite foreign keys; never trust the client.
- The secret key and VAPID private key live only in Supabase secrets.
- Edge Functions never log event or task content.
- One frontend, one Supabase project, two Edge Functions.
- Reminder queries use partial indexes, and the only stored occurrences are the 14-day reminder window.
- Keep backups outside Supabase and test restoring them.

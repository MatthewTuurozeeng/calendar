# Personal Calendar & Productivity Planner

> A personal, cross-platform calendar and productivity app for events,
> tasks, recurring routines, reminders, and optional planning modules,
> built as an installable Progressive Web App (PWA).

## 1. Overview

This is a calendar and productivity planner built around one person's way
of organizing time. It connects **what I need to do, when I plan to do it,
and how I review my progress**, on both a laptop and a phone.

It is not a Google Calendar clone. Its distinguishing features are:

- A daily command center that answers "what do I need to know and do today?"
- Task time-blocking: scheduling a task onto the calendar while keeping
  its completion state on the task.
- A general recurrence engine for lectures, shifts, workouts and routines.
- Optional modules, starting with an Academic Planner, that can be
  enabled, disabled or archived without affecting the core app.

### Product principles

- **Personal first.** Build the workflows the owner actually uses.
- **Modular.** Specialized planners sit on top of the core calendar,
  task and recurrence engine. They never fork it.
- **Reliable.** Editing or deleting an event always updates its reminders.
  Recurring schedules behave predictably.
- **Private.** Authentication plus row-level security on every user-owned table.
- **Calm.** Generous whitespace, clear type, restrained pastel colors.
- **Incremental.** Ship a small version you use daily, then extend it.

## 2. Non-goals

These are deliberately out of scope. Revisit them only with a concrete need.

- Multi-user features: sharing calendars, inviting others, collaboration.
- Two-way sync with Google Calendar, Outlook or other providers
  (one-way `.ics` import/export may come later).
- Native iOS/Android apps (only if PWA limitations become a real blocker).
- A custom backend server, Redis, message queues or microservices.
- Time tracking. Estimates are estimates; the app does not measure time spent.

## 3. Platform and Stack

| Layer        | Choice                                                             | Notes                                                  |
| ------------ | ------------------------------------------------------------------ | ------------------------------------------------------ |
| UI           | React + TypeScript + Vite                                          | One codebase for desktop and mobile browsers           |
| Styling      | Tailwind CSS                                                       | Design tokens defined once (see §5)                   |
| Calendar UI  | FullCalendar (free plugins: daygrid, timegrid, list, interaction)  | Our event/recurrence model stays independent of it     |
| Dates        | date-fns + date-fns-tz                                             | All time-zone math goes through one `lib/dates.ts`   |
| Recurrence   | `rrule`                                                          | Expansion happens in our code, not inside FullCalendar |
| Database     | Supabase PostgreSQL                                                | SQL migrations committed to the repo                   |
| Auth         | Supabase Auth                                                      |                                                        |
| Server logic | Supabase Edge Functions                                            | Reminder generation and push delivery                  |
| Scheduling   | Supabase Cron (`pg_cron`) invoking Edge Functions via `pg_net` |                                                        |
| Push         | Web Push with VAPID keys                                           | Private key lives only in Edge Function secrets        |
| Hosting      | Vercel Hobby or Cloudflare Pages                                   |                                                        |
| Tests        | Vitest (unit), Playwright (end-to-end)                             |                                                        |

Verify current free-tier limits and policies before relying on any of them.

## 4. Features

### 4.1 Calendar

- Views: **Day**, **Week**, **Month**, **Agenda**. Previous/next navigation and a Today button.
- Timed and all-day events, with title, time, category, location, and a reminder indicator.
- Today, past dates and future dates are styled distinctly.
- Overlap detection shows a warning, never a block.
- **Month:** 7-column grid starting on the user's chosen weekday. At most 2–3 event pills per day, then `+N more`.
- **Week:** 7 columns with an hourly rail. Defaults to 6:00–22:00 with scrolling outside that. Selecting a time range creates an event.
- **Day:** hourly timeline plus a "To-Do Today" list for unscheduled tasks, the next event, and the daily intention.
- **Agenda:** chronological list grouped by date. This is the default on narrow screens.

### 4.2 Tasks

- Fields: title, description, status (`pending` / `in_progress` / `completed`), priority (`low` / `medium` / `high`), category, and either a due date or a due date-time.
- Also: estimated minutes, subtasks, reminders, and completion timestamp.
- Actions: add, edit, delete, complete, reopen, and filter.
- Views: **Today**, **Upcoming**, **Overdue**, **Completed**.

### 4.3 Task time-blocking

- "Schedule this task" creates an event linked to the task (`events.task_id`).
- A task can have several time blocks.
- Completing the task does not delete its blocks. Deleting a block does not delete the task.
- The event shows the task's completion state. Ticking it off from the calendar completes the task.

### 4.4 Recurrence

Recurrence is a core capability, used by classes, meetings, workouts, shifts and reading sessions alike.

- Supported: daily, weekly (chosen weekdays), monthly (by date or by "2nd Tuesday"), interval ("every 2 weeks"), and an end date or count.
- A series is **one event row** with an `rrule`. Occurrences are expanded on demand for the visible range and never stored as copies.
- Recurrence is expanded in the series' own IANA time zone, so "10:00 every Monday" stays at 10:00 local time.
- Edit scopes:
  - **This occurrence** writes an `event_exceptions` row, either cancelled or overridden.
  - **This and following** ends the original series the day before and creates a new series from the selected occurrence. Exceptions after the split move to the new series.
  - **All occurrences** updates the series row. If the time or rule changes, exceptions that no longer match an occurrence are removed, and the user is told how many.

### 4.5 Reminders

- Presets: 5, 15, 30 and 60 minutes before, plus a custom offset. Several reminders per event or task are allowed.
- Offsets are stored on the event or task (`reminder_offsets`). Concrete reminder rows are generated from them.
- All-day events and date-only tasks remind relative to a default time-of-day from notification preferences (for example 08:00).
- Pipeline details are in §7.

### 4.6 Dashboard

The dashboard answers: **"What do I need to know and do today?"**

- Today's date, the next event with a countdown, and today's timeline.
- Tasks due today and overdue tasks.
- Quick-add for events and tasks.
- A short completion summary.
- The daily intention or note.
- Optional: free gaps between commitments.

Keep it to these items. Add no more cards without a reason.

### 4.7 Categories and settings

- Categories (life areas) are user-defined, each with a name and color, and can be archived. On first sign-in the app seeds defaults: Work, Personal, Health, Family, Projects, Study.
- Settings: time zone (taken from the browser at sign-up), week start day, enabled modules, dashboard sections, and notification preferences.

### 4.8 Academic Planner (optional module)

The module adds data; it never adds a second engine.

- A **semester** has a name, start date and end date.
- A **course** has a code, title, color, and optional lecturer and venue. It belongs to a semester.
- **Classes** are recurring events with `course_id` set and `kind = 'class'`. Their `rrule` ends on the semester end date.
- **Quizzes and exams** are events with `kind = 'quiz'` or `'exam'`.
- **Assignments** are tasks with `course_id` set, so they get due dates, priority, subtasks and time-blocking for free.
- Holidays and cancelled or moved classes are handled by ordinary `event_exceptions`.
- Clash warnings reuse the general overlap check.

**Lifecycle**

- Disabling the module hides academic navigation and views. No data is deleted, and academic events still show on the calendar unless the user hides them.
- Archiving a semester (`archived_at`) hides its courses from pickers but keeps their history searchable.
- Deleting a semester is a separate, confirmed action that cascades to its courses, classes and assignments.

### 4.9 Cross-device and PWA

- Responsive layout. Sign in on any device to see the same data.
- Manifest, icons and a service worker for app-shell caching and push.
- **iPhone/iPad:** Web Push only works after the app is added to the Home Screen (iOS 16.4+). Android Chrome and desktop browsers work from the browser tab.
- Offline read access (cached recent range) is planned. Offline writes are out of scope until conflict rules are designed.

## 5. Design System: "Sunset Cloud"

### Category palette

| Name         | Hex         | Suggested use              |
| ------------ | ----------- | -------------------------- |
| Dusty Orange | `#F08D7E` | Social or creative time    |
| Warm Peach   | `#EFA18A` | Family or personal errands |
| Soft Rose    | `#E2BAB1` | Alternate personal         |
| Periwinkle   | `#ACAEC5` | Rest or reading            |
| Rose-Pink    | `#DDA6B9` | Appointments or self-care  |

### Neutrals (starting values)

| Token          | Hex         |
| -------------- | ----------- |
| Background     | `#FAF8F6` |
| Text primary   | `#29272A` |
| Text secondary | `#6B6870` |
| Border         | `#E7E2E0` |

### Rules

- Text on pastel pills is always **dark charcoal**, never white. Check contrast with a tool.
- Never use color alone to show category or status. Add a label or icon.
- Keep visible keyboard focus rings and comfortable tap targets (about 44px minimum).
- Show clear empty, loading, error and confirmation states.

### Layout

- **Desktop:** a header (period title, Today, previous/next, view switcher); a sidebar (mini-calendar, modules, categories, quick-add); the main view; and an optional detail panel.
- **Mobile:** a compact top bar, a bottom navigation (Today · Calendar · Tasks · Settings), and a floating quick-add button. Agenda and Day views are the default.

Dark mode is deferred (see §11), but all colors go through tokens so it can be added without a rewrite.

## 6. Data Model

### Conventions

- Every user-owned table has `user_id`. RLS restricts all access to `user_id = auth.uid()`.
- Parent tables expose `unique (user_id, id)`. Child tables use **composite foreign keys** `(user_id, parent_id)`, so a row can never point at another user's record, even if RLS is misconfigured.
- `created_at` and `updated_at` are on every table. `updated_at` is maintained by a shared trigger.
- **Time:**
  - Timed values are `timestamptz` in UTC.
  - All-day values are `date`.
  - Every event stores an IANA `timezone` for recurrence expansion.
- **Deletion:**
  - Events, tasks and categories are hard-deleted after confirmation (categories can also be archived).
  - Semesters and courses are archived by default and deleted only explicitly.
  - Pending reminders are removed with their parent via cascade.

### Schema (draft, to be refined in migrations)

```sql
-- ---------- Profile & settings (one row per user) ----------
create table profiles (
  id                 uuid primary key references auth.users on delete cascade,
  display_name       text,
  timezone           text not null,                 -- IANA, set from browser at sign-up
  week_starts_on     smallint not null default 1 check (week_starts_on between 0 and 6),
  enabled_modules    text[] not null default '{}',  -- e.g. {'academic'}
  dashboard_prefs    jsonb not null default '{}',
  notification_prefs jsonb not null default '{}',   -- e.g. {"all_day_reminder_time":"08:00"}
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Categories ----------
create table categories (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  name        text not null,
  color       text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  position    int  not null default 0,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, name),
  unique (user_id, id)
);

-- ---------- Academic module ----------
create table semesters (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  name        text not null,
  start_date  date not null,
  end_date    date not null,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date),
  unique (user_id, id)
);

create table courses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users on delete cascade,
  semester_id uuid not null,
  code        text not null,
  title       text not null,
  lecturer    text,
  venue       text,
  color       text check (color ~ '^#[0-9A-Fa-f]{6}$'),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (user_id, semester_id) references semesters (user_id, id) on delete cascade,
  unique (user_id, id)
);

-- ---------- Tasks ----------
create table tasks (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references auth.users on delete cascade,
  category_id       uuid,
  course_id         uuid,                          -- set for assignments
  title             text not null,
  description       text,
  status            text not null default 'pending'
                      check (status in ('pending','in_progress','completed')),
  priority          text not null default 'medium'
                      check (priority in ('low','medium','high')),
  due_at            timestamptz,                   -- due at a specific time
  due_date          date,                          -- due on a day, no time
  estimated_minutes int check (estimated_minutes > 0),
  reminder_offsets  int[] not null default '{}',   -- minutes before due
  completed_at      timestamptz,
  position          int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (due_at is null or due_date is null),
  check ((status = 'completed') = (completed_at is not null)),
  foreign key (user_id, category_id) references categories (user_id, id) on delete set null (category_id),
  foreign key (user_id, course_id)   references courses (user_id, id)    on delete cascade,
  unique (user_id, id)
);

create table task_subtasks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  task_id      uuid not null,
  title        text not null,
  is_completed boolean not null default false,
  position     int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (user_id, task_id) references tasks (user_id, id) on delete cascade
);

-- ---------- Events (one-off and recurring series) ----------
create table events (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users on delete cascade,
  category_id      uuid,
  course_id        uuid,                           -- academic events
  task_id          uuid,                           -- time block for a task
  kind             text not null default 'general'
                     check (kind in ('general','class','quiz','exam','milestone')),
  title            text not null,
  description      text,
  location         text,                           -- place or meeting link
  all_day          boolean not null default false,
  start_at         timestamptz,                    -- timed events
  end_at           timestamptz,
  start_date       date,                           -- all-day events
  end_date         date,                           -- exclusive
  timezone         text not null,                  -- IANA; recurrence expands in this zone
  rrule            text,                           -- RFC 5545 rule, e.g. FREQ=WEEKLY;BYDAY=MO,WE
  series_until     timestamptz,                    -- cached end of series; null = open-ended
  reminder_offsets int[] not null default '{}',    -- minutes before start
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (all_day and start_date is not null and end_date > start_date
             and start_at is null and end_at is null)
    or
    (not all_day and start_at is not null and end_at > start_at
                 and start_date is null and end_date is null)
  ),
  foreign key (user_id, category_id) references categories (user_id, id) on delete set null (category_id),
  foreign key (user_id, course_id)   references courses (user_id, id)    on delete cascade,
  foreign key (user_id, task_id)     references tasks (user_id, id)      on delete set null (task_id),
  unique (user_id, id)
);

-- One row per changed or cancelled occurrence of a series
create table event_exceptions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users on delete cascade,
  event_id        uuid not null,
  original_start  timestamptz,                     -- identifies a timed occurrence
  original_date   date,                            -- identifies an all-day occurrence
  is_cancelled    boolean not null default false,
  new_start_at    timestamptz,
  new_end_at      timestamptz,
  new_title       text,
  new_location    text,
  new_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(original_start, original_date) = 1),
  foreign key (user_id, event_id) references events (user_id, id) on delete cascade,
  unique (event_id, original_start),
  unique (event_id, original_date)
);

-- ---------- Daily notes / intention ----------
create table daily_notes (
  user_id    uuid not null references auth.users on delete cascade,
  note_date  date not null,
  intention  text,
  note       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, note_date)
);

-- ---------- Reminders (generated rows, written by server only) ----------
create table reminders (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users on delete cascade,
  event_id         uuid,
  task_id          uuid,
  occurrence_start timestamptz,                    -- which occurrence of a recurring event
  offset_minutes   int not null,
  remind_at        timestamptz not null,
  status           text not null default 'pending'
                     check (status in ('pending','processing','sent','cancelled','failed')),
  attempt_count    int not null default 0,
  locked_at        timestamptz,
  sent_at          timestamptz,
  last_error       text,
  idempotency_key  text not null unique,           -- e.g. event:<id>:<occurrence>:<offset>
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(event_id, task_id) = 1),
  foreign key (user_id, event_id) references events (user_id, id) on delete cascade,
  foreign key (user_id, task_id)  references tasks (user_id, id)  on delete cascade
);

-- ---------- Push subscriptions (one per device/browser) ----------
create table push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  user_agent   text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  revoked_at   timestamptz
);

-- ---------- Indexes ----------
create index events_user_start_idx    on events (user_id, start_at);
create index events_user_date_idx     on events (user_id, start_date);
create index events_user_series_idx   on events (user_id) where rrule is not null;
create index tasks_user_status_idx    on tasks (user_id, status, due_at);
create index tasks_user_due_date_idx  on tasks (user_id, due_date);
create index reminders_due_idx        on reminders (remind_at) where status = 'pending';
create index reminders_event_idx      on reminders (event_id) where status = 'pending';
```

### Row-level security

Every table above gets RLS enabled. Most use one policy:

```sql
alter table <table> enable row level security;
create policy own_rows on <table>
  for all
  using      (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
```

Exceptions:

- `profiles` uses `id` instead of `user_id`.
- `reminders` is **select-only** for clients. Only server code using the service role inserts or updates it.

### Fetching a visible range

1. Load one-off events that overlap the range.
2. Load series where the series start is at or before the range end and `series_until` is null or at or after the range start.
3. Load exceptions for those series.
4. Expand the series client-side with `rrule` in each event's `timezone`, then apply the exceptions.

This logic lives in one tested module, `features/recurrence`.

## 7. Reminder Pipeline

```text
Event/task saved ──► DB trigger: cancel pending reminders for it
        │
        └──► Edge Function `sync-reminders` (called after save)
                 expands next 14 days of occurrences × offsets
                 upserts reminder rows by idempotency_key

Supabase Cron, hourly ──► `sync-reminders` for all series (rolls the 14-day window forward)

Supabase Cron, every minute ──► Edge Function `send-reminders`
    1. reset rows stuck in 'processing' > 5 min back to 'pending'
    2. claim due rows atomically:
         UPDATE reminders SET status='processing', locked_at=now(), attempt_count=attempt_count+1
         WHERE id IN (SELECT id FROM reminders
                      WHERE status='pending' AND remind_at <= now()
                      ORDER BY remind_at LIMIT 50
                      FOR UPDATE SKIP LOCKED)
         RETURNING *;
    3. skip anything more than 60 min late → mark 'failed' ('stale')
    4. send Web Push to each active subscription of the user
    5. mark 'sent', or back to 'pending' for retry (max 3 attempts, then 'failed')
    6. revoke subscriptions that return 404/410
```

### Rules

- The cancel trigger runs first, so a stale reminder can never fire even if `sync-reminders` fails.
- The VAPID private key and service-role key live only in Edge Function secrets, never in the frontend.
- Push delivery is best effort. Connectivity, permissions and OS behavior can delay or drop notifications.

### Known risk

Free Supabase projects may pause after a period of inactivity, and reminders stop while the project is paused. Daily use normally keeps the project active. Check the current pause policy, and treat a missing morning notification as a signal to check the project.

## 8. Project Structure

```text
calendar/
├── client/                frontend (Vite + React); run npm scripts here
│   ├── public/            manifest.webmanifest, icons/
│   ├── src/
│   │   ├── app/           routes.tsx, providers.tsx
│   │   ├── components/    layout/, ui/
│   │   ├── features/
│   │   │   ├── calendar/  events/  tasks/  categories/
│   │   │   ├── recurrence/          # expansion, exceptions, edit scopes
│   │   │   ├── reminders/  dashboard/  settings/
│   │   │   └── academic/
│   │   ├── lib/           supabase.ts, dates.ts, validation.ts
│   │   ├── types/         database.ts (generated from Supabase)
│   │   ├── styles/
│   │   └── main.tsx
│   ├── tests/             unit/, e2e/
│   └── .env.local         VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
├── server/                backend; run the Supabase CLI here
│   └── supabase/
│       ├── migrations/
│       └── functions/     sync-reminders/, send-reminders/
└── README.md
```

- Frontend: `cd client && npm install && npm run dev`.
- Backend: `cd server && supabase db push` (or pass `--workdir server` from the root).
- Regenerate types: `cd server && supabase gen types typescript --linked > ../client/src/types/database.ts`.

Keep components, hooks and queries inside their feature folder. Don't add abstraction layers before they're needed.

### Deploying, reminders and install setup

Do these once per Supabase project. Installing on a phone and push both need the HTTPS deployment.

1. **VAPID keys** for Web Push: `npx web-push generate-vapid-keys`. Keep the private key out of the repo.
2. **Database and functions** (from `server/`):
   ```bash
   supabase db push
   supabase secrets set VAPID_PUBLIC_KEY=<public> VAPID_PRIVATE_KEY=<private> VAPID_SUBJECT=mailto:<your email>
   supabase functions deploy sync-reminders
   supabase functions deploy send-reminders
   ```
3. **Cron credentials in Vault.** In the dashboard SQL editor, using the secret API key named `default` (Project Settings → API Keys):
   ```sql
   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
   select vault.create_secret('<sb_secret_... default key>', 'edge_functions_secret_key');
   ```
   The migration already scheduled `send-reminders` every minute and `sync-reminders` hourly; they use these two secrets.
4. **Frontend on Vercel.** Import the repo with **Root Directory** `client` (Vite preset). Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and `VITE_VAPID_PUBLIC_KEY`. `client/vercel.json` sends every route to the app.
5. **Auth URLs.** In Supabase Authentication → URL Configuration, set the Site URL to the Vercel URL and add it to Redirect URLs.
6. **On the phone.** Open the Vercel URL in Chrome (Android) or Safari (iPhone), sign in, then install: Settings → Install, or Chrome's ⋮ menu → *Add to home screen*. On iPhone use Share → *Add to Home Screen*. Open the installed app, go to Settings → Notifications → *Notifications on this device*, and send a test notification.

To check the pipeline: `select status, last_error, remind_at from reminders order by remind_at desc limit 20;` and the cron history in `cron.job_run_details`.

## 9. Releases

Each release should be **used daily** before the next one starts.

### v0.1: Core (usable daily)

- Scaffold Vite, React, TypeScript and Tailwind, plus the Sunset Cloud tokens.
- Supabase project and migrations for profiles, categories, tasks, subtasks, events, event_exceptions and daily_notes. RLS on all of them.
- Auth, the profile created at sign-up, and seeded categories.
- Day, Week, Month and Agenda views. Event CRUD, timed and all-day.
- Task CRUD with the Today, Upcoming, Overdue and Completed views.
- Recurrence (daily, weekly, monthly, end date) with the three edit scopes.
- Task time-blocking.
- A basic dashboard.
- Deployed. A manual database export procedure (`supabase db dump` plus a data dump) documented and tried once.

**Done when:**

- [ ] I can manage my real week on phone and laptop.
- [ ] A second test account can't see or reference my data.
- [ ] Recurrence unit tests pass.

### v0.2: Reminders and PWA

- Manifest, icons, service worker, and install flow (required for iOS push).
- Push subscription management and a VAPID setup.
- Reminder offsets in the UI, the `reminders` table, the cancel trigger, and the two Edge Functions with their cron schedules.

**Done when:**

- [ ] Notifications arrive on my actual phone and laptop with the app closed.
- [ ] Editing or deleting an event never produces a stale notification.
- [ ] A retried worker run never sends a duplicate.

### v0.3: Academic Planner

- Semesters, courses, class series, quizzes and exams, and assignments as tasks.
- A semester setup flow: add courses, then weekly class times, which generates the series.
- Clash warnings, plus enable, disable and archive.

**Done when:**

- [ ] My real timetable is in the app.
- [ ] A cancelled class and a moved class both display correctly.
- [ ] Disabling and re-enabling the module loses nothing.

> If a semester is in progress, v0.3 can come before v0.2.

### v0.4: Hardening

- Offline read access for the recent range.
- JSON export and `.ics` export.
- An accessibility pass.
- Playwright end-to-end suite for the core flows.
- A backup **restore** test into a fresh project.

**Done when:**

- [ ] A restore from backup works.
- [ ] End-to-end tests run in CI.

## 10. Testing

**Unit (Vitest)**

- Recurrence expansion, exceptions, and the three edit scopes.
- Time-zone handling.
- Task status rules.
- Reminder time calculation, including all-day and date-only cases.
- Module enable/disable.

**Integration (local Supabase)**

- RLS: a second user can neither read nor reference the first user's rows.
- Event edit and delete cancel and regenerate reminders.
- Worker claiming is idempotent under concurrent runs.

**End-to-end (Playwright)**

- Create and edit an event.
- Create and complete a task.
- Create a recurring event and edit one occurrence.
- Schedule a task as a time block.
- Toggle the Academic module.
- Mobile viewport and keyboard navigation.

**Manual notification checks**

- Permission granted and denied.
- App open, in the background, and closed.
- Device offline, then back online.
- Expired subscription.
- Several devices.
- iOS installed PWA.

## 11. Ideas for Later

These are not specified yet. Design them when their turn comes.

- Weekly review: planned vs. completed, overdue items, time by category, and a reflection.
- Habit tracking.
- Year view.
- Dark mode.
- Free-time-gap suggestions for time-blocking.
- `.ics` import.
- Natural-language quick-add.
- Offline editing with conflict resolution.
- Additional modules, such as a work planner or fitness planner.

## 12. Security and Budget Rules

**Security**

- RLS on every table, plus composite foreign keys for ownership. Never trust the client.
- Secrets (service role key, VAPID private key) are kept only in server environments.
- Don't log event or task descriptions in Edge Functions.
- Keep backups outside Supabase, and test restoring them.

**Budget**

- Keep the architecture to one frontend, one Supabase project, and two Edge Functions.
- Reminder queries hit the partial index on pending rows only, with no full-table polling.
- Store no recurrence occurrences except the 14-day reminder window.
- Watch database, function-invocation and egress usage monthly.

## 13. First Steps

1. Create the GitHub repo and scaffold Vite, React, TypeScript and Tailwind.
2. Add the design tokens and the responsive shell (header, sidebar, bottom navigation).
3. Create the Supabase project, write the first migration from §6, and enable RLS.
4. Build auth and event CRUD with the Week and Agenda views.
5. Add tasks, then the recurrence module with its unit tests.
6. Deploy and start using it daily. That's v0.1.

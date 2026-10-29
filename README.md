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

### Status (29 October 2026)

v0.1 (core) and v0.2 (reminders and PWA) are built and deployed on Vercel.
Not built yet:

- **Calendar:** the Day view's to-do list and the sidebar mini-calendar.
- **Academic Planner (v0.3):** only the Modules switch exists; `features/academic/` is empty.
- **v0.4 hardening:** the database export procedure and Playwright end-to-end tests.

Sections below describe the full design. Where something isn't built yet, it is marked *(planned)*.

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
| UI           | React 19 + TypeScript + Vite, React Router                         | One codebase for desktop and mobile browsers           |
| Styling      | Tailwind CSS v4                                                    | Design tokens defined once (see §5)                   |
| Calendar UI  | FullCalendar (free plugins: daygrid, timegrid, list, interaction)  | Our event/recurrence model stays independent of it     |
| Dates        | date-fns + date-fns-tz                                             | All time-zone math goes through one `lib/dates.ts`   |
| Recurrence   | `rrule`                                                          | Expansion happens in our code, not inside FullCalendar |
| Database     | Supabase PostgreSQL                                                | SQL migrations committed to the repo                   |
| Auth         | Supabase Auth                                                      |                                                        |
| Server logic | Supabase Edge Functions                                            | Reminder generation and push delivery                  |
| Scheduling   | Supabase Cron (`pg_cron`) invoking Edge Functions via `pg_net` |                                                        |
| Push         | Web Push with VAPID keys                                           | Private key lives only in Edge Function secrets        |
| Hosting      | Vercel Hobby                                                       | `client/vercel.json` sends every route to the app      |
| Tests        | Vitest (unit); Playwright (end-to-end, planned)                    |                                                        |

Verify current free-tier limits and policies before relying on any of them.

## 4. Features

### 4.1 Calendar

- Views: **Day**, **Week**, **Month**, **Agenda**. Previous/next navigation and a Today button.
- Timed and all-day events, with title, time, category, location, and a reminder indicator.
- Today, past dates and future dates are styled distinctly.
- Overlap detection shows a warning, never a block, in the event form and when scheduling a task.
- Drag an event to move it, or drag its edge to resize it. On a recurring event this asks which occurrences to change.
- **Month:** 7-column grid starting on the user's chosen weekday. At most 3 rows of events per day, then `+N more`.
- **Week:** 7 columns with an hourly rail, scrolled to the "Day starts at" hour (default 6:00). Selecting a time range creates an event. Weekends and week numbers can be shown or hidden.
- **Day:** hourly timeline. *(Planned: a "To-Do Today" list for unscheduled tasks, the next event, and the daily intention.)*
- **Agenda:** chronological list grouped by date. This is the default on narrow screens.
- The default view is a setting; "Automatic" means Week on wide screens and Agenda on phones.

### 4.2 Tasks

- Fields: title, description, status (`pending` / `in_progress` / `completed`), priority (`low` / `medium` / `high`), category, and either a due date or a due date-time.
- Also: estimated minutes, subtasks, reminders, and completion timestamp.
- Actions: add, edit, delete, complete, reopen, and filter.
- Views: **Today**, **Upcoming** (grouped by day, undated tasks last), **Overdue**, **Completed** (the 20 most recently completed).

### 4.3 Task time-blocking

- "Schedule this task" creates an event linked to the task (`events.task_id`).
- A task can have several time blocks.
- Completing the task does not delete its blocks. Deleting a block does not delete the task.
- The event shows the task's completion state. Ticking it off from the calendar completes the task.

### 4.4 Recurrence

Recurrence is a core capability, used by classes, meetings, workouts, shifts and reading sessions alike.

- Supported: daily, weekly (chosen weekdays), monthly (by date or by "2nd Tuesday"), yearly, interval ("every 2 weeks"), and an end date or count.
- A series is **one event row** with an `rrule`. Occurrences are expanded on demand for the visible range and never stored as copies.
- Recurrence is expanded in the series' own IANA time zone, so "10:00 every Monday" stays at 10:00 local time.
- Edit scopes:
  - **This occurrence** writes an `event_exceptions` row, either cancelled or overridden (time, all-day dates, title, location, description or category).
  - **This and following** ends the original series the day before and creates a new series from the selected occurrence. Exceptions after the split move to the new series.
  - **All occurrences** updates the series row. If the time or rule changes, exceptions that no longer match an occurrence are removed, and the user is told how many.

### 4.5 Reminders

- Presets: 5, 15, 30 and 60 minutes before, plus a custom offset. Several reminders per event or task are allowed.
- Offsets are stored on the event or task (`reminder_offsets`). Concrete reminder rows are generated from them.
- All-day events and date-only tasks remind relative to a default time-of-day from notification preferences (for example 08:00).
- Default reminders for new events are a setting.
- Settings → Notifications turns on push for the current device and sends a test notification.
- Pipeline details are in §7.

### 4.6 Dashboard

The dashboard answers: **"What do I need to know and do today?"**

- Today's date, the next event with a countdown, and today's schedule.
- Tasks due today and overdue tasks, plus tasks completed today so a ticked-off task doesn't vanish.
- Quick-add for events and tasks.
- **Daily intention:** a one-line focus for the day plus an optional note, saved as you type to `daily_notes` (one row per day).
- **Today so far:** a completion summary showing tasks done out of today's plan (with a progress bar and the overdue count), events finished, and focus time blocked for tasks.
- **Free time** (off by default): gaps of 30 minutes or more between timed events, from now (or the "Day starts at" hour) until 22:00. Tapping one opens a new event in that slot.

The summary and free-time logic is pure and unit-tested (`features/dashboard/today.ts`).

Each section can be switched on or off in Settings → Today page. Keep it to these items. Add no more cards without a reason.

### 4.7 Categories and settings

- Categories (life areas) are user-defined, each with a name and color, and can be archived. On first sign-in the app seeds defaults: Work, Personal, Health, Family, Projects, Study.
- Settings is one page with a section list that follows the scroll:
  - **General:** name, appearance (System, Light or Dark, per device), and Install app.
  - **Date & time:** time zone (taken from the browser at sign-up), start of week, and time format (12- or 24-hour).
  - **View options:** default view, show weekends, show week numbers, day start hour, and default event duration.
  - **Notifications:** push on this device with a test notification, default event reminders, and the all-day reminder time.
  - **Categories:** add, rename, recolor, reorder and archive.
  - **Today page:** which dashboard sections show.
  - **Modules:** enable the Academic planner.
  - **Account:** email, change password, and sign out.
- Changes save as you make them, with a small saved/error toast.
- Preferences live on `profiles`: `calendar_prefs`, `notification_prefs`, `dashboard_prefs` and `enabled_modules` (§6). The theme is per device, in `localStorage`.

### 4.8 Academic Planner (optional module, planned for v0.3)

The module adds data; it never adds a second engine. The tables (`semesters`, `courses`, and `course_id` and `kind` on events and tasks) already exist; the UI does not.

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
- Manifest, icons and a hand-written service worker (`public/sw.js`):
  - pages are network-first, with the cached app shell used offline
  - built assets are cached
  - the worker handles push messages and notification clicks
- An **Install app** button in Settings uses Chrome's install prompt. The browser's own banner is suppressed on purpose, which is why the console logs "Banner not shown".
- **iPhone/iPad:** Web Push only works after the app is added to the Home Screen (iOS 16.4+). Android Chrome and desktop browsers work from the browser tab.
- Offline read access (cached recent range) is planned. Offline writes are out of scope until conflict rules are designed.

### 4.10 Landing page and sign-in

- **`/welcome`** is a public landing page with the product pitch, features, engineering notes and changelog. It follows light and dark mode.
- **Signed-out visits:**
  - to `/` in a browser → the landing page
  - to `/` in the installed app → straight to sign-in
  - to any other page → sign-in, then back to that page after signing in
- **`/sign-in`** has *Sign in* and *Create account* tabs. `?mode=sign-up` opens on the second tab.
  - Sign-up asks for the password twice and requires 8+ characters.
  - Supabase sends a confirmation email before the first sign-in.
  - A *Back to home* link returns to the landing page.

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

### Dark mode

`<html data-theme="light|dark">` switches the neutral tokens; components never change.

| Token          | Dark        |
| -------------- | ----------- |
| Background     | `#19181B` |
| Surface        | `#232126` |
| Text primary   | `#ECE8EA` |
| Text secondary | `#A9A4AC` |
| Border         | `#39363C` |

- The pastels don't change between themes. Text on them uses the `on-pastel` token, which is always dark.
- The preference (System, Light, Dark) is stored per device, and "System" follows the OS live.
- An inline script in `index.html` applies the theme before first paint, so there is no flash. `lib/theme.ts` then keeps it and the `theme-color` meta tag (the phone's status bar) in step.

### Rules

- Text on pastel pills is always **dark charcoal** (`on-pastel`), never white, in both themes. Check contrast with a tool.
- Never use color alone to show category or status. Add a label or icon.
- Keep visible keyboard focus rings and comfortable tap targets (about 44px minimum).
- Show clear empty, loading, error and confirmation states.

### Layout

- **Desktop:** a header (period title, Today, previous/next, view switcher); a sidebar (New event, New task, navigation and categories; a mini-calendar and module links are planned); the main view; and dialogs for editing.
- **Mobile:** a compact top bar, a bottom navigation (Today · Calendar · Tasks · Settings), and a floating quick-add button. Agenda and Day views are the default.

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

### Schema

The migrations in `server/supabase/migrations/` are the source of truth. This is a summary of them.

```sql
-- ---------- Profile & settings (one row per user) ----------
create table profiles (
  id                 uuid primary key references auth.users on delete cascade,
  display_name       text,
  timezone           text not null,                 -- IANA, set from browser at sign-up
  week_starts_on     smallint not null default 1 check (week_starts_on between 0 and 6),
  enabled_modules    text[] not null default '{}',  -- e.g. {'academic'}
  dashboard_prefs    jsonb not null default '{}',
  notification_prefs jsonb not null default '{}',   -- e.g. {"all_day_reminder_time":"08:00","default_event_reminders":[15]}
  calendar_prefs     jsonb not null default '{}',   -- e.g. {"default_view":"timeGridWeek","time_format":"24h"}
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
  new_start_date  date,                            -- moved all-day occurrence
  new_end_date    date,                            -- exclusive
  new_title       text,
  new_location    text,
  new_description text,
  new_category_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (num_nonnulls(original_start, original_date) = 1),
  check ((new_start_date is null) = (new_end_date is null)),
  foreign key (user_id, event_id) references events (user_id, id) on delete cascade,
  foreign key (user_id, new_category_id) references categories (user_id, id) on delete set null (new_category_id),
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

- `profiles` uses `id` instead of `user_id`, and clients can only select and update it. The `handle_new_user` trigger creates the row at sign-up from the `timezone` and `display_name` the client passes, and seeds the default categories.
- `reminders` is **select-only** for clients. Only server code using the service role inserts or updates it, through the `upsert_reminders` and `claim_due_reminders` functions.
- Table privileges are a second layer behind RLS: `anon` has none.

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
        └──► Edge Function `sync-reminders` (the app calls it after a save,
                 debounced, with the user's JWT)
                 expands next 14 days of occurrences × offsets
                 upsert_reminders(): insert by idempotency_key, reviving
                 pending/cancelled rows but never sent or failed ones

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

Cron reaches the Edge Functions through `invoke_edge_function()`, which reads the project URL and a secret API key from Vault. Both functions accept either a user JWT or that secret key. `send-reminders` called with a user JWT sends that user a test notification. The occurrence expansion lives in `functions/_shared/reminder-plan.ts`, a copy of the client's logic that is unit-tested from the client suite.

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
│   ├── public/            manifest.webmanifest, sw.js, favicon.svg, icons/
│   ├── src/
│   │   ├── app/           routes.tsx, providers.tsx
│   │   ├── components/    layout/ (AppShell, Header, Sidebar, BottomNav), ui/ (Dialog, Switch, Logo, icons…)
│   │   ├── features/
│   │   │   ├── auth/        # sign-in page, session, route guard, profile loader
│   │   │   ├── landing/     # public /welcome page
│   │   │   ├── calendar/  events/  tasks/  categories/
│   │   │   ├── recurrence/  # rules, expansion, exceptions, edit scopes
│   │   │   ├── reminders/   # reminder picker, push subscription, sync trigger
│   │   │   ├── dashboard/   # Today page
│   │   │   ├── settings/  pwa/
│   │   │   └── academic/    # empty until v0.3
│   │   ├── lib/           supabase.ts, dates.ts, validation.ts, theme.ts, use-now.ts
│   │   ├── types/         database.ts (generated from Supabase)
│   │   ├── styles/        index.css (tokens, dark theme, FullCalendar theming)
│   │   └── main.tsx
│   ├── tests/             unit/ (Vitest); e2e/ (empty, planned)
│   ├── vercel.json        SPA rewrite; no-cache for sw.js
│   └── .env.local         VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_VAPID_PUBLIC_KEY
├── server/                backend; run the Supabase CLI here
│   └── supabase/
│       ├── migrations/    core schema, calendar prefs, exception overrides, reminder pipeline
│       └── functions/     sync-reminders/, send-reminders/, _shared/reminder-plan.ts
└── README.md
```

- Frontend: `cd client && npm install && npm run dev`. Also `npm test`, `npm run lint` and `npm run build` (type-checks first).
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
   - Use the variable type **Config**, not Sensitive. Vercel warns about the `VITE_` prefix, but these values are public by design. Keep the prefix, because Vite only exposes `VITE_` variables. A variable's type can't be changed after saving, so delete it and add it again.
   - Paste the **whole** publishable key, starting with `sb_publishable_`. A truncated key makes every sign-in fail with `401 Invalid API key`.
   - Vite bakes these values in at build time. After changing one, **redeploy**.
5. **Auth URLs.** In Supabase Authentication → URL Configuration, set the Site URL to the Vercel URL. Add `https://<your-app>.vercel.app/**` and `http://localhost:5173/**` to Redirect URLs. Supabase's built-in email sender is rate-limited to a few emails an hour.
6. **On the phone.** Open the Vercel URL in Chrome (Android) or Safari (iPhone), sign in, then install: Settings → Install, or Chrome's ⋮ menu → *Add to home screen*. On iPhone use Share → *Add to Home Screen*. Open the installed app, go to Settings → Notifications → *Notifications on this device*, and send a test notification.

To check the pipeline: `select status, last_error, remind_at from reminders order by remind_at desc limit 20;` and the cron history in `cron.job_run_details`.

**Troubleshooting sign-in.** A `400 invalid_credentials` means a wrong email or password. Check for a stale browser-saved password on the deployed domain. There's no in-app password reset yet; set a new password in the SQL editor:

```sql
update auth.users set encrypted_password = extensions.crypt('<new password>', extensions.gen_salt('bf'))
where email = '<email>';
```

## 9. Releases

Each release should be **used daily** before the next one starts.

### v0.1: Core (usable daily): built, apart from the export procedure

- Scaffold Vite, React, TypeScript and Tailwind, plus the Sunset Cloud tokens.
- Supabase project and migrations for profiles, categories, tasks, subtasks, events, event_exceptions and daily_notes. RLS on all of them.
- Auth, the profile created at sign-up, and seeded categories.
- Day, Week, Month and Agenda views. Event CRUD, timed and all-day.
- Task CRUD with the Today, Upcoming, Overdue and Completed views.
- Recurrence (daily, weekly, monthly, end date) with the three edit scopes.
- Task time-blocking.
- A basic dashboard.
- Deployed. *(Done.)* A manual database export procedure (`supabase db dump` plus a data dump) documented and tried once. *(Not done.)*

**Done when:**

- [ ] I can manage my real week on phone and laptop.
- [ ] A second test account can't see or reference my data.
- [x] Recurrence unit tests pass.

### v0.2: Reminders and PWA: built

- Manifest, icons, service worker, and install flow (required for iOS push).
- Push subscription management and a VAPID setup.
- Reminder offsets in the UI, the `reminders` table, the cancel trigger, and the two Edge Functions with their cron schedules.

**Done when:**

- [ ] Notifications arrive on my actual phone and laptop with the app closed.
- [ ] Editing or deleting an event never produces a stale notification.
- [ ] A retried worker run never sends a duplicate.

### v0.3: Academic Planner: next

- Semesters, courses, class series, quizzes and exams, and assignments as tasks.
- A semester setup flow: add courses, then weekly class times, which generates the series.
- Clash warnings, plus enable, disable and archive.

**Done when:**

- [ ] My real timetable is in the app.
- [ ] A cancelled class and a moved class both display correctly.
- [ ] Disabling and re-enabling the module loses nothing.

> If a semester is in progress, v0.3 can come before v0.2.

### v0.4: Hardening: planned

- Offline read access for the recent range.
- JSON export and `.ics` export.
- An accessibility pass.
- Playwright end-to-end suite for the core flows.
- A backup **restore** test into a fresh project.

**Done when:**

- [ ] A restore from backup works.
- [ ] End-to-end tests run in CI.

## 10. Testing

**Unit (Vitest)**: `cd client && npm test` (81 tests)

- `recurrence.test.ts`: rule building and parsing, expansion, exceptions, the three edit scopes, and DST.
- `reminder-plan.test.ts`: reminder times, including all-day and date-only cases and the 14-day window.
- `task-views.test.ts`: which view a task belongs in, sorting and due labels.
- `timing.test.ts`: event timing and time-zone handling.
- `today.test.ts`: the Today page's free-time gaps and completion summary.
- `prefs.test.ts`: reading stored preferences safely.
- `validation.test.ts`: form validation.
- Planned: module enable/disable.

**Integration (local Supabase)**

- RLS: a second user can neither read nor reference the first user's rows.
- Event edit and delete cancel and regenerate reminders.
- Worker claiming is idempotent under concurrent runs.

**End-to-end (Playwright)**: planned for v0.4; Playwright is installed and `tests/e2e/` is empty

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
- Free-time-gap suggestions for time-blocking.
- `.ics` import.
- Natural-language quick-add.
- An in-app "Forgot password?" flow.
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

## 13. Next Steps

1. Finish v0.1: the database export procedure, tried once.
2. Check off the v0.2 "Done when" items on a real phone and laptop.
3. Build the Academic Planner (v0.3).
4. Harden (v0.4): offline reading, export, the accessibility pass, Playwright in CI, and a restore test.

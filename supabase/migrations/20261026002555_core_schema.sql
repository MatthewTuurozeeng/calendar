-- Core schema from README §6: tables, indexes, updated_at triggers, RLS,
-- and profile + default categories created at sign-up.

-- ---------- Shared updated_at trigger ----------
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------- Profile & settings (one row per user) ----------
create table public.profiles (
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
create table public.categories (
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
create table public.semesters (
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

create table public.courses (
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
  foreign key (user_id, semester_id) references public.semesters (user_id, id) on delete cascade,
  unique (user_id, id)
);

-- ---------- Tasks ----------
create table public.tasks (
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
  foreign key (user_id, category_id) references public.categories (user_id, id) on delete set null (category_id),
  foreign key (user_id, course_id)   references public.courses (user_id, id)    on delete cascade,
  unique (user_id, id)
);

create table public.task_subtasks (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users on delete cascade,
  task_id      uuid not null,
  title        text not null,
  is_completed boolean not null default false,
  position     int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (user_id, task_id) references public.tasks (user_id, id) on delete cascade
);

-- ---------- Events (one-off and recurring series) ----------
create table public.events (
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
  foreign key (user_id, category_id) references public.categories (user_id, id) on delete set null (category_id),
  foreign key (user_id, course_id)   references public.courses (user_id, id)    on delete cascade,
  foreign key (user_id, task_id)     references public.tasks (user_id, id)      on delete set null (task_id),
  unique (user_id, id)
);

-- One row per changed or cancelled occurrence of a series
create table public.event_exceptions (
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
  foreign key (user_id, event_id) references public.events (user_id, id) on delete cascade,
  unique (event_id, original_start),
  unique (event_id, original_date)
);

-- ---------- Daily notes / intention ----------
create table public.daily_notes (
  user_id    uuid not null references auth.users on delete cascade,
  note_date  date not null,
  intention  text,
  note       text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, note_date)
);

-- ---------- Reminders (generated rows, written by server only) ----------
create table public.reminders (
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
  foreign key (user_id, event_id) references public.events (user_id, id) on delete cascade,
  foreign key (user_id, task_id)  references public.tasks (user_id, id)  on delete cascade
);

-- ---------- Push subscriptions (one per device/browser) ----------
create table public.push_subscriptions (
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
create index events_user_start_idx    on public.events (user_id, start_at);
create index events_user_date_idx     on public.events (user_id, start_date);
create index events_user_series_idx   on public.events (user_id) where rrule is not null;
create index tasks_user_status_idx    on public.tasks (user_id, status, due_at);
create index tasks_user_due_date_idx  on public.tasks (user_id, due_date);
create index reminders_due_idx        on public.reminders (remind_at) where status = 'pending';
create index reminders_event_idx      on public.reminders (event_id) where status = 'pending';

-- Foreign-key lookups (keep cascades and "blocks for this task" queries off full scans)
create index courses_semester_idx     on public.courses (user_id, semester_id);
create index task_subtasks_task_idx   on public.task_subtasks (user_id, task_id);
create index events_task_idx          on public.events (user_id, task_id) where task_id is not null;
create index events_course_idx        on public.events (user_id, course_id) where course_id is not null;
create index tasks_course_idx         on public.tasks (user_id, course_id) where course_id is not null;
create index reminders_task_idx       on public.reminders (task_id) where status = 'pending';

-- ---------- updated_at triggers ----------
create trigger set_updated_at before update on public.profiles         for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.categories       for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.semesters        for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.courses          for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.tasks            for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.task_subtasks    for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.events           for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.event_exceptions for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.daily_notes      for each row execute function public.set_updated_at();
create trigger set_updated_at before update on public.reminders        for each row execute function public.set_updated_at();

-- ---------- Row-level security ----------
alter table public.profiles           enable row level security;
alter table public.categories         enable row level security;
alter table public.semesters          enable row level security;
alter table public.courses            enable row level security;
alter table public.tasks              enable row level security;
alter table public.task_subtasks      enable row level security;
alter table public.events             enable row level security;
alter table public.event_exceptions   enable row level security;
alter table public.daily_notes        enable row level security;
alter table public.reminders          enable row level security;
alter table public.push_subscriptions enable row level security;

-- profiles: keyed by id; the row is created by the sign-up trigger, so clients only read and update it
create policy own_profile_select on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));
create policy own_profile_update on public.profiles
  for update to authenticated
  using      (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy own_rows on public.categories
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy own_rows on public.semesters
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy own_rows on public.courses
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy own_rows on public.tasks
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy own_rows on public.task_subtasks
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy own_rows on public.events
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy own_rows on public.event_exceptions
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy own_rows on public.daily_notes
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy own_rows on public.push_subscriptions
  for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- reminders: select-only for clients; Edge Functions write with the service role
create policy own_rows_select on public.reminders
  for select to authenticated
  using (user_id = (select auth.uid()));

-- Table privileges as a second layer behind RLS: nothing for anon,
-- no client writes to reminders, no client insert/delete of profiles.
revoke all on all tables in schema public from anon;
revoke insert, update, delete on public.reminders from authenticated;
revoke insert, delete on public.profiles from authenticated;

-- ---------- Profile + default categories at sign-up ----------
-- The client passes { timezone, display_name } in options.data on signUp.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  tz text := new.raw_user_meta_data ->> 'timezone';
begin
  if tz is null or not exists (select 1 from pg_catalog.pg_timezone_names where name = tz) then
    tz := 'UTC';
  end if;

  insert into public.profiles (id, display_name, timezone)
  values (new.id, new.raw_user_meta_data ->> 'display_name', tz);

  insert into public.categories (user_id, name, color, position) values
    (new.id, 'Work',     '#ACAEC5', 0),
    (new.id, 'Personal', '#E2BAB1', 1),
    (new.id, 'Health',   '#DDA6B9', 2),
    (new.id, 'Family',   '#EFA18A', 3),
    (new.id, 'Projects', '#F08D7E', 4),
    (new.id, 'Study',    '#ACAEC5', 5);

  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

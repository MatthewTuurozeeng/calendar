-- Reminder pipeline (README §7): cancel trigger, server-only upsert and claim
-- functions, and the cron jobs that call the two Edge Functions.

-- ---------- Cancel pending reminders when their source changes ----------
-- Runs inside the write, so a stale reminder can never fire even if
-- sync-reminders fails afterwards. sync-reminders revives the ones that still apply.
create function public.cancel_pending_reminders()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_table_name = 'tasks' then
    update public.reminders set status = 'cancelled'
    where task_id = old.id and status = 'pending';
  elsif tg_table_name = 'events' then
    update public.reminders set status = 'cancelled'
    where event_id = old.id and status = 'pending';
  else
    -- event_exceptions: the series it belongs to, before and after (a split moves exceptions)
    update public.reminders set status = 'cancelled'
    where status = 'pending'
      and event_id in (
        case when tg_op <> 'INSERT' then old.event_id end,
        case when tg_op <> 'DELETE' then new.event_id end
      );
  end if;
  return null;
end;
$$;

revoke execute on function public.cancel_pending_reminders() from public, anon, authenticated;

-- Deletes need no trigger: pending reminders cascade with their event or task.
create trigger cancel_reminders after update on public.events
  for each row execute function public.cancel_pending_reminders();
create trigger cancel_reminders after update on public.tasks
  for each row execute function public.cancel_pending_reminders();
create trigger cancel_reminders after insert or update or delete on public.event_exceptions
  for each row execute function public.cancel_pending_reminders();

-- ---------- Upsert generated reminders (sync-reminders) ----------
-- Idempotent by idempotency_key. Revives pending and cancelled rows, but never
-- touches a reminder that was sent or failed, so nothing is sent twice.
create function public.upsert_reminders(reminder_rows jsonb)
returns integer
language sql
security definer
set search_path = ''
as $$
  with written as (
    insert into public.reminders
      (user_id, event_id, task_id, occurrence_start, offset_minutes, remind_at, idempotency_key)
    select r.user_id, r.event_id, r.task_id, r.occurrence_start, r.offset_minutes, r.remind_at, r.idempotency_key
    from jsonb_to_recordset(reminder_rows) as r(
      user_id uuid, event_id uuid, task_id uuid, occurrence_start timestamptz,
      offset_minutes int, remind_at timestamptz, idempotency_key text
    )
    on conflict (idempotency_key) do update
      set status = 'pending',
          remind_at = excluded.remind_at,
          attempt_count = 0,
          locked_at = null,
          last_error = null
      where public.reminders.status in ('pending', 'cancelled')
    returning 1
  )
  select count(*)::int from written;
$$;

-- ---------- Claim due reminders (send-reminders) ----------
create function public.claim_due_reminders(batch_size integer default 50)
returns setof public.reminders
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Rows stuck in 'processing' (a run that died) go back to the queue.
  update public.reminders set status = 'pending', locked_at = null
  where status = 'processing' and locked_at < now() - interval '5 minutes';

  -- More than an hour late is too stale to be useful.
  update public.reminders set status = 'failed', last_error = 'stale'
  where status = 'pending' and remind_at < now() - interval '60 minutes';

  -- SKIP LOCKED lets overlapping runs claim different rows, never the same one.
  return query
  update public.reminders
  set status = 'processing', locked_at = now(), attempt_count = attempt_count + 1
  where id in (
    select id from public.reminders
    where status = 'pending' and remind_at <= now()
    order by remind_at
    limit batch_size
    for update skip locked
  )
  returning *;
end;
$$;

revoke execute on function public.upsert_reminders(jsonb) from public, anon, authenticated;
revoke execute on function public.claim_due_reminders(integer) from public, anon, authenticated;
grant execute on function public.upsert_reminders(jsonb) to service_role;
grant execute on function public.claim_due_reminders(integer) to service_role;

-- ---------- Cron: call the Edge Functions ----------
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- Reads the project URL and a secret API key from Vault, so neither is in the
-- repo. Create both once per project (see README "Reminders and install setup").
create function public.invoke_edge_function(function_name text)
returns bigint
language sql
security definer
set search_path = ''
as $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url')
           || '/functions/v1/' || function_name,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'edge_functions_secret_key')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
$$;

revoke execute on function public.invoke_edge_function(text) from public, anon, authenticated;

select cron.schedule('send-reminders', '* * * * *', $$select public.invoke_edge_function('send-reminders')$$);
-- Hourly, to roll the 14-day reminder window forward for every series.
select cron.schedule('sync-reminders', '7 * * * *', $$select public.invoke_edge_function('sync-reminders')$$);

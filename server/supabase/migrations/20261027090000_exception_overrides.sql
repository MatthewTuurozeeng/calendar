-- Let a single occurrence of a series move to other dates (all-day events)
-- and change category. Null override columns inherit from the series.
alter table public.event_exceptions
  add column new_start_date  date,
  add column new_end_date    date,                -- exclusive, like events.end_date
  add column new_category_id uuid,
  add constraint event_exceptions_new_dates_check
    check ((new_start_date is null) = (new_end_date is null)
           and (new_end_date is null or new_end_date > new_start_date)),
  add constraint event_exceptions_new_category_fkey
    foreign key (user_id, new_category_id) references public.categories (user_id, id)
    on delete set null (new_category_id);

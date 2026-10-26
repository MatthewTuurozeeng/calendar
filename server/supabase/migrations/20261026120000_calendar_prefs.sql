-- Calendar display preferences edited on the settings page, e.g.
-- {"default_view":"timeGridWeek","time_format":"24h","show_weekends":false}.
-- Missing keys fall back to client defaults.
alter table public.profiles
  add column calendar_prefs jsonb not null default '{}';

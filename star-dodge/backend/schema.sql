-- Review and apply in your Supabase project. No paid currency lives here.
create table if not exists public.pilot_backups (
 user_id uuid primary key references auth.users(id) on delete cascade,
 progress jsonb not null check (coalesce(jsonb_typeof(progress) = 'object' and progress->>'version' = '1' and jsonb_typeof(progress->'pilot') = 'object' and octet_length(progress::text) < 65536, false)),
 updated_at timestamptz not null default now()
);
alter table public.pilot_backups enable row level security;
revoke all on table public.pilot_backups from anon, authenticated;
grant select, insert, update, delete on table public.pilot_backups to authenticated;
drop policy if exists "pilots_own_backups" on public.pilot_backups;
create policy "pilots_own_backups" on public.pilot_backups for all to authenticated
 using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create or replace function public.touch_pilot_backup() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at = now(); return new; end;
$$;
drop trigger if exists pilot_backup_updated on public.pilot_backups;
create trigger pilot_backup_updated before update on public.pilot_backups
 for each row execute function public.touch_pilot_backup();

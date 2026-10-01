-- RedWave security hardening
-- This migration has already been applied to the connected Supabase project.
-- It prevents authenticated listeners from changing their own profile role.

revoke update on table public.profiles from authenticated;
grant update (name, avatar_url) on table public.profiles to authenticated;

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
on public.profiles
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

alter table public.profiles enable row level security;
alter table public.songs enable row level security;
alter table public.likes enable row level security;

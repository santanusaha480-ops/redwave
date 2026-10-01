-- RedWave security hardening v2
-- Least-privilege grants + RLS defense in depth.

alter table public.profiles enable row level security;
alter table public.songs enable row level security;
alter table public.likes enable row level security;

-- Users may edit only profile fields exposed by the app, never role/id/created_at.
revoke all on table public.profiles from anon;
revoke insert, delete, truncate, references, trigger on table public.profiles from authenticated;
grant select on table public.profiles to authenticated;
grant update (name, avatar_url) on table public.profiles to authenticated;

-- Public catalog is read-only for listeners; only admins can write songs via RLS.
revoke insert, update, delete, truncate, references, trigger on table public.songs from anon;
grant select on table public.songs to anon, authenticated;
grant insert, update, delete on table public.songs to authenticated;

-- Likes are private to the signed-in owner.
revoke all on table public.likes from anon;
grant select, insert, update, delete on table public.likes to authenticated;

-- Defense-in-depth policies.
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select to authenticated
using ((select auth.uid()) = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

drop policy if exists songs_public_read on public.songs;
create policy songs_public_read on public.songs for select to anon, authenticated
using (true);

drop policy if exists songs_admin_insert on public.songs;
create policy songs_admin_insert on public.songs for insert to authenticated
with check (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));

drop policy if exists songs_admin_update on public.songs;
create policy songs_admin_update on public.songs for update to authenticated
using (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'))
with check (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));

drop policy if exists songs_admin_delete on public.songs;
create policy songs_admin_delete on public.songs for delete to authenticated
using (exists (select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='admin'));

drop policy if exists likes_own_all on public.likes;
create policy likes_own_all on public.likes for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- Indexes used by authorization checks.
create index if not exists likes_user_id_idx on public.likes(user_id);
create index if not exists songs_created_by_idx on public.songs(created_by);

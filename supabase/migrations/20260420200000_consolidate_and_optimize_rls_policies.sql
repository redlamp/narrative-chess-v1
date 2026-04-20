-- Consolidate duplicate permissive SELECT policies and wrap auth.uid() in
-- (select auth.uid()) so RLS initplans evaluate once per query rather than
-- once per row. See the Supabase RLS performance lints:
--   0003_auth_rls_initplan
--   0006_multiple_permissive_policies

-- profiles: drop the narrower self-only SELECT; the broader authenticated
-- policy already covers it.
drop policy if exists "users can read their own profile" on public.profiles;

-- city_versions: split the overlapping authenticated SELECTs into a single
-- combined policy, keep an anon-only policy for published rows.
drop policy if exists "authors can read all city versions" on public.city_versions;
drop policy if exists "public can read published city versions" on public.city_versions;

create policy "anon can read published city versions"
  on public.city_versions
  for select
  to anon
  using (status = 'published');

create policy "authenticated can read published or authored city versions"
  on public.city_versions
  for select
  to authenticated
  using (status = 'published' or public.has_app_role('author'));

-- user_roles: merge self + admin SELECTs into one policy.
drop policy if exists "users can read own role" on public.user_roles;
drop policy if exists "admins can read all user roles" on public.user_roles;

create policy "users can read own role or admins can read all"
  on public.user_roles
  for select
  to authenticated
  using ((select auth.uid()) = user_id or public.has_app_role('admin'));

-- user_layout_bundles: rewrite policies to use (select auth.uid()).
drop policy if exists "users can read their own layout bundles" on public.user_layout_bundles;
drop policy if exists "users can insert their own layout bundles" on public.user_layout_bundles;
drop policy if exists "users can update their own layout bundles" on public.user_layout_bundles;

create policy "users can read their own layout bundles"
  on public.user_layout_bundles
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "users can insert their own layout bundles"
  on public.user_layout_bundles
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "users can update their own layout bundles"
  on public.user_layout_bundles
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- user_saved_matches: rewrite policies to use (select auth.uid()).
drop policy if exists "users can read their own saved matches" on public.user_saved_matches;
drop policy if exists "users can insert their own saved matches" on public.user_saved_matches;
drop policy if exists "users can update their own saved matches" on public.user_saved_matches;
drop policy if exists "users can delete their own saved matches" on public.user_saved_matches;

create policy "users can read their own saved matches"
  on public.user_saved_matches
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "users can insert their own saved matches"
  on public.user_saved_matches
  for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "users can update their own saved matches"
  on public.user_saved_matches
  for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "users can delete their own saved matches"
  on public.user_saved_matches
  for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- game_threads / game_participants: rewrite to use (select auth.uid()).
drop policy if exists "participants can read their game threads" on public.game_threads;
drop policy if exists "participants can read their game participants" on public.game_participants;

create policy "participants can read their game threads"
  on public.game_threads
  for select
  to authenticated
  using (created_by = (select auth.uid()) or public.is_game_participant(id));

create policy "participants can read their game participants"
  on public.game_participants
  for select
  to authenticated
  using (user_id = (select auth.uid()) or public.is_game_participant(game_id));

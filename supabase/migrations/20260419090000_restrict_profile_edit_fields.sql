drop policy if exists "users can insert their own profile" on public.profiles;
drop policy if exists "users can update their own profile" on public.profiles;

revoke insert, update, delete on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;

create or replace function public.upsert_current_profile(
  p_username text,
  p_display_name text default null
)
returns table (
  user_id uuid,
  username text,
  display_name text,
  elo_rating integer
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_username text := lower(trim(p_username));
  v_display_name text := nullif(trim(coalesce(p_display_name, '')), '');
begin
  if v_user_id is null then
    raise exception 'Sign in to update your profile.';
  end if;

  if v_username !~ '^[a-z0-9_]{3,24}$' then
    raise exception 'Username must be 3-24 chars using lowercase letters, numbers, or underscores.';
  end if;

  return query
  insert into public.profiles (
    user_id,
    username,
    display_name
  )
  values (
    v_user_id,
    v_username,
    v_display_name
  )
  on conflict (user_id) do update
  set
    username = excluded.username,
    display_name = excluded.display_name
  returning
    profiles.user_id,
    profiles.username,
    profiles.display_name,
    profiles.elo_rating;
end;
$$;

revoke all on function public.upsert_current_profile(text, text) from public;
grant execute on function public.upsert_current_profile(text, text) to authenticated;

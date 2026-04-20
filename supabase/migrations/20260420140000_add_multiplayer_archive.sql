alter table public.game_participants
  add column if not exists archived_at timestamptz;

create index if not exists game_participants_user_archived_idx
  on public.game_participants (user_id, archived_at)
  where archived_at is not null;

create or replace function public.archive_game(
  p_game_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_participant_id uuid;
  v_thread_status text;
begin
  if v_user_id is null then
    raise exception 'Sign in to archive multiplayer games.';
  end if;

  select gp.id, gt.status
    into v_participant_id, v_thread_status
  from public.game_participants gp
  join public.game_threads gt
    on gt.id = gp.game_id
  where gp.game_id = p_game_id
    and gp.user_id = v_user_id
  for update of gp;

  if v_participant_id is null then
    raise exception 'That multiplayer game is not available for this account.';
  end if;

  if v_thread_status not in ('completed', 'cancelled', 'abandoned') then
    raise exception 'Only finished multiplayer games can be archived.';
  end if;

  update public.game_participants
  set archived_at = now()
  where id = v_participant_id;
end;
$$;

create or replace function public.unarchive_game(
  p_game_id uuid
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_participant_id uuid;
begin
  if v_user_id is null then
    raise exception 'Sign in to unarchive multiplayer games.';
  end if;

  select gp.id
    into v_participant_id
  from public.game_participants gp
  where gp.game_id = p_game_id
    and gp.user_id = v_user_id
  for update of gp;

  if v_participant_id is null then
    raise exception 'That multiplayer game is not available for this account.';
  end if;

  update public.game_participants
  set archived_at = null
  where id = v_participant_id;
end;
$$;

revoke all on function public.archive_game(uuid) from public;
grant execute on function public.archive_game(uuid) to authenticated;

revoke all on function public.unarchive_game(uuid) from public;
grant execute on function public.unarchive_game(uuid) to authenticated;

drop function if exists public.list_active_games();
drop function if exists public.list_active_games(boolean);

create or replace function public.list_active_games(
  p_include_archived boolean default false
)
returns table (
  game_id uuid,
  status text,
  time_control_kind text,
  base_seconds integer,
  increment_seconds integer,
  move_deadline_seconds integer,
  deadline_at timestamptz,
  white_seconds_remaining integer,
  black_seconds_remaining integer,
  turn_started_at timestamptz,
  rated boolean,
  result text,
  white_rating_delta integer,
  black_rating_delta integer,
  city_edition_id text,
  city_label text,
  created_at timestamptz,
  updated_at timestamptz,
  last_move_at timestamptz,
  current_turn text,
  your_side text,
  your_participant_status text,
  archived_at timestamptz,
  opponent_user_id uuid,
  opponent_username text,
  opponent_display_name text,
  opponent_elo_rating integer,
  opponent_participant_status text,
  is_open_game boolean,
  can_join_open_game boolean,
  is_your_turn boolean,
  is_incoming_invite boolean,
  is_outgoing_invite boolean,
  is_timed_out boolean,
  can_claim_timeout boolean
)
language sql
stable
security definer
set search_path = public, auth
as $$
  with me as (
    select auth.uid() as user_id
  ),
  rows as (
    select
      gt.id as game_id,
      gt.status,
      gt.time_control_kind,
      gt.base_seconds,
      gt.increment_seconds,
      gt.move_deadline_seconds,
      gt.deadline_at,
      gt.white_seconds_remaining,
      gt.black_seconds_remaining,
      gt.turn_started_at,
      gt.rated,
      gt.result,
      gt.white_rating_delta,
      gt.black_rating_delta,
      gt.city_edition_id,
      ce.label as city_label,
      gt.created_at,
      gt.updated_at,
      gt.last_move_at,
      gt.current_turn,
      self_gp.side as your_side,
      self_gp.participant_status as your_participant_status,
      self_gp.archived_at as archived_at,
      opponent_gp.user_id as opponent_user_id,
      opponent_profile.username as opponent_username,
      opponent_profile.display_name as opponent_display_name,
      coalesce(opponent_profile.elo_rating, 1200) as opponent_elo_rating,
      opponent_gp.participant_status as opponent_participant_status,
      gt.is_open as is_open_game,
      false as can_join_open_game,
      (
        gt.status = 'active'
        and self_gp.participant_status = 'active'
        and gt.current_turn = self_gp.side
      ) as is_your_turn,
      (
        gt.status = 'invited'
        and self_gp.participant_status = 'invited'
        and gt.created_by <> me.user_id
      ) as is_incoming_invite,
      (
        gt.status = 'invited'
        and gt.created_by = me.user_id
      ) as is_outgoing_invite,
      (
        gt.status = 'active'
        and gt.current_turn is not null
        and gt.deadline_at is not null
        and gt.deadline_at <= now()
      ) as is_timed_out,
      (
        gt.status = 'active'
        and self_gp.participant_status = 'active'
        and self_gp.side in ('white', 'black')
        and gt.current_turn is not null
        and gt.current_turn <> self_gp.side
        and gt.deadline_at is not null
        and gt.deadline_at <= now()
      ) as can_claim_timeout,
      case
        when gt.status = 'invited' and self_gp.participant_status = 'invited' and gt.created_by <> me.user_id then 0
        when gt.status = 'active' and gt.current_turn = self_gp.side then 1
        when gt.status = 'active' then 2
        when gt.status = 'invited' then 4
        when gt.status = 'completed' then 5
        else 6
      end as sort_bucket
    from me
    join public.game_participants self_gp
      on self_gp.user_id = me.user_id
     and self_gp.participant_status in ('invited', 'active')
    join public.game_threads gt
      on gt.id = self_gp.game_id
     and gt.status in ('invited', 'active', 'completed')
    left join public.game_participants opponent_gp
      on opponent_gp.game_id = gt.id
     and opponent_gp.user_id <> me.user_id
     and opponent_gp.side in ('white', 'black')
    left join public.profiles opponent_profile
      on opponent_profile.user_id = opponent_gp.user_id
    left join public.city_editions ce
      on ce.id = gt.city_edition_id
    where p_include_archived or self_gp.archived_at is null

    union all

    select
      gt.id as game_id,
      gt.status,
      gt.time_control_kind,
      gt.base_seconds,
      gt.increment_seconds,
      gt.move_deadline_seconds,
      gt.deadline_at,
      gt.white_seconds_remaining,
      gt.black_seconds_remaining,
      gt.turn_started_at,
      gt.rated,
      gt.result,
      gt.white_rating_delta,
      gt.black_rating_delta,
      gt.city_edition_id,
      ce.label as city_label,
      gt.created_at,
      gt.updated_at,
      gt.last_move_at,
      gt.current_turn,
      'spectator'::text as your_side,
      'invited'::text as your_participant_status,
      null::timestamptz as archived_at,
      gt.created_by as opponent_user_id,
      creator_profile.username as opponent_username,
      creator_profile.display_name as opponent_display_name,
      coalesce(creator_profile.elo_rating, 1200) as opponent_elo_rating,
      'active'::text as opponent_participant_status,
      true as is_open_game,
      true as can_join_open_game,
      false as is_your_turn,
      false as is_incoming_invite,
      false as is_outgoing_invite,
      false as is_timed_out,
      false as can_claim_timeout,
      3 as sort_bucket
    from me
    join public.game_threads gt
      on gt.status = 'invited'
     and gt.is_open = true
     and gt.created_by <> me.user_id
    join public.game_participants creator_gp
      on creator_gp.game_id = gt.id
     and creator_gp.user_id = gt.created_by
     and creator_gp.participant_status = 'active'
     and creator_gp.side in ('white', 'black')
    left join public.profiles creator_profile
      on creator_profile.user_id = gt.created_by
    left join public.city_editions ce
      on ce.id = gt.city_edition_id
    where not exists (
      select 1
      from public.game_participants gp
      where gp.game_id = gt.id
        and gp.user_id = me.user_id
    )
  )
  select
    rows.game_id,
    rows.status,
    rows.time_control_kind,
    rows.base_seconds,
    rows.increment_seconds,
    rows.move_deadline_seconds,
    rows.deadline_at,
    rows.white_seconds_remaining,
    rows.black_seconds_remaining,
    rows.turn_started_at,
    rows.rated,
    rows.result,
    rows.white_rating_delta,
    rows.black_rating_delta,
    rows.city_edition_id,
    rows.city_label,
    rows.created_at,
    rows.updated_at,
    rows.last_move_at,
    rows.current_turn,
    rows.your_side,
    rows.your_participant_status,
    rows.archived_at,
    rows.opponent_user_id,
    rows.opponent_username,
    rows.opponent_display_name,
    rows.opponent_elo_rating,
    rows.opponent_participant_status,
    rows.is_open_game,
    rows.can_join_open_game,
    rows.is_your_turn,
    rows.is_incoming_invite,
    rows.is_outgoing_invite,
    rows.is_timed_out,
    rows.can_claim_timeout
  from rows
  order by
    case when rows.archived_at is not null then 1 else 0 end,
    case when rows.can_claim_timeout then 0 else 1 end,
    rows.sort_bucket,
    case when rows.status = 'completed' then coalesce(rows.last_move_at, rows.updated_at, rows.created_at) end desc nulls last,
    coalesce(rows.deadline_at, rows.last_move_at, rows.updated_at, rows.created_at) asc nulls last,
    rows.updated_at desc;
$$;

revoke all on function public.list_active_games(boolean) from public;
grant execute on function public.list_active_games(boolean) to authenticated;

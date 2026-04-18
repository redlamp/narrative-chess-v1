drop function if exists public.create_game_invite(text, text, text, integer, integer, integer, boolean);

create or replace function public.create_game_invite(
  p_opponent_username text,
  p_city_edition_id text default null,
  p_time_control_kind text default 'move_deadline',
  p_base_seconds integer default null,
  p_increment_seconds integer default 0,
  p_move_deadline_seconds integer default 86400,
  p_rated boolean default false,
  p_creator_side text default 'white'
)
returns table (
  game_id uuid,
  status text,
  time_control_kind text,
  rated boolean,
  city_edition_id text
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_creator_username text;
  v_opponent_user_id uuid;
  v_game_id uuid;
  v_creator_side text := lower(trim(p_creator_side));
  v_opponent_side text;
  v_start_fen constant text := 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
begin
  if v_user_id is null then
    raise exception 'Sign in to create a multiplayer game.';
  end if;

  if v_creator_side not in ('white', 'black') then
    raise exception 'Creator side must be white or black.';
  end if;

  v_opponent_side := case when v_creator_side = 'white' then 'black' else 'white' end;

  if p_time_control_kind not in ('live_clock', 'move_deadline') then
    raise exception 'Time control must be live_clock or move_deadline.';
  end if;

  if p_time_control_kind = 'live_clock' and (p_base_seconds is null or p_base_seconds <= 0 or p_increment_seconds < 0) then
    raise exception 'Live clock games need positive base seconds and non-negative increment seconds.';
  end if;

  if p_time_control_kind = 'move_deadline' and (p_move_deadline_seconds is null or p_move_deadline_seconds <= 0) then
    raise exception 'Correspondence games need a move deadline.';
  end if;

  select pr.username
    into v_creator_username
  from public.profiles pr
  where pr.user_id = v_user_id;

  if v_creator_username is null then
    raise exception 'Claim a username before creating multiplayer games.';
  end if;

  select pr.user_id
    into v_opponent_user_id
  from public.profiles pr
  where pr.username = lower(trim(p_opponent_username));

  if v_opponent_user_id is null then
    raise exception 'No player found for that username.';
  end if;

  if v_opponent_user_id = v_user_id then
    raise exception 'You cannot invite yourself.';
  end if;

  if p_city_edition_id is not null
    and not exists (
      select 1
      from public.city_versions cv
      where cv.city_edition_id = p_city_edition_id
        and cv.status = 'published'
    ) then
    raise exception 'Choose a published city edition for multiplayer.';
  end if;

  insert into public.game_threads (
    created_by,
    city_edition_id,
    status,
    play_mode,
    time_control_kind,
    base_seconds,
    increment_seconds,
    move_deadline_seconds,
    deadline_at,
    rated,
    current_turn,
    current_fen
  )
  values (
    v_user_id,
    p_city_edition_id,
    'invited',
    case when p_time_control_kind = 'live_clock' then 'sync' else 'async' end,
    p_time_control_kind,
    case when p_time_control_kind = 'live_clock' then p_base_seconds else null end,
    case when p_time_control_kind = 'live_clock' then p_increment_seconds else 0 end,
    case when p_time_control_kind = 'move_deadline' then p_move_deadline_seconds else null end,
    null,
    p_rated,
    'white',
    v_start_fen
  )
  returning id into v_game_id;

  insert into public.game_participants (game_id, user_id, side, participant_status)
  values
    (v_game_id, v_user_id, v_creator_side, 'active'),
    (v_game_id, v_opponent_user_id, v_opponent_side, 'invited');

  return query
  select
    gt.id,
    gt.status,
    gt.time_control_kind,
    gt.rated,
    gt.city_edition_id
  from public.game_threads gt
  where gt.id = v_game_id;
end;
$$;

revoke all on function public.create_game_invite(text, text, text, integer, integer, integer, boolean, text) from public;
grant execute on function public.create_game_invite(text, text, text, integer, integer, integer, boolean, text) to authenticated;

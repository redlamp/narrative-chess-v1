alter table public.game_threads
  add column if not exists white_seconds_remaining integer,
  add column if not exists black_seconds_remaining integer,
  add column if not exists turn_started_at timestamptz;

update public.game_threads
set
  white_seconds_remaining = coalesce(white_seconds_remaining, base_seconds),
  black_seconds_remaining = coalesce(black_seconds_remaining, base_seconds)
where time_control_kind = 'live_clock';

alter table public.game_threads
  drop constraint if exists game_threads_live_clock_remaining_check;

alter table public.game_threads
  add constraint game_threads_live_clock_remaining_check
  check (
    time_control_kind <> 'live_clock'
    or (
      white_seconds_remaining is not null
      and black_seconds_remaining is not null
      and white_seconds_remaining >= 0
      and black_seconds_remaining >= 0
    )
  );

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

  if v_creator_side not in ('white', 'black', 'random') then
    raise exception 'Creator side must be white, black, or random.';
  end if;

  if v_creator_side = 'random' then
    v_creator_side := case when random() < 0.5 then 'white' else 'black' end;
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
    white_seconds_remaining,
    black_seconds_remaining,
    turn_started_at,
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
    case when p_time_control_kind = 'live_clock' then p_base_seconds else null end,
    case when p_time_control_kind = 'live_clock' then p_base_seconds else null end,
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

create or replace function public.respond_to_game_invite(
  p_game_id uuid,
  p_response text
)
returns table (
  game_id uuid,
  status text,
  participant_status text
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_thread_status text;
  v_participant_status text;
  v_time_control_kind text;
  v_move_deadline_seconds integer;
  v_white_seconds_remaining integer;
begin
  if v_user_id is null then
    raise exception 'Sign in to respond to multiplayer invites.';
  end if;

  if p_response not in ('accept', 'decline') then
    raise exception 'Invite response must be accept or decline.';
  end if;

  select
    gt.status,
    gp.participant_status,
    gt.time_control_kind,
    gt.move_deadline_seconds,
    gt.white_seconds_remaining
    into
      v_thread_status,
      v_participant_status,
      v_time_control_kind,
      v_move_deadline_seconds,
      v_white_seconds_remaining
  from public.game_threads gt
  join public.game_participants gp
    on gp.game_id = gt.id
  where gt.id = p_game_id
    and gp.user_id = v_user_id
  for update of gt, gp;

  if v_thread_status is null then
    raise exception 'That multiplayer invite is not available.';
  end if;

  if v_thread_status <> 'invited' or v_participant_status <> 'invited' then
    raise exception 'That multiplayer invite has already been resolved.';
  end if;

  if p_response = 'accept' then
    update public.game_participants
    set participant_status = 'active'
    where game_id = p_game_id
      and user_id = v_user_id;

    update public.game_threads
    set
      status = 'active',
      turn_started_at = now(),
      deadline_at = case
        when v_time_control_kind = 'move_deadline' then now() + make_interval(secs => v_move_deadline_seconds)
        when v_time_control_kind = 'live_clock' then now() + make_interval(secs => v_white_seconds_remaining)
        else null
      end
    where id = p_game_id;

    return query
    select gt.id, gt.status, gp.participant_status
    from public.game_threads gt
    join public.game_participants gp
      on gp.game_id = gt.id
    where gt.id = p_game_id
      and gp.user_id = v_user_id;
    return;
  end if;

  update public.game_participants
  set participant_status = 'declined'
  where game_id = p_game_id
    and user_id = v_user_id;

  update public.game_threads
  set
    status = 'cancelled',
    result = 'cancelled',
    completed_at = now(),
    current_turn = null,
    deadline_at = null,
    turn_started_at = null
  where id = p_game_id;

  return query
  select gt.id, gt.status, gp.participant_status
  from public.game_threads gt
  join public.game_participants gp
    on gp.game_id = gt.id
  where gt.id = p_game_id
    and gp.user_id = v_user_id;
end;
$$;

drop function if exists public.list_active_games();

create or replace function public.list_active_games()
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
  opponent_user_id uuid,
  opponent_username text,
  opponent_display_name text,
  opponent_elo_rating integer,
  opponent_participant_status text,
  is_your_turn boolean,
  is_incoming_invite boolean,
  is_outgoing_invite boolean
)
language sql
stable
security definer
set search_path = public, auth
as $$
  with me as (
    select auth.uid() as user_id
  )
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
    opponent_gp.user_id as opponent_user_id,
    opponent_profile.username as opponent_username,
    opponent_profile.display_name as opponent_display_name,
    coalesce(opponent_profile.elo_rating, 1200) as opponent_elo_rating,
    opponent_gp.participant_status as opponent_participant_status,
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
    ) as is_outgoing_invite
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
  order by
    case
      when gt.status = 'invited' and self_gp.participant_status = 'invited' and gt.created_by <> me.user_id then 0
      when gt.status = 'active' and gt.current_turn = self_gp.side then 1
      when gt.status = 'active' then 2
      when gt.status = 'invited' then 3
      when gt.status = 'completed' then 4
      else 5
    end,
    case when gt.status = 'completed' then coalesce(gt.last_move_at, gt.updated_at, gt.created_at) end desc nulls last,
    coalesce(gt.deadline_at, gt.last_move_at, gt.updated_at, gt.created_at) asc nulls last,
    gt.updated_at desc;
$$;

drop function if exists public.append_game_move(uuid, text, text, text, text, text, jsonb, boolean, boolean);

create or replace function public.append_game_move(
  p_game_id uuid,
  p_from_square text,
  p_to_square text,
  p_promotion text default null,
  p_san text default null,
  p_fen_after text default null,
  p_snapshot_payload jsonb default null,
  p_is_checkmate boolean default false,
  p_is_stalemate boolean default false
)
returns table (
  game_id uuid,
  next_ply_number integer,
  status text,
  current_turn text,
  deadline_at timestamptz,
  result text,
  white_rating_delta integer,
  black_rating_delta integer
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
  v_side text;
  v_thread_status text;
  v_current_turn text;
  v_time_control_kind text;
  v_base_seconds integer;
  v_increment_seconds integer;
  v_move_deadline_seconds integer;
  v_turn_started_at timestamptz;
  v_white_seconds_remaining integer;
  v_black_seconds_remaining integer;
  v_next_white_seconds_remaining integer;
  v_next_black_seconds_remaining integer;
  v_elapsed_seconds integer;
  v_active_remaining_after_elapsed integer;
  v_is_rated boolean;
  v_rating_applied_at timestamptz;
  v_next_ply integer;
  v_next_turn text;
  v_next_status text;
  v_next_deadline timestamptz;
  v_result text;
  v_white_user_id uuid;
  v_black_user_id uuid;
  v_white_rating integer;
  v_black_rating integer;
  v_white_score numeric;
  v_black_score numeric;
  v_white_delta integer := null;
  v_black_delta integer := null;
begin
  if v_user_id is null then
    raise exception 'Sign in to sync multiplayer moves.';
  end if;

  if p_from_square !~ '^[a-h][1-8]$' or p_to_square !~ '^[a-h][1-8]$' then
    raise exception 'Move squares must be valid algebraic coordinates.';
  end if;

  if p_promotion is not null and p_promotion not in ('q', 'r', 'b', 'n') then
    raise exception 'Promotion must be q, r, b, or n.';
  end if;

  select
    gp.side,
    gt.status,
    gt.current_turn,
    gt.time_control_kind,
    gt.base_seconds,
    gt.increment_seconds,
    gt.move_deadline_seconds,
    gt.turn_started_at,
    gt.white_seconds_remaining,
    gt.black_seconds_remaining,
    gt.rated,
    gt.rating_applied_at
    into
      v_side,
      v_thread_status,
      v_current_turn,
      v_time_control_kind,
      v_base_seconds,
      v_increment_seconds,
      v_move_deadline_seconds,
      v_turn_started_at,
      v_white_seconds_remaining,
      v_black_seconds_remaining,
      v_is_rated,
      v_rating_applied_at
  from public.game_threads gt
  join public.game_participants gp
    on gp.game_id = gt.id
  where gt.id = p_game_id
    and gp.user_id = v_user_id
    and gp.participant_status = 'active'
  for update of gt, gp;

  if v_side is null then
    raise exception 'That multiplayer game is not available for this account.';
  end if;

  if v_thread_status <> 'active' then
    raise exception 'Only active multiplayer games can accept moves.';
  end if;

  if v_current_turn is distinct from v_side then
    raise exception 'It is not your turn in this multiplayer game.';
  end if;

  v_next_white_seconds_remaining := v_white_seconds_remaining;
  v_next_black_seconds_remaining := v_black_seconds_remaining;

  if v_time_control_kind = 'live_clock' then
    v_elapsed_seconds := greatest(
      0,
      ceil(extract(epoch from (v_now - coalesce(v_turn_started_at, v_now))))::integer
    );

    if v_side = 'white' then
      v_active_remaining_after_elapsed := coalesce(v_white_seconds_remaining, v_base_seconds) - v_elapsed_seconds;
      if v_active_remaining_after_elapsed <= 0 then
        raise exception 'White clock expired before this move could be recorded.';
      end if;
      v_next_white_seconds_remaining := v_active_remaining_after_elapsed + coalesce(v_increment_seconds, 0);
    else
      v_active_remaining_after_elapsed := coalesce(v_black_seconds_remaining, v_base_seconds) - v_elapsed_seconds;
      if v_active_remaining_after_elapsed <= 0 then
        raise exception 'Black clock expired before this move could be recorded.';
      end if;
      v_next_black_seconds_remaining := v_active_remaining_after_elapsed + coalesce(v_increment_seconds, 0);
    end if;
  end if;

  select coalesce(max(gm.ply_number), 0) + 1
    into v_next_ply
  from public.game_moves gm
  where gm.game_id = p_game_id;

  insert into public.game_moves (
    game_id,
    ply_number,
    user_id,
    move_side,
    from_square,
    to_square,
    promotion,
    san,
    fen_after,
    snapshot_payload
  )
  values (
    p_game_id,
    v_next_ply,
    v_user_id,
    v_side,
    p_from_square,
    p_to_square,
    p_promotion,
    p_san,
    coalesce(p_fen_after, ''),
    p_snapshot_payload
  );

  v_next_status := case
    when p_is_checkmate or p_is_stalemate then 'completed'
    else 'active'
  end;

  v_result := case
    when p_is_checkmate then v_side
    when p_is_stalemate then 'draw'
    else null
  end;

  v_next_turn := case
    when p_is_checkmate or p_is_stalemate then null
    when v_side = 'white' then 'black'
    else 'white'
  end;

  v_next_deadline := case
    when p_is_checkmate or p_is_stalemate then null
    when v_time_control_kind = 'move_deadline' then v_now + make_interval(secs => v_move_deadline_seconds)
    when v_time_control_kind = 'live_clock' and v_next_turn = 'white' then v_now + make_interval(secs => v_next_white_seconds_remaining)
    when v_time_control_kind = 'live_clock' and v_next_turn = 'black' then v_now + make_interval(secs => v_next_black_seconds_remaining)
    else null
  end;

  if v_next_status = 'completed' and v_is_rated and v_rating_applied_at is null then
    select
      max(case when gp.side = 'white' then gp.user_id end),
      max(case when gp.side = 'black' then gp.user_id end)
      into v_white_user_id, v_black_user_id
    from public.game_participants gp
    where gp.game_id = p_game_id
      and gp.side in ('white', 'black');

    if v_white_user_id is not null then
      insert into public.profiles (user_id)
      values (v_white_user_id)
      on conflict (user_id) do nothing;
    end if;

    if v_black_user_id is not null then
      insert into public.profiles (user_id)
      values (v_black_user_id)
      on conflict (user_id) do nothing;
    end if;

    if v_white_user_id is not null and v_black_user_id is not null then
      select p.elo_rating into v_white_rating
      from public.profiles p
      where p.user_id = v_white_user_id;

      select p.elo_rating into v_black_rating
      from public.profiles p
      where p.user_id = v_black_user_id;

      if v_result = 'white' then
        v_white_score := 1;
        v_black_score := 0;
      elsif v_result = 'black' then
        v_white_score := 0;
        v_black_score := 1;
      else
        v_white_score := 0.5;
        v_black_score := 0.5;
      end if;

      v_white_delta := public.calculate_elo_delta(v_white_rating, v_black_rating, v_white_score);
      v_black_delta := public.calculate_elo_delta(v_black_rating, v_white_rating, v_black_score);

      update public.profiles
      set elo_rating = elo_rating + v_white_delta
      where user_id = v_white_user_id;

      update public.profiles
      set elo_rating = elo_rating + v_black_delta
      where user_id = v_black_user_id;
    end if;
  end if;

  update public.game_threads
  set
    status = v_next_status,
    current_turn = v_next_turn,
    current_fen = coalesce(p_fen_after, current_fen),
    result = coalesce(v_result, result),
    winner_user_id = case
      when p_is_checkmate then v_user_id
      when p_is_stalemate then null
      else winner_user_id
    end,
    completed_at = case
      when p_is_checkmate or p_is_stalemate then v_now
      else completed_at
    end,
    last_move_at = v_now,
    turn_started_at = case
      when p_is_checkmate or p_is_stalemate then null
      else v_now
    end,
    deadline_at = v_next_deadline,
    white_seconds_remaining = case
      when v_time_control_kind = 'live_clock' then v_next_white_seconds_remaining
      else white_seconds_remaining
    end,
    black_seconds_remaining = case
      when v_time_control_kind = 'live_clock' then v_next_black_seconds_remaining
      else black_seconds_remaining
    end,
    rating_applied_at = case
      when v_next_status = 'completed' and v_is_rated and v_rating_applied_at is null then v_now
      else rating_applied_at
    end,
    white_rating_delta = case
      when v_next_status = 'completed' and v_is_rated and v_rating_applied_at is null then v_white_delta
      else white_rating_delta
    end,
    black_rating_delta = case
      when v_next_status = 'completed' and v_is_rated and v_rating_applied_at is null then v_black_delta
      else black_rating_delta
    end
  where id = p_game_id;

  return query
  select
    gt.id,
    v_next_ply,
    gt.status,
    gt.current_turn,
    gt.deadline_at,
    gt.result,
    gt.white_rating_delta,
    gt.black_rating_delta
  from public.game_threads gt
  where gt.id = p_game_id;
end;
$$;

revoke all on function public.create_game_invite(text, text, text, integer, integer, integer, boolean, text) from public;
grant execute on function public.create_game_invite(text, text, text, integer, integer, integer, boolean, text) to authenticated;

revoke all on function public.respond_to_game_invite(uuid, text) from public;
grant execute on function public.respond_to_game_invite(uuid, text) to authenticated;

revoke all on function public.list_active_games() from public;
grant execute on function public.list_active_games() to authenticated;

revoke all on function public.append_game_move(uuid, text, text, text, text, text, jsonb, boolean, boolean) from public;
grant execute on function public.append_game_move(uuid, text, text, text, text, text, jsonb, boolean, boolean) to authenticated;

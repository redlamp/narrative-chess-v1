create or replace function public.fen_piece_at(p_fen text, p_square text)
returns text
language plpgsql
immutable
strict
as $$
declare
  v_board text := split_part(p_fen, ' ', 1);
  v_rows text[] := string_to_array(split_part(p_fen, ' ', 1), '/');
  v_file integer := ascii(substr(p_square, 1, 1)) - ascii('a') + 1;
  v_rank integer := substr(p_square, 2, 1)::integer;
  v_row text;
  v_col integer := 0;
  v_char text;
  v_index integer;
begin
  if p_square !~ '^[a-h][1-8]$' or v_board = '' or array_length(v_rows, 1) <> 8 then
    return null;
  end if;

  v_row := v_rows[9 - v_rank];

  for v_index in 1..char_length(v_row) loop
    v_char := substr(v_row, v_index, 1);

    if v_char ~ '^[1-8]$' then
      v_col := v_col + v_char::integer;
      if v_col >= v_file then
        return null;
      end if;
    else
      v_col := v_col + 1;
      if v_col = v_file then
        return v_char;
      end if;
    end if;
  end loop;

  return null;
end;
$$;

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
  v_current_fen text;
  v_from_piece text;
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
  v_move_history jsonb;
  v_move_history_length integer;
  v_latest_move jsonb;
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
    gt.current_fen,
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
      v_current_fen,
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

  v_from_piece := public.fen_piece_at(v_current_fen, p_from_square);
  if v_from_piece is null then
    raise exception 'There is no piece to move on %.', p_from_square;
  end if;

  if (v_side = 'white' and v_from_piece !~ '^[A-Z]$') or (v_side = 'black' and v_from_piece !~ '^[a-z]$') then
    raise exception 'You can only move your own pieces.';
  end if;

  select coalesce(max(gm.ply_number), 0) + 1
    into v_next_ply
  from public.game_moves gm
  where gm.game_id = p_game_id;

  if p_snapshot_payload is null or jsonb_typeof(p_snapshot_payload) <> 'object' then
    raise exception 'Move snapshot payload is required.';
  end if;

  v_move_history := p_snapshot_payload -> 'moveHistory';
  if jsonb_typeof(v_move_history) <> 'array' then
    raise exception 'Move snapshot payload must include move history.';
  end if;

  v_move_history_length := jsonb_array_length(v_move_history);
  if v_move_history_length <> v_next_ply then
    raise exception 'Move snapshot is out of sync with the server game.';
  end if;

  v_latest_move := v_move_history -> (v_move_history_length - 1);
  if jsonb_typeof(v_latest_move) <> 'object' then
    raise exception 'Move snapshot must include the submitted move.';
  end if;

  if v_latest_move ->> 'side' is distinct from v_side then
    raise exception 'Submitted move side does not match your multiplayer side.';
  end if;

  if v_latest_move ->> 'from' is distinct from p_from_square or v_latest_move ->> 'to' is distinct from p_to_square then
    raise exception 'Submitted move squares do not match the snapshot.';
  end if;

  if coalesce(v_latest_move ->> 'san', '') is distinct from coalesce(p_san, '') then
    raise exception 'Submitted move notation does not match the snapshot.';
  end if;

  if coalesce(v_latest_move ->> 'fenAfter', '') is distinct from coalesce(p_fen_after, '') then
    raise exception 'Submitted move position does not match the snapshot.';
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

revoke all on function public.append_game_move(uuid, text, text, text, text, text, jsonb, boolean, boolean) from public;
grant execute on function public.append_game_move(uuid, text, text, text, text, text, jsonb, boolean, boolean) to authenticated;

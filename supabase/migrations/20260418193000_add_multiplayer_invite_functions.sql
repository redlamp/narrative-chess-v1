drop function if exists public.create_game_invite(text, text, text, boolean);
drop function if exists public.respond_to_game_invite(uuid, text);
drop function if exists public.list_active_games();

create or replace function public.create_game_invite(
  p_opponent_username text,
  p_city_edition_id text default null,
  p_play_mode text default 'async',
  p_rated boolean default false
)
returns table (
  game_id uuid,
  status text,
  play_mode text,
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
  v_start_fen constant text := 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
begin
  if v_user_id is null then
    raise exception 'Sign in to create a multiplayer game.';
  end if;

  if p_play_mode not in ('sync', 'async') then
    raise exception 'Play mode must be sync or async.';
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
    rated,
    current_turn,
    current_fen
  )
  values (
    v_user_id,
    p_city_edition_id,
    'invited',
    p_play_mode,
    p_rated,
    'white',
    v_start_fen
  )
  returning id into v_game_id;

  insert into public.game_participants (game_id, user_id, side, participant_status)
  values
    (v_game_id, v_user_id, 'white', 'active'),
    (v_game_id, v_opponent_user_id, 'black', 'invited');

  return query
  select
    gt.id,
    gt.status,
    gt.play_mode,
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
begin
  if v_user_id is null then
    raise exception 'Sign in to respond to multiplayer invites.';
  end if;

  if p_response not in ('accept', 'decline') then
    raise exception 'Invite response must be accept or decline.';
  end if;

  select gt.status, gp.participant_status
    into v_thread_status, v_participant_status
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
    set status = 'active'
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
    current_turn = null
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

create or replace function public.list_active_games()
returns table (
  game_id uuid,
  status text,
  play_mode text,
  rated boolean,
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
    gt.play_mode,
    gt.rated,
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
   and gt.status in ('invited', 'active')
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
      else 3
    end,
    coalesce(gt.last_move_at, gt.updated_at, gt.created_at) desc;
$$;

revoke all on function public.create_game_invite(text, text, text, boolean) from public;
grant execute on function public.create_game_invite(text, text, text, boolean) to authenticated;

revoke all on function public.respond_to_game_invite(uuid, text) from public;
grant execute on function public.respond_to_game_invite(uuid, text) to authenticated;

revoke all on function public.list_active_games() from public;
grant execute on function public.list_active_games() to authenticated;

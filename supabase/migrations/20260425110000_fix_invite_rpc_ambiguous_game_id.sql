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
    update public.game_participants gp
    set participant_status = 'active'
    where gp.game_id = p_game_id
      and gp.user_id = v_user_id;

    update public.game_threads gt
    set
      status = 'active',
      turn_started_at = now(),
      deadline_at = case
        when v_time_control_kind = 'move_deadline' then now() + make_interval(secs => v_move_deadline_seconds)
        when v_time_control_kind = 'live_clock' then now() + make_interval(secs => v_white_seconds_remaining)
        else null
      end
    where gt.id = p_game_id;

    return query
    select gt.id, gt.status, gp.participant_status
    from public.game_threads gt
    join public.game_participants gp
      on gp.game_id = gt.id
    where gt.id = p_game_id
      and gp.user_id = v_user_id;
    return;
  end if;

  update public.game_participants gp
  set participant_status = 'declined'
  where gp.game_id = p_game_id
    and gp.user_id = v_user_id;

  update public.game_threads gt
  set
    status = 'cancelled',
    result = 'cancelled',
    completed_at = now(),
    current_turn = null,
    deadline_at = null,
    turn_started_at = null
  where gt.id = p_game_id;

  return query
  select gt.id, gt.status, gp.participant_status
  from public.game_threads gt
  join public.game_participants gp
    on gp.game_id = gt.id
  where gt.id = p_game_id
    and gp.user_id = v_user_id;
end;
$$;

revoke all on function public.respond_to_game_invite(uuid, text) from public;
grant execute on function public.respond_to_game_invite(uuid, text) to authenticated;

create or replace function public.cancel_game_invite(
  p_game_id uuid
)
returns table (
  game_id uuid,
  status text,
  result text
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user_id uuid := auth.uid();
  v_now timestamptz := now();
  v_thread_status text;
  v_created_by uuid;
begin
  if v_user_id is null then
    raise exception 'Sign in to cancel multiplayer invites.';
  end if;

  select gt.status, gt.created_by
    into v_thread_status, v_created_by
  from public.game_threads gt
  where gt.id = p_game_id
  for update;

  if v_thread_status is null then
    raise exception 'That multiplayer invite is not available.';
  end if;

  if v_created_by is distinct from v_user_id then
    raise exception 'Only the inviter can cancel this multiplayer invite.';
  end if;

  if v_thread_status <> 'invited' then
    raise exception 'Only pending multiplayer invites can be cancelled.';
  end if;

  update public.game_participants gp
  set participant_status = 'left'
  where gp.game_id = p_game_id
    and gp.user_id <> v_user_id
    and gp.participant_status in ('invited', 'active');

  update public.game_threads gt
  set
    status = 'cancelled',
    result = 'cancelled',
    completed_at = v_now,
    current_turn = null,
    turn_started_at = null,
    deadline_at = null,
    is_open = false
  where gt.id = p_game_id;

  return query
  select gt.id, gt.status, gt.result
  from public.game_threads gt
  where gt.id = p_game_id;
end;
$$;

revoke all on function public.cancel_game_invite(uuid) from public;
grant execute on function public.cancel_game_invite(uuid) to authenticated;

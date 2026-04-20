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

  update public.game_participants
  set participant_status = 'left'
  where game_id = p_game_id
    and user_id <> v_user_id
    and participant_status in ('invited', 'active');

  update public.game_threads
  set
    status = 'cancelled',
    result = 'cancelled',
    completed_at = v_now,
    current_turn = null,
    turn_started_at = null,
    deadline_at = null,
    is_open = false
  where id = p_game_id;

  return query
  select gt.id, gt.status, gt.result
  from public.game_threads gt
  where gt.id = p_game_id;
end;
$$;

revoke all on function public.cancel_game_invite(uuid) from public;
grant execute on function public.cancel_game_invite(uuid) to authenticated;

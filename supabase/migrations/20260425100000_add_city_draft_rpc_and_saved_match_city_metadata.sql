alter table public.user_saved_matches
  add column if not exists city_metadata jsonb;

create or replace function public.save_city_draft_version(
  p_city_edition_id text,
  p_payload jsonb,
  p_content_status text,
  p_review_status text,
  p_review_notes text default null,
  p_last_reviewed_at timestamptz default null,
  p_notes text default null
)
returns table (
  version_id uuid,
  version_number integer,
  city_edition_id text
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  current_user_id uuid := auth.uid();
  next_version_number integer;
begin
  if current_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if not public.has_app_role('author') then
    raise exception 'Author role required to save city drafts.';
  end if;

  if not exists (
    select 1
    from public.city_editions ce
    where ce.id = p_city_edition_id
  ) then
    raise exception 'Unknown city edition.';
  end if;

  perform pg_advisory_xact_lock(hashtext('city-draft-version:' || p_city_edition_id));

  select coalesce(max(cv.version_number), 0) + 1
  into next_version_number
  from public.city_versions cv
  where cv.city_edition_id = p_city_edition_id;

  return query
  insert into public.city_versions (
    city_edition_id,
    version_number,
    status,
    content_status,
    review_status,
    payload,
    review_notes,
    last_reviewed_at,
    notes,
    created_by
  )
  values (
    p_city_edition_id,
    next_version_number,
    'draft',
    p_content_status,
    p_review_status,
    p_payload,
    p_review_notes,
    p_last_reviewed_at,
    p_notes,
    current_user_id
  )
  returning id, public.city_versions.version_number, public.city_versions.city_edition_id;
end;
$$;

revoke all on function public.save_city_draft_version(text, jsonb, text, text, text, timestamptz, text) from public;
grant execute on function public.save_city_draft_version(text, jsonb, text, text, text, timestamptz, text) to authenticated;

revoke all on function public.publish_city_version(text, jsonb, text, text, text, timestamptz, text) from public;
grant execute on function public.publish_city_version(text, jsonb, text, text, text, timestamptz, text) to authenticated;

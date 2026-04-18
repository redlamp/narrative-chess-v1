create or replace function public.publish_city_version(
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
  next_version_number integer;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if not public.has_app_role('admin') then
    raise exception 'Admin role required to publish city editions.';
  end if;

  select coalesce(max(cv.version_number), 0) + 1
  into next_version_number
  from public.city_versions cv
  where cv.city_edition_id = p_city_edition_id;

  update public.city_versions
  set status = 'archived'
  where city_edition_id = p_city_edition_id
    and status = 'published';

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
    created_by,
    published_at
  )
  values (
    p_city_edition_id,
    next_version_number,
    'published',
    p_content_status,
    p_review_status,
    p_payload,
    p_review_notes,
    p_last_reviewed_at,
    p_notes,
    auth.uid(),
    now()
  )
  returning id, public.city_versions.version_number, public.city_versions.city_edition_id;
end;
$$;

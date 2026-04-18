create table if not exists public.user_saved_matches (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  saved_at timestamptz not null,
  move_count integer not null,
  snapshot jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_saved_matches enable row level security;

drop trigger if exists set_user_saved_matches_updated_at on public.user_saved_matches;
create trigger set_user_saved_matches_updated_at
before update on public.user_saved_matches
for each row
execute function public.set_updated_at();

create policy "users can read their own saved matches"
on public.user_saved_matches
for select
to authenticated
using (auth.uid() = user_id);

create policy "users can insert their own saved matches"
on public.user_saved_matches
for insert
to authenticated
with check (auth.uid() = user_id);

create policy "users can update their own saved matches"
on public.user_saved_matches
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "users can delete their own saved matches"
on public.user_saved_matches
for delete
to authenticated
using (auth.uid() = user_id);

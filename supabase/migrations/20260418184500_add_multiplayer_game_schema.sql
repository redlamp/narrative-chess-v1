create table if not exists public.game_threads (
  id uuid primary key default gen_random_uuid(),
  created_by uuid not null references auth.users(id) on delete cascade,
  city_edition_id text references public.city_editions(id) on delete restrict,
  status text not null default 'invited' check (status in ('invited', 'active', 'completed', 'abandoned', 'cancelled')),
  play_mode text not null default 'async' check (play_mode in ('sync', 'async')),
  rated boolean not null default false,
  current_turn text check (current_turn in ('white', 'black')),
  current_fen text,
  result text check (result in ('white', 'black', 'draw', 'abandoned', 'cancelled')),
  winner_user_id uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  last_move_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.game_participants (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.game_threads(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  side text not null check (side in ('white', 'black', 'spectator')),
  participant_status text not null default 'invited' check (participant_status in ('invited', 'active', 'declined', 'left')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint game_participants_game_user_unique unique (game_id, user_id)
);

create table if not exists public.game_moves (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.game_threads(id) on delete cascade,
  ply_number integer not null check (ply_number > 0),
  user_id uuid references auth.users(id) on delete set null,
  move_side text not null check (move_side in ('white', 'black')),
  from_square text not null check (from_square ~ '^[a-h][1-8]$'),
  to_square text not null check (to_square ~ '^[a-h][1-8]$'),
  promotion text check (promotion in ('q', 'r', 'b', 'n')),
  san text,
  fen_after text not null,
  created_at timestamptz not null default now(),
  constraint game_moves_game_ply_unique unique (game_id, ply_number)
);

create index if not exists game_threads_status_updated_idx
  on public.game_threads (status, updated_at desc);

create index if not exists game_threads_created_by_updated_idx
  on public.game_threads (created_by, updated_at desc);

create index if not exists game_participants_user_status_idx
  on public.game_participants (user_id, participant_status, updated_at desc);

create unique index if not exists game_participants_game_side_unique_idx
  on public.game_participants (game_id, side)
  where side in ('white', 'black');

create index if not exists game_moves_game_created_idx
  on public.game_moves (game_id, created_at asc);

alter table public.game_threads enable row level security;
alter table public.game_participants enable row level security;
alter table public.game_moves enable row level security;

drop trigger if exists set_game_threads_updated_at on public.game_threads;
create trigger set_game_threads_updated_at
before update on public.game_threads
for each row
execute function public.set_updated_at();

drop trigger if exists set_game_participants_updated_at on public.game_participants;
create trigger set_game_participants_updated_at
before update on public.game_participants
for each row
execute function public.set_updated_at();

create or replace function public.is_game_participant(p_game_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.game_participants gp
    where gp.game_id = p_game_id
      and gp.user_id = auth.uid()
      and gp.participant_status in ('invited', 'active')
  );
$$;

create or replace function public.calculate_elo_delta(
  p_player_rating integer,
  p_opponent_rating integer,
  p_score numeric,
  p_k_factor integer default 32
)
returns integer
language sql
immutable
set search_path = public
as $$
  select round(
    p_k_factor * (
      p_score - (1.0 / (1.0 + power(10.0, (p_opponent_rating - p_player_rating) / 400.0)))
    )
  )::integer;
$$;

create policy "participants can read their game threads"
on public.game_threads
for select
to authenticated
using (
  created_by = auth.uid() or public.is_game_participant(id)
);

create policy "participants can read their game participants"
on public.game_participants
for select
to authenticated
using (
  user_id = auth.uid() or public.is_game_participant(game_id)
);

create policy "participants can read their game moves"
on public.game_moves
for select
to authenticated
using (
  public.is_game_participant(game_id)
);

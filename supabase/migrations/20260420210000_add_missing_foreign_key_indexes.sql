-- Cover foreign keys that currently lack an index. Flagged by the Supabase
-- performance linter rule 0001_unindexed_foreign_keys. Without these, queries
-- that filter or join on the FK column fall back to sequential scans as the
-- referenced tables grow.

create index if not exists city_versions_created_by_idx
  on public.city_versions (created_by);

create index if not exists game_moves_user_id_idx
  on public.game_moves (user_id);

create index if not exists game_threads_city_edition_id_idx
  on public.game_threads (city_edition_id);

create index if not exists game_threads_winner_user_id_idx
  on public.game_threads (winner_user_id);

create index if not exists user_saved_matches_user_id_idx
  on public.user_saved_matches (user_id);

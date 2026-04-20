-- Register multiplayer tables with Supabase Realtime so clients can subscribe
-- to live move and thread updates. RLS policies continue to filter the change
-- stream, so only participants receive rows they can already read.

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'game_threads'
  ) then
    alter publication supabase_realtime add table public.game_threads;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'game_participants'
  ) then
    alter publication supabase_realtime add table public.game_participants;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'game_moves'
  ) then
    alter publication supabase_realtime add table public.game_moves;
  end if;
end $$;

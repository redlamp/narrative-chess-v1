# TODO

Last updated: April 18, 2026

## In Progress

1. Multiplayer groundwork
   a. `Games` tabs split into `Active`, `Yours`, `Historic`
   b. multiplayer plan doc added
   c. next: profiles + username claim UI

## Next

1. Add `profiles` table
   a. username
   b. display name
   c. basic Elo rating

2. Wire username claim UI
   a. account details panel
   b. validation
   c. unique username check

3. Add multiplayer tables
   a. `game_threads`
   b. `game_participants`
   c. `game_moves`

4. Add invite-by-username flow

5. Add rated game completion + Elo update

## Durable data already moved to Supabase

1. city editions and published/draft versions
2. cloud layout bundles
3. saved matches

## Notes

1. Keep public Play on published city data by default
2. Keep invite-based multiplayer before public matchmaking
3. Keep `Historic` separate from multiplayer state

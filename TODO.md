# TODO

Last updated: April 18, 2026

## In Progress

1. Multiplayer groundwork
   a. `Games` tabs split into `Active`, `Yours`, `Historic`
   b. multiplayer plan doc added
   c. profiles + username claim UI scaffolded
   d. next: multiplayer schema tables

## Next

1. Add multiplayer tables
   a. `game_threads`
   b. `game_participants`
   c. `game_moves`

2. Add invite-by-username flow

3. Add rated game completion + Elo update

4. Add `Active` games UI backed by multiplayer data

## Durable data already moved to Supabase

1. city editions and published/draft versions
2. cloud layout bundles
3. saved matches

## Notes

1. Keep public Play on published city data by default
2. Keep invite-based multiplayer before public matchmaking
3. Keep `Historic` separate from multiplayer state

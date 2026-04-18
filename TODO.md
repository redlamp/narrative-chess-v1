# TODO

Last updated: April 18, 2026

## In Progress

1. Multiplayer groundwork
   a. `Games` tabs split into `Active`, `Yours`, `Historic`
   b. multiplayer plan doc added
   c. profiles + username claim UI scaffolded
   d. multiplayer schema tables scaffolded
   e. next: invite flow

## Next

1. Add invite-by-username flow

2. Add move append / turn update flow

3. Add rated game completion + Elo update

4. Add `Active` games UI backed by multiplayer data

5. Add Supabase Realtime subscriptions for multiplayer

## Durable data already moved to Supabase

1. city editions and published/draft versions
2. cloud layout bundles
3. saved matches

## Notes

1. Keep public Play on published city data by default
2. Keep invite-based multiplayer before public matchmaking
3. Keep `Historic` separate from multiplayer state

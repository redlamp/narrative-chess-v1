# TODO

Last updated: April 18, 2026

## In Progress

1. Multiplayer groundwork
   a. `Games` tabs split into `Active`, `Yours`, `Historic`
   b. multiplayer plan doc added
   c. profiles + username claim UI scaffolded
   d. multiplayer schema tables scaffolded
   e. invite-by-username RPCs added
   f. `Active` tab now creates invites and accepts / declines them
   g. product direction changed from `sync/async` to time controls
   h. time-control schema + invite presets implemented
   i. move append / turn sync implemented
   j. `Active` games can now be opened into the match surface
   k. rated completion + Elo update implemented
   l. Play header now shows multiplayer status and Elo delta for completed rated games
   m. open multiplayer games poll Supabase for opponent moves while loaded
   n. completed multiplayer games now appear in `Games > Active`
   o. invite creator can choose white or black
   p. append-move promotion mapping has focused tests

## Next

1. Add Supabase Realtime subscriptions for multiplayer

2. Add random side assignment to invites

3. Add fuller tests around active-game session refresh and append failure states

4. Add completed-game review filters if completed list becomes noisy

## Durable data already moved to Supabase

1. city editions and published/draft versions
2. cloud layout bundles
3. saved matches

## Notes

1. Keep public Play on published city data by default
2. Keep invite-based multiplayer before public matchmaking
3. Keep `Historic` separate from multiplayer state
4. Current invite flow lets the creator choose white or black; random side remains future work
5. Replace user-facing `sync/async` with time-control presets like `10 min` and `1 move / day`

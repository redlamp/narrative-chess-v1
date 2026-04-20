# Multiplayer Plan

Last updated: April 20, 2026

## Goal

Add invite-based multiplayer that supports:

1. one multiplayer game model with time controls
2. live clock play
3. correspondence play with move deadlines
4. durable game history
5. usernames
6. a basic Elo system

Keep scope narrow. Do not build public matchmaking first.

## Product direction

`Play > Games` should evolve toward:

1. `Active`
   a. live multiplayer games
   b. correspondence games waiting on a player
   c. invites and accepted games

2. `Yours`
   a. personal saved games
   b. solo/local runs
   c. archived personal copies

3. `Historic`
   a. reference games
   b. study imports
   c. not multiplayer state

## Naming

Use:

1. `username`
   a. unique
   b. lowercase canonical form
   c. stable for invites and game headers

2. `display_name`
   a. optional
   b. can change more freely

3. `elo_rating`
   a. starts at `1200`
   b. updated only after rated completed games

## Phase 1

### Profiles

Add `profiles` table:

1. `user_id`
2. `username`
3. `display_name`
4. `elo_rating`
5. timestamps

Rules:

1. username unique
2. username required before multiplayer
3. user can edit display name
4. username change should be restricted or deferred

### DB shape

Add:

1. `profiles`
2. `game_threads`
3. `game_participants`
4. `game_moves`

## Phase 2

### Game threads

`game_threads` should hold:

1. `id`
2. `created_by`
3. `city_edition_id`
4. `status`
   a. `invited`
   b. `active`
   c. `completed`
   d. `abandoned`
5. `time_control_kind`
   a. `live_clock`
   b. `move_deadline`
6. `base_seconds`
   a. optional for live clock only
7. `increment_seconds`
   a. optional for live clock only
8. `move_deadline_seconds`
   a. optional for correspondence only
9. `deadline_at`
   a. next required move deadline for correspondence
10. `current_turn`
11. `current_fen`
12. `winner_user_id`
13. `rated`
14. timestamps

### Participants

`game_participants` should hold:

1. `game_id`
2. `user_id`
3. `side`
   a. `white`
   b. `black`
4. `participant_status`
   a. `invited`
   b. `active`
   c. `declined`
   d. `left`

### Moves

`game_moves` should hold:

1. `game_id`
2. `ply_number`
3. `user_id`
4. `from_square`
5. `to_square`
6. `promotion`
7. `fen_after`
8. `snapshot_payload` optional at first
9. timestamps

Move rows are append-only.

## Phase 3

### Invite flow

Start with direct invites by username and open games that any signed-in player can join.

Reason:

1. simpler permissions
2. easier UX
3. avoids matchmaking/moderation work
4. good for async and sync both

Flow:

1. user enters opponent username or marks the game as open
2. creator chooses:
   a. city edition
   b. rated or casual
   c. time control preset
3. invite sent, or open game listed for other signed-in players
4. opponent accepts or declines, or another player joins the open game
5. game becomes active

Suggested first presets:

1. `10 min`
   a. live clock
   b. `base_seconds = 600`
   c. `increment_seconds = 0`

2. `15 + 10`
   a. live clock
   b. `base_seconds = 900`
   c. `increment_seconds = 10`

3. `1 move / hour`
   a. correspondence
   b. `move_deadline_seconds = 3600`

4. `1 move / day`
   a. correspondence
   b. `move_deadline_seconds = 86400`

5. `1 move / week`
   a. correspondence
   b. `move_deadline_seconds = 604800`

6. `1 move / month`
   a. correspondence
   b. `move_deadline_seconds = 2592000`

## Phase 4

### Realtime

Use Supabase Realtime only after thread/move model exists.

Realtime should cover:

1. new moves
2. invite updates
3. turn changes
4. maybe presence later

Correspondence does not need presence to work.

## Elo

Keep Elo basic at first.

Rules:

1. start at `1200`
2. only rated completed games count
3. use simple K-factor, start with `32`
4. no provisional rating system at first
5. no team/mode-specific ladders at first

Basic update:

1. expected score from player ratings
2. actual score from result
3. `new_rating = old_rating + K * (actual - expected)`

Do this in a DB function when a rated game is completed.

## RLS

Need strict ownership rules:

1. users can read their own profile
2. public can read limited profile fields needed for multiplayer lookup
3. players can read games they participate in
4. players can insert moves only on their turn
5. players cannot edit prior moves

## UI rollout

1. username claim UI in account details
2. `Games > Active` invite/create state
3. active game list
4. turn indicators
5. accept/decline invite
6. time control badge
7. rated/casual badge
8. result screen with Elo delta
9. completed games list in `Games > Yours`
10. creator side choice

Implemented UI status:

1. username claim UI in account details: done
2. `Games > Active` invite/create state: done
3. active game list: done
4. turn indicators: done
5. accept/decline invite: done
6. time control badge: done
7. rated/casual badge: done
8. result display with Elo delta: done
9. completed games list in `Games > Yours`: done
10. creator side choice, including random side: done

## Current Online Turn Loop

Implemented direction:

1. Players create direct username invites or open games from the Games panel.
2. The invite chooses a published city edition, side, rated/casual mode, and time control.
3. The accepting player activates the game; the server starts the first turn timer.
4. The Play surface loads the latest server snapshot and locks local controls unless it is the signed-in player's turn.
5. After a local legal move, the Play surface locks again while `append_game_move` records the move.
6. `append_game_move` validates participant, active game status, current turn, square format, promotion, and next ply before inserting.
7. The server advances `current_turn`, updates `deadline_at`, and stores live-clock remaining seconds when the time control is a clock.
8. The opponent sees the game as their turn after refresh/polling, loads the updated snapshot, and repeats the loop.

Time-control behavior:

- `live_clock`: each player starts with `base_seconds`; the moving side spends elapsed time since `turn_started_at`, then receives `increment_seconds`; `deadline_at` tracks when the active side's clock would expire.
- `move_deadline`: each turn gets a fresh `move_deadline_seconds` window; players can still make multiple moves in a day if both keep responding before the current deadline.
- when `deadline_at` passes while the game is still active, the opposing active participant may call `claim_game_timeout` to settle the thread as `completed` with the caller as winner; rated games run the standard Elo delta update, and `list_active_games` surfaces `is_timed_out` and `can_claim_timeout` flags to drive the Play and Games affordances.

UI contract:

- header Turn/State/Moves cards stay in the first row across local, study, and multiplayer modes.
- multiplayer games add Online, Clock/Due, Cloud sync, and Elo cards after the core three cards.
- Turn reads `Your turn`, `Syncing move`, or the active color for loaded multiplayer games.

## Near-term implementation order

Done:

1. scaffold `profiles`
2. add username claim UI
3. add multiplayer schema tables:
   a. `game_threads`
   b. `game_participants`
   c. `game_moves`
   d. `calculate_elo_delta()`
4. replace user-facing `sync/async` choices with explicit time controls
5. create direct invite flow
6. create open-game flow
7. append moves to DB through `append_game_move`
8. validate participant, player side, turn, square format, promotion, and next ply in `append_game_move`
9. add rated game completion and Elo settlement in the move append path
10. poll/list active, invited, open, and completed games through `list_active_games`
11. claim timeouts on expired live clocks and missed correspondence deadlines through `claim_game_timeout`
12. cancel pending direct and open multiplayer invites through `cancel_game_invite`
13. `Games > Active` auto-polls every 20s and shows a relative "Updated Xs ago" timestamp beside the manual refresh control
14. per-user archive/unarchive of finished multiplayer games through `archive_game` and `unarchive_game`, with an include-archived toggle in `Games > Yours`

Remaining:

1. apply and verify all checked-in migrations in the live Supabase project
2. subscribe with Realtime after the polling turn loop is stable

## Deliberate non-goals for first release

1. public matchmaking
2. spectators
3. chat
4. clans/friends/social graph
5. complex ranking tiers
6. tournament mode

## Notes

1. Do not ask users to choose between `sync` and `async` directly.
2. Ask for a time control instead.
3. Live and correspondence are backend variants of the same thread model.
4. The first implementation can keep `play_mode` internally if needed for compatibility, but the product direction should move to explicit time controls.
5. Polling is the first multiplayer refresh path; Realtime can replace it after the turn loop is stable.

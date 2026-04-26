# Narrative Chess Review And Next Plan

## Summary
The project is healthy for a serious prototype: package boundaries are mostly right, chess logic is tested, docs are active, Supabase work is disciplined, and local quality gates pass. I ran `typecheck`, `lint`, `test`, `build`, and `security:scan`; all passed. The build still warns about large chunks, especially `index` and `maplibre-gl`.

No open GitHub issues or PRs were found. Local `main` is ahead of `origin/main` by 16 commits, so I will treat the local checkout as the current source of truth and avoid GitHub writes unless separately requested.

## Review Findings
- City context is not fully wired into gameplay: `useChessMatch` still builds characters from Edinburgh only, even when Play selects another city. See [useChessMatch.ts](/C:/workspace/narrative-chess/apps/web/src/hooks/useChessMatch.ts:67) and [App.tsx](/C:/workspace/narrative-chess/apps/web/src/App.tsx:762).
- Saved matches do not persist city context and still default to “Edinburgh match”, which conflicts with multiple playable cities. See [savedMatches.ts](/C:/workspace/narrative-chess/apps/web/src/savedMatches.ts:9) and [savedMatches.ts](/C:/workspace/narrative-chess/apps/web/src/savedMatches.ts:25).
- Remote city draft saving allocates `version_number` client-side, then inserts directly. That should move behind an RPC before relying on it with multiple editors. See [cityBoards.ts](/C:/workspace/narrative-chess/apps/web/src/cityBoards.ts:129).
- Supabase docs are slightly stale: `account-auth-setup.md` omits newer multiplayer RPCs, and the RLS checklist has a city draft provenance note that does not match current code. See [docs/supabase-rls-checklist.md](/C:/workspace/narrative-chess/docs/supabase-rls-checklist.md:86).
- README links include local absolute Windows paths and a lowercase `docs/prd.md` link, which will be brittle outside this machine. See [README.md](/C:/workspace/narrative-chess/README.md:99) and [README.md](/C:/workspace/narrative-chess/README.md:134).
- Mobile support is documented but not implemented yet; the board still uses HTML5 drag whenever `onSquareDrop` exists. See [Board.tsx](/C:/workspace/narrative-chess/apps/web/src/components/Board.tsx:367).

## Implementation Plan
1. **Documentation and repo hygiene first**
   - Fix README links to relative repo links and correct `docs/PRD.md` casing.
   - Update Supabase auth/setup docs to include all current RPCs: invite cancel, timeout claim, archive/unarchive, resign, and realtime notes.
   - Reconcile RLS checklist notes with actual migrations and client code.

2. **Make city context a real gameplay contract**
   - Add a small Play city context object in `apps/web`: board id, label, source, published edition id, preview mode, and `CityBoard`.
   - Pass that context into `useChessMatch`; remove the Edinburgh hard-code.
   - Rebuild local/study character rosters from the active city board.
   - When loading multiplayer games, resolve the game’s `city_edition_id` before hydrating the snapshot; preserve server snapshot data if the city cannot be resolved.

3. **Persist city context with saves**
   - Extend `SavedMatchRecord` with backward-compatible optional city metadata.
   - Use the selected city label in default saved-match names.
   - Persist the metadata locally and in Supabase, with a nullable `city_metadata jsonb` migration for cloud saves.
   - Keep legacy saved matches readable, defaulting unknown city context to current bundled fallback behavior.

4. **Harden city draft publishing**
   - Add `save_city_draft_version` RPC to allocate version numbers, set `created_by`, and insert draft versions transactionally.
   - Switch `saveCityBoardDraftToSupabase` from direct insert to RPC.
   - Add explicit revoke/grant statements for `publish_city_version` and the new draft RPC.

5. **Stabilize Play/Cities UI without widening scope**
   - Implement the first mobile foundation slice from `docs/MOBILE.md`: `100dvh`, coarse-pointer hook, hover gates, and board drag guard.
   - Keep desktop behavior unchanged.
   - Defer full mobile navigation and 3D work until city/data contracts are clean.

## Test Plan
- Keep existing gates green: `bun run typecheck`, `bun run lint`, `bun run test`, `bun run build`, `bun run security:scan`.
- Add focused tests for city-aware character generation in `useChessMatch`.
- Add saved-match tests for legacy records, city metadata persistence, and default naming.
- Add city-board RPC adapter tests around success/failure mapping.
- Add manual browser smoke after implementation: select London, make moves, save/load, switch back to Edinburgh, load multiplayer snapshot, verify story/district context stays consistent.

## Assumptions
- Current priority remains Milestone 2 plus Milestone 6.
- No new packages, no 3D, no broad UI rewrite.
- No shared `content-schema` changes are required for the first pass.
- GitHub publishing is out of scope until explicitly requested.

# PRD — Narrative Chess

Last Updated: April 20, 2026 (consolidated residual from supabase-migration-plan.md + TODO.md)
Status: Active prototype, local-first static deployment with optional Supabase-backed account, cloud save, and multiplayer paths

---

## 1. Product Summary

Narrative Chess = web chess with narrative layer grounded in city geography, district metadata, character framing.

Priority order:
1. chess clarity + correctness
2. lightweight narrative value
3. city-context presentation
4. richer spatial/visual presentation later

Beyond pure prototype. Includes: playable local chess, study replay, city-aware board, structured content editors, shared layout tooling, design token system, GitHub Pages deployment, optional Supabase auth/cloud saves, and an early multiplayer turn loop.

Six page areas: Play, Cities, Classics, Roles, Research, Design.

---

## 2. Product Intent

Target:
- valid, readable chess game
- city-aware board where districts matter
- lightweight character cast attached to pieces
- narrative layer reacting to moves, captures, checks, game state

Not: social simulation, open-world city sim, 3D narrative engine.

---

## 3. Current Product Surface

### 3.1 Play
Most mature surface:
- playable local chess with legal move validation
- move history with replay stepping + scrubbing
- shared animation playhead for board + map motion
- saved games + historic study flows
- online multiplayer game list, invite/open-game creation, turn-aware board locking, and completed multiplayer review from Games > Yours
- Story Beat, City Tile, Character, Narrative Tone, map panels
- Google Maps + MapLibre variants
- shared layout mode: panel visibility, resizing, saved layouts, per-panel bounds
- highlight color picker in app menu
- unified BoardPanel shared with Cities

### 3.2 Cities
Real authoring surface:
- city list + district list views
- City Editor + District Editor panels
- board placement + map placement panels
- drag-and-drop district reassignment on board
- district multi-select for bulk editing
- district list auto-scrolls to selected item; group auto-expands on select
- map anchor, radius, locality, landmarks, day/night profile, tone cue editing
- file save/load + browser draft persistence
- dirty-state handling + save/reset affordances
- canonical city data source with draft status UI
- board click: occupied square selects district, empty square assigns selected district

### 3.3 Classics
- list/detail browsing
- structured metadata
- detail links
- loading games into Play workspace

### 3.4 Roles
- piece-type grouping
- list/detail editing
- browser persistence + file save workflows

### 3.5 Research
Structured planning/reference surface. Not deep production tool yet.

### 3.6 Design
Typography zoo + visual hierarchy reference. Design support, not gameplay.

---

## 4. Major Delivered Changes

### 4.1 Core Chess + Replay
- legal local chess via `packages/game-core`
- move history + undo
- replay + PGN-based study support
- saved match support in browser
- board-state-derived character + event views

### 4.2 City-Aware Play Surface
- Edinburgh integrated as active play city
- district-aware board labeling + hover/selection
- City Tile + Story Beat panels
- MapLibre city map: district markers, radius overlays, piece overlays
- Google Maps retained as comparison/fallback

### 4.3 Character + Narrative Layer
- generated character roster from city + role pools
- Character panel: Details + Recent Actions tabs
- move-to-event narrative generation in `packages/narrative-engine`
- tone presets affecting generated output

### 4.4 Authoring + Content Tools
- Cities editor: district map + board placement
- drag-and-drop district square reassignment
- role catalog editor
- classic game library editor
- design exploration page
- research comparison page

### 4.5 Layout + Workspace Tooling
- shared layout mode across Play + content pages
- drag/resize behavior
- panel visibility toggles
- saveable page/workspace layouts
- per-panel bound editing via panel settings
- Data menu with Reset action + bundled layout defaults for GitHub Pages

### 4.6 Design Token System
- 4-phase migration: CSS token foundation, Shadcn component patterns, typography tokens, semantic color tokens
- `--field-label-gap` token for label-to-input spacing app-wide
- card padding overrides cleaned up
- form grid alignment fixes (`align-content: start`)

### 4.7 Board Unification
- unified BoardPanel shared between Play + Cities
- Pieces toggle on board panel
- board scaling fixes
- board toggle rotation fix (writing-mode on text span only)
- square labels + district labels get `pointer-events: none`

### 4.8 Persistence + Delivery
- browser-local persistence for settings + drafts
- optional local file save/load via File System Access APIs
- "Save everything" workflow
- canonical city data source established with draft status UI
- GitHub Pages deployment from `main`

### 4.9 Early Multiplayer + Account Surface
- optional Supabase Auth with profile username/display name and Elo rating
- direct username invites and open multiplayer games
- live-clock and correspondence time-control presets
- active game loading from Supabase snapshots
- client-side board lock for non-player sides and non-turn states
- server-side `append_game_move` validation for participant, side, turn, square format, promotion, and ply ordering
- completed multiplayer games moved out of Games > Active and shown in Games > Yours
- `claim_game_timeout` RPC lets the opposing active participant settle a game when the live clock or correspondence deadline has passed, with Elo applied for rated games
- `resign_game` RPC lets an active participant concede an in-progress match from the Play header, scoring the opponent and settling Elo when rated

---

## 5. Architecture Snapshot

### 5.1 Package Boundaries
- `apps/web` — UI, panels, page composition, editor flows, browser persistence
- `packages/game-core` — chess.js integration, legal move validation, replay, snapshots
- `packages/content-schema` — shared Zod schemas + TypeScript contracts
- `packages/narrative-engine` — character generation, move-to-event, tone-aware narrative
- `content/` — checked-in city boards, classic games, piece styles, narrative templates

### 5.2 State Ownership
Mostly respects boundary:
- chess simulation state owned outside renderer
- board/map rendering consumes snapshots
- authoring pages own editor state in web app

Biggest remaining issue: persistence fragmentation.

### 5.3 Persistence Model Today
Mixed local-first plus optional Supabase-backed flows:
- `localStorage` — app settings, layouts, saved matches, role/catalog drafts, city drafts
- IndexedDB — persisted local directory handles
- local file save/load — JSON + CSS export/import
- checked-in JSON — `content/` + `layouts/`
- Supabase — optional auth/profile, cloud saved matches, layout bundles, published/draft city versions, and multiplayer game threads/moves

Main problem: data-source ambiguity between browser state, local file state, repo-tracked files, deployed state. Partially addressed by canonical city data source + draft status UI, but not yet resolved across all content types.

---

## 6. Milestone Status

Active target: Milestone 2 completion + Milestone 6 durability. Don't widen scope. Make Play + Cities dependable, align authored data with gameplay.

### Milestone 0 — Foundation ✅ Complete
- monorepo structure, TypeScript + test setup, shared schemas, baseline docs + agent guidance

### Milestone 1 — Core Chess ✅ Complete
- legal local chess, move history + undo, study replay, responsive Play shell, baseline event log

### Milestone 2 — City Board 🔄 In Progress
Done: Edinburgh mapped, district metadata in panels, MapLibre + Google maps, Cities editor, drag-and-drop district placement, canonical city data source

Remaining:
- multiple playable cities wired into Play
- cleaner canonical data flow: content/editor → gameplay (partially addressed)
- stronger published vs local-only board edit distinction (partially addressed via draft status UI)

### Milestone 3 — Character Generation 🔄 In Progress
Done: generated roster, role catalog, Character panel + Recent Actions

Remaining:
- stronger authored/procedural override path
- richer district-informed variation
- explicit character revision workflow

### Milestone 4 — Narrative Event Layer 🔄 In Progress
Done: move + capture framing, tone presets, Story Beat + Character surfaces, event history on snapshots

Remaining:
- stronger memory callbacks
- better event variety + repetition suppression
- more contextual use of district/city/state info

### Milestone 5 — Visual Identity/3D ⏳ Not Started
Groundwork: refined 2D presentation, map overlays, SVG piece assets, board + map motion, 4-phase design token system
Not started: 3D board, scene-based presentation, 3D character/district visualization

### Milestone 6 — Durable Content + Save 🔄 In Progress
Done: local save/load flows, checked-in content, browser draft persistence, Pages deployment, canonical city data source + draft status UI, bundled layout defaults

Remaining:
- single canonical data source across all content types (city data partially done)
- sync strategy
- database-backed storage
- revision history + conflict handling

### Milestone 7 — Multiplayer 🔄 In Progress
Done: optional Supabase username/profile foundation, game thread/participant/move schema, direct invites, open games, time-control presets, active game list, turn-aware Play loading, server-side move append validation, live-clock state, basic Elo settlement on rated completion, completed games shown in Games > Yours, timeout claims for expired clocks and missed correspondence deadlines via `claim_game_timeout`, cancel path for pending invites via `cancel_game_invite`, auto-polled Games list with a relative refresh timestamp, per-user archive/unarchive for finished multiplayer games, active-game resignation via `resign_game`, Supabase Realtime subscriptions layered over the polling loop for both the loaded Play game and the Games > Active list

Remaining:
- apply and verify migrations in the live Supabase project before relying on production multiplayer enforcement, including the new realtime publication migration
- once Realtime is verified in production, consider reducing Play-surface and Games list poll cadence

### Milestone 8 — Story Artifact Output ⏳ Not Started

---

## 7. Strengths
- Real playable chess core with replay + state inspection
- Cities page productive for district placement, metadata, radius, board alignment
- Layout system = strong internal tool for fast iteration
- Package boundaries (`game-core`, `content-schema`, `narrative-engine`) sound
- Design token system provides consistent visual foundation
- Unified BoardPanel reduces code duplication between Play + Cities

---

## 8. Weaknesses + Risks

**8.1 Data Canonicality** — Main issue. Browser drafts, local files, checked-in content, deployed state drift silently. City data partially addressed; other content types still fragmented.

**8.2 Play Not Yet Simplified** — Feature-rich but feels like toolbench, not chess-first.

**8.3 Narrative Still Template-First** — Works but weak arcs, repetitive over longer games.

**8.4 UI Regression Risk High** — Layout mode, panel visibility, map hover/selection, story/panel sync, saved match state, content editor drafts, drag-and-drop = many failure surfaces.

**8.5 Performance Risk Growing** — Play combines shared motion timelines + board overlays + MapLibre overlays + synchronized panels.

---

## 9. Next Steps

### Priority A — Data + Persistence Cleanup
- formalize canonical vs draft data rules
- define what is browser-cache-only
- define what must save to file
- plan backend/DB migration path (don't implement yet)
- make "published state" vs "local draft state" explicit in UI
- extend canonical data source pattern from cities to other content types

### Priority B — Play Surface Stabilization
- reduce layout/panel inconsistencies
- improve animation reliability + performance
- tighten panel sync rules
- remove UI clutter weakening chess readability
- keep multiplayer turn/player-side enforcement explicit in the board and status tiles

### Priority C — Cities Workflow Maturity
- improve district editing workflow
- clarify save/reset semantics
- improve map search + placement loops
- prepare path from edited city data into gameplay without hidden drift

### Priority D — Narrative Quality Pass
- enrich move templates with more context
- reduce repetitive phrasing
- use district, role, prior actions more effectively
- define "lightweight but good enough" narrative boundary

### Priority E — Shared Editor Shell Consistency
- normalize list/detail layouts where practical
- standardize button bars, save/reset semantics, notification behavior
- keep shadcn-based patterns consistent across panels + editor pages

---

## 10. Agent Workstreams

### Agent 1 — Persistence + Data Contracts
Files: `apps/web/src/*State.ts`, `fileSystemAccess.ts`, `layouts/`, `content/`
- document current persistence sources
- define canonical vs draft rules
- propose backend-ready schema mapping

### Agent 2 — Play Surface + Motion
Files: `App.tsx`, `Board.tsx`, `CityMapLibrePanel.tsx`, `useMovePlayhead.ts`, `useCaptureImpact.ts`
- stabilize animation behavior
- improve frame pacing + overlay sync
- simplify panel behavior conflicting with play clarity

### Agent 3 — Cities Authoring
Files: `CityReviewPage.tsx`, `CityDistrictPlacementEditor.tsx`, related draft state
- improve district editor ergonomics
- tighten bulk edit rules
- improve save/reset + placement workflows

### Agent 4 — Narrative Systems
Files: `packages/narrative-engine`, `content/templates/narrative-data.json`
- reduce repetition
- improve move/capture/check framing
- define memory + callback rules

### Agent 5 — Content + Editorial Tooling
Focus: Roles, Classics, Research, Design
- normalize editor patterns
- improve authoring flow

### Agent 6 — QA + Regression Review
- regression review after major UI/data changes
- workflow verification: save, load, publish, deploy
- accessibility + keyboard checks for critical panels

Recommended sequence:
1. Agent 1 defines data ownership + persistence rules
2. Agent 2 + Agent 3 in parallel once rules clear
3. Agent 4 after Play + Cities contracts stable
4. Agent 5 normalizes support pages
5. Agent 6 runs continuously as regression pass

---

## 11. Delivery Sequence

1. clarify persistence rules + canonical data ownership
2. stabilize Play interactions + animation/performance
3. stabilize Cities as primary authored data workflow
4. improve narrative quality on current schema
5. only then decide on backend/DB implementation

---

## 12. Immediate Next Tasks

### Short-Term
- add Narrative Tone info button with tooltip (explain feature + per-mode impact)
- document persistence sources + UI states
- define "published data" vs "local draft data" in-product
- reduce Play page polish debt
- review Cities save/load end to end
- define which values stay browser-only cache
- make local file saves vs repo-tracked content visibly distinct in UI
- verify live Supabase migrations for multiplayer RLS/RPC behavior

### Medium-Term
- choose canonical data model for layouts, cities, districts, characters, saved matches
- prepare DB migration plan
- wire authored city content more cleanly into gameplay
- improve narrative event quality
- normalize shared editor + button-bar patterns across non-Play pages
- add Realtime subscriptions after polling-based multiplayer is stable

### Deferred
- 3D presentation
- comic/vignette generation
- heavier backend before data contracts stable

### Open Questions
- `content/` checked-in role and classic game files: stay part of normal editing workflow, or demote to seed/export/backup once those entities migrate to Supabase like cities did?
- Public Play: read published only, or let signed-in editors preview drafts on the real Play surface (behind an explicit toggle)?

---

## 13. Acceptance Criteria — Next Phase

- local edits, saved files, deployed content stop drifting silently
- Play reliable + chess-first after recent UI expansion
- Cities dependable for authoring + inspecting district data
- narrative output improves without expanding schema complexity
- team can explain where every important data class lives

---

## 14. Summary

Narrative Chess: serious local-first prototype. Real chess core, city-aware play, structured content editors, layout tooling, design token system, deployable static delivery.

Biggest gap: not capability. Data source clarity + consolidation + stability under growing UI complexity. That drives next milestone.

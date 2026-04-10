# Product Requirements Document (PRD)

Last Updated: April 11, 2026
Status: Active prototype, local-first, static deployment

---

## 1. Product Summary

Codename: Narrative Chess

Narrative Chess is a web-based chess experience with a narrative layer grounded in city geography, district metadata, and character framing.

The product priority order remains:

1. chess clarity and correctness
2. lightweight narrative value
3. city-context presentation
4. richer spatial or visual presentation later

The app is now beyond a pure prototype shell. It includes a playable local chess experience, study replay support, city-aware board presentation, structured content editors, shared layout tooling, and static deployment on GitHub Pages. It is not yet database-backed and still relies on a mix of browser-local state, optional local file saves, and checked-in content files.

The app surface now spans six meaningful page areas:

- Play
- Cities
- Classics
- Roles
- Research
- Design

---

## 2. Product Intent

The target experience is still:

- a valid and readable chess game
- a city-aware board where districts matter
- a cast of lightweight characters attached to pieces
- a narrative layer that reacts to moves, captures, checks, and game state

This is not yet a social simulation, open-world city sim, or 3D narrative engine. Those remain possible future directions, but they are not the current milestone.

---

## 3. Current Product Surface

### 3.1 Play

The Play page is the most mature game surface. It currently includes:

- a playable local chess board with legal move validation
- move history with replay stepping and scrubbing
- a shared animation playhead for board and map motion
- saved games and historic game study flows
- Story Beat, City Tile, Character, Narrative Tone, and map panels
- Google Maps and MapLibre variants for city map presentation
- shared layout mode with panel visibility, resizing, saved layouts, and per-panel bounds

### 3.2 Cities

The Cities page is now a real authoring surface, not just a placeholder.

It currently includes:

- city list and district list views
- City Editor and District Editor detail panels
- board placement and map placement panels
- district multi-select for some bulk editing flows
- map anchor, radius, locality, landmarks, day/night profile, and tone cue editing
- file save/load integration and browser draft persistence
- explicit dirty-state handling and save/reset affordances

### 3.3 Classics

The Classics page supports historic/reference games and study flows, including:

- list/detail browsing
- structured metadata
- detail links
- loading games into the Play workspace

### 3.4 Roles

The Roles page supports editing role catalogs used in lightweight character generation:

- piece-type grouping
- list/detail editing
- browser persistence and file save workflows

### 3.5 Research

The Research page exists as a structured planning/reference surface. It is not yet a deep production tool, but it is part of the authoring workflow.

### 3.6 Design

The Design page now includes a typography zoo and reference area for visual hierarchy work. It is a design support page, not a gameplay page.

---

## 4. Major Delivered Changes Since Project Start

This list is worth sharing because the app has moved well beyond the original "core chess only" state.

### 4.1 Core Chess and Replay

- legal local chess built around `packages/game-core`
- move history and undo
- replay and PGN-based study support
- saved match support in the browser
- board-state-derived character and event views

### 4.2 City-Aware Play Surface

- Edinburgh integrated as the active play city
- district-aware board labeling and hover/selection behavior
- City Tile and Story Beat panels
- MapLibre city map with district markers, radius overlays, and piece overlays
- Google Maps map panel retained as a comparison/fallback surface

### 4.3 Character and Narrative Layer

- generated character roster from city and role pools
- Character panel with Details and Recent Actions tabs
- move-to-event narrative generation in `packages/narrative-engine`
- tone presets that already affect generated output

### 4.4 Authoring and Content Tools

- Cities editor with district map placement and board placement
- role catalog editor
- classic game library editor
- design exploration page
- research comparison page

### 4.5 Layout and Workspace Tooling

- shared layout mode across Play and content pages
- drag/resize behavior
- panel visibility toggles
- saveable page/workspace layouts
- panel bound editing via per-panel settings

### 4.6 Persistence and Delivery

- browser-local persistence for many settings and drafts
- optional local file save/load via File System Access APIs
- "Save everything" workflow
- GitHub Pages deployment working from `main`

---

## 5. Architecture Snapshot

### 5.1 Package Boundaries

- `apps/web`
  - UI, panels, page composition, editor flows, browser persistence, deployment surface
- `packages/game-core`
  - chess.js integration, legal move validation, replay generation, snapshot handling
- `packages/content-schema`
  - shared Zod schemas and TypeScript contracts
- `packages/narrative-engine`
  - character generation, move-to-event translation, tone-aware narrative templates
- `content/`
  - checked-in city boards, classic games, piece styles, narrative template data

### 5.2 State Ownership

The app mostly respects the intended boundary:

- chess simulation state is owned outside the renderer
- board/map rendering consumes snapshots
- authoring pages own their own editor state in the web app

The biggest remaining issue is not simulation correctness. It is persistence fragmentation.

### 5.3 Persistence Model Today

The app currently uses a mixed local-first model:

- `localStorage` for app settings, layouts, saved matches, role/catalog drafts, and city drafts
- IndexedDB for persisted local directory handles
- local file save/load for explicit JSON and CSS export/import
- checked-in JSON files in `content/` and `layouts/`

This model is useful for rapid iteration, but it is now the main source of confusion between:

- local browser state
- local filesystem state
- repo-tracked canonical files
- GitHub Pages deployed state

That data-source ambiguity is the highest-priority product infrastructure problem.

---

## 6. Current Milestone Status

Practical milestone guidance:

Even though work has landed in Milestones 3, 4, and 6, the project should still be managed as a Milestone 2 plus Milestone 6 consolidation effort. The right next move is not to widen scope further. It is to make Play and Cities dependable, align authored data with gameplay, and remove ambiguity about what data is canonical.

### Milestone 0 - Foundation

Status: Complete

Delivered:

- monorepo structure
- TypeScript and test setup
- shared schemas
- baseline docs and agent guidance

### Milestone 1 - Core Chess Vertical Slice

Status: Complete

Delivered:

- legal local chess
- move history and undo
- study replay loading
- responsive Play shell
- baseline event log generation

### Milestone 2 - City Board Prototype

Status: In progress, substantially delivered for Edinburgh

Delivered:

- Edinburgh mapped into Play
- district metadata surfaced in gameplay panels
- MapLibre and Google map variants
- Cities editor for district data and placement

Still missing to mark complete:

- multiple playable cities wired into the Play experience
- cleaner canonical data flow from content/editor into gameplay
- stronger distinction between published and local-only board edits

### Milestone 3 - Character Generation System

Status: In progress

Delivered:

- generated character roster
- role catalog support
- Character panel and Recent Actions view

Still missing to mark complete:

- stronger authored/procedural override path
- richer district-informed variation
- explicit character revision workflow

### Milestone 4 - Narrative Event Layer

Status: In progress

Delivered:

- move and capture framing
- tone presets
- Story Beat and Character narrative surfaces
- event history attached to snapshots

Still missing to mark complete:

- stronger memory callbacks
- better event variety and suppression of repetitive text
- more contextual use of district/city/state information

### Milestone 5 - Visual Identity and 3D Presence

Status: Not started as a formal milestone

Groundwork already present:

- refined 2D presentation
- map overlays
- SVG piece assets
- map and board piece motion

Not yet started:

- 3D board
- scene-based presentation
- 3D character or district visualization

### Milestone 6 - Durable Content and Save Infrastructure

Status: In progress

Delivered:

- local save/load flows
- checked-in content files
- browser draft persistence
- Pages deployment pipeline

Still missing to mark complete:

- single canonical data source
- sync strategy
- database-backed storage
- revision history and conflict handling

### Milestone 7 - Multiplayer and Session Play

Status: Not started

### Milestone 8 - Story Artifact Output

Status: Not started

### Working Milestone Recommendation

For planning and agent coordination, the active target should be:

- primary: Milestone 2 completion
- parallel support: Milestone 6 durability work
- controlled support only: Milestone 3 and 4 quality improvements where they directly improve Play

---

## 7. Current Strengths

### 7.1 Chess Readability is Real

The app is not merely thematic mock UI. There is a real playable chess core with replay and state inspection.

### 7.2 City Authoring Is Already Useful

The Cities page is now productive enough to shape district placement, metadata, radius, and board alignment without leaving the app.

### 7.3 Layout Tooling Is Powerful

The shared layout system has become one of the app's strongest internal tools. It supports fast iteration across Play and content pages.

### 7.4 The Repository Boundaries Are Mostly Sound

`game-core`, `content-schema`, and `narrative-engine` remain meaningful boundaries. That is a strong base for further work.

---

## 8. Current Weaknesses and Risks

### 8.1 Data Canonicality Is Unclear

This is the main issue.

Right now it is too easy for:

- local browser drafts
- local saved files
- checked-in repo content
- deployed Pages state

to drift apart.

### 8.2 Play Is Feature-Rich but Not Yet Simplified

The Play page has a lot of useful surfaces, but it is easy for the app to feel like a toolbench rather than a chess-first play experience.

### 8.3 Narrative Quality Is Still Template-First

The current narrative system works, but it is still a lightweight framing layer. It is not yet delivering strong arcs or low-repetition storytelling over longer games.

### 8.4 UI Regression Risk Is High

There is a lot of UI state now:

- layout mode
- panel visibility
- map hover and selection
- story/detail panel sync
- saved match state
- content editor draft state

This makes regression risk high unless more UI behavior is covered by targeted tests and review passes.

### 8.5 Performance Risk Is Growing

The Play page now combines:

- shared motion timelines
- board overlays
- MapLibre overlays
- several synchronized side panels

That is workable now, but it needs explicit performance discipline to avoid gradually degrading.

---

## 9. What Should Happen Next

The next phase should not be "add more pages." It should be consolidation.

### 9.1 Priority A - Data and Persistence Cleanup

Goal: define one canonical source for content and layout state.

Work:

- formalize canonical vs draft data rules
- define what is browser cache only
- define what must be saved to file
- plan backend/database migration path, but do not implement it yet unless it directly solves a current workflow problem
- make "published state" and "local draft state" explicit in UI

### 9.2 Priority B - Play Surface Stabilization

Goal: make Play feel tighter and more reliable.

Work:

- reduce remaining layout/panel inconsistencies
- improve animation reliability and performance
- tighten panel sync rules
- continue removing UI clutter that weakens chess readability

### 9.3 Priority C - Cities Workflow Maturity

Goal: make Cities the dependable source for authored district data.

Work:

- improve district editing workflow
- clarify save/reset semantics
- improve map search and placement loops
- prepare the path from edited city data into gameplay without hidden drift

### 9.4 Priority D - Narrative Quality Pass

Goal: improve output quality before expanding scope.

Work:

- enrich move templates with more context
- reduce repetitive phrasing
- use district, role, and prior actions more effectively
- define a clear boundary for "lightweight but good enough" narrative output

### 9.5 Priority E - Shared Editor Shell Consistency

Goal: keep support pages useful without fragmenting interaction patterns.

Work:

- normalize list/detail layouts where practical
- standardize button bars, save/reset semantics, and notification behavior
- keep shadcn-based patterns consistent across Play support panels and editor pages

---

## 10. Proposed Agent Workstreams

These are the agent roles worth using next. They should be treated as bounded workstreams with disjoint write scopes where possible.

### Agent 1 - Persistence and Data Contracts

Focus:

- `apps/web/src/*State.ts`
- `apps/web/src/fileSystemAccess.ts`
- `layouts/`
- `content/`

Responsibilities:

- document current persistence sources
- define canonical vs draft rules
- propose backend-ready schema mapping
- reduce drift between browser, file, and deployed data

### Agent 2 - Play Surface and Motion

Focus:

- `apps/web/src/App.tsx`
- `apps/web/src/components/Board.tsx`
- `apps/web/src/components/CityMapLibrePanel.tsx`
- `apps/web/src/hooks/useMovePlayhead.ts`
- `apps/web/src/hooks/useCaptureImpact.ts`

Responsibilities:

- stabilize animation behavior
- improve frame pacing and overlay sync
- simplify panel behavior where it conflicts with play clarity

### Agent 3 - Cities Authoring

Focus:

- `apps/web/src/components/EdinburghReviewPage.tsx`
- `apps/web/src/components/CityDistrictPlacementEditor.tsx`
- related draft state modules

Responsibilities:

- improve district editor ergonomics
- tighten bulk edit rules
- improve save/reset and placement workflows
- prepare cities to feed gameplay more directly

### Agent 4 - Narrative Systems

Focus:

- `packages/narrative-engine`
- `content/templates/narrative-data.json`

Responsibilities:

- reduce repetition
- improve move/capture/check framing
- define memory and callback rules for later milestones

### Agent 5 - Content and Editorial Tooling

Focus:

- Roles
- Classics
- Research
- Design

Responsibilities:

- keep editor patterns consistent
- improve authoring flow
- make support pages useful without letting them dominate the product

### Agent 6 - QA and Regression Review

Focus:

- targeted UI review
- persistence checks
- GitHub Pages and deployment verification

Responsibilities:

- regression review after each major UI/data change
- workflow verification for save, load, publish, and deploy
- accessibility and keyboard checks for critical panels

### Recommended Agent Sequence

The highest-value order from here is:

1. Agent 1 defines data ownership, persistence rules, and draft vs published behavior.
2. Agent 2 and Agent 3 work in parallel once those rules are clear enough to avoid drift.
3. Agent 4 improves narrative quality only after the Play and Cities contracts are stable.
4. Agent 5 follows by normalizing the support pages to the same editor shell patterns.
5. Agent 6 runs continuously as a review and regression pass after each major change set.

---

## 11. Recommended Delivery Sequence From Here

1. clarify persistence rules and canonical data ownership
2. stabilize Play interactions and animation/performance
3. stabilize Cities as the primary authored data workflow
4. improve narrative quality using the current schema
5. only then decide on backend/database implementation

This order is important. A database will help, but it will not fix unclear data ownership by itself.

---

## 12. Immediate Next Tasks

### 12.1 Short-Term

- document persistence sources and UI states
- define "published data" vs "local draft data" in-product
- reduce Play page polish debt
- review Cities save/load behavior end to end
- define which values are allowed to remain browser-only cache
- make local file saves and repo-tracked content visibly distinct in UI

### 12.2 Medium-Term

- choose the canonical data model for layouts, cities, districts, characters, and saved matches
- prepare database migration plan
- wire authored city content more cleanly into gameplay
- improve narrative event quality
- normalize shared editor and button-bar patterns across non-Play pages

### 12.3 Deferred

- multiplayer
- 3D presentation
- comic/vignette generation
- heavier backend complexity before data contracts are stable

---

## 13. Acceptance Criteria For The Next Phase

The next phase should be considered successful if:

- local edits, saved files, and deployed content stop drifting silently
- Play feels reliable and chess-first after recent UI expansion
- Cities becomes the dependable place to author and inspect district data
- narrative output improves without expanding schema complexity too early
- the team can explain where every important class of data lives

---

## 14. Summary

Narrative Chess is now a serious local-first prototype with:

- a real chess core
- city-aware play surfaces
- structured content editors
- layout tooling
- deployable static delivery

The biggest gap is no longer "can the app do enough?" It can.

The biggest gap is:

- data source clarity
- consolidation
- stability under growing UI complexity

That should drive the next milestone work.

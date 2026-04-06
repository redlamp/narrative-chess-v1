# Product Requirements Document (PRD)

**Last Updated:** April 6, 2026
**Status:** Living Document - Primary Source of Truth
**Supersedes:** `docs/queue.md` (The queue is now integrated into the milestones below)

---

## 1. Overview

**Codename:** Narrative Chess  
**Product Type:** Web-based chess game with a generative narrative layer.  
**Premise:** A chess game where the board is a real city, the pieces are people, and every move contributes to an emergent social narrative.

Narrative Chess reinterprets the rules and structure of chess through urban geography, character systems, and story generation. Each board maps to a city. Each square maps to a neighborhood, district, or borough. Each piece becomes a person with a role, background, motivations, and evolving history. As players make moves, the game generates narrative context around those actions, transforming abstract strategy into an unfolding story.

The project begins as a playable digital chess experience with a strong data foundation for later narrative and visual expansion. Over time, it grows into a hybrid of strategy game, city simulator, character generator, and comic/story engine.

---

## 2. Vision

Create a chess-driven storytelling system where:

- classic chess rules remain legible and intact
- city geography shapes tone, identity, and character origin
- pieces feel like people rather than tokens
- each move builds narrative momentum
- the same chess match can be retold as a dramatic, funny, tragic, or absurd story

The long-term aspiration is for a completed match to feel like both:

1. a strategically valid chess game
2. a coherent, replayable story artifact

---

## 3. Product Goals

### Primary Goals
- Deliver a solid, readable, enjoyable digital chess foundation.
- Build a framework for city-based boards tied to real places.
- Generate distinctive characters from piece type + city + neighborhood + team context.
- Produce a lightweight narrative log that reacts to gameplay events.
- Establish technical foundations for later 3D, visual vignette, and comic-book output.

### Secondary Goals
- Enable players to compare how the same opening or classic game becomes a different story in different cities.
- Support online play and spectatorship later.
- Create a system that can scale from text-first narrative to illustrated or cinematic presentation.

### Non-Goals for Initial Release
- Fully simulated open-world city navigation.
- AAA-quality character rendering.
- Real-time action gameplay.
- Fully voice-acted or authored branching dialogue.
- Complex combat simulation beyond chess resolution.

---

## 4. Core Design Pillars

### 4.1 Chess First
The game must remain understandable and functional as chess. Narrative should enrich the game, not obscure legal moves, board state, or turn structure.

### 4.2 Place Matters
The city is not cosmetic. Neighborhood identity, socioeconomic cues, local landmarks, and cultural context should meaningfully influence the tone and construction of characters.

### 4.3 Pieces Are People
Every piece should feel like an individual with a role, traits, and a potential arc.

### 4.4 Emergent Story Over Fixed Plot
The game should generate compelling narrative framing around moves rather than requiring fully authored storylines.

### 4.5 Tone Range
Narrative outcomes can be comic, dramatic, absurd, political, intimate, or disturbing. The system should support tonal variation without defaulting to moral simplicity.

### 4.6 Avoid Harmful Reduction
The system must avoid simplistic or offensive mappings around race, class, religion, gender, or morality. Rival teams should be framed through institutions, factions, sports, unions, families, political machines, or local subcultures rather than crude identity binaries.

---

## 5. Experience Summary

A player starts a match in a selected city. The standard 8x8 board is visible in an abstract board mode. Each square corresponds to a real neighborhood or subdistrict. The player can switch to a city/map mode that presents the board through city and district context. In early milestones, this may be a simpler labeled or overlaid map view rather than a full board-to-city morph.

Each piece begins the game as a generated character informed by:

- piece type
- side/faction
- starting district
- local city context
- team narrative framing

As pieces move, capture, protect, pressure, sacrifice, or promote, the game records and narrativizes these actions. The result is both a chess move history and a character/story history.

---

## 6. Gameplay Concept

### 6.1 Board as City
- The board remains 8x8 in game logic.
- Each square maps to a neighborhood, district, or subdistrict.
- Board mode preserves chess readability.
- Map mode visualizes the city and district layout.
- Day/night square treatment reflects white/black square parity and can imply temporal rhythm.

### 6.2 Square Identity
Each square should ideally contain:
- district/neighborhood name
- high-level descriptors (residential, nightlife, industrial, affluent, student-heavy, historic, waterfront, etc.)
- socioeconomic/cultural tags
- optional landmark hooks
- narrative tone cues

### 6.3 Piece Identity
Pieces should feel like distinct people shaped by role, place, faction, and emerging history. For the first playable version, character identity should stay lightweight and readable. The canonical implementation schema for early character generation is defined in **Section 10.1 First Playable Character Schema**.

### 6.4 Teams / Factions
Teams replace simplistic good-vs-evil framing with situational rivalries. Examples:
- rival unions
- political factions
- sports supporters
- crime families
- neighborhood coalitions
- media empires
- activist groups
- city agencies in conflict

The same visual side can represent different faction setups in different matches.

### 6.5 Capture Interpretation
Captures do not always imply death. Capture may be narrated as:
- arrest
- public humiliation
- social ousting
- scandal
- deplatforming
- exposure
- career ruin
- blackmail
- displacement
- injury
- disappearance
- murder

The framing depends on tone, character type, city, and prior events.

### 6.6 Promotion
Pawn promotion is a major narrative moment. The piece may gain:
- a new role
- new status
- changed name presentation
- altered aesthetic
- transformed narrative vocabulary

Promotion should often rhyme with the pawn’s origin while reflecting reinvention.

---

## 7. Narrative System

### 7.1 Narrative Layers
The narrative system should evolve in layers.

**Layer 1: Event Log**
A structured move log with flavor text.
*Examples: Phillip patrols Newhaven. Aisha cuts through Leith and applies pressure downtown. Camila exposes Darren and forces him off the board.*

**Layer 2: Character Memory**
Events become part of each character’s record.
*Examples: falsely accused another character, survived a near capture, defended the king twice, spent most of the game shielding the back rank.*

**Layer 3: Relational Hooks**
Previous actions can be referenced later.
*Examples: a liar later gets exposed, a cautious character becomes reckless, a neglected piece makes a decisive intervention.*

**Layer 4: Scene Generation**
Important moves can be reframed as vignettes or comic panels.

### 7.2 Tone Engine
Narrative output should support adjustable tone presets:
- grounded realism
- dark comedy
- tabloid melodrama
- civic noir
- absurd satire
- tragic urban drama

### 7.3 Narrative Constraints
The system should avoid:
- making immutable traits the reason for morality
- overusing violence
- flattening neighborhoods into stereotypes
- generating offensive character mappings without explicit, intentional framing

---

## 8. City System

### 8.1 Initial City Candidates
Recommended first cities:
- Edinburgh
- New York City
- Los Angeles
- Amsterdam

### 8.2 City Selection Criteria
A candidate city should ideally have:
- recognizable district identity
- strong public map data availability
- clear cultural texture
- diverse population and occupations
- useful landmark density
- interesting class, political, and social contrasts

### 8.3 City-to-Board Mapping Rules
Requirements:
- 64 board cells must map to 64 coherent districts or subdistricts
- mappings should feel intuitive where possible
- existing neighborhoods should be reused before inventing arbitrary divisions
- large districts may be split naturally by roads, rivers, landmarks, or known sub-areas
- neighboring tiles should broadly preserve geographic proximity where practical

### 8.4 City Research Data Model
For each district, capture:
- name
- parent borough or administrative area
- summary description
- land use type
- class or economic cues
- demographic texture at a high level
- political or cultural notes
- notable institutions or landmarks
- day and night energy profile
- candidate occupations for resident characters

---

## 9. Views and UX

### 9.1 Board View
Primary gameplay surface.
*Requirements: highly legible chessboard, standard move highlighting, selected piece state, history log, hover or click details for piece identity, optional narrative snippets.*

### 9.2 Map View
A city-referenced interpretation of the board.
*Requirements: district labels or overlays, selected piece remains readable, valid move destinations clearly highlighted, simple contextual city view in early milestones, optional richer map or 3D presentation later.*

### 9.3 Character Info Panel
Should show:
- name
- role
- district of origin
- faction
- traits
- current status
- key past actions
- one-line description

### 9.4 Narrative Panel / Match Chronicle
Should show:
- move history
- flavored event log
- major turning points
- optional filters by character

---

## 10. Character Data and Generation Constraints

### 10.1 First Playable Character Schema
For the first playable version, each piece should be assigned:
- full name
- role
- district of origin
- faction
- 4-6 traits selected from a larger curated pool of 10-20 traits
- 4-6 verbs selected from a larger curated pool of 10-20 verbs
- one-line description

Later versions may expand character detail, but early milestones should keep identity readable, lightweight, and safe to generate procedurally.

### 10.2 Generation Constraints
- separate appearance or style from moral framing
- allow some fields to be unknown, omitted, or deferred
- do not make immutable identity traits the cause of good or evil alignment
- allow culturally progressive and diverse character representation
- allow antagonistic or harmful characters, including racists, bigots, and other hostile social roles, when they serve the narrative, but do not frame those traits as culturally representative of groups or neighborhoods
- prefer broad plausibility and editorial restraint over overconfident specificity

### 10.3 Structured Character Model
- id
- match_id
- piece_id
- piece_type
- faction
- district_origin
- first_name
- middle_name
- last_name
- display_name
- role
- trait_ids
- verb_ids
- one_line_description
- appearance_tags
- cultural_context_notes
- memory_log
- status
- generation_source
- generation_model
- content_status (`empty`, `procedural`, `authored`)
- review_status (`empty`, `needs review`, `reviewed`, `approved`)
- review_notes
- last_reviewed_at

### 10.4 Notes on Character Data
Early versions should avoid broad procedural generation of sensitive demographic fields such as religion, sexuality, or ethnicity as explicit structured data. The main risks are stereotype reinforcement, overconfident inference, flattening neighborhoods into caricature, and accidentally making identity traits feel causally linked to morality.

To reduce those risks:
- keep the early schema focused on role, district, traits, verbs, and description
- use optional `cultural_context_notes` only where grounded in reviewed city content
- allow identity-relevant details to remain unknown, omitted, or implied lightly in authored text later
- separate style and presentation from ethical alignment or narrative worth

---

## 11. Recommended MVP

### 11.1 MVP Slice
- standard playable chess
- one city only: Edinburgh
- board mode plus simple map mode
- district labels for all 64 cells
- generated text-only character bios for all pieces
- flavored narrative event log for moves and captures
- no online play yet
- no 3D city mesh requirement yet
- no full comic generation yet

### 11.2 Prototype Sequencing
#### Prototype A — Core Local Chess
**Status:** ✅ Completed
**Goal:** local playable chess, move history and undo, minimal narrative event hooks, optional low-skill legal-move opponent.
**Notes:** Core logic is stable.

#### Prototype B — Edinburgh Board
**Status:** 🟡 In Progress (Needs Integration)
**Goal:** Edinburgh district mapping added to the board, district labels and basic city context in UI, board and city data coordinated through shared schemas, simple map-mode support.
**Notes:** Requires wiring `game-core` state transitions to consume `CityBoard` data.

---

## 12. Technical Recommendation

### 12.1 App Structure
Use a lightweight monorepo to support agent parallelism while keeping the repository manageable on a basic GitHub account.

**Structure:**
- `apps/web` — primary React application
- `packages/game-core` — chess rules wrappers, move/state logic
- `packages/content-schema` — shared TypeScript/Zod schemas
- `packages/narrative-engine` — event generation, templates, and memory hooks
- `content/cities` — city and district data
- `content/templates` — narrative templates, verbs, and tone presets
- `docs` — design notes, research, and workflow docs
- `AGENTS.md` — project-level guidance for agentic coding tools

### 12.2 Frontend
React + TypeScript + shadcn/ui

### 12.3 Board Rendering
Start with a 2D chess board to validate gameplay clarity, board interactions, and the basic narrative layer. Map elements should follow after the core chess experience is working. If the proof of concept is strong, the project can later move to a Three.js-based 3D board and city presentation.

### 12.4 3D / Spatial Layer
Three.js is the planned path for later board-space presentation, but it is not required for the initial prototype.

### 12.5 Game Logic
Use a validated chess rules library such as chess.js early, wrapped with custom narrative hooks. For solo play, investigate existing lightweight chess AI or engine integrations appropriate for hobbyist-level play. The first goal is a simple, approachable player-vs-computer mode rather than a highly advanced opponent.

### 12.6 State Management
Zustand or Redux Toolkit. Zustand is likely enough at the beginning.

### 12.7 Backend / Data Layer
Supabase or another PostgreSQL-backed service for:
- city data tables
- district metadata
- character generation templates
- saved games
- user accounts later
- online game state later

---

## 13. Data Model (High Level)

### 13.1 City
- id, name, country, style_tags, faction_presets, district_map

### 13.2 District
- id, city_id, name, board_coordinate, borough, descriptors, landmarks, day_profile, night_profile, role_biases

### 13.3 Match
- id, city_id, factions, opening_seed, move_history, event_history, result

### 13.4 Event
- id, match_id, move_number, event_type, actor_character_id, target_character_id, location_district_id, generated_text, tags

---

## 14. Risks

### Design Risks
- narrative overwhelms chess readability
- city mappings feel arbitrary or forced
- generated characters become repetitive or stereotyped
- the tone shifts too wildly to feel coherent

### Technical Risks
- geospatial rendering complexity grows too early
- online multiplayer adds too much architecture burden before the core is proven
- content schema becomes too broad before use cases are validated

### Ethical Risks
- neighborhoods represented reductively
- demographic inference handled insensitively
- faction framing accidentally creates harmful optics

---

## 15. Open Questions and Current Decisions

- **Is the main fantasy competitive chess with flavor, or storytelling through chess with strategy support?**
  *Decision:* Preserve chess as the foundation while building strong narrative support around it.

- **Should the system support solo play vs AI in the first public prototype?**
  *Decision:* Yes, a simple chess AI or lightweight engine integration is the target, but it must not delay the core playable prototype.

- **Should each city be hand-crafted or partially automated?**
  *Decision:* Based on open city/district data, then passed through a research and editorial phase.

- **How authored vs procedural should bios be?**
  *Decision:* Start procedural, but the system must track and support a transition toward authored content.

- **When should the project shift from text-only to models?**
  *Decision:* After proof of concept for basic gameplay and basic narrative is in place.

---

## 16. Milestones and Agentic Workstreams

The phase list below describes product scope evolution. The milestone plan below translates that scope into practical delivery slices that can be worked on in parallel.

**Progress Tracking:**
*   **✅ Completed:** Feature is implemented, tested, and stable in the core logic.
*   **🟡 In Progress:** Work has started, but integration or final polish is required.
*   **⚪ Not Started:** Feature is scoped but no work has begun.

### Milestone 0 — Project Foundation
**Objective:** Establish repo structure, development conventions, core tooling, and integration boundaries before feature work accelerates.
**Progress:** ✅ Completed
**Deliverables:** monorepo structure, TS/linting/formatting/test setup, baseline React app, initial documentation, content folder strategy, schema validation approach.

### Milestone 1 — Core Chess Vertical Slice
**Objective:** Deliver a clean, fully playable local chess experience with a strong UI foundation.
**Progress:** ✅ Completed
**Deliverables:** legal chess rules, move history and undo, selected-piece/valid-move highlighting, game-end conditions, baseline responsive UI shell, minimal narrative event log.

### Milestone 2 — City Board Prototype
**Objective:** Replace abstract squares with district-aware board data for one city.
**Progress:** 🟡 In Progress
**Deliverables:** one fully mapped city board (Edinburgh), 64 board coordinates mapped to neighborhoods/subdistricts, district metadata model populated, board labels and district details visible in UI, board view and simple map view toggle.
**Notes:** Requires wiring `game-core` state transitions to consume `CityBoard` data.

### Milestone 3 — Character Generation System
**Objective:** Give every piece a generated human identity grounded in role, place, and faction.
**Progress:** 🟡 In Progress
**Deliverables:** character schema finalized, archetype role pools per piece type, first-pass naming strategy, district-informed trait generation, hover/click character cards, piece metadata stored in match state.
**Notes:** Requires integrating `DistrictCell` data into `CharacterSummary` generation.

### Milestone 4 — Narrative Event Layer
**Objective:** Turn chess actions into readable narrative output.
**Progress:** 🟡 In Progress
**Deliverables:** flavored event log layered over move history, action templates by piece type and event type, capture interpretation rules, initial character memory hooks, tone preset support at a basic level.
**Notes:** The engine is functional but needs richer context from the City/Character data to elevate the narrative quality.

### Milestone 5 — Visual Identity and 3D Presence
**Objective:** Introduce lightweight spatial and character representation without losing chess readability.
**Progress:** ⚪ Not Started
**Deliverables:** improved board presentation in 3D space, low-fi piece or character stand-ins, camera controls suited to a board game, visual distinction between board mode and map mode, basic atmosphere/shader experiments.

### Milestone 6 — Saved Matches and Content Infrastructure
**Objective:** Make the system durable enough to support iteration, replay, and future expansion.
**Progress:** ⚪ Not Started
**Deliverables:** persisted matches or exportable match snapshots, content loading strategy for cities, templates, and factions, admin/debug views for inspecting generated data, backend or hosted data layer introduced only where needed.

### Milestone 7 — Multiplayer and Session Play
**Objective:** Add networked play only after the single-player/local prototype is strong.
**Progress:** ⚪ Not Started
**Deliverables:** room creation and joining, synchronized move state, server-authoritative or host-authoritative validation, reconnect handling, multiplayer-ready event log behavior.

### Milestone 8 — Narrative Vignettes and Story Artifact Output
**Objective:** Turn major moments into more memorable story artifacts.
**Progress:** ⚪ Not Started
**Deliverables:** selection rules for important moments, simple staged scenes or keyframe vignettes, exportable story recap or comic-like sequence, end-of-match summary focused on arcs and turning points.

---

## 17. AGENTS.md Guidance

The repository should include an `AGENTS.md` file at the root so tools like Codex and Claude Code have clear project instructions before making changes.

### Purpose of `AGENTS.md`
- define architecture boundaries
- define editing and ownership expectations
- define how agents should scope work
- define coding and testing expectations
- reduce drift between parallel agent threads

### Recommended contents of `AGENTS.md`
*(Content remains as previously defined)*

---

## 18. Working Model for Claude Code Agents

*(Content remains as previously defined)*

---

## 19. Proposed Next Steps

1. **Lock Milestone 0 and Milestone 1 scope.** (✅ Complete)
2. **Define repo/package structure** before parallel agent work begins. (✅ Complete)
3. **Establish core schemas** for `City`, `District`, `Character`, `Match`, and `Event`. (✅ Complete)
4. **Build the local chess vertical slice first.** (✅ Complete)
5. **Choose the first city and begin structured district mapping in parallel.** (Next Focus)
6. **Add character generation** only after the chess and city data contracts are stable.

**Next Action:** Focus on Milestone 2: City Board Prototype. This requires integrating the structured data from `content/cities/` into the state management of `game-core` and then feeding that enriched state into `narrative-engine`.


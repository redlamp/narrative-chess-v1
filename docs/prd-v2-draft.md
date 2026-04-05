# Narrative Chess - PRD Draft v2

This draft updates the original PRD to better match the current codebase direction and the recovery notes from the latest prompt audit.

## 1. Product Summary

Narrative Chess is a chess-first web app with a lightweight narrative layer, city context, and reviewed content tooling. The board remains the product center. Utility pages exist to support chess play, content review, and future expansion.

## 2. Updated Principles

- Chess readability comes first.
- Narrative should enrich move meaning without obscuring legality or board state.
- City and district data should be reviewed, editable, and easy to inspect.
- Utility surfaces such as research, style references, and content editors should share a small number of reusable patterns.
- Page scrolling is preferable to deep nested scroll regions when content grows.
- Accessibility and keyboard support are part of the feature, not a later polish layer.

## 3. Current Surface Areas

- Match: playable chess, move history, narrative log, study/replay, and layout controls.
- Cities: city overview, district review, and draft save/load support.
- Roles: piece-family and role editing with reusable content patterns.
- Classics: reference games, significance notes, study loading, and editable library behavior.
- Research: competitive references and supporting materials.
- Style Assets: a future review surface for piece art, CSS, and state styling references.

## 4. Scope Guidance

### In scope

- legal chess
- move history and undo
- narrative event logging
- reviewed city data
- shared content editor shells
- study/reference games
- style and asset review tooling

### Out of scope for the near term

- multiplayer
- 3D board or city rendering
- full geospatial simulation
- heavy procedural character generation
- advanced engine strength

## 5. UX Guidance

- Keep the Match page compact and board-led.
- Use one clear list/detail pattern across Cities, Roles, and Classics.
- Make search fields easy to clear.
- Favor sticky detail editors over cramped above-the-fold layouts when lists grow long.
- Keep controls for theme, layout, and settings simple and obvious.

## 6. Milestones

### Milestone 0 - Foundation
- repo setup
- TypeScript and testing
- shadcn baseline
- shared schemas
- docs and workflow conventions

### Milestone 1 - Core Chess
- legal local chess
- move history
- undo
- narrative event log
- study and replay support

### Milestone 2 - Cities
- one seeded city
- district mapping
- city and district review workflow
- city-specific metadata and save/load

### Milestone 3 - Shared Content Editing
- consistent editor shell across Cities, Roles, and Classics
- repo-local file saves where appropriate
- list/detail consistency
- validation and status handling

### Milestone 4 - Narrative Depth
- stronger narrative templates
- memory hooks
- tone presets

### Milestone 5 - Style and Asset Review
- piece art reference page
- CSS/style reference page
- configurable piece-state styling
- file-backed style notes

### Milestone 6 - Visual Expansion
- optional map polish
- optional 3D experiments

### Milestone 7 - Multiplayer
- session and sync support only after the single-player experience is stable

## 7. Acceptance Notes

- If a page starts to feel like a dashboard, reduce chrome before adding more panels.
- If content is long, prefer the page to scroll.
- If a workflow can be reviewed in the repo, save it in the repo.
- If a feature changes schemas, call that out explicitly in the implementation summary.

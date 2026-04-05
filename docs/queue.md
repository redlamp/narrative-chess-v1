# Narrative Chess Queue

This queue rebuilds the current work around the live repo state on `main`.

It is meant to be durable and resumable: each slice should land as a bounded branch, pass `lint`, `typecheck`, `test`, and `build`, and leave the next slice obvious.

This queue now includes the recovered prompts that were previously tracked in `recovery-queue.md`, so `queue.md` is the single source of truth.

## Current State

Shipped:
- local playable chess with move history, undo, and study/replay mode
- minimal narrative log and character layer
- Cities, Roles, Classics, and Research pages
- layout editing, theme toggle, local match saves, and named workspace layout files

Gaps that still matter:
- the editor shell is much more consistent now, but multi-city authoring will need a broader review and expansion path as more cities are added
- board keyboard support is underway, but layout editing and editor-page semantics still need an accessibility pass
- the match shell still feels busier than a chess-first tool should

## Active Queue

### 1. Shared Content Persistence
Status: completed (first pass)

Goal:
- move Roles and Classics onto the same repo-local draft workflow used by Cities

Deliverables:
- browser draft state plus folder connect / load / save / download actions
- repo-local draft files for roles and classic games under `content/`
- validation feedback before writing files

Result:
- Roles and Classics now both have repo-local draft workflows, with Classics synced back into the app shell instead of remaining a disconnected local editor.

Why first:
- this removes the highest-risk content loss path
- it makes future curation visible in the repo instead of hiding it in `localStorage`

### 2. Classics As A Real Editor
Status: completed (first pass)

Goal:
- turn the Classics page into a growing editable library, not just a viewer

Deliverables:
- add / duplicate / delete games
- edit metadata, significance notes, links, and PGN
- keep board preview and study-mode loading wired to the edited draft

Result:
- The Classics page now behaves like an editable study library and the selected edited game can be loaded into study mode directly.

### 3. Shared Index + Detail Editor Pattern
Status: completed (recovery pass)

Goal:
- align Cities, Roles, and Classics around one reusable editing shell

Deliverables:
- consistent intro/status/save strip
- consistent list/detail density and selection behavior
- consistent validation and save notices

### 4. Accessibility Pass
Status: in progress

Goal:
- fix the biggest interaction and semantics gaps without redesigning the app

Deliverables:
- proper keyboard model for the board
- keyboard support for layout editing or a guarded non-keyboard fallback
- better live-region and form relationships across editor pages

Progress:
- board arrow-key navigation is now being committed with tests so the chess surface is no longer pointer-only

### 5. Design Cleanup
Status: queued

Goal:
- make the product feel less like a dashboard and more like a chess-first tool

Deliverables:
- strengthen board primacy on Match
- reduce shell noise around navigation and utilities
- tighten typography and spacing across editor pages

## Recovery Items Merged Into The Main Queue

### 6. Multi-City Sample Data
Status: completed

Goal:
- add a second sample city so the Cities workflow can prove it supports more than one city

Deliverables:
- add London as a second seeded city
- keep the new city clearly marked as seeded/procedural rather than fully reviewed
- validate the city selector and district editor with more than one city in the list

Result:
- London now sits alongside Edinburgh in the Cities workflow, and the left column can be used to switch between seeded city drafts instead of acting like a single-entry stub.

### 7. Match Style And Assets
Status: completed

Goal:
- give the app a clean way to review piece styling, piece art, and CSS references

Result:
- the light/dark toggle is icon-only and shows the target mode
- Research includes `competition`, `Art assets`, and `style reference` tabs
- the app includes piece asset and styling reference pages
- piece CSS can be edited live, shared with the app, and saved to a repo-local file

### 8. Layout And Settings Recovery
Status: completed

Goal:
- make local layout behavior easier to reset and more predictable

Result:
- named layout files can now be removed
- deleting a named layout returns the workspace to the default layout state

### 9. Docs Follow-Up
Status: completed

Goal:
- keep the PRD and usage guidance in sync with the product direction

Result:
- PRD gap review is documented
- a revised PRD draft is in place
- user suggestions for agent roles and prompt efficiency are documented

## Deferred For Now

- multiplayer
- 3D board or map rendering
- backend persistence
- ambitious city simulation systems
- broad architecture changes outside the current package boundaries

## Working Rules

- branch each slice from the current integration branch
- commit queue/doc changes separately from feature code when practical
- call out schema changes explicitly in summaries
- prefer file-backed reviewed content over procedural hidden state

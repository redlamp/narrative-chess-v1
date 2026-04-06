# User Feedback & Implementation Tasks

**Session:** April 6, 2026  
**Status:** Active — maintained for momentum across sessions  
**Last Updated:** 2026-04-06

---

## High Priority (Structural Refactors)

### ✅ Task 1: Merge Saved Games + Historic Games
- [✅] Consolidate into one component with "saved" / "historic" tabs
- [✅] Unified format: name, players, location, date, description
- [✅] Remove "Start, prev, next, end, resume local" buttons (handled in history component)
- [✅] Maintain similar visual hierarchy to existing panels
- **Status:** ✅ COMPLETED (commit e81caa9)
- **Effort:** 2 hrs
- **Files Affected:** Created RecentGamesPanel.tsx, updated App.tsx, added CSS

### ✅ / 🔄 / ⏳ Task 2: Decompose Story Component into 4 Standalone Components
- [ ] Break Story into: Story Beat, Narrative Tone, City (tile), Character
- [ ] Allow independent positioning on screen
- [ ] Each component should work standalone
- [ ] Plan for responsive layout support (future: hide info when smaller, vertical/horizontal layouts)
- **Status:** Not Started
- **Effort:** 4-5 hrs
- **Files Affected:** `StoryPanel.tsx`, new component files for Beat/Tone/City/Character
- **Dependencies:** Narrative Tone info button (Task 4)

### ✅ / 🔄 / ⏳ Task 13: City Page Board Display + Authoring
- [ ] Show highlighted district location on board visualization
- [ ] Add ability to change district placement on board
- [ ] Plan authoring UI for multiple districts per tile / shared locations
- **Status:** Not Started
- **Effort:** 3-4 hrs
- **Files Affected:** `EdinburghReviewPage.tsx`, `cityReviewState.ts`

---

## Medium Priority (Features & Polish)

### ✅ Task 3: Character Component "Recent Actions" Tab
- [✅] Add 2 tabs: "Details" and "Recent Actions"
- [✅] Recent Actions shows: PGN notation + narrative element for each move
- [✅] Test and iterate on UX
- **Status:** ✅ COMPLETED (commit 3eb84c4)
- **Effort:** 1.5 hrs
- **Files Affected:** Created CharacterDetailPanel.tsx, updated StoryPanel.tsx, App.tsx, added CSS

### ✅ / 🔄 / ⏳ Task 4: Narrative Tone Component Info Button
- [ ] Add "ⓘ" info button with tooltip
- [ ] Main tooltip: explain what feature does
- [ ] Per-mode tooltips: explain game/narrative impact
- **Status:** Not Started
- **Effort:** 1 hr
- **Files Affected:** `StoryToneSection.tsx` or new Narrative Tone component
- **Icons:** `Info` from lucide-react

### ✅ / 🔄 / ⏳ Task 5: Game State Header: Consistent Sizing & Styling
- [ ] Fix game state elements changing size between white/black turns
- [ ] "Checkmate" → red/destructive style
- [ ] "Check" → amber style
- [ ] Turn display: show "Black" or "White" with king icon (team-colored)
- **Status:** Not Started
- **Effort:** 1-1.5 hrs
- **Files Affected:** `MatchHistoryPanel.tsx` or header components

### ✅ / 🔄 / ⏳ Task 11: Cities List Status Icons + Layout
- [ ] "XX Districts" → top left of list item
- [ ] Second line: Review Content + Review Status tags
- [ ] Icons:
  - "procedural" → `BotMessageSquare` or similar
  - "authored" → `UserRoundPen`
  - "needs review" → `FileScan`
  - "reviewed" → `ScanEye`
  - "approved" → `UserRoundCheck`
- **Status:** Not Started
- **Effort:** 1.5-2 hrs
- **Files Affected:** `cityBoards.ts`, city list rendering in Cities page

### ✅ / 🔄 / ⏳ Task 12: Character/City Content Status: Unified Styling
- [ ] Consistent styling for content/review status across both Character and City pages
- [ ] Show last update date on both
- [ ] Pull review metadata from state
- **Status:** Not Started
- **Effort:** 1.5-2 hrs
- **Files Affected:** `RoleCatalogPage.tsx`, `EdinburghReviewPage.tsx`

### ✅ / 🔄 / ⏳ Task 6: City Selector: Dropdown Instead of Pill
- [ ] Change from fixed pill to dropdown selector
- [ ] User selects city for story context
- [ ] Persist selection in view state
- **Status:** Not Started
- **Effort:** 1 hr
- **Files Affected:** Story component (post-decomposition)

---

## Low Priority (Polish)

### ✅ / 🔄 / ⏳ Task 9: Board Header: Fix Styling
- [ ] Don't change "board" label to "study replay board"
- [ ] Fix header styling changes between panels
- **Status:** Not Started
- **Effort:** 0.5 hr
- **Files Affected:** Board/study panel headers

### ✅ / 🔄 / ⏳ Task 10: Research & Design Panels: Layout Fix
- [ ] Fix odd nesting (many panels inside "competitive analysis")
- [ ] Adjust layout to match other panels
- **Status:** Not Started
- **Effort:** 1-1.5 hrs
- **Files Affected:** `ResearchPage.tsx`, `DesignPage.tsx`

---

## Backlog (Future)

### Task 7: City Tile Google Maps Links
- Add Google Maps links opening in new window based on district location
- **Effort:** 1-2 hrs
- **Priority:** Can be added once City/Tile components stable

### Task 8: Map Component for City Context
- "Map" component showing Google Maps embed
- Jump to locations on hover
- **Effort:** 2-3 hrs
- **Priority:** Future enhancement

---

## Ongoing Tracking

| Task # | Title | Status | Effort | Priority |
|--------|-------|--------|--------|----------|
| 1 | Saved + Historic Merge | ✅ | 2h | ⭐ High |
| 2 | Story Decomposition | ⏳ | 4-5h | ⭐ High |
| 3 | Character Recent Actions | ✅ | 1.5h | 🟡 Med |
| 4 | Narrative Tone Info | ⏳ | 1h | 🟡 Med |
| 5 | Game State Header | ⏳ | 1-1.5h | 🟡 Med |
| 6 | City Selector Dropdown | ⏳ | 1h | 🟡 Med |
| 9 | Board Header Styling | ⏳ | 0.5h | 🔵 Low |
| 10 | Research/Design Layout | ⏳ | 1-1.5h | 🔵 Low |
| 11 | Cities List Icons | ⏳ | 1.5-2h | 🟡 Med |
| 12 | Status Styling Unify | ⏳ | 1.5-2h | 🟡 Med |
| 13 | City Board Authoring | ⏳ | 3-4h | ⭐ High |
| 7 | Google Maps Links | ⏳ | 1-2h | 🔘 Backlog |
| 8 | Map Component | ⏳ | 2-3h | 🔘 Backlog |

---

## Session Notes

- **Chat 1 Focus:** Data structure consolidation (Tasks 1, 2, 13)
- **Chat 2 Focus:** Features & polish (Tasks 3-6, 11-12)
- **Chat 3+ Focus:** Backlog items, integration testing

## Quick Start for Next Session

If resuming: Pick the highest-priority incomplete task and read its details above. All context is preserved.

**To check progress:** Search this file for task # or title.

**To update:** Mark with `✅` when complete, update "Last Updated" date at top.

# Recovery Queue - Milestone 2-4 Work Items

This queue documents the feature improvements and deferred work items identified from the accessibility-follow-through branch analysis (2026-04-05).

## Priority 1: Editor UX Cleanup

**Goal:** Make content editors feel consistent and easier to scan

**Open items:**
- Move `Add role` into the `[type] roles` panel header
- Add `remove role` and `reset role` actions to RoleCatalogPage
- Combine traits and verbs into inline tag-style editors (✅ partially done with AutocompleteTagList)
- Keep full-page scrolling as default where practical
- Simplify Cities column to name + count display
- Keep city overview visually distinct from district records
- Add helpful sort options for Cities and Roles pages
- Add clearable search controls (consider ClearableSearchField component reuse)
- Keep district detail editor anchored while list scrolls
- Add London as a sample city record

**Why this is a slice:** Moves the app toward one readable list/detail editing pattern without changing core gameplay

**Impact on haiku:** AutocompleteTagList + tag sizing already done; remaining items are UI/UX polish

---

## Priority 2: Match Style and Assets

**Goal:** Give the app a clean way to review piece styling, piece art, and CSS references

**Open items:**
- Change light/dark toggle to only show icon for the mode it will switch to
- Add a page for piece art assets and HTML/CSS styling used on them
- Add configurable style options for pieces and notable states
- Allow direct CSS styles to be shared with the app
- Add file-backed way to save CSS styles for future reference

**Why this is a slice:** User wants controlled styling reference surface, not core chess redesign

**Current state:** Piece styles are in `content/styles/piece-styles.css`; app has theme toggle but not asset review page

---

## Priority 3: Layout and Settings Recovery

**Goal:** Make local layout behavior easier to reset and more predictable

**Open items:**
- Add option to remove local layout files and return to default settings
- Improve error handling for corrupted layout persistence

**Why this is a slice:** Layout persistence is already in place; this is small but useful management

**Current state:** Layout state saved to localStorage; no recovery/reset UI yet

---

## Priority 4: Research Page Organization

**Goal:** Separate research content by purpose instead of one undifferentiated list

**Open items:**
- Add tabs for `Competition`, `Art assets`, and `Style reference`

**Why this is a slice:** Research page exists; mostly information architecture cleanup

**Current state:** Single research page showing competitive-analysis and reference games mixed

---

## Priority 5: Docs Follow-up

**Goal:** Keep PRD and usage guidance in sync with product direction

**Open items:**
- Review app state against PRD (see prd-gap-review.md)
- Maintain user-suggestions note for better agent splits
- Keep recovery queue current

**Why this is a slice:** Docs keep next implementation steps obvious when interrupted

---

## Cross-Cutting Observations

From prd-gap-review.md:

1. **Chess-first principle slipping:** App shell reads more like tool dashboard than chess experience. PRD says chess clarity leads, utilities support it.

2. **Content editor unification incomplete:** Cities, Roles, Classics, Research have useful content but editing chrome not unified. PRD prefers reviewed, structured content with small number of clear authoring patterns.

3. **Layout editor scope creep:** Layout editor, files, named saves are practical but beyond MVP scope. Keep as support features, not product center.

4. **Accessibility needs framing:** Better but PRD still implies clean, readable play surface. Keyboard behavior and semantics should be acceptance criteria, not polish.

5. **Style assets need context:** Valuable but not core gameplay. Frame as content/reference tooling.

## Recommended Next Actions

1. **Immediate (continuing haiku work):**
   - Test keyboard shortcuts and map mode in running app
   - Verify district labels display correctly with view mode toggle
   - Add London board data entry for testing

2. **Short term (Priority 1 slice):**
   - Simplify Cities editor column display
   - Add clearable search to Roles and Cities pages
   - Add sort options for both editors

3. **Medium term (Priority 2-3 slices):**
   - Create DesignPage for piece styles and CSS reference
   - Add research page organization with tabs
   - Add layout reset/recovery UI

4. **Alignment task:**
   - Review current app against prd-gap-review.md findings
   - Consider PRD v2 draft recommendations

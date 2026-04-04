# Prompt Audit - 2026-04-05

This audit reviews the main Codex session log from `2026-04-04`, checks the user prompts against the current repo state on `codex/milestone-1-vertical-slice`, and turns any incomplete asks into a fresh queue.

## Completed Prompt Groups

These prompt groups are complete in the current repo state:

1. Repo bootstrap and orientation
   - `review the explore folder`
   - `set up a local git repo`
   - `readme pass`
   - Result: repo initialized, README updated, and the early-state review was completed.

2. Milestone 1 playable chess slice
   - `proceed, focus on Milestone 1`
   - `can I test what you've done?`
   - Result: the app now has legal local chess, move history, undo, status, study mode, and a runnable web app.

3. PGN and classic-game study support
   - `load, or paste in chess notation`
   - `do it`
   - Result: study mode, PGN import, built-in classic games, and step-through controls are present in [StudyPanel.tsx](/C:/workspace/narrative-chess/apps/web/src/components/StudyPanel.tsx) and [ClassicGamesLibraryPage.tsx](/C:/workspace/narrative-chess/apps/web/src/components/ClassicGamesLibraryPage.tsx).

4. Match-page layout and visual polish rounds
   - header sizing and subtitle removal
   - side-by-side move and narrative panels
   - smaller board and better piece contrast
   - 3-column match layout
   - hover details for tile and character info
   - square board corners
   - Result: these landed across [App.tsx](/C:/workspace/narrative-chess/apps/web/src/App.tsx), [Board.tsx](/C:/workspace/narrative-chess/apps/web/src/components/Board.tsx), and [styles.css](/C:/workspace/narrative-chess/apps/web/src/styles.css).

5. Role catalog and classics library expansion
   - editable role catalog
   - left-to-right drill-down for piece family to role detail
   - classics page with history, significance notes, and a seeded game list
   - add 10-20 games, including the Bongcloud item
   - Result: role editing is in [RoleCatalogPage.tsx](/C:/workspace/narrative-chess/apps/web/src/components/RoleCatalogPage.tsx), and the classics library now contains 20 games in [classic-games.json](/C:/workspace/narrative-chess/content/games/classic-games.json).

6. Match shell controls and persistence
   - collapsible non-board panels
   - layout edit mode with drag, resize, and snap grid
   - header menu and settings
   - dark theme toggle
   - named workspace layout saves
   - Result: these are present in [App.tsx](/C:/workspace/narrative-chess/apps/web/src/App.tsx), [LayoutToolbar.tsx](/C:/workspace/narrative-chess/apps/web/src/components/LayoutToolbar.tsx), [AppMenu.tsx](/C:/workspace/narrative-chess/apps/web/src/components/AppMenu.tsx), and [fileSystemAccess.ts](/C:/workspace/narrative-chess/apps/web/src/fileSystemAccess.ts).

7. Cities page and local file-backed editing
   - `Add a page to the site with info about Edinburgh and districts`
   - `Provide a way to save data and updates I make`
   - `Rename Edinburgh to Cities`
   - Result: the Cities workspace and repo-local draft save flow are present in [EdinburghReviewPage.tsx](/C:/workspace/narrative-chess/apps/web/src/components/EdinburghReviewPage.tsx) and [fileSystemAccess.ts](/C:/workspace/narrative-chess/apps/web/src/fileSystemAccess.ts).

8. Research and competitive analysis
   - `Do some research on chess games`
   - `add a page to the app with photo/screenshot reference`
   - Result: the research page is present in [CompetitiveLandscapePage.tsx](/C:/workspace/narrative-chess/apps/web/src/components/CompetitiveLandscapePage.tsx).

9. Queue rebuild and usage-limit recovery
   - `Review this log`
   - `Rebuild the queue and return to the tasks`
   - Result: the recovery work landed, and the rebuilt queue lives in [queue.md](/C:/workspace/narrative-chess/docs/queue.md).

10. First accessibility follow-through
    - design and accessibility review agents requested
    - board keyboard movement requested indirectly by the review findings
    - Result: board arrow-key navigation and panel semantics are now in [boardNavigation.ts](/C:/workspace/narrative-chess/apps/web/src/boardNavigation.ts), [Board.tsx](/C:/workspace/narrative-chess/apps/web/src/components/Board.tsx), and [Panel.tsx](/C:/workspace/narrative-chess/apps/web/src/components/Panel.tsx).

## Partially Completed Or Still Open

These prompts are not fully complete yet:

1. `Provide a similar format for city details, we'll want some common patterns for updating information`
   - Status: partial
   - Why: Cities now have the same broad three-pane structure, but [EdinburghReviewPage.tsx](/C:/workspace/narrative-chess/apps/web/src/components/EdinburghReviewPage.tsx) still uses a custom shell while [RoleCatalogPage.tsx](/C:/workspace/narrative-chess/apps/web/src/components/RoleCatalogPage.tsx) and [ClassicGamesLibraryPage.tsx](/C:/workspace/narrative-chess/apps/web/src/components/ClassicGamesLibraryPage.tsx) share [IndexedWorkspace.tsx](/C:/workspace/narrative-chess/apps/web/src/components/IndexedWorkspace.tsx). The editing chrome, save strip, density, and validation patterns are still inconsistent.

2. `Add an agent to do accessibility feedback`
   - Status: partial follow-through
   - Why: the review happened, and the board now supports keyboard navigation, but the broader accessibility findings are still open. The remaining gaps are reflected in [queue.md](/C:/workspace/narrative-chess/docs/queue.md) and still include layout-editor keyboard support, stronger editor-page semantics, and broader live-region coverage.

3. `The overall site style is pretty amateur, can you stick with default shadcn styling and I can update later`
   - Status: partial
   - Why: the app moved toward a simpler shadcn-style baseline, but the current queue still flags design cleanup as open in [queue.md](/C:/workspace/narrative-chess/docs/queue.md). The product shell still reads more like a dashboard than a chess-first tool.

4. `keep going through as many milestones as you can`
   - Status: open-ended
   - Why: a lot of milestone work landed, but this was not a finite request. The sensible continuation is to finish the shared content-editor shell and accessibility/design cleanup before pushing further into broader city expansion.

## New Queue From Incomplete Prompts

1. Shared editor-shell cleanup
   - Goal: give Cities the same editing pattern quality as Roles and Classics.
   - Scope: move [EdinburghReviewPage.tsx](/C:/workspace/narrative-chess/apps/web/src/components/EdinburghReviewPage.tsx) onto the shared indexed workspace shell, standardize save/status strips, and align validation and selection behavior across all three editor pages.

2. Accessibility follow-through
   - Goal: finish the work implied by the accessibility review prompt.
   - Scope: add keyboard support or a deliberate fallback for layout editing, tighten page-switcher/settings semantics, improve live-region messaging, and keep board inspection usable without hover-only behavior.

3. Design cleanup and shell simplification
   - Goal: finish the remaining work behind the "default shadcn styling" request.
   - Scope: reduce dashboard noise, make Match feel more board-first, and tighten spacing and hierarchy across the editor pages.

4. Resume milestone progression after editor-shell stabilization
   - Goal: continue the broad "keep going" instruction in a safer order.
   - Scope: once the editor shell and accessibility baseline are stable, continue with city-system expansion instead of adding new surface area on top of inconsistent tools.

# PRD Gap Review - 2026-04-05

This note compares the current repo state against [docs/prd.md](./prd.md) and highlights the deviations that matter most before the next implementation push.

## Important Deviations

- The app shell still reads more like a tool dashboard than a chess-first experience. The PRD says chess clarity should lead, with utility pages and editor surfaces supporting the game rather than competing with it.
- Cities, Roles, Classics, and Research are useful, but the editing chrome is not yet fully unified. The PRD prefers reviewed, structured content with a small number of clear authoring patterns.
- The layout editor, layout files, and named file save behavior are practical additions, but they are further into workspace tooling than the original MVP scope. They should remain support features, not the product center.
- The current accessibility state is better, but the PRD still implies a clean, readable play surface. Keyboard behavior and semantics for editor flows should be treated as acceptance criteria, not polish.
- The style-asset and CSS-sharing ideas are valuable, but they are not core gameplay. They need to be framed as content/reference tooling.

## What To Carry Forward

- Keep Match board-first and reduce persistent chrome where possible.
- Standardize Cities, Roles, and Classics around one reusable editor shell.
- Prefer page scrolling over nested scroll regions unless a sub-pane is clearly the better chess or editing experience.
- Treat research, assets, and style references as reviewable support content.
- Document any new authoring workflows explicitly so they do not drift into hidden app logic.

## Suggested PRD Updates

- Add an explicit section for supporting authoring tools: research, style references, and asset review.
- Add acceptance criteria for shared editor-shell consistency across content pages.
- Make accessibility and keyboard interaction explicit for layout editing and board inspection.
- Clarify that the app can grow utility pages, but the primary user fantasy remains a playable chess match with narrative context.

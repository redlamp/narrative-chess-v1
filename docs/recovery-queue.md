# Recovery Queue - 2026-04-05

This queue collects the user prompts that were interrupted by usage-limit failures and are still open after the current codebase state is reviewed.

## 1. Editor UX cleanup

Goal:
- make the content editors feel consistent and easier to scan

Open items:
- move `Add role` into the `[type] roles` panel
- add `remove role` and `reset role` actions
- combine traits and verbs into inline tag-style editors instead of split preview panels
- keep full-page scrolling as the default where practical
- simplify the Cities column to name plus count
- keep the city overview visually distinct from district records
- add helpful sort options for Cities and Roles
- add clearable search controls where repeated search fields exist
- make the district detail editor stay near the top while the list scrolls
- add London as a sample city record

Why this is a slice:
- these changes all move the app toward one readable list/detail editing pattern without changing core gameplay

## 2. Match style and assets

Goal:
- give the app a clean way to review piece styling, piece art, and CSS references

Open items:
- change the light/dark toggle so it only shows the icon for the mode it will switch to
- add a page for piece art assets and the HTML/CSS styling used on them
- add configurable style options for pieces and notable states
- allow direct CSS styles to be shared with the app
- add a file-backed way to save those CSS styles so future passes can reference them

Why this is a slice:
- the user wants a controlled styling reference surface, not a redesign of core chess logic

## 3. Layout and settings recovery

Goal:
- make local layout behavior easier to reset and more predictable

Open items:
- add an option to remove local layout files and return to default settings

Why this is a slice:
- layout persistence is already in place, so this is a small but useful management pass

## 4. Research page organization

Goal:
- separate research content by purpose instead of keeping it in one undifferentiated list

Open items:
- add tabs for `competition`, `Art assets`, and `style reference`

Why this is a slice:
- the research page is already present, so this is mostly an information architecture cleanup

## 5. Docs follow-up

Goal:
- keep the PRD and usage guidance in sync with the product direction

Open items:
- review the current app state against the PRD and carry the resulting deviations into the revised draft
- maintain the user-suggestions note for better agent splits and prompt efficiency

Why this is a slice:
- the docs should keep the next implementation steps obvious when usage limits interrupt a run

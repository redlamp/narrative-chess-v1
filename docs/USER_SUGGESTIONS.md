# User Suggestions

## Useful Agent Roles

- `Editor Shell Agent`: keep Cities, Roles, and Classics aligned on one reusable list/detail pattern.
- `Accessibility Agent`: focus on keyboard paths, focus order, live regions, and semantics.
- `Docs Agent`: maintain the queue, PRD notes, and recovery logs when usage limits interrupt coding.
- `Content Agent`: work on JSON content, research references, and reviewed editor data.
- `UI Polish Agent`: make shell density, spacing, and hierarchy feel chess-first without changing core logic.

## Prompt Efficiency Tactics

- Keep each prompt to one visible outcome, one folder boundary, and one validation target.
- Ask for a branch and commit per slice so interrupted work is easy to recover.
- Prefer file names or component names over broad descriptions like "the whole UI."
- When the task spans multiple surfaces, ask for the smallest shared contract first, then split implementation.
- If usage limits are a risk, ask for a docs queue entry up front so the next run can resume cleanly.
- Ask for a short final report with `summary`, `files changed`, `assumptions`, `schema changes`, and `branch + commit hash`.

## Recovery Habits

- Put failed prompts into a durable queue doc immediately.
- Use one integration branch and separate feature branches for parallel slices.
- Keep docs changes separate from app changes when possible.
- Re-run `lint`, `typecheck`, `test`, and `build` only after the slice is merged or otherwise stable.

## Good Prompt Shape

- "Change X in these files, keep Y behavior, and report Z."
- "Review these pages against the PRD, then turn open gaps into a queue."
- "Split this into 2-3 bounded branches if that reduces risk."

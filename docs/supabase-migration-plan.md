# Supabase Migration Plan

Last updated: April 18, 2026
Status: Proposed plan
Main target: Milestone 2 + Milestone 6

## Big Idea

Problem now:

- app save many place
- browser
- file save
- checked-in repo content
- deployed site

These drift. User not know true thing.

Plan:

- keep frontend on GitHub Pages
- use Supabase as main truth for shared content and durable saves
- keep local browser state as working draft or cache
- keep file save as export / backup / import, not main truth

Vercel not needed now.

## Why Supabase

Need now is not hosting. Need now is save sanity.

Supabase gives:

- Postgres as one canonical source
- auth when editor login needed
- storage for exports or later assets
- future path for version history
- future path for collaboration if project grows

This fits repo pain better than changing host.

## What Stay In Scope

- make clear what data is canonical
- add draft vs published rules
- move important content away from browser/file confusion
- keep current local-first editing feel
- do migration in pieces, not giant rewrite

## What Stay Out Of Scope

- multiplayer
- realtime collaboration
- giant CMS rebuild
- moving off GitHub Pages
- replacing every local save right away
- broad schema redesign with no clear reason

## Main Decisions

- Supabase is source of truth for shared authored data
- GitHub Pages stays host for now
- DreamHost can handle DNS only if custom subdomain wanted
- `content/` files become seed/export/backup after migration

Example:

- `narrative.example.com` can point to GitHub Pages
- app can still talk to Supabase

## Ownership Rules

### Local only for now

These can stay local:

- panel layouts
- personal workspace setup
- view mode
- local piece-style experiments unless user explicitly promotes them

### Move to Supabase

These should become canonical in DB:

- cities
- districts
- role catalog
- authored character overrides
- reference/classic games
- durable saved matches for signed-in users

### File saves after migration

File saves still useful, but for:

- export
- backup
- import
- editorial review

Not main truth.

## Draft Words Must Be Clear

Use these words:

- `local_draft`
  - only in browser
  - not synced yet
- `remote_draft`
  - saved in Supabase
  - not live
- `published`
  - live version Play and Cities should use publicly

Important rule:

- saved does not mean published

No silent publish.

## Current Save System To Replace

Important files now:

- [cityReviewState.ts](/abs/path/c:/workspace/narrative-chess/apps/web/src/cityReviewState.ts:1)
- [fileSystemAccess.ts](/abs/path/c:/workspace/narrative-chess/apps/web/src/fileSystemAccess.ts:1)
- [savedMatches.ts](/abs/path/c:/workspace/narrative-chess/apps/web/src/savedMatches.ts:1)

Important truth now:

- city boards already have local idea of `published` / `saved` / `draft`
- but "saved" still means browser/file world, not backend truth
- saved matches are localStorage only
- role catalog and classic games still rely on browser and file flows a lot

Good news:

- UI language already partly exists
- migration can keep mental model, just change where truth lives

## Rollout Order

Do not move all at once.

### Phase 0: Name things right

Goal:

- define persistence words and contracts first

Need:

- clear canonical vs local draft rules
- clear sync status words
- clear rule for what reads published vs edits draft

Implementation rule:

- prefer small explicit types
- do not invent broad new architecture first

### Phase 1: Cities first

Why:

- strongest authoring surface now
- biggest visible save pain
- Play depends on city data being correct

Need:

- Supabase tables for cities and city versions
- Cities page edits remote draft
- explicit publish action
- explicit reset-to-published action
- Play can later read published city data

UI target:

- Cities edits draft
- public Play uses published
- later maybe add editor-only draft preview

### Phase 2: Roles and character foundation

Why:

- user wants deeper city + character tools
- role content already exists

Need:

- move role catalog persistence to Supabase
- add narrow authored character override path

Character rule:

- keep lightweight
- no giant proc-gen identity system
- authored override fields can stay simple:
  - name
  - role
  - district
  - faction
  - traits
  - verbs
  - one-line summary
  - review/status metadata

### Phase 3: Reference games and saved matches

Need:

- remote reference game persistence
- remote saved matches for signed-in users

Okay first pass:

- signed-in users get remote saves
- anonymous users can keep local saves

### Phase 4: Cleanup old paths

Need:

- stop presenting folder save as main workflow
- keep export/import
- stop assuming bundled JSON is live source after entity migrates

## Data Shape

Keep first version simple.

### `cities`

Use for stable city identity.

Suggested fields:

- `id`
- `slug`
- `name`
- `country`
- `created_at`
- `updated_at`

### `city_versions`

Use for draft and published city board records.

Suggested fields:

- `id`
- `city_id`
- `version_number`
- `status`
- `board_payload` JSONB
- `created_by`
- `created_at`
- `published_at`
- `notes`

Rule:

- never overwrite published in place
- use versions

### `roles`

Use for stable role identity.

Suggested fields:

- `id`
- `piece_kind`
- `name`
- `created_at`
- `updated_at`

### `role_versions`

Use for role draft/published history.

Suggested fields:

- `id`
- `role_id`
- `status`
- `payload` JSONB
- `created_by`
- `created_at`
- `published_at`

### `characters`

Use for authored overrides, not giant generation system.

Suggested fields:

- `id`
- `city_id`
- `piece_key` or similar anchor
- `status`
- `payload` JSONB
- `created_by`
- `created_at`
- `updated_at`

### `reference_games`

Use for stable study identity.

Suggested fields:

- `id`
- `slug`
- `title`
- `created_at`
- `updated_at`

### `reference_game_versions`

Use for study content versions.

Suggested fields:

- `id`
- `reference_game_id`
- `status`
- `payload` JSONB
- `created_by`
- `created_at`
- `published_at`

### `saved_matches`

Use for durable player saves.

Suggested fields:

- `id`
- `user_id`
- `name`
- `snapshot_payload` JSONB
- `move_count`
- `created_at`
- `updated_at`

## Why Version Tables

Need:

- draft vs published
- revision history later
- safer publish flow
- rollback

So version tables better than only one mutable row.

## Schema Strategy

Start simple:

- keep validation in `packages/content-schema`
- store first payloads as JSONB
- validate with Zod on app side
- normalize later only when real query need appears

Important rule:

- do not casually change shared schemas
- if agent changes `packages/content-schema`, agent must say so clearly

## Auth Strategy

Start narrow:

- use Supabase Auth
- editor login for write actions
- public can read published data if needed
- remote saved matches for signed-in users first

Not needed yet:

- social login
- full multi-user account system
- complicated org roles

Small email magic-link setup enough at first.

## API Strategy

First pass:

- frontend talks to Supabase directly
- use RLS for access control
- do not build custom API layer unless clearly needed

Use Edge Functions only for things like:

- privileged publish action
- import/export jobs
- migration helpers
- complex validation jobs

Do not start with Edge Functions for plain CRUD.

## Frontend Integration Rule

Do not spray Supabase calls through giant React components.

Make small adapters in `apps/web`, for example:

- `loadPublishedCity`
- `loadEditableCityDraft`
- `saveRemoteCityDraft`
- `publishCityDraft`
- `resetCityDraftToPublished`

Good rule:

- local component state for immediate editing
- optional localStorage for unsynced buffer
- explicit save to Supabase

This keeps editor fast and lowers regression risk.

## Play Surface Rule

After city migration:

- public Play should read published city data
- keep bundled JSON fallback during rollout

Can use simple source flag during transition.

Do not switch all city reads at once until verified.

## Migration Mechanics

### Seed plan

For each content family:

1. export current checked-in content
2. import to Supabase as first published version
3. keep provenance metadata if useful
4. keep repo content as seed/export until stable

### Import/export plan

Keep import/export, but demote it.

Use export for:

- backup
- review
- optional repo sync

Use import for:

- bootstrap
- manual restore

## Testing Plan

Add tests around logic changes.

Main cases:

- no remote draft
- save remote draft
- publish draft
- reset draft to published
- Play reads correct published city
- fallback works when backend not ready or unavailable
- saved matches still work during transition

## Risks

### Scope bloat

Fix:

- cities first
- no realtime now
- no multiplayer now

### Big editor regressions

Fix:

- hide backend behind adapters
- avoid giant component rewrites

### Schema churn

Fix:

- JSONB first
- Zod contracts stay source of truth

### Login behavior unclear

Fix:

- decide early if remote saves require login
- if unclear, make remote saves login-only first

## Agent Work Split

### Agent 1

Define persistence contracts and adapter interfaces.

Target:

- `apps/web`
- `packages/content-schema` only if truly needed

### Agent 2

Add Supabase client setup and city persistence adapters.

Target:

- `apps/web`

### Agent 3

Wire city draft/publish UI without giant rewrite.

Target:

- [EdinburghReviewPage.tsx](/abs/path/c:/workspace/narrative-chess/apps/web/src/components/EdinburghReviewPage.tsx:1)
- related city editor files

### Agent 4

Seed current city content into Supabase and document import flow.

Target:

- `content/`
- migration docs or scripts

### Agent 5

Migrate role catalog persistence.

Target:

- `apps/web`

## Best First Build Order

If build starts now:

1. define city persistence contract
2. create `cities` and `city_versions`
3. seed Edinburgh as first published city
4. wire Cities editor to remote draft
5. add publish/reset actions
6. keep Play on bundled content until verified
7. then switch Play to published remote city reads

This keeps Milestone 2 safer while moving Milestone 6 forward.

## User Answers Still Needed

These choices matter:

1. Remote saved matches need login, or anonymous cloud save too?
2. One editor now, or multiple editors soon?
3. Should `content/` stay part of normal editing workflow, or become seed/export/backup only?
4. Public Play use published only, or should private editor preview load drafts too?

## References

- [PRD.md](/abs/path/c:/workspace/narrative-chess/docs/PRD.md:1)
- [cityReviewState.ts](/abs/path/c:/workspace/narrative-chess/apps/web/src/cityReviewState.ts:1)
- [fileSystemAccess.ts](/abs/path/c:/workspace/narrative-chess/apps/web/src/fileSystemAccess.ts:1)
- [savedMatches.ts](/abs/path/c:/workspace/narrative-chess/apps/web/src/savedMatches.ts:1)

# Nested containers implementation

Approved design: containers are special inventory items, displayed as photo cards with a folder badge and a count. Opening a card reveals an adjacent contents panel. Nested navigation uses breadcrumbs (Bedroom → Cabinet → Drawer → Camera); small screens stack the panel below its card. Locations and containers both allow loose items.

## Data and persistence

Add `container` to item kinds and a nullable `parent_container_id` self-reference. Root records use `location_id`; children use only their parent. Derive location and full path through ancestors. Preserve owner isolation and optimistic versions. Reject cycles, foreign owners, non-container parents, conversion of occupied containers, and deletion of occupied containers. Moving a parent changes inherited locations without rewriting children. Duplicate containers are empty copies.

Use an authenticated complete inventory snapshot so the existing 200-result search cap cannot hide ancestors or contents. Update search/Ask to include paths. Connect the current dashboard to saved records through its existing repository boundary. Keep sample inventory explicitly available at `/demo`. Stored photo paths are allowed; uploaded demo photos remain session-only until image storage is separately configured.

## Execution

- [x] Add database and domain tests for nesting, moves, validation, ownership, deletion, and path-aware search.
- [x] Add a forward migration, hierarchy helpers, repository hydration, complete snapshot, and API validation.
- [x] Add container cards/panels, creation, destination selection, safe removal, and nested breadcrumbs. Preserve existing editing and Jarvis controls.
- [x] Connect authenticated loading and mutations; show pending, save failures, and setup/sign-in states accurately.
- [x] Test database invariants, browser interactions and save/reload behavior; run lint, TypeScript, tests, and build.
- [ ] Inspect desktop and narrow layouts in the Codex preview; the local preview surface was unavailable during this pass because of the environment usage-limit gate.

Database deployment is separate from application code. Apply only to an identified configured target; if no migration connection is available, deliver the tested migration with explicit setup instructions and report that hosted persistence remains unverified.

# Verification record

## Saved-data readiness and refinement plan — 2026-10-14

- Local configuration has a hosted Supabase URL/public key and a Google provider configured. Values were inspected only for presence/type, never printed. Neither disposable smoke-account pair is configured; there is no confirmed staging designation, local Vercel linkage, Vercel CLI, Supabase CLI, or hosting token available.
- Read-only hosted Auth settings returned 200 with email authentication enabled. Zero-row PostgREST metadata checks for `locations.parent_location_id` and `locations.version` each returned 400 / `42703`; the creation-request ledger returned 404 / `PGRST205`. The configured target does not expose the schema this working tree requires. These are schema-readiness observations, not authenticated persistence or isolation verification. No inventory rows were retrieved and no external writes were made.
- GitHub reports a successful Vercel status for the last pushed boundary, `e127e4a`, linked to [its deployment dashboard](https://vercel.com/papertops-projects/inventory/9s7JH8QCAWdNfKapmg1R1ZLnZ1wW). This establishes that deployment's status, not the version currently served by an alias. The latest source remains uncommitted/unpushed; no current hosted URL/version has been established.
- Opening that exact deployment dashboard in the available browser redirected to Vercel login. No authenticated hosting session was available there; no login, account creation, plugin connection or hosting changes were attempted.
- Synthetic-only live provider checks exposed an intermittent short camping-request fallback. Sanitized diagnostics identified an oversized `search_inventory.query`, rejected by the existing 200-character guard; the model-facing schema had not advertised that bound. The schema now includes the same limit, and invalid read-only search arguments return corrective tool feedback without executing a search. The model may correct them only within the unchanged four-turn/time budget. Deterministic regressions cover recovery and repeated-invalid exhaustion; final answer/citation validation and truthful fallback remain intact. No private inventory was sent and temporary diagnostics were removed. Independent live retest results are recorded in `design-qa.md`.

Before hosted verification or release:

1. Identify an existing designated test/staging Supabase project and app URL, confirm the deployed commit, and supply one disposable confirmed account (two for ownership/isolation checks) through local secret configuration, not chat. Do not use real-user accounts or production data for smoke writes.
2. Inspect that target's applied migration history and take a recoverable backup. Reconcile every prerequisite in chronological order: inventory, containers, private photos, space management, lost-status removal, dashboard activity, then `202610130001_rooms_creation.sql`. The new migration remains unapplied by this team. Get explicit schema-migration authority before applying it; no automatic down migration is provided.
3. Verify the target exposes Room parents/location versions, sibling uniqueness, the creation-request ledger and creation RPCs. Use the designated disposable accounts for minimal temporary Space/Room/container/item records: draft cancellation must write nothing; explicit Add must persist; retries must not duplicate or resurrect deleted records. Check fresh-load persistence, inherited paths, stale-write conflicts, and cross-owner isolation. Clean up only the exact records created by this run.
4. Verify complete Jarvis scope pagination, duplicate-location choices, changed-revision restart and packing followups through the authenticated deployed app. The existing `test:supabase` script tests direct Auth/table/search operations but does not alone establish these app/Room/idempotency flows. Provider checks must use fabricated inventory unless private-data submission is separately authorized.
5. Run the local release gate, then obtain separate commit/push/deployment authority. Verify the deployed version, redirects/authentication and the same saved-data flows after rollout. Use backup/forward-fix recovery if needed; preserve all real records.

Hosted saved-data verification is blocked on the designated target, disposable accounts, migration readiness and release authority. Local mocked-session and embedded PostgreSQL coverage remains useful but does not substitute for hosted Auth/PostgREST/browser behavior.

## Inline Jarvis and container controls — 2026-10-13

- Platform ran `npm run release:check` on the combined completed changes: formatting, ESLint, TypeScript, 234 tests passed (4 opt-in tests skipped), and the Next.js production build passed. `git diff --check` also passed.
- The release includes Dashboard-only inline Jarvis, preserved conversation and draft state, subdued composer keyboard focus, visible root/nested container creation controls and validation, and sidebar container selection by stable item ID.
- Frontend and QA accepted the component and workflow regressions; Designer accepted desktop/mobile inline conversation layout. Detailed browser evidence is in `design-qa.md`.
- This release adds no backend migration. Platform did not run live-service smoke tests, apply a live migration, or manually deploy the application.

## Account flow — 2026-09-16

- ESLint, TypeScript, 184 automated tests, production build, and formatting checks passed. Four opt-in live-model tests were skipped.
- Coverage includes signup/password validation, confirmation/resend/errors, login/loading/retry, logout failures, account isolation, and ignoring delayed chat, upload, or queued writes after leaving an account.
- Browser checks confirmed the sign-in and signup dialog opens over the sample workspace; the narrow viewport keeps the form scrollable. Static code review found no important issues.
- Real signup, email delivery, and a hosted authenticated session were not exercised. Verify those with your own account after configuring the Supabase confirmation template and redirect URL described in README.

## Release preparation — 2026-09-16

- `npm run release:check` passed formatting, ESLint, TypeScript, 162 automated tests, and the production build. Four opt-in live-model tests were skipped. The two previously reported Jarvis formatting issues are resolved.
- Local Supabase URL and publishable-key values are now populated. `.env.local` remains ignored and is excluded from the commit. A scan of commit candidates found no configured credentials or recognizable secret keys.
- Hosted authentication, migration deployment, and photo storage still require live verification; passing the local release checks does not establish that the Supabase integration deployed successfully.

## Private photo storage — 2026-09-16

- `npm run check` passed ESLint, TypeScript, and 162 automated tests; four opt-in live-model tests were skipped. `npm run build` passed and includes `/api/items/[id]/photo`.
- New coverage verifies private-path hydration after a fresh load, upload and version-conflict failures, edits queued during a slow upload, refreshing a photo changed in another session, sample-mode isolation, private image rendering without the image optimizer, and empty-location accounts.
- The photo migration was executed in PGlite with a minimal Supabase Storage schema fixture. Real PostgreSQL policies reject anonymous/foreign reads and uploads, foreign changes/deletes, invalid paths, and object overwrites. The fixture checks bucket size/MIME configuration; it does not emulate the Storage HTTP service's enforcement.
- Local browser verification uploaded the bundled camera asset to a sample item. The photo decoded successfully, the session-only notice appeared, and reloading restored the sample photo as intended. The browser reported no warnings/errors during this check.
- `git diff --check` and `node --check scripts/smoke-photos.mjs` passed. Changed photo files were formatted. The repository-wide formatting check still flags the unrelated `src/components/jarvis-chat.tsx` and `tests/jarvis-chat.test.tsx` files; these were not reformatted by this task.
- Both public Supabase environment values remain blank. The new migration has **not** been applied to a hosted project, and real signed-in uploads, cross-device reads, and Storage service isolation remain unverified. No external inventory/photo data was uploaded.
- `npm run test:photos` is ready for a configured project and two disposable accounts. It uses synthetic image data and cleans up its own records/objects. See the README for setup and the additional signed-in browser check.
- Replaced/deleted-item photos and orphan uploads remain private in Storage; automatic cleanup is deferred to avoid deleting shared references or uploads whose save response was lost. This retention limitation is documented in the README.

## Jarvis demo and item editing — 2026-09-15

- `npm run check` passed lint, TypeScript, and 127 automated tests. Two opt-in model tests are skipped by the regular suite.
- `npm run build` passed, including `/api/ask/local` and the authenticated API routes.
- Live browser verification with bundled sample records and a synthetic tent: Jarvis created an item, renamed it, added a tag, opened its details, and used the new item in a camping answer.
- Focused Jarvis input inspected in the browser: computed outline and box shadow are both `none`.
- Regression coverage includes semantic demo retrieval, bounded tool loops, unknown citations, create/edit argument validation, packing-list revisions, version conflicts, storage-source transitions, full-description preservation, saved API success/failure, and partially completed saved batches.
- The native Google adapter successfully completed a synthetic model/tool round trip. Hosted Supabase remains unconfigured and has not been live-tested. Local sample items and chat are session-only.
- A further live camera-accessory query was blocked by automatic approval review because it classified the inventory payload as private. Camera and accessory retrieval were verified through local automated tests instead; no alternate external submission was made.
- Item IDs are validated against retrieved records. Model-written prose can still misstate details; the clickable inventory cards show the source records.

## Current setup verification — 2026-09-14

Verified with Node.js 22.20.0 against the current working tree:

- `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, and `npm run build` passed. The full suite is 78 tests across 9 files.
- `git diff --check` passed.
- `.env.local` was created from `.env.example` with owner-only read/write permissions. Supabase values remain blank; `AI_PROVIDER=search` is the default.
- Git ignores `.env.local` and Vercel's local project metadata.
- `.nvmrc` selects Node 22. Existing GitHub CI already runs the release checks with Node 22.
- Git remote is `https://github.com/PaperTop/inventory.git`. Current working changes have not been committed or pushed by this setup pass.

The liquid dashboard now supports nested container cards, adjacent contents panels, inherited breadcrumbs, container placement, and authenticated API loading/mutations when Supabase is configured. With the local environment’s blank Supabase variables, verification used the labeled in-memory sample fallback; hosted persistence and authentication remain unverified. `/demo` redirects to `/`.

Hosted Supabase, email delivery, deployed authentication, and Vercel deployment were not verified. No Supabase configuration was available locally. Docker is installed, but its daemon was unavailable, and the Supabase CLI is not installed. The hosted smoke test requires a configured project and disposable confirmed account.

## Historical verification — 2026-09-13

Verified on 2026-09-13 with Node.js 22 and the versions pinned in `package-lock.json`.

## Automated checks

- `npm run check` passed ESLint, TypeScript, and all 45 Vitest tests across 6 test files.
- `npm run build` produced a successful Next.js production build, including the dashboard, demo, Auth callback, and all API routes.
- `npm run format:check` confirmed that all tracked source and documentation files match the project's Prettier rules.

The automated suite covers inventory validation and search, slot-grid presentation behavior, bounded read-only answers, the one-node LangGraph workflow, LangChain provider configuration and failure behavior, HTTP protections, and PostgreSQL schema/RLS behavior through PGlite.

The retro dashboard was also checked in the Codex in-app browser at desktop and mobile widths. Search, category filters, the item editor, and Ask Inventory were exercised with demo data, and the browser console reported no warnings or errors. See `design-qa.md` for the reference comparison.

## External checks after configuration

The following checks require services and credentials that are intentionally absent from the repository:

- Run `npm run test:supabase` against a disposable confirmed Supabase user to verify hosted Auth and PostgREST behavior.
- Sign up, confirm an email, and exercise two-user isolation in the deployed environment.
- If enabling local inference, start Ollama with the configured model and confirm that Ask returns cited answers before its 20-second timeout.
- If deploying to Vercel, verify the production Supabase redirect URL and test the deployed Auth callback.

The application defaults to `AI_PROVIDER=search`, so inventory CRUD, search, and Ask work without a model provider. Model access remains read-only and receives only the bounded records selected by application search.

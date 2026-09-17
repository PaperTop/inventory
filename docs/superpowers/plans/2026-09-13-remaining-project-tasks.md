# Inventory Remaining Work Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax for tracking.

**Goal:** Launch the existing private inventory app, add human-reviewed observations, and evaluate vision and retrieval improvements against measured needs.

**Architecture:** Supabase remains the source of truth and ownership boundary. Ask remains read-only. Observation evidence produces proposals; only explicit human approval can invoke a version-checked inventory update.

**Tech Stack:** Existing Next.js, React, TypeScript, Supabase/PostgreSQL, Zod, LangGraph, LangChain, Vitest, and PGlite; planned Vercel hosting.

**Spec:** [Detailed project plan](../../../planning/README.md), plus the user's five-phase roadmap. Phase numbering below follows the user's roadmap; the older guide uses different numbering.

This is a project-level task backlog, not code-level implementation instructions. Create a focused implementation plan for each subsystem when its work begins. All unchecked tasks remain planned; inspecting the repository did not verify deployed services or rerun application tests.

## Global constraints

- The manually confirmed inventory database is the source of truth.
- Derive authoritative ownership from verified authentication, never caller input.
- Keep row-level security, owner-matching references, and optimistic versions intact.
- AI cannot create, edit, or delete inventory.
- Keep automatic observation writes disabled until accuracy is measured and a separate automation decision is made.
- Keep model credentials server-only; use deterministic search initially in production.
- Before implementation, read applicable Next.js guidance in `node_modules/next/dist/docs/` as required by `AGENTS.md`.

## Current setup update (2026-09-14)

The backend baseline remains implemented, but the replacement liquid dashboard currently uses in-memory sample data and its own local Ask matching. Restore account screens and connect inventory, location, and Ask API calls before treating the app as a persistent MVP. `/demo` currently redirects to `/`. Node 22 is pinned in `.nvmrc`; `npm run release:check` runs the full local release gate. Hosted configuration and verification remain pending.

## Phases 1–2: backend baseline

Retain the completed MVP and read-only assistant described in the user's roadmap. Existing code includes authenticated inventory CRUD, lexical search, model adapters, bounded generation and citation validation, and deterministic fallback.

Phase 4 also has partial foundations: `inventory_observations`, its uniqueness constraint and RLS, and the pure `reconcile()` function. Extend these rather than rebuilding them.

## Phase 3: production setup — next

- [ ] **3.1 Establish the deployment repository and release checks.** Git is initialized with remote `https://github.com/PaperTop/inventory.git`. Review and commit the current working changes to establish a release candidate, excluding secrets and generated output. Retain `.github/workflows/ci.yml`; run `npm run check`, `npm run build`, and `npm run format:check`. Done when a reproducible release candidate passes checks and can be imported by the deployment service.
- [ ] **3.2 Connect hosted Supabase and apply the existing migration.** Configure the project URL and publishable key, apply `supabase/migrations/202609130001_inventory.sql`, and verify tables, RLS, constraints, and search RPC. Keep preview/test data separate from production. Done when the app can authenticate and persist owned records against the hosted database.
- [ ] **3.3 Configure email confirmation and Auth URLs.** Configure the confirmation template, development/preview callback URLs, and intended production callback. Exercise signup, confirmation, expired/invalid links, login, and logout through `src/app/auth/confirm/route.ts` and the existing auth UI. Done when valid confirmations establish a session and invalid links fail safely.
- [ ] **3.4 Extend hosted integration testing to two users.** Extend `scripts/smoke-supabase.mjs` or add a companion script using two disposable confirmed accounts. Test cross-user reads, edits, deletes, location references, search results, and Ask citations through the deployed app as well as database access. Verify stale writes and unauthenticated requests fail. Clean up only test-owned records. Done when both directions of isolation pass; the existing one-user smoke test alone is insufficient.
- [ ] **3.5 Add shared API rate limits and inference quotas.** Integrate limits at authenticated request boundaries in `src/lib/context.ts`/`src/lib/handlers.ts` and the Ask path. Use shared storage so limits hold across server instances. Specify limits in configuration, return `429` with retry guidance, and refuse hosted inference when its quota cannot be checked. Test concurrent requests, per-user separation, reset behavior, and storage failure. Done when excess traffic cannot bypass limits by reaching another instance.
- [ ] **3.6 Add audit logging and operational error visibility.** Record actor, action, resource ID, outcome, timestamp, and request correlation ID for inventory mutations, denied operations, and inference usage/failure. Exclude credentials and raw personal inventory/model payloads by default. Define access controls and retention; if persisted in database tables, add migration and RLS tests. Done when a successful mutation and a failed request can be traced without exposing another user's data.
- [ ] **3.7 Deploy to Vercel and finalize production Auth configuration.** Import the project, configure environment-specific variables, initially set `AI_PROVIDER=search`, deploy, and update the Supabase site/callback URLs to the actual HTTPS domain. Update `README.md` to use the current repository layout. Done when signup, confirmation, CRUD, search, and Ask work on the deployed URL.
- [ ] **3.8 Run the production release check and document recovery.** Repeat two-user isolation against production with disposable records. Check keyboard access, focus, form errors, mobile layout, and demo isolation. Record deployed verification in `docs/verification.md`; document application rollback and database backup/restore procedures for the chosen hosting setup. Done when launch checks pass and recovery steps are recorded.

**Dependencies:** 3.1–3.3 establish the hosted test environment; 3.4–3.6 must pass before public launch. 3.7 depends on the repository, database, Auth, and protections; 3.8 validates the resulting deployment. Rate limiting and logging can be developed while hosted setup proceeds.

**Release gate:** Real accounts work, cross-user access fails, shared limits and audit visibility work, and the deployed app passes smoke checks. Hosted inference remains optional and requires working quotas before enablement.

## Phase 4: camera observation review

- [ ] **4.1 Define the ingestion contract and producer authentication.** Extend `src/lib/reconciliation.ts` with a public input contract that excludes authoritative `user_id`; inject ownership server-side. Define event identity, source, timestamp, confidence, item/base version, patch, and bounded evidence metadata. Define how an external adapter authenticates without loosening browser write protections. Done when valid structured events are accepted by contract tests and owner spoofing, invalid patches, and unowned targets fail.
- [ ] **4.2 Persist review state and evidence references.** Add a new migration for proposals and review decisions, preserving the existing append-only observation model. Include pending, accepted, rejected, and conflict states, original/edited patches, reviewer, and decision time. Decide evidence retention when an item is deleted: the current observation foreign key cascades deletion. Done when ownership tests pass and review history survives according to the documented retention policy.
- [ ] **4.3 Implement authenticated, idempotent ingestion.** Add `src/app/api/observations/route.ts` and repository/handler support. Reuse `(user_id, source, source_event_id)` uniqueness; exact retries return the existing result, while a reused ID with different content is rejected. Validate destination ownership and persist evidence plus its proposal consistently. Done when concurrent duplicates create one event/proposal and ingestion never changes an inventory item.
- [ ] **4.4 Reconcile observations against current inventory.** Reuse `reconcile()` for version, quantity, time, confidence, owner, and identity checks. Persist reasons and handle deleted/missing targets explicitly. Done when stale, conflicting, low-confidence, and high-confidence events produce the expected review outcome, with zero automatic inventory writes.
- [ ] **4.5 Build the review queue.** Add an authenticated queue page and focused review components, with paginated owned proposals and filters for review state. Show current values beside proposed changes, confidence, observation time, evidence references, and conflict reasons. Done when users can inspect their proposals on desktop/mobile and cannot access another user's queue.
- [ ] **4.6 Implement accept, edit, and reject decisions.** Add a review-decision endpoint and an atomic database operation that checks ownership, pending state, and the current item version. Accept applies the confirmed patch once; edit validates and previews the final patch before confirmation; reject records a decision without changing inventory. A race or stale version returns a conflict requiring fresh review. Done when concurrent/double approval cannot apply a change twice or leave inventory and review state inconsistent.
- [ ] **4.7 Validate the complete review loop and instrument outcomes.** Test event replay, restart persistence, cross-user access, stale approval, invalid destination, rejection, and edited approval. Record acceptance, edit, rejection, conflict, and review-time metrics with reason codes. Distinguish user preference from actual false matching. Done when a synthetic observation can travel through ingestion and review to exactly one confirmed update, and outcomes can support later evaluation.

**Dependencies:** 4.1 → 4.2 → 4.3–4.4 → 4.5–4.6 → 4.7. Complete production security first. Use ordinary durable database state for the queue; if orchestration introduces resumable LangGraph pauses, include a persistent Postgres checkpointer in that focused design.

**Release gate:** Every inventory change requires explicit human approval, fresh version validation, and an auditable decision. Rejected evidence remains available under the chosen retention policy.

## Phase 5: vision and smarter retrieval

- [ ] **5.1 Build an evaluation dataset and baseline.** Collect authorized examples from the intended environments, including similar objects, occlusion, low light, movement, and hand-object interactions. Label item identity and changes; separate evaluation examples from tuning examples. Establish lexical-search queries and target quality, latency, and cost criteria before selecting models. Done when the dataset and evaluation protocol are reproducible.
- [ ] **5.2 Evaluate open-source detection models.** Compare candidates on the fixed dataset, verifying exact model licenses and hardware fit at evaluation time. Measure misses, false detections, latency, and resource cost. Done when a documented comparison supports selecting a model or deferring vision.
- [ ] **5.3 Add object tracking and interaction detection.** Evaluate identity continuity, temporary disappearance, pickup, move, and put-down events across frames. Done when measured tracking results meet the criteria from 5.1 and ambiguous events remain explicitly uncertain.
- [ ] **5.4 Match observations to owned inventory.** Combine detection/tracking evidence with owned item and location candidates. Support ambiguous and unmatched objects without forced assignments. Build the external adapter to submit the phase-4 contract, never direct item writes. Done when matches are evaluated against labeled identities and ambiguous results cannot silently become accepted changes.
- [ ] **5.5 Evaluate visual embeddings only if matching needs them.** Proceed only when 5.4 demonstrates a material matching gap. Compare against the baseline, enforce owner-scoped retrieval, and define vector refresh/deletion alongside item/evidence changes. Done when a benchmark demonstrates worthwhile improvement or records a decision to defer.
- [ ] **5.6 Evaluate semantic inventory search only if lexical search needs it.** Use the missed-query set from 5.1 and real usage. Compare retrieval quality, owner isolation, latency, and operating costs; preserve validated citations and deterministic fallback. Done when evidence supports shipping semantic retrieval or keeping lexical search.
- [ ] **5.7 Run a review-only pilot and decide whether automation is justified.** Measure false matches, missed changes, review corrections, end-to-end latency, and operating costs on held-out and real reviewed events. Define acceptable thresholds and supported scenarios before any separate automation implementation. Done when a written go/no-go decision exists; automatic writes remain disabled under this plan.

**Dependencies:** 5.1 → 5.2 → 5.3 → 5.4 → optional 5.5 → 5.7. Task 5.6 can proceed independently once retrieval failures are measured. The vision pilot requires phase 4's review and metrics loop.

## Additional backlog from the detailed guide

These are useful follow-ups, separate from the five-phase release gates:

- [ ] **B1 Location management:** Add safe location deletion/reassignment with owner and concurrent-update checks. Done when a used location cannot leave orphaned or foreign references.
- [ ] **B2 Data export:** Export all owned inventory, including more than the current 200-result listing limit, with documented format and private authenticated delivery. Done when export completeness and two-user isolation pass.

## Recommended starting batch

Start with 3.1–3.4: establish the deployment repository, connect Supabase, configure confirmation, and prove real two-user isolation. Then finish limits/logging and deploy. Evaluate actual camera models only after the review workflow can safely receive their output.

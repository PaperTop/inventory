# Personal Inventory Implementation Plan

> Execute inline using superpowers:executing-plans; use TDD for core behaviors.

**Goal:** Deliver a runnable inventory vertical slice with read-only answers and secure ownership.
**Architecture:** Next.js UI and API, user-scoped Supabase repository, pure inventory and reconciliation domain modules, bounded read-only LangGraph answer workflow.
**Tech Stack:** Node 22, Next.js, React, TypeScript, Supabase SSR, LangGraph, LangChain model adapters, Zod, Vitest, PGlite.
**Spec:** ../specs/2026-09-13-inventory-design.md

## Global constraints

- No AI write access or service-role key in application runtime.
- Durable quantity is 1; consumable quantity is nonnegative and may be fractional.
- User-owned tables enforce RLS; item/location references enforce matching owners.
- Camera observations propose changes only. No ingestion route in v1.

## Task 1: Domain contracts and read-only answers

Files: src/lib/inventory.ts, src/lib/ask.ts, src/lib/answer-graph.ts, src/lib/provider.ts, src/lib/reconciliation.ts, tests/domain.test.ts, tests/answer-graph.test.ts, tests/provider.test.ts.
Interfaces: itemInput.parse(unknown), searchInventory(items, query), askInventory(question, reader, provider), reconcile(item, observation).

- [ ] Write fixtures and failing tests for invalid quantities, normalization, search by tags/attributes, empty matches, write requests, ungrounded citations and stale observations.
- [ ] Run `npm test -- tests/domain.test.ts` and observe missing-contract failures.
- [ ] Implement strict Zod inputs, lexical ranking with plain text output, a single-node read-only LangGraph workflow, bounded model adapters, and pure proposal reconciliation.
- [ ] Re-run tests until green.

## Task 2: Database and ownership

Files: supabase/migrations/202609130001_inventory.sql, supabase/config.toml, tests/database.test.ts.

- [ ] Write executable Postgres assertions using two users and authenticated role: foreign rows hidden; foreign insert/update blocked; foreign location FK blocked; stale update changes zero rows; invalid quantity rejected; observations immutable and deduplicated.
- [ ] Run database tests against absent migration to confirm missing-schema failure.
- [ ] Implement tables, checks, FK ownership, RLS, immutable owner/version trigger, search RPC and indexes.
- [ ] Run embedded Postgres suite until green.

## Task 3: Authenticated API vertical slice

Files: src/lib/supabase/{server,client}.ts, src/lib/repository.ts, src/lib/http.ts, src/lib/handlers.ts, src/app/api/{items,locations,ask}/route.ts, src/app/api/items/[id]/route.ts, src/proxy.ts.
Interfaces: Repository.list(query), create(input), update(id, version, input), remove(id, version), locations(), createLocation(name). Owner comes exclusively from verified server session.

- [ ] Write tests for unauthenticated rejection, same-origin guard, malformed body, CRUD validation and optimistic conflicts using an in-memory repository fixture.
- [ ] Confirm failures then implement common handlers and thin Next.js routes.
- [ ] Implement Supabase SSR cookie refresh and password auth UI; explicit confirmation flow.
- [ ] Run unit and database suites.

## Task 4: UI, setup and deployable artifact

Files: src/app/{page,layout,globals.css}, src/components/{dashboard,item-form,auth-form}.tsx, src/app/demo/page.tsx, src/lib/demo.ts, README.md, .env.example, .github/workflows/ci.yml.

- [ ] Build responsive dashboard on the API contract, with create/edit/delete, reusable locations, search/filter and cited Ask results.
- [ ] Add labeled demo with in-memory state and no production data.
- [ ] Provide setup, Auth confirmation template, env table, migration, real Supabase smoke script and Vercel deployment instructions.
- [ ] Run `npm run check` and `npm run build`; inspect the app and demo in a browser and exercise item edit/search/ask.
- [ ] Record actual verified checks and any external integration limits.

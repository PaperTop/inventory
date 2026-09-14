# Inventory MVP design

## Outcome and scope

A single-user workspace per Supabase account: sign up, sign in, maintain durable possessions and consumable stocks, search, and ask questions with cited inventory results. Each account is isolated. Use Node 22, Next.js App Router, TypeScript, Supabase Auth/Postgres, Zod and Vitest. No AI writes, camera ingestion, automatic purchases, shared workspaces or image storage in v1.

## Architecture, top down

Browser → Next.js routes → authenticated inventory repository → Supabase Postgres with RLS.
Ask route → inventory reader → bounded retrieved records → answer provider → validated citations.
Future camera adapter → observation envelope → pure reconciliation function → review proposal → future explicit human confirmation → inventory writer.

The reader exposes only search. The provider receives a snapshot, no database client, credentials, SQL execution, writer or inventory mutations. An optional LangGraph workflow summarizes retrieved facts through LangChain model adapters; Claude remains opt-in. The default provider is deterministic search, explicitly labeled, so no API key is required. Ollama with Qwen3-8B is the documented open-source inference option. The v1 graph has one generation node and no tools; it provides a stable orchestration boundary for future review workflows. Search retrieval is lexical, not semantic, in v1.

## Decisions and alternatives

Use one Next.js deployment; a separate agent service would require two deployments before it adds value. Server API routes centralize validation and ownership; direct browser database access would make app policy harder to trace. Postgres enforces ownership independently of API checks. Durable rows represent one object and quantity is always 1; consumable rows aggregate nonnegative decimal quantities with a named unit and optional reorder threshold. Status is active, stored, lent, lost or disposed; condition is new, good, fair, poor or unknown. Locations are per-user named records. Tags are a normalized lowercase text array; attributes are a bounded JSON object. Timestamps and a monotonic version support stale-update detection.

## Security and data model

Tables: locations, items, inventory_observations. Every table has user_id and RLS. Items reference locations by (user_id, location_id), preventing cross-owner references. Observation records reference items by owner, retain source/event key/confidence/observed time/base version/proposed patch, and are append-only under authenticated access. There is no HTTP ingestion route yet. Source/event keys deduplicate events. No service-role key is used by the application. Authenticated requests use verified Supabase users. Mutating cookie-authenticated routes require same-origin requests. Inputs reject unknown fields, excessive sizes, invalid UUIDs, negative quantities and invalid durable quantities. Optimistic updates/delete match version, returning 409 on stale state. Personalized responses are never cached.

## UX

Responsive inventory dashboard with account controls, search, type and low-stock filters, add/edit form, delete confirmation, location creation and an Ask panel with clickable citations. Empty, loading, setup and error states are explicit. No fabricated saved data. A separate /demo offers clearly labeled in-memory sample data for preview; production API authorization remains required.

## Failure behavior

Invalid requests: 400; missing session: 401; cross-origin mutations: 403; missing/foreign item: 404; stale edit: 409. Missing Supabase setup has a helpful setup screen. Provider unavailable/malformed output: deterministic fallback with a visible notice. Empty retrieval states that nothing matched. No inference can silently modify truth. Reconciliation rejects owner/item mismatch, records low confidence or stale/version-conflicting observations for review, and never applies any patch.

## Verification and deployment

Core tests exercise validation, lexical retrieval, grounded answer citation filtering, stale observation handling, and read-only behavior. Run the actual migration in embedded Postgres (PGlite) with auth.uid() fixture and authenticated roles to test RLS, cross-owner references, constraints and versions. Test route authentication and CRUD using a repository boundary; production browser smoke verifies setup and demo interactions. Run lint, TypeScript and production build. A real Supabase smoke command is documented for validating Auth/PostgREST after credentials are configured. Vercel auto-detects Next.js; migrations run separately before deployment. Secrets only in server environment; public Supabase URL and publishable key are expected public values.

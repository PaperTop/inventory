# Verification record

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

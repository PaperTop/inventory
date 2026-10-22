# Deployment parity checklist

## Already shipped

- Greeting/search fixes: `e69cd46`; later reliability improvements: `ad6e2cd`.
- Production demo AI: `129221e`; generous usage limits: `955b9c7`. Demo inference no longer requires Supabase or sign-in. Requests stay bounded and session-only; the authenticated saved API remains separate.

The earlier “332 tests passed, still local” and “production demo route blocked” notes describe older boundaries, not the current code. They should not be used as a release status report.

## Release verification

- Server-derived AI availability is shown in the composer. Basic-search fallback remains explicit, while greetings and complete scoped lists can deliberately avoid model inference.
- `GET /api/ask/local` publishes only mode and release SHA with no-store headers; it is not an AI health call or a credentials endpoint.
- Run the full local release gate before publishing.
- After a successful production deployment, `.github/workflows/deployed-smoke.yml` tests the exact deployment URL and commit from the event. Manual runs use `DEMO_URL` and optional `EXPECTED_RELEASE`.
- `scripts/smoke-deployed.mjs` checks greetings, all records in a nested location (beyond the twenty-card citation limit), and a two-turn packing conversation. It asserts AI mode for packing, grounding, no prepared writes, and a respected exclusion. Requests are serial and not automatically retried; only fabricated data is supplied.
- This is HTTP behavior verification. Browser interactions and visual/accessibility QA remain separate checks. A passing tiny live sample is not a reliability percentage.

## Saved-data rollout — still gated

Do not infer a database target from a production URL or run smoke writes on a real-user account. Before applying migrations or enabling saved-data verification, obtain:

1. An explicitly designated Supabase staging/test project and application URL, with its migration history reviewed and a recoverable backup.
2. Approval for the exact pending migrations, including `202610130001_rooms_creation.sql` after all prerequisites. No migration has been applied as part of deployment-parity work.
3. Two disposable confirmed accounts, configured locally in `.env.smoke.local` rather than hosting settings or chat. App URL/public key remain in `.env.local`.
4. Then verify Auth callbacks, Room hierarchy, draft cancellation, creation idempotency/version conflicts, fresh-session persistence, complete location queries and cross-owner isolation. Existing hosted smoke commands supplement but do not replace those application checks.
5. Clean up only fixtures created by the run, preserve real records, and record actual evidence before calling saved-data rollout complete.

Until that target and account setup are supplied, saved-data rollout is pending. The public demo can operate independently and must not be presented as proof of hosted persistence.

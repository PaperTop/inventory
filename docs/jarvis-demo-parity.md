# Jarvis demo parity diagnosis

## Confirmed findings

The user's example was “hi” producing shoes and a hoodie. Controlled runs of `0699b03` (before trip clarification) and `7228676` (with clarification), with identical synthetic inventory and no provider, both reproduced it. This bug predates the clarification update: keyword matching treated `hi` as a substring of `Clothing` (and `White`), returning unrelated clothing records.

The clarification update also introduced separate regressions. Complete requests using `destination Yosemite; duration 2 nights; style car camping; weather rainy` or a Chicago business trip with `70 degrees Fahrenheit and clear skies` reached the controlled provider before the update but were intercepted by unnecessary questions afterward. The destination and weather heuristics did not recognize facts expressed in those forms. Tests with natural destination replies/corrections reproduced additional context-recognition gaps.

These comparisons use the same synthetic records and a deterministic mock answer provider. They establish routing/retrieval regressions, not live-model intelligence or output quality. No real inference requests were made for this investigation.

## Local corrections

- Whole-message greetings, help, thanks and common small talk receive a short conversational response before inventory search, trip questions or model calls. They return no inventory cards and cannot apply changes. The UI labels these as Jarvis replies, without an irrelevant AI-outage warning when the reply requires no AI.
- A greeting followed by an actual request still reaches the request path. Item queries such as `hi-vis vest` and `hiking` are not classified as greetings. Short tokens in the shared in-memory/snapshot matchers require whole-token matches so `hi-vis vest` does not also retrieve every `Clothing` item; longer partial searches remain supported. The separate SQL search RPC was not changed.
- Trip recognition accepts destination labels/“for Yosemite”, temperatures expressed in degrees, clear skies, driving/camping style and natural pending destination replies. “How about Big Sur instead?” retains the current trip intent. Fully supplied context reaches the answer path; materially vague requests still receive a focused bundle and users can opt out. New trips still start fresh, with no guessed forecast or assistant-invented trip facts.

The original wrong-card and unnecessary-question cases are retained as regressions, along with production-fallback UI tests. This is not a wholesale clarification revert or removal of the production security boundary.

## Deployed environment: a separate difference

Read-only requests to the user-supplied [public demo](https://inventory-lime-one.vercel.app/) confirmed:

| Request                                                | Actual result                                                                |
| ------------------------------------------------------ | ---------------------------------------------------------------------------- |
| `GET /`                                                | 200; sample inventory and Jarvis app                                         |
| `POST /api/ask/local` with an empty synthetic snapshot | 404; `Local Jarvis is available in development only.`                        |
| `POST /api/ask` without an account                     | 503; `Add your Supabase environment variables to connect inventory storage.` |

The served JavaScript contains the current trip-question marker, Trip questions label and history-preserving local fallback notice, not the old notice. GitHub reports a successful Vercel status for `7228676`; the exact server commit behind the public alias is not independently exposed. Current UI features are therefore present, but exact alias-to-commit identity is not asserted.

At investigation time, local configuration selected a hosted model with a key present. The app has since switched to Claude; the previous adapter was removed. The production sample route rejects requests before model execution regardless of whether production has a provider key. The client then runs deterministic local search, explaining why the deployed sample lacks model reasoning available in local development. This amplifies the greeting bug but does not prove the deployed model itself is worse. Production provider/model settings cannot be established through the blocked route. Missing Supabase setup also prevents the saved-account path; it is separate from previously documented database migration readiness.

Browser interaction was unavailable because browser use is disabled in Work settings. Actual public HTTP/assets and controlled client → handler tests were used; no screenshot or live browser conversation is claimed. No production configuration, account or record was changed.

## Next deployment decision

The local behavior corrections require a separately authorized code release before the public demo changes. They do not enable production sample inference. For full AI behavior, configure the authenticated production path and verify its required migrations/accounts, or explicitly design a public synthetic demo with a fixed server-controlled fixture, input/rate/spend limits and honest mode labeling. Simply removing the development-only guard would expose an unauthenticated model endpoint and is not an appropriate parity fix.

Current local verification and remaining limitations are recorded in `design-qa.md`. Hosted persistence remains deferred. No live model call, database write, migration, production setting change, deployment, commit or push was performed for this assignment.

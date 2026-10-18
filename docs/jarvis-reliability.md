# Jarvis reliability investigation — 2026-10-15

## Follow-up reliability fixes — 2026-10-18

Three live requests with sixteen fabricated records and realistic-length IDs (Tahoe camping, photography accessories, hotel-trip essentials) all returned validated AI answers before these changes: 10.5s, 5.4s and 6.6s. This small baseline does not reproduce or explain the user's reported frequency; the failing environment/warning is still needed to distinguish provider, deployment and application failures. The fixture is retained as an opt-in test, `JARVIS_FALLBACK_SAMPLE=1` in `tests/jarvis-fallback-live.test.ts`; it is not run by the normal test suite.

A controlled real-handler → chat regression did reproduce a separate failure: deterministic fallback can exceed 4,000 characters, but chat sent the entire answer back in history. The next request failed the server history schema, then failed the same schema in browser fallback and left the chat busy. Outgoing history now fits the existing limit with an explicit shortening marker; the original displayed answer and server input validation are unchanged.

Malformed JSON or answer-schema failures now receive one format-only correction if a model turn remains. It uses the existing 25-second/four-call budget, has no tool access and cannot repeat prepared changes. A second invalid answer, fourth-turn invalid answer, refusal, truncation, provider error or invented citation still fails honestly; no network retries or inventory validation bypass were added.

The client also preserves HTTP status and distinguishes production-disabled sample AI, sign-in failures and unavailable server setup from generic network failures. The production sample restriction is unchanged; this does not enable anonymous paid inference. No deployment, database write or private-inventory measurement was performed.

Verification: the full release check passed (348 tests, 8 opt-in skips, formatting, lint, TypeScript and production build). The same three live fixtures passed after the changes at 11.0s, 4.2s and 9.0s. The hotel-trip run exercised format correction: its second invocation returned no tools but invalid answer JSON/schema, and the third returned a validated final answer. Six user-level live fixture requests were measured in total, before and after; individual requests can use up to four model invocations. These observations do not establish a production reliability percentage.

## Claude compatibility follow-up — 2026-10-16

A native-adapter regression reproduced valid Claude thinking/text content blocks being rejected as `answer_schema`, causing deterministic fallback. The graph now extracts only explicit text blocks for JSON validation, never thinking or arbitrary rich content. Original signed blocks remain intact in tool history; turn reminders are appended rather than rewriting the system prompt. Claude's `stop_reason: max_tokens` is recognized as truncation, and refusals remain failures rather than invented answers.

Claude receives a bounded 2,400-token output budget; Haiku 5.5 uses low effort to leave room for the answer. Other adapters retain their previous budget. Deadlines, zero retries, four model turns, citation checks and item-change validation remain unchanged. Fallback notices now distinguish missing configuration, authentication/model access, rate limits, timeout, truncation and invalid output without exposing provider bodies or credentials.

Native-adapter tests use fabricated HTTP responses for a complete search round, signed thinking preservation, valid text extraction, truncation, refusal, foreign citations and HTTP errors. One separately enabled live smoke test with fabricated inventory completed successfully in approximately 2.9 seconds. This does not establish a universal success rate or enable production sample inference; the development-only sample endpoint restriction remains unchanged. No private inventory or database writes were used.

## Confirmed cause and scoped change

The measured synthetic baseline reproduced `tool_budget`: the model requested another search on its fourth and final invocation. All four provider responses finished normally; this observed failure was not a timeout. The application had offered tools on a turn when it would reject any resulting tool call. The earlier 21.49-second fallback did not capture a reason and cannot retrospectively be classified.

Jarvis now tells the model how many tool rounds remain and reserves invocation four for a final answer. Provider adapters set `tool_choice: none` on that invocation only; earlier turns retain normal tool access. The existing rejection of an actual fourth-turn tool request remains, including for a noncompliant provider. A deterministic replay failed with `tool_budget` before the change and passes afterward with exactly four model invocations and three searches. Independent tests still reject foreign citations on the last turn and allow a limited, grounded answer that explicitly acknowledges gaps.

The existing four-invocation limit, up to four tool calls per permitted round, 13-read ceiling including the initial overview, 25-second graph deadline, zero provider retries, answer schema, citation-evidence check and prepared-change validation remain. There is no model replacement, increased deadline, retry-until-success, invented ownership or fallback relabeling. Exact location questions still use deterministic scoped pagination without model inference.

The installed provider adapters accept per-invocation tool choice. The implementation was checked against the installed package types/converter code rather than assuming a different adapter version. The current Claude adapter preserves the same reserved final-answer turn.

## Sanitized internal diagnostics

`InventoryReader.diagnose` is an optional internal observation callback, not an HTTP response field or automatic raw log. Events contain only stage (`model`, `tool`, `answer`), outcome, fixed failure reason, duration, model-turn/tool-call counts, and a normalized finish category. No prompts, histories, inventory contents, provider bodies/messages/stacks, URLs, keys or credentials are included. A throwing observer is ignored so instrumentation cannot repeat an action or change an answer.

Fixed reasons distinguish provider errors, rate limits, deadline/cancellation, tool budget/argument/availability/reader failures, output limits, answer JSON/schema and ungrounded citations. Signal/error identity is used for deadline/cancellation; elapsed time alone is not evidence of a timeout. The visible fallback remains truthful and does not return prepared changes after a failed answer.

## Bounded measurement

All provider inputs in this investigation are fabricated fixtures. No database, saved account or real private inventory is involved. Requests are serialized and never automatically retried.

| Batch                                             | Calls | Outcome                                                                                                             | Latency                                                          |
| ------------------------------------------------- | ----: | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Initial instrumentation batches                   |     6 | Outcomes unobserved because the runner suppressed passing-test console output; these calls still count in the total | Per-attempt values unavailable; not used as reliability evidence |
| Measured baseline, original short camping fixture |     3 | 2 AI answers, 1 truthful search fallback (`tool_budget`); all citations from the fixture                            | 3094 ms fallback; 3152 / 3335 ms AI                              |

The sanitized baseline artifact is `/private/tmp/inventory-jarvis-reliability-measurement.json`. `tests/jarvis-reliability-live.test.ts` is opt-in through `JARVIS_RELIABILITY_SAMPLE` and executes exactly three attempts, preserving each completed measurement locally. Use `--disableConsoleIntercept --reporter=verbose` to expose its console output as well. A passing measurement harness means its fixed sample ran and citations stayed within the fixture, not that every attempt produced an AI answer. Do not confuse that with behavioral acceptance.

Independent QA owns the post-change fixed five-request matrix: two short camping prompts, one work-packing prompt, one camping prompt with relevant essentials beyond 260 irrelevant records, and its exclusion follow-up. See `design-qa.md` for its actual per-attempt outcomes and final release gate. No further baseline calls are planned. A small sample does not establish a production success rate or eliminate provider failures; truthful bounded fallback remains required.

Recovered QA results: all five completed with AI answers and no fallback at 2759, 3833, 1979, 2827 and 1954 ms respectively. The second short prompt corrected invalid tool arguments and answered on its reserved fourth turn. However, the late-inventory camping case failed the required personal-essential citation checks: contact lenses and night guard were mentioned in the answer but absent from its cited cards. The other four cases passed their quality checks, including the follow-up's exclusion. The actual live matrix exited 1; AI completion success is not complete packing-quality acceptance. All five calls completed before the interruption and none were rerun. Total actual requests in this investigation: 14 (six unobserved instrumentation attempts, three measured baseline attempts, five QA attempts). Do not pool different source versions into a success-rate claim.

## Local-only grounding follow-up

After the exhausted live sample, a reconstructed synthetic answer reproduces the missing citation pattern; it is not claimed to be the original provider prose, which was never logged. The new regression first failed with only the backpack card. Packing answers now supplement validated model suggestions with a clearly separate, bounded record check when relevant daily essentials lack cards. Eligibility requires both a personal-care/health/first-aid/vision/hygiene category and a name identifying contact lenses, glasses, night guard, medication/medicine or inhaler; it is not a medical inference or an automatic packing recommendation. Only already-retrieved, available records survive, including explicit follow-up exclusions. No additional search or model request is made.

At most four missing cards are added, within the existing 20-card limit. The independent section names the records and their paths, quantities, status and poor-condition warning, and asks the user to confirm trip suitability; it explicitly says they are not automatically packed. It never converts a generic suggested purchase into an owned record, appends arbitrary possessions, changes editing answers, truncates the model answer or exceeds 4000 characters. If the section cannot fit, it is omitted rather than violating the answer budget. This conservative name/category vocabulary is deliberately limited and is not an exhaustive personal-needs model.

This last grounding patch is verified through local reconstructed replay and negative guards only. It has **not** been sent through another live provider batch; the recorded five-case live results describe the earlier final-turn fix, not this new patch. No additional provider requests are authorized or planned in this run.

Hosted verification remains explicitly deferred. No live database changes, migration, deployment, commit or push are part of this investigation.

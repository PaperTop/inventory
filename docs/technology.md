# Technology and cost decisions

“Startup approved” is interpreted here as mature components, commercially usable permissive licenses, low operating complexity, and the ability to replace hosted services. It is not a certification.

| Component                   | License                                     | Why it earns its place                                             |
| --------------------------- | ------------------------------------------- | ------------------------------------------------------------------ |
| Next.js, React              | MIT                                         | One TypeScript web app and server, deployable on Vercel or Node    |
| Supabase JS / SSR           | MIT                                         | Managed or self-hosted Auth and PostgreSQL access                  |
| Supabase platform           | Apache-2.0 (platform repo; components vary) | Reduces account/database setup; self-hosting is possible           |
| PostgreSQL                  | PostgreSQL License                          | Durable data, transactions, RLS and search in one database         |
| LangGraph                   | MIT                                         | Explicit read-only workflow today; resumable orchestration later   |
| LangChain model adapters    | MIT                                         | Connect Ollama-compatible and optional Claude models               |
| Ollama (optional runtime)   | MIT                                         | Local OpenAI-compatible inference without per-token vendor billing |
| Qwen3-8B (optional weights) | Apache-2.0                                  | Documented permissive model; hardware cost still applies           |
| Zod                         | MIT                                         | Shared input contracts                                             |
| Phosphor Icons              | MIT                                         | Consistent interface icons for the liquid-glass dashboard          |
| Vitest / PGlite             | MIT / Apache-2.0                            | Fast real behavior tests and executable Postgres policy checks     |

Installed versions and direct dependency licenses are recorded in `dependency-licenses.json`. `package-lock.json` pins the resolved dependency tree; package distributions carry their license notices. Preserve those notices when redistributing. The model is not downloaded or bundled in this repository.

## Defaults

- Start with built-in database search. No model is needed for CRUD, search, quantities, low stock or location lookups.
- Use optional Qwen3-8B through Ollama for local exploration; no model was silently installed or downloaded.
- Jarvis uses a bounded LangGraph generate/search loop: at most four model turns, twelve tool calls, and a 25-second deadline. Item edits are prepared by the graph, validated against the current inventory, and saved through the existing store; the model never receives a database client. Claude uses the native `@langchain/anthropic` adapter. No embeddings service, vector database or provider failover is used.
- Hosted inference can be more economical than keeping a GPU running for low traffic; use the same compatible interface and compare actual latency and usage before committing to infrastructure.
- Claude remains available only by explicit environment configuration. Its SDK is open source; the Claude service/model is proprietary and billed separately.
- Google ADK, Vercel AI SDK, camera detection models and third-party tracking SDKs are not included. LangGraph owns workflow orchestration; LangChain components only connect models.

## Sources checked

- [LangGraph repository](https://github.com/langchain-ai/langgraphjs)
- [LangChain.js repository](https://github.com/langchain-ai/langchainjs)
- [Ollama license](https://github.com/ollama/ollama/blob/main/LICENSE)
- [Qwen3-8B license](https://huggingface.co/Qwen/Qwen3-8B/blob/main/LICENSE)
- [Supabase SSR documentation](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Supabase RLS documentation](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Ollama OpenAI compatibility](https://docs.ollama.com/api/openai-compatibility)

Use the license for the exact model/version selected; an inference runtime's license does not cover model weights. No claim is made that hosted service tiers or prices remain unchanged.

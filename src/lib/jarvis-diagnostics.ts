export type JarvisFailureReason =
  | "provider_error"
  | "rate_limit"
  | "authentication"
  | "model_unavailable"
  | "refusal"
  | "deadline"
  | "cancelled"
  | "tool_budget"
  | "tool_arguments"
  | "tool_unavailable"
  | "tool_error"
  | "answer_json"
  | "answer_schema"
  | "output_limit"
  | "citation";

export type JarvisDiagnostic = {
  stage: "model" | "tool" | "answer";
  outcome: "success" | "failure";
  reason?: JarvisFailureReason;
  elapsedMs: number;
  turn?: number;
  toolCalls?: number;
  finish?: "stop" | "length" | "other";
};

export class JarvisFailure extends Error {
  constructor(public readonly reason: JarvisFailureReason) {
    super(
      reason === "tool_budget"
        ? "Jarvis reached its tool loop limit."
        : reason === "answer_schema"
          ? "The model must return plain text JSON matching the answer schema."
          : `Jarvis failed: ${reason}`,
    );
    this.name = "JarvisFailure";
  }
}

export function failureReason(error: unknown): JarvisFailureReason {
  if (error instanceof JarvisFailure) return error.reason;
  // Never expose provider messages, response bodies, URLs, or arbitrary fields.
  if (error && typeof error === "object") {
    const { name, status } = error as { name?: unknown; status?: unknown };
    if (name === "TimeoutError") return "deadline";
    if (name === "AbortError") return "cancelled";
    if (status === 429) return "rate_limit";
    if (status === 401 || status === 403) return "authentication";
    if (status === 404) return "model_unavailable";
  }
  return "provider_error";
}

export function fallbackNotice(reason: JarvisFailureReason): string {
  const explanation: Partial<Record<JarvisFailureReason, string>> = {
    rate_limit: "the provider rate limit was reached. Try again later.",
    authentication:
      "the provider rejected authentication. Check the server API key and account access.",
    model_unavailable:
      "the configured model was not found. Check the server model ID and account access.",
    deadline: "the request timed out. Try a shorter request.",
    cancelled: "the request was cancelled.",
    output_limit: "the response was cut off before it finished.",
    answer_json: "the response was not valid answer JSON.",
    answer_schema: "the response did not match the required answer format.",
    citation: "the response cited inventory records that were not retrieved.",
    tool_budget: "the search limit was reached before a final answer.",
    refusal: "the provider declined the request.",
  };
  return `The AI answer was unavailable: ${explanation[reason] ?? "the AI service or an inventory lookup failed."} No items were changed. Showing matching inventory records.`;
}

export function reportDiagnostic(
  report: ((event: JarvisDiagnostic) => void) | undefined,
  event: JarvisDiagnostic,
) {
  try {
    report?.(event);
  } catch {
    // Observability must never change the answer or repeat an action.
  }
}

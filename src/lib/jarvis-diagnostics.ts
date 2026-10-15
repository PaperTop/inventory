export type JarvisFailureReason =
  | "provider_error"
  | "rate_limit"
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
  }
  return "provider_error";
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

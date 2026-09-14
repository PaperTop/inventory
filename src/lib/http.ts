import { ZodError } from "zod";
import type { InventoryRepository } from "./contracts";
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export type RequestContext = {
  userId: string;
  repository: InventoryRepository;
};
export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "private, no-store", Vary: "Cookie" },
  });
}
export async function safely(action: () => Promise<Response>) {
  try {
    return await action();
  } catch (error) {
    if (error instanceof ZodError)
      return json(
        {
          error: error.issues
            .map((i) => `${i.path.join(".") || "Input"}: ${i.message}`)
            .join("; "),
        },
        400,
      );
    if (error instanceof HttpError)
      return json({ error: error.message }, error.status);
    console.error(
      "Inventory request failed",
      error instanceof Error ? error.name : "UnknownError",
    );
    return json(
      { error: "Unable to complete this request. Please try again." },
      500,
    );
  }
}
export function authorize(request: Request, context: RequestContext | null) {
  if (!context)
    throw new HttpError(401, "Please sign in to access your inventory.");
  if (
    request.method !== "GET" &&
    request.headers.get("origin") !== new URL(request.url).origin
  )
    throw new HttpError(403, "This request must come from the same site.");
  return context;
}
export async function readBody(request: Request): Promise<unknown> {
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new HttpError(415, "Expected JSON.");
  // Bound actual bytes even when Content-Length is absent or dishonest.
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "Missing request body.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 16000) {
      await reader.cancel();
      throw new HttpError(413, "Request body is too large.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new HttpError(400, "Invalid JSON.");
  }
}

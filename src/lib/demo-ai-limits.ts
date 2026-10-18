import { createHash } from "node:crypto";
import { HttpError } from "./http";

// Best-effort, per-process protection only. Serverless replicas/cold starts do
// not share this state; provider spending limits / edge rules are still needed.
export function createDemoUsageGuard(now = Date.now) {
  const clients = new Map<string, { count: number; expires: number }>();
  let hourEnds = 0;
  let hourlyRequests = 0;
  let active = 0;
  return (request: Request) => {
    const time = now();
    if (time >= hourEnds) {
      hourEnds = time + 3_600_000;
      hourlyRequests = 0;
    }
    for (const [key, entry] of clients)
      if (entry.expires <= time) clients.delete(key);
    // Trust forwarding metadata only on the platform that supplies it.
    // Other hosts share a conservative bucket rather than trusting client IPs.
    const address =
      process.env.VERCEL === "1"
        ? request.headers
            .get("x-forwarded-for")
            ?.split(",")[0]
            .trim()
            .slice(0, 64) || "unknown"
        : "unknown";
    const key = createHash("sha256").update(address).digest("hex");
    const client = clients.get(key);
    if (
      active >= 2 ||
      hourlyRequests >= 60 ||
      (client?.count ?? 0) >= 6 ||
      (!client && clients.size >= 1000)
    )
      throw new HttpError(
        429,
        "Demo AI usage limit reached. Please wait before trying again.",
      );
    clients.set(key, {
      count: (client?.count ?? 0) + 1,
      expires: client?.expires ?? time + 600_000,
    });
    hourlyRequests++;
    active++;
    let released = false;
    return () => {
      if (!released) {
        active--;
        released = true;
      }
    };
  };
}

export const acquireDemoUsage = createDemoUsageGuard();

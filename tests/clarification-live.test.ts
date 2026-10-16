import { writeFile } from "node:fs/promises";
import { expect, it } from "vitest";
import {
  askInventory,
  type AskResult,
  type InventoryFact,
} from "../src/lib/ask";
import { configuredProvider } from "../src/lib/provider";
import { searchFacts } from "../src/lib/inventory-search";
import type { JarvisDiagnostic } from "../src/lib/jarvis-diagnostics";

// Exactly two synthetic requests after a zero-provider clarification. Persist
// start and completion so interrupted requests count and are never replaced.
it.skipIf(!process.env.JARVIS_CLARIFICATION_LIVE)(
  "verifies the fixed two-case synthetic tailoring sample without retries",
  async () => {
    const make = (
      id: string,
      name: string,
      category: string,
      extra: Partial<InventoryFact> = {},
    ): InventoryFact => ({
      id,
      name,
      category,
      description: "Fabricated clarification fixture, not a real possession",
      quantity: 1,
      unit: "pc",
      status: "active",
      condition: "good",
      location_name: "Synthetic Home → Shelf",
      tags: [],
      attributes: {},
      ...extra,
    });
    const rows = [
      make("bag", "Backpack", "Travel"),
      make("water", "Water bottle", "Everyday carry"),
      make("jacket", "Rain jacket", "Clothing"),
      make("warm", "Warm fleece", "Clothing"),
      make("contacts", "Daily contact lenses", "Personal care", {
        quantity: 8,
        unit: "pairs",
      }),
      make("charger", "Phone charger", "Electronics"),
      make("empty", "Contact lens solution", "Personal care", { quantity: 0 }),
      make("lent", "Tent", "Camping", { status: "lent" }),
    ];
    const provider = configuredProvider();
    expect(provider).toBeDefined();
    let providerCalls = 0;
    const wrapped = {
      answer: async (
        ...args: Parameters<NonNullable<typeof provider>["answer"]>
      ) => {
        providerCalls++;
        return provider!.answer(...args);
      },
    };
    const read = { search: async (query: string) => searchFacts(rows, query) };
    const first = await askInventory("Pack me for camping", read, wrapped);
    expect(first.clarification).toBe(true);
    expect(providerCalls).toBe(0);
    const cases = [
      {
        id: "camping-reply",
        question:
          "Yosemite, two nights, car camping. Expected conditions are cold and rainy; no live forecast is requested.",
        history: [{ question: "Pack me for camping", answer: first.answer }],
      },
      {
        id: "complete-work",
        question:
          "Pack for a two-night business trip to Boston, staying at a hotel; expected weather is mild and dry.",
        history: undefined,
      },
    ];
    const ledger: unknown[] = [];
    const path = "/private/tmp/inventory-clarification-qa-20261015.json";
    for (const scenario of cases) {
      const record: {
        id: string;
        state: string;
        elapsedMs?: number;
        mode?: string;
        fallback?: boolean;
        checks?: Record<string, boolean>;
        diagnostics: JarvisDiagnostic[];
      } = { id: scenario.id, state: "started", diagnostics: [] };
      ledger.push(record);
      await writeFile(path, JSON.stringify(ledger, null, 2));
      const before = JSON.stringify(rows);
      const start = performance.now();
      let result: AskResult | undefined;
      try {
        result = await askInventory(
          scenario.question,
          { ...read, diagnose: (event) => record.diagnostics.push(event) },
          wrapped,
          scenario.history,
        );
        record.state = "completed";
      } catch {
        record.state = "failed-before-answer";
      }
      record.elapsedMs = Math.round(performance.now() - start);
      record.mode = result?.mode;
      record.fallback = Boolean(result?.notice);
      const checks = {
        ai: result?.mode === "ai" && !result.clarification && !result.notice,
        readonly:
          result?.changes === undefined && JSON.stringify(rows) === before,
        grounded: Boolean(
          result?.citations.every((row) =>
            rows.some((owned) => owned.id === row.id),
          ),
        ),
        noUnavailableCards: Boolean(
          result?.citations.every(
            (row) =>
              row.quantity > 0 && ["active", "stored"].includes(row.status),
          ),
        ),
        noRepeatedQuestions: Boolean(
          result &&
          !/where are you going|how many (?:days|nights)|what.*conditions.*\?/i.test(
            result.answer,
          ),
        ),
        contextual: Boolean(
          result &&
          (scenario.id === "camping-reply"
            ? /cold|rain|yosemite/i.test(result.answer)
            : /business|work|hotel|boston/i.test(result.answer)),
        ),
        noLiveForecastClaim: Boolean(
          result &&
          !/I (?:checked|looked up|fetched).*forecast|(?:live|latest|current) forecast (?:shows|says|predicts)/i.test(
            result.answer,
          ),
        ),
      };
      record.checks = checks;
      await writeFile(path, JSON.stringify(ledger, null, 2));
      console.info("QA_CLARIFICATION_ATTEMPT", JSON.stringify(record));
      for (const [check, pass] of Object.entries(checks))
        expect.soft(pass, `${scenario.id}: ${check}`).toBe(true);
    }
    expect(providerCalls).toBe(2);
  },
  90000,
);

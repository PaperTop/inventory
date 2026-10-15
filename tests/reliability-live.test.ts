import { expect, it } from "vitest";
import { writeFile } from "node:fs/promises";
import {
  askInventory,
  type ChatTurn,
  type InventoryFact,
} from "../src/lib/ask";
import { configuredProvider } from "../src/lib/provider";
import { searchFacts } from "../src/lib/inventory-search";
import type { JarvisDiagnostic } from "../src/lib/jarvis-diagnostics";

// Deliberately opt-in: exactly five serial synthetic application requests, no
// retry-on-failure. Internal model turns retain the application's own limits.
it.skipIf(!process.env.JARVIS_RELIABILITY_LIVE)(
  "runs the agreed fixed five-attempt synthetic reliability matrix",
  async () => {
    const fact = (
      id: string,
      name: string,
      category: string,
      extra: Partial<InventoryFact> = {},
    ): InventoryFact => ({
      id,
      name,
      category,
      description: "Fabricated reliability fixture; not a real possession",
      quantity: 1,
      unit: "pc",
      status: "active",
      condition: "good",
      location_name: "Synthetic Home → Shelf",
      tags: [],
      attributes: {},
      ...extra,
    });
    const short = [
      fact("bag", "Backpack", "Travel"),
      fact("water", "Water bottle", "Everyday carry"),
      fact("shoes", "Sneakers", "Clothing"),
    ];
    const late = [
      ...Array.from({ length: 260 }, (_, n) =>
        fact(`decor-${n}`, `Desk ornament ${n}`, "Decor"),
      ),
      ...short,
      fact("contacts", "Daily contact lenses", "Personal care", {
        quantity: 8,
        unit: "pairs",
      }),
      fact("guard", "Night guard", "Personal care"),
      fact("bandages", "Bandages", "First aid", { quantity: 10 }),
      fact("camera", "Compact camera", "Electronics"),
      fact("solution", "Contact lens solution", "Personal care", {
        quantity: 0,
      }),
      fact("raincoat", "Rain jacket", "Clothing", { status: "disposed" }),
      fact("tent", "Two-person tent", "Camping", { status: "lent" }),
    ];
    const cases = [
      { id: "short-camping-1", question: "Pack me for camping", rows: short },
      { id: "short-camping-2", question: "Pack me for camping", rows: short },
      {
        id: "work-pack",
        question: "Help me pack for a two-night work trip.",
        rows: late,
      },
      {
        id: "late-camping",
        question: "Help me pack for camping for two nights.",
        rows: late,
      },
      {
        id: "camping-followup",
        question:
          "Leave the camera off my packing list. Keep my personal essentials.",
        rows: late,
      },
    ];
    const provider = configuredProvider();
    expect(
      provider,
      "An existing model provider must be configured for this opt-in matrix",
    ).toBeDefined();
    const history: ChatTurn[] = [];
    const ledger: unknown[] = [];
    for (const scenario of cases) {
      const diagnostics: JarvisDiagnostic[] = [];
      const before = JSON.stringify(scenario.rows);
      const start = performance.now();
      const result = await askInventory(
        scenario.question,
        {
          search: async (query) => searchFacts(scenario.rows, query),
          diagnose: (event) => diagnostics.push(event),
        },
        provider,
        scenario.id === "camping-followup" ? history : undefined,
      );
      const elapsedMs = Math.round(performance.now() - start);
      // No raw model prose, prompts, configuration or errors are logged.
      console.info(
        "QA_RELIABILITY_ATTEMPT",
        JSON.stringify({
          id: scenario.id,
          elapsedMs,
          mode: result.mode,
          fallback: Boolean(result.notice),
          citations: result.citations.map((row) => row.id),
          diagnostics,
        }),
      );
      ledger.push({
        id: scenario.id,
        elapsedMs,
        mode: result.mode,
        fallback: Boolean(result.notice),
        citations: result.citations.map((row) => row.id),
        diagnostics,
      });
      await writeFile(
        "/private/tmp/inventory-jarvis-qa-matrix-20261015.json",
        JSON.stringify(ledger, null, 2),
      );
      expect
        .soft(result.mode, `${scenario.id} unexpectedly fell back`)
        .toBe("ai");
      expect.soft(result.notice, scenario.id).toBeUndefined();
      expect.soft(result.changes, scenario.id).toBeUndefined();
      expect.soft(JSON.stringify(scenario.rows), scenario.id).toBe(before);
      expect
        .soft(
          result.citations.every((row) =>
            scenario.rows.some((owned) => owned.id === row.id),
          ),
          scenario.id,
        )
        .toBe(true);
      expect
        .soft(result.answer, scenario.id)
        .not.toMatch(
          /pack (?:your |the )?(?:contact lens solution|rain jacket|two-person tent)/i,
        );
      if (
        ["work-pack", "late-camping", "camping-followup"].includes(scenario.id)
      ) {
        expect
          .soft(
            result.citations.map((row) => row.id),
            scenario.id,
          )
          .toEqual(expect.arrayContaining(["contacts", "guard"]));
        expect.soft(result.answer, scenario.id).toMatch(/contact/i);
        expect.soft(result.answer, scenario.id).toMatch(/night guard/i);
      }
      if (scenario.id.startsWith("short-camping")) {
        expect
          .soft(
            result.citations.map((row) => row.id),
            scenario.id,
          )
          .toContain("bag");
        expect
          .soft(result.answer, scenario.id)
          .toMatch(
            /not (?:found|listed|in)|missing|suggest|consider|need|gap/i,
          );
      }
      if (scenario.id === "late-camping")
        history.push({ question: scenario.question, answer: result.answer });
      if (scenario.id === "camping-followup")
        expect
          .soft(result.citations.map((row) => row.id))
          .not.toContain("camera");
    }
  },
  180000,
);

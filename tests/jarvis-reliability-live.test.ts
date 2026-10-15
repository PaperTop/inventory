import { expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { askInventory, type InventoryFact } from "../src/lib/ask";
import { configuredProvider } from "../src/lib/provider";
import { searchFacts } from "../src/lib/inventory-search";
import type { JarvisDiagnostic } from "../src/lib/jarvis-diagnostics";

// Opt-in, fixed sample. Fabricated records only; no database or credentials output.
it.skipIf(!process.env.JARVIS_RELIABILITY_SAMPLE)(
  "measures three synthetic short camping attempts without retrying failures",
  async () => {
    const measurements: unknown[] = [];
    const rows: InventoryFact[] = [
      ["backpack", "Backpack", "Everyday carry"],
      ["water-bottle", "Water bottle", "Everyday carry"],
      ["sneakers", "Sneakers", "Clothing"],
    ].map(([id, name, category]) => ({
      id,
      name,
      category,
      description:
        id === "backpack"
          ? "Main backpack for school and travel. Fits a 15-inch laptop."
          : id === "water-bottle"
            ? "One-liter bottle for long days away from home."
            : "Everyday white sneakers.",
      quantity: 1,
      unit: id === "sneakers" ? "pair" : "pc",
      status: "active",
      condition: id === "sneakers" ? "fair" : "good",
      location_name: id === "sneakers" ? "Bedroom" : "College",
      tags:
        id === "backpack"
          ? ["school", "travel", "everyday"]
          : id === "water-bottle"
            ? ["daily", "gym"]
            : ["everyday"],
      attributes:
        id === "backpack"
          ? { color: "Black" }
          : ({} as InventoryFact["attributes"]),
    }));
    expect(configuredProvider()).toBeDefined();
    for (let attempt = 1; attempt <= 3; attempt++) {
      const events: JarvisDiagnostic[] = [];
      const start = performance.now();
      const result = await askInventory(
        "Pack me for camping",
        {
          search: async (query) => searchFacts(rows, query),
          diagnose: (event) => events.push(event),
        },
        configuredProvider(),
      );
      const grounded = result.citations.every((row) =>
        rows.some((source) => source.id === row.id),
      );
      const measurement = {
        sample:
          process.env.JARVIS_RELIABILITY_SAMPLE === "after"
            ? "after"
            : "before",
        attempt,
        mode: result.mode,
        elapsedMs: Math.round(performance.now() - start),
        grounded,
        events,
      };
      measurements.push(measurement);
      writeFileSync(
        "/private/tmp/inventory-jarvis-reliability-measurement.json",
        JSON.stringify(measurements, null, 2),
      );
      console.info(JSON.stringify(measurement));
      expect(grounded).toBe(true);
    }
  },
  90000,
);

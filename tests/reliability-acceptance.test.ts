import { AIMessage } from "@langchain/core/messages";
import { afterEach, expect, it, vi } from "vitest";
import { askInventory, type InventoryFact } from "../src/lib/ask";
import { createReadOnlyAnswerGraph } from "../src/lib/answer-graph";
import { searchFacts } from "../src/lib/inventory-search";
import type { JarvisDiagnostic } from "../src/lib/jarvis-diagnostics";

const rows: InventoryFact[] = [
  {
    id: "bag",
    name: "Backpack",
    description: "Synthetic QA fixture",
    category: "Travel",
    quantity: 1,
    unit: "pc",
    status: "active",
    condition: "good",
    location_name: "Test Home",
    tags: [],
    attributes: {},
  },
  {
    id: "contacts",
    name: "Daily contact lenses",
    description: "Synthetic QA fixture",
    category: "Personal care",
    quantity: 8,
    unit: "pairs",
    status: "active",
    condition: "good",
    location_name: "Test Home → Bedroom",
    tags: [],
    attributes: {},
  },
];
const reader = () => ({
  search: vi.fn(async (query: string) => searchFacts(rows, query)),
});
afterEach(() => vi.restoreAllMocks());

it.each(["transport", "timeout", "malformed"])(
  "keeps a truthful useful fallback without changes after %s failure",
  async (failure) => {
    const inventory = reader();
    const before = structuredClone(rows);
    const provider = createReadOnlyAnswerGraph({
      invoke: vi.fn(async () => {
        if (failure === "transport") throw new TypeError("fetch failed");
        if (failure === "timeout")
          throw new DOMException("Synthetic timeout", "TimeoutError");
        return new AIMessage('{"answer":"truncated');
      }),
    });
    const result = await askInventory(
      "Pack me for camping",
      inventory,
      provider,
    );
    expect(result.mode).toBe("search");
    expect(result.notice).toMatch(/unavailable|could not be validated/i);
    expect(result.notice).toMatch(/No items were changed/);
    expect(result.answer).toMatch(/not a complete camping checklist/);
    expect(result.citations.map((row) => row.id)).toEqual(
      expect.arrayContaining(["bag", "contacts"]),
    );
    expect(result.changes).toBeUndefined();
    expect(rows).toEqual(before);
  },
);

it("aborts an in-flight model invocation without further model calls or inventory changes", async () => {
  const controller = new AbortController();
  vi.spyOn(AbortSignal, "timeout").mockReturnValue(controller.signal);
  let invoked!: () => void;
  const entered = new Promise<void>((resolve) => {
    invoked = resolve;
  });
  const invoke = vi.fn(
    async (_messages: unknown, options?: { signal: AbortSignal }) => {
      invoked();
      return await new Promise<AIMessage>((_resolve, reject) => {
        const abort = () =>
          reject(
            options?.signal.reason ?? new DOMException("Aborted", "AbortError"),
          );
        if (options?.signal.aborted) abort();
        else options?.signal.addEventListener("abort", abort, { once: true });
      });
    },
  );
  const result = askInventory(
    "Pack me for camping",
    reader(),
    createReadOnlyAnswerGraph({ invoke }),
  );
  await entered;
  controller.abort(new DOMException("Synthetic cancellation", "AbortError"));
  expect(await result).toMatchObject({
    mode: "search",
    notice: expect.stringMatching(/No items were changed/),
  });
  expect(invoke).toHaveBeenCalledOnce();
});

it("rejects a foreign citation after a real tool lookup, rather than letting model prose establish ownership", async () => {
  let turns = 0;
  const invoke = vi.fn(async () =>
    ++turns === 1
      ? new AIMessage({
          content: "",
          tool_calls: [
            {
              id: "lookup",
              name: "search_inventory",
              args: { query: "backpack" },
            },
          ],
        })
      : new AIMessage(
          JSON.stringify({
            answer: "Pack your synthetic foreign tent.",
            itemIds: ["another-owner-tent"],
          }),
        ),
  );
  const result = await askInventory(
    "Pack me for camping",
    reader(),
    createReadOnlyAnswerGraph({ invoke }),
  );
  expect(result.mode).toBe("search");
  expect(result.answer).not.toContain("foreign tent");
  expect(
    result.citations.every((row) => rows.some((owned) => owned.id === row.id)),
  ).toBe(true);
  expect(result.changes).toBeUndefined();
  expect(invoke).toHaveBeenCalledTimes(2);
});

it.each([
  [new DOMException("sensitive synthetic error", "TimeoutError"), "deadline"],
  [new DOMException("sensitive synthetic error", "AbortError"), "cancelled"],
  [
    Object.assign(new Error("sensitive synthetic error"), {
      status: 429,
      body: "private response",
    }),
    "rate_limit",
  ],
  [new TypeError("sensitive synthetic error"), "provider_error"],
] as const)(
  "records a sanitized %s failure reason without leaking arbitrary error fields",
  async (error, reason) => {
    const events: JarvisDiagnostic[] = [];
    const inventory = reader();
    const result = await askInventory(
      "Pack me for camping",
      { ...inventory, diagnose: (event) => events.push(event) },
      createReadOnlyAnswerGraph({
        invoke: async () => {
          throw error;
        },
      }),
    );
    expect(result.mode).toBe("search");
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          stage: "answer",
          outcome: "failure",
          reason,
        }),
      ]),
    );
    for (const event of events) {
      expect(
        Object.keys(event).every((key) =>
          [
            "stage",
            "outcome",
            "reason",
            "elapsedMs",
            "turn",
            "toolCalls",
            "finish",
          ].includes(key),
        ),
      ).toBe(true);
      expect(event.elapsedMs).toBeGreaterThanOrEqual(0);
    }
    expect(JSON.stringify(events)).not.toMatch(
      /sensitive|private response|body|stack/,
    );
  },
);

it("a failing diagnostics sink cannot cause another request or change a valid answer", async () => {
  const invoke = vi.fn(
    async () =>
      new AIMessage(
        JSON.stringify({
          answer: "Backpack is available in Test Home.",
          itemIds: ["bag"],
        }),
      ),
  );
  const result = await askInventory(
    "Where is Backpack?",
    {
      ...reader(),
      diagnose: () => {
        throw new Error("Synthetic sink failure");
      },
    },
    createReadOnlyAnswerGraph({ invoke }),
  );
  expect(result.mode).toBe("ai");
  expect(result.citations.map((row) => row.id)).toEqual(["bag"]);
  expect(invoke).toHaveBeenCalledOnce();
});

it.each(["foreign-citation", "illegal-tool", "limited-answer"])(
  "keeps fourth-turn grounding and budgets for %s",
  async (outcome) => {
    let turns = 0;
    let toolReads = 0;
    const events: JarvisDiagnostic[] = [];
    const invoke = vi.fn(
      async (
        messages: unknown[],
        options?: { signal: AbortSignal; finalAnswer?: boolean },
      ) => {
        turns++;
        expect(options?.finalAnswer).toBe(turns === 4);
        if (turns < 4 || outcome === "illegal-tool")
          return new AIMessage({
            content: "",
            tool_calls: [
              {
                id: `lookup-${turns}`,
                name: "search_inventory",
                args: { query: "backpack" },
              },
            ],
          });
        expect(String((messages[0] as { content: string }).content)).toMatch(
          /evidence is insufficient|never invent/,
        );
        return new AIMessage(
          JSON.stringify(
            outcome === "foreign-citation"
              ? { answer: "Pack your foreign tent.", itemIds: ["foreign-tent"] }
              : {
                  answer:
                    "Backpack is available. Shelter was not found in the records searched; this list is incomplete.",
                  itemIds: ["bag"],
                },
          ),
        );
      },
    );
    const result = await askInventory(
      "Pack me for camping",
      {
        search: async (query) => searchFacts(rows, query),
        searchPage: undefined,
        diagnose: (event) => events.push(event),
      },
      createReadOnlyAnswerGraph({
        invoke: async (messages, options) => {
          // Count only tool reads from the diagnostic tool-message boundary below.
          const previous = messages.at(-2) as { tool_calls?: unknown[] };
          if (previous?.tool_calls?.length) toolReads++;
          return invoke(messages, options);
        },
      }),
    );
    expect(invoke).toHaveBeenCalledTimes(4);
    expect(toolReads).toBe(3);
    expect(result.changes).toBeUndefined();
    if (outcome === "limited-answer") {
      expect(result.mode).toBe("ai");
      expect(result.answer).toMatch(/not found in the records searched/);
      expect(result.citations.map((row) => row.id)).toEqual([
        "bag",
        "contacts",
      ]);
      expect(result.answer).toMatch(/Recorded personal essentials to review/);
    } else {
      expect(result.mode).toBe("search");
      expect(result.answer).not.toContain("foreign tent");
      expect(events).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            stage: "answer",
            outcome: "failure",
            reason: outcome === "foreign-citation" ? "citation" : "tool_budget",
          }),
        ]),
      );
    }
  },
);

it("surfaces uncited recorded personal essentials separately from the model's packing selection without sweeping in other possessions", async () => {
  // Reconstructed failure pattern, not the unretained live model response.
  const owned: InventoryFact[] = [
    ...Array.from({ length: 260 }, (_, n) => ({
      ...rows[0],
      id: `decor-${n}`,
      name: `Desk ornament ${n}`,
      category: "Decor",
    })),
    ...rows,
    {
      ...rows[0],
      id: "guard",
      name: "Night guard",
      category: "Personal care",
      location_name: "Test Home → Bedroom → Drawer",
    },
    {
      ...rows[0],
      id: "unavailable",
      name: "Contact lens solution",
      category: "Personal care",
      quantity: 0,
    },
    {
      ...rows[0],
      id: "disposed",
      name: "Prescription glasses",
      category: "Health",
      status: "disposed",
    },
    {
      ...rows[0],
      id: "lent",
      name: "Reading glasses",
      category: "Personal care",
      status: "lent",
    },
    {
      ...rows[0],
      id: "unrelated",
      name: "Hair dryer",
      category: "Personal care",
    },
  ];
  const before = structuredClone(owned);
  const answer = vi.fn(async () => ({
    answer:
      "Pack Backpack. Personal essentials: Daily contact lenses and Night guard.",
    itemIds: ["bag"],
  }));
  const result = await askInventory(
    "Help me pack for camping for two nights.",
    { search: async (query) => searchFacts(owned, query) },
    { answer },
  );
  expect(result.mode).toBe("ai");
  expect(result.citations.map((row) => row.id).sort()).toEqual([
    "bag",
    "contacts",
    "guard",
  ]);
  expect(result.answer).toMatch(/Recorded personal essentials to review/i);
  expect(result.answer).toContain("Test Home → Bedroom → Drawer");
  expect(result.answer).toMatch(/confirm|review|suitability/i);
  expect(result.answer).not.toMatch(
    /Desk ornament|Hair dryer|Contact lens solution|Prescription glasses|Reading glasses/,
  );
  expect(answer).toHaveBeenCalledOnce();
  expect(result.changes).toBeUndefined();
  expect(owned).toEqual(before);
});

it("does not reintroduce an explicitly excluded personal essential in a packing follow-up", async () => {
  const owned = [
    ...rows,
    { ...rows[0], id: "guard", name: "Night guard", category: "Personal care" },
  ];
  const result = await askInventory(
    "Remove Night guard",
    { search: async (query) => searchFacts(owned, query) },
    {
      answer: async () => ({
        answer: "Backpack remains on the list.",
        itemIds: ["bag"],
      }),
    },
    [{ question: "Pack me for camping", answer: "A starting packing list." }],
  );
  expect(result.citations.map((row) => row.id)).not.toContain("guard");
  expect(result.answer).not.toMatch(/Night guard/i);
  expect(result.changes).toBeUndefined();
});

it("does not add packing-only review records to an unrelated lookup", async () => {
  const result = await askInventory("Where is Backpack?", reader(), {
    answer: async () => ({
      answer: "Backpack is in Test Home.",
      itemIds: ["bag"],
    }),
  });
  expect(result.mode).toBe("ai");
  expect(result.citations.map((row) => row.id)).toEqual(["bag"]);
  expect(result.answer).not.toMatch(/Recorded personal essentials/);
});

it("bounds optional recorded-essential review without truncating an already valid answer", async () => {
  const owned = [
    ...rows,
    ...Array.from({ length: 6 }, (_, n) => ({
      ...rows[1],
      id: `guard-${n}`,
      name: `Night guard ${n}`,
    })),
  ];
  const inventory = {
    search: async (query: string) => searchFacts(owned, query),
  };
  const result = await askInventory("Pack me for camping", inventory, {
    answer: async () => ({
      answer: "Backpack is available.",
      itemIds: ["bag"],
    }),
  });
  expect(result.citations).toHaveLength(5);
  expect(
    result.citations.every((row) => owned.some((known) => known.id === row.id)),
  ).toBe(true);
  expect(result.citations.filter((row) => row.id !== "bag")).toHaveLength(4);
  const longAnswer = "x".repeat(4000);
  const capped = await askInventory("Pack me for camping", inventory, {
    answer: async () => ({ answer: longAnswer, itemIds: ["bag"] }),
  });
  expect(capped.mode).toBe("ai");
  expect(capped.answer).toBe(longAnswer);
  expect(capped.citations.map((row) => row.id)).toEqual(["bag"]);
});

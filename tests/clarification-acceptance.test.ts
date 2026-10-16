import { expect, it, vi } from "vitest";
import {
  askInventory,
  type InventoryFact,
  type ChatTurn,
  type AnswerProvider,
} from "../src/lib/ask";
import { searchFacts } from "../src/lib/inventory-search";

const bag: InventoryFact = {
  id: "bag",
  name: "Backpack",
  description: "Synthetic trip fixture",
  category: "Travel",
  quantity: 1,
  unit: "pc",
  status: "active",
  condition: "good",
  location_name: "Test Home",
  tags: [],
  attributes: {},
};
const reader = () => ({
  search: vi.fn(async (query: string) => searchFacts([bag], query)),
});
const answerProvider = () => ({
  answer: vi.fn<AnswerProvider["answer"]>(async () => ({
    answer:
      "Owned: Backpack at Test Home. Suggested shelter was not found in the searched records.",
    itemIds: ["bag"],
  })),
});

it("asks a bounded material camping question bundle instead of silently choosing destination, weather, length or style", async () => {
  const provider = answerProvider();
  const result = await askInventory("Pack me for camping", reader(), provider);
  expect(provider.answer).not.toHaveBeenCalled();
  expect(result.answer).toMatch(/where|destination|location/i);
  expect(result.answer).toMatch(/weather|conditions|temperature/i);
  expect(result.answer).toMatch(/long|nights|duration/i);
  expect(result.answer.match(/\?/g)?.length).toBeLessThanOrEqual(3);
  expect(result.answer).toMatch(/basic|assum|unknown|not sure/i);
  expect(result.citations).toEqual([]);
  expect(result.changes).toBeUndefined();
});

it("preserves the clarification exchange and uses a complete reply without asking the original questions again", async () => {
  const provider = answerProvider();
  const first = await askInventory("Pack me for camping", reader(), provider);
  const history: ChatTurn[] = [
    { question: "Pack me for camping", answer: first.answer },
  ];
  const reply =
    "Yosemite, two nights, car camping. Expect cold rain; I am not asking for a live forecast.";
  const result = await askInventory(reply, reader(), provider, history);
  expect(provider.answer).toHaveBeenCalledOnce();
  const context = provider.answer.mock.calls[0]?.[0];
  expect(JSON.stringify(context)).toContain("Yosemite");
  expect(JSON.stringify(context)).toContain("cold rain");
  expect(context?.history).toEqual(history);
  expect(JSON.stringify(context)).not.toMatch(/destination unspecified/);
  expect(result.answer).not.toMatch(
    /where (?:are you|will you)|what (?:weather|conditions)|how (?:long|many nights)/i,
  );
  expect(result.citations.map((row) => row.id)).toContain("bag");
  expect(result.changes).toBeUndefined();
});

it("does not ask for destination or duration already given in the initial request", async () => {
  const result = await askInventory(
    "Help me pack for two nights camping in Yosemite",
    reader(),
    answerProvider(),
  );
  expect(result.answer).toMatch(/weather|conditions|temperature/i);
  expect(result.answer).not.toMatch(
    /where (?:are you|will you)|how (?:long|many nights)/i,
  );
});

it("keeps the trip anchor and user answers when the user supplies a later duration/weather correction", async () => {
  const provider = answerProvider();
  const first = await askInventory("Pack me for camping", reader(), provider);
  const details = "Yosemite, two nights, car camping. Expect cold rain.";
  const second = await askInventory(details, reader(), provider, [
    { question: "Pack me for camping", answer: first.answer },
  ]);
  const result = await askInventory(
    "Make it three nights instead, with snow.",
    reader(),
    provider,
    [
      { question: "Pack me for camping", answer: first.answer },
      { question: details, answer: second.answer },
    ],
  );
  expect(provider.answer).toHaveBeenCalledTimes(2);
  const latest = provider.answer.mock.calls[1][0];
  expect(latest.question).toMatch(/camping/i);
  expect(latest.question).toContain("Yosemite");
  expect(latest.question).toContain("three nights");
  expect(latest.question).toContain("snow");
  expect(latest.question).not.toContain("destination unspecified");
  expect(result.clarification).not.toBe(true);
  expect(result.citations.map((row) => row.id)).toContain("bag");
});

it("asks for missing conditions for a new trip instead of reusing another trip's weather", async () => {
  const provider = answerProvider();
  const old = "Pack for two nights car camping in Yosemite with cold rain.";
  const first = await askInventory(old, reader(), provider);
  const next = await askInventory(
    "Help me pack for a weekend trip to Miami",
    reader(),
    provider,
    [{ question: old, answer: first.answer }],
  );
  expect(next.clarification).toBe(true);
  expect(next.answer).toMatch(/conditions|weather/);
  expect(next.answer).not.toContain("cold rain");
  expect(provider.answer).toHaveBeenCalledOnce();
});

it("does not mistake unrelated prior inventory conversation or assistant assertions for user-supplied trip facts", async () => {
  const result = await askInventory(
    "Pack me for camping",
    reader(),
    answerProvider(),
    [
      {
        question: "Where is Backpack?",
        answer: "You are going to Yosemite for two nights. It will be sunny.",
      },
    ],
  );
  expect(result.clarification).toBe(true);
  expect(result.answer).toMatch(/Where are you going/);
  expect(result.answer).toMatch(/days or nights/);
  expect(result.answer).toMatch(/conditions/);
});

it("a fully specified trip proceeds directly without a questionnaire", async () => {
  const provider = answerProvider();
  await askInventory(
    "Pack for a two-night car camping trip in Yosemite. Expected weather: cold rain.",
    reader(),
    provider,
  );
  expect(provider.answer).toHaveBeenCalledOnce();
});

it.each([
  "I don't know yet; make a basic list.",
  "Use reasonable assumptions and proceed.",
  "Skip the questions; just a basic packing list.",
])("supports an explicit escape from clarification: %s", async (reply) => {
  const provider = answerProvider();
  const first = await askInventory("Pack me for camping", reader(), provider);
  const result = await askInventory(reply, reader(), provider, [
    { question: "Pack me for camping", answer: first.answer },
  ]);
  expect(provider.answer).toHaveBeenCalledOnce();
  expect(result.answer).toMatch(/assum|unknown|provisional|basic/i);
  expect(result.answer).not.toMatch(
    /where (?:are you|will you)|how (?:long|many nights)/i,
  );
  expect(result.changes).toBeUndefined();
});

it("unknown trip facts do not create an endless clarification loop even without a model provider", async () => {
  const first = await askInventory("Pack me for camping", reader());
  const result = await askInventory("Not sure yet", reader(), undefined, [
    { question: "Pack me for camping", answer: first.answer },
  ]);
  expect(result.answer).toMatch(/assum|unknown|provisional|basic/i);
  expect(result.answer).not.toMatch(
    /where (?:are you|will you)|how (?:long|many nights)/i,
  );
  expect(result.mode).toBe("search");
  expect(result.changes).toBeUndefined();
});

it("labels unresolved trip assumptions even when the inventory is empty and the provider is unavailable", async () => {
  const empty = { search: async () => [] };
  const first = await askInventory("Pack me for camping", empty);
  const result = await askInventory(
    "Not sure yet, use a basic list.",
    empty,
    undefined,
    [{ question: "Pack me for camping", answer: first.answer }],
  );
  expect(result.clarification).not.toBe(true);
  expect(result.mode).toBe("search");
  expect(result.answer).toMatch(/Provisional assumptions/);
  expect(result.answer).toMatch(/No matching items found/);
  expect(result.citations).toEqual([]);
  expect(result.changes).toBeUndefined();
});

it.each([
  "Where is Backpack?",
  "Add a tent to my inventory",
  "Change Backpack's status to stored",
])(
  "does not intercept an unrelated lookup or explicit inventory edit: %s",
  async (question) => {
    const provider = answerProvider();
    await askInventory(question, reader(), provider);
    expect(provider.answer).toHaveBeenCalledOnce();
  },
);

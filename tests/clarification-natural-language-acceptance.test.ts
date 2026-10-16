import { expect, it, vi } from "vitest";
import { askInventory, type InventoryFact } from "../src/lib/ask";
import { searchFacts } from "../src/lib/inventory-search";

const bag: InventoryFact = {
  id: "synthetic-bag",
  name: "Backpack",
  description: "Synthetic QA fixture",
  category: "Travel",
  quantity: 1,
  unit: "pc",
  status: "active",
  condition: "good",
  location_name: "Test shelf",
  tags: [],
  attributes: {},
};

it.each([
  "Help me make a packing list for camping: destination Yosemite; duration 2 nights; style car camping; weather rainy.",
  "Pack for a 3-day business trip to Chicago. Expected weather is 70 degrees Fahrenheit and clear skies. Staying at a hotel.",
  "Pack for Yosemite for two nights, cold rain, driving to a campsite.",
])(
  "does not suppress an answer when complete trip context is expressed naturally: %s",
  async (question) => {
    const provider = {
      answer: vi.fn(async () => ({
        answer: "Backpack is available on Test shelf.",
        itemIds: [bag.id],
      })),
    };
    const result = await askInventory(
      question,
      { search: async (query) => searchFacts([bag], query) },
      provider,
    );
    expect(result.clarification).not.toBe(true);
    expect(provider.answer).toHaveBeenCalledOnce();
  },
);

it("accepts a natural short reply without false destination assumptions and keeps later destination corrections in the same trip", async () => {
  const reader = { search: async (query: string) => searchFacts([bag], query) };
  const provider = {
    answer: vi.fn(async (context: { question: string }) => ({
      answer: `Grounded packing response. ${context.question}`,
      itemIds: [bag.id],
    })),
  };
  const first = await askInventory("Pack me for camping", reader, provider);
  const details = "Yosemite for two nights, rain, driving";
  const second = await askInventory(details, reader, provider, [
    { question: "Pack me for camping", answer: first.answer },
  ]);
  expect(second.clarification).not.toBe(true);
  expect(second.answer).not.toContain("destination unspecified");
  const third = await askInventory(
    "How about Big Sur instead?",
    reader,
    provider,
    [
      { question: "Pack me for camping", answer: first.answer },
      { question: details, answer: second.answer },
    ],
  );
  expect(third.clarification).not.toBe(true);
  const context = provider.answer.mock.calls.at(-1)?.[0].question;
  expect(context).toContain("camping");
  expect(context).toContain("Big Sur");
  expect(context).toContain("two nights");
  expect(context).toContain("rain");
});

it("a natural request for something useful exits the question bundle, and a simple backpack request is not treated as a trip questionnaire", async () => {
  const reader = { search: async (query: string) => searchFacts([bag], query) };
  const provider = {
    answer: vi.fn(async () => ({
      answer: "Backpack is available.",
      itemIds: [bag.id],
    })),
  };
  const first = await askInventory("Pack me for camping", reader, provider);
  const next = await askInventory(
    "Just give me something useful",
    reader,
    provider,
    [{ question: "Pack me for camping", answer: first.answer }],
  );
  expect(next.clarification).not.toBe(true);
  expect(next.answer).toMatch(/provisional|assum/i);
  await askInventory("Pack my backpack", reader, provider);
  expect(provider.answer).toHaveBeenCalledTimes(2);
});

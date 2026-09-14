import { z } from "zod";
import { queryTerms, type Item } from "./inventory";
export interface InventoryReader {
  search(query: string): Promise<Item[]>;
}
export type InventoryFact = Pick<
  Item,
  | "id"
  | "name"
  | "description"
  | "category"
  | "quantity"
  | "unit"
  | "status"
  | "condition"
  | "location_name"
  | "tags"
  | "attributes"
>;
export interface AnswerProvider {
  answer(context: {
    question: string;
    items: readonly InventoryFact[];
  }): Promise<unknown>;
}
export type AskResult = {
  answer: string;
  citations: InventoryFact[];
  mode: "search" | "ai";
  notice?: string;
};
const output = z
  .object({
    answer: z.string().trim().min(1).max(4000),
    itemIds: z.array(z.string()).min(1).max(20),
  })
  .strict();
export const questionInput = z
  .object({ question: z.string().trim().min(1).max(1000) })
  .strict();
export async function askInventory(
  question: string,
  reader: InventoryReader,
  provider?: AnswerProvider,
): Promise<AskResult> {
  question = questionInput.parse({ question }).question;
  // UX guard only: the actual security boundary is absence of any write capability.
  if (
    /\b(delete|remove|add|update|change|move|set|consume|buy|order)\b/i.test(
      question,
    )
  ) {
    return {
      answer:
        "Ask is read-only. Use the inventory editor to add, change, or remove items.",
      citations: [],
      mode: "search",
    };
  }
  const terms = queryTerms(question);
  const rows = (await reader.search(terms.join(" "))).slice(0, 20);
  const facts: InventoryFact[] = rows.map(
    ({
      id,
      name,
      description,
      category,
      quantity,
      unit,
      status,
      condition,
      location_name,
      tags,
      attributes,
    }) => ({
      id,
      name,
      description,
      category,
      quantity,
      unit,
      status,
      condition,
      location_name,
      tags,
      attributes,
    }),
  );
  const items: InventoryFact[] = [];
  let remaining = 12000;
  for (const fact of facts) {
    const compact = {
      ...fact,
      description: fact.description.slice(0, 500),
      attributes:
        JSON.stringify(fact.attributes).length <= 1000 ? fact.attributes : {},
    };
    const size = JSON.stringify(compact).length;
    if (size > remaining) break;
    items.push(compact);
    remaining -= size;
  }
  if (!items.length)
    return {
      answer:
        "No matching items found. Try an item name, location, category, or tag. This search cannot confirm that you do not own it.",
      citations: [],
      mode: "search",
    };
  const fallback: AskResult = {
    answer: items
      .map(
        (i) =>
          `${i.name} — ${i.quantity} ${i.unit}; ${i.location_name || "no location set"}; ${i.status}.`,
      )
      .join("\n"),
    citations: items,
    mode: "search",
  };
  if (!provider) return fallback;
  try {
    const result = output.parse(
      await provider.answer({ question, items: structuredClone(items) }),
    );
    const ids = [...new Set(result.itemIds)];
    if (ids.some((id) => !items.some((i) => i.id === id)))
      throw new Error("Unknown citation");
    return {
      answer: result.answer,
      citations: items.filter((i) => ids.includes(i.id)),
      mode: "ai",
    };
  } catch {
    return {
      ...fallback,
      notice:
        "The AI answer was unavailable or could not be validated. Showing matching inventory records.",
    };
  }
}

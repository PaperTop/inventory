import { z } from "zod";
import { conditions, statuses, type Item } from "./inventory";
import {
  inventoryIntent,
  retrieveInventory,
  searchFacts,
} from "./inventory-search";
import {
  inventoryOverview,
  inventoryPage,
  type InventoryOverview,
  type InventoryPage,
} from "./inventory-context";
import {
  inventoryChangeInput,
  requestsInventoryChange,
  type InventoryChange,
} from "./inventory-changes";
export interface InventoryReader {
  search(
    query: string,
  ): Promise<(InventoryFact & { location_path?: string[] })[]>;
  overview?(offset?: number): Promise<InventoryOverview>;
  searchPage?(query: string, offset?: number): Promise<InventoryPage>;
  prepareChange?(change: InventoryChange): void;
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
  answer(
    context: {
      question: string;
      items: readonly InventoryFact[];
      history?: ChatTurn[];
    },
    reader?: InventoryReader,
  ): Promise<unknown>;
}
export type ChatTurn = { question: string; answer: string };
export type AskResult = {
  answer: string;
  citations: InventoryFact[];
  mode: "search" | "ai";
  notice?: string;
  changes?: InventoryChange[];
};
export const answerOutput = z
  .object({
    answer: z.string().trim().min(1).max(4000),
    itemIds: z.array(z.string()).max(20),
  })
  .strict();
export const questionInput = z
  .object({
    question: z.string().trim().min(1).max(1000),
    history: z
      .array(
        z
          .object({
            question: z.string().max(1000),
            answer: z.string().max(4000),
          })
          .strict(),
      )
      .max(6)
      .optional(),
  })
  .strict();

export const inventoryFactInput = z
  .object({
    id: z.string().min(1).max(160),
    name: z.string().min(1).max(160),
    description: z.string().max(2000),
    category: z.string().max(80),
    quantity: z.number().finite().min(0).max(1_000_000_000),
    unit: z.string().min(1).max(30),
    status: z.enum(statuses),
    condition: z.enum(conditions),
    location_name: z.string().max(2000).nullable(),
    tags: z.array(z.string().max(40)).max(20),
    attributes: z
      .record(z.string().max(80), z.json())
      .refine((value) => JSON.stringify(value).length <= 1000),
  })
  .strict();

export function inventoryFacts(
  rows: readonly (InventoryFact & { location_path?: string[] })[],
): InventoryFact[] {
  return rows.map(
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
      location_path,
      tags,
      attributes,
    }) => ({
      id,
      name,
      category,
      quantity,
      unit,
      status,
      condition,
      tags,
      location_name: location_path?.slice(0, -1).join(" → ") || location_name,
      description,
      attributes: JSON.stringify(attributes).length <= 1000 ? attributes : {},
    }),
  );
}

function boundedFacts(rows: readonly InventoryFact[]) {
  return inventoryPage(inventoryFacts(rows)).items;
}

export async function askInventory(
  question: string,
  reader: InventoryReader,
  provider?: AnswerProvider,
  history?: ChatTurn[],
): Promise<AskResult> {
  ({ question, history } = questionInput.parse({ question, history }));
  const editing = requestsInventoryChange(question, history);
  // UX guard only: the actual security boundary is absence of any write capability.
  if (
    /^(?:please\s+)?(?:delete|remove|consume|buy|order)\b/i.test(question) &&
    !/\b(list|pack(?:ing)?|plan)\b/i.test(question) &&
    (!history?.length || /\b(inventory|database)\b/i.test(question))
  ) {
    return {
      answer:
        "Ask is read-only. Use the inventory editor to add, change, or remove items.",
      citations: [],
      mode: "search",
    };
  }
  const items = boundedFacts(await retrieveInventory(question, reader));
  const empty: AskResult = {
    answer:
      "No matching items found. Try an item name, location, category, or tag. This search cannot confirm that you do not own it.",
    citations: [],
    mode: "search",
  };
  const packing = inventoryIntent(question) === "camping";
  const fallback: AskResult = !items.length
    ? empty
    : {
        answer:
          (packing
            ? "A starting packing list from your available inventory:\n"
            : "") +
          items
            .map(
              (i) =>
                `${i.name} — ${i.quantity} ${i.unit}; ${i.location_name || "no location set"}; ${i.status}.`,
            )
            .join("\n") +
          (packing
            ? "\nThis is not a complete camping checklist. Check shelter, sleep gear, food, lighting, and weather protection for your trip."
            : ""),
        citations: items,
        mode: "search",
      };
  if (!provider)
    return editing
      ? {
          answer:
            "Adding or editing items through Jarvis needs an AI connection. No items were changed. You can still use the inventory editor.",
          citations: [],
          mode: "search",
        }
      : fallback;
  try {
    const evidence = new Map(items.map((item) => [item.id, item]));
    const changes: InventoryChange[] = [];
    let searches = 0;
    let snapshot: Promise<InventoryFact[]> | undefined;
    const getSnapshot = () =>
      (snapshot ??= reader.search("").then(inventoryFacts));
    const checkRead = (offset: number) => {
      // One automatic overview plus at most twelve tool calls.
      if (++searches > 13) throw new Error("Inventory search limit reached.");
      z.number().int().min(0).max(1_000_000).parse(offset);
    };
    const searchPage = async (query: string, offset = 0) => {
      checkRead(offset);
      z.string().max(200).parse(query);
      const page = inventoryPage(
        searchFacts(await getSnapshot(), query),
        offset,
      );
      page.items.forEach((item) => evidence.set(item.id, item));
      return structuredClone(page);
    };
    const safeReader: InventoryReader = {
      search: async (query) => (await searchPage(query)).items,
      searchPage,
      overview: async (offset = 0) => {
        checkRead(offset);
        return inventoryOverview(await getSnapshot(), offset);
      },
      ...(editing
        ? {
            prepareChange: (rawChange: InventoryChange) => {
              const change = inventoryChangeInput.parse(rawChange);
              if (changes.length >= 5)
                throw new Error("At most five item changes per request.");
              if (change.type === "update" && !evidence.has(change.id))
                throw new Error("Search for an item before editing it.");
              changes.push(change);
            },
          }
        : {}),
    };
    const result = answerOutput.parse(
      await provider.answer(
        {
          question,
          items: structuredClone(items),
          ...(history?.length ? { history } : {}),
        },
        safeReader,
      ),
    );
    const ids = [...new Set(result.itemIds)];
    if (ids.some((id) => !evidence.has(id)))
      throw new Error("Unknown citation");
    return {
      answer: result.answer,
      citations: ids.map((id) => evidence.get(id)!),
      mode: "ai",
      ...(changes.length ? { changes } : {}),
    };
  } catch {
    return {
      ...fallback,
      notice:
        "The AI answer was unavailable or could not be validated. No items were changed. Showing matching inventory records.",
    };
  }
}

import { z } from "zod";
import { tripContext } from "./trip-context";
import { conversationIntent, withoutGreeting } from "./conversation-intent";
import {
  fallbackNotice,
  failureReason,
  JarvisFailure,
  reportDiagnostic,
  type JarvisDiagnostic,
} from "./jarvis-diagnostics";
import { conditions, statuses, type Item, type Location } from "./inventory";
import {
  explicitScopeQuestion,
  inventoryContents,
  resolveScopeName,
  scopeChoices,
  type InventoryResult,
  type InventoryScopeChoice,
} from "./inventory-scope";
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
  diagnose?(event: JarvisDiagnostic): void;
  snapshot?(): Promise<{ items: Item[]; locations: Location[] }>;
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
> &
  Partial<
    Pick<
      Item,
      | "kind"
      | "location_path"
      | "parent_container_id"
      | "resolved_location_id"
      | "location_ancestor_ids"
    >
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
  conversational?: boolean;
  contextNotice?: string;
  clarification?: boolean;
  answer: string;
  citations: InventoryFact[];
  mode: "search" | "ai";
  notice?: string;
  changes?: InventoryChange[];
  inventoryResult?: InventoryResult;
  scopeChoices?: InventoryScopeChoice[];
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
    kind: z.enum(["durable", "consumable", "container"]).optional(),
    location_path: z.array(z.string().max(160)).max(128).optional(),
    parent_container_id: z.string().min(1).max(160).nullable().optional(),
    resolved_location_id: z.string().min(1).max(160).nullable().optional(),
    location_ancestor_ids: z.array(z.string().max(160)).max(2).optional(),
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
      kind,
      parent_container_id,
      resolved_location_id,
      location_ancestor_ids,
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
      ...(kind ? { kind } : {}),
      ...(location_path ? { location_path } : {}),
      ...(parent_container_id !== undefined ? { parent_container_id } : {}),
      ...(resolved_location_id !== undefined ? { resolved_location_id } : {}),
      ...(location_ancestor_ids ? { location_ancestor_ids } : {}),
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
  const conversational = conversationIntent(question);
  if (conversational)
    return {
      answer: conversational,
      citations: [],
      mode: "search",
      conversational: true,
    };
  question = withoutGreeting(question);
  const priorScope = history?.some((turn) =>
    explicitScopeQuestion(turn.question),
  );
  const followUp = /^(?:and\s+)?(?:in|inside|what about)\s+/i;
  let scopeName =
    explicitScopeQuestion(question) ??
    (priorScope && followUp.test(question)
      ? question.replace(followUp, "").replace(/[?.!]+$/, "")
      : null);
  // A full breadcrumb reply can answer a scope clarification without repeating
  // the original sentence. Resolve it against current records, never chat prose.
  if (!scopeName && priorScope && reader.snapshot && question.length <= 200) {
    const snapshot = await reader.snapshot();
    if (
      resolveScopeName(
        question,
        scopeChoices(snapshot.items, snapshot.locations),
      ).length
    )
      scopeName = question;
  }
  if (scopeName && reader.snapshot) {
    const snapshot = await reader.snapshot();
    const choices =
      scopeName === "*"
        ? [{ type: "all" as const, id: "all", name: "All inventory", path: [] }]
        : resolveScopeName(
            scopeName,
            scopeChoices(snapshot.items, snapshot.locations),
          );
    if (choices.length !== 1)
      return {
        answer: choices.length
          ? `Which location do you mean? ${choices.map((choice) => choice.path.join(" → ")).join("; ")}.`
          : `I could not identify a location or container named “${scopeName}”. Choose its full path.`,
        citations: [],
        mode: "search",
        ...(choices.length ? { scopeChoices: choices } : {}),
      };
    const page = inventoryContents(
      snapshot.items,
      snapshot.locations,
      choices[0],
    );
    return {
      answer:
        page.total === 0
          ? `There are no recorded items in ${page.scope.path.join(" → ") || page.scope.name}.`
          : `${page.total} recorded ${page.total === 1 ? "item" : "items"} in ${page.scope.path.join(" → ") || page.scope.name}, including nested contents.${page.complete ? " All results are shown." : ` Showing ${page.items.length}; load the next page to see the rest.`}`,
      citations: page.items.slice(0, 20),
      mode: "search",
      inventoryResult: page,
    };
  }
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
  const previousPacking = history?.findLast(
    (turn) =>
      ["camping", "packing"].includes(inventoryIntent(turn.question)) &&
      !/^(?:please )?(?:remove|add|exclude|without|leave)\b/i.test(
        turn.question,
      ),
  );
  const trip = !editing ? tripContext(question, history) : null;
  if (trip && "clarification" in trip)
    return {
      answer: trip.clarification!,
      citations: [],
      mode: "search",
      clarification: true,
    };
  const planningQuestion = trip?.question ?? question;
  const packingFollowUp = Boolean(
    previousPacking &&
    !editing &&
    /^(?:please )?(?:remove|leave|exclude|without|where|what about|add)\b/i.test(
      question,
    ),
  );
  let retrieved = await retrieveInventory(
    packingFollowUp ? previousPacking!.question : planningQuestion,
    reader,
  );
  if (packingFollowUp) {
    // Apply explicit list exclusions to the deterministic fallback as well as
    // passing history to the provider. These never mutate inventory.
    const excluded = new Set<string>();
    const revisions = [
      ...(history ?? [])
        .slice((history ?? []).indexOf(previousPacking!) + 1)
        .map((turn) => turn.question),
      question,
    ];
    for (const text of revisions) {
      const match = text.match(
        /^(?:please )?(remove|exclude|without|leave(?: out)?|add)\s+(.+?)(?:\s+(?:from|to)\s+(?:(?:my|the)\s+)?(?:camping\s+)?(?:packing\s+)?list)?[.!?]*$/i,
      );
      if (!match) continue;
      const term = match[2].replace(/^(?:the|my)\s+/i, "").toLowerCase();
      if (match[1].toLowerCase() === "add") {
        const available = (await reader.search(term)).filter(
          (row) =>
            row.quantity > 0 && ["active", "stored"].includes(row.status),
        );
        retrieved = [
          ...new Map(
            [...retrieved, ...available].map((row) => [row.id, row]),
          ).values(),
        ];
      }
      const exact = retrieved.filter((row) => row.name.toLowerCase() === term);
      const matching = exact.length
        ? exact
        : retrieved.filter((row) => row.name.toLowerCase().includes(term));
      for (const row of matching) {
        if (match[1].toLowerCase() === "add") excluded.delete(row.id);
        else excluded.add(row.id);
      }
    }
    retrieved = retrieved.filter((row) => !excluded.has(row.id));
  }
  const items = boundedFacts(retrieved);
  const empty: AskResult = {
    answer:
      (trip?.summary ?? "") +
      "No matching items found. Try an item name, location, category, or tag. This search cannot confirm that you do not own it.",
    citations: [],
    mode: "search",
  };
  const intent = inventoryIntent(
    packingFollowUp ? previousPacking!.question : planningQuestion,
  );
  const packing = intent === "camping" || intent === "packing";
  const fallback: AskResult = !items.length
    ? empty
    : {
        answer:
          (trip?.summary ?? "") +
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
            ? intent === "camping"
              ? "\nThis is not a complete camping checklist. Check shelter, sleep gear, food, lighting, and weather protection for your trip."
              : "\nThis is a starting list from available records, not a complete trip checklist. Confirm your plans, weather, personal essentials and any supplies not found in the searched records."
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
      : {
          ...fallback,
          notice:
            "AI is not configured. Check the server provider, model and API key settings, then restart the server. Showing matching inventory records.",
        };
  const answerStarted = performance.now();
  try {
    const evidence = new Map(items.map((item) => [item.id, item]));
    const changes: InventoryChange[] = [];
    let searches = 0;
    let snapshot: Promise<InventoryFact[]> | undefined;
    const getSnapshot = () =>
      (snapshot ??= (
        reader.snapshot
          ? reader.snapshot().then((value) => value.items)
          : reader.search("")
      ).then(inventoryFacts));
    const checkRead = (offset: number) => {
      // One automatic overview plus at most twelve tool calls.
      if (++searches > 13) throw new JarvisFailure("tool_budget");
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
      diagnose: reader.diagnose,
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
    const rawResult = await provider.answer(
      {
        question: planningQuestion + (trip?.summary ? `\n${trip.summary}` : ""),
        items: structuredClone(items),
        ...(history?.length ? { history } : {}),
      },
      safeReader,
    );
    const parsed = answerOutput.safeParse(rawResult);
    if (!parsed.success) throw new JarvisFailure("answer_schema");
    const result = parsed.data;
    const ids = [...new Set(result.itemIds)];
    if (ids.some((id) => !evidence.has(id)))
      throw new JarvisFailure("citation");
    // Separate deterministic record evidence from the model's suggestions.
    // Only a bounded set of already-retrieved, available daily necessities is
    // eligible, never every owned record or an inferred medical need.
    const essentials =
      packing && !editing
        ? items
            .filter(
              (item) =>
                !ids.includes(item.id) &&
                item.quantity > 0 &&
                ["active", "stored"].includes(item.status) &&
                /\b(personal care|health|first aid|vision|hygiene)\b/i.test(
                  item.category,
                ) &&
                /\b(contact lenses?|glasses|night guard|medication|medicine|inhaler)\b/i.test(
                  item.name,
                ),
            )
            .slice(0, Math.min(4, 20 - ids.length))
        : [];
    const check = essentials.length
      ? "\n\nRecorded personal essentials to review (confirm trip suitability; not automatically packed):\n" +
        essentials
          .map(
            (item) =>
              `${item.name} — ${item.location_path?.slice(0, -1).join(" → ") || item.location_name || "no location set"}; ${item.quantity} ${item.unit}; ${item.status}${item.condition === "poor" ? "; poor condition" : ""}.`,
          )
          .join("\n")
      : "";
    // Never truncate the model's answer or exceed the validated answer budget.
    const includedEssentials =
      result.answer.length + check.length + (trip?.summary?.length ?? 0) <= 4000
        ? essentials
        : [];
    const answer = result.answer + (includedEssentials.length ? check : "");
    const summary = trip?.summary ?? "";
    reportDiagnostic(reader.diagnose, {
      stage: "answer",
      outcome: "success",
      elapsedMs: performance.now() - answerStarted,
    });
    return {
      answer:
        summary.length + answer.length <= 4000 ? summary + answer : answer,
      ...(summary.length + answer.length > 4000
        ? { contextNotice: summary }
        : {}),
      citations: [...ids.map((id) => evidence.get(id)!), ...includedEssentials],
      mode: "ai",
      ...(changes.length ? { changes } : {}),
    };
  } catch (error) {
    reportDiagnostic(reader.diagnose, {
      stage: "answer",
      outcome: "failure",
      reason: failureReason(error),
      elapsedMs: performance.now() - answerStarted,
    });
    return {
      ...fallback,
      notice: fallbackNotice(failureReason(error)),
    };
  }
}

import type { Item, Location } from "./inventory";
import {
  locationAncestors,
  locationPath,
  resolveHierarchy,
} from "./containers";
import type { InventoryFact } from "./ask";

export type InventoryScope = {
  type: "location" | "container" | "all";
  id?: string;
};
export type InventoryScopeChoice = {
  type: InventoryScope["type"];
  id: string;
  name: string;
  path: string[];
};
export type InventoryResult = {
  scope: InventoryScopeChoice;
  items: (InventoryFact &
    Partial<
      Pick<
        Item,
        | "kind"
        | "location_path"
        | "parent_container_id"
        | "resolved_location_id"
      >
    >)[];
  total: number;
  offset: number;
  limit: number;
  nextOffset: number | null;
  complete: boolean;
  revision?: string;
};
export type InventoryContentsPage = InventoryResult;

export class InventoryScopeChanged extends Error {
  constructor() {
    super("Inventory changed while paging. Start this location query again.");
  }
}

function scopeRevision(value: unknown) {
  // A content fingerprint for consistency checks, never an authorization token.
  let hash = BigInt("0xcbf29ce484222325");
  for (const byte of new TextEncoder().encode(JSON.stringify(value)))
    hash = BigInt.asUintN(64, (hash ^ BigInt(byte)) * BigInt("0x100000001b3"));
  return hash.toString(16).padStart(16, "0");
}

export function inventoryContents(
  items: readonly Item[],
  locations: readonly Location[],
  scope: InventoryScope,
  offset = 0,
  expectedRevision?: string,
): InventoryResult {
  if (!Number.isSafeInteger(offset) || offset < 0)
    throw new Error("Invalid page offset.");
  const rows = resolveHierarchy(items, locations);
  let choice: InventoryScopeChoice = {
    type: "all",
    id: "all",
    name: "All inventory",
    path: [],
  };
  let matching = rows;
  if (scope.type === "location") {
    const place = locations.find((row) => row.id === scope.id);
    if (!place) throw new Error("Location not found.");
    const ids = new Set(
      locations
        .filter(
          (row) =>
            row.id === place.id ||
            locationAncestors(row, locations).some(
              (parent) => parent.id === place.id,
            ),
        )
        .map((row) => row.id),
    );
    matching = rows.filter(
      (row) => row.resolved_location_id && ids.has(row.resolved_location_id),
    );
    choice = {
      type: "location",
      id: place.id,
      name: place.name,
      path: locationPath(place, locations),
    };
  } else if (scope.type === "container") {
    const container = rows.find(
      (row) => row.id === scope.id && row.kind === "container",
    );
    if (!container) throw new Error("Container not found.");
    matching = rows.filter((row) => row.ancestor_ids?.includes(container.id));
    choice = {
      type: "container",
      id: container.id,
      name: container.name,
      path: container.location_path ?? [container.name],
    };
  }
  // A stable identity order makes pagination independent of presentation sort.
  matching = [...matching].sort((left, right) =>
    left.id.localeCompare(right.id),
  );
  const revision = scopeRevision([
    choice,
    matching.map((row) => [row.id, row.version, row.location_path]),
  ]);
  if (expectedRevision && expectedRevision !== revision)
    throw new InventoryScopeChanged();
  const page: InventoryResult["items"] = [];
  let bytes = 0;
  for (const row of matching.slice(offset, offset + 100)) {
    const fact = {
      id: row.id,
      name: row.name,
      description: row.description,
      category: row.category,
      quantity: row.quantity,
      unit: row.unit,
      status: row.status,
      condition: row.condition,
      tags: row.tags,
      attributes:
        JSON.stringify(row.attributes).length <= 1000 ? row.attributes : {},
      location_name:
        row.location_path?.slice(0, -1).join(" → ") || row.location_name,
      kind: row.kind,
      location_path: row.location_path,
      parent_container_id: row.parent_container_id ?? null,
      resolved_location_id: row.resolved_location_id,
    };
    const size = new TextEncoder().encode(JSON.stringify(fact)).byteLength;
    if (page.length && bytes + size > 240_000) break;
    page.push(fact);
    bytes += size;
  }
  const next = offset + page.length;
  return {
    scope: choice,
    items: page,
    total: matching.length,
    offset,
    limit: 100,
    nextOffset: next < matching.length ? next : null,
    complete: offset === 0 && next >= matching.length,
    revision,
  };
}

function normalized(value: string) {
  return value
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/\b(?:the|my)\b/g, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(
      /\b(?:bed room|bath room|livingroom)\b/g,
      (match) =>
        ({
          "bed room": "bedroom",
          "bath room": "bathroom",
          livingroom: "living room",
        })[match]!,
    )
    .trim();
}

export function scopeChoices(
  items: readonly Item[],
  locations: readonly Location[],
): InventoryScopeChoice[] {
  return [
    ...locations.map((row) => ({
      type: "location" as const,
      id: row.id,
      name: row.name,
      path: locationPath(row, locations),
    })),
    ...resolveHierarchy(items, locations)
      .filter((row) => row.kind === "container")
      .map((row) => ({
        type: "container" as const,
        id: row.id,
        name: row.name,
        path: row.location_path ?? [row.name],
      })),
  ];
}

export function resolveScopeName(
  name: string,
  choices: readonly InventoryScopeChoice[],
): InventoryScopeChoice[] {
  const target = normalized(name);
  const exact = choices.filter(
    (choice) =>
      normalized(choice.name) === target ||
      normalized(choice.path.join(" ")) === target,
  );
  if (exact.length) return exact;
  const withoutRole = target.replace(/\s+(?:space|room|container)$/, "");
  const roleMatches = choices.filter(
    (choice) =>
      normalized(choice.name) === withoutRole ||
      normalized(choice.path.join(" ")) === withoutRole,
  );
  if (roleMatches.length) return roleMatches;
  // Full path phrases such as "the drawer in my bedroom".
  const words = target.split(/\s+(?:in|inside|within|at)\s+/);
  if (words.length > 1)
    return choices.filter(
      (choice) =>
        normalized(choice.name) === words[0] &&
        words
          .slice(1)
          .every((part) =>
            choice.path
              .slice(0, -1)
              .some((piece) => normalized(piece) === part),
          ),
    );
  return [];
}

export function explicitScopeQuestion(question: string): string | null {
  question = question.replace(/’/g, "'");
  if (
    /\b(?:everything|every (?:item|thing)|all (?:of )?(?:my |the )?(?:items|things|possessions|contents)|list (?:the )?contents|whats|what is|what's|what do I have|what have I got|(?:show|list) (?:me )?(?:(?:my|the) )?(?:items|things|contents))\b/i.test(
      question,
    )
  ) {
    const match = question.match(
      /\b(?:in|inside|within|at|under|of)\s+(.+?)[?.!]*$/i,
    );
    if (match) return match[1].trim().replace(/[?.!]+$/, "");
    if (
      /\b(?:everything|all (?:my )?(?:items|inventory|possessions))\b/i.test(
        question,
      )
    )
      return "*";
  }
  return null;
}

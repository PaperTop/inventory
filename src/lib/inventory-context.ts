import type { InventoryFact } from "./ask";

export type InventoryPage = {
  items: InventoryFact[];
  totalMatches: number;
  nextOffset: number | null;
  limited: boolean;
};

type InventorySummary = Pick<
  InventoryFact,
  "id" | "name" | "category" | "status" | "quantity"
> & {
  notes: string;
};

export type InventoryOverview = {
  totalItems: number;
  categories: { name: string; count: number }[];
  categoriesLimited: boolean;
  items: InventorySummary[];
  nextOffset: number | null;
  limited: boolean;
};

// Full records retain descriptions for safe edits. The cursor advances by what
// actually fit, not the nominal page size, so long notes cannot hide records.
export function inventoryPage(
  rows: readonly InventoryFact[],
  offset = 0,
): InventoryPage {
  const items: InventoryFact[] = [];
  let remaining = 12000;
  for (const row of rows.slice(offset, offset + 20)) {
    const size = JSON.stringify(row).length + 1;
    if (size > remaining) break;
    items.push(row);
    remaining -= size;
  }
  const next = offset + items.length;
  const limited = next < rows.length;
  return {
    items,
    totalMatches: rows.length,
    nextOffset: limited ? next : null,
    limited,
  };
}

export function inventoryOverview(
  rows: readonly InventoryFact[],
  offset = 0,
): InventoryOverview {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const category = row.category || "Uncategorized";
    counts.set(category, (counts.get(category) ?? 0) + 1);
  }
  const categories = [...counts].sort((a, b) => b[1] - a[1]);
  const items: InventorySummary[] = [];
  let remaining = 8000;
  for (const row of rows.slice(offset, offset + 50)) {
    const summary = {
      id: row.id,
      name: row.name,
      category: row.category,
      status: row.status,
      quantity: row.quantity,
      notes: [row.description, ...row.tags]
        .filter(Boolean)
        .join("; ")
        .slice(0, 160),
    };
    const size = JSON.stringify(summary).length + 1;
    if (size > remaining) break;
    items.push(summary);
    remaining -= size;
  }
  const next = offset + items.length;
  return {
    totalItems: rows.length,
    categories: categories
      .slice(0, 40)
      .map(([name, count]) => ({ name, count })),
    categoriesLimited: categories.length > 40,
    items,
    nextOffset: next < rows.length ? next : null,
    limited: next < rows.length,
  };
}

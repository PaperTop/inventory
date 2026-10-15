import { queryTerms } from "./inventory";
import type { InventoryFact, InventoryReader } from "./ask";

// Small, transparent fallback for the demo. The model can expand any request
// further through search_inventory; this is not a substitute for inference.
export function inventoryIntent(question: string) {
  if (/\b(camp(?:ing)?|hik(?:e|ing))\b/i.test(question)) return "camping";
  if (
    /\b(?:pack(?:ing)?|trip|travel|weekend away|prepare for)\b/i.test(question)
  )
    return "packing";
  if (
    /\b(camera|photo(?:graphy)?)\b.*\b(accessor(?:y|ies)|gear|kit)\b/i.test(
      question,
    )
  )
    return "accessories";
  if (
    /\b(tak(?:e|ing)|shoot|capture)\b.*\b(pictures?|photos?|photographs?)\b/i.test(
      question,
    )
  )
    return "photography";
  return "lookup";
}

export function searchFacts(items: readonly InventoryFact[], query: string) {
  const terms = queryTerms(query);
  if (!terms.length) return [...items];
  return items
    .map((item) => {
      const text = [
        item.name,
        item.description,
        item.category,
        item.location_name,
        ...item.tags,
        JSON.stringify(item.attributes),
      ]
        .join(" ")
        .toLowerCase();
      const score = terms.reduce(
        (sum, term) =>
          sum +
          (item.name.toLowerCase().includes(term)
            ? 3
            : text.includes(term)
              ? 1
              : 0),
        0,
      );
      return { item, score };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score)
    .map((row) => row.item);
}

export async function retrieveInventory(
  question: string,
  reader: InventoryReader,
) {
  const intent = inventoryIntent(question);
  const queries =
    intent === "camping" || intent === "packing"
      ? [
          "contact contacts lenses glasses medication medicine prescription inhaler bandage bandages first-aid",
          "toiletries toothbrush toothpaste soap sanitizer sunscreen repellent hygiene personal care",
          intent === "camping"
            ? "backpack rucksack shoes sneakers boots bottle jacket hoodie tent sleeping torch flashlight"
            : "backpack suitcase luggage shoes bottle clothing jacket hoodie shirt charger cable phone laptop travel",
          intent === "camping"
            ? "camping hiking rain first-aid sunscreen stove food camera"
            : "travel toiletries clothing socks underwear toothbrush charger personal care",
        ]
      : intent === "accessories"
        ? [
            "tripod lens lenses sd memory battery camera strap filter flash photography",
          ]
        : intent === "photography"
          ? ["camera smartphone iphone phone gopro webcam"]
          : [queryTerms(question).join(" ")];
  const matches = (
    await Promise.all(queries.map((query) => reader.search(query)))
  ).flat();
  const unique = [...new Map(matches.map((item) => [item.id, item])).values()];
  const accessory =
    /\b(tripod|lens(?:es)?|sd|memory card|batter(?:y|ies)|strap|filter|flash|camera bag|camera case|charger)\b/i;
  return unique.filter((item) => {
    if (intent === "camping" || intent === "packing")
      return item.quantity > 0 && ["active", "stored"].includes(item.status);
    if (intent === "photography")
      return (
        /\b(camera|smartphone|iphone|phone|gopro|webcam)\b/i.test(item.name) &&
        !accessory.test(item.name) &&
        item.status !== "disposed"
      );
    if (intent === "accessories")
      return (
        !/\bcontact\s+lens(?:es)?\b/i.test(item.name) &&
        (accessory.test(item.name) || /accessor/i.test(item.category)) &&
        item.status !== "disposed"
      );
    return true;
  });
}

import type { Item } from "./inventory";

export type ActivityActor = "user" | "jarvis";
export type DashboardActivityKind = "created" | "updated" | "moved" | "deleted";

export type DashboardActivity = {
  id: string;
  itemId: string | null;
  itemName: string;
  kind: DashboardActivityKind;
  actor: ActivityActor;
  occurredAt: string;
  imagePath: string | null;
  detail: string | null;
};

export type DashboardActivityGroup = {
  room: { id: string | null; name: string };
  activities: DashboardActivity[];
};

export type DashboardSuggestion = {
  id: string;
  text: string;
  prompt: string;
  itemIds: string[];
  roomNames: string[];
};

export type DashboardBriefing = {
  asOf: string;
  lastVisitedAt: string | null;
  activityHeading: string;
  summary: string;
  activityCount: number;
  hasMore: boolean;
  groups: DashboardActivityGroup[];
  suggestion: DashboardSuggestion | null;
};

export interface DashboardRepository {
  briefing(): Promise<DashboardBriefing>;
  acknowledge(asOf: string): Promise<void>;
}

export function groundedDashboardSuggestion(
  items: readonly Item[],
): DashboardSuggestion | null {
  const eligible = items.filter(
    (item) =>
      item.kind !== "container" &&
      item.status !== "disposed" &&
      item.category.trim() &&
      item.resolved_location_id &&
      item.location_name,
  );
  const categories = new Map<string, Item[]>();
  for (const item of eligible) {
    const key = item.category.trim().toLocaleLowerCase();
    categories.set(key, [...(categories.get(key) ?? []), item]);
  }
  const candidate = [...categories.entries()]
    .map(([key, rows]) => ({
      key,
      rows,
      roomNames: [
        ...new Set(rows.map((row) => row.location_name).filter(Boolean)),
      ] as string[],
    }))
    .filter((group) => group.rows.length >= 2 && group.roomNames.length >= 2)
    .sort(
      (a, b) =>
        b.rows.length - a.rows.length ||
        b.roomNames.length - a.roomNames.length ||
        a.key.localeCompare(b.key),
    )[0];
  if (!candidate) return null;
  const category = candidate.rows[0].category.trim();
  return {
    id: `split-category:${candidate.key}`,
    text: `Jarvis noticed items in ${category} are stored in ${candidate.roomNames.length} spaces.`,
    prompt: `Help me review how items in my ${category} category are organized across ${candidate.roomNames.join(" and ")}. Start with a read-only plan and do not make changes.`,
    itemIds: candidate.rows.map((row) => row.id),
    roomNames: candidate.roomNames,
  };
}

export function dashboardSummary(
  lastVisitedAt: string | null,
  activityCount: number,
) {
  if (!activityCount)
    return lastVisitedAt
      ? "No inventory changes have been recorded since your last visit."
      : "No recent inventory activity has been recorded yet.";
  const changes = `${activityCount} inventory ${activityCount === 1 ? "change" : "changes"}`;
  return lastVisitedAt
    ? `Since your last visit, ${changes} ${activityCount === 1 ? "was" : "were"} recorded.`
    : `Here ${activityCount === 1 ? "is" : "are"} your ${changes}.`;
}

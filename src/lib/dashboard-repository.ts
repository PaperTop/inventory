import type { SupabaseClient } from "@supabase/supabase-js";
import {
  dashboardSummary,
  groundedDashboardSuggestion,
  type DashboardActivity,
  type DashboardActivityGroup,
  type DashboardRepository,
} from "./dashboard";
import type { Item } from "./inventory";
import { HttpError } from "./http";

type DbError = { code?: string; message: string } | null;
function check(error: DbError) {
  if (!error) return;
  if (error.code === "42501")
    throw new HttpError(403, "You do not have access to this dashboard.");
  throw new HttpError(
    503,
    "Dashboard activity is unavailable. Check that the latest database migration has been applied.",
  );
}

type ActivityRow = {
  id: string;
  item_id: string | null;
  item_name: string;
  kind: DashboardActivity["kind"];
  actor: DashboardActivity["actor"];
  occurred_at: string;
  room_id: string | null;
  room_name: string;
  image_path: string | null;
  detail: string | null;
};

export function createDashboardRepository(
  client: SupabaseClient,
  userId: string,
): DashboardRepository {
  return {
    async briefing() {
      const asOf = new Date().toISOString();
      const { data: visit, error: visitError } = await client
        .from("inventory_dashboard_visits")
        .select("last_visited_at")
        .eq("user_id", userId)
        .maybeSingle();
      check(visitError);
      const lastVisitedAt = visit?.last_visited_at ?? null;
      let activityQuery = client
        .from("inventory_activity")
        .select(
          "id,item_id,item_name,kind,actor,occurred_at,room_id,room_name,image_path,detail",
          { count: "exact" },
        )
        .eq("user_id", userId)
        .lte("occurred_at", asOf)
        .order("occurred_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(50);
      if (lastVisitedAt)
        activityQuery = activityQuery.gt("occurred_at", lastVisitedAt);
      else
        activityQuery = activityQuery.gte(
          "occurred_at",
          new Date(Date.parse(asOf) - 30 * 24 * 60 * 60 * 1000).toISOString(),
        );
      const { data, error, count } = await activityQuery;
      check(error);
      const rows = (data ?? []) as ActivityRow[];
      const grouped = new Map<string, DashboardActivityGroup>();
      for (const row of rows) {
        const key = row.room_id ?? `name:${row.room_name}`;
        const group = grouped.get(key) ?? {
          room: { id: row.room_id, name: row.room_name },
          activities: [],
        };
        group.activities.push({
          id: row.id,
          itemId: row.item_id,
          itemName: row.item_name,
          kind: row.kind,
          actor: row.actor,
          occurredAt: row.occurred_at,
          imagePath: row.image_path,
          detail: row.detail,
        });
        grouped.set(key, group);
      }

      let suggestion = null;
      const { data: snapshot, error: snapshotError } =
        await client.rpc("inventory_snapshot");
      if (!snapshotError)
        suggestion = groundedDashboardSuggestion((snapshot ?? []) as Item[]);

      const activityCount = count ?? rows.length;
      return {
        asOf,
        lastVisitedAt,
        activityHeading: lastVisitedAt
          ? "Since your last visit"
          : "Recent inventory activity",
        summary: dashboardSummary(lastVisitedAt, activityCount),
        activityCount,
        hasMore: activityCount > rows.length,
        groups: [...grouped.values()],
        suggestion,
      };
    },

    async acknowledge(asOf) {
      const { error } = await client.rpc("ack_inventory_dashboard_visit", {
        visited_at: asOf,
      });
      check(error);
    },
  };
}

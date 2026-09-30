import { describe, expect, it } from "vitest";
import {
  dashboardSummary,
  groundedDashboardSuggestion,
} from "../src/lib/dashboard";
import { itemInput, type Item } from "../src/lib/inventory";

function item(
  id: string,
  category: string,
  roomId: string | null,
  roomName: string | null,
  extra: Partial<Item> = {},
): Item {
  return {
    ...itemInput.parse({ name: id, category }),
    id,
    user_id: "owner",
    version: 1,
    created_at: "2026-09-19T00:00:00Z",
    updated_at: "2026-09-19T00:00:00Z",
    location_name: roomName,
    resolved_location_id: roomId,
    ...extra,
  };
}

describe("dashboard briefing", () => {
  it("uses truthful first-visit and returning-visit summaries", () => {
    expect(dashboardSummary(null, 0)).toMatch(/no recent/i);
    expect(dashboardSummary(null, 2)).toBe(
      "Here are your 2 inventory changes.",
    );
    expect(dashboardSummary("2026-09-18T00:00:00Z", 1)).toBe(
      "Since your last visit, 1 inventory change was recorded.",
    );
  });

  it("grounds a planning suggestion in a shared category across rooms", () => {
    const suggestion = groundedDashboardSuggestion([
      item("Camera", "Photography", "room-1", "Bedroom"),
      item("Tripod", "Photography", "room-2", "Living Room"),
    ]);
    expect(suggestion).toMatchObject({
      itemIds: ["Camera", "Tripod"],
      roomNames: ["Bedroom", "Living Room"],
    });
    expect(suggestion?.text).toMatch(/photography.*2 spaces/i);
    expect(suggestion?.prompt).toMatch(/read-only plan.*do not make changes/i);
  });

  it("omits suggestions without cross-room evidence", () => {
    expect(
      groundedDashboardSuggestion([
        item("Camera", "Photography", "room-1", "Bedroom"),
        item("Tripod", "Photography", "room-1", "Bedroom"),
      ]),
    ).toBeNull();
    expect(
      groundedDashboardSuggestion([
        item("Camera", "", "room-1", "Bedroom"),
        item("Tripod", "", "room-2", "Living Room"),
      ]),
    ).toBeNull();
  });
});

// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render as renderView,
  screen,
  within,
  waitFor,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { LiquidDashboard } from "../src/components/liquid-dashboard";
import { readFileSync } from "node:fs";
import styles from "../src/components/liquid-dashboard.module.css";

function render(ui: Parameters<typeof renderView>[0]) {
  const result = renderView(ui);
  fireEvent.click(screen.getByRole("button", { name: "All items" }));
  return result;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("navy workspace navigation", () => {
  it("keeps room parent identities when their sample space is renamed", async () => {
    const user = userEvent.setup();
    render(<LiquidDashboard />);
    await user.click(screen.getByRole("button", { name: "Spaces" }));
    await user.click(screen.getByRole("button", { name: "Actions for Home" }));
    await user.click(screen.getByRole("button", { name: "Rename Home" }));
    await user.clear(screen.getByLabelText("Place name"));
    await user.type(screen.getByLabelText("Place name"), "House");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await user.click(screen.getByRole("button", { name: "Open House" }));
    const rooms = screen.getByRole("region", { name: "Rooms" });
    expect(
      within(rooms).getByRole("button", { name: "Bedroom" }),
    ).toBeVisible();
    expect(
      within(rooms).getByRole("button", { name: "Living Room" }),
    ).toBeVisible();
  });

  it("highlights only the open container through cards, tree and breadcrumbs, then clears it on leaving", async () => {
    const user = userEvent.setup();
    render(<LiquidDashboard />);
    const nav = screen.getByRole("navigation", { name: "Inventory locations" });
    await user.click(screen.getByRole("button", { name: "Spaces" }));
    await user.click(screen.getByRole("button", { name: "Open Cabinet" }));
    const cabinet = within(nav).getByRole("button", { name: "Cabinet" });
    const drawer = within(nav).getByRole("button", { name: "Drawer" });
    expect(cabinet).toHaveAttribute("aria-current", "location");
    expect(cabinet).toHaveClass(styles.activeNav);
    expect(drawer).not.toHaveAttribute("aria-current");
    await user.click(drawer);
    expect(drawer).toHaveAttribute("aria-current", "location");
    expect(cabinet).not.toHaveAttribute("aria-current");
    expect(cabinet).not.toHaveClass(styles.activeNav);
    const breadcrumb = screen.getByRole("navigation", {
      name: "Inventory breadcrumb",
    });
    await user.click(
      within(breadcrumb).getByRole("button", { name: "Cabinet" }),
    );
    expect(cabinet).toHaveAttribute("aria-current", "location");
    expect(drawer).not.toHaveAttribute("aria-current");
    await user.click(screen.getByRole("button", { name: "Close container" }));
    expect(nav.querySelector("[aria-current]")).toBeNull();
    await user.click(drawer);
    await user.click(screen.getByRole("button", { name: "All items" }));
    expect(nav.querySelector("[aria-current]")).toBeNull();
  });

  it("keeps keyboard focus inside the open mobile navigation and restores it on close", async () => {
    const user = userEvent.setup();
    renderView(<LiquidDashboard />);
    const opener = screen.getByRole("button", { name: "Open navigation" });
    await user.click(opener);
    const dialog = screen.getByRole("dialog", { name: "Navigation" });
    const close = within(dialog).getByRole("button", {
      name: "Close navigation",
    });
    expect(close).toHaveFocus();
    expect(document.querySelector(`section.${styles.library}`)).toHaveAttribute(
      "inert",
    );
    await user.tab();
    expect(
      within(dialog).getByRole("button", { name: "Dashboard" }),
    ).toHaveFocus();
    await user.tab({ shift: true });
    expect(close).toHaveFocus();
    await user.tab({ shift: true });
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Navigation" })).toBeNull();
    await waitFor(() => expect(opener).toHaveFocus());
  });
  it("keeps full-width space buttons styled inside branch wrappers", () => {
    const stylesheet = document.createElement("style");
    stylesheet.textContent = readFileSync(
      "src/components/liquid-dashboard.module.css",
      "utf8",
    ).replace(/\.([a-zA-Z_][\w-]*)/g, (match, name: string) =>
      styles[name] ? `.${styles[name]}` : match,
    );
    document.head.append(stylesheet);
    try {
      render(<LiquidDashboard />);
      const nav = screen.getByRole("navigation", {
        name: "Inventory locations",
      });
      for (const name of ["Home", "Bedroom", "College"]) {
        const button = within(nav).getByRole("button", { name });
        const appearance = getComputedStyle(button);
        expect(appearance.display, name).toBe("flex");
        expect(appearance.backgroundColor, name).toBe("rgba(0, 0, 0, 0)");
        expect(appearance.textAlign, name).toBe("left");
      }
    } finally {
      stylesheet.remove();
    }
  });
  it("uses one space button to select its items and toggle its children", async () => {
    const user = userEvent.setup();
    render(<LiquidDashboard />);
    const nav = screen.getByRole("navigation", { name: "Inventory locations" });
    const home = within(nav).getByRole("button", { name: "Home" });
    expect(home).toHaveAttribute("aria-expanded", "true");
    expect(
      within(nav).queryByRole("button", { name: "Collapse Home" }),
    ).toBeNull();
    await user.click(within(home).getByText("Home"));
    expect(within(nav).queryByRole("button", { name: "Bedroom" })).toBeNull();
    expect(within(nav).queryByRole("button", { name: "Cabinet" })).toBeNull();
    expect(home).toHaveAttribute("aria-expanded", "false");
    expect(home).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("button", { name: "View Backpack" })).toBeNull();
    expect(screen.getByRole("button", { name: "View Wallet" })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "View Travel tripod" }),
    ).toBeNull();
    await user.click(home.querySelector("svg:last-child")!);
    expect(within(nav).getByRole("button", { name: "Bedroom" })).toBeVisible();
    const bedroom = within(nav).getByRole("button", { name: "Bedroom" });
    await user.click(bedroom);
    expect(bedroom).toHaveAttribute("aria-expanded", "true");
    expect(bedroom).toHaveAttribute("aria-pressed", "true");
    const cabinet = within(nav).getByRole("button", { name: "Cabinet" });
    const drawer = within(nav).getByRole("button", { name: "Drawer" });
    expect(cabinet).toBeVisible();
    expect(drawer).toBeVisible();
    expect(drawer.closest(`.${styles.containerTree}`)?.parentElement).toBe(
      cabinet.closest(`.${styles.containerBranch}`),
    );
    expect(
      within(nav).getAllByRole("button", { name: "Cabinet" }),
    ).toHaveLength(1);
    expect(within(nav).getAllByRole("button", { name: "Drawer" })).toHaveLength(
      1,
    );
    await user.keyboard("{Enter}");
    expect(within(nav).queryByRole("button", { name: "Cabinet" })).toBeNull();
    const college = within(nav).getByRole("button", { name: "College" });
    await user.click(college);
    expect(college).toHaveAttribute("aria-expanded", "true");
    expect(college).toHaveAttribute("aria-pressed", "true");
    expect(
      college.closest(`.${styles.spaceBranchRow}`)?.parentElement,
    ).toHaveTextContent("No containers");
    expect(screen.getByRole("button", { name: "View Backpack" })).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "View Travel tripod" }),
    ).toBeNull();
    await user.click(college.querySelector("svg:last-child")!);
    expect(college).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "View Backpack" })).toBeVisible();
    await user.click(bedroom);
    expect(bedroom).toHaveAttribute("aria-expanded", "true");
    expect(within(nav).getByRole("button", { name: "Cabinet" })).toBeVisible();
    expect(college).toHaveAttribute("aria-expanded", "false");
    await user.click(bedroom);
    expect(bedroom).toHaveAttribute("aria-expanded", "false");
    expect(within(nav).queryByRole("button", { name: "Cabinet" })).toBeNull();
    expect(college).toHaveAttribute("aria-expanded", "false");
    await user.click(screen.getByRole("button", { name: "All items" }));
    expect(screen.getByRole("button", { name: "View Backpack" })).toBeVisible();
  });
  it("renames a built-in space through a visible edit control", async () => {
    const user = userEvent.setup();
    render(<LiquidDashboard />);
    await user.click(screen.getByRole("button", { name: "Spaces" }));
    await user.click(screen.getByRole("button", { name: "Open Home" }));
    await user.click(screen.getByRole("button", { name: "Edit Bedroom" }));
    await user.clear(screen.getByLabelText("Room name"));
    await user.type(screen.getByLabelText("Room name"), "Office");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    expect(screen.getByRole("button", { name: "Edit Office" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Edit Bedroom" })).toBeNull();
  });

  it("confirms deletion and keeps nested contents in the chosen destination", async () => {
    const user = userEvent.setup();
    render(<LiquidDashboard />);
    await user.click(screen.getByRole("button", { name: "Spaces" }));
    await user.click(screen.getByRole("button", { name: "Open Home" }));
    await user.click(screen.getByRole("button", { name: "Delete Bedroom" }));
    await user.selectOptions(screen.getByLabelText("Move items to"), "College");
    await user.click(screen.getByRole("button", { name: "Confirm deletion" }));
    expect(screen.queryByRole("button", { name: "Edit Bedroom" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "All items" }));
    await user.click(
      screen.getByRole("button", { name: "View Travel tripod" }),
    );
    expect(
      screen.getByRole("complementary", { name: "Item details" }),
    ).toHaveTextContent("College");
  });
  it("opens details on selection and returns to the inventory with Escape", async () => {
    const user = userEvent.setup();
    render(<LiquidDashboard />);
    expect(
      screen.queryByRole("complementary", { name: "Item details" }),
    ).toBeNull();
    expect(screen.queryByRole("form", { name: "Jarvis" })).toBeNull();
    await user.click(
      screen.getByRole("button", { name: "View Travel tripod" }),
    );
    expect(screen.getByRole("textbox", { name: "Item name" })).toHaveValue(
      "Travel tripod",
    );
    await user.keyboard("{Escape}");
    expect(
      screen.queryByRole("complementary", { name: "Item details" }),
    ).toBeNull();
    expect(
      screen.getByRole("button", { name: "View Travel tripod" }),
    ).toHaveFocus();
  });

  it("filters the inventory by category and preserves the filter in the table", async () => {
    const user = userEvent.setup();
    render(<LiquidDashboard />);
    await user.click(screen.getByRole("combobox", { name: "Category" }));
    await user.click(screen.getByRole("option", { name: "Electronics" }));
    expect(screen.getByRole("button", { name: "View Laptop" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "View Sneakers" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "List view" }));
    const table = screen.getByRole("table");
    expect(
      within(table).getByRole("columnheader", { name: "Container" }),
    ).toBeVisible();
    expect(
      within(table).getByRole("button", { name: "View Laptop" }),
    ).toBeVisible();
    expect(
      within(table).queryByRole("button", { name: "View Sneakers" }),
    ).toBeNull();
  });

  it("opens a search suggestion in Jarvis without sending it automatically", async () => {
    const user = userEvent.setup();
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    render(<LiquidDashboard />);
    await user.type(
      screen.getByRole("textbox", { name: "Search items" }),
      "camera",
    );
    expect(screen.getByRole("table")).toBeVisible();
    await user.click(
      screen.getByRole("button", { name: "Where are my camera accessories?" }),
    );
    expect(screen.getByRole("textbox", { name: "Ask Jarvis" })).toHaveValue(
      "Where are my camera accessories?",
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("liquid dashboard interactions", () => {
  it("adds and edits items from Jarvis and shows the applied records", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", async (_path: string, options: RequestInit) => {
      const body = JSON.parse(options.body as string);
      return {
        ok: true,
        json: async () => ({
          mode: "ai",
          answer: "Prepared.",
          citations: [],
          changes: body.question.startsWith("Add")
            ? [
                {
                  type: "create",
                  item: {
                    name: "Camping tent",
                    category: "Camping",
                    location: "College",
                  },
                },
              ]
            : [
                {
                  type: "update",
                  id: "backpack",
                  changes: {
                    name: "Hiking backpack",
                    tags: ["school", "travel", "everyday", "camping"],
                  },
                },
              ],
        }),
      };
    });
    render(<LiquidDashboard />);
    await user.click(screen.getByRole("button", { name: "Open Jarvis" }));
    const chat = screen.getByRole("form", { name: "Jarvis" });
    await user.type(
      within(chat).getByRole("textbox"),
      "Add a camping tent in College",
    );
    await user.click(
      within(chat).getByRole("button", { name: "Send to Jarvis" }),
    );
    expect(await within(chat).findByText("Added Camping tent.")).toBeVisible();
    await user.click(
      within(chat).getByRole("button", { name: "Open Camping tent" }),
    );
    expect(screen.getByRole("textbox", { name: "Item name" })).toHaveValue(
      "Camping tent",
    );
    expect(screen.getByRole("textbox", { name: "Category" })).toHaveValue(
      "Camping",
    );
    await user.click(
      screen.getByRole("button", { name: "Close item details" }),
    );
    await user.click(screen.getByRole("button", { name: "Open Jarvis" }));
    await user.type(
      within(chat).getByRole("textbox"),
      "Rename my backpack to Hiking backpack and tag it camping",
    );
    await user.click(
      within(chat).getByRole("button", { name: "Send to Jarvis" }),
    );
    expect(
      await within(chat).findByText("Updated Hiking backpack."),
    ).toBeVisible();
    await user.click(
      within(chat).getByRole("button", { name: "Open Hiking backpack" }),
    );
    expect(screen.getByRole("textbox", { name: "Item name" })).toHaveValue(
      "Hiking backpack",
    );
    expect(screen.getByRole("button", { name: "camping" })).toBeVisible();
  });

  it("does not report success or partially apply an invalid chat batch", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", async () => ({
      ok: true,
      json: async () => ({
        mode: "ai",
        answer: "I saved everything.",
        citations: [],
        changes: [
          { type: "create", item: { name: "Test tent" } },
          { type: "update", id: "backpack", changes: { quantity: 2 } },
        ],
      }),
    }));
    render(<LiquidDashboard />);
    await user.click(screen.getByRole("button", { name: "Open Jarvis" }));
    const chat = screen.getByRole("form", { name: "Jarvis" });
    await user.type(
      within(chat).getByRole("textbox"),
      "Add a tent and update my backpack",
    );
    await user.click(
      within(chat).getByRole("button", { name: "Send to Jarvis" }),
    );
    expect(
      await within(chat).findByText("No items were changed."),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "View Test tent" }),
    ).not.toBeInTheDocument();
    expect(
      within(chat).queryByText("I saved everything."),
    ).not.toBeInTheDocument();
  });
  it("closes item details while keeping Jarvis available and reopens on item selection", async () => {
    const user = userEvent.setup();
    render(<LiquidDashboard />);
    await user.click(screen.getByRole("button", { name: "View Backpack" }));
    await user.click(
      screen.getByRole("button", { name: "Close item details" }),
    );
    expect(
      screen.queryByRole("complementary", { name: "Item details" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Jarvis" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "View Laptop" }));
    expect(
      screen.getByRole("complementary", { name: "Item details" }),
    ).toBeVisible();
    expect(screen.getByRole("textbox", { name: "Item name" })).toHaveValue(
      "Laptop",
    );
  });

  it("sends the current local inventory to Jarvis without requiring Supabase", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", async (path: string, options: RequestInit) => {
      expect(path).toBe("/api/ask/local");
      expect(JSON.parse(options.body as string)).toMatchObject({
        question: "Where is my telescope?",
        items: expect.arrayContaining([
          expect.objectContaining({ id: "backpack", name: "Backpack" }),
        ]),
      });
      return {
        ok: true,
        json: async () => ({
          answer: "Your telescope is in the attic.",
          mode: "search",
          citations: [
            {
              id: "saved-telescope",
              name: "Telescope",
              description: "",
              category: "Optics",
              quantity: 1,
              unit: "pc",
              status: "active",
              condition: "good",
              location_name: "Attic",
              tags: [],
              attributes: {},
            },
          ],
        }),
      };
    });
    render(<LiquidDashboard />);
    await user.click(screen.getByRole("button", { name: "Open Jarvis" }));
    await user.type(
      screen.getByRole("textbox", { name: "Ask Jarvis" }),
      "Where is my telescope?",
    );
    await user.click(screen.getByRole("button", { name: "Send to Jarvis" }));
    expect(
      await screen.findByText("Your telescope is in the attic."),
    ).toBeVisible();
    expect(screen.getByText("Telescope")).toBeVisible();
    expect(screen.getByText(/Local inventory/)).toBeVisible();
  });

  it("clearly labels local answers and searches items outside the active location", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", async () => ({
      ok: false,
      json: async () => ({ error: "Please sign in" }),
    }));
    render(<LiquidDashboard />);
    await user.click(
      within(
        screen.getByRole("navigation", { name: "Inventory locations" }),
      ).getByRole("button", { name: "Car" }),
    );
    await user.click(screen.getByRole("button", { name: "Open Jarvis" }));
    await user.type(
      screen.getByRole("textbox", { name: "Ask Jarvis" }),
      "Where is my backpack?",
    );
    await user.click(screen.getByRole("button", { name: "Send to Jarvis" }));
    expect(await screen.findByText(/Local inventory/)).toBeVisible();
    expect(screen.getByText(/Backpack — 1 pc; College/)).toBeVisible();
  });

  it("opens a cited item and keeps previous questions when asking a follow-up", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", async () => {
      throw new Error("offline");
    });
    render(<LiquidDashboard />);
    await user.click(screen.getByRole("button", { name: "Open Jarvis" }));
    const chat = screen.getByRole("form", { name: "Jarvis" });
    await user.type(
      within(chat).getByRole("textbox"),
      "Do I have anything to take pictures?",
    );
    await user.click(
      within(chat).getByRole("button", { name: "Send to Jarvis" }),
    );
    await user.click(
      await within(chat).findByRole("button", { name: "Open Camera" }),
    );
    expect(screen.getByRole("textbox", { name: "Item name" })).toHaveValue(
      "Camera",
    );
    await user.click(
      screen.getByRole("button", { name: "Close item details" }),
    );
    await user.click(screen.getByRole("button", { name: "Open Jarvis" }));
    await user.type(within(chat).getByRole("textbox"), "Pack me for camping");
    await user.click(
      within(chat).getByRole("button", { name: "Send to Jarvis" }),
    );
    expect(
      await within(chat).findByText(/starting packing list/),
    ).toBeVisible();
    expect(
      within(chat).getByText("Do I have anything to take pictures?"),
    ).toBeVisible();
    expect(within(chat).getByRole("textbox")).toHaveValue("");
  });

  it("adds trimmed tags with Enter or the add button and ignores duplicates", async () => {
    const user = userEvent.setup();
    render(<LiquidDashboard />);
    await user.click(screen.getByRole("button", { name: "View Backpack" }));
    const input = screen.getByRole("textbox", { name: "New tag" });
    await user.type(input, "  camping  {Enter}");
    expect(screen.getByRole("button", { name: "camping" })).toBeVisible();
    expect(input).toHaveValue("");
    await user.type(input, "CAMPING");
    await user.click(screen.getByRole("button", { name: "Add tag" }));
    expect(screen.getAllByRole("button", { name: /^camping$/i })).toHaveLength(
      1,
    );
    await user.type(input, "hiking");
    await user.click(screen.getByRole("button", { name: "Add tag" }));
    await user.click(screen.getByRole("button", { name: "View Laptop" }));
    expect(
      screen.queryByRole("button", { name: "hiking" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "View Backpack" }));
    expect(screen.getByRole("button", { name: "hiking" })).toBeVisible();
  });

  it("shows past tags when focusing tag input and allows adding via suggestion or custom input", async () => {
    const user = userEvent.setup();
    render(<LiquidDashboard />);
    await user.click(screen.getByRole("button", { name: "View Backpack" }));
    const input = screen.getByRole("textbox", { name: "New tag" });

    // Focus tag input to open past tags popover
    await user.click(input);
    expect(screen.getByRole("region", { name: "Past tags" })).toBeVisible();

    // "creative" is a past tag from camera that Backpack does not have yet
    const creativeChip = screen.getByRole("button", {
      name: "Select tag creative",
    });
    expect(creativeChip).toBeVisible();

    // Click to add past tag
    await user.click(creativeChip);
    expect(screen.getByRole("button", { name: "creative" })).toBeVisible();

    // Type a custom new tag and click plus button
    await user.type(input, "waterproof");
    await user.click(screen.getByRole("button", { name: "Add tag" }));
    expect(screen.getByRole("button", { name: "waterproof" })).toBeVisible();
  });

  it("creates a place in a dialog with its chosen icon and highlight", async () => {
    const user = userEvent.setup();
    render(<LiquidDashboard />);
    await user.click(screen.getByRole("button", { name: "Add space" }));
    const dialog = screen.getByRole("dialog", { name: "Add space" });
    await user.click(
      within(dialog).getByRole("button", { name: "Change icon" }),
    );
    await user.type(within(dialog).getByLabelText("Place name"), "Studio");
    await user.click(within(dialog).getByRole("radio", { name: "Camera" }));
    await user.click(within(dialog).getByRole("radio", { name: "Rose" }));
    await user.click(within(dialog).getByRole("button", { name: "Add space" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const place = within(
      screen.getByRole("navigation", { name: "Inventory locations" }),
    ).getByRole("button", { name: "Studio" });
    expect(place).toHaveAttribute("data-place-icon", "Camera");
    expect(place).toHaveStyle({ "--place-color": "#f59ab8" });
    expect(screen.getByRole("button", { name: "Add space" })).toHaveFocus();
  });

  it("supports keyboard selection and dismissing the glass filter", async () => {
    const user = userEvent.setup();
    render(<LiquidDashboard />);
    await user.click(screen.getByRole("button", { name: "More filters" }));
    const filter = screen.getByRole("combobox", { name: "Filter items" });
    filter.focus();
    await user.keyboard("{ArrowDown}{End}{Enter}");
    expect(filter).toHaveTextContent("Low stock");
    expect(filter).toHaveAttribute("aria-expanded", "false");
    await user.click(filter);
    expect(screen.getByRole("listbox", { name: "Filter items" })).toBeVisible();
    await user.keyboard("{Escape}");
    expect(filter).toHaveFocus();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    await user.click(filter);
    await user.click(screen.getByRole("textbox", { name: "Search items" }));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("omits Missing navigation and lost status choices", async () => {
    const user = userEvent.setup();
    render(<LiquidDashboard />);

    expect(
      within(
        screen.getByRole("navigation", { name: "Main navigation" }),
      ).queryByRole("button", { name: "Missing" }),
    ).toBeNull();

    const statusFilter = screen.getByRole("combobox", { name: "Status" });
    await user.click(statusFilter);
    const filterOptions = screen.getByRole("listbox", { name: "Status" });
    expect(
      within(filterOptions).queryByRole("option", { name: "Missing" }),
    ).toBeNull();
    await user.click(
      within(filterOptions).getByRole("option", { name: "Stored" }),
    );
    expect(screen.getByRole("button", { name: "View Camera" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "View Backpack" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "View Camera" }));
    const itemStatus = screen.getByRole("combobox", { name: "Item status" });
    await user.click(itemStatus);
    const itemOptions = screen.getByRole("listbox", { name: "Item status" });
    expect(
      within(itemOptions).queryByRole("option", { name: "Missing" }),
    ).toBeNull();
    await user.click(within(itemOptions).getByRole("option", { name: "Lent" }));
    expect(itemStatus).toHaveTextContent("Lent");
  });

  it("edits notes directly and deletes the selected item", async () => {
    const user = userEvent.setup();
    render(<LiquidDashboard />);
    await user.click(screen.getByRole("button", { name: "View Backpack" }));
    const notes = screen.getByRole("textbox", { name: "Notes" });
    expect(notes).toBeEnabled();
    await user.clear(notes);
    await user.type(notes, "Packed for tomorrow.");
    await user.click(screen.getByRole("button", { name: "View Laptop" }));
    await user.click(screen.getByRole("button", { name: "View Backpack" }));
    expect(screen.getByRole("textbox", { name: "Notes" })).toHaveValue(
      "Packed for tomorrow.",
    );
    for (const name of ["Delete", "Duplicate", "Favorite"]) {
      expect(
        within(
          screen.getByRole("complementary", { name: "Item details" }),
        ).queryByRole("button", { name }),
      ).not.toBeInTheDocument();
    }
    await user.click(screen.getByRole("button", { name: "Delete item" }));
    expect(
      screen.queryByRole("button", { name: "View Backpack" }),
    ).not.toBeInTheDocument();
  });

  it("starts item editing when a detail field is clicked", async () => {
    const user = userEvent.setup();
    render(<LiquidDashboard />);
    await user.click(screen.getByRole("button", { name: "View Backpack" }));

    const category = screen.getByRole("textbox", { name: "Category" });
    await user.click(category);

    await user.clear(category);
    await user.type(category, "Travel");
    expect(category).toHaveValue("Travel");
  });

  it("replaces only the selected item's photo", async () => {
    const user = userEvent.setup();
    render(<LiquidDashboard />);
    await user.click(screen.getByRole("button", { name: "View Backpack" }));
    const file = new File(["photo"], "backpack.png", { type: "image/png" });
    await user.upload(screen.getByLabelText("Upload item photo"), file);
    await waitFor(() =>
      expect(
        screen.getByRole("img", { name: "Backpack" }).getAttribute("src"),
      ).toMatch(/^data:image\/png;base64,/),
    );
    const thumbnail = screen
      .getByRole("button", { name: "View Backpack" })
      .querySelector("img");
    expect(thumbnail?.getAttribute("src")).toBe(
      screen.getByRole("img", { name: "Backpack" }).getAttribute("src"),
    );
    await user.click(screen.getByRole("button", { name: "View Laptop" }));
    expect(
      screen.getByRole("img", { name: "Laptop" }).getAttribute("src"),
    ).not.toMatch(/^data:/);
  });

  it("rejects unsupported and oversized photos without replacing the image", async () => {
    const user = userEvent.setup({ applyAccept: false });
    render(<LiquidDashboard />);
    await user.click(screen.getByRole("button", { name: "View Backpack" }));
    const original = screen
      .getByRole("img", { name: "Backpack" })
      .getAttribute("src");
    const input = screen.getByLabelText("Upload item photo");
    await user.upload(
      input,
      new File(["text"], "notes.txt", { type: "text/plain" }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Choose a JPG, PNG, or WebP image",
    );
    await user.upload(
      input,
      new File([new Uint8Array(5 * 1024 * 1024 + 1)], "large.png", {
        type: "image/png",
      }),
    );
    expect(screen.getByRole("alert")).toHaveTextContent("5 MB or smaller");
    expect(screen.getByRole("img", { name: "Backpack" })).toHaveAttribute(
      "src",
      original,
    );
  });

  it("adds a place from the left rail without creating an item", async () => {
    const user = userEvent.setup();
    render(<LiquidDashboard />);
    await user.click(screen.getByRole("button", { name: "Add space" }));
    await user.type(
      screen.getByRole("textbox", { name: "Place name" }),
      "Garage",
    );
    await user.click(screen.getByRole("button", { name: "Add space" }));
    const navigation = screen.getByRole("navigation", {
      name: "Inventory locations",
    });
    expect(
      within(navigation).getByRole("button", { name: "Garage" }),
    ).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/0 items in this scope/)).toBeVisible();
    await user.click(screen.getByRole("button", { name: "All items" }));
    expect(
      screen.queryByRole("button", { name: "View New item" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "View Backpack" }));
    await user.click(screen.getByRole("combobox", { name: "Item location" }));
    await user.click(screen.getByRole("option", { name: "Garage" }));
    await user.click(
      within(navigation).getByRole("button", { name: "Garage" }),
    );
    expect(screen.getByRole("button", { name: "View Backpack" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Add item" }));
    expect(
      within(screen.getByRole("dialog", { name: "Add item" })).getByRole(
        "option",
        { name: "Garage", selected: true },
      ),
    ).toBeVisible();
  });

  it("rejects blank and duplicate places and allows cancelling", async () => {
    const user = userEvent.setup();
    render(<LiquidDashboard />);
    await user.click(screen.getByRole("button", { name: "Add space" }));
    const name = screen.getByRole("textbox", { name: "Place name" });
    await user.type(name, "   ");
    await user.click(screen.getByRole("button", { name: "Add space" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Place name is required",
    );
    await user.clear(name);
    await user.type(name, " college ");
    await user.click(screen.getByRole("button", { name: "Add space" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "That place already exists",
    );
    await user.click(
      screen.getByRole("button", { name: "Cancel adding place" }),
    );
    expect(
      screen.queryByRole("textbox", { name: "Place name" }),
    ).not.toBeInTheDocument();
  });

  it("opens a custom place editor on double-click and saves its fields", async () => {
    const user = userEvent.setup();
    render(<LiquidDashboard />);
    await user.click(screen.getByRole("button", { name: "Add space" }));
    await user.type(
      screen.getByRole("textbox", { name: "Place name" }),
      "Studio",
    );
    await user.click(screen.getByRole("button", { name: "Add space" }));

    const navigation = screen.getByRole("navigation", {
      name: "Inventory locations",
    });
    await user.dblClick(
      within(navigation).getByRole("button", { name: "Studio" }),
    );
    const dialog = screen.getByRole("dialog", { name: "Edit space" });
    await user.click(
      within(dialog).getByRole("button", { name: "Change icon" }),
    );
    const name = within(dialog).getByRole("textbox", { name: "Place name" });
    await user.clear(name);
    await user.type(name, "Workshop");
    await user.click(within(dialog).getByRole("radio", { name: "Camera" }));
    await user.click(within(dialog).getByRole("radio", { name: "Rose" }));
    await user.click(
      within(dialog).getByRole("button", { name: "Save changes" }),
    );

    const edited = within(navigation).getByRole("button", { name: "Workshop" });
    expect(edited).toHaveAttribute("data-place-icon", "Camera");
    expect(edited).toHaveStyle({ "--place-color": "#f59ab8" });
    expect(
      screen.queryByRole("button", { name: "Studio" }),
    ).not.toBeInTheDocument();
  });

  it("deletes a custom place from its editor", async () => {
    const user = userEvent.setup();
    render(<LiquidDashboard />);
    await user.click(screen.getByRole("button", { name: "Add space" }));
    await user.type(
      screen.getByRole("textbox", { name: "Place name" }),
      "Studio",
    );
    await user.click(screen.getByRole("button", { name: "Add space" }));

    const navigation = screen.getByRole("navigation", {
      name: "Inventory locations",
    });
    await user.dblClick(
      within(navigation).getByRole("button", { name: "Studio" }),
    );
    await user.click(screen.getByRole("button", { name: "Delete place" }));
    await user.click(screen.getByRole("button", { name: "Confirm deletion" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(
      within(navigation).queryByRole("button", { name: "Studio" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("navigation", { name: "Inventory breadcrumb" }),
    ).toHaveTextContent("Home");
  });

  it("keeps an active item filter clearable when responsive controls reflow", async () => {
    const user = userEvent.setup();
    render(<LiquidDashboard />);
    await user.click(screen.getByRole("button", { name: "More filters" }));

    await user.click(screen.getByRole("combobox", { name: "Filter items" }));
    await user.click(screen.getByRole("option", { name: "Low stock" }));

    const clearFilter = screen.getByRole("button", {
      name: "Clear item filter",
    });
    expect(clearFilter).toBeVisible();

    await user.click(clearFilter);

    expect(
      screen.getByRole("combobox", { name: "Filter items" }),
    ).toHaveTextContent("All items");
    expect(screen.getByRole("button", { name: "View Backpack" })).toBeVisible();
  });

  it("rejects a blank item name and keeps the saved item named", async () => {
    const user = userEvent.setup();
    render(<LiquidDashboard />);
    await user.click(screen.getByRole("button", { name: "View Backpack" }));

    const name = screen.getByRole("textbox", { name: "Item name" });
    await user.click(name);
    await user.clear(name);
    await user.tab();

    expect(name).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Item name is required",
    );
    expect(screen.getByRole("button", { name: "View Backpack" })).toBeVisible();
  });

  it("saves an item name on Enter and returns to view mode", async () => {
    const user = userEvent.setup();
    render(<LiquidDashboard />);
    await user.click(screen.getByRole("button", { name: "View Backpack" }));
    const name = screen.getByRole("textbox", { name: "Item name" });
    await user.click(name);
    await user.clear(name);
    await user.type(name, "Travel bag{Enter}");
    expect(
      screen.getByRole("button", { name: "View Travel bag" }),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: /^(Move|Done)$/ }),
    ).not.toBeInTheDocument();
  });

  it("changes a durable item's quantity and prevents negative quantities", async () => {
    const user = userEvent.setup();
    render(<LiquidDashboard />);
    await user.click(screen.getByRole("button", { name: "View Backpack" }));

    const decrease = screen.getByRole("button", { name: "Decrease quantity" });
    const increase = screen.getByRole("button", { name: "Increase quantity" });
    await user.click(increase);
    expect(within(decrease.parentElement!).getByText("2")).toBeVisible();
    await user.click(decrease);

    expect(within(decrease.parentElement!).getByText("1")).toBeVisible();
    await user.click(decrease);
    expect(within(decrease.parentElement!).getByText("0")).toBeVisible();
    expect(decrease).toBeDisabled();
    await user.click(increase);
    expect(decrease).toBeEnabled();
    await user.click(increase);
    await user.click(screen.getByRole("button", { name: "View Laptop" }));
    await user.click(screen.getByRole("button", { name: "View Backpack" }));
    expect(
      within(
        screen.getByRole("button", { name: "Decrease quantity" })
          .parentElement!,
      ).getByText("2"),
    ).toBeVisible();
  });

  it("moves an item directly through its location field", async () => {
    const user = userEvent.setup();
    render(<LiquidDashboard />);

    await user.click(screen.getByRole("button", { name: "View Umbrella" }));

    const destination = screen.getByRole("combobox", {
      name: "Item location",
    });
    expect(destination).toHaveTextContent("Car");
    expect(
      screen.getByRole("combobox", { name: "Item location" }),
    ).toHaveTextContent("Car");

    await user.click(destination);
    await user.click(screen.getByRole("option", { name: "Home" }));

    expect(
      screen.getByRole("combobox", { name: "Item location" }),
    ).toHaveTextContent("Home");
  });

  it("uses a glass control for the item location dropdown", async () => {
    const user = userEvent.setup();
    render(<LiquidDashboard />);
    await user.click(screen.getByRole("button", { name: "View Backpack" }));

    const location = screen.getByRole("combobox", { name: "Item location" });
    expect(location.tagName).toBe("BUTTON");

    await user.click(location);
    expect(
      screen.getByRole("listbox", { name: "Item location" }),
    ).toBeVisible();
    expect(screen.getByRole("option", { name: "College" })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await user.click(screen.getByRole("option", { name: "Home" }));
    expect(location).toHaveTextContent("Home");
  });

  it("exposes accessible duplicate and delete icon buttons", async () => {
    const user = userEvent.setup();
    render(<LiquidDashboard />);
    await user.click(screen.getByRole("button", { name: "View Backpack" }));

    expect(
      screen.getByRole("button", { name: "Duplicate item" }),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Delete item" })).toBeVisible();
  });

  it("opens nested container contents with an inherited breadcrumb", async () => {
    const user = userEvent.setup();
    render(<LiquidDashboard />);
    await user.click(screen.getByRole("button", { name: "Spaces" }));

    await user.click(screen.getByRole("button", { name: "Open Cabinet" }));
    const cabinet = screen.getByRole("region", { name: "Cabinet contents" });
    expect(cabinet).toBeVisible();

    await user.click(
      within(cabinet).getByRole("button", { name: "Open Drawer" }),
    );
    expect(
      screen.getByRole("region", { name: "Drawer contents" }),
    ).toBeVisible();
    expect(
      screen.getByRole("navigation", { name: "Inventory breadcrumb" }),
    ).toHaveTextContent("HomeBedroomCabinetDrawer");
    expect(
      within(screen.getByRole("region", { name: "Drawer contents" })).getByRole(
        "button",
        { name: "View Camera" },
      ),
    ).toBeVisible();
  });

  it("moves an item into a container and shows it inside the open panel", async () => {
    const user = userEvent.setup();
    render(<LiquidDashboard />);

    await user.click(screen.getByRole("button", { name: "View Backpack" }));
    const destination = screen.getByRole("combobox", {
      name: "Item location",
    });
    await user.click(destination);
    await user.click(
      screen.getByRole("option", { name: "Home → Bedroom → Cabinet" }),
    );

    expect(destination).toHaveTextContent("Home → Bedroom → Cabinet");
    await user.click(
      screen.getByRole("button", { name: "Close item details" }),
    );
    await user.click(screen.getByRole("button", { name: "Spaces" }));
    await user.click(screen.getByRole("button", { name: "Open Cabinet" }));
    expect(
      within(
        screen.getByRole("region", { name: "Cabinet contents" }),
      ).getByRole("button", { name: "View Backpack" }),
    ).toBeVisible();
  });

  it("offers one visible container action in a space without opening filters", async () => {
    const user = userEvent.setup();
    render(<LiquidDashboard />);
    expect(screen.queryByRole("button", { name: "Add container" })).toBeNull();
    await user.click(screen.getByRole("button", { name: "Spaces" }));
    await user.click(screen.getByRole("button", { name: "Open Home" }));
    await user.click(
      within(screen.getByRole("region", { name: "Rooms" })).getByRole(
        "button",
        { name: "Bedroom" },
      ),
    );
    expect(
      screen.getByRole("button", { name: "More filters" }),
    ).toHaveAttribute("aria-expanded", "false");
    const create = screen.getByRole("button", { name: "Add container" });
    expect(create).toBeVisible();
    await user.click(screen.getByRole("button", { name: "More filters" }));
    expect(
      screen.getAllByRole("button", { name: "Add container" }),
    ).toHaveLength(1);
    await user.click(create);
    const draft = screen.getByRole("dialog", { name: "Add container" });
    expect(
      within(draft).getByRole("combobox", { name: "Location" }),
    ).toHaveValue("location:sample-location-1");
    expect(within(draft).getByRole("textbox", { name: "Name" })).toHaveValue(
      "",
    );
    await user.type(
      within(draft).getByRole("textbox", { name: "Name" }),
      "Packing box",
    );
    await user.click(
      within(draft).getByRole("button", { name: "Add container" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Close item details" }),
    );
    expect(
      screen.getByRole("button", { name: "Open Packing box" }),
    ).toBeVisible();
  });

  it("creates a nested container from the visible toolbar action", async () => {
    const user = userEvent.setup();
    render(<LiquidDashboard />);
    await user.click(screen.getByRole("button", { name: "Spaces" }));

    await user.click(screen.getByRole("button", { name: "Open Cabinet" }));
    await user.click(screen.getByRole("button", { name: "Add container" }));

    const draft = screen.getByRole("dialog", { name: "Add container" });
    expect(
      screen.queryByRole("button", { name: "Open Nested box" }),
    ).toBeNull();
    expect(
      within(draft).getByRole("combobox", { name: "Location" }),
    ).toHaveValue("container:cabinet");
    await user.type(
      within(draft).getByRole("textbox", { name: "Name" }),
      "Nested box",
    );
    await user.click(
      within(draft).getByRole("button", { name: "Add container" }),
    );
    await user.click(
      screen.getByRole("button", { name: "Close item details" }),
    );
    await user.click(screen.getByRole("button", { name: "Open Nested box" }));
    expect(
      screen.getByRole("region", { name: "Nested box contents" }),
    ).toBeVisible();
  });
});

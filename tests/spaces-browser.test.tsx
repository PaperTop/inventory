// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom/vitest";
import { Folder } from "@phosphor-icons/react";
import { SpacesBrowser } from "../src/components/spaces-browser";
afterEach(cleanup);
it("filters space cards and opens existing edit and delete actions from the menu", async () => {
  const user = userEvent.setup();
  const edit = vi.fn(),
    remove = vi.fn();
  render(
    <SpacesBrowser
      spaces={[
        { name: "Bedroom", Icon: Folder, color: "#55b7ff" },
        { name: "College", Icon: Folder, color: "#55b7ff" },
      ]}
      items={[]}
      onOpen={() => {}}
      onAdd={() => {}}
      onEdit={edit}
      onDelete={remove}
    />,
  );
  await user.type(
    screen.getByRole("searchbox", { name: "Search spaces" }),
    "bed",
  );
  expect(screen.queryByRole("button", { name: "Open College" })).toBeNull();
  await user.click(screen.getByLabelText("Actions for Bedroom"));
  await user.click(screen.getByRole("button", { name: "Edit Bedroom" }));
  expect(edit).toHaveBeenCalledWith("Bedroom");
  await user.click(screen.getByLabelText("Actions for Bedroom"));
  await user.click(screen.getByRole("button", { name: "Delete Bedroom" }));
  expect(remove).toHaveBeenCalledWith("Bedroom");
});

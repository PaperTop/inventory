"use client";

import { useState, type CSSProperties } from "react";
import {
  DotsThree,
  MagnifyingGlass,
  Plus,
  SquaresFour,
  List,
  PencilSimple,
  SlidersHorizontal,
  Trash,
  type Icon,
} from "@phosphor-icons/react";
import type { Item } from "@/lib/inventory";
import styles from "./spaces-browser.module.css";

type Space = { name: string; Icon: Icon; color: string };
export function SpacesBrowser({
  spaces,
  items,
  onOpen,
  onAdd,
  onEdit,
  onDelete,
}: {
  spaces: Space[];
  items: Item[];
  onOpen: (name: string) => void;
  onAdd: () => void;
  onEdit: (name: string) => void;
  onDelete: (name: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [menu, setMenu] = useState<string | null>(null);
  const visible = spaces.filter((space) =>
    space.name.toLowerCase().includes(search.trim().toLowerCase()),
  );
  return (
    <section className={styles.browser} aria-label="Manage spaces">
      <header className={styles.header}>
        <div>
          <h1>Spaces</h1>
          <p>Organize your inventory by location.</p>
        </div>
        <button className={styles.add} onClick={onAdd}>
          <Plus /> Add space
        </button>
      </header>
      <div className={styles.toolbar}>
        <label className={styles.search}>
          <MagnifyingGlass />
          <input
            type="search"
            aria-label="Search spaces"
            placeholder="Search spaces…"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setMenu(null);
            }}
          />
        </label>
        <div className={styles.view}>
          <button
            aria-label="Space grid view"
            aria-pressed={view === "grid"}
            onClick={() => setView("grid")}
          >
            <SquaresFour weight="fill" />
          </button>
          <button
            aria-label="Space list view"
            aria-pressed={view === "list"}
            onClick={() => setView("list")}
          >
            <List />
          </button>
        </div>
      </div>
      <div className={`${styles.cards} ${view === "list" ? styles.list : ""}`}>
        {visible.map((space) => {
          const contents = items.filter(
            (item) => item.location_name === space.name,
          );
          const containers = contents.filter(
            (item) => item.kind === "container",
          ).length;
          const count = contents.length - containers;
          const SpaceIcon = space.Icon;
          return (
            <article
              key={space.name}
              className={styles.card}
              style={{ "--space-color": space.color } as CSSProperties}
            >
              <button
                className={styles.open}
                aria-label={`Open ${space.name}`}
                onClick={() => onOpen(space.name)}
              >
                <span className={styles.visual}>
                  <SpaceIcon weight="duotone" />
                </span>
                <span className={styles.caption}>
                  <strong>{space.name}</strong>
                  <small>
                    {count} {count === 1 ? "item" : "items"}
                    {containers > 0 &&
                      ` · ${containers} ${containers === 1 ? "container" : "containers"}`}
                  </small>
                </span>
              </button>
              <div
                className={styles.menuWrap}
                onBlur={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget))
                    setMenu(null);
                }}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    setMenu(null);
                    event.currentTarget
                      .querySelector<HTMLButtonElement>("button")
                      ?.focus();
                  }
                }}
              >
                <button
                  className={styles.more}
                  aria-label={`Actions for ${space.name}`}
                  aria-expanded={menu === space.name}
                  onClick={() =>
                    setMenu(menu === space.name ? null : space.name)
                  }
                >
                  <DotsThree weight="bold" />
                </button>
                {menu === space.name && (
                  <div className={styles.menu}>
                    <button
                      aria-label={`Rename ${space.name}`}
                      onClick={() => {
                        setMenu(null);
                        onEdit(space.name);
                      }}
                    >
                      <PencilSimple />
                      Rename
                    </button>
                    <button
                      aria-label={`Edit ${space.name}`}
                      onClick={() => {
                        setMenu(null);
                        onEdit(space.name);
                      }}
                    >
                      <SlidersHorizontal />
                      Edit space
                    </button>
                    <button
                      className={styles.danger}
                      aria-label={`Delete ${space.name}`}
                      onClick={() => {
                        setMenu(null);
                        onDelete(space.name);
                      }}
                    >
                      <Trash />
                      Delete space
                    </button>
                  </div>
                )}
              </div>
            </article>
          );
        })}
        {!search && (
          <button className={styles.addCard} onClick={onAdd}>
            <Plus />
            <span>Add space</span>
          </button>
        )}
      </div>
      {visible.length === 0 && (
        <p className={styles.empty}>No spaces found. Try another name.</p>
      )}
      <p className={styles.count}>
        {visible.length} {visible.length === 1 ? "space" : "spaces"}
      </p>
    </section>
  );
}

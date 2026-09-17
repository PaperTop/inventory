"use client";

import Image from "next/image";
import { Folder, Plus, House, X } from "@phosphor-icons/react";
import type { Item } from "@/lib/inventory";
import { ancestors } from "@/lib/containers";
import { sortInventory, type InventoryViewOptions } from "@/lib/presentation";
import type { VisualItem } from "./use-inventory-store";
import styles from "./liquid-dashboard.module.css";
import css from "./container-grid.module.css";

export function ContainerGrid({
  items,
  visible,
  selectedId,
  view,
  sort,
  opened,
  onOpen,
  showContainers,
  queryActive,
  onSelect,
  onAddItem,
  onAddContainer,
}: {
  items: VisualItem[];
  visible: Item[];
  selectedId?: string;
  view: "grid" | "list";
  sort: InventoryViewOptions["sort"];
  opened: string | null;
  onOpen: (id: string | null) => void;
  showContainers: boolean;
  queryActive: boolean;
  onSelect: (item: Item) => void;
  onAddItem: (parent?: string) => void;
  onAddContainer: (parent?: string) => void;
}) {
  const current = items.find(
    (item) => item.id === opened && item.kind === "container",
  );
  const chain = current ? [...ancestors(current, items), current] : [];
  const rows = sortInventory(
    current
      ? visible.filter((item) => item.parent_container_id === current.id)
      : showContainers
        ? queryActive
          ? visible
          : visible.filter((item) => !item.parent_container_id)
        : visible.filter((item) => item.kind !== "container"),
    sort,
  );
  const imageOf = (item: Item) =>
    items.find((row) => row.id === item.id)?.image ??
    "/inventory-assets/item.svg";
  const count = (item: Item) =>
    items.filter(
      (row) => row.ancestor_ids?.includes(item.id) && row.kind !== "container",
    ).length;
  const openItem = (item: Item) =>
    item.kind === "container" ? onOpen(item.id) : onSelect(item);
  const date = (value: string) =>
    new Date(value).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    });

  return (
    <div className={`${css.workspace} ${current ? css.withContainer : ""}`}>
      <section
        className={css.content}
        aria-label={current ? `${current.name} contents` : "Inventory items"}
      >
        {view === "list" ? (
          <div className={css.tableScroll}>
            <table className={css.table}>
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Category</th>
                  <th>Location</th>
                  <th>Container</th>
                  <th>Qty</th>
                  <th>Status</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((item) => (
                  <tr
                    key={item.id}
                    className={item.id === selectedId ? css.selectedRow : ""}
                  >
                    <td>
                      <button
                        onClick={() => openItem(item)}
                        aria-label={
                          item.kind === "container"
                            ? `Open ${item.name}`
                            : `View ${item.name}`
                        }
                      >
                        <Image
                          src={imageOf(item)}
                          alt=""
                          width={36}
                          height={36}
                          unoptimized={imageOf(item).startsWith("/api/items/")}
                        />
                        <span>{item.name}</span>
                      </button>
                    </td>
                    <td>{item.category}</td>
                    <td>{item.location_name ?? "Unassigned"}</td>
                    <td>
                      {item.parent_container_id
                        ? [...ancestors(item, items)]
                            .map((parent) => parent.name)
                            .join(" / ")
                        : "—"}
                    </td>
                    <td>
                      {item.quantity}
                      {item.unit === "pair" ? " pair" : ""}
                    </td>
                    <td>
                      <span className={css.status} data-status={item.status}>
                        {item.status === "lost" ? "Missing" : item.status}
                      </span>
                    </td>
                    <td>{date(item.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className={styles.itemGrid}>
            {rows.map((item) => (
              <button
                key={item.id}
                className={`${styles.itemCard} ${item.id === selectedId ? styles.selectedCard : ""}`}
                onClick={() => openItem(item)}
                aria-label={
                  item.kind === "container"
                    ? `Open ${item.name}`
                    : `View ${item.name}`
                }
              >
                <span className={styles.itemImage}>
                  <Image
                    src={imageOf(item)}
                    alt=""
                    fill
                    sizes="(max-width: 600px) 130px, 160px"
                    loading="eager"
                    unoptimized={imageOf(item).startsWith("/api/items/")}
                  />
                </span>
                <span className={styles.itemName}>{item.name}</span>
                <span className={styles.itemSubline}>
                  {item.kind === "container"
                    ? `${count(item)} items`
                    : item.category}
                </span>
                {item.kind === "container" && (
                  <Folder className={css.folderIcon} />
                )}
              </button>
            ))}
            <button
              className={css.addTile}
              aria-label={
                current
                  ? `Add item to ${current.name}`
                  : "Add item to inventory"
              }
              onClick={() => onAddItem(current?.id)}
            >
              <Plus />
              <span>Add item{current ? ` to ${current.name}` : ""}</span>
            </button>
          </div>
        )}
        {current && (
          <footer className={css.panelFooter}>
            <span>{rows.length} items</span>
            <button onClick={() => onAddContainer(current.id)}>
              <Folder />
              Add container
            </button>
          </footer>
        )}
      </section>
      {current && (
        <aside className={css.containerInfo} aria-label="Container overview">
          <button
            className={css.closeInfo}
            onClick={() => onOpen(null)}
            aria-label="Close container"
          >
            <X />
          </button>
          <nav>
            <button onClick={() => onOpen(null)}>
              <House />
              Home
            </button>
            <span>
              <Folder />
              {current.location_name}
            </span>
            {chain.map((item) => (
              <button
                key={item.id}
                onClick={() => onOpen(item.id)}
                className={item.id === current.id ? css.currentPath : ""}
              >
                <Folder />
                {item.name}
              </button>
            ))}
          </nav>
          <Image src={imageOf(current)} alt="" width={88} height={88} />
          <h2>{current.name}</h2>
          <p>{count(current)} items</p>
          <button
            className={css.containerDetails}
            onClick={() => onSelect(current)}
            aria-label={`Edit ${current.name}`}
          >
            View container details
          </button>
        </aside>
      )}
    </div>
  );
}

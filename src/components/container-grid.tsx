"use client";
import Image from "next/image";
import { useRef, useState } from "react";
import {
  Folder,
  Plus,
  CaretUp,
  CaretRight,
  House,
} from "@phosphor-icons/react";
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
  queryActive: boolean;
  onSelect: (item: Item) => void;
  onAddItem: (parent: string) => void;
  onAddContainer: (parent: string) => void;
}) {
  const [opened, setOpened] = useState<string | null>(null);
  const rootTrigger = useRef<HTMLButtonElement | null>(null);
  const current = items.find(
    (item) => item.id === opened && item.kind === "container",
  );
  const chain = current ? [...ancestors(current, items), current] : [];
  const rootId = chain[0]?.id;
  const roots = queryActive
    ? visible
    : visible.filter((item) => !item.parent_container_id);
  const shownRoot =
    roots.find((item) => item.id === rootId) ??
    (queryActive ? roots.find((item) => item.id === opened) : undefined);
  function close() {
    setOpened(null);
    rootTrigger.current?.focus();
  }
  function imageOf(item: Item) {
    return (
      items.find((row) => row.id === item.id)?.image ??
      "/inventory-assets/item.svg"
    );
  }
  function count(item: Item) {
    const children = items.filter((row) => row.ancestor_ids?.includes(item.id));
    const objects = children.filter((row) => row.kind !== "container").length;
    const containers = children.filter(
      (row) => row.kind === "container",
    ).length;
    return `${objects} item${objects === 1 ? "" : "s"}${
      containers
        ? ` · ${containers} container${containers === 1 ? "" : "s"}`
        : ""
    }`;
  }
  function card(item: Item, inside = false) {
    const container = item.kind === "container";
    return (
      <button
        key={item.id}
        ref={item.id === shownRoot?.id ? rootTrigger : undefined}
        type="button"
        className={`${styles.itemCard} ${css.card} ${
          container ? css.container : ""
        } ${item.id === selectedId ? styles.selectedCard : ""} ${
          item.id === shownRoot?.id ? css.openCard : ""
        }`}
        onClick={() => {
          if (container) {
            if (opened === item.id && !inside) close();
            else {
              setOpened(item.id);
            }
          } else onSelect(item);
        }}
        aria-label={container ? `Open ${item.name}` : `View ${item.name}`}
        aria-expanded={
          container ? chain.some((row) => row.id === item.id) : undefined
        }
        aria-controls={
          container && chain.some((row) => row.id === item.id)
            ? "container-panel"
            : undefined
        }
      >
        {container && (
          <Folder className={css.folder} weight="fill" aria-hidden="true" />
        )}
        <span className={styles.itemImage}>
          <Image
            src={imageOf(item)}
            unoptimized={imageOf(item).startsWith("/api/items/")}
            alt=""
            fill
            sizes="140px"
            loading="eager"
          />
        </span>
        <span className={styles.itemName}>{item.name}</span>
        {container && <span className={css.count}>{count(item)}</span>}
        {!container && inside && (
          <span className={css.badge}>
            <Folder weight="fill" aria-hidden="true" /> In {current?.name}
          </span>
        )}
        {queryActive && (
          <span className={css.path}>
            {item.location_path?.slice(0, -1).join(" → ")}
          </span>
        )}
        {!inside && view === "list" && (
          <span className={styles.itemSubline}>
            {item.category} · {item.location_name}
          </span>
        )}
        {item.quantity > 1 && (
          <span className={styles.countBadge}>{item.quantity}</span>
        )}
      </button>
    );
  }
  function panel() {
    if (!current) return null;
    const children = sortInventory(
      items.filter((item) => item.parent_container_id === current.id),
      sort,
    );
    return (
      <section
        id="container-panel"
        className={css.panel}
        aria-label={`${current.name} contents`}
      >
        <header className={css.panelHeader}>
          <nav aria-label="Container breadcrumb" className={css.breadcrumb}>
            <button
              type="button"
              onClick={close}
              aria-label="Back to inventory"
            >
              <House aria-hidden="true" />
              {current.location_name ?? "Inventory"}
            </button>
            {chain.map((item) => (
              <span key={item.id}>
                <CaretRight aria-hidden="true" />
                <button
                  type="button"
                  aria-current={item.id === current.id ? "location" : undefined}
                  onClick={() => setOpened(item.id)}
                >
                  {item.name}
                </button>
              </span>
            ))}
          </nav>
          <span className={css.panelPath}>
            {current.location_path?.join(" → ")}
          </span>
          <button type="button" className={css.close} onClick={close}>
            Close <CaretUp aria-hidden="true" />
          </button>
        </header>
        <div className={css.children}>
          {children.map((item) => card(item, true))}
          <button
            type="button"
            className={css.addTile}
            onClick={() => onAddItem(current.id)}
          >
            <Plus aria-hidden="true" />
            <span>
              Add item
              <br />
              to {current.name}
            </span>
          </button>
        </div>
        <footer className={css.panelFooter}>
          <span>
            {children.length ? count(current) : "This container is empty"}
          </span>
          <button type="button" onClick={() => onAddContainer(current.id)}>
            <Folder aria-hidden="true" /> Add container
          </button>
          <button type="button" onClick={() => onSelect(current)}>
            Edit {current.name}
          </button>
        </footer>
      </section>
    );
  }
  return (
    <div
      className={`${view === "grid" ? styles.itemGrid : styles.itemList} ${css.grid}`}
      aria-label="Inventory items"
    >
      {roots.map((item) =>
        item.id === shownRoot?.id ? (
          <div
            className={`${css.expanded} ${view === "list" ? css.listExpanded : ""}`}
            key={item.id}
          >
            {card(item)}
            {panel()}
          </div>
        ) : (
          card(item)
        ),
      )}
      {Array.from(
        { length: Math.max(0, (view === "grid" ? 24 : 0) - roots.length) },
        (_, index) => (
          <div
            className={styles.emptySlot}
            key={`empty-${index}`}
            aria-hidden="true"
          />
        ),
      )}
    </div>
  );
}

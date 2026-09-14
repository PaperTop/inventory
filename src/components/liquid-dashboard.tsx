"use client";

import Image from "next/image";
import { useMemo, useState, type FormEvent } from "react";
import {
  Buildings,
  CarProfile,
  CaretDown,
  Check,
  Copy,
  Cube,
  DotsThree,
  House,
  List,
  MagnifyingGlass,
  MapPin,
  Minus,
  Package,
  PaperPlaneTilt,
  PencilSimple,
  Plus,
  SlidersHorizontal,
  Sparkle,
  SquaresFour,
  Tag,
  Trash,
  Warning,
} from "@phosphor-icons/react";
import type { Item } from "@/lib/inventory";
import {
  buildInventorySlots,
  duplicateInventoryItem,
  filterInventory,
  type InventoryViewOptions,
} from "@/lib/presentation";
import styles from "./liquid-dashboard.module.css";

type VisualItem = Item & { image: string };

const owner = "11111111-1111-4111-8111-111111111111";
const baseDate = "2026-09-14T07:24:00.000Z";

const seedItems: VisualItem[] = [
  {
    id: "backpack",
    user_id: owner,
    name: "Backpack",
    kind: "durable",
    description: "Main backpack for school and travel. Fits a 15-inch laptop.",
    category: "Everyday carry",
    quantity: 1,
    unit: "pc",
    reorder_threshold: null,
    location_id: null,
    location_name: "College",
    tags: ["school", "travel", "everyday"],
    status: "active",
    condition: "good",
    attributes: { color: "Black", material: "Recycled nylon" },
    version: 1,
    created_at: "2026-09-08T10:20:00.000Z",
    updated_at: baseDate,
    image: "/inventory-assets/backpack.png",
  },
  {
    id: "laptop",
    user_id: owner,
    name: "Laptop",
    kind: "durable",
    description: "13-inch laptop used for work and classes.",
    category: "Electronics",
    quantity: 1,
    unit: "pc",
    reorder_threshold: null,
    location_id: null,
    location_name: "College",
    tags: ["work", "school"],
    status: "active",
    condition: "good",
    attributes: { color: "Silver" },
    version: 1,
    created_at: "2026-08-19T08:00:00.000Z",
    updated_at: "2026-09-13T17:10:00.000Z",
    image: "/inventory-assets/laptop.png",
  },
  {
    id: "water-bottle",
    user_id: owner,
    name: "Water bottle",
    kind: "durable",
    description: "One-liter bottle for long days away from home.",
    category: "Everyday carry",
    quantity: 1,
    unit: "pc",
    reorder_threshold: null,
    location_id: null,
    location_name: "College",
    tags: ["daily", "gym"],
    status: "active",
    condition: "good",
    attributes: { capacity: "1 L" },
    version: 1,
    created_at: "2026-08-28T08:00:00.000Z",
    updated_at: "2026-09-13T13:42:00.000Z",
    image: "/inventory-assets/bottle.png",
  },
  {
    id: "headphones",
    user_id: owner,
    name: "Headphones",
    kind: "durable",
    description: "Noise-cancelling headphones with a travel case.",
    category: "Electronics",
    quantity: 1,
    unit: "pc",
    reorder_threshold: null,
    location_id: null,
    location_name: "Bedroom",
    tags: ["music", "travel"],
    status: "active",
    condition: "good",
    attributes: { color: "Black" },
    version: 1,
    created_at: "2026-07-10T08:00:00.000Z",
    updated_at: "2026-09-12T22:12:00.000Z",
    image: "/inventory-assets/headphones.png",
  },
  {
    id: "sneakers",
    user_id: owner,
    name: "Sneakers",
    kind: "durable",
    description: "Everyday white sneakers.",
    category: "Clothing",
    quantity: 1,
    unit: "pair",
    reorder_threshold: null,
    location_id: null,
    location_name: "Bedroom",
    tags: ["everyday"],
    status: "active",
    condition: "fair",
    attributes: { size: "10" },
    version: 1,
    created_at: "2026-06-02T08:00:00.000Z",
    updated_at: "2026-09-11T10:00:00.000Z",
    image: "/inventory-assets/sneakers.png",
  },
  {
    id: "camera",
    user_id: owner,
    name: "Camera",
    kind: "durable",
    description: "Compact camera for trips and weekend walks.",
    category: "Electronics",
    quantity: 1,
    unit: "pc",
    reorder_threshold: null,
    location_id: null,
    location_name: "Bedroom",
    tags: ["travel", "creative"],
    status: "stored",
    condition: "good",
    attributes: { lens: "35 mm" },
    version: 1,
    created_at: "2026-05-18T08:00:00.000Z",
    updated_at: "2026-09-10T09:30:00.000Z",
    image: "/inventory-assets/camera.png",
  },
  {
    id: "hoodie",
    user_id: owner,
    name: "Hoodie",
    kind: "durable",
    description: "Soft charcoal hoodie for cool evenings.",
    category: "Clothing",
    quantity: 1,
    unit: "pc",
    reorder_threshold: null,
    location_id: null,
    location_name: "Bedroom",
    tags: ["everyday", "warm"],
    status: "active",
    condition: "good",
    attributes: { size: "M" },
    version: 1,
    created_at: "2026-05-05T08:00:00.000Z",
    updated_at: "2026-09-09T19:20:00.000Z",
    image: "/inventory-assets/hoodie.png",
  },
  {
    id: "notebook",
    user_id: owner,
    name: "Notebook",
    kind: "durable",
    description: "Daily notes, sketches, and lists.",
    category: "Stationery",
    quantity: 1,
    unit: "pc",
    reorder_threshold: null,
    location_id: null,
    location_name: "College",
    tags: ["school", "work"],
    status: "active",
    condition: "good",
    attributes: { pages: 120 },
    version: 1,
    created_at: "2026-08-30T08:00:00.000Z",
    updated_at: "2026-09-08T14:00:00.000Z",
    image: "/inventory-assets/notebook.png",
  },
  {
    id: "wallet",
    user_id: owner,
    name: "Wallet",
    kind: "durable",
    description: "Slim leather wallet for essential cards.",
    category: "Everyday carry",
    quantity: 1,
    unit: "pc",
    reorder_threshold: null,
    location_id: null,
    location_name: "Home",
    tags: ["daily"],
    status: "active",
    condition: "good",
    attributes: { material: "Leather" },
    version: 1,
    created_at: "2026-04-02T08:00:00.000Z",
    updated_at: "2026-09-07T08:00:00.000Z",
    image: "/inventory-assets/wallet.png",
  },
  {
    id: "umbrella",
    user_id: owner,
    name: "Umbrella",
    kind: "durable",
    description: "Compact umbrella kept near the front door.",
    category: "Everyday carry",
    quantity: 1,
    unit: "pc",
    reorder_threshold: null,
    location_id: null,
    location_name: "Car",
    tags: ["travel", "rain"],
    status: "active",
    condition: "new",
    attributes: { color: "Black" },
    version: 1,
    created_at: "2026-09-01T08:00:00.000Z",
    updated_at: "2026-09-06T16:40:00.000Z",
    image: "/inventory-assets/umbrella.png",
  },
];

const navItems = [
  { label: "Home", value: "all", Icon: House },
  { label: "College", value: "College", Icon: Buildings },
  { label: "Car", value: "Car", Icon: CarProfile },
] as const;

function now() {
  return new Date().toISOString();
}

export function LiquidDashboard() {
  const [items, setItems] = useState(seedItems);
  const [selectedId, setSelectedId] = useState(seedItems[0].id);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<InventoryViewOptions["kind"]>("all");
  const [location, setLocation] = useState("all");
  const [sort, setSort] = useState<InventoryViewOptions["sort"]>("recent");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [editing, setEditing] = useState(false);
  const [assistantPrompt, setAssistantPrompt] = useState("");
  const [assistantReply, setAssistantReply] = useState("");
  const [notice, setNotice] = useState("Sample inventory is ready");

  const filtered = useMemo(
    () => filterInventory(items, { query, kind, location, sort }),
    [items, kind, location, query, sort],
  );
  const selected =
    items.find((item) => item.id === selectedId) ?? items[0] ?? null;
  const slots = view === "grid" ? buildInventorySlots(filtered, 32) : filtered;

  function patchSelected(patch: Partial<VisualItem>) {
    if (!selected) return;
    setItems((current) =>
      current.map((item) =>
        item.id === selected.id
          ? { ...item, ...patch, version: item.version + 1, updated_at: now() }
          : item,
      ),
    );
  }

  function addItem() {
    const id = crypto.randomUUID();
    const created: VisualItem = {
      ...seedItems[7],
      id,
      name: "New item",
      description: "Add a few details so this item is easy to find later.",
      tags: [],
      location_name: "Home",
      created_at: now(),
      updated_at: now(),
      version: 1,
    };
    setItems((current) => [created, ...current]);
    setSelectedId(id);
    setLocation("all");
    setEditing(true);
    setNotice("New item added");
  }

  function removeSelected() {
    if (!selected) return;
    const remaining = items.filter((item) => item.id !== selected.id);
    setItems(remaining);
    setSelectedId(remaining[0]?.id ?? "");
    setEditing(false);
    setNotice(`${selected.name} deleted`);
  }

  function duplicateSelected() {
    if (!selected) return;
    const id = crypto.randomUUID();
    const duplicate: VisualItem = {
      ...duplicateInventoryItem(selected, id, now()),
      image: selected.image,
    };
    setItems((current) => [duplicate, ...current]);
    setSelectedId(id);
    setEditing(true);
    setNotice(`${selected.name} duplicated`);
  }

  function askAssistant(event: FormEvent) {
    event.preventDefault();
    const prompt = assistantPrompt.trim();
    if (!prompt) return;
    const match = items.find((item) =>
      prompt.toLowerCase().includes(item.name.toLowerCase()),
    );
    setAssistantReply(
      match
        ? `${match.name} is listed in ${match.location_name ?? "an unassigned location"}.`
        : `I found ${items.length} items. Try asking where your backpack, laptop, or camera is.`,
    );
  }

  return (
    <main className={styles.shell}>
      <div className={styles.backdrop} aria-hidden="true" />
      <div className={styles.glow} aria-hidden="true" />

      <header className={styles.brand}>
        <span className={styles.brandIcon}><Package weight="fill" /></span>
        <span>Inventory</span>
        <small>Private workspace</small>
      </header>

      <div className={styles.workspace}>
        <aside className={`${styles.glass} ${styles.rail}`}>
          <nav aria-label="Inventory locations">
            {navItems.map(({ label, value, Icon }) => (
              <button
                key={value}
                className={location === value ? styles.activeNav : ""}
                onClick={() => setLocation(value)}
                aria-pressed={location === value}
              >
                <Icon weight={location === value ? "fill" : "regular"} />
                <span>{label}</span>
              </button>
            ))}
          </nav>
          <button className={styles.addRail} onClick={addItem} aria-label="Add item">
            <Plus weight="bold" />
          </button>
          <div className={styles.profile} title="Local demo profile">JH</div>
        </aside>

        <section className={`${styles.glass} ${styles.library}`}>
          <div className={styles.toolbar}>
            <label className={styles.search}>
              <MagnifyingGlass weight="bold" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search items..."
                aria-label="Search items"
              />
              {query && <button onClick={() => setQuery("")} aria-label="Clear search">×</button>}
            </label>

            <label className={styles.selectControl}>
              <span>Sort</span>
              <select value={sort} onChange={(event) => setSort(event.target.value as InventoryViewOptions["sort"])}>
                <option value="recent">Recently updated</option>
                <option value="name">Name</option>
                <option value="quantity">Quantity</option>
              </select>
              <CaretDown weight="bold" />
            </label>

            <label className={styles.selectControl}>
              <SlidersHorizontal weight="bold" />
              <select value={kind} onChange={(event) => setKind(event.target.value as InventoryViewOptions["kind"])}>
                <option value="all">All items</option>
                <option value="durable">Durable</option>
                <option value="consumable">Consumable</option>
                <option value="low">Low stock</option>
              </select>
              <CaretDown weight="bold" />
            </label>

            <div className={styles.viewToggle} aria-label="View style">
              <button className={view === "grid" ? styles.selectedToggle : ""} onClick={() => setView("grid")} aria-label="Grid view"><SquaresFour weight="fill" /></button>
              <button className={view === "list" ? styles.selectedToggle : ""} onClick={() => setView("list")} aria-label="List view"><List weight="bold" /></button>
            </div>
          </div>

          <div className={styles.libraryMeta}>
            <span>{location === "all" ? "All spaces" : location}</span>
            <span>{filtered.length} items</span>
          </div>

          <div className={view === "grid" ? styles.itemGrid : styles.itemList} aria-label="Inventory items">
            {slots.map((item, index) =>
              item ? (
                <button
                  key={item.id}
                  className={`${styles.itemCard} ${item.id === selected?.id ? styles.selectedCard : ""}`}
                  onClick={() => { setSelectedId(item.id); setEditing(false); }}
                  aria-label={`View ${item.name}`}
                >
                  <span className={styles.itemImage}>
                    <Image
                      src={(item as VisualItem).image}
                      alt=""
                      fill
                      sizes="140px"
                      loading="eager"
                    />
                  </span>
                  <span className={styles.itemName}>{item.name}</span>
                  {view === "list" && <span className={styles.itemSubline}>{item.category} · {item.location_name}</span>}
                  {item.quantity > 1 && <span className={styles.countBadge}>{item.quantity}</span>}
                </button>
              ) : (
                <div className={styles.emptySlot} key={`empty-${index}`} aria-hidden="true" />
              ),
            )}
          </div>

          {filtered.length === 0 && (
            <div className={styles.emptyState}>
              <Cube weight="duotone" />
              <strong>No items found</strong>
              <span>Try a different search or filter.</span>
            </div>
          )}

          <footer className={styles.libraryFooter}>
            <span><span className={styles.liveDot} /> Local sample data</span>
            <span>{notice}</span>
          </footer>
        </section>

        <aside className={`${styles.glass} ${styles.details}`}>
          {selected ? (
            <>
              <div className={styles.detailHero}>
                <div className={styles.detailImage}>
                  <Image src={selected.image} alt={selected.name} fill sizes="220px" priority />
                </div>
                <div className={styles.detailTitle}>
                  {editing ? (
                    <input value={selected.name} onChange={(event) => patchSelected({ name: event.target.value })} aria-label="Item name" />
                  ) : (
                    <h1>{selected.name}</h1>
                  )}
                  <span><Cube weight="duotone" /> {selected.kind === "durable" ? "Durable" : "Consumable"}</span>
                </div>
                <button className={styles.moreButton} aria-label="More options"><DotsThree weight="bold" /></button>
              </div>

              <div className={styles.detailRows}>
                <div className={styles.fieldRow}>
                  <span className={styles.fieldLabel}><Package weight="duotone" /> Quantity</span>
                  <div className={styles.stepper}>
                    <button onClick={() => patchSelected({ quantity: Math.max(0, selected.quantity - 1) })} aria-label="Decrease quantity"><Minus weight="bold" /></button>
                    <span>{selected.quantity}</span>
                    <button onClick={() => patchSelected({ quantity: selected.quantity + 1 })} aria-label="Increase quantity"><Plus weight="bold" /></button>
                  </div>
                  <span className={styles.unit}>{selected.unit}</span>
                </div>

                <label className={styles.fieldRow}>
                  <span className={styles.fieldLabel}><Tag weight="duotone" /> Category</span>
                  <input disabled={!editing} value={selected.category} onChange={(event) => patchSelected({ category: event.target.value })} />
                </label>

                <label className={styles.fieldRow}>
                  <span className={styles.fieldLabel}><MapPin weight="fill" /> Location</span>
                  <select disabled={!editing} value={selected.location_name ?? "Home"} onChange={(event) => patchSelected({ location_name: event.target.value })}>
                    <option>Home</option><option>Bedroom</option><option>College</option><option>Car</option>
                  </select>
                </label>

                <div className={styles.splitFields}>
                  <label>
                    <span>Condition</span>
                    <select disabled={!editing} value={selected.condition} onChange={(event) => patchSelected({ condition: event.target.value as Item["condition"] })}>
                      <option value="new">New</option><option value="good">Good</option><option value="fair">Fair</option><option value="poor">Poor</option><option value="unknown">Unknown</option>
                    </select>
                  </label>
                  <label>
                    <span>Status</span>
                    <select disabled={!editing} value={selected.status} onChange={(event) => patchSelected({ status: event.target.value as Item["status"] })}>
                      <option value="active">Active</option><option value="stored">Stored</option><option value="lent">Lent</option><option value="lost">Missing</option><option value="disposed">Disposed</option>
                    </select>
                  </label>
                </div>

                <div className={styles.tagRow}>
                  <span className={styles.fieldLabel}><Tag weight="fill" /> Tags</span>
                  <div>{selected.tags.map((tag) => <button key={tag} onClick={() => editing && patchSelected({ tags: selected.tags.filter((entry) => entry !== tag) })}>{tag}{editing && " ×"}</button>)}</div>
                </div>

                <label className={styles.notesRow}>
                  <span>Notes</span>
                  <textarea disabled={!editing} value={selected.description} onChange={(event) => patchSelected({ description: event.target.value })} />
                </label>
              </div>

              <div className={styles.actions}>
                <button onClick={() => patchSelected({ location_name: selected.location_name === "College" ? "Home" : "College" })}><MapPin weight="duotone" /><span>Move</span></button>
                <button className={editing ? styles.actionActive : ""} onClick={() => { setEditing((value) => !value); setNotice(editing ? "Changes saved locally" : "Editing item"); }}>
                  {editing ? <Check weight="bold" /> : <PencilSimple weight="fill" />}<span>{editing ? "Done" : "Edit"}</span>
                </button>
                <button onClick={duplicateSelected}><Copy weight="duotone" /><span>Duplicate</span></button>
                <button onClick={() => patchSelected({ tags: selected.tags.includes("favorite") ? selected.tags : [...selected.tags, "favorite"] })}><Sparkle weight="fill" /><span>Favorite</span></button>
                <button onClick={() => patchSelected({ status: selected.status === "lost" ? "active" : "lost" })}><Warning weight="duotone" /><span>{selected.status === "lost" ? "Found" : "Missing"}</span></button>
                <button className={styles.deleteAction} onClick={removeSelected}><Trash weight="fill" /><span>Delete</span></button>
              </div>

              <form className={styles.assistant} onSubmit={askAssistant}>
                <span className={styles.orb}><Sparkle weight="fill" /></span>
                <label>
                  <strong>Jarvis</strong>
                  <input value={assistantPrompt} onChange={(event) => setAssistantPrompt(event.target.value)} placeholder="Ask about your things..." aria-label="Ask Jarvis" />
                </label>
                <button aria-label="Send question"><PaperPlaneTilt weight="fill" /></button>
                {assistantReply && <p>{assistantReply}</p>}
              </form>
            </>
          ) : (
            <div className={styles.noSelection}><Package weight="duotone" /><span>Add an item to get started.</span></div>
          )}
        </aside>
      </div>
    </main>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type SVGProps,
} from "react";
import {
  Archive,
  ArrowRight,
  Backpack,
  Box,
  Check,
  Close,
  Coffee,
  ExternalLink,
  Grid3x3,
  MapPin,
  Notebook,
  Package,
  Plug,
  Plus,
  Search,
  Shield,
  Shirt,
  SlidersHorizontal,
  Sparkles,
  Spray,
  Trash,
} from "pixelarticons/react";
import { apiRepository, askApi } from "@/lib/browser-api";
import { askInventory, type AskResult } from "@/lib/ask";
import { demoRepository } from "@/lib/demo";
import {
  isLowStock,
  type Item,
  type ItemInput,
  type Location,
} from "@/lib/inventory";
import { buildInventorySlots } from "@/lib/presentation";
import { ItemForm } from "./item-form";

type PixelIcon = (props: SVGProps<SVGSVGElement>) => React.JSX.Element;

function ItemIcon({
  item,
  size = 36,
}: {
  item: Pick<Item, "name" | "category"> & Partial<Pick<Item, "kind">>;
  size?: number;
}) {
  let Icon: PixelIcon = Package;
  if (item.category === "Electronics") Icon = Plug;
  else if (item.category === "Clothing") Icon = Shirt;
  else if (item.name.toLowerCase().includes("notebook")) Icon = Notebook;
  else if (item.category === "Everyday carry") Icon = Backpack;
  else if (item.category === "Personal care") Icon = Spray;
  else if (item.kind === "consumable") Icon = Coffee;
  return <Icon width={size} height={size} aria-hidden="true" />;
}

const filters = [
  { value: "all", label: "All items", Icon: Grid3x3 },
  { value: "durable", label: "Durables", Icon: Archive },
  { value: "consumable", label: "Consumables", Icon: Coffee },
  { value: "low", label: "Running low", Icon: SlidersHorizontal },
] as const;

export function Dashboard({
  demo = false,
  email = "",
}: {
  demo?: boolean;
  email?: string;
}) {
  const router = useRouter();
  const [repository] = useState(() =>
    demo ? demoRepository() : apiRepository,
  );
  const [items, setItems] = useState<Item[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editor, setEditor] = useState<Item | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<Item | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<AskResult | null>(null);
  const [asking, setAsking] = useState(false);
  const requestNumber = useRef(0);

  const refresh = useCallback(async () => {
    const request = ++requestNumber.current;
    setLoading(true);
    setError("");
    try {
      const [rows, places] = await Promise.all([
        repository.list(query),
        repository.locations(),
      ]);
      if (request !== requestNumber.current) return;
      setItems(rows);
      setLocations(places);
    } catch (cause) {
      if (request === requestNumber.current)
        setError(
          cause instanceof Error ? cause.message : "Unable to load inventory.",
        );
    } finally {
      if (request === requestNumber.current) setLoading(false);
    }
  }, [query, repository]);

  useEffect(() => {
    const timer = setTimeout(() => void refresh(), 180);
    return () => clearTimeout(timer);
  }, [refresh]);

  const filtered = items.filter(
    (item) =>
      filter === "all" ||
      (filter === "low" ? isLowStock(item) : item.kind === filter),
  );
  const low = items.filter(isLowStock).length;
  const slots = buildInventorySlots(filtered, 30);

  async function save(input: ItemInput) {
    if (editor) await repository.update(editor.id, editor.version, input);
    else await repository.create(input);
    setNotice(editor ? "Changes saved." : "Item added.");
    setAnswer(null);
    await refresh();
  }

  async function ask(event?: FormEvent, example?: string) {
    event?.preventDefault();
    const nextQuestion = example ?? question;
    if (!nextQuestion.trim() || asking) return;
    setQuestion(nextQuestion);
    setAsking(true);
    setAnswer(null);
    try {
      setAnswer(
        demo
          ? await askInventory(nextQuestion, {
              search: (search) => repository.list(search),
            })
          : await askApi(nextQuestion),
      );
    } catch (cause) {
      setAnswer({
        answer:
          cause instanceof Error
            ? cause.message
            : "Unable to search right now.",
        citations: [],
        mode: "search",
      });
    } finally {
      setAsking(false);
    }
  }

  return (
    <div className="pixel-shell">
      <header className="pixel-header">
        <Link href={demo ? "/demo" : "/"} className="pixel-brand">
          <Box width={27} height={27} />
          <span>INVENTORY</span>
        </Link>
        <nav className="category-dock" aria-label="Inventory categories">
          {filters.map(({ value, label, Icon }) => (
            <button
              key={value}
              className={filter === value ? "active" : ""}
              onClick={() => setFilter(value)}
              aria-label={label}
              title={label}
            >
              <Icon width={27} height={27} />
              {value === "low" && low > 0 && (
                <span className="dock-count">{low}</span>
              )}
            </button>
          ))}
          <button
            onClick={() => document.getElementById("ask-question")?.focus()}
            aria-label="Ask inventory"
            title="Ask inventory"
          >
            <Sparkles width={27} height={27} />
          </button>
          <button
            className="dock-add"
            onClick={() => setEditor(null)}
            aria-label="Add item"
            title="Add item"
          >
            <Plus width={27} height={27} />
          </button>
        </nav>
        <span className="privacy-chip">
          <Shield width={16} height={16} />
          {demo ? "DEMO MODE" : "PRIVATE"}
        </span>
      </header>

      <div className="pixel-board">
        <aside className="pixel-rail">
          <p>MENU</p>
          <nav aria-label="Workspace navigation">
            {filters.map(({ value, label, Icon }) => (
              <button
                key={value}
                className={filter === value ? "active" : ""}
                onClick={() => setFilter(value)}
                aria-label={label}
                title={label}
              >
                <Icon width={30} height={30} />
              </button>
            ))}
            <button
              onClick={() => document.getElementById("ask-question")?.focus()}
              aria-label="Ask inventory"
              title="Ask inventory"
            >
              <Sparkles width={30} height={30} />
            </button>
          </nav>
          <div className="rail-account">
            <span>{demo ? "D" : email.charAt(0).toUpperCase()}</span>
            <small>{demo ? "DEMO" : "YOU"}</small>
          </div>
          {demo ? (
            <Link href="/" aria-label="Set up your inventory" title="Set up">
              <ExternalLink width={23} height={23} />
            </Link>
          ) : (
            <button
              aria-label="Sign out"
              title="Sign out"
              onClick={async () => {
                try {
                  const { browserClient } =
                    await import("@/lib/supabase/client");
                  const { error: signOutError } =
                    await browserClient().auth.signOut();
                  if (signOutError) throw signOutError;
                  router.refresh();
                } catch {
                  setError("Unable to sign out. Please try again.");
                }
              }}
            >
              <ExternalLink width={23} height={23} />
            </button>
          )}
        </aside>

        <main className="inventory-stage">
          {demo && (
            <div className="pixel-banner">
              <span>SAMPLE SAVE FILE · CHANGES RESET ON RELOAD</span>
              <Link href="/">
                CONNECT INVENTORY <ArrowRight width={16} height={16} />
              </Link>
            </div>
          )}

          <div className="stage-toolbar">
            <label className="pixel-search">
              <Search width={21} height={21} />
              <input
                aria-label="Search inventory"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                maxLength={200}
                placeholder="SEARCH ITEM NAME..."
              />
              {query && (
                <button aria-label="Clear search" onClick={() => setQuery("")}>
                  <Close width={18} height={18} />
                </button>
              )}
            </label>
            <div className="stage-title">
              <span>
                {filters.find((entry) => entry.value === filter)?.label}
              </span>
              <strong>{loading ? "--" : filtered.length}</strong>
            </div>
            <button className="pixel-add" onClick={() => setEditor(null)}>
              <Plus width={19} height={19} /> ADD ITEM
            </button>
          </div>

          {error && (
            <div role="alert" className="pixel-alert error">
              {error}
              <button onClick={() => void refresh()}>RETRY</button>
            </div>
          )}
          {notice && (
            <div role="status" className="pixel-alert success">
              <Check width={17} height={17} /> {notice}
              <button aria-label="Dismiss" onClick={() => setNotice("")}>
                <Close width={16} height={16} />
              </button>
            </div>
          )}

          <section className="inventory-slots" aria-label="Inventory items">
            {loading
              ? Array.from({ length: 30 }, (_, index) => (
                  <div className="inventory-slot loading" key={index} />
                ))
              : slots.map((item, index) =>
                  item ? (
                    <div
                      className={`inventory-slot occupied ${isLowStock(item) ? "low" : ""}`}
                      key={item.id}
                    >
                      <button
                        className="slot-main"
                        onClick={() => setEditor(item)}
                        aria-label={`Edit ${item.name}`}
                      >
                        <span className="slot-icon">
                          <ItemIcon item={item} />
                        </span>
                        <strong>{item.name}</strong>
                        <small>{item.location_name || "UNASSIGNED"}</small>
                        <span className="slot-quantity">
                          {item.quantity} {item.unit}
                        </span>
                      </button>
                      <button
                        className="slot-delete"
                        aria-label={`Delete ${item.name}`}
                        onClick={() => setDeleting(item)}
                      >
                        <Trash width={14} height={14} />
                      </button>
                    </div>
                  ) : (
                    <div
                      className="inventory-slot empty-slot"
                      aria-hidden="true"
                      key={`empty-${index}`}
                    />
                  ),
                )}
          </section>

          {!loading && !filtered.length && (
            <div className="slot-empty-message">
              <Package width={34} height={34} />
              <strong>NO ITEMS FOUND</strong>
              <span>TRY ANOTHER SEARCH OR ADD SOMETHING NEW.</span>
            </div>
          )}

          <footer className="stage-status">
            <span>
              <MapPin width={16} height={16} /> {locations.length} LOCATIONS
            </span>
            <span>{filtered.length} ITEMS SHOWN</span>
            <span className="save-state">
              <i /> {demo ? "SESSION SAVE" : "CLOUD SAVE"}
            </span>
          </footer>
        </main>

        <aside className="inventory-console">
          <div className="console-heading">
            <span>INVENTORY LOG</span>
            <Box width={27} height={27} />
          </div>

          <div className="console-stats">
            <div>
              <span>ITEMS</span>
              <strong>{loading ? "--" : items.length}</strong>
            </div>
            <div>
              <span>LOCATIONS</span>
              <strong>{locations.length}</strong>
            </div>
            <button onClick={() => setFilter("low")}>
              <span>LOW STOCK</span>
              <strong>{loading ? "--" : low}</strong>
            </button>
          </div>

          <section className="console-ask">
            <div className="console-section-title">
              <Sparkles width={22} height={22} />
              <span>ASK INVENTORY</span>
              <small>READ ONLY</small>
            </div>
            <p>SEARCH YOUR SAVE FILE USING NATURAL LANGUAGE.</p>
            <form onSubmit={ask}>
              <label className="sr-only" htmlFor="ask-question">
                Ask your inventory
              </label>
              <textarea
                id="ask-question"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                maxLength={1000}
                placeholder="WHERE IS MY CHARGER?"
                rows={4}
              />
              <button disabled={asking || !question.trim()}>
                {asking ? "SEARCHING..." : "SEARCH INVENTORY"}
                <ArrowRight width={18} height={18} />
              </button>
            </form>

            {!answer && !asking && (
              <div className="console-suggestions">
                {["Where is my charger?", "What travel items do I own?"].map(
                  (example) => (
                    <button
                      key={example}
                      onClick={() => void ask(undefined, example)}
                    >
                      {example}
                    </button>
                  ),
                )}
              </div>
            )}

            {answer && (
              <div className="console-answer" aria-live="polite">
                <span>
                  {answer.mode === "ai" ? "AI RESULT" : "SEARCH RESULT"}
                </span>
                <p>{answer.answer}</p>
                {answer.notice && <small>{answer.notice}</small>}
                <div>
                  {answer.citations.map((item) => (
                    <button
                      key={item.id}
                      onClick={async () => {
                        try {
                          const matches = await repository.list(item.name);
                          const full = matches.find(
                            (match) => match.id === item.id,
                          );
                          if (full) setEditor(full);
                          else setNotice("Item changed. Search again.");
                        } catch (cause) {
                          setError(
                            cause instanceof Error
                              ? cause.message
                              : "Unable to open item.",
                          );
                        }
                      }}
                    >
                      <ItemIcon item={item} size={18} /> {item.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          <div className="console-note">
            <Shield width={18} height={18} />
            <span>LOOKS THINGS UP. NEVER CHANGES YOUR ITEMS.</span>
          </div>
        </aside>
      </div>

      {editor !== undefined && (
        <ItemForm
          item={editor}
          locations={locations}
          onClose={() => setEditor(undefined)}
          onSave={save}
          onLocation={async (name) => {
            const location = await repository.createLocation(name);
            setLocations(await repository.locations());
            return location;
          }}
        />
      )}
      {deleting && (
        <DeleteDialog
          item={deleting}
          busy={deleteBusy}
          onClose={() => setDeleting(null)}
          onDelete={async () => {
            setDeleteBusy(true);
            try {
              await repository.remove(deleting.id, deleting.version);
              setDeleting(null);
              setNotice("Item deleted.");
              setAnswer(null);
              await refresh();
            } catch (cause) {
              setDeleting(null);
              setError(
                cause instanceof Error
                  ? cause.message
                  : "Unable to delete item.",
              );
            } finally {
              setDeleteBusy(false);
            }
          }}
        />
      )}
    </div>
  );
}

function DeleteDialog({
  item,
  busy,
  onClose,
  onDelete,
}: {
  item: Item;
  busy: boolean;
  onClose: () => void;
  onDelete: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className="delete-dialog"
      onCancel={onClose}
      aria-labelledby="delete-title"
    >
      <h2 id="delete-title">DELETE {item.name}?</h2>
      <p>
        This removes the item and its observation history. Mark it disposed in
        the editor if you want to keep a record.
      </p>
      <div className="dialog-actions">
        <button className="secondary" onClick={onClose}>
          KEEP ITEM
        </button>
        <button className="danger" disabled={busy} onClick={onDelete}>
          {busy ? "DELETING..." : "DELETE ITEM"}
        </button>
      </div>
    </dialog>
  );
}

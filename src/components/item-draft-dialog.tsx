"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { itemContentInput, type Location } from "@/lib/inventory";
import { locationPath } from "@/lib/containers";
import type { VisualItem } from "./use-inventory-store";
import styles from "./liquid-dashboard.module.css";

export function ItemDraftDialog({
  draft,
  items,
  locations,
  placeNames,
  onCancel,
  onAdd,
}: {
  draft: VisualItem;
  items: VisualItem[];
  locations: Location[];
  placeNames: string[];
  onCancel: () => void;
  onAdd: (item: VisualItem) => Promise<string | undefined>;
}) {
  const [value, setValue] = useState(draft);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const dialog = useRef<HTMLDivElement>(null);
  const container = draft.kind === "container";
  const destination = value.parent_container_id
    ? items
        .find((item) => item.id === value.parent_container_id)
        ?.location_path?.join(" → ")
    : locations.find((place) => place.id === value.location_id)
      ? locationPath(
          locations.find((place) => place.id === value.location_id)!,
          locations,
        ).join(" → ")
      : value.location_name;
  useEffect(() => {
    const overflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    dialog.current?.querySelector<HTMLInputElement>("input")?.focus();
    return () => {
      document.documentElement.style.overflow = overflow;
    };
  }, []);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    if (!value.name.trim()) {
      setError("Name is required");
      dialog.current?.querySelector<HTMLInputElement>("input")?.focus();
      return;
    }
    const parsed = itemContentInput.safeParse({
      name: value.name,
      kind: value.kind,
      description: value.description,
      category: value.category,
      quantity: value.quantity,
      unit: value.unit,
      status: value.status,
      condition: value.condition,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message || "Check the item details.");
      return;
    }
    submitting.current = true;
    setSaving(true);
    setError("");
    try {
      const failure = await onAdd({ ...value, ...parsed.data });
      if (failure) {
        setError(failure);
        if (failure.startsWith("Choose"))
          dialog.current?.querySelector<HTMLSelectElement>("select")?.focus();
      }
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not confirm the save. Check inventory before retrying.",
      );
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }
  return (
    <div className={styles.placeOverlay}>
      <div
        ref={dialog}
        className={styles.placeDialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="draft-title"
        onKeyDown={(event) => {
          if (event.key === "Escape" && !saving) {
            event.stopPropagation();
            onCancel();
          }
          if (event.key === "Tab") {
            const controls = [
              ...event.currentTarget.querySelectorAll<HTMLElement>(
                "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled)",
              ),
            ];
            const first = controls[0],
              last = controls.at(-1);
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last?.focus();
            }
            if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <h2 id="draft-title">Add {container ? "container" : "item"}</h2>
        <p className={styles.draftHint}>
          Unsaved draft · nothing is created until you choose Add.
        </p>
        <p className={styles.draftHint}>
          Destination:{" "}
          {destination || "Choose a space, room, or container before adding."}
        </p>
        <form onSubmit={submit} noValidate>
          <fieldset disabled={saving} className={styles.draftFields}>
            <label>
              Name
              <input
                value={value.name}
                maxLength={160}
                required
                onChange={(event) =>
                  setValue({ ...value, name: event.target.value })
                }
              />
            </label>
            <label>
              Location
              <select
                value={
                  value.parent_container_id
                    ? `container:${value.parent_container_id}`
                    : `location:${value.location_id ?? value.location_name ?? ""}`
                }
                onChange={(event) => {
                  const choice = event.target.value;
                  if (choice.startsWith("container:")) {
                    const parent = items.find(
                      (item) => item.id === choice.slice(10),
                    );
                    setValue({
                      ...value,
                      parent_container_id: parent?.id ?? null,
                      location_id: null,
                      location_name: parent?.location_name ?? null,
                    });
                  } else {
                    const key = choice.slice(9);
                    const place = locations.find((entry) => entry.id === key);
                    const name = place?.name ?? key;
                    setValue({
                      ...value,
                      parent_container_id: null,
                      location_id: place?.id ?? null,
                      location_name: name || null,
                    });
                  }
                }}
              >
                <option value="location:">Choose a space or room</option>
                {locations.length
                  ? locations.map((place) => (
                      <option key={place.id} value={`location:${place.id}`}>
                        {locationPath(place, locations).join(" → ")}
                      </option>
                    ))
                  : placeNames.map((name) => (
                      <option key={name} value={`location:${name}`}>
                        {name}
                      </option>
                    ))}
                {items
                  .filter((item) => item.kind === "container")
                  .map((item) => (
                    <option key={item.id} value={`container:${item.id}`}>
                      {item.location_path?.join(" → ") || item.name}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Category
              <input
                value={value.category}
                maxLength={80}
                onChange={(event) =>
                  setValue({ ...value, category: event.target.value })
                }
              />
            </label>
            {!container && (
              <label>
                Type
                <select
                  value={value.kind}
                  onChange={(event) =>
                    setValue({
                      ...value,
                      kind: event.target.value as VisualItem["kind"],
                      quantity: 1,
                    })
                  }
                >
                  <option value="durable">Durable item</option>
                  <option value="consumable">Consumable</option>
                </select>
              </label>
            )}
            {value.kind === "consumable" && (
              <label>
                Quantity
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={value.quantity}
                  onChange={(event) =>
                    setValue({ ...value, quantity: Number(event.target.value) })
                  }
                />
              </label>
            )}
            <label>
              Notes
              <textarea
                value={value.description}
                maxLength={2000}
                onChange={(event) =>
                  setValue({ ...value, description: event.target.value })
                }
              />
            </label>
            {error && (
              <p role="alert" className={styles.placeError}>
                {error}
              </p>
            )}
            <div className={styles.placeDialogActions}>
              <button
                type="button"
                className={styles.dialogCancel}
                onClick={onCancel}
              >
                Cancel
              </button>
              <button type="submit" className={styles.dialogCreate}>
                {saving ? "Adding…" : container ? "Add container" : "Add item"}
              </button>
            </div>
          </fieldset>
        </form>
      </div>
    </div>
  );
}

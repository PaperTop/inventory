"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Close } from "pixelarticons/react";
import {
  conditions,
  itemInput,
  statuses,
  type Item,
  type ItemInput,
  type Location,
} from "@/lib/inventory";
export function ItemForm({
  item,
  locations,
  onClose,
  onSave,
  onLocation,
}: {
  item: Item | null;
  locations: Location[];
  onClose: () => void;
  onSave: (input: ItemInput) => Promise<void>;
  onLocation: (name: string) => Promise<Location>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [kind, setKind] = useState(item?.kind ?? "durable");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [location, setLocation] = useState(item?.location_id ?? "");
  const [locationName, setLocationName] = useState("");
  useEffect(() => {
    dialog.current?.showModal();
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      const form = new FormData(event.currentTarget);
      const threshold = form.get("reorder_threshold") as string;
      const input = itemInput.parse({
        name: form.get("name"),
        description: form.get("description"),
        category: form.get("category"),
        kind,
        quantity: kind === "durable" ? 1 : Number(form.get("quantity")),
        unit: kind === "durable" ? "item" : form.get("unit"),
        reorder_threshold:
          kind === "consumable" && threshold !== "" ? Number(threshold) : null,
        location_id: location || null,
        tags: String(form.get("tags"))
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        status: form.get("status"),
        condition: form.get("condition"),
        attributes: JSON.parse(String(form.get("attributes") || "{}")),
      });
      await onSave(input);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to save item.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={dialog}
      className="item-dialog"
      onCancel={onClose}
      aria-labelledby="editor-title"
    >
      <div className="dialog-heading">
        <div>
          <p className="eyebrow">YOUR INVENTORY</p>
          <h2 id="editor-title">
            {item ? "Edit item" : "A place for something new"}
          </h2>
        </div>
        <button
          className="icon-button"
          aria-label="Close editor"
          onClick={onClose}
        >
          <Close width={20} height={20} />
        </button>
      </div>
      <form onSubmit={submit}>
        <label>
          Item name
          <input
            autoFocus
            name="name"
            required
            maxLength={160}
            defaultValue={item?.name}
            placeholder="e.g. USB-C charger"
          />
        </label>
        <div className="form-grid">
          <label>
            Type
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as typeof kind)}
            >
              <option value="durable">Durable · one possession</option>
              <option value="consumable">Consumable · track stock</option>
            </select>
          </label>
          <label>
            Category
            <input
              name="category"
              maxLength={80}
              defaultValue={item?.category}
              placeholder="e.g. Electronics"
            />
          </label>
        </div>
        {kind === "consumable" && (
          <div className="form-grid three">
            <label>
              Quantity
              <input
                name="quantity"
                type="number"
                min="0"
                max="1000000000"
                step="any"
                required
                defaultValue={item?.quantity ?? 1}
              />
            </label>
            <label>
              Unit
              <input
                name="unit"
                required
                maxLength={30}
                defaultValue={item?.unit ?? "bottle"}
              />
            </label>
            <label>
              Low-stock at
              <input
                name="reorder_threshold"
                type="number"
                min="0"
                max="1000000000"
                step="any"
                defaultValue={item?.reorder_threshold ?? ""}
                placeholder="Optional"
              />
            </label>
          </div>
        )}
        <label>
          Location
          <select
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          >
            <option value="">No location set</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </label>
        <div className="location-add">
          <input
            aria-label="New location name"
            value={locationName}
            maxLength={100}
            onChange={(e) => setLocationName(e.target.value)}
            placeholder="Or create a location"
          />
          <button
            type="button"
            className="secondary"
            disabled={!locationName.trim() || busy}
            onClick={async () => {
              setBusy(true);
              setError("");
              try {
                const l = await onLocation(locationName.trim());
                setLocation(l.id);
                setLocationName("");
              } catch (e) {
                setError(
                  e instanceof Error ? e.message : "Unable to create location.",
                );
              } finally {
                setBusy(false);
              }
            }}
          >
            Create location
          </button>
        </div>
        <div className="form-grid">
          <label>
            Status
            <select name="status" defaultValue={item?.status ?? "active"}>
              {statuses.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Condition
            <select
              name="condition"
              defaultValue={item?.condition ?? "unknown"}
            >
              {conditions.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
        </div>
        <label>
          Tags <span className="muted">· separated by commas</span>
          <input
            name="tags"
            defaultValue={item?.tags.join(", ")}
            placeholder="travel, work, everyday"
          />
        </label>
        <label>
          Notes
          <textarea
            name="description"
            maxLength={2000}
            rows={2}
            defaultValue={item?.description}
            placeholder="Anything you want to remember about it"
          />
        </label>
        <details>
          <summary>Flexible attributes</summary>
          <p className="help">
            Optional JSON object for details such as color, model, or expiry
            date.
          </p>
          <textarea
            aria-label="Attributes JSON"
            name="attributes"
            rows={3}
            defaultValue={JSON.stringify(item?.attributes ?? {}, null, 2)}
          />
        </details>
        {error && (
          <p role="alert" className="error">
            {error}
          </p>
        )}
        <div className="dialog-actions">
          <button type="button" className="secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            {busy ? "Saving…" : item ? "Save changes" : "Add item"}
          </button>
        </div>
      </form>
    </dialog>
  );
}

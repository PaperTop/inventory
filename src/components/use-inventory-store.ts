"use client";

import { useEffect, useRef, useState } from "react";
import { apiRepository } from "@/lib/browser-api";
import { uploadInventoryPhoto } from "@/lib/browser-photos";
import { itemInput, type Item, type Location } from "@/lib/inventory";
import { resolveHierarchy, validatePlacement } from "@/lib/containers";
import { privatePhotoPath, privatePhotoSource } from "@/lib/photos";
import {
  prepareInventoryChanges,
  type InventoryChange,
  type ChangeOutcome,
} from "@/lib/inventory-changes";

export type VisualItem = Item & { image: string };
export function visualItem(item: Item): VisualItem {
  const path = item.attributes.image_path;
  const privatePath = privatePhotoPath(path, item.user_id);
  return {
    ...item,
    image: privatePath
      ? privatePhotoSource(item.id, privatePath)
      : typeof path === "string" &&
          /^\/inventory-assets\/[a-z0-9-]+\.(png|svg|webp)$/.test(path)
        ? path
        : item.kind === "container"
          ? "/inventory-assets/container.svg"
          : "/inventory-assets/item.svg",
  };
}
export function inputOf(item: Item) {
  const {
    name,
    kind,
    description,
    category,
    quantity,
    unit,
    reorder_threshold,
    location_id,
    parent_container_id,
    tags,
    status,
    condition,
    attributes,
  } = item;
  return itemInput.parse({
    name,
    kind,
    description,
    category,
    quantity,
    unit,
    reorder_threshold,
    location_id,
    parent_container_id: parent_container_id ?? null,
    tags,
    status,
    condition,
    attributes,
  });
}

export function useInventoryStore(
  initial: VisualItem[],
  locations: Location[],
  persisted: boolean,
) {
  const [items, setItems] = useState(() =>
    resolveHierarchy(initial, locations),
  );
  const current = useRef(resolveHierarchy(initial, locations)),
    saved = useRef(new Map(initial.map((item) => [item.id, item])));
  const [pending, setPending] = useState(0),
    pendingRef = useRef(0);
  const [error, setError] = useState("");
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const generation = useRef(0);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    const lifecycleGeneration = generation;
    return () => {
      mounted.current = false;
      lifecycleGeneration.current++;
    };
  }, []);
  const pendingEdits = useRef<
    {
      key: symbol;
      id: string;
      changes: Partial<VisualItem>;
    }[]
  >([]);
  function replace(rows: VisualItem[], nextLocations = locations) {
    const resolved = resolveHierarchy(rows, nextLocations);
    current.current = resolved;
    setItems(resolved);
  }
  function load(rows: VisualItem[], nextLocations = locations) {
    saved.current = new Map(rows.map((row) => [row.id, row]));
    replace(rows, nextLocations);
  }
  function confirm(result: VisualItem, completed?: symbol) {
    saved.current.set(result.id, result);
    pendingEdits.current = pendingEdits.current.filter(
      (edit) => edit.key !== completed,
    );
    // A response confirms only its own write. Reapply newer optimistic edits
    // instead of replacing the visible row with an older server snapshot.
    const visible = pendingEdits.current
      .filter((edit) => edit.id === result.id)
      .reduce(
        (row, edit) => ({ ...row, ...edit.changes, version: row.version + 1 }),
        result,
      );
    replace(
      current.current.map((row) => (row.id === result.id ? visible : row)),
    );
  }
  async function refresh(ensureActive: () => void) {
    const rows = (await apiRepository.list("")).map(visualItem);
    ensureActive();
    saved.current = new Map(rows.map((row) => [row.id, row]));
    replace(rows);
  }
  function run<T>(
    operation: (ensureActive: () => void) => Promise<T>,
  ): Promise<T | undefined> {
    if (!mounted.current) return Promise.resolve(undefined);
    const token = generation.current;
    const ensureActive = () => {
      if (!mounted.current || token !== generation.current)
        throw new Error("This inventory session has ended.");
    };
    pendingRef.current++;
    setPending(pendingRef.current);
    setError("");
    const next = queue.current
      .then(async () => {
        if (!mounted.current || token !== generation.current) return undefined;
        try {
          return await operation(ensureActive);
        } catch (e) {
          if (!mounted.current || token !== generation.current)
            return undefined;
          generation.current++;
          pendingEdits.current = [];
          const message =
            e instanceof Error ? e.message : "Could not save this change.";
          setError(
            message +
              " Your change was not confirmed. Reload saved inventory before trying again.",
          );
          replace([...saved.current.values()]);
          return undefined;
        } finally {
          // Invalidated operations are decremented below as well.
        }
      })
      .finally(() => {
        pendingRef.current--;
        if (mounted.current) setPending(pendingRef.current);
      });
    queue.current = next;
    return next;
  }
  useEffect(() => {
    if (!pending) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [pending]);

  function patch(id: string, changes: Partial<VisualItem>) {
    if (!mounted.current) return;
    const existing = current.current.find((row) => row.id === id);
    if (!existing) return;
    const next = {
      ...existing,
      ...changes,
      updated_at: new Date().toISOString(),
      version: existing.version + 1,
    };
    try {
      validatePlacement(next, current.current);
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    replace(
      resolveHierarchy(
        current.current.map((row) => (row.id === id ? next : row)),
        locations,
      ),
    );
    if (!persisted) return next;
    const key = Symbol();
    pendingEdits.current.push({ key, id, changes });
    return run(async (ensureActive) => {
      const base = saved.current.get(id);
      if (!base) throw new Error("Item no longer exists. Reload inventory.");
      const result = visualItem(
        await apiRepository.update(
          id,
          base.version,
          inputOf({ ...base, ...changes }),
        ),
      );
      ensureActive();
      confirm(result, key);
      return current.current.find((row) => row.id === id);
    });
  }
  async function savePhoto(id: string, file: File) {
    if (!persisted) {
      setError(
        "Sign in to save photos. Sample photos last for this session only.",
      );
      return;
    }
    return run(async (ensureActive) => {
      // Resolve after earlier queued writes complete; preserve their fields and
      // use their confirmed version when attaching the newly uploaded object.
      const base = saved.current.get(id);
      if (!base) throw new Error("Item no longer exists. Reload inventory.");
      const path = await uploadInventoryPhoto(file, base.user_id);
      ensureActive();
      const result = visualItem(
        await apiRepository.update(
          id,
          base.version,
          inputOf({
            ...base,
            attributes: { ...base.attributes, image_path: path },
          }),
        ),
      );
      // Retain uploaded objects on ambiguous save failures: the write may have
      // committed even if its response was lost. Never remove a referenced photo.
      ensureActive();
      confirm(result);
      return result;
    });
  }
  async function create(item: VisualItem) {
    if (!mounted.current) return;
    try {
      validatePlacement(item, current.current);
    } catch (e) {
      setError((e as Error).message);
      return;
    }
    if (!persisted) {
      replace(resolveHierarchy([item, ...current.current], locations));
      return item;
    }
    return run(async (ensureActive) => {
      const created = visualItem(await apiRepository.create(inputOf(item)));
      ensureActive();
      saved.current.set(created.id, created);
      replace(resolveHierarchy([created, ...current.current], locations));
      return created;
    });
  }
  async function remove(id: string) {
    if (!mounted.current) return false;
    if (current.current.some((item) => item.parent_container_id === id)) {
      setError("Move the contents out before deleting this container.");
      return false;
    }
    if (!persisted) {
      replace(current.current.filter((item) => item.id !== id));
      return true;
    }
    return run(async (ensureActive) => {
      const item = saved.current.get(id);
      if (!item) throw new Error("Item no longer exists.");
      await apiRepository.remove(id, item.version);
      ensureActive();
      saved.current.delete(id);
      replace(current.current.filter((item) => item.id !== id));
      return true;
    });
  }
  async function applyChanges(
    changes: InventoryChange[],
    expectedVersions: Record<string, number>,
    placeNames: string[],
  ): Promise<ChangeOutcome> {
    const completed: Item[] = [];
    const messages: string[] = [];
    try {
      if (pendingRef.current)
        throw new Error(
          "Wait for the current inventory changes to finish, then ask Jarvis again.",
        );
      const prepared = prepareInventoryChanges(
        changes,
        current.current,
        locations,
        placeNames,
        expectedVersions,
      );
      for (const change of prepared) {
        const previous = current.current.find(
          (row) => row.id === change.item.id,
        );
        if (
          change.type === "update" &&
          previous?.version !== change.item.version - 1
        )
          throw new Error(
            "An item changed before it could be saved. Ask Jarvis again.",
          );
        const result =
          change.type === "create"
            ? await create(visualItem(change.item))
            : await patch(change.item.id, {
                ...change.item,
                image: previous!.image,
              });
        if (!result)
          throw new Error(
            "The inventory change could not be saved. Reload inventory before trying again.",
          );
        const actual =
          current.current.find((row) => row.id === result.id) ?? result;
        completed.push(actual);
        messages.push(
          `${change.type === "create" ? "Added" : "Updated"} ${actual.name}.`,
        );
      }
      return { items: completed, summary: messages.join("\n") };
    } catch (error) {
      return {
        items: completed,
        summary: messages.length
          ? messages.join("\n") + "\nThe remaining changes were not applied."
          : "No items were changed.",
        error:
          error instanceof Error
            ? error.message
            : "Could not save inventory changes.",
      };
    }
  }
  return {
    items,
    setItems: (value: VisualItem[] | ((rows: VisualItem[]) => VisualItem[])) =>
      replace(typeof value === "function" ? value(current.current) : value),
    load,
    patch,
    create,
    remove,
    savePhoto,
    applyChanges,
    pending,
    error,
    reload: () => run(refresh),
  };
}

"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import type { AskResult } from "@/lib/ask";
import type { Location } from "@/lib/inventory";
import { contentsApi } from "@/lib/browser-api";
import {
  inventoryContents,
  type InventoryResult,
  type InventoryScope,
  type InventoryScopeChoice,
} from "@/lib/inventory-scope";
import type { VisualItem } from "./use-inventory-store";
import styles from "./inventory-dashboard.module.css";

export function JarvisInventoryResults({
  result,
  items,
  locations,
  saved,
  onSelect,
}: {
  result: AskResult;
  items: VisualItem[];
  locations: Location[];
  saved: boolean;
  onSelect: (id: string) => void;
}) {
  const [page, setPage] = useState(result.inventoryResult);
  const [records, setRecords] = useState(
    result.inventoryResult?.items ?? result.citations,
  );
  const [error, setError] = useState("");
  const [chosenScope, setChosenScope] = useState<InventoryScopeChoice>();
  const [loading, setLoading] = useState(false);
  const pending = useRef(false);
  async function load(scope: InventoryScope, offset: number) {
    if (pending.current) return;
    pending.current = true;
    setLoading(true);
    setError("");
    try {
      const next: InventoryResult = saved
        ? await contentsApi(scope, offset, offset ? page?.revision : undefined)
        : inventoryContents(
            items,
            locations,
            scope,
            offset,
            offset ? page?.revision : undefined,
          );
      if (
        next.offset !== offset ||
        (next.nextOffset !== null && next.nextOffset <= offset)
      )
        throw new Error("The result page did not advance. Try loading again.");
      setRecords((current) =>
        offset === 0
          ? next.items
          : [
              ...new Map(
                [...current, ...next.items].map((record) => [
                  record.id,
                  record,
                ]),
              ).values(),
            ],
      );
      setPage(next);
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure.message
          : "Could not load the next results. Your current results are kept.",
      );
    } finally {
      pending.current = false;
      setLoading(false);
    }
  }
  return (
    <div className={styles.inventoryResult}>
      {!page && result.scopeChoices?.length && (
        <div>
          <p>Choose the exact location:</p>
          {result.scopeChoices.map((scope) => (
            <button
              key={`${scope.type}:${scope.id}`}
              disabled={loading}
              aria-pressed={
                chosenScope?.id === scope.id && chosenScope.type === scope.type
              }
              onClick={() => {
                setChosenScope(scope);
                void load(scope, 0);
              }}
            >
              {scope.path.join(" → ") || scope.name}
            </button>
          ))}
        </div>
      )}
      {!page && chosenScope && (
        <p>
          Selected scope: {chosenScope.path.join(" → ") || chosenScope.name}
        </p>
      )}
      {page && (
        <div className={styles.resultSummary}>
          <strong>{page.scope.path.join(" → ") || page.scope.name}</strong>
          <p>
            Showing {records.length} of {page.total} inventory records ·
            includes all descendant rooms and containers within this scope.
          </p>
          <p role="status">
            {page.nextOffset === null && records.length === page.total
              ? "All results loaded."
              : "More results available."}
          </p>
        </div>
      )}
      <div className={styles.assistantResults}>
        {records.map((item) => {
          const current = items.find((row) => row.id === item.id);
          return (
            <button
              key={item.id}
              type="button"
              aria-label={`Open ${item.name}`}
              disabled={!current}
              onClick={() => onSelect(item.id)}
            >
              <Image
                src={current?.image ?? "/inventory-assets/item.svg"}
                alt=""
                width={40}
                height={40}
                unoptimized
              />
              <span>
                <strong>{item.name}</strong>
                <span>
                  {item.quantity} {item.unit} ·{" "}
                  {("location_path" in item && Array.isArray(item.location_path)
                    ? item.location_path.slice(0, -1).join(" → ")
                    : item.location_name) || "No location"}
                </span>
                <span>
                  {item.status}
                  {item.condition === "poor" ? " · poor condition" : ""}
                  {!current ? " · Not in the current inventory" : ""}
                </span>
              </span>
            </button>
          );
        })}
      </div>
      {page?.total === 0 && <p>No records in this scope.</p>}
      {error && (
        <p role="alert" className={styles.assistantNotice}>
          {error}
        </p>
      )}
      {error && page && (
        <button
          type="button"
          className={styles.loadResults}
          disabled={loading}
          onClick={() => void load(page.scope, 0)}
        >
          Restart results
        </button>
      )}
      {error && !page && chosenScope && (
        <button
          type="button"
          className={styles.loadResults}
          disabled={loading}
          onClick={() => void load(chosenScope, 0)}
        >
          Retry selected location
        </button>
      )}
      {page?.nextOffset !== null && page?.nextOffset !== undefined && (
        <button
          className={styles.loadResults}
          type="button"
          disabled={loading}
          onClick={() => void load(page.scope, page.nextOffset!)}
        >
          {loading
            ? "Loading…"
            : error
              ? `Retry loading (${Math.max(0, page.total - records.length)} remaining)`
              : `Load more (${Math.max(0, page.total - records.length)} remaining)`}
        </button>
      )}
      {loading && <p role="status">Loading inventory results…</p>}
    </div>
  );
}

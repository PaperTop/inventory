"use client";

import Image from "next/image";
import { type ReactNode } from "react";
import {
  Armchair,
  ArrowRight,
  Bathtub,
  Bed,
  CookingPot,
  Garage,
  MapPin,
  Sparkle,
} from "@phosphor-icons/react";
import type { DashboardActivity, DashboardBriefing } from "@/lib/dashboard";
import type { VisualItem } from "./use-inventory-store";
import styles from "./inventory-dashboard.module.css";

function relativeTime(value: string, asOf: string) {
  const elapsed = Math.max(
    0,
    new Date(asOf).getTime() - new Date(value).getTime(),
  );
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function roomIcon(name: string) {
  const normalized = name.toLowerCase();
  if (normalized.includes("bed")) return <Bed weight="duotone" />;
  if (normalized.includes("bath")) return <Bathtub weight="duotone" />;
  if (normalized.includes("kitchen")) return <CookingPot weight="duotone" />;
  if (normalized.includes("living")) return <Armchair weight="duotone" />;
  if (normalized.includes("garage") || normalized.includes("car"))
    return <Garage weight="duotone" />;
  return <MapPin weight="duotone" />;
}

function activityCopy(activity: DashboardActivity) {
  const verb = {
    created: "Added",
    updated: "Updated",
    moved: "Moved",
    deleted: "Removed",
  }[activity.kind];
  if (activity.kind === "moved" && activity.detail?.startsWith("Moved to "))
    return `Moved ${activity.itemName} ${activity.detail.slice("Moved ".length)}`;
  return `${activity.detail ?? verb} ${activity.itemName}`;
}

function ActivityRow({
  activity,
  asOf,
  item,
  sample,
  onSelectItem,
}: {
  activity: DashboardActivity;
  asOf: string;
  item?: VisualItem;
  sample: boolean;
  onSelectItem: (id: string) => void;
}) {
  const content = (
    <>
      <span className={styles.thumbnail} aria-hidden="true">
        <Image
          src={item?.image ?? "/inventory-assets/item.svg"}
          alt=""
          width={64}
          height={64}
          unoptimized={item?.image.startsWith("/api/items/")}
        />
      </span>
      <span className={styles.activityCopy}>
        <strong>{activityCopy(activity)}</strong>
        <span>
          {sample
            ? "Sample data"
            : activity.actor === "jarvis"
              ? "via Jarvis"
              : "by you"}
        </span>
      </span>
      <time dateTime={activity.occurredAt}>
        {relativeTime(activity.occurredAt, asOf)}
      </time>
    </>
  );

  return item ? (
    <button
      type="button"
      className={styles.activityRow}
      onClick={() => onSelectItem(item.id)}
      aria-label={`${activityCopy(activity)}. Open ${item.name}`}
    >
      {content}
    </button>
  ) : (
    <div className={styles.activityRow}>{content}</div>
  );
}

function DashboardSkeleton() {
  return (
    <div
      className={styles.loading}
      role="status"
      aria-label="Loading dashboard"
    >
      <span className={styles.loadingLine} />
      <span className={styles.loadingLine} />
      <div className={styles.loadingGroups}>
        <span />
        <span />
      </div>
    </div>
  );
}

export function InventoryDashboard({
  briefing,
  items,
  accountEmail,
  sample = false,
  loading = false,
  error = "",
  mobileNavigation,
  conversation,
  onRetry,
  onAsk,
  onSelectItem,
}: {
  briefing: DashboardBriefing | null;
  items: VisualItem[];
  accountEmail?: string;
  sample?: boolean;
  loading?: boolean;
  error?: string;
  mobileNavigation?: ReactNode;
  conversation?: (suggestion: ReactNode) => ReactNode;
  onRetry?: () => void;
  onAsk: (prompt: string) => void;
  onSelectItem: (id: string) => void;
}) {
  const localName = accountEmail
    ?.split("@")[0]
    ?.split(/[._-]/)[0]
    ?.replace(/^./, (character) => character.toUpperCase());
  const suggestion = briefing?.suggestion && (
    <div className={styles.suggestion}>
      <Sparkle weight="duotone" aria-hidden="true" />
      <div>
        <p>
          {briefing.suggestion.text}{" "}
          <button
            type="button"
            onClick={() => onAsk(briefing.suggestion!.prompt)}
          >
            Plan together <ArrowRight weight="bold" />
          </button>
        </p>
        <span>Starts a conversation · no changes made.</span>
      </div>
    </div>
  );

  return (
    <section className={styles.dashboard} aria-labelledby="dashboard-title">
      <div className={styles.mobileHeader}>{mobileNavigation}</div>
      <header className={styles.intro}>
        <p className={styles.eyebrow}>
          {sample
            ? "Sample inventory"
            : localName
              ? `Welcome back, ${localName}`
              : "Welcome back"}
        </p>
        <h1 id="dashboard-title">Your inventory, in brief.</h1>
        {!loading && briefing && (
          <p className={styles.summary}>{briefing.summary}</p>
        )}
      </header>

      {loading ? (
        <DashboardSkeleton />
      ) : error ? (
        <div className={styles.errorState} role="alert">
          <strong>Recent activity is unavailable.</strong>
          <span>{error}</span>
          {onRetry && (
            <button type="button" onClick={onRetry}>
              Try again
            </button>
          )}
        </div>
      ) : briefing?.groups.length ? (
        <div className={styles.activityGroups} aria-label="Recent activity">
          {briefing.groups.map((group) => (
            <section
              className={styles.activityGroup}
              key={group.room.id ?? group.room.name}
            >
              <h2>
                {roomIcon(group.room.name)}
                <span>{group.room.name}</span>
              </h2>
              <div>
                {group.activities.map((activity) => (
                  <ActivityRow
                    activity={activity}
                    asOf={briefing.asOf}
                    item={items.find((item) => item.id === activity.itemId)}
                    key={activity.id}
                    sample={sample}
                    onSelectItem={onSelectItem}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <Sparkle weight="duotone" />
          <div>
            <strong>No recent activity yet</strong>
            <span>
              Add or update an item and the latest changes will appear here.
            </span>
          </div>
        </div>
      )}

      <div className={styles.actions}>
        {conversation ? conversation(suggestion) : suggestion}
      </div>
    </section>
  );
}

"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { CaretDown, Check } from "@phosphor-icons/react";
import styles from "./glass-select.module.css";

type Option<T> = { value: T; label: string };

export function GlassSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  icon,
  compact = false,
  onFocus,
}: {
  label: string;
  value: T;
  options: readonly Option<T>[];
  onChange: (value: T) => void;
  icon?: ReactNode;
  compact?: boolean;
  onFocus?: () => void;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const selected = Math.max(
    0,
    options.findIndex((option) => option.value === value),
  );

  useEffect(() => {
    if (!open) return;
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);

  function choose(index: number) {
    if (!options[index]) return;
    onChange(options[index].value);
    setOpen(false);
    trigger.current?.focus();
  }

  return (
    <div
      ref={root}
      className={`${styles.dropdown} ${compact ? styles.compact : ""}`}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }}
    >
      <button
        ref={trigger}
        type="button"
        disabled={options.length === 0}
        role="combobox"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        className={styles.trigger}
        onFocus={onFocus}
        onClick={() => {
          setActive(selected);
          setOpen(!open);
        }}
        onKeyDown={(event) => {
          if (["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) {
            event.preventDefault();
            setOpen(true);
            setActive(
              event.key === "Home"
                ? 0
                : event.key === "End"
                  ? options.length - 1
                  : !open
                    ? selected
                    : (active +
                        (event.key === "ArrowDown" ? 1 : -1) +
                        options.length) %
                      options.length,
            );
          } else if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (open) choose(active);
            else {
              setActive(selected);
              setOpen(true);
            }
          } else if (event.key === "Escape") {
            event.preventDefault();
            setOpen(false);
          } else if (
            event.key.length === 1 &&
            !event.ctrlKey &&
            !event.metaKey &&
            !event.altKey
          ) {
            const match = options.findIndex((option) =>
              option.label.toLowerCase().startsWith(event.key.toLowerCase()),
            );
            if (match !== -1) {
              event.preventDefault();
              setActive(match);
              setOpen(true);
            }
          }
        }}
      >
        <span className={styles.leading} aria-hidden="true">
          {icon ?? label}
        </span>
        <span className={styles.value}>
          {options[selected]?.label ?? "None available"}
        </span>
        <CaretDown
          className={styles.chevron}
          aria-hidden="true"
          weight="bold"
        />
      </button>
      {open && (
        <div id={id} role="listbox" aria-label={label} className={styles.panel}>
          {options.map((option, index) => (
            <button
              key={option.value}
              id={`${id}-${index}`}
              type="button"
              role="option"
              aria-selected={value === option.value}
              tabIndex={-1}
              className={`${styles.option} ${active === index ? styles.active : ""}`}
              onPointerMove={() => setActive(index)}
              onClick={() => choose(index)}
            >
              <span>{option.label}</span>
              {value === option.value && (
                <Check weight="bold" aria-hidden="true" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

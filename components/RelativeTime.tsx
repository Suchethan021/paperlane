"use client";

import { useSyncExternalStore } from "react";

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000_000],
  ["month", 2_592_000_000],
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
];

function relative(iso: string, now: number): string {
  const diff = Date.parse(iso) - now;
  const abs = Math.abs(diff);
  if (abs < 45_000) return "just now";

  const fmt = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  for (const [unit, ms] of UNITS) {
    if (abs >= ms) return fmt.format(Math.round(diff / ms), unit);
  }
  return "just now";
}

/** Re-render once a minute; that's the finest granularity the label shows. */
function subscribe(onChange: () => void): () => void {
  const id = setInterval(onChange, 60_000);
  return () => clearInterval(id);
}

/** Bucketed to the minute so the snapshot is stable between renders. */
const clientSnapshot = () => Math.floor(Date.now() / 60_000);
const serverSnapshot = () => null;

/**
 * Renders an absolute date on the server and a relative one in the browser.
 *
 * Formatting relative time during SSR guarantees a hydration mismatch, because
 * the server and the browser never share a clock tick. `useSyncExternalStore` is
 * the right primitive here rather than an effect that calls setState: it gives
 * React an explicit server snapshot, so the first client render already agrees
 * with the server markup.
 */
export function RelativeTime({ value }: { value: string }) {
  const minute = useSyncExternalStore(subscribe, clientSnapshot, serverSnapshot);

  const label =
    minute === null ? value.slice(0, 10) : relative(value, minute * 60_000);

  return (
    <time dateTime={value} suppressHydrationWarning>
      {label}
    </time>
  );
}

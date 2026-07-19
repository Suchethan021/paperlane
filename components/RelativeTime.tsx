"use client";

import { useEffect, useState } from "react";

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000_000],
  ["month", 2_592_000_000],
  ["day", 86_400_000],
  ["hour", 3_600_000],
  ["minute", 60_000],
];

function relative(iso: string): string {
  const diff = Date.parse(iso) - Date.now();
  const abs = Math.abs(diff);
  if (abs < 45_000) return "just now";

  const fmt = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  for (const [unit, ms] of UNITS) {
    if (abs >= ms) return fmt.format(Math.round(diff / ms), unit);
  }
  return "just now";
}

/**
 * Renders an absolute date on the server and swaps to "3 minutes ago" after
 * mount. Formatting relative time during SSR guarantees a hydration mismatch,
 * because the server and the browser never share a clock tick.
 */
export function RelativeTime({ value }: { value: string }) {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    setLabel(relative(value));
    const id = setInterval(() => setLabel(relative(value)), 60_000);
    return () => clearInterval(id);
  }, [value]);

  return (
    <time dateTime={value} title={new Date(value).toLocaleString()}>
      {label ?? value.slice(0, 10)}
    </time>
  );
}

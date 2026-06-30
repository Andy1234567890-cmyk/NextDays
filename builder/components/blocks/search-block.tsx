// Such-Block — elegante Pill-Leiste (Airbnb-Niveau, eigenständig). Navigiert mit
// ?q=&start=&end=&guests= (wird vom properties_grid-Block der Seite ausgewertet).
"use client";

import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { pickText } from "@/lib/i18n";

export function SearchBlock({ content }: { content: Record<string, unknown> }) {
  const router = useRouter();
  const placeholder = pickText(content.placeholder) || "Reiseziel suchen";
  const showGuests = content.show_guests !== false;
  const showDates = content.show_dates !== false;

  const [q, setQ] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [guests, setGuests] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (showDates && start) params.set("start", start);
    if (showDates && end) params.set("end", end);
    if (showGuests && guests) params.set("guests", guests);
    const qs = params.toString();
    router.push(qs ? `/?${qs}` : "/");
  }

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <form
        onSubmit={submit}
        className="flex flex-col items-stretch gap-2 rounded-3xl border border-border bg-card p-2 shadow-lg shadow-black/5 sm:flex-row sm:items-center sm:rounded-full"
      >
        <label className="flex flex-1 items-center gap-2 px-4 py-2">
          <Icon icon="ph:magnifying-glass" className="size-5 shrink-0 text-muted-foreground" />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={placeholder}
            className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
        </label>

        {showDates ? (
          <div className="flex items-center gap-2 border-border px-2 sm:border-l">
            <label className="flex items-center gap-1.5 px-2 text-sm">
              <Icon icon="ph:calendar-blank" className="size-4 text-muted-foreground" />
              <input
                type="date"
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className="bg-transparent text-sm outline-none"
                aria-label="Von"
              />
            </label>
            <span className="text-muted-foreground">–</span>
            <input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="bg-transparent px-2 text-sm outline-none"
              aria-label="Bis"
            />
          </div>
        ) : null}

        {showGuests ? (
          <label className="flex items-center gap-1.5 border-border px-4 text-sm sm:border-l">
            <Icon icon="ph:user" className="size-4 text-muted-foreground" />
            <input
              type="number"
              min={1}
              value={guests}
              onChange={(e) => setGuests(e.target.value)}
              placeholder="Gäste"
              className="w-16 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </label>
        ) : null}

        <button
          type="submit"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-primary px-7 py-3 text-sm font-semibold text-primary-foreground transition hover:opacity-90"
        >
          <Icon icon="ph:magnifying-glass" className="size-4" />
          Suchen
        </button>
      </form>
    </div>
  );
}

// Such-Block: schlanke Reiseziel/Datum/Gäste-Suche, die mit ?q=&guests=&start=
// &end= navigiert (wird vom properties_grid-Block der Seite ausgewertet). Ersetzt
// die feste Marktplatz-Suchleiste durch einen konfigurierbaren Block.
"use client";

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
    <form
      onSubmit={submit}
      className="mx-auto flex max-w-4xl flex-wrap items-end gap-3 px-6 py-6"
    >
      <label className="flex flex-1 flex-col gap-1 text-sm">
        <span className="font-medium">Wohin</span>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder}
          className="rounded-full border border-border px-4 py-2"
        />
      </label>
      {showDates ? (
        <>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Von</span>
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              className="rounded-full border border-border px-4 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">Bis</span>
            <input
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              className="rounded-full border border-border px-4 py-2"
            />
          </label>
        </>
      ) : null}
      {showGuests ? (
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">Gäste</span>
          <input
            type="number"
            min={1}
            value={guests}
            onChange={(e) => setGuests(e.target.value)}
            className="w-24 rounded-full border border-border px-4 py-2"
          />
        </label>
      ) : null}
      <button
        type="submit"
        className="rounded-full bg-primary px-6 py-2 text-sm font-medium text-primary-foreground"
      >
        Suchen
      </button>
    </form>
  );
}

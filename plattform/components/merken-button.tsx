// „Merken"-Button auf der Inserat-Detailseite: fügt das Objekt einer Merkliste
// des eingeloggten Gastes hinzu (Popover mit Listenauswahl + Schnell-Anlegen).
// Nicht eingeloggt → Link zu /anmelden.
"use client";

import { Icon } from "@iconify/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import {
  type WishlistSummary,
  erstelleMerkliste,
  fuegeItemHinzu,
  ladeMerkzettel,
} from "@/lib/guest-wishlist";

export function MerkenButton({
  propertyId,
  eingeloggt,
}: {
  propertyId: string;
  eingeloggt: boolean;
}) {
  const [offen, setOffen] = useState(false);
  const [lists, setLists] = useState<WishlistSummary[] | null>(null);
  const [neu, setNeu] = useState("");
  const [busy, setBusy] = useState(false);
  const [gemerkt, setGemerkt] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function klickAussen(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOffen(false);
      }
    }
    document.addEventListener("mousedown", klickAussen);
    return () => document.removeEventListener("mousedown", klickAussen);
  }, []);

  async function oeffnen() {
    setOffen((o) => !o);
    setFehler(null);
    if (lists === null) {
      const res = await ladeMerkzettel();
      if (res.ok) setLists(res.data.items);
      else setFehler(res.error);
    }
  }

  async function hinzufuegen(wishlistId: string) {
    setBusy(true);
    setFehler(null);
    const res = await fuegeItemHinzu(wishlistId, propertyId);
    setBusy(false);
    if (res.ok) {
      setGemerkt(wishlistId);
      setOffen(false);
    } else {
      setFehler(res.error);
    }
  }

  async function anlegenUndMerken(e: React.FormEvent) {
    e.preventDefault();
    const name = neu.trim();
    if (!name || busy) return;
    setBusy(true);
    setFehler(null);
    const res = await erstelleMerkliste(name);
    if (!res.ok) {
      setBusy(false);
      setFehler(res.error);
      return;
    }
    setLists((l) => [res.data, ...(l ?? [])]);
    setNeu("");
    await hinzufuegen(res.data.id);
  }

  if (!eingeloggt) {
    return (
      <Link
        href={`/anmelden?weiter=/inserat/${propertyId}`}
        className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-secondary"
      >
        <Icon icon="ph:heart" className="size-4" />
        Merken
      </Link>
    );
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={oeffnen}
        className="flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-secondary"
      >
        <Icon
          icon={gemerkt ? "ph:heart-fill" : "ph:heart"}
          className={"size-4" + (gemerkt ? " text-accent" : "")}
        />
        {gemerkt ? "Gemerkt" : "Merken"}
      </button>

      {offen && (
        <div className="absolute right-0 top-full z-40 mt-2 w-64 rounded-2xl border border-border bg-card p-3 shadow-lg">
          <p className="px-1 pb-2 text-sm font-medium">In Merkliste speichern</p>
          {fehler && (
            <p className="mb-2 rounded-lg bg-accent/10 px-2 py-1.5 text-xs text-accent">
              {fehler}
            </p>
          )}
          <div className="max-h-48 overflow-y-auto">
            {lists === null ? (
              <div className="flex items-center gap-2 px-1 py-3 text-sm text-muted-foreground">
                <Icon icon="ph:spinner" className="size-4 animate-spin" />
                Lädt…
              </div>
            ) : lists.length === 0 ? (
              <p className="px-1 py-2 text-xs text-muted-foreground">
                Noch keine Liste — leg unten eine an.
              </p>
            ) : (
              lists.map((l) => (
                <button
                  key={l.id}
                  type="button"
                  disabled={busy}
                  onClick={() => hinzufuegen(l.id)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-secondary disabled:opacity-60"
                >
                  <Icon icon="ph:heart" className="size-4 text-muted-foreground" />
                  <span className="flex-1 truncate">{l.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {l.item_count}
                  </span>
                </button>
              ))
            )}
          </div>
          <form
            onSubmit={anlegenUndMerken}
            className="mt-2 flex gap-2 border-t border-border pt-2"
          >
            <input
              value={neu}
              onChange={(e) => setNeu(e.target.value)}
              placeholder="Neue Liste"
              className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm outline-none focus:border-ring"
            />
            <button
              type="submit"
              disabled={busy || !neu.trim()}
              aria-label="Anlegen"
              className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
            >
              <Icon icon="ph:plus" className="size-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

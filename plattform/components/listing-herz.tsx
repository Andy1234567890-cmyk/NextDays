// Merken-Herz auf der Inserat-Karte (oben rechts) — funktional wie das große
// merken-button.tsx, nur kompakt als rundes Overlay. Liegt visuell in der Karte,
// die selbst ein <Link> ist: der Klick wird gestoppt (kein Navigieren) und öffnet
// ein kleines Listen-Popover. Nicht eingeloggt → Weiterleitung zu /anmelden.
"use client";

import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import {
  type WishlistSummary,
  erstelleMerkliste,
  fuegeItemHinzu,
  ladeMerkzettel,
} from "@/lib/guest-wishlist";

export function ListingHerz({
  propertyId,
  eingeloggt,
}: {
  propertyId: string;
  eingeloggt: boolean;
}) {
  const router = useRouter();
  const [offen, setOffen] = useState(false);
  const [lists, setLists] = useState<WishlistSummary[] | null>(null);
  const [neu, setNeu] = useState("");
  const [busy, setBusy] = useState(false);
  const [gemerkt, setGemerkt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function klickAussen(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOffen(false);
    }
    document.addEventListener("mousedown", klickAussen);
    return () => document.removeEventListener("mousedown", klickAussen);
  }, []);

  function stop(e: React.MouseEvent) {
    // In der Karte liegt ein <Link> — Klick auf das Herz darf NICHT navigieren.
    e.preventDefault();
    e.stopPropagation();
  }

  async function oeffnen(e: React.MouseEvent) {
    stop(e);
    if (!eingeloggt) {
      router.push(`/anmelden?weiter=/inserat/${propertyId}`);
      return;
    }
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
      setGemerkt(true);
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

  return (
    <div ref={ref} className="absolute right-2 top-2 sm:right-3 sm:top-3" onClick={stop}>
      {/* Trefferfläche und Optik getrennt: der Knopf ist 40 px (Touch-Größe —
          das Herz liegt auf einem Link, der beim Danebentippen die Detailseite
          öffnet statt zu merken), der sichtbare Kreis nur 36 px. Bei ~155 px
          Kartenbreite nimmt ein 40-px-Kreis sonst ein Viertel des Bildes ein. */}
      <button
        type="button"
        onClick={oeffnen}
        aria-label={gemerkt ? "Gemerkt" : "Merken"}
        className="flex size-10 items-center justify-center md:size-9"
      >
        <span className="flex size-9 items-center justify-center rounded-full bg-black/25 text-white backdrop-blur-sm transition group-hover:bg-black/40">
          <Icon
            icon={gemerkt ? "ph:heart-fill" : "ph:heart"}
            className={"size-5" + (gemerkt ? " text-accent" : "")}
          />
        </span>
      </button>

      {offen && (
        <div className="absolute right-0 top-full z-40 mt-2 w-60 max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-card p-3 text-foreground shadow-lg">
          <p className="px-1 pb-2 text-sm font-medium">In Merkliste speichern</p>
          {fehler && (
            <p className="mb-2 rounded-lg bg-accent/10 px-2 py-1.5 text-xs text-accent">
              {fehler}
            </p>
          )}
          <div className="max-h-44 overflow-y-auto">
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
              className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground disabled:opacity-50 md:size-8"
            >
              <Icon icon="ph:plus" className="size-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

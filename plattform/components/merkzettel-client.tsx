// Merkzettel (Client-Insel): Listen anlegen/löschen, Objekte je Liste anzeigen
// (Property-Karten mit bookable-Badge + „ab"-Preis) und entfernen.
"use client";

import { Icon } from "@iconify/react";
import Link from "next/link";
import { useEffect, useState } from "react";

import {
  type WishlistDetail,
  type WishlistSummary,
  entferneItem,
  erstelleMerkliste,
  ladeMerkliste,
  loescheMerkliste,
} from "@/lib/guest-wishlist";
import { formatCurrency } from "@/lib/listings";

export function MerkzettelClient({
  initialLists,
}: {
  initialLists: WishlistSummary[];
}) {
  const [lists, setLists] = useState<WishlistSummary[]>(initialLists);
  const [aktivId, setAktivId] = useState<string | null>(
    initialLists[0]?.id ?? null,
  );
  const [detail, setDetail] = useState<WishlistDetail | null>(null);
  const [ladeDetail, setLadeDetail] = useState(false);
  const [neueListe, setNeueListe] = useState("");
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    if (!aktivId) {
      setDetail(null);
      return;
    }
    let aktiv = true;
    setLadeDetail(true);
    (async () => {
      const res = await ladeMerkliste(aktivId);
      if (!aktiv) return;
      setLadeDetail(false);
      if (res.ok) setDetail(res.data);
    })();
    return () => {
      aktiv = false;
    };
  }, [aktivId]);

  async function anlegen(e: React.FormEvent) {
    e.preventDefault();
    const name = neueListe.trim();
    if (!name || busy) return;
    setBusy(true);
    setFehler(null);
    const res = await erstelleMerkliste(name);
    setBusy(false);
    if (res.ok) {
      setLists((l) => [res.data, ...l]);
      setAktivId(res.data.id);
      setNeueListe("");
    } else {
      setFehler(res.error);
    }
  }

  async function listeLoeschen(id: string) {
    const res = await loescheMerkliste(id);
    if (res.ok) {
      setLists((l) => l.filter((x) => x.id !== id));
      if (aktivId === id) {
        const rest = lists.filter((x) => x.id !== id);
        setAktivId(rest[0]?.id ?? null);
      }
    } else {
      setFehler(res.error);
    }
  }

  async function itemEntfernen(propertyId: string) {
    if (!aktivId || !detail) return;
    const res = await entferneItem(aktivId, propertyId);
    if (res.ok) {
      setDetail({
        ...detail,
        items: detail.items.filter((i) => i.property_id !== propertyId),
      });
      setLists((l) =>
        l.map((x) =>
          x.id === aktivId
            ? { ...x, item_count: Math.max(0, x.item_count - 1) }
            : x,
        ),
      );
    } else {
      setFehler(res.error);
    }
  }

  return (
    <div className="flex flex-col gap-5 sm:gap-6">
      {/* Neue Liste */}
      <form onSubmit={anlegen} className="flex flex-col gap-2 sm:flex-row">
        <input
          value={neueListe}
          onChange={(e) => setNeueListe(e.target.value)}
          placeholder="Neue Merkliste (z. B. Sommer 2026)"
          className="min-h-12 w-full rounded-full border border-border bg-card px-4 text-base outline-none focus:border-ring sm:min-h-0 sm:py-2.5 sm:text-sm"
        />
        <button
          type="submit"
          disabled={busy || !neueListe.trim()}
          className="flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60 sm:min-h-0 sm:py-2.5"
        >
          <Icon icon="ph:plus" className="size-4" />
          Anlegen
        </button>
      </form>

      {fehler && (
        <p className="rounded-xl bg-accent/10 px-3 py-2 text-sm text-accent">
          {fehler}
        </p>
      )}

      {lists.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card p-6 text-center sm:p-12">
          <span className="flex size-14 items-center justify-center rounded-2xl bg-accent/10 text-accent">
            <Icon icon="ph:heart" className="size-7" />
          </span>
          <p className="text-sm text-muted-foreground">
            Du hast noch keine Merklisten. Lege oben deine erste an.
          </p>
        </div>
      ) : (
        <>
          {/* Listen-Chips */}
          <div className="band-scroll -mx-4 flex snap-x gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
            {lists.map((l) => (
              <div
                key={l.id}
                className={
                  "group flex min-h-11 shrink-0 snap-start items-center gap-2 whitespace-nowrap rounded-full border px-4 text-sm transition-colors " +
                  (l.id === aktivId
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-card hover:bg-secondary")
                }
              >
                <button
                  type="button"
                  onClick={() => setAktivId(l.id)}
                  className="flex items-center gap-2 font-medium"
                >
                  <Icon icon="ph:heart" className="size-4" />
                  {l.name}
                  <span
                    className={
                      l.id === aktivId
                        ? "text-primary-foreground/70"
                        : "text-muted-foreground"
                    }
                  >
                    {l.item_count}
                  </span>
                </button>
                <button
                  type="button"
                  aria-label="Liste löschen"
                  onClick={() => listeLoeschen(l.id)}
                  className={
                    "flex size-8 items-center justify-center rounded-full opacity-60 hover:opacity-100 " +
                    (l.id === aktivId ? "" : "text-muted-foreground")
                  }
                >
                  <Icon icon="ph:x" className="size-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Items der aktiven Liste */}
          {ladeDetail ? (
            <div className="flex items-center gap-2 py-10 text-muted-foreground">
              <Icon icon="ph:spinner" className="size-5 animate-spin" />
              Lädt…
            </div>
          ) : detail && detail.items.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
              {detail.items.map((item) => (
                <div key={item.property_id} className="group flex flex-col gap-3">
                  <div className="relative aspect-square overflow-hidden rounded-2xl bg-secondary">
                    <Link href={`/inserat/${item.property_id}`}>
                      {item.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.photo}
                          alt={item.title}
                          className="size-full object-cover transition-transform group-hover:scale-105"
                        />
                      ) : (
                        <span className="flex size-full items-center justify-center text-muted-foreground">
                          <Icon icon="ph:image" className="size-8" />
                        </span>
                      )}
                    </Link>
                    <button
                      type="button"
                      aria-label="Aus Merkzettel entfernen"
                      onClick={() => itemEntfernen(item.property_id)}
                      className="absolute right-3 top-3 flex size-11 items-center justify-center rounded-full bg-card/95 text-accent shadow-sm hover:bg-card md:size-8"
                    >
                      <Icon icon="ph:heart-fill" className="size-4" />
                    </button>
                    {!item.bookable && (
                      <span className="absolute left-3 top-3 rounded-full bg-card/95 px-3 py-1 text-xs font-semibold text-muted-foreground">
                        Nicht buchbar
                      </span>
                    )}
                  </div>
                  <div>
                    <Link
                      href={`/inserat/${item.property_id}`}
                      className="font-medium leading-snug hover:underline"
                    >
                      {item.title}
                    </Link>
                    <p className="text-sm text-muted-foreground">
                      {[item.city, item.country].filter(Boolean).join(", ") ||
                        "—"}
                    </p>
                    {item.price_from != null ? (
                      <p className="mt-0.5 text-sm">
                        <span className="font-semibold">
                          {formatCurrency(item.price_from, item.currency)}
                        </span>{" "}
                        <span className="text-muted-foreground">Nacht</span>
                      </p>
                    ) : (
                      <p className="mt-0.5 text-sm text-muted-foreground">
                        Preis auf Anfrage
                      </p>
                    )}
                    {item.note && (
                      <p className="mt-1 text-sm italic text-muted-foreground">
                        „{item.note}"
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card p-6 text-center sm:p-12">
              <span className="flex size-14 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                <Icon icon="ph:heart-break" className="size-7" />
              </span>
              <p className="text-sm text-muted-foreground">
                Diese Liste ist noch leer. Merke dir Unterkünfte über das
                Herz-Symbol.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

"use client";

// Kachelliste der Unterkünfte (.. „Unterkünfte"): Suchfeld + Karten mit
// Titelbild, Objektname und Ort. Klick → Objektfläche mit den sechs Reitern.
// Live über useRealtime auf properties (neue/geänderte Objekte ohne Reload).
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useRealtime } from "@/lib/use-realtime";

type PropertyCard = {
  id: string;
  title: string;
  city: string | null;
  photo: string | null;
};

export function PropertyGrid({ items }: { items: PropertyCard[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");

  // Neue/geänderte/gelöschte Objekte → Server-Component neu laden (die Liste
  // kommt serverseitig, deshalb router.refresh statt lokalem State).
  useRealtime({ table: "properties", onChange: () => router.refresh() });

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        (p.city ?? "").toLowerCase().includes(q),
    );
  }, [items, query]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold">Unterkünfte</h1>
        <div className="relative w-full max-w-md">
          <Icon
            icon="ph:magnifying-glass"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Unterkünfte suchen …"
            className="pl-9"
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <Card className="p-10 text-center text-sm text-muted-foreground">
          {items.length === 0
            ? "Noch keine Unterkünfte angelegt."
            : "Keine Unterkunft passt zur Suche."}
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {rows.map((p) => (
            <Link
              key={p.id}
              href={`/reservierungen/unterkuenfte/${p.id}/kalender`}
              className="group flex flex-col overflow-hidden rounded-2xl border bg-card transition-shadow hover:shadow-md"
            >
              <div className="relative aspect-[4/3] w-full overflow-hidden bg-secondary">
                {p.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.photo}
                    alt=""
                    className="size-full object-cover transition-transform group-hover:scale-105"
                  />
                ) : (
                  <span className="flex size-full items-center justify-center text-muted-foreground">
                    <Icon icon="ph:house-line" className="size-10" />
                  </span>
                )}
                <span className="absolute inset-x-0 top-0 bg-gradient-to-b from-black/60 to-transparent px-3 py-2 font-display text-sm font-bold text-white">
                  {p.title}
                </span>
              </div>
              <div className="p-3">
                {p.city ? (
                  <p className="text-sm text-muted-foreground">
                    Gelegen in <span className="font-semibold text-foreground">{p.city}</span>
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">Kein Ort hinterlegt</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

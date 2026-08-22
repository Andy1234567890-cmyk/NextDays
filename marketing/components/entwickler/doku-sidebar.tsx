"use client";

// Linke Spalte — zwei Gestalten, je nach Bereich.
//
// Referenz-UX: docs.lodgify.com (ReadMe.io), live abgelesen am 22.08.2026.
//   · Im Leitfaden („Documentation") stehen Gruppen mit Überschrift und
//     darunter die Seiten. Keine Methoden-Abzeichen, keine Aufklapp-Pfeile.
//   · In der Referenz („API Reference") steht je Bereich eine aufklappbare
//     Gruppe („Show subpages for Reservations"), darin die Endpunkte mit
//     Methoden-Abzeichen. Die Gruppe des offenen Endpunkts ist offen, die
//     anderen sind zu — bei über 40 Endpunkten in zehn Bereichen ist das der
//     Unterschied zwischen einer Liste und einer Wand.
//
// Beides in EINER Komponente, weil beide dieselbe Suche, dasselbe
// Tastenkürzel und dieselbe Hervorhebung des offenen Eintrags brauchen.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

import { RefMethode } from "@/components/entwickler/ref-methode";
import { Icon } from "@/components/ui/icon";

export type SidebarEintrag = {
  slug: string;
  methode: string;
  pfad: string;
  titel: string;
};

export type SidebarGruppe = {
  name: string;
  endpunkte: SidebarEintrag[];
};

export type SidebarKapitelGruppe = {
  label: string;
  kapitel: { slug: string; label: string }[];
};

export function DokuSidebar({
  bereich,
  kapitelGruppen,
  gruppen,
  labels,
}: {
  bereich: "doku" | "referenz";
  kapitelGruppen: SidebarKapitelGruppe[];
  gruppen: SidebarGruppe[];
  labels: {
    sprung: string;
    keineTreffer: string;
    /** Überschrift über dem Endpunkt-Baum, z. B. „Öffentliche API v1". */
    version: string;
  };
}) {
  const pfadname = usePathname();
  const [suche, setSuche] = useState("");
  const feld = useRef<HTMLInputElement>(null);

  // ⌘/ bzw. Strg+/ setzt den Fokus ins Sprungfeld — dasselbe Kürzel wie bei
  // ReadMe. Bewusst NICHT ⌘K: das ist in den meisten Browsern die Adresszeile.
  useEffect(() => {
    function taste(e: KeyboardEvent) {
      if (e.key === "/" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        feld.current?.focus();
        feld.current?.select();
      }
    }
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, []);

  const begriff = suche.trim().toLowerCase();

  const gefilterteGruppen = useMemo(() => {
    if (!begriff) return gruppen;
    return gruppen
      .map((g) => ({
        ...g,
        // Gesucht wird über Titel, Pfad UND Methode: wer „post reservations"
        // eingibt, meint einen Endpunkt, nicht einen Titel.
        endpunkte: g.endpunkte.filter((e) =>
          `${e.methode} ${e.pfad} ${e.titel} ${g.name}`
            .toLowerCase()
            .includes(begriff),
        ),
      }))
      .filter((g) => g.endpunkte.length > 0);
  }, [gruppen, begriff]);

  const gefilterteKapitel = useMemo(() => {
    if (!begriff) return kapitelGruppen;
    return kapitelGruppen
      .map((g) => ({
        ...g,
        kapitel: g.kapitel.filter((k) =>
          k.label.toLowerCase().includes(begriff),
        ),
      }))
      .filter((g) => g.kapitel.length > 0);
  }, [kapitelGruppen, begriff]);

  const leer =
    bereich === "doku"
      ? gefilterteKapitel.length === 0
      : gefilterteGruppen.length === 0;

  return (
    <nav
      aria-label={labels.sprung}
      className="flex h-full flex-col gap-5 overflow-y-auto border-r border-border bg-surface-warm/40 px-4 py-5"
    >
      <label className="relative block">
        <Icon
          icon="ph:magnifying-glass"
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <input
          ref={feld}
          type="search"
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
          placeholder={labels.sprung}
          className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-12 text-sm outline-none placeholder:text-muted-foreground focus:border-accent"
        />
        <kbd className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-border px-1.5 py-0.5 font-mono text-[0.625rem] text-muted-foreground">
          ⌘/
        </kbd>
      </label>

      {leer ? (
        <p className="px-1 text-sm text-muted-foreground">{labels.keineTreffer}</p>
      ) : null}

      {bereich === "doku"
        ? gefilterteKapitel.map((gruppe) => (
            <div key={gruppe.label}>
              <p className="px-1 text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground">
                {gruppe.label}
              </p>
              <ul className="mt-2 flex flex-col gap-0.5">
                {gruppe.kapitel.map((k) => {
                  const ziel = k.slug ? `/entwickler/${k.slug}` : "/entwickler";
                  const aktiv = pfadname === ziel;
                  return (
                    <li key={k.slug || "start"}>
                      <Link
                        href={ziel}
                        aria-current={aktiv ? "page" : undefined}
                        className={
                          "block rounded-lg px-2 py-1.5 text-sm transition-colors " +
                          (aktiv
                            ? "bg-surface-accent font-medium text-accent"
                            : "text-muted-foreground hover:bg-background hover:text-foreground")
                        }
                      >
                        {k.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))
        : [
            <p
              key="version"
              className="border-b border-border px-1 pb-3 font-display text-sm font-semibold"
            >
              {labels.version}
            </p>,
            ...gefilterteGruppen.map((gruppe) => (
                <ReferenzGruppe
                key={gruppe.name}
                gruppe={gruppe}
                pfadname={pfadname}
                // Beim Suchen sind alle Treffer-Gruppen offen: sonst müsste
                // man nach einer Suche noch aufklappen, um das Gefundene zu
                // sehen.
                erzwungenOffen={Boolean(begriff)}
              />
            )),
          ]}
    </nav>
  );
}

function ReferenzGruppe({
  gruppe,
  pfadname,
  erzwungenOffen,
}: {
  gruppe: SidebarGruppe;
  pfadname: string;
  erzwungenOffen: boolean;
}) {
  const enthaeltAktiv = gruppe.endpunkte.some(
    (e) => pfadname === `/entwickler/referenz/${e.slug}`,
  );
  const [offen, setOffen] = useState(enthaeltAktiv);

  // Die Gruppe des offenen Endpunkts geht auf, auch wenn man über einen Link
  // aus dem Text dorthin springt.
  useEffect(() => {
    if (enthaeltAktiv) setOffen(true);
  }, [enthaeltAktiv]);

  const sichtbar = offen || erzwungenOffen;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOffen((a) => !a)}
        aria-expanded={sichtbar}
        className="flex w-full items-center gap-1.5 rounded-lg px-1 py-1 text-left text-[0.6875rem] font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:text-foreground"
      >
        <Icon
          icon="ph:caret-right"
          className={
            "size-3 transition-transform " + (sichtbar ? "rotate-90" : "")
          }
        />
        {gruppe.name}
      </button>
      {sichtbar ? (
        <ul className="mt-1 flex flex-col gap-0.5">
          {gruppe.endpunkte.map((e) => {
            const ziel = `/entwickler/referenz/${e.slug}`;
            const aktiv = pfadname === ziel;
            return (
              <li key={e.slug}>
                <Link
                  href={ziel}
                  aria-current={aktiv ? "page" : undefined}
                  className={
                    "flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors " +
                    (aktiv
                      ? "bg-surface-accent font-medium text-accent"
                      : "text-muted-foreground hover:bg-background hover:text-foreground")
                  }
                >
                  <RefMethode methode={e.methode} />
                  <span className="truncate">{e.titel}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

"use client";

// Ausstattungs-Abschnitt der Inserat-Seite („Das bietet dir diese Unterkunft").
// Airbnb-Muster: erst zehn Merkmale, darunter „Alle N Ausstattungsmerkmale
// anzeigen" — eine Liste mit 27 Zeilen schiebt sonst Beschreibung und Lage aus
// dem Blick.
//
// Die Labels kommen aus den Katalogen (lib/ausstattung.ts); Merkmale ohne Label
// erscheinen NICHT (kein roher Slug für den Gast).
import { Icon } from "@iconify/react";
import { useState } from "react";
import { useTranslations } from "next-intl";

import { ausstattungZeilen } from "@/lib/ausstattung";

const ZEIGE_ZUERST = 10;

export function AusstattungListe({ slugs }: { slugs: readonly string[] }) {
  const t = useTranslations();
  const tInserat = useTranslations("inserat");
  const [alle, setAlle] = useState(false);

  const zeilen = ausstattungZeilen(t, slugs);
  if (zeilen.length === 0) return null;

  const sichtbar = alle ? zeilen : zeilen.slice(0, ZEIGE_ZUERST);

  return (
    <div className="border-b border-border py-6">
      <h2 className="font-display text-xl font-semibold">
        {tInserat("ausstattungTitel")}
      </h2>
      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {sichtbar.map((a) => (
          <div key={a.slug} className="flex items-center gap-3">
            <Icon icon={a.icon} className="size-5 shrink-0" />
            <span>{a.label}</span>
          </div>
        ))}
      </div>
      {zeilen.length > ZEIGE_ZUERST && (
        <button
          type="button"
          onClick={() => setAlle((v) => !v)}
          className="mt-6 rounded-lg border border-foreground px-6 py-3 text-sm font-medium transition-colors hover:bg-secondary"
        >
          {alle
            ? tInserat("ausstattungWeniger")
            : tInserat("ausstattungAlle", { count: zeilen.length })}
        </button>
      )}
    </div>
  );
}

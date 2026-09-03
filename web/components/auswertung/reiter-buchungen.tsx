"use client";

// Reiter „Buchungen" — Hostaways `Rental Activity`.
//
// Die Spaltenwahl sitzt wie dort als Zahnrad rechts neben der letzten Spalte.
// Die Auswahl überlebt den Seitenwechsel (localStorage, pro Betrachter): eine
// Tabelle mit zehn Spalten, die sich bei jedem Aufruf zurücksetzt, wird nicht
// benutzt. Wie bei Hostaway ist die Auswahl BENUTZERSACHE, nicht Kontosache.
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";

import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import { Checkbox } from "@nextdays/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@nextdays/ui/dropdown-menu";
import { formatCurrency } from "@/lib/currency";
import type { Auswertung, BuchungZeile } from "@/lib/auswertung-typen";

import { VergleichHinweis } from "./vergleich-delta";

const SPALTEN = [
  "property",
  "guest",
  "channel",
  "stay",
  "nights",
  "guests",
  "status",
  "revenue",
  "commission",
  "bookedAt",
] as const;
type Spalte = (typeof SPALTEN)[number];

const VORGABE: Spalte[] = [
  "property",
  "channel",
  "stay",
  "nights",
  "guests",
  "status",
  "revenue",
];

const RECHTS: readonly string[] = ["nights", "guests", "revenue", "commission"];

const SPEICHER = "auswertung.buchungen.spalten";

export function ReiterBuchungen({ a }: { a: Auswertung }) {
  const t = useTranslations("analysis");
  const [sichtbar, setSichtbar] = useState<Spalte[]>(VORGABE);

  // Erst nach dem Mounten lesen: `localStorage` gibt es beim Serverrendern
  // nicht, und ein abweichender erster Rendergang wäre ein Hydration-Fehler.
  useEffect(() => {
    try {
      const roh = window.localStorage.getItem(SPEICHER);
      if (!roh) return;
      const geparst: unknown = JSON.parse(roh);
      if (Array.isArray(geparst)) {
        const gueltig = geparst.filter((s): s is Spalte =>
          SPALTEN.includes(s as Spalte),
        );
        if (gueltig.length) setSichtbar(gueltig);
      }
    } catch {
      // Privater Modus, gesperrte Site-Daten, kaputter Eintrag: Vorgabe
      // behalten. Eine Spaltenauswahl ist kein Grund, die Seite zu verlieren.
    }
  }, []);

  function umschalten(s: Spalte) {
    setSichtbar((alt) => {
      const next = alt.includes(s) ? alt.filter((x) => x !== s) : [...alt, s];
      try {
        window.localStorage.setItem(SPEICHER, JSON.stringify(next));
      } catch {
        // siehe oben — Speichern ist Komfort, kein Muss.
      }
      return next;
    });
  }

  const zeigt = useMemo(() => (s: Spalte) => sichtbar.includes(s), [sichtbar]);

  // Der Leerzustand meldet auch, was der Vorzeitraum hatte — „dieses Jahr
  // keine Buchungen, letztes Jahr 34" ist die Aussage, nicht bloß „leer".
  if (!a.buchungen.length) {
    return (
      <Card className="flex flex-col gap-1 p-8 text-center text-sm text-muted-foreground">
        <span>{t("empty")}</span>
        {a.vorher && (
          <span className="text-xs">
            {t("compareRowCount", {
              label: t(`compare.${a.vorher.vergleich}`),
              count: a.vorher.buchungen_gesamt,
            })}
          </span>
        )}
      </Card>
    );
  }

  const geld = (v: number | null, w: string | null) =>
    v === null || !w ? "—" : formatCurrency(v, w);

  const datum = (iso: string) => (iso ? new Date(iso).toLocaleDateString() : "—");

  return (
    <div className="flex flex-col gap-3">
      {a.vorher && (
        <VergleichHinweis
          vergleich={a.vorher.vergleich}
          von={a.vorher.von}
          bis={a.vorher.bis}
        />
      )}
    <Card className="overflow-hidden">
      {/* `min-w-0` links: ohne das schiebt die Zeilenzahl das Spalten-Menü
          auf schmalen Bildschirmen aus der Karte. */}
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <span className="flex min-w-0 flex-col text-sm text-muted-foreground">
          <span className="truncate">
            {t("table.rowCount", { count: a.buchungen.length })}
          </span>
          {a.vorher && (
            // Vom Vorzeitraum steht hier NUR die Summe. Seine Einzelbuchungen
            // gehören nicht in diese Tabelle: sie wären zwischen den aktuellen
            // nicht unterscheidbar (das Backend liefert sie deshalb gar nicht).
            <span className="truncate text-xs">
              {t("compareRowCount", {
                label: t(`compare.${a.vorher.vergleich}`),
                count: a.vorher.buchungen_gesamt,
              })}
            </span>
          )}
        </span>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <Icon icon="ph:gear" className="size-4" />
              {t("table.columns")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 p-2">
            {SPALTEN.map((s) => (
              <label
                key={s}
                className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
              >
                <Checkbox
                  checked={zeigt(s)}
                  onCheckedChange={() => umschalten(s)}
                />
                {t(`col.${s}`)}
              </label>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Waagerecht scrollbar in EIGENEM Behälter: die Seite selbst darf nie
          waagerecht scrollen. */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-muted/40 text-left">
            <tr>
              {SPALTEN.filter(zeigt).map((s) => (
                <th
                  key={s}
                  className={
                    "px-4 py-3 font-medium whitespace-nowrap " +
                    (RECHTS.includes(s) ? "text-right" : "")
                  }
                >
                  {t(`col.${s}`)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {a.buchungen.map((b: BuchungZeile) => (
              <tr key={b.id} className="border-b border-border last:border-0">
                {zeigt("property") && (
                  <td className="px-4 py-3">{b.property_title ?? "—"}</td>
                )}
                {zeigt("guest") && (
                  <td className="px-4 py-3">{b.guest_name ?? "—"}</td>
                )}
                {zeigt("channel") && (
                  <td className="px-4 py-3 whitespace-nowrap">
                    {b.ota_name || b.channel}
                    {b.is_owner_stay && (
                      // Eigennutzung sichtbar machen: Hostaway zählt Owner
                      // Stays still als Direktbuchung mit, was den Umsatz je
                      // Kanal verfälscht. Hier steht es dran.
                      <span className="ml-1.5 rounded-full bg-muted px-2 py-0.5 text-xs">
                        {t("ownerStay")}
                      </span>
                    )}
                  </td>
                )}
                {zeigt("stay") && (
                  <td className="px-4 py-3 whitespace-nowrap">
                    {datum(b.check_in)} – {datum(b.check_out)}
                  </td>
                )}
                {zeigt("nights") && (
                  <td className="px-4 py-3 text-right tabular-nums">
                    {b.naechte}
                  </td>
                )}
                {zeigt("guests") && (
                  <td className="px-4 py-3 text-right tabular-nums">
                    {b.gaeste ?? "—"}
                  </td>
                )}
                {zeigt("status") && <td className="px-4 py-3">{b.status}</td>}
                {zeigt("revenue") && (
                  <td className="px-4 py-3 text-right tabular-nums">
                    {geld(b.umsatz, b.currency)}
                  </td>
                )}
                {zeigt("commission") && (
                  <td className="px-4 py-3 text-right tabular-nums">
                    {geld(b.provision, b.currency)}
                  </td>
                )}
                {zeigt("bookedAt") && (
                  <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                    {/* Leer, wenn die Quelle keinen echten Zeitpunkt liefert —
                        nie unser Eingang als „gebucht am" (Wurzel 5b). */}
                    {b.booked_at ? datum(b.booked_at) : "—"}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
    </div>
  );
}

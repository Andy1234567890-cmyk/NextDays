"use client";

// Objekte-Reiter: welche Objekte auf der Kunden-Website erscheinen (0426).
//
// Die Achse gibt es seit 0159/0162 (`properties.listed_on_website`) — bisher nur
// verstreut in der Kanal-Karte des einzelnen Objekts. Hier stehen alle Objekte
// in EINER Liste, weil die Frage „was zeigt meine Website" eine Frage an die
// Website ist und nicht an jedes Objekt einzeln.
//
// Der Filter im Renderer fehlte übrigens komplett: `listed_on_website` wurde
// nirgends abgefragt, die Kunden-Website zeigte ALLE aktiven Objekte. Der
// Schalter war also eine Attrappe. Behoben in booking_engine/schaufenster.py.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";

import { Input } from "@nextdays/ui/input";
import type { CustomDomain } from "@/lib/site-config";
import type { Page } from "@/lib/site-pages";
import { type Property, updateProperty } from "@/lib/properties";

import { BaukastenRahmen } from "./rahmen";
import { EinstellungenKopf } from "./einstellungen/rahmen";

export function ObjekteAnsicht({
  pages,
  domains,
  properties,
}: {
  pages: Page[];
  domains: CustomDomain[];
  properties: Property[];
}) {
  const t = useTranslations("website");
  const [pending, start] = useTransition();
  const [suche, setSuche] = useState("");
  // Lokaler Stand je Objekt: der Schalter soll sofort umspringen, nicht erst
  // nach dem Server-Refresh. Nur die WIRKLICH geänderten IDs stehen darin —
  // der Rest kommt weiter aus den Server-Daten und bleibt damit aktuell.
  const [lokal, setLokal] = useState<Record<string, boolean>>({});

  const sichtbar = useMemo(() => {
    const nadel = suche.trim().toLowerCase();
    if (!nadel) return properties;
    return properties.filter(
      (p) =>
        p.title.toLowerCase().includes(nadel) ||
        p.id.toLowerCase().includes(nadel),
    );
  }, [properties, suche]);

  function anAus(p: Property, an: boolean) {
    setLokal((l) => ({ ...l, [p.id]: an }));
    start(async () => {
      const res = await updateProperty(p.id, { listed_on_website: an });
      if (!res.ok) {
        // Gegenzustand (Wurzel 1): schlägt das Speichern fehl, muss der Schalter
        // zurückspringen. Ohne das zeigt die Oberfläche einen Zustand, den die
        // Datenbank nicht hat — und der Kunde glaubt, es sei gespeichert.
        setLokal((l) => {
          const kopie = { ...l };
          delete kopie[p.id];
          return kopie;
        });
        toast.error(res.error);
      }
    });
  }

  const anzahlAn = properties.filter((p) => lokal[p.id] ?? p.listed_on_website)
    .length;

  return (
    <BaukastenRahmen
      pages={pages}
      domains={domains}
      breit
      inhalt={
        <div className="mx-auto flex max-w-3xl flex-col gap-6 p-4 md:p-6">
          <EinstellungenKopf
            titel={t("objekte.titel")}
            beschreibung={t("objekte.hinweis")}
          />

          <p className="rounded-(--radius) border border-border bg-secondary/40 p-4 text-sm">
            {t("objekte.anzahl", {
              an: anzahlAn,
              gesamt: properties.length,
            })}
          </p>

          {properties.length > 8 ? (
            <Input
              value={suche}
              onChange={(e) => setSuche(e.target.value)}
              placeholder={t("objekte.suchen")}
              aria-label={t("objekte.suchen")}
            />
          ) : null}

          {properties.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("objekte.keine")}
            </p>
          ) : (
            <ul className="divide-y divide-border rounded-(--radius) border border-border">
              {sichtbar.map((p) => {
                const an = lokal[p.id] ?? p.listed_on_website;
                // Nur aktive Objekte werden überhaupt verkauft. Bei einem
                // Entwurf ist der Schalter zwar setzbar, hat aber keine Wirkung
                // — das steht dann auch da, statt dass der Kunde rätselt.
                const aktiv = p.status === "active";
                return (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{p.title}</p>
                      {!aktiv ? (
                        <p className="flex items-center gap-1 pt-0.5 text-xs text-muted-foreground">
                          <Icon icon="ph:warning" className="size-3.5" />
                          {t("objekte.nichtAktiv")}
                        </p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={an}
                      aria-label={p.title}
                      disabled={pending}
                      onClick={() => anAus(p, !an)}
                      className={
                        "relative h-6 w-11 shrink-0 rounded-full transition disabled:opacity-60 " +
                        (an ? "bg-foreground" : "bg-border")
                      }
                    >
                      <span
                        className={
                          "absolute top-0.5 size-5 rounded-full bg-background transition-all " +
                          (an ? "left-[1.375rem]" : "left-0.5")
                        }
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      }
    />
  );
}

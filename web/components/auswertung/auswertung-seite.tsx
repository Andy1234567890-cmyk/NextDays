"use client";

// Die Auswertung — Filterleiste, Kennzahlen, sechs Reiter.
//
// EIN Abruf für fünf der sechs Reiter. Sie teilen Zeitraum, Bezug und
// Objektfilter, und ihre Zahlen müssen übereinstimmen; getrennte Abrufe je
// Reiter wären genau der Fehler, den Hostaway im September 2025 nachbessern
// musste („Einheitliche Zahlen auf allen Seiten" — vorher rechneten
// Analytics, Mietaktivität und Auslastung verschieden). Der Reiterwechsel
// löst dort KEINEN neuen Abruf aus, er blendet einen anderen Teil derselben
// Antwort ein.
//
// AUSNAHME „Kennzahlen": das am 30.08.2026 hierher gezogene Kontrollzentrum
// (vorher `/reservierungen/kontrollzentrum`). Es liest aus dem Slice
// `reservations` (`getTenantStats`), weil nur dieser Sparklines und den
// Vorperioden-Vergleich liefert. Es bekommt denselben Filterstand, damit
// beide Quellen denselben Zeitraum meinen.
//
// Solange zwei Quellen bestehen, dürfen sie einander nicht widersprechen:
// `occupancy_rate` rechnet im reservations-Slice gegen `Spanne × Objektzahl`
// und kennt weder gesperrte Tage noch Stop-Sell. Diese Kachel ist im Reiter
// „Kennzahlen" deshalb ausgeblendet — die Auslastung steht im eigenen Reiter
// und rechnet dort nach der Betreiber-Regel.
import { useCallback, useEffect, useState } from "react";
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";

import { Card } from "@nextdays/ui/card";
import { getAuswertung } from "@/lib/auswertung";
import type { Auswertung, Reiter } from "@/lib/auswertung-typen";

import { AuswertungNav } from "./auswertung-nav";
import {
  Filterleiste,
  vergleichMoeglich,
  type FilterStand,
} from "./filterleiste";
import { KennzahlKacheln } from "./kennzahl-kacheln";
import { ReiterAnalytics } from "./reiter-analytics";
import { ReiterAuslastung } from "./reiter-auslastung";
import { ReiterBuchungen } from "./reiter-buchungen";
import { ReiterGaeste } from "./reiter-gaeste";
import { ReiterKennzahlen } from "./reiter-kennzahlen";
import { ReiterKanaele } from "./reiter-kanaele";

/** Laufender Monat als Vorgabe — der Regelfall einer Auswertung. */
function laufenderMonat(): { von: string; bis: string } {
  const h = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return {
    von: iso(new Date(h.getFullYear(), h.getMonth(), 1)),
    bis: iso(new Date(h.getFullYear(), h.getMonth() + 1, 0)),
  };
}

export function AuswertungSeite({
  objekte,
  kanaele,
}: {
  objekte: readonly { value: string; label: string }[];
  kanaele: readonly { value: string; label: string }[];
}) {
  const t = useTranslations("analysis");
  const [stand, setStand] = useState<FilterStand>(() => ({
    ...laufenderMonat(),
    bezug: "anreise",
    propertyIds: [],
    channels: [],
    vergleich: "keiner",
  }));
  // Wird der Zeitraum über die Vergleichsgrenze hinaus verlängert, fällt der
  // Vergleich mit. Ohne das schickte die Seite einen Wert weiter, den das
  // Backend mit 422 abweist — die Filterleiste zeigt dann „kein Vergleich",
  // gesendet würde aber „1j". Zustand und Anzeige müssen dasselbe sagen.
  const setzenGeprueft = useCallback((s: FilterStand) => {
    setStand(
      vergleichMoeglich(s.von, s.bis) ? s : { ...s, vergleich: "keiner" },
    );
  }, []);

  const [reiter, setReiter] = useState<Reiter>("kennzahlen");
  const [daten, setDaten] = useState<Auswertung | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(true);

  const laden = useCallback(async (s: FilterStand) => {
    setLaedt(true);
    setFehler(null);
    const res = await getAuswertung({
      von: s.von,
      bis: s.bis,
      bezug: s.bezug,
      propertyIds: s.propertyIds,
      channels: s.channels,
      vergleich: s.vergleich,
    });
    if (res.ok) setDaten(res.data);
    else {
      setFehler(res.error);
      // Alte Zahlen stehen lassen wäre schlimmer als nichts: sie gehörten zu
      // einem anderen Filter und niemand sähe den Unterschied.
      setDaten(null);
    }
    setLaedt(false);
  }, []);

  useEffect(() => {
    void laden(stand);
  }, [laden, stand]);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-2xl font-extrabold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      <Filterleiste
        stand={stand}
        setzen={setzenGeprueft}
        objekte={objekte}
        kanaele={kanaele}
        laedt={laedt}
      />

      {fehler && (
        <Card className="flex items-center gap-2 p-4 text-sm text-destructive">
          <Icon icon="ph:warning-circle" className="size-4 shrink-0" />
          {fehler}
        </Card>
      )}

      {daten && (
        <KennzahlKacheln
          k={daten.kennzahlen}
          waehrungen={daten.waehrungen}
          vorher={daten.vorher}
        />
      )}

      <AuswertungNav aktiv={reiter} wechseln={setReiter} />

      {laedt && !daten ? (
        <Card className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
          <Icon icon="ph:spinner" className="size-4 animate-spin" />
          {t("loading")}
        </Card>
      ) : daten ? (
        <div className={laedt ? "opacity-60 transition-opacity" : undefined}>
          {/* Eigene Datenquelle (`getTenantStats`): Sparklines und
              Vorperioden-Vergleich liefert nur dieser Slice. Er bekommt den
              Filterstand, damit beide Quellen denselben Zeitraum meinen. */}
          {reiter === "kennzahlen" && <ReiterKennzahlen stand={stand} />}
          {reiter === "analytics" && <ReiterAnalytics a={daten} />}
          {reiter === "buchungen" && <ReiterBuchungen a={daten} />}
          {reiter === "auslastung" && <ReiterAuslastung a={daten} />}
          {reiter === "kanaele" && <ReiterKanaele a={daten} />}
          {reiter === "gaeste" && <ReiterGaeste a={daten} />}
        </div>
      ) : null}
    </div>
  );
}

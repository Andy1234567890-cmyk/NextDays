"use client";

// Widerruf und Änderung der Einwilligung — steht auf /cookie-richtlinie.
//
// Ohne diese Stelle wäre die Leiste eine Einbahnstraße: einmal geklickt,
// nie mehr änderbar. Die Einwilligung muss „so einfach widerrufbar" sein wie
// sie erteilt wurde (Art. 7 Abs. 3 DSGVO) — deshalb dieselbe Kategorienliste
// und dieselben zwei gleichrangigen Knöpfe wie in der Leiste.
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { KategorienFeld } from "@/components/einwilligung/kategorien-feld";
import { useEinwilligung } from "@/components/einwilligung/use-einwilligung";
import { Button } from "@/components/ui/button";
import {
  ALLES_ERLAUBT,
  type Auswahl,
  NICHTS_ERLAUBT,
  type OptionaleKategorie,
} from "@/lib/einwilligung";

export function EinwilligungsEinstellungen() {
  const t = useTranslations("einwilligung");
  const locale = useLocale();
  const { entscheidung, geladen, speichern } = useEinwilligung();
  const [auswahl, setAuswahl] = useState<Auswahl>(NICHTS_ERLAUBT);
  const [bestaetigt, setBestaetigt] = useState(false);

  // Die Schalter zeigen den GESPEICHERTEN Stand, sobald er gelesen ist — auch
  // wenn er in einem anderen Tab geändert wurde (der Hook hört auf `storage`).
  useEffect(() => {
    setAuswahl(entscheidung?.auswahl ?? NICHTS_ERLAUBT);
  }, [entscheidung]);

  const sichern = (neu: Auswahl) => {
    setAuswahl(neu);
    speichern(neu);
    setBestaetigt(true);
  };

  const setzen = (kategorie: OptionaleKategorie, an: boolean) => {
    setBestaetigt(false);
    setAuswahl((vorher) => ({ ...vorher, [kategorie]: an }));
  };

  // Kein erfundenes Datum: ohne Zeitpunkt im Speicher wird keiner behauptet,
  // dann steht dort derselbe Satz wie ohne Entscheidung (Wurzel 5b).
  const datum =
    entscheidung?.zeitpunkt &&
    !Number.isNaN(Date.parse(entscheidung.zeitpunkt))
      ? new Intl.DateTimeFormat(locale, { dateStyle: "long" }).format(
          new Date(entscheidung.zeitpunkt),
        )
      : null;

  return (
    <section
      id="einwilligung"
      className="mx-auto min-w-0 max-w-3xl scroll-mt-24 px-6 pb-24"
    >
      <div className="min-w-0 rounded-3xl border border-border bg-card p-6 shadow-soft sm:p-8">
        <h2 className="font-display text-xl font-semibold">
          {t("einstellungen.titel")}
        </h2>
        <p className="mt-3 break-words text-sm leading-relaxed text-muted-foreground">
          {t("einstellungen.text")}
        </p>

        {/* `aria-live`: Der Stand ändert sich ohne Seitenwechsel. */}
        <p
          aria-live="polite"
          className="mt-3 break-words text-sm leading-relaxed text-muted-foreground"
        >
          {!geladen
            ? null
            : bestaetigt
              ? t("einstellungen.gespeichert")
              : datum
                ? t("einstellungen.stand", { datum })
                : t("einstellungen.offen")}
        </p>

        <div className="mt-6">
          <KategorienFeld auswahl={auswahl} setzen={setzen} />
        </div>

        <div className="mt-6 flex min-w-0 flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            className="flex-1"
            onClick={() => sichern(NICHTS_ERLAUBT)}
          >
            {t("allesAblehnen")}
          </Button>
          <Button
            type="button"
            className="flex-1"
            onClick={() => sichern(ALLES_ERLAUBT)}
          >
            {t("allesAnnehmen")}
          </Button>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-2 w-full sm:w-auto"
          onClick={() => sichern(auswahl)}
        >
          {t("auswahlSpeichern")}
        </Button>
      </div>
    </section>
  );
}

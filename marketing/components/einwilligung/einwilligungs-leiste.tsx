"use client";

// Die Einwilligungs-Leiste. Erscheint einmal, solange nichts entschieden ist,
// und danach nie wieder — der Widerruf liegt auf /cookie-richtlinie.
//
// GLEICHRANGIGE KNÖPFE: „Alle ablehnen" und „Alle annehmen" tragen dieselbe
// Variante, dieselbe Größe und stehen in derselben Reihe. Kein „annehmen" in
// Farbe und „ablehnen" als blasser Text — das ist die verbreitetste Form des
// dunklen Musters und macht die Einwilligung angreifbar. Die Auswahl der
// Kategorien liegt einen Klick tiefer, aber der Ablehnen-Knopf liegt NICHT
// tiefer als der Annehmen-Knopf.
//
// KEIN X ZUM SCHLIESSEN: Ein Schließen ohne Entscheidung sieht wie ein
// Ablehnen aus, ist aber keines — der nächste Aufruf fragt wieder. Wer nichts
// will, klickt „Alle ablehnen"; das ist ein Klick, genauso wie annehmen.
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";

import { KategorienFeld } from "@/components/einwilligung/kategorien-feld";
import { useEinwilligung } from "@/components/einwilligung/use-einwilligung";
import { Button } from "@/components/ui/button";
import {
  ALLES_ERLAUBT,
  type Auswahl,
  NICHTS_ERLAUBT,
  type OptionaleKategorie,
  optionaleDiensteVorhanden,
} from "@/lib/einwilligung";

export function EinwilligungsLeiste() {
  const t = useTranslations("einwilligung");
  const { entscheidung, geladen, speichern } = useEinwilligung();
  const [auswahl, setAuswahl] = useState<Auswahl>(NICHTS_ERLAUBT);
  const [detailsOffen, setDetailsOffen] = useState(false);

  // Nichts rendern, solange der Speicher nicht gelesen ist (Hydration), wenn
  // eine Entscheidung vorliegt — oder wenn es in dieser Umgebung gar keinen
  // optionalen Dienst gibt (dann wäre die Leiste eine Attrappe, siehe
  // lib/einwilligung.ts).
  if (!geladen || entscheidung || !optionaleDiensteVorhanden()) return null;

  const setzen = (kategorie: OptionaleKategorie, an: boolean) =>
    setAuswahl((vorher) => ({ ...vorher, [kategorie]: an }));

  return (
    // `inset-x-0` + Innenabstand statt fester Breite: bei 320 px bleibt der
    // Kasten innerhalb des Bildschirms, ohne eigene Breitenannahme.
    // z-[90] liegt über dem Support-Chat (z-50) und unter dem
    // Voranmelde-Popup (z-[100]) — die Reihenfolge ist Absicht: erst
    // entscheiden, dann chatten; ein bereits offenes Popup bleibt vorn.
    <div
      role="dialog"
      aria-label={t("titel")}
      className="fixed inset-x-0 bottom-0 z-[90] p-3 sm:p-4"
    >
      <div className="mx-auto flex min-w-0 max-w-3xl flex-col gap-4 rounded-3xl border border-border bg-card p-5 shadow-float-lg sm:p-6">
        <div className="min-w-0">
          <h2 className="font-display text-base font-semibold">{t("titel")}</h2>
          <p className="mt-2 break-words text-sm leading-relaxed text-muted-foreground">
            {t("text")}
          </p>
          <Link
            href="/cookie-richtlinie"
            className="mt-2 inline-block break-words text-sm text-accent underline underline-offset-4"
          >
            {t("richtlinie")}
          </Link>
        </div>

        {detailsOffen ? (
          <KategorienFeld auswahl={auswahl} setzen={setzen} />
        ) : null}

        {/* Bei 320 px stehen die Knöpfe untereinander (`flex-col`), ab `sm`
            nebeneinander. Beide mit `flex-1`, damit keiner größer wirkt. */}
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            className="flex-1"
            onClick={() => speichern(NICHTS_ERLAUBT)}
          >
            {t("allesAblehnen")}
          </Button>
          <Button
            type="button"
            className="flex-1"
            onClick={() => speichern(ALLES_ERLAUBT)}
          >
            {t("allesAnnehmen")}
          </Button>
        </div>

        <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="flex-1"
            aria-expanded={detailsOffen}
            onClick={() => setDetailsOffen((offen) => !offen)}
          >
            {detailsOffen ? t("auswahlSchliessen") : t("auswahlOeffnen")}
          </Button>
          {detailsOffen ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => speichern(auswahl)}
            >
              {t("auswahlSpeichern")}
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

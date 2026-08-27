"use client";

// Die Einwilligungs-Leiste. Erscheint von allein, solange nichts entschieden
// ist — und danach nur noch, wenn der Besucher sie selbst wieder aufruft.
//
// WIDERRUF: über das Cookie-Symbol unten links auf JEDER Seite
// (components/einwilligung/einwilligungs-knopf.tsx), das das Ereignis
// EINWILLIGUNG_OEFFNEN schickt und diese Leiste erneut öffnet. Das ist derselbe
// eine Klick wie beim Erteilen (Art. 7 Abs. 3 DSGVO) und die verbreitete
// Umsetzung — Cookiebot, CookieYes und Usercentrics benutzen ebenfalls ein
// dauerhaft sichtbares Symbol, das das Banner wieder aufruft. Ein Bedienfeld in
// der Cookie-Richtlinie wäre der falsche Ort: die Rechtsseite ist der Text.
//
// Hier stand bis zum 26.08.2026 „über den Footer-Eintrag ‚Cookie-Einstellungen'"
// — den es im Footer nie gab (nachgezählt, kein Treffer auf
// EINWILLIGUNG_OEFFNEN in marketing-footer.tsx). Ein Kommentar, der einen
// Widerrufsweg beschreibt, den es nicht gibt, ist gefährlicher als keiner: er
// lässt beim Prüfen glauben, Art. 7 Abs. 3 sei zweifach erfüllt.
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
import { useEffect, useRef, useState } from "react";

import { KategorienFeld } from "@/components/einwilligung/kategorien-feld";
import { useEinwilligung } from "@/components/einwilligung/use-einwilligung";
import { Button } from "@/components/ui/button";
import {
  type Auswahl,
  EINWILLIGUNG_OEFFNEN,
  NICHTS_ERLAUBT,
  type OptionaleKategorie,
  optionaleDiensteVorhanden,
} from "@/lib/einwilligung";

export function EinwilligungsLeiste() {
  const t = useTranslations("einwilligung");
  const { entscheidung, geladen, speichern } = useEinwilligung();
  const [auswahl, setAuswahl] = useState<Auswahl>(NICHTS_ERLAUBT);
  // Erneut geöffnet per Footer-Eintrag. Getrennt von der Frage, ob schon
  // entschieden wurde: sonst müsste der Widerruf die gespeicherte Entscheidung
  // löschen, um die Leiste zu zeigen — und wer dann weggeht, ohne zu klicken,
  // hätte ungefragt alles widerrufen.
  const [erneutOffen, setErneutOffen] = useState(false);

  useEffect(() => {
    const oeffnen = () => setErneutOffen(true);
    window.addEventListener(EINWILLIGUNG_OEFFNEN, oeffnen);
    return () => window.removeEventListener(EINWILLIGUNG_OEFFNEN, oeffnen);
  }, []);

  // Escape schließt die Leiste NUR, wenn sie erneut geöffnet wurde — also wenn
  // bereits eine Entscheidung vorliegt, zu der zurückgekehrt werden kann.
  //
  // Beim ERSTEN Besuch tut Escape bewusst nichts: ein Wegdrücken ohne
  // Entscheidung sähe wie ein Ablehnen aus, wäre aber keines (beim nächsten
  // Aufruf stünde die Leiste wieder da). Wer nichts will, klickt „Alle
  // ablehnen" — ein Klick, genau wie annehmen.
  useEffect(() => {
    if (!erneutOffen) return;
    const aufTaste = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setErneutOffen(false);
      }
    };
    window.addEventListener("keydown", aufTaste);
    return () => window.removeEventListener("keydown", aufTaste);
  }, [erneutOffen]);

  // FOKUS: Die Leiste ist ein Dialog (`role="dialog"`), also muss der Fokus
  // hineinwandern, drin bleiben und beim Schließen zurückkommen.
  //
  // Ohne das war der Widerruf per Tastatur NICHT so einfach wie die Erteilung
  // (Art. 7 Abs. 3): das Cookie-Symbol blendet sich beim Öffnen aus, der Fokus
  // fiel damit auf <body>, und wer nicht mit der Maus arbeitet, musste die
  // ganze Seite durchtabben, um zu widerrufen. Beim ersten Besuch fällt das
  // nicht auf, weil die Leiste dort ohnehin am Anfang steht — der Mangel trifft
  // genau den Widerrufsweg.
  const kasten = useRef<HTMLDivElement | null>(null);
  const vorherFokussiert = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!erneutOffen) return;
    vorherFokussiert.current = document.activeElement as HTMLElement | null;
    // Ersten Knopf fokussieren — das ist „Alle ablehnen", also der
    // datenschutzfreundliche Weg, nicht das Annehmen.
    kasten.current?.querySelector<HTMLElement>("button, [href]")?.focus();
    return () => vorherFokussiert.current?.focus?.();
  }, [erneutOffen]);

  // Tab-Falle: solange die Leiste als Dialog offen ist, bleibt der Fokus darin.
  // Nur im erneut geöffneten Fall — beim ersten Besuch ist die Leiste kein
  // modaler Dialog, sondern der Anfang der Seite, und ein Wegtabben dorthin ist
  // legitim (der Besucher darf lesen, bevor er entscheidet).
  useEffect(() => {
    if (!erneutOffen) return;
    const fangen = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !kasten.current) return;
      const ziele = kasten.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      );
      if (ziele.length === 0) return;
      const erstes = ziele[0];
      const letztes = ziele[ziele.length - 1];
      if (!erstes || !letztes) return;
      if (e.shiftKey && document.activeElement === erstes) {
        e.preventDefault();
        letztes.focus();
      } else if (!e.shiftKey && document.activeElement === letztes) {
        e.preventDefault();
        erstes.focus();
      }
    };
    window.addEventListener("keydown", fangen);
    return () => window.removeEventListener("keydown", fangen);
  }, [erneutOffen]);

  // Beim erneuten Öffnen die bereits getroffene Wahl vorbelegen — der
  // Besucher soll seinen Stand sehen und ändern, nicht bei Null anfangen.
  useEffect(() => {
    if (erneutOffen && entscheidung) setAuswahl(entscheidung.auswahl);
  }, [erneutOffen, entscheidung]);

  // Nichts rendern, solange der Speicher nicht gelesen ist (Hydration), wenn
  // eine Entscheidung vorliegt UND die Leiste nicht erneut aufgerufen wurde —
  // oder wenn es in dieser Umgebung gar keinen optionalen Dienst gibt (dann
  // wäre die Leiste eine Attrappe, siehe lib/einwilligung.ts).
  if (!geladen || !optionaleDiensteVorhanden()) return null;
  if (entscheidung && !erneutOffen) return null;

  const setzen = (kategorie: OptionaleKategorie, an: boolean) =>
    setAuswahl((vorher) => ({ ...vorher, [kategorie]: an }));


  // Speichern MUSS das erneute Öffnen mit zurücknehmen. Ohne das blieb die
  // Leiste nach einem Widerruf offen stehen: die gespeicherte Entscheidung war
  // neu, aber `erneutOffen` stand noch auf `true` und hat den Ausstieg oben
  // überstimmt (live gemessen — Leiste UND Knopf gleichzeitig sichtbar).
  const entscheiden = (gewaehlt: Auswahl) => {
    speichern(gewaehlt);
    setErneutOffen(false);
  };

  return (
    // `inset-x-0` + Innenabstand statt fester Breite: bei 320 px bleibt der
    // Kasten innerhalb des Bildschirms, ohne eigene Breitenannahme.
    // z-[120] liegt über ALLEM: Support-Chat (z-50), Voranmelde-Popup
    // (z-[100], ein Vollbild-Backdrop) und dem Cookie-Symbol (z-[110]).
    //
    // Vorher stand hier z-[90] mit der Begründung „ein bereits offenes Popup
    // bleibt vorn". Das war gegen den Chat richtig und gegen das Popup falsch:
    // wer bei offenem Popup auf das Cookie-Symbol klickte, sah das Symbol
    // verschwinden und die Leiste hinter dem Backdrop — der Widerruf war
    // faktisch unmöglich, obwohl Art. 7 Abs. 3 DSGVO ihn „jederzeit" verlangt.
    // Das Popup fängt die Haupt-Schaltflächen ab, ist also häufig offen.
    //
    // Ein Werbe-Overlay darf ein Widerrufsrecht nicht verdecken. Die Rangfolge
    // ist damit: Einwilligung > Voranmeldung > Chat.
    <div
      role="dialog"
      // `aria-modal` nur beim erneuten Öffnen: dann IST es ein modaler Dialog
      // (der Fokus wird gefangen). Beim ersten Besuch wäre die Zusage falsch —
      // dort darf der Besucher die Seite lesen, bevor er entscheidet.
      aria-modal={erneutOffen || undefined}
      aria-label={t("titel")}
      className="fixed inset-x-0 bottom-0 z-[120] p-3 sm:p-4"
    >
      <div
        ref={kasten}
        className="mx-auto flex min-w-0 max-w-3xl flex-col gap-4 rounded-3xl border border-border bg-card p-5 shadow-float-lg sm:p-6"
      >
        {/* Kopfzeile: Titel und Schließen — wie bei Booking. Der
            Einleitungstext steht NICHT mehr hier, sondern auf der
            Übersichtsseite der linken Spalte („Ihre Cookie-Einstellungen"). Das
            hält den Kopf kurz und macht die Kategorien zur eigentlichen
            Oberfläche. */}
        <div className="flex min-w-0 items-start justify-between gap-3 border-b border-border pb-4">
          <h2 className="min-w-0 break-words font-display text-base font-semibold">
            {t("verwalten")}
          </h2>
          {/* Das X schließt NUR, wenn bereits eine Entscheidung vorliegt — also
              beim erneuten Öffnen zum Ändern. Beim ersten Besuch gibt es kein
              X: ein Wegdrücken ohne Entscheidung sähe wie ein Ablehnen aus,
              wäre aber keines (beim nächsten Aufruf stünde die Leiste wieder
              da). Wer nichts will, klickt „Alle ablehnen" — ein Klick, genau
              wie das Bestätigen. */}
          {erneutOffen ? (
            <button
              type="button"
              aria-label={t("schliessen")}
              onClick={() => setErneutOffen(false)}
              className="-mr-1 -mt-1 shrink-0 rounded-lg p-1 text-xl leading-none text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span aria-hidden>&times;</span>
            </button>
          ) : null}
        </div>

        {/* Die Kategorien stehen OFFEN auf der ersten Ebene, nicht hinter
            „Auswahl anzeigen". Granularität ist Pflicht (Art. 4 Nr. 11 DSGVO:
            Einwilligung „für einen bestimmten Fall"; EDSA-Leitlinie: der
            Betroffene muss je Zweck frei wählen können), und die
            Aufsichtsbehörden verlangen, dass die feinere Wahl OHNE umständliches
            Untermenü erreichbar ist. Ein Klapp-Knopf davor macht das Ablehnen
            einzelner Zwecke aufwendiger als das pauschale Annehmen — genau die
            Ungleichbehandlung, die beanstandet wird. */}
        <KategorienFeld auswahl={auswahl} setzen={setzen} />

        {/* Fußzeile nach der Vorlage: „Einstellungen bestätigen" gefüllt
            links, „Alle ablehnen" rechts. Kein „Alle annehmen" — damit gibt es
            kein Ein-Klick-Annehmen, das Ablehnen ist also der EINFACHERE Weg.
            Das ist strenger als die Gleichrangigkeits-Vorgabe verlangt und
            deshalb unproblematisch: beanstandet wird der umgekehrte Fall, ein
            prominentes Annehmen neben versteckter Ablehnung.

            Bei 320 px stehen sie untereinander (`flex-col`), ab `sm`
            nebeneinander mit Abstand dazwischen. */}
        <div className="flex min-w-0 flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
          <Button
            type="button"
            className="sm:min-w-56"
            onClick={() => entscheiden(auswahl)}
          >
            {t("bestaetigen")}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => entscheiden(NICHTS_ERLAUBT)}
          >
            {t("allesAblehnen")}
          </Button>
        </div>
      </div>
    </div>
  );
}

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
// ZWEI KNÖPFE, GLEICHRANGIG: „Alle ablehnen" und rechts der Zustimmungsknopf.
// Beide tragen dieselbe Variante, dieselbe Größe und stehen in derselben Reihe.
// Kein „annehmen" in Farbe und „ablehnen" als blasser Text — das ist die
// verbreitetste Form des dunklen Musters und macht die Einwilligung angreifbar.
//
// Der dritte Knopf („Einstellungen bestätigen") ist am 29.08.2026 entfallen.
// Er war neben den Pauschalknöpfen die dritte Antwort auf dieselbe Frage und
// hat den Abschluss zerfasert. Stattdessen trägt der RECHTE Knopf beide
// Bedeutungen und wechselt seine Beschriftung mit der Auswahl: solange alle
// Zwecke an sind (die Vorbelegung), heißt er „Alle annehmen"; sobald der
// Besucher einen Schalter umlegt, heißt er „Einstellungen bestätigen" und
// speichert genau die getroffene Auswahl. So bleibt es bei zwei Knöpfen, ohne
// dass die Schalter zu einer Attrappe werden — ein Schalter ohne Knopf, der
// ihn übernimmt, wäre genau das.
//
// VORBELEGUNG: Die optionalen Zwecke stehen beim ersten Öffnen auf AN
// (`allesErlaubt()`), nicht auf aus. Das ist eine bewusste Produktentscheidung
// vom 29.08.2026 — sie erhöht die Einwilligungsquote und ist zugleich der
// rechtlich angreifbare Teil dieses Dialogs (EuGH „Planet49" C-673/17, § 25
// TDDDG: vorangekreuzte Kästchen sind keine wirksame Einwilligung). Wer das
// zurückdreht, setzt hier `NICHTS_ERLAUBT` ein; gespeichert wird ohnehin erst
// mit einem Klick, und `entscheidungLesen` bleibt fail-closed.
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
  allesErlaubt,
  type Auswahl,
  EINWILLIGUNG_OEFFNEN,
  NICHTS_ERLAUBT,
  OPTIONALE_KATEGORIEN,
  type OptionaleKategorie,
  optionaleDiensteVorhanden,
} from "@/lib/einwilligung";

export function EinwilligungsLeiste() {
  const t = useTranslations("einwilligung");
  const { entscheidung, geladen, speichern } = useEinwilligung();
  // Vorbelegung: alle optionalen Zwecke AN — siehe Kopfkommentar
  // („VORBELEGUNG"). `allesErlaubt` wird als Funktion übergeben, damit React
  // sie einmalig beim ersten Rendern auswertet.
  const [auswahl, setAuswahl] = useState<Auswahl>(allesErlaubt);
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
    // Das erste fokussierbare Element im Kasten fokussieren — beim erneuten
    // Öffnen ist das X zum Schließen, sonst der erste Schalter im
    // Kategorienfeld. KEIN Knopf der Fußzeile: der Fokus soll den Dialog
    // betreten, nicht eine der beiden Antworten vorwegnehmen.
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

  // Steht die Auswahl noch auf der Vorbelegung (alles an)? Danach richtet sich
  // die Beschriftung des rechten Knopfes. Über OPTIONALE_KATEGORIEN gezählt,
  // nicht über `Object.values` — sonst zählte ein später ergänztes Feld mit,
  // das kein Zweck ist.
  const allesAn = OPTIONALE_KATEGORIEN.every((k) => auswahl[k]);

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

        {/* Fußzeile: zwei gleichrangige Knöpfe — links ablehnen, rechts
            zustimmen. Der rechte trägt beide Bedeutungen (siehe Kopfkommentar):
            „Alle annehmen", solange alles an ist, sonst „Einstellungen
            bestätigen".

            „Alle annehmen" fehlte hier zwischen dem 27. und dem 29.08.2026 und
            hat live das Gegenteil des Gewollten bewirkt: es gab keinen Weg
            mehr, in einem Zug einzuwilligen, also willigte faktisch niemand
            ein. Gemessen: ohne Einwilligung verlässt kein einziger
            `/g/collect`-Treffer die Seite, und GA4 meldete unter Verwaltung →
            Einwilligungseinstellungen „Cookie-Einwilligungssignale für Analyse
            inaktiv".

            Bei 320 px stehen beide untereinander (`flex-col`), ab `sm`
            nebeneinander. */}
        <div className="flex min-w-0 flex-col gap-2 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-end">
          <Button
            type="button"
            className="sm:min-w-44"
            onClick={() => entscheiden(NICHTS_ERLAUBT)}
          >
            {t("allesAblehnen")}
          </Button>
          <Button
            type="button"
            className="sm:min-w-44"
            onClick={() => entscheiden(auswahl)}
          >
            {allesAn ? t("allesAnnehmen") : t("bestaetigen")}
          </Button>
        </div>
      </div>
    </div>
  );
}

"use client";

// Popup für offizielle Ankündigungen: erscheint EINMAL pro Sitzung nach dem
// Login und verschwindet erst durch aktives Bestätigen. Nur admin/co_admin —
// das Gate sitzt im Dashboard-Layout, hier wird nichts nachgeprüft.
import { useCallback, useEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";

import { kategorieSchluessel } from "@/components/announcements/kategorie";
import {
  popupAnnouncement,
  quittiereAnnouncement,
  type Announcement,
} from "@/lib/announcements";
import { Button } from "@nextdays/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@nextdays/ui/dialog";

// Riegel gegen F5: das Server-Layout bleibt beim Navigieren im Baum stehen,
// der Effekt läuft also nur einmal je Vollladen. Ein Reload würde ihn erneut
// auslösen — dagegen dieser Schlüssel. Er wird NUR nach einer erfolgreichen
// Antwort gesetzt (siehe unten).
const SESSION_RIEGEL = "nd_ankuendigung_geprueft";

// Endlos-Sicherung für die Kette: liefert der Server (Fehler in der
// Quittierung, Uhr-/Datenproblem) immer wieder dieselbe Ankündigung, soll der
// Nutzer nicht ewig klicken müssen.
const MAX_KETTE = 10;

function riegelLesen(): boolean {
  try {
    return sessionStorage.getItem(SESSION_RIEGEL) === "1";
  } catch {
    // In gesperrten Browsern (Safari privat, Cookie-Blocker) wirft der Zugriff.
    // Dann gibt es keinen Riegel — lieber ein Popup zu viel als ein Absturz.
    return false;
  }
}

function riegelSetzen(): void {
  try {
    sessionStorage.setItem(SESSION_RIEGEL, "1");
  } catch {
    // s. o. — ohne Riegel weiterlaufen ist verkraftbar.
  }
}

export function AnkuendigungPopup() {
  const t = useTranslations("neuerungen");
  const locale = useLocale();

  const [aktuell, setAktuell] = useState<Announcement | null>(null);
  const [speichert, setSpeichert] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [position, setPosition] = useState(1);
  const bestaetigenRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (riegelLesen()) return;
    let abgebrochen = false;
    void (async () => {
      const res = await popupAnnouncement();
      if (abgebrochen) return;
      if (!res.ok) {
        // Kein Riegel bei Fehler: ein 503 darf die Ankündigung nicht für die
        // ganze Sitzung verschlucken. Auch keine sichtbare Meldung — ein
        // Ladefehler hier ist kein Anlass, den Nutzer zu unterbrechen.
        return;
      }
      riegelSetzen();
      // `/popup` liefert die Hülle {item, offen} — nicht die Ankündigung
      // selbst. Sie direkt zu setzen ergäbe einen Dialog ohne Titel.
      setAktuell(res.data.item);
    })();
    return () => {
      abgebrochen = true;
    };
    // Absichtlich einmalig: „einmal pro Sitzung" ist genau diese Semantik.
  }, []);

  // Der Fokus beim Öffnen wird NICHT hier gesetzt, sondern in
  // `onOpenAutoFocus` am DialogContent. Grund: Radix setzt den Startfokus
  // selbst, und zwar NACH dem Effekt — ein `focus()` aus einem `useEffect`
  // heraus verliert dieses Rennen. Real gemessen landete der Fokus dadurch
  // auf dem scrollbaren Textbereich (dem ersten fokussierbaren Element im
  // Dialog), der daraufhin den blauen Standardring des Browsers zeigte.
  //
  // Beim WECHSEL innerhalb der Kette greift `onOpenAutoFocus` nicht (der
  // Dialog bleibt ja offen) — dort ist der Fokus aber ohnehin schon auf dem
  // Knopf, der den Wechsel ausgelöst hat.

  const bestaetigen = useCallback(async () => {
    if (!aktuell || speichert) return;
    setSpeichert(true);
    setFehler(null);
    const res = await quittiereAnnouncement(aktuell.id);
    if (!res.ok) {
      // NICHT optimistisch: das Schließen IST die Quittierung. Scheitert sie,
      // bleibt der Dialog offen — sonst gälte sie als erledigt, ohne es zu
      // sein, und die Ankündigung wäre für diesen Nutzer verloren.
      setFehler(res.error);
      setSpeichert(false);
      return;
    }
    if (position >= MAX_KETTE) {
      setAktuell(null);
      setSpeichert(false);
      return;
    }
    // Kette: erneut fragen statt eine Liste zu puffern — die Reihenfolge
    // bleibt Server-Sache. Der Dialog bleibt dabei OFFEN, nur der Inhalt
    // tauscht; sonst blitzt das Dashboard auf und der Fokus springt zweimal.
    const naechste = await popupAnnouncement();
    setSpeichert(false);
    if (!naechste.ok) {
      // Die aktuelle IST quittiert — der Nachschlag ist nur gescheitert.
      // Schließen ist hier richtig: der Rest kommt beim nächsten Login.
      setAktuell(null);
      return;
    }
    if (naechste.data.item) setPosition((p) => p + 1);
    setAktuell(naechste.data.item);
  }, [aktuell, speichert, position]);

  if (!aktuell) return null;

  const kategorie = kategorieSchluessel(aktuell.kategorie);
  // Ohne Veröffentlichungsdatum bleibt die Zeile leer, statt „Invalid Date"
  // zu zeigen — ein fehlender Wert wird nicht durch einen erfundenen ersetzt.
  const datum = aktuell.veroeffentlicht_am
    ? new Date(aktuell.veroeffentlicht_am).toLocaleDateString(locale, {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "";

  return (
    <Dialog open>
      <DialogContent
        showCloseButton={false}
        // Höhe (`max-h-[90dvh]`) und Spalten-Flex kommen aus DialogContent —
        // hier NICHT wiederholen. Zwei Höhenangaben auf zwei Ebenen waren der
        // Grund, warum der Fuß aus dem Fenster rutschen konnte.
        //
        // `overflow-hidden` überschreibt bewusst das `overflow-y-auto` des
        // Dialogs: dieser Popup hat einen EIGENEN Scrollbereich (der Textteil).
        // Ohne das gäbe es zwei ineinander liegende Scrollbalken, und der
        // äußere würde den Fuß wegscrollen, statt ihn stehen zu lassen.
        className="max-w-2xl overflow-hidden p-0"
        aria-describedby={undefined}
        // Startfokus auf den Bestätigungsknopf statt auf das erste
        // fokussierbare Element (das ist der scrollbare Textbereich — er bekam
        // dadurch sichtbar den Fokusring, obwohl niemand ihn angesteuert hat).
        // Der Knopf ist der Ausweg aus dem Dialog und damit die richtige
        // Startposition; der Textbereich bleibt per Tab erreichbar.
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          bestaetigenRef.current?.focus();
        }}
        // Overlay-Klick UND Escape bleiben gesperrt: beides würde die
        // Ankündigung ungelesen wegwischen. Quittieren ist endgültig — der
        // Server liefert eine quittierte Ankündigung nie wieder aus. Eine
        // versehentlich gedrückte Escape-Taste (der Reflex, mit dem man jedes
        // Modal schließt) darf deshalb NICHT dasselbe auslösen wie der bewusste
        // Klick auf „Verstanden"; sonst ist der Inhalt für diesen Nutzer
        // dauerhaft verloren, ohne dass er ihn je gesehen hat.
        //
        // Das ist KEIN Keyboard-Trap nach WCAG 2.1.2: der Ausweg ist einen
        // Tastendruck weit entfernt — der Bestätigungsknopf hat beim Öffnen den
        // Fokus (`onOpenAutoFocus` oben), Enter/Leertaste quittiert und
        // schließt. Der Knopf ist bei knapper Fensterhöhe auch wirklich
        // erreichbar: der Fuß ist `shrink-0` in einer auf `max-h-[90dvh]`
        // begrenzten Flex-Spalte, gemessen bei 700px UND 500px Fensterhöhe.
        // Bitte nicht als Bug „reparieren" — ohne diese Sperre ist das Feature
        // offen wie ein Scheunentor.
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        {/* Diese Fläche erbt ihre Höhe vom Dialog (Flex-Item in dessen Spalte)
            und gibt sie als eigene Spalte an Kopf/Text/Fuß weiter. `min-h-0`
            ist hier PFLICHT: die Default-Mindesthöhe eines Flex-Items ist
            `auto` = Inhaltshöhe. Ohne das wächst die Fläche auf die volle
            Textlänge (real gemessen: 2826px bei 700px Fenster) und schiebt den
            Fuß aus dem Bild, statt dass der Text in der Mitte scrollt.
            Bewusst KEINE eigene `max-h` — die Höhe gehört dem Dialog. */}
        <div className="neuerungen-flaeche flex min-h-0 flex-1 flex-col bg-background text-foreground">
          <div className="shrink-0 space-y-3 border-b border-border px-6 pb-5 pt-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-accent px-3 py-1 text-xs font-medium text-accent-foreground">
                {t(`kategorie.${kategorie}`)}
              </span>
              <span className="text-xs text-muted-foreground">
                {t("veroeffentlichtAm", { datum })}
              </span>
            </div>
            <DialogTitle className="text-balance">{aktuell.titel}</DialogTitle>
            {aktuell.kurztext && (
              <p className="text-sm text-muted-foreground">
                {aktuell.kurztext}
              </p>
            )}
          </div>

          {/* Scrollbarer Inhalt: fokussierbar + benannt, damit er auch per
              Tastatur gescrollt werden kann (sonst ist langer Text für
              Tastaturnutzer unerreichbar). `tabIndex` bleibt deshalb — es zu
              entfernen wäre ein Barrierefreiheits-Rückschritt.
              `aria-live` meldet den Wechsel innerhalb der Kette, ohne den
              Fokus zu verschieben.

              `focus-visible:` statt `focus:`: der Browser-Standardring
              erschien bei JEDEM Fokus, also auch bei reiner Mausbedienung —
              als blauer Rahmen um den Textblock, den niemand angefordert hat.
              `focus-visible` zeigt ihn nur bei Tastaturnutzung, also genau
              dann, wenn er die Orientierung trägt. Der Ring nutzt das
              semantische `ring`-Token statt Chrome-Blau; `outline-none` allein
              (ohne Ersatz) wäre der falsche Weg — dann sähe ein
              Tastaturnutzer gar nicht mehr, wo er steht. */}
          <div
            className="min-h-0 flex-1 overflow-y-auto px-6 py-5 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
            tabIndex={0}
            role="region"
            aria-label={t("popup.ariaLabel")}
            aria-live="polite"
          >
            {/* inhalt_html ist serverseitig mit nh3 gegen eine Allowlist
                bereinigt (Wurzel 8: Sanitizing beim SPEICHERN, in POST UND
                PATCH), inklusive img-src-Prüfung gegen die eigene
                Storage-Basis. Der Text stammt ausschließlich vom
                Plattform-Team, nie von Kunden. dangerouslySetInnerHTML ist
                hier deshalb der korrekte Weg — der Redakteur soll seine
                Formatierung sehen. */}
            <div
              className="tiptap text-sm leading-relaxed [&_img]:max-w-full [&_img]:rounded-2xl"
              dangerouslySetInnerHTML={{ __html: aktuell.inhalt_html }}
            />
          </div>

          <div className="shrink-0 space-y-3 border-t border-border px-6 pb-6 pt-4">
            {fehler && (
              <p
                role="alert"
                className="rounded-2xl bg-destructive/10 px-4 py-2 text-sm text-destructive"
              >
                {t("popup.fehler", { grund: fehler })}
              </p>
            )}
            <div className="flex items-center justify-end gap-3">
              {position > 1 && (
                <span className="text-xs text-muted-foreground">
                  {t("popup.vonAnzahl", { nummer: position })}
                </span>
              )}
              <Button
                ref={bestaetigenRef}
                type="button"
                variant="accent"
                onClick={() => void bestaetigen()}
                disabled={speichert}
                aria-busy={speichert}
              >
                {speichert
                  ? t("popup.wirdGespeichert")
                  : fehler
                    ? t("popup.erneut")
                    : t("popup.gelesen")}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

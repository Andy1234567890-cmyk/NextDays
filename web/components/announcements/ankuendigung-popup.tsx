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

  // Autofokus auf den Bestätigungsknopf — er ist der einzige Ausweg und muss
  // deshalb sofort erreichbar sein (siehe Esc-Kommentar unten).
  useEffect(() => {
    if (aktuell) bestaetigenRef.current?.focus();
  }, [aktuell]);

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
        className="max-h-[85vh] max-w-2xl overflow-hidden p-0"
        aria-describedby={undefined}
        // Esc und Overlay-Klick sind gesperrt, weil sie sonst am
        // Quittierungspfad vorbei schließen würden — die Ankündigung wäre
        // weggeklickt und käme beim nächsten Login wieder.
        //
        // Das ist KEIN Keyboard-Trap nach WCAG 2.1.2: der Ausweg ist genau
        // einen Tastendruck weit entfernt (der Bestätigungsknopf hat beim
        // Öffnen den Fokus, Enter/Leertaste schließt). Bitte nicht als Bug
        // „reparieren" — ohne diese Sperre ist das Feature offen wie ein
        // Scheunentor.
        onEscapeKeyDown={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <div className="neuerungen-flaeche flex max-h-[85vh] flex-col bg-background text-foreground">
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
              Tastaturnutzer unerreichbar). `aria-live` meldet den Wechsel
              innerhalb der Kette, ohne den Fokus zu verschieben. */}
          <div
            className="min-h-0 flex-1 overflow-y-auto px-6 py-5"
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

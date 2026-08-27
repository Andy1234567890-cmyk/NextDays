"use client";

// Voranmeldung: das Popup hinter „Anmelden" und „Kostenlos starten".
//
// Solange die Plattform nicht öffentlich ist, führen beide Knöpfe ins Leere —
// stattdessen sammeln wir hier Adressen für den Start. Statt jeden Knopf
// einzeln umzubauen (es gibt sie in Navigation, Hero und Schlussabschnitt, und
// die Seite wird gerade überarbeitet), fängt diese Komponente Klicks auf Links
// ab, die auf die App zeigen. Vorteil: die Marketing-Bausteine bleiben
// unangetastet, und beim Start genügt EIN Schalter unten, um wieder
// durchzuleiten.
//
// Der Versand läuft über die FastAPI (Double-Opt-in); hier wird nichts
// gespeichert und nichts an Brevo geschickt.
import { useLocale } from "next-intl";
import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { voranmeldungTexte } from "@/content/voranmeldung";
import { VORANMELDUNG_ZIEL } from "@/lib/app-url";
import { voranmelden } from "@/lib/newsletter";
import { pixelEreignisMelden } from "@/lib/pixel";

// Vor dem Start: Klicks auf Login/Registrierung öffnen das Popup.
// Zum Start auf `false` setzen — dann führen die Knöpfe wieder in die App,
// ohne dass ein einziger Marketing-Baustein angefasst werden muss.
const VOR_DEM_START = true;

/**
 * Ist das ein Voranmelde-Knopf?
 *
 * Erkennung über das feste Marker-Ziel, NICHT über die App-Domain: Eine
 * Domain-Prüfung (`href.startsWith(APP_URL)`) fiel still aus, sobald die
 * Dashboard-URL wechselte — die Knöpfe hätten Besucher dann ungewollt in ein
 * Login geschickt, das sie vor dem Start gar nicht benutzen können.
 */
function istVoranmeldeKnopf(href: string | null): boolean {
  return href === VORANMELDUNG_ZIEL;
}

export function VoranmeldungPopup() {
  const locale = useLocale();
  const t = voranmeldungTexte(locale);
  const [offen, setOffen] = useState(false);
  const [quelle, setQuelle] = useState("popup");
  const [email, setEmail] = useState("");
  const [einwilligung, setEinwilligung] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [fertig, setFertig] = useState<string | null>(null);

  // Aufruf MIT dem Anker in der URL (#voranmeldung) — der Weg von ausserhalb
  // dieser App. Das Demo-Band im Dashboard verlinkt hierher; ohne diese Pruefung
  // laege der Besucher auf der Startseite, und das Popup blieb zu, weil der
  // Klick-Abfang unten nur INNERHALB der Marketing-Seite greift.
  useEffect(() => {
    if (!VOR_DEM_START) return;
    if (window.location.hash !== VORANMELDUNG_ZIEL) return;
    setQuelle("popup_extern");
    setOffen(true);
    // Anker aus der Adresse entfernen: sonst oeffnet ein Neuladen der Seite das
    // Popup wieder, obwohl der Besucher es geschlossen hat.
    window.history.replaceState(null, "", window.location.pathname);
  }, []);

  // Klicks auf App-Links abfangen (Capture-Phase, damit Next.js' Router nicht
  // vorher navigiert).
  useEffect(() => {
    if (!VOR_DEM_START) return;
    const beiKlick = (e: MouseEvent) => {
      // Modifier-Klicks (neuer Tab) in Ruhe lassen — wer bewusst in einem
      // neuen Tab öffnet, soll das dürfen.
      if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) {
        return;
      }
      const ziel = (e.target as HTMLElement | null)?.closest("a");
      if (!ziel || !istVoranmeldeKnopf(ziel.getAttribute("href"))) return;
      e.preventDefault();
      // Woher der Klick kam, wandert als Quelle mit (Auswertung später).
      setQuelle(
        ziel.closest("header") ? "popup_navigation" : "popup_seite",
      );
      setOffen(true);
    };
    document.addEventListener("click", beiKlick, true);
    return () => document.removeEventListener("click", beiKlick, true);
  }, []);

  const schliessen = useCallback(() => {
    setOffen(false);
    setFehler(null);
    setFertig(null);
  }, []);

  // Escape schließt.
  useEffect(() => {
    if (!offen) return;
    const beiTaste = (e: KeyboardEvent) => {
      if (e.key === "Escape") schliessen();
    };
    document.addEventListener("keydown", beiTaste);
    return () => document.removeEventListener("keydown", beiTaste);
  }, [offen, schliessen]);

  async function absenden(e: FormEvent) {
    e.preventDefault();
    if (laeuft || !email.trim() || !einwilligung) return;
    setLaeuft(true);
    setFehler(null);
    try {
      const res = await voranmelden({
        email: email.trim(),
        locale,
        source: quelle,
        // Genau der Satz, der oben neben der Checkbox steht.
        consentText: t.einwilligung,
      });
      setFertig(res.detail);
      // Conversion an den Werbe-Pixel — NACH dem Erfolg, nicht beim Absenden:
      // ein Klick auf „Absenden" ist keine Anmeldung, ein 422 vom Server auch
      // nicht. Metas Standard-Event dafuer heisst `Lead` („when a sign up is
      // completed"). Ohne Einwilligung „marketing" verpufft der Aufruf still,
      // das entscheidet lib/pixel.ts — hier steht bewusst keine zweite
      // Einwilligungspruefung, die auseinanderlaufen koennte.
      //
      // Kein `value`/`currency`: eine Voranmeldung hat keinen Geldwert, und
      // einen zu erfinden waere ein Fantasiewert in der Kampagnen-Auswertung
      // (Wurzel 4).
      pixelEreignisMelden("Lead");
      setEmail("");
      setEinwilligung(false);
    } catch (exc) {
      setFehler(exc instanceof Error ? exc.message : t.fehlerAllgemein);
    } finally {
      setLaeuft(false);
    }
  }

  if (!offen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={t.titel}
      onMouseDown={(e) => {
        // Nur ein Klick auf den Hintergrund schließt, nicht einer im Dialog.
        if (e.target === e.currentTarget) schliessen();
      }}
    >
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-2xl">
        <button
          type="button"
          onClick={schliessen}
          aria-label={t.schliessen}
          className="absolute right-4 top-4 text-muted-foreground transition-colors hover:text-foreground"
        >
          <Icon icon="ph:x" className="size-5" />
        </button>

        <h2 className="font-display text-xl font-semibold tracking-tight">
          {t.titel}
        </h2>

        {fertig ? (
          <>
            <p className="mt-3 text-sm text-muted-foreground">{fertig}</p>
            <Button className="mt-6 w-full" onClick={schliessen}>
              {t.schliessen}
            </Button>
          </>
        ) : (
          <form onSubmit={absenden}>
            <p className="mt-2 text-sm text-muted-foreground">{t.text}</p>

            <Label htmlFor="voranmeldung-email" className="mt-5 block">
              {t.emailLabel}
            </Label>
            <Input
              id="voranmeldung-email"
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t.emailPlatzhalter}
              error={!!fehler}
              className="mt-1.5"
            />

            <label className="mt-4 flex items-start gap-2.5 text-xs leading-relaxed text-muted-foreground">
              <input
                type="checkbox"
                required
                checked={einwilligung}
                onChange={(e) => setEinwilligung(e.target.checked)}
                className="mt-0.5 size-4 shrink-0"
              />
              <span>
                {t.einwilligung}{" "}
                <Link
                  href="/datenschutz"
                  className="underline underline-offset-2 hover:text-foreground"
                >
                  {t.datenschutzLink}
                </Link>
              </span>
            </label>

            {fehler && (
              <p className="mt-3 text-sm text-destructive" role="alert">
                {fehler}
              </p>
            )}

            <Button
              type="submit"
              disabled={laeuft || !email.trim() || !einwilligung}
              className="mt-5 w-full"
            >
              {laeuft ? t.laeuft : t.absenden}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}

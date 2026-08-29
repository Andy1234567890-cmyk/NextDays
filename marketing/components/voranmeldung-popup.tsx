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
import { ereignisMelden } from "@/lib/analytics";
import { VORANMELDUNG_ZIEL } from "@/lib/app-url";
import { voranmelden } from "@/lib/newsletter";
import { pixelEreignisMelden } from "@/lib/pixel";

// Vor dem Start: Klicks auf Login/Registrierung öffnen das Popup.
//
// SEIT 29.08.2026 AUS. Die Plattform ist erreichbar, Anmeldung und
// Registrierung funktionieren — ein Popup davor wäre jetzt die Sackgasse, die
// es vorher verhindert hat. Die Knöpfe führen wieder in die App
// (`app-url.ts`), das Popup bleibt für die Newsletter-Anmeldung im Footer.
//
// Der Abfang unten greift ohnehin nur bei `href="#voranmeldung"`; steht eine
// echte App-URL im Link, ist er wirkungslos. Der Schalter macht die Absicht
// eindeutig, statt sich auf diese Nebenwirkung zu verlassen.
const VOR_DEM_START = false;

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

  /**
   * Der EINZIGE Weg, das Popup zu oeffnen — und damit die einzige Stelle, an
   * der `popup_geoeffnet` gemeldet wird.
   *
   * Bewusst nicht als Effekt auf `offen`: die Quelle wandert im selben Zug mit,
   * und ein Effekt auf zwei Zustaenden meldet auch dann, wenn sich nur die
   * Quelle aendert. Wer hier einen dritten Oeffnungsweg ergaenzt, bekommt die
   * Zaehlung geschenkt, statt sie zu vergessen.
   */
  const oeffnen = useCallback(
    (neueQuelle: string) => {
      setQuelle(neueQuelle);
      setOffen(true);
      ereignisMelden("popup_geoeffnet", { quelle: neueQuelle }, locale);
    },
    [locale],
  );

  // Aufruf MIT dem Anker in der URL (#voranmeldung) — der Weg von ausserhalb
  // dieser App. Das Demo-Band im Dashboard verlinkt hierher; ohne diese Pruefung
  // laege der Besucher auf der Startseite, und das Popup blieb zu, weil der
  // Klick-Abfang unten nur INNERHALB der Marketing-Seite greift.
  //
  // BEWUSST OHNE `VOR_DEM_START`-Riegel (29.08.2026): Dieser Weg ist der
  // einzige, der das Popup nach dem Start noch oeffnet — der Klick-Abfang
  // unten ist dann aus. Daran haengen zwei Dinge, die weiterlaufen muessen:
  // der Newsletter-Knopf im Footer und das Demo-Band im Dashboard. Waere der
  // Riegel auch hier, waere das Popup mit dem Startschalter stillschweigend
  // unerreichbar geworden — beide Knoepfe haetten dann nichts mehr getan.
  //
  // ZWEI Ausloeser, weil es zwei Faelle gibt: Der Effekt-Lauf deckt den Aufruf
  // MIT Anker in der Adresse ab (von aussen). `hashchange` deckt den Klick auf
  // DERSELBEN Seite ab — ohne ihn setzt der Newsletter-Knopf im Footer nur
  // den Anker, und es passiert nichts: ein Knopf, der aussieht, als taete er
  // etwas, ist schlimmer als keiner.
  useEffect(() => {
    const pruefen = () => {
      if (window.location.hash !== VORANMELDUNG_ZIEL) return;
      oeffnen("popup_extern");
      // Anker aus der Adresse entfernen: sonst oeffnet ein Neuladen der Seite
      // das Popup wieder, obwohl der Besucher es geschlossen hat. Das ist
      // zugleich der Grund, warum ein erneuter Lauf dieses Effekts
      // (Sprachwechsel aendert `oeffnen`) nichts doppelt meldet: der Anker
      // ist dann weg.
      window.history.replaceState(null, "", window.location.pathname);
    };
    pruefen();
    window.addEventListener("hashchange", pruefen);
    return () => window.removeEventListener("hashchange", pruefen);
  }, [oeffnen]);

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
      // Woher der Klick kam, EINMAL bestimmen und für beides verwenden: die
      // Quelle des Popups trägt den Präfix `popup_`, der GA4-Parameter
      // `stelle` denselben Wert ohne ihn. Zwei getrennte `closest("header")`-
      // Prüfungen wären zwei Stellen, die auseinanderlaufen können.
      const stelle = ziel.closest("header") ? "navigation" : "seite";
      // WELCHER Knopf gedrückt wurde, steht am Link (`data-cta`), nicht im
      // `href`: vor dem Start tragen Login, Registrierung und Demo alle
      // denselben Marker `#voranmeldung` (lib/app-url.ts). Die Beschriftung
      // taugt erst recht nicht — sie ist in 24 Sprachen verschieden.
      // Fehlt das Attribut, geht `ziel` GAR NICHT mit (Wurzel 4).
      const kennung = ziel.getAttribute("data-cta");
      ereignisMelden(
        "cta_klick",
        { stelle, ...(kennung ? { ziel: kennung } : {}) },
        locale,
      );
      // Zwei Ereignisse mit Absicht: der Klick sagt, WELCHER Knopf gedrückt
      // wurde, das Öffnen sagt, dass das Overlay kam. Sie fallen nicht immer
      // zusammen (der Anker-Weg oben öffnet ohne Klick).
      oeffnen(`popup_${stelle}`);
    };
    document.addEventListener("click", beiKlick, true);
    return () => document.removeEventListener("click", beiKlick, true);
  }, [locale, oeffnen]);

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
      // Dieselbe Conversion an GA4 — NEBEN dem Pixel, nicht in ihm. Die beiden
      // haengen an VERSCHIEDENEN Einwilligungen (marketing bzw. analytisch);
      // wer nur „Analytisch" erlaubt, muss hier trotzdem gezaehlt werden.
      // Deshalb auch keine Abhaengigkeit vom Rueckgabewert des Pixel-Aufrufs.
      ereignisMelden("voranmeldung", { quelle }, locale);
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

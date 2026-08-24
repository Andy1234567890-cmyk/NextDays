"use client";

// Cookie-Hinweis der Kunden-Website (0426).
//
// Schlicht, aber nicht wirkungslos: der Klick schaltet Googles Consent Mode v2
// von „denied" auf „granted" (0430). Vorher hat gtag.js zwar geladen, aber keine
// Cookies gesetzt und keine personenbezogenen Daten gesendet — der Default steht
// in components/google-tag.tsx und läuft VOR dem Skript.
//
// Für eigenen Code des Betriebs (`custom_js`) gilt das NICHT: den bindet der
// Renderer unverändert ein, und wer dort ein Analytics-Skript einträgt, braucht
// seine eigene Consent-Lösung. Das sagt der Text im Baukasten auch. Ein Banner,
// das „Zustimmung" behauptet, während fremder Code längst läuft, wäre schlimmer
// als keines — deshalb wird hier nur das freigegeben, was wir selbst laden.
//
// Die Auswahl liegt in `localStorage` und nicht in einem Cookie: sie betrifft
// nur diesen Browser, muss den Server nie erreichen, und ein Cookie für die
// Cookie-Frage ist eine Pointe, die niemand braucht.
import { useEffect, useState } from "react";

const SCHLUESSEL = "nd-cookie-hinweis";

export function CookieHinweis({
  text,
  knopf,
  linkText,
  linkHref,
}: {
  text: string;
  knopf: string;
  linkText?: string;
  /** Pfad zur Cookie-Richtlinie. Fehlt sie, gibt es keinen Link — kein Verweis
   *  auf eine Seite, die es nicht gibt. */
  linkHref?: string | null;
}) {
  // `null` = noch nicht entschieden, ob angezeigt wird. Ohne diesen dritten
  // Zustand blitzt der Hinweis bei jedem Seitenaufruf kurz auf, auch bei
  // jemandem, der ihn längst weggeklickt hat: der Server weiß nichts von
  // localStorage und rendert ihn, der Effekt entfernt ihn erst danach.
  const [zeigen, setZeigen] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      setZeigen(window.localStorage.getItem(SCHLUESSEL) !== "ok");
    } catch {
      // Privates Fenster, blockierte Site-Daten: dann eben jedes Mal zeigen.
      // Lieber ein Hinweis zu viel als einer, der wegen eines Fehlers ausfällt.
      setZeigen(true);
    }
  }, []);

  if (zeigen !== true) return null;

  return (
    <div
      // `role="region"` und nicht `dialog`: der Hinweis sperrt die Seite nicht,
      // und ein Dialog verlangte Fokus-Fang und Escape-Behandlung, die es hier
      // nicht braucht.
      role="region"
      aria-label={text}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-background/95 p-4 backdrop-blur"
    >
      <div className="mx-auto flex max-w-5xl flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-foreground">
          {text}
          {linkHref && linkText ? (
            <>
              {" "}
              <a href={linkHref} className="underline">
                {linkText}
              </a>
            </>
          ) : null}
        </p>
        <button
          type="button"
          onClick={() => {
            // Googles Consent Mode v2: die vier Signale freigeben. `gtag`
            // existiert nur, wenn der Betrieb eine Mess-Kennung eingetragen
            // hat — deshalb die Prüfung und kein Import.
            //
            // Diese Zeilen stehen VOR dem localStorage-Schreiben: schlägt das
            // Speichern fehl (privates Fenster), soll die Zustimmung für DIESE
            // Sitzung trotzdem gelten. Der Hinweis kommt beim nächsten Aufruf
            // wieder, was der ehrliche Ausgang ist.
            const gtag = (
              window as unknown as {
                gtag?: (...args: unknown[]) => void;
              }
            ).gtag;
            gtag?.("consent", "update", {
              ad_storage: "granted",
              ad_user_data: "granted",
              ad_personalization: "granted",
              analytics_storage: "granted",
            });
            try {
              window.localStorage.setItem(SCHLUESSEL, "ok");
            } catch {
              // Nicht speicherbar → der Hinweis kommt beim nächsten Aufruf
              // wieder. Das ist der ehrliche Ausgang; ihn trotzdem für diese
              // Sitzung zu verstecken würde vortäuschen, die Wahl sei gemerkt.
            }
            setZeigen(false);
          }}
          className="btn-marke btn-marke-primaer shrink-0 bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground"
        >
          {knopf}
        </button>
      </div>
    </div>
  );
}

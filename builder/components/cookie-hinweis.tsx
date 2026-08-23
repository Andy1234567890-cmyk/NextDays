"use client";

// Cookie-Hinweis der Kunden-Website (0426).
//
// Bewusst schlicht und ohne Zustimmungs-Verwaltung: dieser Hinweis begleitet
// eine Seite, die selbst keine Tracking-Cookies setzt. Sobald der Betrieb per
// `custom_js` ein Analytics-Skript einbindet, braucht er eine echte
// Consent-Lösung — das sagt der Text im Baukasten auch, und die Entscheidung
// bleibt bei ihm. Ein Banner, das „Zustimmung" behauptet und trotzdem beim
// ersten Aufruf lädt, wäre schlimmer als keines.
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

"use client";

// Die klebende Hinweisleiste über der Seite (0440, Dudas „Top bar message").
//
// Sie hat KEINE Abschnitte, sondern einen Satz, wahlweise einen Knopf und zwei
// Farben. Das ist Absicht: eine Leiste, in die man Blöcke bauen kann, wird zu
// einem zweiten Kopfbereich — und dann verdeckt sie die Seite, statt sie zu
// ergänzen.
//
// KOLLISION MIT DEM COOKIE-HINWEIS: Bei Duda steht dazu nur der Satz „Do not
// use the Notification Bar if you have the Cookie Notification enabled. The
// Cookie Notification takes priority and covers the notification bar." — also:
// die Leiste verschwindet unter dem Banner, und der Kunde darf selbst darauf
// kommen. Wir lösen es stattdessen: solange der Cookie-Hinweis offen ist,
// erscheint die Leiste gar nicht erst. Zwei Balken übereinander sind kein
// Layout, sondern ein Fehler.
import { useEffect, useState } from "react";

import { texte } from "@/lib/texte";

export type HinweisleisteDaten = {
  text: Record<string, string>;
  knopf_text?: Record<string, string>;
  knopf_url?: string | null;
  hintergrund?: string | null;
  schrift?: string | null;
  schliessbar?: boolean;
};

/** Text in der Sprache des Gastes, sonst in der Standardsprache, sonst der
 *  erste vorhandene.
 *
 *  Kein erfundener Ersatz: gibt es gar nichts, bleibt die Leiste weg. Eine
 *  Leiste ohne Text ist ein farbiger Streifen, der Platz kostet. */
function textFuer(
  werte: Record<string, string> | undefined,
  sprache: string,
  standard: string,
): string {
  if (!werte) return "";
  const kandidaten = [sprache, standard, ...Object.keys(werte)];
  for (const k of kandidaten) {
    const wert = (werte[k] || "").trim();
    if (wert) return wert;
  }
  return "";
}

export function Hinweisleiste({
  daten,
  sprache,
  standardSprache,
  cookieOffen,
  onGeschlossen,
}: {
  daten: HinweisleisteDaten;
  sprache: string;
  standardSprache: string;
  /** Ist der Cookie-Hinweis gerade sichtbar? Dann tritt die Leiste zurück. */
  cookieOffen: boolean;
  onGeschlossen: () => void;
}) {
  const [offen, setOffen] = useState(true);
  const t = texte(sprache);
  const text = textFuer(daten.text, sprache, standardSprache);
  const knopf = textFuer(daten.knopf_text, sprache, standardSprache);

  // Die Leiste schiebt den Seiteninhalt nicht, sie liegt darüber. Damit der
  // Kopfbereich nicht darunter verschwindet, bekommt der Body oben so viel
  // Abstand, wie die Leiste hoch ist — gemessen, nicht geraten: der Text kann
  // auf dem Telefon zweizeilig werden.
  useEffect(() => {
    if (!offen || !text || cookieOffen) return undefined;
    const leiste = document.getElementById("nd-hinweisleiste");
    if (!leiste) return undefined;
    function messen() {
      document.body.style.paddingTop = `${leiste!.offsetHeight}px`;
    }
    messen();
    const beobachter = new ResizeObserver(messen);
    beobachter.observe(leiste);
    return () => {
      beobachter.disconnect();
      document.body.style.paddingTop = "";
    };
  }, [offen, text, cookieOffen]);

  if (!offen || !text || cookieOffen) return null;

  return (
    <div
      id="nd-hinweisleiste"
      role="region"
      aria-label={text}
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-3 px-4 py-2 text-center text-sm"
      style={{
        backgroundColor: daten.hintergrund || "#111827",
        color: daten.schrift || "#ffffff",
      }}
    >
      <span>{text}</span>
      {knopf && daten.knopf_url ? (
        <a
          href={daten.knopf_url}
          className="shrink-0 rounded-full border border-current px-3 py-1 text-xs font-semibold"
        >
          {knopf}
        </a>
      ) : null}
      {daten.schliessbar === false ? null : (
        <button
          type="button"
          aria-label={t.popupSchliessen}
          onClick={() => {
            setOffen(false);
            onGeschlossen();
          }}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-lg leading-none opacity-70 transition hover:opacity-100"
        >
          ×
        </button>
      )}
    </div>
  );
}

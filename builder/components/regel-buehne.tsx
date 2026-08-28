"use client";

// Die Bühne der Personalisierungs-Regeln (0440).
//
// Sie tut drei Dinge und sonst nichts:
//   1. den Besuch zählen (einmal je Seitenaufbau),
//   2. die greifenden Regeln bestimmen (`lib/regeln`),
//   3. je Aktionsart genau eine Aktion ausspielen.
//
// WARUM HIER UND NICHT IM LAYOUT: Die Auswertung braucht Fensterbreite, Pfad,
// Query-String und `localStorage`. Alles davon gibt es erst im Browser. Ein
// Server-Component könnte höchstens raten — und Raten ist bei Personalisierung
// dasselbe wie Falschausspielen.
//
// WARUM DIE REGELN NICHT HIER GEHOLT WERDEN: Sie kommen als Prop vom Server,
// der sie ohnehin schon für die Seite lädt. Ein zweiter Abruf aus dem Browser
// wäre eine zusätzliche Anfrage pro Seitenansicht, und die Regeln ändern sich
// nicht zwischen Serveraufbau und erstem Bild.
import { useEffect, useMemo, useState } from "react";

import { Effekte, type EffektName } from "@/components/effekte";
import { Hinweisleiste, type HinweisleisteDaten } from "@/components/hinweisleiste";
import { Popups, type PopupDaten, type PopupPosition } from "@/components/popups";
import {
  besuchZaehlen,
  gezeigtMerken,
  greifendeRegeln,
  type Besuchsstand,
  type Regel,
} from "@/lib/regeln";

/** Wandelt die Pop-up-Aktion einer Regel in das um, was `Popups` versteht.
 *
 *  Der Zeitpunkt der REGEL ersetzt den Auslöser AM Pop-up (0437): eine Regel,
 *  die „nach 3 Sekunden" sagt, soll das auch dann tun, wenn am Pop-up selbst
 *  „beim Verlassen" steht. Sonst gäbe es zwei Wahrheiten für dieselbe Frage. */
function alsPopup(regel: Regel, titel: string): PopupDaten | null {
  const a = regel.action as {
    page_id?: string;
    zeitpunkt?: "sofort" | "verzoegert" | "verlassen" | "scroll";
    wert?: number | null;
    position?: PopupPosition | null;
  };
  if (!a.page_id) return null;
  const zeitpunkt = a.zeitpunkt ?? "sofort";
  return {
    id: a.page_id,
    title: titel,
    // „sofort" gibt es in `PopupDaten` nicht als eigenen Auslöser — es ist eine
    // Verzögerung von null. Einen vierten Auslöser einzuführen, der dasselbe
    // tut wie ein vorhandener mit dem Wert 0, wäre eine Unterscheidung ohne
    // Unterschied.
    trigger:
      zeitpunkt === "verlassen"
        ? "exit"
        : zeitpunkt === "scroll"
          ? "scroll"
          : "delay",
    value: zeitpunkt === "sofort" ? 0 : (a.wert ?? null),
    device: null,
    once: regel.einmal_je_besucher,
    position: a.position ?? null,
    merken: () => gezeigtMerken(regel),
  };
}

export function RegelBuehne({
  regeln,
  ortVerfuegbar,
  sprache,
  standardSprache,
  popupInhalte,
  popupTitel,
  cookieOffen = false,
}: {
  regeln: Regel[];
  ortVerfuegbar: boolean;
  sprache: string;
  standardSprache: string;
  /** Der gerenderte Inhalt je Pop-up, nach ID — entsteht serverseitig. */
  popupInhalte: Record<string, React.ReactNode>;
  popupTitel: Record<string, string>;
  cookieOffen?: boolean;
}) {
  // `null` heißt „noch nicht ausgewertet". Ein leeres Array hieße „ausgewertet,
  // nichts greift" — der Unterschied entscheidet, ob wir schon etwas zeigen
  // dürfen. Ohne ihn blitzt beim ersten Bild eine Aktion auf, die nach der
  // Auswertung wieder verschwindet.
  const [greifend, setGreifend] = useState<Regel[] | null>(null);
  const [besuche, setBesuche] = useState<Besuchsstand | null>(null);

  useEffect(() => {
    setBesuche(besuchZaehlen());
  }, []);

  useEffect(() => {
    if (!besuche) return;
    setGreifend(
      greifendeRegeln(regeln, {
        breite: window.innerWidth,
        pfad: window.location.pathname,
        suche: window.location.search,
        jetzt: new Date(),
        besuche,
        ortVerfuegbar,
      }),
    );
  }, [regeln, besuche, ortVerfuegbar]);

  const leiste = useMemo(
    () => greifend?.find((r) => r.action_type === "top_bar") ?? null,
    [greifend],
  );
  const effekt = useMemo(
    () => greifend?.find((r) => r.action_type === "effect") ?? null,
    [greifend],
  );
  const popupRegel = useMemo(
    () => greifend?.find((r) => r.action_type === "popup") ?? null,
    [greifend],
  );
  const skript = useMemo(
    () => greifend?.find((r) => r.action_type === "script") ?? null,
    [greifend],
  );

  // Ein Effekt gilt als gezeigt, sobald er läuft.
  //
  // Eigener Effekt statt eines Aufrufs beim Rendern: `gezeigtMerken` schreibt
  // in den Browserspeicher, und Schreiben während des Renderns ist ein
  // Seiteneffekt an der falschen Stelle — React ruft eine Komponente im
  // Strict-Modus zweimal auf, und der Zähler stünde danach falsch.
  useEffect(() => {
    if (effekt) gezeigtMerken(effekt);
  }, [effekt]);

  // Eigenes JavaScript des Betriebs.
  //
  // Über ein Script-Element und nicht über `eval`: so gilt dieselbe Content
  // Security Policy wie für jeden anderen Code der Seite, der Fehler landet mit
  // Zeilennummer in der Konsole, und der Betrieb kann sein Skript im
  // Entwicklerwerkzeug finden. `eval` wäre unsichtbar und CSP-fest zugleich —
  // also schlechter in beiden Richtungen.
  useEffect(() => {
    if (!skript) return undefined;
    const code = (skript.action as { code?: string }).code;
    if (!code) return undefined;
    const element = document.createElement("script");
    element.type = "text/javascript";
    element.dataset.ndRegel = skript.id;
    element.text = code;
    document.body.appendChild(element);
    gezeigtMerken(skript);
    return () => {
      element.remove();
    };
  }, [skript]);

  const popups = useMemo(() => {
    if (!popupRegel) return [];
    const eintrag = alsPopup(popupRegel, popupTitel[
      (popupRegel.action as { page_id?: string }).page_id ?? ""
    ] ?? "");
    return eintrag ? [eintrag] : [];
  }, [popupRegel, popupTitel]);

  if (!greifend) return null;

  return (
    <>
      {leiste ? (
        <Hinweisleiste
          daten={leiste.action as unknown as HinweisleisteDaten}
          sprache={sprache}
          standardSprache={standardSprache}
          cookieOffen={cookieOffen}
          onGeschlossen={() => gezeigtMerken(leiste)}
        />
      ) : null}
      {effekt ? (
        <Effekte
          effekt={(effekt.action as { effekt?: EffektName }).effekt ?? "schnee"}
          dauerSekunden={
            (effekt.action as { dauer_sekunden?: number }).dauer_sekunden ?? 15
          }
        />
      ) : null}
      {popups.length ? (
        <Popups popups={popups} sprache={sprache} kinder={popupInhalte} />
      ) : null}
    </>
  );
}

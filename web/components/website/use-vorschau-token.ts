"use client";

// Der Vorschau-Token — EIN Weg für alle drei Reiter, die eine Vorschau zeigen.
//
// WARUM ALS HOOK
// Dieselben zwölf Zeilen standen dreimal da (Abschnitts-Editor, Design-Reiter,
// Vorlagen-Reiter) und einmal, mit `.catch`, in der Kopfzeile. Genau die drei
// ohne `.catch` waren kaputt: wirft die Server-Action (Netzfehler, abgelaufene
// Sitzung, veralteter Action-Bezeichner nach einem Hot-Reload), läuft weder der
// Erfolgs- noch der Fehlerzweig. `token` blieb `null`, `tokenFehler` blieb
// `false` — und die Vorschau zeigte für immer „wird vorbereitet" statt der
// Fehlermeldung, die direkt daneben schon programmiert war (Nachprüfung, neuer
// Befund 2: `/website/vorlagen` hing minutenlang).
//
// Ein verschluckter Fehler, der als „lädt noch" aussieht, ist Wurzel 5 — und
// dass die Kopfzeile ihn schon gelernt hatte, während drei Kopien daneben
// weiterliefen, ist Wurzel 2: eine Lehre, die nur eine von vier Stellen
// erreicht, ist keine.
import { useEffect, useState } from "react";

/** Wie ein Token-Abruf ausgeht. Dieselbe Form wie die Server-Actions
 *  `createDraftToken`/`createTemplatePreviewToken`. */
type TokenErgebnis =
  | { ok: true; data: { token: string } }
  | { ok: false; error: string };

/**
 * Holt einen Vorschau-Token für `schluessel` und hält seinen Zustand.
 *
 * `schluessel` ist die Seiten- bzw. Vorlagen-ID; `null` heißt „nichts zu
 * holen" (kein Abruf, kein Fehler). Wechselt er, wird der alte Abruf verworfen
 * — ohne das setzte eine langsame Antwort den Token einer Seite, die man
 * inzwischen verlassen hat.
 *
 * `holen` MUSS bei jedem Render dieselbe Funktion sein oder stabil referenziert
 * werden; der Effekt hört nur auf `schluessel`.
 */
export function useVorschauToken(
  schluessel: string | null,
  holen: (schluessel: string) => Promise<TokenErgebnis>,
): { token: string | null; tokenFehler: boolean } {
  const [token, setToken] = useState<string | null>(null);
  const [tokenFehler, setTokenFehler] = useState(false);

  useEffect(() => {
    if (!schluessel) {
      setToken(null);
      setTokenFehler(false);
      return;
    }
    let lebt = true;
    setToken(null);
    setTokenFehler(false);
    holen(schluessel)
      .then((res) => {
        if (!lebt) return;
        if (res.ok) setToken(res.data.token);
        else setTokenFehler(true);
      })
      .catch(() => {
        // Ein Wurf ist hier ein normaler Ausgang, kein Sonderfall: die
        // Server-Action geht übers Netz. Er MUSS im Fehlerzustand landen —
        // sonst bleibt der Ladezustand für immer stehen und sieht aus wie
        // Arbeit, die noch läuft (Wurzel 5).
        if (lebt) setTokenFehler(true);
      });
    return () => {
      lebt = false;
    };
    // `holen` bewusst nicht in der Liste: es ist bei jedem Render eine neue
    // Funktion (ein Verweis auf die Server-Action), und ein Neu-Erzeugen des
    // Rückrufs ist kein Grund, einen neuen Token zu holen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schluessel]);

  return { token, tokenFehler };
}

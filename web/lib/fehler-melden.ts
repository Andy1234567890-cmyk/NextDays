// Einen Serverfehler so melden, dass er auffindbar bleibt.
//
// WOFUER: Bei einem 500 sendet der Server bewusst nur „internal_error" (kein
// Stacktrace im Browser, Wurzel 5). Ein `toast.error(res.error)` zeigte
// deshalb genau dieses eine Wort — und war nach vier Sekunden weg. Weder der
// Betrieb noch der Support konnte danach noch sagen, welcher Aufruf es war.
//
// Dabei liegt die Ursache im Server bereit: `merke_ursache` hinterlegt
// Exception-Typ und die letzte EIGENE Codezeile unter der Request-ID, die in
// jeder Fehlerantwort steht. Dieser Helfer bringt die Kennung in die Meldung
// und laesst sie stehen, bis sie jemand wegklickt.
//
// WARUM EIN HELFER und nicht 38-mal derselbe Dreizeiler: genau diese 38
// Aufrufe standen im Aufgaben-Bereich, alle als `toast.error(res.error)`. Wer
// eine neue Meldung schreibt, greift hierher statt die Kennung erneut zu
// verlieren.

import { toast } from "sonner";

/** Was ein fehlgeschlagener `Result` mitbringt. Absichtlich strukturell
 *  getippt: den `Result`-Typ gibt es in jedem `lib/<domäne>.ts` als eigene
 *  Kopie, ein Import daraus haette hier eine Domaene bevorzugt. */
type Fehlgeschlagen = {
  error: string;
  status?: number;
  requestId?: string;
};

/**
 * Serverfehler als Toast melden — mit Kennung, wenn es eine gibt.
 *
 * Ohne `requestId` verhaelt es sich wie `toast.error(res.error)` vorher: bei
 * einem fachlichen Fehler („Objekt gehoert nicht zu diesem Konto") ist die
 * Meldung selbst die Auskunft, eine Kennung waere nur Rauschen.
 *
 * MIT Kennung bleibt der Toast stehen (`duration: Infinity`): eine Nummer,
 * die man abschreiben oder kopieren soll, darf nicht nach vier Sekunden
 * verschwinden. Das ist der Unterschied zwischen „da war ein Fehler" und
 * einem Fehler, den jemand nachverfolgen kann.
 */
export function fehlerMelden(res: Fehlgeschlagen, titel?: string): void {
  const nachricht = titel ? `${titel}: ${res.error}` : res.error;
  if (!res.requestId) {
    toast.error(nachricht);
    return;
  }
  const kennung = res.requestId;
  toast.error(nachricht, {
    description: kennung,
    duration: Infinity,
    closeButton: true,
    action: {
      label: "⧉",
      onClick: () => {
        // `navigator.clipboard` fehlt ohne HTTPS und in aelteren Browsern —
        // dann still nichts tun statt die Seite mit einem TypeError zu killen.
        void navigator.clipboard?.writeText(`${nachricht} · ${kennung}`);
      },
    },
  });
}

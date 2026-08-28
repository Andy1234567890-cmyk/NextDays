"use client";

// Rückgängig und Wiederholen für den Abschnitts-Editor.
//
// Im Vorbild stehen die beiden Pfeile fest in der Kopfzeile (`docs/UI`, Foto
// 19.04.39). Bei uns gab es sie überhaupt nicht — bei einem Editor mit
// Autospeichern ist das kein Komfortmangel, sondern eine Lücke: es gibt keinen
// Speichern-Knopf, den man NICHT drückt. Wer einen Abschnitt löscht, hat ihn
// 900 ms später gelöscht, und der einzige Rückweg war, ihn neu anzulegen und
// von Hand nachzufüllen.
//
// WAS EIN SCHRITT IST
// Nicht jeder Tastendruck. Der Verlauf merkt sich einen Stand erst, wenn er
// eine Weile RUHT (`RUHE_MS`) — sonst wäre ein getippter Satz vierzig Schritte
// und der Pfeil nähme pro Klick einen Buchstaben zurück. Dieselbe Ruhe, die das
// Autospeichern benutzt, mit demselben Grund.
//
// WARUM DER VERLAUF DEN WERT KOPIERT
// Er hält JSON-Zeichenketten, nicht die Objekte selbst. Ein Verlauf aus
// Verweisen auf dieselben Objekte wäre kein Verlauf: der Editor arbeitet mit
// `structuredClone` an manchen Stellen und mit Streuung (`{...r}`) an anderen,
// und ein einziger übersehener geteilter Unterbaum machte jeden früheren Stand
// still zum aktuellen.
//
// WAS EIN SCHRITT NICHT IST: BUCHHALTUNG
// Nicht jedes Feld des beobachteten Werts ist eine Nutzeränderung. Im
// Abschnitts-Editor trägt jede Zeile eine `id` — `null`, solange sie nie
// gespeichert war, danach die DB-ID, die das Autospeichern nachträgt. Diese
// Zuweisung ist kein Schritt, den jemand zurücknehmen will; sie ist die Quittung
// des Servers.
//
// Wurde sie mitverglichen, war ein neuer Abschnitt ZWEI Stände: einer ohne ID
// (700 ms nach dem Einfügen gemerkt) und einer mit (900 ms später, wenn die
// Antwort kam). Die Folgen, alle drei gemessen (Nachprüfung A1):
//
//   · ↺ spielte den Stand OHNE ID ein. Der Server sah eine Zeile ohne ID, legte
//     sie NEU an und löschte die alte — für den Kunden sah ↺ aus wie „passiert
//     nichts", in der DB war es ein Identitätswechsel. Alles, was auf die alte
//     ID zeigte (ein ausgeliefertes Formular über `block_id`), zeigte danach
//     ins Leere.
//   · Der zurückkommende Stand unterschied sich von dem, was `springe`
//     hinterlegt hatte, also galt er als neue Nutzeränderung: der Zeiger sprang
//     ans Ende, ↻ blieb für immer tot.
//   · Ein zweites ↺ fand nichts mehr.
//
// Deshalb entscheidet der AUFRUFER über den Vergleich (`vergleiche`), und beim
// Zurückspielen behält der Aufrufer die heutigen IDs (`uebernehme`). Der Verlauf
// führt die Gestalt der Seite, nicht ihre Buchhaltung.
import { useCallback, useEffect, useRef, useState } from "react";

/** Wie lange ein Stand ruhen muss, bevor er ein Schritt wird. */
const RUHE_MS = 700;

/** Wie viele Schritte aufgehoben werden.
 *
 *  Fünfzig und nicht unbegrenzt: jeder Schritt ist eine vollständige Kopie der
 *  Seite, und eine Seite darf bis zu `MAX_ABSCHNITTE` Bausteine mit Inhalt in
 *  24 Sprachen tragen. Unbegrenzt hieße, dass ein langer Arbeitstag im
 *  Browserspeicher wächst, bis der Reiter stirbt — und zwar erst nach Stunden,
 *  also genau dann, wenn am meisten offen ist. */
const MAX_SCHRITTE = 50;

export type Verlauf<T> = {
  /** Ist ein Schritt zurück möglich? */
  kannZurueck: boolean;
  kannVor: boolean;
  /** Einen Schritt zurück. Gibt den Stand zurück, den der Aufrufer setzen
   *  soll, oder `null`, wenn es nichts zurückzunehmen gibt. */
  zurueck: () => T | null;
  vor: () => T | null;
  /** Den Verlauf auf einen Stand zurücksetzen (neue Seite geladen). */
  neuAnfangen: (wert: T) => void;
};

/**
 * Verlauf über einen beliebigen serialisierbaren Wert.
 *
 * Der Hook BEOBACHTET `wert` und schreibt selbst mit; der Aufrufer muss nichts
 * melden. Das ist Absicht: ein Editor, der bei jeder Änderung zusätzlich
 * „merk dir das" rufen müsste, vergisst es an der dritten Stelle — und man
 * merkt es erst, wenn der Pfeil einen Schritt überspringt.
 *
 * Ein Stand, den der Hook SELBST gesetzt hat (durch `zurueck`/`vor`), darf
 * nicht als neuer Schritt zurück in den Verlauf wandern. Sonst wäre einmal
 * Zurück und einmal Vor eine Endlosschleife aus zwei Ständen.
 */
export function useVerlauf<T>(
  wert: T,
  optionen?: {
    /** Was VERGLICHEN wird, um einen neuen Schritt zu erkennen. Ohne diese
     *  Funktion der ganze Wert.
     *
     *  Sie blendet Felder aus, die der Server nachträgt (IDs, Zeitstempel):
     *  eine Änderung nur darin ist keine Nutzeränderung, und sie als Schritt zu
     *  führen macht den Verlauf unbrauchbar (siehe Kopf dieser Datei). */
    vergleiche?: (wert: T) => unknown;
    /** Wie ein zurückgespielter Stand mit dem AKTUELLEN zusammengeführt wird.
     *
     *  Nötig als Gegenstück zu `vergleiche`: was dort ausgeblendet ist, steht
     *  im gemerkten Stand veraltet (oder gar nicht) und muss aus dem aktuellen
     *  kommen. Ohne das schickte ↺ einen Stand ohne DB-IDs an den Server.
     *  Ohne diese Funktion wird der gemerkte Stand unverändert genommen. */
    uebernehme?: (gemerkt: T, aktuell: T) => T;
  },
): Verlauf<T> {
  const vergleiche = optionen?.vergleiche;
  const uebernehme = optionen?.uebernehme;
  // Beide über eine Ref, weil ein Aufrufer sie inline schreibt (bei jedem
  // Render eine neue Funktion). In den Abhängigkeiten stünden sie sonst
  // dauernd als „geändert" und der Effekt liefe endlos.
  const vergleicheRef = useRef(vergleiche);
  vergleicheRef.current = vergleiche;
  const uebernehmeRef = useRef(uebernehme);
  uebernehmeRef.current = uebernehme;
  // Der AKTUELLE Wert für `uebernehme` — er darf nicht in den Abhängigkeiten
  // des Sprungs stehen, sonst wäre `zurueck`/`vor` bei jeder Änderung eine
  // neue Funktion.
  const wertRef = useRef(wert);
  wertRef.current = wert;

  const zuText = useCallback((w: T): string => {
    const v = vergleicheRef.current;
    return JSON.stringify(v ? v(w) : w);
  }, []);

  // Der Verlauf hält ZWEI Zeichenketten je Schritt: `roh` ist der vollständige
  // Wert (der wiederhergestellt wird), `sicht` die verglichene Projektion.
  // Nur eine von beiden zu halten geht nicht — mit `roh` allein wäre jede
  // ID-Nachtragung ein Schritt, mit `sicht` allein wäre der Inhalt verloren.
  const [staende, setStaende] = useState<Array<{ roh: string; sicht: string }>>(
    () => [{ roh: JSON.stringify(wert), sicht: zuText(wert) }],
  );
  const [zeiger, setZeiger] = useState(0);
  // Was der Hook zuletzt selbst gesetzt hat — als PROJEKTION. Kommt genau
  // dieser Stand als `wert` zurück, ist es das Echo des eigenen Sprungs und
  // kein neuer Schritt.
  const eigenerSprung = useRef<string | null>(null);

  const roh = JSON.stringify(wert);
  const sicht = zuText(wert);

  useEffect(() => {
    if (eigenerSprung.current === sicht) {
      eigenerSprung.current = null;
      return;
    }
    const timer = setTimeout(() => {
      setStaende((alt) => {
        // Nichts Neues — das passiert bei jedem Render, in dem sich nur eine
        // Auswahl geändert hat, UND bei jeder ID-Nachtragung des Servers.
        if (alt[zeiger]?.sicht === sicht) {
          // Der ROHE Stand wird trotzdem nachgezogen: die Gestalt ist
          // dieselbe, aber die Zeile trägt jetzt ihre DB-ID. Ohne das läge im
          // Verlauf weiter der Stand ohne ID, und ein späteres ↺ schickte ihn
          // an den Server — genau die Identitätsrotation, die A1 verursachte.
          if (alt[zeiger].roh === roh) return alt;
          const kopie = alt.slice();
          kopie[zeiger] = { roh, sicht };
          return kopie;
        }
        // Alles NACH dem Zeiger fällt weg: wer zurückgegangen ist und dann
        // etwas anderes tut, hat einen neuen Ast aufgemacht. Der alte ist
        // damit unerreichbar — ihn aufzuheben hieße, dass „Wiederholen"
        // irgendwann einen Stand einsetzt, der nie zu dieser Arbeit gehörte.
        const behalten = alt.slice(0, zeiger + 1);
        behalten.push({ roh, sicht });
        const ueberzaehlig = Math.max(0, behalten.length - MAX_SCHRITTE);
        const neu = behalten.slice(ueberzaehlig);
        // Der Zeiger wandert mit — sonst zeigt er nach dem Abschneiden auf
        // einen Stand weiter vorn und der nächste Klick springt weit zurück.
        setZeiger(neu.length - 1);
        return neu;
      });
    }, RUHE_MS);
    return () => clearTimeout(timer);
  }, [roh, sicht, zeiger]);

  const springe = useCallback(
    (richtung: -1 | 1): T | null => {
      const ziel = zeiger + richtung;
      const stand = staende[ziel];
      if (stand === undefined) return null;
      const gemerkt = JSON.parse(stand.roh) as T;
      // Was `vergleiche` ausblendet, kommt aus dem AKTUELLEN Wert — sonst
      // spielte ↺ veraltete oder fehlende DB-IDs zurück.
      const u = uebernehmeRef.current;
      const ergebnis = u ? u(gemerkt, wertRef.current) : gemerkt;
      // Gemerkt wird die PROJEKTION des Ergebnisses, nicht die des gemerkten
      // Stands: der Effekt oben vergleicht gegen das, was tatsächlich gesetzt
      // wird. Wichen die beiden ab, hielte der Hook seinen eigenen Sprung für
      // eine Nutzeränderung, hängte ihn als Schritt an und ↻ wäre tot.
      eigenerSprung.current = zuText(ergebnis);
      setZeiger(ziel);
      return ergebnis;
    },
    [staende, zeiger, zuText],
  );

  const neuAnfangen = useCallback(
    (neuerWert: T) => {
      const eintrag = { roh: JSON.stringify(neuerWert), sicht: zuText(neuerWert) };
      eigenerSprung.current = eintrag.sicht;
      setStaende([eintrag]);
      setZeiger(0);
    },
    [zuText],
  );

  return {
    kannZurueck: zeiger > 0,
    kannVor: zeiger < staende.length - 1,
    zurueck: useCallback(() => springe(-1), [springe]),
    vor: useCallback(() => springe(1), [springe]),
    neuAnfangen,
  };
}

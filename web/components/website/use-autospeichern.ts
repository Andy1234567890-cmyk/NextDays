"use client";

// Autospeichern für den Baukasten.
//
// Warum kein Speichern-Knopf: der Kunde stellt eine Farbe ein, sieht das
// Ergebnis rechts und klickt weiter — dass er dazwischen etwas bestätigen muss,
// ist eine Fehlerquelle ohne Nutzen. Im Markt ist Autospeichern hier Standard.
//
// Zwei Dinge machen das sicher:
//  • Entprellung: erst wenn eine Weile nichts mehr passiert, wird geschrieben.
//    Sonst löst jeder Tastendruck in einem Hex-Feld einen Request aus — und ein
//    halb getipptes „#ab" wäre ein 422.
//  • Nur der DIFF gegen den letzten bestätigten Stand wird gesendet. Ein Lauf,
//    der nichts geändert hat, schickt auch nichts.
//
// Der zuletzt vom Server bestätigte Stand ist die Wahrheit, nicht der lokale:
// so ergibt ein zweiter Lauf mit demselben Inhalt keinen zweiten Schreibvorgang
// (Wurzel 2 — real kommt alles doppelt).
import { useCallback, useEffect, useRef, useState } from "react";

import type { SpeicherStand } from "./schale";

const ENTPRELLUNG_MS = 900;
/** Wie lange „gespeichert" stehen bleibt, bevor die Anzeige verstummt. */
const QUITTUNG_MS = 2500;

export function useAutospeichern<T>({
  wert,
  bestaetigt,
  speichern,
  gueltig,
}: {
  /** Aktueller Bearbeitungsstand. */
  wert: T;
  /** Letzter vom Server bestätigter Stand. */
  bestaetigt: T;
  /** Schreibt den Diff. Gibt den neuen bestätigten Stand zurück oder einen Fehler. */
  speichern: (
    diff: Partial<T>,
  ) => Promise<{ ok: true; data: T } | { ok: false; error: string }>;
  /** false = noch nicht schreibbar (z. B. halb getippter Hex-Wert). */
  gueltig?: (wert: T) => boolean;
}): {
  stand: SpeicherStand;
  /** Der Stand, den der Server bestätigt hat — der Aufrufer übernimmt ihn. */
  uebernommen: T | null;
  fehler: string | null;
  /** Sofort schreiben, ohne auf die Entprellung zu warten (z. B. beim Verlassen). */
  jetzt: () => void;
} {
  const [stand, setStand] = useState<SpeicherStand>("ruht");
  const [uebernommen, setUebernommen] = useState<T | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  // In Refs, damit der Timer immer den frischen Stand sieht, ohne bei jedem
  // Tastendruck neu aufgesetzt zu werden.
  const wertRef = useRef(wert);
  const bestaetigtRef = useRef(bestaetigt);
  const laeuft = useRef(false);
  wertRef.current = wert;
  bestaetigtRef.current = bestaetigt;

  // Auch die Callbacks in Refs: `speichern` wird vom Aufrufer meist als
  // Inline-Funktion übergeben und hat damit bei JEDEM Render eine neue
  // Identität. Hing `schreibe` daran, wurde der Entprellungs-Timer bei jedem
  // Render neu aufgesetzt — und nach einem Fehlschlag erzeugten die eigenen
  // setState-Aufrufe Renders, die den nächsten Versuch bewaffneten: ein
  // Anfrage-Sturm mit einem roten Hinweis pro Sekunde, bis der Kunde die Seite
  // verließ.
  const speichernRef = useRef(speichern);
  const gueltigRef = useRef(gueltig);
  speichernRef.current = speichern;
  gueltigRef.current = gueltig;

  /** Der Stand, der bereits einmal fehlgeschlagen ist. Solange sich daran
   *  nichts ändert, wird nicht erneut versucht — sonst läuft ein dauerhafter
   *  Fehler (z. B. eine halb getippte Adresse) in eine Endlosschleife. */
  const gescheitertAn = useRef<string | null>(null);

  const schreibe = useCallback(async () => {
    if (laeuft.current) return;
    const jetztWert = wertRef.current;
    const jetztBestaetigt = bestaetigtRef.current;
    const pruefe = gueltigRef.current;
    if (pruefe && !pruefe(jetztWert)) return;
    // Derselbe Stand, der schon einmal abgelehnt wurde: nicht erneut senden.
    if (gescheitertAn.current === JSON.stringify(jetztWert)) return;

    const diff: Record<string, unknown> = {};
    for (const k of Object.keys(jetztWert as object)) {
      const a = (jetztWert as Record<string, unknown>)[k];
      const b = (jetztBestaetigt as Record<string, unknown>)[k];
      // Strukturvergleich, weil Felder auch Objekte/Arrays sein können
      // (Locale-Maps, Bilderlisten).
      if (JSON.stringify(a) !== JSON.stringify(b)) diff[k] = a;
    }
    if (Object.keys(diff).length === 0) return;

    laeuft.current = true;
    setStand("speichert");
    setFehler(null);
    const res = await speichernRef.current(diff as Partial<T>);
    laeuft.current = false;
    if (!res.ok) {
      // Diesen Stand merken, damit derselbe Fehler nicht im Sekundenrhythmus
      // erneut auflaufen kann. Ändert der Kunde etwas, ist der Merker hinfällig.
      gescheitertAn.current = JSON.stringify(jetztWert);
      setStand("fehler");
      setFehler(res.error);
      return;
    }
    gescheitertAn.current = null;
    setUebernommen(res.data);
    setStand("gespeichert");
  }, []);

  // Entprellter Lauf bei jeder Änderung.
  useEffect(() => {
    const gleich =
      JSON.stringify(wert) === JSON.stringify(bestaetigt);
    if (gleich) return;
    const timer = setTimeout(() => void schreibe(), ENTPRELLUNG_MS);
    return () => clearTimeout(timer);
  }, [wert, bestaetigt, schreibe]);

  // „gespeichert" nach einer Weile verstummen lassen — eine Quittung, die stehen
  // bleibt, wirkt wie ein Zustand statt wie eine Rückmeldung.
  useEffect(() => {
    if (stand !== "gespeichert") return;
    const timer = setTimeout(() => setStand("ruht"), QUITTUNG_MS);
    return () => clearTimeout(timer);
  }, [stand]);

  return { stand, uebernommen, fehler, jetzt: () => void schreibe() };
}

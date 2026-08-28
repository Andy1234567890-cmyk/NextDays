"use client";

// Die zuletzt eingesetzten Bausteine — für die Sicht „Zuletzt" im Katalog.
//
// Im Vorbild steht sie ganz oben in der Kategorienspalte („Recent", `docs/UI`,
// Foto 19.02.58), und aus einem handfesten Grund: wer eine Seite baut, setzt
// dieselben fünf Bausteine immer wieder. Ohne diese Sicht sucht man jedes Mal
// neu in einer Liste von sechzig.
//
// WARUM IM BROWSER UND NICHT IN DER DATENBANK
// Es ist eine Bequemlichkeit für DIESEN Menschen an DIESEM Rechner, kein
// Zustand der Website. In der Datenbank wäre es eine Tabelle mit RLS, einem
// Endpunkt und einer Aufräumfrage — für eine Liste, die niemand vermisst, wenn
// sie leer ist.
//
// Jeder Zugriff ist gekapselt: in einem privaten Fenster, bei gesperrtem
// Website-Speicher oder in einer Vorlese-Umgebung wirft `localStorage` schon
// beim LESEN. Ein Katalog, der deshalb gar nicht erst erscheint, wäre der
// schlechtere Tausch (Wurzel 5: der Hauptpfad darf daran nicht kippen).
import { useCallback, useEffect, useState } from "react";

import type { BlockType } from "@/lib/site-pages";

/** Wie viele Einträge die Liste hält.
 *
 *  Acht und nicht „alle": „Zuletzt" heißt zuletzt. Eine Liste, die mit der Zeit
 *  jeden je benutzten Baustein enthält, ist wieder der ganze Katalog — nur in
 *  einer Reihenfolge, die niemand vorhersagen kann. */
const MAX = 8;

const SCHLUESSEL = "nextdays.baukasten.zuletzt";

function lesen(): BlockType[] {
  try {
    const roh = window.localStorage.getItem(SCHLUESSEL);
    if (!roh) return [];
    const wert: unknown = JSON.parse(roh);
    if (!Array.isArray(wert)) return [];
    // Nur Zeichenketten übernehmen. Was davon der Katalog noch kennt,
    // entscheidet er selbst — hier wird nicht gegen `ABSCHNITTE` geprüft, weil
    // diese Datei den Katalog nicht kennen soll und ein entfernter Baustein
    // dort ohnehin herausfällt.
    return wert.filter((v): v is BlockType => typeof v === "string");
  } catch {
    // Kein Zugriff auf den Speicher (privates Fenster, gesperrte Website-Daten)
    // oder kaputtes JSON. Beides heißt hier dasselbe: es gibt keine Liste.
    return [];
  }
}

export function useZuletzt(): {
  zuletzt: BlockType[];
  merken: (typ: BlockType) => void;
} {
  // Erst nach dem Einhängen lesen, nicht im `useState`-Initialisierer: auf dem
  // Server gibt es kein `window`, und ein Anfangswert, der sich beim ersten
  // Bild im Browser ändert, ist ein Hydrations-Unterschied.
  const [zuletzt, setZuletzt] = useState<BlockType[]>([]);

  useEffect(() => {
    setZuletzt(lesen());
  }, []);

  const merken = useCallback((typ: BlockType) => {
    setZuletzt((alt) => {
      // Der eben benutzte nach vorn, Doppelte raus. Ein Baustein, den man zum
      // dritten Mal einsetzt, soll oben stehen und nicht dreimal.
      const neu = [typ, ...alt.filter((t) => t !== typ)].slice(0, MAX);
      try {
        window.localStorage.setItem(SCHLUESSEL, JSON.stringify(neu));
      } catch {
        // Schreiben ging nicht — die Liste gilt trotzdem für diese Sitzung.
        // Sie ist eine Bequemlichkeit; sie darf das Einfügen nicht aufhalten.
      }
      return neu;
    });
  }, []);

  return { zuletzt, merken };
}

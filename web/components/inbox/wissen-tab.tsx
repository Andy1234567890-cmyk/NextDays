"use client";

// Wissensdatenbank der KI — ZWEI EBENEN: erst die Objekte, dann deren Fakten.
//
// Warum zwei Ebenen und nicht eine flache Liste: Ein Betrieb mit 44 Objekten
// und ein paar hundert Fakten sieht in einer flachen Liste nicht, WELCHE
// Objekte gepflegt sind — und genau das ist die Frage, die er hat. Die Spalte
// „Fakten" in der Objektliste beantwortet sie auf einen Blick.
//
// Die Zeile „Betriebsweit" ganz oben führt die Fakten ohne Objektbezug. In der
// Vorlage gibt es sie nicht (dort hängt jeder Fakt an einem Listing); ohne sie
// wären betriebsweite Fakten bei uns unerreichbar.
//
// Kein Realtime-Abo: `inbox_knowledge_fact` ist für anon/authenticated bewusst
// gesperrt (0260 — dort stehen Zugangsdaten). Ein Abo darauf wäre eine stumme
// Attrappe. Die Liste lädt nach jeder eigenen Änderung neu.
import { useCallback, useEffect, useState } from "react";

import {
  type WissenObjekt,
  type WissenObjektListe,
  listWissenObjekte,
} from "@/lib/inbox";

import { WissenFakten } from "./wissen-fakten";
import { WissenObjektliste } from "./wissen-objektliste";

/** Welches Objekt gerade offen ist. `null` = Ebene 1 (Objektliste),
 *  `"betriebsweit"` = die Fakten ohne Objektbezug. */
export type WissenAuswahl =
  | null
  | { art: "betriebsweit" }
  | { art: "objekt"; objekt: WissenObjekt };

export function WissenTab() {
  const [auswahl, setAuswahl] = useState<WissenAuswahl>(null);
  const [liste, setListe] = useState<WissenObjektListe | null>(null);
  const [suche, setSuche] = useState("");
  const [sortierung, setSortierung] = useState<"objekt" | "ort" | "geaendert">(
    "objekt",
  );
  const [absteigend, setAbsteigend] = useState(false);
  const [seite, setSeite] = useState(1);
  const [proSeite, setProSeite] = useState(20);
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = useCallback(async () => {
    const res = await listWissenObjekte({
      suche: suche || undefined,
      sortierung,
      absteigend,
      seite,
      proSeite,
    });
    if (res.ok) setListe(res.data);
    else setFehler(res.error);
  }, [suche, sortierung, absteigend, seite, proSeite]);

  useEffect(() => {
    void laden();
  }, [laden]);

  // Die Suche entprellen: sonst läuft je Tastendruck eine Abfrage.
  const [eingabe, setEingabe] = useState("");
  useEffect(() => {
    const id = setTimeout(() => {
      setSuche(eingabe);
      setSeite(1);
    }, 300);
    return () => clearTimeout(id);
  }, [eingabe]);

  if (auswahl) {
    return (
      <WissenFakten
        auswahl={auswahl}
        onZurueck={() => {
          setAuswahl(null);
          // Frisch laden: die Faktenzahl der Zeile hat sich geändert, wenn
          // drinnen etwas angelegt oder gelöscht wurde.
          void laden();
        }}
      />
    );
  }

  return (
    <WissenObjektliste
      liste={liste}
      fehler={fehler}
      suche={eingabe}
      onSuche={setEingabe}
      sortierung={sortierung}
      absteigend={absteigend}
      onSortieren={(s) => {
        if (s === sortierung) setAbsteigend((v) => !v);
        else {
          setSortierung(s);
          setAbsteigend(false);
        }
        setSeite(1);
      }}
      seite={seite}
      proSeite={proSeite}
      onSeite={setSeite}
      onProSeite={(n) => {
        setProSeite(n);
        setSeite(1);
      }}
      onOeffnen={setAuswahl}
    />
  );
}

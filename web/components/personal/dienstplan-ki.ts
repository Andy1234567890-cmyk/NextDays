"use client";

// KI-Zustand und -Aktionen des Dienstplans (Vertrag §2.3) als eigener Hook.
//
// WARUM AUSGELAGERT: `dienstplan.tsx` führt den Plan-Zustand — Fenster,
// Filter, Auswahl, Tausch. Prognose, Autoplan und Assistent haben davon
// NICHTS: sie hängen nur an der Woche und melden ihr Ergebnis zurück. Als
// eigener Hook ist ihr Zustand (fünf Felder) auch nur an einer Stelle zu
// finden, statt zwischen dem des Plans zu liegen.
//
// WAS HIER NICHT PASSIERT: Nachladen des Plans. Eine übernommene Prognose oder
// Variante schreibt Bedarf bzw. Schichten — was daraufhin neu zu holen ist,
// weiß der Dienstplan (Fenster, Kennzahlen, Bedarf-Editor), nicht dieser Hook.
// Er ruft dafür `onUebernommen` auf; ein Hook, der selbst nachlädt, müsste das
// Fenster kennen und wäre keine Trennung mehr.
//
// Die Läufe stehen in einer FINANZTABELLE ohne Grant (Vertrag §0) — es gibt
// dafür also kein Realtime-Abo, sondern nach eigener Aktion ein Nachladen.
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  autoplanStarten,
  getKiStatus,
  kiAssistent,
  listPlanungslaeufe,
  planungslaufUebernehmen,
  planungslaufVerwerfen,
  prognoseErzeugen,
  prognoseUebernehmen,
} from "@/lib/personal-planung";
import type {
  AssistentAntwort,
  AutoplanRequest,
  KiStatus,
  Planungslauf,
  Prognose,
} from "@/lib/personal-planung-typen";

export type KiZustand = {
  status: KiStatus | null;
  prognose: Prognose | null;
  prognoseFehlercode: string | null;
  lauf: Planungslauf | null;
  assistent: AssistentAntwort | null;
  prognoseErzeugen: () => Promise<void>;
  prognoseUebernehmen: (id: string) => Promise<void>;
  autoplan: (werte: AutoplanRequest) => Promise<void>;
  varianteUebernehmen: (id: string, variante: number) => Promise<void>;
  laufVerwerfen: (id: string) => Promise<void>;
  frage: (frage: string) => Promise<void>;
};

export function useDienstplanKi({
  woche,
  setLaeuft,
  protokoll,
  onUebernommen,
}: {
  woche: string;
  /** Das EINE Laufzeichen des Dienstplans — die Aktionen laufen nie parallel. */
  setLaeuft: (laeuft: boolean) => void;
  protokoll: (art: string, text: string, daten?: unknown) => void;
  /** Nach dem Übernehmen: der Dienstplan holt Plan, Kennzahlen und Bedarf neu. */
  onUebernommen: () => void;
}): KiZustand {
  const t = useTranslations("personal");
  const [status, setStatus] = useState<KiStatus | null>(null);
  const [prognose, setPrognose] = useState<Prognose | null>(null);
  const [prognoseFehlercode, setPrognoseFehlercode] = useState<string | null>(null);
  const [lauf, setLauf] = useState<Planungslauf | null>(null);
  const [assistent, setAssistent] = useState<AssistentAntwort | null>(null);

  // Status EINMAL laden — er entscheidet, ob das Panel Knöpfe zeigt.
  useEffect(() => {
    let abgebrochen = false;
    void (async () => {
      const res = await getKiStatus();
      if (abgebrochen) return;
      if (res.ok) setStatus(res.data);
      else setStatus({ konfiguriert: false, verbrauch_heute: 0, tageslimit: 0, solver: "" });
    })();
    return () => {
      abgebrochen = true;
    };
  }, []);

  async function prognoseAktion() {
    setLaeuft(true);
    setPrognoseFehlercode(null);
    const res = await prognoseErzeugen(woche);
    setLaeuft(false);
    if (!res.ok) {
      protokoll("fehler", `Prognose: ${res.status} ${res.error}`, res.details);
      // 422 `produktivitaet_fehlt` ist eine fehlende Eingabe, kein Ausfall —
      // das Panel zeigt dafür einen Hinweis mit Weg zu den Einstellungen.
      const code = typeof res.details?.code === "string" ? res.details.code : null;
      if (code) {
        setPrognoseFehlercode(code);
        return;
      }
      return void toast.error(res.error);
    }
    setPrognose(res.data);
    protokoll("ki", `Prognose ${res.data.id} (${res.data.status})`, res.data);
  }

  async function prognoseUebernehmenAktion(id: string) {
    setLaeuft(true);
    const res = await prognoseUebernehmen(id);
    setLaeuft(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(
      t("ki.bedarfUebernommen", { angelegt: res.data.angelegt, vorhanden: res.data.vorhanden }),
    );
    protokoll("ki", `Prognose ${id} übernommen`, res.data);
    onUebernommen();
  }

  async function autoplanAktion(werte: AutoplanRequest) {
    setLaeuft(true);
    const res = await autoplanStarten(woche, werte);
    setLaeuft(false);
    if (!res.ok) {
      protokoll("fehler", `Autoplan: ${res.status} ${res.error}`, res.details);
      return void toast.error(res.error);
    }
    setLauf(res.data);
    protokoll(
      "ki",
      `Autoplan ${res.data.id}: ${res.data.varianten.length} Varianten in ${res.data.dauer_ms ?? "?"} ms`,
      res.data,
    );
  }

  /** Nach Übernehmen/Verwerfen den Lauf frisch holen (kein Abo: Finanztabelle). */
  async function laufNachladen(id: string): Promise<Planungslauf | null> {
    const res = await listPlanungslaeufe(woche);
    if (!res.ok) return null;
    return res.data.find((l) => l.id === id) ?? null;
  }

  async function varianteUebernehmenAktion(id: string, variante: number) {
    setLaeuft(true);
    const res = await planungslaufUebernehmen(id, variante);
    setLaeuft(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(
      t("ki.varianteUebernommen", { angelegt: res.data.angelegt, vorhanden: res.data.vorhanden }),
    );
    protokoll("ki", `Lauf ${id} Variante ${variante} übernommen`, res.data);
    const neu = await laufNachladen(id);
    if (neu) setLauf(neu);
    onUebernommen();
  }

  async function laufVerwerfenAktion(id: string) {
    setLaeuft(true);
    const res = await planungslaufVerwerfen(id);
    setLaeuft(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(t("ki.laufVerworfen", { anzahl: res.data.geloescht }));
    protokoll("ki", `Lauf ${id} verworfen: ${res.data.geloescht} Entwürfe`);
    setLauf(null);
    onUebernommen();
  }

  async function frageAktion(frage: string) {
    setLaeuft(true);
    const res = await kiAssistent(frage, woche);
    setLaeuft(false);
    if (!res.ok) {
      protokoll("fehler", `Assistent: ${res.status} ${res.error}`, res.details);
      return void toast.error(res.error);
    }
    setAssistent(res.data);
    protokoll("ki", `Assistent: ${res.data.quellen.length} Quellen`, res.data);
  }

  return {
    status,
    prognose,
    prognoseFehlercode,
    lauf,
    assistent,
    prognoseErzeugen: prognoseAktion,
    prognoseUebernehmen: prognoseUebernehmenAktion,
    autoplan: autoplanAktion,
    varianteUebernehmen: varianteUebernehmenAktion,
    laufVerwerfen: laufVerwerfenAktion,
    frage: frageAktion,
  };
}

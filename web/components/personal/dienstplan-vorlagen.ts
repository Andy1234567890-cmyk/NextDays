"use client";

// Wochenvorlagen des Dienstplans (Vertrag §1.4) als eigener Hook.
//
// WARUM AUSGELAGERT: eine Wochenvorlage ist ein Zeitgerüst, das mit dem
// sichtbaren FENSTER nichts zu tun hat — sie hängt an einer Woche und an
// nichts sonst. Ihr Zustand (Liste, Ladezeichen, Dialog offen) lag zwischen
// dem des Plans und war dort nur Rauschen.
//
// DER KONFLIKTFLUSS BLEIBT DER DES PLANS: das Anwenden einer Vorlage legt
// Schichten an und kann deshalb wie eine Einzelschicht mit 409 antworten
// (Warnungen). Die Rückfrage stellt darum NICHT dieser Hook, sondern der
// Dienstplan über `konfliktFrage` — EIN Fluss, nicht zwei (Wurzel 5).
import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  createWochenvorlage,
  deleteWochenvorlage,
  listWochenvorlagen,
  updateWochenvorlage,
  wochenvorlageAnwenden,
} from "@/lib/personal-planung";
import type { Wochenvorlage } from "@/lib/personal-planung-typen";
import type { Konflikt } from "@/lib/personal-typen";

export type VorlagenZustand = {
  offen: boolean;
  liste: Wochenvorlage[];
  laden: boolean;
  oeffnen: () => Promise<void>;
  schliessen: () => void;
  speichern: (werte: { name: string; notiz: string; mit_personen: boolean }) => Promise<void>;
  umbenennen: (id: string, werte: { name: string; notiz: string }) => Promise<void>;
  loeschen: (id: string) => Promise<void>;
  anwenden: (id: string, mitPersonen: boolean) => Promise<void>;
};

export function useDienstplanVorlagen({
  woche,
  setLaeuft,
  protokoll,
  konfliktFrage,
  onAngewendet,
}: {
  woche: string;
  setLaeuft: (laeuft: boolean) => void;
  protokoll: (art: string, text: string, daten?: unknown) => void;
  /** Die Rückfrage des Dienstplans bei 409 — hier NICHT nachgebaut. */
  konfliktFrage: (konflikte: Konflikt[]) => boolean;
  /** Nach dem Anwenden: der Dienstplan holt Plan und Kennzahlen neu. */
  onAngewendet: () => void;
}): VorlagenZustand {
  const t = useTranslations("personal");
  const [offen, setOffen] = useState(false);
  const [liste, setListe] = useState<Wochenvorlage[]>([]);
  const [laden, setLaden] = useState(false);

  async function nachladen() {
    const res = await listWochenvorlagen();
    if (res.ok) setListe(res.data);
  }

  async function oeffnen() {
    setOffen(true);
    setLaden(true);
    const res = await listWochenvorlagen();
    setLaden(false);
    if (!res.ok) {
      protokoll("fehler", `Wochenvorlagen: ${res.error}`, res.details);
      return void toast.error(res.error);
    }
    setListe(res.data);
    protokoll("laden", `${res.data.length} Wochenvorlagen`);
  }

  async function speichern(werte: { name: string; notiz: string; mit_personen: boolean }) {
    setLaeuft(true);
    const res = await createWochenvorlage({
      name: werte.name,
      notiz: werte.notiz || null,
      aus_woche: woche,
      mit_personen: werte.mit_personen,
    });
    setLaeuft(false);
    if (!res.ok) {
      protokoll("fehler", `Vorlage speichern: ${res.error}`, res.details);
      return void toast.error(res.error);
    }
    toast.success(t("wochenvorlagen.gespeichert", { name: res.data.name }));
    protokoll("gespeichert", `Wochenvorlage ${res.data.id}`, res.data);
    await nachladen();
  }

  async function umbenennen(id: string, werte: { name: string; notiz: string }) {
    setLaeuft(true);
    const res = await updateWochenvorlage(id, { name: werte.name, notiz: werte.notiz || null });
    setLaeuft(false);
    if (!res.ok) return void toast.error(res.error);
    await nachladen();
  }

  async function loeschen(id: string) {
    setLaeuft(true);
    const res = await deleteWochenvorlage(id);
    setLaeuft(false);
    if (!res.ok) return void toast.error(res.error);
    protokoll("geloescht", `Wochenvorlage ${id}`);
    await nachladen();
  }

  async function anwenden(id: string, mitPersonen: boolean, warnungenOk = false): Promise<void> {
    setLaeuft(true);
    const res = await wochenvorlageAnwenden(id, woche, {
      mit_personen: mitPersonen,
      warnungen_akzeptieren: warnungenOk,
    });
    setLaeuft(false);
    if (!res.ok) {
      protokoll("fehler", `Vorlage anwenden: ${res.status} ${res.error}`, res.details);
      // Derselbe Konfliktfluss wie bei der Einzelschicht (409 = Warnungen).
      if (res.status === 409 && res.details?.konflikte) {
        if (konfliktFrage(res.details.konflikte as Konflikt[])) {
          return anwenden(id, mitPersonen, true);
        }
        return;
      }
      return void toast.error(res.error);
    }
    toast.success(
      t("wochenvorlagen.angewendet", {
        angelegt: res.data.angelegt,
        vorhanden: res.data.vorhanden,
      }),
    );
    setOffen(false);
    onAngewendet();
  }

  return {
    offen,
    liste,
    laden,
    oeffnen,
    schliessen: () => setOffen(false),
    speichern,
    umbenennen,
    loeschen,
    anwenden: (id, mit) => anwenden(id, mit),
  };
}

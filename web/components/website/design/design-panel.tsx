"use client";

// Das Design-Panel — Zustand, Autospeichern und die Leiste, an EINER Stelle.
//
// Es steht an zwei Orten und ist beide Male dasselbe Bauteil:
//
//   · im Design-Reiter (eigene Route, wenn man von woanders kommt),
//   · IM Abschnitts-Editor, wo der Klick auf den Reiter nur das Panel wechselt
//     und die Seite NICHT verlässt.
//
// WARUM HERAUSGELÖST
// Der Zustand ist nicht trivial: der Entwurf, der bestätigte Serverstand, das
// Zusammenführen bei einer fremden Änderung und das Autospeichern greifen
// ineinander. Zweimal geschrieben wären es zwei Wahrheiten über dieselbe
// Site-Konfiguration — und die zweite ist die, die beim nächsten Fehler niemand
// prüft (Wurzel 2).
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { type Branding, setBranding } from "@/lib/site-config";

import { type SpeicherStand } from "../schale";
import { useAutospeichern } from "../use-autospeichern";
import { DesignLeiste } from "./design-leiste";
import type { DesignUnterseite } from "../design-ansicht";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/** Nur speichern, wenn alle gesetzten Farben vollständige Hex-Werte sind. Ein
 *  halb getipptes „#ab" wäre serverseitig ein 422. */
function farbenGueltig(b: Branding): boolean {
  return (
    [
      b.primary_color,
      b.secondary_color,
      b.background_color,
      b.foreground_color,
    ] as Array<string | null>
  ).every((c) => !c || HEX_RE.test(c));
}

/** Felder, die der Kunde SEIT dem Speichern erneut geändert hat.
 *
 *  Nötig, weil zwischen Absenden und Antwort weitergetippt werden kann: würde
 *  man den Serverstand blind übernehmen, verschwindet diese Eingabe unter der
 *  Hand. Hier gewinnt der lokale Wert, der Server liefert nur die Basis. */
function istGeaendert(lokal: Branding, server: Branding): Partial<Branding> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(lokal) as Array<keyof Branding>) {
    if (JSON.stringify(lokal[k]) !== JSON.stringify(server[k])) {
      out[k] = lokal[k];
    }
  }
  return out as Partial<Branding>;
}

export function DesignPanel({
  branding,
  unterseite = null,
  onUnterseite,
  imPanel = false,
  onStand,
  onGespeichert,
}: {
  /** Der Serverstand. Ändert er sich (Realtime-Refresh), wird er
   *  zusammengeführt statt ersetzt. */
  branding: Branding;
  /** Offene Unterseite der Leiste. */
  unterseite?: DesignUnterseite | null;
  /** Wechsel der Unterseite melden — nur im Panel-Modus. Ohne diesen Rückruf
   *  wäre die Wahl im Panel gefangen, und die Menüspalte daneben zeigte
   *  weiterhin den vorigen Eintrag als aktiv. */
  onUnterseite?: (u: DesignUnterseite | null) => void;
  /** true = die Unterseiten werden HIER geöffnet, ohne Seitenwechsel.
   *
   *  Im eigenen Design-Reiter bleibt es false: dort hat jede Unterseite eine
   *  eigene Adresse, überlebt ein Neuladen und lässt sich verschicken. Im
   *  Editor darf sie das nicht — dort würde jeder Klick den iframe neu laden. */
  imPanel?: boolean;
  /** Meldet den Speicherstand nach außen — die Kopfzeile zeigt ihn an. */
  onStand?: (stand: SpeicherStand) => void;
  /** Nach einem bestätigten Speichervorgang: die Vorschau neu laden. Sie
   *  rendert serverseitig, ein lokaler Zustandswechsel erreicht sie nicht. */
  onGespeichert?: () => void;
}) {
  const [entwurf, setEntwurf] = useState<Branding>(branding);
  const [bestaetigt, setBestaetigt] = useState<Branding>(branding);

  // Ein neues `branding`-Prop kommt vom Realtime-Refresh. `useState` nimmt es
  // nur als ANFANGSWERT — ohne diesen Effekt käme eine Änderung aus einer
  // zweiten Sitzung nie an, und das Abo wäre eine Attrappe.
  //
  // Übernommen wird nur, was der Kunde hier NICHT gerade bearbeitet: sein
  // offener Stand darf nicht unter der Hand ersetzt werden.
  const fremderStand = JSON.stringify(branding);
  useEffect(() => {
    setBestaetigt((alt) => {
      const neu = JSON.parse(fremderStand) as Branding;
      if (JSON.stringify(alt) === fremderStand) return alt;
      setEntwurf((offen) => ({ ...neu, ...istGeaendert(offen, alt) }));
      return neu;
    });
  }, [fremderStand]);

  const auto = useAutospeichern<Branding>({
    wert: entwurf,
    bestaetigt,
    gueltig: farbenGueltig,
    speichern: async (diff) => {
      const res = await setBranding(diff);
      if (!res.ok) return { ok: false as const, error: res.error };
      return { ok: true as const, data: res.data };
    },
  });

  // Der vom Server bestätigte Stand ist die Wahrheit — er wird übernommen, nicht
  // der lokale. Sonst schickt der nächste Lauf denselben Diff erneut.
  useEffect(() => {
    if (!auto.uebernommen) return;
    setBestaetigt(auto.uebernommen);
    setEntwurf((e) => ({
      ...auto.uebernommen!,
      ...istGeaendert(e, auto.uebernommen!),
    }));
    onGespeichert?.();
    // `onGespeichert` bewusst NICHT in den Abhängigkeiten: es ist bei jedem
    // Render eine neue Funktion, und der Effekt soll auf den bestätigten Stand
    // reagieren, nicht auf das Neu-Erzeugen eines Rückrufs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto.uebernommen]);

  useEffect(() => {
    onStand?.(auto.stand);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto.stand]);

  // Ein Speicherfehler wird GEZEIGT. Er still zu verschlucken hieße, dass der
  // Kunde weiterarbeitet und nichts davon ankommt (Wurzel 5).
  useEffect(() => {
    if (auto.fehler) toast.error(auto.fehler);
  }, [auto.fehler]);

  // Die offene Unterseite ist IMMER `unterseite` — im eigenen Reiter aus der
  // Route, im Editor aus dessen Zustand.
  //
  // Hier stand ein eigenes `useState(unterseite)` daneben. `useState` nimmt ein
  // Prop nur als ANFANGSWERT: der Klick in der Menüspalte setzte den Zustand
  // des Editors, das Panel las weiter seinen eigenen und zeigte deshalb
  // unverändert die Übersicht (Nachprüfung C4, Prüfpunkte 2 und 3). Zwei
  // Zustände über dieselbe Sache, von denen der eine den anderen nie erfährt —
  // dieselbe Wurzel wie beim Realtime-Prop oben.
  //
  // `onUnterseite` reicht die Wahl nach oben, statt sie hier zu behalten:
  // im Editor beschriftet dieselbe Wahl auch die Menüspalte (`menueAktiv`) und
  // den Panel-Titel.
  return (
    <DesignLeiste
      stand={entwurf}
      setze={(patch) => setEntwurf((e) => ({ ...e, ...patch }))}
      unterseite={unterseite}
      onUnterseite={imPanel ? onUnterseite : undefined}
    />
  );
}

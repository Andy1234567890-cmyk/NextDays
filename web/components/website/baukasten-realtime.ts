"use client";

// Realtime für den Website-Baukasten — EINE Stelle für alle seine Reiter.
//
// WARUM ES DAS VORHER NICHT GAB
// Der Baukasten war als „Formular links, Vorschau rechts, Autospeichern" gebaut,
// unter der stillen Annahme, dass genau EIN Mensch seine eigene Website
// bearbeitet. Unter der Annahme kann es keine fremde Änderung geben, also
// brauchte es kein Abo. Die Annahme stimmt nur nicht: an einem Konto hängen
// Agentur, Eigentümer und Mitarbeiter, und schon zwei offene Reiter desselben
// Menschen sind zwei Bearbeiter. Bis heute gewann dann stillschweigend der,
// der zuletzt gespeichert hat — ohne dass der andere je erfuhr, dass seine
// Änderung überschrieben wurde.
//
// WAS EIN ABO VORAUSSETZT (und warum hier nicht jede Tabelle steht)
// Ein Abo wirkt nur, wenn BEIDES stimmt: die Tabelle ist Mitglied der
// Publikation `supabase_realtime` UND `authenticated` darf sie lesen. Fehlt
// eines, ist das Abo eine stumme Attrappe — die Oberfläche sieht live aus und
// aktualisiert nie. Live geprüft am 25.08.2026:
//
//   site_blocks          Publikation ✓  select ✓   → Abo
//   site_pages           Publikation ✓  select ✓   → Abo
//   site_redirects       Publikation ✓  select ✓   → Abo
//   site_rules           Publikation ✓  select ✓   → Abo
//   tenant_site_config   Publikation ✓  select ✓   → Abo
//
//   site_form_submissions  —  —   KEIN Abo: Gast-Formulardaten, bewusst gesperrt
//   site_form_uploads      —  —   KEIN Abo: Anlagen, privat (0444)
//   site_media             —  —   KEIN Abo: Mediathek, kein Grant
//   site_media_folders     —  —   KEIN Abo
//   site_ai_profile        —  —   KEIN Abo
//   site_ai_usage          —  —   KEIN Abo: Verbrauchszähler
//
// Für die gesperrten gilt die Regel aus CLAUDE.md: sie werden NICHT per Grant
// geöffnet, damit ein Abo geht. Dort ist das Abo der Fehler, nicht die Sperre.
//
// Nachprüfen (nicht annehmen): `bash scripts/realtime/abos-pruefen.sh`.
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { useRealtime } from "@/lib/use-realtime";

/** Tabellen, die der Baukasten abonnieren DARF. Die Liste ist bewusst
 *  geschlossen: ein Tippfehler oder eine gesperrte Tabelle soll beim Übersetzen
 *  auffallen und nicht erst als stummes Abo im Betrieb. */
export type BaukastenTabelle =
  | "site_blocks"
  | "site_pages"
  | "site_redirects"
  | "site_rules"
  | "tenant_site_config";

/**
 * Bis wann eintreffende Ereignisse als EIGENES Echo gelten.
 *
 * Modulweit und nicht je Komponente: Ein Speichervorgang im Design-Reiter
 * schreibt `tenant_site_config`, und dieselbe Tabelle hört der SEO-Reiter im
 * Nachbar-Tab ab. Läge das Fenster in der Komponente, hielte jede nur ihre
 * eigenen Schreibvorgänge auseinander — und meldete die des Nachbarn als
 * fremde Änderung, obwohl es derselbe Mensch war.
 */
let eigenesEchoBis = 0;

/** So lange nach dem eigenen Speichern gelten Ereignisse als eigenes Echo.
 *
 *  Großzügig bemessen: der Weg Antwort → Publikation → WebSocket dauert unter
 *  Last länger als der Rückweg der HTTP-Antwort. Vier Sekunden sind lieber
 *  einmal zu viel verschluckt als einmal zu oft „jemand anderes hat geändert"
 *  über einer Eingabe, die man selbst gerade gemacht hat. */
const ECHO_FENSTER_MS = 4000;

/** Nach einem bestätigten eigenen Schreibvorgang aufrufen.
 *
 *  Steht zentral in `useAutospeichern`, damit kein Reiter es vergessen kann —
 *  jeder Schreibweg des Baukastens läuft dort hindurch. Wer daneben von Hand
 *  speichert (der Abschnitts-Editor tut das), ruft es selbst. */
export function eigenesEchoMerken(): void {
  eigenesEchoBis = Date.now() + ECHO_FENSTER_MS;
}

/** Ist das gerade eingetroffene Ereignis unser eigenes Echo? */
export function istEigenesEcho(): boolean {
  return Date.now() < eigenesEchoBis;
}

/**
 * Fremde Änderungen an den speisenden Tabellen bemerken.
 *
 * Verhalten, und es ist bewusst nicht „einfach neu laden":
 *
 * * Nichts Ungespeichertes offen → die Ansicht aktualisiert sich selbst.
 * * Etwas offen → `fremdeAenderung` wird `true`, und die Oberfläche zeigt einen
 *   Knopf. Automatisch neu zu laden würde wegwerfen, woran gerade jemand tippt.
 *   Die Entscheidung gehört dem, der schreibt.
 */
export function useBaukastenRealtime({
  tabellen,
  offen = false,
  onFremd,
}: {
  tabellen: readonly BaukastenTabelle[];
  /** Gibt es ungespeicherte Eingaben? */
  offen?: boolean;
  /** Zusätzliche Reaktion, z. B. die Vorschau neu laden. Läuft auch dann, wenn
   *  wegen offener Eingaben NICHT aktualisiert wird — die Vorschau zeigt den
   *  Serverstand und darf ihm folgen. */
  onFremd?: () => void;
}): { fremdeAenderung: boolean; uebernehmen: () => void } {
  const router = useRouter();
  const [fremdeAenderung, setFremdeAenderung] = useState(false);
  const offenRef = useRef(offen);
  offenRef.current = offen;
  const onFremdRef = useRef(onFremd);
  onFremdRef.current = onFremd;

  const ereignis = useCallback(() => {
    if (istEigenesEcho()) return;
    onFremdRef.current?.();
    if (offenRef.current) {
      setFremdeAenderung(true);
      return;
    }
    router.refresh();
  }, [router]);

  const uebernehmen = useCallback(() => {
    setFremdeAenderung(false);
    router.refresh();
  }, [router]);

  // Feste Reihenfolge, feste Anzahl: `useRealtime` ist ein Hook und darf nicht
  // in einer Schleife über eine veränderliche Liste stehen. Fünf Aufrufe, je
  // einer pro erlaubter Tabelle, jeder nur aktiv, wenn die Tabelle angefragt
  // ist — das ist die Bauform, die React zulässt.
  const an = (t: BaukastenTabelle) => tabellen.includes(t);
  useRealtime({ table: "site_blocks", enabled: an("site_blocks"), onChange: ereignis });
  useRealtime({ table: "site_pages", enabled: an("site_pages"), onChange: ereignis });
  useRealtime({
    table: "site_redirects",
    enabled: an("site_redirects"),
    onChange: ereignis,
  });
  useRealtime({ table: "site_rules", enabled: an("site_rules"), onChange: ereignis });
  useRealtime({
    table: "tenant_site_config",
    enabled: an("tenant_site_config"),
    onChange: ereignis,
  });

  // Nach `router.refresh()` kommen neue Serverdaten herein; der Hinweis hat sich
  // damit erledigt.
  useEffect(() => {
    if (!offen && fremdeAenderung) setFremdeAenderung(false);
  }, [offen, fremdeAenderung]);

  return { fremdeAenderung, uebernehmen };
}

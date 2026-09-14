// Riegel für das Buchhaltungs-Modul: erreichbar NUR mit freigeschaltetem Modul (0572).
//
// WARUM ein Layout und keine Prüfung je Seite: unter `/buchhaltung` hängen 17
// Unterbereiche (rechnungen, datev, kassenbuch, e-rechnung …). Eine Prüfung je
// Seite hieße 17 Kopien derselben Regel — und die achtzehnte Seite, die jemand
// nächste Woche anlegt, hätte sie nicht. Ein Layout deckt jeden Pfad darunter
// ab, auch künftige. Dasselbe Muster wie `hr/layout.tsx`.
//
// WARUM überhaupt: das Modul ist eine 1:1-Übernahme aus Taskilo, von der erst
// Rechnungsliste und Rechnung-erstellen portiert sind; 13 Unterseiten sind
// Platzhalter (docs/buchhaltung/TASKILO-FINANZ-BESTAND-2026-09-11.md). Der
// Menüpunkt ist in `app-sidebar.tsx` für Betriebe ohne das Modul ausgeblendet —
// aber ein ausgeblendeter Link ist keine Schranke. Wer die Adresse tippt oder
// ein altes Lesezeichen öffnet, käme sonst weiterhin an.
//
// WARUM `enabled_modules` UND NICHT MEHR `is_internal` (bis 11.09.2026):
// `is_internal` (0505) kennzeichnet die drei Fotomodell-Konten des Hauses
// (Seeblick, Alpenzeit, Nordlicht). Die Anweisung vom 11.09.2026 lautet aber:
// Buchhaltung „nur bei theresa.gruber, bei niemandem sonst" — und
// theresa.gruber ist der Vorführbetrieb Nordstrand (0630), der `is_internal`
// NICHT trägt. Am alten Flag hängend war der Riegel genau falsch herum:
// Nordstrand bekam 404, die Fotomodell-Konten kamen hinein. `enabled_modules`
// ist der Riegel, der dafür gebaut wurde (0572: „gebaut, aber noch nicht reif
// für zahlende Betriebe"); 0633 setzt `buchhaltung` ausschließlich beim
// Vorführbetrieb. Der zugehörige API-Riegel sitzt in
// `apps/api/.../auth/modul_freischaltung.py` (mit Ausnahme der
// Firmenstammdaten unter `companies/`, die /konto jedes Betriebs braucht).
//
// KEIN Sicherheitsmerkmal, sondern eine Reifegrad-Frage: die Buchhaltung zeigt
// ausschließlich Daten des EIGENEN Mandanten. Die Datenschranke bleiben RLS und
// die Autorisierung der Endpunkte, nicht diese Datei.
//
// WIEDER FREIGEBEN, wenn das Modul fertig ist: diese Datei löschen, in
// `app-sidebar.tsx` den Eintrag aus `MODUL_PFADE` nehmen und im Backend aus
// `MODUL_PRAEFIXE`. Die drei Stellen gehören zusammen.
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { getSession } from "@/lib/auth";

export default async function BuchhaltungLayout({
  children,
}: {
  children: ReactNode;
}) {
  const { me, abgemeldet, fehler } = await getSession();

  // Fail-closed (Wurzel 5): weder eine abgelaufene Sitzung noch ein
  // Backend-Aussetzer darf hier durchrutschen. `getSession` statt `getMe`, weil
  // nur sie die beiden Fälle unterscheidet — `getMe` macht aus jedem 503
  // ebenfalls `null`, und dann stünde im Log „nicht angemeldet", obwohl der
  // Nutzer es ist.
  const freigeschaltet = (me?.enabled_modules ?? []).includes("buchhaltung");
  if (abgemeldet || fehler || !freigeschaltet) {
    // Diagnose (Pflicht laut CLAUDE.md): eine 404 ohne Grund im Log kostet
    // beim nächsten Mal eine Stunde Suche.
    console.info("[buchhaltung] 404 — Modul nicht freigeschaltet", {
      angemeldet: Boolean(me),
      abgemeldet,
      fehler,
      module: me?.enabled_modules ?? null,
      tenant: me?.tenant_id ?? null,
    });
    notFound();
  }

  return children;
}

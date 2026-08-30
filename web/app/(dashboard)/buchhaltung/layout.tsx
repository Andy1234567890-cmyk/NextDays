// Riegel für das Buchhaltungs-Modul: erreichbar NUR in internen Konten.
//
// WARUM ein Layout und keine Prüfung je Seite: unter `/buchhaltung` hängen 17
// Unterbereiche (rechnungen, datev, kassenbuch, e-rechnung …). Eine Prüfung je
// Seite hieße 17 Kopien derselben Regel — und die achtzehnte Seite, die jemand
// nächste Woche anlegt, hätte sie nicht. Ein Layout deckt jeden Pfad darunter
// ab, auch künftige.
//
// WARUM überhaupt: das Modul ist in Entwicklung, 13 der Unterseiten sind noch
// Platzhalter. Der Menüpunkt ist deshalb in `app-sidebar.tsx` für echte
// Betriebe ausgeblendet — aber ein ausgeblendeter Link ist keine Schranke. Wer
// die Adresse tippt oder ein altes Lesezeichen öffnet, käme sonst weiterhin an.
//
// WARUM `is_internal` UND NICHT `is_demo`: das sind zwei entgegengesetzte
// Kennzeichnungen. `is_demo` (0407) ist die anonyme Schaufenster-Vorführung der
// Marketing-Seite; dort ist `/buchhaltung` gerade GESPERRT
// (`demo_gate.GESPERRTE_PRAEFIXE`, 0408) und jede Änderung antwortet 405.
// `is_internal` (0505) ist das Gegenteil: ein Arbeitskonto des Hauses, in dem
// Unfertiges erprobt wird. Am `is_demo` hängend wäre dieser Riegel genau falsch
// herum — und er träfe niemanden, weil live kein Mandant das Flag trägt.
//
// KEIN Sicherheitsmerkmal, sondern eine Reifegrad-Frage: die Buchhaltung zeigt
// ausschließlich Daten des EIGENEN Mandanten. Die Datenschranke bleiben RLS und
// die Autorisierung der Endpunkte, nicht diese Datei.
//
// WIEDER FREIGEBEN, wenn das Modul fertig ist: diese Datei löschen und in
// `app-sidebar.tsx` das `istIntern ? [accountingGroup] : []` auf
// `accountingGroup` zurücknehmen. Beide Stellen gehören zusammen.
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
  if (abgemeldet || fehler || !me?.is_internal) {
    // Diagnose (Pflicht laut CLAUDE.md): eine 404 ohne Grund im Log kostet
    // beim nächsten Mal eine Stunde Suche.
    console.info("[buchhaltung] 404 — Modul nur in internen Konten", {
      angemeldet: Boolean(me),
      abgemeldet,
      fehler,
      istIntern: me?.is_internal ?? null,
      tenant: me?.tenant_id ?? null,
    });
    notFound();
  }

  return children;
}

// Riegel für den Website-Baukasten: erreichbar nur mit freigeschaltetem Modul (0572).
//
// WARUM ein Layout und keine Prüfung je Seite: unter `/website` hängen viele
// Unterbereiche, und eine Prüfung je Seite wäre so oft kopiert, wie es Seiten
// gibt — die nächste neue hätte sie nicht. Ein Layout deckt jeden Pfad
// darunter ab, auch künftige. Dasselbe Muster wie `buchhaltung/layout.tsx`.
//
// WARUM überhaupt: Der Bereich ist gebaut, aber noch nicht für zahlende Betriebe freigegeben (Betreiber, 06.09.2026). Der Menüpunkt ist in `app-sidebar.tsx` für Betriebe
// ohne das Modul ausgeblendet — aber ein ausgeblendeter Link ist keine
// Schranke. Wer die Adresse tippt oder ein altes Lesezeichen öffnet, käme
// sonst weiterhin an.
//
// WARUM NICHT `is_internal` (0505): das kennzeichnet die drei Fotomodell-Konten
// des Hauses (Seeblick, Alpenzeit, Nordlicht). Der Beta-Betrieb, der dieses
// Modul erproben soll, ist keines davon — live geprüft am 06.09.2026. Am
// `is_internal` hängend wäre der Riegel genau falsch herum: der Bereich
// verschwände dort, wo er gebraucht wird, und erschiene in den Vorführkonten.
//
// KEIN Sicherheitsmerkmal, sondern eine Reifegrad-Frage: der Bereich zeigt
// ausschließlich Daten des EIGENEN Mandanten. Die Datenschranke bleiben RLS und
// die Autorisierung der Endpunkte, nicht diese Datei. Der zugehörige
// API-Riegel sitzt in `apps/api/.../auth/modul_freischaltung.py`.
//
// WIEDER FREIGEBEN: das Modul allen Betrieben geben heißt, diese Datei löschen
// UND in `app-sidebar.tsx` den Eintrag aus `MODUL_PFADE` nehmen UND im Backend
// aus `MODUL_PRAEFIXE`. Die drei Stellen gehören zusammen.
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { getSession } from "@/lib/auth";

export default async function BaukastenWebsiteLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Fail-closed (Wurzel 5): weder eine abgelaufene Sitzung noch ein
  // Backend-Aussetzer darf hier durchrutschen. `getSession` statt `getMe`, weil
  // nur sie die beiden Fälle unterscheidet.
  const { me, abgemeldet, fehler } = await getSession();
  const freigeschaltet = (me?.enabled_modules ?? []).includes("website_builder");
  if (abgemeldet || fehler || !freigeschaltet) {
    // Diagnose (Pflicht laut CLAUDE.md): eine 404 ohne Grund im Log kostet
    // beim nächsten Mal eine Stunde Suche.
    console.info("[website-baukasten] 404 — Modul nicht freigeschaltet", {
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

// Riegel für DAC7: erreichbar nur mit freigeschaltetem Modul (0572/0700).
//
// WARUM: DAC7 ist ein Pay-Modul in Entwicklung. Bis zum 14.09.2026 hing der
// Menüpunkt allein an `manage_billing` und fehlte in `MODUL_PFADE` wie in
// `MODUL_PRAEFIXE` — jeder Admin jedes Betriebs sah ihn und erreichte die
// Seite. Der Betreiber: nur der Entwickler-/Vorführbetrieb soll das sehen.
//
// Dasselbe Muster wie `hr/layout.tsx` und `buchhaltung/layout.tsx`: ein Layout
// statt einer Prüfung je Seite, fail-closed (Wurzel 5), Diagnose im Log. Der
// zugehörige API-Riegel sitzt in `apps/api/.../auth/modul_freischaltung.py`
// (`/taxpayer/dac7`).
//
// WIEDER FREIGEBEN: diese Datei löschen UND `/dac7` aus `MODUL_PFADE` in
// `app-sidebar.tsx` UND `dac7` aus `MODUL_PRAEFIXE` im Backend nehmen.
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { getSession } from "@/lib/auth";

export default async function Dac7Layout({
  children,
}: {
  children: ReactNode;
}) {
  const { me, abgemeldet, fehler } = await getSession();
  const freigeschaltet = (me?.enabled_modules ?? []).includes("dac7");
  if (abgemeldet || fehler || !freigeschaltet) {
    console.info("[dac7] 404 — Modul nicht freigeschaltet", {
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

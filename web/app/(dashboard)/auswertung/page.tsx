// Auswertung — Kennzahlen, Buchungen, Auslastung, Kanäle, Gäste.
//
// Der Bericht, den die Sidebar bisher unter /gaeste/monatsbericht versprach,
// ohne dass es ihn gab: der Link fiel auf die dynamische Route /gaeste/[id]
// und zeigte die Gast-Detailseite mit „monatsbericht" als vermeintlicher ID —
// kein 404, sondern eine falsche Seite.
//
// Eigener Hauptmenüpunkt statt Unterpunkt unter „Gäste": ein Auslastungs- oder
// Kanalbericht ist kein Gästethema. Hostaway führt seinen Berichtsbereich
// ebenfalls als eigenen Punkt (`Financial Reporting`), Lodgify als `Reports`.
//
// Aufbau nach Hostaway: Filterleiste ganz oben, darunter die Kennzahlreihe,
// dann die Reiter. Grundlage: `docs/MONATSBERICHT-WETTBEWERBSANALYSE.md`.
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";

import { AuswertungSeite } from "@/components/auswertung/auswertung-seite";
import { Card } from "@nextdays/ui/card";
import { CHANNEL_SOURCES } from "@/lib/calendar-channels";
import { getMe } from "@/lib/auth";
import { listProperties } from "@/lib/properties";

// `manual`, `ical` und `contract_end` sind gesperrte Nächte, keine
// Vertriebskanäle — als Umsatzfilter wären sie sinnlos.
const NUR_SPERREN: readonly string[] = ["manual", "ical", "contract_end"];

export const dynamic = "force-dynamic";

export default async function AuswertungPage() {
  const t = await getTranslations("calendar");
  const [me, objekte] = await Promise.all([getMe(), listProperties()]);

  // Autorisierung (Wurzel 9): dieselbe Hürde wie der Endpunkt.
  //
  // `view_finances`, NICHT `download_booking_report`: das sind zwei getrennte
  // Aufzählungen. `me.capabilities` führt ausschließlich Capability-Werte
  // (auth/permissions.py); `download_booking_report` ist eine Permission
  // (auth/granular_permissions.py) und steht dort NIE drin — die Prüfung war
  // damit immer falsch und die Seite für jeden leer.
  //
  // Sachlich ist `view_finances` ohnehin die richtige: die Auswertung zeigt
  // Umsatz, Provision und Netto je Kanal. Staff und Cleaner bleiben damit
  // draußen (§4.3), Eigentümer ebenso — deren `view_occupancy_stats` deckt
  // nur die Nicht-Umsatz-Auswertungen.
  // Diagnose (Pflicht laut CLAUDE.md): WARUM die Seite leer bleibt, muss im
  // Log stehen — eine weiße Fläche ohne Grund kostete hier bereits eine Stunde.
  console.info("[auswertung] Zugriff", {
    angemeldet: Boolean(me),
    rolle: me?.role ?? null,
    email: me?.email ?? null,
    hatViewFinances: me?.capabilities?.includes("view_finances") ?? false,
    capabilities: me?.capabilities?.length ?? 0,
  });

  if (!me?.capabilities.includes("view_finances")) {
    console.warn("[auswertung] 404 — view_finances fehlt", {
      rolle: me?.role ?? null,
      vorhanden: me?.capabilities ?? [],
    });
    notFound();
  }

  if (!objekte.ok) {
    return <Card className="p-5 text-sm text-destructive">{objekte.error}</Card>;
  }

  return (
    <AuswertungSeite
      objekte={objekte.data.items.map((p) => ({
        value: p.id,
        label: p.title,
      }))}
      // Kanalliste aus der EINEN Quelle (`CHANNEL_SOURCES`) mit den
      // Beschriftungen aus `calendar.channel.*` — derselbe Katalog, den
      // `scripts/i18n/kanal-enums-pruefen.mjs` über alle 24 Sprachen
      // deckungsgleich hält. Eine zweite Liste hier wäre die sechste Stelle,
      // an der ein neuer Kanal vergessen werden kann.
      kanaele={CHANNEL_SOURCES.filter((s) => !NUR_SPERREN.includes(s)).map(
        (s) => ({ value: s, label: t(`channel.${s}`) }),
      )}
    />
  );
}

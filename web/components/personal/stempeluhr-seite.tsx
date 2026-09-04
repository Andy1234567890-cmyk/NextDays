"use client";

// Seite /hr/stempeluhr (Vertrag §6): die EIGENE Stempeluhr, die eigenen Zeiten
// des laufenden Monats, die eigenen Ueberstundenantraege.
//
// WAS HIER NEU IST UND WAS WIEDERVERWENDET WIRD
// ---------------------------------------------
// Die Stempeluhr selbst ist `<Stempeluhr>` (stempeluhr.tsx) — inklusive
// Sekundenzaehler, Schicht heute und der GPS-Behandlung aus §3.3. Die
// Antragsliste ist `<UeberstundenListe>` (ueberstunden.tsx) im Modus
// `eigenesich`. Neu ist hier ausschliesslich die eigene MONATSLISTE samt Summe:
// sie ist bewusst NICHT die Team-Tabelle aus zeiterfassung.tsx, weil dort
// Korrektur, Bestaetigung, Loeschen und Monatsabschluss haengen — Handlungen,
// die eine Person auf ihren eigenen Zeiten nicht hat.
//
// WOHER DER SCOPE KOMMT
// ---------------------
// Nicht von hier. `GET /zeiterfassung` liefert ohne Team-Recht nur die eigenen
// Zeilen, `GET /ueberstunden` unter dem Own-Guard nur die eigenen Antraege
// (Wurzel 3). Der Filter auf `eigeneId` unten ist deshalb kein Schutz, sondern
// eine ANZEIGE-Klarstellung fuer den Fall, dass die Person zusaetzlich ein
// Team-Recht hat und die Route ihr das ganze Team liefern wuerde: auf DIESER
// Seite geht es um die eigene Zeit, nicht um die des Teams.
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useState } from "react";

import { listZeiten } from "@/lib/personal";
import type { Ueberstundenantrag } from "@/lib/personal-betrieb-typen";
import type { KommendeSchicht, ZeitListe, Zeiterfassung } from "@/lib/personal-typen";
import { stunden } from "@/lib/personal-typen";
import { tagInZone, uhrzeitInZone } from "@/lib/personal-zeit";
import { useRealtime } from "@/lib/use-realtime";
import { formatDate } from "@/lib/utils";

import { Stempeluhr } from "./stempeluhr";
import { UeberstundenListe } from "./ueberstunden";

export function StempeluhrSeite({
  offen,
  zeiten,
  antraege,
  von,
  bis,
  zone,
  eigeneId,
  gpsPflicht,
  gpsRadiusM,
  objekte,
  schichtHeute,
}: {
  offen: Zeiterfassung | null;
  zeiten: ZeitListe;
  antraege: Ueberstundenantrag[];
  von: string;
  bis: string;
  zone: string;
  eigeneId: string;
  gpsPflicht: boolean;
  gpsRadiusM: number;
  objekte: { id: string; title: string }[];
  schichtHeute: KommendeSchicht | null;
}) {
  const t = useTranslations("personal");
  const locale = useLocale();
  const [liste, setListe] = useState(zeiten);

  const nachladen = useCallback(async () => {
    const res = await listZeiten(von, bis);
    if (res.ok) setListe(res.data);
  }, [von, bis]);
  useRealtime({ table: "personal_zeiterfassung", onChange: nachladen });

  const eigene = liste.items
    .filter((z) => z.user_id === eigeneId)
    .sort((a, b) => b.start_at.localeCompare(a.start_at));
  // Nur abgeschlossene Zeilen zaehlen in die Summe — eine laufende Stempelung
  // hat noch keine Netto-Zeit, die stimmt (Wurzel 4: kein Zwischenwert, der
  // wie ein Ergebnis aussieht).
  const summe = eigene.reduce((n, z) => n + (z.end_at ? z.netto_minuten : 0), 0);
  const monat = new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(
    new Date(`${von}T12:00:00Z`),
  );

  return (
    <div className="flex flex-1 flex-col gap-6 pb-20">
      <div>
        <h1 className="font-display text-3xl font-extrabold">{t("stempeluhr.titel")}</h1>
        <p className="text-sm text-muted-foreground">{t("stempeluhr.subtitle")}</p>
      </div>

      <Stempeluhr
        initial={offen}
        zone={zone}
        objekte={objekte}
        schichtHeute={schichtHeute}
        gpsPflicht={gpsPflicht}
        gpsRadiusM={gpsRadiusM}
        onGestempelt={nachladen}
      />

      <section className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <h2 className="font-display text-lg font-extrabold">
            {t("stempeluhr.meineZeiten", { monat })}
          </h2>
          <p className="text-sm font-medium tabular-nums">
            {t("stempeluhr.summeMonat", { stunden: stunden(summe) })}
          </p>
        </div>

        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-left">
              <tr>
                <th className="p-2">{t("datum")}</th>
                <th className="p-2">{t("von")}</th>
                <th className="p-2">{t("bis")}</th>
                <th className="p-2 text-right">{t("zeit.pause")}</th>
                <th className="p-2 text-right">{t("zeit.netto")}</th>
                <th className="p-2">{t("zeit.quelle")}</th>
                <th className="p-2">{t("dienstplan.status")}</th>
              </tr>
            </thead>
            <tbody>
              {eigene.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-muted-foreground">
                    {t("zeit.keine")}
                  </td>
                </tr>
              )}
              {eigene.map((z) => (
                <tr key={z.id} className="border-t">
                  <td className="p-2">{formatDate(tagInZone(z.start_at, zone), locale)}</td>
                  <td className="p-2 tabular-nums">{uhrzeitInZone(z.start_at, zone)}</td>
                  <td className="p-2 tabular-nums">
                    {z.end_at ? (
                      uhrzeitInZone(z.end_at, zone)
                    ) : (
                      <span className="inline-flex items-center gap-1 text-emerald-700">
                        <Icon icon="ph:record-fill" className="size-3" />
                        {t("zeit.zustand.laeuft")}
                      </span>
                    )}
                  </td>
                  <td className="p-2 text-right tabular-nums">
                    {z.pause_minuten > 0 ? `${z.pause_minuten} min` : "—"}
                  </td>
                  <td className="p-2 text-right tabular-nums">
                    {z.end_at ? stunden(z.netto_minuten) : "—"}
                  </td>
                  <td className="p-2 text-xs text-muted-foreground">
                    {t.has(`zeit.quellen.${z.quelle}`) ? t(`zeit.quellen.${z.quelle}`) : z.quelle}
                  </td>
                  <td className="p-2">
                    <ZeitStatusBadge z={z} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {eigene.some((z) => z.notiz) && (
          <ul className="text-xs text-muted-foreground">
            {eigene
              .filter((z) => z.notiz)
              .map((z) => (
                <li key={z.id}>
                  {formatDate(tagInZone(z.start_at, zone), locale)}: {z.notiz}
                </li>
              ))}
          </ul>
        )}
      </section>

      <UeberstundenListe
        initial={antraege}
        von={von}
        bis={bis}
        kannEntscheiden={false}
        eigenesich
      />
    </div>
  );
}

function ZeitStatusBadge({ z }: { z: Zeiterfassung }) {
  const t = useTranslations("personal");
  const farbe: Record<Zeiterfassung["status"], string> = {
    offen: "bg-secondary text-muted-foreground",
    abgeschlossen: "bg-amber-100 text-amber-800",
    bestaetigt: "bg-emerald-100 text-emerald-800",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs ${farbe[z.status]}`}>
      {t(`zeit.status.${z.status}`)}
    </span>
  );
}

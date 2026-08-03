"use client";

// Objekt → Synchronisierung: was steht bei welchem Portal, und läuft es?
//
// Die Kanal-Übersicht (/channels/[code]) zeigt dieselbe Zuordnung aus Sicht des
// PORTALS — alle Objekte eines Kanals untereinander. Diese Seite zeigt sie aus
// Sicht des OBJEKTS: alle Kanäle dieses einen Hauses. Beide braucht man; wer
// eine Buchung im Extranet nachschlagen will, kommt vom Objekt.
//
// Aufbau nach Lodgify (dort „Synchronisierungseinstellungen" am Objekt): ein
// Block je Portal, darin je Zeile die PORTAL-Seite (Zimmername + Hotel-ID|
// Zimmer-ID) neben UNSERER Seite (Objekt und Einheit) und dem Status. Genau
// diese Kennungen fehlten bisher überall in der Oberfläche — ohne sie lässt
// sich eine Abweichung im Extranet nicht wiederfinden.
//
// Nicht verbundene Portale werden NICHT verschwiegen: sie stehen mit dem
// Hinweis da, was zu tun ist. Eine leere Tabelle beantwortet die Frage „warum
// kommt von dort nichts?" nicht.
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useTranslations } from "next-intl";

import { Card } from "@nextdays/ui/card";
import { channelLogoLoose } from "@/lib/channel-logos";
import type { StoredChannelConnection } from "@/lib/channex";
import type { Property } from "@/lib/properties";

type Einheit = { id: string; name: string; position: number };

export function PropertySync({
  property,
  connections,
  units,
}: {
  property: Property;
  connections: StoredChannelConnection[];
  units: Einheit[];
}) {
  const t = useTranslations("objects.sync");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-extrabold">{t("title")}</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">{t("hint")}</p>
      </div>

      {connections.length === 0 ? (
        <Card className="p-5 text-sm text-muted-foreground">{t("none")}</Card>
      ) : (
        connections.map((c) => (
          <Card key={c.portal_code} className="flex flex-col gap-3 p-5">
            <div className="flex items-center gap-2">
              {/* Echtes Portal-Logo, sonst nur der Name — kein Ersatz-Icon. */}
              {channelLogoLoose(c.portal_code) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={channelLogoLoose(c.portal_code) as string}
                  alt=""
                  className="h-4 w-auto max-w-[6rem] object-contain object-left"
                />
              ) : null}
              {/* Der Portalname führt eine Ebene tiefer: Kennungen, Tarifpläne,
                  Verkaufsschalter. Ohne diesen Weg endet die Frage „warum kommt
                  dort kein Preis an?" auf dieser Seite. */}
              <Link
                href={`/objekte/${property.id}/synchronisierung/${c.portal_code}`}
                className="font-display text-lg font-extrabold hover:underline"
              >
                {c.portal}
              </Link>
              <StatusChip
                active={c.is_active}
                fehler={c.last_error ?? c.last_sync_error}
                labels={{
                  active: t("statusActive"),
                  paused: t("statusPaused"),
                  error: t("statusError"),
                }}
              />
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[44rem] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">{t("colPortal")}</th>
                    <th className="py-2 pr-4 font-medium">{t("colOurs")}</th>
                    <th className="py-2 font-medium">{t("colStatus")}</th>
                  </tr>
                </thead>
                <tbody>
                  {units.map((u) => (
                    <tr key={u.id} className="border-b border-border/60 last:border-0">
                      <td className="py-3 pr-4 align-top">
                        <p className="font-medium">
                          {c.ota_room_title ?? property.title}
                        </p>
                        {/* Hotel-ID|Zimmer-ID — dieselbe Schreibweise wie im
                            Extranet, damit man sie dort wiederfindet. */}
                        <p className="text-xs text-muted-foreground">
                          {[c.hotel_id, c.ota_room_type_code]
                            .filter(Boolean)
                            .join(" | ")}
                        </p>
                      </td>
                      <td className="py-3 pr-4 align-top">
                        <p className="font-medium">{property.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {units.length > 1 ? u.name : t("singleUnit")}
                        </p>
                      </td>
                      <td className="py-3 align-top">
                        <p>{c.is_active ? t("published") : t("notPublished")}</p>
                        {c.last_sync_status && (
                          <p className="text-xs text-muted-foreground">
                            {c.last_sync_status === "ok"
                              ? t("syncOk")
                              : c.last_sync_status}
                          </p>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {(c.last_error || c.last_sync_error) && (
              <p className="rounded-(--radius) border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {c.last_error ?? c.last_sync_error}
              </p>
            )}
          </Card>
        ))
      )}
    </div>
  );
}

function StatusChip({
  active,
  fehler,
  labels,
}: {
  active: boolean;
  fehler: string | null;
  labels: { active: string; paused: string; error: string };
}) {
  // Ein Fehler schlägt den Zustand: „aktiv" neben einer Fehlermeldung wäre eine
  // Falschaussage. Pausiert ist kein Alarm — das ist der Wille des Betriebs.
  const ton = fehler
    ? "bg-destructive/10 text-destructive"
    : active
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
      : "bg-muted text-muted-foreground";
  const text = fehler ? labels.error : active ? labels.active : labels.paused;
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ton}`}>
      <Icon
        icon={fehler ? "ph:warning-circle" : active ? "ph:check-circle" : "ph:pause-circle"}
        className="mr-1 inline size-3.5 align-[-2px]"
      />
      {text}
    </span>
  );
}

"use client";

// Eigentümer-Portal · Benachrichtigungs-Einstellungen. Je Ereignis ein Schalter
// pro Kanal (E-Mail / SMS); alle Schalter aus = deaktiviert.
//
// Die Kategorien und ihre Kanäle kommen VOM SERVER (NotificationOverview aus
// dem Katalog). Die UI führt keine eigene Liste — sonst laufen Migration,
// Schema und Oberfläche auseinander (Wurzel 4). Ein Schalter mit
// `aenderbar: false` ist eine vertraglich nötige Mail: er bleibt an und ist
// gesperrt, statt eine Änderung vorzutäuschen, die das Backend zurückdreht.
//
// Kein Realtime-Abo: notification_settings ist die EIGENE Präferenzzeile, die
// nur dieser Nutzer in dieser Sitzung ändert. Es gibt keinen zweiten Schreiber,
// auf dessen Ereignis man hören müsste — ein Abo wäre hier Zierde ohne Zweck.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Card, CardContent } from "@nextdays/ui/card";
import { Switch } from "@nextdays/ui/switch";
import { setzeBenachrichtigungen } from "@/lib/portal-benachrichtigungen";
import {
  PORTAL_KATEGORIEN,
  type NotificationOverview,
} from "@/lib/portal-benachrichtigungen-typen";

export function PortalBenachrichtigungen({
  overview,
  error,
}: {
  overview: NotificationOverview | null;
  error: string | null;
}) {
  const t = useTranslations("portal");

  // Lokaler Zustand je Spalte (`<schluessel>_<kanal>`), damit der Schalter
  // sofort reagiert. Scheitert das PATCH, wird er zurückgedreht — es bleibt
  // kein falscher Zustand stehen (Wurzel 5).
  const [zustand, setZustand] = useState<Record<string, boolean>>(() => {
    const z: Record<string, boolean> = {};
    for (const k of overview?.kategorien ?? []) {
      for (const kanal of k.kanaele) {
        z[`${k.schluessel}_${kanal.kanal}`] = kanal.aktiv;
      }
    }
    return z;
  });
  const [speichert, setSpeichert] = useState<string | null>(null);

  // Nur die Kategorien, die einen Eigentümer betreffen. Die Marketing-Kategorien
  // („Angebote und Updates") gehören in die Konto-Einstellungen des Betriebs,
  // nicht in das Eigentümer-Portal.
  const kategorien = (overview?.kategorien ?? []).filter((k) =>
    PORTAL_KATEGORIEN.includes(k.schluessel),
  );

  const umschalten = async (spalte: string, neu: boolean) => {
    if (speichert) return;
    const vorher = zustand[spalte];
    setZustand((z) => ({ ...z, [spalte]: neu }));
    setSpeichert(spalte);
    const res = await setzeBenachrichtigungen({ [spalte]: neu });
    setSpeichert(null);
    if (!res.ok) {
      setZustand((z) => ({ ...z, [spalte]: vorher }));
      toast.error(res.error || t("notifications.saveFailed"));
      return;
    }
    // Der Server ist die Wahrheit: er erzwingt Pflicht-Mails zurück auf „an"
    // und pflegt das Sammel-Opt-out mit. Antwort übernehmen, statt dem lokalen
    // Klick zu glauben.
    const antwort = res.data as Record<string, unknown>;
    if (typeof antwort[spalte] === "boolean") {
      setZustand((z) => ({ ...z, [spalte]: antwort[spalte] as boolean }));
    }
    toast.success(t("notifications.saved"));
  };

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-extrabold">
          {t("notifications.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("notifications.hint")}
        </p>
      </header>

      {error && (
        <div className="rounded-(--radius) border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {kategorien.length === 0 && !error ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
              <Icon icon="ph:bell" className="size-6" />
            </span>
            <p className="text-sm text-muted-foreground">{t("loadFailed")}</p>
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-(--radius) border border-border">
          {kategorien.map((k) => (
            <li
              key={k.schluessel}
              className="flex flex-wrap items-start gap-4 p-4"
            >
              <div className="flex min-w-56 flex-1 flex-col">
                <span className="text-sm font-medium">
                  {/* Fehlt ein Label, steht der Katalog-Schlüssel da — sichtbar
                      falsch statt still leer (Wurzel 4). */}
                  {t.has(`notifications.categories.${k.schluessel}`)
                    ? t(`notifications.categories.${k.schluessel}`)
                    : k.schluessel}
                </span>
                {t.has(`notifications.categories.${k.schluessel}Hint`) && (
                  <span className="text-xs text-muted-foreground">
                    {t(`notifications.categories.${k.schluessel}Hint`)}
                  </span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-6">
                {k.kanaele.map((kanal) => {
                  const spalte = `${k.schluessel}_${kanal.kanal}`;
                  const an = zustand[spalte] ?? kanal.aktiv;
                  return (
                    <label
                      key={spalte}
                      className="flex items-center gap-2 text-sm"
                      title={
                        kanal.aenderbar ? undefined : t("notifications.locked")
                      }
                    >
                      <Switch
                        checked={an}
                        disabled={!kanal.aenderbar || speichert === spalte}
                        onCheckedChange={(wert) => {
                          void umschalten(spalte, wert);
                        }}
                        aria-label={`${k.schluessel} ${kanal.kanal}`}
                      />
                      <span
                        className={
                          kanal.aenderbar
                            ? "text-muted-foreground"
                            : "text-muted-foreground opacity-70"
                        }
                      >
                        {t.has(`notifications.channel.${kanal.kanal}`)
                          ? t(`notifications.channel.${kanal.kanal}`)
                          : kanal.kanal}
                      </span>
                      {!kanal.aenderbar && (
                        <Icon
                          icon="ph:lock-simple"
                          className="size-3.5 text-muted-foreground"
                        />
                      )}
                    </label>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

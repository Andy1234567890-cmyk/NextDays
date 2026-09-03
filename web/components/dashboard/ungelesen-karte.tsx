"use client";

// Die offenen Konversationen aus dem Posteingang: eine Zahl plus die Liste der
// betroffenen Gespräche. Trägt bewusst KEINEN Zeitraum-Selektor, sondern das
// feste Abzeichen „Aktuell" — ein Ungelesen-Stand ist ein Ist-Wert, kein Verlauf.
//
// Bis zum Raster-Umbau war das Inline-JSX in reservations-dashboard.tsx. Sie
// steht jetzt für sich, weil der Kachel-Katalog (`lib/dashboard-katalog.ts`)
// jede Kachel einzeln adressieren muss.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import Link from "next/link";

import { Card, CardContent } from "@nextdays/ui/card";
import {
  KachelKopf,
  PeriodBadge,
} from "@/components/dashboard/kachel-kopf";
import { fmtDate } from "@/lib/dashboard-format";
import { kanalAbzeichen } from "@/lib/kanal-marke";
import type { NachrichtenKennzahlen } from "@/lib/inbox";
import { channelLabelLoose } from "@/lib/channel-logos";

export function UngelesenKarte({ daten }: { daten: NachrichtenKennzahlen }) {
  const t = useTranslations("reservations");

  return (
    <Card className="h-full">
      <CardContent className="flex h-full flex-col gap-4 p-6">
        <KachelKopf
          icon="ph:envelope-open"
          title={t("dashboard.unreadConversations")}
          gross
          rechts={<PeriodBadge label={t("dashboard.badgeCurrent")} />}
        />
        <div>
          <p className="font-display text-4xl font-extrabold leading-none">
            {daten.ungelesen}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("dashboard.unreadConversationsLabel")}
          </p>
        </div>
        {daten.ungelesen_threads.length ? (
          <ul className="max-h-72 divide-y divide-border overflow-y-auto border-t border-border">
            {daten.ungelesen_threads.map((thread) => {
              // Die Bildmarke, NICHT die Wortmarke aus `channelLogoLoose`:
              // „Booking.com" & Co. sind breite Schriftzüge und werden im
              // 2-rem-Kreis zum Fleck (dieselbe Erkenntnis wie im Posteingang,
              // daher derselbe Helfer statt einer Kopie).
              const marke = kanalAbzeichen(thread.ota_name);
              return (
                <li key={thread.id}>
                  <Link
                    href="/posteingang"
                    className="flex items-center gap-3 rounded-xl py-2 transition-colors hover:bg-secondary/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                  >
                    <span
                      className={`flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary ${marke.fg}`}
                      title={channelLabelLoose(thread.ota_name) || undefined}
                    >
                      <Icon icon={marke.icon} className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {thread.guest_name || t("dashboard.unknownGuest")}
                      </p>
                      {thread.arrival_date && thread.departure_date ? (
                        <p className="truncate text-xs text-muted-foreground">
                          {fmtDate(thread.arrival_date)} –{" "}
                          {fmtDate(thread.departure_date)}
                        </p>
                      ) : null}
                    </div>
                    <Icon
                      icon="ph:caret-right"
                      className="size-4 shrink-0 text-muted-foreground"
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="border-t border-border pt-3 text-sm text-muted-foreground">
            {t("dashboard.noUnread")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

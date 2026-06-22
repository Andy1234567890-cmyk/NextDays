"use client";

// Posteingang-Liste: OTA-Buchungen als Threads (Portal, Gast, Aufenthalt).
// Nachricht-Antwort folgt separat (Channex Messaging-API).
import { Icon } from "@iconify/react";
import { useState } from "react";
import { useTranslations } from "next-intl";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { InboxThread } from "@/lib/inbox";

const OTA_ICON: Record<string, string> = {
  "booking.com": "simple-icons:bookingdotcom",
  airbnb: "simple-icons:airbnb",
  expedia: "simple-icons:expedia",
  vrbo: "ph:house",
};

function otaIcon(name: string | null): string {
  if (!name) return "ph:chat-circle";
  return OTA_ICON[name.trim().toLowerCase()] ?? "ph:globe";
}

export function InboxList({
  threads,
  error,
}: {
  threads: InboxThread[];
  error: string | null;
}) {
  const t = useTranslations("inbox");
  const [active, setActive] = useState<string | null>(threads[0]?.id ?? null);
  const current = threads.find((x) => x.id === active) ?? null;

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-6">
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </header>

      {error && (
        <Card>
          <CardContent className="p-4 text-sm text-destructive">{error}</CardContent>
        </Card>
      )}

      {threads.length === 0 && !error ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            {t("empty")}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-12">
          {/* Thread-Liste */}
          <ul className="flex flex-col divide-y divide-border rounded-(--radius) border border-border sm:col-span-5">
            {threads.map((th) => (
              <li key={th.id}>
                <button
                  type="button"
                  onClick={() => setActive(th.id)}
                  className={
                    "flex w-full items-center gap-3 p-3 text-left " +
                    (th.id === active ? "bg-muted/60" : "hover:bg-muted/30")
                  }
                >
                  <Icon icon={otaIcon(th.ota_name)} className="size-5 text-muted-foreground" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">
                      {th.guest_name ?? t("unknownGuest")}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {th.ota_name ?? t("directChannel")}
                      {th.arrival_date ? ` · ${th.arrival_date} → ${th.departure_date ?? ""}` : ""}
                    </span>
                  </div>
                </button>
              </li>
            ))}
          </ul>

          {/* Detail */}
          <Card className="sm:col-span-7">
            {current ? (
              <>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Icon icon={otaIcon(current.ota_name)} className="size-5 text-accent" />
                    {current.guest_name ?? t("unknownGuest")}
                  </CardTitle>
                  <CardDescription>
                    {current.ota_name ?? t("directChannel")}
                    {current.ota_reservation_code ? ` · ${current.ota_reservation_code}` : ""}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{t("stay")}</span>
                    <span>
                      {current.arrival_date} → {current.departure_date}
                    </span>
                  </div>
                  {current.guest_email && (
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t("email")}</span>
                      <span>{current.guest_email}</span>
                    </div>
                  )}
                  <p className="mt-3 rounded-(--radius) border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
                    {t("replyComingSoon")}
                  </p>
                </CardContent>
              </>
            ) : (
              <CardContent className="p-6 text-sm text-muted-foreground">
                {t("selectThread")}
              </CardContent>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

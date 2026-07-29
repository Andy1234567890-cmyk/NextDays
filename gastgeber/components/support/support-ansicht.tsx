"use client";

// Support-Übersicht: entweder die eigenen Anfragen oder der Kontakt-Flow.
//
// Die persistente Anfragen-Liste ist bewusst unser eigener Entwurf: Airbnb
// führt Support im normalen Posteingang (keine Liste), Booking in einer
// Nachrichten-Sektion, und Amazon hat gar kein Ticket-Archiv für Endkunden —
// was dort die Hauptbeschwerde ist. Für Vorgänge, die sich über Wochen ziehen,
// ist eine nachvollziehbare Liste klar besser. Der Spaltenkanon folgt Zendesk:
// Betreff · Thema · Letzte Aktivität · Status.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useFormatierung } from "@/lib/formatierung";
import type { Ticket } from "@/lib/support";
import { useRealtime } from "@/lib/use-realtime";

import { NeueAnfrage } from "./neue-anfrage";
import { STATUS_ANZEIGE, themaLabelKey } from "./themen-katalog";

export function SupportAnsicht({ tickets }: { tickets: Ticket[] }) {
  const t = useTranslations("support");
  const f = useFormatierung();
  const router = useRouter();
  const [neu, setNeu] = useState(tickets.length === 0);

  // Realtime: neue Antworten ändern last_message_at, Statuswechsel den Status —
  // beides muss die Liste ohne Neuladen widerspiegeln.
  useRealtime({
    table: "support_tickets",
    onChange: () => router.refresh(),
  });

  if (neu) {
    return (
      <div className="mx-auto max-w-2xl px-8 py-8 lg:py-12">
        <h1 className="font-sans text-[2rem] font-bold tracking-tight">
          {t("titel")}
        </h1>
        <p className="mt-2 text-[0.9375rem] text-muted-foreground">
          {t("neueAnfrageHinweis")}
        </p>
        <div className="mt-10">
          <NeueAnfrage
            onAbbruch={() =>
              tickets.length > 0 ? setNeu(false) : window.history.back()
            }
          />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-8 py-8 lg:py-12">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-sans text-[2rem] font-bold tracking-tight">
            {t("titel")}
          </h1>
          <p className="mt-2 text-[0.9375rem] text-muted-foreground">
            {t("listeHinweis")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setNeu(true)}
          className="shrink-0 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
        >
          {t("neueAnfrage")}
        </button>
      </div>

      <ul className="mt-8 divide-y divide-border rounded-2xl border border-border">
        {tickets.map((ticket) => {
          const anzeige =
            STATUS_ANZEIGE[ticket.status] ?? STATUS_ANZEIGE.in_bearbeitung;
          const themaKey = themaLabelKey(ticket.category);
          return (
            <li key={ticket.id}>
              <Link
                href={`/support/${ticket.id}`}
                className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/40"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">
                    {ticket.subject}
                  </span>
                  {/* Ohne hinterlegtes Thema entfällt der Teil samt
                      Trennzeichen — kein erfundenes Ersatz-Thema (Wurzel 4). */}
                  <span className="mt-0.5 block text-sm text-muted-foreground">
                    {themaKey ? `${t(themaKey)} · ` : ""}
                    {f.datum(ticket.last_message_at ?? ticket.created_at)}
                  </span>
                </span>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                    anzeige.ton === "du"
                      ? "bg-foreground text-background"
                      : anzeige.ton === "fertig"
                        ? "bg-muted text-muted-foreground"
                        : "bg-muted text-foreground"
                  }`}
                >
                  {t(anzeige.labelKey)}
                </span>
                <Icon
                  icon="ph:caret-right"
                  className="size-4 shrink-0 text-muted-foreground"
                />
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

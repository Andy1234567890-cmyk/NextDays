// Support-Übersicht: Tickets aus beiden Auth-Welten (Betriebs-Nutzer und
// Plattform-Gäste), zuletzt aktive zuerst.
import Link from "next/link";

import { getTickets } from "@/lib/backoffice";
import type { TicketStatus } from "@/lib/backoffice";

import { RealtimeRefresh } from "@/components/realtime-refresh";

const TABS: { status: TicketStatus | "alle"; label: string }[] = [
  { status: "open", label: "Offen" },
  { status: "waiting", label: "Wartend" },
  { status: "resolved", label: "Gelöst" },
  { status: "closed", label: "Geschlossen" },
  { status: "alle", label: "Alle" },
];

// Priorität als Badge: Farbe UND Text. Farbe allein wäre ein WCAG-1.4.1-Verstoß
// (Level A) — und der rohe englische Enum-Wert wäre für das Team ohnehin
// schlechter lesbar als ein Adjektiv.
const PRIO_ANZEIGE: Record<string, { label: string; stil: string }> = {
  urgent: { label: "Dringend", stil: "bg-destructive text-background" },
  high: { label: "Hoch", stil: "bg-foreground text-background" },
  normal: { label: "Normal", stil: "bg-muted text-foreground" },
  low: { label: "Niedrig", stil: "bg-muted text-muted-foreground" },
};

export default async function SupportSeite({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const aktiv = TABS.find((t) => t.status === status)?.status ?? "open";
  const liste = await getTickets({
    status: aktiv === "alle" ? undefined : (aktiv as TicketStatus),
    limit: 100,
  });

  return (
    <div className="px-8 py-8 lg:px-12 lg:py-12">
      {/* Neue Tickets und Antworten erscheinen ohne Neuladen —
          mandantenübergreifend, seit 0206 (is_platform_admin()). */}
      <RealtimeRefresh table="support_tickets" />
      <h1 className="font-sans text-[2rem] font-bold tracking-tight">Support</h1>
      <p className="mt-2 text-[0.9375rem] text-muted-foreground">
        Anfragen von Betrieben und Plattform-Gästen.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t.status}
            href={`/support?status=${t.status}`}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
              aktiv === t.status
                ? "border-foreground bg-foreground text-background"
                : "border-border hover:border-foreground"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {liste.items.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          Keine Tickets in dieser Ansicht.
        </p>
      ) : (
        <>
          <p className="mt-8 text-sm text-muted-foreground">
            {liste.total} Tickets
          </p>
          <ul className="mt-4 divide-y divide-border rounded-2xl border border-border">
            {liste.items.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/support/${t.id}`}
                  className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-muted/40"
                >
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${
                      (PRIO_ANZEIGE[t.priority] ?? PRIO_ANZEIGE.normal).stil
                    }`}
                  >
                    {(PRIO_ANZEIGE[t.priority] ?? PRIO_ANZEIGE.normal).label}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">
                      {t.subject}
                    </span>
                    <span className="mt-0.5 block truncate text-sm text-muted-foreground">
                      {/* Die Herkunft benennen — Betrieb oder Plattform-Gast. */}
                      {t.tenant_name
                        ? t.tenant_name
                        : t.reporter_guest_id
                          ? "Plattform-Gast"
                          : "—"}
                      {t.category ? ` · ${t.category}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {t.last_message_at
                      ? new Date(t.last_message_at).toLocaleString("de-DE")
                      : new Date(t.created_at).toLocaleDateString("de-DE")}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

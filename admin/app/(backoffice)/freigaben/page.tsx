// Objekt-Freigabe für den eigenen Marktplatz.
//
// Ein Objekt erscheint auf dem Marktplatz erst, wenn alle drei Achsen stimmen:
// status='active' UND listed_on_marketplace UND moderation_status='approved'.
// OTA-Vertrieb und eigene Website des Betriebs sind davon NICHT betroffen —
// dort ist der Betreiber nicht der Herausgeber.
import Link from "next/link";

import { getModerationQueue, getPlatformMe } from "@/lib/backoffice";
import type { ModerationStatus } from "@/lib/backoffice";

import { FreigabeKarte } from "@/components/freigabe-karte";
import { RealtimeRefresh } from "@/components/realtime-refresh";

const TABS: { status: ModerationStatus; label: string }[] = [
  { status: "pending", label: "Wartend" },
  { status: "approved", label: "Freigegeben" },
  { status: "rejected", label: "Abgelehnt" },
];

export default async function FreigabenSeite({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const aktiv = (TABS.find((t) => t.status === status)?.status ??
    "pending") as ModerationStatus;

  const [me, liste] = await Promise.all([
    getPlatformMe(),
    getModerationQueue({ status: aktiv, limit: 100 }),
  ]);

  return (
    <div className="px-8 py-8 lg:px-12 lg:py-12">
      <h1 className="font-sans text-[2rem] font-bold tracking-tight">
        Freigaben
      </h1>
      {/* Reicht ein Gastgeber ein Objekt ein, erscheint es sofort. Möglich
          seit 0206: is_platform_admin() erlaubt Backoffice-Nutzern das
          mandantenübergreifende LESEN von properties (nur SELECT — der
          Schreibpfad ist seit 0207 auch für Betriebe geschlossen). */}
      <RealtimeRefresh table="properties" />
      <p className="mt-2 max-w-2xl text-[0.9375rem] text-muted-foreground">
        Objekte erscheinen auf dem myNextDays-Marktplatz erst nach Freigabe.
        Der Vertrieb über Portale und die eigene Website des Betriebs läuft
        unabhängig davon weiter.
      </p>

      <div className="mt-6 flex gap-2">
        {TABS.map((t) => (
          <Link
            key={t.status}
            href={`/freigaben?status=${t.status}`}
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

      {!me.can_write && (
        <p className="mt-6 rounded-xl bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
          Dein Zugang darf Objekte ansehen, aber nicht entscheiden.
        </p>
      )}

      {liste.items.length === 0 ? (
        <p className="mt-8 text-sm text-muted-foreground">
          {aktiv === "pending"
            ? "Keine Objekte warten auf Freigabe."
            : "Keine Objekte in dieser Ansicht."}
        </p>
      ) : (
        <>
          <p className="mt-8 text-sm text-muted-foreground">
            {liste.total} Objekte
          </p>
          <div className="mt-4 space-y-4">
            {liste.items.map((o) => (
              <FreigabeKarte
                key={o.id}
                objekt={o}
                darfEntscheiden={me.can_write}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

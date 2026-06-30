// Hinweis-Banner: Zahlungen (Stripe) noch nicht aktiviert.
// Erscheint im Dashboard, solange der Connected Account des Tenants nicht
// charges_enabled ist — damit der Nutzer sofort sieht, dass das Onboarding
// unvollständig ist und Objekte/Verkauf noch nicht möglich sind. Server-
// Komponente: liest den echten Status; ohne Account/ohne offene Punkte wird
// nichts gerendert.
import { Icon } from "@iconify/react";
import Link from "next/link";

import { getConnectStatus, getStoredConnectAccountId } from "@/lib/payments";

export async function PaymentsStatusBanner() {
  const accountId = await getStoredConnectAccountId();
  if (!accountId) {
    // Noch gar kein Account → Einrichtung anstoßen.
    return <Banner variant="missing" />;
  }
  const status = await getConnectStatus(accountId);
  if (!status.ok || status.data.charges_enabled) {
    // Aktiv (oder Status nicht lesbar) → kein Banner.
    return null;
  }
  return <Banner variant="incomplete" />;
}

function Banner({ variant }: { variant: "missing" | "incomplete" }) {
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-3">
        <Icon
          icon="ph:warning-circle"
          className="mt-0.5 size-5 shrink-0 text-amber-600"
        />
        <div className="flex flex-col">
          <span className="font-semibold text-amber-900">
            Zahlungen noch nicht aktiviert
          </span>
          <span className="text-sm text-amber-900/80">
            {variant === "missing"
              ? "Richte deine Auszahlungen ein, um Objekte anzulegen und Buchungen zu empfangen."
              : "Es fehlen noch Angaben zur Zahlungsfreischaltung. Schließe die Einrichtung ab, um Objekte anzulegen."}
          </span>
        </div>
      </div>
      <Link
        href="/konto/zahlungen"
        className="flex shrink-0 items-center justify-center gap-2 rounded-full bg-amber-600 px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
      >
        <Icon icon="ph:credit-card" className="size-4" />
        Jetzt einrichten
      </Link>
    </div>
  );
}

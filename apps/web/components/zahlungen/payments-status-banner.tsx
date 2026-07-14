// Hinweis-Banner: Zahlungen (Stripe) — Status im Dashboard.
// Server-Komponente, liest den ECHTEN Connect-Status des Tenants und zeigt ihn
// an, solange der Account nicht voll aktiviert ist:
//   - kein Account            → "missing"    (Einrichtung anstoßen)
//   - Account, aber Status     → "error"      (Status NICHT lesbar — z.B. Stripe
//     nicht lesbar             im Backend nicht konfiguriert; NICHT verschlucken!)
//   - Account, nicht aktiv     → "incomplete" (Angaben fehlen / Stripe prüft noch)
//   - Account, charges_enabled → null         (alles aktiv → kein Banner)
// Wichtig: ein fehlgeschlagener Status-Call darf NICHT wie "alles ok" wirken —
// sonst bliebe ein kaputter/nicht konfigurierter Stripe-Pfad unsichtbar.
import { Icon } from "@iconify/react";
import Link from "next/link";

import { getConnectStatus, getStoredConnectAccountId } from "@/lib/payments";

type Variant = "missing" | "incomplete" | "error";

export async function PaymentsStatusBanner() {
  const accountId = await getStoredConnectAccountId();
  if (!accountId) {
    // Noch gar kein Account → Einrichtung anstoßen.
    return <Banner variant="missing" />;
  }
  const status = await getConnectStatus(accountId);
  if (!status.ok) {
    // Status NICHT lesbar (Backend-Fehler / Stripe nicht konfiguriert) → sichtbar
    // machen statt zu verschlucken.
    return <Banner variant="error" detail={status.error} />;
  }
  if (status.data.charges_enabled) {
    // Voll aktiviert → kein Banner.
    return null;
  }
  // Account vorhanden, aber noch nicht freigeschaltet. Rohe Stripe-Pfade
  // (z. B. „individual.dob.day") NICHT anzeigen — der Nutzer kann damit nichts
  // anfangen; der Banner-Text erklärt es bereits, Details pflegt er in /konto.
  return <Banner variant="incomplete" />;
}

const COPY: Record<Variant, { color: string; title: string; body: string }> = {
  missing: {
    color: "amber",
    title: "Zahlungen noch nicht eingerichtet",
    body: "Richte deine Auszahlungen ein, um Objekte anzulegen und Buchungen zu empfangen.",
  },
  incomplete: {
    color: "amber",
    title: "Zahlungen noch nicht aktiviert",
    body: "Es fehlen noch Angaben zur Zahlungsfreischaltung. Schließe die Einrichtung ab, um Objekte anzulegen.",
  },
  error: {
    color: "red",
    title: "Zahlungs-Status nicht abrufbar",
    body: "Der Stripe-Status konnte nicht geladen werden. Bitte Einrichtung prüfen.",
  },
};

const STYLES = {
  amber: {
    box: "border-amber-300 bg-amber-50",
    icon: "text-amber-600",
    title: "text-amber-900",
    body: "text-amber-900/80",
    btn: "bg-amber-600",
  },
  red: {
    box: "border-red-300 bg-red-50",
    icon: "text-red-600",
    title: "text-red-900",
    body: "text-red-900/80",
    btn: "bg-red-600",
  },
} as const;

function Banner({ variant, detail }: { variant: Variant; detail?: string }) {
  const copy = COPY[variant];
  const s = STYLES[copy.color as keyof typeof STYLES];
  return (
    <div
      className={`mb-4 flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between ${s.box}`}
    >
      <div className="flex items-start gap-3">
        <Icon
          icon="ph:warning-circle"
          className={`mt-0.5 size-5 shrink-0 ${s.icon}`}
        />
        <div className="flex flex-col">
          <span className={`font-semibold ${s.title}`}>{copy.title}</span>
          <span className={`text-sm ${s.body}`}>{copy.body}</span>
          {detail ? (
            <span className={`mt-1 text-xs ${s.body}`}>{detail}</span>
          ) : null}
        </div>
      </div>
      <Link
        href="/konto"
        className={`flex shrink-0 items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 ${s.btn}`}
      >
        <Icon icon="ph:credit-card" className="size-4" />
        Jetzt einrichten
      </Link>
    </div>
  );
}

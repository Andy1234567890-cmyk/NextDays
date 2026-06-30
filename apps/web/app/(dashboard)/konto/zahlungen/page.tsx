// Konto → Zahlungen.
// Server-Komponente: ermittelt Tenant + E-Mail aus der NextDays-Session (getMe),
// gated auf die Capability MANAGE_BILLING (Admin/Co-Admin), lädt einen bereits
// angelegten Connect-Account + dessen KYC-Status vor und rendert das eigene
// white-label Stripe-Connect-Onboarding (StripeOnboarding). Kein Stripe-hosted
// Onboarding — die Daten gehen über lib/payments.ts ans Backend.
import { redirect } from "next/navigation";

import { StripeOnboarding } from "@/components/zahlungen/stripe-onboarding";
import { getMe } from "@/lib/auth";
import { getFirmenProfil } from "@/lib/firmenprofil";
import {
  getConnectStatus,
  getStoredConnectAccountId,
  type ConnectStatus,
} from "@/lib/payments";

export const dynamic = "force-dynamic";

export default async function ZahlungenPage() {
  const me = await getMe();
  if (!me) redirect("/login");

  // UI-Gating: nur Admin/Co-Admin mit MANAGE_BILLING dürfen Zahlungen einrichten.
  if (!me.capabilities.includes("manage_billing")) {
    return (
      <div className="flex flex-col gap-4">
        <header className="flex flex-col gap-1">
          <h2 className="font-display text-xl font-extrabold">Zahlungen</h2>
        </header>
        <p className="rounded-(--radius) border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          Für die Einrichtung von Zahlungen brauchst du die Berechtigung zur
          Verwaltung der Abrechnung. Wende dich an einen Administrator.
        </p>
      </div>
    );
  }

  if (!me.tenant_id) {
    return (
      <div className="flex flex-col gap-4">
        <header className="flex flex-col gap-1">
          <h2 className="font-display text-xl font-extrabold">Zahlungen</h2>
        </header>
        <p className="rounded-(--radius) border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          Es ist noch kein Unternehmen mit deinem Konto verknüpft. Schließe
          zuerst das Onboarding ab.
        </p>
      </div>
    );
  }

  // Bereits angelegten Account + dessen Live-Status vorladen (kein Fallback:
  // ohne Account bleibt beides null und das Setup-Formular wird gezeigt).
  // Schlägt der Status-Call fehl (z.B. Stripe im Backend nicht konfiguriert),
  // wird der Fehler weitergereicht und sichtbar gemacht — NICHT verschluckt,
  // sonst bliebe ein kaputter Stripe-Pfad als „lädt …" hängen.
  const accountId = await getStoredConnectAccountId();
  let status: ConnectStatus | null = null;
  let statusError: string | null = null;
  if (accountId) {
    const res = await getConnectStatus(accountId);
    if (res.ok) {
      status = res.data;
    } else {
      statusError = res.error;
    }
  }

  // Land aus dem Firmenprofil für die Vorbefüllung (rein optional).
  const profil = await getFirmenProfil();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h2 className="font-display text-xl font-extrabold">Zahlungen</h2>
        <p className="text-sm text-muted-foreground">
          Richte dein Zahlungskonto ein, um Gästezahlungen zu empfangen und
          Auszahlungen zu erhalten.
        </p>
      </header>

      <StripeOnboarding
        tenantId={me.tenant_id}
        email={me.email ?? (profil.ok ? String(profil.data.email ?? "") : "")}
        initialAccountId={accountId}
        initialStatus={status}
        initialStatusError={statusError}
      />
    </div>
  );
}

"use client";

// Zahlungen-Abschnitt direkt auf der Konto-Seite (/konto) — kein eigener Tab.
// Lädt Tenant/E-Mail/Capability (getMe) + den bereits angelegten Connect-Account
// und dessen Live-Status über Server-Actions (lib/payments.ts) und rendert das
// eigene white-label Stripe-Onboarding. So liegt die komplette Zahlungs-
// einrichtung im Admin-Konto, ohne separate Unterseite.
//
// Capability-Gate: nur Admin/Co-Admin mit MANAGE_BILLING dürfen Zahlungen
// einrichten — sonst Hinweis (wie auf der früheren Zahlungs-Unterseite). Fehler
// beim Status-Laden werden durchgereicht und sichtbar gemacht (nicht verschluckt).
import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";

import { StripeOnboarding } from "@/components/zahlungen/stripe-onboarding";
import { Separator } from "@/components/ui/separator";
import { getMe } from "@/lib/auth";
import { getFirmenProfil } from "@/lib/firmenprofil";
import {
  getConnectStatus,
  getStoredConnectAccountId,
  type ConnectStatus,
} from "@/lib/payments";

type Loaded = {
  canManage: boolean;
  tenantId: string | null;
  email: string;
  accountId: string | null;
  status: ConnectStatus | null;
  statusError: string | null;
};

export function KontoZahlungenSection() {
  const [state, setState] = useState<Loaded | null>(null);

  useEffect(() => {
    let active = true;
    void (async () => {
      const me = await getMe();
      if (!active) return;
      if (!me) {
        setState({
          canManage: false,
          tenantId: null,
          email: "",
          accountId: null,
          status: null,
          statusError: null,
        });
        return;
      }
      const canManage = me.capabilities.includes("manage_billing");
      // E-Mail aus Session, sonst aus dem Firmenprofil (kein erfundener Wert).
      let email = me.email ?? "";
      if (!email) {
        const profil = await getFirmenProfil();
        if (active && profil.ok) email = String(profil.data.email ?? "");
      }
      // Account + Live-Status nur laden, wenn der Nutzer Zahlungen verwalten darf.
      let accountId: string | null = null;
      let status: ConnectStatus | null = null;
      let statusError: string | null = null;
      if (canManage && me.tenant_id) {
        accountId = await getStoredConnectAccountId();
        if (accountId) {
          const res = await getConnectStatus(accountId);
          if (res.ok) status = res.data;
          else statusError = res.error;
        }
      }
      if (!active) return;
      setState({
        canManage,
        tenantId: me.tenant_id ?? null,
        email,
        accountId,
        status,
        statusError,
      });
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="flex flex-col gap-5">
      <Separator />
      <div className="flex flex-col gap-1">
        <h3 className="font-display text-lg font-extrabold">Zahlungen</h3>
        <p className="text-sm text-muted-foreground">
          Richte dein Zahlungskonto ein, um Gästezahlungen zu empfangen und
          Auszahlungen zu erhalten.
        </p>
      </div>

      {state === null ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Icon icon="ph:spinner" className="size-4 animate-spin" />
          Wird geladen …
        </p>
      ) : !state.canManage ? (
        <p className="rounded-(--radius) border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          Für die Einrichtung von Zahlungen brauchst du die Berechtigung zur
          Verwaltung der Abrechnung. Wende dich an einen Administrator.
        </p>
      ) : !state.tenantId ? (
        <p className="rounded-(--radius) border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          Es ist noch kein Unternehmen mit deinem Konto verknüpft. Schließe
          zuerst das Onboarding ab.
        </p>
      ) : (
        <StripeOnboarding
          tenantId={state.tenantId}
          email={state.email}
          initialAccountId={state.accountId}
          initialStatus={state.status}
          initialStatusError={state.statusError}
        />
      )}
    </section>
  );
}

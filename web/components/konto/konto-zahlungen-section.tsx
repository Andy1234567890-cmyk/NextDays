"use client";

// Zahlungen-Abschnitt direkt auf der Konto-Seite (/konto) — kein eigener Tab,
// KEINE doppelten Eingabefelder. Name, Adresse, E-Mail, Telefon, IBAN,
// Geburtsdatum und Website kommen aus den Stammdaten/dem Firmenprofil und werden
// beim Profil-Speichern automatisch an Stripe übertragen. Hier bleibt nur der
// echte Status + der Aktivieren-Button (ToS-Zustimmung).
//
// Lädt Tenant/E-Mail/Capability (getMe) + den bereits angelegten Connect-Account
// und dessen Live-Status über Server-Actions (lib/payments.ts). Fehler beim
// Status-Laden werden durchgereicht und sichtbar gemacht (nicht verschluckt).
import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";

import { PaymentsActivation } from "@/components/zahlungen/payments-activation";
import { Button } from "@nextdays/ui/button";

import { getMe } from "@/lib/auth";
import { getFirmenProfil, resyncStripeProfil } from "@/lib/firmenprofil";
import {
  getConnectStatus,
  getStoredConnectAccountId,
  type ConnectStatus,
} from "@/lib/payments";

type Loaded = {
  canManage: boolean;
  tenantId: string | null;
  accountId: string | null;
  status: ConnectStatus | null;
  statusError: string | null;
  // Letzter Ablehnungsgrund des Zahlungsanbieters (stripe_sync_error). Ohne ihn
  // sah der Nutzer nur „es fehlen Pflichtangaben", obwohl die Angaben da sind
  // und Stripe genau EINE davon (z. B. die Website) zurückgewiesen hat.
  syncError: string | null;
};

// Das Anlegen des Zahlungskontos ist beim Speichern der Stammdaten
// fehlgeschlagen. Grund im Klartext zeigen (er kommt vom Zahlungsanbieter) und
// einen Wiederanlauf anbieten — ohne Button war der Nutzer hier eingesperrt.
function FehlgeschlageneAnlage({ grund }: { grund: string }) {
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-3 rounded-(--radius) border border-destructive/40 bg-destructive/5 p-3">
      <p className="text-sm text-foreground">
        <Icon
          icon="ph:warning"
          className="mr-1.5 inline size-4 align-text-bottom text-destructive"
        />
        Dein Zahlungskonto konnte nicht angelegt werden. Rückmeldung des
        Zahlungsanbieters: {grund}
      </p>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={laeuft}
          onClick={() => {
            setLaeuft(true);
            setFehler(null);
            void (async () => {
              const res = await resyncStripeProfil();
              if (!res.ok) {
                setFehler(res.error);
                setLaeuft(false);
                return;
              }
              window.location.reload();
            })();
          }}
        >
          {laeuft ? "Wird versucht …" : "Nochmal versuchen"}
        </Button>
        {fehler ? (
          <span className="text-sm text-destructive">{fehler}</span>
        ) : null}
      </div>
    </div>
  );
}

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
          accountId: null,
          status: null,
          statusError: null,
          syncError: null,
        });
        return;
      }
      const canManage = me.capabilities.includes("manage_billing");
      let accountId: string | null = null;
      let status: ConnectStatus | null = null;
      let statusError: string | null = null;
      let syncError: string | null = null;
      if (canManage && me.tenant_id) {
        accountId = await getStoredConnectAccountId();
        if (accountId) {
          const res = await getConnectStatus(accountId);
          if (res.ok) status = res.data;
          else statusError = res.error;
        }
        // Der Sync-Fehler wird AUCH ohne Account geladen: scheitert das
        // automatische Anlegen (z. B. Stripe verlangt ein vollständiges
        // Connect-Plattformprofil), gibt es keine acct_-ID — und die Karte zeigte
        // dann nur „speichere zuerst deine Stammdaten", obwohl sie gespeichert
        // sind und der echte Grund am Profil steht (Wurzel 5).
        const profil = await getFirmenProfil();
        if (profil.ok && typeof profil.data.stripeSyncError === "string") {
          syncError = profil.data.stripeSyncError;
        }
      }
      if (!active) return;
      setState({
        canManage,
        tenantId: me.tenant_id ?? null,
        accountId,
        status,
        statusError,
        syncError,
      });
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="flex flex-col gap-5">
      <div className="flex flex-col gap-1">
        <h3 className="font-display text-lg font-extrabold">Zahlungen</h3>
        <p className="text-sm text-muted-foreground">
          Aktivierung deines Zahlungskontos. Alle Angaben kommen aus deinen
          Stammdaten — kein doppeltes Ausfüllen.
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
      ) : !state.accountId ? (
        state.syncError ? (
          <FehlgeschlageneAnlage grund={state.syncError} />
        ) : (
          // Noch kein Stripe-Account: er entsteht automatisch, sobald die
          // Stammdaten (mit E-Mail + Land) gespeichert sind — kein separater
          // manueller Anlege-Schritt.
          <p className="rounded-(--radius) border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
            <Icon
              icon="ph:info"
              className="mr-1.5 inline size-4 align-text-bottom"
            />
            Speichere zuerst deine Stammdaten (inkl. Land und E-Mail). Dein
            Zahlungskonto wird daraus automatisch angelegt; danach erscheint hier
            die Aktivierung.
          </p>
        )
      ) : (
        <>
          <PaymentsActivation
            accountId={state.accountId}
            initialStatus={state.status}
            initialStatusError={state.statusError}
            syncError={state.syncError}
          />
        </>
      )}
    </section>
  );
}

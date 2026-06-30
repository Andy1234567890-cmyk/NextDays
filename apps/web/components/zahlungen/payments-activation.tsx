"use client";

// Zahlungs-Aktivierung (Stripe Connect) — NUR Status + Aktivieren.
// Es gibt KEINE doppelten Eingabefelder: Name, Adresse, E-Mail, Telefon, IBAN,
// Geburtsdatum, Website kommen alle aus den Stammdaten/dem Firmenprofil und
// werden beim Profil-Speichern automatisch an Stripe übertragen
// (buchhaltung.update_company_profile → _ensure_connect_account). Hier bleibt
// nur, was Stripe zusätzlich braucht und nicht „Daten" ist: die ausdrückliche
// ToS-Zustimmung (mit echter Nutzer-IP) — der „Zahlungen aktivieren"-Klick.
//
// Realtime-Pflicht: der KYC-Status wird über den account.updated-Webhook in
// tenant_billing_profile gespiegelt; wir abonnieren die Tabelle (useRealtime,
// WebSocket) und laden bei jeder Änderung live nach — kein Polling.
import { Icon } from "@iconify/react";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  acceptConnectTos,
  getConnectStatus,
  type ConnectStatus,
} from "@/lib/payments";
import { useRealtime } from "@/lib/use-realtime";

// Offene Requirements lesbar machen (statt roher Stripe-Pfade wie
// „individual.dob.day"). Bündelt verwandte Felder zu einem Hinweis und verweist
// dorthin, wo die Daten gepflegt werden — die Stammdaten.
const REQUIREMENT_HINTS: { match: (r: string) => boolean; label: string }[] = [
  { match: (r) => r.startsWith("individual.dob") || r.includes("dob"), label: "Geburtsdatum" },
  { match: (r) => r.includes("address"), label: "Adresse" },
  { match: (r) => r.includes("first_name") || r.includes("last_name"), label: "Name" },
  { match: (r) => r.includes("email"), label: "E-Mail" },
  { match: (r) => r.includes("phone"), label: "Telefon" },
  { match: (r) => r.includes("external_account"), label: "Bankverbindung (IBAN)" },
  { match: (r) => r.includes("business_profile.url"), label: "Website" },
  { match: (r) => r.includes("tos_acceptance"), label: "Zustimmung zu den Nutzungsbedingungen" },
];

function humanizeRequirements(reqs: string[]): string[] {
  const labels = new Set<string>();
  for (const r of reqs) {
    const hint = REQUIREMENT_HINTS.find((h) => h.match(r));
    // tos_acceptance kommt über den Aktivieren-Button — nicht als „fehlende
    // Stammdaten" auflisten.
    if (hint && !r.includes("tos_acceptance")) labels.add(hint.label);
  }
  return [...labels];
}

function StatusBadge({ label, on }: { label: string; on: boolean }) {
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium " +
        (on
          ? "bg-secondary text-secondary-foreground"
          : "bg-muted text-muted-foreground")
      }
    >
      <Icon
        icon={on ? "ph:check-circle-fill" : "ph:circle-dashed"}
        className={"size-3.5 " + (on ? "text-emerald-600" : "")}
      />
      {label}
    </span>
  );
}

type Props = {
  accountId: string;
  initialStatus: ConnectStatus | null;
  initialStatusError: string | null;
};

export function PaymentsActivation({
  accountId,
  initialStatus,
  initialStatusError,
}: Props) {
  const [status, setStatus] = useState<ConnectStatus | null>(initialStatus);
  const [statusError, setStatusError] = useState<string | null>(
    initialStatusError,
  );
  const [accepting, startAccept] = useTransition();

  const reloadStatus = useCallback(async () => {
    const res = await getConnectStatus(accountId);
    if (res.ok) {
      setStatus(res.data);
      setStatusError(null);
    } else {
      setStatusError(res.error);
    }
  }, [accountId]);

  useEffect(() => {
    if (!status && !statusError) void reloadStatus();
  }, [status, statusError, reloadStatus]);

  // account.updated-Webhook schreibt tenant_billing_profile → live nachladen.
  useRealtime({
    table: "tenant_billing_profile",
    onChange: () => void reloadStatus(),
    enabled: true,
  });

  function handleAcceptTos() {
    startAccept(async () => {
      const res = await acceptConnectTos(accountId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setStatus(res.data);
      toast.success("Zahlungen aktiviert.");
    });
  }

  if (statusError) {
    return (
      <div className="flex flex-col gap-2 rounded-(--radius) border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
        <span className="flex items-center gap-2 font-medium">
          <Icon icon="ph:warning-circle" className="size-5 shrink-0" />
          Zahlungs-Status nicht abrufbar
        </span>
        <span className="text-destructive/90">{statusError}</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void reloadStatus()}
          className="self-start"
        >
          <Icon icon="ph:arrow-clockwise" className="size-4" />
          Erneut versuchen
        </Button>
      </div>
    );
  }

  if (!status) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon icon="ph:spinner" className="size-4 animate-spin" />
        Status wird geladen …
      </p>
    );
  }

  const missing = humanizeRequirements(status.requirements);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <StatusBadge label="Zahlungen aktiv" on={status.charges_enabled} />
        <StatusBadge label="Auszahlungen aktiv" on={status.payouts_enabled} />
        <StatusBadge label="Angaben vollständig" on={status.details_submitted} />
      </div>

      {status.disabled_reason && (
        <p className="rounded-(--radius) border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <Icon
            icon="ph:warning"
            className="mr-1.5 inline size-4 align-text-bottom"
          />
          {status.disabled_reason}
        </p>
      )}

      {status.charges_enabled ? (
        <div className="flex items-center gap-2 rounded-(--radius) border border-emerald-600/40 bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
          <Icon
            icon="ph:check-circle-fill"
            className="size-5 shrink-0 text-emerald-600"
          />
          Zahlungen aktiv — du kannst Gästezahlungen empfangen.
        </div>
      ) : (
        <>
          {missing.length > 0 && (
            <div className="flex flex-col gap-2">
              <h4 className="text-sm font-medium">
                Fehlende Angaben (bitte in den Stammdaten ergänzen)
              </h4>
              <ul className="flex flex-wrap gap-2">
                {missing.map((m) => (
                  <li
                    key={m}
                    className="flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"
                  >
                    <Icon icon="ph:circle-dashed" className="size-3.5" />
                    {m}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="accent"
              onClick={handleAcceptTos}
              disabled={accepting}
              className="self-start"
            >
              <Icon
                icon={accepting ? "ph:spinner" : "ph:rocket-launch"}
                className={"size-4 " + (accepting ? "animate-spin" : "")}
              />
              {accepting ? "Wird aktiviert …" : "Zahlungen aktivieren"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Mit dem Klick akzeptierst du die Stripe-Nutzungsbedingungen. Alle
              übrigen Angaben kommen aus deinen Stammdaten.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

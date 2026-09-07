// Abschnitt „Zahlungen & Auszahlungen" (Server-tauglich). Oben die Stripe-
// Einrichtung mit echten Schritten und dem Live-Status des Kontos (vorher stand
// hier nur „Noch nicht verbunden" ohne einen Weg, das zu ändern — Stripe fehlte
// im Gastgeber-Konto komplett), darunter PayPal als reine Anzeige aus
// /payments/settings (kein Erfinden, Wurzel 4).
import { Icon } from "@iconify/react";
import { getTranslations } from "next-intl/server";

import type { AuszahlungsStatus, PaymentSettings } from "@/lib/payments";
import type { Unternehmensprofil } from "@/lib/unternehmen";

import { StripeEinrichtung } from "./stripe-einrichtung";

export async function ZahlungenAbschnitt({
  settings,
  kontoId,
  kontoStatus,
  profil,
}: {
  settings: PaymentSettings | null;
  kontoId: string | null;
  kontoStatus: AuszahlungsStatus | null;
  profil: Unternehmensprofil | null;
}) {
  const t = await getTranslations("konto");
  const paypalOk = !!settings?.paypal_connected;

  return (
    <div>
      <StripeEinrichtung kontoId={kontoId} status={kontoStatus} profil={profil} />

      <div className="border-b border-border py-6">
        <div className="flex items-center justify-between gap-4">
          <p className="font-medium">{t("paypalTitel")}</p>
          <StatusPill ok={paypalOk} />
        </div>
        <p className="mt-1 text-[0.9375rem] text-muted-foreground">
          {paypalOk ? t("paypalAktiv") : t("paypalOffen")}
        </p>
      </div>

      <p className="mt-6 max-w-lg text-sm text-muted-foreground/80">
        {t("zahlungenHinweis")}
      </p>
    </div>
  );
}

async function StatusPill({ ok }: { ok: boolean }) {
  const t = await getTranslations("konto");
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
        ok
          ? "bg-emerald-100 text-emerald-800"
          : "bg-amber-100 text-amber-800"
      }`}
    >
      <Icon
        icon={ok ? "solar:check-circle-bold" : "solar:clock-circle-bold"}
        className="size-3.5"
      />
      {ok ? t("seStatusAktiv") : t("seStatusOffen")}
    </span>
  );
}

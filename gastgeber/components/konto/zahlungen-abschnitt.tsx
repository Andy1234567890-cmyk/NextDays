// Abschnitt „Zahlungen & Auszahlungen" (Server-tauglich, reine Anzeige). Zeigt
// den ECHTEN Stripe-/PayPal-Verbindungsstatus aus /payments/settings (kein
// Erfinden, Wurzel 4). Das eigentliche Verbinden passiert im Finanzen-Bereich.
import { Icon } from "@iconify/react";
import { getTranslations } from "next-intl/server";

import type { PaymentSettings } from "@/lib/payments";

export async function ZahlungenAbschnitt({
  settings,
}: {
  settings: PaymentSettings | null;
}) {
  const t = await getTranslations("konto");

  const stripeStatus = !settings?.stripe_connected
    ? { text: t("stripeVerbinden"), ok: false }
    : settings.stripe_charges_enabled
      ? { text: t("stripeAktiv"), ok: true }
      : { text: t("stripeOffen"), ok: false };

  const paypalOk = !!settings?.paypal_connected;

  return (
    <section>
      <h1 className="mb-8 font-display text-3xl font-semibold tracking-tight">
        {t("zahlungenTitel")}
      </h1>

      <div className="border-b border-border py-6">
        <div className="flex items-center justify-between gap-4">
          <p className="font-medium">{t("stripeTitel")}</p>
          <StatusPill ok={stripeStatus.ok} />
        </div>
        <p className="mt-1 text-[0.9375rem] text-muted-foreground">
          {stripeStatus.text}
        </p>
      </div>

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
    </section>
  );
}

function StatusPill({ ok }: { ok: boolean }) {
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
      {ok ? "Aktiv" : "Offen"}
    </span>
  );
}

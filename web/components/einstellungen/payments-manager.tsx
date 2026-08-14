"use client";

// Zahlungen (Payment settings) — 1:1 nach dem Lodgify-Modell:
//   * Online-Zahlungs-Gateway Stripe: Verbindungsstatus + Verhaltens-Toggles.
//   * Alternative Methoden: PayPal (eigenes Konto verbinden, Multiparty) und
//     Manuelle Zahlungen (IBAN/Bank).
// Sensible Finanzdaten: der Server erzwingt MANAGE_BILLING und schreibt nur die
// Zahlungs-Spalten. Keine Realtime-Subscription (Tabelle ist gegen den anon-
// Direktpfad gesperrt) — der State wird nach eigenem Speichern aktualisiert.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import { Input } from "@nextdays/ui/input";
import { Switch } from "@nextdays/ui/switch";
import { Textarea } from "@nextdays/ui/textarea";
import { Shortcode } from "@/components/shared/shortcode";
import {
  type PaymentSettings,
  type PaymentSettingsResponse,
  startPaypalOnboarding,
  syncPaypalStatus,
  updatePaymentSettings,
} from "@/lib/payment-settings";

function toInput(s: PaymentSettingsResponse): PaymentSettings {
  const {
    stripe_connected: _c,
    stripe_charges_enabled: _e,
    paypal_onboarding_status: _p,
    paypal_connected: _pc,
    ...rest
  } = s;
  return rest;
}

export function PaymentsManager({
  initial,
}: {
  initial: PaymentSettingsResponse;
}) {
  const t = useTranslations("settings");
  const [settings, setSettings] = useState<PaymentSettingsResponse>(initial);
  const [form, setForm] = useState<PaymentSettings>(toInput(initial));
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof PaymentSettings>(
    key: K,
    value: PaymentSettings[K],
  ) => setForm((f) => ({ ...f, [key]: value }));

  const save = (next?: Partial<PaymentSettings>) => {
    const payload = { ...form, ...next };
    startTransition(async () => {
      const res = await updatePaymentSettings(payload);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setSettings(res.data);
      setForm(toInput(res.data));
      toast.success("Gespeichert.");
    });
  };

  // PayPal-Onboarding starten → zur action_url umleiten. return_url führt zurück
  // auf diese Seite; nach Rückkehr synct der Return-Handler den Status.
  const connectPaypal = () => {
    startTransition(async () => {
      const returnUrl = `${window.location.origin}/einstellungen/zahlungen`;
      const res = await startPaypalOnboarding(returnUrl);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      window.location.href = res.data.action_url;
    });
  };

  // Status nach Rückkehr vom Onboarding neu bei PayPal abfragen.
  const refreshPaypal = () => {
    startTransition(async () => {
      const res = await syncPaypalStatus();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const connected = res.data.receivable && res.data.email_confirmed;
      setSettings((s) => ({
        ...s,
        paypal_connected: connected,
        paypal_onboarding_status: connected ? "completed" : "pending",
      }));
      toast.success(connected ? "PayPal verbunden." : "PayPal-Verbindung noch ausstehend.");
    });
  };

  const stripeActive = form.active_card_gateway === "stripe";

  return (
    <div className="flex flex-col gap-6">
      {/* Online-Zahlungs-Gateways ------------------------------------------ */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Online-Zahlungs-Gateways</h2>

        <Card className="flex flex-col gap-4 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              {/* Echtes Stripe-Original-Logo (public/channels/stripe.svg) —
                  kein generisches Icon (Nutzer-Vorgabe: nur Originallogos). */}
              <span className="flex h-9 w-16 items-center justify-center">
                <img
                  src="/channels/stripe.svg"
                  alt="Stripe"
                  className="h-6 w-auto"
                />
              </span>
              <div className="flex flex-col">
                {stripeActive && (
                  <span className="w-fit rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-600">
                    Aktiviert
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  Kartenzahlung, Apple/Google Pay, über 135 Währungen.
                </span>
              </div>
            </div>

            {stripeActive ? (
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={() => save({ active_card_gateway: "none" })}
              >
                Deaktivieren
              </Button>
            ) : settings.stripe_connected && settings.stripe_charges_enabled ? (
              <Button
                size="sm"
                disabled={pending}
                onClick={() => save({ active_card_gateway: "stripe" })}
              >
                Aktivieren
              </Button>
            ) : (
              <Button size="sm" variant="outline" asChild>
                <a href="/konto">{t("payments.connectStripe")}</a>
              </Button>
            )}
          </div>

          {!settings.stripe_connected && (
            <p className="rounded-(--radius) border border-border bg-muted/40 p-3 text-xs text-muted-foreground">
              Verbinde zuerst dein Stripe-Konto unter{" "}
              <a href="/konto" className="text-accent underline">
                Konto → Zahlungen
              </a>
              , um Kartenzahlungen zu aktivieren.
            </p>
          )}
          {settings.stripe_connected && !settings.stripe_charges_enabled && (
            <p className="rounded-(--radius) border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700">
              Dein Stripe-Konto ist verbunden, aber noch nicht abrechnungsfähig
              (offene Verifizierung). Schließe die Einrichtung unter Konto ab.
            </p>
          )}

          {/* Verhaltens-Toggles der Kartenzahlung */}
          {stripeActive && (
            <>
              <div className="flex flex-col divide-y divide-border border-t border-border pt-1">
                <ToggleRow
                  label={t("payments.autoChargeFirst")}
                  hint="Die erste (Sofort-)Anzahlung wird beim Buchen direkt von der Karte eingezogen. Aus: der Gast erhält stattdessen einen Zahlungslink."
                  checked={form.auto_charge_first_deposit}
                  disabled={pending}
                  onChange={(v) => save({ auto_charge_first_deposit: v })}
                />
                <ToggleRow
                  label={t("payments.autoPreauthDeposit")}
                  hint="Die Kaution wird gemäß der Kondition vorautorisiert (Betrag wird auf der Karte reserviert, nicht abgebucht). Vorautorisierungen können oft nur ~7 Tage garantiert werden."
                  checked={form.auto_preauth_deposits}
                  disabled={pending}
                  onChange={(v) => save({ auto_preauth_deposits: v })}
                />
                <ToggleRow
                  label={t("payments.autoChargeFuture")}
                  hint="Die für die Anzahlung gespeicherte Karte wird zur fälligen Restzahlung automatisch belastet. Aus: der Gast erhält stattdessen einen Zahlungslink."
                  checked={form.auto_charge_scheduled}
                  disabled={pending}
                  onChange={(v) => save({ auto_charge_scheduled: v })}
                />
                <ToggleRow
                  label={t("payments.verifyCard")}
                  hint="Die Karte wird vor Bestätigung geprüft und hinterlegt (ohne Belastung), z. B. bei Buchungsanfragen."
                  checked={form.verify_card_before_booking}
                  disabled={pending}
                  onChange={(v) => save({ verify_card_before_booking: v })}
                />
                <ToggleRow
                  label={t("payments.autoRefund")}
                  hint="Löst eine Stornierungsbedingung eine geplante Rückerstattung aus, wird sie automatisch über Stripe erstattet. Aus: der Betrag wird nur berechnet und ist manuell auszulösen."
                  checked={form.auto_refund_on_cancel}
                  disabled={pending}
                  onChange={(v) => save({ auto_refund_on_cancel: v })}
                />
              </div>

              {/* Name des Händlers (Statement-Descriptor) */}
              <div className="flex flex-col gap-1.5 border-t border-border pt-4">
                <span className="text-sm font-medium">{t("payments.merchantName")}</span>
                <p className="text-xs text-muted-foreground">
                  Geben Sie den Namen Ihres Unternehmens ein, der dem Gast auf der
                  Kartenabrechnung erscheint und Ihre Zahlungen sicher verifiziert.
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder={t("payments.merchantNamePlaceholder")}
                    value={form.merchant_name ?? ""}
                    disabled={pending}
                    onChange={(e) =>
                      set("merchant_name", e.target.value || null)
                    }
                  />
                  <Button
                    variant="outline"
                    disabled={pending}
                    onClick={() => save()}
                  >
                    Speichern
                  </Button>
                </div>
              </div>
            </>
          )}
        </Card>
      </section>

      {/* Alternative Methoden ---------------------------------------------- */}
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">{t("payments.alternativeMethods")}</h2>

        {/* PayPal — eigenes Geschäftskonto verbinden (Multiparty) */}
        <Card className="flex flex-col gap-4 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              {/* Echtes PayPal-Original-Logo (public/channels/paypal.svg). */}
              <span className="flex h-9 w-20 items-center justify-center">
                <img
                  src="/channels/paypal.svg"
                  alt="PayPal"
                  className="h-6 w-auto"
                />
              </span>
              <div className="flex flex-col">
                {settings.paypal_connected && (
                  <span className="w-fit rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-600">
                    Verbunden
                  </span>
                )}
                {!settings.paypal_connected &&
                  settings.paypal_onboarding_status === "pending" && (
                    <span className="w-fit rounded-full bg-amber-500/15 px-2 py-0.5 text-xs font-medium text-amber-600">
                      Verbindung ausstehend
                    </span>
                  )}
                <span className="text-xs text-muted-foreground">
                  Verbinde dein eigenes PayPal-Geschäftskonto. Gäste zahlen per
                  PayPal, das Geld geht direkt an dich.
                </span>
              </div>
            </div>

            {settings.paypal_connected ? (
              <Button
                variant="outline"
                size="sm"
                disabled={pending}
                onClick={refreshPaypal}
              >
                Status prüfen
              </Button>
            ) : (
              <Button size="sm" disabled={pending} onClick={connectPaypal}>
                PayPal verbinden
              </Button>
            )}
          </div>

          {!settings.paypal_connected &&
            settings.paypal_onboarding_status === "pending" && (
              <p className="rounded-(--radius) border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700">
                Das Onboarding wurde gestartet, ist aber noch nicht abgeschlossen.
                Schließe die Schritte in deinem PayPal-Konto ab und klicke dann auf
                „Status prüfen".
              </p>
            )}
          {settings.paypal_onboarding_status === "revoked" && (
            <p className="rounded-(--radius) border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              Die PayPal-Freigabe wurde entzogen. Verbinde dein Konto erneut, um
              wieder PayPal-Zahlungen zu empfangen.
            </p>
          )}
        </Card>

        {/* Manuelle Zahlungen */}
        <Card className="flex flex-col gap-4 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-(--radius) bg-muted">
                <Icon icon="ph:bank" className="size-5 text-foreground" />
              </span>
              <div className="flex flex-col">
                <span className="font-medium">{t("payments.manualPayments")}</span>
                <span className="text-xs text-muted-foreground">
                  Banküberweisung, Bargeld, POS. Erfordert manuelle Erfassung —
                  keine automatischen Folgezahlungen oder Rückerstattungen.
                </span>
              </div>
            </div>
            <Switch
              checked={form.manual_payments_enabled}
              disabled={pending}
              onCheckedChange={(v) =>
                save({ manual_payments_enabled: v })
              }
              aria-label={t("payments.enableManual")}
            />
          </div>

          {form.manual_payments_enabled && (
            <div className="grid grid-cols-1 gap-3 border-t border-border pt-4 sm:grid-cols-2">
              <BankField
                label="IBAN"
                value={form.iban}
                disabled={pending}
                onChange={(v) => set("iban", v)}
              />
              <BankField
                label={t("payments.bic")}
                value={form.bic}
                disabled={pending}
                onChange={(v) => set("bic", v)}
              />
              <BankField
                label={t("payments.bankName")}
                value={form.bank_name}
                disabled={pending}
                onChange={(v) => set("bank_name", v)}
              />
              <BankField
                label={t("payments.recipientName")}
                value={form.account_holder}
                disabled={pending}
                onChange={(v) => set("account_holder", v)}
              />
              {/* Zahlungshinweis + Steuersatz: die beiden Werte stehen in der
                  Zahlungsaufforderung an den Gast und speisen die Platzhalter
                  {{payment_text}} / {{tax_rate}}. Ohne Eingabefeld waren sie
                  nicht pflegbar — eine Vorlage mit diesen Bausteinen wurde
                  deshalb nie gesendet. */}
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{t("payments.paymentTextLabel")}</span>
                  <Shortcode>{`{{payment_text}}`}</Shortcode>
                </span>
                <Textarea
                  rows={3}
                  value={form.default_payment_text ?? ""}
                  disabled={pending}
                  placeholder={t("payments.paymentTextPlaceholder")}
                  onChange={(e) => set("default_payment_text", e.target.value || null)}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">{t("payments.taxRateLabel")}</span>
                  <Shortcode>{`{{tax_rate}}`}</Shortcode>
                </span>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  max="100"
                  value={form.default_tax_rate ?? ""}
                  disabled={pending}
                  onChange={(e) =>
                    set(
                      "default_tax_rate",
                      e.target.value === "" ? null : Number(e.target.value),
                    )
                  }
                />
              </label>
              <div className="sm:col-span-2">
                <Button disabled={pending} onClick={() => save()}>
                  Bankdaten speichern
                </Button>
              </div>
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium">{label}</span>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </div>
      <Switch
        checked={checked}
        disabled={disabled}
        onCheckedChange={onChange}
        aria-label={label}
      />
    </div>
  );
}

function BankField({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: string | null;
  disabled?: boolean;
  onChange: (v: string | null) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium">{label}</span>
      <Input
        value={value ?? ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value || null)}
      />
    </div>
  );
}

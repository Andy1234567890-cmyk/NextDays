// Stripe-Bezahlschritt im myBestDays-Branding (eigenes UI, kein Stripe-Redirect).
// Lädt für eine angelegte Reservierung den PaymentIntent (Destination Charge),
// rendert das Payment Element (Karten + lokale Methoden, 3DS automatisch) und
// bestätigt clientseitig. Der finale „bezahlt"-Status kommt serverseitig über den
// Stripe-Webhook — hier wird nur der Erfolg der Bestätigung angezeigt.
"use client";

import { Icon } from "@iconify/react";
import {
  Elements,
  PaymentElement,
  useElements,
  useStripe,
} from "@stripe/react-stripe-js";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { ladeZahlungsIntent } from "@/lib/buchung";

type Phase =
  | { kind: "loading" }
  | { kind: "error"; msg: string }
  | { kind: "ready"; clientSecret: string; publishableKey: string };

// Stripe.js-Instanz je Publishable Key cachen (loadStripe nur einmal je Key).
const _stripeCache = new Map<string, Promise<Stripe | null>>();
function stripePromise(key: string): Promise<Stripe | null> {
  let p = _stripeCache.get(key);
  if (!p) {
    p = loadStripe(key);
    _stripeCache.set(key, p);
  }
  return p;
}

export function StripeCheckout({
  reservationId,
  depositHint,
  onPaid,
}: {
  reservationId: string;
  depositHint?: string | null;
  onPaid?: () => void;
}) {
  const t = useTranslations("zahlung");
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });

  useEffect(() => {
    let active = true;
    (async () => {
      const res = await ladeZahlungsIntent(reservationId);
      if (!active) return;
      if (res.ok) {
        setPhase({
          kind: "ready",
          clientSecret: res.data.client_secret,
          publishableKey: res.data.publishable_key,
        });
      } else {
        setPhase({ kind: "error", msg: res.error });
      }
    })();
    return () => {
      active = false;
    };
  }, [reservationId]);

  if (phase.kind === "loading") {
    return (
      <div className="flex items-center gap-2 py-6 text-muted-foreground">
        <Icon icon="ph:spinner" className="size-5 animate-spin" />
        {t("vorbereiten")}
      </div>
    );
  }

  if (phase.kind === "error") {
    return (
      <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        <Icon icon="ph:warning-circle" className="mr-1 inline size-4" />
        {phase.msg}
      </div>
    );
  }

  if (!phase.publishableKey) {
    return (
      <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        {t("nichtKonfiguriert")}
      </div>
    );
  }

  return (
    <Elements
      stripe={stripePromise(phase.publishableKey)}
      options={{
        clientSecret: phase.clientSecret,
        appearance: {
          theme: "stripe",
          variables: { borderRadius: "12px", fontFamily: "inherit" },
        },
      }}
    >
      <PayForm depositHint={depositHint} onPaid={onPaid} />
    </Elements>
  );
}

function PayForm({
  depositHint,
  onPaid,
}: {
  depositHint?: string | null;
  onPaid?: () => void;
}) {
  const t = useTranslations("zahlung");
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handlePay() {
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);
    // 3DS/SCA wird vom Payment Element automatisch ausgelöst. return_url ist für
    // redirect-basierte Methoden (iDEAL/Giropay/…) Pflicht (Stripe-Doku); mit
    // redirect:"if_required" wird sie NUR bei einem echten Redirect genutzt —
    // Kartenzahlung bleibt inline ohne Weiterleitung.
    const { error: err } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/checkout/abgeschlossen`,
      },
      redirect: "if_required",
    });
    setSubmitting(false);
    if (err) {
      setError(err.message ?? t("fehlgeschlagen"));
      return;
    }
    // Bestätigung ok — der endgültige „bezahlt"-Status kommt per Webhook.
    setDone(true);
    onPaid?.();
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
        <Icon icon="ph:check-circle" className="mr-1 inline size-4" />
        {t("erhalten")}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PaymentElement />
      {depositHint && (
        <p className="rounded-xl bg-secondary px-3 py-2 text-sm text-muted-foreground">
          <Icon icon="ph:info" className="mr-1 inline size-4" />
          {depositHint}
        </p>
      )}
      {error && (
        <p className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={handlePay}
        disabled={!stripe || submitting}
        className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-primary px-7 font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60 sm:w-auto sm:self-start"
      >
        {submitting ? (
          <Icon icon="ph:spinner" className="size-5 animate-spin" />
        ) : (
          <Icon icon="ph:lock-simple" className="size-5" />
        )}
        {t("jetztBezahlen")}
      </button>
    </div>
  );
}

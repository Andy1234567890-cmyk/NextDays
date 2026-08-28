// Stripe-Bezahlschritt im myNextDays-Branding (eigenes UI, kein Stripe-Redirect).
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

import { ladeZahlungsIntent } from "@/lib/buchung";
import { mitSprache } from "@/lib/sprache";
import { texte } from "@/lib/texte";

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
  clientSecret,
  publishableKey,
  depositHint,
  onPaid,
  sprache = "en",
}: {
  /**
   * Die Reservierung — oder, seit „Zahlung zuerst" (0409), die Buchungsabsicht.
   * Nur noch nötig, wenn kein `clientSecret` mitkommt.
   */
  reservationId: string;
  /**
   * Zahlungsdaten, die der Buchungsaufruf bereits geliefert hat (0409). Sind
   * sie gesetzt, wird NICHT nachgeladen: Für eine Buchungsabsicht gibt es noch
   * keine Reservierung, gegen die `/payments/booking/{id}/intent` laufen
   * könnte — der Aufruf liefe in einen 404.
   */
  clientSecret?: string | null;
  publishableKey?: string | null;
  depositHint?: string | null;
  onPaid?: () => void;
  /**
   * Sprache der Website. Der Renderer hat pro Request genau EINE (siehe
   * lib/texte.ts) und reicht sie durch — ohne sie standen die fünf Texte hier
   * deutsch im Markup jeder Kundenwebsite, auch der dänischen.
   */
  sprache?: string;
}) {
  const t = texte(sprache);
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });

  useEffect(() => {
    let active = true;
    (async () => {
      // Direkt bezahlen, wenn der Buchungsaufruf die Daten schon mitgebracht
      // hat (der Normalfall seit 0409).
      if (clientSecret) {
        // Ohne veröffentlichbaren Schlüssel kann Stripe.js nicht laden. Das ist
        // ein Konfigurationsfehler des Servers und wird als solcher gemeldet,
        // statt mit einem leeren Formular zu enden (Wurzel 4/5).
        if (!publishableKey) {
          setPhase({ kind: "error", msg: t.zahlungNichtKonfiguriert });
          return;
        }
        setPhase({ kind: "ready", clientSecret, publishableKey });
        return;
      }
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
  }, [reservationId, clientSecret, publishableKey, t]);

  if (phase.kind === "loading") {
    return (
      <div className="flex items-center gap-2 py-6 text-muted-foreground">
        <Icon icon="ph:spinner" className="size-5 animate-spin" />
        {t.zahlungVorbereiten}
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
        {t.zahlungNichtKonfiguriert}
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
      <PayForm depositHint={depositHint} onPaid={onPaid} sprache={sprache} />
    </Elements>
  );
}

function PayForm({
  depositHint,
  onPaid,
  sprache,
}: {
  depositHint?: string | null;
  onPaid?: () => void;
  /** Sprache der Website — durchgereicht, nicht neu ermittelt. */
  sprache: string;
}) {
  const t = texte(sprache);
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
        // Die Sprache mit in den Rücksprung: nach einem Redirect-Verfahren
        // (iDEAL, Giropay) kommt der Gast auf einer FRISCHEN Anfrage zurück,
        // die von der vorherigen Seite nichts weiß. Ohne `lang` stünde die
        // Bestätigung — der letzte Eindruck der Buchung — in der
        // Standardsprache.
        return_url: mitSprache(
          `${window.location.origin}/checkout/abgeschlossen`,
          sprache,
        ),
      },
      redirect: "if_required",
    });
    setSubmitting(false);
    if (err) {
      setError(err.message ?? t.zahlungFehlgeschlagen);
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
        {t.zahlungErhalten}
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
        className="btn-marke btn-marke-primaer flex items-center justify-center gap-2 bg-primary px-7 py-3 font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {submitting ? (
          <Icon icon="ph:spinner" className="size-5 animate-spin" />
        ) : (
          <Icon icon="ph:lock-simple" className="size-5" />
        )}
        {t.zahlungJetzt}
      </button>
    </div>
  );
}

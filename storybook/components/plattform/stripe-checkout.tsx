// Storybook-Attrappe des Stripe-Bezahlschritts. Das echte plattform/-Pendant
// lädt einen PaymentIntent (Destination Charge) und rendert das Stripe Payment
// Element. In der Werkstatt gibt es kein Stripe/Backend — hier wird nur das
// myBestDays-Branding um das (hier statische) Zahlungsfeld gezeigt, damit das
// visuelle Design geprüft werden kann.
"use client";

import { Icon } from "@iconify/react";
import { useState } from "react";

export function StripeCheckout({
  depositHint,
  onPaid,
}: {
  reservationId?: string;
  depositHint?: string | null;
  onPaid?: () => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  function handlePay() {
    setSubmitting(true);
    // Attrappe: kein echter Stripe-Confirm, nur Zustandswechsel für die Vorschau.
    setSubmitting(false);
    setDone(true);
    onPaid?.();
  }

  if (done) {
    return (
      <div className="rounded-2xl border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
        <Icon icon="ph:check-circle" className="mr-1 inline size-4" />
        Zahlung erhalten — deine Buchung wird bestätigt. Du erhältst eine E-Mail.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Platzhalter für das Stripe Payment Element (in der App echt gerendert). */}
      <div className="rounded-xl border border-border bg-card p-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Icon icon="ph:credit-card" className="size-4" />
          Kartennummer · MM/JJ · CVC
        </div>
      </div>
      {depositHint && (
        <p className="rounded-xl bg-secondary px-3 py-2 text-sm text-muted-foreground">
          <Icon icon="ph:info" className="mr-1 inline size-4" />
          {depositHint}
        </p>
      )}
      <button
        type="button"
        onClick={handlePay}
        disabled={submitting}
        className="flex items-center justify-center gap-2 rounded-full bg-primary px-7 py-3 font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        <Icon icon="ph:lock-simple" className="size-5" />
        Jetzt bezahlen
      </button>
    </div>
  );
}

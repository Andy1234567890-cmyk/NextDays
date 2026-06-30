// Rückkehr-Seite nach einer redirect-basierten Zahlung (iDEAL/Giropay/…).
// Stripe leitet hierher zurück und hängt `redirect_status` + `payment_intent` an
// die URL. Der endgültige „bezahlt"-Status kommt serverseitig über den Webhook;
// hier wird nur eine ehrliche Rückmeldung gezeigt (kein Status erfunden).
"use client";

import { Icon } from "@iconify/react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

function Result() {
  const params = useSearchParams();
  const status = params.get("redirect_status");

  const ok = status === "succeeded";
  const pending = status === "pending" || status === "processing";

  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <Icon
        icon={ok ? "ph:check-circle" : pending ? "ph:clock" : "ph:warning-circle"}
        className={
          "size-14 " +
          (ok ? "text-emerald-600" : pending ? "text-amber-500" : "text-red-600")
        }
      />
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        {ok
          ? "Zahlung erhalten"
          : pending
            ? "Zahlung wird verarbeitet"
            : "Zahlung nicht abgeschlossen"}
      </h1>
      <p className="text-muted-foreground">
        {ok
          ? "Deine Buchung wird bestätigt. Du erhältst eine E-Mail."
          : pending
            ? "Deine Zahlung wird noch verarbeitet. Sobald sie bestätigt ist, erhältst du eine E-Mail."
            : "Die Zahlung wurde nicht abgeschlossen. Bitte versuche es erneut."}
      </p>
    </main>
  );
}

export default function CheckoutDonePage() {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader compact />
      <Suspense fallback={null}>
        <Result />
      </Suspense>
      <SiteFooter />
    </div>
  );
}

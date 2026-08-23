// Zahlungsergebnis aus den Rückkehr-Parametern von Stripe.
//
// Bewusst eine eigene Client-Datei: die Seite selbst muss eine Server-Component
// sein, damit sie Branding und Menü des Betriebs laden kann (getSiteContext
// liest Request-Header). Ohne diese Trennung stand die Seite unter „use client"
// und die Kopfzeile war ungebrandet.
//
// Der endgültige „bezahlt"-Status kommt serverseitig über den Webhook; hier wird
// nur gezeigt, was Stripe an die URL gehängt hat — kein Status wird erfunden.
"use client";

import { Icon } from "@iconify/react";
import { useSearchParams } from "next/navigation";

export function Ergebnis() {
  const params = useSearchParams();
  const status = params.get("redirect_status");

  const ok = status === "succeeded";
  const pending = status === "pending" || status === "processing";

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center justify-center gap-4 px-6 py-16 text-center">
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
    </div>
  );
}

// Rückkehr-Seite nach einer redirect-basierten Zahlung (iDEAL/Giropay/…).
// Stripe leitet hierher zurück und hängt `redirect_status` + `payment_intent` an
// die URL an. Die Auswertung dieser Parameter liegt in ./ergebnis (Client), damit
// diese Seite eine Server-Component bleiben und das Branding des Betriebs laden
// kann — vorher stand die ganze Seite unter „use client" und trug deshalb eine
// ungebrandete Kopfzeile.
import { Suspense } from "react";

import { SiteShell } from "@/components/site-shell";
import { getSiteContext, navOf } from "@/lib/site-context";
import { spracheWaehlen } from "@/lib/sprache";

import { Ergebnis } from "./ergebnis";

export default async function CheckoutDonePage() {
  const { branding } = await getSiteContext();
  return (
    <SiteShell
      branding={branding}
      nav={navOf(branding)}
      jahr={new Date().getFullYear()}
      sprache={spracheWaehlen(branding)}
      flaeche="bestaetigung"
    >
      <Suspense fallback={null}>
        <Ergebnis />
      </Suspense>
    </SiteShell>
  );
}

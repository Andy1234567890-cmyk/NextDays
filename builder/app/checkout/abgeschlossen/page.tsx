// Die Bestätigungsseite (0474).
//
// Rückkehr-Seite nach einer umleitungsbasierten Zahlung (iDEAL/Giropay/…):
// Stripe leitet hierher zurück und hängt `redirect_status` + `payment_intent`
// an die Adresse.
//
// Seit 0474 ist ihr Inhalt ein BAUSTEIN (`checkout_result`), damit der Betrieb
// seinen eigenen Dankestext setzen und weitere Abschnitte darunter legen kann —
// Anfahrt, Kontakt, ein Hinweis auf das Gast-Portal. Vorher stand hier ein
// fester Satz, den niemand ändern konnte.
//
// Das ERGEBNIS bleibt unantastbar: es kommt von Stripe, der endgültige
// „bezahlt"-Status serverseitig über den Webhook. Gestaltbar ist der Text zu
// jedem der drei Ausgänge, nie der Ausgang selbst.
//
// Server-Component, damit sie Branding und Menü des Betriebs laden kann
// (`getSiteContext` liest Request-Header). Die Auswertung der URL-Parameter
// liegt im Baustein, der ein Client-Stück ist.
import { Suspense } from "react";

import { BlockRenderer } from "@/components/blocks/block-renderer";
import { CheckoutResultBlock } from "@/components/blocks/checkout-blocks";
import { SiteShell } from "@/components/site-shell";
import { aktuellerHost } from "@/lib/host";
import { getSiteContext, navOf } from "@/lib/site-context";
import { ladeSystemseitenVorlage } from "@/lib/site";
import { spracheWaehlen } from "@/lib/sprache";

export default async function CheckoutDonePage({
  searchParams,
}: {
  // `?lang=` — Stripe leitet nach der Zahlung hierher zurück, und die
  // Rücksprung-URL trägt die Sprache mit. Ohne sie stünde die Bestätigung,
  // also der letzte Eindruck der ganzen Buchung, in der falschen Sprache.
  searchParams: Promise<{ lang?: string }>;
}) {
  const { lang } = await searchParams;
  const { tenantId, branding } = await getSiteContext();
  const host = await aktuellerHost();
  const vorlage = host
    ? await ladeSystemseitenVorlage(host, "checkout_abgeschlossen")
    : null;
  // EINMAL bestimmen und beides damit speisen: Schale und Inhalt. Vorher stand
  // der Aufruf nur im `sprache`-Attribut der Schale, der Inhalt bekam keinen
  // `modus` und lief auf Deutsch.
  const sprache = spracheWaehlen(branding, lang);

  return (
    <SiteShell
      branding={branding}
      nav={navOf(branding)}
      jahr={new Date().getFullYear()}
      sprache={sprache}
      flaeche="bestaetigung"
    >
      {/* `Suspense` in beiden Zweigen: der Ergebnis-Baustein liest
          `useSearchParams`, und das verlangt im App Router eine Grenze — ohne
          sie fällt die ganze Seite ins clientseitige Rendern zurück. */}
      <Suspense fallback={null}>
        {vorlage && tenantId ? (
          <BlockRenderer
            blocks={vorlage.blocks}
            tenantId={tenantId}
            // Ohne `modus` fällt der Inhalt auf `locale: "de"` zurück, während
            // die Schale drumherum in der Gastsprache steht.
            modus={{ aktiv: false, locale: sprache }}
          />
        ) : (
          <CheckoutResultBlock content={{}} />
        )}
      </Suspense>
    </SiteShell>
  );
}

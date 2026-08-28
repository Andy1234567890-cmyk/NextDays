// Die Buchungsseite (0474).
//
// WAS HIER VORHER STAND
// Eine Attrappe. Die Seite trug drei Kästen, von denen zwei leer und grau
// waren, einen „Weiter"-Knopf ohne Wirkung, kein Feld für den Namen des Gastes
// und keine Zahlung. Dazu erfundene Angaben, die wie Daten aussahen:
// „3.–5. Juli 2026", „1 Gast", „Wenn du vor dem 1. Juli stornierst …",
// „Seltenes Fundstück – diese Unterkunft ist normalerweise ausgebucht" — und
// ein festes `NAECHTE = 2`, aus dem der angezeigte Preis gerechnet wurde.
//
// Alles davon war deutsch im Markup, auf jeder Kundenseite, auch der dänischen.
// Und alles davon war eine Aussage im Namen des Betriebs, die niemand
// eingegeben hatte (Wurzel 4).
//
// WAS JETZT HIER STEHT
// Nichts als der Rahmen. Der Inhalt sind BAUSTEINE — `checkout_summary` und
// `checkout_form` —, die der Betrieb im Baukasten anordnet und beschriftet. Sie
// holen ihre Zahlen aus dem Angebot des Servers (`/booking-engine/quote`) und
// den Zeitraum aus der Adresse, in die ihn der Buchungs-Block geschrieben hat.
//
// Hat der Betrieb noch keine Vorlage gewählt, gilt das eingebaute Layout
// darunter: Zusammenfassung und Buchungsabschluss nebeneinander. Es ist derselbe
// Aufbau, den die Vorlage „klassisch" setzt — nur ohne eigene Texte. So steht
// ein bestehender Betrieb nicht vor einer leeren Seite (Wurzel 1).
import { notFound } from "next/navigation";

import { BlockRenderer } from "@/components/blocks/block-renderer";
import {
  CheckoutFormBlock,
  CheckoutSummaryBlock,
} from "@/components/blocks/checkout-blocks";
import { SiteShell } from "@/components/site-shell";
import { aktuellerHost } from "@/lib/host";
import { ladeInserat } from "@/lib/inserate";
import { getSiteContext, navOf } from "@/lib/site-context";
import { ladeSystemseitenVorlage } from "@/lib/site";
import { spracheWaehlen } from "@/lib/sprache";

export default async function CheckoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  // `?lang=` — die Sprachwahl des Gastes. Sie fehlte hier ganz: wer die
  // Objektseite auf Dänisch las und dort auf „Buchen" klickte, bekam den
  // Checkout in der Standardsprache. Der Sprachwähler in der Kopfzeile schien
  // also mitten im wichtigsten Schritt zu vergessen, was er kann.
  searchParams: Promise<{ lang?: string }>;
}) {
  const { id } = await params;
  const { lang } = await searchParams;
  // Tenant-Scope (Wurzel 3): der Checkout lud das Inserat vorher UNGESCOPED —
  // mit einer fremden Objekt-ID hätte man über die Direkt-URL die Buchungsstrecke
  // eines anderen Betriebs geöffnet. Der Scope kommt aus der Domain, nicht aus
  // der Anfrage.
  const { tenantId, branding, unknown } = await getSiteContext();
  if (unknown || !tenantId) notFound();
  // Sprache der Website an den Server (0474) — sonst kommen die
  // Ausstattungs-Bezeichnungen auf Englisch zurück.
  const sprache = spracheWaehlen(branding, lang);
  const listing = await ladeInserat(id, { locale: sprache }, tenantId);
  if (!listing) notFound();

  const host = await aktuellerHost();
  const vorlage = host
    ? await ladeSystemseitenVorlage(host, "checkout")
    : null;

  return (
    <SiteShell
      branding={branding}
      nav={navOf(branding)}
      jahr={new Date().getFullYear()}
      sprache={sprache}
      flaeche="zahlung"
    >
      {vorlage ? (
        <BlockRenderer
          // Die Gastsprache MIT in den Inhalt. Ohne `modus` greift der Standard
          // `NICHT_EDITIERBAR` mit `locale: "de"` — dann stand die Kopfzeile
          // in der Gastsprache und der gestaltete Inhalt derselben Seite auf
          // Deutsch. Ausgerechnet auf der Seite mit Geldbezug.
          modus={{ aktiv: false, locale: sprache }}
          blocks={vorlage.blocks}
          tenantId={tenantId}
          objekt={listing}
        />
      ) : (
        // Das eingebaute Layout. Die Anordnung entspricht der Vorlage
        // „klassisch": Formular links, Zusammenfassung rechts mitlaufend.
        <div className="mx-auto w-full max-w-5xl px-6 py-8">
          <div className="grid gap-12 lg:grid-cols-[1fr_24rem]">
            <CheckoutFormBlock content={{}} objekt={listing} />
            <div className="lg:relative">
              <div className="lg:sticky lg:top-28">
                <CheckoutSummaryBlock content={{}} objekt={listing} />
              </div>
            </div>
          </div>
        </div>
      )}
    </SiteShell>
  );
}

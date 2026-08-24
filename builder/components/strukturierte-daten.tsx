// Strukturierte Daten (JSON-LD) für die Seiten einer Kunden-Website (0430).
//
// Was das bringt: eine Suchmaschine liest aus dem sichtbaren Text nicht sicher
// heraus, dass „ab 890 kr" ein Preis und „Havvej 12" eine Anschrift ist.
// JSON-LD sagt es ihr in ihrer Sprache — und erst damit erscheint die Seite als
// Rich Result (Sterne, Preis, Öffnungszeiten) statt als reiner blauer Link.
//
// Vier Typen, weil sie verschiedene Quellen und verschiedene Risiken haben:
//   · Organization/LocalBusiness → Firmenprofil des Betriebs
//   · WebSite + SearchAction      → die Website selbst
//   · BreadcrumbList              → der Seitenpfad
//   · LodgingBusiness + Offer     → je Objektseite
// Jeder ist einzeln abschaltbar (tenant_site_config.schema_*).
//
// WICHTIG — kein Kundencode: der Inhalt entsteht ausschließlich aus geprüften
// eigenen Feldern. Deshalb ist `dangerouslySetInnerHTML` hier vertretbar, und
// deshalb steht der Schalter standardmäßig auf AN. Zusätzlich wird jeder Wert
// durch `JSON.stringify` geführt und das Ergebnis gegen den einen Ausbruch
// gesichert, den JSON-in-HTML zulässt: die Zeichenfolge `</script`.
import type { ReactElement } from "react";

import type { SiteBranding } from "@/lib/site-context";

/** JSON für ein <script>-Element sicher serialisieren.
 *
 *  `JSON.stringify` allein genügt NICHT. Steht in einem Feld die Zeichenfolge
 *  `</script>`, beendet der Browser das Element mitten im JSON — der Rest wird
 *  als HTML gelesen. Das ist der klassische JSON-in-HTML-Ausbruch, und er ist
 *  hier erreichbar: der Firmenname und der Objekttitel kommen aus Eingaben.
 *
 *  `<` wird deshalb als Unicode-Escape geschrieben. Das ist gültiges JSON,
 *  ändert den gelesenen Wert nicht und macht das Element unschließbar. */
function jsonFuerScript(daten: unknown): string {
  return JSON.stringify(daten).replace(/</g, "\\u003c");
}

/** Ein JSON-LD-Block. Mehrere Typen wandern als Array in EIN Element: das ist
 *  laut Schema.org zulässig und spart dem Browser drei Parser-Läufe. */
function LdScript({ daten }: { daten: unknown[] }): ReactElement | null {
  if (daten.length === 0) return null;
  return (
    <script
      type="application/ld+json"
      // Nur eigene, geprüfte Felder (siehe Kopf der Datei).
      dangerouslySetInnerHTML={{
        __html: jsonFuerScript(daten.length === 1 ? daten[0] : daten),
      }}
    />
  );
}

/** Anschrift als `PostalAddress` — oder `undefined`, wenn nichts da ist.
 *
 *  Teilangaben sind gültig: „9881 Bindslev" ohne Straße ist besser als keine
 *  Anschrift. Was NICHT passiert: ein fehlendes Feld mit einem plausiblen Wert
 *  füllen (Wurzel 4) — eine falsche Anschrift in strukturierten Daten ist eine
 *  Falschaussage, die Google gegen die Website verwendet. */
function anschrift(org: NonNullable<SiteBranding["organization"]>) {
  const felder: Record<string, string> = {};
  if (org.street) felder.streetAddress = org.street;
  if (org.postal_code) felder.postalCode = org.postal_code;
  if (org.city) felder.addressLocality = org.city;
  if (org.country) felder.addressCountry = org.country;
  if (Object.keys(felder).length === 0) return undefined;
  return { "@type": "PostalAddress", ...felder };
}

/** Organization/LocalBusiness + WebSite für JEDE Seite der Website.
 *
 *  Steht im Root-Layout und nicht je Seite: die Angaben sind site-weit, und
 *  Google erwartet sie auf jeder Seite (er wertet jede einzeln).
 *
 *  `LodgingBusiness` und nicht `Organization`, sobald eine Anschrift da ist:
 *  der spezifischere Typ ist für Google die stärkere Aussage — er erlaubt
 *  Öffnungszeiten, Bewertungen und den Kartenausschnitt. Ohne Anschrift wäre
 *  `LocalBusiness` eine Behauptung ohne Ort, deshalb dann nur `Organization`. */
export function SiteStrukturierteDaten({
  branding,
  basisUrl,
}: {
  branding: SiteBranding | null | undefined;
  basisUrl: string;
}): ReactElement | null {
  if (!branding) return null;
  const bloecke: unknown[] = [];

  const org = branding.organization;
  if (branding.schema_organization && org?.name) {
    const adresse = anschrift(org);
    const eintrag: Record<string, unknown> = {
      "@context": "https://schema.org",
      // Ein Betrieb, der Unterkünfte vermietet, IST ein LodgingBusiness. Ohne
      // Anschrift bleibt es beim allgemeinen Typ — siehe Kommentar oben.
      "@type": adresse ? "LodgingBusiness" : "Organization",
      name: org.name,
      url: basisUrl,
    };
    if (adresse) eintrag.address = adresse;
    if (org.phone) eintrag.telephone = org.phone;
    if (org.email) eintrag.email = org.email;
    if (branding.logo_url) eintrag.logo = branding.logo_url;
    const social = Object.values(branding.social_links ?? {}).filter(Boolean);
    // `sameAs` verknüpft die Website mit den Profilen desselben Betriebs. Das
    // ist der Weg, auf dem Google „diese Facebook-Seite gehört zu dieser
    // Website" erfährt — ohne ihn sind es für ihn zwei fremde Auftritte.
    if (social.length > 0) eintrag.sameAs = social;
    bloecke.push(eintrag);
  }

  if (branding.site_name) {
    bloecke.push({
      "@context": "https://schema.org",
      "@type": "WebSite",
      name: branding.site_name,
      url: basisUrl,
      // Die Suchbox der Website als Aktion. Damit kann Google in seinem
      // Ergebnis ein eigenes Suchfeld für DIESE Website anbieten.
      potentialAction: {
        "@type": "SearchAction",
        target: {
          "@type": "EntryPoint",
          urlTemplate: `${basisUrl}/?q={search_term_string}`,
        },
        "query-input": "required name=search_term_string",
      },
    });
  }

  return <LdScript daten={bloecke} />;
}

/** BreadcrumbList einer Unterseite.
 *
 *  Nur für Unterseiten: eine Brotkrume mit einem einzigen Element ist keine
 *  Aussage, und Google verwirft sie. Die Startseite bekommt also keine. */
export function BrotkrumenDaten({
  branding,
  basisUrl,
  titel,
  pfad,
}: {
  branding: SiteBranding | null | undefined;
  basisUrl: string;
  titel: string;
  pfad: string;
}): ReactElement | null {
  if (!branding?.schema_breadcrumbs) return null;
  if (!pfad || pfad === "/") return null;
  return (
    <LdScript
      daten={[
        {
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: [
            {
              "@type": "ListItem",
              position: 1,
              // Der Name der Startseite ist der Name der Website. Fehlt er,
              // steht hier der neutrale Begriff — und nicht der Domainname,
              // der in einem Suchergebnis unbeholfen aussieht.
              name: branding.site_name ?? "Start",
              item: basisUrl,
            },
            {
              "@type": "ListItem",
              position: 2,
              name: titel,
              item: `${basisUrl}${pfad}`,
            },
          ],
        },
      ]}
    />
  );
}

/** LodgingBusiness + Offer einer Objektseite.
 *
 *  Der wertvollste der vier Typen: hier entsteht das Suchergebnis mit Preis.
 *  Google zeigt für ein `Offer` mit `price` und `priceCurrency` den Betrag
 *  direkt im Ergebnis an — bei einer Unterkunft ist das der Unterschied
 *  zwischen einem blauen Link und einem Eintrag, der wie ein Portal aussieht.
 *
 *  Was hier NICHT passiert: ein Preis oder eine Bewertung erfinden. Ohne
 *  hinterlegten Preis gibt es kein `Offer` (nicht „ab 0"), ohne echte
 *  Bewertungen kein `aggregateRating`. Beides wäre gegenüber Google eine
 *  Falschaussage — und Google prüft sie: ein Preis im Schema, der auf der Seite
 *  nicht steht, ist ein Verstoß gegen seine Richtlinien und kann die ganze
 *  Domain aus den Rich Results nehmen.
 *
 *  `priceCurrency` kommt aus dem Objekt und wird NIE ersetzt (Wurzel 4): fehlt
 *  sie, entfällt das `Offer` komplett. Ein Betrag ohne Währung ist in
 *  strukturierten Daten unbrauchbar, und ein angenommenes „EUR" wäre bei einem
 *  dänischen Betrieb schlicht falsch. */
export function ObjektStrukturierteDaten({
  branding,
  basisUrl,
  objekt,
}: {
  branding: SiteBranding | null | undefined;
  basisUrl: string;
  objekt: {
    id: string;
    titel: string;
    typ: string;
    ort: string;
    beschreibung: string | null;
    fotos: string[];
    gaeste: number;
    preisProNacht: number | null;
    currency: string | null;
    bewertung?: number;
    anzahlBewertungen?: number;
  };
}): ReactElement | null {
  if (!branding?.schema_lodging) return null;

  const eintrag: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "LodgingBusiness",
    name: objekt.titel,
    url: `${basisUrl}/inserat/${objekt.id}`,
  };
  if (objekt.beschreibung) eintrag.description = objekt.beschreibung;
  // Höchstens sechs Bilder: Google wertet die ersten, und eine Liste mit
  // vierzig URLs bläht jede Seitenantwort auf, ohne etwas hinzuzufügen.
  if (objekt.fotos.length > 0) eintrag.image = objekt.fotos.slice(0, 6);
  if (objekt.ort) {
    // `address` mit nur der Ortsangabe. Die exakte Anschrift eines
    // Ferienobjekts steht bewusst NICHT auf der öffentlichen Seite (sie geht
    // erst nach der Buchung raus) — also darf sie auch nicht im Schema stehen.
    eintrag.address = {
      "@type": "PostalAddress",
      addressLocality: objekt.ort,
    };
  }
  if (objekt.gaeste > 0) {
    eintrag.occupancy = {
      "@type": "QuantitativeValue",
      maxValue: objekt.gaeste,
      unitText: "person",
    };
  }
  if (objekt.preisProNacht != null && objekt.currency) {
    eintrag.makesOffer = {
      "@type": "Offer",
      // `LowPrice` und nicht `price`: der Wert ist ein „ab"-Preis, und genau
      // dafür ist `priceSpecification` mit `minPrice` gedacht. Ihn als festen
      // `price` auszugeben wäre die Falschaussage, die Google beanstandet,
      // sobald der Gast im Buchungsschritt einen höheren Betrag sieht.
      priceSpecification: {
        "@type": "PriceSpecification",
        minPrice: objekt.preisProNacht,
        priceCurrency: objekt.currency,
      },
      availability: "https://schema.org/InStock",
    };
  }
  if (objekt.bewertung != null && (objekt.anzahlBewertungen ?? 0) > 0) {
    eintrag.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: objekt.bewertung,
      reviewCount: objekt.anzahlBewertungen,
    };
  }

  return <LdScript daten={[eintrag]} />;
}

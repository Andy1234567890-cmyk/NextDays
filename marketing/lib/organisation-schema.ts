// Strukturierte Daten zur Firma und zum Produkt — schema.org als JSON-LD.
//
// Wozu das da ist: Suchmaschinen UND Sprachmodelle bauen aus solchen Angaben
// eine Entität („myNextDays ist eine Software von myNextDays ApS in Dänemark").
// Ohne sie müssen beide aus dem Fließtext raten, und genau dabei entsteht die
// Verwechslung, die uns am meisten kostet: myNextDays (das PMS) mit myBestDays
// (dem Marktplatz). `sameAs` und `alternateName` sind der Weg, das explizit zu
// sagen, statt es zu hoffen.
//
// Warum hier und nicht in der jeweiligen Seite: die Angaben beschreiben die
// FIRMA und das PRODUKT, nicht eine einzelne Seite. Sie stehen deshalb einmal
// im Root-Layout und gelten für jede Route. Eine Kopie je Seite wäre derselbe
// Wert an zwanzig Stellen (Wurzel 4).
//
// Alle Werte kommen aus `content/legal/anbieter` — derselben Quelle, aus der
// das Impressum lebt. Es gibt hier bewusst KEINE eigenen Konstanten: eine
// Adresse, die im Impressum stimmt und im JSON-LD veraltet ist, ist schlimmer
// als gar kein JSON-LD, weil sie eine falsche Entität behauptet.
import { ANBIETER } from "@/content/legal/anbieter";
import { siteUrl } from "@/lib/site-url";

/** Stabile Kennung der Firma — Anker, auf den andere Knoten verweisen. */
const ORGANISATION_ID = siteUrl("/#organisation");

/**
 * Die Firma hinter beiden Marken.
 *
 * `sameAs` listet die Profile, über die eine Suchmaschine dieselbe Entität
 * wiedererkennt. Es steht dort nur, was es wirklich gibt (siehe Kommentar an
 * `ANBIETER.social`) — ein erfundenes Profil wäre ein toter Verweis auf eine
 * fremde Seite.
 */
export function organisationSchema(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": ORGANISATION_ID,
    name: ANBIETER.firma,
    alternateName: "myNextDays",
    url: siteUrl("/"),
    logo: siteUrl("/marketing/brand/mynextdays-logo.png"),
    email: ANBIETER.email,
    telephone: ANBIETER.telefonE164,
    address: {
      "@type": "PostalAddress",
      streetAddress: ANBIETER.strasse,
      // `ort` trägt Postleitzahl und Ort in einem Feld („9881 Bindslev"),
      // schema.org will sie getrennt. Die dänische Postleitzahl ist immer
      // vierstellig und steht vorn — deshalb ist die Trennung hier eindeutig
      // und kein Ratespiel.
      postalCode: ANBIETER.ort.split(" ")[0],
      addressLocality: ANBIETER.ort.split(" ").slice(1).join(" "),
      addressCountry: "DK",
    },
    // CVR ist die dänische Handelsregisternummer. `identifier` mit
    // `propertyID` benennt, WELCHE Nummer das ist — eine nackte Zahl wäre für
    // einen Leser ohne Kontext bedeutungslos.
    identifier: {
      "@type": "PropertyValue",
      propertyID: "CVR",
      value: ANBIETER.cvr,
    },
    sameAs: Object.values(ANBIETER.social),
  };
}

/**
 * Das Produkt selbst.
 *
 * `SoftwareApplication` mit `applicationCategory: BusinessApplication` ist die
 * Kategorie, unter der Google Software führt. Bewusst OHNE `aggregateRating`:
 * Bewertungssterne im Suchergebnis dürfen nur aus echten, auf der Seite
 * sichtbaren Bewertungen stammen. Erfundene oder nicht angezeigte Sterne sind
 * ein Richtlinienverstoß und können das ganze Rich-Result kosten (Wurzel 4 —
 * kein plausibler Ersatzwert).
 *
 * `offers` nennt bewusst keinen Betrag: der Einstiegspreis kommt aus Stripe und
 * ist je Währung anders (lib/anzeigewaehrung). Eine feste Zahl hier wäre eine
 * 25. Kopie eines Preises, der sich ändert. Was stattdessen belastbar ist und
 * für einen Interessenten zählt: es gibt eine kostenlose Testphase.
 */
export function produktSchema(beschreibung: string): Record<string, unknown> {
  // Dauer der kostenlosen Testphase in Tagen. Sie steht hier als benannte
  // Konstante und nicht als Zahl im Objekt, damit die Stelle beim nächsten
  // Wechsel auffindbar ist — dieselbe Angabe steht als Fließtext in
  // `messages/*.json` (`meta.description`, `preise.ctaTrial`) und auf der
  // Preisseite. Eine Zusammenführung ist hier NICHT möglich, weil die
  // Sprachdateien den Satz übersetzt tragen und nicht die nackte Zahl; das
  // hier ist die maschinenlesbare Fassung derselben Aussage.
  const TESTPHASE_TAGE = 14;
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": siteUrl("/#produkt"),
    name: "myNextDays",
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "Property Management System",
    operatingSystem: "Web, iOS, Android",
    url: siteUrl("/"),
    description: beschreibung,
    publisher: { "@id": ORGANISATION_ID },
    offers: {
      "@type": "Offer",
      category: "subscription",
      availability: "https://schema.org/InStock",
    },
    // Kostenpflichtig. Die Testphase steht separat darunter — `false` allein
    // sagt „das kostet", ohne den Einstieg zu nennen, den Meta-Beschreibung
    // und Preisseite bewerben.
    isAccessibleForFree: false,
    // Die Testphase als maschinenlesbare Aussage. `QuantitativeValue` mit
    // `unitCode: "DAY"` (UN/CEFACT, das Vokabular, das schema.org dafür
    // vorsieht) statt eines Satzes: „14 Tage kostenlos" im Fließtext kann ein
    // Modell übersehen oder falsch verstehen, ein Zahlenwert mit Einheit
    // nicht.
    freeTrial: {
      "@type": "QuantitativeValue",
      value: TESTPHASE_TAGE,
      unitCode: "DAY",
    },
    softwareHelp: { "@type": "CreativeWork", url: siteUrl("/hilfe") },
  };
}

/**
 * Die Website als Entität.
 *
 * BEWUSST OHNE `potentialAction`/`SearchAction`: Daraus baut Google die
 * Sitelinks-Suchbox, und der einzige Suchendpunkt, den diese Seite hat, ist
 * `/hilfe/suche` — der steht in der robots.txt unter `Disallow` und trägt
 * `noindex` (aus gutem Grund: je Suchbegriff anderer Inhalt). Eine Suchbox,
 * deren Ziel der Crawler nicht abrufen darf, liefert dem Nutzer nichts; sie
 * wäre eine Attrappe, die im Rich-Results-Test grün aussieht und im Ergebnis
 * nie erscheint.
 *
 * Sollte es je eine indexierbare, seitenweite Suche geben, gehört sie hier
 * nachgetragen — dann mit dem ECHTEN Parameternamen, gegen die Route geprüft.
 */
export function websiteSchema(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": siteUrl("/#website"),
    url: siteUrl("/"),
    name: "myNextDays",
    publisher: { "@id": ORGANISATION_ID },
  };
}

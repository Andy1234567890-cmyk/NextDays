import type { LegalDoc } from "../types";

// DE ist die Quell-/Referenzfassung der Gast-AGB: Alle anderen 23 Sprachfassungen
// werden aus dieser Datei übersetzt. Inhaltliche Änderungen IMMER zuerst hier,
// dann in allen Sprachen nachziehen. Zielgruppe sind Verbraucher (Gäste) —
// anders als die Agentur-AGB in apps/web.
export const agb: LegalDoc = {
  title: "Nutzungsbedingungen für Gäste (AGB)",
  stand: "Stand: 3. Juli 2026",
  intro: [
    "Diese Nutzungsbedingungen regeln die Nutzung des Buchungsportals myNextDays (nachfolgend „Plattform“) durch Reisende und Bucher (nachfolgend „Gast“).",
    "Betreiberin der Plattform ist [vollständige Firmierung, Rechtsform, Anschrift und Registerangaben des Betreibers — vor Veröffentlichung ergänzen] (nachfolgend „myNextDays“ oder „wir“).",
  ],
  sections: [
    {
      heading: "§ 1 Geltungsbereich",
      paragraphs: [
        "Diese Bedingungen gelten für die Nutzung der Plattform, insbesondere für die Suche nach Unterkünften und die Buchung von Beherbergungsleistungen über die Plattform.",
        "Für die Beherbergungsleistung selbst gelten ergänzend die Bedingungen des jeweiligen Anbieters (z. B. Hausordnung, Stornobedingungen), die im Angebot ausgewiesen sind.",
      ],
    },
    {
      heading: "§ 2 Rolle von myNextDays; Vertragsschluss",
      paragraphs: [
        "myNextDays vermittelt Beherbergungsleistungen, die von den jeweiligen Anbietern (Agenturen, Vermieter oder Eigentümer, nachfolgend „Anbieter“) angeboten werden. Der Vertrag über die Unterkunft kommt ausschließlich zwischen dem Gast und dem jeweiligen Anbieter zustande. myNextDays wird nicht Vertragspartei des Beherbergungsvertrags.",
        "Der jeweilige Anbieter wird im Angebot und in der Buchungsbestätigung benannt.",
      ],
    },
    {
      heading: "§ 3 Buchung und Buchungsbestätigung",
      paragraphs: [
        "Die Darstellung der Unterkünfte auf der Plattform ist eine Aufforderung zur Abgabe eines Buchungsangebots. Mit dem Abschluss des Buchungsvorgangs (Klick auf den zahlungspflichtigen Buchungs-Button) gibt der Gast ein verbindliches Angebot zum Abschluss eines Beherbergungsvertrags mit dem Anbieter ab.",
        "Der Vertrag kommt zustande, wenn die Buchung bestätigt wird. Die Buchungsbestätigung wird dem Gast an die angegebene E-Mail-Adresse übermittelt.",
        "Der Gast ist verpflichtet, bei der Buchung richtige und vollständige Angaben zu machen (insbesondere Name, Kontaktdaten und Anzahl der Reisenden).",
      ],
    },
    {
      heading: "§ 4 Preise und Zahlung",
      paragraphs: [
        "Es gelten die im Angebot zum Zeitpunkt der Buchung ausgewiesenen Preise einschließlich der dort ausgewiesenen Steuern, Gebühren und Zusatzkosten. Preise werden in der im Angebot ausgewiesenen Währung angezeigt. Vor Ort können zusätzliche örtliche Abgaben (z. B. Kurtaxe) anfallen, soweit dies im Angebot ausgewiesen ist.",
        "Die Zahlung wird über den Zahlungsdienstleister Stripe abgewickelt. Zahlungsdaten (z. B. Kartendaten) werden direkt von Stripe erhoben und verarbeitet; myNextDays speichert keine vollständigen Kartendaten. Stripe verarbeitet personenbezogene Daten gemäß der [Stripe-Datenschutzerklärung](https://stripe.com/privacy).",
        "Sofern im Angebot eine Kaution ausgewiesen ist, kann diese bei Buchung oder Anreise vorautorisiert und im Schadensfall ganz oder teilweise einbehalten werden; maßgeblich sind die Angaben im Angebot.",
      ],
    },
    {
      heading: "§ 5 Stornierung, Umbuchung und Widerruf",
      paragraphs: [
        "Ob und zu welchen Bedingungen eine Buchung kostenfrei storniert oder geändert werden kann, richtet sich nach den im Angebot ausgewiesenen Stornobedingungen des Anbieters.",
        "Bei Beherbergungsleistungen, die für einen bestimmten Zeitraum gebucht werden, besteht nach Art. 16 Buchst. l der EU-Verbraucherrechte-Richtlinie bzw. den entsprechenden nationalen Vorschriften in der Regel kein gesetzliches Widerrufsrecht. Zwingende gesetzliche Rechte des Gastes bleiben unberührt.",
      ],
    },
    {
      heading: "§ 6 Pflichten des Gastes",
      paragraphs: [
        "Der Gast nutzt die Unterkunft vertragsgemäß, hält die im Angebot ausgewiesene Höchstbelegung ein und beachtet die Hausordnung des Anbieters.",
        "Die Plattform darf nicht missbräuchlich genutzt werden, insbesondere nicht für Scheinbuchungen, betrügerische Zahlungen oder das Einstellen rechtswidriger Inhalte (z. B. in Bewertungen oder Nachrichten).",
      ],
    },
    {
      heading: "§ 7 Haftung von myNextDays",
      paragraphs: [
        "Für die Erbringung der Beherbergungsleistung ist allein der Anbieter verantwortlich. myNextDays haftet nicht für die Richtigkeit der von Anbietern eingestellten Angebotsinhalte, übernimmt jedoch die Vermittlung und Zahlungsabwicklung mit der Sorgfalt eines ordentlichen Kaufmanns.",
        "myNextDays haftet unbeschränkt für Vorsatz und grobe Fahrlässigkeit sowie für Schäden aus der Verletzung von Leben, Körper oder Gesundheit. Bei einfacher Fahrlässigkeit haftet myNextDays nur für die Verletzung wesentlicher Vertragspflichten (Kardinalpflichten), begrenzt auf den vertragstypischen, vorhersehbaren Schaden. Zwingende gesetzliche Haftungsregeln bleiben unberührt.",
      ],
    },
    {
      heading: "§ 8 Datenschutz",
      paragraphs: [
        "myNextDays verarbeitet personenbezogene Daten des Gastes zur Durchführung der Vermittlung und Buchung. Buchungsdaten werden an den jeweiligen Anbieter übermittelt, soweit dies zur Durchführung des Beherbergungsvertrags erforderlich ist. Für die Zahlungsabwicklung gilt § 4.",
        "Einzelheiten ergeben sich aus den Datenschutzinformationen der Plattform.",
      ],
    },
    {
      heading: "§ 9 Beschwerden und Streitbeilegung",
      paragraphs: [
        "Beanstandungen zur Unterkunft richtet der Gast zunächst an den Anbieter; bei Fragen zur Buchung oder Zahlung hilft der Support von myNextDays über die auf der Plattform angegebenen Kontaktwege.",
        "myNextDays ist nicht verpflichtet und nicht bereit, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen, soweit keine gesetzliche Pflicht besteht.",
      ],
    },
    {
      heading: "§ 10 Änderungen dieser Bedingungen",
      paragraphs: [
        "myNextDays kann diese Bedingungen mit Wirkung für die Zukunft ändern, soweit dies aus triftigen Gründen erforderlich ist (insbesondere Gesetzesänderungen oder Änderungen der Rechtsprechung) und der Gast dadurch nicht unangemessen benachteiligt wird. Für bereits abgeschlossene Buchungen gilt die bei Buchung wirksame Fassung.",
      ],
    },
    {
      heading: "§ 11 Schlussbestimmungen",
      paragraphs: [
        "Es gilt das Recht des Staates, in dem die Betreiberin ihren Sitz hat, unter Ausschluss des UN-Kaufrechts. Ist der Gast Verbraucher, bleiben die zwingenden Verbraucherschutzvorschriften des Staates, in dem er seinen gewöhnlichen Aufenthalt hat, unberührt.",
        "Sollten einzelne Bestimmungen dieser Bedingungen unwirksam sein oder werden, bleibt die Wirksamkeit der übrigen Bestimmungen unberührt.",
      ],
    },
  ],
};

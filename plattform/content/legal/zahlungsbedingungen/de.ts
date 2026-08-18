import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Zahlungsbedingungen",
  stand: "Stand: 18. August 2026",
  intro: [
    "Diese Zahlungsbedingungen regeln, wie Zahlungen im Zusammenhang mit einer Buchung über myBestDays abgewickelt werden. Sie ergänzen die [Nutzungsbedingungen für Gäste](https://mybestdays.dk/rechtliches/nutzungsbedingungen); bei Widersprüchen zu Zahlungsfragen gehen diese Zahlungsbedingungen vor.",
  ],
  sections: [
    {
      id: "rolle",
      heading: "1. Unsere Rolle bei der Zahlung",
      paragraphs: [
        "myBestDays wickelt Zahlungen im Auftrag des Anbieters ab. Wir sind kein Zahlungsinstitut und kein E-Geld-Institut; die Zahlungsdienstleistung selbst erbringt unser Zahlungsdienstleister.",
        "Zahlungen über die Plattform werden über Stripe abgewickelt (Stripe Payments Europe, Limited). Kartendaten und andere Zahlungsdaten erhebt und verarbeitet Stripe unmittelbar. myBestDays speichert keine vollständigen Kartendaten.",
        "Zahlen Sie über die Plattform, gilt Ihre Zahlungspflicht gegenüber dem Anbieter in Höhe des gezahlten Betrags als erfüllt, sobald die Zahlung bei unserem Zahlungsdienstleister erfolgreich autorisiert und eingezogen ist.",
      ],
    },
    {
      id: "zahlungsarten",
      heading: "2. Zahlungsarten",
      paragraphs: [
        "Welche Zahlungsarten zur Verfügung stehen, hängt vom Angebot, vom Land des Anbieters und von Ihrem Land ab. Die verfügbaren Zahlungsarten werden Ihnen vor Abschluss der Buchung angezeigt.",
        "Für bestimmte Zahlungsarten ist eine starke Kundenauthentifizierung nach der Richtlinie (EU) 2015/2366 erforderlich. Ohne erfolgreiche Authentifizierung kann die Zahlung nicht ausgeführt werden.",
      ],
    },
    {
      id: "faelligkeit",
      heading: "3. Fälligkeit, Anzahlung und Restzahlung",
      paragraphs: [
        "Wann welcher Betrag fällig wird, bestimmt der Anbieter im Angebot. Üblich sind drei Modelle: vollständige Zahlung bei Buchung, Anzahlung bei Buchung mit Restzahlung vor Anreise, oder Zahlung vor Ort beim Anbieter.",
        "Das für Ihre Buchung geltende Modell und die Fälligkeitstermine werden vor Abschluss der Buchung angezeigt und in der Buchungsbestätigung wiederholt.",
        "Vor Fälligkeit der Restzahlung erinnern wir Sie an die von Ihnen angegebene E-Mail-Adresse. Bleibt die Restzahlung aus, kann der Anbieter nach seinen Stornobedingungen vom Vertrag zurücktreten.",
      ],
    },
    {
      id: "waehrung",
      heading: "4. Währung",
      paragraphs: [
        "Abgerechnet wird in der Währung des Angebots. Diese Währung wird bei jedem Preis und im Bezahlvorgang ausgewiesen.",
        "Wird Ihnen ein Betrag zusätzlich in einer anderen Währung angezeigt, ist das eine unverbindliche Umrechnung zur Orientierung und kein verbindlicher Preis.",
        "Rechnet Ihr Zahlungsdienstleister in eine andere Währung um oder erhebt er ein Auslandsentgelt, tragen Sie diese Kosten. Sie sind nicht Bestandteil des Gesamtpreises und werden von uns weder festgelegt noch vereinnahmt.",
      ],
    },
    {
      id: "kaution",
      heading: "5. Kaution",
      paragraphs: [
        "Sieht das Angebot eine Kaution vor, wird deren Höhe vor Abschluss der Buchung ausgewiesen.",
        "Je nach Angebot wird die Kaution auf Ihrem Zahlungsmittel vorautorisiert (der Betrag wird reserviert, aber nicht abgebucht) oder eingezogen. Eine Vorautorisierung kann Ihr verfügbares Kartenlimit vorübergehend mindern.",
        "Nach dem Aufenthalt wird die Vorautorisierung freigegeben oder die eingezogene Kaution erstattet, soweit der Anbieter keinen Schaden geltend macht. Macht der Anbieter einen Schaden geltend, muss er ihn belegen; über die Berechtigung entscheidet das Verhältnis zwischen Ihnen und dem Anbieter.",
        "Verlangt der Anbieter die Kaution stattdessen vor Ort, ist sie eine Vor-Ort-Kostenposition und wird nicht über die Plattform abgewickelt.",
      ],
    },
    {
      id: "rueckerstattungen",
      heading: "6. Rückerstattungen",
      paragraphs: [
        "Rückerstattungen erfolgen auf das für die Zahlung verwendete Zahlungsmittel, sofern nichts anderes vereinbart oder technisch nicht möglich ist.",
        "Wir veranlassen eine Rückerstattung unverzüglich, sobald ihr Grund feststeht. Wie lange die Gutschrift auf Ihrem Konto oder Ihrer Karte sichtbar wird, bestimmt Ihr Zahlungsdienstleister; üblich sind fünf bis zehn Bankarbeitstage.",
        "Ob und in welcher Höhe ein Anspruch auf Rückerstattung besteht, richtet sich nach den [Stornierungsbedingungen](https://mybestdays.dk/rechtliches/stornierungsbedingungen) und der [Umbuchungs- und Rückerstattungsrichtlinie](https://mybestdays.dk/rechtliches/rueckerstattung).",
      ],
    },
    {
      id: "fehlgeschlagene-zahlungen",
      heading: "7. Fehlgeschlagene Zahlungen und Rückbuchungen",
      paragraphs: [
        "Scheitert eine Zahlung, informieren wir Sie und geben Ihnen Gelegenheit, ein anderes Zahlungsmittel zu hinterlegen. Bleibt die Zahlung aus, kann die Buchung storniert werden.",
        "Buchen Sie eine bereits ausgeführte Zahlung zurück, ohne dass ein Erstattungsanspruch besteht, kann der Anbieter den Betrag weiterhin verlangen. Kosten, die uns durch eine unberechtigte Rückbuchung entstehen, können wir Ihnen in Rechnung stellen.",
        "Halten wir eine Zahlung für betrügerisch, können wir sie zurückhalten oder die Buchung stornieren. Wir informieren Sie darüber und begründen die Entscheidung.",
      ],
    },
    {
      id: "belege",
      heading: "8. Belege und Abrechnungen",
      paragraphs: [
        "Für die über die Plattform gezahlten Beträge stellen wir Ihnen einen Beleg bereit, den Sie in Ihrem Konto unter „Buchungen“ abrufen können.",
        "Eine Rechnung über die Beherbergungsleistung stellt der Anbieter aus; er ist der leistende Unternehmer. Zu Steuern siehe die [Steuerrichtlinie](https://mybestdays.dk/rechtliches/steuern).",
      ],
    },
    {
      id: "aenderungen",
      heading: "9. Änderungen dieser Zahlungsbedingungen",
      paragraphs: [
        "Für Änderungen dieser Zahlungsbedingungen gilt Abschnitt A22 der [Nutzungsbedingungen](https://mybestdays.dk/rechtliches/nutzungsbedingungen#a22-aenderungen).",
      ],
    },
  ],
};

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Servicegebühren",
  stand: "Stand: 18. August 2026",
  intro: [
    "myBestDays finanziert sich über eine Servicegebühr auf vermittelte Buchungen. Diese Seite erklärt, wer sie zahlt, wie sie berechnet wird und wo sie ausgewiesen ist.",
  ],
  sections: [
    {
      id: "wer-zahlt",
      heading: "1. Wer die Servicegebühr zahlt",
      paragraphs: [
        "Die Servicegebühr trägt der Anbieter. Sie wird vom Buchungswert einbehalten und mindert die Auszahlung an ihn; der Gast zahlt sie nicht zusätzlich.",
        "Fällt für eine Buchung ausnahmsweise eine Servicegebühr für den Gast an, weisen wir sie vor Abschluss der Buchung als eigene Position im Gesamtpreis aus. Ohne diese Ausweisung fällt keine Gebühr für den Gast an.",
      ],
    },
    {
      id: "berechnung",
      heading: "2. Wie sie berechnet wird",
      paragraphs: [
        "Die Servicegebühr ist ein Prozentsatz des über die Plattform abgerechneten Buchungswerts. Der für Ihre Buchungen geltende Satz steht in Ihrem Gastgeber-Konto und in der Vereinbarung, der Sie bei der Registrierung zugestimmt haben.",
        "Bemessungsgrundlage ist der Übernachtungspreis zuzüglich der über die Plattform abgerechneten Zuschläge. Nicht einbezogen werden durchlaufende Posten, die keine Gegenleistung des Anbieters sind — insbesondere die Kurtaxe und die Kaution.",
        "Die Servicegebühr wird in der Währung des Angebots berechnet und ausgewiesen.",
      ],
    },
    {
      id: "umsatzsteuer",
      heading: "3. Umsatzsteuer",
      paragraphs: [
        "Auf die Servicegebühr fällt Umsatzsteuer an, soweit sie gesetzlich geschuldet wird. Ob sie ausgewiesen wird oder das Reverse-Charge-Verfahren greift, hängt vom Sitz und vom Status des Anbieters ab.",
        "Über die Servicegebühr stellen wir dem Anbieter eine Abrechnung aus, die in seinem Konto abrufbar ist.",
      ],
    },
    {
      id: "stornierung",
      heading: "4. Stornierung und Rückerstattung",
      paragraphs: [
        "Wird eine Buchung vollständig erstattet, erstatten wir die Servicegebühr anteilig in dem Umfang, in dem der Buchungswert erstattet wird.",
        "Storniert der Anbieter ohne wichtigen Grund, entfällt die Servicegebühr nicht automatisch; wir behalten uns vor, die durch die Stornierung entstandenen Kosten geltend zu machen.",
      ],
    },
    {
      id: "aenderung",
      heading: "5. Änderung der Servicegebühr",
      paragraphs: [
        "Eine Änderung des Satzes kündigen wir Anbietern mindestens 30 Tage vor Wirksamwerden auf einem dauerhaften Datenträger an; das entspricht Artikel 3 Absatz 2 der Verordnung (EU) 2019/1150.",
        "Für bereits bestätigte Buchungen gilt der Satz, der im Zeitpunkt der Buchung galt.",
      ],
    },
  ],
};

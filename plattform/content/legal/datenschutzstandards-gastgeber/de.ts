import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Datenschutz-Standards für Gastgeber",
  stand: "Stand: 18. August 2026",
  intro: [
    "Wenn Sie über myBestDays anbieten, erhalten Sie personenbezogene Daten Ihrer Gäste. Für deren Verarbeitung sind Sie eigenständig Verantwortlicher im Sinne der Verordnung (EU) 2016/679 (DSGVO). Diese Standards beschreiben, was wir dabei von Ihnen erwarten.",
  ],
  sections: [
    {
      id: "zweckbindung",
      heading: "1. Zweckbindung",
      paragraphs: [
        "Sie verwenden Gastdaten ausschließlich, um die Buchung durchzuführen, mit dem Gast zu kommunizieren und Ihre gesetzlichen Pflichten zu erfüllen (etwa Meldeschein, Kurtaxe, Steuer- und Aufbewahrungspflichten).",
        "Jede weitere Verwendung — insbesondere Werbung, Newsletter, Weitergabe an Dritte, Aufnahme in eine eigene Gästedatei für spätere Direktbuchungen — bedarf einer eigenen Rechtsgrundlage, in der Regel der Einwilligung des Gastes.",
        "Sie nutzen Gastdaten nicht, um den Gast zu einer Buchung außerhalb der Plattform zu bewegen.",
      ],
    },
    {
      id: "datensparsamkeit",
      heading: "2. Datensparsamkeit",
      paragraphs: [
        "Sie erheben nur die Daten, die Sie tatsächlich benötigen. Ausweiskopien fordern Sie nur an, wenn eine Rechtsvorschrift es verlangt, und speichern sie nur, solange die Vorschrift es vorsieht.",
        "Zahlungsdaten fordern Sie nicht an. Zahlungen laufen über die Plattform.",
      ],
    },
    {
      id: "sicherheit",
      heading: "3. Sicherheit",
      paragraphs: [
        "Sie schützen Gastdaten durch angemessene technische und organisatorische Maßnahmen — Zugriff nur für Personen, die die Daten benötigen, geschützte Geräte, verschlüsselte Übertragung.",
        "Setzen Sie Mitarbeitende, Reinigungskräfte oder Co-Gastgeber ein, verpflichten Sie diese zur Vertraulichkeit und geben ihnen nur die Daten, die sie für ihre Aufgabe brauchen.",
      ],
    },
    {
      id: "loeschung",
      heading: "4. Aufbewahrung und Löschung",
      paragraphs: [
        "Sie löschen Gastdaten, sobald der Zweck entfallen ist und keine Aufbewahrungspflicht mehr besteht.",
        "Meldescheine und steuerlich relevante Unterlagen bewahren Sie so lange auf, wie es das Recht Ihres Landes vorschreibt — nicht länger.",
      ],
    },
    {
      id: "rechte",
      heading: "5. Rechte der Gäste",
      paragraphs: [
        "Wendet sich ein Gast mit einem Auskunfts-, Berichtigungs-, Lösch- oder Widerspruchsbegehren an Sie, beantworten Sie es fristgerecht. Betrifft es Daten, die bei uns liegen, leiten Sie ihn an uns weiter.",
        "Sie informieren Ihre Gäste darüber, wie Sie ihre Daten verarbeiten, soweit Sie über die Durchführung der Buchung hinausgehen.",
      ],
    },
    {
      id: "vorfall",
      heading: "6. Datenschutzvorfälle",
      paragraphs: [
        "Kommt es zu einer Verletzung des Schutzes von Gastdaten, informieren Sie unverzüglich die zuständige Aufsichtsbehörde und, wo erforderlich, die betroffenen Gäste.",
        "Betrifft der Vorfall Daten, die Sie über die Plattform erhalten haben, informieren Sie zusätzlich uns, damit wir unsere eigenen Pflichten prüfen können.",
      ],
    },
    {
      id: "kameras",
      heading: "7. Kameras und Aufnahmegeräte",
      paragraphs: [
        "In Innenräumen mit berechtigter Privatheitserwartung — Schlafräume, Bäder — sind Kameras und Mikrofone unzulässig, auch abgeschaltet.",
        "Alle übrigen Kameras, Bewegungsmelder mit Aufzeichnung, Türklingeln mit Kamera und Geräuschsensoren legen Sie im Angebot offen, mit Angabe des Standorts und dessen, was aufgezeichnet wird.",
      ],
    },
    {
      id: "folgen",
      heading: "8. Folgen von Verstößen",
      paragraphs: [
        "Verstöße gegen diese Standards behandeln wir wie Verstöße gegen die [Zusätzlichen Bedingungen für Gastgeber](https://mybestdays.dk/rechtliches/gastgeber-bedingungen) und können Maßnahmen bis zur Sperrung des Kontos ergreifen.",
      ],
    },
  ],
};

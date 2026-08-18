import { ANBIETER, DSA_KOORDINATOR } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Gesetz über digitale Dienste",
  stand: "Stand: 18. August 2026",
  intro: [
    "myBestDays ist ein Vermittlungsdienst und eine Online-Plattform im Sinne der Verordnung (EU) 2022/2065 über einen Binnenmarkt für digitale Dienste („Gesetz über digitale Dienste“, DSA). Diese Seite bündelt die Angaben und Verfahren, die diese Verordnung verlangt.",
    "myBestDays ist keine sehr große Online-Plattform im Sinne von Artikel 33 der Verordnung. Die dafür geltenden zusätzlichen Pflichten — Ermittlung systemischer Risiken, unabhängige Prüfung, Anzeigenarchiv und Veröffentlichung der monatlichen Nutzerzahl in dem dort vorgesehenen Verfahren — treffen uns daher nicht.",
  ],
  sections: [
    {
      id: "kontaktstellen",
      heading: "1. Kontaktstellen (Artikel 11 und 12)",
      paragraphs: [
        `Zentrale Kontaktstelle für Behörden der Mitgliedstaaten, die Kommission und den Europäischen Ausschuss für digitale Dienste: ${ANBIETER.email}, postalisch ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, ${ANBIETER.land}.`,
        `Zentrale Kontaktstelle für Nutzer: ${ANBIETER.email}. Sie erreichen uns dort unmittelbar und ohne automatisiertes Vorschaltverfahren.`,
        "Mit beiden Kontaktstellen kann in deutscher, dänischer und englischer Sprache kommuniziert werden.",
        `Ein gesetzlicher Vertreter in der Union nach Artikel 13 ist nicht zu benennen: die Betreiberin ist in ${ANBIETER.land} und damit in der Union niedergelassen.`,
        `Zuständiger Koordinator für digitale Dienste nach Artikel 49: ${DSA_KOORDINATOR.name}, ${DSA_KOORDINATOR.land} ([${DSA_KOORDINATOR.website.replace("https://", "")}](${DSA_KOORDINATOR.website})).`,
      ],
    },
    {
      id: "melden",
      heading: "2. Rechtswidrige Inhalte melden (Artikel 16)",
      paragraphs: [
        "Jede Person kann uns Inhalte melden, die sie für rechtswidrig hält. Nutzen Sie dafür die Meldefunktion, die an jedem Angebot, jeder Bewertung und jeder Nachricht verfügbar ist, oder die Kontaktstelle für Nutzer.",
        "Damit wir eine Meldung ohne eingehende rechtliche Prüfung beurteilen können, sollte sie enthalten:",
      ],
      list: [
        "eine hinreichend begründete Erläuterung, warum der Inhalt rechtswidrig ist;",
        "die genaue elektronische Fundstelle, insbesondere die URL;",
        "Name und E-Mail-Adresse der meldenden Person — außer bei Meldungen zu Straftaten gegen die sexuelle Selbstbestimmung von Kindern, dort ist die Angabe freiwillig;",
        "die Erklärung, dass die Angaben nach bestem Wissen richtig und vollständig sind.",
      ],
    },
    {
      id: "bearbeitung",
      heading: "3. Wie wir Meldungen bearbeiten",
      paragraphs: [
        "Wir bestätigen den Eingang unverzüglich und entscheiden zeitnah, sorgfältig, frei von Willkür und objektiv.",
        "Enthält eine Meldung die Angaben aus Abschnitt 2, begründet sie unsere Kenntnis im Sinne von Artikel 6 der Verordnung.",
        "Über unsere Entscheidung informieren wir die meldende Person und weisen auf die Rechtsbehelfe hin.",
        "Bei automatisierter Bearbeitung teilen wir das mit.",
      ],
    },
    {
      id: "begruendung",
      heading: "4. Begründung von Maßnahmen (Artikel 17)",
      paragraphs: [
        "Beschränken wir die Sichtbarkeit eines Inhalts, entfernen ihn, sperren den Zugang zu ihm, setzen Zahlungen aus, sperren die Erbringung des Dienstes oder das Konto, erhält die betroffene Person eine klare und spezifische Begründung.",
        "Die Begründung nennt Art und Umfang der Maßnahme, ihren räumlichen und zeitlichen Geltungsbereich, die Tatsachen und Umstände der Entscheidung, ob eine automatisierte Verarbeitung beteiligt war, die Rechtsgrundlage oder die verletzte Vertragsbestimmung und die verfügbaren Rechtsbehelfe.",
      ],
    },
    {
      id: "straftaten",
      heading: "5. Verdacht auf Straftaten (Artikel 18)",
      paragraphs: [
        "Bestehen Anhaltspunkte für eine Straftat, die eine Gefahr für das Leben oder die Sicherheit einer Person begründet, unterrichten wir unverzüglich die zuständigen Strafverfolgungs- oder Justizbehörden.",
      ],
    },
    {
      id: "beschwerdeverfahren",
      heading: "6. Internes Beschwerdeverfahren (Artikel 20)",
      paragraphs: [
        "Gegen jede Maßnahme nach Abschnitt 4 und gegen die Ablehnung einer Meldung kann innerhalb von sechs Monaten kostenfrei Beschwerde eingelegt werden.",
        "Beschwerden werden zeitnah, diskriminierungsfrei und sorgfältig bearbeitet — unter Aufsicht qualifizierter Personen und nicht allein mit automatisierten Mitteln.",
        "Erweist sich eine Beschwerde als begründet, nehmen wir die Maßnahme zurück. Den Weg beschreibt [Beschwerden und Streitbeilegung](https://mybestdays.dk/rechtliches/beschwerden).",
      ],
    },
    {
      id: "streitbeilegung",
      heading: "7. Außergerichtliche Streitbeilegung (Artikel 21)",
      paragraphs: [
        "Nutzer können sich für Streitigkeiten über Maßnahmen nach Abschnitt 4 an eine vom zuständigen Koordinator für digitale Dienste zertifizierte außergerichtliche Streitbeilegungsstelle wenden. Die Liste der zertifizierten Stellen führt die Europäische Kommission.",
        "Die Entscheidungen dieser Stellen sind für uns nicht bindend; zur Teilnahme an Verfahren unabhängiger Anbieter sind wir nicht verpflichtet. Der Weg zu den Gerichten bleibt unberührt.",
      ],
    },
    {
      id: "vertrauenswuerdige-hinweisgeber",
      heading: "8. Vertrauenswürdige Hinweisgeber (Artikel 22)",
      paragraphs: [
        "Meldungen, die von einem als vertrauenswürdiger Hinweisgeber anerkannten Melder in dessen Fachgebiet eingereicht werden, bearbeiten wir vorrangig.",
      ],
    },
    {
      id: "missbrauch",
      heading: "9. Maßnahmen gegen Missbrauch (Artikel 23)",
      paragraphs: [
        "Konten, über die häufig offensichtlich rechtswidrige Inhalte bereitgestellt werden, sperren wir nach vorheriger Verwarnung für einen angemessenen Zeitraum.",
        "Die Bearbeitung von Meldungen und Beschwerden setzen wir für Personen aus, die häufig offensichtlich unbegründete Meldungen oder Beschwerden einreichen — ebenfalls nach vorheriger Verwarnung.",
        "Wir prüfen dabei stets den Einzelfall: Anzahl, Anteil und Schwere der betroffenen Vorgänge sowie die Absicht.",
      ],
    },
    {
      id: "transparenz",
      heading: "10. Transparenzberichte (Artikel 15 und 24)",
      paragraphs: [
        "Wir veröffentlichen jährlich einen Bericht über die Moderation von Inhalten: Zahl der behördlichen Anordnungen, Zahl und Art der Meldungen, ergriffene Maßnahmen, Zahl der Beschwerden und ihr Ausgang, Angaben zum Einsatz automatisierter Verfahren sowie Zahl der Streitigkeiten vor außergerichtlichen Stellen.",
        `Kleinstunternehmen und kleine Unternehmen sind nach Artikel 19 der Verordnung von einem Teil dieser Pflichten befreit. Solange die Befreiung greift, stellen wir die Angaben auf Anfrage unter ${ANBIETER.email} bereit; sobald der erste Bericht veröffentlicht ist, wird er an dieser Stelle verlinkt.`,
      ],
    },
    {
      id: "rueckverfolgbarkeit",
      heading: "11. Rückverfolgbarkeit von Anbietern (Artikel 30 bis 32)",
      paragraphs: [
        "Anbieter, die auf der Plattform gewerblich handeln, dürfen erst anbieten, wenn sie uns Name, Anschrift, Telefonnummer, E-Mail-Adresse, Registerangaben, Umsatzsteuer-Identifikationsnummer und Zahlungskonto übermittelt haben und ihre Angaben plausibel sind.",
        "Diese Angaben zeigen wir im Angebot an, soweit die Verordnung das vorsieht.",
        "Erfahren wir, dass ein Angebot ein rechtswidriges Erzeugnis oder eine rechtswidrige Dienstleistung betraf, informieren wir die betroffenen Gäste, soweit uns deren Kontaktdaten vorliegen.",
      ],
    },
    {
      id: "empfehlungssysteme",
      heading: "12. Empfehlungssysteme (Artikel 27)",
      paragraphs: [
        "Die wesentlichen Parameter der Suchergebnisreihenfolge und der Empfehlungen sowie die Möglichkeit, sie zu beeinflussen, sind unter [Preise, Ranking und Empfehlungen](https://mybestdays.dk/rechtliches/preisangaben) beschrieben.",
      ],
    },
    {
      id: "werbung",
      heading: "13. Werbung (Artikel 26)",
      paragraphs: [
        "Wir zeigen derzeit keine bezahlte Werbung Dritter und keine bezahlten Platzierungen in den Suchergebnissen.",
        "Sollten wir Werbung einführen, kennzeichnen wir sie deutlich, nennen den Werbetreibenden und die wesentlichen Parameter der Ausspielung. Werbung auf Grundlage besonderer Kategorien personenbezogener Daten nach Artikel 9 der Verordnung (EU) 2016/679 und Werbung an Minderjährige auf Grundlage von Profiling schließen wir aus.",
      ],
    },
  ],
};

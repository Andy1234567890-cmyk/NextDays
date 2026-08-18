import { ANBIETER, AUFSICHTSBEHOERDE } from "@nextdays/anbieter";

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Datenschutzerklärung",
  stand: "Stand: 18. August 2026",
  intro: [
    "Diese Erklärung beschreibt, welche personenbezogenen Daten myBestDays verarbeitet, zu welchen Zwecken, auf welcher Rechtsgrundlage und welche Rechte Ihnen zustehen. Sie gilt für die Website, die mobilen Anwendungen und alle sonstigen Zugänge zur Plattform.",
  ],
  sections: [
    {
      id: "verantwortlicher",
      heading: "1. Verantwortlicher und Datenschutzbeauftragter",
      paragraphs: [
        `Verantwortlicher im Sinne der Verordnung (EU) 2016/679 (DSGVO) ist die ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, ${ANBIETER.land}, CVR-nr. ${ANBIETER.cvr}, ${ANBIETER.email}, ${ANBIETER.telefon}. Die vollständigen Anbieterangaben stehen im [Impressum](https://mybestdays.dk/rechtliches/impressum).`,
        "Ein Datenschutzbeauftragter ist nicht benannt; die Voraussetzungen des Artikels 37 DSGVO liegen nicht vor. Anfragen zum Datenschutz richten Sie an die oben genannte E-Mail-Adresse.",
        "Anbieter, bei denen Sie buchen, sind für die Daten, die sie von uns erhalten, eigenständig Verantwortliche. Für sie gelten die [Datenschutz-Standards für Gastgeber](https://mybestdays.dk/rechtliches/datenschutzstandards-gastgeber).",
      ],
    },
    {
      id: "kategorien",
      heading: "2. Welche Daten wir verarbeiten",
      paragraphs: ["Je nachdem, wie Sie die Plattform nutzen, verarbeiten wir:"],
      list: [
        "Bestandsdaten — Name, E-Mail-Adresse, Telefonnummer, Sprache und Währung, Kennwort in verschlüsselter Form;",
        "Buchungsdaten — gebuchte Unterkunft, Zeitraum, Anzahl und Namen der Reisenden, besondere Wünsche, Buchungsstatus;",
        "Zahlungsdaten — Betrag, Währung, Zahlungsstatus, die letzten Stellen des Zahlungsmittels sowie die Vorgangskennung unseres Zahlungsdienstleisters. Vollständige Kartendaten erreichen uns nicht;",
        "Kommunikationsdaten — Nachrichten zwischen Ihnen und dem Anbieter, Anfragen an unseren Kundenservice, Beschwerden;",
        "Inhaltsdaten — Bewertungen, Fotos, Merkzettel;",
        "Nutzungsdaten — aufgerufene Seiten, Suchanfragen, Zeitpunkt des Zugriffs;",
        "technische Daten — IP-Adresse, Browser- und Gerätekennungen, Betriebssystem, Referrer.",
      ],
    },
    {
      id: "zwecke",
      heading: "3. Zwecke und Rechtsgrundlagen",
      paragraphs: [
        "Bereitstellung der Plattform, Konto, Suche, Buchung, Zahlungsabwicklung und Kommunikation mit dem Anbieter — Artikel 6 Absatz 1 Buchstabe b DSGVO (Vertrag oder vorvertragliche Maßnahme).",
        "Kundenservice, Beschwerdebearbeitung und Streitbeilegung — Artikel 6 Absatz 1 Buchstabe b und f DSGVO.",
        "Erkennung und Verhinderung von Betrug, Missbrauch und Sicherheitsvorfällen, Durchsetzung unserer Bedingungen — Artikel 6 Absatz 1 Buchstabe f DSGVO (berechtigtes Interesse an einem sicheren Marktplatz).",
        "Bewertungen und deren Veröffentlichung — Artikel 6 Absatz 1 Buchstabe b und f DSGVO.",
        "Erfüllung gesetzlicher Pflichten, insbesondere handels- und steuerrechtlicher Aufbewahrungspflichten, der Meldepflicht nach der Richtlinie (EU) 2021/514 (DAC7) und der Pflichten aus der Verordnung (EU) 2022/2065 — Artikel 6 Absatz 1 Buchstabe c DSGVO.",
        "Verbesserung der Plattform durch Auswertung aggregierter Nutzungsdaten — Artikel 6 Absatz 1 Buchstabe f DSGVO.",
        "Werbliche E-Mails und nicht notwendige Cookies — Artikel 6 Absatz 1 Buchstabe a DSGVO (Einwilligung), die Sie jederzeit mit Wirkung für die Zukunft widerrufen können.",
      ],
    },
    {
      id: "empfaenger",
      heading: "4. Empfänger",
      paragraphs: [
        "Anbieter erhalten die Daten, die sie zur Durchführung Ihrer Buchung und zur Erfüllung ihrer gesetzlichen Pflichten benötigen — insbesondere Name, Kontaktdaten, Zeitraum, Anzahl der Reisenden und Ihre Nachrichten an sie.",
        "Unser Zahlungsdienstleister Stripe verarbeitet Zahlungsdaten als eigenständig Verantwortlicher; es gilt zusätzlich die [Stripe-Datenschutzerklärung](https://stripe.com/privacy).",
        "Dienstleister, die für uns Hosting, Datenbankbetrieb, E-Mail-Versand, Fehlerdiagnose und Kundenservice-Werkzeuge erbringen, verarbeiten Daten ausschließlich weisungsgebunden auf Grundlage eines Vertrags nach Artikel 28 DSGVO.",
        "Behörden und Gerichte erhalten Daten nur, soweit wir dazu verpflichtet sind; siehe [Richtlinien für Behörden- und Strafverfolgungsanfragen](https://mybestdays.dk/rechtliches/behoerdenanfragen).",
        "Steuerbehörden erhalten die nach DAC7 zu meldenden Angaben zu Anbietern.",
      ],
    },
    {
      id: "drittland",
      heading: "5. Übermittlung in Drittländer",
      paragraphs: [
        "Unsere Server und die unserer Auftragsverarbeiter stehen in der Europäischen Union.",
        "Soweit im Einzelfall eine Verarbeitung außerhalb des Europäischen Wirtschaftsraums stattfindet, geschieht dies nur auf Grundlage eines Angemessenheitsbeschlusses der Europäischen Kommission oder der Standardvertragsklauseln nach Artikel 46 Absatz 2 Buchstabe c DSGVO nebst ergänzenden Schutzmaßnahmen.",
      ],
    },
    {
      id: "speicherdauer",
      heading: "6. Speicherdauer",
      paragraphs: [
        "Kontodaten speichern wir, solange Ihr Konto besteht, und löschen sie danach, soweit keine Aufbewahrungspflicht entgegensteht.",
        "Buchungs- und Zahlungsdaten unterliegen handels- und steuerrechtlichen Aufbewahrungsfristen; sie betragen je nach Sitzstaat regelmäßig fünf bis zehn Jahre ab Ende des Jahres, in dem die Buchung abgeschlossen wurde.",
        "Nachrichten zu einer Buchung speichern wir bis drei Jahre nach Ende des Aufenthalts, um Streitfälle klären zu können.",
        "Bewertungen bleiben nach Löschung Ihres Kontos in anonymisierter Form erhalten, weil sie Teil der Bewertungsgrundlage einer Unterkunft sind.",
        "Daten zu Betrugs- und Missbrauchsfällen speichern wir so lange, wie es zur Abwehr weiterer Verstöße erforderlich ist, längstens jedoch drei Jahre nach dem letzten Vorfall.",
      ],
    },
    {
      id: "rechte",
      heading: "7. Ihre Rechte",
      paragraphs: ["Ihnen stehen nach der DSGVO folgende Rechte zu:"],
      list: [
        "Auskunft über die zu Ihnen gespeicherten Daten (Artikel 15);",
        "Berichtigung unrichtiger Daten (Artikel 16);",
        "Löschung (Artikel 17), soweit keine Aufbewahrungspflicht entgegensteht;",
        "Einschränkung der Verarbeitung (Artikel 18);",
        "Datenübertragbarkeit (Artikel 20);",
        "Widerspruch gegen eine Verarbeitung auf Grundlage berechtigter Interessen (Artikel 21), insbesondere gegen Direktwerbung;",
        "Widerruf einer erteilten Einwilligung mit Wirkung für die Zukunft (Artikel 7 Absatz 3);",
        `Beschwerde bei einer Aufsichtsbehörde (Artikel 77) — zuständig ist die Behörde Ihres Wohnsitzes, Ihres Arbeitsplatzes oder des Orts des mutmaßlichen Verstoßes. Am Sitz des Verantwortlichen ist das ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.strasse}, ${AUFSICHTSBEHOERDE.ort}, ${AUFSICHTSBEHOERDE.land}, ${AUFSICHTSBEHOERDE.email}.`,
      ],
    },
    {
      id: "ausuebung",
      heading: "8. Wie Sie Ihre Rechte ausüben",
      paragraphs: [
        `Viele Angaben können Sie unmittelbar in Ihrem Konto einsehen, ändern oder löschen. Für alles Übrige wenden Sie sich an ${ANBIETER.email}.`,
        "Wir antworten unverzüglich, spätestens innerhalb eines Monats. Können wir die Frist nicht einhalten, teilen wir Ihnen das mit einer Begründung mit.",
      ],
    },
    {
      id: "automatisiert",
      heading: "9. Automatisierte Entscheidungen",
      paragraphs: [
        "Wir setzen automatisierte Verfahren ein, um Betrug, Missbrauch und rechtswidrige Inhalte zu erkennen. Führt ein solches Verfahren zu einer Maßnahme gegen Ihr Konto oder Ihre Inhalte, begründen wir sie und Sie können eine Überprüfung durch einen Menschen verlangen.",
        "Eine ausschließlich automatisierte Entscheidung mit rechtlicher Wirkung im Sinne von Artikel 22 DSGVO treffen wir nicht.",
      ],
    },
    {
      id: "pflicht",
      heading: "10. Pflicht zur Bereitstellung",
      paragraphs: [
        "Die für eine Buchung erforderlichen Daten müssen Sie bereitstellen; ohne sie kann kein Vertrag geschlossen und die Unterkunft nicht bereitgestellt werden. Alle übrigen Angaben sind freiwillig.",
      ],
    },
    {
      id: "aenderungen",
      heading: "11. Änderungen dieser Erklärung",
      paragraphs: [
        "Wir passen diese Erklärung an, wenn sich die Verarbeitung oder die Rechtslage ändert. Die jeweils geltende Fassung ist hier abrufbar; das Stand-Datum steht oben.",
      ],
    },
  ],
};

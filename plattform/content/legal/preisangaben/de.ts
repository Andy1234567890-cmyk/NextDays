import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Preise, Ranking und Empfehlungen",
  stand: "Stand: 18. August 2026",
  intro: [
    "Diese Seite erklärt, wie Preise auf myBestDays angezeigt werden, wonach sich die Reihenfolge der Suchergebnisse richtet und wie Empfehlungen zustande kommen. Sie erfüllt die Transparenzpflichten aus Artikel 6a der Richtlinie 2005/29/EG, Artikel 5 der Verordnung (EU) 2019/1150 und Artikel 27 der Verordnung (EU) 2022/2065.",
  ],
  sections: [
    {
      id: "preisanzeige",
      heading: "1. Wie Preise angezeigt werden",
      paragraphs: [
        "Sobald Zeitraum und Anzahl der Reisenden feststehen, zeigen wir den Gesamtpreis für den gesamten Aufenthalt an, einschließlich Steuern und aller über die Plattform abgerechneten Gebühren.",
        "Solange noch kein Zeitraum gewählt ist, zeigen wir einen Preis je Nacht als Orientierung und kennzeichnen ihn als solchen.",
        "Kosten, die erst vor Ort anfallen, weisen wir vor Abschluss der Buchung gesondert aus. Sie sind nicht Teil des Gesamtpreises, aber vor der Buchung sichtbar.",
        "Zeigen wir einen durchgestrichenen Vergleichspreis, ist das der niedrigste Preis, den der Anbieter für dieselbe Leistung in den letzten 30 Tagen vor der Ermäßigung verlangt hat (Artikel 6a der Richtlinie 98/6/EG).",
        "Preise sind für alle Gäste gleich. Wir passen den Preis nicht an Ihre Person, Ihr Gerät oder Ihr bisheriges Suchverhalten an.",
      ],
    },
    {
      id: "ranking",
      heading: "2. Wonach sich die Reihenfolge der Suchergebnisse richtet",
      paragraphs: [
        "In der Standardsortierung bestimmen die folgenden Merkmale die Reihenfolge, in absteigender Bedeutung:",
      ],
      list: [
        "Übereinstimmung mit Ihrer Suche — Verfügbarkeit im gesuchten Zeitraum, Kapazität für die Anzahl der Reisenden, Lage im gesuchten Gebiet und gesetzte Filter;",
        "Vollständigkeit und Qualität des Angebots — Beschreibung, Fotos, gepflegte Ausstattungsangaben;",
        "Bewertungen — Gesamtnote und Anzahl der Bewertungen;",
        "Verlässlichkeit des Anbieters — Antwortverhalten, Annahmequote und Stornierungen durch den Anbieter;",
        "Aktualität von Preisen und Verfügbarkeiten;",
        "Preis-Leistungs-Verhältnis im Vergleich zu ähnlichen Angeboten im selben Gebiet.",
      ],
    },
    {
      id: "kein-bezahltes-ranking",
      heading: "3. Bezahlte Platzierung",
      paragraphs: [
        "Ein Anbieter kann sich keinen besseren Platz in der Standardsortierung erkaufen. Die Höhe der Servicegebühr beeinflusst die Reihenfolge nicht.",
        "Sollten wir künftig bezahlte Platzierungen anbieten, kennzeichnen wir sie unmissverständlich als Anzeige und trennen sie sichtbar von den übrigen Ergebnissen.",
      ],
    },
    {
      id: "sortierung-aendern",
      heading: "4. Sortierung ändern",
      paragraphs: [
        "Sie können die Sortierung jederzeit ändern, etwa nach Preis oder Bewertung. Welche Sortierung aktiv ist, wird über der Ergebnisliste angezeigt.",
        "Es steht Ihnen mindestens eine Sortierung zur Verfügung, die nicht auf einer Profilbildung im Sinne von Artikel 4 Nummer 4 der Verordnung (EU) 2016/679 beruht.",
      ],
    },
    {
      id: "empfehlungen",
      heading: "5. Empfehlungen",
      paragraphs: [
        "Zeigen wir Ihnen Vorschläge („könnte Ihnen gefallen“, „ähnliche Unterkünfte“), beruhen diese auf der aktuellen Suche, auf zuvor angesehenen Angeboten und auf Merkmalen ähnlicher Unterkünfte.",
        "Sie können personalisierte Empfehlungen in Ihrem Konto abschalten. Danach sehen Sie Vorschläge, die allein auf der aktuellen Suche beruhen.",
      ],
    },
    {
      id: "bewertungen",
      heading: "6. Bewertungen im Ranking",
      paragraphs: [
        "Wie Bewertungen zustande kommen und geprüft werden, steht in den [Bewertungsrichtlinien](https://mybestdays.dk/rechtliches/bewertungsrichtlinien). Bewertungen fließen in die Reihenfolge ein, aber weder gewichten wir einzelne Bewertungen höher noch unterdrücken wir negative.",
      ],
    },
  ],
};

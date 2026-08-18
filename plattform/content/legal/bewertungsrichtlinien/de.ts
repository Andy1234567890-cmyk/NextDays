import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Bewertungsrichtlinien",
  stand: "Stand: 18. August 2026",
  intro: [
    "Bewertungen sind für Gäste die wichtigste unabhängige Quelle. Diese Richtlinien beschreiben, wer bewerten darf, wie wir sicherstellen, dass Bewertungen von tatsächlichen Gästen stammen, und wann wir eine Bewertung entfernen.",
  ],
  sections: [
    {
      id: "echtheit",
      heading: "1. Wie wir die Echtheit sicherstellen",
      paragraphs: [
        "Eine Bewertung kann nur abgeben, wer die Unterkunft über myBestDays gebucht hat und deren Aufenthaltszeitraum begonnen hat. Die Bewertung wird technisch an die konkrete Buchung gebunden.",
        "Damit erfüllen wir die Pflicht aus Anhang I Nummer 23b der Richtlinie 2005/29/EG, nur solche Bewertungen als Gästebewertungen darzustellen, bei denen wir angemessene Schritte zur Prüfung unternommen haben, dass sie von tatsächlichen Gästen stammen.",
        "Wir kaufen keine Bewertungen, geben keine in Auftrag und stellen keine gefälschten Bewertungen ein. Wir dulden auch nicht, dass Anbieter dies tun.",
      ],
    },
    {
      id: "frist",
      heading: "2. Frist und Veröffentlichung",
      paragraphs: [
        "Nach der Abreise haben Sie 14 Tage Zeit, eine Bewertung abzugeben. Der Anbieter kann in derselben Frist eine Bewertung über Sie abgeben.",
        "Beide Bewertungen werden gleichzeitig veröffentlicht, sobald beide vorliegen oder die Frist abgelaufen ist. So beeinflusst keine Seite die andere.",
        "Eine abgegebene Bewertung können Sie innerhalb der Frist zurückziehen. Nach der Veröffentlichung ist eine Änderung nicht mehr möglich; Sie können sie löschen lassen.",
      ],
    },
    {
      id: "antwort",
      heading: "3. Antwort des Anbieters",
      paragraphs: [
        "Der Anbieter kann auf eine Bewertung öffentlich antworten. Für die Antwort gelten dieselben Regeln wie für die Bewertung selbst.",
        "Eine Antwort verändert die Bewertung nicht und ändert nichts an der Gesamtnote.",
      ],
    },
    {
      id: "entfernung",
      heading: "4. Wann wir eine Bewertung entfernen",
      paragraphs: [
        "Wir entfernen eine Bewertung nicht deshalb, weil sie negativ ist oder weil der Anbieter mit ihr unzufrieden ist. Wir entfernen sie, wenn sie:",
      ],
      list: [
        "gegen die [Richtlinien für angemessene Inhalte](https://mybestdays.dk/rechtliches/inhaltsrichtlinien) verstößt;",
        "personenbezogene Daten Dritter enthält;",
        "sich erkennbar auf eine andere Unterkunft oder einen anderen Aufenthalt bezieht;",
        "im Wesentlichen Umstände betrifft, auf die weder Gast noch Anbieter Einfluss hatten (z. B. Wetter, Baustelle der Gemeinde, Anreiseverkehr) — in diesem Fall entfernen wir nur den betroffenen Teil, wenn er sich abtrennen lässt;",
        "erkennbar der Erpressung dient, etwa weil sie mit einer Forderung verknüpft wurde;",
        "durch Anreize erkauft wurde oder in koordinierter Absicht abgegeben wurde.",
      ],
    },
    {
      id: "anreize",
      heading: "5. Anreize sind unzulässig",
      paragraphs: [
        "Anbieter dürfen für eine Bewertung weder Geld noch Rabatte, Upgrades, Geschenke oder sonstige Vorteile anbieten — auch nicht für das Unterlassen einer Bewertung.",
        "Anbieter dürfen Gäste zu einer Bewertung einladen, ohne die Note zu beeinflussen. Eine Einladung, die nur bei positiver Erfahrung zur Bewertung auffordert, ist unzulässig.",
      ],
    },
    {
      id: "darstellung",
      heading: "6. Wie wir Bewertungen darstellen",
      paragraphs: [
        "Die Gesamtnote ist der ungewichtete Durchschnitt aller veröffentlichten Bewertungen einer Unterkunft. Wir gewichten keine Bewertung höher, weil sie besser ausfällt.",
        "Die Standardsortierung zeigt die neuesten Bewertungen zuerst. Sie können auf andere Sortierungen umstellen; welche Sortierung aktiv ist, wird angezeigt.",
        "Wir geben an, wie viele Bewertungen einer Gesamtnote zugrunde liegen. Bei weniger als drei Bewertungen zeigen wir keine Gesamtnote, sondern nur die einzelnen Bewertungen.",
      ],
    },
    {
      id: "beschwerde",
      heading: "7. Beschwerde gegen eine Entscheidung",
      paragraphs: [
        "Entfernen wir Ihre Bewertung oder lehnen wir die Entfernung einer Bewertung ab, begründen wir das und weisen auf den Beschwerdeweg hin — siehe [Beschwerden und Streitbeilegung](https://mybestdays.dk/rechtliches/beschwerden).",
      ],
    },
  ],
};

import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Antidiskriminierungs-Richtlinie",
  stand: "Stand: 18. August 2026",
  intro: [
    "myBestDays steht allen offen. Wer über die Plattform bucht oder anbietet, darf niemanden wegen persönlicher Merkmale schlechter behandeln.",
    "Diese Richtlinie ist Bestandteil der [Nutzungsbedingungen](https://mybestdays.dk/rechtliches/nutzungsbedingungen) und gilt für Gäste wie für Anbieter.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Grundsatz",
      paragraphs: [
        "Auf myBestDays ist es unzulässig, eine Person wegen ihrer Herkunft, Hautfarbe, Staatsangehörigkeit, ethnischen Zugehörigkeit, Religion oder Weltanschauung, ihres Geschlechts, ihrer Geschlechtsidentität, ihrer sexuellen Orientierung, einer Behinderung, ihres Alters oder ihres Familienstands zu benachteiligen.",
        "Das gilt für die Annahme oder Ablehnung von Buchungen, für Preise und Bedingungen, für den Umgang während des Aufenthalts und für die Kommunikation über die Plattform.",
        "Zusätzlich gilt Artikel 20 der Verordnung (EU) 2018/302: Anbieter dürfen den Zugang zu ihrem Angebot nicht wegen der Staatsangehörigkeit, des Wohnsitzes oder des Niederlassungsorts eines Gastes innerhalb der Union beschränken.",
      ],
    },
    {
      id: "fuer-anbieter",
      heading: "2. Was das für Anbieter bedeutet",
      paragraphs: ["Als Anbieter dürfen Sie insbesondere nicht:"],
      list: [
        "eine Buchungsanfrage wegen eines der genannten Merkmale ablehnen;",
        "unterschiedliche Preise, Kautionen oder Bedingungen für Gäste verlangen, weil sie eines der Merkmale erfüllen;",
        "im Angebot oder in Nachrichten erklären, dass bestimmte Personengruppen unerwünscht sind;",
        "Assistenz- oder Blindenführhunde ablehnen, auch wenn Ihre Hausregeln Tiere ausschließen;",
        "einen Gast wegen seines Wohnsitzes in einem anderen Mitgliedstaat der Union anders behandeln.",
      ],
    },
    {
      id: "zulaessig",
      heading: "3. Was zulässig bleibt",
      paragraphs: [
        "Sie dürfen die Höchstbelegung, ein Mindestalter für den Hauptbucher und sachliche Hausregeln (etwa Rauchverbot oder Ruhezeiten) festlegen, solange sie für alle Gäste gleich gelten.",
        "Bewohnen Sie die Unterkunft selbst mit und teilen sich Wohnraum mit dem Gast, dürfen Sie das im Angebot deutlich machen; die Merkmale aus Abschnitt 1 rechtfertigen eine Ablehnung dennoch nicht.",
        "Sie dürfen eine Buchung ablehnen, wenn konkrete Anhaltspunkte für einen Verstoß gegen die Hausregeln oder für Betrug vorliegen. Der Grund muss sich auf das Verhalten beziehen, nicht auf die Person.",
      ],
    },
    {
      id: "barrierefreiheit",
      heading: "4. Barrierefreiheit",
      paragraphs: [
        "Angaben zur Barrierefreiheit einer Unterkunft müssen zutreffen. Eine Unterkunft als barrierefrei zu beschreiben, die es nicht ist, ist zugleich ein Verstoß gegen die [Richtlinien für angemessene Inhalte](https://mybestdays.dk/rechtliches/inhaltsrichtlinien).",
        "Wenn eine Anpassung ohne unzumutbaren Aufwand möglich ist, erwarten wir, dass Anbieter sie vornehmen.",
      ],
    },
    {
      id: "melden",
      heading: "5. Diskriminierung melden",
      paragraphs: [
        "Wenn Sie Diskriminierung erlebt oder beobachtet haben, melden Sie es uns über die Meldefunktion oder über die Kontaktwege unter [Beschwerden und Streitbeilegung](https://mybestdays.dk/rechtliches/beschwerden).",
        "Wir prüfen jede Meldung. Bestätigt sich ein Verstoß, ergreifen wir Maßnahmen bis zur dauerhaften Sperrung des Kontos. Wurde Ihnen deshalb eine Buchung abgesagt, helfen wir Ihnen, eine vergleichbare Unterkunft zu finden.",
      ],
    },
  ],
};

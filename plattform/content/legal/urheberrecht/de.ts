import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Urheberrechtsrichtlinie",
  stand: "Stand: 18. August 2026",
  intro: [
    "myBestDays achtet die Rechte Dritter und erwartet dasselbe von seinen Nutzern. Diese Richtlinie beschreibt, wie Sie eine Urheberrechtsverletzung melden und wie wir damit umgehen.",
  ],
  sections: [
    {
      id: "grundsatz",
      heading: "1. Grundsatz",
      paragraphs: [
        "Wer Inhalte auf die Plattform einstellt, sichert zu, die dafür erforderlichen Rechte zu besitzen. Das gilt insbesondere für Fotos, Grundrisse, Texte und Kartenausschnitte in Angeboten.",
        "Fremde Inhalte ohne Erlaubnis einzustellen, ist ein Verstoß gegen die [Nutzungsbedingungen](https://mybestdays.dk/rechtliches/nutzungsbedingungen) und gegen die [Richtlinien für angemessene Inhalte](https://mybestdays.dk/rechtliches/inhaltsrichtlinien).",
      ],
    },
    {
      id: "meldung",
      heading: "2. Eine Verletzung melden",
      paragraphs: [
        "Melden Sie eine Urheberrechtsverletzung über die Meldefunktion am betroffenen Inhalt oder über die unter [Gesetz über digitale Dienste](https://mybestdays.dk/rechtliches/dsa) genannte Kontaktstelle. Eine Meldung sollte enthalten:",
      ],
      list: [
        "eine genaue Bezeichnung des beanstandeten Inhalts, insbesondere die URL;",
        "eine Beschreibung des geschützten Werks und den Nachweis Ihrer Rechtsinhaberschaft oder Ihrer Berechtigung, für den Rechtsinhaber zu handeln;",
        "eine Begründung, warum die Nutzung nicht erlaubt ist;",
        "Ihren Namen und eine Kontaktadresse;",
        "die Erklärung, dass Ihre Angaben nach bestem Wissen richtig und vollständig sind.",
      ],
    },
    {
      id: "bearbeitung",
      heading: "3. Wie wir Meldungen bearbeiten",
      paragraphs: [
        "Wir bestätigen den Eingang Ihrer Meldung unverzüglich und entscheiden zügig und sorgfältig.",
        "Halten wir die Meldung für begründet, entfernen wir den Inhalt oder sperren den Zugang zu ihm und informieren die Person, die ihn eingestellt hat, unter Angabe der Gründe und des Beschwerdewegs.",
        "Halten wir die Meldung für unbegründet, teilen wir Ihnen das mit einer Begründung mit.",
      ],
    },
    {
      id: "gegendarstellung",
      heading: "4. Widerspruch der betroffenen Person",
      paragraphs: [
        "Wurde Ihr Inhalt entfernt und halten Sie das für unberechtigt, können Sie innerhalb von sechs Monaten kostenfrei Beschwerde einlegen. Legen Sie dabei dar, warum Sie zur Nutzung berechtigt sind.",
        "Erweist sich die Beschwerde als begründet, stellen wir den Inhalt wieder her.",
      ],
    },
    {
      id: "wiederholung",
      heading: "5. Wiederholte Verstöße",
      paragraphs: [
        "Konten, über die wiederholt rechtsverletzende Inhalte eingestellt werden, sperren wir nach vorheriger Verwarnung. Das entspricht Artikel 23 der Verordnung (EU) 2022/2065.",
        "Ebenso sperren wir die Meldefunktion für Personen, die wiederholt offensichtlich unbegründete Meldungen abgeben.",
      ],
    },
  ],
};

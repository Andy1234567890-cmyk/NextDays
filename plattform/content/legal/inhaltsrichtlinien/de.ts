import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Richtlinien für angemessene Inhalte",
  stand: "Stand: 18. August 2026",
  intro: [
    "Diese Richtlinien gelten für alle Inhalte, die Nutzer auf myBestDays einstellen: Angebote, Fotos, Bewertungen, Nachrichten, Profilangaben und Antworten auf Bewertungen.",
    "Sie sind Bestandteil der [Nutzungsbedingungen](https://mybestdays.dk/rechtliches/nutzungsbedingungen). Ein Verstoß kann zur Entfernung des Inhalts und zu Maßnahmen gegen das Konto führen.",
  ],
  sections: [
    {
      id: "nicht-erlaubt",
      heading: "1. Was nicht erlaubt ist",
      paragraphs: ["Auf myBestDays sind insbesondere folgende Inhalte unzulässig:"],
      list: [
        "rechtswidrige Inhalte jeder Art, insbesondere Aufrufe zu Straftaten, terroristische Inhalte und Darstellungen sexuellen Missbrauchs von Kindern;",
        "Inhalte, die zu Hass oder Gewalt gegen Personen oder Gruppen aufgrund von Herkunft, Hautfarbe, Religion, Weltanschauung, Geschlecht, Geschlechtsidentität, sexueller Orientierung, Behinderung oder Alter aufstacheln;",
        "Beleidigungen, Bedrohungen, Belästigung und die gezielte Bloßstellung einzelner Personen;",
        "personenbezogene Daten Dritter ohne deren Einwilligung, insbesondere Namen, Anschriften, Telefonnummern, Ausweis- oder Zahlungsdaten;",
        "irreführende Angaben über eine Unterkunft, ihre Lage, Ausstattung, Größe oder Verfügbarkeit;",
        "fremde Fotos, Texte oder Marken ohne die erforderlichen Rechte;",
        "Werbung, Spam und Inhalte, die auf andere Buchungswege außerhalb der Plattform führen;",
        "Schadsoftware, Phishing-Versuche und Links auf solche Inhalte;",
        "Angebote für etwas anderes als eine Beherbergungsleistung.",
      ],
    },
    {
      id: "fotos",
      heading: "2. Fotos",
      paragraphs: [
        "Fotos müssen die tatsächlich angebotene Unterkunft zeigen und in einem Zustand aufgenommen sein, der dem heutigen entspricht.",
        "Fotos dürfen keine erkennbaren Personen ohne deren Einwilligung zeigen. Bearbeitungen sind zulässig, soweit sie den Eindruck der Unterkunft nicht verfälschen — eine Aufhellung ja, ein wegretuschierter Nachbarbau nein.",
        "Kamerabasierte Überwachung in der Unterkunft ist im Angebot offenzulegen. In Innenräumen, in denen Gäste eine berechtigte Privatheitserwartung haben — Schlafräume, Bäder — sind Kameras unzulässig, auch abgeschaltet.",
      ],
    },
    {
      id: "melden",
      heading: "3. Inhalte melden",
      paragraphs: [
        "Halten Sie einen Inhalt für rechtswidrig oder für einen Verstoß gegen diese Richtlinien, können Sie ihn über die Meldefunktion an jedem Angebot, jeder Bewertung und jeder Nachricht melden.",
        "Das Meldeverfahren nach Artikel 16 der Verordnung (EU) 2022/2065 und die Bearbeitung von Meldungen sind unter [Gesetz über digitale Dienste](https://mybestdays.dk/rechtliches/dsa) beschrieben.",
      ],
    },
    {
      id: "durchsetzung",
      heading: "4. Wie wir durchsetzen",
      paragraphs: [
        "Wir prüfen jeden gemeldeten Inhalt und wählen die mildeste geeignete Maßnahme: Hinweis, Entfernung des betroffenen Teils, Entfernung des gesamten Inhalts, Einschränkung der Sichtbarkeit, Sperrung einer Funktion oder Sperrung des Kontos.",
        "Wiederholte oder schwere Verstöße wiegen schwerer. Bei offensichtlich rechtswidrigen Inhalten oder Gefahr für Personen handeln wir sofort.",
        "Jede Maßnahme begründen wir gegenüber der betroffenen Person und weisen auf den Beschwerdeweg hin. Die Beschwerde wird von Menschen bearbeitet.",
      ],
    },
  ],
};

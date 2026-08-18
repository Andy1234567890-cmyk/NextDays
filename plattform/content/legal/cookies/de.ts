import type { LegalDoc } from "../types";

export const doc: LegalDoc = {
  title: "Cookie-Richtlinie",
  stand: "Stand: 18. August 2026",
  intro: [
    "Diese Richtlinie erklärt, welche Cookies und ähnlichen Technologien myBestDays einsetzt, wozu, wie lange sie gespeichert bleiben und wie Sie sie steuern.",
    "Sie ergänzt die [Datenschutzerklärung](https://mybestdays.dk/rechtliches/datenschutz).",
  ],
  sections: [
    {
      id: "was",
      heading: "1. Was Cookies sind",
      paragraphs: [
        "Cookies sind kleine Textdateien, die eine Website in Ihrem Browser speichert. Ähnliche Technologien sind der lokale Speicher des Browsers und Zählpixel in E-Mails.",
        "Cookies, die für den Betrieb der Plattform unbedingt erforderlich sind, dürfen wir ohne Ihre Einwilligung setzen. Für alle übrigen holen wir Ihre Einwilligung ein (Artikel 5 Absatz 3 der Richtlinie 2002/58/EG).",
      ],
    },
    {
      id: "notwendig",
      heading: "2. Notwendige Cookies",
      paragraphs: [
        "Diese Cookies sind für den Betrieb erforderlich und lassen sich nicht abwählen. Wir setzen derzeit:",
      ],
      list: [
        "„nd_access“ — hält Ihre Anmeldung aufrecht. Nur für den Server lesbar (HttpOnly), Laufzeit entsprechend der Gültigkeit der Sitzung.",
        "„nd_refresh“ — erneuert Ihre Anmeldung, damit Sie nicht ständig neu anmelden müssen. Nur für den Server lesbar, Laufzeit 30 Tage.",
        "„nd_gast_locale“ — merkt sich Ihre gewählte Sprache. Laufzeit ein Jahr.",
      ],
    },
    {
      id: "funktional",
      heading: "3. Funktionale, statistische und Marketing-Cookies",
      paragraphs: [
        "myBestDays setzt derzeit keine Cookies für Statistik, Reichweitenmessung oder Werbung und bindet keine Werbenetzwerke oder Analysedienste ein.",
        "Sollte sich das ändern, holen wir vorher Ihre Einwilligung über einen Auswahldialog ein, in dem Ablehnen genauso einfach ist wie Zustimmen, und ergänzen diese Richtlinie um die konkreten Cookies.",
      ],
    },
    {
      id: "eingebettet",
      heading: "4. Eingebettete Inhalte Dritter",
      paragraphs: [
        "Auf Detailseiten können Karten eingebettet sein. Solche Inhalte laden wir erst, wenn Sie sie ausdrücklich aktivieren; erst dann können Daten an den jeweiligen Anbieter übertragen werden.",
      ],
    },
    {
      id: "steuern",
      heading: "5. Wie Sie Cookies steuern",
      paragraphs: [
        "Ihre Einwilligung können Sie jederzeit über die Cookie-Einstellungen in der Fußzeile ändern oder widerrufen.",
        "Zusätzlich können Sie Cookies in Ihrem Browser löschen oder blockieren. Löschen Sie die notwendigen Cookies, werden Sie abgemeldet und die Plattform funktioniert eingeschränkt.",
      ],
    },
  ],
};

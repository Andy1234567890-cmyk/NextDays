import type { HelpCategory } from "../types";

export const ucMietpreise: HelpCategory = {
  slug: "anwendungsfaelle-mietpreise",
  title: "Mietpreise",
  description: "Mietpreise optimal festlegen.",
  icon: "ph:tag",
  collection: "usecases",
  sections: [
    {
      heading: "Mietpreise",
      articles: [
        {
          slug: "hochsaison-preise",
          title: "Preise für die Hochsaison optimieren",
          excerpt: "So heben Sie Ihre Preise für stark nachgefragte Zeiträume gezielt an.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "h2",
              text: "Ausgangslage",
            },
            {
              type: "p",
              text: "In der Hochsaison steigt die Nachfrage deutlich, während Ihr Grundpreis dieselben Werte wie im Rest des Jahres ansetzt. Ohne saisonale Anpassung lassen Sie in der stärksten Zeit des Jahres Umsatz liegen — die Anpassung erfolgt über den Rate-Plan Ihres Objekts, nicht durch manuelles Überschreiben einzelner Tage.",
            },
            {
              type: "steps",
              items: [
                "Öffnen Sie den Rate-Plan des betroffenen Objekts und legen Sie eine Saisonregel für den gewünschten Zeitraum an.",
                "Setzen Sie den Aufschlag als Prozentwert oder festen Betrag über dem Grundpreis — der Rate-Plan übernimmt die Objektwährung automatisch.",
                "Prüfen Sie im Kalender, dass der neue Preis für den Hochsaison-Zeitraum korrekt angezeigt wird, bevor Sie ihn aktivieren.",
                "Kontrollieren Sie den Mindestaufenthalt für die Hochsaison — oft ist eine höhere Mindestbuchungsdauer sinnvoll, um die Auslastung planbar zu halten.",
                "Beobachten Sie nach Aktivierung die Buchungslage über die ersten Tage und passen Sie den Aufschlag bei Bedarf nach.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Eine Saisonregel wirkt kanalübergreifend auf Portalen, Plattform und Website gleichermaßen. Details zum Aufbau der Regeln finden Sie unter [Rate-Pläne](/hilfe/preise-raten/rate-plaene).",
            },
          ],
        },
        {
          slug: "laengere-aufenthalte-rabatt",
          title: "Längere Aufenthalte mit Rabatt fördern",
          excerpt: "So belohnen Sie Gäste mit längerer Aufenthaltsdauer und reduzieren Wechselaufwand.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "h2",
              text: "Ausgangslage",
            },
            {
              type: "p",
              text: "Kurze Aufenthalte bedeuten mehr An- und Abreisen, mehr Reinigungen und mehr Leerstandsrisiko zwischen Buchungen. Ein gestaffelter Aufenthaltsrabatt macht längere Buchungen für Gäste attraktiver und reduziert diesen Aufwand spürbar.",
            },
            {
              type: "steps",
              items: [
                "Öffnen Sie den Rate-Plan des Objekts und legen Sie einen Aufenthaltsrabatt an.",
                "Definieren Sie mindestens eine Staffel, etwa ab 7 Nächten oder ab 28 Nächten, mit dem jeweiligen Rabattsatz.",
                "Prüfen Sie, dass sich die Staffeln nicht überschneiden und der Rabatt nur ab der jeweiligen Mindestdauer greift.",
                "Testen Sie im Kalender eine Beispielbuchung über die Rabattgrenze hinweg, um die korrekte Anwendung zu bestätigen.",
                "Aktivieren Sie den Rabatt und beobachten Sie die Auswirkung auf durchschnittliche Aufenthaltsdauer und Auslastung.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Aufenthaltsrabatte lassen sich mit Saisonregeln kombinieren — der Rate-Plan berechnet beide Anpassungen zusammen. Mehr dazu unter [Rate-Pläne](/hilfe/preise-raten/rate-plaene).",
            },
          ],
        },
      ],
    },
  ],
};

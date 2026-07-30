import type { HelpCategory } from "../types";

export const ucReservierungen: HelpCategory = {
  slug: "anwendungsfaelle-reservierungen",
  title: "Reservierungen & Kalender",
  description: "Reservierungen und Kalender im Griff behalten.",
  icon: "ph:calendar-check",
  collection: "usecases",
  sections: [
    {
      heading: "Reservierungen & Kalender",
      articles: [
        {
          slug: "ueberbuchung-vermeiden",
          title: "Überbuchungen zuverlässig vermeiden",
          excerpt: "So stellen Sie sicher, dass ein Objekt nie doppelt gebucht wird.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "h2",
              text: "Ausgangslage",
            },
            {
              type: "p",
              text: "Ein Objekt wird über mehrere Kanäle gleichzeitig verkauft — Portale wie Booking, Airbnb & Co., die eigene Plattform sowie die App. Eine Überbuchung entsteht, wenn Verfügbarkeit auf einem Kanal nicht rechtzeitig gesperrt wird, nachdem auf einem anderen Kanal gebucht wurde.",
            },
            {
              type: "steps",
              items: [
                "Prüfen Sie im Belegungsplan, dass jedes Objekt genau eine Zeile mit einer buchbaren Einheit ist — keine gemeinsame Kapazität mehrerer Zimmer.",
                "Lassen Sie neue Buchungen ausschließlich über den Belegungsplan oder die angebundenen Kanäle anlegen, nie durch manuelles Beschreiben einzelner Tage.",
                "Kontrollieren Sie nach jeder Buchung, dass die gebuchten Nächte im Kalender sofort als belegt erscheinen.",
                "Nutzen Sie bei technischen Problemen oder Wartung sofort Stop-Sell, statt den Tag offen zu lassen.",
                "Prüfen Sie bei Unklarheiten die Buchungs-Zeitleiste der betroffenen Reservierung, um den zeitlichen Ablauf nachzuvollziehen.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Verändern Sie Nächte oder Sperren nie manuell außerhalb des Belegungsplans — nur so bleibt sichergestellt, dass alle Kanäle denselben Verfügbarkeitsstand sehen und keine Lücke für eine Doppelbuchung entsteht.",
            },
          ],
        },
        {
          slug: "buchung-umziehen",
          title: "Eine Buchung in ein anderes Objekt umziehen",
          excerpt: "So verschieben Sie eine bestehende Reservierung sauber auf ein anderes Objekt.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "h2",
              text: "Ausgangslage",
            },
            {
              type: "p",
              text: "Manchmal muss ein Gast aus einem Objekt in ein anderes umziehen, etwa wegen eines technischen Defekts oder auf Gastwunsch. Beim Umzug werden die bisherigen Kalendernächte automatisch freigegeben und im Zielobjekt neu belegt.",
            },
            {
              type: "steps",
              items: [
                "Öffnen Sie die betroffene Buchung in der Buchungs-Zeitleiste.",
                "Wählen Sie im Aktionsmenü „Objekt wechseln“ bzw. „Umziehen“.",
                "Wählen Sie das Zielobjekt und prüfen Sie dessen Verfügbarkeit im gewählten Zeitraum.",
                "Bestätigen Sie den Umzug.",
                "Prüfen Sie anschließend im Belegungsplan, dass die alten Nächte im Ursprungsobjekt wieder als verfügbar angezeigt werden.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Die Freigabe der alten Nächte übernimmt das System automatisch — Sie müssen den Ursprungszeitraum nicht selbst manuell öffnen. Informieren Sie den Gast über den Objektwechsel, insbesondere wenn sich Ausstattung oder Zugang unterscheiden.",
            },
          ],
        },
        {
          slug: "langzeitbuchung-anlegen",
          title: "Eine Langzeitbuchung anlegen",
          excerpt: "So legen Sie eine Reservierung über einen längeren Zeitraum korrekt an.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "h2",
              text: "Ausgangslage",
            },
            {
              type: "p",
              text: "Für Langzeitgäste — etwa mehrere Wochen oder Monate — legen Sie eine Reservierung wie gewohnt an, achten aber zusätzlich auf Mindestaufenthalt, Zahlungsregeln und die Kanal-Sichtbarkeit des Objekts über den gesamten Zeitraum.",
            },
            {
              type: "steps",
              items: [
                "Öffnen Sie den Belegungsplan des gewünschten Objekts und markieren Sie den vollständigen Zeitraum.",
                "Legen Sie die Buchung mit den Gastdaten und dem geplanten An- und Abreisedatum an.",
                "Richten Sie bei Bedarf eine Zahlungsregel mit Anzahlung und Restzahlung ein, statt den vollen Betrag sofort fällig zu stellen.",
                "Prüfen Sie, dass keine Mindest- oder Höchstaufenthaltsregel dem langen Zeitraum widerspricht.",
                "Speichern Sie die Buchung und kontrollieren Sie, dass der gesamte Zeitraum im Kalender korrekt als belegt erscheint.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Bei sehr langen Aufenthalten empfiehlt sich eine Restzahlung in mehreren Teilbeträgen statt einer einzigen großen Fälligkeit — so bleibt das Zahlungsrisiko überschaubar. Details dazu unter [Die Restzahlung automatisieren](/hilfe/anwendungsfaelle-zahlungen/restzahlung-automatisieren).",
            },
          ],
        },
      ],
    },
  ],
};

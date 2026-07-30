import type { HelpCategory } from "../types";

export const mobileApp: HelpCategory = {
  slug: "mobile-app",
  title: "Mobile App",
  description: "Die myNextDays-App für unterwegs.",
  icon: "ph:device-mobile",
  collection: "kb",
  sections: [
    {
      heading: "App",
      articles: [
        {
          slug: "die-app",
          title: "Die myNextDays-App",
          excerpt: "Ein Konto, vier Erlebnisse: Gast, Agentur, Owner und Mitarbeiter.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "p",
              text: "Die myNextDays-App ist die mobile Plattform für Ihren gesamten Betrieb. Sie ist kein separates Produkt, sondern ein gleichwertiges Frontend zu Ihrem Web-Dashboard — beide greifen auf dasselbe Konto und dieselben Daten zu, nur die Oberfläche ist für unterwegs optimiert.",
            },
            { type: "h2", text: "Vier Erlebnisse in einer App" },
            {
              type: "ul",
              items: [
                "Gast: Buchungen ansehen, mit dem Betrieb kommunizieren, Check-in-Informationen abrufen.",
                "Agentur: mehrere Betriebe und Objekte im Überblick verwalten.",
                "Owner: schreibgeschützter Einblick in die eigenen Objekte, Belegung und Berichte.",
                "Mitarbeiter: Kalender, Aufgaben und Reinigungspläne für den operativen Alltag.",
              ],
            },
            { type: "h2", text: "Welches Erlebnis Sie sehen" },
            {
              type: "p",
              text: "Nach der Anmeldung zeigt die App automatisch das passende Erlebnis für Ihre Rolle — dieselbe Rolle, die auch im Web-Dashboard gilt. Ein Mitarbeiter mit eingeschränkten Rechten sieht in der App genau dieselben Einschränkungen wie im Browser, da die Berechtigung serverseitig geprüft wird.",
            },
            {
              type: "note",
              variant: "info",
              text: "Mehr zu Rollen und was sie jeweils sehen dürfen finden Sie unter [Rollen & Berechtigungen](/hilfe/team-rollen/rollen-berechtigungen).",
            },
            {
              type: "note",
              variant: "tip",
              text: "Sie benötigen keine separate Registrierung für die App — melden Sie sich einfach mit Ihren bestehenden myNextDays-Zugangsdaten an.",
            },
          ],
        },
        {
          slug: "app-installieren",
          title: "App installieren & anmelden",
          excerpt: "So laden Sie die myNextDays-App herunter und melden sich an.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "p",
              text: "Die myNextDays-App steht für iOS und Android zur Verfügung. Die Anmeldung erfolgt mit denselben Zugangsdaten wie im Web-Dashboard — es ist kein separates Konto und keine erneute Registrierung nötig.",
            },
            { type: "h2", text: "Installation" },
            {
              type: "steps",
              items: [
                "Öffnen Sie den App Store (iOS) oder Google Play (Android).",
                "Suchen Sie nach „myNextDays“.",
                "Installieren Sie die App auf Ihrem Smartphone oder Tablet.",
                "Öffnen Sie die App nach der Installation.",
              ],
            },
            { type: "h2", text: "Anmeldung" },
            {
              type: "steps",
              items: [
                "Tippen Sie auf „Anmelden“.",
                "Geben Sie Ihre E-Mail-Adresse und Ihr Passwort ein.",
                "Bestätigen Sie gegebenenfalls die Zwei-Faktor-Abfrage.",
                "Sie gelangen automatisch in das für Ihre Rolle passende Erlebnis.",
              ],
            },
            {
              type: "ul",
              items: [
                "Zugangsdaten sind identisch mit dem Web-Dashboard.",
                "Wurde Ihr Zugriff entzogen, ist auch die Anmeldung in der App sofort gesperrt.",
                "Bei Problemen mit dem Passwort nutzen Sie „Passwort vergessen“ direkt in der App.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Melden Sie sich ausschließlich über den offiziellen App-Store-Eintrag „myNextDays“ an; die App fragt niemals Zugangsdaten außerhalb des Anmeldebildschirms ab.",
            },
          ],
        },
        {
          slug: "unterwegs-verwalten",
          title: "Unterwegs verwalten",
          excerpt: "Buchungen, Nachrichten und Aufgaben direkt vom Smartphone aus bearbeiten.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "p",
              text: "Die myNextDays-App eignet sich besonders für den laufenden Betrieb unterwegs: Sie sehen aktuelle Buchungen, beantworten Gästenachrichten und arbeiten Aufgaben ab, ohne am Rechner sitzen zu müssen — Änderungen erscheinen in Echtzeit auch im Web-Dashboard.",
            },
            { type: "h2", text: "Buchungen im Blick" },
            {
              type: "p",
              text: "Im Bereich „Buchungen“ sehen Sie An- und Abreisen, Belegung und Status je Objekt. Mitarbeiter und Reinigung sehen dabei nur die für sie relevanten Informationen, ohne Preise oder Vertriebsdetails.",
            },
            { type: "h2", text: "Nachrichten & Aufgaben" },
            {
              type: "steps",
              items: [
                "Öffnen Sie den Bereich „Nachrichten“, um Gästeanfragen direkt zu beantworten.",
                "Wechseln Sie in „Aufgaben“, um Ihnen zugewiesene To-dos zu sehen.",
                "Tippen Sie eine Aufgabe an, um Details zu öffnen und sie abzuschließen.",
                "Markieren Sie erledigte Reinigungstermine direkt vor Ort als abgeschlossen.",
              ],
            },
            {
              type: "ul",
              items: [
                "Neue Nachrichten und Aufgaben erscheinen live, ohne manuelles Aktualisieren.",
                "Abgeschlossene Aufgaben sind sofort auch im Web-Dashboard sichtbar.",
                "Owner sehen Buchungen und Berichte ihrer Objekte, jedoch rein lesend.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Push-Benachrichtigungen informieren Sie über neue Nachrichten und zugewiesene Aufgaben, sobald Sie diese in den Geräteeinstellungen erlauben.",
            },
          ],
        },
      ],
    },
  ],
};

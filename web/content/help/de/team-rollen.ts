import type { HelpCategory } from "../types";

export const teamRollen: HelpCategory = {
  slug: "team-rollen",
  title: "Team & Berechtigungen",
  description: "Mitarbeiter, Rollen und Zugriffsrechte.",
  icon: "ph:shield-check",
  collection: "kb",
  sections: [
    {
      heading: "Zugriff",
      articles: [
        {
          slug: "mitarbeiter-einladen",
          title: "Mitarbeiter einladen",
          excerpt: "So laden Sie neue Mitarbeiter zu Ihrem myNextDays-Konto ein.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "p",
              text: "Zu Ihrem Betrieb können Sie beliebig viele Mitarbeiter einladen — etwa für Rezeption, Reinigung oder Verwaltung. Jede Einladung ist an eine E-Mail-Adresse gebunden und vergibt sofort eine feste Rolle, die den Zugriff im Web und in der myNextDays-App bestimmt.",
            },
            { type: "h2", text: "Einladung versenden" },
            {
              type: "steps",
              items: [
                "Öffnen Sie „Konto“ und wechseln Sie in den Bereich „Team“.",
                "Klicken Sie auf „Mitarbeiter einladen“.",
                "Tragen Sie die E-Mail-Adresse der Person ein.",
                "Wählen Sie die passende Rolle aus, z. B. Mitarbeiter oder Reinigung.",
                "Bestätigen Sie die Einladung.",
              ],
            },
            { type: "h2", text: "Was danach passiert" },
            {
              type: "p",
              text: "Die eingeladene Person erhält eine E-Mail mit einem Link, um ein eigenes Passwort zu vergeben und sich anzumelden. Der Login gilt gleichermaßen für das Web-Dashboard und die myNextDays-App — es gibt kein separates Konto pro Frontend.",
            },
            {
              type: "ul",
              items: [
                "Eine Einladung ist so lange gültig, bis sie angenommen oder zurückgezogen wird.",
                "Offene Einladungen sehen Sie im Bereich „Team“ mit Status „Ausstehend“.",
                "Die Rolle lässt sich jederzeit nachträglich anpassen.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Welche Rolle welche Bereiche sehen darf, erfahren Sie unter [Rollen & Berechtigungen](/hilfe/team-rollen/rollen-berechtigungen).",
            },
            {
              type: "note",
              variant: "tip",
              text: "Vergeben Sie von Anfang an die engste passende Rolle — Rechte lassen sich jederzeit später erweitern.",
            },
          ],
        },
        {
          slug: "rollen-berechtigungen",
          title: "Rollen & Berechtigungen",
          excerpt: "Die fünf Rollen in myNextDays und was sie jeweils dürfen.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "p",
              text: "myNextDays unterscheidet fünf Rollen: Admin, Co-Admin, Mitarbeiter, Reinigung und Eigentümer. Jede Rolle bestimmt, welche Bereiche im Web-Dashboard und in der myNextDays-App sichtbar sind — die Rechte werden dabei serverseitig erzwungen, nicht nur in der Oberfläche ausgeblendet.",
            },
            { type: "h2", text: "Die Rollen im Überblick" },
            {
              type: "ul",
              items: [
                "Admin: voller Zugriff auf alle Bereiche, inklusive Finanzen, Vertrieb und Team-Verwaltung.",
                "Co-Admin: nahezu voller Zugriff wie Admin, für die zweite Führungsebene des Betriebs.",
                "Mitarbeiter: operativer Zugriff auf Buchungen, Kalender und Aufgaben, ohne Finanz- oder Vertriebseinblick.",
                "Reinigung: ausschließlich Zugriff auf zugewiesene Reinigungsaufgaben und Objektdetails, ohne Finanz- oder Vertriebseinblick.",
                "Eigentümer: schreibgeschützter Einblick in die eigenen Objekte, keine Verwaltung fremder Objekte.",
              ],
            },
            { type: "h2", text: "Rolle zuweisen oder ändern" },
            {
              type: "steps",
              items: [
                "Öffnen Sie „Konto“ → „Team“.",
                "Wählen Sie den betreffenden Mitarbeiter aus der Liste.",
                "Klicken Sie auf „Rolle ändern“.",
                "Wählen Sie die neue Rolle aus und bestätigen Sie.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Mitarbeiter und Reinigung sehen grundsätzlich keine Preise, Umsätze oder Buchungskanäle — dieser Ausschluss gilt serverseitig und lässt sich nicht über die Oberfläche umgehen.",
            },
            {
              type: "note",
              variant: "info",
              text: "Eine Übersicht je Rolle finden Sie unter [Was welche Rolle sieht](/hilfe/team-rollen/was-welche-rolle-sieht).",
            },
          ],
        },
        {
          slug: "was-welche-rolle-sieht",
          title: "Was welche Rolle sieht",
          excerpt: "Konkrete Bereiche und Ansichten je Rolle im Web und in der App.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "p",
              text: "Neben den grundsätzlichen Rechten aus [Rollen & Berechtigungen](/hilfe/team-rollen/rollen-berechtigungen) hilft ein konkreter Blick auf einzelne Bereiche, damit Sie beim Onboarding neuer Mitarbeiter die richtige Erwartung setzen.",
            },
            { type: "h2", text: "Kalender & Buchungen" },
            {
              type: "p",
              text: "Admin, Co-Admin und Mitarbeiter sehen den vollständigen Belegungsplan mit Gastdaten und Aufgaben. Reinigung sieht nur die ihr zugewiesenen Termine samt Objektadresse und Checkliste, jedoch keine Gastnamen oder Preise. Eigentümer sehen den Belegungskalender ausschließlich für ihre eigenen Objekte, rein lesend.",
            },
            { type: "h2", text: "Finanzen & Vertrieb" },
            {
              type: "ul",
              items: [
                "Umsätze, Provisionen und Rechnungen: nur Admin und Co-Admin.",
                "Portale (OTA-Anbindung) und Plattform-Sichtbarkeit: nur Admin und Co-Admin.",
                "Mitarbeiter und Reinigung: kein Zugriff auf Finanz- oder Vertriebsbereiche, auch nicht auf Detailseiten.",
              ],
            },
            { type: "h2", text: "Team & Einstellungen" },
            {
              type: "p",
              text: "Die Verwaltung von Mitarbeitern, Rollen und Kontoeinstellungen bleibt Admin und Co-Admin vorbehalten. Eigentümer und operative Rollen sehen diesen Bereich in der myNextDays-App und im Web-Dashboard gar nicht erst.",
            },
            {
              type: "note",
              variant: "info",
              text: "Diese Aufteilung gilt identisch im Web-Dashboard und in der myNextDays-App, da beide Frontends dieselbe Rolle aus Ihrem Konto abfragen.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Testen Sie neue Rollen nach der Einladung kurz gemeinsam mit dem Mitarbeiter, um Missverständnisse über sichtbare Bereiche zu vermeiden.",
            },
          ],
        },
        {
          slug: "zugriff-entziehen",
          title: "Zugriff entziehen",
          excerpt: "Mitarbeiterzugriff sofort und vollständig entfernen.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "p",
              text: "Verlässt ein Mitarbeiter Ihren Betrieb oder ändert sich die Zusammenarbeit, entfernen Sie den Zugriff direkt im Konto. Der Entzug wirkt serverseitig und sofort — nicht erst nach Ablauf einer bestehenden Sitzung.",
            },
            { type: "h2", text: "Zugriff entfernen" },
            {
              type: "steps",
              items: [
                "Öffnen Sie „Konto“ → „Team“.",
                "Wählen Sie den betreffenden Mitarbeiter aus.",
                "Klicken Sie auf „Zugriff entziehen“.",
                "Bestätigen Sie den Vorgang.",
              ],
            },
            { type: "h2", text: "Auswirkung auf laufende Sitzungen" },
            {
              type: "p",
              text: "Nach dem Entzug kann sich die Person weder im Web-Dashboard noch in der myNextDays-App erneut anmelden. Bereits zugewiesene Aufgaben oder Reinigungstermine sollten Sie vorher einem anderen Mitarbeiter zuordnen, damit nichts unbearbeitet bleibt.",
            },
            {
              type: "ul",
              items: [
                "Offene Aufgaben vor dem Entzug neu zuweisen.",
                "Zugriff lässt sich später erneut per Einladung wiederherstellen.",
                "Der Entzug betrifft nur diesen Betrieb, nicht andere Konten der Person.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Entziehen Sie den Zugriff zeitnah, sobald eine Zusammenarbeit endet — offene Mitarbeiterkonten bleiben sonst ein unnötiges Sicherheitsrisiko.",
            },
          ],
        },
      ],
    },
  ],
};

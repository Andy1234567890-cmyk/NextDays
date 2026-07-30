import type { HelpCategory } from "../types";

export const eigentuemer: HelpCategory = {
  slug: "eigentuemer",
  title: "Eigentümer & Abrechnungen",
  description: "Eigentümerkonten, Abrechnungen und Provisionen.",
  icon: "ph:users-three",
  collection: "kb",
  sections: [
    {
      heading: "Eigentümer",
      articles: [
        {
          slug: "eigentuemer-anlegen",
          title: "Eigentümer anlegen",
          excerpt: "So legen Sie ein neues Eigentümerkonto in myNextDays an.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "p",
              text: "Eigentümer sind eigene Konten in myNextDays, über die Sie Objekte verwalten, die einer bestimmten Person oder Gesellschaft gehören. Ein Eigentümerkonto erhält einen begrenzten, read-only Einblick in seine eigenen Objekte, ohne selbst Änderungen am Betrieb vorzunehmen.",
            },
            { type: "h2", text: "Neues Eigentümerkonto anlegen" },
            {
              type: "steps",
              items: [
                "Öffnen Sie den Bereich „Eigentümer“ im Hauptmenü.",
                "Klicken Sie auf „Neuen Eigentümer anlegen“.",
                "Tragen Sie Name, E-Mail-Adresse und Kontaktdaten ein.",
                "Hinterlegen Sie bei Bedarf die Rechnungsanschrift für Abrechnungen.",
                "Speichern Sie das Konto.",
              ],
            },
            { type: "h2", text: "Zugang einrichten" },
            {
              type: "p",
              text: "Nach dem Anlegen können Sie dem Eigentümer eine Einladung zum eigenen Zugang senden. Der Eigentümer meldet sich dann mit eigenen Zugangsdaten an und sieht ausschließlich die ihm zugeordneten Objekte.",
            },
            {
              type: "ul",
              items: [
                "Ein Eigentümerkonto kann mehrere Objekte umfassen.",
                "Jedes Objekt gehört genau einem Eigentümer.",
                "Kontaktdaten und Rechnungsanschrift lassen sich jederzeit nachträglich anpassen.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Wie Sie ein bestehendes Objekt einem Eigentümer zuordnen, lesen Sie unter [Objekt einem Eigentümer zuordnen](/hilfe/eigentuemer/objekt-eigentuemer-zuordnen).",
            },
          ],
        },
        {
          slug: "objekt-eigentuemer-zuordnen",
          title: "Objekt einem Eigentümer zuordnen",
          excerpt: "Jedes Objekt gehört genau einem Eigentümer — so richten Sie die Zuordnung ein.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "p",
              text: "In myNextDays gehört jedes Objekt genau einem Eigentümer. Eine Mehrfachzuordnung ist nicht vorgesehen — soll ein Objekt einem anderen Eigentümer gehören, lösen Sie zuerst die bestehende Zuordnung, bevor Sie eine neue setzen.",
            },
            { type: "h2", text: "Zuordnung vornehmen" },
            {
              type: "steps",
              items: [
                "Öffnen Sie das Objekt unter „Objekte“.",
                "Wechseln Sie in den Tab „Eigentümer“.",
                "Wählen Sie den zuständigen Eigentümer aus der Liste aus.",
                "Bestätigen Sie die Zuordnung.",
                "Speichern Sie die Änderung am Objekt.",
              ],
            },
            { type: "h2", text: "Wechsel des Eigentümers" },
            {
              type: "p",
              text: "Ändert sich der Eigentümer eines Objekts, etwa durch einen Verkauf, ersetzen Sie die bestehende Zuordnung durch die neue. Bereits erstellte Abrechnungen für vergangene Zeiträume bleiben dabei dem ursprünglichen Eigentümer zugeordnet.",
            },
            {
              type: "ul",
              items: [
                "Ein Objekt kann zu jedem Zeitpunkt nur einem Eigentümer zugeordnet sein.",
                "Ohne Zuordnung erscheint das Objekt in keinem Eigentümer-Zugang.",
                "Vergangene Abrechnungen bleiben beim ursprünglichen Eigentümer erhalten.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Eine Mehrfachzuordnung eines Objekts zu mehreren Eigentümern ist ausgeschlossen — das System lässt eine zweite gleichzeitige Zuordnung nicht zu.",
            },
          ],
        },
        {
          slug: "eigentuemer-abrechnung",
          title: "Eigentümer-Abrechnung (Statement)",
          excerpt: "So erstellen Sie ein Statement mit Einnahmen abzüglich Provision für einen Eigentümer.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "p",
              text: "Die Eigentümer-Abrechnung, auch Statement genannt, fasst für einen gewählten Zeitraum alle Einnahmen der zugeordneten Objekte zusammen und zieht Ihre vereinbarte Provision ab. Das Ergebnis ist der Betrag, den Sie dem Eigentümer auszahlen.",
            },
            { type: "h2", text: "Statement erstellen" },
            {
              type: "steps",
              items: [
                "Öffnen Sie den Bereich „Eigentümer“ und wählen Sie den gewünschten Eigentümer aus.",
                "Wechseln Sie in den Tab „Abrechnung“.",
                "Wählen Sie den Abrechnungszeitraum aus.",
                "Prüfen Sie die aufgelisteten Buchungen und Einnahmen je Objekt.",
                "Lassen Sie das Statement mit abgezogener Provision erstellen.",
              ],
            },
            { type: "h2", text: "Aufbau des Statements" },
            {
              type: "p",
              text: "Ein Statement listet je Objekt die Bruttoeinnahmen aus Buchungen, die davon abgezogene Provision und den daraus resultierenden Auszahlungsbetrag. Zusatzkosten wie Reinigung oder Gebühren können, je nach Vereinbarung, gesondert ausgewiesen werden.",
            },
            {
              type: "ul",
              items: [
                "Bruttoeinnahmen: Summe aller Buchungen im Zeitraum je Objekt.",
                "Provision: Ihr vereinbarter Anteil, wird von den Einnahmen abgezogen.",
                "Auszahlungsbetrag: Einnahmen abzüglich Provision und ggf. weiterer Posten.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Beträge im Statement werden immer in der Objektwährung ausgewiesen — es gibt keinen pauschalen Währungs-Fallback.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Erstellen Sie Statements regelmäßig zum gleichen Stichtag, damit Eigentümer einen verlässlichen Rhythmus für ihre Auszahlungen haben.",
            },
          ],
        },
        {
          slug: "eigentuemer-zugang",
          title: "Eigentümer-Zugang",
          excerpt: "Was Eigentümer in ihrem read-only Zugang sehen können.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "p",
              text: "Der Eigentümer-Zugang ist ein eigener, read-only Login für myNextDays. Eigentümer sehen darin ausschließlich die ihnen zugeordneten Objekte sowie die dazugehörigen Belegungen und Abrechnungen — ohne Möglichkeit, Einstellungen selbst zu ändern.",
            },
            { type: "h2", text: "Was Eigentümer sehen" },
            {
              type: "ul",
              items: [
                "Belegungskalender ihrer eigenen Objekte.",
                "Erstellte Statements mit Einnahmen und abgezogener Provision.",
                "Grunddaten ihrer Objekte, etwa Ausstattung und Beschreibung.",
              ],
            },
            { type: "h2", text: "Zugang aktivieren" },
            {
              type: "steps",
              items: [
                "Öffnen Sie den Eigentümer unter „Eigentümer“.",
                "Klicken Sie auf „Zugang einladen“.",
                "Der Eigentümer erhält eine E-Mail zur Einrichtung des eigenen Passworts.",
                "Nach der Anmeldung sieht der Eigentümer automatisch nur seine zugeordneten Objekte.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Der Eigentümer-Zugang ist strikt read-only: Preise, Verfügbarkeiten oder Objektdaten können nur Sie als Betrieb ändern, nicht der Eigentümer selbst.",
            },
            {
              type: "note",
              variant: "info",
              text: "Mehr zur Zuordnung von Objekten finden Sie unter [Objekt einem Eigentümer zuordnen](/hilfe/eigentuemer/objekt-eigentuemer-zuordnen).",
            },
          ],
        },
      ],
    },
  ],
};

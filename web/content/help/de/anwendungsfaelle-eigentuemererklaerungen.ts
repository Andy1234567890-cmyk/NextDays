import type { HelpCategory } from "../types";

export const ucEigentuemer: HelpCategory = {
  slug: "anwendungsfaelle-eigentuemererklaerungen",
  title: "Eigentümererklärungen",
  description: "Eigentümererklärungen erstellen.",
  icon: "ph:file-text",
  collection: "usecases",
  sections: [
    {
      heading: "Eigentümererklärungen",
      articles: [
        {
          slug: "statement-erzeugen",
          title: "Ein Eigentümer-Statement erzeugen",
          excerpt: "So erstellen Sie für einen Eigentümer eine übersichtliche Abrechnung seines Zeitraums.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "h2",
              text: "Ausgangslage",
            },
            {
              type: "p",
              text: "Verwalten Sie Objekte für Eigentümer, benötigen diese regelmäßig eine nachvollziehbare Übersicht über Einnahmen, abgezogene Provision und Auszahlung ihrer Objekte für einen bestimmten Zeitraum — das Eigentümer-Statement fasst diese Daten automatisch zusammen.",
            },
            {
              type: "steps",
              items: [
                "Öffnen Sie im Konto den Bereich Eigentümer und wählen Sie den betroffenen Eigentümer aus.",
                "Wählen Sie den Abrechnungszeitraum, für den das Statement erstellt werden soll.",
                "Prüfen Sie, dass alle Objekte dieses Eigentümers korrekt zugeordnet sind, da nur zugeordnete Objekte in das Statement einfließen.",
                "Lassen Sie das Statement erzeugen und kontrollieren Sie die aufgeführten Reservierungen auf Vollständigkeit.",
                "Stellen Sie das Statement dem Eigentümer über den Eigentümer-Zugang bereit oder exportieren Sie es als Dokument.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Das Statement zeigt jede Reservierung mit Betrag in der jeweiligen Objektwährung — es gibt keinen pauschalen Währungs-Hinweis, da mehrere Objekte auch unterschiedliche Währungen führen können. Mehr zur Zuordnung unter [Objekt einem Eigentümer zuordnen](/hilfe/eigentuemer/objekt-eigentuemer-zuordnen).",
            },
          ],
        },
        {
          slug: "provision-abrechnen",
          title: "Provision mit dem Eigentümer abrechnen",
          excerpt: "So stellen Sie sicher, dass Ihre Provision korrekt aus den Einnahmen des Eigentümers berechnet wird.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "h2",
              text: "Ausgangslage",
            },
            {
              type: "p",
              text: "Ihre Provision für die Verwaltung eines Objekts ist im Tarif des Eigentümers hinterlegt und wird bei jedem Statement automatisch von den Bruttoeinnahmen abgezogen. Damit die Abrechnung stimmt, muss der Provisionssatz vor der ersten Buchung im Zeitraum korrekt gesetzt sein.",
            },
            {
              type: "steps",
              items: [
                "Öffnen Sie im Konto den Tarif des betroffenen Eigentümers und prüfen Sie den hinterlegten Provisionssatz.",
                "Passen Sie den Satz bei Bedarf an, bevor neue Reservierungen im kommenden Abrechnungszeitraum eingehen.",
                "Erzeugen Sie das Eigentümer-Statement für den Zeitraum und prüfen Sie, dass die Provision je Reservierung korrekt ausgewiesen wird.",
                "Kontrollieren Sie die Summe aus Bruttoeinnahmen, abgezogener Provision und Netto-Auszahlung auf Plausibilität.",
                "Klären Sie Abweichungen vor Freigabe des Statements direkt mit dem Eigentümer, statt das Statement nachträglich zu ändern.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Eine nachträgliche Änderung des Provisionssatzes wirkt nur auf künftige Zeiträume, nicht rückwirkend auf bereits erzeugte Statements. Prüfen Sie den Satz daher rechtzeitig vor Beginn eines neuen Abrechnungszeitraums — siehe auch [Eigentümer-Abrechnung (Statement)](/hilfe/eigentuemer/eigentuemer-abrechnung).",
            },
          ],
        },
      ],
    },
  ],
};

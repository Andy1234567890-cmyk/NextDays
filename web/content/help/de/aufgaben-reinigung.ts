import type { HelpCategory } from "../types";

export const aufgabenReinigung: HelpCategory = {
  slug: "aufgaben-reinigung",
  title: "Aufgaben & Reinigung",
  description: "Reinigungspläne und Team-Aufgaben organisieren.",
  icon: "ph:broom",
  collection: "kb",
  sections: [
    {
      heading: "Betrieb",
      articles: [
        {
          slug: "aufgaben-anlegen",
          title: "Aufgaben anlegen",
          excerpt: "So erstellen Sie eine neue Aufgabe für ein Objekt oder einen Zeitraum.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "p",
              text: "Aufgaben bündeln alles, was rund um ein Objekt erledigt werden muss — von der Reinigung nach dem Check-out bis zu Wartungsarbeiten oder Gästeanfragen. Jede Aufgabe hängt an genau einem Objekt und kann einem Teammitglied zugewiesen werden.",
            },
            { type: "h2", text: "Neue Aufgabe erstellen" },
            {
              type: "steps",
              items: [
                "Öffnen Sie den Bereich „Aufgaben“ im Hauptmenü.",
                "Klicken Sie auf „Neue Aufgabe“.",
                "Wählen Sie das betroffene Objekt aus.",
                "Vergeben Sie einen Titel und optional eine Beschreibung.",
                "Legen Sie Fälligkeitsdatum und -uhrzeit fest.",
                "Speichern Sie die Aufgabe.",
              ],
            },
            { type: "h2", text: "Aufgabentypen" },
            {
              type: "p",
              text: "Neben freien Aufgaben gibt es systemseitig erzeugte Aufgaben, etwa automatisch geplante Reinigungen nach einem Check-out. Diese sind bereits mit dem Objekt und dem passenden Zeitfenster verknüpft und müssen nur noch einem Teammitglied zugewiesen werden.",
            },
            {
              type: "ul",
              items: [
                "Manuelle Aufgabe: frei erfasst, z. B. Wartung oder Sonderwunsch.",
                "Automatische Reinigungsaufgabe: aus dem Check-out-Datum abgeleitet.",
                "Wiederkehrende Aufgabe: für regelmäßige Kontrollen oder Inspektionen.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Details zur automatischen Zeitplanung finden Sie unter [Reinigungspläne](/hilfe/aufgaben-reinigung/reinigungsplaene).",
            },
            {
              type: "note",
              variant: "tip",
              text: "Vergeben Sie präzise Titel — Teammitglieder sehen in der mobilen Ansicht oft nur den Titel und das Objekt auf einen Blick.",
            },
          ],
        },
        {
          slug: "reinigungsplaene",
          title: "Reinigungspläne",
          excerpt: "Reinigungen nach dem Check-out automatisch planen lassen.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "p",
              text: "Ein Reinigungsplan sorgt dafür, dass nach jedem Check-out automatisch eine Reinigungsaufgabe für das betroffene Objekt entsteht — ohne dass Sie jede Buchung einzeln nachverfolgen müssen. Das reduziert vergessene Übergaben und sorgt für einen verlässlichen Ablauf zwischen zwei Aufenthalten.",
            },
            { type: "h2", text: "Automatische Planung aktivieren" },
            {
              type: "steps",
              items: [
                "Öffnen Sie das Objekt und wechseln Sie in den Tab „Reinigung“.",
                "Aktivieren Sie „Reinigung nach Check-out automatisch planen“.",
                "Legen Sie fest, wie viel Zeit nach dem Check-out für die Reinigung eingeplant wird.",
                "Bestimmen Sie optional ein Standard-Team oder eine Standardreinigungskraft.",
                "Speichern Sie die Einstellung.",
              ],
            },
            { type: "h2", text: "Zusammenspiel mit dem Kalender" },
            {
              type: "p",
              text: "Sobald eine Buchung storniert oder verschoben wird, passt sich die zugehörige Reinigungsaufgabe automatisch an das neue Check-out-Datum an. So bleibt der Reinigungsplan immer mit dem tatsächlichen Belegungsstand synchron.",
            },
            {
              type: "ul",
              items: [
                "Reinigung entsteht automatisch bei jedem Check-out mit aktivem Plan.",
                "Verschiebt sich die Buchung, verschiebt sich die Reinigungsaufgabe mit.",
                "Storniert Gäste den Aufenthalt, wird die Reinigungsaufgabe entfernt.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Ohne aktivierten Reinigungsplan entstehen keine automatischen Aufgaben — legen Sie Reinigungen dann manuell unter [Aufgaben anlegen](/hilfe/aufgaben-reinigung/aufgaben-anlegen) an.",
            },
          ],
        },
        {
          slug: "aufgaben-zuweisen",
          title: "Aufgaben zuweisen",
          excerpt: "Aufgaben gezielt an Reinigungskräfte oder Teammitglieder vergeben.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "p",
              text: "Damit eine Aufgabe erledigt wird, weisen Sie sie einem konkreten Teammitglied zu — etwa einer Reinigungskraft oder einem Mitarbeiter mit Wartungszuständigkeit. Nur die zugewiesene Person sieht die Aufgabe standardmäßig in ihrer eigenen Übersicht.",
            },
            { type: "h2", text: "Aufgabe manuell zuweisen" },
            {
              type: "steps",
              items: [
                "Öffnen Sie die Aufgabe in der Liste „Aufgaben“.",
                "Klicken Sie auf „Zuweisen“.",
                "Wählen Sie das zuständige Teammitglied aus der Liste aus.",
                "Bestätigen Sie die Zuweisung.",
              ],
            },
            { type: "h2", text: "Zuweisung nach Objekt" },
            {
              type: "p",
              text: "Ist einer Reinigungskraft bereits ein Objekt fest zugeordnet, können Sie Aufgaben für dieses Objekt auch automatisch dieser Person zuweisen lassen. Das spart bei wiederkehrenden Reinigungen Klicks und reduziert Rückfragen.",
            },
            {
              type: "ul",
              items: [
                "Manuelle Zuweisung: Sie wählen die Person je Aufgabe selbst aus.",
                "Feste Objektzuordnung: neue Aufgaben für dieses Objekt gehen automatisch an die hinterlegte Person.",
                "Eine Aufgabe hat immer genau eine zuständige Person.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Reinigungskräfte und Mitarbeiter sehen ausschließlich ihre eigenen zugewiesenen Aufgaben, keine Finanz- oder Vertriebsdaten des Objekts.",
            },
          ],
        },
        {
          slug: "aufgaben-status",
          title: "Aufgaben-Status verfolgen",
          excerpt: "Den Bearbeitungsstand von Aufgaben in Echtzeit im Blick behalten.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "p",
              text: "Jede Aufgabe durchläuft einen klaren Status — von offen über in Bearbeitung bis abgeschlossen. So sehen Sie jederzeit, ob eine Reinigung oder Wartung rechtzeitig vor dem nächsten Check-in fertig wird.",
            },
            { type: "h2", text: "Status-Übersicht" },
            {
              type: "ul",
              items: [
                "Offen: Aufgabe ist erstellt, aber noch nicht begonnen.",
                "In Bearbeitung: die zugewiesene Person hat die Aufgabe gestartet.",
                "Abgeschlossen: die Aufgabe ist erledigt und bestätigt.",
              ],
            },
            { type: "h2", text: "Status aktualisieren" },
            {
              type: "steps",
              items: [
                "Öffnen Sie die Aufgabe aus der Liste „Aufgaben“.",
                "Wählen Sie den passenden Status, z. B. „In Bearbeitung“ oder „Abgeschlossen“.",
                "Ergänzen Sie bei Bedarf eine kurze Notiz, etwa zu Auffälligkeiten im Objekt.",
                "Speichern Sie die Änderung.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Statusänderungen erscheinen sofort in der geteilten Aufgabenliste — ein manuelles Neuladen ist nicht nötig.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Ist eine Reinigung kurz vor dem nächsten Check-in noch offen, prüfen Sie zuerst die Zuweisung, bevor Sie den Gast kontaktieren.",
            },
          ],
        },
      ],
    },
  ],
};

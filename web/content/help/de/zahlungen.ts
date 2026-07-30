import type { HelpCategory } from "../types";

export const zahlungen: HelpCategory = {
  slug: "zahlungen",
  title: "Zahlungen & Rechnungen",
  description: "Zahlungsanbieter, Zahlungsregeln und Rechnungen.",
  icon: "ph:credit-card",
  collection: "kb",
  sections: [
    {
      heading: "Zahlungen",
      articles: [
        {
          slug: "zahlungsanbieter-verbinden",
          title: "Zahlungsanbieter verbinden",
          excerpt:
            "So verbinden Sie Stripe oder PayPal mit myNextDays, um Zahlungen automatisch abzuwickeln.",
          updated: "Stand: Juli 2026",
          body: [
            { type: "h2", text: "Verfügbare Anbieter" },
            {
              type: "p",
              text: "myNextDays wickelt Zahlungen über verbundene Zahlungsanbieter ab. Aktuell unterstützt werden Stripe und PayPal — Sie können einen oder beide Anbieter gleichzeitig verbinden und je nach Objekt oder Gastwunsch nutzen.",
            },
            {
              type: "steps",
              items: [
                "Öffnen Sie Konto und wechseln Sie zum Abschnitt „Zahlungen“.",
                "Wählen Sie den gewünschten Anbieter — Stripe oder PayPal.",
                "Folgen Sie dem Verbindungsdialog und melden Sie sich beim Anbieter an oder legen Sie ein neues Konto an.",
                "Bestätigen Sie die Verbindung — der Status wechselt auf „verbunden“.",
              ],
            },
            { type: "h2", text: "Was danach passiert" },
            {
              type: "p",
              text: "Sobald ein Anbieter verbunden ist, können Sie Zahlungslinks versenden, Anzahlungen einziehen und Rückerstattungen direkt aus der Buchung auslösen. Alle Beträge werden in der für das jeweilige Objekt hinterlegten Währung verarbeitet.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Ohne verbundenen Anbieter können Sie Zahlungen nur manuell als erhalten markieren — eine automatische Abbuchung ist dann nicht möglich.",
            },
            { type: "h2", text: "Mehrere Objekte, ein Anbieter" },
            {
              type: "p",
              text: "Eine einmal hergestellte Verbindung gilt kontoweit für alle Ihre Objekte. Wie die Abbuchung im Detail abläuft, legen Sie über [Zahlungsregeln](/hilfe/zahlungen/zahlungsregeln) fest. Auszahlungen an Sie erfolgen anschließend über den jeweiligen Anbieter, siehe [Auszahlungen](/hilfe/zahlungen/auszahlungen).",
            },
            {
              type: "ul",
              items: [
                "Stripe eignet sich für Kartenzahlungen und viele lokale Zahlarten",
                "PayPal bietet Gästen eine vertraute Alternative",
                "Beide Anbieter lassen sich unabhängig voneinander trennen und neu verbinden",
              ],
            },
          ],
        },
        {
          slug: "zahlungsregeln",
          title: "Zahlungsregeln",
          excerpt: "Legen Sie fest, wann Anzahlung und Restzahlung einer Buchung fällig werden.",
          updated: "Stand: Juli 2026",
          body: [
            { type: "h2", text: "Anzahlung und Restzahlung" },
            {
              type: "p",
              text: "Zahlungsregeln bestimmen, wie eine Buchung finanziell abgewickelt wird — zum Beispiel eine Anzahlung bei der Buchung und eine Restzahlung vor Anreise, oder die volle Zahlung sofort. Die Regeln gelten pro Objekt und lassen sich jederzeit anpassen.",
            },
            {
              type: "steps",
              items: [
                "Öffnen Sie das Objekt und wechseln Sie zum Abschnitt „Zahlungsregeln“.",
                "Wählen Sie, ob eine Anzahlung erhoben wird, und legen Sie den Anteil fest.",
                "Bestimmen Sie, wann die Restzahlung fällig wird, zum Beispiel eine bestimmte Anzahl Tage vor Anreise.",
                "Speichern Sie die Einstellungen.",
              ],
            },
            { type: "h2", text: "Automatischer Einzug" },
            {
              type: "p",
              text: "Ist ein Zahlungsanbieter verbunden, zieht myNextDays Anzahlung und Restzahlung automatisch zum hinterlegten Zeitpunkt ein und informiert den Gast vorab per Nachricht.",
            },
            {
              type: "note",
              variant: "info",
              text: "Zahlungsregeln wirken nur bei Buchungen mit verbundenem Zahlungsanbieter. Ohne Anbieter markieren Sie Zahlungen manuell in der Buchung.",
            },
            { type: "h2", text: "Unterschiede je Kanal" },
            {
              type: "p",
              text: "Auf Portalen kann abweichend deren eigene Zahlungsabwicklung gelten — prüfen Sie in diesem Fall die jeweiligen Portalbedingungen. Für Buchungen über die eigene Plattform oder Website greifen immer Ihre hier hinterlegten Regeln. Details zur Anbieteranbindung finden Sie unter [Zahlungsanbieter verbinden](/hilfe/zahlungen/zahlungsanbieter-verbinden), zur Rechnungsstellung unter [Rechnungen erstellen](/hilfe/zahlungen/rechnungen-erstellen).",
            },
            {
              type: "ul",
              items: [
                "Anzahlung als fester Betrag oder Prozentsatz möglich",
                "Restzahlungsfrist frei wählbar",
                "Änderungen wirken erst auf neue Buchungen, nicht rückwirkend",
              ],
            },
          ],
        },
        {
          slug: "rechnungen-erstellen",
          title: "Rechnungen erstellen",
          excerpt: "So erstellen Sie zu einer Buchung eine Rechnung mit korrekter Rechnungsadresse.",
          updated: "Stand: Juli 2026",
          body: [
            { type: "h2", text: "Rechnung anlegen" },
            {
              type: "p",
              text: "Zu jeder Buchung lässt sich eine Rechnung erstellen — für den Gast selbst oder für ein abweichendes Unternehmen, falls die Buchung geschäftlich erfolgt.",
            },
            {
              type: "steps",
              items: [
                "Öffnen Sie die Buchung in Reservierungen.",
                "Wählen Sie „Rechnung erstellen“.",
                "Prüfen oder ergänzen Sie die Rechnungsadresse.",
                "Prüfen Sie die aufgeführten Positionen — Übernachtung, Add-ons, Gebühren.",
                "Erstellen Sie die Rechnung und versenden Sie sie an den Gast.",
              ],
            },
            { type: "h2", text: "Rechnungsadresse pflegen" },
            {
              type: "p",
              text: "Die Rechnungsadresse können Sie direkt in der Buchung hinterlegen oder vom Gast über die Buchungsbestätigung nachreichen lassen. Ohne vollständige Adresse lässt sich in bestimmten Ländern keine rechtsgültige Rechnung ausstellen.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Prüfen Sie bei Geschäftskunden insbesondere Firmenname und Anschrift — nachträgliche Korrekturen erfordern eine Korrekturrechnung.",
            },
            { type: "h2", text: "Beträge und Währung" },
            {
              type: "p",
              text: "Alle Positionen werden in der für das Objekt hinterlegten Währung ausgewiesen. Bereits erfolgte Zahlungen werden auf der Rechnung als Zahlungseingang vermerkt. Wie Anzahlung und Restzahlung zustande kommen, lesen Sie unter [Zahlungsregeln](/hilfe/zahlungen/zahlungsregeln).",
            },
            {
              type: "ul",
              items: [
                "Rechnungen lassen sich als PDF herunterladen",
                "Korrekturrechnungen sind bei Änderungen jederzeit möglich",
                "Add-ons erscheinen als eigene Position",
              ],
            },
          ],
        },
        {
          slug: "rueckerstattungen",
          title: "Rückerstattungen",
          excerpt:
            "So erstatten Sie eine Zahlung ganz oder teilweise zurück, wenn eine Buchung storniert oder geändert wird.",
          updated: "Stand: Juli 2026",
          body: [
            { type: "h2", text: "Wann eine Rückerstattung nötig ist" },
            {
              type: "p",
              text: "Eine Rückerstattung fällt typischerweise bei einer Stornierung an, kann aber auch bei einer nachträglichen Preisanpassung oder einem stornierten Add-on nötig sein.",
            },
            {
              type: "steps",
              items: [
                "Öffnen Sie die betroffene Buchung in Reservierungen.",
                "Wählen Sie „Rückerstattung“ im Zahlungsbereich der Buchung.",
                "Geben Sie den zu erstattenden Betrag ein — vollständig oder teilweise.",
                "Bestätigen Sie die Rückerstattung.",
              ],
            },
            { type: "h2", text: "Ablauf über den Zahlungsanbieter" },
            {
              type: "p",
              text: "Die Rückerstattung wird über den bei der Zahlung genutzten Anbieter — Stripe oder PayPal — ausgeführt und direkt an das ursprüngliche Zahlungsmittel des Gastes zurücküberwiesen. Der Vorgang wird automatisch in der Buchungs-Zeitleiste vermerkt.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Ohne verbundenen Zahlungsanbieter lässt sich eine Rückerstattung nicht automatisch auslösen — klären Sie die Rückzahlung in diesem Fall direkt mit dem Gast.",
            },
            { type: "h2", text: "Auswirkung auf Provisionen" },
            {
              type: "p",
              text: "Bereits abgerechnete Marktplatz- oder Portalprovisionen werden bei einer Rückerstattung anteilig angepasst. Mehr dazu unter [Provisionen verstehen](/hilfe/zahlungen/provisionen-verstehen). Details zur Stornierung selbst finden Sie unter [Stornierung & Rückerstattung](/hilfe/reservierungen/stornierung-rueckerstattung).",
            },
            {
              type: "ul",
              items: [
                "Teilrückerstattungen sind für einzelne Positionen möglich",
                "Der Bearbeitungsstatus ist in der Buchung jederzeit sichtbar",
                "Rückerstattungen laufen ausschließlich über den ursprünglich genutzten Anbieter",
              ],
            },
          ],
        },
        {
          slug: "auszahlungen",
          title: "Auszahlungen",
          excerpt:
            "So erhalten Sie die Erlöse Ihrer Buchungen von den verbundenen Zahlungsanbietern ausgezahlt.",
          updated: "Stand: Juli 2026",
          body: [
            { type: "h2", text: "Wie Auszahlungen funktionieren" },
            {
              type: "p",
              text: "Eingehende Zahlungen sammeln sich zunächst beim verbundenen Zahlungsanbieter. Von dort erfolgt die Auszahlung an Ihr hinterlegtes Bankkonto nach dem jeweils üblichen Rhythmus des Anbieters.",
            },
            {
              type: "steps",
              items: [
                "Öffnen Sie Konto und wechseln Sie zum Abschnitt „Zahlungen“.",
                "Prüfen Sie unter „Auszahlungen“ den Status des jeweiligen Anbieters.",
                "Öffnen Sie bei Bedarf die Detailansicht des Anbieters für die vollständige Auszahlungshistorie.",
              ],
            },
            { type: "h2", text: "Was vor der Auszahlung abgezogen wird" },
            {
              type: "p",
              text: "Vor der Auszahlung werden anfallende Marktplatz- und Portalprovisionen sowie Anbietergebühren berücksichtigt. Der ausgezahlte Betrag entspricht damit nicht zwangsläufig der ursprünglichen Buchungssumme.",
            },
            {
              type: "note",
              variant: "info",
              text: "Den genauen Aufbau der Abzüge erklärt [Provisionen verstehen](/hilfe/zahlungen/provisionen-verstehen).",
            },
            { type: "h2", text: "Mehrere Objekte und Eigentümer" },
            {
              type: "p",
              text: "Verwalten Sie Objekte für unterschiedliche Eigentümer, werden Auszahlungen entsprechend den hinterlegten Eigentümerabrechnungen zugeordnet. Prüfen Sie bei Unstimmigkeiten zunächst den Status der zugrunde liegenden Buchungen in Reservierungen.",
            },
            {
              type: "ul",
              items: [
                "Auszahlungsrhythmus und -methode bestimmt der jeweilige Anbieter",
                "Zurückgehaltene Beträge, etwa bei laufenden Rückerstattungen, sind gekennzeichnet",
                "Die vollständige Historie steht direkt beim Anbieter zur Einsicht bereit",
              ],
            },
          ],
        },
        {
          slug: "provisionen-verstehen",
          title: "Provisionen verstehen",
          excerpt:
            "Ein Überblick, wie sich Marktplatz- und Portalprovisionen zusammensetzen und wo sie abgerechnet werden.",
          updated: "Stand: Juli 2026",
          body: [
            { type: "h2", text: "Zwei Arten von Provisionen" },
            {
              type: "p",
              text: "Bei Buchungen über myNextDays können zwei unterschiedliche Provisionen anfallen: die Marktplatzprovision für Buchungen über die eigene Plattform sowie Portalprovisionen für Buchungen, die über angebundene Portale wie Booking oder Airbnb eingehen. Beide sind unabhängig voneinander und können je nach Vertriebsweg einer Buchung unterschiedlich ausfallen.",
            },
            {
              type: "ul",
              items: [
                "Marktplatzprovision: fällt bei Buchungen über die myNextDays-Plattform an",
                "Portalprovision: wird vom jeweiligen Portal gemäß dessen eigenen Konditionen berechnet",
                "Direktbuchungen über Ihre eigene Website sind davon unabhängig zu betrachten",
              ],
            },
            { type: "h2", text: "Wo Provisionen sichtbar sind" },
            {
              type: "steps",
              items: [
                "Öffnen Sie Konto und wechseln Sie zum Abschnitt „Abrechnung“.",
                "Wählen Sie den gewünschten Monat.",
                "Prüfen Sie die Aufstellung je Buchung mit zugehöriger Provision.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Über welchen Kanal eine Buchung einging, sehen Sie direkt an der Buchung selbst — das erklärt, welche Provision jeweils angesetzt wurde.",
            },
            { type: "h2", text: "Zusammenhang mit Auszahlungen" },
            {
              type: "p",
              text: "Provisionen werden vor der Auszahlung von der Buchungssumme abgezogen. Details zum Auszahlungsvorgang finden Sie unter [Auszahlungen](/hilfe/zahlungen/auszahlungen). Bei einer Rückerstattung wird die zugehörige Provision anteilig korrigiert — den vollständigen Ablauf einer Buchung zeigt die [Buchungs-Zeitleiste](/hilfe/reservierungen/buchungs-zeitleiste).",
            },
          ],
        },
      ],
    },
  ],
};

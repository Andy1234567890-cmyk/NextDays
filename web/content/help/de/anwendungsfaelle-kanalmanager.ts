import type { HelpCategory } from "../types";

export const ucKanalmanager: HelpCategory = {
  slug: "anwendungsfaelle-kanalmanager",
  title: "Kanalmanager",
  description: "Portale und Kanalmanager meistern.",
  icon: "ph:share-network",
  collection: "usecases",
  sections: [
    {
      heading: "Kanalmanager",
      articles: [
        {
          slug: "erstes-portal-verbinden",
          title: "Ihr erstes Portal verbinden",
          excerpt: "So schalten Sie zum ersten Mal ein Portal für ein Objekt frei.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "h2",
              text: "Ausgangslage: Sie haben ein Objekt angelegt, aber noch kein Portal verbunden",
            },
            {
              type: "p",
              text: "Ihr Objekt ist in myNextDays vollständig eingerichtet, aber noch auf keinem Portal wie Booking.com oder Airbnb sichtbar. Bevor ein Portal ein Objekt annimmt, braucht Ihr Konto einmalig eine kontoweite Portal-Verbindung — danach reicht für jedes weitere Objekt nur noch ein Mapping.",
            },
            {
              type: "steps",
              items: [
                "Öffnen Sie /konto, Abschnitt „Portale & Kanalmanager\", und richten Sie die kontoweite Verbindung mit Ihren Betriebsdaten ein",
                "Öffnen Sie danach das Objekt unter /objekte und wechseln Sie auf den Tab „Portale\"",
                "Wählen Sie das gewünschte Portal aus und ordnen Sie es dem passenden Zimmer- bzw. Angebotstyp zu",
                "Prüfen Sie Fotos, Ausstattung, Preise und Stornobedingungen — Portale verlangen vollständige Angaben",
                "Aktivieren Sie die Sichtbarkeit; der Status wechselt nach Prüfung durch das Portal auf „Verbunden\"",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Die kontoweite Verbindung richten Sie nur einmal ein. Details dazu unter [Booking.com anbinden](/hilfe/portale-kanalmanager/booking-verbinden) und [Airbnb anbinden](/hilfe/portale-kanalmanager/airbnb-verbinden).",
            },
          ],
        },
        {
          slug: "booking-anbinden",
          title: "Booking.com anbinden",
          excerpt: "So machen Sie ein Objekt über den Kanalmanager auf Booking.com buchbar.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "h2",
              text: "Ausgangslage: Ihr Objekt soll zusätzlich auf Booking.com sichtbar werden",
            },
            {
              type: "p",
              text: "Booking.com ist eines der Portale, die über den Kanalmanager angebunden werden. Voraussetzung ist die kontoweite Portal-Verbindung — ist diese bereits eingerichtet, brauchen Sie für Booking.com nur noch ein Mapping je Objekt.",
            },
            {
              type: "steps",
              items: [
                "Öffnen Sie das Objekt unter /objekte, Tab „Portale\"",
                "Wählen Sie „Booking.com\" aus der Liste der verfügbaren Portale",
                "Ordnen Sie den passenden Zimmer- bzw. Angebotstyp zu und bestätigen Sie mindestens eine Rate mit Preis und Stornobedingungen",
                "Hinterlegen Sie eine gültige Zahlungsmethode für die Provisionsabrechnung",
                "Aktivieren Sie die Sichtbarkeit für Booking.com",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Die Freischaltung durch Booking.com kann einige Stunden dauern. Der Status im Tab „Portale\" zeigt, sobald die Verbindung aktiv ist.",
            },
          ],
        },
        {
          slug: "airbnb-anbinden",
          title: "Airbnb anbinden",
          excerpt: "So machen Sie ein Objekt über den Kanalmanager auf Airbnb buchbar.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "h2",
              text: "Ausgangslage: Ihr Objekt soll zusätzlich auf Airbnb sichtbar werden",
            },
            {
              type: "p",
              text: "Airbnb wird wie jedes andere Portal über die kontoweite Verbindung angebunden. Ist diese eingerichtet, aktivieren Sie Airbnb pro Objekt über ein Mapping — unabhängig davon, ob das Objekt bereits auf Booking.com oder anderen Portalen sichtbar ist.",
            },
            {
              type: "steps",
              items: [
                "Öffnen Sie das Objekt unter /objekte, Tab „Portale\"",
                "Wählen Sie „Airbnb\" aus der Liste der verfügbaren Portale",
                "Bestätigen Sie Objektkategorie und zugeordneten Angebotstyp",
                "Ergänzen Sie Fotos, Ausstattung und Hausregeln — Airbnb verlangt vollständige Angaben vor der Freischaltung",
                "Aktivieren Sie die Sichtbarkeit für Airbnb",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Ohne hinterlegte Stornobedingungen und Hausordnung lehnt Airbnb die Freischaltung ab. Ergänzen Sie diese Angaben zuerst im Objekt.",
            },
          ],
        },
        {
          slug: "preise-synchron-halten",
          title: "Preise über alle Portale synchron halten",
          excerpt: "Ein Kalender genügt — der Kanalmanager verteilt Preisänderungen automatisch an alle Portale.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "h2",
              text: "Ausgangslage: Sie ändern einen Preis und möchten sicherstellen, dass er überall stimmt",
            },
            {
              type: "p",
              text: "Sie pflegen Preise ausschließlich im myNextDays-Kalender des Objekts — niemals einzeln in den Portalen selbst. Der Kanalmanager überträgt jede Änderung automatisch an alle Portale, für die das Objekt aktiv gemappt ist.",
            },
            {
              type: "steps",
              items: [
                "Öffnen Sie den Preiskalender bzw. die Ratenpläne des Objekts",
                "Passen Sie den Tagespreis, Mindestaufenthalt oder die An-/Abreisebeschränkung an",
                "Speichern Sie die Änderung — sie wirkt zuerst intern im Objekt",
                "Prüfen Sie im Tab „Portale\", dass alle gewünschten Portale weiterhin aktiv gemappt sind",
                "Warten Sie wenige Minuten, bis die Änderung an die Portale übertragen ist",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Tragen Sie Preise niemals direkt im Portal ein — solche Änderungen werden beim nächsten Abgleich vom myNextDays-Kalender überschrieben.",
            },
          ],
        },
        {
          slug: "portal-buchung-importieren",
          title: "Eine Portal-Buchung importieren",
          excerpt: "Portal-Buchungen landen automatisch im Kalender — hier prüfen Sie, dass der Import geklappt hat.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "h2",
              text: "Ausgangslage: Ein Gast hat über ein Portal gebucht, die Buchung soll in myNextDays ankommen",
            },
            {
              type: "p",
              text: "Bucht ein Gast über Booking.com, Airbnb oder ein anderes verbundenes Portal, importiert der Kanalmanager die Reservierung automatisch — Sie müssen nichts manuell übertragen. Dieser Ablauf beschreibt, wie Sie den Import nachvollziehen und bestätigen.",
            },
            {
              type: "steps",
              items: [
                "Öffnen Sie den Kalender oder die Reservierungsliste des betroffenen Objekts",
                "Suchen Sie die neue Reservierung — sie trägt ein Herkunfts-Badge des Portals, etwa Booking.com oder Airbnb",
                "Prüfen Sie Gastdaten, Zeitraum und Preis auf Vollständigkeit",
                "Kontrollieren Sie, dass die gebuchten Nächte auf allen anderen Kanälen als gesperrt angezeigt werden",
                "Öffnen Sie bei Bedarf die Buchungsdetails, um Zusatzleistungen oder Nachrichten des Gasts zu bearbeiten",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Storniert der Gast über das Portal oder ändert den Zeitraum, wird das ebenfalls automatisch übernommen und die Nächte werden wieder freigegeben.",
            },
          ],
        },
        {
          slug: "doppelbuchung-loesen",
          title: "Eine Doppelbuchung auflösen",
          excerpt: "So gehen Sie vor, wenn dieselbe Nacht ausnahmsweise auf zwei Kanälen verkauft wurde.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "h2",
              text: "Ausgangslage: Zwei Reservierungen überschneiden sich für dasselbe Objekt und dieselben Nächte",
            },
            {
              type: "p",
              text: "Der Kanalmanager sperrt gebuchte Nächte normalerweise sofort kanalübergreifend. Eine Doppelbuchung kann trotzdem entstehen, etwa bei zeitgleichen Buchungen auf zwei Portalen im selben Moment oder bei einer manuell angelegten Reservierung, die mit einer Portal-Buchung kollidiert.",
            },
            {
              type: "steps",
              items: [
                "Öffnen Sie den Kalender des Objekts und identifizieren Sie beide sich überschneidenden Reservierungen",
                "Prüfen Sie Buchungszeitpunkt und Herkunfts-Badge beider Reservierungen",
                "Kontaktieren Sie den zuletzt eingegangenen Gast und bieten Sie ein Ausweichobjekt oder einen alternativen Zeitraum an",
                "Stornieren Sie die nicht haltbare Reservierung im jeweiligen Portal, nicht nur in myNextDays",
                "Setzen Sie für die betroffenen Nächte anschließend Stop-Sell, bis der Fall vollständig geklärt ist",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Stornieren Sie eine Portal-Buchung immer über das Portal selbst — eine Stornierung nur in myNextDays gibt die Nacht zwar intern frei, informiert das Portal aber nicht zuverlässig.",
            },
          ],
        },
        {
          slug: "portal-pausieren",
          title: "Ein Portal vorübergehend pausieren",
          excerpt: "Sichtbarkeit pro Portal einzeln abschalten, ohne das Mapping zu verlieren.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "h2",
              text: "Ausgangslage: Ein Objekt soll auf einem Portal vorübergehend nicht buchbar sein",
            },
            {
              type: "p",
              text: "Die Sichtbarkeit ist pro Portal einzeln schaltbar — unabhängig von Website und Plattform-Marktplatz. Möchten Sie zum Beispiel Airbnb kurzzeitig pausieren, aber Booking.com weiterlaufen lassen, deaktivieren Sie ausschließlich diesen einen Kanal.",
            },
            {
              type: "steps",
              items: [
                "Öffnen Sie das Objekt unter /objekte, Tab „Portale\"",
                "Suchen Sie den Eintrag des Portals, das Sie pausieren möchten",
                "Schalten Sie die Sichtbarkeit für dieses Portal aus",
                "Speichern Sie — die Änderung wirkt innerhalb weniger Minuten, das Objekt verschwindet aus den Suchergebnissen dieses Portals",
                "Schalten Sie die Sichtbarkeit wieder ein, sobald das Objekt erneut buchbar sein soll",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Das Mapping bleibt beim Pausieren erhalten — Sie müssen die Zuordnung zum Portal später nicht neu einrichten. Für ein komplettes Sperren aller Kanäle nutzen Sie stattdessen Stop-Sell.",
            },
          ],
        },
        {
          slug: "mapping-pruefen",
          title: "Das Objekt-Mapping prüfen",
          excerpt: "So kontrollieren Sie, ob Ihr Objekt noch korrekt dem richtigen Angebotstyp im Portal zugeordnet ist.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "h2",
              text: "Ausgangslage: Preise oder Verfügbarkeit stimmen auf einem Portal nicht mehr mit myNextDays überein",
            },
            {
              type: "p",
              text: "Weicht die Anzeige im Portal von Ihrem myNextDays-Kalender ab, liegt die Ursache häufig an einem fehlerhaften oder unterbrochenen Mapping — der Verknüpfung zwischen Ihrem Objekt und dem Zimmer- bzw. Angebotstyp im Portal.",
            },
            {
              type: "steps",
              items: [
                "Öffnen Sie das Objekt unter /objekte, Tab „Portale\"",
                "Prüfen Sie den Status des betroffenen Portals — er sollte „Verbunden\" anzeigen, nicht „Fehler\" oder „Ausstehend\"",
                "Kontrollieren Sie, ob der zugeordnete Zimmer- bzw. Angebotstyp im Portal noch dem tatsächlichen Objekt entspricht",
                "Bei Abweichung: Mapping trennen und neu zuordnen, danach die Sichtbarkeit erneut aktivieren",
                "Warten Sie nach der Korrektur einige Minuten und prüfen Sie Preise und Verfügbarkeit erneut im Portal",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Ein Objekt kann mehreren Portalen gleichzeitig zugeordnet sein — prüfen Sie bei Unstimmigkeiten gezielt das eine betroffene Portal, nicht alle auf einmal.",
            },
          ],
        },
        {
          slug: "raten-je-portal",
          title: "Unterschiedliche Raten je Portal",
          excerpt: "Wie Sie einem Portal einen eigenen Ratenplan zuweisen, ohne die übrigen Kanäle zu beeinflussen.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "h2",
              text: "Ausgangslage: Sie möchten auf einem Portal einen anderen Preis anbieten als auf den übrigen Kanälen",
            },
            {
              type: "p",
              text: "Ratenpläne lassen sich einzeln je Portal zuordnen, etwa ein nicht stornierbarer Ratenplan für ein Portal und ein flexibler für ein anderes. Die Grundpreise bleiben zentral im Objekt gepflegt, das Mapping bestimmt, welcher Ratenplan an welches Portal geht.",
            },
            {
              type: "steps",
              items: [
                "Legen Sie im Objekt den zusätzlichen Ratenplan mit den gewünschten Konditionen an (Preis, Stornobedingungen, Mindestaufenthalt)",
                "Öffnen Sie den Tab „Portale\" und wählen Sie das betroffene Portal",
                "Ordnen Sie im Mapping den neuen Ratenplan diesem Portal zu",
                "Lassen Sie die übrigen Portale unverändert auf ihrem bisherigen Ratenplan",
                "Speichern Sie und prüfen Sie nach wenigen Minuten die Preisanzeige im jeweiligen Portal",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Jeder Ratenplan wird unabhängig übertragen — eine Änderung an einem Ratenplan wirkt sich nicht auf Portale aus, die einem anderen Ratenplan zugeordnet sind.",
            },
          ],
        },
        {
          slug: "portal-fehler-beheben",
          title: "Häufige Portal-Fehler beheben",
          excerpt: "Typische Ursachen, wenn ein Portal ein Objekt ablehnt oder die Synchronisierung stockt.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "h2",
              text: "Ausgangslage: Der Status eines Portals zeigt einen Fehler oder das Objekt wird nicht übernommen",
            },
            {
              type: "p",
              text: "Portale lehnen eine Verbindung meist wegen fehlender Stammdaten oder unvollständiger Objektangaben ab. Gehen Sie die häufigsten Ursachen der Reihe nach durch, bevor Sie den Support kontaktieren.",
            },
            {
              type: "steps",
              items: [
                "Prüfen Sie unter /konto, ob Adresse, Steuerinformationen und Kontaktdaten vollständig hinterlegt sind",
                "Kontrollieren Sie im Objekt, ob Beschreibung, Fotos, Ausstattung und mindestens eine Rate vollständig sind",
                "Prüfen Sie, ob eine gültige Zahlungsmethode für Provisionen hinterlegt ist",
                "Öffnen Sie den Tab „Portale\" und lesen Sie die genaue Fehlermeldung neben dem betroffenen Portal",
                "Beheben Sie die genannte Lücke und aktivieren Sie die Sichtbarkeit erneut",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Ein Portal-Fehler betrifft immer nur dieses eine Portal — die übrigen Kanäle laufen unabhängig davon weiter, solange deren eigene Anforderungen erfüllt sind.",
            },
          ],
        },
      ],
    },
  ],
};

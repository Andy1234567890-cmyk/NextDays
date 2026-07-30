import type { HelpCategory } from "../types";

export const portaleKanalmanager: HelpCategory = {
  slug: "portale-kanalmanager",
  title: "Portale & Kanalmanager",
  description: "Booking, Airbnb, Expedia & Co. zentral steuern.",
  icon: "ph:share-network",
  collection: "kb",
  sections: [
    {
      heading: "Portale verbinden",
      articles: [
        {
          slug: "was-ist-kanalmanager",
          title: "Was ist der Kanalmanager?",
          excerpt:
            "Der Kanalmanager gleicht Preise, Verfügbarkeit und Buchungen automatisch zwischen myNextDays und den Portalen ab.",
          updated: "Stand: Juli 2026",
          body: [
            { type: "h2", text: "Eine Verbindung für alle Portale" },
            {
              type: "p",
              text: "Der Kanalmanager ist die Brücke zwischen myNextDays und den großen Buchungsportalen wie Booking, Airbnb & Co. Statt in jedem Portal einzeln Preise, Verfügbarkeit und Belegung zu pflegen, tragen Sie alles einmal in myNextDays ein — der Kanalmanager verteilt es automatisch an alle verbundenen Portale.",
            },
            { type: "h2", text: "Was automatisch synchronisiert wird" },
            {
              type: "ul",
              items: [
                "Verfügbarkeit — jede Reservierung sperrt die Nacht sofort auf allen Portalen",
                "Preise und Mindestaufenthalte aus Ihrem Preiskalender",
                "Eingehende Portal-Buchungen werden automatisch in myNextDays importiert",
                "Stornierungen und Stop-Sell wirken kanalübergreifend",
              ],
            },
            { type: "h2", text: "Was Sie dadurch nicht mehr manuell tun müssen" },
            {
              type: "p",
              text: "Ohne Kanalmanager müssten Sie nach jeder Buchung händisch in jedem Portal die Nacht sperren — ein häufiger Grund für Doppelbuchungen. Mit aktivem Kanalmanager übernimmt myNextDays diesen Abgleich in beide Richtungen, mehrmals täglich und in Echtzeit bei neuen Buchungen.",
            },
            {
              type: "note",
              variant: "info",
              text: "Die Portal-Verbindung wird einmalig kontoweit eingerichtet. Für jedes einzelne Objekt aktivieren Sie danach nur noch das Mapping — mehr dazu unter [Objekt einem Portal zuordnen](/hilfe/portale-kanalmanager/objekt-portal-zuordnen).",
            },
          ],
        },
        {
          slug: "portal-verbindung",
          title: "Portal-Verbindung einrichten",
          excerpt:
            "Die Verbindung zu den Portalen richten Sie einmal kontoweit ein — nicht für jedes Objekt neu.",
          updated: "Stand: Juli 2026",
          body: [
            { type: "h2", text: "Einmalig für das ganze Konto" },
            {
              type: "p",
              text: "Die Anbindung an die Portale ist eine kontoweite Einstellung: Sie verbinden Ihr myNextDays-Konto genau einmal mit dem Kanalmanager. Alle Objekte, die Sie später anlegen, greifen automatisch auf diese eine Verbindung zurück — Sie müssen sie nicht je Objekt neu aufbauen.",
            },
            { type: "h2", text: "So richten Sie die Verbindung ein" },
            {
              type: "steps",
              items: [
                "Öffnen Sie /konto und wählen Sie den Abschnitt „Portale & Kanalmanager\"",
                "Klicken Sie auf „Verbindung einrichten\" und bestätigen Sie Ihre Betriebsdaten (Adresse, Kontakt, Rechtsform)",
                "Prüfen Sie die automatisch übernommenen Stammdaten — sie werden an alle Portale weitergegeben",
                "Schließen Sie die Einrichtung ab; der Status wechselt auf „Verbunden\"",
              ],
            },
            { type: "h2", text: "Nächster Schritt: Objekte zuordnen" },
            {
              type: "p",
              text: "Nach der einmaligen Einrichtung ist noch kein Objekt sichtbar — dafür ordnen Sie jedes Objekt einzeln einem Portal zu (Mapping) und verbinden die gewünschten Portale wie Booking.com oder Airbnb.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Ohne vollständige Stammdaten (Adresse, Steuerinformationen, Kontakt) lehnen die Portale die Verbindung ab. Prüfen Sie diese Angaben zuerst unter /konto.",
            },
          ],
        },
        {
          slug: "objekt-portal-zuordnen",
          title: "Objekt einem Portal zuordnen",
          excerpt:
            "Nach der kontoweiten Verbindung aktivieren Sie pro Objekt nur noch das Mapping zum jeweiligen Portal.",
          updated: "Stand: Juli 2026",
          body: [
            { type: "h2", text: "Mapping statt Neuverbindung" },
            {
              type: "p",
              text: "Ist die Portal-Verbindung einmal kontoweit eingerichtet, verbinden Sie jedes Objekt nur noch über ein sogenanntes Mapping: Sie legen fest, welches myNextDays-Objekt welchem Zimmer- bzw. Angebotstyp im Portal entspricht. Das ist pro Objekt ein einmaliger Schritt.",
            },
            { type: "h2", text: "So ordnen Sie ein Objekt zu" },
            {
              type: "steps",
              items: [
                "Öffnen Sie das Objekt unter /objekte und wechseln Sie auf den Tab „Portale\"",
                "Wählen Sie das gewünschte Portal, zum Beispiel Booking.com oder Airbnb",
                "Ordnen Sie das Objekt dem passenden Zimmer- bzw. Angebotstyp im Portal zu",
                "Aktivieren Sie die Synchronisierung — Preise und Verfügbarkeit werden ab sofort übertragen",
              ],
            },
            { type: "h2", text: "Ein Objekt, mehrere Portale" },
            {
              type: "p",
              text: "Ein einzelnes Objekt kann gleichzeitig mehreren Portalen zugeordnet sein. Jede Zuordnung ist unabhängig — Sie können ein Objekt zum Beispiel auf Booking.com und Airbnb sichtbar machen, auf Expedia aber vorerst deaktiviert lassen.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Prüfen Sie nach dem Mapping direkt die Sichtbarkeit — siehe [Sichtbarkeit pro Portal](/hilfe/portale-kanalmanager/sichtbarkeit-pro-portal).",
            },
          ],
        },
        {
          slug: "booking-verbinden",
          title: "Booking.com verbinden",
          excerpt: "So schalten Sie Booking.com als Vertriebskanal für ein Objekt frei.",
          updated: "Stand: Juli 2026",
          body: [
            { type: "h2", text: "Voraussetzung: kontoweite Verbindung" },
            {
              type: "p",
              text: "Bevor Sie Booking.com für ein Objekt aktivieren, muss die kontoweite Portal-Verbindung eingerichtet sein (siehe [Portal-Verbindung einrichten](/hilfe/portale-kanalmanager/portal-verbindung)). Danach ist Booking.com für jedes weitere Objekt nur noch eine Frage des Mappings.",
            },
            { type: "h2", text: "Booking.com aktivieren" },
            {
              type: "steps",
              items: [
                "Öffnen Sie das Objekt unter /objekte, Tab „Portale\"",
                "Wählen Sie „Booking.com\" aus der Liste der verfügbaren Portale",
                "Ordnen Sie den passenden Zimmer- bzw. Angebotstyp zu und bestätigen Sie die Ratenpläne",
                "Aktivieren Sie die Sichtbarkeit — das Objekt wird nach der Prüfung durch Booking.com live geschaltet",
              ],
            },
            { type: "h2", text: "Was Booking.com von Ihnen erwartet" },
            {
              type: "ul",
              items: [
                "Vollständige Objektbeschreibung, Bilder und Ausstattung",
                "Mindestens eine Rate mit Preis und Stornobedingungen",
                "Eine gültige Zahlungsmethode für Provisionen",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Die Freischaltung durch Booking.com kann einige Stunden dauern. Der Status im Objekt-Tab „Portale\" zeigt, ob die Verbindung bereits aktiv ist.",
            },
          ],
        },
        {
          slug: "airbnb-verbinden",
          title: "Airbnb verbinden",
          excerpt: "So machen Sie ein Objekt über den Kanalmanager auf Airbnb buchbar.",
          updated: "Stand: Juli 2026",
          body: [
            { type: "h2", text: "Airbnb als weiteres Portal" },
            {
              type: "p",
              text: "Airbnb wird wie jedes andere Portal über die kontoweite Verbindung angebunden. Ist diese eingerichtet, aktivieren Sie Airbnb pro Objekt über das Mapping — unabhängig davon, ob das Objekt bereits auf Booking.com oder anderen Portalen sichtbar ist.",
            },
            { type: "h2", text: "Airbnb für ein Objekt aktivieren" },
            {
              type: "steps",
              items: [
                "Öffnen Sie das Objekt unter /objekte, Tab „Portale\"",
                "Wählen Sie „Airbnb\" aus der Liste der verfügbaren Portale",
                "Bestätigen Sie die Objektkategorie und den zugeordneten Angebotstyp",
                "Prüfen Sie Fotos, Ausstattung und Hausregeln — Airbnb verlangt vollständige Angaben vor der Freischaltung",
                "Aktivieren Sie die Sichtbarkeit für Airbnb",
              ],
            },
            { type: "h2", text: "Nach der Aktivierung" },
            {
              type: "p",
              text: "Sobald Airbnb das Objekt freigegeben hat, laufen Preise und Verfügbarkeit automatisch über den Kanalmanager. Buchungen, die auf Airbnb eingehen, erscheinen anschließend automatisch in Ihrem Reservierungskalender.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Ohne hinterlegte Stornobedingungen und Hausordnung lehnt Airbnb die Freischaltung ab. Ergänzen Sie diese Angaben zuerst im Objekt.",
            },
          ],
        },
        {
          slug: "preise-verfuegbarkeit-sync",
          title: "Preise & Verfügbarkeit synchronisieren",
          excerpt:
            "Preise und Verfügbarkeit werden automatisch an alle verbundenen Portale übertragen.",
          updated: "Stand: Juli 2026",
          body: [
            { type: "h2", text: "Ein Kalender, alle Portale" },
            {
              type: "p",
              text: "Sie pflegen Preise und Verfügbarkeit ausschließlich im myNextDays-Kalender des jeweiligen Objekts. Der Kanalmanager überträgt jede Änderung automatisch an alle Portale, für die das Objekt aktiv gemappt ist — ohne dass Sie etwas doppelt eintragen.",
            },
            { type: "h2", text: "Was übertragen wird" },
            {
              type: "ul",
              items: [
                "Tagespreise aus Ihrem Preiskalender bzw. den Ratenplänen",
                "Verfügbare Nächte und Sperrungen",
                "Mindestaufenthalt und An-/Abreisebeschränkungen",
                "Stop-Sell-Tage — diese sperren automatisch auf allen Portalen",
              ],
            },
            { type: "h2", text: "Wie schnell die Synchronisierung wirkt" },
            {
              type: "p",
              text: "Änderungen an Preisen und Verfügbarkeit werden innerhalb weniger Minuten an die Portale weitergegeben. Neue Reservierungen sperren die betroffenen Nächte sofort, damit auf keinem anderen Kanal dieselbe Nacht erneut verkauft werden kann.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Mehr zum kanalübergreifenden Sperren einzelner Tage finden Sie unter [Überbuchungen vermeiden](/hilfe/portale-kanalmanager/ueberbuchungen-vermeiden).",
            },
          ],
        },
        {
          slug: "portal-buchungen-empfangen",
          title: "Portal-Buchungen empfangen",
          excerpt: "Buchungen aus Booking, Airbnb & Co. landen automatisch in Ihrem Kalender.",
          updated: "Stand: Juli 2026",
          body: [
            { type: "h2", text: "Automatischer Import" },
            {
              type: "p",
              text: "Bucht ein Gast über ein Portal wie Booking.com oder Airbnb, importiert der Kanalmanager die Reservierung automatisch in myNextDays. Sie müssen nichts manuell übertragen — die Buchung erscheint im Kalender und in der Reservierungsliste des betroffenen Objekts.",
            },
            { type: "h2", text: "Was bei einer Portal-Buchung passiert" },
            {
              type: "steps",
              items: [
                "Das Portal meldet die neue Buchung an den Kanalmanager",
                "myNextDays legt die Reservierung mit Gastdaten, Zeitraum und Preis an",
                "Die gebuchten Nächte werden sofort auf allen anderen Kanälen gesperrt",
                "Sie erhalten eine Benachrichtigung und finden die Buchung im Kalender",
              ],
            },
            { type: "h2", text: "Stornierungen und Änderungen" },
            {
              type: "p",
              text: "Storniert ein Gast über das Portal oder ändert der Gast den Zeitraum, wird das ebenfalls automatisch nach myNextDays übertragen und die betroffenen Nächte werden wieder freigegeben.",
            },
            {
              type: "note",
              variant: "info",
              text: "Portal-Buchungen sind an den Reservierungsdetails an ihrem Herkunfts-Badge erkennbar, zum Beispiel Booking.com oder Airbnb.",
            },
          ],
        },
        {
          slug: "ueberbuchungen-vermeiden",
          title: "Überbuchungen vermeiden",
          excerpt: "Stop-Sell und automatische Sperrungen verhindern Doppelbuchungen über mehrere Portale.",
          updated: "Stand: Juli 2026",
          body: [
            { type: "h2", text: "Warum Überbuchungen entstehen" },
            {
              type: "p",
              text: "Ohne zentrale Steuerung passiert es leicht, dass dieselbe Nacht auf zwei Portalen gleichzeitig verkauft wird — etwa wenn Preise und Verfügbarkeit manuell in mehreren Systemen gepflegt werden. Der Kanalmanager schließt diese Lücke, indem jede Buchung auf jedem Kanal sofort alle anderen Kanäle sperrt.",
            },
            { type: "h2", text: "Ihre Werkzeuge gegen Überbuchungen" },
            {
              type: "ul",
              items: [
                "Automatische Sperrung: Jede neue Reservierung — egal auf welchem Kanal — sperrt die Nächte überall",
                "Stop-Sell: Sperrt einen Tag manuell auf allen Kanälen gleichzeitig, etwa für Eigennutzung oder Wartung",
                "Mindestaufenthalt und Anreisebeschränkungen verhindern unpassende Kurzbuchungen",
              ],
            },
            { type: "h2", text: "Stop-Sell setzen" },
            {
              type: "steps",
              items: [
                "Öffnen Sie den Belegungskalender des Objekts",
                "Markieren Sie den betroffenen Tag oder Zeitraum",
                "Wählen Sie „Stop-Sell\" — der Tag ist danach auf allen Portalen sowie auf Website und Plattform gesperrt",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Stop-Sell gilt ausnahmslos für alle Kanäle. Es gibt keine Möglichkeit, einen Tag nur für ein einzelnes Portal zu sperren und für andere offen zu lassen.",
            },
          ],
        },
        {
          slug: "sichtbarkeit-pro-portal",
          title: "Sichtbarkeit pro Portal",
          excerpt: "Jedes Portal lässt sich unabhängig von Website und Plattform-Marktplatz ein- oder ausschalten.",
          updated: "Stand: Juli 2026",
          body: [
            { type: "h2", text: "Drei unabhängige Vertriebswege" },
            {
              type: "p",
              text: "Ein Objekt kann gleichzeitig über mehrere Wege verkauft werden: über die Portale (Booking, Airbnb & Co.), über den myNextDays-Plattform-Marktplatz und über Ihre eigene Website. Jeder Weg hat einen eigenen Sichtbarkeits-Schalter — sie sind vollständig unabhängig voneinander.",
            },
            { type: "h2", text: "Sichtbarkeit je Portal steuern" },
            {
              type: "p",
              text: "Innerhalb der Portale ist zusätzlich jedes einzelne Portal separat schaltbar. Ein Objekt kann zum Beispiel auf Booking.com aktiv, auf Airbnb aber deaktiviert sein — beide Zuordnungen bleiben davon unberührt bestehen.",
            },
            { type: "h2", text: "So ändern Sie die Sichtbarkeit" },
            {
              type: "steps",
              items: [
                "Öffnen Sie das Objekt unter /objekte, Tab „Portale\"",
                "Schalten Sie den gewünschten Kanal (einzelnes Portal, Website oder Plattform-Marktplatz) einzeln ein oder aus",
                "Speichern Sie — die Änderung wirkt innerhalb weniger Minuten",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Der Objekt-Status (aktiv/inaktiv) sowie Stop-Sell wirken übergeordnet auf alle Kanäle. Die Sichtbarkeits-Schalter steuern nur, auf welchen zusätzlichen Kanälen ein bereits aktives Objekt erscheint.",
            },
          ],
        },
      ],
    },
  ],
};

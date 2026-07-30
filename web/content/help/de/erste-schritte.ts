import type { HelpCategory } from "../types";

export const ersteSchritte: HelpCategory = {
  slug: "erste-schritte",
  title: "Erste Schritte",
  description: "Konto einrichten und in wenigen Minuten loslegen.",
  icon: "ph:rocket-launch",
  collection: "kb",
  sections: [
    {
      heading: "Einrichtung",
      articles: [
        {
          slug: "willkommen",
          title: "Willkommen bei myNextDays",
          excerpt: "Ein Überblick über PMS, Kanalmanager, Marktplatz und App.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "p",
              text: "myNextDays ist Ihre zentrale Plattform für Ferienobjekte und Hotels. Statt mehrerer Insellösungen verwalten Sie Verfügbarkeit, Preise, Reservierungen und Gästekommunikation an einem Ort — egal ob Sie ein einzelnes Ferienhaus oder mehrere Hotelzimmer betreiben.",
            },
            { type: "h2", text: "Die vier Bausteine" },
            {
              type: "ul",
              items: [
                "PMS (Property-Management-System): Objekte, Kalender, Preise, Reservierungen, Aufgaben und Zahlungen.",
                "Kanalmanager: Verbindung zu Portalen wie Booking, Airbnb & Co. — eine Eingabe, viele Portale synchron.",
                "Plattform-Marktplatz: der eigene myNextDays-Marktplatz, ein gleichrangiger Buchungskanal neben den Portalen.",
                "App: die mobile Anwendung für Gäste, Eigentümer und Mitarbeiter mit denselben Daten wie im Web.",
              ],
            },
            { type: "h2", text: "Wie die Bausteine zusammenspielen" },
            {
              type: "p",
              text: "Sie pflegen Objekt, Preise und Verfügbarkeit einmal zentral im PMS. Von dort verteilt myNextDays die Daten automatisch an alle aktiven Kanäle. Eine Buchung — egal über welchen Kanal sie hereinkommt — sperrt sofort die entsprechenden Nächte überall, sodass Doppelbuchungen ausgeschlossen sind.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Beginnen Sie mit Konto & Betrieb einrichten, danach Ihr erstes Objekt anlegen — die Reihenfolge spart Ihnen später Korrekturen.",
            },
            { type: "h2", text: "Nächste Schritte" },
            {
              type: "steps",
              items: [
                "Öffnen Sie im Menü Konto und ergänzen Sie Ihre Betriebsdaten.",
                "Legen Sie unter Objekte Ihr erstes Objekt an.",
                "Prüfen Sie Ausstattung, Fotos und Preise auf Vollständigkeit.",
                "Klicken Sie auf Veröffentlichen, um das Objekt auf allen Kanälen sichtbar zu machen.",
              ],
            },
            {
              type: "p",
              text: "Mehr zu den einzelnen Schritten finden Sie in [Konto & Betrieb einrichten](/hilfe/erste-schritte/konto-einrichten) und [Ihr erstes Objekt anlegen](/hilfe/erste-schritte/erstes-objekt).",
            },
          ],
        },
        {
          slug: "konto-einrichten",
          title: "Konto & Betrieb einrichten",
          excerpt: "Stammdaten, Rechnungsadresse und Währung korrekt hinterlegen.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "p",
              text: "Bevor Sie Objekte anlegen, richten Sie Ihren Betrieb im Konto ein. Diese Daten werden für Rechnungen, Portale und die Abrechnung mit myNextDays benötigt und sollten deshalb vollständig und korrekt sein.",
            },
            { type: "h2", text: "Stammdaten hinterlegen" },
            {
              type: "steps",
              items: [
                "Öffnen Sie im Menü Konto.",
                "Tragen Sie unter Stammdaten Firmenname bzw. Namen des Einzelunternehmens, Anschrift und Kontaktdaten ein.",
                "Hinterlegen Sie die Rechnungsadresse — sie erscheint auf allen ausgestellten Rechnungen.",
                "Wählen Sie Ihre Basiswährung. Diese gilt für alle Preise, bis Sie sie pro Objekt gezielt ändern.",
              ],
            },
            { type: "h2", text: "Warum die Währung wichtig ist" },
            {
              type: "p",
              text: "Die Währung wird nicht geraten oder automatisch ergänzt: Fehlt sie, kann kein Preis korrekt angezeigt oder abgerechnet werden. Deshalb verlangt myNextDays eine bewusste Auswahl beim Einrichten, statt einen Standardwert einzusetzen.",
            },
            {
              type: "note",
              variant: "warn",
              text: "Ändern Sie die Währung eines Objekts nachträglich, werden alle daran hängenden Preispläne mit umgestellt. Prüfen Sie Preise danach einmal gegen.",
            },
            { type: "h2", text: "Rechnungsadresse & Abrechnung" },
            {
              type: "p",
              text: "Unter Abrechnung im Konto sehen Sie Ihre laufenden Rechnungen und die hinterlegte Rechnungsadresse. Halten Sie diese aktuell, insbesondere bei einer Änderung der Rechtsform oder Anschrift, damit Rechnungen korrekt ausgestellt werden.",
            },
            {
              type: "ul",
              items: [
                "Firmenname bzw. Name des Einzelunternehmens",
                "Rechnungsanschrift mit Land",
                "Steuer- bzw. Umsatzsteuer-ID, sofern vorhanden",
                "Basiswährung für neue Objekte",
              ],
            },
          ],
        },
        {
          slug: "erstes-objekt",
          title: "Ihr erstes Objekt anlegen",
          excerpt: "So legen Sie Schritt für Schritt Ihr erstes buchbares Objekt an.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "p",
              text: "Ein Objekt in myNextDays ist immer genau eine buchbare Einheit: entweder ein einzelnes Zimmer in einem Hotel oder ein komplettes Ferienobjekt. Betreiben Sie ein Hotel mit mehreren Zimmern, legen Sie für jedes Zimmer ein eigenes Objekt an.",
            },
            { type: "h2", text: "Objekt anlegen" },
            {
              type: "steps",
              items: [
                "Öffnen Sie im Menü Objekte.",
                "Klicken Sie auf Objekt hinzufügen.",
                "Wählen Sie den Objekttyp: Kategorie, Immobilientyp und Angebotsart.",
                "Ergänzen Sie Adresse, Belegung und Basispreis in Ihrer hinterlegten Währung.",
                "Speichern Sie das Objekt als Entwurf, um es später zu vervollständigen.",
              ],
            },
            { type: "h2", text: "Was danach noch fehlt" },
            {
              type: "p",
              text: "Ein neu angelegtes Objekt ist zunächst ein Entwurf und auf keinem Kanal sichtbar. Ergänzen Sie Ausstattung, Fotos, Beschreibung und Kalenderverfügbarkeit, bevor Sie es veröffentlichen — nur ein vollständiges Objekt lässt sich verlässlich vermarkten.",
            },
            {
              type: "ul",
              items: [
                "Ausstattungsmerkmale aus der Kategorie-Liste auswählen",
                "Mindestens ein Titelfoto und eine Beschreibung hinterlegen",
                "Belegung (Erwachsene, Kinder, Betten) korrekt eintragen",
                "Basispreis und Kalenderverfügbarkeit prüfen",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Betreiben Sie mehrere Zimmertypen, wiederholen Sie diesen Vorgang für jedes einzelne Zimmer — es gibt keine übergeordnete Gebäude-Ebene mit Zimmern darunter.",
            },
            {
              type: "p",
              text: "Sind alle Pflichtfelder ausgefüllt, können Sie das Objekt veröffentlichen, siehe [Ein Objekt veröffentlichen](/hilfe/erste-schritte/objekt-veroeffentlichen).",
            },
          ],
        },
        {
          slug: "objekt-veroeffentlichen",
          title: "Ein Objekt veröffentlichen",
          excerpt: "Ein Klick schaltet Plattform-Marktplatz, Portale und Website gemeinsam frei.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "p",
              text: "Veröffentlichen macht ein Objekt sichtbar und buchbar. Im Normalfall genügt ein einziger Klick, um alle drei Vertriebskanäle gleichzeitig zu aktivieren — Sie können die Sichtbarkeit pro Kanal aber jederzeit einzeln anpassen.",
            },
            { type: "h2", text: "So veröffentlichen Sie" },
            {
              type: "steps",
              items: [
                "Öffnen Sie das Objekt unter Objekte.",
                "Prüfen Sie im Reiter Übersicht, ob alle Pflichtangaben grün markiert sind.",
                "Klicken Sie auf Veröffentlichen.",
                "Bestätigen Sie den Dialog — Plattform-Marktplatz, Portale und Website werden aktiviert.",
              ],
            },
            { type: "h2", text: "Kanäle einzeln steuern" },
            {
              type: "p",
              text: "Nach der Veröffentlichung finden Sie im Reiter Sichtbarkeit drei getrennte Schalter: Website, Plattform-Marktplatz und Portale. Möchten Sie ein Objekt beispielsweise nur auf Ihrer eigenen Website, aber nicht über Portale anbieten, deaktivieren Sie einfach den entsprechenden Schalter.",
            },
            {
              type: "ul",
              items: [
                "Website: Sichtbarkeit auf Ihrer eigenen myNextDays-Website",
                "Plattform-Marktplatz: Sichtbarkeit auf dem globalen myNextDays-Marktplatz",
                "Portale: Sichtbarkeit auf Booking, Airbnb & Co.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Diese drei Schalter sind unabhängig vom Objekt-Status (aktiv/inaktiv). Ein aktives Objekt kann trotzdem auf einzelnen Kanälen unsichtbar sein.",
            },
            { type: "h2", text: "Objekt vorübergehend sperren" },
            {
              type: "p",
              text: "Möchten Sie einen einzelnen Tag statt des ganzen Objekts sperren, nutzen Sie Stop-Sell im Kalender — das sperrt den Tag auf allen Kanälen gleichzeitig, unabhängig von den Sichtbarkeits-Schaltern.",
            },
          ],
        },
        {
          slug: "drei-vertriebskanaele",
          title: "Die drei Vertriebskanäle verstehen",
          excerpt: "Portale, Plattform-Marktplatz und App im Überblick.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "p",
              text: "myNextDays vermarktet jedes Objekt über mehrere gleichrangige Wege gleichzeitig. Zu verstehen, wie diese zusammenspielen, hilft Ihnen, Sichtbarkeit und Preise gezielt zu steuern.",
            },
            { type: "h2", text: "Portale" },
            {
              type: "p",
              text: "Über den Kanalmanager verbinden Sie Ihr Objekt mit großen Buchungsportalen wie Booking, Airbnb & Co. Verfügbarkeit und Preise werden automatisch synchronisiert, sodass Sie nicht mehrere Portal-Kalender manuell pflegen müssen.",
            },
            { type: "h2", text: "Plattform-Marktplatz" },
            {
              type: "p",
              text: "Der myNextDays-Marktplatz ist ein eigener, globaler Buchungskanal — vergleichbar mit Booking oder Airbnb, jedoch Teil derselben Plattform. Er ist kein „Direktbuchungs“-Ersatz, sondern ein gleichrangiger Kanal mit eigener Sichtbarkeits-Achse.",
            },
            { type: "h2", text: "App" },
            {
              type: "p",
              text: "Die mobile App bietet Gästen, Eigentümern und Mitarbeitern Zugriff auf dieselben Daten wie das Web — etwa Buchungsdetails, Nachrichten oder Aufgaben, abhängig von der jeweiligen Rolle.",
            },
            { type: "h2", text: "Drei getrennte Sichtbarkeits-Achsen" },
            {
              type: "ul",
              items: [
                "Website — Ihre eigene myNextDays-Website",
                "Plattform-Marktplatz — der globale myNextDays-Marktplatz",
                "Portale — Booking, Airbnb & Co. über den Kanalmanager",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Alle drei Achsen sind unabhängig voneinander schaltbar. Stop-Sell und der Objekt-Status wirken dagegen kanalübergreifend auf alle drei gleichzeitig.",
            },
          ],
        },
      ],
    },
  ],
};

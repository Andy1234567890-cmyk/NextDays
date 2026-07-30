import type { HelpCategory } from "../types";

export const kontoAbo: HelpCategory = {
  slug: "konto-abo",
  title: "Konto & Abonnement",
  description: "Stammdaten, Tarif, Sicherheit und 2FA.",
  icon: "ph:gear-six",
  collection: "kb",
  sections: [
    {
      heading: "Konto",
      articles: [
        {
          slug: "betriebsstammdaten",
          title: "Betriebsstammdaten",
          excerpt: "Firmenname, Anschrift und Kontaktdaten Ihres Betriebs zentral pflegen.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "p",
              text: "Unter /konto bündelt myNextDays alle Betriebs- und Kontofunktionen als Abschnitte auf einer Seite — Sie müssen nicht zwischen vielen Unterseiten wechseln. Die Betriebsstammdaten bilden dabei die Grundlage: Firmenname, Rechtsform, Anschrift und Kontaktdaten, die für Rechnungen, Portale und die Kommunikation mit Gästen verwendet werden.",
            },
            { type: "h2", text: "Stammdaten öffnen und bearbeiten" },
            {
              type: "steps",
              items: [
                "Öffnen Sie /konto.",
                "Wechseln Sie in den Abschnitt „Betriebsstammdaten“.",
                "Prüfen Sie Firmenname, Anschrift, Telefonnummer und E-Mail-Adresse für Rückfragen.",
                "Nehmen Sie Ihre Änderungen vor.",
                "Speichern Sie den Abschnitt.",
              ],
            },
            { type: "h2", text: "Warum diese Daten wichtig sind" },
            {
              type: "p",
              text: "Die Betriebsstammdaten fließen in Rechnungen, in die Registrierung bei angebundenen Portalen und in rechtlich verpflichtende Angaben wie das Impressum ein. Eine unvollständige oder veraltete Anschrift kann dazu führen, dass Rechnungen fehlerhaft ausgestellt oder Portalanbindungen verzögert werden.",
            },
            {
              type: "ul",
              items: [
                "Firmenname und Rechtsform erscheinen auf allen ausgestellten Rechnungen.",
                "Die Anschrift wird für die Registrierung bei Portalen benötigt.",
                "Kontaktdaten dienen als Rückfallweg, falls Systembenachrichtigungen nicht ankommen.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Ändern Sie Ihre Rechnungsanschrift, prüfen Sie anschließend die bereits ausgestellten Rechnungen unter [Abrechnung & Tarifrechner](/hilfe/konto-abo/abrechnung-tarifrechner) — bestehende Belege werden nicht rückwirkend angepasst.",
            },
          ],
        },
        {
          slug: "abonnement-tarif",
          title: "Abonnement & Tarif",
          excerpt: "Ihr Tarif bestimmt das Objektkontingent — die gebuchte Objektzahl sehen Sie jederzeit im Konto.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "p",
              text: "Ihr myNextDays-Abonnement umfasst ein Objektkontingent: die maximale Anzahl an Objekten (Zimmer oder Ferienobjekte), die Sie gleichzeitig aktiv verwalten können. Die aktuell gebuchte Objektzahl wird im Abschnitt „Abonnement & Tarif“ unter /konto angezeigt, zusammen mit dem verbleibenden Kontingent.",
            },
            { type: "h2", text: "Kontingent im Blick behalten" },
            {
              type: "p",
              text: "Das Kontingent wird serverseitig durchgesetzt: Erreichen Sie die Obergrenze Ihres Tarifs, lässt sich kein weiteres Objekt anlegen, bis Sie ein bestehendes Objekt deaktivieren oder Ihren Tarif erweitern. Das gilt unabhängig davon, ob das neue Objekt ein Zimmer oder ein Ferienobjekt ist — beides zählt gleich zum Kontingent.",
            },
            {
              type: "steps",
              items: [
                "Öffnen Sie /konto und den Abschnitt „Abonnement & Tarif“.",
                "Prüfen Sie die gebuchte Objektzahl im Verhältnis zum Kontingent Ihres Tarifs.",
                "Wählen Sie bei Bedarf einen größeren Tarif, um mehr Objekte anzulegen.",
                "Bestätigen Sie den Tarifwechsel.",
              ],
            },
            {
              type: "ul",
              items: [
                "Jedes Objekt zählt einzeln zum Kontingent, unabhängig vom Objekttyp.",
                "Ein Tarifwechsel wirkt sich sofort auf das verfügbare Kontingent aus.",
                "Ein Downgrade ist nur möglich, wenn die aktive Objektzahl zum neuen Kontingent passt.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Ein Downgrade auf einen Tarif mit kleinerem Kontingent wird abgelehnt, solange mehr Objekte aktiv sind, als der neue Tarif erlaubt. Deaktivieren Sie zuerst überzählige Objekte.",
            },
            {
              type: "note",
              variant: "info",
              text: "Details zu Rechnungen und der Tarifberechnung finden Sie unter [Abrechnung & Tarifrechner](/hilfe/konto-abo/abrechnung-tarifrechner).",
            },
          ],
        },
        {
          slug: "abrechnung-tarifrechner",
          title: "Abrechnung & Tarifrechner",
          excerpt: "Rechnungsadresse, bisherige Rechnungen und der Tarifrechner für Ihr Objektkontingent.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "p",
              text: "Der Abschnitt „Abrechnung & Tarifrechner“ unter /konto bündelt alles rund um die Rechnungsstellung: Ihre Rechnungsadresse, die Liste bisheriger Rechnungen zum Download sowie einen Tarifrechner, mit dem Sie die Kosten für Ihr aktuelles oder ein größeres Objektkontingent nachvollziehen können.",
            },
            { type: "h2", text: "Rechnungsadresse und Rechnungen" },
            {
              type: "p",
              text: "Die Rechnungsadresse kann von Ihrer Betriebsanschrift abweichen, etwa wenn eine Steuerkanzlei die Belege erhält. Bereits ausgestellte Rechnungen finden Sie chronologisch sortiert; jede lässt sich als PDF herunterladen.",
            },
            { type: "h2", text: "Tarifrechner nutzen" },
            {
              type: "steps",
              items: [
                "Öffnen Sie /konto und den Abschnitt „Abrechnung & Tarifrechner“.",
                "Geben Sie im Tarifrechner die gewünschte Objektzahl ein.",
                "Vergleichen Sie die resultierenden Kosten je Tarifstufe.",
                "Wechseln Sie bei Bedarf direkt aus dem Rechner in den passenden Tarif.",
              ],
            },
            {
              type: "ul",
              items: [
                "Der Tarifrechner zeigt die Kosten in der für Ihr Konto hinterlegten Währung.",
                "Rechnungen stehen dauerhaft zum Download bereit.",
                "Die Rechnungsadresse lässt sich unabhängig von den Betriebsstammdaten pflegen.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Vergleichen Sie mit dem Tarifrechner regelmäßig, ob Ihr Objektkontingent noch zur tatsächlich gebuchten Objektzahl passt — siehe [Abonnement & Tarif](/hilfe/konto-abo/abonnement-tarif).",
            },
          ],
        },
        {
          slug: "passwort-email-aendern",
          title: "Passwort & E-Mail ändern",
          excerpt: "Sicherheitskritische Änderungen verlangen eine erneute Anmeldung und einen Bestätigungsschritt.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "p",
              text: "Passwort und E-Mail-Adresse gehören zu den sicherheitskritischsten Angaben Ihres Kontos. myNextDays verlangt daher bei beiden Änderungen eine erneute Authentifizierung — Sie bestätigen die Änderung mit Ihrem aktuellen Passwort, auch wenn Sie bereits angemeldet sind.",
            },
            { type: "h2", text: "Passwort ändern" },
            {
              type: "steps",
              items: [
                "Öffnen Sie /konto und den Abschnitt „Passwort & E-Mail ändern“.",
                "Geben Sie Ihr aktuelles Passwort zur Bestätigung ein.",
                "Vergeben Sie das neue Passwort und wiederholen Sie es.",
                "Speichern Sie die Änderung.",
              ],
            },
            { type: "h2", text: "E-Mail-Adresse ändern" },
            {
              type: "p",
              text: "Der Wechsel der E-Mail-Adresse läuft als Doppel-Opt-in: Nach Bestätigung Ihres aktuellen Passworts erhalten Sie einen Bestätigungslink an die NEUE Adresse. Erst mit Klick auf diesen Link wird die Änderung wirksam — die alte Adresse bleibt bis dahin aktiv, damit der Zugriff auf Ihr Konto nie unterbrochen wird.",
            },
            {
              type: "ul",
              items: [
                "Ohne aktuelles Passwort lässt sich weder Passwort noch E-Mail ändern.",
                "Der Bestätigungslink für die neue E-Mail-Adresse ist zeitlich begrenzt gültig.",
                "Bis zur Bestätigung bleibt die bisherige E-Mail-Adresse für Anmeldung und Benachrichtigungen aktiv.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Prüfen Sie nach einer E-Mail-Änderung auch die Zwei-Faktor-Authentifizierung — siehe [Zwei-Faktor-Authentifizierung](/hilfe/konto-abo/zwei-faktor) — falls Wiederherstellungscodes an die alte Adresse gebunden waren.",
            },
          ],
        },
        {
          slug: "zwei-faktor",
          title: "Zwei-Faktor-Authentifizierung",
          excerpt: "Ein zusätzlicher Anmeldeschritt schützt Ihr Konto vor unbefugtem Zugriff.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "p",
              text: "Die Zwei-Faktor-Authentifizierung (2FA) ergänzt Ihr Passwort um einen zweiten Faktor über eine Authenticator-App. Damit reicht ein gestohlenes Passwort allein nicht mehr aus, um sich in Ihr myNextDays-Konto einzuloggen.",
            },
            { type: "h2", text: "2FA einrichten" },
            {
              type: "steps",
              items: [
                "Öffnen Sie /konto und den Abschnitt „Zwei-Faktor-Authentifizierung“.",
                "Bestätigen Sie Ihr aktuelles Passwort zur erneuten Authentifizierung.",
                "Scannen Sie den angezeigten QR-Code mit einer Authenticator-App.",
                "Geben Sie den generierten Code zur Bestätigung ein.",
                "Speichern Sie die angezeigten Wiederherstellungscodes an einem sicheren Ort.",
              ],
            },
            { type: "h2", text: "2FA deaktivieren" },
            {
              type: "p",
              text: "Auch das Deaktivieren der Zwei-Faktor-Authentifizierung verlangt eine erneute Authentifizierung mit Ihrem aktuellen Passwort. So verhindert myNextDays, dass jemand mit einer bereits offenen Sitzung Ihren Schutz einfach abschaltet.",
            },
            {
              type: "ul",
              items: [
                "Wiederherstellungscodes ermöglichen den Zugriff, falls die Authenticator-App verloren geht.",
                "Jeder Wiederherstellungscode ist nur einmal verwendbar.",
                "Ein- und Ausschalten der 2FA sind gleichermaßen an eine Passwortbestätigung gebunden.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Bewahren Sie Ihre Wiederherstellungscodes getrennt vom Gerät mit der Authenticator-App auf, etwa in einem Passwort-Manager.",
            },
          ],
        },
        {
          slug: "geraeteverlauf",
          title: "Geräteverlauf",
          excerpt: "Behalten Sie im Blick, von welchen Geräten aus Ihr Konto angemeldet ist.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "p",
              text: "Der Geräteverlauf unter /konto zeigt Ihnen, auf welchen Geräten Ihr Konto aktuell angemeldet ist — mit Gerätetyp, ungefährem Standort und Zeitpunkt der letzten Aktivität. So erkennen Sie schnell, ob eine Anmeldung tatsächlich von Ihnen stammt.",
            },
            { type: "h2", text: "Geräteverlauf prüfen" },
            {
              type: "steps",
              items: [
                "Öffnen Sie /konto und den Abschnitt „Geräteverlauf“.",
                "Sichten Sie die Liste der angemeldeten Geräte.",
                "Erkennen Sie ein unbekanntes Gerät, melden Sie es ab.",
                "Ändern Sie anschließend sicherheitshalber Ihr Passwort.",
              ],
            },
            { type: "h2", text: "Wann ein Blick sinnvoll ist" },
            {
              type: "p",
              text: "Prüfen Sie den Geräteverlauf besonders nach einer Passwort- oder E-Mail-Änderung sowie nach der Nutzung eines fremden oder öffentlichen Geräts. Ein unbekannter Eintrag ist ein klares Warnsignal für unbefugten Zugriff.",
            },
            {
              type: "ul",
              items: [
                "Jeder Eintrag zeigt Gerätetyp, ungefähren Standort und letzte Aktivität.",
                "Einzelne Geräte lassen sich gezielt abmelden, ohne die anderen zu beeinträchtigen.",
                "Ein unerkanntes Gerät ist Anlass für einen sofortigen Passwortwechsel.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Erkennen Sie ein Gerät nicht, melden Sie es sofort ab und ändern Sie danach Ihr Passwort unter [Passwort & E-Mail ändern](/hilfe/konto-abo/passwort-email-aendern).",
            },
          ],
        },
        {
          slug: "datenschutz",
          title: "Datenschutz",
          excerpt: "Suchmaschinen-Indexierung je Objekt steuern und Ihre Daten exportieren.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "p",
              text: "Im Abschnitt „Datenschutz“ unter /konto steuern Sie zwei Dinge: ob Ihre Objektseiten von Suchmaschinen indexiert werden dürfen, und wie Sie Ihre bei myNextDays gespeicherten Daten exportieren können.",
            },
            { type: "h2", text: "Suchmaschinen-Indexierung je Objekt" },
            {
              type: "p",
              text: "Standardmäßig ist die Suchmaschinen-Indexierung für neue Objekte deaktiviert. Erst wenn Sie sie bewusst je Objekt einschalten, dürfen Suchmaschinen wie Google die öffentliche Objektseite in ihren Index aufnehmen. So behalten Sie die Kontrolle, welche Objekte außerhalb von Portalen und der eigenen Plattform auffindbar sind.",
            },
            {
              type: "steps",
              items: [
                "Öffnen Sie /konto und den Abschnitt „Datenschutz“.",
                "Wählen Sie das gewünschte Objekt aus der Liste.",
                "Schalten Sie die Suchmaschinen-Indexierung ein oder aus.",
                "Nutzen Sie bei mehreren Objekten den Sammelschalter, um alle Objekte einheitlich zu setzen.",
              ],
            },
            { type: "h2", text: "Daten exportieren" },
            {
              type: "p",
              text: "Über die Datenexport-Funktion fordern Sie eine vollständige Kopie Ihrer im Konto gespeicherten Daten an. Der Export wird zusammengestellt und Ihnen anschließend zum Download bereitgestellt.",
            },
            {
              type: "ul",
              items: [
                "Die Indexierung ist je Objekt einzeln steuerbar, mit Sammelschalter für alle Objekte.",
                "Neue Objekte starten grundsätzlich ohne Suchmaschinen-Indexierung.",
                "Der Datenexport enthält Ihre Konto- und Objektdaten in strukturierter Form.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Die Suchmaschinen-Indexierung ist unabhängig von der Sichtbarkeit auf Portalen und im eigenen Marktplatz — sie betrifft ausschließlich die öffentliche Objektseite in Suchmaschinen.",
            },
          ],
        },
      ],
    },
  ],
};

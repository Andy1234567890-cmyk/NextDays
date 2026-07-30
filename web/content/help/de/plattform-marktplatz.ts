import type { HelpCategory } from "../types";

export const plattformMarktplatz: HelpCategory = {
  slug: "plattform-marktplatz",
  title: "Plattform (Marktplatz)",
  description: "Auf dem myNextDays-Marktplatz verkaufen.",
  icon: "ph:storefront",
  collection: "kb",
  sections: [
    {
      heading: "Marktplatz",
      articles: [
        {
          slug: "der-marktplatz",
          title: "Der myNextDays-Marktplatz",
          excerpt: "Der globale myNextDays-Marktplatz ist ein eigener Buchungskanal neben Portalen und Website.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "p",
              text: "Der myNextDays-Marktplatz (/plattform) ist der globale Buchungskanal von myNextDays selbst — vergleichbar mit Booking oder Airbnb, jedoch Teil derselben Plattform. Gäste durchsuchen dort Objekte aller angeschlossenen Betriebe und buchen direkt.",
            },
            { type: "h2", text: "Kein „Direkt“, sondern ein gleichrangiger Kanal" },
            {
              type: "p",
              text: "Der Marktplatz ersetzt keine Direktbuchung über Ihre eigene Website. Er ist ein eigenständiger, dritter Vertriebsweg mit eigener Sichtbarkeits-Achse, eigenem Gästestamm und eigener Provision — genau wie ein Portal, nur eben von myNextDays selbst betrieben.",
            },
            { type: "h2", text: "Wie Objekte auf den Marktplatz kommen" },
            {
              type: "ul",
              items: [
                "Das Objekt muss aktiv sein (Objekt-Status erlaubt Verkauf).",
                "Die Marktplatz-Sichtbarkeit muss eingeschaltet sein — getrennt von Portalen und Website.",
                "Für den gewünschten Zeitraum muss Verfügbarkeit im Kalender bestehen.",
              ],
            },
            { type: "h2", text: "Buchungen aus dem Marktplatz" },
            {
              type: "p",
              text: "Eine Marktplatz-Buchung sperrt die entsprechenden Nächte sofort auf allen anderen Kanälen — genauso wie eine Portal- oder Website-Buchung. Sie erscheint in Ihrem Kalender und in den Reservierungen wie jede andere Buchung auch, mit dem Kanal „Plattform“ gekennzeichnet.",
            },
            {
              type: "note",
              variant: "info",
              text: "Stop-Sell und ein inaktiver Objekt-Status wirken kanalübergreifend und sperren auch den Marktplatz — unabhängig vom Marktplatz-Sichtbarkeits-Schalter.",
            },
            {
              type: "p",
              text: "Wie Sie ein Objekt für den Marktplatz freischalten, lesen Sie unter [Objekt auf dem Marktplatz listen](/hilfe/plattform-marktplatz/objekt-listen).",
            },
          ],
        },
        {
          slug: "objekt-listen",
          title: "Objekt auf dem Marktplatz listen",
          excerpt: "Marktplatz-Sichtbarkeit ist ein eigener Schalter, getrennt von Portalen und Website.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "p",
              text: "Die Sichtbarkeit auf dem Marktplatz steuern Sie über einen eigenen Schalter am Objekt — unabhängig davon, ob dasselbe Objekt auch auf Portalen oder Ihrer Website sichtbar ist.",
            },
            { type: "h2", text: "So listen Sie ein Objekt" },
            {
              type: "steps",
              items: [
                "Öffnen Sie das Objekt unter Objekte.",
                "Wechseln Sie in den Reiter Sichtbarkeit.",
                "Aktivieren Sie den Schalter Plattform-Marktplatz.",
                "Prüfen Sie, dass der Objekt-Status aktiv ist und Kalenderverfügbarkeit besteht.",
              ],
            },
            { type: "h2", text: "Voraussetzung: vollständiges Profil" },
            {
              type: "p",
              text: "Der Marktplatz zeigt nur Objekte mit vollständigen Angaben an — Titelfoto, Beschreibung, Ausstattung und Basispreis müssen hinterlegt sein. Fehlen Pflichtangaben, bleibt das Objekt trotz aktiviertem Schalter unsichtbar.",
            },
            {
              type: "ul",
              items: [
                "Mindestens ein Titelfoto und eine Beschreibung",
                "Ausstattungsmerkmale aus der Kategorie-Liste",
                "Belegung und Basispreis in der hinterlegten Objektwährung",
                "Kalenderverfügbarkeit für den gewünschten Zeitraum",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Klicken Sie auf Veröffentlichen, schaltet myNextDays im Normalfall Marktplatz, Portale und Website gemeinsam frei — Sie können den Marktplatz-Schalter danach jederzeit einzeln wieder ausschalten.",
            },
            { type: "h2", text: "Sichtbarkeit wieder entfernen" },
            {
              type: "p",
              text: "Deaktivieren Sie den Schalter Plattform-Marktplatz, verschwindet das Objekt aus der Marktplatz-Suche. Bereits bestätigte Buchungen bleiben davon unberührt und laufen wie gewohnt weiter, siehe [Marktplatz-Provision](/hilfe/plattform-marktplatz/marktplatz-provision).",
            },
          ],
        },
        {
          slug: "marktplatz-provision",
          title: "Marktplatz-Provision",
          excerpt: "Für jede über den Marktplatz vermittelte Buchung fällt die im Tarif hinterlegte Provision an.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "p",
              text: "Wie bei jedem Buchungsportal fällt für Buchungen, die über den myNextDays-Marktplatz zustande kommen, eine Provision an. Sie wird pro Buchung berechnet und ist unabhängig von etwaigen Provisionen für Portale.",
            },
            { type: "h2", text: "Wie die Provision berechnet wird" },
            {
              type: "p",
              text: "Die Höhe richtet sich nach der im Tarif hinterlegten Provision Ihres Betriebs. Sie finden den aktuellen Satz jederzeit unter Konto im Bereich Abrechnung — dort wird kein pauschaler Wert angenommen, sondern der tatsächlich für Ihren Tarif geltende Satz angezeigt.",
            },
            { type: "h2", text: "Wo Sie die Provision einsehen" },
            {
              type: "steps",
              items: [
                "Öffnen Sie im Menü Konto.",
                "Wechseln Sie in den Bereich Abrechnung.",
                "Öffnen Sie eine Marktplatz-Buchung, um Umsatz und Provision im Detail zu sehen.",
                "Prüfen Sie die Übersicht der Provisionen für den laufenden Abrechnungszeitraum.",
              ],
            },
            { type: "h2", text: "Abgrenzung zu Portal-Provisionen" },
            {
              type: "ul",
              items: [
                "Marktplatz-Provision gilt ausschließlich für Buchungen über den myNextDays-Marktplatz.",
                "Portal-Buchungen (Booking, Airbnb & Co.) unterliegen den Konditionen des jeweiligen Portals.",
                "Website-Buchungen unterliegen der für Ihren Tarif hinterlegten Konditionen ohne Marktplatz-Provision.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Die Provision wird automatisch aus Ihrem Tarif ermittelt. Ein fehlender oder unklarer Tarif führt zu einer klaren Fehlermeldung statt eines geschätzten Werts.",
            },
          ],
        },
        {
          slug: "gaesteprofil-bewertungen",
          title: "Gästeprofil & Bewertungen",
          excerpt: "Marktplatz-Gäste haben ein Profil mit Buchungshistorie und können Bewertungen hinterlassen.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "p",
              text: "Gäste, die über den myNextDays-Marktplatz buchen, legen ein eigenes Gästeprofil an. Darin sammeln sich ihre Buchungen, Nachrichten mit Betrieben und abgegebene Bewertungen — ähnlich wie bei einem Portal-Gästekonto.",
            },
            { type: "h2", text: "Was Sie als Betrieb sehen" },
            {
              type: "p",
              text: "In den Reservierungsdetails einer Marktplatz-Buchung finden Sie das Gästeprofil mit bisherigen Aufenthalten bei Ihrem Betrieb und, sofern vom Gast freigegeben, öffentlich sichtbaren Bewertungen zu anderen Unterkünften.",
            },
            { type: "h2", text: "Bewertungen nach dem Aufenthalt" },
            {
              type: "steps",
              items: [
                "Nach dem Check-out erhält der Gast eine Aufforderung zur Bewertung.",
                "Die Bewertung erscheint nach kurzer Prüfung auf der Objektseite im Marktplatz.",
                "Sie können als Betrieb öffentlich auf jede Bewertung antworten.",
                "Unsachliche oder missbräuchliche Bewertungen können Sie über Melden zur Prüfung einreichen.",
              ],
            },
            {
              type: "ul",
              items: [
                "Bewertungen sind an eine tatsächliche Buchung gebunden — keine Bewertung ohne Aufenthalt.",
                "Der Gast bewertet Sauberkeit, Kommunikation, Lage und Preis-Leistung.",
                "Ihre Antwort ist für alle Marktplatz-Besucher sichtbar.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Gute Bewertungen wirken sich direkt auf die Platzierung Ihres Objekts in der Marktplatz-Suche aus — reagieren Sie zeitnah und sachlich auf Kritik.",
            },
          ],
        },
        {
          slug: "blockierte-personen",
          title: "Blockierte Personen",
          excerpt: "Ein Betrieb kann einen Gast sperren, sodass Nachrichten und Buchungen unterbunden werden.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "p",
              text: "Kommt es mit einem Gast zu Problemen, können Sie ihn als Betrieb blockieren. Eine blockierte Person kann Ihnen keine Nachrichten mehr senden und keine neue Buchung bei Ihrem Betrieb mehr anlegen.",
            },
            { type: "h2", text: "Eine Person blockieren" },
            {
              type: "steps",
              items: [
                "Öffnen Sie den Nachrichtenverlauf oder die Reservierung mit dem betreffenden Gast.",
                "Klicken Sie auf Gast blockieren.",
                "Bestätigen Sie den Dialog — die Sperre gilt sofort.",
                "Die blockierte Person erscheint anschließend in Konto unter Blockierte Personen.",
              ],
            },
            { type: "h2", text: "Was die Sperre bewirkt" },
            {
              type: "ul",
              items: [
                "Der Gast kann keine neuen Nachrichten mehr an Ihren Betrieb senden.",
                "Der Gast kann keine neue Buchung bei Ihrem Betrieb anlegen.",
                "Eine laufende Buchung mit einer bereits bestätigten Anreise innerhalb der nächsten zwei Wochen bleibt von der Sperre unberührt, damit der Aufenthalt geregelt abgewickelt werden kann.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Die Sperre gilt ausschließlich für Ihren Betrieb. Andere Betriebe auf dem Marktplatz sehen die Sperre nicht und sind davon nicht betroffen.",
            },
            { type: "h2", text: "Sperre wieder aufheben" },
            {
              type: "p",
              text: "Öffnen Sie Konto und dort Blockierte Personen. Wählen Sie den Eintrag und klicken Sie auf Sperre aufheben — der Gast kann anschließend wieder Nachrichten senden und buchen.",
            },
          ],
        },
      ],
    },
  ],
};

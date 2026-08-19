import type { HelpCategory } from "../types";

export const kalenderVerfuegbarkeit: HelpCategory = {
  slug: "kalender-verfuegbarkeit",
  title: "Kalender & Verfügbarkeit",
  description: "Belegungsplan, Stop-Sell und Mindestaufenthalt.",
  icon: "ph:calendar-dots",
  collection: "kb",
  sections: [
    {
      heading: "Kalender",
      articles: [
        {
          slug: "belegungsplan-lesen",
          title: "Den Belegungsplan lesen",
          excerpt: "So lesen Sie Buchungen, Verfügbarkeit und Preise im Belegungsplan richtig.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "p",
              text: "Der Belegungsplan zeigt Ihnen auf einen Blick, welche Nächte gebucht, verfügbar oder gesperrt sind. Bei Ferienobjekten sehen Sie eine Zeile pro Objekt, bei Hotels eine verschachtelte Ansicht mit einer Zeile je Zimmerkategorie und Rate-Plan.",
            },
            { type: "h2", text: "Aufbau der Ansicht" },
            {
              type: "steps",
              items: [
                "Öffnen Sie den Kalender über den Menüpunkt „Belegungsplan“.",
                "Wählen Sie oben den Zeitraum, den Sie einsehen möchten.",
                "Filtern Sie bei Bedarf nach einzelnen Objekten oder Zimmerkategorien.",
                "Klicken Sie auf einen Tag, um Details zu Preis und Verfügbarkeit zu öffnen.",
                "Klicken Sie auf einen belegten Zeitraum, um die zugehörige Buchung zu öffnen.",
              ],
            },
            { type: "h2", text: "Farben und Symbole" },
            {
              type: "ul",
              items: [
                "Belegt: der Zeitraum ist durch eine Buchung reserviert.",
                "Verfügbar: der Tag kann auf allen aktiven Kanälen gebucht werden.",
                "Gesperrt: der Tag ist durch Stop-Sell oder manuelle Blockierung nicht buchbar.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Jede Zeile im Belegungsplan steht für genau eine buchbare Einheit — ein Zimmer oder ein Ferienobjekt. Es gibt keine Container-Zeile für mehrere Zimmer gleichzeitig.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Mehr zum gezielten Öffnen und Schließen einzelner Tage finden Sie unter [Verfügbarkeit setzen](/hilfe/kalender-verfuegbarkeit/verfuegbarkeit-setzen).",
            },
          ],
        },
        {
          slug: "verfuegbarkeit-setzen",
          title: "Verfügbarkeit setzen",
          excerpt: "Einzelne Tage oder Zeiträume gezielt öffnen und schließen.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "p",
              text: "Verfügbarkeit bestimmt, ob ein Objekt an einem bestimmten Tag gebucht werden kann. Sie können einzelne Tage oder ganze Zeiträume öffnen oder schließen, direkt im Belegungsplan.",
            },
            { type: "h2", text: "Zeitraum bearbeiten" },
            {
              type: "steps",
              items: [
                "Öffnen Sie den Belegungsplan des gewünschten Objekts.",
                "Markieren Sie den gewünschten Zeitraum durch Klicken und Ziehen.",
                "Wählen Sie im Aktionsmenü „Verfügbarkeit ändern“.",
                "Bestätigen Sie, ob der Zeitraum geöffnet oder geschlossen werden soll.",
                "Speichern Sie die Änderung.",
              ],
            },
            { type: "h2", text: "Auswirkung auf Kanäle" },
            {
              type: "p",
              text: "Eine Verfügbarkeitsänderung wirkt sich auf alle Vertriebskanäle aus, auf denen das Objekt sichtbar ist: Portale wie Booking, Airbnb & Co., die eigene Plattform sowie die App. Die Übertragung an die Portale erfolgt automatisch im Hintergrund.",
            },
            {
              type: "ul",
              items: [
                "Öffnen: der Tag wird auf allen aktiven Kanälen buchbar.",
                "Schließen: der Tag verschwindet aus der Buchbarkeit, bleibt aber im Kalender sichtbar.",
                "Bereits bestehende Buchungen sind von einer Verfügbarkeitsänderung nicht betroffen.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Schließen Sie einen Zeitraum nicht mit der Absicht, ihn komplett und dauerhaft für den Verkauf zu sperren — dafür ist Stop-Sell die richtige Funktion, siehe [Stop-Sell](/hilfe/kalender-verfuegbarkeit/stop-sell).",
            },
          ],
        },
        {
          slug: "stop-sell",
          title: "Stop-Sell",
          excerpt: "Stop-Sell sperrt einen Tag sofort auf allen Vertriebskanälen gleichzeitig.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "p",
              text: "Stop-Sell ist die schnellste Möglichkeit, einen einzelnen Tag komplett aus dem Verkauf zu nehmen. Anders als eine reine Verfügbarkeitsänderung wirkt Stop-Sell hart und sofort auf allen Kanälen gleichzeitig — auf den Portalen, der eigenen Plattform und in der App.",
            },
            { type: "h2", text: "Stop-Sell setzen" },
            {
              type: "steps",
              items: [
                "Öffnen Sie den Belegungsplan des betroffenen Objekts.",
                "Wählen Sie den gewünschten Tag oder Zeitraum aus.",
                "Klicken Sie im Aktionsmenü auf „Stop-Sell aktivieren“.",
                "Bestätigen Sie die Sperre.",
              ],
            },
            { type: "h2", text: "Wann Stop-Sell sinnvoll ist" },
            {
              type: "ul",
              items: [
                "Kurzfristige Wartungsarbeiten oder technische Probleme im Objekt.",
                "Ein Sonderfall, bei dem Sie sofort und ohne Ausnahme keine neue Buchung wollen.",
                "Eine schnelle, plattformweite Notsperre, ohne jeden Kanal einzeln zu bearbeiten.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Stop-Sell kennt keine kanalspezifische Ausnahme: Ist ein Tag gesperrt, kann kein Gast über keinen Kanal buchen, auch nicht über die Rezeption oder eine Direktanfrage.",
            },
            {
              type: "note",
              variant: "info",
              text: "Für dauerhafte Eigennutzung oder geplante Wartung eignet sich stattdessen die [Manuelle Blockierung](/hilfe/kalender-verfuegbarkeit/manuelle-blockierung).",
            },
          ],
        },
        {
          slug: "mindest-hoechstaufenthalt",
          title: "Mindest- & Höchstaufenthalt",
          excerpt: "Wie lange Gäste mindestens oder höchstens buchen dürfen.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "p",
              text: "Mit Mindest- und Höchstaufenthalt legen Sie fest, wie viele Nächte ein Gast für einen Anreisetag mindestens oder höchstens buchen kann. Das hilft, kurze Lückenbuchungen zu vermeiden oder Ihr Objekt gezielt für längere Aufenthalte zu positionieren.",
            },
            { type: "h2", text: "Regel einrichten" },
            {
              type: "steps",
              items: [
                "Öffnen Sie im Objekt den Belegungsplan oder den Tab „Preise“.",
                "Wählen Sie den betroffenen Zeitraum aus.",
                "Tragen Sie unter „Mindestaufenthalt“ die minimale Nächteanzahl ein.",
                "Tragen Sie optional unter „Höchstaufenthalt“ eine maximale Nächteanzahl ein.",
                "Speichern Sie die Regel.",
              ],
            },
            { type: "h2", text: "Typische Anwendungsfälle" },
            {
              type: "ul",
              items: [
                "Hochsaison: höherer Mindestaufenthalt, um Wechseltage zu bündeln.",
                "Nebensaison: niedrigerer Mindestaufenthalt, um mehr Buchungen zu ermöglichen.",
                "Höchstaufenthalt: sinnvoll, wenn ein Objekt danach für Wartung oder eine andere Nutzung frei sein muss.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Die Regel gilt für den Anreisetag: Ein Gast kann an einem Tag mit Mindestaufenthalt von drei Nächten nicht für nur zwei Nächte anreisen, selbst wenn die einzelnen Tage verfügbar sind.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Kombinieren Sie längere Mindestaufenthalte mit [Aufenthaltsrabatte](/hilfe/preise-raten/aufenthaltsrabatte), um den Anreiz für Gäste zu erhöhen.",
            },
          ],
        },
        {
          slug: "manuelle-blockierung",
          title: "Manuelle Blockierung",
          excerpt: "Zeiträume für Eigennutzung oder Wartung gezielt reservieren.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "p",
              text: "Eine manuelle Blockierung reserviert einen Zeitraum im Kalender, ohne dass eine echte Gästebuchung vorliegt — etwa für Eigennutzung, geplante Wartungsarbeiten oder Renovierungen. Der Zeitraum wird im Belegungsplan wie eine Buchung dargestellt, ist aber klar als Blockierung erkennbar.",
            },
            { type: "h2", text: "Blockierung anlegen" },
            {
              type: "steps",
              items: [
                "Öffnen Sie den Belegungsplan des betroffenen Objekts.",
                "Markieren Sie den gewünschten Zeitraum.",
                "Wählen Sie im Aktionsmenü „Manuell blockieren“.",
                "Geben Sie einen Grund an, z. B. „Eigennutzung“ oder „Wartung“.",
                "Speichern Sie die Blockierung.",
              ],
            },
            { type: "h2", text: "Unterschied zu Stop-Sell" },
            {
              type: "p",
              text: "Eine manuelle Blockierung reserviert konkret einen Zeitraum für einen bestimmten, dokumentierten Zweck und lässt sich später wieder freigeben. Für eine sofortige, plattformweite Notsperre ohne dokumentierten Zeitraum ist stattdessen Stop-Sell gedacht.",
            },
            {
              type: "ul",
              items: [
                "Manuelle Blockierung: geplant, mit Grund, für Eigennutzung oder Wartung.",
                "Freigabe jederzeit möglich, sobald der Zeitraum nicht mehr benötigt wird.",
                "Blockierte Nächte zählen nicht als Gästebuchung und erscheinen nicht in der Umsatzübersicht.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Löschen Sie eine manuelle Blockierung, sobald der Grund entfällt — sonst bleibt das Objekt auf allen Kanälen unnötig gesperrt.",
            },
            {
              type: "note",
              variant: "info",
              text: "Für eine sofortige Sperre ohne geplanten Zeitraum nutzen Sie [Stop-Sell](/hilfe/kalender-verfuegbarkeit/stop-sell).",
            },
          ],
        },
      ],
    },
  ],
};

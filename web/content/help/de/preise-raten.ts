import type { HelpCategory } from "../types";

export const preiseRaten: HelpCategory = {
  slug: "preise-raten",
  title: "Preise & Raten",
  description: "Rate-Pläne, Saisonpreise und dynamische Preise.",
  icon: "ph:tag",
  collection: "kb",
  sections: [
    {
      heading: "Preisgestaltung",
      articles: [
        {
          slug: "grundpreis-waehrung",
          title: "Grundpreis & Währung",
          excerpt: "So legen Sie den Basispreis fest und weisen Ihrem Objekt die richtige Währung zu.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "p",
              text: "Jedes Objekt in myNextDays ist genau eine buchbare Einheit — ein einzelnes Zimmer oder ein Ferienobjekt. Für diese Einheit hinterlegen Sie einen Grundpreis sowie eine zentrale Währung, die für das gesamte Objekt gilt.",
            },
            { type: "h2", text: "Währung zentral festlegen" },
            {
              type: "p",
              text: "Die Objektwährung wird einmal pro Objekt gesetzt und gilt automatisch für alle Rate-Pläne, die Sie für dieses Objekt anlegen. Es gibt keinen separaten Währungs-Fallback — fehlt die Währung, können Sie keine Preise speichern.",
            },
            {
              type: "steps",
              items: [
                "Öffnen Sie Ihr Objekt unter „Objekte“.",
                "Wechseln Sie in den Tab „Preise“.",
                "Wählen Sie unter „Objektwährung“ die passende Währung aus.",
                "Tragen Sie den Basispreis für die Standardbelegung ein.",
                "Speichern Sie die Änderungen.",
              ],
            },
            { type: "h2", text: "Was passiert bei einer Währungsänderung" },
            {
              type: "p",
              text: "Ändern Sie die Objektwährung nachträglich, wirkt sich das auf alle bestehenden Rate-Pläne dieses Objekts aus, da diese immer in der Objektwährung geführt werden. Prüfen Sie danach Ihre Preise, bevor Sie sie erneut an die Portale übertragen.",
            },
            {
              type: "ul",
              items: [
                "Ein Objekt hat genau eine Währung — nicht mehrere je Rate-Plan.",
                "Der Basispreis ist der Ausgangswert für abgeleitete Raten.",
                "Beträge werden immer mit der hinterlegten Objektwährung angezeigt.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Ohne hinterlegte Währung lässt sich kein Preis speichern und keine Rate an Portale übertragen. Prüfen Sie dies zuerst, wenn eine Preisänderung fehlschlägt.",
            },
            {
              type: "note",
              variant: "info",
              text: "Mehr zu abgeleiteten Preisen finden Sie unter [Abgeleitete Raten](/hilfe/preise-raten/abgeleitete-raten).",
            },
          ],
        },
        {
          slug: "rate-plaene",
          title: "Rate-Pläne anlegen",
          excerpt: "Rate-Pläne bündeln Preis, Stornobedingungen und Verpflegung für ein Objekt.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "p",
              text: "Ein Rate-Plan definiert, zu welchen Bedingungen ein Objekt gebucht werden kann: Preis, Stornoregeln, Verpflegung und Mindestaufenthalt. Ein Objekt kann mehrere Rate-Pläne gleichzeitig anbieten, etwa einen flexiblen und einen nicht stornierbaren Plan.",
            },
            { type: "h2", text: "Neuen Rate-Plan erstellen" },
            {
              type: "steps",
              items: [
                "Öffnen Sie das Objekt und wechseln Sie in den Tab „Preise“.",
                "Klicken Sie auf „Neuen Rate-Plan anlegen“.",
                "Vergeben Sie einen sprechenden Namen, z. B. „Flexibel“ oder „Nicht stornierbar“.",
                "Legen Sie fest, ob der Plan eine Basisrate oder eine abgeleitete Rate ist.",
                "Hinterlegen Sie Stornobedingungen und Verpflegung.",
                "Speichern und aktivieren Sie den Rate-Plan.",
              ],
            },
            { type: "h2", text: "Basisrate vs. weitere Rate-Pläne" },
            {
              type: "p",
              text: "Legen Sie zuerst Ihre Basisrate an (häufig als „BAR“ bezeichnet, Best Available Rate). Alle weiteren Rate-Pläne können entweder eigenständig gepflegt oder aus dieser Basisrate abgeleitet werden.",
            },
            {
              type: "ul",
              items: [
                "Basisrate: manuell gepflegter Grundpreis je Nacht.",
                "Weitere Rate-Pläne: eigenständig oder als Aufschlag/Abschlag auf die Basisrate.",
                "Jeder Rate-Plan kann einzeln an Portale übertragen werden.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Halten Sie die Zahl der Rate-Pläne pro Objekt überschaubar — zu viele Varianten erschweren Gästen den Vergleich und erhöhen den Pflegeaufwand.",
            },
            {
              type: "note",
              variant: "info",
              text: "Details zu Aufschlägen und Abschlägen finden Sie unter [Abgeleitete Raten](/hilfe/preise-raten/abgeleitete-raten).",
            },
          ],
        },
        {
          slug: "abgeleitete-raten",
          title: "Abgeleitete Raten",
          excerpt: "Abgeleitete Rate-Pläne berechnen sich automatisch aus einer Basisrate.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "p",
              text: "Eine abgeleitete Rate ist ein Rate-Plan, dessen Preis nicht manuell gepflegt wird, sondern sich automatisch aus einer Basisrate berechnet — als fester Aufschlag, Abschlag oder Prozentsatz. Das spart Pflegeaufwand, da eine Preisänderung an der Basisrate automatisch alle abgeleiteten Pläne aktualisiert.",
            },
            { type: "h2", text: "Typisches Beispiel" },
            {
              type: "p",
              text: "Ein häufiges Muster ist ein Plan mit Frühstück, der aus der Basisrate ohne Verpflegung abgeleitet wird: Der Frühstückspreis wird als Aufschlag pro Nacht und Person auf die Basisrate definiert. Ändern Sie die Basisrate, passt sich der Frühstückspreis automatisch an.",
            },
            { type: "h2", text: "Abgeleitete Rate einrichten" },
            {
              type: "steps",
              items: [
                "Öffnen Sie den gewünschten Rate-Plan im Tab „Preise“.",
                "Wählen Sie als Preisquelle „Abgeleitet von …“ und die zugehörige Basisrate.",
                "Bestimmen Sie, ob der Unterschied als fester Betrag oder als Prozentsatz gilt.",
                "Legen Sie fest, ob es sich um einen Aufschlag oder Abschlag handelt.",
                "Speichern Sie die Zuordnung.",
              ],
            },
            {
              type: "ul",
              items: [
                "Aufschlag: z. B. Verpflegung, spätere Stornierbarkeit.",
                "Abschlag: z. B. nicht stornierbarer Plan mit Preisvorteil.",
                "Die Basisrate bleibt die einzige manuell gepflegte Quelle.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Eine abgeleitete Rate kann nicht gleichzeitig manuell überschrieben werden. Lösen Sie zuerst die Ableitung, wenn Sie einen Einzelpreis abweichend setzen möchten.",
            },
          ],
        },
        {
          slug: "saison-wochenendpreise",
          title: "Saison- & Wochenendpreise",
          excerpt: "Preise für Saisonzeiträume und Wochenenden gezielt anpassen.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "p",
              text: "Nachfrage schwankt über das Jahr und innerhalb der Woche. Mit Saison- und Wochenendpreisen passen Sie den Basispreis für bestimmte Zeiträume oder Wochentage an, ohne für jeden Tag einzeln in den Kalender zu gehen.",
            },
            { type: "h2", text: "Saisonzeitraum anlegen" },
            {
              type: "steps",
              items: [
                "Öffnen Sie im Objekt den Tab „Preise“ und den Bereich „Saisonpreise“.",
                "Legen Sie einen neuen Zeitraum mit Start- und Enddatum an.",
                "Hinterlegen Sie den Preis oder die prozentuale Abweichung vom Basispreis für diesen Zeitraum.",
                "Speichern Sie den Saisonzeitraum.",
              ],
            },
            { type: "h2", text: "Wochenendpreise" },
            {
              type: "p",
              text: "Zusätzlich können Sie einzelne Wochentage, etwa Freitag und Samstag, mit einem eigenen Aufschlag versehen. Dieser Aufschlag wirkt zusätzlich zum jeweils gültigen Saison- oder Basispreis.",
            },
            {
              type: "ul",
              items: [
                "Saisonpreise wirken für zusammenhängende Zeiträume.",
                "Wochenendpreise wirken je Wochentag, unabhängig von der Saison.",
                "Beide Regeln lassen sich kombinieren.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Überschneiden sich mehrere Saisonzeiträume, gilt die zuletzt angelegte bzw. spezifischste Regel. Prüfen Sie den Kalender nach dem Speichern.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Für automatische, nachfragebasierte Anpassungen eignet sich zusätzlich [Dynamische Preise](/hilfe/preise-raten/dynamische-preise).",
            },
          ],
        },
        {
          slug: "dynamische-preise",
          title: "Dynamische Preise",
          excerpt: "Preise automatisch an Nachfrage, Vorlaufzeit und Auslastung anpassen.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "note",
              variant: "info",
              text: "Dynamische Preise sind ein kostenpflichtiges Zusatzmodul. Sie buchen es unter „Erweiterungen“ dazu — dort steht auch der Preis. Ohne gebuchtes Modul rechnet die Automatik nicht.",
            },
            {
              type: "p",
              text: "Dynamische Preise passen den Basispreis automatisch anhand von Faktoren wie Buchungsvorlauf, aktueller Auslastung und Nachfrage an — ähnlich wie es große Portale bei ihren eigenen Preisempfehlungen tun. So reagieren Sie auf Marktveränderungen, ohne jeden Tag manuell nachzujustieren.",
            },
            { type: "h2", text: "Dynamische Preise aktivieren" },
            {
              type: "steps",
              items: [
                "Öffnen Sie im Objekt den Tab „Preise“ und den Bereich „Dynamische Preise“.",
                "Aktivieren Sie die Funktion für die Basisrate des Objekts.",
                "Legen Sie eine Preisuntergrenze und eine Preisobergrenze fest.",
                "Bestimmen Sie, wie stark die Auslastung den Preis beeinflussen darf.",
                "Speichern Sie die Einstellungen.",
              ],
            },
            { type: "h2", text: "Grenzen und Sicherheit" },
            {
              type: "p",
              text: "Preisuntergrenze und Preisobergrenze verhindern, dass der automatische Algorithmus Preise setzt, die für Ihren Betrieb nicht tragbar sind. Abgeleitete Rate-Pläne folgen der dynamisch berechneten Basisrate automatisch mit.",
            },
            {
              type: "ul",
              items: [
                "Preisuntergrenze schützt vor zu niedrigen Preisen in schwacher Nachfrage.",
                "Preisobergrenze schützt vor überzogenen Preisen bei hoher Nachfrage.",
                "Abgeleitete Raten übernehmen automatisch die neue Basisrate.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Dynamische Preise wirken nur auf die Basisrate. Manuell fest eingestellte Rate-Pläne ohne Ableitung ändern sich nicht automatisch mit.",
            },
          ],
        },
        {
          slug: "aufenthaltsrabatte",
          title: "Aufenthaltsrabatte",
          excerpt: "Rabatte für längere Aufenthalte und frühe Buchungen einrichten.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "p",
              text: "Aufenthaltsrabatte belohnen Gäste für längere Buchungen oder frühzeitiges Buchen. Sie werden als Prozentsatz auf den Gesamtpreis des Aufenthalts angewendet und lassen sich unabhängig je Objekt konfigurieren.",
            },
            { type: "h2", text: "Rabattarten" },
            {
              type: "ul",
              items: [
                "Langzeitrabatt: ab einer bestimmten Anzahl Nächte, z. B. ab 7 oder 28 Nächten.",
                "Frühbucherrabatt: bei Buchung ausreichend weit im Voraus.",
                "Last-Minute-Rabatt: bei kurzfristiger Buchung nahe am Anreisedatum.",
              ],
            },
            { type: "h2", text: "Rabatt einrichten" },
            {
              type: "steps",
              items: [
                "Öffnen Sie im Objekt den Tab „Preise“ und den Bereich „Rabatte“.",
                "Wählen Sie die gewünschte Rabattart aus.",
                "Legen Sie die Schwelle fest, z. B. Mindestnächte oder Vorlaufzeit.",
                "Tragen Sie den Rabatt in Prozent ein.",
                "Speichern Sie die Regel.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Rabatte wirken auf den Gesamtpreis des jeweiligen Rate-Plans und werden dem Gast bereits in der Preisübersicht angezeigt.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Kombinieren Sie Langzeitrabatte mit [Mindest- & Höchstaufenthalt](/hilfe/kalender-verfuegbarkeit/mindest-hoechstaufenthalt), um längere Buchungen gezielt zu fördern.",
            },
          ],
        },
      ],
    },
  ],
};

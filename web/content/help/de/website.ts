import type { HelpCategory } from "../types";

export const website: HelpCategory = {
  slug: "website",
  title: "Website-Baukasten",
  description: "Eigene Buchungs-Website mit dem Baukasten erstellen.",
  icon: "ph:browser",
  collection: "kb",
  sections: [
    {
      heading: "Website-Baukasten",
      articles: [
        {
          slug: "website-erstellen",
          title: "Eine Website erstellen",
          excerpt: "Mit dem Baukasten legen Sie in wenigen Minuten eine eigene Buchungs-Website an.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "p",
              text: "Der Website-Baukasten erstellt Ihnen eine eigene Buchungs-Website — ein zusätzlicher Vertriebskanal neben Portalen und dem myBestDays-Marktplatz. Sie behalten die volle Kontrolle über Aufbau, Inhalte und Branding.",
            },
            { type: "h2", text: "So legen Sie eine Website an" },
            {
              type: "steps",
              items: [
                "Öffnen Sie im Menü Website.",
                "Klicken Sie auf Website erstellen.",
                "Wählen Sie eine Vorlage als Ausgangspunkt für Ihr Layout.",
                "Bestätigen Sie mit Website anlegen — Sie gelangen direkt in den Editor.",
              ],
            },
            { type: "h2", text: "Was der Baukasten enthält" },
            {
              type: "ul",
              items: [
                "Einen visuellen Editor mit Seiten, Ebenen und Vorschau-Ansicht",
                "Vorgefertigte Bausteine für Objektlisten, Galerien und Kontaktformulare",
                "Eine direkte Buchungsstrecke, die auf Ihrer Kalenderverfügbarkeit basiert",
                "Anpassbare Farben, Schriften und Logo passend zu Ihrer Marke",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Beginnen Sie mit einer Vorlage, die Ihrer Objektart nahekommt — Ferienobjekt oder Hotel — das spart Ihnen beim Anpassen der Bausteine später Zeit.",
            },
            { type: "h2", text: "Nächste Schritte" },
            {
              type: "p",
              text: "Nach der Erstellung passen Sie Seiten und Layout an, siehe [Seiten & Layout bearbeiten](/hilfe/website/seiten-layout), und zeigen Ihre Objekte auf der Website, siehe [Objekte auf der Website anzeigen](/hilfe/website/objekte-anzeigen).",
            },
          ],
        },
        {
          slug: "seiten-layout",
          title: "Seiten & Layout bearbeiten",
          excerpt: "Seiten, Ebenen und Bausteine im visuellen Editor anpassen.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "p",
              text: "Der Editor gliedert sich in drei Bereiche: links die Seiten- und Ebenenübersicht, in der Mitte die Vorschau Ihrer Website, rechts die Einstellungen des jeweils ausgewählten Bausteins.",
            },
            { type: "h2", text: "Eine Seite bearbeiten" },
            {
              type: "steps",
              items: [
                "Wählen Sie links unter Seiten die gewünschte Seite aus.",
                "Klicken Sie in der Vorschau auf einen Baustein, um ihn auszuwählen.",
                "Passen Sie rechts Text, Bild oder Abstand des Bausteins an.",
                "Ziehen Sie Bausteine per Drag-and-drop, um die Reihenfolge zu ändern.",
              ],
            },
            { type: "h2", text: "Neue Seiten & Bausteine hinzufügen" },
            {
              type: "p",
              text: "Über die Schaltfläche Seite hinzufügen legen Sie weitere Unterseiten an, etwa Über uns oder Kontakt. Innerhalb einer Seite fügen Sie über Baustein hinzufügen neue Abschnitte wie Galerie, Bewertungen oder Kontaktformular ein.",
            },
            {
              type: "ul",
              items: [
                "Startseite, Objektübersicht und Kontakt sind bei jeder Vorlage vorbelegt",
                "Weitere Seiten lassen sich frei benennen und in die Navigation aufnehmen",
                "Bausteine sind responsiv und passen sich Desktop, Tablet und Smartphone an",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Änderungen im Editor sind zunächst nur ein Entwurf. Erst ein Klick auf Veröffentlichen übernimmt sie auf Ihre öffentliche Website.",
            },
          ],
        },
        {
          slug: "domain-verbinden",
          title: "Domain verbinden",
          excerpt: "Eine eigene Domain mit Ihrer myNextDays-Website verknüpfen.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "p",
              text: "Standardmäßig ist Ihre Website über eine myNextDays-Subdomain erreichbar. Möchten Sie stattdessen eine eigene Domain wie beispielsweise ihr-betrieb.de nutzen, verbinden Sie diese im Bereich Domain.",
            },
            { type: "h2", text: "Domain hinterlegen" },
            {
              type: "steps",
              items: [
                "Öffnen Sie in der Website die Einstellungen und dort Domain.",
                "Tragen Sie Ihre eigene Domain ein und klicken Sie auf Verbinden.",
                "Legen Sie bei Ihrem Domain-Anbieter die angezeigten DNS-Einträge an.",
                "Warten Sie auf die Bestätigung — die Prüfung erfolgt automatisch im Hintergrund.",
              ],
            },
            { type: "h2", text: "DNS-Einträge korrekt setzen" },
            {
              type: "p",
              text: "myNextDays zeigt Ihnen die genau erforderlichen Einträge für Ihren Domain-Anbieter an. Die Verbindung wird erst aktiv, sobald diese Einträge korrekt gesetzt sind und sich weltweit verbreitet haben — das kann je nach Anbieter einige Stunden dauern.",
            },
            {
              type: "ul",
              items: [
                "CNAME- oder A-Eintrag laut angezeigter Anleitung setzen",
                "Bestehende, widersprüchliche Einträge für dieselbe Domain vorher entfernen",
                "Zertifikat für https wird nach erfolgreicher Verbindung automatisch ausgestellt",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Ohne korrekt gesetzte DNS-Einträge bleibt Ihre Website unter der eigenen Domain nicht erreichbar — prüfen Sie die Schreibweise sorgfältig gegen die Angaben Ihres Anbieters.",
            },
          ],
        },
        {
          slug: "objekte-anzeigen",
          title: "Objekte auf der Website anzeigen",
          excerpt: "Welche Objekte über die Website sichtbar und buchbar sind, steuern Sie separat pro Objekt.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "p",
              text: "Damit ein Objekt auf Ihrer Website erscheint, muss die Website-Sichtbarkeit für dieses Objekt eingeschaltet sein. Dieser Schalter ist unabhängig von der Sichtbarkeit auf dem myBestDays-Marktplatz oder auf Portalen.",
            },
            { type: "h2", text: "Objekt für die Website freischalten" },
            {
              type: "steps",
              items: [
                "Öffnen Sie das Objekt unter Objekte.",
                "Wechseln Sie in den Reiter Sichtbarkeit.",
                "Aktivieren Sie den Schalter Website.",
                "Wechseln Sie in die Website und prüfen Sie den Baustein Objektübersicht in der Vorschau.",
              ],
            },
            { type: "h2", text: "Reihenfolge & Darstellung anpassen" },
            {
              type: "p",
              text: "Im Baustein Objektübersicht legen Sie fest, ob Objekte automatisch nach Verfügbarkeit sortiert werden oder Sie eine feste Reihenfolge vorgeben. Jedes Objekt zeigt Titelfoto, Basispreis in seiner hinterlegten Währung und die wichtigsten Ausstattungsmerkmale.",
            },
            {
              type: "ul",
              items: [
                "Automatische Sortierung nach Verfügbarkeit oder manuelle Reihenfolge",
                "Filter nach Objekttyp oder Ausstattung optional aktivierbar",
                "Buchungsschritte laufen direkt auf der Website, ohne Portal-Umweg",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Ein Objekt ohne aktivierte Website-Sichtbarkeit bleibt aus der Objektübersicht ausgeblendet, selbst wenn es auf dem Marktplatz oder bei Portalen sichtbar ist.",
            },
          ],
        },
        {
          slug: "website-veroeffentlichen",
          title: "Website veröffentlichen",
          excerpt: "Entwürfe werden erst mit einem Klick auf Veröffentlichen öffentlich sichtbar.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "p",
              text: "Solange Sie im Editor arbeiten, sehen nur Sie den aktuellen Entwurf. Erst ein Klick auf Veröffentlichen macht die Änderungen unter Ihrer Domain für alle Besucher sichtbar.",
            },
            { type: "h2", text: "So veröffentlichen Sie" },
            {
              type: "steps",
              items: [
                "Öffnen Sie im Editor die Vorschau und prüfen Sie alle Seiten.",
                "Klicken Sie oben rechts auf Veröffentlichen.",
                "Bestätigen Sie den Dialog — die Website ist unmittelbar danach live.",
                "Öffnen Sie Ihre Domain in einem neuen Tab, um das Ergebnis zu prüfen.",
              ],
            },
            { type: "h2", text: "Entwürfe & Zurücksetzen" },
            {
              type: "p",
              text: "Solange Sie noch nicht veröffentlicht haben, können Sie jederzeit zum letzten veröffentlichten Stand zurückkehren, ohne den Entwurf endgültig zu verlieren — nutzen Sie dafür Entwurf verwerfen in den Website-Einstellungen.",
            },
            {
              type: "ul",
              items: [
                "Veröffentlichte Änderungen sind sofort unter Ihrer Domain sichtbar",
                "Ein unveröffentlichter Entwurf bleibt intern, bis Sie ihn bestätigen",
                "Jede Veröffentlichung wird mit Datum in der Historie festgehalten",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Prüfen Sie vor dem Veröffentlichen die mobile Ansicht in der Vorschau — die meisten Gäste rufen Buchungs-Websites über das Smartphone auf.",
            },
          ],
        },
      ],
    },
  ],
};

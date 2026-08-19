import type { HelpCategory } from "../types";

export const ucWebsite: HelpCategory = {
  slug: "anwendungsfaelle-website",
  title: "Webseite",
  description: "Ihre Website optimal nutzen.",
  icon: "ph:browser",
  collection: "usecases",
  sections: [
    {
      heading: "Webseite",
      articles: [
        {
          slug: "website-live-schalten",
          title: "Ihre Website live schalten",
          excerpt: "So veröffentlichen Sie Ihre eigene Website als eigenständigen Vertriebskanal.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "h2",
              text: "Ausgangslage",
            },
            {
              type: "p",
              text: "Ihre Website ist ein eigener Vertriebskanal neben Portalen und der Plattform. Sie bauen die Seiten im Editor auf, doch erst mit der Veröffentlichung wird die Website für Gäste sichtbar und Ihre Objekte erscheinen dort buchbar.",
            },
            {
              type: "steps",
              items: [
                "Öffnen Sie den Website-Editor und prüfen Sie, dass alle gewünschten Seiten mit Inhalten befüllt sind.",
                "Wählen Sie im Objekt-Tab pro Objekt, ob es auf der Website sichtbar sein soll — diese Sichtbarkeit ist unabhängig von Portalen und Plattform.",
                "Kontrollieren Sie die Vorschau auf Desktop- und mobiler Ansicht, bevor Sie live gehen.",
                "Klicken Sie auf „Veröffentlichen“, um die Website für Gäste freizuschalten.",
                "Prüfen Sie nach der Veröffentlichung die öffentliche URL und testen Sie eine Beispielbuchung über die Website.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Die Website-Sichtbarkeit eines Objekts ist eine eigene Achse — ein Objekt kann auf Portalen aktiv, auf der Website aber ausgeblendet sein und umgekehrt. Details unter [Eine eigene Domain einrichten](/hilfe/website/domain-verbinden).",
            },
          ],
        },
        {
          slug: "eigene-domain-einrichten",
          title: "Eine eigene Domain einrichten",
          excerpt: "So verbinden Sie Ihre eigene Domain mit Ihrer myNextDays-Website.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "h2",
              text: "Ausgangslage",
            },
            {
              type: "p",
              text: "Eine eigene Domain wie www.ihr-betrieb.de wirkt professioneller als eine Standard-Adresse und stärkt Ihre Marke gegenüber Gästen, die direkt bei Ihnen buchen möchten.",
            },
            {
              type: "steps",
              items: [
                "Öffnen Sie im Website-Editor den Bereich „Domain“ und tragen Sie Ihre gewünschte eigene Domain ein.",
                "Richten Sie beim Anbieter Ihrer Domain die angezeigten DNS-Einträge (in der Regel CNAME oder A-Record) ein.",
                "Warten Sie, bis die Domain als verbunden und das SSL-Zertifikat als aktiv angezeigt wird — das kann je nach Anbieter einige Stunden dauern.",
                "Testen Sie den Aufruf der eigenen Domain in einem privaten Browserfenster, um zwischengespeicherte alte Einträge auszuschließen.",
                "Prüfen Sie, dass alte Standard-Adressen weiterhin auf die neue Domain umleiten, damit bestehende Links nicht ins Leere laufen.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Ändern Sie DNS-Einträge nur wie angezeigt — falsche Werte können bestehende E-Mail-Einstellungen Ihrer Domain stören. Prüfen Sie im Zweifel mit Ihrem Domain-Anbieter, bevor Sie bestehende Einträge überschreiben.",
            },
          ],
        },
        {
          slug: "direktbuchungen-steigern",
          title: "Direktbuchungen steigern",
          excerpt: "So lenken Sie mehr Gäste auf Ihre eigene Website statt auf Portale.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "h2",
              text: "Ausgangslage",
            },
            {
              type: "p",
              text: "Buchungen über die eigene Website sind für Ihren Betrieb meist günstiger als über Portale, da hier keine Portal-Provision anfällt. Mit ein paar gezielten Maßnahmen erhöhen Sie den Anteil der Direktbuchungen über Ihre Website als eigenständigen Kanal.",
            },
            {
              type: "steps",
              items: [
                "Stellen Sie sicher, dass alle buchbaren Objekte auf der Website sichtbar und mit aktuellen Fotos sowie Beschreibungen versehen sind.",
                "Richten Sie einen Website-exklusiven Rabatt oder Vorteil ein, etwa einen kleinen Preisnachlass gegenüber Portalen.",
                "Verlinken Sie Ihre eigene Domain in Buchungsbestätigungen und der Kommunikation mit Gästen, die bereits einmal gebucht haben.",
                "Prüfen Sie regelmäßig die Buchungsstatistik, um den Anteil der Website an allen Buchungen im Zeitverlauf zu beobachten.",
                "Optimieren Sie Ladezeit und mobile Darstellung der Website, da ein Großteil der Gäste über das Smartphone bucht.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "Ein Website-exklusiver Vorteil funktioniert nur, wenn Gäste die Website überhaupt finden — verweisen Sie aktiv darauf, statt nur auf Portale zu setzen. Zur Veröffentlichung siehe [Ihre Website live schalten](/hilfe/anwendungsfaelle-website/website-live-schalten).",
            },
          ],
        },
      ],
    },
  ],
};

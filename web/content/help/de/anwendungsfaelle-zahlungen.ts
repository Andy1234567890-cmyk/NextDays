import type { HelpCategory } from "../types";

export const ucZahlungen: HelpCategory = {
  slug: "anwendungsfaelle-zahlungen",
  title: "Zahlungen",
  description: "Zahlungen richtig abwickeln.",
  icon: "ph:credit-card",
  collection: "usecases",
  sections: [
    {
      heading: "Zahlungen",
      articles: [
        {
          slug: "anzahlung-einrichten",
          title: "Eine Anzahlung einrichten",
          excerpt: "So verlangen Sie bei Buchung nur einen Teilbetrag statt der vollen Summe.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "h2",
              text: "Ausgangslage",
            },
            {
              type: "p",
              text: "Statt den gesamten Buchungsbetrag sofort einzuziehen, können Sie eine Anzahlung als Zahlungsregel festlegen. Der Gast zahlt bei Buchung nur einen Teilbetrag über Stripe oder PayPal, den Rest später über eine Restzahlung.",
            },
            {
              type: "steps",
              items: [
                "Öffnen Sie im Objekt den Bereich „Zahlungsregeln“.",
                "Legen Sie eine neue Regel vom Typ „Anzahlung“ an.",
                "Bestimmen Sie den Anzahlungsbetrag als Prozentsatz oder Festbetrag der Gesamtsumme.",
                "Legen Sie fest, wann die Anzahlung fällig ist, in der Regel unmittelbar bei Buchung.",
                "Speichern Sie die Regel und prüfen Sie sie an einer Testbuchung.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Die Anzahlung wird über den beim Objekt hinterlegten Zahlungsanbieter abgewickelt. Den passenden Betrag zur Restsumme richten Sie unter [Die Restzahlung automatisieren](/hilfe/anwendungsfaelle-zahlungen/restzahlung-automatisieren) ein.",
            },
          ],
        },
        {
          slug: "restzahlung-automatisieren",
          title: "Die Restzahlung automatisieren",
          excerpt: "So wird der offene Restbetrag automatisch vor der Anreise eingezogen.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "h2",
              text: "Ausgangslage",
            },
            {
              type: "p",
              text: "Nach einer Anzahlung bleibt ein Restbetrag offen. Statt diesen manuell nachzuverfolgen, richten Sie eine Zahlungsregel ein, die die Restzahlung automatisch zu einem festen Zeitpunkt vor der Anreise über Stripe oder PayPal einzieht.",
            },
            {
              type: "steps",
              items: [
                "Öffnen Sie im Objekt den Bereich „Zahlungsregeln“.",
                "Legen Sie eine neue Regel vom Typ „Restzahlung“ an, sofern bereits eine Anzahlungsregel besteht.",
                "Bestimmen Sie, wie viele Tage vor der Anreise die Restzahlung fällig wird.",
                "Aktivieren Sie den automatischen Einzug, damit der hinterlegte Zahlungsanbieter den Betrag selbstständig abbucht.",
                "Prüfen Sie den Status der Restzahlung anschließend in der Buchungs-Zeitleiste der jeweiligen Reservierung.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Scheitert der automatische Einzug, etwa wegen einer abgelaufenen Karte, wird die Buchung nicht automatisch storniert. Prüfen Sie fehlgeschlagene Restzahlungen zeitnah und kontaktieren Sie den Gast direkt.",
            },
          ],
        },
        {
          slug: "rueckerstattung-durchfuehren",
          title: "Eine Rückerstattung durchführen",
          excerpt: "So erstatten Sie einem Gast einen Betrag ganz oder teilweise zurück.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "h2",
              text: "Ausgangslage",
            },
            {
              type: "p",
              text: "Bei einer Stornierung oder Reklamation können Sie einem Gast den gezahlten Betrag ganz oder teilweise zurückerstatten. Die Rückerstattung läuft über denselben Zahlungsanbieter, über den ursprünglich bezahlt wurde — Stripe oder PayPal.",
            },
            {
              type: "steps",
              items: [
                "Öffnen Sie die betroffene Buchung in der Buchungs-Zeitleiste.",
                "Wählen Sie im Bereich „Zahlungen“ die ursprüngliche Zahlung aus, die erstattet werden soll.",
                "Wählen Sie zwischen vollständiger oder teilweiser Rückerstattung.",
                "Geben Sie bei einer teilweisen Rückerstattung den gewünschten Betrag ein.",
                "Bestätigen Sie die Rückerstattung und prüfen Sie den aktualisierten Zahlungsstatus in der Zeitleiste.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Eine Rückerstattung ändert nichts automatisch am Buchungsstatus oder an den belegten Kalendernächten. Prüfen Sie bei einer Stornierung zusätzlich, ob die betroffenen Nächte im Belegungsplan wieder freigegeben werden müssen.",
            },
          ],
        },
        {
          slug: "kaution-verwalten",
          title: "Eine Kaution verwalten",
          excerpt: "So richten Sie eine Kaution ein und geben sie nach dem Aufenthalt wieder frei.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "h2",
              text: "Ausgangslage",
            },
            {
              type: "p",
              text: "Eine Kaution sichert Sie gegen Schäden während des Aufenthalts ab. Sie wird als eigene Zahlungsregel hinterlegt und über Stripe oder PayPal entweder vorab autorisiert oder eingezogen, abhängig von der Konfiguration des Objekts.",
            },
            {
              type: "steps",
              items: [
                "Öffnen Sie im Objekt den Bereich „Zahlungsregeln“ und legen Sie eine Regel vom Typ „Kaution“ an.",
                "Bestimmen Sie den Kautionsbetrag und den Zeitpunkt der Autorisierung, üblicherweise kurz vor der Anreise.",
                "Prüfen Sie nach dem Check-out den Zustand des Objekts.",
                "Geben Sie die Kaution bei einwandfreiem Zustand über die Buchung vollständig frei.",
                "Erstatten Sie bei einem Schaden nur den nicht benötigten Teil und dokumentieren Sie den Grund für die Einbehaltung.",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Eine autorisierte, aber nicht eingezogene Kaution verfällt je nach Zahlungsanbieter nach einer bestimmten Frist automatisch. Geben Sie die Kaution zeitnah nach dem Check-out frei oder ziehen Sie den benötigten Betrag rechtzeitig ein.",
            },
          ],
        },
        {
          slug: "rechnung-korrigieren",
          title: "Eine Rechnung korrigieren",
          excerpt: "So korrigieren Sie eine bereits ausgestellte Rechnung nachträglich.",
          updated: "Stand: Juli 2026",
          body: [
            {
              type: "h2",
              text: "Ausgangslage",
            },
            {
              type: "p",
              text: "Enthält eine bereits ausgestellte Rechnung einen Fehler, etwa bei der Rechnungsadresse oder einer Position, korrigieren Sie sie über die Buchung, statt die ursprüngliche Rechnung einfach zu löschen.",
            },
            {
              type: "steps",
              items: [
                "Öffnen Sie die betroffene Buchung in der Buchungs-Zeitleiste und wechseln Sie zum Bereich „Rechnungen“.",
                "Wählen Sie die fehlerhafte Rechnung aus.",
                "Erstellen Sie eine Korrektur bzw. Stornorechnung zur ursprünglichen Rechnung.",
                "Legen Sie anschließend eine neue, korrigierte Rechnung mit den richtigen Angaben an.",
                "Versenden Sie die korrigierte Rechnung erneut an den Gast bzw. die Rechnungsadresse.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Eine bereits versendete Rechnung sollte aus Nachvollziehbarkeit nicht direkt überschrieben werden. Die Korrektur über eine Stornorechnung erhält den ursprünglichen Beleg und macht die Änderung nachvollziehbar.",
            },
          ],
        },
      ],
    },
  ],
};

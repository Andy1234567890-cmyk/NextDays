import type { HelpCategory } from "../types";

export const nachrichten: HelpCategory = {
  slug: "nachrichten",
  title: "Nachrichten & Gäste",
  description: "Posteingang, Vorlagen und Gästekommunikation.",
  icon: "ph:chat-circle-dots",
  collection: "kb",
  sections: [
    {
      heading: "Kommunikation",
      articles: [
        {
          slug: "posteingang",
          title: "Der Plattform-Posteingang",
          excerpt: "Alle Gäste-Nachrichten Ihrer Objekte laufen zentral im Plattform-Posteingang zusammen.",
          updated: "Stand: Juli 2026",
          body: [
            { type: "h2", text: "Ein Posteingang für alle Objekte" },
            {
              type: "p",
              text: "Der Plattform-Posteingang bündelt alle Nachrichten Ihrer Gäste an einer Stelle — unabhängig davon, über welches Objekt oder welchen Zeitraum die Konversation läuft. Sie öffnen ihn unter /nachrichten und sehen dort jede Unterhaltung als eigenen Thread.",
            },
            { type: "h2", text: "Aufbau des Posteingangs" },
            {
              type: "ul",
              items: [
                "Linke Spalte: Liste aller Konversationen, neueste zuerst",
                "Mittlere Spalte: der aktive Nachrichtenverlauf mit dem Gast",
                "Rechte Spalte: Kontext zur Reservierung — Zeitraum, Objekt, Gastdaten",
              ],
            },
            { type: "h2", text: "Auf eine Nachricht antworten" },
            {
              type: "steps",
              items: [
                "Öffnen Sie /nachrichten und wählen Sie die gewünschte Konversation",
                "Schreiben Sie Ihre Antwort im Textfeld oder nutzen Sie eine Schnellantwort",
                "Senden Sie die Nachricht — der Gast erhält sie auf demselben Weg, über den er geschrieben hat",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Der Plattform-Posteingang zeigt ausschließlich die direkte Kommunikation zwischen Ihnen und Ihren Gästen auf myNextDays — Nachrichten aus den Portalen bearbeiten Sie weiterhin dort.",
            },
          ],
        },
        {
          slug: "schnellantworten",
          title: "Schnellantworten",
          excerpt: "Vorlagen für häufige Fragen sparen Zeit im Gästekontakt.",
          updated: "Stand: Juli 2026",
          body: [
            { type: "h2", text: "Was Schnellantworten sind" },
            {
              type: "p",
              text: "Schnellantworten sind vorformulierte Textbausteine für wiederkehrende Fragen — etwa zur Anreise, zum WLAN-Passwort oder zur Parkplatzsituation. Statt jede Antwort neu zu tippen, fügen Sie die passende Vorlage mit einem Klick in den [Plattform-Posteingang](/hilfe/nachrichten/posteingang) ein.",
            },
            { type: "h2", text: "Eine Schnellantwort anlegen" },
            {
              type: "steps",
              items: [
                "Öffnen Sie /nachrichten und klicken Sie auf „Schnellantworten verwalten\"",
                "Klicken Sie auf „Neue Vorlage\" und vergeben Sie einen Titel, zum Beispiel „Check-in-Infos\"",
                "Schreiben Sie den Antworttext; Platzhalter wie Gastname oder Anreisedatum werden beim Senden automatisch eingesetzt",
                "Speichern Sie die Vorlage — sie steht ab sofort in jeder Konversation zur Verfügung",
              ],
            },
            { type: "h2", text: "Schnellantworten im Alltag nutzen" },
            {
              type: "p",
              text: "Im Nachrichtenfenster öffnen Sie die Vorlagenliste über das Blitz-Symbol, wählen die passende Antwort aus und passen sie bei Bedarf noch individuell an, bevor Sie sie absenden.",
            },
            {
              type: "note",
              variant: "tip",
              text: "Legen Sie Vorlagen für die häufigsten fünf bis zehn Fragen an — das deckt in der Praxis den Großteil der eingehenden Nachrichten ab.",
            },
          ],
        },
        {
          slug: "automatische-nachrichten",
          title: "Automatische Nachrichten",
          excerpt: "Bestätigungen, Check-in-Infos und Erinnerungen lassen sich automatisch an Gäste senden.",
          updated: "Stand: Juli 2026",
          body: [
            { type: "h2", text: "Wiederkehrende Nachrichten automatisieren" },
            {
              type: "p",
              text: "Statt Buchungsbestätigungen, Check-in-Hinweise oder Dankesnachrichten manuell zu versenden, hinterlegen Sie sie einmal als Regel — myNextDays verschickt sie dann automatisch zum passenden Zeitpunkt vor, während oder nach dem Aufenthalt.",
            },
            { type: "h2", text: "Typische Auslöser für automatische Nachrichten" },
            {
              type: "ul",
              items: [
                "Direkt nach der Buchung — Bestätigung mit den wichtigsten Eckdaten",
                "Wenige Tage vor Anreise — Check-in-Informationen und Zugangscode",
                "Am Abreisetag — Dank und Bitte um eine Bewertung",
              ],
            },
            { type: "h2", text: "Eine automatische Nachricht einrichten" },
            {
              type: "steps",
              items: [
                "Öffnen Sie /nachrichten, Abschnitt „Automatische Nachrichten\"",
                "Wählen Sie den Auslöser, zum Beispiel „X Tage vor Anreise\"",
                "Hinterlegen Sie den Text — Platzhalter wie Gastname, Objekt oder Anreisedatum werden automatisch befüllt",
                "Aktivieren Sie die Regel; sie gilt für alle Objekte, sofern nicht anders eingeschränkt",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Automatische Nachrichten erscheinen ganz normal im [Plattform-Posteingang](/hilfe/nachrichten/posteingang) und lassen sich dort jederzeit nachträglich einsehen.",
            },
          ],
        },
        {
          slug: "nachrichten-blockieren",
          title: "Nachrichten blockieren",
          excerpt: "Sie können eine Person direkt aus dem Nachrichtenverlauf heraus für weitere Kontaktaufnahme sperren.",
          updated: "Stand: Juli 2026",
          body: [
            { type: "h2", text: "Wann eine Blockierung sinnvoll ist" },
            {
              type: "p",
              text: "Bei beleidigenden Nachrichten, Belästigung oder wiederholt unangemessenem Verhalten können Sie eine Person direkt aus dem Nachrichten-Thread blockieren. Eine blockierte Person kann Ihnen danach keine neuen Nachrichten mehr schreiben und keine neue Buchung mehr bei Ihnen anlegen.",
            },
            { type: "h2", text: "Eine Person aus dem Thread blockieren" },
            {
              type: "steps",
              items: [
                "Öffnen Sie die betroffene Konversation im [Plattform-Posteingang](/hilfe/nachrichten/posteingang)",
                "Klicken Sie oben im Thread auf das Menü und wählen Sie „Person blockieren\"",
                "Bestätigen Sie den Vorgang — die Blockierung gilt sofort",
              ],
            },
            { type: "h2", text: "Was die Blockierung bedeutet — und was nicht" },
            {
              type: "ul",
              items: [
                "Neue Nachrichten der blockierten Person werden nicht mehr zugestellt",
                "Neue Buchungsanfragen der Person werden abgelehnt",
                "Läuft aktuell eine Reservierung dieser Person, bleibt die Kommunikation für die Dauer des Aufenthalts ausnahmsweise möglich",
              ],
            },
            {
              type: "note",
              variant: "warn",
              text: "Eine Blockierung lässt sich jederzeit in der Übersicht „Blockierte Personen\" im Konto wieder aufheben. Prüfen Sie vor dem Blockieren, ob bereits eine laufende Buchung besteht.",
            },
          ],
        },
      ],
    },
  ],
};

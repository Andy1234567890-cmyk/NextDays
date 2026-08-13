// Vereinbarung zur Auftragsverarbeitung (AVV/DPA) nach Art. 28 DSGVO.
//
// Wird — wie im Branchenstandard (Lodgify /dpa/, SiteMinder, Cloudbeds) — als
// Vertragsbestandteil veröffentlicht und über die AGB einbezogen, statt einzeln
// unterschrieben zu werden.
//
// Die technischen und organisatorischen Maßnahmen (Abschnitt „Sicherheit“)
// dürfen NUR enthalten, was tatsächlich umgesetzt ist. Belegt am 30.07.2026:
//   TLS + Sicherheits-Header      → next.config.ts aller Frontends
//   Mandantentrennung per RLS     → supabase/migrations (RLS + revoke-Policies)
//   Rollentrennung/Maskierung     → apps/api/src/features/auth/guest_masking.py
//   Zwei-Faktor (TOTP)            → apps/api/src/features/auth/otp_service.py
//   Anmeldeprotokoll              → apps/api/src/features/login_devices
//   Ratelimit                     → apps/api/src/core/ratelimit*.py
//   Verschlüsselte Backups + Test → deploy/backup (Borg repokey + age, restore-test.sh)
//   Connector nur durch Leitung   → apps/api/.../mcp/router.py (MANAGE_CONNECTIONS,
//                                   Rolle aus der DB, nicht aus dem JWT)
//   Freitexte nur auf Freigabe    → apps/api/.../mcp/oauth_service.py (SCOPE_FREITEXT)
//   Zugriffslog je Abruf          → supabase/migrations/0388_mcp_zugriffslog.sql
// Neue Maßnahme umgesetzt → hier nachtragen; entfällt eine → hier entfernen.
//
// Die Liste der Unterauftragsverarbeiter MUSS mit ./datenschutz.ts
// übereinstimmen — beide aus derselben Code-Realität gepflegt.
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, RECHTSSTAND } from "./anbieter";

import type { LegalDoc } from "./types";

export const avv: LegalDoc = {
  slug: "auftragsverarbeitung",
  title: "Vereinbarung zur Auftragsverarbeitung",
  metaDescription:
    "Auftragsverarbeitung nach Art. 28 DSGVO zwischen myNextDays ApS und den Betrieben, die die Plattform nutzen: Gegenstand, Weisungen, Sicherheit, Unterauftragsverarbeiter.",
  stand: RECHTSSTAND,
  numbered: true,
  toc: true,
  intro: [
    `Diese Vereinbarung (nachfolgend „AVV“) gilt zwischen dem Betrieb, der die Plattform myNextDays nutzt (nachfolgend „Verantwortlicher“), und der ${ANBIETER.firma} (nachfolgend „Auftragsverarbeiter“ oder „wir“) und konkretisiert die Pflichten aus Art. 28 der Verordnung (EU) 2016/679 (DSGVO).`,
    `Sie wird durch die [Allgemeinen Geschäftsbedingungen](${AGB_URL}) einbezogen und gilt für die gesamte Dauer der Nutzung der Plattform. Sie geht den AGB vor, soweit es um die Verarbeitung personenbezogener Daten im Auftrag geht.`,
    "Ergänzend gilt die [Datenschutzerklärung](/datenschutz) für die Daten, die wir als eigener Verantwortlicher verarbeiten — insbesondere die Daten des Kontos und der Geschäftsbeziehung.",
  ],
  sections: [
    {
      heading: "Gegenstand und Rollenverteilung",
      unterpunkte: [
        {
          paragraphs: [
            "Gegenstand ist die Verarbeitung personenbezogener Daten, die der Verantwortliche in die Plattform einbringt oder über sie erhebt, damit wir die vertraglich vereinbarten Leistungen erbringen können: Verwaltung von Objekten, Reservierungen und Belegung, Kommunikation mit Gästen, Zahlungsabwicklung, Buchhaltung und Eigentümerabrechnung, Anbindung an Buchungsportale, Website-Baukasten sowie Aufgaben- und Teamverwaltung.",
          ],
        },
        {
          paragraphs: [
            "Der Verantwortliche entscheidet über Zwecke und Mittel dieser Verarbeitung. Wir verarbeiten die Daten ausschließlich auf seine dokumentierte Weisung und nicht für eigene Zwecke.",
          ],
        },
        {
          paragraphs: [
            "Für die Daten des Kontos, der Abrechnung unserer eigenen Leistungen, der Systemsicherheit und der gesetzlichen Aufbewahrung sind wir selbst Verantwortlicher. Diese Verarbeitung ist nicht Gegenstand dieser AVV.",
          ],
        },
      ],
    },
    {
      heading: "Art, Umfang und Zweck der Verarbeitung",
      paragraphs: [
        "Verarbeitet wird durch Erheben, Speichern, Anzeigen, Verändern, Übermitteln an vom Verantwortlichen gewählte Empfänger (z. B. Buchungsportale, Zahlungsdienstleister), Einschränken und Löschen — in automatisierter Form in der Plattform.",
        "Der Verarbeitungsort ist die Europäische Union; Ausnahmen sind in Abschnitt 8 abschließend benannt.",
      ],
    },
    {
      heading: "Kategorien betroffener Personen",
      list: [
        "Gäste und Buchende, einschließlich Mitreisender",
        "Interessenten, die Anfragen stellen oder Nachrichten senden",
        "Eigentümer der verwalteten Objekte",
        "Mitarbeitende des Verantwortlichen (Team, Reinigung, Service, Rezeption)",
        "Ansprechpartner von Partnern und Dienstleistern des Verantwortlichen",
      ],
    },
    {
      heading: "Kategorien personenbezogener Daten",
      list: [
        "Stammdaten: Name, Anschrift, Geburtsdatum sofern erfasst, Nationalität sofern für die Meldepflicht erfasst",
        "Kontaktdaten: E-Mail-Adresse, Telefonnummer",
        "Buchungsdaten: Zeitraum, Objekt, Anzahl Reisender, Preise, Zusatzleistungen, Stornierungen",
        "Zahlungsdaten: Betrag, Währung, Zahlungsart, Zahlungsstatus, Referenzen (vollständige Kartendaten erreichen unsere Systeme nicht)",
        "Kommunikationsdaten: Nachrichten, Notizen, Bewertungen",
        "Zugangs- und Nutzungsdaten der Mitarbeitenden: Rolle, Berechtigungen, Anmeldezeitpunkt, Gerät und IP-Adresse der Anmeldung",
        "Besondere Kategorien nach Art. 9 DSGVO sind nicht Gegenstand des Auftrags; der Verantwortliche bringt solche Daten nicht in Freitextfelder ein.",
      ],
    },
    {
      heading: "Weisungen",
      unterpunkte: [
        {
          paragraphs: [
            "Weisungen erteilt der Verantwortliche durch die Nutzung und Konfiguration der Plattform sowie in Textform an unsere Kontaktadresse. Mündliche Weisungen bestätigen wir in Textform.",
          ],
        },
        {
          paragraphs: [
            "Halten wir eine Weisung für rechtswidrig, teilen wir dies unverzüglich mit und dürfen die Umsetzung aussetzen, bis der Verantwortliche sie bestätigt oder ändert.",
          ],
        },
        {
          paragraphs: [
            "Sind wir gesetzlich zur Verarbeitung verpflichtet (etwa gegenüber Behörden), informieren wir den Verantwortlichen vorab, soweit uns das rechtlich erlaubt ist.",
          ],
        },
        {
          titel: "Verbindung eigener Dienste des Verantwortlichen",
          paragraphs: [
            "Der Verantwortliche kann sein Konto über eine Schnittstelle mit einem Dienst verbinden, den er selbst gewählt und mit dem er einen eigenen Vertrag geschlossen hat — etwa einem KI-Assistenten. Erteilt er eine solche Verbindung, ist das seine ausdrückliche Weisung nach Art. 28 Abs. 3 Buchstabe a DSGVO, die freigegebenen Daten an diesen Dienst herauszugeben. Sie umfasst ausdrücklich auch eine damit verbundene Übermittlung in ein Drittland, wenn der Dienst seinen Sitz außerhalb der Europäischen Union hat.",
            "Kurz gesagt: Über eine solche Verbindung entscheidet allein der Verantwortliche, und für den verbundenen Dienst ist er selbst zuständig.",
            "Erteilen kann sie nur ein Konto mit der Berechtigung, externe Verbindungen zu verwalten. Diese Berechtigung ist der Rolle „Administrator“ vorbehalten; Konten mit eingeschränkten Rechten — auch die Rolle „Co-Administrator“ — können keine Verbindung erteilen. Wir zeichnen auf, wer sie wann für welchen Dienst erteilt hat, welche Datenarten freigegeben wurden und welche Abrufe erfolgt sind; diese Aufzeichnung steht dem Verantwortlichen in der Oberfläche unter „Konto → Verbindungen“ zur Verfügung, damit er seine Rechenschaftspflicht erfüllen und Auskunftsersuchen beantworten kann.",
            "Der verbundene Dienst ist kein Unterauftragsverarbeiter von uns: Wir beauftragen ihn nicht, wählen ihn nicht aus und weisen ihn nicht an. Er verarbeitet die Daten aufgrund des Vertrags, den der Verantwortliche selbst mit ihm geschlossen hat. Für diese Verarbeitung, für ihre Rechtsgrundlage und für die Garantien der Übermittlung in ein Drittland ist deshalb der Verantwortliche zuständig; sie ist nicht Gegenstand dieser AVV.",
            "Freitextfelder — Buchungsnotizen und der Inhalt von Gastnachrichten — sind von einer solchen Verbindung standardmäßig ausgenommen. Sie können besondere Kategorien personenbezogener Daten nach Art. 9 DSGVO enthalten, etwa Angaben zur Gesundheit. Der Verantwortliche muss sie bei der Erteilung gesondert freigeben; ohne diese Freigabe werden sie nicht übermittelt.",
            "Der Verantwortliche kann eine erteilte Verbindung jederzeit in der Oberfläche trennen. Die Erneuerungstoken werden dabei gelöscht, und bei jedem weiteren Abruf wird geprüft, ob die Zustimmung noch besteht — ein getrennter Dienst kann deshalb sofort nichts mehr lesen, nicht erst nach Ablauf seines Zugangstokens.",
          ],
        },
      ],
    },
    {
      heading: "Vertraulichkeit",
      paragraphs: [
        "Alle Personen, die auftragsgemäß Zugriff auf die Daten haben können, sind zur Vertraulichkeit verpflichtet und werden regelmäßig zum Datenschutz unterrichtet. Der Zugriff ist auf das für die jeweilige Aufgabe erforderliche Maß beschränkt.",
        "Zugriffe unserer Mitarbeitenden auf Kundendaten erfolgen nur zur Fehlerbehebung, auf Support-Anfrage oder zur Erfüllung gesetzlicher Pflichten.",
      ],
    },
    {
      heading: "Sicherheit der Verarbeitung",
      paragraphs: [
        "Wir treffen die nach Art. 32 DSGVO erforderlichen technischen und organisatorischen Maßnahmen. Umgesetzt sind insbesondere:",
      ],
      list: [
        "Transportverschlüsselung (TLS) für alle Verbindungen, HTTP-Sicherheits-Header inklusive strikter Content-Security-Policy",
        "Mandantentrennung unmittelbar in der Datenbank: zeilenbasierte Zugriffsregeln (Row Level Security) plus entzogene Tabellenrechte für sensible Daten, sodass ein Zugriff außerhalb des eigenen Betriebs auch auf direktem Datenbankweg ausgeschlossen ist",
        "Rollenbasierte Berechtigungen mit Datentrennung: Service- und Reinigungskräfte erhalten keine Finanz- und Vertriebsdaten, Eigentümer nur ihre eigenen Objekte; Gästedaten werden für nicht berechtigte Rollen maskiert",
        "Zwei-Faktor-Authentisierung (TOTP) für Konten verfügbar; Wiederanmeldung bei sicherheitskritischen Änderungen",
        "Protokoll der Anmeldungen mit Gerät, Zeitpunkt und IP-Adresse, einsehbar für den Verantwortlichen",
        "Verbindungen zu externen Diensten kann nur ein Konto mit der Rolle „Administrator“ erteilen; jeder Abruf über eine solche Verbindung wird protokolliert (Werkzeug, Zeitpunkt, Umfang — ohne die Inhalte selbst) und ist für den Verantwortlichen einsehbar. Eine getrennte Verbindung verliert den Zugriff sofort: bei jedem Abruf wird geprüft, ob die Zustimmung noch besteht",
        "Begrenzung der Anfragehäufigkeit gegen automatisierte Angriffe, Prüfung von Signaturen eingehender Webhook-Aufrufe",
        "Verschlüsselte, außerhalb des Produktionssystems gelagerte Sicherungskopien mit regelmäßigem Wiederherstellungstest",
        "Getrennte Umgebungen für Entwicklung und Betrieb; Änderungen an der Datenbank ausschließlich über versionierte Migrationen",
      ],
    },
    {
      heading: "Unterauftragsverarbeiter",
      paragraphs: [
        "Der Verantwortliche genehmigt den Einsatz der folgenden Unterauftragsverarbeiter. Mit jedem bestehen Verträge nach Art. 28 Abs. 4 DSGVO mit Pflichten, die dieser AVV entsprechen.",
      ],
      list: [
        "Hetzner Online GmbH, Deutschland (Server, Datenbank, Medien, Mailserver; Rechenzentrum Helsinki, Finnland)",
        "Stripe Payments Europe, Limited, Irland (Zahlungen, Auszahlungen, gesetzliche Identitätsprüfung)",
        "PayPal (Europe) S.à r.l. et Cie, S.C.A., Luxemburg (Zahlungen, sofern der Verantwortliche sie aktiviert)",
        "Channex.io Ltd, Vereinigtes Königreich (Anbindung an Buchungsportale, sofern aktiviert)",
        "Meta Platforms Ireland Limited, Irland (WhatsApp-Nachrichten, sofern aktiviert)",
        "Google Ireland Limited, Irland (Übersetzung von Inhalten; Anmeldung mit Google, sofern genutzt)",
        "Groq, Inc., USA (Antwortvorschläge im Posteingang, sofern aktiviert)",
        "Cloudflare, Inc., USA (Verwaltung der DNS-Einträge für eigene Domains, sofern genutzt)",
      ],
      unterpunkte: [
        {
          paragraphs: [
            "Einen Wechsel oder eine Ergänzung teilen wir mindestens 30 Tage vorher mit. Der Verantwortliche kann innerhalb dieser Frist aus wichtigem, datenschutzbezogenem Grund widersprechen; wird der Widerspruch nicht ausgeräumt, kann er den betroffenen Leistungsteil oder den Vertrag kündigen.",
          ],
        },
        {
          paragraphs: [
            "Dienste, die der Verantwortliche selbst mit einem Dritten vereinbart, sind keine Unterauftragsverarbeitung, sondern eine von ihm veranlasste Übermittlung. Das gilt für ein Buchungsportal, mit dem er einen eigenen Vertrag hat, ebenso wie für einen KI-Assistenten oder ein anderes Programm, das er über die Schnittstelle mit seinem Konto verbindet (siehe Abschnitt „Weisungen“).",
            "Maßgeblich ist dabei nicht, über wessen Systeme die Daten fließen, sondern wer den Dienst hinzuzieht: Eine Unterauftragsverarbeitung entsteht, wenn WIR einen weiteren Dienstleister beauftragen, um unsere Leistung zu erbringen. Wählt der Verantwortliche den Dienst selbst aus und schließt er den Vertrag mit ihm, verarbeitet dieser Dienst für den Verantwortlichen — nicht für uns. Diese Abgrenzung entspricht der Vertragspraxis vergleichbarer Anbieter für vom Kunden verbundene Drittdienste.",
          ],
        },
      ],
    },
    {
      heading: "Übermittlung in Drittländer",
      paragraphs: [
        "Übermittlungen an Empfänger außerhalb der EU beschränken sich auf die oben mit Sitz USA bzw. Vereinigtes Königreich genannten Dienste. Grundlage sind die Standarddatenschutzklauseln der Europäischen Kommission nach Art. 46 Abs. 2 lit. c DSGVO oder ein geltender Angemessenheitsbeschluss; ergänzende Schutzmaßnahmen (Verschlüsselung, Datenminimierung) werden angewandt.",
      ],
    },
    {
      heading: "Unterstützung des Verantwortlichen",
      unterpunkte: [
        {
          paragraphs: [
            "Wir unterstützen den Verantwortlichen bei der Beantwortung von Anfragen betroffener Personen (Art. 15 bis 22 DSGVO). Die Plattform bietet dafür Auskunft, Berichtigung, Export und Löschung der Daten unmittelbar in der Oberfläche. Wenden sich betroffene Personen direkt an uns, verweisen wir sie an den Verantwortlichen und informieren ihn.",
          ],
        },
        {
          paragraphs: [
            "Wir unterstützen ferner bei Datenschutz-Folgenabschätzungen, bei der Einhaltung der Pflichten aus Art. 32 bis 36 DSGVO und bei Anfragen von Aufsichtsbehörden.",
          ],
        },
      ],
    },
    {
      heading: "Verletzungen des Schutzes personenbezogener Daten",
      paragraphs: [
        "Wird uns eine Verletzung des Schutzes personenbezogener Daten bekannt, die Daten des Verantwortlichen betrifft, informieren wir ihn unverzüglich, spätestens innerhalb von 48 Stunden nach Kenntnis, in Textform.",
        "Die Mitteilung enthält, soweit bekannt, Art und Zeitpunkt des Vorfalls, betroffene Datenkategorien und Personengruppen, wahrscheinliche Folgen und die ergriffenen sowie vorgeschlagenen Maßnahmen. Wir unterstützen den Verantwortlichen bei seinen Melde- und Benachrichtigungspflichten nach Art. 33 und 34 DSGVO.",
      ],
    },
    {
      heading: "Nachweise und Kontrollen",
      unterpunkte: [
        {
          paragraphs: [
            "Wir weisen die Einhaltung dieser AVV auf Anfrage nach, insbesondere durch Auskunft über die getroffenen Maßnahmen und über die eingesetzten Unterauftragsverarbeiter.",
          ],
        },
        {
          paragraphs: [
            "Der Verantwortliche kann Kontrollen im erforderlichen Umfang durchführen oder durch einen unabhängigen, nicht mit uns im Wettbewerb stehenden Prüfer durchführen lassen. Kontrollen erfolgen nach Ankündigung mit angemessener Frist, während der üblichen Geschäftszeiten und ohne Störung des Betriebs. Den Aufwand einer über die Auskunft hinausgehenden Prüfung trägt der Verantwortliche, sofern die Prüfung nicht durch einen von uns verursachten Vorfall veranlasst ist.",
          ],
        },
      ],
    },
    {
      heading: "Löschung und Rückgabe",
      paragraphs: [
        "Nach Ende des Vertrags stellen wir die Daten des Verantwortlichen auf Anforderung innerhalb von 30 Tagen in einem gängigen, maschinenlesbaren Format zum Export bereit. Danach löschen wir die Daten einschließlich der Kopien.",
        "Ausgenommen sind Daten, für die eine gesetzliche Aufbewahrungspflicht besteht (insbesondere Rechnungs- und Buchhaltungsdaten); diese werden gesperrt und nach Ablauf der Frist gelöscht. Sicherungskopien werden mit dem regulären Rotationszyklus überschrieben.",
      ],
    },
    {
      heading: "Haftung und Rangfolge",
      paragraphs: [
        "Es gilt Art. 82 DSGVO. Im Verhältnis der Parteien gelten daneben die Haftungsregeln der AGB, soweit sie der DSGVO nicht widersprechen.",
        "Widersprechen sich AGB und diese AVV bei der Verarbeitung im Auftrag, gilt diese AVV. Wird eine Bestimmung unwirksam, bleibt der übrige Inhalt wirksam; die Parteien ersetzen sie durch eine zulässige Regelung mit gleichem Zweck.",
      ],
    },
    {
      heading: "Änderungen dieser Vereinbarung",
      paragraphs: [
        "Wir dürfen diese AVV anpassen, soweit dies durch Rechtsänderungen, Anforderungen von Aufsichtsbehörden, Vorgaben von Zahlungsdienstleistern oder technische Weiterentwicklungen erforderlich wird und der Verantwortliche dadurch nicht schlechter gestellt wird.",
        "Änderungen kündigen wir mindestens 30 Tage vor Inkrafttreten in Textform an. Widerspricht der Verantwortliche nicht innerhalb dieser Frist, gelten sie als angenommen; auf diese Folge wird in der Ankündigung hingewiesen. Bei Widerspruch kann jede Partei den Vertrag zum Zeitpunkt des Inkrafttretens kündigen.",
      ],
    },
    {
      heading: "Kontakt",
      paragraphs: [
        `Anfragen zu dieser Vereinbarung, Weisungen und Meldungen richten Sie an [${ANBIETER.email}](mailto:${ANBIETER.email}) oder an ${ANBIETER.firma}, ${ANBIETER.strasse}, ${ANBIETER.ort}, ${ANBIETER.land}.`,
      ],
    },
  ],
};

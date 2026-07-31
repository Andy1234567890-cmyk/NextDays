// Datenschutzerklärung nach Art. 13/14 DSGVO.
//
// Gilt für die Marketing-Website UND die Plattform (Dashboard, Marktplatz,
// mobile App), weil dieselbe Gesellschaft alle drei betreibt. Rollentrennung:
//   · Website-Besuch + Kundenkonto  → wir sind Verantwortlicher
//   · Gäste-/Buchungsdaten der Kunden → wir sind Auftragsverarbeiter (→ ./avv.ts)
//
// JEDER hier genannte Empfänger muss im Code tatsächlich vorkommen. Belegt am
// 30.07.2026 gegen apps/api/src:
//   Hetzner (Hosting, whois 65.21.144.136 + 62.238.4.193 → CLOUD-HEL1/FI)
//   Stripe (features/payments), PayPal (api-m.paypal.com)
//   Channex.io Ltd (features/channel_manager, Companies House 09250795)
//   Groq (features/inbox/ai.py), Google Cloud Translation (features/content)
//   Cloudflare (features/site_config/cloudflare_client.py)
//   Meta/WhatsApp (features/whatsapp/client.py → graph.facebook.com)
//   Brevo/Sendinblue (features/newsletter/brevo_client.py → api.brevo.com)
//   Iconify (marketing lädt Icons zur Laufzeit von api.iconify.design)
// Neuer ausgehender Dienst mit Personenbezug → hier nachtragen, sonst ist die
// Erklärung unvollständig (Art. 13 Abs. 1 lit. e DSGVO).
//
// OFFEN — betrieblich festzulegen: die Löschfrist der Server-Logfiles. Solange
// keine Frist konfiguriert ist, wird hier bewusst KEINE Zahl behauptet.
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, AUFSICHTSBEHOERDE, RECHTSSTAND } from "./anbieter";

import type { LegalDoc } from "./types";

export const datenschutz: LegalDoc = {
  slug: "datenschutz",
  title: "Datenschutzerklärung",
  metaDescription:
    "Wie myNextDays personenbezogene Daten verarbeitet: Zwecke, Rechtsgrundlagen, Empfänger, Speicherdauer und Ihre Rechte nach der DSGVO.",
  stand: RECHTSSTAND,
  numbered: true,
  toc: true,
  intro: [
    `Diese Erklärung beschreibt, wie die ${ANBIETER.firma} personenbezogene Daten verarbeitet — beim Besuch dieser Website, bei der Nutzung der Plattform myNextDays (Dashboard, Marktplatz und mobile App) und im Rahmen der Geschäftsbeziehung mit unseren Kunden.`,
    "Grundlage ist die Verordnung (EU) 2016/679 (DSGVO) sowie das dänische Datenschutzgesetz (databeskyttelsesloven). Wir verkaufen keine Daten, erstellen keine Profile und setzen auf unseren Websites keine Analyse-, Tracking- oder Werbedienste ein. Werblich verarbeiten wir Daten ausschließlich dort, wo Sie ausdrücklich eingewilligt haben — nämlich für unseren Newsletter (siehe Abschnitt Kommunikation), den Sie jederzeit mit einem Klick wieder abbestellen können.",
  ],
  sections: [
    {
      heading: "Verantwortlicher",
      paragraphs: [
        "Verantwortlich für die in dieser Erklärung beschriebenen Verarbeitungen ist:",
      ],
      zeilen: [
        {
          label: "Unternehmen",
          werte: [ANBIETER.firma, `CVR-nr. ${ANBIETER.cvr}`],
        },
        {
          label: "Anschrift",
          werte: [ANBIETER.strasse, ANBIETER.ort, ANBIETER.land],
        },
        {
          label: "E-Mail",
          werte: [ANBIETER.email],
          href: `mailto:${ANBIETER.email}`,
        },
        {
          label: "Telefon",
          werte: [ANBIETER.telefon],
          href: `tel:${ANBIETER.telefonE164}`,
        },
      ],
    },
    {
      heading: "Geltungsbereich und Rollen",
      unterpunkte: [
        {
          paragraphs: [
            "Für den Besuch dieser Website, für Ihr Kundenkonto und für die Abwicklung unserer Geschäftsbeziehung sind wir Verantwortlicher im Sinne von Art. 4 Nr. 7 DSGVO.",
          ],
        },
        {
          paragraphs: [
            "Für die Daten, die unsere Kunden (Vermieter, Hotels, Agenturen) in der Plattform über ihre Gäste, Eigentümer und Mitarbeiter verarbeiten, sind die Kunden Verantwortliche und wir Auftragsverarbeiter nach Art. 28 DSGVO. Die Einzelheiten stehen in der [Vereinbarung zur Auftragsverarbeitung](/auftragsverarbeitung).",
          ],
        },
        {
          paragraphs: [
            "Buchen Sie als Gast eine Unterkunft über unseren Marktplatz, verarbeiten wir Ihre Buchungs- und Kontaktdaten sowohl im eigenen Namen (Betrieb des Marktplatzes, Zahlungsabwicklung) als auch für den gastgebenden Betrieb. Ihr Beherbergungsvertrag kommt ausschließlich mit dem Betrieb zustande; dessen Datenschutzhinweise gelten daneben.",
          ],
        },
      ],
    },
    {
      heading: "Besuch dieser Website",
      unterpunkte: [
        {
          titel: "Server-Logfiles",
          paragraphs: [
            "Bei jedem Aufruf übermittelt Ihr Browser technisch notwendige Daten, die unser Webserver protokolliert: IP-Adresse, Datum und Uhrzeit, aufgerufene Adresse, übertragene Datenmenge, Statuscode, Referrer und Browserkennung. Zweck ist die Bereitstellung der Seite sowie die Erkennung und Abwehr von Angriffen und Störungen. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO; unser berechtigtes Interesse liegt im sicheren und stabilen Betrieb. Die Protokolle werden nur so lange aufbewahrt, wie dies für Betrieb und Sicherheit erforderlich ist, und nicht mit anderen Daten zusammengeführt.",
          ],
        },
        {
          titel: "Schriften",
          paragraphs: [
            "Die verwendeten Schriften sind lokal auf unserem Server eingebunden. Es findet keine Verbindung zu Google Fonts oder einem anderen Schrift-Dienst statt.",
          ],
        },
        {
          titel: "Symbole (Iconify)",
          paragraphs: [
            "Die Symbole dieser Website werden zur Laufzeit von api.iconify.design (Iconify) geladen. Dabei wird Ihre IP-Adresse an diesen Dienst übermittelt, technisch bedingt durch den Abruf. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (einheitliche Darstellung der Oberfläche). Es werden keine Cookies gesetzt und keine Inhalte Ihres Besuchs übertragen.",
          ],
        },
        {
          titel: "Keine Analyse, keine Werbung",
          paragraphs: [
            "Wir setzen keine Analyse-, Tracking- oder Werbedienste ein (kein Google Analytics, keine Pixel, keine Werbenetzwerke) und erstellen keine Profile. Welche Cookies die Plattform technisch benötigt, steht in der [Cookie-Richtlinie](/cookie-richtlinie).",
          ],
        },
      ],
    },
    {
      heading: "Kundenkonto und Nutzung der Plattform",
      paragraphs: [
        "Für die Registrierung und den Betrieb eines Kontos verarbeiten wir die Angaben, die Sie oder Ihr Betrieb eingeben: Name, Firmierung und Rechtsform, Anschrift, E-Mail-Adresse, Telefonnummer, Rolle und Berechtigungen, Registerdaten (z. B. Handelsregister- oder Umsatzsteuernummer), Bankverbindung für Auszahlungen sowie die Inhalte, die im Konto angelegt werden.",
        "Zur Absicherung des Zugangs verarbeiten wir außerdem Anmeldeprotokolle (Zeitpunkt, IP-Adresse, Gerät und Browser der Anmeldung) und — falls aktiviert — die Daten der Zwei-Faktor-Authentisierung.",
        "Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Erfüllung des Nutzungsvertrags, siehe [AGB](" +
          AGB_URL +
          ")), für die Zugangssicherung Art. 6 Abs. 1 lit. f DSGVO und für steuer- und handelsrechtliche Aufbewahrung Art. 6 Abs. 1 lit. c DSGVO.",
      ],
    },
    {
      heading: "Buchungen, Gäste- und Objektdaten",
      paragraphs: [
        "Über die Plattform werden Reservierungen, Gästedaten, Nachrichten, Aufgaben und Abrechnungen verarbeitet. Dazu gehören insbesondere Name und Kontaktdaten des Gastes, An- und Abreise, Anzahl der Reisenden, Preise und Zahlungsstatus, Nachrichtenverläufe sowie — sofern der Betrieb es erfasst — Meldedaten und Sonderwünsche.",
        "Diese Verarbeitung erfolgt im Auftrag und nach Weisung des jeweiligen Betriebs. Wir nutzen diese Daten nicht für eigene Zwecke, nicht für Werbung und nicht für das Training von KI-Modellen.",
        "Innerhalb eines Betriebs sind die Daten nach Rollen getrennt: Reinigungs- und Servicekräfte sehen keine Finanz- und Vertriebsdaten, Eigentümer nur ihre eigenen Objekte. Zwischen verschiedenen Betrieben sind die Daten technisch getrennt (mandantenbezogene Zugriffsregeln in der Datenbank).",
      ],
    },
    {
      heading: "Zahlungsabwicklung",
      unterpunkte: [
        {
          titel: "Stripe",
          paragraphs: [
            "Kartenzahlungen und Auszahlungen laufen über Stripe Payments Europe, Limited, Irland. Dabei werden die für die Zahlung erforderlichen Daten (Betrag, Währung, Zahlungsmittel, Name, E-Mail-Adresse, Buchungsreferenz) sowie für Konten unserer Kunden die gesetzlich vorgeschriebenen Identifizierungsdaten (Inhaber, wirtschaftlich Berechtigte, Ausweisdaten, Bankverbindung) an Stripe übermittelt. Vollständige Kartendaten erreichen unsere Systeme nicht. Rechtsgrundlagen sind Art. 6 Abs. 1 lit. b DSGVO und, für Identifizierungs- und Geldwäschepflichten, Art. 6 Abs. 1 lit. c DSGVO. Einzelheiten regelt die [Datenschutzerklärung von Stripe](https://stripe.com/privacy).",
          ],
        },
        {
          titel: "PayPal",
          paragraphs: [
            "Sofern der Betrieb PayPal als Zahlungsart anbietet, werden die Zahlungsdaten an PayPal (Europe) S.à r.l. et Cie, S.C.A., Luxemburg, übermittelt. Es gilt die [Datenschutzerklärung von PayPal](https://www.paypal.com/de/webapps/mpp/ua/privacy-full).",
          ],
        },
      ],
    },
    {
      heading: "Vertriebskanäle und Portale",
      paragraphs: [
        "Wenn ein Betrieb seine Objekte über Portale wie Booking.com, Airbnb oder Expedia verkauft, werden Verfügbarkeiten, Preise, Restriktionen und Buchungsdaten über unseren Anbindungsdienstleister Channex.io Ltd, Vereinigtes Königreich, mit dem jeweiligen Portal ausgetauscht. Aus dieser Richtung erhalten wir die Buchungs- und Gästedaten des Portals.",
        "Für das jeweilige Portal gelten dessen eigene Datenschutzbestimmungen; insoweit ist das Portal eigenständig verantwortlich. Rechtsgrundlage der Übermittlung ist Art. 6 Abs. 1 lit. b DSGVO in Verbindung mit dem Auftrag des Betriebs.",
      ],
    },
    {
      heading: "Kommunikation",
      unterpunkte: [
        {
          titel: "E-Mail",
          paragraphs: [
            "E-Mails im Rahmen der Nutzung (Buchungsbestätigungen, Systemnachrichten, Support, Bestätigungs- und Einladungslinks) versenden und empfangen wir über einen eigenen Mailserver, den wir selbst betreiben. Für diese Nachrichten ist kein externer Versanddienst eingebunden.",
          ],
        },
        {
          titel: "Newsletter und Voranmeldung",
          paragraphs: [
            "Auf unserer Website können Sie sich für Neuigkeiten zu myNextDays eintragen (Voranmeldung/Newsletter). Verarbeitet werden dabei Ihre E-Mail-Adresse, die Sprache und die Stelle, an der Sie sich eingetragen haben.",
            "Die Anmeldung läuft im Double-Opt-in-Verfahren: Nach dem Eintragen erhalten Sie eine E-Mail mit einem Bestätigungslink; erst mit dem Klick darauf ist die Anmeldung wirksam. Zum Nachweis der Einwilligung speichern wir den Zeitpunkt der Anmeldung und der Bestätigung, die dabei verwendete IP-Adresse, die Browserkennung sowie den Wortlaut, dem Sie zugestimmt haben. Diese Angaben dienen ausschließlich dem Nachweis nach Art. 7 Abs. 1 DSGVO und werden nicht für Werbung ausgewertet.",
            "Rechtsgrundlage ist Ihre Einwilligung nach Art. 6 Abs. 1 lit. a DSGVO; die Speicherung des Nachweises stützen wir auf Art. 6 Abs. 1 lit. c in Verbindung mit Art. 7 Abs. 1 DSGVO. Sie können die Einwilligung jederzeit mit Wirkung für die Zukunft widerrufen — über den Abmeldelink in jeder Newsletter-Mail oder formlos per E-Mail an uns. Der Widerruf berührt die Rechtmäßigkeit der bis dahin erfolgten Verarbeitung nicht.",
            "Für Verwaltung und Versand der Newsletter setzen wir Brevo (Sendinblue SAS, 106 boulevard Haussmann, 75008 Paris, Frankreich; deutsche Niederlassung: Brevo GmbH, Köpenicker Straße 126, 10179 Berlin) als Auftragsverarbeiter ein. Übermittelt werden Ihre E-Mail-Adresse und die genannten Zusatzangaben (Sprache, Quelle). Die Daten werden auf Servern innerhalb der Europäischen Union (Frankreich und Deutschland) verarbeitet; mit Brevo besteht ein Auftragsverarbeitungsvertrag nach Art. 28 DSGVO. Es gilt die [Datenschutzerklärung von Brevo](https://www.brevo.com/legal/privacypolicy/).",
            "Versenden wir einen Newsletter, misst Brevo in unserem Auftrag, ob die Nachricht geöffnet und ob enthaltene Links angeklickt wurden. Diese Messung hilft uns, Inhalt und Häufigkeit anzupassen; sie ist Teil der Einwilligung und endet mit Ihrer Abmeldung. Eine Zusammenführung mit anderen Datenquellen oder eine Profilbildung findet nicht statt.",
            "Solange die Bestätigung aussteht, wird Ihre Adresse nicht angeschrieben und nicht an Brevo übermittelt; ein nicht bestätigter Eintrag verfällt nach sieben Tagen. Nach einer Abmeldung sperren wir die Adresse für den Versand und bewahren den Einwilligungs- und Abmeldenachweis auf, solange Ansprüche daraus geltend gemacht werden können; auf Verlangen löschen wir ihn vollständig.",
          ],
        },
        {
          titel: "Nachrichten in der Plattform",
          paragraphs: [
            "Nachrichten zwischen Gast und Betrieb werden in der Plattform gespeichert, damit beide Seiten den Verlauf einsehen können. Blockiert ein Betrieb einen Gast, wird der Nachrichtenkanal gesperrt; bestehende Nachrichten bleiben zur Nachvollziehbarkeit erhalten.",
          ],
        },
        {
          titel: "WhatsApp",
          paragraphs: [
            "Nutzt ein Betrieb die WhatsApp-Anbindung, werden die Nachrichteninhalte und die Telefonnummern der Beteiligten über die WhatsApp Business Platform von Meta Platforms Ireland Limited übermittelt. Die Nutzung dieser Funktion entscheidet der Betrieb; ohne Aktivierung findet keine Übermittlung statt.",
          ],
        },
      ],
    },
    {
      heading: "Automatisierte Funktionen und KI",
      unterpunkte: [
        {
          titel: "Antwortvorschläge",
          paragraphs: [
            "Für Antwortvorschläge im Nachrichten-Posteingang setzen wir — sofern die Funktion für den Betrieb aktiviert ist — das Sprachmodell-Angebot von Groq, Inc., USA, ein. Dabei wird der jeweilige Nachrichtenkontext an den Dienst übermittelt. Vorschläge werden nicht automatisch versendet; über den Versand entscheidet immer ein Mensch. Eine automatisierte Entscheidungsfindung mit rechtlicher Wirkung im Sinne von Art. 22 DSGVO findet nicht statt.",
          ],
        },
        {
          titel: "Übersetzungen",
          paragraphs: [
            "Objekt- und Inhaltstexte können über die Cloud Translation API von Google Ireland Limited übersetzt werden. Übermittelt werden dabei die zu übersetzenden Texte; personenbezogene Daten nur, soweit sie in diesen Texten enthalten sind.",
          ],
        },
        {
          titel: "Preisempfehlungen",
          paragraphs: [
            "Für Preisempfehlungen greifen wir auf Markt-, Wetter- und Wechselkursdaten externer Quellen zu. Diese Abfragen enthalten keine personenbezogenen Daten, sondern nur Ort, Zeitraum und Objektmerkmale.",
          ],
        },
      ],
    },
    {
      heading: "Websites und Domains unserer Kunden",
      paragraphs: [
        "Erstellt ein Betrieb über den Baukasten eine eigene Website mit eigener Domain, verwalten wir die dafür nötigen DNS-Einträge über Cloudflare, Inc. Dabei werden Domain- und Konfigurationsdaten übermittelt; Besucherdaten der Kunden-Website verarbeiten wir wie in dieser Erklärung beschrieben.",
        "Für Inhalte, Impressum und Datenschutzhinweise der Kunden-Website ist der jeweilige Betrieb verantwortlich.",
      ],
    },
    {
      heading: "Hosting und Speicherung",
      paragraphs: [
        "Die Plattform, die Datenbank, die Medien und der Mailserver laufen auf Servern der Hetzner Online GmbH, Deutschland, im Rechenzentrum Helsinki (Finnland) — also innerhalb der Europäischen Union. Mit Hetzner besteht ein Auftragsverarbeitungsvertrag.",
        "Sicherungskopien werden verschlüsselt erstellt und verschlüsselt bei einem Speicheranbieter innerhalb der EU aufbewahrt.",
      ],
    },
    {
      heading: "Empfänger im Überblick",
      paragraphs: [
        "Außer den genannten Dienstleistern geben wir personenbezogene Daten nur weiter, wenn wir gesetzlich dazu verpflichtet sind (z. B. Steuerbehörden, Strafverfolgung) oder Sie bzw. der verantwortliche Betrieb es verlangen.",
      ],
      list: [
        "Hetzner Online GmbH (Deutschland/Finnland) — Hosting, Datenbank, Medien, Mailserver",
        "Stripe Payments Europe, Limited (Irland) — Zahlungen, Auszahlungen, Identitätsprüfung",
        "PayPal (Europe) S.à r.l. et Cie, S.C.A. (Luxemburg) — Zahlungen, sofern aktiviert",
        "Channex.io Ltd (Vereinigtes Königreich) — Anbindung an Buchungsportale",
        "Meta Platforms Ireland Limited (Irland) — WhatsApp-Nachrichten, sofern aktiviert",
        "Sendinblue SAS / Brevo (Frankreich, Deutschland) — Newsletter-Verwaltung und -Versand, nur bei Einwilligung",
        "Google Ireland Limited (Irland) — Übersetzungen; Anmeldung mit Google, sofern genutzt",
        "Groq, Inc. (USA) — Antwortvorschläge, sofern aktiviert",
        "Cloudflare, Inc. (USA) — DNS-Verwaltung für Kunden-Domains",
        "Iconify (api.iconify.design) — Symbole dieser Website",
      ],
    },
    {
      heading: "Übermittlung in Drittländer",
      paragraphs: [
        "Die Verarbeitung findet grundsätzlich innerhalb der EU statt. Bei den oben genannten Diensten mit Sitz außerhalb der EU kann es zu einer Übermittlung in ein Drittland kommen.",
        "Für Groq, Inc. und Cloudflare, Inc. (USA) stützen wir die Übermittlung auf die Standarddatenschutzklauseln der Europäischen Kommission nach Art. 46 Abs. 2 lit. c DSGVO, soweit sich der Empfänger nicht auf einen Angemessenheitsbeschluss (EU-US Data Privacy Framework) berufen kann.",
        "Für Channex.io Ltd (Vereinigtes Königreich) gilt der Angemessenheitsbeschluss der Europäischen Kommission für das Vereinigte Königreich; entfällt dieser, greifen die Standarddatenschutzklauseln.",
      ],
    },
    {
      heading: "Speicherdauer",
      list: [
        "Kontodaten: für die Dauer der Geschäftsbeziehung; danach Löschung, soweit keine Aufbewahrungspflicht besteht.",
        "Buchungs-, Rechnungs- und Zahlungsdaten: nach dänischem Buchführungsgesetz fünf Jahre nach Ende des Geschäftsjahres, dem sie zuzuordnen sind; bei Kunden mit Sitz in Deutschland können längere handels- und steuerrechtliche Fristen greifen.",
        "Nachrichten und Gästedaten in der Plattform: nach Weisung des verantwortlichen Betriebs, längstens bis zur Löschung durch diesen bzw. bis zum Ende des Vertrags.",
        "Newsletter: bis zum Widerruf der Einwilligung; unbestätigte Anmeldungen verfallen nach sieben Tagen. Der Einwilligungs- und Abmeldenachweis bleibt darüber hinaus erhalten, solange er als Nachweis benötigt wird.",
        "Anmeldeprotokolle und Sicherheitsereignisse: kurzfristig zur Angriffserkennung.",
        "Server-Logfiles: nur so lange, wie es für Betrieb und Sicherheit erforderlich ist.",
        "Sicherungskopien: rollierend, bis sie durch neuere Sicherungen ersetzt werden.",
      ],
    },
    {
      heading: "Ihre Rechte",
      paragraphs: [
        "Sie haben das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch gegen Verarbeitungen auf Grundlage berechtigter Interessen (Art. 21 DSGVO). Eine erteilte Einwilligung können Sie jederzeit mit Wirkung für die Zukunft widerrufen.",
        `Wenden Sie sich dafür an [${ANBIETER.email}](mailto:${ANBIETER.email}). Betreffen Ihre Daten die Nutzung der Plattform durch einen Betrieb, leiten wir Ihre Anfrage an den verantwortlichen Betrieb weiter oder unterstützen diesen bei der Beantwortung.`,
        `Sie können sich außerdem bei einer Datenschutz-Aufsichtsbehörde beschweren — zuständig für uns ist ${AUFSICHTSBEHOERDE.name}, ${AUFSICHTSBEHOERDE.strasse}, ${AUFSICHTSBEHOERDE.ort}, ${AUFSICHTSBEHOERDE.land}, [${AUFSICHTSBEHOERDE.email}](mailto:${AUFSICHTSBEHOERDE.email}). Sie können sich auch an die Aufsichtsbehörde Ihres Wohnsitzes wenden.`,
      ],
    },
    {
      heading: "Sicherheit der Verarbeitung",
      paragraphs: [
        "Wir sichern die Verarbeitung durch technische und organisatorische Maßnahmen nach Art. 32 DSGVO ab, insbesondere: durchgehende Transportverschlüsselung (TLS), mandantenbezogene Zugriffsregeln direkt in der Datenbank, rollenbasierte Berechtigungen mit Trennung von Finanz- und Servicedaten, optionale Zwei-Faktor-Authentisierung, Begrenzung von Anmeldeversuchen, verschlüsselte Sicherungskopien mit regelmäßigem Wiederherstellungstest sowie Protokollierung sicherheitsrelevanter Ereignisse.",
      ],
    },
    {
      heading: "Pflicht zur Bereitstellung",
      paragraphs: [
        "Die Angaben, die wir für Vertragsschluss, Abrechnung und gesetzliche Pflichten benötigen, sind erforderlich — ohne sie können wir die Plattform nicht bereitstellen. Alle weiteren Angaben sind freiwillig.",
      ],
    },
    {
      heading: "Änderungen dieser Erklärung",
      paragraphs: [
        "Wir passen diese Erklärung an, wenn sich die Verarbeitung, die eingesetzten Dienstleister oder die Rechtslage ändern. Es gilt jeweils die hier veröffentlichte Fassung; das Datum oben zeigt den Stand.",
      ],
    },
  ],
};

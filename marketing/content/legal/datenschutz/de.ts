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
//   Google Ireland (reCAPTCHA Enterprise, marketing/lib/captcha.ts → Skript von
//     www.google.com; lädt NUR nach Einwilligung, marketing/lib/einwilligung.ts)
//   Google Sign-In (web/lib/oauth-login.ts → GoTrue EXTERNAL_GOOGLE, Scopes
//     openid/email/profile; OAuth-Client 275621779169-p776…)
// Neuer ausgehender Dienst mit Personenbezug → hier nachtragen, sonst ist die
// Erklärung unvollständig (Art. 13 Abs. 1 lit. e DSGVO).
//
// NICHT MEHR IN DER LISTE (Stand 24.08.2026): Iconify. Die Marketing-Seite holte
// ihre Symbole früher zur Laufzeit von api.iconify.design; seit
// marketing/components/ui/icon.tsx werden sie serverseitig aus dem
// eingecheckten Satz components/ui/icon-set.ts gerendert (Generator
// scripts/generate-icon-set.mjs, das Paket @iconify-json/ph ist eine
// devDependency und wird nicht ausgeliefert). Es gibt keinen Abruf mehr, also
// auch keinen Empfänger — der Abschnitt „Symbole“ sagt das ausdrücklich, damit
// die Zeile nicht aus einer alten Fassung zurückkehrt.
//
// Der Abschnitt „US CLOUD Act" ist Pflichtinhalt für den Google-OAuth-
// Zustimmungsbildschirm (Google prüft die verlinkte Erklärung). NICHT zu
// verwechseln: CLOUD Act = US-Recht; EU Data Act (VO 2023/2854) = Cloud-
// Wechsel/Portabilität; Cloud and AI Development Act = EU-Vorschlag vom
// 03.06.2026, noch nicht in Kraft. Ein „EU Cloud Act" existiert nicht.
//
// OFFEN — betrieblich festzulegen: die Löschfrist der Server-Logfiles. Solange
// keine Frist konfiguriert ist, wird hier bewusst KEINE Zahl behauptet.
import { AGB_URL } from "@/lib/app-url";

import { ANBIETER, AUFSICHTSBEHOERDE, DATENSCHUTZ_STAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const datenschutz: LegalDoc = {
  slug: "datenschutz",
  title: "Datenschutzerklärung",
  metaDescription:
    "Wie myNextDays personenbezogene Daten verarbeitet: Zwecke, Rechtsgrundlagen, Empfänger, Speicherdauer und Ihre Rechte nach der DSGVO.",
  standIso: DATENSCHUTZ_STAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Diese Erklärung beschreibt, wie die ${ANBIETER.firma} personenbezogene Daten verarbeitet — beim Besuch dieser Website, bei der Nutzung der Plattform myNextDays (Dashboard, Marktplatz und mobile App) und im Rahmen der Geschäftsbeziehung mit unseren Kunden.`,
    "Grundlage ist die Verordnung (EU) 2016/679 (DSGVO) sowie das dänische Datenschutzgesetz (databeskyttelsesloven). Wir verkaufen keine Daten und erstellen keine Profile, die Sie als Person identifizieren. Auf dieser Website messen wir — nur mit Ihrer Einwilligung — die Reichweite unserer Seiten und den Erfolg unserer Werbung; beide Kategorien sind einzeln abwählbar (siehe Abschnitte Reichweitenmessung sowie Werbung und Erfolgsmessung). Werblich verarbeiten wir Daten ausschließlich dort, wo Sie ausdrücklich eingewilligt haben — nämlich für unseren Newsletter (siehe Abschnitt Kommunikation), den Sie jederzeit mit einem Klick wieder abbestellen können.",
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
          titel: "Symbole",
          paragraphs: [
            "Die Symbole dieser Website liegen ebenso wie die Schriften bei uns: Sie werden auf unserem Server in die Seite eingesetzt und nicht von einem Symbol-Dienst nachgeladen. Es findet dabei keine Verbindung zu einem Dritten statt, und Ihre IP-Adresse wird an niemanden übermittelt.",
          ],
        },
        {
          titel: "Spamschutz des Kontaktformulars (reCAPTCHA)",
          paragraphs: [
            "Unser Kontaktformular ist gegen automatisierte Massenzuschriften mit reCAPTCHA Enterprise der Google Ireland Limited geschützt. Nur wenn Sie dem zustimmen, lädt Ihr Browser beim Ausfüllen des Formulars ein Skript von www.google.com; dabei werden Ihre IP-Adresse und Angaben zu Ihrer Interaktion mit dem Formular an Google übermittelt und dort ausgewertet, um Mensch und Skript zu unterscheiden. Rechtsgrundlage ist Art. 6 Abs. 1 lit. a DSGVO (Einwilligung); ergänzend gilt die [Datenschutzerklärung von Google](https://policies.google.com/privacy).",
            "Ohne Ihre Einwilligung wird nichts von Google geladen und es fließen keine Daten dorthin; das Formular nehmen wir dann nicht an, Sie können uns aber jederzeit eine E-Mail schreiben. Erteilen Sie sie, setzt reCAPTCHA ein eigenes Cookie („_GRECAPTCHA“, Laufzeit von Google festgelegt, bis zu sechs Monate), das der Risikobewertung dient. Ihre Einwilligung können Sie jederzeit über das Cookie-Symbol unten links auf jeder Seite ändern oder widerrufen; das Cookie wird dann gelöscht.",
          ],
        },
        {
          titel: "Reichweitenmessung (Google Analytics)",
          paragraphs: [
            "Auf dieser Website messen wir mit Google Analytics 4 der Google Ireland Limited, wie unsere Seiten genutzt werden — welche Seiten aufgerufen werden, woher Besucher kommen und an welcher Stelle sie abbrechen. Zweck ist ausschließlich die Verbesserung von Angebot und Auffindbarkeit.",
            "Geladen wird ausschließlich mit Ihrer Einwilligung. Erteilen Sie sie, lädt Ihr Browser ein Skript von www.googletagmanager.com und speichert zwei Cookies („_ga“ und „_ga_<Kennung>“, Laufzeit bis zu zwei Jahre) mit einer zufällig erzeugten Kennung; übermittelt werden diese Kennung, die aufgerufenen Seiten, Verweisquelle, ungefährer Standort auf Länder- bzw. Regionsebene, Gerät und Browser sowie Ihre IP-Adresse, die Google vor jeder Speicherung kürzt. Rechtsgrundlage ist Art. 6 Abs. 1 lit. a DSGVO (Einwilligung).",
            "Wir haben die Auswertung ausdrücklich eingeschränkt: Google-Signale und Werbe-Personalisierung sind abgeschaltet. Es entstehen daher keine geräteübergreifenden Profile und keine Zielgruppen für Werbung, und wir geben keine Nutzungsdaten an Werbenetzwerke weiter. Eine Zusammenführung mit Ihrem Kundenkonto findet nicht statt.",
            "Google verarbeitet die Daten als unser Auftragsverarbeiter auf Grundlage eines Vertrags nach Art. 28 DSGVO (Google Ads Data Processing Terms). Die Kürzung Ihrer IP-Adresse erfolgt auf Servern in der EU, bevor Daten in die USA übertragen werden; übermittelt wird also ein pseudonymer Datensatz. Grundlage der Übermittlung ist der Angemessenheitsbeschluss der EU-Kommission zum EU-US Data Privacy Framework (Art. 45 DSGVO), unter dem Google LLC zertifiziert ist; ergänzend hat Google die Standardvertragsklauseln der EU-Kommission (Art. 46 DSGVO) einbezogen. Wir weisen ausdrücklich darauf hin, dass US-Behörden nach Section 702 FISA auch auf Daten zertifizierter Unternehmen zugreifen können und ein Restrisiko daher nicht vollständig auszuschließen ist. Es gilt zusätzlich die [Datenschutzerklärung von Google](https://policies.google.com/privacy).",
            "Speicherdauer: Die ereignis- und nutzerbezogenen Daten werden in unserer Property nach 14 Monaten automatisch gelöscht; aggregierte Berichtsdaten ohne Bezug zu einzelnen Besuchern bleiben darüber hinaus erhalten. Ihre Einwilligung selbst läuft nach sechs Monaten ab.",
            "Ohne Ihre Einwilligung wird nichts geladen, es wird kein Cookie gesetzt und es fließen keine Daten zu Google. Sie können Ihre Einwilligung jederzeit über das Cookie-Symbol unten links auf jeder Seite widerrufen; die Messung endet dann sofort und die genannten Cookies werden gelöscht. Nach sechs Monaten fragen wir erneut.",
          ],
        },
        {
          titel: "Werbung und Erfolgsmessung",
          paragraphs: [
            "Mit Ihrer Einwilligung setzen wir Marketing-Cookies ein, um den Erfolg unserer Werbung zu messen und Ihnen passende Anzeigen auf anderen Plattformen zu zeigen. Beteiligt sind Meta Platforms Ireland (Meta-Pixel, Cookie „_fbp“), LinkedIn Ireland (Insight-Tag, Cookies „li_gc“ und „bcookie“) und Google Ireland Limited (Google Ads, Cookie „_gcl_au“). Rechtsgrundlage ist Art. 6 Abs. 1 lit. a DSGVO. Ohne Ihre Einwilligung wird keines dieser Skripte geladen und kein Cookie gesetzt; bei Widerruf löschen wir sie. Einzelheiten zu jedem Cookie stehen in der [Cookie-Richtlinie](/cookie-richtlinie).",
          ],
        },
      ],
    },
    {
      heading: "Kundenkonto und Nutzung der Plattform",
      paragraphs: [
        "Für die Registrierung und den Betrieb eines Kontos verarbeiten wir die Angaben, die Sie oder Ihr Betrieb eingeben: Name, Firmierung und Rechtsform, Anschrift, E-Mail-Adresse, Telefonnummer, Rolle und Berechtigungen, Registerdaten (z. B. Handelsregister- oder Umsatzsteuernummer), Bankverbindung für Auszahlungen sowie die Inhalte, die im Konto angelegt werden.",
        "Zur Absicherung des Zugangs verarbeiten wir außerdem Anmeldeprotokolle (Zeitpunkt, IP-Adresse, Gerät und Browser der Anmeldung) und — falls aktiviert — die Daten der Zwei-Faktor-Authentisierung.",
        "Anmeldung mit Google: Sie können sich statt mit E-Mail und Passwort auch mit einem Google-Konto anmelden. Wählen Sie diesen Weg, erhalten wir von Google Ireland Limited ausschließlich Ihre E-Mail-Adresse, Ihren Namen, Ihr Profilbild und eine Kennung Ihres Google-Kontos (Bereiche „openid“, „email“, „profile“) — ausdrücklich keinen Zugriff auf Ihre E-Mails, Kontakte, Dateien oder Kalender. Ihr Google-Passwort erfahren wir nicht. Google verarbeitet den Anmeldevorgang dabei als eigener Verantwortlicher; es gilt die [Datenschutzerklärung von Google](https://policies.google.com/privacy). Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO, da die Anmeldung der Vertragserfüllung dient; die Wahl dieses Anmeldewegs ist freiwillig und jederzeit durch die Anmeldung mit E-Mail und Passwort ersetzbar.",
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
            "Zahlungslinks für Zusatzleistungen: Stellt ein Betrieb seinem Gast eine Zusatzleistung (z. B. Reinigung oder Wäsche) über einen Zahlungslink in Rechnung, führt dieser Link auf eine von Stripe betriebene Zahlungsseite. Wir übermitteln dafür an Stripe die Bezeichnung der Leistung, den Betrag, die Währung sowie eine interne Referenz auf Buchung und Betrieb; das Firmenlogo des Betriebs wird an dessen Stripe-Konto übertragen, damit die Seite seine Marke zeigt. Auf der Zahlungsseite selbst erhebt Stripe die Zahlungs- und Gerätedaten des Gastes in eigener Verantwortlichkeit. An uns zurück gelangen nur der Zahlungsstatus, der Betrag, die einbehaltenen Beträge und die Kennungen der Zahlung — keine Kartendaten.",
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
      paragraphs: [
        "Für die hier beschriebenen Funktionen gilt neben der DSGVO die Verordnung (EU) 2024/1689 (KI-Verordnung, „AI Act“), deren Transparenzpflichten nach Art. 50 seit dem 2. August 2026 anwendbar sind.",
      ],
      unterpunkte: [
        {
          titel: "Antwortvorschläge",
          paragraphs: [
            "Für Antwortvorschläge im Nachrichten-Posteingang setzen wir — sofern die Funktion für den Betrieb aktiviert ist — das Sprachmodell-Angebot von Groq, Inc., USA, ein. Dabei wird der jeweilige Nachrichtenkontext an den Dienst übermittelt. Vorschläge werden nicht automatisch versendet; über den Versand entscheidet immer ein Mensch. Eine automatisierte Entscheidungsfindung mit rechtlicher Wirkung im Sinne von Art. 22 DSGVO findet nicht statt.",
            "Es handelt sich damit nicht um ein KI-System, das im Sinne von Art. 50 Abs. 1 der KI-Verordnung unmittelbar mit natürlichen Personen interagiert: Die Verpflichtung setzt eine DIREKTE Interaktion voraus, bei der die KI selbst mit der Person kommuniziert und nicht über einen menschlichen Vermittler. Hier schlägt die Funktion dem Betrieb einen Text vor, den ein Mitarbeiter prüft, ändern kann und selbst absendet — der Mitarbeiter ist dieser Vermittler, der Gast korrespondiert mit dem Betrieb und nicht mit einem Chatbot. Ein Assistent, der Gästen selbsttätig antwortet, ist nicht im Einsatz; der Produktberater auf dieser Website (siehe unten) betrifft ausschließlich Interessenten und keine Gästekommunikation. Nach unserer Einordnung erfüllt die Funktion auch keinen der Tatbestände für Hochrisiko-KI nach Anhang III der KI-Verordnung.",
            "Nachrichten an Gäste sind zudem kein „Text über Angelegenheiten von öffentlichem Interesse“ im Sinne von Art. 50 Abs. 4 der KI-Verordnung: Sie werden nicht veröffentlicht, sondern individuell an eine bestimmte Person gesendet, und betreffen die Abwicklung eines Aufenthalts. Unabhängig davon greift hier die menschliche Prüfung durch den absendenden Mitarbeiter.",
            "Sollte künftig eine Funktion angeboten werden, die selbsttätig — ohne menschliche Freigabe — an Gäste antwortet, wird der Gast zu Beginn des Dialogs sichtbar darauf hingewiesen, dass er mit einem KI-System schreibt. Ohne diesen Hinweis wird eine solche Funktion nicht bereitgestellt.",
          ],
        },
        {
          titel: "Produktberater auf dieser Website",
          paragraphs: [
            "Auf dieser Website beantwortet ein KI-gestützter Produktberater Fragen zu unserer Software. Er greift ausschließlich auf öffentlich verfügbare Inhalte dieser Website zurück (Hilfe-Artikel, Funktionsbeschreibungen, häufige Fragen, Rechtstexte) sowie auf die aktuellen Preise aus unserer Abrechnung. Kundendaten, Buchungen oder Gästedaten stehen ihm nicht zur Verfügung.",
            "Anders als bei den Antwortvorschlägen im Posteingang antwortet dieser Berater UNMITTELBAR und ohne menschliche Freigabe. Er ist damit ein KI-System im Sinne von Art. 50 Abs. 1 der KI-Verordnung, das direkt mit natürlichen Personen interagiert. Sie werden deshalb zu Beginn des Dialogs sichtbar darauf hingewiesen, dass die Antworten von einem KI-Assistenten stammen und Fehler enthalten können.",
            "Verarbeitet werden dabei Ihre Frage und die gewählte Sprache. Beides wird zur Beantwortung an Google Cloud (Vertex AI) in der Region europe-west4 (Niederlande) übermittelt; eine Verarbeitung außerhalb der EU findet dabei nicht statt. Wir speichern die Fragen nicht dauerhaft und verwenden sie nicht zum Training von KI-Modellen. Rechtsgrundlage ist unser berechtigtes Interesse an einer schnellen Auskunft für Interessenten (Art. 6 Abs. 1 lit. f DSGVO).",
            "Kann der Berater eine Frage nicht aus den vorhandenen Inhalten beantworten, bietet er die Weiterleitung an unseren Support an. Erst dann — und nur, wenn Sie das Formular ausfüllen — erheben wir Name, E-Mail-Adresse und optional Ihre Telefonnummer; diese Angaben verarbeiten wir nach den Regeln im Abschnitt „Kommunikation“.",
          ],
        },
        {
          titel: "Rollen nach der KI-Verordnung",
          paragraphs: [
            "Für die im Produkt eingebauten KI-Funktionen sind wir Betreiber im Sinne von Art. 3 Nr. 4 der KI-Verordnung; Anbieter der zugrunde liegenden Sprachmodelle sind die jeweiligen Modellanbieter. Nutzt ein Betrieb diese Funktionen im Rahmen seiner beruflichen Tätigkeit, ist er dafür seinerseits Betreiber und trifft ihn die Pflicht zur KI-Kompetenz nach Art. 4 der KI-Verordnung, die seit dem 2. Februar 2025 unabhängig von der Unternehmensgröße gilt. Seit dem 27. Juli 2026 gilt sie in der Fassung der Verordnung (EU) 2026/1744: Anbieter und Betreiber ergreifen Maßnahmen, um die Entwicklung der KI-Kompetenz ihres Personals zu unterstützen; ein bestimmtes Niveau muss dabei ausdrücklich nicht garantiert werden. Wir unterstützen durch Hinweise in der Anwendung und in unserem Hilfe-Center; die Schulung der eigenen Mitarbeitenden bleibt Aufgabe des Betriebs.",
            "Verbindet ein Betrieb sein Konto mit einem eigenen KI-Assistenten (siehe den folgenden Punkt), ist er auch dafür Betreiber im Sinne der KI-Verordnung — er entscheidet über den Einsatz und formuliert die Anfragen. Die Schnittstelle selbst ist kein KI-System: sie liest Daten aus der Datenbank und gibt sie aus, ohne Ableitungen zu treffen; Erwägungsgrund 12 der KI-Verordnung grenzt solche Systeme ausdrücklich von KI ab.",
          ],
        },
        {
          titel: "Verbindung mit einem eigenen KI-Assistenten",
          paragraphs: [
            "Ein Betrieb kann sein Konto über eine Schnittstelle mit einem KI-Assistenten verbinden, den er selbst gewählt hat und mit dem er einen eigenen Vertrag hat — etwa Claude von Anthropic PBC, USA. Ist eine solche Verbindung erteilt, kann der Assistent auf Anfrage des Betriebs lesend abrufen: Belegung, Verfügbarkeit und Tagespreise; Buchungen mit Gastname, Aufenthaltszeitraum, Objekt, Buchungskanal, Status sowie Betrag und Währung, soweit die Rolle des abfragenden Kontos Beträge sehen darf; und die Übersicht der Konversationen im Posteingang. Ohne eine erteilte Verbindung findet keine Übermittlung statt.",
            "Nicht übermittelt werden dabei E-Mail-Adresse und Telefonnummer der Gäste, Kartendaten, Bankverbindungen und Zahlungsbelege, Zugangscodes sowie Objektdossiers. Buchungsnotizen und der Inhalt von Gastnachrichten sind standardmäßig ausgenommen, weil sie Angaben zur Gesundheit oder andere besondere Kategorien nach Art. 9 DSGVO enthalten können; der Betrieb muss sie bei der Erteilung ausdrücklich und gesondert freigeben.",
            "Die Verbindung kann nur ein Konto mit der Rolle „Administrator“ erteilen, nicht jedes Konto mit Zugang. Jeder Abruf wird protokolliert und ist für den Betrieb unter „Konto → Verbindungen“ einsehbar; er kann die Verbindung dort jederzeit trennen, und der Zugriff endet damit sofort.",
            "Rechtlich ist diese Übermittlung eine Weisung des Betriebs an uns (Art. 28 Abs. 3 Buchstabe a DSGVO). Der Anbieter des Assistenten ist kein Unterauftragsverarbeiter von uns — wir beauftragen ihn nicht und weisen ihn nicht an; er verarbeitet die Daten aufgrund des Vertrags, den der Betrieb selbst mit ihm geschlossen hat. Für die Rechtsgrundlage dieser Verarbeitung, für die Information seiner Gäste und für die Garantien einer Übermittlung in ein Drittland ist deshalb der Betrieb verantwortlich.",
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
      heading: "Partnerprogramm",
      paragraphs: [
        "Wir betreiben ein Partnerprogramm, über das Partner (Influencer, Berater, Agenturen, Kunden) Betriebe an myNextDays empfehlen und dafür eine Provision erhalten. Dabei verarbeiten wir Daten von Partnern und — in geringem Umfang — von empfohlenen Betrieben.",
      ],
      unterpunkte: [
        {
          titel: "Daten der Partner",
          paragraphs: [
            "Bei der Bewerbung verarbeiten wir Name, Firma, Rechtsform, Land, E-Mail-Adresse, Sprache, Social-Media-Konten (Plattform, Adresse, Handle, selbst angegebene Reichweite), Umsatzsteuer-Identifikationsnummer (Prüfung über das EU-System VIES), Auszahlungsdaten (IBAN, Wise- oder PayPal-Adresse) sowie die Zustimmung zu den Teilnahmebedingungen mit Version und Zeitpunkt. Rechtsgrundlage ist die Durchführung des Partnervertrags (Art. 6 Abs. 1 lit. b DSGVO); für Gutschriften und Aufbewahrung gelten die steuer- und handelsrechtlichen Pflichten (Art. 6 Abs. 1 lit. c DSGVO).",
            "Führt ein Partner ein Team, sieht er von seinen Team-Partnern Name bzw. Firma, Rang, Anzahl zahlender Kunden und die daraus entstehende Team-Provision. Nachrichten zwischen Sponsor und Team-Partner werden in der Plattform gespeichert, damit beide den Verlauf sehen.",
          ],
        },
        {
          titel: "Klicks auf Partner-Links",
          paragraphs: [
            "Ruft ein Besucher einen Partner-Link (mynextdays.com/p/CODE) auf, speichern wir den Code, den Zeitpunkt, die aufgerufene Seite, die verweisende Seite und etwaige Kampagnenparameter sowie IP-Adresse und Browserkennung ausschließlich als gekürzte Prüfsummen (Hash) — zur Missbrauchserkennung (Häufungen), nicht zur Wiedererkennung. Ein Tracking-Cookie wird nicht gesetzt. Klickdaten löschen wir nach 90 Tagen. Rechtsgrundlage ist unser berechtigtes Interesse an einer betrugssicheren Abrechnung des Programms (Art. 6 Abs. 1 lit. f DSGVO).",
          ],
        },
        {
          titel: "Verbundene Social-Media-Konten und Beiträge",
          paragraphs: [
            "Partner können ihre Konten bei YouTube (Google), Instagram und Facebook (Meta) sowie TikTok freiwillig mit dem Partner-Dashboard verbinden. Dabei erteilen sie der jeweiligen Plattform eine Lesefreigabe (OAuth); wir schreiben nichts in diese Konten. Wir speichern die Kennung und den Namen des Kontos, das Zugangstoken verschlüsselt, den Zeitpunkt der Verbindung sowie täglich einen Messwert je Konto: Follower- bzw. Abonnentenzahl, Aufrufe der letzten 28 Tage, Interaktionsrate und Anzahl der Beiträge, jeweils mit dem Zeitpunkt der Plattformantwort. Zu Beiträgen, die der Partner im Dashboard anlegt (Titel, Plattform, Adresse, Veröffentlichungsdatum), speichern wir zusätzlich Aufrufe, Likes, Kommentare, Teilungen und Speicherungen aus der Plattform.",
            "Zweck ist die Prüfung der vom Partner angegebenen Reichweite und die Zuordnung von Klicks und Kunden zu einzelnen Beiträgen; unverifizierte Angaben werden bei der Freigabe geringer gewichtet. Hinweise auf Unstimmigkeiten (etwa ein Follower-Sprung ohne passende Aufrufe) dienen ausschließlich der manuellen Prüfung durch uns und führen zu keiner automatisierten Entscheidung. Rechtsgrundlage ist die Einwilligung des Partners (Art. 6 Abs. 1 lit. a DSGVO), die er durch das Verbinden erteilt und im Dashboard unter „Verbindung trennen“ jederzeit widerrufen kann; beim Trennen löschen wir das Zugangstoken sofort, gespeicherte Messwerte bleiben als Verlauf erhalten und werden mit dem Partnerkonto gelöscht. Wir nutzen ausschließlich die offiziellen Schnittstellen der Plattformen; für die Verarbeitung durch Google, Meta und TikTok gelten deren eigene Datenschutzhinweise.",
          ],
        },
        {
          titel: "Empfohlene Betriebe",
          paragraphs: [
            "Registriert sich ein Betrieb mit einem Partner-Code, speichern wir die Zuordnung des Betriebs zum Partner sowie Zeitpunkt, Weg (Link oder Code) und Status. Der Partner sieht den Betrieb ausschließlich pseudonym (laufende Nummer, Land, Status, Beträge) — nie Name, E-Mail-Adresse oder Buchungsdaten. Nur wenn der Betrieb bei der Registrierung ausdrücklich zustimmt, darf ihn der Partner über die Plattform kontaktieren. Für die Provisionsabrechnung verarbeiten wir die Netto-Abo-Beträge der bezahlten Rechnungen des Betriebs; Rechtsgrundlage ist die Durchführung des Partner- und des Nutzungsvertrags (Art. 6 Abs. 1 lit. b DSGVO).",
          ],
        },
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
        "Google Ireland Limited (Irland) — Übersetzungen; Spamschutz des Kontaktformulars (reCAPTCHA Enterprise), nur bei Einwilligung; Reichweitenmessung (Google Analytics 4), nur bei Einwilligung; Anmeldung mit Google, sofern genutzt",
        "Groq, Inc. (USA) — Antwortvorschläge, sofern aktiviert",
        "Cloudflare, Inc. (USA) — DNS-Verwaltung für Kunden-Domains",
      ],
      unterpunkte: [
        {
          paragraphs: [
            "Nicht in dieser Liste stehen Dienste, die ein Betrieb selbst mit einem Dritten vereinbart und über die Schnittstelle mit seinem Konto verbindet — etwa ein KI-Assistent wie Claude von Anthropic PBC, USA. Sie sind keine von uns beauftragten Dienstleister, sondern Empfänger auf Weisung des jeweiligen Betriebs; ohne dessen Verbindung fließen dorthin keine Daten. Anthropic ist nach der offiziellen Teilnehmerliste des US-Handelsministeriums nicht unter dem EU-US Data Privacy Framework zertifiziert; eine Übermittlung stützt sich daher auf die Standarddatenschutzklauseln, für die der jeweilige Betrieb als Verantwortlicher einzustehen hat.",
          ],
        },
      ],
    },
    {
      heading: "Übermittlung in Drittländer",
      paragraphs: [
        "Die Verarbeitung findet grundsätzlich innerhalb der EU statt. Bei den oben genannten Diensten mit Sitz außerhalb der EU kann es zu einer Übermittlung in ein Drittland kommen.",
        "Für Groq, Inc. und Cloudflare, Inc. (USA) stützen wir die Übermittlung auf die Standarddatenschutzklauseln der Europäischen Kommission nach Art. 46 Abs. 2 lit. c DSGVO, soweit sich der Empfänger nicht auf einen Angemessenheitsbeschluss (EU-US Data Privacy Framework) berufen kann.",
        "Vertragspartner der Zahlungsabwicklung ist Stripe Payments Europe, Limited (Irland). Soweit Stripe dabei auf die Stripe, LLC (USA) zurückgreift, ist diese unter dem EU-US Data Privacy Framework zertifiziert; die Übermittlung stützt sich insoweit auf den Angemessenheitsbeschluss der Europäischen Kommission nach Art. 45 DSGVO. Ergänzend gelten die Standarddatenschutzklauseln aus dem [Stripe-Auftragsverarbeitungsvertrag](https://stripe.com/legal/dpa).",
        "Für Channex.io Ltd (Vereinigtes Königreich) gilt der Angemessenheitsbeschluss der Europäischen Kommission für das Vereinigte Königreich; entfällt dieser, greifen die Standarddatenschutzklauseln.",
      ],
    },
    {
      heading: "Behördlicher Zugriff durch Drittstaaten (US CLOUD Act)",
      paragraphs: [
        "Anbieter, die einer US-amerikanischen Rechtshoheit unterliegen, können nach dem US-amerikanischen CLOUD Act (Clarifying Lawful Overseas Use of Data Act, 2018) verpflichtet werden, Daten an US-Behörden herauszugeben — auch dann, wenn diese Daten auf Servern innerhalb der Europäischen Union liegen. Ein solcher Zugriff kann im Widerspruch zur DSGVO stehen, und der Anbieter kann rechtlich daran gehindert sein, uns oder Sie darüber zu informieren. Weder der Angemessenheitsbeschluss zum EU-US Data Privacy Framework noch die Standarddatenschutzklauseln schließen dieses Risiko aus.",
        "Wir begrenzen dieses Risiko, indem die tragenden Systeme — Plattform, Datenbank, Medien, Mailserver und Sicherungskopien — bei europäischen Anbietern innerhalb der EU betrieben werden und dort keine US-Rechtshoheit greift.",
      ],
      unterpunkte: [
        {
          titel: "Betroffene Dienste",
          paragraphs: [
            "Eine US-Rechtshoheit kommt ausschließlich bei den folgenden, klar abgegrenzten Zusatzdiensten in Betracht:",
          ],
          list: [
            "Groq, Inc. (USA) — Antwortvorschläge im Nachrichten-Posteingang, nur wenn der Betrieb die Funktion aktiviert. Übermittelt wird der jeweilige Nachrichtenkontext.",
            "Cloudflare, Inc. (USA) — DNS-Verwaltung für Kunden-Domains. Übermittelt werden Domain- und Konfigurationsdaten, keine Gästedaten.",
            "Google LLC (USA) — bei der Anmeldung mit Google, bei Übersetzungen und bei der Reichweitenmessung (Google Analytics 4, nur mit Einwilligung); Vertragspartner ist jeweils die Google Ireland Limited, ein Zugriff der US-Muttergesellschaft ist dennoch nicht ausgeschlossen.",
          ],
        },
        {
          titel: "Vermeidbarkeit",
          paragraphs: [
            "Die Nutzung der Plattform ist ohne diese Dienste möglich: die Antwortvorschläge sind abschaltbar, die DNS-Verwaltung betrifft nur Kunden mit eigener Domain, und die Anmeldung mit Google ist eine freiwillige Alternative zur Anmeldung mit E-Mail und Passwort.",
          ],
        },
        {
          titel: "Abgrenzung zu europäischem Recht",
          paragraphs: [
            "Der CLOUD Act ist US-amerikanisches Recht, kein Recht der Europäischen Union. Er ist zu unterscheiden vom EU Data Act (Verordnung (EU) 2023/2854), der Wechsel und Portabilität bei Datenverarbeitungsdiensten regelt, sowie vom Cloud and AI Development Act, der sich zum Stand dieser Erklärung im europäischen Gesetzgebungsverfahren befindet.",
          ],
        },
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
      // Eigener Abschnitt, weil Google Play ihn abgleicht: die Löschseite muss
      // in der Datenschutzerklärung genannt sein und dieselbe Adresse tragen
      // wie im Datensicherheitsformular. Ein Abschnitt „Ihre Rechte", der die
      // Löschung nur als DSGVO-Artikel erwähnt, genügt der Prüfung nicht —
      // gefordert ist der konkrete, benannte Weg.
      heading: "Konto und App-Daten löschen",
      paragraphs: [
        "Die Löschung Ihres Kontos können Sie jederzeit selbst beantragen — in der App unter ‚Profil → Konto‘ oder über unser Formular im Web:",
        "[mynextdays.com/konto-loeschen](https://mynextdays.com/konto-loeschen)",
        "Der Weg im Web funktioniert bewusst auch dann, wenn Sie die App nicht mehr installiert haben oder sich nicht mehr anmelden können. Zum Schutz vor Missbrauch geschieht das in zwei Schritten: Sie tragen die E-Mail-Adresse Ihres Kontos ein und erhalten an genau diese Adresse einen Bestätigungslink. Erst dessen Aufruf macht den Antrag gültig — eine eingetragene Adresse allein bewirkt nichts. Wir bearbeiten den Antrag innerhalb von 30 Tagen und antworten per E-Mail.",
        "Mit dem Konto löschen wir Ihre Zugangsdaten, Ihr Profil, Ihre Objekt- und Kalenderdaten sowie Ihre Nachrichten. Nicht gelöscht werden Unterlagen, für die eine gesetzliche Aufbewahrungspflicht besteht — insbesondere Rechnungen und Buchungsbelege abgerechneter Zeiträume (Buchführungspflicht nach dänischem Recht, in der Regel fünf Jahre). Diese Unterlagen werden für die Dauer der Frist gesperrt, also ausschließlich zur Erfüllung dieser Pflicht aufbewahrt und danach gelöscht.",
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

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts):
// jede der 24 Sprachfassungen exportiert ihr Dokument so. Der benannte
// Export bleibt daneben stehen, damit bestehende Importe nicht brechen.
export default datenschutz;

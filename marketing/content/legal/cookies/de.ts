// Cookie-Richtlinie.
//
// Die aufgeführten Cookies sind die TATSÄCHLICH gesetzten — belegt am
// 30.07.2026 im Code:
//   nd_access / nd_refresh  → packages/auth/src/server.ts (jar.set), Namen aus
//                             web/lib/auth.ts + plattform/lib/guest-session.ts
//   nd_locale               → web/i18n/locales.ts (LOCALE_COOKIE)
//   sidebar_state           → packages/ui/src/sidebar.tsx
//   sb-…                    → Supabase-OAuth-Session bei „Anmelden mit Google“
//   nd_voice_consent        → web/lib/voice-consent.ts (localStorage, kein Cookie)
//   nd_consent              → marketing/lib/einwilligung.ts (localStorage, kein
//                             Cookie — die Entscheidung wird nur im Browser
//                             gebraucht, ein Cookie ginge bei jedem Aufruf mit)
//   nd_support_token        → marketing/lib/support.ts (localStorage, kein
//                             Cookie; nur wenn der Besucher den Chat öffnet)
// Diese Marketing-Website selbst setzt KEINE Cookies.
// Neues Cookie/neuer Speicherwert im Frontend → hier nachtragen.
//
// Stand 24.08.2026: Der Abschnitt „Warum es kein Cookie-Banner gibt“ ist
// entfallen. Es gibt jetzt eine Einwilligungs-Leiste — nicht für Cookies,
// sondern für den EINEN externen Dienst dieser Seite (reCAPTCHA am
// Kontaktformular, marketing/lib/captcha.ts). Wer den Abschnitt wieder
// einfügt, macht die Richtlinie unwahr.
import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const cookies: LegalDoc = {
  slug: "cookie-richtlinie",
  title: "Cookie-Richtlinie",
  metaDescription:
    "Welche Cookies myNextDays setzt: ausschließlich technisch notwendige und funktionale Cookies, keine Tracking- oder Werbe-Cookies.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Diese Richtlinie erklärt, welche Cookies und vergleichbaren Speichertechniken die ${ANBIETER.firma} auf dieser Website und in der Plattform myNextDays einsetzt.`,
    "Kurz gefasst: Wir verwenden ausschließlich technisch notwendige und funktionale Cookies. Es gibt keine Analyse-, Werbe- oder Tracking-Cookies und keine Weitergabe von Nutzungsdaten an Werbenetzwerke.",
  ],
  sections: [
    {
      heading: "Was Cookies sind",
      paragraphs: [
        "Cookies sind kleine Textdateien, die eine Website im Browser speichert. Sie ermöglichen es, eine Sitzung wiederzuerkennen — zum Beispiel damit Sie nach dem Anmelden angemeldet bleiben. Neben Cookies nutzen Browser weitere Speicher wie Local Storage, die technisch ähnlich funktionieren.",
      ],
    },
    {
      heading: "Wofür wir Ihre Einwilligung brauchen",
      paragraphs: [
        "Eine Einwilligung ist nach § 9 der dänischen Cookie-Bekendtgørelse (Umsetzung von Art. 5 Abs. 3 der Richtlinie 2002/58/EG) nur nötig, wenn ein Zugriff auf Ihr Gerät nicht ausschließlich der Übermittlung einer Nachricht dient oder für einen ausdrücklich angeforderten Dienst unbedingt erforderlich ist.",
        "Alle Cookies, die wir setzen, sind für die Anmeldung, die Sicherheit der Sitzung oder eine von Ihnen selbst getroffene Einstellung erforderlich — dafür fragen wir nichts ab und setzen umgekehrt auch nichts, was eine Einwilligung bräuchte.",
        "Einwilligen müssen Sie für genau eine Sache: den Spamschutz unseres Kontaktformulars. Er kommt von Google (reCAPTCHA Enterprise), ist also ein externer Dienst, und wird ausschließlich dann geladen, wenn Sie ihn erlaubt haben. Dafür fragt eine Leiste am unteren Bildschirmrand — beim ersten Besuch, mit gleichrangigen Knöpfen für Ablehnen und Annehmen und ohne Vorauswahl. Solange Sie nicht entschieden haben, gilt „nicht erlaubt“.",
        "Ihre Entscheidung liegt im Speicher Ihres Browsers (Local Storage, Wert „nd_consent“); sie enthält nur die Kategorie, den Zeitpunkt und eine Fassungsnummer, keine Kennung Ihrer Person. Über das Cookie-Symbol unten links auf jeder Seite können Sie sie jederzeit ändern oder widerrufen. Nach sechs Monaten fragen wir erneut — eine Einwilligung soll nicht unbegrenzt weitergelten.",
      ],
    },
    {
      heading: "Diese Website",
      paragraphs: [
        "Die Marketing-Website setzt keine Cookies. Schriften und Symbole liegen auf unserem eigenen Server — es wird dafür kein Symbol- oder Schrift-Dienst eines Dritten aufgerufen. Der einzige externe Dienst dieser Seite ist der Spamschutz des Kontaktformulars, und der lädt nur mit Ihrer Einwilligung. Einzelheiten stehen in der [Datenschutzerklärung](/datenschutz).",
      ],
    },
    {
      heading: "Cookies der Plattform",
      paragraphs: [
        "Sobald Sie sich im Dashboard, im Marktplatz oder in der mobilen Ansicht anmelden, werden folgende Cookies gesetzt:",
      ],
      unterpunkte: [
        {
          titel: "nd_access — Anmeldung (technisch notwendig)",
          list: [
            "Zweck: weist Ihre angemeldete Sitzung gegenüber dem Server aus.",
            "Inhalt: kurzlebiges Zugangstoken; nur für den Server lesbar (HttpOnly), nur über HTTPS übertragen.",
            "Laufzeit: Sitzung bzw. Ablauf des Tokens.",
          ],
        },
        {
          titel: "nd_refresh — Sitzungsverlängerung (technisch notwendig)",
          list: [
            "Zweck: erneuert das Zugangstoken, damit Sie nicht ständig neu angemeldet werden müssen.",
            "Inhalt: Erneuerungstoken; HttpOnly, nur über HTTPS.",
            "Laufzeit: bis zur Abmeldung oder zum Ablauf.",
          ],
        },
        {
          titel: "nd_locale — Sprachwahl (funktional)",
          list: [
            "Zweck: merkt sich die von Ihnen gewählte Sprache.",
            "Inhalt: Sprachkürzel, z. B. „de“ oder „en“.",
            "Laufzeit: bis zur Änderung oder zum Löschen.",
          ],
        },
        {
          titel: "sidebar_state — Seitenleiste (funktional)",
          list: [
            "Zweck: merkt sich, ob die Navigationsleiste ein- oder ausgeklappt ist.",
            "Inhalt: „true“ oder „false“.",
            "Laufzeit: bis zur Änderung oder zum Löschen.",
          ],
        },
        {
          titel: "sb-… — Anmeldung mit Google (technisch notwendig, nur bei Nutzung)",
          list: [
            "Zweck: hält die Sitzung, wenn Sie sich über Google anmelden.",
            "Inhalt: Sitzungstoken des Anmeldedienstes.",
            "Laufzeit: Sitzung bzw. Ablauf des Tokens. Wird nur gesetzt, wenn Sie die Google-Anmeldung wählen.",
          ],
        },
      ],
    },
    {
      heading: "Local Storage",
      unterpunkte: [
        {
          titel: "nd_consent",
          paragraphs: [
            "Hält Ihre Entscheidung über den Spamschutz des Kontaktformulars fest, damit die Einwilligungs-Leiste nicht bei jedem Aufruf erneut fragt. Gespeichert werden nur die Kategorie, der Zeitpunkt und eine Fassungsnummer. Der Wert verlässt Ihr Gerät nicht und wird nicht an unseren Server übertragen; er gilt für diesen Browser. Laufzeit: sechs Monate — danach fragt die Leiste erneut. Löschen Sie den Wert, fragt sie beim nächsten Besuch wieder.",
          ],
        },
        {
          titel: "nd_support_token",
          paragraphs: [
            "Wird nur gesetzt, wenn Sie den Chat auf dieser Website selbst öffnen und eine Nachricht senden. Er ist der Schlüssel zu Ihrer eigenen Unterhaltung — ohne ihn fänden Sie nach einem Seitenwechsel unsere Antwort nicht wieder. Er enthält keine Angaben über Sie und wird nur für diesen Zweck verwendet.",
          ],
        },
        {
          titel: "nd_voice_consent",
          paragraphs: [
            "Speichert im Browser, ob Sie der Nutzung der Spracheingabe zugestimmt haben, damit die Zustimmung nicht bei jedem Aufruf erneut abgefragt wird. Der Wert verlässt Ihr Gerät nicht.",
          ],
        },
      ],
    },
    {
      heading: "Cookies der mobilen App",
      paragraphs: [
        "Die mobile App arbeitet nicht mit Cookies. Zugangs- und Erneuerungstoken werden im gesicherten Schlüsselspeicher des Geräts (iOS Keychain, Android Keystore) abgelegt und beim Abmelden gelöscht.",
      ],
    },
    {
      heading: "Cookies Dritter",
      paragraphs: [
        "Wenn Sie eine Zahlung durchführen, kann der Zahlungsdienstleister (Stripe oder PayPal) auf seiner eigenen Seite Cookies setzen, die für die Abwicklung und Betrugsprävention erforderlich sind. Dafür gelten die Bestimmungen des jeweiligen Anbieters.",
        "Auf Websites, die Betriebe mit unserem Baukasten erstellen, entscheidet der jeweilige Betrieb über zusätzliche Cookies und ist für die dortigen Hinweise verantwortlich.",
      ],
    },
    {
      heading: "Cookies löschen und steuern",
      paragraphs: [
        "Sie können Cookies jederzeit in den Einstellungen Ihres Browsers löschen oder blockieren. Blockieren Sie die notwendigen Cookies, ist eine Anmeldung an der Plattform technisch nicht möglich — die öffentliche Website und der Marktplatz bleiben ohne Anmeldung nutzbar.",
        "Beim Abmelden entfernen wir die Anmelde-Cookies selbst.",
      ],
    },
    {
      heading: "Änderungen dieser Richtlinie",
      paragraphs: [
        "Kommen Funktionen hinzu, die weitere Cookies benötigen, aktualisieren wir diese Liste. Es gilt jeweils die hier veröffentlichte Fassung; das Datum oben zeigt den Stand.",
      ],
    },
  ],
};

// Default-Export ist die Schnittstelle des Loaders (content/legal/laden.ts):
// jede der 24 Sprachfassungen exportiert ihr Dokument so. Der benannte
// Export bleibt daneben stehen, damit bestehende Importe nicht brechen.
export default cookies;

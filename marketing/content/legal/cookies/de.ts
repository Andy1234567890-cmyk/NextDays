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
//   _ga / _ga_<Kennung>     → Google Analytics 4 (marketing/lib/analytics.ts),
//                             NUR nach Einwilligung „statistik"; von Google
//                             gesetzt, nicht von uns. Widerruf löscht sie.
// Von sich aus setzt diese Marketing-Website KEINE Cookies.
// Neues Cookie/neuer Speicherwert im Frontend → hier nachtragen.
//
// Stand 24.08.2026: Der Abschnitt „Warum es kein Cookie-Banner gibt“ ist
// entfallen. Es gibt jetzt eine Einwilligungs-Leiste. Wer den Abschnitt wieder
// einfügt, macht die Richtlinie unwahr.
//
// Stand 26.08.2026: Die Leiste schaltet ZWEI Dienste — reCAPTCHA am
// Kontaktformular (marketing/lib/captcha.ts) UND die Reichweitenmessung
// (marketing/lib/analytics.ts). Bis dahin stand hier „keine Analyse-Cookies“;
// das war mit dem Einbau von GA4 unwahr geworden und ist mitgeändert. Bei einer
// Rechtsseite ist eine überholte Zusicherung der gefährlichere Fehler: sie
// sieht aus, als wäre sie geprüft.
import { ANBIETER, RECHTSSTAND_ISO } from "../anbieter";

import type { LegalDoc } from "../types";

export const cookies: LegalDoc = {
  slug: "cookie-richtlinie",
  title: "Cookie-Richtlinie",
  metaDescription:
    "Welche Cookies myNextDays setzt: technisch notwendige Cookies sowie — nur mit Ihrer Einwilligung — funktionale, analytische und Marketing-Cookies. Jede Kategorie ist einzeln an- und abschaltbar.",
  standIso: RECHTSSTAND_ISO,
  numbered: true,
  toc: true,
  intro: [
    `Diese Richtlinie erklärt, welche Cookies und vergleichbaren Speichertechniken die ${ANBIETER.firma} auf dieser Website und in der Plattform myNextDays einsetzt.`,
    "Kurz gefasst: Notwendig sind allein die Cookies, ohne die die Website nicht wie angefordert funktioniert. Alles Weitere braucht Ihre Einwilligung und lädt ohne sie nicht — der Spamschutz unseres Kontaktformulars, die Reichweitenmessung und die Marketing-Cookies, mit denen wir den Erfolg unserer Werbung messen. Sie können jede dieser Kategorien einzeln erlauben oder ablehnen und Ihre Entscheidung jederzeit widerrufen.",
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
        "Einwilligen müssen Sie für drei Kategorien, die alle ohne Ihre Erlaubnis nicht geladen werden: den Spamschutz unseres Kontaktformulars (reCAPTCHA von Google), die Reichweitenmessung dieser Website (Google Analytics 4) und die Marketing-Cookies (Meta, LinkedIn, Google Ads). Dafür fragt ein Fenster mit einer Kategorie-Liste — beim ersten Besuch, ohne Vorauswahl, jede Kategorie mit eigenem Schalter. Solange Sie nicht entschieden haben, gilt „nicht erlaubt“, und es wird weder ausgewertet noch geworben.",
        "Ihre Entscheidung liegt im Speicher Ihres Browsers (Local Storage, Wert „nd_consent“); sie enthält nur die Kategorie, den Zeitpunkt und eine Fassungsnummer, keine Kennung Ihrer Person. Über das Cookie-Symbol unten links auf jeder Seite können Sie sie jederzeit ändern oder widerrufen. Nach sechs Monaten fragen wir erneut — eine Einwilligung soll nicht unbegrenzt weitergelten.",
      ],
    },
    {
      heading: "Diese Website",
      paragraphs: [
        "Von sich aus setzt diese Website keine Cookies. Schriften und Symbole liegen auf unserem eigenen Server — es wird dafür kein Symbol- oder Schrift-Dienst eines Dritten aufgerufen. Hinzu kommen nur die Dienste, die Sie erlauben: der Spamschutz des Kontaktformulars, die Reichweitenmessung und die Marketing-Dienste. Welche Cookies dabei gesetzt werden, mit welcher Laufzeit und auf welchem Host, steht unten im Abschnitt „Cookies Dritter“. Widerruf über das Cookie-Symbol unten links — der jeweilige Dienst endet sofort und seine Cookies werden gelöscht. Einzelheiten stehen in der [Datenschutzerklärung](/datenschutz).",
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
          titel:
            "sb-… — Anmeldung mit Google (technisch notwendig, nur bei Nutzung)",
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
            "Hält Ihre Entscheidung über die einwilligungspflichtigen Dienste fest — den Spamschutz des Kontaktformulars und die Reichweitenmessung —, damit die Einwilligungs-Leiste nicht bei jedem Aufruf erneut fragt. Gespeichert werden nur die Kategorien, der Zeitpunkt und eine Fassungsnummer. Der Wert verlässt Ihr Gerät nicht und wird nicht an unseren Server übertragen; er gilt für diesen Browser. Laufzeit: sechs Monate — danach fragt die Leiste erneut. Löschen Sie den Wert, fragt sie beim nächsten Besuch wieder.",
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
        "Nur mit Ihrer Einwilligung setzen Google-Dienste auf dieser Website die folgenden Cookies — die Reichweitenmessung zwei, der Spamschutz eines. Ohne Ihre Einwilligung wird das jeweilige Skript nicht geladen und keines dieser Cookies gesetzt; bei Widerruf löschen wir sie.",
      ],
      unterpunkte: [
        {
          titel:
            "_fbp — Erfolgsmessung der Werbung (Einwilligung erforderlich)",
          list: [
            "Zweck: ordnet Ihren Besuch einer Werbeanzeige zu, damit wir den Erfolg unserer Kampagnen messen können.",
            "Inhalt: eine zufällig erzeugte Kennung; keine Namens-, E-Mail- oder Kontoangaben von uns.",
            "Anbieter: Meta Platforms Ireland Limited, Merrion Road, Dublin 4, Irland.",
            "Host: mynextdays.com (Erstanbieter-Cookie, von Metas Skript gesetzt). Laufzeit: etwa drei Monate.",
          ],
        },
        {
          titel:
            "_gcl_au — Erfolgsmessung Google Ads (Einwilligung erforderlich)",
          list: [
            "Zweck: ordnet Ihren Besuch einer Google-Anzeige zu, damit wir den Erfolg unserer Kampagnen messen können.",
            "Inhalt: eine zufällig erzeugte Kennung ohne Bezug zu Ihrer Person.",
            "Anbieter: Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland.",
            "Host: mynextdays.com (Erstanbieter-Cookie). Laufzeit: etwa drei Monate.",
          ],
        },
        {
          titel:
            "li_gc und bcookie — LinkedIn-Werbung (Einwilligung erforderlich)",
          list: [
            "Zweck: kennzeichnet Ihren Browser gegenüber LinkedIn, damit Anzeigen und deren Erfolg zugeordnet werden können; li_gc speichert zusätzlich Ihre dortige Einwilligung.",
            "Inhalt: eine Browser-Kennung sowie der Einwilligungsstand; keine Angaben aus Ihrem Konto bei uns.",
            "Anbieter: LinkedIn Ireland Unlimited Company, Wilton Plaza, Dublin 2, Irland.",
            "Host: linkedin.com (Drittanbieter-Cookies). Laufzeit: etwa sechs Monate bzw. ein Jahr.",
          ],
        },
        {
          titel:
            "_GRECAPTCHA — Spamschutz des Kontaktformulars (Einwilligung erforderlich)",
          list: [
            "Host: www.google.com (Drittanbieter-Cookie).",
            "Zweck: erlaubt Google die Risikobewertung, mit der automatisierte Massenzuschriften von echten Anfragen unterschieden werden.",
            "Inhalt: eine von Google erzeugte Kennung für diese Bewertung; keine Namens-, E-Mail- oder Kontoangaben von uns.",
            "Anbieter: Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland.",
            "Laufzeit: von Google festgelegt, bis zu sechs Monate. Gesetzt wird es erst, wenn Sie den Spamschutz erlaubt und das Kontaktformular geöffnet haben.",
          ],
        },
        {
          titel: "_ga — Reichweitenmessung (Einwilligung erforderlich)",
          list: [
            "Host: mynextdays.com (Erstanbieter-Cookie, von Googles Skript gesetzt).",
            "Zweck: unterscheidet Besucher, damit wiederkehrende Aufrufe nicht doppelt gezählt werden.",
            "Inhalt: zufällig erzeugte Kennung ohne Bezug zu Ihrer Person; keine Namens-, E-Mail- oder Kontoangaben.",
            "Anbieter: Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland.",
            "Laufzeit: bis zu zwei Jahre.",
          ],
        },
        {
          titel:
            "_ga_<Kennung> — Sitzungsstand der Messung (Einwilligung erforderlich)",
          list: [
            "Host: mynextdays.com (Erstanbieter-Cookie, von Googles Skript gesetzt).",
            "Zweck: hält fest, wann Ihr aktueller Besuch begonnen hat, damit Seitenaufrufe einer Sitzung zusammengehören.",
            "Inhalt: Zeitstempel und Zähler der Sitzung; die Kennung im Namen bezeichnet unsere Property, nicht Sie.",
            "Anbieter: Google Ireland Limited.",
            "Laufzeit: bis zu zwei Jahre.",
          ],
        },
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

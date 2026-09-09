// Darstellung eines Nachrichtenverlaufs — EINE Wahrheit für den OTA-Posteingang
// (components/inbox/inbox-list.tsx) und den WhatsApp-Chat
// (components/inbox/whatsapp-panel.tsx). Beide zeigen dieselben Threads in
// derselben Liste; ohne gemeinsame Formatierung sieht derselbe Verlauf je nach
// Kanal anders aus (vorher: hier „1.8.2026, 14:51:44", dort nur die Uhrzeit).
//
// Vorbild sind Lodgify und Hostaway: Tage werden mit einem Trenner gegliedert,
// unter der Blase steht nur noch die Uhrzeit.

/**
 * Vorschautext einer Nachricht, die NUR aus Bildern besteht.
 *
 * Der Server speichert dieses Kürzel in `portal_messages.body` (die Spalte ist
 * NOT NULL) statt eines fertigen Satzes: er kennt die Sprache des Betrachters
 * nicht. Die Worte macht die Oberfläche über `inbox.attachmentPreview`.
 *
 * Muss mit `NUR_ANHANG_TEXT` in
 * `apps/api/.../channel_manager/common.py` übereinstimmen.
 */
export const NUR_ANHANG_TEXT = "[attachment]";

/**
 * Vorschau-Kürzel des Ende-zu-Ende-verschlüsselten Eigentümer-Chats (0611).
 *
 * Hier ist der Grund ein anderer als bei `NUR_ANHANG_TEXT`: Der Server kennt
 * den Inhalt NICHT — er hat nur Chiffretext (ADR-0029). Eine echte Vorschau
 * ist also unmöglich, nicht bloß sprachlich unpassend.
 *
 * Müssen mit `inbox/eigentuemer.py` übereinstimmen.
 */
export const E2E_VORSCHAU = "[e2e]";
export const E2E_VORSCHAU_BILD = "[e2e_bild]";

/** Der Kanalname des Eigentümer-Chats — kein Vertriebskanal, eigenes Kürzel. */
export const EIGENTUEMER_KANAL = "[eigentuemer]";

/**
 * Kanalname einer Threadzeile → i18n-Schlüssel, oder `null` für „unverändert".
 *
 * Wie `vorschauSchluessel` eine EINE Stelle: Der Kanalname steht an mehreren
 * Orten (Listenabzeichen, Gesprächskopf), und ohne gemeinsame Auflösung kennt
 * die eine ihn und die andere zeigt das rohe Kürzel.
 */
export function kanalSchluessel(name: string | null): string | null {
  return name === EIGENTUEMER_KANAL ? "eigentuemerKanal" : null;
}

/**
 * Vorschautext einer Threadzeile → i18n-Schlüssel, oder `null` für „unverändert
 * anzeigen".
 *
 * EINE Stelle für alle Kürzel: Sonst prüft jede Liste ihre eigene Teilmenge,
 * und ein neues Kürzel steht in der einen Oberfläche als Wort, in der anderen
 * roh — genau so stand „None" in der Glocke.
 */
export function vorschauSchluessel(text: string | null): string | null {
  if (text === NUR_ANHANG_TEXT) return "attachmentPreview";
  if (text === E2E_VORSCHAU) return "e2eVorschau";
  if (text === E2E_VORSCHAU_BILD) return "e2eVorschauBild";
  return null;
}

/** Nur die Uhrzeit unter der Blase — das Datum steht im Tages-Trenner. */
export function uhrzeit(iso: string, locale: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

/**
 * Datum UND Uhrzeit ausgeschrieben — für den `title`-Tooltip am Zeitstempel.
 *
 * Unter der Blase steht bewusst nur „16:19"; das Datum trägt der Tages-Trenner.
 * Bei einer langen Nachricht ist dieser Trenner aber weit nach oben gescrollt,
 * und dann sagt „16:19" allein nicht, von welchem Tag die Nachricht stammt.
 * Der Tooltip beantwortet das, ohne die Zeile zu überladen.
 */
export function zeitpunktLang(iso: string, locale: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString(locale, {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
}

/** Beginnt mit dieser Nachricht ein neuer Kalendertag? */
export function tagWechsel(vorher: string | null, jetzt: string | null): boolean {
  if (!jetzt) return false;
  if (!vorher) return true;
  const a = new Date(vorher);
  const b = new Date(jetzt);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return false;
  return a.toDateString() !== b.toDateString();
}

/**
 * „Heute" / „Gestern" / „Donnerstag, 26. März 2026" für den Tages-Trenner.
 * `t` liefert die beiden Wörter aus dem inbox-Namensraum, damit hier keine
 * deutschen Festwerte stehen.
 */
export function tagLabel(
  iso: string | null,
  locale: string,
  t: (key: string) => string,
): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const heute = new Date();
  const gestern = new Date(heute);
  gestern.setDate(heute.getDate() - 1);
  if (d.toDateString() === heute.toDateString()) return t("today");
  if (d.toDateString() === gestern.toDateString()) return t("yesterday");
  return d.toLocaleDateString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

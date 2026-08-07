// Darstellung eines Nachrichtenverlaufs — EINE Wahrheit für den OTA-Posteingang
// (components/inbox/inbox-list.tsx) und den WhatsApp-Chat
// (components/inbox/whatsapp-panel.tsx). Beide zeigen dieselben Threads in
// derselben Liste; ohne gemeinsame Formatierung sieht derselbe Verlauf je nach
// Kanal anders aus (vorher: hier „1.8.2026, 14:51:44", dort nur die Uhrzeit).
//
// Vorbild sind Lodgify und Hostaway: Tage werden mit einem Trenner gegliedert,
// unter der Blase steht nur noch die Uhrzeit.

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

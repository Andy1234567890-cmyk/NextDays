// Kataloge für „Sprache & Währung": Anzeigewährung und Zeitzone.
//
// Beides aus der Laufzeit statt aus gepflegten Listen — dieselbe Lehre wie bei
// den Ländernamen: Eine handgepflegte Liste lief zwangsläufig gegen die DB
// auseinander und zeigte am Ende rohe Kürzel.
//
// Wichtig zur Abgrenzung: Das hier ist die ANZEIGEWÄHRUNG des Nutzers. Sie
// ersetzt NIE die Objektwährung (`properties.currency`) oder die Währung einer
// Buchung — Preise werden weiter in ihrer echten Währung geführt (Wurzel 4).

/** Währungen, die Airbnb im Konto anbietet, plus die Märkte aus unseren
 *  Steuerregeln. Bewusst eine kuratierte Liste und nicht „alle ISO-4217":
 *  Intl kennt keine Aufzählung aller Codes, und eine Auswahl aus 300 Einträgen
 *  wäre für den Nutzer schlechter als eine aus 40. */
const WAEHRUNGS_CODES = [
  "AUD", "BRL", "BGN", "CAD", "CLP", "CNY", "COP", "CRC", "CZK", "DKK",
  "EGP", "EUR", "GBP", "HKD", "HUF", "IDR", "ILS", "INR", "JPY", "KES",
  "KRW", "KZT", "MAD", "MXN", "MYR", "NGN", "NOK", "NZD", "PEN", "PHP",
  "PLN", "QAR", "RON", "RUB", "SAR", "SEK", "SGD", "THB", "TRY", "TWD",
  "UAH", "USD", "UYU", "VND", "ZAR",
] as const;

export interface Waehrung {
  code: string;
  /** „Euro (€)" — Name aus Intl, Symbol nur wenn es sich vom Code
   *  unterscheidet (bei CHF & Co. wäre „CHF (CHF)" albern). */
  label: string;
}

function waehrungsName(code: string, sprache: string): string {
  const name = new Intl.DisplayNames([sprache], {
    type: "currency",
    fallback: "code",
  }).of(code);
  if (!name || name === code) return code;

  // Symbol ermitteln, indem aus einer formatierten Null die Ziffern entfernt
  // werden — Intl bietet keinen direkten Weg dazu.
  const symbol = new Intl.NumberFormat(sprache, {
    style: "currency",
    currency: code,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
    .format(0)
    .replace(/[\d\s .,]/g, "");

  return symbol && symbol !== code ? `${name} (${symbol})` : `${name} (${code})`;
}

export function waehrungen(sprache = "de"): Waehrung[] {
  return WAEHRUNGS_CODES.map((code) => ({
    code,
    label: waehrungsName(code, sprache),
  })).sort((a, b) => a.label.localeCompare(b.label, sprache));
}

/** Anzeige einer einzelnen Währung; unbekannte Codes kommen unverändert
 *  zurück statt einen erfundenen Namen zu bekommen. */
export function waehrungLabel(code: string | null, sprache = "de"): string | null {
  if (!code) return null;
  return waehrungsName(code.toUpperCase(), sprache);
}

export interface Zeitzone {
  id: string;
  /** „(GMT+01:00) Berlin" — wie bei Airbnb, damit der Versatz sichtbar ist. */
  label: string;
}

/** Alle IANA-Zonen mit aktuellem UTC-Versatz, nach Versatz sortiert.
 *
 *  `supportedValuesOf` liefert die echte Zonenliste der Laufzeit — dieselbe
 *  Quelle, gegen die der DB-Trigger prüft. Damit kann die Auswahl keinen Wert
 *  anbieten, den der Server ablehnt. */
export function zeitzonen(sprache = "de"): Zeitzone[] {
  const ids = Intl.supportedValuesOf("timeZone");
  const jetzt = new Date();

  return ids
    .map((id) => {
      const teile = new Intl.DateTimeFormat("en-US", {
        timeZone: id,
        timeZoneName: "longOffset",
      }).formatToParts(jetzt);
      const roh =
        teile.find((t) => t.type === "timeZoneName")?.value ?? "GMT+00:00";
      // „GMT+1" → „GMT+01:00", damit die Sortierung stimmt und die Breite
      // gleich bleibt.
      const m = /GMT([+-])(\d{1,2}):?(\d{2})?/.exec(roh);
      const vorzeichen = m?.[1] === "-" ? -1 : 1;
      const stunden = Number(m?.[2] ?? 0);
      const minuten = Number(m?.[3] ?? 0);
      const versatz = vorzeichen * (stunden * 60 + minuten);
      const anzeige = `GMT${m?.[1] ?? "+"}${String(stunden).padStart(2, "0")}:${String(
        minuten,
      ).padStart(2, "0")}`;
      // Nur den Ortsteil zeigen: „Europe/Berlin" → „Berlin".
      const ort = id.split("/").slice(1).join(" · ").replace(/_/g, " ") || id;
      return { id, versatz, label: `(${anzeige}) ${ort}` };
    })
    .sort(
      (a, b) =>
        a.versatz - b.versatz || a.label.localeCompare(b.label, sprache),
    )
    .map(({ id, label }) => ({ id, label }));
}

/** Anzeige einer einzelnen Zone; unbekannte IDs kommen unverändert zurück. */
export function zeitzoneLabel(id: string | null): string | null {
  if (!id) return null;
  return zeitzonen().find((z) => z.id === id)?.label ?? id;
}

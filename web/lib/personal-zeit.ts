// Zeitzonen-Helfer des Personalbereichs (rein, ohne "use server").
//
// Dieselbe Trennung wie im Aufgabenkalender: gespeichert wird UTC, gedacht
// wird in der Zone des Betriebs bzw. Objekts. Kalendertag, Uhrzeit und
// Verschieben um ganze Tage passieren deshalb IN der Zone — sonst kippt eine
// 08:00-Schicht am Tag der Zeitumstellung auf 07:00 oder 09:00.

function teile(iso: string, zone: string): Record<string, string> {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const aus: Record<string, string> = {};
  for (const p of fmt.formatToParts(new Date(iso))) aus[p.type] = p.value;
  return aus;
}

/** Kalendertag (yyyy-MM-dd) eines UTC-Zeitpunkts in der Zone. */
export function tagInZone(iso: string, zone: string): string {
  const p = teile(iso, zone);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Uhrzeit „HH:mm" eines UTC-Zeitpunkts in der Zone. */
export function uhrzeitInZone(iso: string, zone: string): string {
  const p = teile(iso, zone);
  return `${p.hour}:${p.minute}`;
}

/** Minuten seit Mitternacht (Ortszeit). */
export function minutenInZone(iso: string, zone: string): number {
  const p = teile(iso, zone);
  return Number(p.hour) * 60 + Number(p.minute);
}

/**
 * UTC-ISO für „Datum + Uhrzeit in der Zone". Iterativ über den Versatz, weil
 * `Intl` nur die Richtung UTC → Zone kennt; zwei Runden reichen auch am Tag
 * der Zeitumstellung.
 */
export function utcFuerOrtszeit(tag: string, uhrzeit: string, zone: string): string {
  const [h, m] = uhrzeit.split(":").map(Number);
  let schaetzung = Date.UTC(
    Number(tag.slice(0, 4)),
    Number(tag.slice(5, 7)) - 1,
    Number(tag.slice(8, 10)),
    h,
    m,
  );
  for (let i = 0; i < 2; i += 1) {
    const iso = new Date(schaetzung).toISOString();
    const ist = minutenInZone(iso, zone);
    const istTag = tagInZone(iso, zone);
    const tagVersatz = (Date.parse(`${istTag}T00:00:00Z`) - Date.parse(`${tag}T00:00:00Z`)) / 60000;
    const diff = tagVersatz + ist - (h * 60 + m);
    if (diff === 0) break;
    schaetzung -= diff * 60000;
  }
  return new Date(schaetzung).toISOString();
}

/** Zeitpunkt um n Kalendertage verschieben — Uhrzeit in der Zone bleibt gleich. */
export function umTageVerschieben(iso: string, tage: number, zone: string): string {
  const tag = tagInZone(iso, zone);
  const d = new Date(`${tag}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + tage);
  return utcFuerOrtszeit(d.toISOString().slice(0, 10), uhrzeitInZone(iso, zone), zone);
}

export function wochentagKurz(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { weekday: "short" }).format(new Date(`${iso}T12:00:00Z`));
}

export function tagKurz(iso: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit" }).format(
    new Date(`${iso}T12:00:00Z`),
  );
}

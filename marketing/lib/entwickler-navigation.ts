// Die Navigation der Entwickler-Doku — EINE Quelle für Kopfzeile, Sidebar,
// Routing und den „Nächste Seite"-Fuß.
//
// Aufbau 1:1 nach docs.lodgify.com (ReadMe.io), live abgelesen am 22.08.2026:
//
//   Kopfzeile: ZWEI Bereiche als Tabs — „Documentation" (/docs) und
//   „API Reference" (/reference). Das ist der Kern der Ordnung dort: der
//   Leitfaden und die Endpunktliste teilen sich NICHT eine Sidebar, weil man
//   entweder liest oder nachschlägt.
//
//   Doku-Sidebar: Gruppen mit Überschrift („Overview", „Appendix") und darunter
//   die Seiten — Getting started · Authorization · Localization · Errors ·
//   Rate limits, dann im Anhang Error codes · Timezones table.
//
//   Jede Doku-Seite endet mit „Next Page: <Titel>".
//
// Übernommen ist diese Gliederung samt Anhang-Gedanke. Die Inhalte sind unsere:
// wo Lodgify eine Zeitzonen-Tabelle braucht (ihre API nimmt Zeitzonen-Strings),
// steht bei uns die Regel, welche Felder Kalendertage und welche Zeitpunkte
// sind — eine abgeschriebene Tabelle, die wir nirgends verwenden, wäre eine
// erfundene Zusage (Wurzel 4).
export type KapitelId =
  | "start"
  | "schnellstart"
  | "zugang"
  | "konzepte"
  | "konventionen"
  | "fehler"
  | "limits"
  | "webhooks"
  | "grenzen"
  | "fehlercodes"
  | "lokalisierung"
  | "zeit"
  | "hilfe";

export type Kapitel = {
  id: KapitelId;
  /** Adressteil unter /entwickler. Leer = die Startseite des Leitfadens. */
  slug: string;
  /** Übersetzungsschlüssel unter `entwickler.inhalt`. */
  labelKey: string;
};

export type KapitelGruppe = {
  /** Übersetzungsschlüssel unter `entwickler.gruppen`. */
  labelKey: string;
  kapitel: readonly Kapitel[];
};

/**
 * Die Doku-Sidebar. Reihenfolge = Leseweg: erst ankommen, dann die Regeln, dann
 * das Nachschlagewerk im Anhang.
 */
export const KAPITEL_GRUPPEN: readonly KapitelGruppe[] = [
  {
    labelKey: "ueberblick",
    kapitel: [
      { id: "start", slug: "", labelKey: "start" },
      { id: "schnellstart", slug: "schnellstart", labelKey: "schnellstart" },
      { id: "zugang", slug: "zugang", labelKey: "zugang" },
      { id: "konzepte", slug: "konzepte", labelKey: "konzepte" },
      { id: "konventionen", slug: "konventionen", labelKey: "konventionen" },
      { id: "fehler", slug: "fehler", labelKey: "fehler" },
      { id: "limits", slug: "ratenbegrenzung", labelKey: "limits" },
      { id: "webhooks", slug: "webhooks", labelKey: "webhooks" },
      { id: "grenzen", slug: "grenzen", labelKey: "grenzen" },
    ],
  },
  {
    labelKey: "anhang",
    kapitel: [
      { id: "fehlercodes", slug: "fehlercodes", labelKey: "fehlercodes" },
      { id: "lokalisierung", slug: "lokalisierung", labelKey: "lokalisierung" },
      { id: "zeit", slug: "zeitzonen", labelKey: "zeit" },
      { id: "hilfe", slug: "hilfe", labelKey: "hilfe" },
    ],
  },
] as const;

/** Alle Kapitel in Leseordnung — für „Nächste Seite" und `generateStaticParams`. */
export const KAPITEL: readonly Kapitel[] = KAPITEL_GRUPPEN.flatMap(
  (g) => g.kapitel,
);

/** Alle Kapitel-Slugs außer der Startseite. */
export const KAPITEL_SLUGS = KAPITEL.filter((k) => k.slug).map((k) => k.slug);

export function kapitelMitSlug(slug: string): Kapitel | undefined {
  return KAPITEL.find((k) => k.slug === slug);
}

/**
 * Das Kapitel NACH diesem — Grundlage des „Nächste Seite"-Fußes. Am Ende des
 * Leitfadens gibt es keins; dann führt der Fuß in die Referenz.
 */
export function naechstesKapitel(id: KapitelId): Kapitel | undefined {
  const i = KAPITEL.findIndex((k) => k.id === id);
  return i >= 0 ? KAPITEL[i + 1] : undefined;
}

/** Basis-Adresse aller Doku-Seiten. */
export const DOKU_BASIS = "/entwickler";
export const REFERENZ_BASIS = "/entwickler/referenz";

export function kapitelPfad(slug: string): string {
  return slug ? `${DOKU_BASIS}/${slug}` : DOKU_BASIS;
}

export function endpunktPfad(slug: string): string {
  return `${REFERENZ_BASIS}/${slug}`;
}

"use client";

// Reiterzeile des Aufgaben-Moduls (.. /tasks): die acht Flächen waagerecht
// über dem Inhalt.
//
// WAR BIS ZUM 31.08.2026 EINE LINKE SEITENLEISTE. Sie kostete auf jeder
// Aufgabenseite 14 rem Breite — und ausgerechnet der Aufgabenkalender ist die
// breiteste Fläche des Moduls: jede Tagesspalte, die die Leiste verdrängte,
// fehlte dem Raster. Gemeldet als „Das Menü oben als Tab-Reihe zum
// Umschalten".
//
// Der Rücklink „PM-Modul" ist dabei ersatzlos entfallen: er stand über den
// Reitern, hieß nach einem internen Bauteilnamen, den kein Betrieb kennt, und
// führte auf eine Übersicht, die auch über die Hauptnavigation erreichbar ist.
//
// Optik aus `aufgaben-reiter.tsx` (Unterstrich in Primärfarbe, Versalien),
// damit die beiden Reiterzeilen einer Seite — Modul oben, Zeitraum darunter —
// als dieselbe Bauform lesen. Der Unterschied ist bewusst: DIESE Reiter sind
// LINKS (jeder ist eine eigene Seite mit eigener Adresse), die darunter sind
// Knöpfe (sie schalten innerhalb einer Seite um).
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

const BASE = "/reservierungen/aufgaben";

const TAB_SLUGS = [
  "",
  "meine",
  "team",
  "inspektion",
  "vertretungen",
  "vorlagen",
  "planmaessig",
  "regelmaessig",
  // Preise der bestellbaren Dienstleistungen (0531): sie entscheiden, was
  // eine vom Eigentuemer bestellte Leistung in seiner Abrechnung kostet.
  "dienstleistungen",
] as const;

const TAB_KEYS: Record<(typeof TAB_SLUGS)[number], string> = {
  "": "tabs.kalender",
  meine: "tabs.meine",
  team: "tabs.team",
  inspektion: "tabs.inspektion",
  vertretungen: "tabs.vertretungen",
  vorlagen: "tabs.vorlagen",
  planmaessig: "tabs.planmaessig",
  regelmaessig: "tabs.regelmaessig",
  dienstleistungen: "tabs.dienstleistungen",
};

export function TasksSubnav() {
  const pathname = usePathname();
  const t = useTranslations("reservations");

  const isActive = (slug: string) => {
    const href = slug ? `${BASE}/${slug}` : BASE;
    return slug ? pathname.startsWith(href) : pathname === BASE;
  };

  return (
    // Waagerecht scrollbar statt umbrechend: acht Reiter passen auf einem
    // schmalen Bildschirm nicht in eine Zeile, und eine zweite Reiterzeile
    // verschiebt bei jedem Wechsel den Inhalt darunter. `scrollbar-hide`, weil
    // ein Balken über der Trennlinie die Reiterzeile zerschneidet — gewischt
    // und mit dem Rad gescrollt wird trotzdem.
    <nav className="scrollbar-hide -mx-1 flex gap-1 overflow-x-auto border-b px-1">
      {TAB_SLUGS.map((slug) => {
        const active = isActive(slug);
        return (
          <Link
            key={slug || "kalender"}
            href={slug ? `${BASE}/${slug}` : BASE}
            aria-current={active ? "page" : undefined}
            // Aktiver Reiter im LOGO-ROT (`--accent`, #b82028), nicht im
            // Primaer-Token: das ist Logo-SCHWARZ, und ein schwarzer
            // Unterstrich unter schwarzer Schrift ist auf einen Blick nicht
            // als „hier bin ich" zu erkennen. Genommen wird `accent`
            // (Markenfarbe) und ausdruecklich NICHT `destructive` — das ist
            // zwar derselbe Farbwert, meint aber „Gefahr/Loeschen" und wuerde
            // beim naechsten Farbwechsel das Falsche mitziehen.
            className={`shrink-0 whitespace-nowrap border-b-2 px-3 py-2 text-sm font-medium uppercase tracking-wide transition-colors ${
              active
                ? "border-accent font-semibold text-accent"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t(`tasksSubnav.${TAB_KEYS[slug]}`)}
          </Link>
        );
      })}
    </nav>
  );
}

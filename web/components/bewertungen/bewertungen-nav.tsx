"use client";

// Unternavigation des Bewertungsbereichs — REITER über dem Inhalt, keine
// Seitenspalte.
//
// Warum umgestellt: die Spalte kostete 14 rem plus Abstand, also gut ein
// Sechstel der Fläche, dauerhaft für vier Wörter. Die Bewertungsliste ist eine
// Tabelle mit acht Spalten; ihr fehlte genau diese Breite, die Notenspalte
// wurde rechts abgeschnitten. Eine Navigation, die den Inhalt beschneidet, den
// sie erschließt, sitzt am falschen Platz.
//
// Jeder Eintrag zeigt auf eine ECHTE Route — tote Links haben wir uns woanders
// schon eingefangen.
import { Icon } from "@iconify/react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";

// Drei Reiter, nicht vier — und nicht zwei.
//
// Hostaway hat an dieser Stelle zwei (`MANAGE REVIEWS` · `AUTO-REVIEWS`), und
// so weit folgen wir: „Qualität" ist zu einem eigenen Hauptmenüpunkt geworden
// (wie ihr `Hosting Quality`), „Automatik" ist zu `AUTO-REVIEWS` geworden —
// den Vorlagen selbst, nicht einer Einstellungsseite.
//
// „Geplant" bleibt. Bei Hostaway gibt es das nicht als Ort, weil eine geplante
// Bewertung dort nur ein Status derselben Zeile ist (`Scheduled`). Bei uns ist
// sie eine eigene Zeile mit Frist, Fehlergrund und drei Aktionen (ändern,
// überspringen, sofort senden) — ein eigener Arbeitsablauf, den ein Filter in
// der Liste nicht abbilden kann, ohne dass diese Aktionen verschwinden. Ihn
// wegzukürzen wäre kein Nachbau, sondern ein Funktionsverlust.
const EINTRAEGE = [
  { key: "navAll", href: "/bewertungen", icon: "ph:star" },
  { key: "navQueue", href: "/bewertungen/geplant", icon: "ph:clock-countdown" },
  { key: "navAutomation", href: "/bewertungen/einstellungen", icon: "ph:robot" },
] as const;

export function BewertungenNav() {
  const t = useTranslations("reviews");
  const pathname = usePathname();

  return (
    // Waagerecht scrollbar statt umbrechend: auf dem Telefon sollen die vier
    // Reiter EINE Zeile bleiben, nicht zwei — sonst springt der Inhalt beim
    // Wechsel nach unten.
    <nav
      className="-mx-1 flex gap-1 overflow-x-auto border-b border-border px-1 pb-0"
      aria-label={t("title")}
    >
      {EINTRAEGE.map((e) => {
        // Exakter Vergleich: /bewertungen ist Präfix aller anderen und wäre
        // sonst dauerhaft aktiv.
        const aktiv = pathname === e.href;
        return (
          <Link
            key={e.href}
            href={e.href}
            aria-current={aktiv ? "page" : undefined}
            className={
              "flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm whitespace-nowrap transition-colors " +
              (aktiv
                ? "border-foreground font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:border-border hover:text-foreground")
            }
          >
            <Icon icon={e.icon} className="size-4" />
            {t(e.key)}
          </Link>
        );
      })}
    </nav>
  );
}

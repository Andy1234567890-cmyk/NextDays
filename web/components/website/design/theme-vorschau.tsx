// Wireframe-Vorschau eines Themes.
//
// Zeigt in wenigen Strichen, WO Logo, Menü und Inhalt liegen — genau das ist der
// Unterschied zwischen den vier Skeletten. Bewusst gezeichnet und nicht als
// Screenshot: ein Bild müsste bei jeder Layout-Änderung neu erzeugt werden und
// wäre irgendwann eine Lüge über den echten Aufbau.
//
// currentColor überall, damit die Vorschau die Umgebungsfarbe des Dashboards
// annimmt und in beiden Themes (hell/dunkel) lesbar bleibt.
import type { SiteTheme } from "@/lib/site-config";

export function ThemeVorschau({ theme }: { theme: SiteTheme }) {
  return (
    <svg
      viewBox="0 0 120 78"
      role="presentation"
      className="h-auto w-full rounded-sm border border-border bg-secondary/40 text-foreground/70"
    >
      {theme === "klar" ? (
        <>
          {/* Kopfzeile: Logo links, Menü rechts */}
          <rect x="8" y="8" width="18" height="6" rx="1" fill="currentColor" />
          <rect x="74" y="10" width="12" height="2" rx="1" fill="currentColor" />
          <rect x="90" y="10" width="12" height="2" rx="1" fill="currentColor" />
          <line
            x1="0"
            y1="20"
            x2="120"
            y2="20"
            stroke="currentColor"
            strokeWidth="0.6"
            opacity="0.4"
          />
          <rect
            x="8"
            y="27"
            width="104"
            height="30"
            rx="2"
            fill="currentColor"
            opacity="0.25"
          />
          <rect x="8" y="63" width="40" height="3" rx="1" fill="currentColor" opacity="0.5" />
        </>
      ) : null}

      {theme === "mitte" ? (
        <>
          {/* Logo zentriert, Menü darunter */}
          <rect x="51" y="7" width="18" height="6" rx="1" fill="currentColor" />
          <rect x="38" y="17" width="12" height="2" rx="1" fill="currentColor" />
          <rect x="54" y="17" width="12" height="2" rx="1" fill="currentColor" />
          <rect x="70" y="17" width="12" height="2" rx="1" fill="currentColor" />
          <line
            x1="0"
            y1="24"
            x2="120"
            y2="24"
            stroke="currentColor"
            strokeWidth="0.6"
            opacity="0.4"
          />
          <rect
            x="8"
            y="30"
            width="104"
            height="27"
            rx="2"
            fill="currentColor"
            opacity="0.25"
          />
          <rect x="40" y="63" width="40" height="3" rx="1" fill="currentColor" opacity="0.5" />
        </>
      ) : null}

      {theme === "karte" ? (
        <>
          {/* Kopfzeile als abgesetzte Karte */}
          <rect
            x="8"
            y="6"
            width="104"
            height="14"
            rx="7"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.9"
          />
          <rect x="16" y="10" width="16" height="6" rx="1" fill="currentColor" />
          <rect x="76" y="12" width="10" height="2" rx="1" fill="currentColor" />
          <rect x="90" y="12" width="10" height="2" rx="1" fill="currentColor" />
          <rect
            x="8"
            y="26"
            width="104"
            height="31"
            rx="6"
            fill="currentColor"
            opacity="0.25"
          />
          <rect x="8" y="63" width="40" height="3" rx="1" fill="currentColor" opacity="0.5" />
        </>
      ) : null}

      {theme === "seitlich" ? (
        <>
          {/* Vertikale Leiste links, Inhalt rechts */}
          <line
            x1="34"
            y1="0"
            x2="34"
            y2="78"
            stroke="currentColor"
            strokeWidth="0.6"
            opacity="0.4"
          />
          <rect x="8" y="8" width="18" height="6" rx="1" fill="currentColor" />
          <rect x="8" y="22" width="16" height="2" rx="1" fill="currentColor" />
          <rect x="8" y="28" width="20" height="2" rx="1" fill="currentColor" />
          <rect x="8" y="34" width="14" height="2" rx="1" fill="currentColor" />
          <rect
            x="42"
            y="8"
            width="70"
            height="46"
            rx="2"
            fill="currentColor"
            opacity="0.25"
          />
          <rect x="42" y="62" width="34" height="3" rx="1" fill="currentColor" opacity="0.5" />
        </>
      ) : null}
    </svg>
  );
}

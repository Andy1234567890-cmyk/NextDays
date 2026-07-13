"use client";

// Einzeilige Tab-Leiste: misst die verfügbare Breite und schiebt überzählige
// Tabs hinter ein „⋯"-Overflow-Menü, damit die Bar IMMER einzeilig bleibt.
// Farbvarianten über `tone` (neutral = Kartei-Stil, accent = rotes Gäste-Band).
import { Icon } from "@iconify/react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

export type OverflowTab = {
  key: string;
  label: string;
  /** Optionaler Präfix (z. B. Stufen-Nummer), links vom Label, gedimmt. */
  prefix?: string;
};

type Tone = "neutral" | "accent";

const useIso = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function OverflowTabs({
  tabs,
  active,
  onSelect,
  tone = "neutral",
}: {
  tabs: OverflowTab[];
  active: string;
  onSelect: (key: string) => void;
  tone?: Tone;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);
  // Anzahl sichtbarer Tabs; Rest wandert ins Menü. Start: alle sichtbar.
  const [visibleCount, setVisibleCount] = useState(tabs.length);
  const [menuOpen, setMenuOpen] = useState(false);

  // Nach jedem Layout messen, wie viele Tabs (plus „⋯"-Button) nebeneinander
  // passen. Die versteckte Mess-Reihe rendert ALLE Tabs voller Breite.
  useIso(() => {
    const el = containerRef.current;
    const measure = measureRef.current;
    if (!el || !measure) return;

    function recompute() {
      const el2 = containerRef.current;
      const measure2 = measureRef.current;
      if (!el2 || !measure2) return;
      const avail = el2.clientWidth;
      const items = Array.from(measure2.children) as HTMLElement[];
      // Reserve für den „⋯"-Button (letztes Kind der Mess-Reihe).
      const moreW = items[items.length - 1]?.offsetWidth ?? 40;
      const tabEls = items.slice(0, tabs.length);
      let used = 0;
      let count = 0;
      for (let i = 0; i < tabEls.length; i += 1) {
        used += tabEls[i].offsetWidth + 4; // gap-1
        count += 1;
      }
      if (used <= avail) {
        setVisibleCount(tabs.length);
        return;
      }
      // Passt nicht alles → Platz für „⋯" freihalten und neu zählen.
      used = 0;
      count = 0;
      const budget = avail - moreW - 4;
      for (let i = 0; i < tabEls.length; i += 1) {
        const w = tabEls[i].offsetWidth + 4;
        if (used + w > budget) break;
        used += w;
        count += 1;
      }
      setVisibleCount(Math.max(1, count));
    }

    recompute();
    const ro = new ResizeObserver(recompute);
    ro.observe(el);
    return () => ro.disconnect();
  }, [tabs]);

  // Aktiver Tab darf nie im Overflow verschwinden — dann tauschen wir ihn nach
  // vorne, indem wir die Reihenfolge so umsortieren, dass er sichtbar bleibt.
  const activeIdx = tabs.findIndex((tb) => tb.key === active);
  let ordered = tabs;
  if (activeIdx >= visibleCount) {
    const rest = tabs.filter((_, i) => i !== activeIdx);
    ordered = [tabs[activeIdx], ...rest];
  }
  const shown = ordered.slice(0, visibleCount);
  const hidden = ordered.slice(visibleCount);

  const base = "shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm transition";
  const styleFor = (isActive: boolean) => {
    if (tone === "accent") {
      return isActive
        ? `${base} bg-background font-semibold text-foreground`
        : `${base} bg-white/15 font-medium text-white hover:bg-white/25`;
    }
    return isActive
      ? `${base} bg-secondary font-medium text-foreground`
      : `${base} text-muted-foreground hover:bg-muted/60 hover:text-foreground`;
  };
  const moreBtn =
    tone === "accent"
      ? "shrink-0 rounded-full bg-white/15 px-3 py-2 text-white hover:bg-white/25"
      : "shrink-0 rounded-full px-3 py-2 text-muted-foreground hover:bg-muted/60 hover:text-foreground";

  return (
    <div ref={containerRef} className="relative flex min-w-0 items-center gap-1">
      {/* Sichtbare, garantiert einzeilige Reihe. */}
      {shown.map((tb) => (
        <button
          key={tb.key}
          type="button"
          onClick={() => onSelect(tb.key)}
          className={styleFor(tb.key === active)}
        >
          {tb.prefix != null && (
            <span className="mr-1.5 text-xs opacity-60">{tb.prefix}</span>
          )}
          {tb.label}
        </button>
      ))}

      {hidden.length > 0 && (
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className={moreBtn}
            aria-label="Mehr"
            aria-expanded={menuOpen}
          >
            <Icon icon="ph:dots-three" className="size-5" />
          </button>
          {menuOpen && (
            <>
              <button
                type="button"
                className="fixed inset-0 z-40 cursor-default"
                aria-label="Schließen"
                onClick={() => setMenuOpen(false)}
              />
              <div className="absolute right-0 z-50 mt-1 min-w-44 overflow-hidden rounded-xl border border-border bg-popover py-1 text-popover-foreground shadow-lg">
                {hidden.map((tb) => (
                  <button
                    key={tb.key}
                    type="button"
                    onClick={() => {
                      onSelect(tb.key);
                      setMenuOpen(false);
                    }}
                    className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-muted/60 ${
                      tb.key === active ? "font-semibold" : ""
                    }`}
                  >
                    {tb.prefix != null && (
                      <span className="text-xs opacity-60">{tb.prefix}</span>
                    )}
                    {tb.label}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Versteckte Mess-Reihe: alle Tabs voller Breite + „⋯", nur zum Messen. */}
      <div
        ref={measureRef}
        aria-hidden
        className="pointer-events-none absolute -z-10 flex items-center gap-1 opacity-0"
        style={{ top: 0, left: 0 }}
      >
        {tabs.map((tb) => (
          <span key={tb.key} className={base}>
            {tb.prefix != null && (
              <span className="mr-1.5 text-xs opacity-60">{tb.prefix}</span>
            )}
            {tb.label}
          </span>
        ))}
        <span className={moreBtn}>
          <Icon icon="ph:dots-three" className="size-5" />
        </span>
      </div>
    </div>
  );
}

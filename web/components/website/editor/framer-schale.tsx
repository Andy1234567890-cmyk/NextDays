"use client";

// Die SCHALE des Seiten-Editors nach Framer (05.09.2026, Auftrag „alles genau
// so umsetzen"; Foto `framer-canvas-2.png`, DOM-Messung 1440 px Fenster):
//
//   ┌──────────────────────────────────────────────────────────────────────┐
//   │ Canvas ▾  +  ▢  T  ▣      Seite · Entwurf        ✓ ▷ [Veröffentlichen] │ 51 px
//   ├──────────┬─────────────────────────────────────────────┬─────────────┤
//   │ Pages    │                                             │ Agent Style │
//   │ Layers   │       Fläche (dunkelgrau #171717)           │             │
//   │ Assets   │                                             │  Karten …   │
//   │  260 px  │                                             │   260 px    │
//   └──────────┴─────────────────────────────────────────────┴─────────────┘
//
// Drei Spalten, beide Seiten IMMER da. Die alte Schale (`../schale.tsx`,
// Hostaway-Raster mit Bereichsleiste, Menüspalte und einklappbarem Inspektor)
// bleibt für die übrigen Website-Routen stehen; der Editor benutzt sie nicht
// mehr. Genau diese Schale war der Grund, warum der Editor trotz Ebenen-Baum
// und Stil-Karten nicht wie Framer aussah: die Bereichsleiste, das helle
// Panel, der Inspektor, der sich wegklappen ließ und dann weg war.
//
// Farben: Panels #111111, Fläche #171717, Trennlinien weiß mit 8 % — die
// gemessenen Werte. Sie liegen als Variablen am Wurzelelement, damit der
// Rest über die normalen Tokens (`bg-background`, `border-border`) läuft und
// die `.dark`-Palette des Dashboards nur an diesen drei Stellen abweicht.
import { Icon } from "@iconify/react";
import { type CSSProperties, type ReactNode, useCallback, useEffect, useRef, useState } from "react";

/** Ein Reiter im linken oder rechten Panel. */
export type PanelReiter<T extends string> = { id: T; label: string };

const DUNKEL: CSSProperties = {
  ["--background" as string]: "#111111",
  ["--card" as string]: "#161616",
  ["--popover" as string]: "#1c1c1c",
  ["--secondary" as string]: "#222222",
  ["--muted" as string]: "#222222",
  ["--muted-foreground" as string]: "#999999",
  ["--border" as string]: "rgba(255,255,255,0.08)",
  ["--input" as string]: "#222222",
  ["--canvas" as string]: "#171717",
};
const HELL: CSSProperties = {
  ["--canvas" as string]: "#e9e9e9",
};

/** Framers Panels sind ziehbar (`resize-zone`, 6 px, Vollerfassung §1/§12):
 *  260 px Standard, hier 200–420. Die Breite bleibt im Browser (localStorage),
 *  nicht in der Datenbank — sie ist eine Eigenschaft dieses Bildschirms. */
const PANEL_STANDARD = 260;
const PANEL_MIN = 200;
const PANEL_MAX = 420;
const PANEL_SCHLUESSEL = "editor-panelbreiten";

function usePanelBreiten(): {
  links: number;
  rechts: number;
  ziehen: (seite: "links" | "rechts") => (e: React.PointerEvent) => void;
} {
  const [breiten, setBreiten] = useState<{ links: number; rechts: number }>(() => {
    try {
      const roh = window.localStorage.getItem(PANEL_SCHLUESSEL);
      if (roh) {
        const o = JSON.parse(roh) as { links?: number; rechts?: number };
        const klemme = (n: unknown) =>
          typeof n === "number" && Number.isFinite(n) ? Math.min(PANEL_MAX, Math.max(PANEL_MIN, n)) : PANEL_STANDARD;
        return { links: klemme(o.links), rechts: klemme(o.rechts) };
      }
    } catch {
      // kein Speicher — Standard
    }
    return { links: PANEL_STANDARD, rechts: PANEL_STANDARD };
  });
  const breitenRef = useRef(breiten);
  breitenRef.current = breiten;
  useEffect(() => {
    try {
      window.localStorage.setItem(PANEL_SCHLUESSEL, JSON.stringify(breiten));
    } catch {
      // kein Speicher — egal, die Sitzung behält den Wert
    }
  }, [breiten]);

  const ziehen = useCallback(
    (seite: "links" | "rechts") => (e: React.PointerEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const start = breitenRef.current[seite];
      const bewege = (ev: PointerEvent) => {
        const d = seite === "links" ? ev.clientX - startX : startX - ev.clientX;
        const neu = Math.min(PANEL_MAX, Math.max(PANEL_MIN, start + d));
        setBreiten((b) => (b[seite] === neu ? b : { ...b, [seite]: neu }));
      };
      const los = () => {
        window.removeEventListener("pointermove", bewege);
        window.removeEventListener("pointerup", los);
        document.body.style.cursor = "";
      };
      document.body.style.cursor = "col-resize";
      window.addEventListener("pointermove", bewege);
      window.addEventListener("pointerup", los);
    },
    [],
  );
  return { links: breiten.links, rechts: breiten.rechts, ziehen };
}

/** Framers `resize-zone`: 6 px breit, 3 px über die Kante hinaus, halb sichtbar. */
function ZiehGriff({ seite, onPointerDown }: { seite: "links" | "rechts"; onPointerDown: (e: React.PointerEvent) => void }) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      onPointerDown={onPointerDown}
      className={
        "absolute top-0 bottom-0 z-20 w-[6px] cursor-col-resize opacity-0 transition hover:bg-sky-500/40 hover:opacity-100 " +
        (seite === "links" ? "-right-[3px]" : "-left-[3px]")
      }
    />
  );
}

export function FramerSchale<L extends string, R extends string>({
  dunkel,
  kopfLinks,
  kopfMitte,
  kopfRechts,
  linkeReiter,
  linkerReiter,
  onLinkerReiter,
  linkesPanel,
  flaeche,
  rechteReiter,
  rechterReiter,
  onRechterReiter,
  rechtesPanel,
  ueberlagerung,
}: {
  /** Dunkles Editor-Thema (Framers Standard). */
  dunkel: boolean;
  kopfLinks: ReactNode;
  kopfMitte?: ReactNode;
  kopfRechts: ReactNode;
  linkeReiter: readonly PanelReiter<L>[];
  linkerReiter: L;
  onLinkerReiter: (id: L) => void;
  linkesPanel: ReactNode;
  flaeche: ReactNode;
  rechteReiter: readonly PanelReiter<R>[];
  rechterReiter: R;
  onRechterReiter: (id: R) => void;
  rechtesPanel: ReactNode;
  /** Etwas, das ÜBER allem liegt (Großpanel, Dialoge). */
  ueberlagerung?: ReactNode;
}) {
  const panel = usePanelBreiten();
  return (
    <div
      className={
        (dunkel ? "dark " : "") +
        "flex h-dvh min-h-0 flex-col overflow-hidden bg-background text-foreground"
      }
      style={dunkel ? DUNKEL : HELL}
      data-editor-schale
    >
      {/* KOPFLEISTE — 51 px wie gemessen, drei Zonen. */}
      <header className="flex h-[51px] shrink-0 items-center border-b border-border px-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-1">{kopfLinks}</div>
        <div className="flex min-w-0 shrink-0 items-center justify-center gap-2 px-2 text-xs text-muted-foreground">
          {kopfMitte}
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5">{kopfRechts}</div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* LINKES PANEL — Pages · Layers · Assets. */}
        <aside
          className="relative flex shrink-0 flex-col border-r border-border"
          style={{ width: panel.links }}
        >
          <ReiterLeiste reiter={linkeReiter} aktiv={linkerReiter} onWahl={onLinkerReiter} />
          <div className="min-h-0 flex-1 overflow-y-auto">{linkesPanel}</div>
          <ZiehGriff seite="links" onPointerDown={panel.ziehen("links")} />
        </aside>

        {/* FLÄCHE */}
        <main className="relative min-w-0 flex-1">{flaeche}</main>

        {/* RECHTES PANEL — Agent · Style. Nie einklappbar: es IST der Editor. */}
        <aside
          className="relative flex shrink-0 flex-col border-l border-border"
          style={{ width: panel.rechts }}
        >
          <ReiterLeiste reiter={rechteReiter} aktiv={rechterReiter} onWahl={onRechterReiter} />
          <div className="min-h-0 flex-1 overflow-y-auto">{rechtesPanel}</div>
          <ZiehGriff seite="rechts" onPointerDown={panel.ziehen("rechts")} />
        </aside>
      </div>

      {ueberlagerung}
    </div>
  );
}

/** Reiter als Pillen — Framers „Pages · Layers · Assets": der aktive steht
 *  hell auf dunklem Kasten, die anderen nur als Text. */
function ReiterLeiste<T extends string>({
  reiter,
  aktiv,
  onWahl,
}: {
  reiter: readonly PanelReiter<T>[];
  aktiv: T;
  onWahl: (id: T) => void;
}) {
  return (
    <div role="tablist" className="flex shrink-0 items-center gap-1 px-2.5 py-2.5">
      {reiter.map((r) => (
        <button
          key={r.id}
          type="button"
          role="tab"
          aria-selected={aktiv === r.id}
          onClick={() => onWahl(r.id)}
          className={
            "rounded-lg px-3 py-1.5 text-[13px] font-medium transition " +
            (aktiv === r.id
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:text-foreground")
          }
        >
          {r.label}
        </button>
      ))}
    </div>
  );
}

/** Kopfleisten-Knopf mit Symbol (Framer: 32 px, ohne Rahmen). */
export function KopfKnopf({
  icon,
  label,
  onClick,
  aktiv = false,
  disabled = false,
  href,
}: {
  icon: string;
  label: string;
  onClick?: () => void;
  aktiv?: boolean;
  disabled?: boolean;
  href?: string;
}) {
  const klasse =
    "flex size-8 items-center justify-center rounded-lg transition disabled:opacity-40 " +
    (aktiv
      ? "bg-secondary text-foreground"
      : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground");
  const inhalt = <Icon icon={icon} className="size-[18px]" aria-hidden />;
  if (href) {
    return (
      <a href={href} target="_blank" rel="noreferrer" aria-label={label} title={label} className={klasse}>
        {inhalt}
      </a>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      aria-pressed={aktiv || undefined}
      className={klasse}
    >
      {inhalt}
    </button>
  );
}

"use client";

// Breakpoint-Flächen (wie Framer): Typ, Live-Spiegel der inaktiven Flächen
// (DOM-Klon des aktiven Frames), das ⊕-Menü am rechten Frame-Rand und der
// „Neuer Haltepunkt"-Dialog (Custom…).
import { Icon } from "@iconify/react";
import { useEffect, useRef, useState } from "react";

// Ein Breakpoint = eine Device-Fläche auf der Canvas (Framer). `x` ist die
// Weltposition der linken Kante (Flächen liegen nebeneinander). Jeder Breakpoint
// hat EIGENE Höhe: `heightMode` "auto" folgt dem Inhalt, "fixed" ist ein fester
// Wert (`fixedHeight`) — so können Desktop/Tablet/Mobil unterschiedlich lang sein.
export type Breakpoint = {
  id: string;
  name: string;
  width: number;
  x: number;
  y: number;
  heightMode: "auto" | "fixed";
  fixedHeight: number;
};

// Live-Spiegel einer INAKTIVEN Breakpoint-Fläche (Framer): zeigt denselben
// Seiteninhalt read-only in der Breite dieses Breakpoints. Der Inhalt kommt aus
// dem Haupt-Editor über query.serialize() und wird in einem zweiten,
// deaktivierten Craft-Editor gerendert (kein Doppel-Bearbeiten). Klick auf die
// Fläche macht sie zum aktiven Breakpoint. Eigenes Label + ⊕ wie beim aktiven.
export function BreakpointMirror({
  bp,
  zoom,
  sourceRef,
  onActivate,
  onAddBreakpoint,
  onMoveStart,
}: {
  bp: Breakpoint;
  zoom: number;
  sourceRef: React.RefObject<HTMLElement | null>;
  onActivate: () => void;
  onAddBreakpoint: (name: string, width: number) => void;
  onMoveStart: (e: React.MouseEvent, bpId: string) => void;
}) {
  const [menu, setMenu] = useState(false);
  // Eigene Höhe dieses Breakpoints: fixed → Wert; auto → der geklonte Inhalt
  // bestimmt die Höhe (so ist jede Fläche unterschiedlich lang, wie in Framer).
  const fixedH = bp.heightMode === "fixed" && bp.fixedHeight ? bp.fixedHeight : null;

  return (
    <div style={{ position: "absolute", left: bp.x, top: bp.y }}>
      {/* Label — Drag verschiebt diese Fläche (und aktiviert sie). */}
      <div
        onMouseDown={(e) => {
          if (e.button === 0) onMoveStart(e, bp.id);
        }}
        style={{ transform: `scale(${1 / zoom})`, transformOrigin: "0 100%", position: "absolute", left: 0, top: "-0.5rem", cursor: "grab" }}
        className="flex -translate-y-full select-none items-center gap-2 whitespace-nowrap rounded-md bg-secondary px-2 py-0.5 text-xs font-medium text-muted-foreground shadow-sm hover:text-foreground"
      >
        <Icon icon="ph:play-circle" className="size-4" />
        {bp.name}
        <span className="text-muted-foreground/70">{bp.width}</span>
      </div>

      {/* ⊕ dieser Fläche */}
      <div
        style={{ transform: `scale(${1 / zoom})`, transformOrigin: "100% 100%", position: "absolute", left: bp.width, top: "-0.5rem", zIndex: 50 }}
        className="-translate-x-full -translate-y-full"
      >
        <div className="relative">
          <button
            type="button"
            aria-label="Haltepunkt hinzufügen"
            onClick={() => setMenu((v) => !v)}
            className={"flex size-6 items-center justify-center rounded-md transition " + (menu ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-primary/10")}
          >
            <Icon icon="ph:plus" className="size-4" />
          </button>
          {menu ? (
            <>
              <button type="button" aria-label="Menü schließen" onClick={() => setMenu(false)} className="fixed inset-0 z-40 cursor-default" />
              <div role="menu" className="absolute right-0 top-full z-50 mt-1 w-40 overflow-hidden rounded-xl border border-border bg-card p-1 shadow-xl shadow-black/10">
                <button type="button" role="menuitem" onClick={() => { onAddBreakpoint("Tablet", 810); setMenu(false); }} className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm transition hover:bg-secondary"><span>Tablet</span><span className="text-xs text-muted-foreground">810</span></button>
                <button type="button" role="menuitem" onClick={() => { onAddBreakpoint("Phone", 390); setMenu(false); }} className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm transition hover:bg-secondary"><span>Phone</span><span className="text-xs text-muted-foreground">390</span></button>
              </div>
            </>
          ) : null}
        </div>
      </div>

      {/* Read-only Spiegel-Fläche. Klick aktiviert diesen Breakpoint. Der Inhalt
          wird als DOM-Klon des aktiven Frames gespiegelt (robust, kein zweiter
          Craft-Editor) und auf die Breakpoint-Breite skaliert. */}
      <button
        type="button"
        onClick={onActivate}
        title={`${bp.name} bearbeiten`}
        style={
          fixedH
            ? { width: bp.width, height: fixedH, minHeight: 0 }
            : { width: bp.width, minHeight: "40rem" }
        }
        className="group/frame relative block cursor-pointer overflow-hidden bg-background text-left shadow-xl shadow-black/10 ring-1 ring-border transition hover:ring-primary/50"
      >
        <MirrorContent sourceRef={sourceRef} width={bp.width} />
      </button>
    </div>
  );
}

// DOM-Klon-Spiegel: klont den Inhalt des aktiven Frames read-only in DIESER
// Breakpoint-Breite (kein Scale) → der Inhalt reflowt responsiv wie in Framer.
// Aktualisiert live bei Änderungen (MutationObserver auf der Quelle).
function MirrorContent({
  sourceRef,
  width,
}: {
  sourceRef: React.RefObject<HTMLElement | null>;
  width: number;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const host = hostRef.current;
    const src = sourceRef.current;
    if (!host || !src) return;
    const sync = () => {
      host.replaceChildren();
      const clone = src.cloneNode(true) as HTMLElement;
      // Editor-Chrome (Handles/Overlays) im Klon entfernen.
      clone.querySelectorAll("[data-editor-chrome]").forEach((n) => n.remove());
      // Selektions-/Ziehgriff-Overlays des geklonten Frames entfernen (sie
      // zeichnen sonst Linien/Punkte in den Spiegel). Alles mit z-40/z-50.
      clone.querySelectorAll(".z-40, .z-50").forEach((n) => n.remove());
      // Rahmen/Ring/Schatten des Quell-Frames abstreifen — der Spiegel-Container
      // hat seinen EIGENEN Rahmen; sonst erscheint eine Linie mitten im Spiegel.
      clone.classList.remove("ring-1", "ring-primary/40", "shadow-xl", "min-h-[40rem]");
      clone.style.boxShadow = "none";
      clone.style.width = "100%";
      clone.style.minHeight = "0";
      clone.style.height = "auto";
      clone.style.pointerEvents = "none";
      host.appendChild(clone);
    };
    sync();
    const mo = new MutationObserver(sync);
    mo.observe(src, { subtree: true, childList: true, attributes: true, characterData: true });
    return () => mo.disconnect();
  }, [sourceRef]);
  return <div ref={hostRef} style={{ width }} className="pointer-events-none" />;
}

// ⊕ am rechten Frame-Rand der AKTIVEN Fläche (wie Framer): öffnet das
// Breakpoint-Menü (Generate/Tablet/Phone/Custom). Zoom-normalisiert, sitzt oben
// rechts an der Frame-Kante.
export function BreakpointPlusMenu({
  zoom,
  frameWidth,
  open,
  onToggle,
  onClose,
  onAdd,
  onCustom,
}: {
  zoom: number;
  frameWidth: number;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  onAdd: (name: string, width: number) => void;
  onCustom: () => void;
}) {
  return (
    <div
      style={{
        transform: `scale(${1 / zoom})`,
        transformOrigin: "100% 100%",
        position: "absolute",
        left: frameWidth,
        top: "-0.5rem",
        zIndex: 50,
      }}
      className="-translate-x-full -translate-y-full"
    >
      <div className="relative">
        <button
          type="button"
          aria-label="Haltepunkt hinzufügen"
          onClick={onToggle}
          className={
            "flex size-6 items-center justify-center rounded-md transition " +
            (open ? "bg-primary text-primary-foreground" : "text-primary hover:bg-primary/10")
          }
        >
          <Icon icon="ph:plus" className="size-4" />
        </button>
        {open ? (
          <>
            {/* Klick daneben schließt. */}
            <button
              type="button"
              aria-label="Menü schließen"
              onClick={onClose}
              className="fixed inset-0 z-40 cursor-default"
            />
            <div
              role="menu"
              className="absolute right-0 top-full z-50 mt-1 w-40 overflow-hidden rounded-xl border border-border bg-card p-1 shadow-xl shadow-black/10"
            >
              <button
                type="button"
                role="menuitem"
                onClick={onClose}
                className="flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-sm transition hover:bg-secondary"
              >
                Generate…
              </button>
              <div className="my-1 h-px bg-border" />
              <button
                type="button"
                role="menuitem"
                onClick={() => onAdd("Tablet", 810)}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm transition hover:bg-secondary"
              >
                <span>Tablet</span>
                <span className="text-xs text-muted-foreground">810</span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => onAdd("Phone", 390)}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-left text-sm transition hover:bg-secondary"
              >
                <span>Phone</span>
                <span className="text-xs text-muted-foreground">390</span>
              </button>
              <div className="my-1 h-px bg-border" />
              <button
                type="button"
                role="menuitem"
                onClick={onCustom}
                className="flex w-full items-center rounded-lg px-2.5 py-1.5 text-left text-sm transition hover:bg-secondary"
              >
                Custom…
              </button>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

// „Neuer Haltepunkt"-Dialog (Framer „New Breakpoint"): zentriertes Modal mit
// Name + Width, Erklärtext, Stornieren/Hinzufügen. „Hinzufügen" erst aktiv, wenn
// eine gültige Breite eingegeben ist.
export function BreakpointDialog({
  onCancel,
  onAdd,
}: {
  onCancel: () => void;
  onAdd: (name: string, width: number) => void;
}) {
  const [name, setName] = useState("");
  const [width, setWidth] = useState("");
  const w = parseInt(width, 10);
  const valid = !Number.isNaN(w) && w >= 100 && w <= 5000;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      <button type="button" aria-label="Schließen" onClick={onCancel} className="absolute inset-0 cursor-default bg-black/10" />
      <div className="relative w-80 rounded-2xl border border-border bg-card p-4 shadow-2xl shadow-black/20">
        <p className="mb-3 text-sm font-semibold">Neuer Haltepunkt</p>
        <div className="flex gap-2">
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            className="h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 text-xs outline-none placeholder:text-muted-foreground"
          />
          <input
            value={width}
            onChange={(e) => setWidth(e.target.value.replace(/[^0-9]/g, ""))}
            onKeyDown={(e) => { if (e.key === "Enter" && valid) onAdd(name.trim() || `${w}`, w); }}
            placeholder="Width"
            inputMode="numeric"
            className="h-8 w-24 shrink-0 rounded-md border border-border bg-background px-2 text-xs outline-none placeholder:text-muted-foreground"
          />
        </div>
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          Fügen Sie einen neuen Breakpoint hinzu, den Sie auf jeder Seite wiederverwenden können. Um ihn zu aktualisieren, ändern Sie einfach seine Breite.
        </p>
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-8 flex-1 rounded-full border border-border text-xs font-medium transition hover:bg-secondary"
          >
            Stornieren
          </button>
          <button
            type="button"
            disabled={!valid}
            onClick={() => onAdd(name.trim() || `${w}`, w)}
            className="h-8 flex-1 rounded-full bg-primary text-xs font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
          >
            Hinzufügen
          </button>
        </div>
      </div>
    </div>
  );
}

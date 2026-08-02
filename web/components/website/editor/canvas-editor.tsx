"use client";

// Visueller Canvas-Editor (Figma-/Framer-Prinzip, KEIN iframe):
// Blöcke werden direkt im Dashboard gerendert, sind auf der Fläche anklickbar,
// per Drag aus der Palette positionierbar und Text wird inline editiert.
// Links Palette · Mitte Canvas (Device-Frame + Zoom + Auswahl-Overlay) · rechts
// Eigenschaften. Speichern synchronisiert den Craft-Baum zurück in site_blocks.
//
// Diese Datei ist die Komposition: Registry (RESOLVER) + EditorShell.
// Die Bausteine leben in ./canvas/ — Toolbar (top-bar), Breakpoint-Flächen
// (breakpoints, use-breakpoints), Kamera/Pan/Zoom (use-canvas-camera),
// Laden/Speichern (use-page-blocks), Seiten-Variablen (use-page-variables),
// Zeichenmodus (draw-layer) und Screen-Chrome (chrome, zoom-bar).
import { Editor, Element, Frame } from "@craftjs/core";
import { Icon } from "@iconify/react";
import { useEffect, useRef, useState } from "react";

import type { Block, Page } from "@/lib/site-pages";
import { anyFontStack, ensureGoogleFontLoaded } from "@/lib/website-fonts";

import {
  ButtonNode,
  ContactNode,
  FrameNode,
  GalleryNode,
  GridNode,
  HeroNode,
  ImageNode,
  MasonryNode,
  PropertiesGridNode,
  ReviewsNode,
  SearchNode,
  SpacerNode,
  StackNode,
  TextNode,
} from "./nodes";
import {
  type Breakpoint,
  BreakpointDialog,
  BreakpointMirror,
  BreakpointPlusMenu,
} from "./canvas/breakpoints";
import { ResizeHandle, SnapGuidesOverlay } from "./canvas/chrome";
import { FrameDrawLayer } from "./canvas/draw-layer";
import { DEVICE_PX, type Device, EditorTopBar } from "./canvas/top-bar";
import { useBreakpoints } from "./canvas/use-breakpoints";
import { useCanvasCamera } from "./canvas/use-canvas-camera";
import { usePageBlocks } from "./canvas/use-page-blocks";
import { usePageVariables } from "./canvas/use-page-variables";
import { ZoomBar } from "./canvas/zoom-bar";
import { CodeEditorView } from "./code-editor";
import { FrameProvider } from "./frame-context";
import { InsertMode, InsertModeProvider } from "./insert-panel";
import { LeftPanel } from "./left-panel";
import { PropertiesPanel } from "./properties-panel";
import { RenderNode } from "./render-node";
import { SelectionOverlay } from "./selection-overlay";
import { fitBox, worldTransform, ZoomProvider } from "./use-camera";
import { VariablesProvider } from "./variables-context";

// ROOT-Canvas: nimmt die Blöcke als Kinder auf (Drop-Ziel der Palette).
// `relative` + volle Höhe, damit absolut positionierte Frames sich auf die
// gesamte Seitenfläche beziehen.
function Canvas({ children }: { children?: React.ReactNode }) {
  return <div className="relative size-full min-h-full">{children}</div>;
}
Canvas.craft = {
  displayName: "Seite",
  rules: { canMoveIn: () => true },
};

const RESOLVER = {
  Canvas,
  FrameNode,
  StackNode,
  GridNode,
  MasonryNode,
  HeroNode,
  TextNode,
  ImageNode,
  GalleryNode,
  ButtonNode,
  SpacerNode,
  ContactNode,
  SearchNode,
  PropertiesGridNode,
  ReviewsNode,
};

export function CanvasEditor({
  page,
  pages,
  initialBlocks,
}: {
  page: Page;
  pages: Page[];
  initialBlocks: Block[];
}) {
  return (
    <Editor resolver={RESOLVER} onRender={RenderNode}>
      <EditorShell page={page} pages={pages} initialBlocks={initialBlocks} />
    </Editor>
  );
}

function EditorShell({
  page,
  pages,
  initialBlocks,
}: {
  page: Page;
  pages: Page[];
  initialBlocks: Block[];
}) {
  const [device, setDevice] = useState<Device>("desktop");
  const [insertOpen, setInsertOpen] = useState(false);
  const [insertMenuOpen, setInsertMenuOpen] = useState(false);
  // Globale Seiten-Schrift (Framer „Typography"). Wird als CSS-Variable am
  // Canvas-Root gesetzt; Elemente ohne eigene Font erben sie.
  const [fontFamily, setFontFamily] = useState<string | null>(null);
  useEffect(() => { ensureGoogleFontLoaded(fontFamily); }, [fontFamily]);
  // Code-Editor (Framer „Edit Code"): wenn gesetzt, ersetzt er die Canvas-Mitte
  // (Breadcrumb + CodeMirror); Seiten-Chip im Breadcrumb kehrt zurück.
  const [codeEditor, setCodeEditor] = useState<{ file: string; source: string; onSave: (src: string) => void } | null>(null);
  // Zeichenmodus: „Frame" aufziehen (Fadenkreuz) statt sofort einfügen.
  const [drawArmed, setDrawArmed] = useState(false);

  // Unendliche Bühne: Kamera (x,y,z) statt Scroll-Container. `viewportRef` ist
  // der überlauf-verborgene Ausschnitt, `frameRef` der Device-Frame in der Welt.
  const {
    camera,
    camRef,
    setCamera,
    zoom,
    viewportRef,
    setHandTool,
    panMode,
    panning,
    startPan,
    zoomBy,
    zoomTo,
  } = useCanvasCamera({ x: 96, y: 72, z: 1 });
  const frameRef = useRef<HTMLDivElement>(null);

  // Breakpoint-Flächen: aktive Fläche, Breite/Höhe, Verschieben, Resize, Guides.
  const {
    breakpoints,
    activeBp,
    activeBpId,
    setActiveBpId,
    frameWidth,
    setFrameWidth,
    heightMode,
    fixedHeight,
    setHeightMode,
    frameHeight,
    applyWidth,
    applyFixedHeight,
    addBreakpoint,
    bpMenu,
    setBpMenu,
    bpCustom,
    setBpCustom,
    guides,
    movingFrame,
    startFrameMove,
    dragging,
    startResize,
  } = useBreakpoints({ camRef, frameRef, zoom });

  const variablesApi = usePageVariables();
  const { save, saving } = usePageBlocks(page, initialBlocks);

  // Device-Umschalter setzt die Frame-Breite (danach frei ziehbar).
  function pickDevice(d: Device) {
    setDevice(d);
    setFrameWidth(DEVICE_PX[d]);
  }

  const zoomToFit = () => {
    const el = frameRef.current;
    const vp = viewportRef.current;
    if (!el || !vp) return;
    // Gesamt-Bounding-Box ALLER Breakpoint-Flächen (frei positioniert in x/y),
    // damit alle sichtbar eingepasst werden (wie Framer „Fit"). Höhe je Fläche:
    // fester Wert oder – als Näherung – die gemessene Höhe des aktiven Frames.
    const activeH = el.offsetHeight / zoom;
    const bpH = (b: Breakpoint) =>
      b.heightMode === "fixed" && b.fixedHeight ? b.fixedHeight : activeH;
    const minX = Math.min(...breakpoints.map((b) => b.x));
    const maxX = Math.max(...breakpoints.map((b) => b.x + b.width));
    const minY = Math.min(...breakpoints.map((b) => b.y));
    const maxY = Math.max(...breakpoints.map((b) => b.y + bpH(b)));
    const box = { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
    setCamera(fitBox(box, { w: vp.clientWidth, h: vp.clientHeight }));
  };

  return (
    <VariablesProvider value={variablesApi}>
    <FrameProvider
      value={{
        width: frameWidth,
        setWidth: applyWidth,
        autoHeight: frameHeight,
        heightMode,
        fixedHeight,
        setHeightMode,
        setFixedHeight: applyFixedHeight,
        fontFamily,
        setFontFamily,
        openCodeEditor: setCodeEditor,
      }}
    >
    <ZoomProvider value={zoom}>
    <InsertModeProvider onClose={() => setInsertOpen(false)}>
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Obere Toolbar (Framer-Stil) */}
      <EditorTopBar
        page={page}
        insertOpen={insertOpen}
        onToggleInsert={() => setInsertOpen((v) => !v)}
        insertMenuOpen={insertMenuOpen}
        onToggleInsertMenu={() => setInsertMenuOpen((v) => !v)}
        onCloseInsertMenu={() => setInsertMenuOpen(false)}
        onDraw={() => setDrawArmed(true)}
        device={device}
        onPickDevice={pickDevice}
        saving={saving}
        onSave={save}
      />

      {/* 3 Spalten: LeftPanel · Canvas · Inspektor.
          Im Insert-Modus WECHSELT die Sidebar zu den Insert-Kategorien und das
          Kachel-Grid legt sich als Overlay über die Canvas. Der Craft-Frame
          bleibt IMMER gemountet (nie display:none), damit keine Blöcke verloren
          gehen. */}
      <div className="grid min-h-0 flex-1 grid-cols-[15rem_1fr_17rem]">
        {/* Spalte 1: Sidebar ODER Insert-Kategorien */}
        <aside className="min-h-0 overflow-hidden border-r border-border">
          {insertOpen ? (
            <InsertMode onClose={() => setInsertOpen(false)} variant="categories" />
          ) : (
            <LeftPanel page={page} pages={pages} />
          )}
        </aside>

        {/* Canvas-Bühne (Framer-Prinzip): fester, überlauf-verborgener Ausschnitt
            („Viewport"). KEINE Scrollbars. Der Device-Frame lebt in einer
            Welt-Schicht, die per Kamera-Transform verschoben/gezoomt wird. Pan
            per Leertaste-Drag/Trackpad, Zoom per ⌘/Pinch-Wheel zum Cursor. */}
        <div
          ref={viewportRef}
          onMouseDown={(e) => {
            // Hand-Werkzeug (Toolbar-Klick oder Leertaste) bzw. mittlere Maustaste → pannen.
            if (panMode || e.button === 1) startPan(e);
          }}
          style={{
            cursor: panning ? "grabbing" : panMode ? "grab" : "default",
            touchAction: "none",
          }}
          className="relative min-h-0 overflow-hidden bg-[oklch(0.94_0.004_260)]"
        >
          {/* Insert-Kachel-Grid: schmale Spalte am linken Rand (Canvas bleibt sichtbar). */}
          {insertOpen ? (
            <div className="absolute inset-y-0 left-0 z-30 w-[22rem] overflow-y-auto border-r border-border bg-background">
              <InsertMode onClose={() => setInsertOpen(false)} variant="grid" />
            </div>
          ) : null}

          {/* Code-Editor (Framer „Edit Code"): ersetzt die Canvas-Mitte, die
              Seitenleisten bleiben sichtbar. Breadcrumb „Seite → Datei". */}
          {codeEditor ? (
            <CodeEditorView
              pageTitle={page.title}
              file={codeEditor.file}
              source={codeEditor.source}
              onChange={codeEditor.onSave}
              onBack={() => setCodeEditor(null)}
            />
          ) : null}

          {/* Auswahl-/Hover-Rahmen + schwebende Block-Toolbar (Screen-Raum,
              misst die bereits transformierten DOM-Rechtecke). Kamera-Werte als
              Revision → Neuvermessung bei Pan/Zoom. */}
          <SelectionOverlay
            scrollRef={viewportRef}
            revision={camera.x + camera.y + camera.z}
          />

          {/* Zeichenmodus: Fadenkreuz-Overlay zum Aufziehen eines Frames. */}
          {drawArmed ? (
            <FrameDrawLayer
              zoom={zoom}
              frameRef={frameRef}
              onDone={() => setDrawArmed(false)}
            />
          ) : null}

          {/* Snapping-Guides (nur während Frame-Drag), im Screen-Raum. */}
          {movingFrame ? <SnapGuidesOverlay guides={guides} camera={camera} /> : null}

          {/* Welt-Schicht: EINE Transform bewegt & zoomt alles. */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              transformOrigin: "0 0",
              transform: worldTransform(camera),
            }}
          >
            {/* Spiegel-Flächen: alle INAKTIVEN Breakpoints als Live-Vorschau
                (read-only) an ihrer Weltposition. Klick macht sie zum aktiven. */}
            {breakpoints
              .filter((bp) => bp.id !== activeBpId)
              .map((bp) => (
                <BreakpointMirror
                  key={bp.id}
                  bp={bp}
                  zoom={zoom}
                  sourceRef={frameRef}
                  onActivate={() => setActiveBpId(bp.id)}
                  onAddBreakpoint={addBreakpoint}
                  onMoveStart={startFrameMove}
                />
              ))}

            {/* Aktive Fläche (editierbar) — an ihrer Weltposition. */}
            <div style={{ position: "absolute", left: activeBp.x, top: activeBp.y }}>
            {/* Frame-Label (wie Framer „Desktop 1200"), gegen den Zoom
                normalisiert, damit es immer gleich groß bleibt. Per Drag am
                Label lässt sich der Frame frei auf der Canvas positionieren. */}
            <div
              onMouseDown={(e) => {
                if (e.button === 0 && !panMode) startFrameMove(e, activeBp.id);
              }}
              style={{
                transform: `scale(${1 / zoom})`,
                transformOrigin: "0 100%",
                position: "absolute",
                left: 0,
                top: "-0.5rem",
                cursor: movingFrame ? "grabbing" : "grab",
              }}
              className="flex -translate-y-full select-none items-center gap-2 whitespace-nowrap rounded-md bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground shadow-sm"
            >
              <Icon icon="ph:play-circle" className="size-4" />
              {activeBp.name}
              <span className="text-primary-foreground/70">{frameWidth}</span>
            </div>

            {/* ⊕ am rechten Frame-Rand (wie Framer): Breakpoint-Menü. */}
            <BreakpointPlusMenu
              zoom={zoom}
              frameWidth={frameWidth}
              open={bpMenu}
              onToggle={() => setBpMenu((v) => !v)}
              onClose={() => setBpMenu(false)}
              onAdd={addBreakpoint}
              onCustom={() => { setBpMenu(false); setBpCustom(true); }}
            />

            {/* Der Frame selbst — sitzt im Welt-Ursprung (0,0). Bei „Fixed"
                fester Höhenwert mit Überlauf-Clip (wie Framer), sonst Auto. */}
            <div
              ref={frameRef}
              style={{
                width: frameWidth,
                // Globale Seiten-Schrift (Framer Typography): als font-family am
                // Frame-Root; alle Nodes ohne eigene Font erben sie.
                ...(fontFamily ? { fontFamily: anyFontStack(fontFamily) ?? undefined } : {}),
                // Bei „Fixed" fester Höhenwert MIT minHeight:0 — sonst würde
                // min-h-[40rem] (640px) ein Verkleinern unter 640 blockieren.
                ...(heightMode === "fixed" && fixedHeight
                  ? { height: fixedHeight, minHeight: 0, overflow: "hidden" }
                  : {}),
              }}
              className={
                "group/frame relative min-h-[40rem] bg-background shadow-xl shadow-black/10 ring-1 " +
                (movingFrame ? "ring-2 ring-primary" : "ring-primary/40")
              }
            >
              <Frame>
                <Element is={Canvas} canvas />
              </Frame>

              {/* 8 Ziehgriffe (4 Ecken + 4 Kanten) — Handle-Punkte gegen den
                  Zoom normalisiert, damit sie immer 9px groß bleiben (Framer). */}
              <ResizeHandle hx={-1} hy={-1} zoom={zoom} onStart={(e) => startResize(e, -1, -1)} />
              <ResizeHandle hx={0} hy={-1} zoom={zoom} onStart={(e) => startResize(e, 0, -1)} />
              <ResizeHandle hx={1} hy={-1} zoom={zoom} onStart={(e) => startResize(e, 1, -1)} />
              <ResizeHandle hx={-1} hy={0} zoom={zoom} onStart={(e) => startResize(e, -1, 0)} />
              <ResizeHandle hx={1} hy={0} zoom={zoom} onStart={(e) => startResize(e, 1, 0)} />
              <ResizeHandle hx={-1} hy={1} zoom={zoom} onStart={(e) => startResize(e, -1, 1)} />
              <ResizeHandle hx={0} hy={1} zoom={zoom} onStart={(e) => startResize(e, 0, 1)} />
              <ResizeHandle hx={1} hy={1} zoom={zoom} onStart={(e) => startResize(e, 1, 1)} />

              {/* Maß-Badge beim Ziehen (wie Framer „1277 × 1683") */}
              {dragging ? (
                <div
                  style={{ transform: `scale(${1 / zoom})`, transformOrigin: "left center" }}
                  className="pointer-events-none absolute -right-2 top-1/2 z-40 -translate-y-1/2 translate-x-full whitespace-nowrap rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground shadow-lg"
                >
                  {frameWidth} × {heightMode === "fixed" && fixedHeight ? fixedHeight : frameHeight}
                </div>
              ) : null}
            </div>
            </div>
          </div>

          {/* Untere schwebende Leiste (Zeiger/Hand/Zoom) — im Screen-Raum. */}
          <ZoomBar
            panMode={panMode}
            zoom={zoom}
            onPointer={() => setHandTool(false)}
            onToggleHand={() => setHandTool((v) => !v)}
            onFit={zoomToFit}
            zoomBy={zoomBy}
            zoomTo={zoomTo}
          />
        </div>

        <aside className="min-h-0 overflow-y-auto border-l border-border">
          <PropertiesPanel />
        </aside>
      </div>

      {/* „Neuer Haltepunkt"-Dialog (Custom… im Breakpoint-Menü, wie Framer). */}
      {bpCustom ? (
        <BreakpointDialog
          onCancel={() => setBpCustom(false)}
          onAdd={(name, width) => addBreakpoint(name || `${width}`, width)}
        />
      ) : null}
    </div>
    </InsertModeProvider>
    </ZoomProvider>
    </FrameProvider>
    </VariablesProvider>
  );
}

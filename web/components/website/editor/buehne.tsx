"use client";

// Die BÜHNE — Framers Canvas (Canvas-Etappen 1 + 2, 05.09.2026;
// `docs/FRAMER-CANVAS-FUNKTIONEN.md` §1 Kamera, §6 Breakpoints).
//
// Live neben Framer gelegt (Projekt „Adaptable Breakfast", Foto
// `framer-canvas-2.png`): eine dunkelgraue, unendliche Fläche; darauf je
// Breakpoint ein RAHMEN mit Kopfzeile „▷ Desktop 1200" und „+" für den
// nächsten Breakpoint; die Seite steht bei 50 % darin; unten schwebt eine
// Leiste mit Auswahl · Hand · Dunkel/Hell · Zoom-Prozent.
//
// Die Kamera ist EIN `transform: translate() scale()` um alle Rahmen. Alles,
// was auf der Fläche liegt (iframe, Auswahl-Schicht, Rahmenkopf), liegt IM
// transformierten Raum — so rechnet niemand Rechtecke um, und die Schicht aus
// `flaechen-overlay.tsx` bleibt deckungsgleich, egal bei welchem Zoom. Der
// Rahmenkopf skaliert sich mit `scale(1/zoom)` zurück, damit er lesbar
// bleibt; Framer hält ihn ebenso in Bildschirmgröße.
//
// Was hier NICHT liegt: der iframe selbst und seine Auswahl-Schicht — die
// kommen vom Editor über `rahmenInhalt`, weil sie an dessen Zustand hängen
// (Token, Sprache, Auswahl). Die Bühne kennt nur Geometrie und Kamera.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

import type { Geraet } from "@nextdays/baukasten-stil";

import { protokoll } from "./protokoll";

/** Breite eines Breakpoint-Rahmens in CSS-Pixeln — Framers Vorgaben
 *  (Desktop 1200, Tablet 810, Phone 390). Sie liegen MITTEN in unseren
 *  Geräte-Bereichen (`GERAETE_BEREICHE`: ≥ 1024 · 768–1023 · ≤ 767), damit
 *  nie ein Pixel Scrollbalken entscheidet, welcher Zustand gezeigt wird. */
export const RAHMEN_BREITE: Record<Geraet, number> = {
  desktop: 1200,
  tablet: 810,
  mobil: 390,
};

/** Reihenfolge auf der Fläche: breit → schmal, wie im Vorbild. */
export const RAHMEN_REIHE: readonly Geraet[] = ["desktop", "tablet", "mobil"];

/** Abstand zwischen zwei Rahmen und Höhe des Rahmenkopfs, im Kameraraum. */
const LUECKE = 120;
const KOPF = 40;
/** Framers Akzentfarbe (`--framer-fresco-tint-color`), am 05.09.2026 aus dem
 *  DOM gelesen: Rahmentitel, Auswahlkante und Griffe tragen sie. */
const TINT = "#0099ff";
const TINT_HELL = "rgba(0,153,255,0.1)";
const ZOOM_MIN = 0.05;
const ZOOM_MAX = 4;
/** Höhe eines Rahmens, solange der Renderer seine Seitenhöhe noch nicht
 *  gemeldet hat — kein Ersatzwert für die Seite, nur die Startgröße des
 *  Rahmens, bis die Messung kommt. */
const START_HOEHE = 900;

export type Kamera = { zoom: number; x: number; y: number };
export type Werkzeug = "auswahl" | "hand";

/** Wo ein Rahmen im Kameraraum steht (linke obere Ecke der SEITE, ohne Kopf). */
export function rahmenUrsprung(
  sichtbar: readonly Geraet[],
  geraet: Geraet,
): { x: number; y: number } {
  let x = 0;
  for (const g of RAHMEN_REIHE) {
    if (!sichtbar.includes(g)) continue;
    if (g === geraet) return { x, y: KOPF };
    x += RAHMEN_BREITE[g] + LUECKE;
  }
  return { x: 0, y: KOPF };
}

function gesamtBreite(sichtbar: readonly Geraet[]): number {
  const breiten = RAHMEN_REIHE.filter((g) => sichtbar.includes(g)).map(
    (g) => RAHMEN_BREITE[g],
  );
  return breiten.reduce((a, b) => a + b, 0) + LUECKE * Math.max(0, breiten.length - 1);
}

/**
 * Die Kamera als Hook: Zoom und Verschiebung samt der Handgriffe darauf.
 *
 * Sie lebt im Editor und nicht in der Bühne, weil auch der iframe Rad- und
 * Tastenereignisse liefert (`rad`/`taste` der Brücke) — die kommen im Editor
 * an und müssen dieselbe Kamera bewegen.
 */
export function useKamera(sichtbar: readonly Geraet[]) {
  const [kamera, setKamera] = useState<Kamera>({ zoom: 0.5, x: 0, y: 0 });
  const [werkzeug, setWerkzeug] = useState<Werkzeug>("auswahl");
  /** Leertaste gehalten: Hand nur für den Moment. */
  const [handGehalten, setHandGehalten] = useState(false);
  const flaecheRef = useRef<HTMLDivElement>(null);
  const hoehenRef = useRef<Record<Geraet, number>>({
    desktop: START_HOEHE,
    tablet: START_HOEHE,
    mobil: START_HOEHE,
  });
  const [hoehen, setHoehen] = useState(hoehenRef.current);

  const hoeheSetzen = useCallback((geraet: Geraet, hoehe: number) => {
    if (!Number.isFinite(hoehe) || hoehe <= 0) return;
    const h = Math.max(200, Math.round(hoehe));
    if (hoehenRef.current[geraet] === h) return;
    hoehenRef.current = { ...hoehenRef.current, [geraet]: h };
    setHoehen(hoehenRef.current);
  }, []);

  /** Zoom um einen PUNKT der Fläche (Bildschirmkoordinaten relativ zur
   *  Fläche): der Punkt unter dem Zeiger bleibt stehen. */
  const zoomeUm = useCallback((faktor: number, px: number, py: number) => {
    setKamera((k) => {
      const zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, k.zoom * faktor));
      if (zoom === k.zoom) return k;
      // Weltpunkt unter (px,py) vor dem Zoom: (px - x) / zoom. Danach gleich.
      const wx = (px - k.x) / k.zoom;
      const wy = (py - k.y) / k.zoom;
      return { zoom, x: px - wx * zoom, y: py - wy * zoom };
    });
  }, []);

  const zoomeMitte = useCallback(
    (faktor: number) => {
      const el = flaecheRef.current;
      const w = el?.clientWidth ?? 0;
      const h = el?.clientHeight ?? 0;
      zoomeUm(faktor, w / 2, h / 2);
    },
    [zoomeUm],
  );

  /** Alle sichtbaren Rahmen ins Bild (⌘1) oder EINEN (⌘2). */
  const einpassen = useCallback(
    (nur: Geraet | null = null) => {
      const el = flaecheRef.current;
      if (!el) return;
      const w = el.clientWidth;
      const h = el.clientHeight;
      const rand = 64;
      const breite = nur ? RAHMEN_BREITE[nur] : gesamtBreite(sichtbar);
      const hoehe =
        (nur
          ? hoehenRef.current[nur]
          : Math.max(...sichtbar.map((g) => hoehenRef.current[g]))) + KOPF;
      if (breite <= 0) return;
      // Framer passt in die BREITE ein und lässt die Seite nach unten laufen;
      // ein Rahmen, der samt 5000 px Seite ins Bild soll, wäre unlesbar.
      const zoom = Math.min(
        ZOOM_MAX,
        Math.max(ZOOM_MIN, Math.min((w - 2 * rand) / breite, (h - 2 * rand) / Math.min(hoehe, 1400))),
      );
      const ursprungX = nur ? rahmenUrsprung(sichtbar, nur).x : 0;
      setKamera({
        zoom,
        x: (w - breite * zoom) / 2 - ursprungX * zoom,
        y: rand,
      });
    },
    [sichtbar],
  );

  const zoomSetzen = useCallback(
    (zoom: number) => {
      const el = flaecheRef.current;
      const w = el?.clientWidth ?? 0;
      const h = el?.clientHeight ?? 0;
      setKamera((k) => {
        const z = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, zoom));
        const wx = (w / 2 - k.x) / k.zoom;
        const wy = (h / 2 - k.y) / k.zoom;
        return { zoom: z, x: w / 2 - wx * z, y: h / 2 - wy * z };
      });
    },
    [],
  );

  const verschiebe = useCallback((dx: number, dy: number) => {
    setKamera((k) => ({ ...k, x: k.x + dx, y: k.y + dy }));
  }, []);

  /** Rad/Pinch, egal ob von der Fläche oder aus dem iframe. `zoom` = ⌘/ctrl
   *  gehalten bzw. Pinch (der Browser meldet Pinch als ctrl+Rad). Ohne
   *  Punkt zoomt es um die Mitte. */
  const rad = useCallback(
    (dx: number, dy: number, zoom: boolean, punkt: { x: number; y: number } | null) => {
      if (zoom) {
        const faktor = Math.exp(-dy * 0.01);
        if (punkt) zoomeUm(faktor, punkt.x, punkt.y);
        else zoomeMitte(faktor);
        return;
      }
      verschiebe(-dx, -dy);
    },
    [verschiebe, zoomeMitte, zoomeUm],
  );

  /** Kamera-Kürzel (Framer: ⌘+ ⌘− ⌘0 = 100 % · ⌘1 = alles · ⌘2 = Auswahl,
   *  Leertaste = Hand, V/H = Werkzeug). Liefert `true`, wenn verarbeitet. */
  const taste = useCallback(
    (
      e: { key: string; code: string; meta: boolean; typ: string; alt?: boolean },
      aktiv: Geraet,
    ): boolean => {
      if (e.code === "Space") {
        setHandGehalten(e.typ === "keydown");
        return true;
      }
      if (e.typ !== "keydown") return false;
      if (e.meta) {
        if (e.key === "=" || e.key === "+") zoomeMitte(1.25);
        else if (e.key === "-") zoomeMitte(0.8);
        else if (e.key === "0") zoomSetzen(1);
        else if (e.key === "1") einpassen(null);
        else if (e.key === "2") einpassen(aktiv);
        else return false;
        protokoll("klick", "Kamera-Kürzel", { key: e.key });
        return true;
      }
      if (!e.alt && (e.key === "v" || e.key === "V")) {
        setWerkzeug("auswahl");
        return true;
      }
      if (!e.alt && (e.key === "h" || e.key === "H")) {
        setWerkzeug("hand");
        return true;
      }
      return false;
    },
    [einpassen, zoomSetzen, zoomeMitte],
  );

  return {
    kamera,
    setKamera,
    werkzeug,
    setWerkzeug,
    handAktiv: werkzeug === "hand" || handGehalten,
    flaecheRef,
    hoehen,
    hoeheSetzen,
    zoomeUm,
    zoomeMitte,
    zoomSetzen,
    einpassen,
    verschiebe,
    rad,
    taste,
  };
}

export type KameraSteuerung = ReturnType<typeof useKamera>;

export function Buehne({
  steuerung,
  sichtbar,
  aktiv,
  onAktiv,
  onRahmenHinzu,
  onRahmenWeg,
  rahmenInhalt,
  onPlay,
  dunkel,
  onDunkel,
  hinweis,
}: {
  steuerung: KameraSteuerung;
  /** Welche Breakpoints als Rahmen stehen (Sichtzustand, nicht gespeichert). */
  sichtbar: readonly Geraet[];
  /** Der Breakpoint, für den geschrieben wird — sein Rahmen ist hervorgehoben
   *  und trägt die Auswahl-Schicht. */
  aktiv: Geraet;
  onAktiv: (geraet: Geraet) => void;
  onRahmenHinzu: (geraet: Geraet) => void;
  onRahmenWeg: (geraet: Geraet) => void;
  /** Der iframe (und bei `aktiv` die Auswahl-Schicht) eines Rahmens. */
  rahmenInhalt: (geraet: Geraet, aktiv: boolean) => ReactNode;
  /** ▷ am Rahmenkopf: den Entwurf in dieser Breite in einem Fenster öffnen. */
  onPlay?: (geraet: Geraet) => void;
  dunkel: boolean;
  onDunkel: (dunkel: boolean) => void;
  /** Kurzer Hinweis unten (z. B. „Klick einen Abschnitt an"). */
  hinweis?: ReactNode;
}) {
  const t = useTranslations("website.canvas");
  const { kamera, flaecheRef, hoehen, handAktiv } = steuerung;
  const [zoomMenue, setZoomMenue] = useState(false);
  const [plusMenue, setPlusMenue] = useState(false);
  const zieht = useRef<{ x: number; y: number } | null>(null);
  const [eingepasst, setEingepasst] = useState(false);

  // Beim ersten Bild alles einpassen — danach nie wieder von selbst: die
  // Kamera gehört dem Nutzer, und ein Sprung bei jedem Nachladen wäre der
  // Grund, warum niemand ihr traut.
  useLayoutEffect(() => {
    if (eingepasst) return;
    if (!flaecheRef.current || flaecheRef.current.clientWidth === 0) return;
    steuerung.einpassen(null);
    setEingepasst(true);
  }, [eingepasst, flaecheRef, steuerung]);

  // Rad ÜBER DER FLÄCHE (nicht über dem iframe — das meldet die Brücke):
  // nativ und `passive: false`, damit die Seite dahinter nicht scrollt.
  useEffect(() => {
    const el = flaecheRef.current;
    if (!el) return;
    function aufRad(e: WheelEvent) {
      e.preventDefault();
      const r = el!.getBoundingClientRect();
      steuerung.rad(e.deltaX, e.deltaY, e.ctrlKey || e.metaKey, {
        x: e.clientX - r.left,
        y: e.clientY - r.top,
      });
    }
    el.addEventListener("wheel", aufRad, { passive: false });
    return () => el.removeEventListener("wheel", aufRad);
  }, [flaecheRef, steuerung]);

  // Kürzel im Editor-Dokument (im iframe fängt sie die Brücke).
  useEffect(() => {
    function inEingabe(z: EventTarget | null) {
      return (
        z instanceof HTMLElement &&
        (z.tagName === "INPUT" ||
          z.tagName === "TEXTAREA" ||
          z.tagName === "SELECT" ||
          z.isContentEditable)
      );
    }
    function drauf(e: KeyboardEvent) {
      if (inEingabe(e.target)) return;
      const ok = steuerung.taste(
        { key: e.key, code: e.code, meta: e.metaKey || e.ctrlKey, typ: e.type, alt: e.altKey },
        aktiv,
      );
      if (ok) e.preventDefault();
    }
    document.addEventListener("keydown", drauf);
    document.addEventListener("keyup", drauf);
    return () => {
      document.removeEventListener("keydown", drauf);
      document.removeEventListener("keyup", drauf);
    };
  }, [aktiv, steuerung]);

  /** Ziehen mit der Hand (oder mittlerer Maustaste) verschiebt die Kamera. */
  function aufZeigerRunter(e: React.PointerEvent) {
    const hand = handAktiv || e.button === 1;
    if (!hand && e.target !== e.currentTarget) return;
    if (!hand && e.button !== 0) return;
    zieht.current = { x: e.clientX, y: e.clientY };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    if (!hand) onAktiv(aktiv); // Klick ins Leere: Auswahl bleibt Sache des Editors
  }
  function aufZeigerBewegt(e: React.PointerEvent) {
    if (!zieht.current) return;
    steuerung.verschiebe(e.clientX - zieht.current.x, e.clientY - zieht.current.y);
    zieht.current = { x: e.clientX, y: e.clientY };
  }
  function aufZeigerHoch(e: React.PointerEvent) {
    if (!zieht.current) return;
    zieht.current = null;
    (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
  }

  const fehlende = RAHMEN_REIHE.filter((g) => !sichtbar.includes(g));
  const reihe = RAHMEN_REIHE.filter((g) => sichtbar.includes(g));
  const prozent = Math.round(kamera.zoom * 100);

  return (
    <div
      ref={flaecheRef}
      data-buehne
      className={
        "relative h-full min-h-0 w-full select-none overflow-hidden bg-(--canvas) " +
        (handAktiv ? "cursor-grab active:cursor-grabbing" : "")
      }
      onPointerDown={aufZeigerRunter}
      onPointerMove={aufZeigerBewegt}
      onPointerUp={aufZeigerHoch}
      onPointerCancel={aufZeigerHoch}
    >
      {/* DER KAMERARAUM */}
      <div
        className="absolute left-0 top-0 origin-top-left will-change-transform"
        style={{
          transform: `translate(${kamera.x}px, ${kamera.y}px) scale(${kamera.zoom})`,
        }}
      >
        {reihe.map((g, i) => {
          const u = rahmenUrsprung(sichtbar, g);
          const istAktiv = g === aktiv;
          const letzter = i === reihe.length - 1;
          return (
            <div
              key={g}
              className="absolute"
              style={{ left: u.x, top: u.y, width: RAHMEN_BREITE[g] }}
            >
              {/* RAHMENKOPF — in Bildschirmgröße, deshalb gegen den Zoom
                  zurückskaliert; verankert an der linken unteren Ecke. */}
              <div
                className="absolute bottom-full left-0 origin-bottom-left"
                style={{
                  transform: `scale(${1 / kamera.zoom})`,
                  width: RAHMEN_BREITE[g] * kamera.zoom,
                  height: KOPF,
                }}
              >
                {/* Framers `ScreenTitle`: Pille 22 px hoch, Radius 10, Innenrand
                    5 px, 12 px/600, 10 px über der Seite; aktiv in der
                    Akzentfarbe auf 10 % Akzent, sonst grau. Der Abspielknopf
                    ist 20×20 voll in Akzent. */}
                <div
                  className="flex h-full items-end pb-[10px]"
                  onPointerDown={(e) => e.stopPropagation()}
                >
                <div
                  className={
                    "inline-flex min-h-[22px] items-center gap-1 rounded-[10px] p-[5px] text-xs font-semibold " +
                    (istAktiv ? "" : "text-muted-foreground")
                  }
                  style={istAktiv ? { color: TINT, backgroundColor: TINT_HELL } : undefined}
                >
                  <button
                    type="button"
                    onClick={() => onPlay?.(g)}
                    aria-label={t("abspielen")}
                    title={t("abspielen")}
                    className="flex size-5 items-center justify-center rounded-[6px] text-white transition hover:opacity-90"
                    style={{ backgroundColor: istAktiv ? TINT : "currentColor" }}
                  >
                    <Icon icon="ph:play-fill" className="size-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onAktiv(g)}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <span className="truncate">{t(`geraet.${g}`)}</span>
                    <span className="opacity-60">{RAHMEN_BREITE[g]}</span>
                    {g === "desktop" ? (
                      <span className="text-[10px] text-muted-foreground">{t("primaer")}</span>
                    ) : null}
                  </button>
                  {g !== "desktop" ? (
                    <button
                      type="button"
                      onClick={() => onRahmenWeg(g)}
                      aria-label={t("rahmenWeg")}
                      title={t("rahmenWeg")}
                      className="flex size-5 items-center justify-center rounded-[6px] opacity-70 transition hover:opacity-100"
                    >
                      <Icon icon="ph:x" className="size-3" />
                    </button>
                  ) : null}
                  {letzter && fehlende.length > 0 ? (
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => setPlusMenue((m) => !m)}
                        aria-haspopup="menu"
                        aria-expanded={plusMenue}
                        aria-label={t("rahmenHinzu")}
                        title={t("rahmenHinzu")}
                        className="flex size-5 items-center justify-center rounded-[6px] opacity-70 transition hover:opacity-100"
                      >
                        <Icon icon="ph:plus" className="size-3.5" />
                      </button>
                      {plusMenue ? (
                        <ul
                          role="menu"
                          className="absolute right-0 top-7 z-20 w-44 rounded-md border border-border bg-popover p-1 shadow-lg"
                        >
                          {fehlende.map((f) => (
                            <li key={f}>
                              <button
                                type="button"
                                role="menuitem"
                                onClick={() => {
                                  setPlusMenue(false);
                                  onRahmenHinzu(f);
                                }}
                                className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs transition hover:bg-secondary"
                              >
                                <span>{t(`geraet.${f}`)}</span>
                                <span className="text-muted-foreground">{RAHMEN_BREITE[f]}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  ) : null}
                </div>
                </div>
              </div>

              {/* DIE SEITE: so hoch, wie der Renderer sie meldet. Der aktive
                  Rahmen trägt Framers Auswahlkante: 1 px durchgezogen in der
                  Akzentfarbe (gemessen: vier Balken mit scaleY 0.01). Keine
                  Eckgriffe — unsere Rahmenbreiten sind Konstanten, ein Griff,
                  der nichts zieht, wäre eine Attrappe. */}
              <div
                className="relative bg-white"
                style={{
                  width: RAHMEN_BREITE[g],
                  height: hoehen[g],
                  outline: istAktiv ? `1px solid ${TINT}` : undefined,
                }}
                onPointerDown={(e) => {
                  if (!handAktiv) e.stopPropagation();
                }}
              >
                {rahmenInhalt(g, istAktiv)}
                {/* Bei der Hand liegt eine Fangfläche über dem iframe — sonst
                    schluckt er den Zug. */}
                {handAktiv ? <div className="absolute inset-0" /> : null}
              </div>
            </div>
          );
        })}
      </div>

      {/* UNTERE LEISTE — schwebend, mittig, in Bildschirmgröße. */}
      <div
        className="absolute bottom-4 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-xl border border-border bg-popover p-1.5 shadow-xl"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <LeistenKnopf
          icon="ph:cursor"
          label={`${t("werkzeug.auswahl")} (V)`}
          aktiv={steuerung.werkzeug === "auswahl"}
          onClick={() => steuerung.setWerkzeug("auswahl")}
        />
        <LeistenKnopf
          icon="ph:hand"
          label={`${t("werkzeug.hand")} (H)`}
          aktiv={steuerung.werkzeug === "hand"}
          onClick={() => steuerung.setWerkzeug("hand")}
        />
        <span aria-hidden className="mx-1 h-5 w-px bg-border" />
        <LeistenKnopf
          icon={dunkel ? "ph:moon" : "ph:sun"}
          label={dunkel ? t("hell") : t("dunkel")}
          onClick={() => onDunkel(!dunkel)}
        />
        <div className="relative">
          <button
            type="button"
            onClick={() => setZoomMenue((m) => !m)}
            aria-haspopup="menu"
            aria-expanded={zoomMenue}
            className="flex h-8 items-center gap-1 rounded-lg bg-secondary px-2.5 text-xs font-medium transition hover:bg-secondary/70"
          >
            {prozent}%
            <Icon icon="ph:caret-down" className="size-3 text-muted-foreground" />
          </button>
          {zoomMenue ? (
            <ul
              role="menu"
              className="absolute bottom-10 left-0 w-52 rounded-md border border-border bg-popover p-1 shadow-lg"
              onMouseLeave={() => setZoomMenue(false)}
            >
              {(
                [
                  [t("zoom.groesser"), "⌘+", () => steuerung.zoomeMitte(1.25)],
                  [t("zoom.kleiner"), "⌘−", () => steuerung.zoomeMitte(0.8)],
                  [t("zoom.einpassen"), "⌘1", () => steuerung.einpassen(null)],
                  [t("zoom.auswahl"), "⌘2", () => steuerung.einpassen(aktiv)],
                  ["50 %", "", () => steuerung.zoomSetzen(0.5)],
                  ["100 %", "⌘0", () => steuerung.zoomSetzen(1)],
                  ["200 %", "", () => steuerung.zoomSetzen(2)],
                ] as const
              ).map(([label, kuerzel, tun]) => (
                <li key={label}>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      tun();
                      setZoomMenue(false);
                    }}
                    className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs transition hover:bg-secondary"
                  >
                    <span>{label}</span>
                    <span className="text-muted-foreground">{kuerzel}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        {hinweis ? (
          <>
            <span aria-hidden className="mx-1 h-5 w-px bg-border" />
            <span className="px-1.5 text-xs text-muted-foreground">{hinweis}</span>
          </>
        ) : null}
      </div>
    </div>
  );
}

function LeistenKnopf({
  icon,
  label,
  aktiv = false,
  onClick,
}: {
  icon: string;
  label: string;
  aktiv?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={aktiv}
      onClick={onClick}
      className={
        "flex size-8 items-center justify-center rounded-lg transition " +
        (aktiv
          ? "bg-secondary text-foreground"
          : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground")
      }
    >
      <Icon icon={icon} className="size-4" />
    </button>
  );
}

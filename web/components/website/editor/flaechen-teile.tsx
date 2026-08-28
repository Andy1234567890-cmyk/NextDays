"use client";

// Die BAUSTEINE der Arbeitsfläche: Kontextmenü, schwebende Leiste, das
// Ausblenden-Menü und die kleinen Knöpfe darin.
//
// Sie liegen getrennt von `flaechen-overlay.tsx`, weil dort die GEOMETRIE
// wohnt — wo ein Rahmen sitzt, wie er dem iframe folgt — und hier das
// AUSSEHEN der Bedienelemente. Zusammen wären es über tausend Zeilen in einer
// Datei, in der man beim Suchen nach einem Knopf durch Rechteck-Mathematik
// blättert.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import type { BlockType } from "@/lib/site-pages";

import { abschnittFuer } from "../abschnitte";
import { GERAET_SYMBOL, type Geraet } from "../vorschau";
import { GERAETE, umgeschaltet, versteckteGeraete } from "./sichtbarkeit";

/** Ein Abschnitt, wie ihn die Arbeitsfläche braucht. Bewusst nur diese drei
 *  Felder: der Inhalt gehört in die Vorschau, nicht hierher. */
export type FlaechenZeile = {
  key: string;
  /** DB-ID, sofern der Abschnitt schon einmal gespeichert wurde.
   *
   *  Sie ordnet die Zeile dem Rechteck zu, das der Renderer meldet — die
   *  Indizes beider Seiten zählen Verschiedenes (der Renderer den ganzen Baum,
   *  der Editor nur die Bausteine). `null` heißt: neu, noch nicht gespeichert. */
  id: string | null;
  typ: BlockType;
  settings: Record<string, unknown>;
};

/** Ort eines offenen Kontextmenüs, in Fensterkoordinaten. */
export type MenuOrt = { x: number; y: number; key: string } | null;


/** Der Name des Widgets, wie er auf dem blauen Etikett steht. */
export function useName() {
  const t = useTranslations("website");
  return (typ: BlockType) => {
    const meta = abschnittFuer(typ);
    return meta ? t(`abschnitte.${meta.label}`) : t("editor.unbekannterAbschnitt");
  };
}

/** Ein Gerätesymbol, bei Bedarf durchgestrichen.
 *
 *  Der Strich ist ein gedrehter Balken über dem Symbol und kein zweiter
 *  Icon-Name: „Monitor mit Schrägstrich" gibt es im Symbolsatz nicht für jedes
 *  Gerät, und ein Symbol, das für Desktop existiert und für Mobil nicht, wäre
 *  eine Darstellung, die je nach Zeile anders aussieht. */
function GeraetSymbol({
  icon,
  durchgestrichen,
}: {
  icon: string;
  durchgestrichen: boolean;
}) {
  return (
    <span className="relative inline-flex size-4 items-center justify-center">
      <Icon icon={icon} className="size-4" />
      {durchgestrichen ? (
        <span
          aria-hidden
          className="absolute left-0 top-1/2 h-px w-full -rotate-45 bg-current"
        />
      ) : null}
    </span>
  );
}

/** Das „Ausblenden auf"-Untermenü — aus der schwebenden Leiste heraus.
 *
 *  Vier Zeilen: „Alle Geräte" und darunter Desktop · Tablet · Mobil. Jedes hat
 *  einen eigenen Breakpoint im Renderer und eine eigene Vorschaubreite — ein
 *  Eintrag, den niemand nachsehen kann, stünde hier nicht.
 *
 *  Ausgeblendete Geräte stehen ORANGE und ihr Symbol ist DURCHGESTRICHEN —
 *  einheitlich, in der Leiste wie im Kontextmenü. Hostaways Artikel beschreibt
 *  das Kontextmenü ohne Durchstreichung; der Screenshot zeigt beides gleich,
 *  und zwei Darstellungen für denselben Zustand sind der Grund, warum niemand
 *  sie liest. */
function AusblendenMenue({
  versteckt,
  onVersteckt,
}: {
  versteckt: Geraet[];
  onVersteckt: (geraete: Geraet[]) => void;
}) {
  const t = useTranslations("website");
  const alleAus = GERAETE.every((g) => versteckt.includes(g));
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onVersteckt(alleAus ? [] : [...GERAETE]);
        }}
        className={
          "flex w-full items-center justify-between gap-4 px-3 py-1.5 text-left text-xs transition hover:bg-secondary " +
          (alleAus ? "text-orange-500" : "")
        }
      >
        {t("arbeitsflaeche.alleGeraete")}
        <GeraetSymbol icon="ph:devices" durchgestrichen={alleAus} />
      </button>
      {GERAETE.map((g) => {
        const aus = versteckt.includes(g);
        return (
          <button
            key={g}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onVersteckt(umgeschaltet(versteckt, g));
            }}
            className={
              "flex w-full items-center justify-between gap-4 px-3 py-1.5 text-left text-xs transition hover:bg-secondary " +
              (aus ? "text-orange-500" : "")
            }
          >
            {t(`arbeitsflaeche.${g}`)}
            <GeraetSymbol
              icon={GERAET_SYMBOL[g]}
              durchgestrichen={aus}
            />
          </button>
        );
      })}
    </>
  );
}

export function AusblendenKnopf({
  versteckt,
  offen,
  onOffen,
  onVersteckt,
}: {
  versteckt: Geraet[];
  offen: boolean;
  onOffen: (offen: boolean) => void;
  onVersteckt: (geraete: Geraet[]) => void;
}) {
  const t = useTranslations("website");
  return (
    <div className="relative">
      <button
        type="button"
        aria-label={t("arbeitsflaeche.ausblendenAuf")}
        title={t("arbeitsflaeche.ausblendenAuf")}
        aria-expanded={offen}
        onClick={(e) => {
          e.stopPropagation();
          onOffen(!offen);
        }}
        className={
          "p-1 transition " +
          (versteckt.length > 0
            ? "text-orange-500"
            : "text-muted-foreground hover:text-foreground")
        }
      >
        <Icon
          icon={versteckt.length > 0 ? "ph:eye-slash" : "ph:eye"}
          className="size-3.5"
        />
      </button>
      {offen ? (
        // Nach OBEN aufgeklappt: die Leiste sitzt am unteren Rand der Karte
        // und die Spalte scrollt — nach unten waere das Menue an der
        // Unterkante der Spalte abgeschnitten.
        <div className="absolute bottom-full right-0 z-30 mb-1 w-40 overflow-hidden rounded-(--radius) border border-border bg-background py-1 shadow-lg">
          <AusblendenMenue versteckt={versteckt} onVersteckt={onVersteckt} />
        </div>
      ) : null}
    </div>
  );
}

export function Kontextmenue({
  ort,
  zeile,
  index,
  gesamt,
  onSchliesse,
  onInhalt,
  onDesign,
  onDuplizieren,
  onVerschiebe,
  onEntferne,
  onVersteckt,
}: {
  ort: NonNullable<MenuOrt>;
  zeile: FlaechenZeile | null;
  index: number;
  gesamt: number;
  onSchliesse: () => void;
  onInhalt: (key: string) => void;
  onDesign: (key: string) => void;
  onDuplizieren: (key: string) => void;
  onVerschiebe: (key: string, richtung: -1 | 1) => void;
  onEntferne: (key: string) => void;
  onVersteckt: (key: string, geraete: Geraet[]) => void;
}) {
  const t = useTranslations("website");
  const name = useName();
  const [ausblendenOffen, setAusblendenOffen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Am unteren/rechten Fensterrand nach innen rücken — sonst steht das Menü
  // zur Hälfte außerhalb und die letzten Einträge (darunter „Löschen") sind
  // nicht erreichbar.
  const [versatz, setVersatz] = useState({ x: ort.x, y: ort.y });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const rechteck = el.getBoundingClientRect();
    setVersatz({
      x: Math.min(ort.x, window.innerWidth - rechteck.width - 8),
      y: Math.min(ort.y, window.innerHeight - rechteck.height - 8),
    });
  }, [ort.x, ort.y]);

  if (!zeile) return null;
  const versteckt = versteckteGeraete(zeile.settings);

  return (
    <>
      {/* Auffangfläche: ein Klick irgendwo schließt das Menü. Sie liegt UNTER
          dem Menü und über allem anderen. */}
      <button
        type="button"
        aria-label={t("editor.closeMenu")}
        onClick={onSchliesse}
        onContextMenu={(e) => {
          e.preventDefault();
          onSchliesse();
        }}
        // `pointer-events-auto`: das Kontextmenü liegt in der Overlay-Schicht,
        // und die ist als Ganzes `pointer-events-none` — sonst fingen ihre
        // Rahmen und Etiketten jeden Klick ab, der eigentlich der Seite in der
        // Vorschau gilt. Jedes bedienbare Teil darin muss die Durchlässigkeit
        // deshalb einzeln aufheben. Ohne das war das Menü sichtbar und tot:
        // kein Eintrag ließ sich anklicken, auch „Entfernen" nicht.
        className="pointer-events-auto fixed inset-0 z-40 cursor-default"
      />
      <div
        ref={ref}
        style={{ left: versatz.x, top: versatz.y }}
        className="pointer-events-auto fixed z-50 w-56 overflow-hidden rounded-(--radius) border border-border bg-background shadow-xl"
      >
        {/* Dunkle Kopfzeile mit dem Widget-Namen in Großbuchstaben. */}
        <div className="bg-foreground px-3 py-1.5 text-[0.625rem] font-semibold uppercase tracking-wide text-background">
          {name(zeile.typ)}
        </div>
        <MenuZeile
          label={t("arbeitsflaeche.inhaltBearbeiten", {
            abschnitt: name(zeile.typ),
          })}
          onKlick={() => {
            onSchliesse();
            onInhalt(zeile.key);
          }}
        />
        <MenuZeile
          label={t("arbeitsflaeche.designBearbeiten")}
          onKlick={() => {
            onSchliesse();
            onDesign(zeile.key);
          }}
        />
        <span aria-hidden className="my-1 block h-px bg-border" />
        <MenuZeile
          label={t("editor.duplizieren")}
          icon="ph:copy"
          onKlick={() => {
            onSchliesse();
            onDuplizieren(zeile.key);
          }}
        />
        <MenuZeile
          label={t("editor.nachOben")}
          icon="ph:arrow-up"
          deaktiviert={index <= 0}
          onKlick={() => {
            onSchliesse();
            onVerschiebe(zeile.key, -1);
          }}
        />
        <MenuZeile
          label={t("editor.nachUnten")}
          icon="ph:arrow-down"
          deaktiviert={index < 0 || index === gesamt - 1}
          onKlick={() => {
            onSchliesse();
            onVerschiebe(zeile.key, 1);
          }}
        />
        <div className="relative">
          <MenuZeile
            label={t("arbeitsflaeche.ausblendenAuf")}
            icon="ph:eye-slash"
            pfeil
            orange={versteckt.length > 0}
            onKlick={() => setAusblendenOffen((o) => !o)}
          />
          {ausblendenOffen ? (
            <div className="border-y border-border bg-secondary/40 py-1">
              <AusblendenMenue
                versteckt={versteckt}
                onVersteckt={(g) => onVersteckt(zeile.key, g)}
              />
            </div>
          ) : null}
        </div>
        <span aria-hidden className="my-1 block h-px bg-border" />
        <MenuZeile
          label={t("editor.entfernen")}
          icon="ph:trash"
          gefahr
          onKlick={() => {
            onSchliesse();
            onEntferne(zeile.key);
          }}
        />
      </div>
    </>
  );
}

// --- kleine Bausteine -------------------------------------------------------

export function TextKnopf({ label, onKlick }: { label: string; onKlick: () => void }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onKlick();
      }}
      className="truncate rounded-full px-1.5 py-0.5 text-[0.6875rem] font-medium text-foreground transition hover:bg-secondary"
    >
      {label}
    </button>
  );
}

export function SymbolKnopf({
  icon,
  label,
  onKlick,
  gefahr,
}: {
  icon: string;
  label: string;
  onKlick: () => void;
  gefahr?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onKlick();
      }}
      className={
        "p-1 text-muted-foreground transition " +
        (gefahr ? "hover:text-destructive" : "hover:text-foreground")
      }
    >
      <Icon icon={icon} className="size-3.5" />
    </button>
  );
}

export function MenuKnopf({
  icon,
  label,
  offen,
  onOffen,
  children,
}: {
  icon: string;
  label: string;
  offen: boolean;
  onOffen: (offen: boolean) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <button
        type="button"
        aria-label={label}
        title={label}
        aria-expanded={offen}
        onClick={(e) => {
          e.stopPropagation();
          onOffen(!offen);
        }}
        className="p-1 text-muted-foreground transition hover:text-foreground"
      >
        <Icon icon={icon} className="size-3.5" />
      </button>
      {offen ? (
        <div className="absolute bottom-full left-0 z-30 mb-1 w-40 overflow-hidden rounded-(--radius) border border-border bg-background py-1 shadow-lg">
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function MenuZeile({
  label,
  icon,
  onKlick,
  deaktiviert,
  gefahr,
  orange,
  pfeil,
}: {
  label: string;
  icon?: string;
  onKlick: () => void;
  deaktiviert?: boolean;
  gefahr?: boolean;
  orange?: boolean;
  pfeil?: boolean;
}) {
  let farbe = "";
  if (gefahr) farbe = "text-destructive";
  else if (orange) farbe = "text-orange-500";
  return (
    <button
      type="button"
      disabled={deaktiviert}
      onClick={(e) => {
        e.stopPropagation();
        onKlick();
      }}
      className={
        "flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs transition hover:bg-secondary disabled:opacity-40 disabled:hover:bg-transparent " +
        farbe
      }
    >
      {icon ? <Icon icon={icon} className="size-3.5 shrink-0" /> : null}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {pfeil ? <Icon icon="ph:caret-right" className="size-3 shrink-0" /> : null}
    </button>
  );
}

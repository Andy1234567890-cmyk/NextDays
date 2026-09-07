"use client";

// Die Bausteine des Stil-Inspektors (Etappe 3 der Framer-Parität, 05.09.2026).
//
// Framers Style-Panel besteht aus DREI Zeilenmustern und einem Kartenkopf
// (`docs/FRAMER-STYLE-INSPEKTOR-FUNKTIONEN.md` §0):
//
//   · Label + Wert                → `StilZeile` (Label links, Feld rechts)
//   · geteilt: Zahl + Modus-Liste → `StilZeile` mit zwei Kindern
//   · Chip mit Entfernen          → `Chip`
//   · Kartenkopf mit „+"-Menü     → `PlusKarte`: leer zeigt es ein Suchmenü der
//     möglichen Einträge, gefüllt klappt der Kopf zu; gesetzte Einträge stehen
//     grau mit Häkchen.
//
// Dazu die HERKUNFT eines Werts (§0.9): auf Tablet/Mobil ist eine eigene
// Überschreibung BLAU und trägt einen Reset-Knopf; ein geerbter Wert steht
// grau mit dem Gerät, von dem er kommt. Das ist Framers Breakpoint-Modell und
// der Grund, warum jede Zeile hier ihren `pfad` kennt: `herkunft()` aus dem
// Paket beantwortet die Frage, und dieselbe Funktion beantwortet sie dem
// Renderer. Zwei Kopien dieser Regel liefen auseinander (Etappe 2, Regel 3).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { type ReactNode, useEffect, useId, useMemo, useRef, useState } from "react";

import {
  type Geraet,
  FARBROLLEN,
  darstellungFuer,
  eigenerWert,
  herkunft,
  jeGeraetMoeglich,
  mitWert,
  wirksamerWert,
} from "@nextdays/baukasten-stil";

import { GERAET_SYMBOL } from "../vorschau";
import { protokoll } from "./protokoll";

/** Ein Pfad in `settings`: `["stil", "opazitaet"]`, `["layout_abstand"]`. */
export type Pfad = readonly string[];

/** Lesen und Schreiben eines Blocks auf EINEM Gerät — der eine Weg, den alle
 *  Felder des Inspektors benutzen.
 *
 *  `setzen(pfad, null)` löscht. Auf Tablet/Mobil landet der Wert in
 *  `je_geraet.<gerät>`, auf Desktop in der Grundfassung; Felder ohne
 *  Geräte-Fassung (Scroll, Zugänglichkeit) immer in der Grundfassung. */
export type Stift = {
  geraet: Geraet;
  settings: Record<string, unknown>;
  /** Der wirksame Wert nach der Kaskade. */
  lesen: (pfad: Pfad) => unknown;
  /** Der auf DIESEM Gerät selbst gesetzte Wert, `undefined` = geerbt/leer. */
  eigen: (pfad: Pfad) => unknown;
  setzen: (pfad: Pfad, wert: unknown) => void;
  /** Mehrere Pfade in EINEM Vorgang (ein Request, kein Zwischenzustand). */
  setzeAlle: (paare: ReadonlyArray<readonly [Pfad, unknown]>) => void;
  laeuft: boolean;
};

export function stift(
  settings: Record<string, unknown>,
  geraet: Geraet,
  onSettings: (settings: Record<string, unknown>) => void,
  laeuft = false,
): Stift {
  return {
    geraet,
    settings,
    laeuft,
    lesen: (pfad) =>
      pfad.length === 0 ? darstellungFuer(settings, geraet) : wirksamerWert(settings, geraet, pfad),
    eigen: (pfad) => eigenerWert(settings, geraet, pfad),
    setzen: (pfad, wert) => {
      // Leerer Pfad: `wert` IST das neue Settings-Objekt (mehrere Felder in
      // einem Vorgang — Abstände aller Seiten, Sichtbarkeit).
      const neu =
        pfad.length === 0
          ? (wert as Record<string, unknown>)
          : mitWert(settings, geraet, pfad, wert);
      // Die Spur, an der man einen stummen Fehler findet: kam der Klick an,
      // welcher Pfad, welches Gerät, was steht danach in `settings`.
      protokoll("klick", "Stil setzen", {
        pfad: pfad.join("."),
        geraet,
        jeGeraet: jeGeraetMoeglich(pfad) && geraet !== "desktop",
        wert,
        vorher: eigenerWert(settings, geraet, pfad),
      });
      onSettings(neu);
    },
    setzeAlle: (paare) => {
      let neu = settings;
      for (const [pfad, wert] of paare) neu = mitWert(neu, geraet, pfad, wert);
      protokoll("klick", "Stil setzen (mehrere)", {
        pfade: paare.map(([p]) => p.join(".")).join(", "),
        geraet,
      });
      onSettings(neu);
    },
  };
}

/**
 * Eine Zeile: Beschriftung links, Feld(er) rechts, Herkunft am Label.
 *
 * Blau = auf diesem Gerät eigens gesetzt (nur Tablet/Mobil — auf Desktop ist
 * jeder Wert „eigen", und alles blau zu färben hieße nichts zu sagen). Der
 * Reset-Knopf (↺) löscht NUR die Überschreibung dieses Geräts; der geerbte
 * Wert scheint danach wieder durch. Auf Desktop löscht ✕ den Wert ganz.
 */
export function StilZeile({
  label,
  pfad,
  s,
  children,
  onEntfernen,
}: {
  label: string;
  /** Der Pfad, dessen Herkunft die Zeile zeigt. Ohne Pfad: reine Beschriftung. */
  pfad?: Pfad;
  s: Stift;
  children: ReactNode;
  /** Eigener Entfernen-Weg, wenn `setzen(pfad, null)` nicht reicht (Listen). */
  onEntfernen?: () => void;
}) {
  const t = useTranslations("website.stil");
  const her = pfad ? herkunft(s.settings, s.geraet, pfad) : null;
  const eigen = pfad ? s.eigen(pfad) !== undefined : false;
  const ueberschreibt = eigen && s.geraet !== "desktop" && pfad !== undefined && jeGeraetMoeglich(pfad);
  const geerbt = her !== null && !her.eigen;

  return (
    <div className="flex min-h-[30px] items-center gap-2">
      <span
        title={
          ueberschreibt
            ? t("ueberschreibung", { geraet: t(`geraet.${s.geraet}`) })
            : geerbt
              ? t("geerbtVon", { geraet: t(`geraet.${her.quelle}`) })
              : undefined
        }
        className={
          "group/zeile flex w-[94px] shrink-0 items-center gap-1 pl-[5px] text-xs " +
          (ueberschreibt ? "font-medium text-sky-600 dark:text-sky-400" : "text-muted-foreground")
        }
      >
        {geerbt ? (
          <Icon icon={GERAET_SYMBOL[her.quelle]} className="size-3 shrink-0 opacity-70" />
        ) : null}
        <span className="min-w-0 truncate">{label}</span>
        {/* Framer hat keinen Löschknopf in der Zeile — der Wert geht über den
            Kopf oder den Pfad zurück. Hier steht er klein NEBEN der Beschriftung
            (Zurücksetzen der Geräte-Fassung bzw. Entfernen), damit die Felder
            rechts die volle Framer-Breite behalten. */}
        {(eigen || onEntfernen) && pfad ? (
          <button
            type="button"
            disabled={s.laeuft}
            onClick={() => (onEntfernen ? onEntfernen() : s.setzen(pfad, null))}
            aria-label={ueberschreibt ? t("zuruecksetzen") : t("entfernen")}
            title={ueberschreibt ? t("zuruecksetzen") : t("entfernen")}
            className="shrink-0 rounded p-0.5 opacity-0 transition group-hover/zeile:opacity-100 hover:text-foreground focus-visible:opacity-100 disabled:opacity-40"
          >
            <Icon icon={ueberschreibt ? "ph:arrow-counter-clockwise" : "ph:x"} className="size-3" />
          </button>
        ) : null}
      </span>
      <div className="flex min-w-0 flex-1 items-center gap-2.5">{children}</div>
    </div>
  );
}

/** Ein Eintrag im „+"-Menü einer Karte. */
export type PlusEintrag = { key: string; label: string; gesetzt: boolean };

/**
 * Kartenkopf mit „+"-Menü (Framer §0.3, §0.6).
 *
 * Leer: nur der Titel und ein „+". Der Klick darauf öffnet ein Suchmenü der
 * möglichen Einträge; ein Klick auf einen Eintrag ÖFFNET dessen Zeile — er
 * schreibt noch nichts. Framer legt hier bereits einen Standardwert an
 * (Fill „white"); wir nicht: ein Wert, den niemand eingegeben hat, wäre ein
 * erfundener (Wurzel 4). Die Zeile steht leer mit Platzhalter da, bis der
 * Kunde etwas eintippt.
 *
 * Gefüllt: der Kopf klappt zu und auf (Klick auf den Titel), das „+" bleibt.
 * Gesetzte Einträge stehen im Menü grau mit Häkchen.
 */
export function PlusKarte({
  titel,
  eintraege,
  offene,
  onOeffnen,
  children,
  geaendert = false,
}: {
  titel: string;
  eintraege: readonly PlusEintrag[];
  /** Die Einträge, deren Zeile gerade zu sehen ist (gesetzt oder geöffnet). */
  offene: ReadonlySet<string>;
  onOeffnen: (key: string) => void;
  children: ReactNode;
  geaendert?: boolean;
}) {
  const t = useTranslations("website.stil");
  const [menue, setMenue] = useState(false);
  const [zu, setZu] = useState(false);
  const [suche, setSuche] = useState("");
  const wurzel = useRef<HTMLDivElement>(null);
  const inhaltId = useId();
  const hatZeilen = offene.size > 0;
  // Kein „+", wenn nichts mehr hinzuzufügen ist — ein Knopf, der ein leeres
  // Menü öffnet, wäre eine Attrappe. Karten mit festen Zeilen (Layout, Stil)
  // haben dann nur den Auf-/Zuklapp-Griff, wie Framers „−".
  const nochOffen = eintraege.some((e) => !e.gesetzt && !offene.has(e.key));

  // Das Menü schließt bei Klick außerhalb — wie jedes Menü. Ohne das bliebe
  // es über der nächsten Karte stehen.
  useEffect(() => {
    if (!menue) return;
    function drauf(e: MouseEvent) {
      if (!wurzel.current?.contains(e.target as Node)) setMenue(false);
    }
    document.addEventListener("mousedown", drauf);
    return () => document.removeEventListener("mousedown", drauf);
  }, [menue]);

  const treffer = useMemo(() => {
    const q = suche.trim().toLowerCase();
    return q ? eintraege.filter((e) => e.label.toLowerCase().includes(q)) : eintraege;
  }, [eintraege, suche]);

  return (
    <div ref={wurzel} className="relative border-b border-border last:border-b-0">
      <div className="flex h-10 items-center gap-2 px-2.5">
        <button
          type="button"
          onClick={() => hatZeilen && setZu((z) => !z)}
          aria-expanded={hatZeilen ? !zu : undefined}
          aria-controls={hatZeilen ? inhaltId : undefined}
          className={
            "flex min-w-0 flex-1 items-center gap-2 text-left text-[0.8125rem] font-semibold " +
            (hatZeilen ? "cursor-pointer" : "cursor-default")
          }
        >
          <span className="truncate">{titel}</span>
          {geaendert ? (
            <span title={titel} className="size-1.5 shrink-0 rounded-full bg-(--brand)" />
          ) : null}
        </button>
        {hatZeilen ? (
          <button
            type="button"
            onClick={() => setZu((z) => !z)}
            aria-label={zu ? t("aufklappen") : t("zuklappen")}
            className="shrink-0 rounded p-1 text-muted-foreground transition hover:text-foreground"
          >
            <Icon icon={zu ? "ph:plus" : "ph:minus"} className="size-3.5" />
          </button>
        ) : null}
        {nochOffen ? (
          <button
            type="button"
            onClick={() => {
              setMenue((m) => !m);
              setSuche("");
            }}
            aria-haspopup="menu"
            aria-expanded={menue}
            aria-label={t("hinzufuegen", { karte: titel })}
            title={t("hinzufuegen", { karte: titel })}
            className="shrink-0 rounded p-1 text-muted-foreground transition hover:bg-secondary hover:text-foreground"
          >
            <Icon icon="ph:plus" className="size-3.5" />
          </button>
        ) : null}
      </div>

      {menue ? (
        <div
          role="menu"
          className="absolute right-3 top-9 z-20 w-56 rounded-lg border border-border bg-popover p-1 shadow-lg"
        >
          <div className="flex items-center gap-1.5 px-2 py-1">
            <Icon icon="ph:magnifying-glass" className="size-3.5 text-muted-foreground" />
            <input
              autoFocus
              value={suche}
              onChange={(e) => setSuche(e.target.value)}
              placeholder={t("suchen")}
              aria-label={t("suchen")}
              className="min-w-0 flex-1 bg-transparent text-[0.8125rem] outline-none"
            />
          </div>
          <ul className="max-h-64 overflow-y-auto">
            {treffer.map((e) => (
              <li key={e.key}>
                <button
                  type="button"
                  role="menuitem"
                  disabled={e.gesetzt || offene.has(e.key)}
                  onClick={() => {
                    onOeffnen(e.key);
                    setZu(false);
                    setMenue(false);
                  }}
                  className="flex w-full items-center justify-between gap-2 rounded px-2 py-1.5 text-left text-[0.8125rem] transition hover:bg-secondary disabled:text-muted-foreground disabled:hover:bg-transparent"
                >
                  <span className="truncate">{e.label}</span>
                  {e.gesetzt || offene.has(e.key) ? (
                    <Icon icon="ph:check" className="size-3.5 shrink-0" />
                  ) : null}
                </button>
              </li>
            ))}
            {treffer.length === 0 ? (
              <li className="px-2 py-1.5 text-[0.75rem] text-muted-foreground">
                {t("keinTreffer")}
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}

      {hatZeilen && !zu ? (
        <div id={inhaltId} className="flex flex-col gap-2.5 px-2.5 pb-2.5">
          {children}
        </div>
      ) : null}
    </div>
  );
}

/** Welche Zeilen einer Karte sichtbar sind: alle GESETZTEN plus die, die der
 *  Kunde über „+" geöffnet hat und noch nicht gefüllt. Eine gelöschte Zeile
 *  fällt heraus, sobald sie nicht mehr gesetzt ist — sonst stünde ein leeres
 *  Feld da, das der Kunde gerade entfernt hat. */
export function useOffene(gesetzte: readonly string[]) {
  const [geoeffnet, setGeoeffnet] = useState<ReadonlySet<string>>(new Set());
  const offene = useMemo(() => {
    const menge = new Set(gesetzte);
    for (const k of geoeffnet) menge.add(k);
    return menge;
  }, [gesetzte, geoeffnet]);
  function oeffne(key: string) {
    setGeoeffnet((g) => new Set(g).add(key));
  }
  function schliesse(key: string) {
    setGeoeffnet((g) => {
      const n = new Set(g);
      n.delete(key);
      return n;
    });
  }
  return { offene, oeffne, schliesse };
}

/** Klappliste im grauen Feld — für Werte mit mehr als drei Möglichkeiten
 *  (Framer nimmt dafür ebenfalls ein Dropdown, kein Segment). */
export function Auswahl<T extends string>({
  wert,
  optionen,
  leer,
  laeuft = false,
  onWahl,
}: {
  wert: T | null;
  optionen: readonly (readonly [T, string])[];
  /** Beschriftung der leeren Wahl („Automatisch"). Fehlt sie, gibt es keine. */
  leer?: string;
  laeuft?: boolean;
  onWahl: (wert: T | null) => void;
}) {
  return (
    <select
      value={wert ?? ""}
      disabled={laeuft}
      onChange={(e) => onWahl((e.target.value || null) as T | null)}
      className="h-[30px] min-w-0 flex-1 rounded-lg bg-secondary px-2 text-[0.8125rem] outline-none disabled:opacity-50"
    >
      {leer !== undefined ? <option value="">{leer}</option> : null}
      {optionen.map(([v, label]) => (
        <option key={v} value={v}>
          {label}
        </option>
      ))}
    </select>
  );
}

/** Ja/Nein als zwei Segmente; ein zweiter Klick setzt zurück. */
export function JaNein({
  wert,
  laeuft = false,
  onWahl,
}: {
  wert: boolean | null;
  laeuft?: boolean;
  onWahl: (wert: boolean | null) => void;
}) {
  const t = useTranslations("website.container");
  return (
    <div className="flex min-w-0 flex-1 gap-0.5 rounded-lg bg-secondary p-0.5">
      {([true, false] as const).map((v) => (
        <button
          key={String(v)}
          type="button"
          disabled={laeuft}
          aria-pressed={wert === v}
          onClick={() => onWahl(wert === v ? null : v)}
          className={
            "flex-1 rounded-[calc(var(--radius)-0.125rem)] py-1 text-[0.75rem] transition disabled:opacity-50 " +
            (wert === v
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground")
          }
        >
          {v ? t("ja") : t("nein")}
        </button>
      ))}
    </div>
  );
}

/** Textfeld im grauen Feld; schreibt beim Verlassen, `Enter` verlässt. */
export function Textfeld({
  wert,
  platzhalter,
  maxLaenge,
  muster,
  laeuft = false,
  onWert,
}: {
  wert: string | null;
  platzhalter?: string;
  maxLaenge?: number;
  /** Pflichtmuster (wie das Backend). Ein Wert, der nicht passt, wird NICHT
   *  geschrieben — das Feld färbt sich rot, statt dass der Server 400 sagt. */
  muster?: RegExp;
  laeuft?: boolean;
  onWert: (wert: string | null) => void;
}) {
  const [fehler, setFehler] = useState(false);
  return (
    <input
      key={wert ?? ""}
      defaultValue={wert ?? ""}
      placeholder={platzhalter ?? "—"}
      maxLength={maxLaenge}
      disabled={laeuft}
      aria-invalid={fehler || undefined}
      onChange={() => setFehler(false)}
      onBlur={(e) => {
        const roh = e.target.value.trim();
        if (roh === "") {
          if (wert !== null) onWert(null);
          return;
        }
        if (muster && !muster.test(roh)) {
          setFehler(true);
          return;
        }
        if (roh !== wert) onWert(roh);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      className={
        "min-w-0 flex-1 rounded-lg bg-secondary px-2 py-1.5 text-[0.8125rem] outline-none disabled:opacity-50 " +
        (fehler ? "ring-1 ring-destructive" : "")
      }
    />
  );
}

// --- Maß mit Einheit ---------------------------------------------------------

export const EINHEITEN = ["px", "%", "vh", "vw"] as const;
export type Einheit = string;
const MASS_RE = /^(-?\d{1,4}(?:\.\d{1,3})?)([a-z%]+)$/;

export function massZerlegen(
  wert: unknown,
  einheiten: readonly string[] = EINHEITEN,
): { zahl: number | null; einheit: Einheit } {
  if (typeof wert === "string") {
    const m = MASS_RE.exec(wert);
    if (m && einheiten.includes(m[2]!)) return { zahl: Number(m[1]), einheit: m[2]! };
  }
  return { zahl: null, einheit: einheiten[0] ?? "px" };
}

/** Zahl + Einheit als EIN Wert (`24px`, `50%`) — die geteilte Zeile aus
 *  Framer (§0.2): Zahl links, Liste rechts. Eine Zahl ohne Einheit ist kein
 *  Maß, deshalb zwei Felder, ein Wert. */
export function MassFeld({
  wert,
  negativ = false,
  dezimal = false,
  einheiten = EINHEITEN,
  platzhalter,
  laeuft = false,
  onWert,
}: {
  wert: unknown;
  /** Negative Werte erlaubt (Position, Versatz) — Größen nie. */
  negativ?: boolean;
  /** Dezimalstellen erlaubt (Schrift: `3.5rem`, `-0.035em`). */
  dezimal?: boolean;
  /** Die wählbaren Einheiten — Framers Dropdown neben der Zahl. */
  einheiten?: readonly string[];
  platzhalter?: string;
  laeuft?: boolean;
  onWert: (wert: string | null) => void;
}) {
  const { zahl, einheit } = massZerlegen(wert, einheiten);
  const [einheitWahl, setEinheitWahl] = useState<Einheit>(einheit);
  const aktuelleEinheit = zahl === null ? einheitWahl : einheit;
  return (
    <>
      <div className="flex h-[30px] min-w-0 flex-[3] items-center rounded-lg bg-secondary px-2">
        <input
          type="number"
          inputMode={dezimal ? "decimal" : "numeric"}
          step={dezimal ? 0.01 : 1}
          min={negativ ? -9999 : 0}
          max={9999}
          disabled={laeuft}
          key={zahl ?? ""}
          defaultValue={zahl ?? ""}
          placeholder={platzhalter ?? "—"}
          onBlur={(e) => {
            const roh = e.target.value.trim();
            if (roh === "") {
              if (zahl !== null) onWert(null);
              return;
            }
            const roher = Number(roh.replace(",", "."));
            const n = dezimal ? Math.round(roher * 1000) / 1000 : Math.round(roher);
            if (!Number.isFinite(n) || (!negativ && n < 0)) return;
            if (n === zahl) return;
            onWert(`${n}${aktuelleEinheit}`);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          className="h-full min-w-0 flex-1 bg-transparent text-[0.8125rem] outline-none disabled:opacity-50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
        />
      </div>
      <select
        value={aktuelleEinheit}
        disabled={laeuft}
        aria-label="Einheit"
        onChange={(e) => {
          const neu = e.target.value as Einheit;
          setEinheitWahl(neu);
          if (zahl !== null) onWert(`${zahl}${neu}`);
        }}
        className="h-[30px] min-w-0 flex-[2] rounded-lg bg-secondary px-1 text-[0.75rem] outline-none disabled:opacity-50"
      >
        {einheiten.map((u) => (
          <option key={u} value={u}>
            {u}
          </option>
        ))}
      </select>
    </>
  );
}

// --- Farbe -------------------------------------------------------------------

const HEX_RE = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;

/** Hex ODER Farbrolle des Themes (`rolle:primary`) — die zwei Formen, die das
 *  Backend annimmt. Schachbrett = keine Farbe (ein eigener Zustand, keine
 *  erfundene Ersatzfarbe). */
export function farbeZerlegen(
  wert: unknown,
): { art: "hex" | "rolle" | null; hex: string | null; alpha: number; rolle: string | null } {
  if (typeof wert !== "string") return { art: null, hex: null, alpha: 100, rolle: null };
  if (wert.startsWith("rolle:")) {
    const rolle = wert.slice(6);
    return (FARBROLLEN as readonly string[]).includes(rolle)
      ? { art: "rolle", hex: null, alpha: 100, rolle }
      : { art: null, hex: null, alpha: 100, rolle: null };
  }
  if (!HEX_RE.test(wert)) return { art: null, hex: null, alpha: 100, rolle: null };
  const hex = wert.slice(0, 7).toLowerCase();
  const alpha = wert.length === 9 ? Math.round((parseInt(wert.slice(7, 9), 16) / 255) * 100) : 100;
  return { art: "hex", hex, alpha, rolle: null };
}

function mitAlpha(hex: string, alpha: number): string {
  if (alpha >= 100) return hex;
  const a = Math.round((Math.max(0, alpha) / 100) * 255)
    .toString(16)
    .padStart(2, "0");
  return `${hex}${a}`;
}

const LEER_MUSTER = {
  backgroundImage:
    "linear-gradient(45deg,#c9c9c9 25%,transparent 25%,transparent 75%,#c9c9c9 75%)," +
    "linear-gradient(45deg,#c9c9c9 25%,transparent 25%,transparent 75%,#c9c9c9 75%)",
  backgroundSize: "6px 6px",
  backgroundPosition: "0 0, 3px 3px",
} as const;

/**
 * Farbfeld: Punkt + Wert. Der Klick auf den Punkt klappt INLINE auf (kein
 * schwebendes Fenster — das ragte aus der Leiste und wurde beschnitten, siehe
 * `design/farbwaehler.tsx`): Hex mit Browser-Wähler und Deckung, oder eine
 * Farbrolle des Themes. Rollen sind Framers „Color Styles" (§0.7): die Farbe
 * folgt dem Theme, statt hier festgeschrieben zu werden.
 */
export function FarbFeld({
  wert,
  mitAlphaRegler = true,
  laeuft = false,
  onWert,
}: {
  wert: unknown;
  mitAlphaRegler?: boolean;
  laeuft?: boolean;
  onWert: (wert: string | null) => void;
}) {
  const t = useTranslations("website.stil");
  const [offen, setOffen] = useState(false);
  const { art, hex, alpha, rolle } = farbeZerlegen(wert);
  const [reiter, setReiter] = useState<"hex" | "rolle">(art === "rolle" ? "rolle" : "hex");

  const punkt =
    art === "hex" && hex
      ? { backgroundColor: mitAlpha(hex, alpha) }
      : art === "rolle"
        ? { backgroundImage: "linear-gradient(135deg,#7c3aed,#0ea5e9)" }
        : LEER_MUSTER;

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-1">
      <div className="flex h-[30px] min-w-0 items-center gap-1.5 rounded-lg bg-secondary px-1.5">
        <button
          type="button"
          disabled={laeuft}
          onClick={() => setOffen((o) => !o)}
          aria-expanded={offen}
          aria-label={t("farbeWaehlen")}
          title={t("farbeWaehlen")}
          className="size-[22px] shrink-0 rounded-[5px] border border-border"
          style={punkt}
        />
        <input
          key={String(wert ?? "")}
          defaultValue={art === "rolle" ? rolle ?? "" : hex ?? ""}
          placeholder="—"
          disabled={laeuft}
          spellCheck={false}
          onBlur={(e) => {
            const roh = e.target.value.trim();
            if (roh === "") {
              if (art !== null) onWert(null);
              return;
            }
            if ((FARBROLLEN as readonly string[]).includes(roh)) {
              onWert(`rolle:${roh}`);
              return;
            }
            const h = roh.startsWith("#") ? roh : `#${roh}`;
            if (HEX_RE.test(h)) onWert(h.toLowerCase());
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
          className="h-full min-w-0 flex-1 bg-transparent font-mono text-[0.75rem] outline-none disabled:opacity-50"
        />
        {art === "hex" && alpha < 100 ? (
          <span className="shrink-0 text-[0.6875rem] text-muted-foreground">{alpha}%</span>
        ) : null}
      </div>

      {offen ? (
        <div className="flex flex-col gap-2 rounded-lg border border-border p-2">
          <div className="flex gap-0.5 rounded-lg bg-secondary p-0.5">
            {(["hex", "rolle"] as const).map((r) => (
              <button
                key={r}
                type="button"
                aria-pressed={reiter === r}
                onClick={() => setReiter(r)}
                className={
                  "flex-1 rounded-[calc(var(--radius)-0.125rem)] py-1 text-[0.75rem] transition " +
                  (reiter === r
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground")
                }
              >
                {t(`farbe.${r}`)}
              </button>
            ))}
          </div>
          {reiter === "hex" ? (
            <div className="flex flex-col gap-2">
              <input
                type="color"
                value={hex ?? "#ffffff"}
                disabled={laeuft}
                onChange={(e) => onWert(mitAlpha(e.target.value.toLowerCase(), alpha))}
                aria-label={t("farbe.hex")}
                className="h-8 w-full cursor-pointer rounded border border-border bg-transparent"
              />
              {mitAlphaRegler ? (
                <label className="flex items-center gap-2 text-[0.75rem] text-muted-foreground">
                  <span className="w-14 shrink-0">{t("farbe.deckung")}</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={alpha}
                    disabled={laeuft || hex === null}
                    onChange={(e) => hex && onWert(mitAlpha(hex, Number(e.target.value)))}
                    className="nd-schieber min-w-0 flex-1"
                  />
                  <span className="w-9 text-right">{alpha}%</span>
                </label>
              ) : null}
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-0.5">
              {FARBROLLEN.map((r) => (
                <li key={r}>
                  <button
                    type="button"
                    disabled={laeuft}
                    aria-pressed={rolle === r}
                    onClick={() => onWert(`rolle:${r}`)}
                    className={
                      "flex w-full items-center gap-2 rounded px-2 py-1 text-left font-mono text-[0.75rem] transition hover:bg-secondary " +
                      (rolle === r ? "bg-secondary" : "")
                    }
                  >
                    <Icon icon="ph:palette" className="size-3.5 shrink-0 text-muted-foreground" />
                    <span className="truncate">{r}</span>
                    {rolle === r ? <Icon icon="ph:check" className="ml-auto size-3.5" /> : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

/** Chip mit Entfernen — Framers drittes Zeilenmuster (Schatten, Verlaufsstufe). */
export function Chip({
  children,
  onEntfernen,
  laeuft = false,
  aktiv = false,
  onClick,
}: {
  children: ReactNode;
  onEntfernen: () => void;
  laeuft?: boolean;
  aktiv?: boolean;
  onClick?: () => void;
}) {
  const t = useTranslations("website.stil");
  return (
    <div
      className={
        "flex min-w-0 items-center gap-1 rounded-lg bg-secondary pl-2 pr-1 " +
        (aktiv ? "ring-1 ring-(--brand)" : "")
      }
    >
      <button
        type="button"
        onClick={onClick}
        disabled={laeuft}
        className="min-w-0 flex-1 truncate py-1.5 text-left text-[0.75rem]"
      >
        {children}
      </button>
      <button
        type="button"
        disabled={laeuft}
        onClick={onEntfernen}
        aria-label={t("entfernen")}
        title={t("entfernen")}
        className="shrink-0 rounded p-1 text-muted-foreground transition hover:text-destructive disabled:opacity-40"
      >
        <Icon icon="ph:x" className="size-3" />
      </button>
    </div>
  );
}

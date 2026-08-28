"use client";

// Die Bedienung von SORTIERUNG und FILTER in der Werkzeugleiste (Framer B4/B5).
//
//     [⇅ Sortierung ⌄]   → Panel: Feld · Richtung · [Verwerfen] [Speichern]
//     [⚟ Filter ⌄]       → Menü:  Feld → Operator → Wert   (greift sofort)
//     Chips daneben:      Branche enthält „Ferien" ×
//
// Die ASYMMETRIE ist Absicht und steht in der Analyse (Abschnitt G): die
// Sortierung ist ein ENTWURF mit Verwerfen/Speichern, der Filter greift
// sofort. Eine Sortierung ist eine Eigenschaft der Liste, ein Filter ein
// Blick, den man wieder wegnimmt.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";

import { Input } from "@nextdays/ui/input";
import { cn } from "@nextdays/ui/utils";

import {
  type Filter,
  type Operator,
  type Sortierung,
  brauchtWert,
  operatorenFuer,
} from "./filter";
import type { Spalte } from "./spalten";

/** Ein Popover, das bei einem Klick daneben zugeht.
 *
 *  Kein `Escape`-Handler: in dieser Oberfläche schliesst Escape das ganze
 *  Panel, nicht das Menü — dieselbe Falle, die die Analyse für Framer
 *  festhält („Nie Escape"). */
function Popover({
  offen,
  onZu,
  children,
}: {
  offen: boolean;
  onZu: () => void;
  children: React.ReactNode;
}) {
  const huelle = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!offen) return;
    function aufKlick(e: MouseEvent) {
      if (!huelle.current?.contains(e.target as Node)) onZu();
    }
    document.addEventListener("mousedown", aufKlick);
    return () => document.removeEventListener("mousedown", aufKlick);
  }, [offen, onZu]);
  return <div ref={huelle} className="relative shrink-0">{children}</div>;
}

export function SortierPanel({
  spalten,
  entwurf,
  angewandt,
  onEntwurf,
  onSpeichern,
  onVerwerfen,
}: {
  spalten: readonly Spalte[];
  entwurf: Sortierung;
  angewandt: Sortierung;
  onEntwurf: (s: Sortierung) => void;
  onSpeichern: () => void;
  onVerwerfen: () => void;
}) {
  const t = useTranslations("website");
  const [offen, setOffen] = useState(false);
  const offenerEntwurf =
    entwurf.key !== angewandt.key || entwurf.richtung !== angewandt.richtung;
  const name =
    entwurf.key === "manuell"
      ? t("blog.cm.manuell")
      : (spalten.find((s) => s.key === entwurf.key)?.label ?? entwurf.key);

  return (
    <Popover offen={offen} onZu={() => setOffen(false)}>
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={offen}
        title={t("blog.sortierung")}
        onClick={() => setOffen((o) => !o)}
        className="inline-flex h-8 items-center gap-1.5 rounded-(--radius) px-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <Icon icon="ph:arrows-down-up" className="size-4" />
        <span className="max-w-40 truncate">{name}</span>
        {/* Der Punkt zeigt den OFFENEN Entwurf. Ohne ihn sähe die Tabelle
            sortiert aus, und beim nächsten Öffnen wäre sie es nicht mehr. */}
        {offenerEntwurf ? (
          <span
            aria-hidden
            className="size-1.5 rounded-full bg-(--brand)"
          />
        ) : null}
      </button>

      {offen ? (
        <div className="absolute left-0 top-9 z-50 flex w-72 flex-col gap-2 rounded-(--radius) border border-border bg-background p-2 shadow-xl">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {t("blog.sortierenNach")}
            <select
              value={entwurf.key}
              onChange={(e) =>
                onEntwurf({ ...entwurf, key: e.target.value })
              }
              className="h-8 rounded-(--radius) border border-border bg-transparent px-2 text-sm text-foreground"
            >
              {/* Die HANDSORTIERUNG steht oben und ist keine Spalte: sie liegt
                  in `post_sort` und liesse sich nicht anzeigen. */}
              <option value="manuell">{t("blog.cm.manuell")}</option>
              {spalten.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>

          {entwurf.key !== "manuell" ? (
            <div className="flex gap-1">
              {(["auf", "ab"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => onEntwurf({ ...entwurf, richtung: r })}
                  className={cn(
                    "flex-1 rounded-(--radius) px-2 py-1.5 text-xs transition",
                    entwurf.richtung === r
                      ? "bg-secondary font-medium text-foreground"
                      : "text-muted-foreground hover:bg-secondary/60",
                  )}
                >
                  {t(`blog.sortRichtung.${r}`)}
                </button>
              ))}
            </div>
          ) : null}

          {offenerEntwurf ? (
            <div className="flex justify-end gap-1 border-t border-border pt-2">
              <button
                type="button"
                onClick={onVerwerfen}
                className="rounded-(--radius) px-2 py-1 text-xs text-muted-foreground transition hover:bg-secondary hover:text-foreground"
              >
                {t("blog.cm.sortVerwerfen")}
              </button>
              <button
                type="button"
                onClick={() => {
                  onSpeichern();
                  setOffen(false);
                }}
                className="rounded-(--radius) bg-(--brand) px-2.5 py-1 text-xs font-medium text-white transition hover:opacity-90"
              >
                {t("blog.cm.sortSpeichern")}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </Popover>
  );
}

export function FilterMenue({
  spalten,
  onHinzu,
}: {
  spalten: readonly Spalte[];
  onHinzu: (f: Filter) => void;
}) {
  const t = useTranslations("website");
  const [offen, setOffen] = useState(false);
  const [suche, setSuche] = useState("");
  //: Das gewählte Feld — Schritt 2 des Menüs. `null` = Feldliste.
  const [feld, setFeld] = useState<Spalte | null>(null);
  const [op, setOp] = useState<Operator>("enthaelt");
  const [wert, setWert] = useState("");

  function schliessen() {
    setOffen(false);
    setFeld(null);
    setSuche("");
    setWert("");
  }

  const gefiltert = spalten.filter((s) =>
    s.label.toLowerCase().includes(suche.trim().toLowerCase()),
  );

  return (
    <Popover offen={offen} onZu={schliessen}>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={offen}
        title={t("blog.filter")}
        aria-label={t("blog.filter")}
        onClick={() => setOffen((o) => !o)}
        className="inline-flex size-8 items-center justify-center rounded-(--radius) text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <Icon icon="ph:funnel" className="size-4" />
      </button>

      {offen ? (
        <div className="absolute left-0 top-9 z-50 flex max-h-96 w-72 flex-col rounded-(--radius) border border-border bg-background shadow-xl">
          {feld === null ? (
            <>
              <div className="border-b border-border p-2">
                <Input
                  autoFocus
                  value={suche}
                  onChange={(e) => setSuche(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  placeholder={t("blog.cm.spaltenSuchen")}
                  className="h-8"
                />
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-1">
                {gefiltert.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    onClick={() => {
                      setFeld(s);
                      // Der erste passende Operator ist die Vorgabe — nicht
                      // ein fester wie „enthält", der zu einem Schalter gar
                      // nicht passt und dauerhaft nichts fände.
                      const ops = operatorenFuer(s.art);
                      setOp(ops[0] ?? "gesetzt");
                      setWert("");
                    }}
                    className="flex w-full items-center gap-2 rounded-(--radius) px-2 py-1.5 text-left text-sm transition-colors hover:bg-secondary/60"
                  >
                    <span className="min-w-0 flex-1 truncate">{s.label}</span>
                    <Icon
                      icon="ph:caret-right"
                      className="size-3.5 text-muted-foreground"
                    />
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="flex flex-col gap-2 p-2">
              <button
                type="button"
                onClick={() => setFeld(null)}
                className="flex items-center gap-1 self-start text-xs text-muted-foreground transition hover:text-foreground"
              >
                <Icon icon="ph:caret-left" className="size-3.5" />
                {feld.label}
              </button>

              <select
                value={op}
                onChange={(e) => setOp(e.target.value as Operator)}
                className="h-8 rounded-(--radius) border border-border bg-transparent px-2 text-sm"
              >
                {operatorenFuer(feld.art).map((o) => (
                  <option key={o} value={o}>
                    {t(`blog.filterOp.${o}`)}
                  </option>
                ))}
              </select>

              {brauchtWert(op) ? (
                <Input
                  autoFocus
                  type={feld.art === "datum" ? "date" : "text"}
                  value={wert}
                  onChange={(e) => setWert(e.target.value)}
                  onKeyDown={(e) => e.stopPropagation()}
                  placeholder={t("blog.filterWert")}
                  className="h-8"
                />
              ) : null}

              <button
                type="button"
                disabled={brauchtWert(op) && !wert.trim()}
                onClick={() => {
                  onHinzu({ key: feld.key, op, wert });
                  schliessen();
                }}
                className="rounded-(--radius) bg-(--brand) px-2.5 py-1.5 text-xs font-medium text-white transition hover:opacity-90 disabled:opacity-40"
              >
                {t("blog.filterAnwenden")}
              </button>
            </div>
          )}
        </div>
      ) : null}
    </Popover>
  );
}

/** Die gesetzten Filter als Chips.
 *
 *  Sie stehen SICHTBAR in der Leiste, jeder mit seinem `×`. Ein stiller Filter
 *  ist der häufigste Grund für „mein Beitrag ist weg" — und bei mehreren
 *  Filtern hilft die Zahl allein nicht: man muss sehen, WELCHER greift. */
export function FilterChips({
  filter,
  spalten,
  onEntfernen,
}: {
  filter: readonly Filter[];
  spalten: readonly Spalte[];
  onEntfernen: (index: number) => void;
}) {
  const t = useTranslations("website");
  return (
    <>
      {filter.map((f, i) => {
        const name = spalten.find((s) => s.key === f.key)?.label ?? f.key;
        return (
          <span
            key={`${f.key}-${f.op}-${i}`}
            className="inline-flex shrink-0 items-center gap-1 rounded-full bg-(--brand)/10 py-0.5 pl-2.5 pr-1 text-xs font-medium text-(--brand)"
          >
            <span className="max-w-56 truncate">
              {name} {t(`blog.filterOp.${f.op}`).toLowerCase()}
              {brauchtWert(f.op) ? ` „${f.wert}"` : ""}
            </span>
            <button
              type="button"
              aria-label={t("blog.cm.filterEntfernen")}
              onClick={() => onEntfernen(i)}
              className="inline-flex size-4 items-center justify-center rounded-full transition hover:bg-(--brand)/20"
            >
              <Icon icon="ph:x" className="size-3" />
            </button>
          </span>
        );
      })}
    </>
  );
}

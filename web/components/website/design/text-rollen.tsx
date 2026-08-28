"use client";

// Die Text-Rollen des Themes (0447) — Hostaways Abschnitt „Text".
//
// Acht Rollen: DFLT (alles, was keine eigene Zuordnung hat — Menü, Beschriftung,
// Fußzeile), PAR (der Absatz) und H1–H6. Je Rolle Schriftart, Größe getrennt für
// Desktop und Mobil, „Text skalieren", Farbe, Stärke, Zeilenhöhe, Laufweite,
// Großbuchstaben und Schatten. Unter DFLT stehen zusätzlich die drei
// Link-Zustände und die Unterstreichung — dort führt Hostaway sie auch.
//
// JEDES Feld hat den dritten Zustand „nicht gewählt", und der ist NICHT
// derselbe wie ein Mittelwert: solange nichts gewählt ist, gilt genau das, was
// der Renderer heute tut, und eine bestehende Kundenseite sieht unverändert aus
// (Wurzel 1). Deshalb steht neben jedem Regler „Standard" und ein Knopf zurück
// dorthin.
//
// Was hier bewusst FEHLT, obwohl Hostaway es hat:
//   · Ausrichtung. Sie gehört an den Abschnitt: dieselbe H2 steht im Hero
//     zentriert und im Textabschnitt links. Als Theme-Wert wäre sie an einer der
//     beiden Stellen immer falsch.
//   · Textrichtung. Sie folgt der Sprache, nicht dem Geschmack — unsere 24
//     Sprachen sind alle LTR.
import { Icon } from "@iconify/react";

import { NativeSelect } from "@nextdays/ui/native-select";
import type {
  TextRolle,
  TextSchatten,
  TextStil,
  ThemeFarbe,
} from "@/lib/site-config";
import { FONT_CATALOG } from "@/lib/website-fonts";

import { Farbwaehler, type FarbwaehlerTexte } from "./farbwaehler";

export const TEXT_ROLLEN: TextRolle[] = [
  "dflt",
  "par",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
];

/** Schriftstärken in Hundertern. Ein Zwischenwert wie 450 fiele bei einer
 *  nicht-variablen Schrift still auf 400 zurück — der Kunde stellte etwas ein
 *  und sähe nichts. */
const STAERKEN = [100, 200, 300, 400, 500, 600, 700, 800, 900];

const SCHATTEN: TextSchatten[] = ["keiner", "weich", "hart"];

export type TextRollenTexte = {
  rolle: (r: TextRolle) => string;
  rolleHinweis: (r: TextRolle) => string;
  schrift: string;
  erbt: string;
  groesseDesktop: string;
  groesseMobil: string;
  skalieren: string;
  skalierenHinweis: string;
  farbe: string;
  staerke: string;
  zeilenhoehe: string;
  laufweite: string;
  grossbuchstaben: string;
  schatten: string;
  schattenWert: (s: TextSchatten) => string;
  linkTitel: string;
  linkNormal: string;
  linkHover: string;
  linkBesucht: string;
  linkUnterstrichen: string;
  standard: string;
  zuruecksetzen: string;
  farbwaehler: FarbwaehlerTexte;
};

export function TextRollen({
  stile,
  onStil,
  offen,
  onOffen,
  palette,
  verknuepfungen,
  onVerknuepfe,
  hintergrund,
  texte,
}: {
  stile: Partial<Record<TextRolle, TextStil>>;
  onStil: (rolle: TextRolle, patch: Partial<TextStil>) => void;
  /** Aufgeklappte Rolle. Genau eine, damit die schmale Leiste lesbar bleibt. */
  offen: TextRolle | null;
  onOffen: (r: TextRolle | null) => void;
  palette: ThemeFarbe[];
  verknuepfungen: Record<string, string | undefined>;
  onVerknuepfe: (rolle: string, id: string | null) => void;
  /** Untergrund, gegen den der Kontrast der Schriftfarbe gemessen wird. */
  hintergrund: string | null;
  texte: TextRollenTexte;
}) {
  return (
    <div className="flex flex-col">
      {TEXT_ROLLEN.map((rolle) => {
        const stil = stile[rolle] ?? {};
        const istOffen = offen === rolle;
        const setze = (patch: Partial<TextStil>) => onStil(rolle, patch);
        return (
          <div key={rolle}>
            <button
              type="button"
              aria-expanded={istOffen}
              onClick={() => onOffen(istOffen ? null : rolle)}
              className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left transition hover:bg-secondary/40"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm">
                  {texte.rolle(rolle)}
                </span>
                <span className="block truncate text-xs text-muted-foreground">
                  {texte.rolleHinweis(rolle)}
                </span>
              </span>
              <Icon
                icon={istOffen ? "ph:caret-up" : "ph:caret-down"}
                className="size-4 shrink-0 text-muted-foreground"
              />
            </button>

            {istOffen ? (
              <div className="flex flex-col gap-3 border-y border-border bg-secondary/40 py-3">
                <div className="flex flex-col gap-3 px-4">
                  <Feld label={texte.schrift}>
                    <NativeSelect
                      value={stil.font ?? ""}
                      onChange={(e) =>
                        setze({ font: e.target.value || null })
                      }
                    >
                      <option value="">{texte.erbt}</option>
                      {FONT_CATALOG.map((f) => (
                        <option key={f.family} value={f.family}>
                          {f.label}
                        </option>
                      ))}
                    </NativeSelect>
                  </Feld>

                  <Zahl
                    label={texte.groesseDesktop}
                    wert={stil.size_desktop ?? null}
                    min={8}
                    max={200}
                    schritt={1}
                    einheit="px"
                    texte={texte}
                    onChange={(v) => setze({ size_desktop: v })}
                  />
                  <Zahl
                    label={texte.groesseMobil}
                    wert={stil.size_mobile ?? null}
                    min={8}
                    max={200}
                    schritt={1}
                    einheit="px"
                    texte={texte}
                    onChange={(v) => setze({ size_mobile: v })}
                  />

                  <Schalter
                    label={texte.skalieren}
                    hinweis={texte.skalierenHinweis}
                    an={stil.scale_text === true}
                    onAn={(an) => setze({ scale_text: an })}
                  />

                  <Feld label={texte.staerke}>
                    <NativeSelect
                      value={stil.weight ? String(stil.weight) : ""}
                      onChange={(e) =>
                        setze({
                          weight: e.target.value
                            ? Number(e.target.value)
                            : null,
                        })
                      }
                    >
                      <option value="">{texte.standard}</option>
                      {STAERKEN.map((w) => (
                        <option key={w} value={w}>
                          {w}
                        </option>
                      ))}
                    </NativeSelect>
                  </Feld>

                  <Zahl
                    label={texte.zeilenhoehe}
                    wert={stil.line_height ?? null}
                    min={0.8}
                    max={3}
                    schritt={0.05}
                    einheit=""
                    texte={texte}
                    onChange={(v) => setze({ line_height: v })}
                  />
                  <Zahl
                    label={texte.laufweite}
                    wert={stil.letter_spacing ?? null}
                    min={-0.1}
                    max={0.5}
                    schritt={0.01}
                    einheit="em"
                    texte={texte}
                    onChange={(v) => setze({ letter_spacing: v })}
                  />

                  <Schalter
                    label={texte.grossbuchstaben}
                    an={stil.uppercase === true}
                    onAn={(an) => setze({ uppercase: an })}
                  />

                  <Feld label={texte.schatten}>
                    <NativeSelect
                      value={stil.shadow ?? "keiner"}
                      onChange={(e) =>
                        setze({ shadow: e.target.value as TextSchatten })
                      }
                    >
                      {SCHATTEN.map((s) => (
                        <option key={s} value={s}>
                          {texte.schattenWert(s)}
                        </option>
                      ))}
                    </NativeSelect>
                  </Feld>
                </div>

                <Farbwaehler
                  wert={stil.color ?? null}
                  label={texte.farbe}
                  texte={texte.farbwaehler}
                  palette={palette}
                  verknuepft={verknuepfungen[`text_${rolle}`] ?? null}
                  onVerknuepfe={(id) => onVerknuepfe(`text_${rolle}`, id)}
                  gegenfarbe={hintergrund}
                  onChange={(hex) => setze({ color: hex })}
                />

                {/* Linkfarben gibt es NUR unter DFLT — auf einer anderen Rolle
                    weist der Server sie mit 422 ab, weil sie dort wirkungslos
                    wären. Die Oberfläche zeigt sie deshalb auch nur dort. */}
                {rolle === "dflt" ? (
                  <>
                    <p className="px-4 text-xs font-semibold text-muted-foreground">
                      {texte.linkTitel}
                    </p>
                    <Farbwaehler
                      wert={stil.link_color ?? null}
                      label={texte.linkNormal}
                      texte={texte.farbwaehler}
                      palette={palette}
                      verknuepft={verknuepfungen.link_normal ?? null}
                      onVerknuepfe={(id) => onVerknuepfe("link_normal", id)}
                      gegenfarbe={hintergrund}
                      onChange={(hex) => setze({ link_color: hex })}
                    />
                    <Farbwaehler
                      wert={stil.link_hover_color ?? null}
                      label={texte.linkHover}
                      texte={texte.farbwaehler}
                      palette={palette}
                      verknuepft={verknuepfungen.link_hover ?? null}
                      onVerknuepfe={(id) => onVerknuepfe("link_hover", id)}
                      gegenfarbe={hintergrund}
                      onChange={(hex) => setze({ link_hover_color: hex })}
                    />
                    <Farbwaehler
                      wert={stil.link_visited_color ?? null}
                      label={texte.linkBesucht}
                      texte={texte.farbwaehler}
                      palette={palette}
                      verknuepft={verknuepfungen.link_besucht ?? null}
                      onVerknuepfe={(id) => onVerknuepfe("link_besucht", id)}
                      gegenfarbe={hintergrund}
                      onChange={(hex) => setze({ link_visited_color: hex })}
                    />
                    <div className="px-4">
                      <Schalter
                        label={texte.linkUnterstrichen}
                        an={stil.link_underline === true}
                        onAn={(an) => setze({ link_underline: an })}
                      />
                    </div>
                  </>
                ) : null}
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function Feld({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium">{label}</span>
      {children}
    </label>
  );
}

function Schalter({
  label,
  hinweis,
  an,
  onAn,
}: {
  label: string;
  hinweis?: string;
  an: boolean;
  onAn: (an: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-2">
      <input
        type="checkbox"
        checked={an}
        onChange={(e) => onAn(e.target.checked)}
        className="mt-0.5 size-3.5 shrink-0 accent-foreground"
      />
      <span className="min-w-0">
        <span className="block text-xs font-medium">{label}</span>
        {hinweis ? (
          <span className="block text-xs leading-snug text-muted-foreground">
            {hinweis}
          </span>
        ) : null}
      </span>
    </label>
  );
}

/** Ein Zahlenfeld mit dem dritten Zustand „nicht gewählt".
 *
 *  Ein `<input type="number">` kann „leer" darstellen — anders als ein Regler,
 *  der immer eine Position hat. Deshalb hier ein Feld und kein Schieber: die
 *  Aussage „Standard" muss ablesbar bleiben, sonst speichert der Kunde einen
 *  Wert, den er nie gewählt hat (Wurzel 4). */
function Zahl({
  label,
  wert,
  min,
  max,
  schritt,
  einheit,
  texte,
  onChange,
}: {
  label: string;
  wert: number | null;
  min: number;
  max: number;
  schritt: number;
  einheit: string;
  texte: { standard: string; zuruecksetzen: string };
  onChange: (v: number | null) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium">{label}</span>
        {wert === null ? (
          <span className="text-xs text-muted-foreground">{texte.standard}</span>
        ) : (
          <button
            type="button"
            onClick={() => onChange(null)}
            title={texte.zuruecksetzen}
            aria-label={texte.zuruecksetzen}
            className="text-muted-foreground transition hover:text-destructive"
          >
            <Icon icon="ph:arrow-counter-clockwise" className="size-3.5" />
          </button>
        )}
      </div>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={wert ?? ""}
          min={min}
          max={max}
          step={schritt}
          aria-label={label}
          placeholder={texte.standard}
          onChange={(e) => {
            const v = e.target.value;
            // Leer heißt „nicht gewählt" und ist ein echter Zustand — nicht 0.
            if (v === "") {
              onChange(null);
              return;
            }
            const n = Number(v);
            if (!Number.isNaN(n)) onChange(n);
          }}
          className="min-w-0 flex-1 rounded-(--radius) border border-border bg-background px-2 py-1 text-xs"
        />
        {einheit ? (
          <span className="text-xs text-muted-foreground">{einheit}</span>
        ) : null}
      </div>
    </div>
  );
}

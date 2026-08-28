"use client";

// „Breite & Abstand" (0447) — Hostaways Abschnitt `Width & Spacing`.
//
// Aufbau wie dort: erst der Schalter `Full width`, dann drei Knöpfe
// `1200px | 1440px | Eigener Wert`, darunter Regler, Zahlenfeld und die Einheit
// (px oder vw). Danach der Abschnitts-Abstand.
//
// Zwei bewusste Abweichungen, beide aus unserem Layout begründet:
//
//   · Hostaway koppelt die HORIZONTALEN Werte mit einem Kettensymbol, das man
//     lösen kann. Bei uns gibt es nichts zu lösen: ein Abschnitt hat links und
//     rechts denselben Rand, es ist EIN Wert. Ein Kettensymbol, das immer
//     geschlossen ist, wäre eine Attrappe (Wurzel 4).
//   · „Spaltenabstand" und „Innerer Spaltenabstand" fehlen. Unser Renderer
//     stapelt Abschnitte; eine allgemeine Spalten-Ebene gibt es nicht.
//
// Zwei Zurück-Knöpfe, und das ist Absicht: `auf 0` ist Hostaways
// „Auffüllung zurücksetzen" (alles auf null Pixel), `Standard` ist der dritte
// Zustand „nie gewählt" — dann gilt, was die Abschnitte selbst mitbringen. Die
// beiden sind NICHT dasselbe, und nur der zweite lässt eine bestehende Seite
// aussehen wie vorher (Wurzel 1).
import { Icon } from "@iconify/react";

import { NativeSelect } from "@nextdays/ui/native-select";
import type { Breiteneinheit } from "@/lib/site-config";

/** Hostaways beide Vorgabe-Breiten. */
const VORGABEN = [1200, 1440];

/** Grenzen je Einheit — dieselben, die die DB als CHECK führt (0447). */
const GRENZEN: Record<Breiteneinheit, { min: number; max: number }> = {
  px: { min: 960, max: 1920 },
  vw: { min: 50, max: 100 },
};

export type BreiteAbstandTexte = {
  titel: string;
  hinweis: string;
  vollbreite: string;
  vollbreiteHinweis: string;
  eigenerWert: string;
  breite: string;
  standard: string;
  abstandTitel: string;
  abstandHinweis: string;
  abstandVertikal: string;
  abstandHorizontal: string;
  aufNull: string;
  zuruecksetzen: string;
};

export function BreiteAbstand({
  breite,
  einheit,
  vollbreite,
  abstandY,
  abstandX,
  setze,
  texte,
}: {
  breite: number | null;
  einheit: Breiteneinheit;
  vollbreite: boolean;
  abstandY: number | null;
  abstandX: number | null;
  setze: (patch: {
    content_width?: number | null;
    content_width_unit?: Breiteneinheit;
    content_full_width?: boolean;
    section_spacing_y?: number | null;
    section_spacing_x?: number | null;
  }) => void;
  texte: BreiteAbstandTexte;
}) {
  const grenze = GRENZEN[einheit];

  /** Einheit wechseln heißt: die Zahl muss in den neuen Bereich passen.
   *
   *  Ohne diese Umrechnung stünde nach dem Wechsel `1440` mit Einheit `vw` in
   *  der Eingabe — der Server lehnt das mit 422 ab, und der Kunde sieht nur,
   *  dass „nichts gespeichert wird". Es wird NICHT geraten: bei einem Wechsel
   *  ohne gesetzten Wert bleibt er leer. */
  function wechsleEinheit(neu: Breiteneinheit) {
    if (breite === null) {
      setze({ content_width_unit: neu });
      return;
    }
    const g = GRENZEN[neu];
    setze({
      content_width_unit: neu,
      content_width: Math.min(g.max, Math.max(g.min, breite)),
    });
  }

  return (
    <div className="flex flex-col gap-3 px-4">
      <p className="text-xs text-muted-foreground">{texte.hinweis}</p>

      <label className="flex items-start gap-2">
        <input
          type="checkbox"
          checked={vollbreite}
          onChange={(e) => setze({ content_full_width: e.target.checked })}
          className="mt-0.5 size-3.5 shrink-0 accent-foreground"
        />
        <span className="min-w-0">
          <span className="block text-xs font-medium">{texte.vollbreite}</span>
          <span className="block text-xs leading-snug text-muted-foreground">
            {texte.vollbreiteHinweis}
          </span>
        </span>
      </label>

      {/* Bei Vollbreite ist der Zahlenwert wirkungslos — die Regler werden
          deshalb ausgeblendet statt deaktiviert dazustehen und Wirkung
          vorzutäuschen. */}
      {vollbreite ? null : (
        <>
          <div className="grid grid-cols-3 gap-2">
            {VORGABEN.map((v) => {
              const aktiv = einheit === "px" && breite === v;
              return (
                <button
                  key={v}
                  type="button"
                  aria-pressed={aktiv}
                  onClick={() =>
                    setze({ content_width: v, content_width_unit: "px" })
                  }
                  className={
                    "rounded-(--radius) border px-1 py-1.5 text-xs transition " +
                    (aktiv
                      ? "border-foreground ring-2 ring-foreground/20"
                      : "border-border hover:border-foreground/50")
                  }
                >
                  {v} px
                </button>
              );
            })}
            <button
              type="button"
              aria-pressed={breite !== null && !VORGABEN.includes(breite)}
              onClick={() =>
                setze({ content_width: breite ?? GRENZEN[einheit].min })
              }
              className={
                "rounded-(--radius) border px-1 py-1.5 text-xs transition " +
                (breite !== null && !VORGABEN.includes(breite)
                  ? "border-foreground ring-2 ring-foreground/20"
                  : "border-border hover:border-foreground/50")
              }
            >
              {texte.eigenerWert}
            </button>
          </div>

          <div className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-medium">{texte.breite}</span>
              <span className="flex items-center gap-2 text-xs text-muted-foreground">
                {breite === null ? texte.standard : `${breite} ${einheit}`}
                {breite !== null ? (
                  <button
                    type="button"
                    onClick={() => setze({ content_width: null })}
                    title={texte.zuruecksetzen}
                    aria-label={texte.zuruecksetzen}
                    className="transition hover:text-destructive"
                  >
                    <Icon
                      icon="ph:arrow-counter-clockwise"
                      className="size-3.5"
                    />
                  </button>
                ) : null}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={grenze.min}
                max={grenze.max}
                step={einheit === "px" ? 20 : 1}
                value={breite ?? grenze.min}
                aria-label={texte.breite}
                onChange={(e) =>
                  setze({ content_width: Number(e.target.value) })
                }
                className="min-w-0 flex-1 accent-foreground"
              />
              <NativeSelect
                value={einheit}
                aria-label={texte.breite}
                onChange={(e) =>
                  wechsleEinheit(e.target.value as Breiteneinheit)
                }
                className="w-16"
              >
                <option value="px">px</option>
                <option value="vw">vw</option>
              </NativeSelect>
            </div>
          </div>
        </>
      )}

      <div className="flex flex-col gap-2 border-t border-border pt-3">
        <span className="text-xs font-semibold">{texte.abstandTitel}</span>
        <p className="text-xs leading-snug text-muted-foreground">
          {texte.abstandHinweis}
        </p>
        <AbstandFeld
          label={texte.abstandVertikal}
          wert={abstandY}
          texte={texte}
          onChange={(v) => setze({ section_spacing_y: v })}
        />
        <AbstandFeld
          label={texte.abstandHorizontal}
          wert={abstandX}
          texte={texte}
          onChange={(v) => setze({ section_spacing_x: v })}
        />
        <button
          type="button"
          onClick={() => setze({ section_spacing_y: 0, section_spacing_x: 0 })}
          className="self-start text-xs text-muted-foreground underline transition hover:text-foreground"
        >
          {texte.aufNull}
        </button>
      </div>
    </div>
  );
}

function AbstandFeld({
  label,
  wert,
  texte,
  onChange,
}: {
  label: string;
  wert: number | null;
  texte: { standard: string; zuruecksetzen: string };
  onChange: (v: number | null) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium">{label}</span>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          {wert === null ? texte.standard : `${wert} px`}
          {wert !== null ? (
            <button
              type="button"
              onClick={() => onChange(null)}
              title={texte.zuruecksetzen}
              aria-label={texte.zuruecksetzen}
              className="transition hover:text-destructive"
            >
              <Icon icon="ph:arrow-counter-clockwise" className="size-3.5" />
            </button>
          ) : null}
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={200}
        step={4}
        value={wert ?? 0}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-foreground"
      />
    </div>
  );
}

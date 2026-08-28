"use client";

// Äußere und innere Abstände eines Abschnitts — die zwei ineinander liegenden
// Rechtecke, wie Hostaway (und Duda darunter) sie zeigt.
//
//   ┌─────────── 0px ───────────┐   ← außen, weiß mit dünnem Rahmen = MARGIN
//   │  0px  ┌──── 0px ────┐ 0px │
//   │       │             │     │   ← innen, gefüllt = PADDING
//   │  0px  └──── 0px ────┘ 0px │
//   └─────────── 0px ───────────┘
//
// Warum diese Form und nicht acht Zahlenfelder untereinander: die Rechtecke
// SIND die Erklärung. Margin und Padding auseinanderzuhalten ist die einzige
// Hürde an dieser Einstellung, und eine Liste „margin-top, margin-right, …"
// nimmt sie nicht — das Bild schon.
//
// Die Werte stehen in `settings` (`margin_top` … `padding_left`) als Zahl MIT
// Einheit (`24px`, `5%`). Beides zusammen und nicht in zwei Feldern: eine Zahl
// ohne Einheit ist kein Abstand, und zwei Felder, die nur gemeinsam Sinn
// ergeben, geraten auseinander.
//
// NICHT GESETZT ist nicht `0`. Ein leeres Feld zeigt zwar `0px` an — das ist
// dieselbe Wirkung, weil der Abschnitts-Rahmen von sich aus keinen Abstand hat
// —, aber gespeichert wird nichts. Wer einen Wert auf 0 zurückstellt, löscht
// ihn damit wieder heraus: dieselbe Seite zweimal geöffnet und unverändert
// geschlossen ergibt denselben Datensatz (Wurzel 2), und ein neues Feld
// verändert keine bestehende Kundenseite (Wurzel 1).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

/** Die Einheiten, die Hostaway im Feld-Dropdown führt. */
const EINHEITEN = ["px", "%", "vh", "vw"] as const;
type Einheit = (typeof EINHEITEN)[number];

/** Die acht Felder. `seite` steuert die Kopplung: links/rechts sind koppelbar,
 *  oben/unten nicht (ein Abschnitt ist keine Zeile in einer Zeile). */
const FELDER = {
  margin: {
    oben: "margin_top",
    rechts: "margin_right",
    unten: "margin_bottom",
    links: "margin_left",
  },
  padding: {
    oben: "padding_top",
    rechts: "padding_right",
    unten: "padding_bottom",
    links: "padding_left",
  },
} as const;

type Kasten = keyof typeof FELDER;
type Seite = keyof (typeof FELDER)["margin"];

const MUSTER = /^(-?\d{1,4})(px|%|vh|vw)$/;

function zerlegen(wert: unknown): { zahl: number; einheit: Einheit } {
  if (typeof wert === "string") {
    const treffer = MUSTER.exec(wert);
    if (treffer) {
      return {
        zahl: Number(treffer[1]),
        einheit: treffer[2] as Einheit,
      };
    }
  }
  return { zahl: 0, einheit: "px" };
}

export function AbstandsFeld({
  settings,
  onSettings,
}: {
  settings: Record<string, unknown>;
  onSettings: (settings: Record<string, unknown>) => void;
}) {
  const t = useTranslations("website");
  const gekoppelt = settings.spacing_x_gekoppelt !== false;

  /** Einen Wert setzen — und bei gekoppelten Seiten den Partner mit.
   *
   *  `0px` löscht den Eintrag statt ihn zu schreiben: „nicht gesetzt" und
   *  „null Pixel" wirken gleich, und von zwei Darstellungen desselben Zustands
   *  läuft eine irgendwann auseinander. Eine andere Einheit mit Wert 0 (`0%`)
   *  fällt ebenfalls heraus — Hostaway setzt bei 0 auf `px` zurück, und das ist
   *  dasselbe Ergebnis, nur ohne den toten Eintrag. */
  function setze(kasten: Kasten, seite: Seite, zahl: number, einheit: Einheit) {
    const neu = { ...settings };
    const schreiben = (s: Seite) => {
      const schluessel = FELDER[kasten][s];
      if (zahl === 0) delete neu[schluessel];
      else neu[schluessel] = `${zahl}${einheit}`;
    };
    schreiben(seite);
    if (gekoppelt && (seite === "links" || seite === "rechts")) {
      schreiben(seite === "links" ? "rechts" : "links");
    }
    onSettings(neu);
  }

  return (
    <div className="flex flex-col gap-2 px-4 py-3">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t("abstaende.titel")}
      </span>

      {/* Außen: MARGIN — weiß mit dünnem Rahmen. */}
      <Rechteck
        beschriftung={t("abstaende.aussen")}
        rahmen="border border-border bg-background"
        werte={(seite) => zerlegen(settings[FELDER.margin[seite]])}
        onWert={(seite, zahl, einheit) => setze("margin", seite, zahl, einheit)}
      >
        {/* Innen: PADDING — gefüllt, damit die Schachtelung sichtbar ist. */}
        <Rechteck
          beschriftung={t("abstaende.innen")}
          rahmen="border border-border bg-secondary"
          werte={(seite) => zerlegen(settings[FELDER.padding[seite]])}
          onWert={(seite, zahl, einheit) =>
            setze("padding", seite, zahl, einheit)
          }
        >
          {/* Das Kettensymbol steht MITTIG zwischen linkem und rechtem Wert —
              da, wo es im Original sitzt. Geschlossen heißt gekoppelt: wer
              links tippt, ändert rechts mit. Es gilt für beide Rechtecke, denn
              es ist EINE Entscheidung über die Waagerechte und nicht zwei. */}
          <div className="flex h-6 items-center justify-center">
            <button
              type="button"
              aria-pressed={gekoppelt}
              aria-label={
                gekoppelt ? t("abstaende.entkoppeln") : t("abstaende.koppeln")
              }
              title={
                gekoppelt ? t("abstaende.entkoppeln") : t("abstaende.koppeln")
              }
              onClick={() =>
                onSettings({ ...settings, spacing_x_gekoppelt: !gekoppelt })
              }
              className={
                "rounded-full border border-border bg-background p-1 transition " +
                (gekoppelt
                  ? "text-foreground"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              <Icon
                icon={gekoppelt ? "ph:link-simple" : "ph:link-simple-break"}
                className="size-3"
              />
            </button>
          </div>
        </Rechteck>
      </Rechteck>
    </div>
  );
}

function Rechteck({
  beschriftung,
  rahmen,
  werte,
  onWert,
  children,
}: {
  beschriftung: string;
  rahmen: string;
  werte: (seite: Seite) => { zahl: number; einheit: Einheit };
  onWert: (seite: Seite, zahl: number, einheit: Einheit) => void;
  children: React.ReactNode;
}) {
  return (
    <div className={"relative rounded-(--radius) px-8 py-6 " + rahmen}>
      <span className="absolute left-2 top-1 text-[0.5625rem] uppercase tracking-wide text-muted-foreground">
        {beschriftung}
      </span>
      <Wert
        seite="oben"
        klasse="absolute left-1/2 top-1 -translate-x-1/2"
        werte={werte}
        onWert={onWert}
      />
      <Wert
        seite="unten"
        klasse="absolute bottom-1 left-1/2 -translate-x-1/2"
        werte={werte}
        onWert={onWert}
      />
      <Wert
        seite="links"
        klasse="absolute left-1 top-1/2 -translate-y-1/2"
        werte={werte}
        onWert={onWert}
      />
      <Wert
        seite="rechts"
        klasse="absolute right-1 top-1/2 -translate-y-1/2"
        werte={werte}
        onWert={onWert}
      />
      {children}
    </div>
  );
}

/** Ein einzelner Wert: Beschriftung, bis er angeklickt wird — dann ein blau
 *  hinterlegtes Eingabefeld mit Einheiten-Auswahl daneben. */
function Wert({
  seite,
  klasse,
  werte,
  onWert,
}: {
  seite: Seite;
  klasse: string;
  werte: (seite: Seite) => { zahl: number; einheit: Einheit };
  onWert: (seite: Seite, zahl: number, einheit: Einheit) => void;
}) {
  const t = useTranslations("website");
  const [offen, setOffen] = useState(false);
  const { zahl, einheit } = werte(seite);

  if (!offen) {
    return (
      <button
        type="button"
        aria-label={t(`abstaende.${seite}`)}
        title={t(`abstaende.${seite}`)}
        onClick={() => setOffen(true)}
        className={
          klasse +
          " rounded px-1 text-[0.625rem] tabular-nums text-muted-foreground transition hover:bg-secondary hover:text-foreground"
        }
      >
        {zahl}
        {einheit}
      </button>
    );
  }

  return (
    // Der Fokus-Austritt wird am GANZEN Feld geprüft, nicht am Eingabefeld
    // allein. Mit einem `onBlur` direkt am `<input>` schloss sich die
    // Bedienung in dem Moment, in dem man das Einheiten-Auswahlfeld anklickt:
    // der Fokus verlässt das Eingabefeld, alles wird ausgehängt, und der Klick
    // auf die Einheit kam nie an. `relatedTarget` ist das Element, das den
    // Fokus BEKOMMT — liegt es noch im selben Feld, bleibt offen.
    <span
      className={klasse + " z-10 flex items-center gap-px"}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
          setOffen(false);
        }
      }}
    >
      <input
        type="number"
        autoFocus
        aria-label={t(`abstaende.${seite}`)}
        value={zahl}
        min={-9999}
        max={9999}
        onChange={(e) => {
          // Leeres Feld heißt 0 und nicht NaN: `Number("")` ist 0, aber
          // `Number("-")` ist NaN — und ein NaN im Wert schriebe `NaNpx`.
          const n = Number(e.target.value);
          onWert(seite, Number.isFinite(n) ? Math.trunc(n) : 0, einheit);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "Escape") setOffen(false);
        }}
        className="w-10 rounded-l bg-blue-600 px-1 py-px text-[0.625rem] tabular-nums text-white outline-none"
      />
      <select
        aria-label={t("abstaende.einheit")}
        value={einheit}
        onChange={(e) => onWert(seite, zahl, e.target.value as Einheit)}
        className="rounded-r bg-blue-600 py-px pl-0.5 pr-1 text-[0.625rem] text-white outline-none"
      >
        {EINHEITEN.map((e) => (
          <option key={e} value={e} className="text-foreground">
            {e}
          </option>
        ))}
      </select>
    </span>
  );
}

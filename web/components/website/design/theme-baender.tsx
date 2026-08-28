"use client";

// Die Grundansicht des Theme-Panels — BÄNDER MIT ECHTER VORSCHAU.
//
// 1:1 nach `docs/UI` (Foto 19.03.40 und 19.03.54):
//
//     COLORS                        ›
//     ■ ■ ■ ■ ■ ■ ■ ■  [+]                ← die Palette selbst
//     ─────────────────────────────────
//     BUTTONS                       ›
//     ( Primary )  ( Secondary )           ← ECHTE Knöpfe im Ist-Stil
//     ─────────────────────────────────
//     TEXT                          ›
//     DFLT Inter, 16
//     PAR  Inter, 16
//     H1   Inter, 70                       ← jede Zeile in IHRER Größe
//     H2   Inter, 70
//     ─────────────────────────────────
//     WIDTH & SPACING            ●  ›      ← türkiser Punkt = geändert
//     IMAGES                        ›
//     BACKGROUNDS                   ›
//
// WAS VORHER HIER STAND UND WARUM ES FALSCH WAR
// Sieben Textzeilen mit einem Pfeil („Layout ›", „Farben ›", …). Man sah nicht,
// WELCHE Farben eingestellt sind, wie die Knöpfe aussehen oder wie groß H1 ist
// — dafür musste man jede Unterseite öffnen, nachsehen und zurückgehen. Ein
// Theme-Panel, das den Zustand des Themes nicht zeigt, ist ein Inhaltsverzeichnis.
//
// Die Vorschau ist die BEDIENUNG, nicht nur Dekoration: der Palettenstreifen
// ist anklickbar, die Textzeilen sind es auch. Der Pfeil rechts führt in die
// volle Unterseite; ein Klick auf die Vorschau in genau den Teil davon, den man
// angeklickt hat.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import type { ReactNode } from "react";

import type { Branding, TextRolle } from "@/lib/site-config";

import type { DesignUnterseite } from "../design-ansicht";
import { TEXT_ROLLEN } from "./text-rollen";

/** Ein Band der Grundansicht. */
type BandId = DesignUnterseite;

/**
 * Ein Band: versale Überschrift, rechts der Änderungspunkt und der Pfeil,
 * darunter die Vorschau.
 *
 * Die Überschrift ist ein KNOPF und die Vorschau liegt darunter — nicht
 * umgekehrt verschachtelt. Ein Knopf, in dem weitere Knöpfe liegen, ist im
 * Browser ungültiges Markup, und die inneren Klicks kämen je nach Browser mal
 * an und mal nicht.
 */
function Band({
  titel,
  geaendert,
  onOeffnen,
  children,
}: {
  titel: string;
  geaendert: boolean;
  onOeffnen: () => void;
  children?: ReactNode;
}) {
  return (
    <section className="border-b border-border last:border-b-0">
      <button
        type="button"
        onClick={onOeffnen}
        className="flex w-full items-center gap-2 px-4 pb-2 pt-4 text-left transition hover:bg-secondary/40"
      >
        <span className="min-w-0 flex-1 truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {titel}
        </span>
        {geaendert ? (
          <span
            title={titel}
            className="size-1.5 shrink-0 rounded-full bg-(--brand)"
          />
        ) : null}
        <Icon
          icon="ph:caret-right"
          aria-hidden
          className="size-4 shrink-0 text-muted-foreground"
        />
      </button>
      {children ? <div className="px-4 pb-4">{children}</div> : null}
    </section>
  );
}

/** Steht in diesem Bereich etwas anderes als der Standard?
 *
 *  Der Punkt wird BERECHNET und nicht gemerkt. Ein gemerkter Zustand („der
 *  Kunde hat hier mal etwas geändert") wäre nach einem Zurücksetzen dauerhaft
 *  falsch — und niemand sähe, dass er lügt. */
function istGesetzt(...werte: unknown[]): boolean {
  return werte.some(
    (w) =>
      w !== null &&
      w !== undefined &&
      w !== false &&
      !(Array.isArray(w) && w.length === 0) &&
      !(typeof w === "object" && Object.keys(w as object).length === 0),
  );
}

export function ThemeBaender({
  stand,
  onOeffnen,
}: {
  stand: Branding;
  /** Ein Band öffnen — im eigenen Design-Reiter eine Navigation, im Editor ein
   *  Panelwechsel. Wer das entscheidet, weiß der Aufrufer; dieses Bauteil
   *  meldet nur, WELCHES Band gemeint war. */
  onOeffnen: (id: BandId) => void;
}) {
  const t = useTranslations("website");

  const palette = stand.theme_colors ?? [];
  const stile = stand.text_styles ?? {};

  // Die Reihenfolge der Bänder folgt der Arbeitsweise: erst das Gerüst
  // (Layout), dann die Marke (Farben, Knöpfe, Text), dann die Geometrie, dann
  // die Bilder und zuletzt das Logo. Dieselbe Reihenfolge wie bisher in der
  // Verweisliste — sie war nie das Problem.
  return (
    <div className="flex flex-col">
      <Band
        titel={t("design.layoutTitel")}
        geaendert={istGesetzt(stand.theme)}
        onOeffnen={() => onOeffnen("site-layout")}
      />

      {/* FARBEN — die Palette als Streifen, wie im Foto. Sie zeigt die
          Designfarben und, falls es noch keine gibt, die vier Grundrollen.
          Ein leerer Streifen wäre die Auskunft „es gibt keine Farben", und die
          wäre falsch: es gibt immer die Grundrollen. */}
      <Band
        titel={t("design.farbenTitel")}
        geaendert={istGesetzt(
          stand.primary_color,
          stand.secondary_color,
          stand.background_color,
          stand.foreground_color,
          palette,
        )}
        onOeffnen={() => onOeffnen("farben")}
      >
        <div className="flex flex-wrap items-center gap-1.5">
          {(palette.length > 0
            ? palette.map((f) => ({ id: f.id, name: f.name, wert: f.color }))
            : [
                { id: "primary", name: t("design.primaer"), wert: stand.primary_color },
                { id: "secondary", name: t("design.flaeche"), wert: stand.secondary_color },
                { id: "background", name: t("design.hintergrund"), wert: stand.background_color },
                { id: "foreground", name: t("design.schrift"), wert: stand.foreground_color },
              ].filter((f) => f.wert)
          ).map((f) => (
            <span
              key={f.id}
              title={`${f.name} · ${f.wert}`}
              style={{ backgroundColor: f.wert ?? undefined }}
              className="size-6 rounded-(--radius) border border-border"
            />
          ))}
          {/* Das `+` steht im Foto am Ende des Streifens und legt eine neue
              Designfarbe an. Es führt in die Unterseite, weil eine Farbe dort
              einen Namen bekommt — eine namenlose Farbe wäre eine Rolle, die
              niemand zuordnen kann. */}
          <button
            type="button"
            onClick={() => onOeffnen("farben")}
            aria-label={t("design.farbeHinzufuegen")}
            title={t("design.farbeHinzufuegen")}
            className="flex size-6 items-center justify-center rounded-(--radius) border border-dashed border-border text-muted-foreground transition hover:border-(--brand) hover:text-foreground"
          >
            <Icon icon="ph:plus" className="size-3.5" />
          </button>
        </div>
      </Band>

      {/* KNÖPFE — ECHTE Knöpfe im eingestellten Stil, nicht ihre Beschreibung.
          Das ist der Punkt des ganzen Bandes: „pill, gefüllt, Inter" sagt
          niemandem, wie der Knopf aussieht. */}
      <Band
        titel={t("design.buttonsTitel")}
        geaendert={istGesetzt(
          stand.button_style,
          stand.button_radius,
          stand.button_font,
        )}
        onOeffnen={() => onOeffnen("buttons")}
      >
        <div className="flex flex-wrap items-center gap-2">
          <span
            style={{
              backgroundColor: stand.primary_color ?? undefined,
              borderRadius: radius(stand.button_radius),
              fontFamily: stand.button_font ?? undefined,
            }}
            className="px-4 py-2 text-sm font-medium text-white"
          >
            {t("design.knopfPrimaer")}
          </span>
          <span
            style={{
              color: stand.primary_color ?? undefined,
              borderColor: stand.primary_color ?? undefined,
              borderRadius: radius(stand.button_radius),
              fontFamily: stand.button_font ?? undefined,
            }}
            className="border px-4 py-2 text-sm font-medium"
          >
            {t("design.knopfSekundaer")}
          </span>
        </div>
      </Band>

      {/* TEXT — jede Rolle in IHRER eigenen Größe und Schrift gerendert.
          Im Foto ist H1 wirklich 70 px hoch und H6 wirklich 14. Genau das ist
          die Auskunft, die man sucht: nicht „H1 ist groß", sondern „SO groß". */}
      <Band
        titel={t("design.textTitel")}
        geaendert={istGesetzt(
          stand.font_family,
          stand.heading_font,
          stand.heading_scale,
          stand.body_scale,
          stile,
        )}
        onOeffnen={() => onOeffnen("text")}
      >
        <div className="flex flex-col gap-1">
          {TEXT_ROLLEN.map((rolle) => (
            <TextZeile
              key={rolle}
              rolle={rolle}
              stand={stand}
              onKlick={() => onOeffnen("text")}
            />
          ))}
        </div>
      </Band>

      <Band
        titel={t("design.breiteTitel")}
        geaendert={istGesetzt(
          stand.content_width,
          stand.content_full_width,
          stand.section_spacing_y,
          stand.section_spacing_x,
        )}
        onOeffnen={() => onOeffnen("breite-abstand")}
      />
      <Band
        titel={t("design.bilderTitel")}
        geaendert={istGesetzt(stand.hero_image_url, stand.lazy_loading)}
        onOeffnen={() => onOeffnen("bilder")}
      />
      <Band
        titel={t("design.logoTitel")}
        geaendert={istGesetzt(
          stand.logo_url,
          stand.logo_scale,
          stand.logo_name_font,
        )}
        onOeffnen={() => onOeffnen("logo")}
      />
    </div>
  );
}

/** Eine Zeile des Text-Bandes: Rollenkürzel links, darauf die Probe in ihrer
 *  echten Gestalt.
 *
 *  Die Probe zeigt Schrift und Größe als TEXT („Inter, 70") und ist zugleich in
 *  genau dieser Schrift und Größe gesetzt. Beides zusammen, weil eines allein
 *  nicht reicht: die reine Zahl sagt nichts über die Wirkung, und die reine
 *  Wirkung lässt sich nicht abschreiben, wenn man sie woanders eintragen will. */
function TextZeile({
  rolle,
  stand,
  onKlick,
}: {
  rolle: TextRolle;
  stand: Branding;
  onKlick: () => void;
}) {
  const t = useTranslations("website");
  const stil = stand.text_styles?.[rolle];
  const schrift =
    stil?.font ??
    (rolle === "par" || rolle === "dflt"
      ? stand.font_family
      : stand.heading_font) ??
    null;
  const groesse = stil?.size_desktop ?? STANDARD_GROESSE[rolle];

  // Die Probe wird GEDECKELT. H1 mit 70 px würde die 20-rem-Spalte sprengen und
  // den Rest des Bandes nach unten schieben; im Foto steht sie deshalb ebenfalls
  // kleiner, als die Zahl sagt. Die ZAHL bleibt die echte — sie ist die
  // Auskunft, die Darstellung ist nur der Eindruck.
  const angezeigt = Math.min(groesse, 28);

  return (
    <button
      type="button"
      onClick={onKlick}
      className="flex w-full items-baseline gap-2 rounded-(--radius) px-1 py-0.5 text-left transition hover:bg-secondary/50"
    >
      <span className="w-9 shrink-0 text-[0.625rem] uppercase tracking-wide text-muted-foreground">
        {rolle}
      </span>
      <span
        style={{
          fontFamily: schrift ?? undefined,
          fontSize: `${angezeigt}px`,
          fontWeight: stil?.weight ?? undefined,
          textTransform: stil?.uppercase ? "uppercase" : undefined,
        }}
        className="min-w-0 truncate leading-tight"
      >
        {t("design.textProbe", {
          schrift: schrift ?? t("design.schriftStandard"),
          groesse,
        })}
      </span>
    </button>
  );
}

/** Größe, die der Renderer ohne eigene Angabe benutzt.
 *
 *  Das sind KEINE erfundenen Ersatzwerte (Wurzel 4), sondern die Zahlen, die
 *  im Renderer wirklich stehen — die Probe muss zeigen, was passiert, wenn man
 *  nichts einstellt. Ändern sie sich dort, müssen sie sich hier mitändern; wäre
 *  das eine offene Frage, stünde hier gar keine Zahl. */
const STANDARD_GROESSE: Record<TextRolle, number> = {
  dflt: 16,
  par: 16,
  h1: 48,
  h2: 36,
  h3: 30,
  h4: 24,
  h5: 20,
  h6: 16,
};

/** Eckenradius der Knopf-Vorschau aus dem eingestellten Stil. */
function radius(r: Branding["button_radius"]): string | undefined {
  if (r === "sharp") return "0";
  if (r === "pill") return "9999px";
  if (r === "rounded") return "0.5rem";
  return undefined;
}

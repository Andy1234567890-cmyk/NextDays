"use client";

// Der STIL-INSPEKTOR — Framers Style-Panel für Container UND Bausteine
// (Etappe 3 der Framer-Parität, 05.09.2026; `docs/FRAMER-STYLE-INSPEKTOR-
// FUNKTIONEN.md` §2, §3, §9, §10, §13).
//
// EIN Panel für jede Elementart (§0.1): dieselben Karten für Abschnitt,
// Spalte und Baustein, weil das Datenmodell (`settings`) und der Renderer
// (`packages/baukasten-stil`) für alle drei dieselben sind. Was ein Element
// NICHT kann, fehlt hier nicht als graues Feld, sondern gar nicht.
//
// Die sechs Karten, in Framers Reihenfolge:
//   Position · Größe · Stil · Transform · Scroll-Abschnitt · Zugänglichkeit
// (Layout und Abstände stehen im Container-Inspektor, Inhalt im Baustein.)
//
// Jede Zeile kennt ihren Pfad in `settings` und schreibt über EINEN Stift
// (`stift()`): auf Desktop in die Grundfassung, auf Tablet/Mobil als
// Überschreibung (blau, mit Reset). Ein Wert, den das Backend abweisen würde,
// wird gar nicht erst gesendet — dieselben Muster wie in
// `schemas_darstellung.py`, geprüft im Feld.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import {
  type A11yTag,
  CURSOR,
  type Cursor,
  ERSCHEINEN_ARTEN,
  type Geraet,
  LINK_REL,
  type LinkRel,
  MISCHMODI,
  type Mischmodus,
  OPENTYPE,
  type OpenType,
  SCHLEIFEN_ARTEN,
  type Grenze,
  type Lage,
  type Mass,
  type MassModus,
  type Radius,
  type Schatten,
  type TextGewicht,
  SCHRIFTFAMILIEN,
  type Schriftfamilie,
  SCHRIFT_WAHL,
  type SchriftWahl,
  codeCssZerlegen,
  darstellungFuer,
  mitWert,
} from "@nextdays/baukasten-stil";

import { Schieber, Segment, Zahlfeld } from "../inspektor-rahmen";
import {
  type AusrichtungsAenderung,
  AusrichtungsLeiste,
} from "./ausrichtungs-leiste";
import { BildFeld } from "./bild-feld";
import { FuellungFeld } from "./fuellung-feld";
import { mitVersteckt, umgeschaltet, versteckteGeraete } from "./sichtbarkeit";
import {
  Auswahl,
  Chip,
  FarbFeld,
  JaNein,
  MassFeld,
  PlusKarte,
  type Stift,
  StilZeile,
  Textfeld,
  stift,
  useOffene,
} from "./stil-felder";

/** Gemessene Größe des Elements in der Vorschau — als grauer Platzhalter bei
 *  „Inhalt"/„Füllen" (§0.5). Fehlt sie, steht „—". */
export type Gemessen = { breite: number; hoehe: number };

const ANKER_RE = /^[a-z][a-z0-9-]{0,49}$/;
const PARAMETER_RE =
  /^[A-Za-z0-9_.%~-]+=[A-Za-z0-9_.%~-]*(&[A-Za-z0-9_.%~-]+=[A-Za-z0-9_.%~-]*){0,9}$/;
const VERHAELTNIS_RE = /^\d{1,4}(\.\d{1,3})?\s*\/\s*\d{1,4}(\.\d{1,3})?$/;
/** GA4-Ereignisname (Framer „Tracking") — dasselbe Muster wie im Backend. */
const EREIGNIS_RE = /^[a-z][a-z0-9_]{0,39}$/;
const LAGEN: readonly Lage[] = [
  "center",
  "top",
  "bottom",
  "left",
  "right",
  "top left",
  "top right",
  "bottom left",
  "bottom right",
];
const TAGS: readonly A11yTag[] = [
  "div",
  "section",
  "article",
  "aside",
  "header",
  "footer",
  "nav",
  "main",
];

function objekt(v: unknown): Record<string, unknown> | null {
  return v !== null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null;
}

/** Welche Schlüssel eines Unterobjekts WIRKSAM gesetzt sind (nach Kaskade). */
function gesetzteSchluessel(s: Stift, wurzel: string): string[] {
  const o = objekt(s.lesen([wurzel]));
  return o
    ? Object.keys(o).filter((k) => o[k] !== null && o[k] !== undefined)
    : [];
}

/** Zusätze für einen CONTAINER (Abschnitt, Spalte): Spaltenbreite in „Größe",
 *  Spalten in „Layout". Ein Baustein hat sie nicht. */
export type ContainerZusatz = {
  istSpalte: boolean;
  /** Breitenanteil in Zwölfteln — `null`, wenn `span` nichts bewirkt. */
  span: number | null;
  onSpan: (span: number) => void;
  kinderZahl: number;
  /** Nur an Abschnitten: eine Spalte anlegen. */
  onSpalteHinzu?: () => void;
};

/** Der übergeordnete Rahmen eines BAUSTEINS — die Ausrichtungsreihe schreibt
 *  in ihn (Framer richtet ein Kind im Stack aus; unser Modell kennt die
 *  Ausrichtung nur am Rahmen, also gilt sie für alle Kinder). */
export type ElternZusatz = {
  settings: Record<string, unknown>;
  onSettings: (settings: Record<string, unknown>) => void;
};

/** Die gängigen Spaltenbreiten — Zwölftel wie der Renderer. */
const SPALTEN_BREITEN: readonly { span: number; label: string }[] = [
  { span: 3, label: "1/4" },
  { span: 4, label: "1/3" },
  { span: 6, label: "1/2" },
  { span: 8, label: "2/3" },
  { span: 9, label: "3/4" },
  { span: 12, label: "1/1" },
];

export function StilInspektor({
  settings,
  geraet,
  sprache,
  gemessen = null,
  laeuft = false,
  onSettings,
  container,
  eltern,
  textKarte = true,
  layout = false,
  imRaster: imRasterProp,
  ankerListe = [],
}: {
  settings: Record<string, unknown>;
  /** Das Gerät, für das geschrieben wird — der aktive Rahmen der Fläche. */
  geraet: Geraet;
  /** Die INHALTS-Sprache des Editors. Nur der Overlay-Text hängt daran: er ist
   *  ein Text je Sprache wie jedes Textfeld eines Bausteins. */
  sprache: string;
  gemessen?: Gemessen | null;
  laeuft?: boolean;
  onSettings: (settings: Record<string, unknown>) => void;
  container?: ContainerZusatz;
  eltern?: ElternZusatz;
  /** Trägt dieses Element eigenen TEXT? Framer zeigt die Text-Sektion nur am
   *  Text-Layer selbst — nicht an einem Rahmen, dessen Text in einem Kind
   *  sitzt, und nicht an einem Bild (06.09.2026 gemessen). */
  textKarte?: boolean;
  /** Liegt dieses Element in einem RASTER? Nur ein TEIL setzt das von außen:
   *  sein Elternteil steht nicht im Block-Baum, sondern im gemeldeten
   *  Teilbaum des Bausteins. */
  imRaster?: boolean;
  /** Ist dieses Element ein RAHMEN (Frame · Stapel · Raster · Link · Knopf)?
   *  Nur dann steht die Layout-Karte da — an einem Text-Layer hat Framer
   *  keine, und ohne sie fehlte dem Knopf sein Innenabstand. */
  layout?: boolean;
  /** Die Scroll-Anker der Seite — Framers „Abschnitt"-Auswahl am Link. */
  ankerListe?: readonly string[];
}) {
  const s = stift(settings, geraet, onSettings, laeuft);
  // Liegt dieses Element in einem RASTER? Der Elternteil sagt es — und nur
  // dann zeigt die Größe-Karte die belegten Spalten und Zeilen (Framer, 06.09.
  // 2026). Ohne Elternteil (ein Teil eines Bausteins) gibt es kein Raster.
  const imRaster =
    imRasterProp ??
    (eltern != null &&
      darstellungFuer(eltern.settings, geraet).layout_typ === "raster");

  /** Die Ausrichtungsreihe schreibt mehrere Felder in EINEM Vorgang — am
   *  Container in ihn selbst, am Baustein in seinen Rahmen. */
  function ausrichten(
    ziel: Record<string, unknown>,
    speichern: (n: Record<string, unknown>) => void,
  ) {
    return (aenderung: AusrichtungsAenderung) => {
      let neu = ziel;
      for (const [k, v] of Object.entries(aenderung))
        neu = mitWert(neu, geraet, [k], v);
      speichern(neu);
    };
  }

  return (
    <div className="flex flex-col">
      {container ? (
        <AusrichtungsLeiste
          settings={s.lesen([]) as Record<string, unknown>}
          span={container.span}
          laeuft={laeuft}
          onSetzen={ausrichten(settings, onSettings)}
          onBreiteFuellen={
            container.span !== null ? () => container.onSpan(12) : undefined
          }
        />
      ) : eltern ? (
        <AusrichtungsLeiste
          settings={
            stift(eltern.settings, geraet, eltern.onSettings).lesen(
              [],
            ) as Record<string, unknown>
          }
          laeuft={laeuft}
          onSetzen={ausrichten(eltern.settings, eltern.onSettings)}
        />
      ) : null}
      <LinkKarte s={s} ankerListe={ankerListe} />
      <PositionKarte s={s} />
      <GroesseKarte
        s={s}
        gemessen={gemessen}
        container={container}
        wachsen={!container}
        imRaster={imRaster}
      />
      {container || layout ? (
        <LayoutKarte s={s} container={container} />
      ) : null}
      <EffekteKarte s={s} />
      <OverlayKarte s={s} sprache={sprache} />
      <CursorKarte s={s} />
      <StilKarte s={s} />
      <TransformKarte s={s} />
      {!container && textKarte ? <TextKarte s={s} /> : null}
      <ScrollKarte s={s} />
      <ZugaenglichkeitKarte s={s} />
      <CodeKarte s={s} />
    </div>
  );
}

/** Abschnittskopf für das, was Framer hat und unser Modell noch nicht
 *  (Effekte, Overlays, Cursor, Code-Overrides). Er steht an seiner Stelle,
 *  damit die Leiste Framers Reihenfolge trägt — mit ausgegrautem „+" und
 *  Hinweis statt eines Menüs, das ins Leere führt (Wurzel 4). */
export function SpaeterKopf({
  name,
}: {
  name: "effekte" | "overlays" | "cursor" | "code";
}) {
  const t = useTranslations("website.stil");
  return (
    <div className="border-b border-border last:border-b-0">
      <div
        className="flex h-10 items-center gap-2 px-2.5"
        title={t("spaeter.hinweis")}
      >
        <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-semibold text-muted-foreground">
          {t(`spaeter.${name}`)}
        </span>
        <span className="shrink-0 rounded p-1 text-muted-foreground/40">
          <Icon icon="ph:plus" className="size-3.5" />
        </span>
      </div>
    </div>
  );
}

// --- Text (Baustein) ---------------------------------------------------------

const GEWICHTE: readonly TextGewicht[] = [
  100, 200, 300, 400, 500, 600, 700, 800, 900,
];

function TextKarte({ s }: { s: Stift }) {
  const t = useTranslations("website.stil");
  const gesetzt = gesetzteSchluessel(s, "text");
  const fest = [
    "schrift",
    "schriftfamilie",
    "farbe",
    "groesse",
    "gewicht",
    "laufweite",
    "zeilenhoehe",
    "ausrichtung",
    "balance",
  ];
  const { offene, oeffne } = useOffene([...gesetzt, ...fest]);
  const lese = <T,>(k: string) => s.lesen(["text", k]) as T | undefined;

  return (
    <PlusKarte
      titel={t("text.titel")}
      geaendert={gesetzt.length > 0}
      offene={offene}
      onOeffnen={oeffne}
      eintraege={(
        ["transformation", "dekoration", "kuerzen", "opentype"] as const
      ).map((k) => ({
        key: k,
        label: t(`text.${k}`),
        gesetzt: gesetzt.includes(k),
      }))}
    >
      {/* Framers „Text Styles" (§18): ein Stil des Projekts statt einzelner
          Werte. Bei uns sind das die acht TEXT-ROLLEN aus Design › Text — sie
          bringen Familie, Größe, Gewicht, Zeilenhöhe, Laufweite und Farbe mit.
          Die beiden Altwerte „Überschrift"/„Fließtext" wählen nur die Familie
          und bleiben, weil bestehende Seiten sie tragen (Wurzel 1). */}
      <StilZeile label={t("text.stil")} pfad={["text", "schrift"]} s={s}>
        <Auswahl
          wert={lese<SchriftWahl>("schrift") ?? null}
          leer={t("automatisch")}
          laeuft={s.laeuft}
          optionen={SCHRIFT_WAHL.map(
            (k) => [k, t(`text.schriftWert.${k}`)] as const,
          )}
          onWahl={(v) => s.setzen(["text", "schrift"], v)}
        />
      </StilZeile>
      {/* Framers Font-Picker (§18). Bei uns der KURATIERTE Katalog und keine
          freie Google-Suche: der Renderer lädt nur diese Familien, und ein
          Name, den er nicht kennt, stünde beim Gast im Fallback — die
          Einstellung wäre unsichtbar (Wurzel 4). Neue Familien kommen an EINER
          Stelle dazu (`SCHRIFT_STACKS` im Paket). */}
      <StilZeile
        label={t("text.schrift")}
        pfad={["text", "schriftfamilie"]}
        s={s}
      >
        <Auswahl
          wert={lese<Schriftfamilie>("schriftfamilie") ?? null}
          leer={t("text.ausDemStil")}
          laeuft={s.laeuft}
          optionen={SCHRIFTFAMILIEN.map((f) => [f, f] as const)}
          onWahl={(v) => s.setzen(["text", "schriftfamilie"], v)}
        />
      </StilZeile>
      <StilZeile label={t("text.gewicht")} pfad={["text", "gewicht"]} s={s}>
        <Auswahl
          wert={
            lese<TextGewicht>("gewicht") != null
              ? String(lese<TextGewicht>("gewicht"))
              : null
          }
          leer={t("automatisch")}
          laeuft={s.laeuft}
          optionen={GEWICHTE.map(
            (g) => [String(g), `${t(`text.gewichtWert.${g}`)} · ${g}`] as const,
          )}
          onWahl={(v) =>
            s.setzen(["text", "gewicht"], v === null ? null : Number(v))
          }
        />
      </StilZeile>
      <StilZeile label={t("text.farbe")} pfad={["text", "farbe"]} s={s}>
        <FarbFeld
          wert={lese<string>("farbe") ?? null}
          laeuft={s.laeuft}
          onWert={(f) => s.setzen(["text", "farbe"], f)}
        />
      </StilZeile>
      <StilZeile label={t("text.groesse")} pfad={["text", "groesse"]} s={s}>
        <MassFeld
          wert={lese<string>("groesse")}
          dezimal
          einheiten={["px", "rem"]}
          laeuft={s.laeuft}
          onWert={(v) => s.setzen(["text", "groesse"], v)}
        />
      </StilZeile>
      <StilZeile label={t("text.laufweite")} pfad={["text", "laufweite"]} s={s}>
        <MassFeld
          wert={lese<string>("laufweite")}
          dezimal
          negativ
          einheiten={["em", "px"]}
          laeuft={s.laeuft}
          onWert={(v) => s.setzen(["text", "laufweite"], v)}
        />
      </StilZeile>
      <StilZeile
        label={t("text.zeilenhoehe")}
        pfad={["text", "zeilenhoehe"]}
        s={s}
      >
        <MassFeld
          wert={lese<string>("zeilenhoehe")}
          dezimal
          einheiten={["em", "px", "%"]}
          laeuft={s.laeuft}
          onWert={(v) => s.setzen(["text", "zeilenhoehe"], v)}
        />
      </StilZeile>
      <StilZeile
        label={t("text.ausrichtung")}
        pfad={["text", "ausrichtung"]}
        s={s}
      >
        <Segment
          wert={
            lese<"start" | "center" | "end" | "justify">("ausrichtung") ?? null
          }
          laeuft={s.laeuft}
          optionen={[
            ["start", "ph:text-align-left", t("text.ausrichtungWert.start")],
            [
              "center",
              "ph:text-align-center",
              t("text.ausrichtungWert.center"),
            ],
            ["end", "ph:text-align-right", t("text.ausrichtungWert.end")],
            [
              "justify",
              "ph:text-align-justify",
              t("text.ausrichtungWert.justify"),
            ],
          ]}
          onWahl={(v) => s.setzen(["text", "ausrichtung"], v)}
        />
      </StilZeile>
      <StilZeile label={t("text.balance")} pfad={["text", "balance"]} s={s}>
        <JaNein
          wert={lese<boolean>("balance") ?? null}
          laeuft={s.laeuft}
          onWahl={(v) => s.setzen(["text", "balance"], v)}
        />
      </StilZeile>
      {offene.has("transformation") ? (
        <StilZeile
          label={t("text.transformation")}
          pfad={["text", "transformation"]}
          s={s}
        >
          <Auswahl
            wert={
              lese<"none" | "uppercase" | "lowercase" | "capitalize">(
                "transformation",
              ) ?? null
            }
            leer={t("automatisch")}
            laeuft={s.laeuft}
            optionen={(
              ["none", "uppercase", "lowercase", "capitalize"] as const
            ).map((k) => [k, t(`text.transformationWert.${k}`)] as const)}
            onWahl={(v) => s.setzen(["text", "transformation"], v)}
          />
        </StilZeile>
      ) : null}
      {offene.has("dekoration") ? (
        <StilZeile
          label={t("text.dekoration")}
          pfad={["text", "dekoration"]}
          s={s}
        >
          <Auswahl
            wert={
              lese<"none" | "underline" | "line-through">("dekoration") ?? null
            }
            leer={t("automatisch")}
            laeuft={s.laeuft}
            optionen={(["none", "underline", "line-through"] as const).map(
              (k) => [k, t(`text.dekorationWert.${k}`)] as const,
            )}
            onWahl={(v) => s.setzen(["text", "dekoration"], v)}
          />
        </StilZeile>
      ) : null}
      {offene.has("kuerzen") ? (
        <StilZeile label={t("text.kuerzen")} pfad={["text", "kuerzen"]} s={s}>
          <Zahlfeld
            wert={lese<number>("kuerzen") ?? null}
            min={1}
            max={20}
            einheit={t("text.zeilen")}
            laeuft={s.laeuft}
            onWert={(v) => s.setzen(["text", "kuerzen"], v)}
          />
        </StilZeile>
      ) : null}
      {offene.has("opentype") ? (
        // Framer „OpenType" (Vollerfassung §18): Merkmale als Schalter; ob die
        // Schrift sie kann, entscheidet die Schrift — CSS ignoriert Unbekanntes.
        <StilZeile label={t("text.opentype")} pfad={["text", "opentype"]} s={s}>
          <SchalterChips
            werte={OPENTYPE}
            gesetzt={
              (lese<OpenType[]>("opentype") ?? []) as readonly OpenType[]
            }
            label={(k) => t(`text.opentypeWert.${k}`)}
            laeuft={s.laeuft}
            onWert={(neu) =>
              s.setzen(["text", "opentype"], neu.length ? neu : null)
            }
          />
        </StilZeile>
      ) : null}
    </PlusKarte>
  );
}

// --- Link --------------------------------------------------------------------

const HREF_RE = /^(https?:\/\/|mailto:|tel:|[/#?])/i;

function LinkKarte({
  s,
  ankerListe,
}: {
  s: Stift;
  ankerListe: readonly string[];
}) {
  const t = useTranslations("website.stil");
  const href = s.lesen(["link", "href"]) as string | undefined;
  const neuerTab = s.lesen(["link", "neuer_tab"]) as boolean | undefined;
  const anker = s.lesen(["link", "anker"]) as string | undefined;
  const rel = (s.lesen(["link", "rel"]) as LinkRel[] | undefined) ?? [];
  const parameter = s.lesen(["link", "parameter"]) as string | undefined;
  const scrollen = s.lesen(["link", "scrollen"]) as "sanft" | "sofort" | undefined;
  const tracking = s.lesen(["link", "tracking"]) as string | undefined;
  const { offene, oeffne } = useOffene([
    "href",
    ...(rel.length ? ["rel"] : []),
    ...(parameter !== undefined ? ["parameter"] : []),
    ...(scrollen !== undefined ? ["scrollen"] : []),
    ...(tracking !== undefined ? ["tracking"] : []),
  ]);
  return (
    <PlusKarte
      titel={t("link.titel")}
      geaendert={href !== undefined}
      offene={offene}
      onOeffnen={oeffne}
      // Framers „+": Rel · Parameters (· Tracking — kein Ereignismodell, fehlt).
      // Ohne Link ausgegraut wie im Vorbild: die Einträge stehen erst mit Adresse.
      eintraege={
        href !== undefined
          ? [
              { key: "rel", label: t("link.rel"), gesetzt: rel.length > 0 },
              {
                key: "parameter",
                label: t("link.parameter"),
                gesetzt: parameter !== undefined,
              },
              {
                key: "scrollen",
                label: t("link.scrollen"),
                gesetzt: scrollen !== undefined,
              },
              {
                key: "tracking",
                label: t("link.tracking"),
                gesetzt: tracking !== undefined,
              },
            ]
          : []
      }
    >
      <StilZeile
        label={t("link.zu")}
        pfad={["link", "href"]}
        s={s}
        onEntfernen={() => s.setzen(["link"], null)}
      >
        <Textfeld
          wert={href ?? null}
          platzhalter={t("link.platzhalter")}
          maxLaenge={2000}
          muster={HREF_RE}
          laeuft={s.laeuft}
          onWert={(v) =>
            v === null
              ? s.setzen(["link"], null)
              : s.setzen(["link", "href"], v)
          }
        />
      </StilZeile>
      {href !== undefined ? (
        <>
          {/* Framers „Abschnitt": der Scroll-Anker der Zielseite. Die Liste
              kennt nur die Anker DIESER Seite (nur die sind hier bekannt);
              für eine andere Seite tippt man den Anker. */}
          <StilZeile label={t("link.abschnitt")} pfad={["link", "anker"]} s={s}>
            {ankerListe.length > 0 ? (
              <Auswahl
                wert={anker ?? null}
                leer={t("link.abschnittLeer")}
                laeuft={s.laeuft}
                optionen={[
                  ...ankerListe.map((a) => [a, `#${a}`] as const),
                  ...(anker && !ankerListe.includes(anker)
                    ? [[anker, `#${anker}`] as const]
                    : []),
                ]}
                onWahl={(v) => s.setzen(["link", "anker"], v)}
              />
            ) : (
              <>
                <span className="shrink-0 text-[0.8125rem] text-muted-foreground">
                  #
                </span>
                <Textfeld
                  wert={anker ?? null}
                  platzhalter={t("link.abschnittLeer")}
                  maxLaenge={50}
                  muster={ANKER_RE}
                  laeuft={s.laeuft}
                  onWert={(v) => s.setzen(["link", "anker"], v)}
                />
              </>
            )}
          </StilZeile>
          <StilZeile label={t("link.neuerTab")} s={s}>
            <JaNein
              wert={neuerTab ?? false}
              laeuft={s.laeuft}
              onWahl={(v) =>
                s.setzen(["link", "neuer_tab"], v === true ? true : null)
              }
            />
          </StilZeile>
          {offene.has("rel") ? (
            <StilZeile label={t("link.rel")} pfad={["link", "rel"]} s={s}>
              <SchalterChips
                werte={LINK_REL}
                gesetzt={rel}
                label={(k) => t(`link.relWert.${k}`)}
                laeuft={s.laeuft}
                onWert={(neu) =>
                  s.setzen(["link", "rel"], neu.length ? neu : null)
                }
              />
            </StilZeile>
          ) : null}
          {offene.has("scrollen") ? (
            // Framers „Scrollen: Smooth/Instant" (§4.2). Es gilt nur für den
            // Sprung auf einen Anker DIESER Seite — bei einem Link auf eine
            // andere Seite entscheidet der Browser, und ein Wert, der dort
            // nichts täte, stünde hier als Versprechen (Wurzel 4).
            <StilZeile
              label={t("link.scrollen")}
              pfad={["link", "scrollen"]}
              s={s}
            >
              <Auswahl
                wert={scrollen ?? null}
                leer={t("automatisch")}
                laeuft={s.laeuft}
                optionen={[
                  ["sanft", t("link.scrollenWert.sanft")],
                  ["sofort", t("link.scrollenWert.sofort")],
                ]}
                onWahl={(v) => s.setzen(["link", "scrollen"], v)}
              />
            </StilZeile>
          ) : null}
          {offene.has("tracking") ? (
            // Framers „Tracking" (§7): der Klick meldet ein Ereignis an das
            // Google-Tag der Website. Ohne Kennung im Baukasten meldet er
            // nichts — der Hinweis darunter sagt das, statt es zu verschweigen.
            <>
              <StilZeile
                label={t("link.tracking")}
                pfad={["link", "tracking"]}
                s={s}
              >
                <Textfeld
                  wert={tracking ?? null}
                  platzhalter={t("link.trackingPlatzhalter")}
                  maxLaenge={40}
                  muster={EREIGNIS_RE}
                  laeuft={s.laeuft}
                  onWert={(v) => s.setzen(["link", "tracking"], v)}
                />
              </StilZeile>
              <p className="pl-[6rem] text-[0.6875rem] leading-snug text-muted-foreground">
                {t("link.trackingHinweis")}
              </p>
            </>
          ) : null}
          {offene.has("parameter") ? (
            <StilZeile
              label={t("link.parameter")}
              pfad={["link", "parameter"]}
              s={s}
            >
              <span className="shrink-0 text-[0.8125rem] text-muted-foreground">
                ?
              </span>
              <Textfeld
                wert={parameter ?? null}
                platzhalter={t("link.parameterPlatzhalter")}
                maxLaenge={300}
                muster={PARAMETER_RE}
                laeuft={s.laeuft}
                onWert={(v) => s.setzen(["link", "parameter"], v)}
              />
            </StilZeile>
          ) : null}
        </>
      ) : null}
    </PlusKarte>
  );
}

/** Mehrfachwahl als Chips (Framers Rel-Liste, OpenType-Merkmale). */
function SchalterChips<T extends string>({
  werte,
  gesetzt,
  label,
  laeuft,
  onWert,
}: {
  werte: readonly T[];
  gesetzt: readonly T[];
  label: (k: T) => string;
  laeuft: boolean;
  onWert: (neu: T[]) => void;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-wrap gap-1 py-1">
      {werte.map((k) => {
        const an = gesetzt.includes(k);
        return (
          <button
            key={k}
            type="button"
            disabled={laeuft}
            aria-pressed={an}
            onClick={() =>
              onWert(an ? gesetzt.filter((x) => x !== k) : [...gesetzt, k])
            }
            className={
              "rounded-md px-2 py-0.5 text-[0.6875rem] transition disabled:opacity-40 " +
              (an
                ? "bg-sky-500/20 text-sky-600 dark:text-sky-300"
                : "bg-secondary text-muted-foreground hover:text-foreground")
            }
          >
            {label(k)}
          </button>
        );
      })}
    </div>
  );
}

// --- Effekte -----------------------------------------------------------------

/** Framer „Effects" (Vollerfassung §8) — alles ohne Komponenten und Varianten:
 *  Erscheinen (Appear), Überfahren (Hover), Drücken (Press), Schleife (Loop),
 *  Ziehen (Drag), Lichtkasten (Lightbox), Ticker, Scroll-Tempo (Scroll Speed)
 *  und Scroll-Transform. Framer öffnet je Effekt einen Dialog links neben dem
 *  Panel; hier stehen die Felder als Zeilen unter dem Eintrag — dieselben
 *  Werte, ein Klick weniger.
 *
 *  Nicht dabei: „Flow" und „Scroll Variant". Beide arbeiten mit VARIANTEN
 *  eines Bausteins, und die gibt es in unserem Modell nicht — ein Eintrag
 *  dafür wäre ein Menüpunkt ohne Wirkung (Wurzel 4).
 *
 *  Ein Unterschied zum Vorbild, bewusst: Framers Ticker und Flow bauen den
 *  Layer beim Anlegen in einen Stack UM und entfernen seine Füllung, und das
 *  `×` am Chip nimmt es NICHT zurück (Vollerfassung §8). Hier ändert ein
 *  Effekt niemals die Struktur — er ist eine Zeile in `settings`, die man
 *  genauso wieder löscht. */
const EFFEKT_EINTRAEGE = [
  "erscheinen",
  "hover",
  "druck",
  "schleife",
  "ziehen",
  "lichtkasten",
  "ticker",
  "scroll_tempo",
  "scroll_transform",
] as const;

function EffekteKarte({ s }: { s: Stift }) {
  const t = useTranslations("website.stil");
  const gesetzt = gesetzteSchluessel(s, "effekte");
  const { offene, oeffne } = useOffene(gesetzt);
  const lese = <T,>(...pfad: string[]) =>
    s.lesen(["effekte", ...pfad]) as T | undefined;

  function hoverZeilen(art: "hover" | "druck") {
    const opazitaet = lese<number>(art, "opazitaet");
    return (
      <>
        <StilZeile
          label={t(`effekte.${art}`)}
          pfad={["effekte", art]}
          s={s}
          onEntfernen={() => s.setzen(["effekte", art], null)}
        >
          <span className="min-w-0 flex-1 text-[0.6875rem] text-muted-foreground">
            {t("effekte.zielzustand")}
          </span>
        </StilZeile>
        <StilZeile
          label={t("effekte.skalierung")}
          pfad={["effekte", art, "skalierung"]}
          s={s}
        >
          <Schieber
            wert={lese<number>(art, "skalierung") ?? null}
            min={0}
            max={2}
            standard={1}
            einheit="×"
            schritt={0.01}
            laeuft={s.laeuft}
            onWert={(v) => s.setzen(["effekte", art, "skalierung"], v)}
          />
        </StilZeile>
        <StilZeile
          label={t("effekte.opazitaet")}
          pfad={["effekte", art, "opazitaet"]}
          s={s}
        >
          <Schieber
            wert={opazitaet != null ? Math.round(opazitaet * 100) : null}
            min={0}
            max={100}
            standard={100}
            einheit="%"
            laeuft={s.laeuft}
            onWert={(v) =>
              s.setzen(
                ["effekte", art, "opazitaet"],
                v === null ? null : v / 100,
              )
            }
          />
        </StilZeile>
        <StilZeile
          label={t("effekte.rotation")}
          pfad={["effekte", art, "rotation"]}
          s={s}
        >
          <Schieber
            wert={lese<number>(art, "rotation") ?? null}
            min={-180}
            max={180}
            standard={0}
            einheit="°"
            laeuft={s.laeuft}
            onWert={(v) => s.setzen(["effekte", art, "rotation"], v)}
          />
        </StilZeile>
        <StilZeile label={t("effekte.versatz")} s={s}>
          <MassFeld
            wert={lese(art, "versatz_x")}
            negativ
            laeuft={s.laeuft}
            onWert={(v) => s.setzen(["effekte", art, "versatz_x"], v)}
          />
          <MassFeld
            wert={lese(art, "versatz_y")}
            negativ
            laeuft={s.laeuft}
            onWert={(v) => s.setzen(["effekte", art, "versatz_y"], v)}
          />
        </StilZeile>
        <StilZeile
          label={t("effekte.dauer")}
          pfad={["effekte", art, "dauer"]}
          s={s}
        >
          <Zahlfeld
            wert={lese<number>(art, "dauer") ?? null}
            min={0}
            max={3000}
            einheit="ms"
            schritt={50}
            platzhalter="200"
            laeuft={s.laeuft}
            onWert={(v) => s.setzen(["effekte", art, "dauer"], v)}
          />
        </StilZeile>
      </>
    );
  }

  return (
    <PlusKarte
      titel={t("effekte.titel")}
      geaendert={gesetzt.length > 0}
      offene={offene}
      onOeffnen={oeffne}
      eintraege={EFFEKT_EINTRAEGE.map((k) => ({
        key: k,
        label: t(`effekte.${k}`),
        gesetzt: gesetzt.includes(k),
      }))}
    >
      {offene.has("erscheinen") ? (
        <>
          <StilZeile
            label={t("effekte.erscheinen")}
            pfad={["effekte", "erscheinen"]}
            s={s}
            onEntfernen={() => s.setzen(["effekte", "erscheinen"], null)}
          >
            <Auswahl
              wert={lese<string>("erscheinen", "art") ?? null}
              leer={t("effekte.erscheinenArt.einblenden")}
              laeuft={s.laeuft}
              optionen={ERSCHEINEN_ARTEN.map(
                (a) => [a, t(`effekte.erscheinenArt.${a}`)] as const,
              )}
              onWahl={(v) =>
                s.setzen(["effekte", "erscheinen", "art"], v ?? "einblenden")
              }
            />
          </StilZeile>
          <StilZeile
            label={t("effekte.dauer")}
            pfad={["effekte", "erscheinen", "dauer"]}
            s={s}
          >
            <Zahlfeld
              wert={lese<number>("erscheinen", "dauer") ?? null}
              min={100}
              max={3000}
              einheit="ms"
              schritt={50}
              platzhalter="600"
              laeuft={s.laeuft}
              onWert={(v) => s.setzen(["effekte", "erscheinen", "dauer"], v)}
            />
          </StilZeile>
          <StilZeile
            label={t("effekte.verzoegerung")}
            pfad={["effekte", "erscheinen", "verzoegerung"]}
            s={s}
          >
            <Zahlfeld
              wert={lese<number>("erscheinen", "verzoegerung") ?? null}
              min={0}
              max={3000}
              einheit="ms"
              schritt={50}
              platzhalter="0"
              laeuft={s.laeuft}
              onWert={(v) =>
                s.setzen(["effekte", "erscheinen", "verzoegerung"], v)
              }
            />
          </StilZeile>
          <StilZeile
            label={t("effekte.wiederholen")}
            pfad={["effekte", "erscheinen", "wiederholen"]}
            s={s}
          >
            <JaNein
              wert={lese<boolean>("erscheinen", "wiederholen") ?? false}
              laeuft={s.laeuft}
              onWahl={(v) =>
                s.setzen(
                  ["effekte", "erscheinen", "wiederholen"],
                  v === true ? true : null,
                )
              }
            />
          </StilZeile>
        </>
      ) : null}
      {offene.has("hover") ? hoverZeilen("hover") : null}
      {offene.has("druck") ? hoverZeilen("druck") : null}
      {offene.has("schleife") ? (
        <>
          <StilZeile
            label={t("effekte.schleife")}
            pfad={["effekte", "schleife"]}
            s={s}
            onEntfernen={() => s.setzen(["effekte", "schleife"], null)}
          >
            <Auswahl
              wert={lese<string>("schleife", "art") ?? null}
              leer={t("effekte.schleifeArt.pulsieren")}
              laeuft={s.laeuft}
              optionen={SCHLEIFEN_ARTEN.map(
                (a) => [a, t(`effekte.schleifeArt.${a}`)] as const,
              )}
              onWahl={(v) =>
                s.setzen(["effekte", "schleife", "art"], v ?? "pulsieren")
              }
            />
          </StilZeile>
          <StilZeile
            label={t("effekte.dauer")}
            pfad={["effekte", "schleife", "dauer"]}
            s={s}
          >
            <Zahlfeld
              wert={lese<number>("schleife", "dauer") ?? null}
              min={300}
              max={20000}
              einheit="ms"
              schritt={100}
              platzhalter="2000"
              laeuft={s.laeuft}
              onWert={(v) => s.setzen(["effekte", "schleife", "dauer"], v)}
            />
          </StilZeile>
        </>
      ) : null}
      {offene.has("ziehen") ? (
        <>
          <StilZeile
            label={t("effekte.ziehenFrei")}
            pfad={["effekte", "ziehen"]}
            s={s}
            onEntfernen={() => s.setzen(["effekte", "ziehen"], null)}
          >
            <JaNein
              wert={lese<boolean>("ziehen", "frei") ?? true}
              laeuft={s.laeuft}
              onWahl={(v) =>
                s.setzeAlle([
                  [["effekte", "ziehen", "frei"], v !== false],
                  // „Frei" und eine Achse schließen sich aus — die Achse
                  // verschwindet mit, statt als toter Wert stehen zu bleiben
                  // (Wurzel 1: jede Aktion hat einen Gegenzustand).
                  [["effekte", "ziehen", "achse"], v !== false ? null : "x"],
                ])
              }
            />
          </StilZeile>
          {lese<boolean>("ziehen", "frei") === false ? (
            <StilZeile
              label={t("effekte.ziehenAchse")}
              pfad={["effekte", "ziehen", "achse"]}
              s={s}
            >
              <Segment
                wert={lese<"x" | "y">("ziehen", "achse") ?? "x"}
                laeuft={s.laeuft}
                optionen={[
                  ["x", "ph:arrows-horizontal", t("effekte.achseX")],
                  ["y", "ph:arrows-vertical", t("effekte.achseY")],
                ]}
                onWahl={(v) => s.setzen(["effekte", "ziehen", "achse"], v ?? "x")}
              />
            </StilZeile>
          ) : null}
          <StilZeile
            label={t("effekte.ziehenZurueck")}
            pfad={["effekte", "ziehen", "zurueck"]}
            s={s}
          >
            <JaNein
              wert={lese<boolean>("ziehen", "zurueck") ?? false}
              laeuft={s.laeuft}
              onWahl={(v) =>
                s.setzen(["effekte", "ziehen", "zurueck"], v === true ? true : null)
              }
            />
          </StilZeile>
        </>
      ) : null}
      {offene.has("lichtkasten") ? (
        <>
          <StilZeile
            label={t("effekte.lichtkastenBreite")}
            pfad={["effekte", "lichtkasten"]}
            s={s}
            onEntfernen={() => s.setzen(["effekte", "lichtkasten"], null)}
          >
            <Zahlfeld
              wert={lese<number>("lichtkasten", "max_breite") ?? null}
              min={200}
              max={2000}
              einheit="px"
              schritt={20}
              platzhalter="800"
              laeuft={s.laeuft}
              onWert={(v) => s.setzen(["effekte", "lichtkasten", "max_breite"], v)}
            />
          </StilZeile>
          <StilZeile
            label={t("effekte.lichtkastenAbstand")}
            pfad={["effekte", "lichtkasten", "innenabstand"]}
            s={s}
          >
            <Zahlfeld
              wert={lese<number>("lichtkasten", "innenabstand") ?? null}
              min={0}
              max={200}
              einheit="px"
              platzhalter="20"
              laeuft={s.laeuft}
              onWert={(v) => s.setzen(["effekte", "lichtkasten", "innenabstand"], v)}
            />
          </StilZeile>
          <StilZeile
            label={t("effekte.lichtkastenGrund")}
            pfad={["effekte", "lichtkasten", "hintergrund"]}
            s={s}
          >
            <FarbFeld
              wert={lese<string>("lichtkasten", "hintergrund") ?? null}
              laeuft={s.laeuft}
              onWert={(f) => s.setzen(["effekte", "lichtkasten", "hintergrund"], f)}
            />
          </StilZeile>
          <p className="pl-[6rem] text-[0.6875rem] leading-snug text-muted-foreground">
            {t("effekte.lichtkastenHinweis")}
          </p>
        </>
      ) : null}
      {offene.has("ticker") ? (
        <>
          <StilZeile
            label={t("effekte.tickerTempo")}
            pfad={["effekte", "ticker"]}
            s={s}
            onEntfernen={() => s.setzen(["effekte", "ticker"], null)}
          >
            <Schieber
              wert={lese<number>("ticker", "tempo") ?? null}
              min={10}
              max={500}
              standard={100}
              einheit="%"
              laeuft={s.laeuft}
              onWert={(v) => s.setzen(["effekte", "ticker", "tempo"], v)}
            />
          </StilZeile>
          <StilZeile
            label={t("effekte.tickerRichtung")}
            pfad={["effekte", "ticker", "richtung"]}
            s={s}
          >
            <Auswahl
              wert={lese<string>("ticker", "richtung") ?? null}
              leer={t("effekte.tickerRichtungWert.links")}
              laeuft={s.laeuft}
              optionen={(["links", "rechts", "oben", "unten"] as const).map(
                (r) => [r, t(`effekte.tickerRichtungWert.${r}`)] as const,
              )}
              onWahl={(v) => s.setzen(["effekte", "ticker", "richtung"], v ?? "links")}
            />
          </StilZeile>
          <StilZeile
            label={t("effekte.tickerHover")}
            pfad={["effekte", "ticker", "hover"]}
            s={s}
          >
            <Auswahl
              wert={lese<string>("ticker", "hover") ?? null}
              leer={t("effekte.tickerHoverWert.weiter")}
              laeuft={s.laeuft}
              optionen={(["weiter", "langsamer", "stopp"] as const).map(
                (h) => [h, t(`effekte.tickerHoverWert.${h}`)] as const,
              )}
              onWahl={(v) => s.setzen(["effekte", "ticker", "hover"], v ?? "weiter")}
            />
          </StilZeile>
          <StilZeile
            label={t("effekte.tickerZiehbar")}
            pfad={["effekte", "ticker", "ziehbar"]}
            s={s}
          >
            <JaNein
              wert={lese<boolean>("ticker", "ziehbar") ?? false}
              laeuft={s.laeuft}
              onWahl={(v) =>
                s.setzen(["effekte", "ticker", "ziehbar"], v === true ? true : null)
              }
            />
          </StilZeile>
        </>
      ) : null}
      {offene.has("scroll_transform") ? (
        <>
          <StilZeile
            label={t("effekte.ausloeser")}
            pfad={["effekte", "scroll_transform"]}
            s={s}
            onEntfernen={() => s.setzen(["effekte", "scroll_transform"], null)}
          >
            <Auswahl
              wert={lese<string>("scroll_transform", "ausloeser") ?? null}
              leer={t("effekte.ausloeserWert.scroll")}
              laeuft={s.laeuft}
              optionen={(
                ["scroll", "ebene_sichtbar", "abschnitt_sichtbar"] as const
              ).map((a) => [a, t(`effekte.ausloeserWert.${a}`)] as const)}
              onWahl={(v) =>
                s.setzen(["effekte", "scroll_transform", "ausloeser"], v ?? "scroll")
              }
            />
          </StilZeile>
          {(["von", "nach"] as const).map((seite) => (
            <div key={seite} className="flex flex-col gap-2.5">
              <p className="pl-[6rem] text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
                {t(`effekte.${seite}`)}
              </p>
              <StilZeile
                label={t("effekte.opazitaet")}
                pfad={["effekte", "scroll_transform", seite, "opazitaet"]}
                s={s}
              >
                <Schieber
                  wert={(() => {
                    const o = lese<number>("scroll_transform", seite, "opazitaet");
                    return o != null ? Math.round(o * 100) : null;
                  })()}
                  min={0}
                  max={100}
                  standard={100}
                  einheit="%"
                  laeuft={s.laeuft}
                  onWert={(v) =>
                    s.setzen(
                      ["effekte", "scroll_transform", seite, "opazitaet"],
                      v === null ? null : v / 100,
                    )
                  }
                />
              </StilZeile>
              <StilZeile
                label={t("effekte.skalierung")}
                pfad={["effekte", "scroll_transform", seite, "skalierung"]}
                s={s}
              >
                <Schieber
                  wert={lese<number>("scroll_transform", seite, "skalierung") ?? null}
                  min={0}
                  max={2}
                  standard={1}
                  einheit="×"
                  schritt={0.01}
                  laeuft={s.laeuft}
                  onWert={(v) =>
                    s.setzen(["effekte", "scroll_transform", seite, "skalierung"], v)
                  }
                />
              </StilZeile>
              <StilZeile
                label={t("effekte.rotation")}
                pfad={["effekte", "scroll_transform", seite, "rotation"]}
                s={s}
              >
                <Schieber
                  wert={lese<number>("scroll_transform", seite, "rotation") ?? null}
                  min={-180}
                  max={180}
                  standard={0}
                  einheit="°"
                  laeuft={s.laeuft}
                  onWert={(v) =>
                    s.setzen(["effekte", "scroll_transform", seite, "rotation"], v)
                  }
                />
              </StilZeile>
              <StilZeile label={t("effekte.versatz")} s={s}>
                <MassFeld
                  wert={lese("scroll_transform", seite, "versatz_x")}
                  negativ
                  laeuft={s.laeuft}
                  onWert={(v) =>
                    s.setzen(["effekte", "scroll_transform", seite, "versatz_x"], v)
                  }
                />
                <MassFeld
                  wert={lese("scroll_transform", seite, "versatz_y")}
                  negativ
                  laeuft={s.laeuft}
                  onWert={(v) =>
                    s.setzen(["effekte", "scroll_transform", seite, "versatz_y"], v)
                  }
                />
              </StilZeile>
            </div>
          ))}
        </>
      ) : null}
      {offene.has("scroll_tempo") ? (
        <StilZeile
          label={t("effekte.scroll_tempo")}
          pfad={["effekte", "scroll_tempo"]}
          s={s}
        >
          <Schieber
            wert={lese<number>("scroll_tempo") ?? null}
            min={10}
            max={300}
            standard={100}
            einheit="%"
            laeuft={s.laeuft}
            onWert={(v) => s.setzen(["effekte", "scroll_tempo"], v)}
          />
        </StilZeile>
      ) : null}
      {offene.has("scroll_tempo") ||
      offene.has("erscheinen") ||
      offene.has("scroll_transform") ||
      offene.has("ticker") ||
      offene.has("ziehen") ? (
        <p className="pl-[6rem] text-[0.6875rem] leading-snug text-muted-foreground">
          {t("effekte.hinweisLive")}
        </p>
      ) : null}
    </PlusKarte>
  );
}

// --- Cursor ------------------------------------------------------------------

/** Framer „Cursor" (Vollerfassung §10): der Zeiger über dem Element.
 *
 *  Zwei der drei Einträge des Vorbilds: „Web Cursor" (eine Liste) und „Custom
 *  Cursor" — dort eine Komponente, hier ein BILD aus der Mediathek samt
 *  Hotspot. Das ist derselbe Zweck mit unseren Mitteln; ein Komponentenmodell
 *  gibt es nicht.
 *
 *  „Set Variant" fehlt: es animiert den Zeiger über Varianten. Ohne Varianten
 *  wäre der Eintrag ein Knopf ohne Wirkung (Wurzel 4).
 *
 *  Reihenfolge im Zeiger: erst das Bild, dann der Web-Cursor als Rückfall —
 *  lehnt der Browser das Bild ab (zu groß, nicht geladen), bleibt das Element
 *  nicht ohne Zeiger. */
function CursorKarte({ s }: { s: Stift }) {
  const t = useTranslations("website.stil");
  const wert = s.lesen(["cursor"]) as Cursor | undefined;
  const bild = s.lesen(["cursor_bild", "url"]) as string | undefined;
  const { offene, oeffne } = useOffene([
    ...(wert !== undefined ? ["web"] : []),
    ...(bild !== undefined ? ["bild"] : []),
  ]);
  return (
    <PlusKarte
      titel={t("cursor.titel")}
      geaendert={wert !== undefined || bild !== undefined}
      offene={offene}
      onOeffnen={oeffne}
      eintraege={[
        { key: "web", label: t("cursor.web"), gesetzt: wert !== undefined },
        { key: "bild", label: t("cursor.bild"), gesetzt: bild !== undefined },
      ]}
    >
      {offene.has("web") ? (
        <StilZeile label={t("cursor.web")} pfad={["cursor"]} s={s}>
          <Auswahl
            wert={wert ?? null}
            leer={t("automatisch")}
            laeuft={s.laeuft}
            optionen={CURSOR.map((c) => [c, t(`cursor.wert.${c}`)] as const)}
            onWahl={(v) => s.setzen(["cursor"], v)}
          />
        </StilZeile>
      ) : null}
      {offene.has("bild") ? (
        <>
          <StilZeile
            label={t("cursor.bild")}
            pfad={["cursor_bild"]}
            s={s}
            onEntfernen={() => s.setzen(["cursor_bild"], null)}
          >
            <BildFeld
              label={t("cursor.bild")}
              wert={bild ?? null}
              kompakt
              onWert={(url) =>
                s.setzen(["cursor_bild"], url ? { url, x: 0, y: 0 } : null)
              }
            />
          </StilZeile>
          {bild !== undefined ? (
            <StilZeile
              label={t("cursor.hotspot")}
              pfad={["cursor_bild", "x"]}
              s={s}
            >
              <Zahlfeld
                wert={(s.lesen(["cursor_bild", "x"]) as number | undefined) ?? null}
                min={0}
                max={128}
                einheit="X"
                platzhalter="0"
                laeuft={s.laeuft}
                onWert={(v) => s.setzen(["cursor_bild", "x"], v ?? 0)}
              />
              <Zahlfeld
                wert={(s.lesen(["cursor_bild", "y"]) as number | undefined) ?? null}
                min={0}
                max={128}
                einheit="Y"
                platzhalter="0"
                laeuft={s.laeuft}
                onWert={(v) => s.setzen(["cursor_bild", "y"], v ?? 0)}
              />
            </StilZeile>
          ) : null}
          <p className="pl-[6rem] text-[0.6875rem] leading-snug text-muted-foreground">
            {t("cursor.bildHinweis")}
          </p>
        </>
      ) : null}
    </PlusKarte>
  );
}

// --- Overlays ----------------------------------------------------------------

/** Framer „Overlays" (Vollerfassung §9): ein Kasten, der beim Klick oder
 *  Überfahren aufgeht — `relativ` am Element (Dropdown, Popover) oder
 *  `fixiert` mittig im Fenster (Modal, Toast).
 *
 *  Framer legt dafür eine KIND-EBENE an und schaltet den Canvas in einen
 *  eigenen Bearbeitungsmodus („Editing Overlay", mit `Done`). Unser Modell
 *  kennt keine freien Kind-Ebenen; der Inhalt ist deshalb ein Text je Sprache,
 *  wie jedes Textfeld eines Bausteins. Kein HTML: was der Kunde tippt, landet
 *  als Text auf einer Gast-Seite (Wurzel 8).
 *
 *  Auf der Fläche steht der Kasten im Editor IMMER offen — ein Popover, das
 *  man nicht sieht, lässt sich nicht gestalten. */
function OverlayKarte({ s, sprache }: { s: Stift; sprache: string }) {
  const t = useTranslations("website.stil");
  const typ = s.lesen(["overlay", "typ"]) as "relativ" | "fixiert" | undefined;
  const inhalt =
    (s.lesen(["overlay", "inhalt"]) as Record<string, string> | undefined) ?? {};
  const gesetzt = typ !== undefined || Object.keys(inhalt).length > 0;
  const { offene, oeffne } = useOffene(gesetzt ? ["overlay"] : []);
  const relativ = (typ ?? "relativ") === "relativ";
  return (
    <PlusKarte
      titel={t("overlay.titel")}
      geaendert={gesetzt}
      offene={offene}
      onOeffnen={oeffne}
      eintraege={[
        { key: "overlay", label: t("overlay.anlegen"), gesetzt },
      ]}
    >
      {offene.has("overlay") ? (
        <>
          <StilZeile
            label={t("overlay.typ")}
            pfad={["overlay", "typ"]}
            s={s}
            onEntfernen={() => s.setzen(["overlay"], null)}
          >
            <Auswahl
              wert={typ ?? null}
              leer={t("overlay.typWert.relativ")}
              laeuft={s.laeuft}
              optionen={[
                ["relativ", t("overlay.typWert.relativ")],
                ["fixiert", t("overlay.typWert.fixiert")],
              ]}
              onWahl={(v) => s.setzen(["overlay", "typ"], v ?? "relativ")}
            />
          </StilZeile>
          <StilZeile
            label={t("overlay.inhalt")}
            pfad={["overlay", "inhalt", sprache]}
            s={s}
          >
            <Textfeld
              wert={inhalt[sprache] ?? null}
              platzhalter={t("overlay.inhaltPlatzhalter")}
              maxLaenge={2000}
              laeuft={s.laeuft}
              onWert={(v) => {
                // Die Sprachfassung EINZELN setzen: eine andere Fassung darf
                // beim Tippen nicht verschwinden (Wurzel 1).
                const neu = { ...inhalt };
                if (v) neu[sprache] = v;
                else delete neu[sprache];
                s.setzen(
                  ["overlay", "inhalt"],
                  Object.keys(neu).length ? neu : null,
                );
              }}
            />
          </StilZeile>
          <StilZeile
            label={t("overlay.ausloeser")}
            pfad={["overlay", "ausloeser"]}
            s={s}
          >
            <Segment
              wert={
                (s.lesen(["overlay", "ausloeser"]) as "klick" | "hover" | undefined) ??
                "klick"
              }
              laeuft={s.laeuft}
              optionen={[
                ["klick", "ph:cursor-click", t("overlay.ausloeserWert.klick")],
                ["hover", "ph:cursor", t("overlay.ausloeserWert.hover")],
              ]}
              onWahl={(v) => s.setzen(["overlay", "ausloeser"], v ?? "klick")}
            />
          </StilZeile>
          {relativ ? (
            <>
              <StilZeile
                label={t("overlay.position")}
                pfad={["overlay", "position"]}
                s={s}
              >
                <Auswahl
                  wert={s.lesen(["overlay", "position"]) as string | null}
                  leer={t("position.unten")}
                  laeuft={s.laeuft}
                  optionen={(["oben", "rechts", "unten", "links"] as const).map(
                    (r) => [r, t(`position.${r}`)] as const,
                  )}
                  onWahl={(v) => s.setzen(["overlay", "position"], v ?? "unten")}
                />
              </StilZeile>
              <StilZeile
                label={t("overlay.ausrichten")}
                pfad={["overlay", "ausrichten"]}
                s={s}
              >
                <Segment
                  wert={
                    (s.lesen(["overlay", "ausrichten"]) as
                      | "start"
                      | "mitte"
                      | "ende"
                      | undefined) ?? "mitte"
                  }
                  laeuft={s.laeuft}
                  optionen={[
                    ["start", "ph:align-left-simple", t("layout.ausrichtenWert.start")],
                    ["mitte", "ph:align-center-horizontal-simple", t("layout.ausrichtenWert.mitte")],
                    ["ende", "ph:align-right-simple", t("layout.ausrichtenWert.ende")],
                  ]}
                  onWahl={(v) => s.setzen(["overlay", "ausrichten"], v ?? "mitte")}
                />
              </StilZeile>
              <StilZeile label={t("overlay.versatz")} s={s}>
                <Zahlfeld
                  wert={(s.lesen(["overlay", "versatz_x"]) as number | undefined) ?? null}
                  min={-200}
                  max={200}
                  einheit="X"
                  platzhalter="0"
                  laeuft={s.laeuft}
                  onWert={(v) => s.setzen(["overlay", "versatz_x"], v)}
                />
                <Zahlfeld
                  wert={(s.lesen(["overlay", "versatz_y"]) as number | undefined) ?? null}
                  min={-200}
                  max={200}
                  einheit="Y"
                  platzhalter="10"
                  laeuft={s.laeuft}
                  onWert={(v) => s.setzen(["overlay", "versatz_y"], v)}
                />
              </StilZeile>
            </>
          ) : null}
          <StilZeile
            label={t("overlay.schliessen")}
            pfad={["overlay", "schliessen"]}
            s={s}
          >
            <Auswahl
              wert={s.lesen(["overlay", "schliessen"]) as string | null}
              leer={t("overlay.schliessenWert.auto")}
              laeuft={s.laeuft}
              optionen={[
                ["auto", t("overlay.schliessenWert.auto")],
                ["klick", t("overlay.schliessenWert.klick")],
              ]}
              onWahl={(v) => s.setzen(["overlay", "schliessen"], v ?? "auto")}
            />
          </StilZeile>
          <StilZeile label={t("overlay.breite")} pfad={["overlay", "breite"]} s={s}>
            <Zahlfeld
              wert={(s.lesen(["overlay", "breite"]) as number | undefined) ?? null}
              min={120}
              max={800}
              einheit="px"
              schritt={10}
              laeuft={s.laeuft}
              onWert={(v) => s.setzen(["overlay", "breite"], v)}
            />
          </StilZeile>
          <p className="pl-[6rem] text-[0.6875rem] leading-snug text-muted-foreground">
            {t("overlay.hinweis")}
          </p>
        </>
      ) : null}
    </PlusKarte>
  );
}

// --- Codeüberschreibungen ----------------------------------------------------

/** Framer „Code Overrides" (Vollerfassung §7): dort eine TypeScript-Datei am
 *  Element, hier eigene CSS-EIGENSCHAFTEN.
 *
 *  Der Unterschied ist keine Bequemlichkeit, sondern Wurzel 8: Kundencode, den
 *  der Server ausliefert, ist ein Skript auf einer fremden Gast-Seite. Was
 *  bleibt, ist der Teil, für den man den Code im Vorbild meistens benutzt —
 *  eine Eigenschaft, die das Panel nicht als Zeile führt.
 *
 *  Geprüft wird HIER mit derselben Funktion wie im Backend
 *  (`codeCssZerlegen` ↔ `css_zerlegen`), und die abgewiesenen Zeilen stehen
 *  unter dem Feld. Ein Feld, das den halben Text schluckt und nichts sagt,
 *  wäre der stille Datenverlust aus `editor-leiste-muss-allowlist-treffen`. */
function CodeKarte({ s }: { s: Stift }) {
  const t = useTranslations("website.stil");
  const css = s.lesen(["code", "css"]) as string | undefined;
  const [entwurf, setEntwurf] = useState<string | null>(null);
  const { offene, oeffne } = useOffene(css !== undefined ? ["css"] : []);
  const text = entwurf ?? css ?? "";
  const { paare, fehler } = codeCssZerlegen(text);
  return (
    <PlusKarte
      titel={t("code.titel")}
      geaendert={css !== undefined}
      offene={offene}
      onOeffnen={oeffne}
      eintraege={[{ key: "css", label: t("code.css"), gesetzt: css !== undefined }]}
    >
      {offene.has("css") ? (
        <>
          <StilZeile
            label={t("code.css")}
            pfad={["code", "css"]}
            s={s}
            onEntfernen={() => {
              setEntwurf(null);
              s.setzen(["code"], null);
            }}
          >
            <textarea
              value={text}
              spellCheck={false}
              rows={4}
              disabled={s.laeuft}
              placeholder={t("code.platzhalter")}
              onChange={(e) => setEntwurf(e.target.value)}
              onBlur={() => {
                const roh = text.trim();
                setEntwurf(null);
                // Gespeichert wird die BEREINIGTE Fassung — genau das, was
                // der Renderer daraus macht. Sonst stünde im Feld etwas
                // anderes, als auf der Seite wirkt.
                const sauber = paare.map(([p, w]) => `${p}: ${w};`).join("\n");
                if (!roh || !sauber) {
                  if (css !== undefined) s.setzen(["code"], null);
                  return;
                }
                if (sauber !== css) s.setzen(["code", "css"], sauber);
              }}
              className="min-w-0 flex-1 rounded-lg bg-secondary px-2 py-1.5 font-mono text-[0.75rem] outline-none disabled:opacity-50"
            />
          </StilZeile>
          {fehler.length > 0 ? (
            <p className="pl-[6rem] text-[0.6875rem] leading-snug text-destructive">
              {t("code.abgewiesen", { zeilen: fehler.join(" · ") })}
            </p>
          ) : null}
          <p className="pl-[6rem] text-[0.6875rem] leading-snug text-muted-foreground">
            {t("code.hinweis")}
          </p>
        </>
      ) : null}
    </PlusKarte>
  );
}

// --- Layout (Container) ------------------------------------------------------

const SEITEN = ["oben", "rechts", "unten", "links"] as const;
const SEITEN_ICON: Record<(typeof SEITEN)[number], string> = {
  oben: "ph:arrow-line-up",
  rechts: "ph:arrow-line-right",
  unten: "ph:arrow-line-down",
  links: "ph:arrow-line-left",
};

/** Innen- oder Außenabstand: EIN Wert für alle Seiten, oder je Seite —
 *  Framers „Padding | Padding per side". Vier gleiche Werte werden als einer
 *  gezeigt; ein Umschalten überträgt statt zu verlieren. */
function AbstandZeile({
  s,
  praefix,
  label,
}: {
  s: Stift;
  praefix: "padding" | "margin";
  label: string;
}) {
  const t = useTranslations("website.stil");
  const felder: Record<(typeof SEITEN)[number], string> = {
    oben: `${praefix}_top`,
    rechts: `${praefix}_right`,
    unten: `${praefix}_bottom`,
    links: `${praefix}_left`,
  };
  const werte = SEITEN.map(
    (seite) => s.lesen([felder[seite]]) as string | undefined,
  );
  const gesetzt = werte.some((w) => w !== undefined);
  const gleich = werte.every((w) => w === werte[0]);
  const [jeSeite, setJeSeite] = useState(gesetzt && !gleich);

  function alleSetzen(wert: string | null) {
    let neu = s.settings;
    for (const seite of SEITEN)
      neu = mitWert(neu, s.geraet, [felder[seite]], wert);
    s.setzen([], neu);
  }

  return (
    <>
      <StilZeile
        label={label}
        pfad={[felder.oben]}
        s={s}
        onEntfernen={() => alleSetzen(null)}
      >
        {jeSeite ? (
          <span className="min-w-0 flex-1 text-[0.75rem] text-muted-foreground">
            {t("layout.jeSeite")}
          </span>
        ) : (
          <MassFeld
            wert={gleich ? werte[0] : undefined}
            negativ={praefix === "margin"}
            laeuft={s.laeuft}
            onWert={alleSetzen}
          />
        )}
        <button
          type="button"
          disabled={s.laeuft}
          aria-pressed={jeSeite}
          title={t("layout.jeSeite")}
          onClick={() => setJeSeite((j) => !j)}
          className={
            "flex size-7 shrink-0 items-center justify-center rounded-(--radius) transition disabled:opacity-40 " +
            (jeSeite
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:bg-secondary/60")
          }
        >
          <Icon icon="ph:squares-four" className="size-4" />
        </button>
      </StilZeile>
      {jeSeite ? (
        <div className="grid grid-cols-2 gap-1 pl-[6rem]">
          {SEITEN.map((seite) => (
            <div key={seite} className="flex items-center gap-1">
              <Icon
                icon={SEITEN_ICON[seite]}
                className="size-3.5 shrink-0 text-muted-foreground"
              />
              <MassFeld
                wert={s.lesen([felder[seite]])}
                negativ={praefix === "margin"}
                laeuft={s.laeuft}
                onWert={(v) => s.setzen([felder[seite]], v)}
              />
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}

function LayoutKarte({
  s,
  container,
}: {
  s: Stift;
  /** Fehlt bei einem TEIL des Bausteins: der hat keine Spaltenzahl und keinen
   *  „Spalte hinzufügen"-Knopf, sonst dieselben Zeilen. */
  container?: ContainerZusatz;
}) {
  const t = useTranslations("website.stil");
  const tc = useTranslations("website.container");
  const richtung = s.lesen(["layout_richtung"]) as
    "zeile" | "spalte" | undefined;
  const verteilen = s.lesen(["layout_verteilen"]) as string | undefined;
  const ausrichten = s.lesen(["layout_ausrichten"]) as string | undefined;
  const umbruch = s.lesen(["layout_umbruch"]) as boolean | undefined;
  const abstand = s.lesen(["layout_abstand"]) as number | undefined;
  const typ = s.lesen(["layout_typ"]) as "stapel" | "raster" | undefined;
  const raster = typ === "raster";
  const gesetzt = [richtung, verteilen, ausrichten, umbruch, abstand, typ].some(
    (v) => v !== undefined,
  );

  return (
    <PlusKarte
      titel={t("layout.titel")}
      geaendert={gesetzt}
      offene={new Set(["richtung"])}
      onOeffnen={() => undefined}
      eintraege={[]}
    >
      {/* Framer „Type: Stack | Grid" (Vollerfassung §4.5). Raster blendet die
          Stapel-Zeilen aus und zeigt Spalten/Zeilen/Abstände. */}
      <StilZeile label={t("layout.typ")} pfad={["layout_typ"]} s={s}>
        <Segment
          wert={typ ?? null}
          laeuft={s.laeuft}
          optionen={[
            ["stapel", "ph:rows", t("layout.stapel")],
            ["raster", "ph:grid-four", t("layout.raster")],
          ]}
          onWahl={(v) => s.setzen(["layout_typ"], v)}
        />
      </StilZeile>
      {raster ? (
        <>
          <StilZeile
            label={t("layout.rasterSpalten")}
            pfad={["raster_spalten"]}
            s={s}
          >
            <Zahlfeld
              wert={(s.lesen(["raster_spalten"]) as number | undefined) ?? null}
              min={1}
              max={12}
              platzhalter="2"
              laeuft={s.laeuft}
              onWert={(v) => s.setzen(["raster_spalten"], v)}
            />
          </StilZeile>
          <StilZeile
            label={t("layout.rasterZeilen")}
            pfad={["raster_zeilen"]}
            s={s}
          >
            <Zahlfeld
              wert={(s.lesen(["raster_zeilen"]) as number | undefined) ?? null}
              min={1}
              max={12}
              platzhalter={t("automatisch")}
              laeuft={s.laeuft}
              onWert={(v) => s.setzen(["raster_zeilen"], v)}
            />
          </StilZeile>
          {(["raster_abstand_x", "raster_abstand_y"] as const).map((k) => (
            <StilZeile
              key={k}
              label={t(
                k === "raster_abstand_x"
                  ? "layout.rasterAbstandX"
                  : "layout.rasterAbstandY",
              )}
              pfad={[k]}
              s={s}
            >
              <Schieber
                wert={(s.lesen([k]) as number | undefined) ?? null}
                min={0}
                max={160}
                standard={0}
                einheit="px"
                schritt={1}
                laeuft={s.laeuft}
                onWert={(v) => s.setzen([k], v)}
              />
            </StilZeile>
          ))}
        </>
      ) : null}
      {!raster ? (
        <>
          <StilZeile label={tc("richtung")} pfad={["layout_richtung"]} s={s}>
            <Segment
              wert={richtung ?? null}
              laeuft={s.laeuft}
              optionen={[
                ["zeile", "ph:arrows-horizontal", tc("nebeneinander")],
                ["spalte", "ph:arrows-vertical", tc("untereinander")],
              ]}
              onWahl={(v) => s.setzen(["layout_richtung"], v)}
            />
          </StilZeile>
          <StilZeile label={tc("verteilen")} pfad={["layout_verteilen"]} s={s}>
            <Auswahl
              wert={
                (verteilen ?? null) as
                  "start" | "mitte" | "ende" | "zwischen" | "umgeben" | null
              }
              leer={tc("automatisch")}
              laeuft={s.laeuft}
              optionen={[
                ["start", tc("anfang")],
                ["mitte", tc("mitte")],
                ["ende", tc("ende")],
                ["zwischen", tc("zwischen")],
                ["umgeben", tc("umgeben")],
              ]}
              onWahl={(v) => s.setzen(["layout_verteilen"], v)}
            />
          </StilZeile>
          <StilZeile
            label={tc("ausrichten")}
            pfad={["layout_ausrichten"]}
            s={s}
          >
            <Segment
              wert={
                (ausrichten ?? null) as
                  "start" | "mitte" | "ende" | "strecken" | null
              }
              laeuft={s.laeuft}
              optionen={[
                ["start", "ph:align-top-simple", tc("anfang")],
                ["mitte", "ph:align-center-vertical-simple", tc("mitte")],
                ["ende", "ph:align-bottom-simple", tc("ende")],
                ["strecken", "ph:arrows-out-line-vertical", tc("strecken")],
              ]}
              onWahl={(v) => s.setzen(["layout_ausrichten"], v)}
            />
          </StilZeile>
          <StilZeile label={tc("umbruch")} pfad={["layout_umbruch"]} s={s}>
            <JaNein
              wert={umbruch ?? null}
              laeuft={s.laeuft}
              onWahl={(v) => s.setzen(["layout_umbruch"], v)}
            />
          </StilZeile>
          <StilZeile label={tc("abstand")} pfad={["layout_abstand"]} s={s}>
            {/* Framer: Zahl + Schieber 0–100 (Vollerfassung §4.5); unser Deckel
            ist 160, wie das Schema. */}
            <Schieber
              wert={abstand ?? null}
              min={0}
              max={160}
              standard={0}
              einheit="px"
              schritt={1}
              laeuft={s.laeuft}
              onWert={(v) => s.setzen(["layout_abstand"], v)}
            />
          </StilZeile>
        </>
      ) : null}
      <AbstandZeile s={s} praefix="padding" label={t("layout.innen")} />
      <AbstandZeile s={s} praefix="margin" label={t("layout.aussen")} />
      {container?.onSpalteHinzu ? (
        <StilZeile label={t("layout.spalten")} s={s}>
          <span className="min-w-0 flex-1 text-[0.8125rem]">
            {tc("spaltenAnzahl", { anzahl: container.kinderZahl })}
          </span>
          <button
            type="button"
            disabled={s.laeuft || container.kinderZahl >= 6}
            onClick={container.onSpalteHinzu}
            aria-label={tc("spalteHinzufuegen")}
            title={tc("spalteHinzufuegen")}
            className="flex size-7 shrink-0 items-center justify-center rounded-(--radius) bg-secondary text-muted-foreground transition hover:text-foreground disabled:opacity-40"
          >
            <Icon icon="ph:plus" className="size-4" />
          </button>
        </StilZeile>
      ) : null}
    </PlusKarte>
  );
}

// --- Position ----------------------------------------------------------------

function PositionKarte({ s }: { s: Stift }) {
  const t = useTranslations("website.stil");
  const gesetzt = gesetzteSchluessel(s, "position");
  const { offene, oeffne } = useOffene([...gesetzt, "typ"]);
  const typ = s.lesen(["position", "typ"]) as string | undefined;
  const pins = typ !== undefined && typ !== "relativ";

  return (
    <PlusKarte
      titel={t("position.titel")}
      geaendert={gesetzt.length > 0}
      offene={offene}
      onOeffnen={oeffne}
      eintraege={[
        {
          key: "typ",
          label: t("position.typ"),
          gesetzt: gesetzt.includes("typ"),
        },
        {
          key: "ebene",
          label: t("position.ebene"),
          gesetzt: gesetzt.includes("ebene"),
        },
      ]}
    >
      <StilZeile label={t("position.typ")} pfad={["position", "typ"]} s={s}>
        <Auswahl
          wert={
            (typ ?? null) as
              "relativ" | "absolut" | "fixiert" | "klebend" | null
          }
          leer={t("automatisch")}
          laeuft={s.laeuft}
          optionen={[
            ["relativ", t("position.relativ")],
            ["absolut", t("position.absolut")],
            ["fixiert", t("position.fixiert")],
            ["klebend", t("position.klebend")],
          ]}
          onWahl={(v) => s.setzen(["position", "typ"], v)}
        />
      </StilZeile>
      {pins ? (
        // Framers Pin-Widget (Vollerfassung §4.3): vier Kanten um ein Quadrat,
        // gesetzte Kante blau. Ein Klick setzt die Kante auf 0 px bzw. löscht
        // sie — der Zahlenwert steht in der Zeile darunter.
        <StilZeile label={t("position.kanten")} s={s}>
          <PinFeld s={s} />
          <span className="min-w-0 flex-1 text-[0.6875rem] leading-snug text-muted-foreground">
            {t("position.kantenHinweis")}
          </span>
        </StilZeile>
      ) : null}
      {pins
        ? (["oben", "rechts", "unten", "links"] as const).map((seite) => (
            <StilZeile
              key={seite}
              label={t(`position.${seite}`)}
              pfad={["position", seite]}
              s={s}
            >
              <MassFeld
                wert={s.lesen(["position", seite])}
                negativ
                laeuft={s.laeuft}
                onWert={(v) => s.setzen(["position", seite], v)}
              />
            </StilZeile>
          ))
        : null}
      {offene.has("ebene") ? (
        <StilZeile
          label={t("position.ebene")}
          pfad={["position", "ebene"]}
          s={s}
        >
          <Zahlfeld
            wert={
              (s.lesen(["position", "ebene"]) as number | undefined) ?? null
            }
            min={-10}
            max={100}
            laeuft={s.laeuft}
            onWert={(v) => s.setzen(["position", "ebene"], v)}
          />
        </StilZeile>
      ) : null}
    </PlusKarte>
  );
}

const PIN_LAGE: Record<"oben" | "rechts" | "unten" | "links", string> = {
  oben: "left-1/2 top-0 h-1 w-3 -translate-x-1/2",
  rechts: "right-0 top-1/2 h-3 w-1 -translate-y-1/2",
  unten: "bottom-0 left-1/2 h-1 w-3 -translate-x-1/2",
  links: "left-0 top-1/2 h-3 w-1 -translate-y-1/2",
};

function PinFeld({ s }: { s: Stift }) {
  const t = useTranslations("website.stil");
  return (
    <span className="relative block size-9 shrink-0 rounded-md bg-secondary">
      <span
        aria-hidden
        className="absolute inset-[9px] rounded-[3px] border border-border"
      />
      {(["oben", "rechts", "unten", "links"] as const).map((seite) => {
        const gesetzt = s.lesen(["position", seite]) !== undefined;
        return (
          <button
            key={seite}
            type="button"
            disabled={s.laeuft}
            aria-pressed={gesetzt}
            aria-label={t(`position.${seite}`)}
            title={t(`position.${seite}`)}
            onClick={() =>
              s.setzen(["position", seite], gesetzt ? null : "0px")
            }
            className={
              "absolute rounded-full transition " +
              PIN_LAGE[seite] +
              (gesetzt
                ? " bg-sky-500"
                : " bg-muted-foreground/40 hover:bg-muted-foreground")
            }
          />
        );
      })}
    </span>
  );
}

// --- Größe -------------------------------------------------------------------

const MODI: readonly MassModus[] = [
  "fest",
  "relativ",
  "viewport",
  "fuellen",
  "inhalt",
];
const MODUS_EINHEIT: Record<MassModus, string> = {
  fest: "px",
  relativ: "%",
  viewport: "vw",
  fuellen: "",
  inhalt: "",
};

/** Breite oder Höhe: Zahl links, Modus rechts — Framers Sizing-Zeile (§3.1).
 *  Bei „Füllen"/„Inhalt" hat die Zahl keinen Sinn; das Feld zeigt dann grau
 *  die gemessene Größe (§0.5). */
function MassZeile({
  s,
  achse,
  gemessen,
}: {
  s: Stift;
  achse: "breite" | "hoehe";
  gemessen: number | null;
}) {
  const t = useTranslations("website.stil");
  const pfad = ["groesse", achse] as const;
  const m = objekt(s.lesen(pfad)) as Mass | null;
  const modus = m?.modus ?? null;
  const braucht =
    modus === "fest" || modus === "relativ" || modus === "viewport";
  const einheit =
    modus === "viewport" && achse === "hoehe"
      ? "vh"
      : modus
        ? MODUS_EINHEIT[modus]
        : "";

  return (
    <StilZeile label={t(`groesse.${achse}`)} pfad={pfad} s={s}>
      <div className="flex min-w-0 flex-[3]">
        <Zahlfeld
          wert={braucht ? (m?.wert ?? null) : null}
          min={0}
          max={modus === "fest" ? 10000 : 1000}
          einheit={einheit || undefined}
          platzhalter={
            gemessen !== null ? String(Math.round(gemessen)) : undefined
          }
          // IMMER bedienbar. Vorher war das Feld gesperrt, solange kein Modus
          // gesetzt war — und weil ohne Größe auch kein Modus dasteht, ließ
          // sich die Breite eines Elements gar nicht eintippen: man musste
          // erst „Fest" wählen und dann die Zahl. Bei Framer (gemessen
          // 06.09.2026) tippt man die Zahl, und daraus WIRD „Fixed".
          laeuft={s.laeuft}
          onWert={(v) => {
            if (v === null) {
              s.setzen(pfad, null);
              return;
            }
            // Eine Zahl ohne Modus heißt „fest" — das ist die einzige
            // Bedeutung, die eine nackte Pixelzahl haben kann. `fuellen` und
            // `inhalt` tragen keine Zahl, also gilt dort dasselbe.
            const zielModus = braucht ? modus! : "fest";
            s.setzen(pfad, { modus: zielModus, wert: v });
          }}
        />
      </div>
      <div className="flex min-w-0 flex-[2]">
        <Auswahl
          wert={modus}
          leer={t("automatisch")}
          laeuft={s.laeuft}
          optionen={MODI.map((mo) => [mo, t(`groesse.modus.${mo}`)] as const)}
          onWahl={(mo) => {
            if (mo === null) {
              s.setzen(pfad, null);
              return;
            }
            if (mo === "fuellen" || mo === "inhalt") {
              s.setzen(pfad, { modus: mo });
              return;
            }
            // Ein Zahl-Modus braucht einen Wert: den bisherigen behalten,
            // sonst den gemessenen nehmen — der ist keine Erfindung, er
            // steht so in der Vorschau. Ohne Messung bleibt die Wahl offen.
            const wert =
              m?.wert ??
              (mo === "fest" && gemessen !== null
                ? Math.round(gemessen)
                : null);
            if (wert === null) return;
            s.setzen(pfad, { modus: mo, wert });
          }}
        />
      </div>
    </StilZeile>
  );
}

/** Framers „Grow" am Text (Vollerfassung §4.4): drei Knöpfe, die Breite UND
 *  Höhe in einem Vorgang setzen. Waagerecht = beides Inhalt (eine Zeile),
 *  senkrecht = Höhe Inhalt bei gehaltener Breite, fest = beide Maße auf die
 *  gemessenen Pixel — ohne Messung gibt es „fest" nicht (kein erfundener Wert). */
function wachsenStufe(
  breite: Mass | undefined,
  hoehe: Mass | undefined,
): "waagerecht" | "senkrecht" | "fest" | null {
  if (breite?.modus === "inhalt" && hoehe?.modus === "inhalt")
    return "waagerecht";
  if (hoehe?.modus === "inhalt") return "senkrecht";
  if (breite?.modus === "fest" && hoehe?.modus === "fest") return "fest";
  return null;
}

function GroesseKarte({
  s,
  gemessen,
  container,
  wachsen = false,
  imRaster = false,
}: {
  s: Stift;
  gemessen: Gemessen | null;
  container?: ContainerZusatz;
  /** Die „Wachsen"-Zeile — nur an Bausteinen, Framer zeigt sie am Text. */
  wachsen?: boolean;
  /** Liegt das Element in einem RASTER? Dann stehen — wie im Vorbild — zuerst
   *  die belegten Spalten und Zeilen, und erst darunter Breite und Höhe
   *  (Messung 06.09.2026: eine Karte im Raster zeigt „Columns Span 1 · Rows
   *  Span 1" über der Größe). Im Stapel gibt es beides nicht. */
  imRaster?: boolean;
}) {
  const t = useTranslations("website.stil");
  const breiteMass = s.lesen(["groesse", "breite"]) as Mass | undefined;
  const hoeheMass = s.lesen(["groesse", "hoehe"]) as Mass | undefined;
  const stufe = wachsenStufe(breiteMass, hoeheMass);
  const gesetzt = gesetzteSchluessel(s, "groesse");
  const { offene, oeffne } = useOffene([...gesetzt, "breite", "hoehe"]);
  const [zusatzMenue, setZusatzMenue] = useState(false);
  const verhaeltnis = s.lesen(["groesse", "seitenverhaeltnis"]) as
    string | undefined;

  const grenzen = [
    "min_breite",
    "max_breite",
    "min_hoehe",
    "max_hoehe",
  ] as const;

  return (
    <PlusKarte
      titel={t("groesse.titel")}
      geaendert={gesetzt.length > 0}
      offene={offene}
      onOeffnen={oeffne}
      eintraege={[
        ...grenzen.map((k) => ({
          key: k,
          label: t(`groesse.${k}`),
          gesetzt: gesetzt.includes(k),
        })),
        {
          key: "seitenverhaeltnis",
          label: t("groesse.seitenverhaeltnis"),
          gesetzt: gesetzt.includes("seitenverhaeltnis"),
        },
      ]}
    >
      {container && container.span !== null ? (
        // Die Spaltenbreite in Zwölfteln — nur, wenn sich zwei Spalten den
        // Abschnitt teilen; bei einer wirkt `span` nicht und stünde als Lüge da.
        <StilZeile label={t("groesse.spalte")} s={s}>
          <Auswahl
            wert={String(container.span)}
            laeuft={s.laeuft}
            optionen={SPALTEN_BREITEN.map(
              (b) => [String(b.span), `${b.label} · ${b.span}/12`] as const,
            )}
            onWahl={(v) => v && container.onSpan(Number(v))}
          />
        </StilZeile>
      ) : null}
      {imRaster ? (
        <>
          <StilZeile
            label={t("groesse.spanX")}
            pfad={["raster_span_x"]}
            s={s}
          >
            <Auswahl
              wert={
                (s.lesen(["raster_span_x"]) as number | undefined)?.toString() ??
                null
              }
              leer={t("groesse.spanEins")}
              laeuft={s.laeuft}
              optionen={Array.from({ length: 12 }, (_, i) => [
                String(i + 1),
                t("groesse.spanWert", { n: i + 1 }),
              ])}
              onWahl={(v) =>
                s.setzen(["raster_span_x"], v === null ? null : Number(v))
              }
            />
          </StilZeile>
          <StilZeile
            label={t("groesse.spanY")}
            pfad={["raster_span_y"]}
            s={s}
          >
            <Auswahl
              wert={
                (s.lesen(["raster_span_y"]) as number | undefined)?.toString() ??
                null
              }
              leer={t("groesse.spanEins")}
              laeuft={s.laeuft}
              optionen={Array.from({ length: 12 }, (_, i) => [
                String(i + 1),
                t("groesse.spanWert", { n: i + 1 }),
              ])}
              onWahl={(v) =>
                s.setzen(["raster_span_y"], v === null ? null : Number(v))
              }
            />
          </StilZeile>
        </>
      ) : null}
      <MassZeile s={s} achse="breite" gemessen={gemessen?.breite ?? null} />
      <MassZeile s={s} achse="hoehe" gemessen={gemessen?.hoehe ?? null} />
      {wachsen ? (
        <StilZeile label={t("groesse.wachsen")} s={s}>
          <Segment
            wert={stufe}
            laeuft={s.laeuft}
            optionen={[
              [
                "waagerecht",
                "ph:arrows-out-line-horizontal",
                t("groesse.wachsenWert.waagerecht"),
              ],
              [
                "senkrecht",
                "ph:arrows-out-line-vertical",
                t("groesse.wachsenWert.senkrecht"),
              ],
              ["fest", "ph:frame-corners", t("groesse.wachsenWert.fest")],
            ]}
            onWahl={(v) => {
              if (v === null || v === stufe) {
                s.setzeAlle([
                  [["groesse", "breite"], null],
                  [["groesse", "hoehe"], null],
                ]);
                return;
              }
              if (v === "waagerecht") {
                s.setzeAlle([
                  [["groesse", "breite"], { modus: "inhalt" }],
                  [["groesse", "hoehe"], { modus: "inhalt" }],
                ]);
              } else if (v === "senkrecht") {
                s.setzeAlle([
                  [
                    ["groesse", "breite"],
                    breiteMass?.modus === "inhalt"
                      ? null
                      : (breiteMass ?? null),
                  ],
                  [["groesse", "hoehe"], { modus: "inhalt" }],
                ]);
              } else if (
                gemessen &&
                gemessen.breite > 0 &&
                gemessen.hoehe > 0
              ) {
                s.setzeAlle([
                  [
                    ["groesse", "breite"],
                    { modus: "fest", wert: Math.round(gemessen.breite) },
                  ],
                  [
                    ["groesse", "hoehe"],
                    { modus: "fest", wert: Math.round(gemessen.hoehe) },
                  ],
                ]);
              }
            }}
          />
        </StilZeile>
      ) : null}
      {grenzen
        .filter((k) => offene.has(k))
        .map((k) => (
          <StilZeile
            key={k}
            label={t(`groesse.${k}`)}
            pfad={["groesse", k]}
            s={s}
          >
            <MassFeld
              wert={s.lesen(["groesse", k])}
              laeuft={s.laeuft}
              onWert={(v) => s.setzen(["groesse", k], v)}
            />
          </StilZeile>
        ))}
      {offene.has("seitenverhaeltnis") ? (
        <StilZeile
          label={t("groesse.seitenverhaeltnis")}
          pfad={["groesse", "seitenverhaeltnis"]}
          s={s}
        >
          {/* Die KETTE (Lock Aspect Ratio, §3.4): rastet das gemessene
              Verhältnis ein. Ohne Messung ist sie aus — ein Verhältnis aus
              dem Nichts wäre erfunden. Daneben das Feld für „16/9". */}
          <button
            type="button"
            disabled={s.laeuft || gemessen === null || gemessen.hoehe === 0}
            aria-pressed={verhaeltnis !== undefined}
            title={t("groesse.ketteHinweis")}
            onClick={() => {
              if (verhaeltnis !== undefined) {
                s.setzen(["groesse", "seitenverhaeltnis"], null);
                return;
              }
              if (!gemessen || gemessen.hoehe === 0) return;
              s.setzen(
                ["groesse", "seitenverhaeltnis"],
                `${Math.round(gemessen.breite)} / ${Math.round(gemessen.hoehe)}`,
              );
            }}
            className={
              "flex size-7 shrink-0 items-center justify-center rounded-(--radius) transition disabled:opacity-40 " +
              (verhaeltnis !== undefined
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:bg-secondary/60")
            }
          >
            <Icon
              icon={
                verhaeltnis !== undefined
                  ? "ph:link-simple"
                  : "ph:link-simple-break"
              }
              className="size-4"
            />
          </button>
          <Textfeld
            wert={verhaeltnis ?? null}
            platzhalter="16 / 9"
            muster={VERHAELTNIS_RE}
            laeuft={s.laeuft}
            onWert={(v) => s.setzen(["groesse", "seitenverhaeltnis"], v)}
          />
        </StilZeile>
      ) : null}
      {/* Framers „↔ Add…"-Zeile: dieselben Einträge wie das „+" im Kopf, nur
          dort, wo der Blick nach den Zeilen ankommt. */}
      {[...grenzen, "seitenverhaeltnis" as const].some(
        (k) => !offene.has(k),
      ) ? (
        <div className="relative pl-[6rem]">
          <button
            type="button"
            disabled={s.laeuft}
            onClick={() => setZusatzMenue((m) => !m)}
            aria-haspopup="menu"
            aria-expanded={zusatzMenue}
            className="flex h-8 w-full items-center gap-2 rounded-(--radius) bg-secondary px-2 text-left text-[0.8125rem] text-muted-foreground transition hover:text-foreground disabled:opacity-40"
          >
            <Icon icon="ph:arrows-out-line-horizontal" className="size-4" />
            {t("hinzufuegenChip")}
          </button>
          {zusatzMenue ? (
            <ul
              role="menu"
              className="absolute left-[6rem] right-0 top-9 z-20 rounded-(--radius) border border-border bg-popover p-1 shadow-lg"
            >
              {[...grenzen, "seitenverhaeltnis" as const]
                .filter((k) => !offene.has(k))
                .map((k) => (
                  <li key={k}>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        oeffne(k);
                        setZusatzMenue(false);
                      }}
                      className="flex w-full rounded px-2 py-1.5 text-left text-[0.8125rem] transition hover:bg-secondary"
                    >
                      {t(`groesse.${k}`)}
                    </button>
                  </li>
                ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </PlusKarte>
  );
}

// --- Stil --------------------------------------------------------------------

function RadiusFeld({ s }: { s: Stift }) {
  const t = useTranslations("website.stil");
  const r = (objekt(s.lesen(["stil", "radius"])) ?? {}) as Radius;
  const jeEcke =
    r.oben_links != null ||
    r.oben_rechts != null ||
    r.unten_rechts != null ||
    r.unten_links != null;
  const [proEcke, setProEcke] = useState(jeEcke);
  const ecken = [
    "oben_links",
    "oben_rechts",
    "unten_links",
    "unten_rechts",
  ] as const;

  return (
    <>
      <StilZeile label={t("stil.radius")} pfad={["stil", "radius"]} s={s}>
        {!proEcke ? (
          <Zahlfeld
            wert={r.alle ?? null}
            min={0}
            max={500}
            einheit="px"
            laeuft={s.laeuft}
            onWert={(v) =>
              s.setzen(["stil", "radius"], v === null ? null : { alle: v })
            }
          />
        ) : (
          <span className="min-w-0 flex-1 text-[0.75rem] text-muted-foreground">
            {t("stil.radiusJeEcke")}
          </span>
        )}
        <button
          type="button"
          disabled={s.laeuft}
          aria-pressed={proEcke}
          title={t("stil.radiusJeEcke")}
          onClick={() => {
            const neu = !proEcke;
            setProEcke(neu);
            // Umschalten ÜBERTRÄGT den Wert statt ihn zu verlieren: ein
            // Radius 12 wird zu vier Ecken 12, vier gleiche Ecken zu einem.
            if (neu && r.alle != null) {
              s.setzen(["stil", "radius"], {
                oben_links: r.alle,
                oben_rechts: r.alle,
                unten_rechts: r.alle,
                unten_links: r.alle,
              });
            } else if (!neu && jeEcke) {
              const werte = ecken.map((e) => r[e] ?? 0);
              const gleich = werte.every((w) => w === werte[0]);
              s.setzen(["stil", "radius"], gleich ? { alle: werte[0] } : null);
            }
          }}
          className={
            "flex size-7 shrink-0 items-center justify-center rounded-(--radius) transition disabled:opacity-40 " +
            (proEcke
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:bg-secondary/60")
          }
        >
          <Icon icon="ph:corners-out" className="size-4" />
        </button>
      </StilZeile>
      {proEcke ? (
        <div className="grid grid-cols-2 gap-1 pl-[6rem]">
          {ecken.map((e) => (
            <div key={e} className="flex items-center gap-1">
              <Icon
                icon={
                  e === "oben_links"
                    ? "ph:arrow-up-left"
                    : e === "oben_rechts"
                      ? "ph:arrow-up-right"
                      : e === "unten_links"
                        ? "ph:arrow-down-left"
                        : "ph:arrow-down-right"
                }
                className="size-3.5 shrink-0 text-muted-foreground"
              />
              <Zahlfeld
                wert={r[e] ?? null}
                min={0}
                max={500}
                laeuft={s.laeuft}
                onWert={(v) => {
                  const { alle: _alle, ...rest } = r;
                  void _alle;
                  const neu: Radius = { ...rest, [e]: v };
                  const leer = ecken.every((k) => neu[k] == null);
                  s.setzen(["stil", "radius"], leer ? null : neu);
                }}
              />
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}

/** Grenze (Border): Breite + Farbe sind Pflicht — der Entwurf lebt lokal, bis
 *  beides steht, und wird erst dann geschrieben. */
function GrenzeFeld({ s }: { s: Stift }) {
  const t = useTranslations("website.stil");
  const g = objekt(s.lesen(["stil", "grenze"])) as Grenze | null;
  const [entwurf, setEntwurf] = useState<Partial<Grenze>>({});
  const stand: Partial<Grenze> = g ?? entwurf;

  function schreibe(neu: Partial<Grenze>) {
    const z = { ...stand, ...neu };
    if (z.breite != null && z.farbe) {
      setEntwurf({});
      s.setzen(["stil", "grenze"], z);
    } else {
      setEntwurf(z);
      if (g) s.setzen(["stil", "grenze"], null);
    }
  }
  const seiten = ["oben", "rechts", "unten", "links"] as const;
  const aktive = stand.seiten ?? [];

  return (
    <>
      <StilZeile label={t("stil.grenze")} pfad={["stil", "grenze"]} s={s}>
        <div className="flex min-w-0 flex-[2]">
          <Zahlfeld
            wert={stand.breite ?? null}
            min={0}
            max={40}
            einheit="px"
            laeuft={s.laeuft}
            onWert={(v) =>
              v === null
                ? s.setzen(["stil", "grenze"], null)
                : schreibe({ breite: v })
            }
          />
        </div>
        <div className="flex min-w-0 flex-[3]">
          <FarbFeld
            wert={stand.farbe ?? null}
            laeuft={s.laeuft}
            onWert={(f) =>
              f === null
                ? s.setzen(["stil", "grenze"], null)
                : schreibe({ farbe: f })
            }
          />
        </div>
      </StilZeile>
      <div className="flex items-center gap-1.5 pl-[6rem]">
        <Auswahl
          wert={stand.art ?? "solid"}
          laeuft={s.laeuft}
          optionen={[
            ["solid", t("stil.grenzeArt.solid")],
            ["dashed", t("stil.grenzeArt.dashed")],
            ["dotted", t("stil.grenzeArt.dotted")],
            ["double", t("stil.grenzeArt.double")],
          ]}
          onWahl={(a) => schreibe({ art: a ?? "solid" })}
        />
        {/* Seiten: keine gewählt = alle. Framer führt es genauso („per
            side" als Aufklapp). */}
        <div className="flex gap-0.5 rounded-(--radius) bg-secondary p-0.5">
          {seiten.map((seite) => (
            <button
              key={seite}
              type="button"
              disabled={s.laeuft}
              aria-pressed={aktive.includes(seite)}
              title={t(`position.${seite}`)}
              onClick={() => {
                const neu = aktive.includes(seite)
                  ? aktive.filter((x) => x !== seite)
                  : [...aktive, seite];
                schreibe({
                  seiten: neu.length === 0 || neu.length === 4 ? null : neu,
                });
              }}
              className={
                "flex size-6 items-center justify-center rounded-[calc(var(--radius)-0.125rem)] transition " +
                (aktive.includes(seite)
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground")
              }
            >
              <Icon
                icon={
                  seite === "oben"
                    ? "ph:align-top-simple"
                    : seite === "unten"
                      ? "ph:align-bottom-simple"
                      : seite === "links"
                        ? "ph:align-left-simple"
                        : "ph:align-right-simple"
                }
                className="size-3.5"
              />
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

/** Schatten: gestapelt bis sechs (§9.9). Ein neuer Schatten kommt mit dem
 *  Wert, den der Klick auf „hinzufügen" verlangt — sichtbar und sofort
 *  änderbar; ohne Farbe wäre er kein Schatten und würde abgewiesen. */
function SchattenFeld({ s }: { s: Stift }) {
  const t = useTranslations("website.stil");
  const roh = s.lesen(["stil", "schatten"]);
  const liste: Schatten[] = Array.isArray(roh) ? (roh as Schatten[]) : [];
  const [aktiv, setAktiv] = useState<number | null>(null);

  function schreibe(neu: Schatten[]) {
    s.setzen(["stil", "schatten"], neu.length === 0 ? null : neu);
  }
  const a = aktiv !== null ? liste[aktiv] : undefined;

  return (
    <>
      <StilZeile label={t("stil.schatten")} pfad={["stil", "schatten"]} s={s}>
        <div className="flex min-w-0 flex-1 flex-wrap gap-1">
          {liste.map((sch, i) => (
            <Chip
              key={i}
              laeuft={s.laeuft}
              aktiv={aktiv === i}
              onClick={() => setAktiv(aktiv === i ? null : i)}
              onEntfernen={() => {
                setAktiv(null);
                schreibe(liste.filter((_, j) => j !== i));
              }}
            >
              {sch.innen ? t("stil.schattenInnen") : t("stil.schattenAussen")} ·{" "}
              {sch.x ?? 0}/{sch.y ?? 0}/{sch.weich ?? 0}
            </Chip>
          ))}
          {liste.length < 6 ? (
            <button
              type="button"
              disabled={s.laeuft}
              onClick={() => {
                const neu = [
                  ...liste,
                  {
                    x: 0,
                    y: 4,
                    weich: 16,
                    ausbreitung: 0,
                    farbe: "#00000033",
                    innen: false,
                  },
                ];
                schreibe(neu);
                setAktiv(neu.length - 1);
              }}
              className="flex items-center gap-1 rounded-(--radius) bg-secondary px-2 py-1.5 text-[0.75rem] transition hover:bg-secondary/70 disabled:opacity-50"
            >
              <Icon icon="ph:plus" className="size-3" />
              {t("stil.schattenNeu")}
            </button>
          ) : null}
        </div>
      </StilZeile>
      {a && aktiv !== null ? (
        <div className="flex flex-col gap-1 rounded-(--radius) border border-border p-2">
          {(
            [
              ["x", -200, 200],
              ["y", -200, 200],
              ["weich", 0, 200],
              ["ausbreitung", -100, 100],
            ] as const
          ).map(([k, min, max]) => (
            <div key={k} className="flex items-center gap-2">
              <span className="w-[4.5rem] shrink-0 text-[0.75rem] text-muted-foreground">
                {t(`stil.schattenFeld.${k}`)}
              </span>
              <Schieber
                wert={a[k] ?? 0}
                min={min}
                max={max}
                standard={0}
                laeuft={s.laeuft}
                onWert={(v) =>
                  schreibe(
                    liste.map((x, j) =>
                      j === aktiv ? { ...x, [k]: v ?? 0 } : x,
                    ),
                  )
                }
              />
            </div>
          ))}
          <div className="flex items-center gap-2">
            <span className="w-[4.5rem] shrink-0 text-[0.75rem] text-muted-foreground">
              {t("stil.schattenFeld.farbe")}
            </span>
            <FarbFeld
              wert={a.farbe}
              laeuft={s.laeuft}
              onWert={(f) => {
                if (!f) return;
                schreibe(
                  liste.map((x, j) => (j === aktiv ? { ...x, farbe: f } : x)),
                );
              }}
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="w-[4.5rem] shrink-0 text-[0.75rem] text-muted-foreground">
              {t("stil.schattenFeld.lage")}
            </span>
            <Auswahl
              wert={a.innen ? "innen" : "aussen"}
              laeuft={s.laeuft}
              optionen={[
                ["aussen", t("stil.schattenAussen")],
                ["innen", t("stil.schattenInnen")],
              ]}
              onWahl={(v) =>
                schreibe(
                  liste.map((x, j) =>
                    j === aktiv ? { ...x, innen: v === "innen" } : x,
                  ),
                )
              }
            />
          </div>
        </div>
      ) : null}
    </>
  );
}

/** „Hinzufügen …"-Chip — Framers leere Fill-/Border-Zeile. */
function HinzuChip({
  onClick,
  laeuft,
}: {
  onClick: () => void;
  laeuft: boolean;
}) {
  const t = useTranslations("website.stil");
  return (
    <button
      type="button"
      disabled={laeuft}
      onClick={onClick}
      className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-(--radius) bg-secondary px-2 text-left text-[0.8125rem] text-muted-foreground transition hover:text-foreground disabled:opacity-40"
    >
      <Icon icon="ph:plus" className="size-3.5" />
      {t("hinzufuegenChip")}
    </button>
  );
}

function StilKarte({ s }: { s: Stift }) {
  const t = useTranslations("website.stil");
  const tv = useTranslations("website.canvas.geraet");
  const gesetzt = gesetzteSchluessel(s, "stil");
  const opazitaet = s.lesen(["stil", "opazitaet"]) as number | undefined;
  const fuellung = s.lesen(["stil", "fuellung"]);
  const grenze = s.lesen(["stil", "grenze"]);
  const [fuellungOffen, setFuellungOffen] = useState(false);
  const [grenzeOffen, setGrenzeOffen] = useState(false);
  // SICHTBAR je Breakpoint = `hidden_on` (die Geräteliste des Renderers).
  // Framers „Visible Yes/No" auf einem Breakpoint ist genau dieses Feld.
  const versteckt = versteckteGeraete(s.settings);
  const sichtbar = !versteckt.includes(s.geraet);
  // Framers Styles-„+" (Vollerfassung §7): Blending · Draggable · Filters ·
  // Mask · Overflow X/Y · Pointer Events · Selection · Tap Color · User Select
  // · Z Index. Z Index steht bei uns in „Position" (es IST eine Position), und
  // „Draggable" ist der Zieh-EFFEKT — derselbe Wert, von beiden Köpfen
  // erreichbar, statt zweier Schalter, die sich widersprechen (Wurzel 2).
  const zusatz = [
    "mischmodus",
    "filter",
    "maske",
    "auswahl",
    "ueberlauf_x",
    "ueberlauf_y",
    "zeiger_ereignisse",
    "text_auswahl",
    "tippfarbe",
  ] as const;
  // „auswahl" ist EIN Eintrag über zwei Feldern (Vorder- und Hintergrundfarbe);
  // im Vorbild heißt er ebenfalls nur „Selection".
  const auswahlGesetzt =
    gesetzt.includes("auswahl_farbe") || gesetzt.includes("auswahl_hintergrund");
  const { offene, oeffne } = useOffene([
    ...gesetzt.filter((k) => (zusatz as readonly string[]).includes(k)),
    ...(auswahlGesetzt ? ["auswahl"] : []),
  ]);
  const filterFelder = [
    ["weichzeichnen", 0, 100, "px", 0],
    ["helligkeit", 0, 200, "%", 100],
    ["kontrast", 0, 200, "%", 100],
    ["saettigung", 0, 200, "%", 100],
    ["graustufen", 0, 100, "%", 0],
  ] as const;

  return (
    <PlusKarte
      titel={t("stil.titel")}
      geaendert={gesetzt.length > 0 || versteckt.length > 0}
      offene={offene}
      onOeffnen={oeffne}
      eintraege={zusatz.map((k) => ({
        key: k,
        label: t(`stil.${k}`),
        gesetzt: k === "auswahl" ? auswahlGesetzt : gesetzt.includes(k),
      }))}
    >
      <StilZeile label={t("stil.opazitaet")} pfad={["stil", "opazitaet"]} s={s}>
        <Schieber
          wert={opazitaet != null ? Math.round(opazitaet * 100) : null}
          min={0}
          max={100}
          standard={100}
          einheit="%"
          laeuft={s.laeuft}
          onWert={(v) =>
            s.setzen(["stil", "opazitaet"], v === null ? null : v / 100)
          }
        />
      </StilZeile>
      <StilZeile label={t("stil.sichtbar")} s={s}>
        <JaNein
          wert={sichtbar}
          laeuft={s.laeuft}
          onWahl={(v) => {
            const soll = v !== false;
            if (soll === sichtbar) return;
            s.setzen(
              [],
              mitVersteckt(s.settings, umgeschaltet(versteckt, s.geraet)),
            );
          }}
        />
        {!sichtbar ? (
          <span
            title={t("stil.sichtbarHinweis", { geraet: tv(s.geraet) })}
            className="text-orange-500"
          >
            <Icon icon="ph:eye-slash" className="size-4" />
          </span>
        ) : null}
      </StilZeile>
      <StilZeile label={t("stil.fuellung")} pfad={["stil", "fuellung"]} s={s}>
        {fuellung === undefined && !fuellungOffen ? (
          <HinzuChip laeuft={s.laeuft} onClick={() => setFuellungOffen(true)} />
        ) : (
          <FuellungFeld
            wert={fuellung}
            laeuft={s.laeuft}
            onWert={(f) => {
              if (f === null) setFuellungOffen(false);
              s.setzen(["stil", "fuellung"], f);
            }}
          />
        )}
      </StilZeile>
      <StilZeile label={t("stil.ueberlauf")} pfad={["stil", "ueberlauf"]} s={s}>
        <Auswahl
          wert={
            (s.lesen(["stil", "ueberlauf"]) as
              | "sichtbar"
              | "verborgen"
              | "abschneiden"
              | "scrollen"
              | undefined) ?? null
          }
          leer={t("automatisch")}
          laeuft={s.laeuft}
          optionen={[
            ["sichtbar", t("stil.ueberlaufWert.sichtbar")],
            ["verborgen", t("stil.ueberlaufWert.verborgen")],
            ["abschneiden", t("stil.ueberlaufWert.abschneiden")],
            ["scrollen", t("stil.ueberlaufWert.scrollen")],
          ]}
          onWahl={(v) => s.setzen(["stil", "ueberlauf"], v)}
        />
      </StilZeile>
      <RadiusFeld s={s} />
      {grenze === undefined && !grenzeOffen ? (
        <StilZeile label={t("stil.grenze")} pfad={["stil", "grenze"]} s={s}>
          <HinzuChip laeuft={s.laeuft} onClick={() => setGrenzeOffen(true)} />
        </StilZeile>
      ) : (
        <GrenzeFeld s={s} />
      )}
      <SchattenFeld s={s} />
      {offene.has("mischmodus") ? (
        <StilZeile
          label={t("stil.mischmodus")}
          pfad={["stil", "mischmodus"]}
          s={s}
        >
          <Auswahl
            wert={
              (s.lesen(["stil", "mischmodus"]) as Mischmodus | undefined) ??
              null
            }
            leer={t("automatisch")}
            laeuft={s.laeuft}
            optionen={MISCHMODI.map(
              (m) => [m, t(`stil.mischmodusWert.${m}`)] as const,
            )}
            onWahl={(v) => s.setzen(["stil", "mischmodus"], v)}
          />
        </StilZeile>
      ) : null}
      {offene.has("filter")
        ? filterFelder.map(([k, min, max, einheit, standard]) => (
            <StilZeile
              key={k}
              label={t(`stil.filterWert.${k}`)}
              pfad={["stil", "filter", k]}
              s={s}
            >
              <Schieber
                wert={
                  (s.lesen(["stil", "filter", k]) as number | undefined) ?? null
                }
                min={min}
                max={max}
                standard={standard}
                einheit={einheit}
                laeuft={s.laeuft}
                onWert={(v) => s.setzen(["stil", "filter", k], v)}
              />
            </StilZeile>
          ))
        : null}
      {(["ueberlauf_x", "ueberlauf_y"] as const)
        .filter((k) => offene.has(k))
        .map((k) => (
          <StilZeile key={k} label={t(`stil.${k}`)} pfad={["stil", k]} s={s}>
            <Auswahl
              wert={
                (s.lesen(["stil", k]) as
                  | "sichtbar"
                  | "verborgen"
                  | "abschneiden"
                  | "scrollen"
                  | undefined) ?? null
              }
              leer={t("automatisch")}
              laeuft={s.laeuft}
              optionen={[
                ["sichtbar", t("stil.ueberlaufWert.sichtbar")],
                ["verborgen", t("stil.ueberlaufWert.verborgen")],
                ["abschneiden", t("stil.ueberlaufWert.abschneiden")],
                ["scrollen", t("stil.ueberlaufWert.scrollen")],
              ]}
              onWahl={(v) => s.setzen(["stil", k], v)}
            />
          </StilZeile>
        ))}
      {(["zeiger_ereignisse", "text_auswahl"] as const)
        .filter((k) => offene.has(k))
        .map((k) => (
          <StilZeile key={k} label={t(`stil.${k}`)} pfad={["stil", k]} s={s}>
            <JaNein
              wert={(s.lesen(["stil", k]) as boolean | undefined) ?? null}
              laeuft={s.laeuft}
              onWahl={(v) => s.setzen(["stil", k], v)}
            />
          </StilZeile>
        ))}
      {offene.has("maske") ? (
        // Framer „Mask": ein Verlauf, der das Element ausblendet. Vier Zeilen
        // statt eines Kurvenfelds — die Wirkung ist dieselbe, und ein Feld,
        // das man nicht auf einem Zahlenwert festhalten kann, wäre je Gerät
        // nicht überschreibbar.
        <>
          <StilZeile
            label={t("stil.maskeArt")}
            pfad={["stil", "maske"]}
            s={s}
            onEntfernen={() => s.setzen(["stil", "maske"], null)}
          >
            <Segment
              wert={
                (s.lesen(["stil", "maske", "art"]) as "linear" | "radial" | undefined) ??
                "linear"
              }
              laeuft={s.laeuft}
              optionen={[
                ["linear", "ph:gradient", t("stil.maskeWert.linear")],
                ["radial", "ph:circle-half", t("stil.maskeWert.radial")],
              ]}
              onWahl={(v) => s.setzen(["stil", "maske", "art"], v ?? "linear")}
            />
          </StilZeile>
          {(s.lesen(["stil", "maske", "art"]) ?? "linear") === "linear" ? (
            <StilZeile
              label={t("stil.maskeWinkel")}
              pfad={["stil", "maske", "winkel"]}
              s={s}
            >
              <Schieber
                wert={(s.lesen(["stil", "maske", "winkel"]) as number | undefined) ?? null}
                min={0}
                max={360}
                standard={180}
                einheit="°"
                laeuft={s.laeuft}
                onWert={(v) => s.setzen(["stil", "maske", "winkel"], v ?? 180)}
              />
            </StilZeile>
          ) : null}
          <StilZeile label={t("stil.maskeBereich")} s={s}>
            <Zahlfeld
              wert={(s.lesen(["stil", "maske", "start"]) as number | undefined) ?? null}
              min={0}
              max={100}
              einheit="%"
              platzhalter="0"
              laeuft={s.laeuft}
              onWert={(v) => s.setzen(["stil", "maske", "start"], v ?? 0)}
            />
            <Zahlfeld
              wert={(s.lesen(["stil", "maske", "ende"]) as number | undefined) ?? null}
              min={0}
              max={100}
              einheit="%"
              platzhalter="100"
              laeuft={s.laeuft}
              onWert={(v) => s.setzen(["stil", "maske", "ende"], v ?? 100)}
            />
          </StilZeile>
          <StilZeile
            label={t("stil.maskeUmkehren")}
            pfad={["stil", "maske", "umkehren"]}
            s={s}
          >
            <JaNein
              wert={(s.lesen(["stil", "maske", "umkehren"]) as boolean | undefined) ?? false}
              laeuft={s.laeuft}
              onWahl={(v) =>
                s.setzen(["stil", "maske", "umkehren"], v === true ? true : null)
              }
            />
          </StilZeile>
        </>
      ) : null}
      {offene.has("auswahl") ? (
        // Framer „Selection": die Farben, in denen markierter Text erscheint.
        <>
          <StilZeile
            label={t("stil.auswahl_farbe")}
            pfad={["stil", "auswahl_farbe"]}
            s={s}
          >
            <FarbFeld
              wert={s.lesen(["stil", "auswahl_farbe"]) ?? null}
              laeuft={s.laeuft}
              onWert={(f) => s.setzen(["stil", "auswahl_farbe"], f)}
            />
          </StilZeile>
          <StilZeile
            label={t("stil.auswahl_hintergrund")}
            pfad={["stil", "auswahl_hintergrund"]}
            s={s}
          >
            <FarbFeld
              wert={s.lesen(["stil", "auswahl_hintergrund"]) ?? null}
              laeuft={s.laeuft}
              onWert={(f) => s.setzen(["stil", "auswahl_hintergrund"], f)}
            />
          </StilZeile>
        </>
      ) : null}
      {offene.has("tippfarbe") ? (
        <StilZeile
          label={t("stil.tippfarbe")}
          pfad={["stil", "tippfarbe"]}
          s={s}
        >
          <FarbFeld
            wert={s.lesen(["stil", "tippfarbe"]) ?? null}
            laeuft={s.laeuft}
            onWert={(f) => s.setzen(["stil", "tippfarbe"], f)}
          />
        </StilZeile>
      ) : null}
    </PlusKarte>
  );
}

// --- Transform ---------------------------------------------------------------

function TransformKarte({ s }: { s: Stift }) {
  const t = useTranslations("website.stil");
  const gesetzt = gesetzteSchluessel(s, "transform");
  const { offene, oeffne } = useOffene(gesetzt);
  const zahlen = [
    ["rotation", -360, 360, "°", 1],
    ["rotation_x", -360, 360, "°", 1],
    ["rotation_y", -360, 360, "°", 1],
    ["skalierung", 0, 10, "×", 0.05],
    ["neigung_x", -89, 89, "°", 1],
    ["neigung_y", -89, 89, "°", 1],
    ["tiefe", -500, 500, "px", 10],
    ["perspektive", 0, 5000, "px", 10],
  ] as const;
  // Framers acht Einträge (Scale · Skew · Rotate · Depth · Perspective ·
  // Origin · Backface · Preserve 3D), bei uns je Achse als eigene Zeile.
  const alle = [
    "skalierung",
    "neigung_x",
    "neigung_y",
    "rotation",
    "rotation_x",
    "rotation_y",
    "versatz_x",
    "versatz_y",
    "tiefe",
    "perspektive",
    "ursprung",
    "rueckseite",
    "raum_3d",
  ] as const;

  return (
    <PlusKarte
      titel={t("transform.titel")}
      geaendert={gesetzt.length > 0}
      offene={offene}
      onOeffnen={oeffne}
      eintraege={alle.map((k) => ({
        key: k,
        label: t(`transform.${k}`),
        gesetzt: gesetzt.includes(k),
      }))}
    >
      {zahlen
        .filter(([k]) => offene.has(k))
        .map(([k, min, max, einheit, schritt]) => (
          <StilZeile
            key={k}
            label={t(`transform.${k}`)}
            pfad={["transform", k]}
            s={s}
          >
            <Schieber
              wert={(s.lesen(["transform", k]) as number | undefined) ?? null}
              min={min}
              max={max}
              standard={k === "skalierung" ? 1 : 0}
              einheit={einheit}
              schritt={schritt}
              laeuft={s.laeuft}
              onWert={(v) => s.setzen(["transform", k], v)}
            />
          </StilZeile>
        ))}
      {(["versatz_x", "versatz_y"] as const)
        .filter((k) => offene.has(k))
        .map((k) => (
          <StilZeile
            key={k}
            label={t(`transform.${k}`)}
            pfad={["transform", k]}
            s={s}
          >
            <MassFeld
              wert={s.lesen(["transform", k])}
              negativ
              laeuft={s.laeuft}
              onWert={(v) => s.setzen(["transform", k], v)}
            />
          </StilZeile>
        ))}
      {offene.has("ursprung") ? (
        <StilZeile
          label={t("transform.ursprung")}
          pfad={["transform", "ursprung"]}
          s={s}
        >
          <Auswahl
            wert={
              (s.lesen(["transform", "ursprung"]) as Lage | undefined) ?? null
            }
            leer={t("automatisch")}
            laeuft={s.laeuft}
            optionen={LAGEN.map(
              (l) => [l, t(`lage.${l.replace(" ", "_")}`)] as const,
            )}
            onWahl={(v) => s.setzen(["transform", "ursprung"], v)}
          />
        </StilZeile>
      ) : null}
      {offene.has("rueckseite") ? (
        <StilZeile
          label={t("transform.rueckseite")}
          pfad={["transform", "rueckseite"]}
          s={s}
        >
          <Auswahl
            wert={
              (s.lesen(["transform", "rueckseite"]) as
                "sichtbar" | "verborgen" | undefined) ?? null
            }
            leer={t("automatisch")}
            laeuft={s.laeuft}
            optionen={[
              ["sichtbar", t("transform.rueckseiteWert.sichtbar")],
              ["verborgen", t("transform.rueckseiteWert.verborgen")],
            ]}
            onWahl={(v) => s.setzen(["transform", "rueckseite"], v)}
          />
        </StilZeile>
      ) : null}
      {offene.has("raum_3d") ? (
        <StilZeile
          label={t("transform.raum_3d")}
          pfad={["transform", "raum_3d"]}
          s={s}
        >
          <JaNein
            wert={
              (s.lesen(["transform", "raum_3d"]) as boolean | undefined) ?? null
            }
            laeuft={s.laeuft}
            onWahl={(v) => s.setzen(["transform", "raum_3d"], v)}
          />
        </StilZeile>
      ) : null}
    </PlusKarte>
  );
}

// --- Scroll-Abschnitt --------------------------------------------------------

function ScrollKarte({ s }: { s: Stift }) {
  const t = useTranslations("website.stil");
  const gesetzt = gesetzteSchluessel(s, "scroll");
  const { offene, oeffne } = useOffene(gesetzt);
  const anker = s.lesen(["scroll", "anker"]) as string | undefined;

  return (
    <PlusKarte
      titel={t("scroll.titel")}
      geaendert={gesetzt.length > 0}
      offene={offene}
      onOeffnen={oeffne}
      eintraege={[
        {
          key: "anker",
          label: t("scroll.anker"),
          gesetzt: gesetzt.includes("anker"),
        },
        {
          key: "versatz_y",
          label: t("scroll.versatz_y"),
          gesetzt: gesetzt.includes("versatz_y"),
        },
      ]}
    >
      {offene.has("anker") || offene.has("versatz_y") ? (
        <StilZeile
          label={t("scroll.anker")}
          pfad={["scroll", "anker"]}
          s={s}
          onEntfernen={() => s.setzen(["scroll"], null)}
        >
          <span className="shrink-0 text-[0.8125rem] text-muted-foreground">
            #
          </span>
          <Textfeld
            wert={anker ?? null}
            platzhalter="kontakt"
            maxLaenge={50}
            muster={ANKER_RE}
            laeuft={s.laeuft}
            onWert={(v) =>
              v === null
                ? s.setzen(["scroll"], null)
                : s.setzen(["scroll", "anker"], v)
            }
          />
        </StilZeile>
      ) : null}
      {offene.has("versatz_y") ? (
        <StilZeile
          label={t("scroll.versatz_y")}
          pfad={["scroll", "versatz_y"]}
          s={s}
        >
          <Zahlfeld
            wert={
              (s.lesen(["scroll", "versatz_y"]) as number | undefined) ?? null
            }
            min={-500}
            max={500}
            einheit="px"
            // Ohne Anker gibt es keinen Abschnitt, zu dem der Versatz gehört —
            // das Backend wiese ihn ab. Erst der Anker, dann der Versatz.
            laeuft={s.laeuft || !anker}
            onWert={(v) => s.setzen(["scroll", "versatz_y"], v)}
          />
        </StilZeile>
      ) : null}
      {offene.has("anker") && !anker ? (
        <p className="pl-[6rem] text-[0.6875rem] text-muted-foreground">
          {t("scroll.hinweis")}
        </p>
      ) : null}
    </PlusKarte>
  );
}

// --- Zugänglichkeit ----------------------------------------------------------

function ZugaenglichkeitKarte({ s }: { s: Stift }) {
  const t = useTranslations("website.stil");
  const gesetzt = gesetzteSchluessel(s, "a11y");
  const { offene, oeffne } = useOffene(gesetzt);
  const felder = [
    "tag",
    "label",
    "tab_index",
    "fuer_leser_verborgen",
    "nosnippet",
  ] as const;

  return (
    <PlusKarte
      titel={t("a11y.titel")}
      geaendert={gesetzt.length > 0}
      offene={offene}
      onOeffnen={oeffne}
      eintraege={felder.map((k) => ({
        key: k,
        label: t(`a11y.${k}`),
        gesetzt: gesetzt.includes(k),
      }))}
    >
      {offene.has("tag") ? (
        <StilZeile label={t("a11y.tag")} pfad={["a11y", "tag"]} s={s}>
          <Auswahl
            wert={(s.lesen(["a11y", "tag"]) as A11yTag | undefined) ?? null}
            leer={t("automatisch")}
            laeuft={s.laeuft}
            optionen={TAGS.map((tag) => [tag, `<${tag}>`] as const)}
            onWahl={(v) => s.setzen(["a11y", "tag"], v)}
          />
        </StilZeile>
      ) : null}
      {offene.has("label") ? (
        <StilZeile label={t("a11y.label")} pfad={["a11y", "label"]} s={s}>
          <Textfeld
            wert={(s.lesen(["a11y", "label"]) as string | undefined) ?? null}
            maxLaenge={120}
            laeuft={s.laeuft}
            onWert={(v) => s.setzen(["a11y", "label"], v)}
          />
        </StilZeile>
      ) : null}
      {offene.has("tab_index") ? (
        <StilZeile
          label={t("a11y.tab_index")}
          pfad={["a11y", "tab_index"]}
          s={s}
        >
          <Zahlfeld
            wert={
              (s.lesen(["a11y", "tab_index"]) as number | undefined) ?? null
            }
            min={-1}
            max={100}
            laeuft={s.laeuft}
            onWert={(v) => s.setzen(["a11y", "tab_index"], v)}
          />
        </StilZeile>
      ) : null}
      {offene.has("fuer_leser_verborgen") ? (
        <StilZeile
          label={t("a11y.fuer_leser_verborgen")}
          pfad={["a11y", "fuer_leser_verborgen"]}
          s={s}
        >
          <JaNein
            wert={
              (s.lesen(["a11y", "fuer_leser_verborgen"]) as
                boolean | undefined) ?? null
            }
            laeuft={s.laeuft}
            onWahl={(v) => s.setzen(["a11y", "fuer_leser_verborgen"], v)}
          />
        </StilZeile>
      ) : null}
      {offene.has("nosnippet") ? (
        // Framer „Google Bot": Skip (data-nosnippet) | Include.
        <StilZeile
          label={t("a11y.nosnippet")}
          pfad={["a11y", "nosnippet"]}
          s={s}
        >
          <Auswahl
            wert={s.lesen(["a11y", "nosnippet"]) === true ? "skip" : null}
            leer={t("a11y.nosnippetWert.einbeziehen")}
            laeuft={s.laeuft}
            optionen={[["skip", t("a11y.nosnippetWert.ueberspringen")]]}
            onWahl={(v) =>
              s.setzen(["a11y", "nosnippet"], v === "skip" ? true : null)
            }
          />
        </StilZeile>
      ) : null}
    </PlusKarte>
  );
}

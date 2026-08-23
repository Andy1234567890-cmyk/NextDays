"use client";

// Die Design-Einstellungen in der schmalen linken Leiste.
//
// Reihenfolge und Umfang folgen dem Branchenstandard (live abgelesen bei
// Lodgify): Theme · Farben · Schriftarten · Buttons · Weitere Optionen. Das ist
// ALLES, was das Aussehen bestimmt — bewusst wenige, benannte Regler statt eines
// Inspektors mit Blending, Masken und Filtern.
//
// „Weitere Optionen" führt in Unterseiten derselben Leiste (Logo), damit die
// Grundansicht kurz bleibt.
import { useTranslations } from "next-intl";
import { useMemo } from "react";

import { NativeSelect } from "@nextdays/ui/native-select";
import type { Branding, ButtonRadius, SiteTheme } from "@/lib/site-config";
import { FONT_CATALOG } from "@/lib/website-fonts";

import { BildFeld } from "../editor/bild-feld";
import { LeisteTitel, LeisteUnterseite, LeisteVerweis } from "../schale";
import { Farbwaehler } from "./farbwaehler";
import { PalettenWaehler } from "./paletten-waehler";
import { ThemeVorschau } from "./theme-vorschau";
import { pruefeFarben } from "./kontrast";

const THEMES: SiteTheme[] = ["klar", "mitte", "karte", "seitlich"];

/** Die Farbrollen in der Reihenfolge, in der sie auf der Seite wirken —
 *  von oben nach unten durchs Dokument.
 *
 *  Vorher waren es vier, und Kopf- und Fußzeile hatten keine eigene: sie
 *  übernahmen den Seitenhintergrund. Ein dunkler Header über hellem Inhalt war
 *  damit unmöglich, und das ist der häufigste Gestaltungswunsch überhaupt.
 *  Lodgify führt dieselben sechs (live abgelesen am 23.08.2026: Firmenname,
 *  Header-Hintergrund, Header-Links, Buttons und Elemente, Links,
 *  Footer-Hintergrund). */
const FARBROLLEN = [
  { key: "brand_name_color", label: "firmenname" },
  { key: "header_background", label: "kopfHintergrund" },
  { key: "header_link_color", label: "kopfLinks" },
  { key: "primary_color", label: "primaer" },
  { key: "link_color", label: "links" },
  { key: "footer_background", label: "fussHintergrund" },
  { key: "background_color", label: "hintergrund" },
  { key: "foreground_color", label: "schrift" },
  { key: "secondary_color", label: "flaeche" },
] as const;

/** Welche Kontrast-Befunde welche Rolle betreffen — damit der Warnring am
 *  richtigen Punkt sitzt und nicht an allen vier. */
const BEFUND_ZU_ROLLE: Record<string, string> = {
  schriftAufHintergrund: "foreground_color",
  schriftAufFlaeche: "foreground_color",
  buttonText: "primary_color",
  linkAufHintergrund: "primary_color",
};

const RAENDER: ButtonRadius[] = ["sharp", "rounded", "pill"];

export function DesignLeiste({
  stand,
  setze,
  unterseite = null,
}: {
  stand: Branding;
  setze: (patch: Partial<Branding>) => void;
  /** Offene Unterseite. Kommt aus der ROUTE, nicht aus lokalem State: nur so
   *  hat „Logo" eine eigene Adresse, überlebt ein Neuladen und lässt den
   *  Zurück-Knopf des Browsers zurück in die Grundansicht führen — genau wie
   *  bei Lodgify (`/styles/logo`, live abgelesen am 23.08.2026). */
  unterseite?: "logo" | null;
}) {
  const t = useTranslations("website");

  const befunde = useMemo(
    () =>
      pruefeFarben({
        primaer: stand.primary_color,
        flaeche: stand.secondary_color,
        hintergrund: stand.background_color,
        schrift: stand.foreground_color,
      }),
    [
      stand.primary_color,
      stand.secondary_color,
      stand.background_color,
      stand.foreground_color,
    ],
  );

  /** Warnung für eine Farbrolle, oder undefined wenn alles trägt. */
  function warnung(rolle: string): string | undefined {
    const b = befunde.find((x) => BEFUND_ZU_ROLLE[x.schluessel] === rolle);
    if (!b) return undefined;
    return `${t(`kontrast.${b.schluessel}`)} — ${t("design.kontrastWert", {
      ist: b.verhaeltnis.toLocaleString(),
      soll: b.schwelle.toLocaleString(),
    })}`;
  }

  if (unterseite === "logo") {
    return (
      <LeisteUnterseite
        titel={t("design.zurueck")}
        zurueckHref="/website/design"
      >
        <LeisteTitel>{t("design.logoTitel")}</LeisteTitel>
        <div className="flex flex-col gap-3 px-4 pb-6">
          <p className="text-xs text-muted-foreground">
            {t("design.logoHinweis")}
          </p>

          <BildFeld
            label={t("design.logoBild")}
            wert={stand.logo_url}
            onWert={(url) => setze({ logo_url: url })}
          />

          <Feld
            label={`${t("design.logoGroesse")} · ${(stand.logo_scale ?? 1).toLocaleString()}×`}
          >
            <input
              type="range"
              min={0.5}
              max={3}
              step={0.1}
              value={stand.logo_scale ?? 1}
              onChange={(e) => setze({ logo_scale: Number(e.target.value) })}
              className="w-full accent-foreground"
            />
          </Feld>

          <Feld label={t("design.logoZiel")}>
            <input
              value={stand.logo_link_url ?? ""}
              maxLength={500}
              inputMode="url"
              placeholder={t("design.logoZielLeer")}
              onChange={(e) =>
                setze({ logo_link_url: e.target.value || null })
              }
              className={EINGABE}
            />
          </Feld>

          <LeisteTitel>{t("design.firmenname")}</LeisteTitel>
          <Feld label={t("design.siteName")}>
            <input
              value={stand.site_name ?? ""}
              maxLength={80}
              onChange={(e) => setze({ site_name: e.target.value || null })}
              className={EINGABE}
            />
          </Feld>
          {/* Eigene Schrift und Größe für den Firmennamen: er steht NEBEN dem
              Logo und muss zu ihm passen, nicht zu den Überschriften im Text. */}
          <SchriftFeld
            label={t("design.schrift")}
            wert={stand.logo_name_font}
            erbtLabel={t("design.schriftMarke")}
            onChange={(v) => setze({ logo_name_font: v })}
          />
          <Feld
            label={`${t("design.namensGroesse")} · ${stand.logo_name_size ?? 18} pt`}
          >
            <input
              type="range"
              min={8}
              max={48}
              step={1}
              value={stand.logo_name_size ?? 18}
              onChange={(e) =>
                setze({ logo_name_size: Number(e.target.value) })
              }
              className="w-full accent-foreground"
            />
          </Feld>

          <LeisteTitel>{t("design.slogan")}</LeisteTitel>
          <Feld label={t("design.sloganText")}>
            <input
              value={stand.tagline ?? ""}
              maxLength={120}
              onChange={(e) => setze({ tagline: e.target.value || null })}
              className={EINGABE}
            />
          </Feld>
          <SchriftFeld
            label={t("design.schrift")}
            wert={stand.slogan_font}
            erbtLabel={t("design.schriftMarke")}
            onChange={(v) => setze({ slogan_font: v })}
          />

          <LeisteTitel>{t("design.faviconTitel")}</LeisteTitel>
          <BildFeld
            label={t("design.faviconBild")}
            wert={stand.favicon_url}
            onWert={(url) => setze({ favicon_url: url })}
          />
        </div>
      </LeisteUnterseite>
    );
  }

  return (
    <div className="flex flex-col pb-8">
      {/* ------------------------------------------------------------- Theme */}
      <LeisteTitel>{t("design.themeTitel")}</LeisteTitel>
      <p className="px-4 pb-1 text-xs text-muted-foreground">
        {t("design.themeHinweis")}
      </p>
      <div className="grid grid-cols-2 gap-2 px-4 pb-2 pt-1">
        {THEMES.map((theme) => {
          const aktiv = (stand.theme ?? "klar") === theme;
          return (
            <button
              key={theme}
              type="button"
              aria-pressed={aktiv}
              title={t(`design.themeBeschreibung.${theme}`)}
              onClick={() => setze({ theme })}
              className="flex flex-col items-center gap-1 text-center"
            >
              <span
                className={
                  "block w-full overflow-hidden rounded-(--radius) border transition " +
                  (aktiv
                    ? "border-foreground ring-2 ring-foreground/20"
                    : "border-border hover:border-foreground/50")
                }
              >
                <ThemeVorschau theme={theme} />
              </span>
              <span
                className={
                  "text-xs " + (aktiv ? "font-semibold" : "text-muted-foreground")
                }
              >
                {t(`design.theme.${theme}`)}
              </span>
            </button>
          );
        })}
      </div>

      {/* ------------------------------------------------------------ Farben */}
      <LeisteTitel>{t("design.farbenTitel")}</LeisteTitel>
      <p className="px-4 pb-2 text-xs text-muted-foreground">
        {t("design.farbenHinweis")}
      </p>
      <PalettenWaehler
        aktuell={[
          stand.primary_color,
          stand.background_color,
          stand.foreground_color,
          stand.secondary_color,
        ]}
        label={t("design.paletteWaehlen")}
        empfohlenLabel={t("design.paletteEmpfohlen")}
        benenne={(p) => t(`paletten.${p.label}`)}
        onWaehle={(p) =>
          setze({
            primary_color: p.primaer,
            secondary_color: p.flaeche,
            background_color: p.hintergrund,
            foreground_color: p.schrift,
          })
        }
      />
      <div className="pt-1">
        {FARBROLLEN.map((rolle) => (
          <Farbwaehler
            key={rolle.key}
            wert={stand[rolle.key]}
            label={t(`design.farbrolle.${rolle.label}`)}
            hinweis={t(`design.farbrolleHinweis.${rolle.label}`)}
            warnung={warnung(rolle.key)}
            zuruecksetzenLabel={t("design.farbeZuruecksetzen")}
            onChange={(hex) => setze({ [rolle.key]: hex } as Partial<Branding>)}
          />
        ))}
      </div>

      {/* -------------------------------------------------------- Schriftarten */}
      <LeisteTitel>{t("design.schriftenTitel")}</LeisteTitel>
      <p className="px-4 pb-2 text-xs text-muted-foreground">
        {t("design.schriftenHinweis")}
      </p>
      <div className="flex flex-col gap-3 px-4">
        <SchriftFeld
          label={t("design.schriftUeberschrift")}
          wert={stand.heading_font}
          erbtLabel={t("design.schriftMarke")}
          onChange={(f) => setze({ heading_font: f })}
        />
        <SchriftFeld
          label={t("design.schriftAbsatz")}
          wert={stand.font_family}
          erbtLabel={t("design.schriftMarke")}
          onChange={(f) => setze({ font_family: f })}
        />
        <SchriftFeld
          label={t("design.schriftButtons")}
          wert={stand.button_font}
          erbtLabel={t("design.schriftWieAbsatz")}
          onChange={(f) => setze({ button_font: f })}
        />
      </div>

      {/* ----------------------------------------------------------- Buttons */}
      <LeisteTitel>{t("design.buttonsTitel")}</LeisteTitel>
      <p className="px-4 pb-2 text-xs text-muted-foreground">
        {t("design.buttonsHinweis")}
      </p>
      <div className="flex flex-col gap-3 px-4">
        <Feld label={t("design.buttonFuellung")}>
          <NativeSelect
            value={stand.button_style ?? "solid"}
            onChange={(e) =>
              setze({
                button_style: e.target.value as Branding["button_style"],
              })
            }
          >
            <option value="solid">{t("design.buttonSolide")}</option>
            <option value="outline">{t("design.buttonUmrandet")}</option>
          </NativeSelect>
        </Feld>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-medium">{t("design.buttonEcken")}</span>
          <div className="grid grid-cols-3 gap-2">
            {RAENDER.map((r) => {
              const aktiv = (stand.button_radius ?? "pill") === r;
              return (
                <button
                  key={r}
                  type="button"
                  aria-pressed={aktiv}
                  onClick={() => setze({ button_radius: r })}
                  className={
                    "flex flex-col items-center gap-1 rounded-(--radius) border px-1 py-2 transition " +
                    (aktiv
                      ? "border-foreground ring-2 ring-foreground/20"
                      : "border-border hover:border-foreground/50")
                  }
                >
                  {/* Wireframe des Randes — die Form selbst ist die Erklärung. */}
                  <span
                    className="block h-4 w-9 border border-foreground/70"
                    style={{
                      borderRadius:
                        r === "sharp"
                          ? "0"
                          : r === "rounded"
                            ? "0.25rem"
                            : "9999px",
                    }}
                  />
                  <span className="w-full truncate text-center text-[0.625rem] leading-none text-muted-foreground">
                    {t(`design.buttonRand.${r}`)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* --------------------------------------------------- Weitere Optionen */}
      <LeisteTitel>{t("design.weitereOptionen")}</LeisteTitel>
      <LeisteVerweis
        label={t("design.logoTitel")}
        href="/website/design/logo"
      />
    </div>
  );
}

const EINGABE =
  "w-full rounded-(--radius) border border-border bg-transparent px-2 py-1.5 text-sm";

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

/** Schriftwahl als Dropdown mit Vorschau-Schrift je Option.
 *
 *  Kuratierter Katalog statt hunderter Google-Fonts: der Kunde soll wählen, nicht
 *  suchen. Der Katalog ist DIE Wahrheit für Editor und Renderer
 *  (web/lib/website-fonts spiegelt builder/lib/fonts-catalog). */
function SchriftFeld({
  label,
  wert,
  erbtLabel,
  onChange,
}: {
  label: string;
  wert: string | null;
  erbtLabel: string;
  onChange: (f: string | null) => void;
}) {
  const gewaehlt = FONT_CATALOG.find((f) => f.family === wert);
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium">{label}</span>
      <select
        value={wert ?? ""}
        onChange={(e) => onChange(e.target.value || null)}
        style={gewaehlt ? { fontFamily: gewaehlt.stack } : undefined}
        className="w-full rounded-(--radius) border border-border bg-transparent px-2 py-1.5 text-sm"
      >
        <option value="">{erbtLabel}</option>
        {FONT_CATALOG.map((f) => (
          <option key={f.family} value={f.family} style={{ fontFamily: f.stack }}>
            {f.label}
          </option>
        ))}
      </select>
    </label>
  );
}

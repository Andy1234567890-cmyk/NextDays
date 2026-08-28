"use client";

// Die Design-Einstellungen — seit 0468 als HOSTAWAY-UNTERSEITEN statt einer
// einzigen langen Rolle.
//
// Vorher stand ALLES (Theme, Designfarben, Farbrollen, Schriftarten,
// Text-Rollen, Breite & Abstand, Größen, Buttons) untereinander in EINER
// scrollenden Leiste unter dem immer gleichen Kopf „DESIGN" mit einem
// einzigen ✕ — der Kunde hat das selbst beanstandet. Hostaway (live
// abgelesen) führt stattdessen eine Grundansicht mit sieben Verweisen und für
// jeden eine eigene Unterseite mit eigenem Panel-Kopf `‹ TITEL ⊡ ✕`
// (`BaukastenSchale`, 0468).
//
// Diese Datei ist jetzt ein ROUTER: die Berechnungen (Kontrast-Befunde,
// Verknüpfen/Lösen, Textstil setzen), die mehrere Unterseiten gemeinsam
// brauchen, stehen einmal oben; darunter entscheidet `unterseite`, welcher
// Bereich zurückkommt. Kein Titel wiederholt sich mehr im Inhalt — der steht
// jetzt EINMAL im Panel-Kopf (`design-ansicht.tsx` setzt ihn dynamisch).
//
// ZWEI EBENEN, EINE WAHRHEIT (0446)
//
// „Designfarben" sind benannte WERTE, „Farbrollen" benannte STELLEN. Wer eine
// Rolle mit einer Designfarbe verknüpft, ändert sie künftig an einer Stelle für
// alle. Wer eine Rolle danach von Hand setzt, löst NUR deren Bindung — feldweise,
// wie bei Hostaway. Durchgesetzt wird das serverseitig
// (`SiteConfigService._farbrollen_aufloesen`); hier wird es gespiegelt, damit
// die Leiste zwischen zwei Speichervorgängen nicht das Gegenteil behauptet.
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { NativeSelect } from "@nextdays/ui/native-select";
import type {
  Branding,
  ButtonRadius,
  Farbrolle,
  SiteTheme,
  TextRolle,
  TextSchatten,
  TextStil,
  ThemeFarbe,
} from "@/lib/site-config";
import { FONT_CATALOG } from "@/lib/website-fonts";

import type { DesignUnterseite } from "../design-ansicht";
import { BAUKASTEN_BASIS } from "../reiter";
import { ThemeBaender } from "./theme-baender";
import { BildFeld } from "../editor/bild-feld";
import { LeisteTitel } from "../schale";
import { BreiteAbstand } from "./breite-abstand";
import { Designfarben } from "./designfarben";
import { Farbwaehler, type FarbwaehlerTexte } from "./farbwaehler";
import { PalettenWaehler } from "./paletten-waehler";
import { pruefeFarben } from "./kontrast";
import { TextRollen } from "./text-rollen";
import { ThemeVorschau } from "./theme-vorschau";

const THEMES: SiteTheme[] = ["klar", "mitte", "karte", "seitlich"];

/** Die Farbrollen in der Reihenfolge, in der sie auf der Seite wirken —
 *  von oben nach unten durchs Dokument.
 *
 *  `gegen` ist die Farbe, gegen die der Kontrast dieser Rolle gemessen wird:
 *  bei einer Schrift ihr Untergrund, bei einer Fläche der Text darauf. Ohne
 *  diese Zuordnung wäre die WCAG-Anzeige im Farbwähler eine Zahl ohne Bezug.
 *
 *  Vorher waren es vier Rollen, und Kopf- und Fußzeile hatten keine eigene: sie
 *  übernahmen den Seitenhintergrund. Ein dunkler Header über hellem Inhalt war
 *  damit unmöglich, und das ist der häufigste Gestaltungswunsch überhaupt. */
const FARBROLLEN: ReadonlyArray<{
  key: Farbrolle & keyof Branding;
  label: string;
  gegen: (b: Branding) => string | null;
}> = [
  {
    key: "brand_name_color",
    label: "firmenname",
    gegen: (b) => b.header_background ?? b.background_color,
  },
  {
    key: "header_background",
    label: "kopfHintergrund",
    gegen: (b) => b.header_link_color ?? b.foreground_color,
  },
  {
    key: "header_link_color",
    label: "kopfLinks",
    gegen: (b) => b.header_background ?? b.background_color,
  },
  // Der Marken-Button trägt weiße Beschriftung (`--primary-foreground`), und
  // dagegen wird gemessen. Das ist keine erfundene Farbe, sondern der Wert, den
  // der Renderer dort wirklich setzt.
  { key: "primary_color", label: "primaer", gegen: () => "#ffffff" },
  { key: "link_color", label: "links", gegen: (b) => b.background_color },
  {
    key: "footer_background",
    label: "fussHintergrund",
    gegen: (b) => b.link_color ?? b.foreground_color,
  },
  {
    key: "background_color",
    label: "hintergrund",
    gegen: (b) => b.foreground_color,
  },
  {
    key: "foreground_color",
    label: "schrift",
    gegen: (b) => b.background_color,
  },
  {
    key: "secondary_color",
    label: "flaeche",
    gegen: (b) => b.foreground_color,
  },
];

/** Welche Kontrast-Befunde welche Rolle betreffen — damit der Warnring am
 *  richtigen Punkt sitzt und nicht an allen vier. */
const BEFUND_ZU_ROLLE: Record<string, string> = {
  schriftAufHintergrund: "foreground_color",
  schriftAufFlaeche: "foreground_color",
  buttonText: "primary_color",
  linkAufHintergrund: "primary_color",
  kopfLinkAufKopf: "header_link_color",
  markenNameAufKopf: "brand_name_color",
  textAufFuss: "footer_background",
};

const RAENDER: ButtonRadius[] = ["sharp", "rounded", "pill"];

export function DesignLeiste({
  stand,
  setze,
  unterseite = null,
  onUnterseite,
}: {
  stand: Branding;
  setze: (patch: Partial<Branding>) => void;
  /** Offene Unterseite. Kommt aus der ROUTE, nicht aus lokalem State: nur so
   *  hat jede Unterseite eine eigene Adresse, überlebt ein Neuladen und lässt
   *  den Zurück-Knopf des Panel-Kopfes in die Grundansicht führen. */
  unterseite?: DesignUnterseite | null;
  /** Gesetzt = die Unterseiten werden IM Panel geöffnet, ohne Seitenwechsel. */
  onUnterseite?: (id: DesignUnterseite) => void;
}) {
  const t = useTranslations("website");
  // Locale ausdrücklich — sonst trennt Server und Browser die Zahl
  // verschieden und React verwirft den Teilbaum (B6).
  const locale = useLocale();
  const router = useRouter();
  const [offeneTextrolle, setOffeneTextrolle] = useState<TextRolle | null>(null);

  const palette: ThemeFarbe[] = stand.theme_colors ?? [];
  const verknuepfungen = (stand.theme_color_links ?? {}) as Record<
    string,
    string | undefined
  >;

  const befunde = useMemo(
    () =>
      pruefeFarben({
        primaer: stand.primary_color,
        flaeche: stand.secondary_color,
        hintergrund: stand.background_color,
        schrift: stand.foreground_color,
        kopfHintergrund: stand.header_background,
        kopfLink: stand.header_link_color,
        fussHintergrund: stand.footer_background,
        link: stand.link_color,
        markenName: stand.brand_name_color,
      }),
    [
      stand.primary_color,
      stand.secondary_color,
      stand.background_color,
      stand.foreground_color,
      stand.header_background,
      stand.header_link_color,
      stand.footer_background,
      stand.link_color,
      stand.brand_name_color,
    ],
  );

  /** Warnung für eine Farbrolle, oder undefined wenn alles trägt. */
  function warnung(rolle: string): string | undefined {
    const b = befunde.find((x) => BEFUND_ZU_ROLLE[x.schluessel] === rolle);
    if (!b) return undefined;
    return `${t(`kontrast.${b.schluessel}`)} — ${t("design.kontrastWert", {
      ist: b.verhaeltnis.toLocaleString(locale),
      soll: b.schwelle.toLocaleString(locale),
    })}`;
  }

  const farbwaehlerTexte: FarbwaehlerTexte = {
    zuruecksetzen: t("design.farbeZuruecksetzen"),
    pipette: t("design.pipette"),
    verknuepfen: t("design.farbeVerknuepfen"),
    verknuepfungLoesen: t("design.verknuepfungLoesen"),
    kontrastTitel: t("design.kontrastTitel"),
    wcag: {
      normalAAA: t("design.wcag.normalAAA"),
      grossAAA: t("design.wcag.grossAAA"),
      normalAA: t("design.wcag.normalAA"),
      grossAA: t("design.wcag.grossAA"),
    },
  };

  /** Eine Verknüpfung setzen oder lösen.
   *
   *  Gelöschte Schlüssel werden ENTFERNT und nicht auf `undefined` gesetzt:
   *  `undefined` überlebt kein JSON und käme als fehlender Schlüssel doch
   *  wieder heraus — nur eben nach einem Umweg, bei dem der Autospeichern-Diff
   *  eine Änderung sieht, die keine ist. */
  function verknuepfe(rolle: string, id: string | null) {
    const neu = { ...verknuepfungen };
    if (id) neu[rolle] = id;
    else delete neu[rolle];
    setze({ theme_color_links: neu as Branding["theme_color_links"] });
  }

  /** Eine Eigenschaft einer Text-Rolle ändern. */
  function setzeTextStil(rolle: TextRolle, patch: Partial<TextStil>) {
    const alt = stand.text_styles ?? {};
    setze({
      text_styles: { ...alt, [rolle]: { ...(alt[rolle] ?? {}), ...patch } },
    });
  }

  /** Palette ändern.
   *
   *  Verknüpfungen auf entfernte Einträge werden hier NICHT mitgelöscht: das
   *  erledigt der Server beim Speichern und lässt dabei den zuletzt gültigen
   *  Farbwert in der Rolle stehen (Wurzel 1). Hier vorzugreifen hieße, die
   *  Regel an zwei Stellen zu führen. */
  function setzePalette(farben: ThemeFarbe[]) {
    setze({ theme_colors: farben });
  }

  // ---------------------------------------------------------------- Logo
  if (unterseite === "logo") {
    return (
      <div className="flex flex-col pb-8">
        <p className="px-4 pt-4 text-xs text-muted-foreground">
          {t("design.logoHinweis")}
        </p>
        <div className="flex flex-col gap-3 px-4 pb-2 pt-3">
          <BildFeld
            label={t("design.logoBild")}
            wert={stand.logo_url}
            onWert={(url) => setze({ logo_url: url })}
          />

          <Feld
            label={`${t("design.logoGroesse")} · ${(stand.logo_scale ?? 1).toLocaleString(locale)}×`}
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
        </div>

        <LeisteTitel>{t("design.firmenname")}</LeisteTitel>
        <div className="flex flex-col gap-3 px-4 pb-2">
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
            label={`${t("design.namensGroesse")} · ${stand.logo_name_size ?? 18} px`}
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
        </div>

        <LeisteTitel>{t("design.slogan")}</LeisteTitel>
        <div className="flex flex-col gap-3 px-4 pb-2">
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
        </div>

        <LeisteTitel>{t("design.faviconTitel")}</LeisteTitel>
        <div className="px-4 pb-2">
          <BildFeld
            label={t("design.faviconBild")}
            wert={stand.favicon_url}
            onWert={(url) => setze({ favicon_url: url })}
          />
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------- Site-Layout
  if (unterseite === "site-layout") {
    return (
      <div className="flex flex-col pb-8">
        <p className="px-4 pb-1 pt-4 text-xs text-muted-foreground">
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
        {/* „Seitlich" ist Hostaways Seitenleisten-Layout: Menü links statt im
            Kopfbereich. Unter 1090 px (`min-[68.125rem]`, site-header.tsx)
            fällt es automatisch auf eine waagerechte Kopfzeile zurück — dieselbe
            Schwelle, die Hostaway selbst fährt (live abgelesen, 0468). */}
        {(stand.theme ?? "klar") === "seitlich" ? (
          <p className="px-4 pb-2 text-xs leading-snug text-muted-foreground">
            {t("design.layoutSeitlichHinweis")}
          </p>
        ) : null}
      </div>
    );
  }

  // -------------------------------------------------------------- Farben
  if (unterseite === "farben") {
    return (
      <div className="flex flex-col pb-8">
        <LeisteTitel>{t("design.designfarbenTitel")}</LeisteTitel>
        <Designfarben
          farben={palette}
          onFarben={setzePalette}
          logoUrl={stand.logo_url}
          texte={{
            titel: t("design.designfarbenTitel"),
            hinweis: t("design.designfarbenHinweis"),
            hinzufuegen: t("design.farbeHinzufuegen"),
            ausLogo: t("design.farbenAusLogo"),
            ausLogoLaeuft: t("design.farbenAusLogoLaeuft"),
            umbenennen: t("design.farbeUmbenennen"),
            entfernen: t("design.farbeEntfernen"),
            voll: t("design.paletteVoll"),
            neueFarbe: t("design.neueFarbe"),
            fehler: {
              "kein-logo": t("design.logoFehler.keinLogo"),
              "nicht-lesbar": t("design.logoFehler.nichtLesbar"),
              gesperrt: t("design.logoFehler.gesperrt"),
              leer: t("design.logoFehler.leer"),
            },
            // Der Backfill von 0446 trägt als Namen den ROLLENSCHLÜSSEL ein —
            // eine Migration darf keine Sprache festschreiben. Hier wird er
            // übersetzt; ein selbst vergebener Name bleibt, wie er ist.
            rollenName: (name) => {
              const rolle = FARBROLLEN.find((r) => r.key === name);
              return rolle ? t(`design.farbrolle.${rolle.label}`) : name;
            },
          }}
        />

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
          onWaehle={(p) => {
            // Eine fertige Palette setzt vier Rollen von Hand — und löst damit
            // deren Verknüpfungen, genau wie eine einzelne Handänderung.
            const links = { ...verknuepfungen };
            for (const rolle of [
              "primary_color",
              "secondary_color",
              "background_color",
              "foreground_color",
            ]) {
              delete links[rolle];
            }
            setze({
              primary_color: p.primaer,
              secondary_color: p.flaeche,
              background_color: p.hintergrund,
              foreground_color: p.schrift,
              theme_color_links: links as Branding["theme_color_links"],
            });
          }}
        />
        <div className="pt-1">
          {FARBROLLEN.map((rolle) => (
            <Farbwaehler
              key={rolle.key}
              wert={stand[rolle.key] as string | null}
              label={t(`design.farbrolle.${rolle.label}`)}
              hinweis={t(`design.farbrolleHinweis.${rolle.label}`)}
              warnung={warnung(rolle.key)}
              texte={farbwaehlerTexte}
              palette={palette}
              verknuepft={verknuepfungen[rolle.key] ?? null}
              onVerknuepfe={(id) => verknuepfe(rolle.key, id)}
              gegenfarbe={rolle.gegen(stand)}
              onChange={(hex) => setze({ [rolle.key]: hex } as Partial<Branding>)}
            />
          ))}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------- Text
  if (unterseite === "text") {
    return (
      <div className="flex flex-col pb-8">
        <LeisteTitel>{t("design.schriftenTitel")}</LeisteTitel>
        <p className="px-4 pb-2 text-xs text-muted-foreground">
          {t("design.schriftenHinweisText")}
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
        </div>

        <LeisteTitel>{t("design.textRollenTitel")}</LeisteTitel>
        <p className="px-4 pb-2 text-xs leading-snug text-muted-foreground">
          {t("design.textRollenHinweis")}
        </p>
        <TextRollen
          stile={stand.text_styles ?? {}}
          onStil={setzeTextStil}
          offen={offeneTextrolle}
          onOffen={setOffeneTextrolle}
          palette={palette}
          verknuepfungen={verknuepfungen}
          onVerknuepfe={verknuepfe}
          hintergrund={stand.background_color}
          texte={{
            rolle: (r) => t(`design.textRolle.${r}`),
            rolleHinweis: (r) => t(`design.textRolleHinweis.${r}`),
            schrift: t("design.schrift"),
            erbt: t("design.schriftMarke"),
            groesseDesktop: t("design.textGroesseDesktop"),
            groesseMobil: t("design.textGroesseMobil"),
            skalieren: t("design.textSkalieren"),
            skalierenHinweis: t("design.textSkalierenHinweis"),
            farbe: t("design.textFarbe"),
            staerke: t("design.textStaerke"),
            zeilenhoehe: t("design.textZeilenhoehe"),
            laufweite: t("design.textLaufweite"),
            grossbuchstaben: t("design.textGrossbuchstaben"),
            schatten: t("design.textSchatten"),
            schattenWert: (s: TextSchatten) => t(`design.schatten.${s}`),
            linkTitel: t("design.linkTitel"),
            linkNormal: t("design.linkNormal"),
            linkHover: t("design.linkHover"),
            linkBesucht: t("design.linkBesucht"),
            linkUnterstrichen: t("design.linkUnterstrichen"),
            standard: t("design.groesseStandard"),
            zuruecksetzen: t("design.groesseZuruecksetzen"),
            farbwaehler: farbwaehlerTexte,
          }}
        />

        <LeisteTitel>{t("design.groessenTitel")}</LeisteTitel>
        <p className="px-4 pb-2 text-xs leading-snug text-muted-foreground">
          {t("design.groessenHinweis")}
        </p>
        <div className="flex flex-col gap-3 px-4">
          <RegelFeld
            label={t("design.ueberschriftenGroesse")}
            wert={stand.heading_scale}
            min={80}
            max={130}
            schritt={5}
            einheit="%"
            standardLabel={t("design.groesseStandard")}
            zuruecksetzen={t("design.groesseZuruecksetzen")}
            onChange={(v) => setze({ heading_scale: v })}
          />
          <RegelFeld
            label={t("design.textGroesse")}
            wert={stand.body_scale}
            min={80}
            max={130}
            schritt={5}
            einheit="%"
            standardLabel={t("design.groesseStandard")}
            zuruecksetzen={t("design.groesseZuruecksetzen")}
            onChange={(v) => setze({ body_scale: v })}
          />
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------ Buttons
  if (unterseite === "buttons") {
    return (
      <div className="flex flex-col pb-8">
        <p className="px-4 pb-2 pt-4 text-xs text-muted-foreground">
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

          <SchriftFeld
            label={t("design.schriftButtons")}
            wert={stand.button_font}
            erbtLabel={t("design.schriftWieAbsatz")}
            onChange={(f) => setze({ button_font: f })}
          />
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------- Bilder
  if (unterseite === "bilder") {
    return (
      <div className="flex flex-col pb-8">
        <p className="px-4 pb-2 pt-4 text-xs leading-snug text-muted-foreground">
          {t("design.bilderHinweis")}
        </p>
        <div className="flex flex-col gap-3 px-4">
          <BildFeld
            label={t("design.heroBildLabel")}
            wert={stand.hero_image_url}
            onWert={(url) => setze({ hero_image_url: url })}
          />
          <p className="text-xs leading-snug text-muted-foreground">
            {t("design.heroBildHinweis")}
          </p>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------ Breite & Abstand
  if (unterseite === "breite-abstand") {
    return (
      <div className="flex flex-col pb-8 pt-2">
        <BreiteAbstand
          breite={stand.content_width}
          einheit={stand.content_width_unit ?? "px"}
          vollbreite={stand.content_full_width === true}
          abstandY={stand.section_spacing_y}
          abstandX={stand.section_spacing_x}
          setze={setze}
          texte={{
            titel: t("design.breiteTitel"),
            hinweis: t("design.breiteHinweis"),
            vollbreite: t("design.vollbreite"),
            vollbreiteHinweis: t("design.vollbreiteHinweis"),
            eigenerWert: t("design.eigenerWert"),
            breite: t("design.inhaltsbreite"),
            standard: t("design.groesseStandard"),
            abstandTitel: t("design.abstandTitel"),
            abstandHinweis: t("design.abstandHinweis"),
            abstandVertikal: t("design.abstandVertikal"),
            abstandHorizontal: t("design.abstandHorizontal"),
            aufNull: t("design.abstandAufNull"),
            zuruecksetzen: t("design.groesseZuruecksetzen"),
          }}
        />
      </div>
    );
  }

  // --------------------------------------------------------- Grundansicht
  // BÄNDER MIT VORSCHAU statt sieben Textzeilen (`theme-baender.tsx`).
  //
  // Vorher stand hier eine Liste aus `LeisteVerweis`: „Layout ›", „Farben ›",
  // „Text ›". Man sah nicht, WELCHE Farben eingestellt sind, wie die Knöpfe
  // aussehen oder wie groß H1 ist — dafür musste man jede Unterseite öffnen,
  // nachsehen und zurückgehen. Ein Theme-Panel, das den Zustand des Themes
  // nicht zeigt, ist ein Inhaltsverzeichnis.
  return (
    <div className="flex flex-col pb-8">
      <ThemeBaender
        stand={stand}
        onOeffnen={(id) => {
          // Im EDITOR wechselt der Klick nur die Unterseite des Panels; im
          // eigenen Design-Reiter navigiert er, damit jede Unterseite eine
          // Adresse behält.
          if (onUnterseite) onUnterseite(id);
          else router.push(`${BAUKASTEN_BASIS}/design/${id}`);
        }}
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

/** Ein Regler mit Zurücksetzen (0435).
 *
 *  Der Punkt ist der dritte Zustand: `null` heißt „nie gewählt", und das ist
 *  NICHT dasselbe wie der Mittelwert. Ein `<input type="range">` kann das nicht
 *  darstellen — er zeigt immer eine Position. Deshalb steht daneben, dass der
 *  Standard gilt, und ein Knopf, der dorthin zurückführt. */
function RegelFeld({
  label,
  wert,
  min,
  max,
  schritt,
  einheit,
  standardLabel,
  zuruecksetzen,
  onChange,
}: {
  label: string;
  wert: number | null;
  min: number;
  max: number;
  schritt: number;
  einheit: string;
  standardLabel: string;
  zuruecksetzen: string;
  onChange: (v: number | null) => void;
}) {
  const anzeige = wert ?? (einheit === "%" ? 100 : min);
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium">{label}</span>
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          {wert === null ? standardLabel : `${wert} ${einheit}`}
          {wert !== null ? (
            <button
              type="button"
              onClick={() => onChange(null)}
              title={zuruecksetzen}
              aria-label={zuruecksetzen}
              className="transition hover:text-destructive"
            >
              <Icon icon="ph:arrow-counter-clockwise" className="size-3.5" />
            </button>
          ) : null}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={schritt}
        value={anzeige}
        onChange={(e) => onChange(Number(e.target.value))}
        aria-label={label}
      />
    </div>
  );
}

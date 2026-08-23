"use client";

// Externe Widgets: ein Such- oder Buchen-Feld, das der Betrieb auf einer FREMDEN
// Seite einbaut (0426, Lodgify-Gegenstück `/external-widgets`).
//
// Der Fall dahinter ist häufig: der Betrieb hat schon eine Website — bei einem
// Webdesigner, in WordPress, in einem Baukasten eines Dritten — und will von
// dort direkt in seine Buchungsstrecke verweisen, ohne die Seite umzuziehen.
//
// Umgesetzt als IFRAME-Schnipsel und NICHT als Skript-Einbindung. Das ist die
// wichtigere Entscheidung von beiden:
//   · Ein `<script>` von uns auf einer fremden Seite hätte dort vollen Zugriff
//     auf das Dokument — auf Formulare, Cookies, alles. Wir würden Kunden bitten,
//     uns dieses Recht einzuräumen, obwohl wir es nicht brauchen.
//   · Ein iframe ist eine eigene Origin. Er kann nichts von der Gastgeber-Seite
//     lesen, und die Gastgeber-Seite nichts von ihm.
// Ein Schnipsel, den der Kunde in seine Seite kopiert, muss außerdem STABIL
// sein: ein iframe mit einer URL bleibt gültig, auch wenn wir unsere App
// umbauen. Ein Skript wäre eine Schnittstelle, die wir für immer tragen.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { NativeSelect } from "@nextdays/ui/native-select";
import type { Branding, ButtonRadius, CustomDomain } from "@/lib/site-config";
import type { Page } from "@/lib/site-pages";

import { EinstellungenKopf } from "./einstellungen/rahmen";
import { BaukastenRahmen } from "./rahmen";

type WidgetTyp = "suche" | "buchen";

const RAENDER: ButtonRadius[] = ["sharp", "rounded", "pill"];

/** Höhe des eingebetteten Rahmens je Typ. Feste Werte, weil ein iframe seine
 *  Höhe nicht selbst an die Gastgeber-Seite melden kann (das bräuchte genau das
 *  Skript, das wir bewusst nicht ausliefern). Die Werte sind großzügig, damit
 *  nichts abgeschnitten wird. */
const HOEHE: Record<WidgetTyp, number> = { suche: 96, buchen: 420 };

export function WidgetsAnsicht({
  pages,
  domains,
  branding,
}: {
  pages: Page[];
  domains: CustomDomain[];
  branding: Branding;
}) {
  const t = useTranslations("website");
  const [typ, setTyp] = useState<WidgetTyp>("suche");
  const [sprache, setSprache] = useState<string>(
    branding.default_language ?? branding.languages?.[0] ?? "de",
  );
  const [neuesFenster, setNeuesFenster] = useState(true);
  const [rand, setRand] = useState<ButtonRadius>(
    branding.button_radius ?? "pill",
  );

  // Die Adresse der Website des Betriebs. OHNE aktive Domain gibt es keinen
  // Schnipsel: eine geratene Adresse (unsere Builder-Adresse, eine
  // Vorschau-URL) würde der Kunde in seine fremde Seite kopieren und dort
  // dauerhaft stehen lassen (Wurzel 4).
  const domain = domains.find((d) => d.status === "active")?.domain ?? null;

  const schnipsel = useMemo(() => {
    if (!domain) return null;
    const params = new URLSearchParams();
    params.set("lang", sprache);
    if (neuesFenster) params.set("ziel", "neu");
    if (rand !== "pill") params.set("rand", rand);
    const url = `https://${domain}/widget/${typ}?${params.toString()}`;
    // `title` ist nicht optional: ein iframe ohne Titel ist für Screenreader
    // ein unbenannter Rahmen. `loading="lazy"` hält die fremde Seite schnell.
    return [
      `<iframe src="${url}"`,
      `        title="${t(`widgets.typ.${typ}`)}"`,
      `        width="100%" height="${HOEHE[typ]}"`,
      `        loading="lazy" style="border:0" ></iframe>`,
    ].join("\n");
  }, [domain, sprache, neuesFenster, rand, typ, t]);

  async function kopieren() {
    if (!schnipsel) return;
    try {
      await navigator.clipboard.writeText(schnipsel);
      toast.success(t("widgets.kopiert"));
    } catch {
      // Kein Zugriff auf die Zwischenablage (kein HTTPS, verweigerte Erlaubnis):
      // dann bleibt das Textfeld, aus dem der Kunde von Hand kopieren kann. Ein
      // „kopiert" zu melden, ohne dass etwas kopiert wurde, wäre eine
      // Falschaussage.
      toast.error(t("widgets.kopierenFehler"));
    }
  }

  const sprachen =
    branding.languages && branding.languages.length > 0
      ? branding.languages
      : [sprache];

  return (
    <BaukastenRahmen
      pages={pages}
      domains={domains}
      breit
      inhalt={
        <div className="mx-auto flex max-w-3xl flex-col gap-6 p-4 md:p-6">
          <EinstellungenKopf
            titel={t("widgets.titel")}
            beschreibung={t("widgets.hinweis")}
          />

          {!domain ? (
            // Ohne eigene Domain gibt es keine Adresse, die auf einer fremden
            // Seite dauerhaft funktioniert. Das wird gesagt, statt einen
            // Schnipsel mit einer Verlegenheits-URL anzubieten.
            <div className="rounded-(--radius) border border-border bg-secondary/40 p-4 text-sm">
              {t("widgets.keineDomain")}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">{t("widgets.typLabel")}</span>
              <NativeSelect
                value={typ}
                onChange={(e) => setTyp(e.target.value as WidgetTyp)}
              >
                <option value="suche">{t("widgets.typ.suche")}</option>
                <option value="buchen">{t("widgets.typ.buchen")}</option>
              </NativeSelect>
              <span className="text-xs text-muted-foreground">
                {t(`widgets.typBeschreibung.${typ}`)}
              </span>
            </label>

            <label className="flex flex-col gap-1.5 text-sm">
              <span className="font-medium">{t("widgets.sprache")}</span>
              <NativeSelect
                value={sprache}
                onChange={(e) => setSprache(e.target.value)}
              >
                {sprachen.map((code) => (
                  <option key={code} value={code}>
                    {code.toUpperCase()}
                  </option>
                ))}
              </NativeSelect>
              <span className="text-xs text-muted-foreground">
                {t("widgets.spracheHinweis")}
              </span>
            </label>
          </div>

          <div className="flex flex-col gap-1.5 text-sm">
            <span className="font-medium">{t("widgets.randLabel")}</span>
            <div className="grid max-w-sm grid-cols-3 gap-2">
              {RAENDER.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRand(r)}
                  aria-pressed={rand === r}
                  className={
                    "rounded-(--radius) border px-3 py-2 text-xs transition " +
                    (rand === r
                      ? "border-foreground font-semibold"
                      : "border-border text-muted-foreground hover:border-foreground/40")
                  }
                >
                  {t(`design.buttonRand.${r}`)}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={neuesFenster}
              onChange={(e) => setNeuesFenster(e.target.checked)}
              className="mt-0.5 size-4 accent-foreground"
            />
            <span>
              <span className="font-medium">{t("widgets.neuesFenster")}</span>
              <span className="block text-xs text-muted-foreground">
                {t("widgets.neuesFensterHinweis")}
              </span>
            </span>
          </label>

          {schnipsel ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium">
                  {t("widgets.codeLabel")}
                </span>
                <button
                  type="button"
                  onClick={kopieren}
                  className="flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                >
                  <Icon icon="ph:copy" className="size-4" />
                  {t("widgets.kopieren")}
                </button>
              </div>
              <textarea
                readOnly
                value={schnipsel}
                rows={5}
                spellCheck={false}
                onFocus={(e) => e.currentTarget.select()}
                className="w-full rounded-(--radius) border border-border bg-secondary/30 px-3 py-2 font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                {t("widgets.codeHinweis")}
              </p>
            </div>
          ) : null}
        </div>
      }
    />
  );
}

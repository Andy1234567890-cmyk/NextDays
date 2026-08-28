"use client";

// Der KI-Knopf neben Meta-Titel und -Beschreibung EINER Seite (0463–0465).
//
// EIN Knopf und nicht zwei: der Endpunkt `/ki/seo` liefert Titel und
// Beschreibung in einem Aufruf, weil beide aus demselben Seiteninhalt
// entstehen. Zwei Knöpfe würden zwei Aufrufe für dieselbe Erzeugung
// verlangen — Verbrauch gegen den Tagesdeckel, für nichts.
//
// Der Vorschlag ERSETZT die Felder NICHT beim Erzeugen: er steht daneben,
// mit Übernehmen/Verwerfen. Erst „Übernehmen" schreibt ihn in den Entwurf der
// aufrufenden Zeile (`seiten-liste.tsx`) — gespeichert wird er dort, mit dem
// ohnehin vorhandenen „Speichern"-Knopf. Das ist Absicht: die KI erzeugt
// einen Vorschlag, der Mensch entscheidet, wann er auf die Website kommt.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@nextdays/ui/button";
import { NativeSelect } from "@nextdays/ui/native-select";
import { kiSeo } from "@/lib/site-ki";

import { useKi } from "../ki/ki-context";

export function KiSeoKnopf({
  pageId,
  sprachen,
  spracheStandard,
  onUebernommen,
}: {
  pageId: string;
  /** Sprachen dieser Website. KEINE erfundene Liste (Wurzel 4): kommt aus
   *  `branding.languages`, dem Rückfall der Aufrufer. */
  sprachen: string[];
  spracheStandard: string;
  onUebernommen: (v: {
    titel: string;
    beschreibung: string;
    modell: string;
  }) => void;
}) {
  const t = useTranslations("website.ki");
  const { verfuegbar } = useKi();
  const [offen, setOffen] = useState(false);
  const [sprache, setSprache] = useState(spracheStandard);
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [vorschlag, setVorschlag] = useState<{
    titel: string;
    beschreibung: string;
    modell: string;
    warnungen: string[];
  } | null>(null);

  if (!verfuegbar) return null;

  async function erzeugen() {
    setLaedt(true);
    setFehler(null);
    const res = await kiSeo({ page_id: pageId, sprache });
    setLaedt(false);
    if (!res.ok) {
      setFehler(res.error);
      return;
    }
    setVorschlag({
      titel: res.data.seo_title,
      beschreibung: res.data.seo_description,
      modell: res.data.modell,
      warnungen: res.data.warnungen,
    });
  }

  return (
    <div className="relative inline-block">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setOffen((o) => !o)}
        className="h-7 gap-1 rounded-full px-2.5 text-xs"
      >
        <Icon icon="solar:magic-stick-3-linear" className="size-3.5" />
        {t("seoKnopf")}
      </Button>

      {offen ? (
        <div className="absolute left-0 top-full z-30 mt-1 w-72 rounded-xl border border-border bg-popover p-2.5 shadow-lg">
          {!vorschlag ? (
            <div className="flex flex-col gap-2">
              {sprachen.length > 1 ? (
                <NativeSelect
                  value={sprache}
                  onChange={(e) => setSprache(e.target.value)}
                  aria-label={t("seoSprache")}
                  className="h-8 text-xs"
                >
                  {sprachen.map((s) => (
                    <option key={s} value={s}>
                      {s.toUpperCase()}
                    </option>
                  ))}
                </NativeSelect>
              ) : null}
              <Button
                type="button"
                size="sm"
                disabled={laedt}
                onClick={() => void erzeugen()}
                className="h-7 gap-1.5 text-xs"
              >
                <Icon
                  icon={laedt ? "svg-spinners:180-ring" : "solar:magic-stick-3-linear"}
                  className="size-3.5"
                />
                {laedt ? t("erzeugtGerade") : t("seoErzeugen")}
              </Button>
              {fehler ? (
                <p className="rounded-lg bg-destructive/10 px-2 py-1.5 text-xs text-destructive">
                  {fehler}
                </p>
              ) : null}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              <div>
                <p className="text-[0.6875rem] font-medium text-muted-foreground">
                  {t("seoTitelVorschlag")}
                </p>
                <p className="text-xs">{vorschlag.titel}</p>
              </div>
              <div>
                <p className="text-[0.6875rem] font-medium text-muted-foreground">
                  {t("seoBeschreibungVorschlag")}
                </p>
                <p className="text-xs">{vorschlag.beschreibung}</p>
              </div>
              {vorschlag.warnungen.map((w) => (
                <p
                  key={w}
                  className="rounded-lg bg-amber-500/10 px-2 py-1.5 text-xs text-amber-700 dark:text-amber-400"
                >
                  {w}
                </p>
              ))}
              <div className="flex gap-1.5">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="h-7 flex-1 text-xs"
                  onClick={() => {
                    onUebernommen({
                      titel: vorschlag.titel,
                      beschreibung: vorschlag.beschreibung,
                      modell: vorschlag.modell,
                    });
                    setVorschlag(null);
                    setOffen(false);
                  }}
                >
                  {t("uebernehmen")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => setVorschlag(null)}
                >
                  {t("verwerfen")}
                </Button>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

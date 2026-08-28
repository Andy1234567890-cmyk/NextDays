"use client";

// „Für alle Seiten erzeugen" (0463–0465, Etappe 2.2 aus BAUKASTEN-PLAN.md).
//
// Zwei Regeln, beide aus der Bug-Jagd:
//
// * NUR leere Felder werden vorgeschlagen. Ein bestehender Titel ist die
//   Arbeit eines Menschen und wird NIE überschrieben (Wurzel 1) — auch wenn
//   `POST /ki/seo` immer BEIDE Felder liefert, wird beim Speichern nur
//   geschrieben, was auf DIESER Seite vorher leer war.
// * Harte Obergrenze je Lauf, und was sie nicht schafft, wird GEZEIGT, nicht
//   verschwiegen (Wurzel 8/5) — „12 von 20, 8 folgen in einem zweiten Lauf"
//   statt eines Vorgangs, der nach 20 Seiten kommentarlos aufhört.
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@nextdays/ui/button";
import { NativeSelect } from "@nextdays/ui/native-select";
import type { Branding } from "@/lib/site-config";
import { type Page, updatePage } from "@/lib/site-pages";
import { kiHerkunftSetzen, kiSeo } from "@/lib/site-ki";

import { useKi } from "../ki/ki-context";

/** Obergrenze je Lauf. Kein technischer Wert (der Tagesdeckel steht in der
 *  DB und greift unabhängig davon) — dies ist die Grenze GEGEN EINE SCHLEIFE,
 *  die eine Kundensite mit 300 Seiten in einem Rutsch durchzieht, während
 *  niemand hinschaut, ob dabei etwas schiefgeht. */
const MAX_LAUF = 25;

type Zeilenstand = "wartet" | "laeuft" | "erledigt" | "fehler";

type Zeile = {
  page: Page;
  stand: Zeilenstand;
  fehler?: string;
};

function fehltFeld(seite: Page): boolean {
  return !seite.seo_title?.trim() || !seite.seo_description?.trim();
}

export function KiAlleSeitenKnopf({
  pages,
  branding,
}: {
  pages: Page[];
  branding: Branding;
}) {
  const t = useTranslations("website.ki");
  const dashboardLocale = useLocale();
  const uiLocale = branding.default_language ?? dashboardLocale;
  const { verfuegbar } = useKi();
  const router = useRouter();
  const [offen, setOffen] = useState(false);
  const [sprache, setSprache] = useState(uiLocale);
  const [ausgewaehlt, setAusgewaehlt] = useState<Set<string>>(new Set());
  const [laeuft, setLaeuft] = useState(false);
  const [abgeschlossen, setAbgeschlossen] = useState(false);
  const [tageslimitErreicht, setTageslimitErreicht] = useState(false);
  const [zeilen, setZeilen] = useState<Zeile[]>([]);

  const kandidaten = pages.filter(fehltFeld);
  const sprachen =
    branding.languages && branding.languages.length > 0
      ? branding.languages
      : [uiLocale];

  if (!verfuegbar || kandidaten.length === 0) return null;

  function oeffnen() {
    const vorausgewaehlt = kandidaten.slice(0, MAX_LAUF).map((p) => p.id);
    setAusgewaehlt(new Set(vorausgewaehlt));
    setZeilen([]);
    setAbgeschlossen(false);
    setTageslimitErreicht(false);
    setOffen(true);
  }

  async function starten() {
    const liste = kandidaten.filter((p) => ausgewaehlt.has(p.id));
    setLaeuft(true);
    setZeilen(liste.map((page) => ({ page, stand: "wartet" as const })));
    setTageslimitErreicht(false);

    for (const seite of liste) {
      setZeilen((z) =>
        z.map((r) => (r.page.id === seite.id ? { ...r, stand: "laeuft" } : r)),
      );
      const res = await kiSeo({ page_id: seite.id, sprache });
      if (!res.ok) {
        if (res.status === 429) {
          // Tageslimit erreicht: den Lauf ANHALTEN, nicht weiter gegen die
          // Wand laufen lassen — der Rest bleibt sichtbar „wartet".
          setTageslimitErreicht(true);
          break;
        }
        setZeilen((z) =>
          z.map((r) =>
            r.page.id === seite.id
              ? { ...r, stand: "fehler", fehler: res.error }
              : r,
          ),
        );
        continue;
      }
      const patch: { seo_title?: string; seo_description?: string } = {};
      if (!seite.seo_title?.trim()) patch.seo_title = res.data.seo_title;
      if (!seite.seo_description?.trim())
        patch.seo_description = res.data.seo_description;
      const gespeichert = await updatePage(seite.id, patch);
      if (!gespeichert.ok) {
        setZeilen((z) =>
          z.map((r) =>
            r.page.id === seite.id
              ? { ...r, stand: "fehler", fehler: gespeichert.error }
              : r,
          ),
        );
        continue;
      }
      void kiHerkunftSetzen({
        tabelle: "site_pages",
        zeilen_id: seite.id,
        herkunft: "ai_generated",
        modell: res.data.modell,
      });
      setZeilen((z) =>
        z.map((r) => (r.page.id === seite.id ? { ...r, stand: "erledigt" } : r)),
      );
    }

    setLaeuft(false);
    setAbgeschlossen(true);
    router.refresh();
  }

  const erledigt = zeilen.filter((z) => z.stand === "erledigt").length;
  const fehlerhaft = zeilen.filter((z) => z.stand === "fehler").length;
  const restlich = kandidaten.length - MAX_LAUF;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={oeffnen}
        className="gap-1.5"
      >
        <Icon icon="solar:magic-stick-3-linear" className="size-4" />
        {t("alleSeitenKnopf", { anzahl: kandidaten.length })}
      </Button>

      {offen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("alleSeitenTitel")}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !laeuft && setOffen(false)}
        >
          <div
            className="flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-(--radius) border border-border bg-background shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
              <div>
                <h2 className="font-display text-lg font-extrabold">
                  {t("alleSeitenTitel")}
                </h2>
                <p className="text-xs text-muted-foreground">
                  {t("alleSeitenHinweis")}
                </p>
              </div>
              {!laeuft ? (
                <button
                  type="button"
                  aria-label={t("alleSeitenSchliessen")}
                  onClick={() => setOffen(false)}
                  className="text-muted-foreground transition hover:text-foreground"
                >
                  <Icon icon="ph:x" className="size-5" />
                </button>
              ) : null}
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4">
              {zeilen.length === 0 ? (
                <div className="flex flex-col gap-3">
                  {sprachen.length > 1 ? (
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="text-xs font-medium">
                        {t("seoSprache")}
                      </span>
                      <NativeSelect
                        value={sprache}
                        onChange={(e) => setSprache(e.target.value)}
                      >
                        {sprachen.map((s) => (
                          <option key={s} value={s}>
                            {s.toUpperCase()}
                          </option>
                        ))}
                      </NativeSelect>
                    </label>
                  ) : null}

                  {restlich > 0 ? (
                    <p className="rounded-(--radius) bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                      {t("alleSeitenObergrenze", {
                        max: MAX_LAUF,
                        rest: restlich,
                      })}
                    </p>
                  ) : null}

                  <ul className="flex flex-col gap-1">
                    {kandidaten.map((p) => (
                      <li key={p.id}>
                        <label className="flex items-center gap-2 rounded-(--radius) px-2 py-1.5 text-sm hover:bg-secondary/60">
                          <input
                            type="checkbox"
                            checked={ausgewaehlt.has(p.id)}
                            onChange={(e) =>
                              setAusgewaehlt((s) => {
                                const neu = new Set(s);
                                if (e.target.checked) neu.add(p.id);
                                else neu.delete(p.id);
                                return neu;
                              })
                            }
                            className="size-4"
                          />
                          <span className="min-w-0 flex-1 truncate">
                            {p.title}
                          </span>
                          <span className="shrink-0 truncate text-xs text-muted-foreground">
                            /{p.slug}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {tageslimitErreicht ? (
                    <p className="rounded-(--radius) bg-destructive/10 px-3 py-2 text-xs text-destructive">
                      {t("alleSeitenTageslimit")}
                    </p>
                  ) : null}
                  <ul className="flex flex-col gap-1">
                    {zeilen.map((z) => (
                      <li
                        key={z.page.id}
                        className="flex items-center gap-2 px-2 py-1.5 text-sm"
                      >
                        <Icon
                          icon={
                            z.stand === "erledigt"
                              ? "ph:check-circle-fill"
                              : z.stand === "fehler"
                                ? "ph:x-circle-fill"
                                : z.stand === "laeuft"
                                  ? "svg-spinners:180-ring"
                                  : "ph:circle-dashed"
                          }
                          className={
                            "size-4 shrink-0 " +
                            (z.stand === "erledigt"
                              ? "text-emerald-600"
                              : z.stand === "fehler"
                                ? "text-destructive"
                                : "text-muted-foreground")
                          }
                        />
                        <span className="min-w-0 flex-1 truncate">
                          {z.page.title}
                        </span>
                        {z.fehler ? (
                          <span className="shrink-0 truncate text-xs text-destructive">
                            {z.fehler}
                          </span>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                  {abgeschlossen ? (
                    <p className="text-sm font-medium">
                      {t("alleSeitenFertig", {
                        erledigt,
                        gesamt: zeilen.length,
                        fehler: fehlerhaft,
                      })}
                    </p>
                  ) : null}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-border px-5 py-3">
              {zeilen.length === 0 ? (
                <Button
                  type="button"
                  disabled={ausgewaehlt.size === 0}
                  onClick={() => void starten()}
                  className="gap-1.5"
                >
                  <Icon icon="solar:magic-stick-3-linear" className="size-4" />
                  {t("alleSeitenStart", { anzahl: ausgewaehlt.size })}
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  disabled={laeuft}
                  onClick={() => setOffen(false)}
                >
                  {t("alleSeitenSchliessen")}
                </Button>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

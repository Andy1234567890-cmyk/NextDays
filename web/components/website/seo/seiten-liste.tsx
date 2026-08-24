"use client";

// SEO/AEO → Seiten (0430): Titel und Beschreibung JE SEITE.
//
// Das ist der Teil, der wirklich zählt. Hostaway schreibt es selbst in seine
// Hilfe: „it is best practice for each page of your site to have a unique title
// and description" — und stellt dafür eine Tabelle bereit, weil man sonst durch
// zehn Seiten klicken müsste.
//
// Die Liste zeigt für jede Seite sofort, WAS FEHLT. Das ist der Grund, warum es
// nicht nur die Felder in der Seiten-Einstellung gibt: eine Website mit zwölf
// Seiten hat typischerweise drei gepflegte und neun leere, und ohne Übersicht
// findet niemand die neun.
//
// Ein „Alles mit KI erzeugen"-Knopf, wie Hostaway ihn hat, steht hier
// ABSICHTLICH nicht: er erzeugt für jede Seite einen plausiblen Satz, und
// danach sieht die Liste vollständig aus. Was drin steht, hat dann niemand
// gelesen — bei dem Text, mit dem die Seite in Google auftritt.
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import type { Branding } from "@/lib/site-config";
import { type Page, updatePage } from "@/lib/site-pages";

import { EinstellungenKopf } from "../einstellungen/rahmen";
import { SeoTextFeld, empfehlungFuer } from "./felder";

/** Was an einer Seite noch fehlt — für die Kennzeichnung in der Liste. */
function fehlt(seite: Page): ("titel" | "beschreibung")[] {
  const out: ("titel" | "beschreibung")[] = [];
  if (!seite.seo_title?.trim()) out.push("titel");
  if (!seite.seo_description?.trim()) out.push("beschreibung");
  return out;
}

function SeitenZeile({
  seite,
  branding,
  offen,
  onOeffnen,
}: {
  seite: Page;
  branding: Branding;
  offen: boolean;
  onOeffnen: () => void;
}) {
  const t = useTranslations("website");
  const [entwurf, setEntwurf] = useState<Page>(seite);
  const [speichert, starte] = useTransition();

  const luecken = fehlt(seite);
  const geaendert =
    entwurf.seo_title !== seite.seo_title ||
    entwurf.seo_description !== seite.seo_description ||
    entwurf.seo_keywords !== seite.seo_keywords ||
    entwurf.canonical_url !== seite.canonical_url ||
    entwurf.noindex !== seite.noindex;

  return (
    <li className="rounded-(--radius) border border-border">
      <button
        type="button"
        onClick={onOeffnen}
        aria-expanded={offen}
        className="flex w-full items-start justify-between gap-4 px-4 py-3 text-left"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">
            {seite.title}
            {seite.is_home ? (
              <span className="pl-2 text-xs font-normal text-muted-foreground">
                {t("seo.seiten.startseite")}
              </span>
            ) : null}
          </p>
          <p className="truncate pt-1 font-mono text-xs text-muted-foreground">
            /{seite.slug}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {/* Entwürfe stehen ohnehin nicht im Index — das zu kennzeichnen
              verhindert, dass jemand ihre SEO-Felder für den Grund hält,
              warum die Seite nicht gefunden wird. */}
          {seite.is_published ? null : (
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
              {t("seo.seiten.entwurf")}
            </span>
          )}
          {seite.noindex ? (
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs">
              {t("seo.seiten.nichtIndexiert")}
            </span>
          ) : null}
          {luecken.length > 0 ? (
            <span className="text-xs font-medium text-destructive">
              {luecken.length === 2
                ? t("seo.seiten.fehltBeides")
                : luecken[0] === "titel"
                  ? t("seo.seiten.fehltTitel")
                  : t("seo.seiten.fehltBeschreibung")}
            </span>
          ) : (
            <span className="text-xs text-muted-foreground">
              {t("seo.seiten.gepflegt")}
            </span>
          )}
        </div>
      </button>

      {offen ? (
        <div className="flex flex-col gap-4 border-t border-border p-4">
          <SeoTextFeld
            label={t("seo.felder.titel")}
            wert={entwurf.seo_title}
            platzhalter={seite.title}
            empfehlung={empfehlungFuer("titel")}
            maxLength={200}
            rueckfall={branding.seo_title}
            rueckfallLabel={t("seo.felder.rueckfall")}
            onWert={(v) => setEntwurf((e) => ({ ...e, seo_title: v }))}
          />
          <SeoTextFeld
            label={t("seo.felder.beschreibung")}
            wert={entwurf.seo_description}
            empfehlung={empfehlungFuer("beschreibung")}
            maxLength={500}
            mehrzeilig
            rueckfall={branding.seo_description}
            rueckfallLabel={t("seo.felder.rueckfall")}
            onWert={(v) => setEntwurf((e) => ({ ...e, seo_description: v }))}
          />
          <SeoTextFeld
            label={t("seo.felder.keywords")}
            wert={entwurf.seo_keywords}
            maxLength={500}
            rueckfall={branding.seo_keywords}
            rueckfallLabel={t("seo.felder.rueckfall")}
            onWert={(v) => setEntwurf((e) => ({ ...e, seo_keywords: v }))}
          />
          <SeoTextFeld
            label={t("seo.felder.canonical")}
            hinweis={t("seo.felder.canonicalHinweis")}
            wert={entwurf.canonical_url}
            maxLength={500}
            onWert={(v) => setEntwurf((e) => ({ ...e, canonical_url: v }))}
          />

          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={entwurf.noindex}
              onChange={(e) =>
                setEntwurf((v) => ({ ...v, noindex: e.target.checked }))
              }
              className="mt-0.5 size-4"
            />
            <span>
              <span className="font-medium">{t("seo.seiten.noindex")}</span>
              <span className="block pt-1 text-xs text-muted-foreground">
                {t("seo.seiten.noindexHinweis")}
              </span>
            </span>
          </label>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={!geaendert || speichert}
              onClick={() =>
                starte(async () => {
                  const res = await updatePage(seite.id, {
                    seo_title: entwurf.seo_title,
                    seo_description: entwurf.seo_description,
                    seo_keywords: entwurf.seo_keywords,
                    canonical_url: entwurf.canonical_url,
                    noindex: entwurf.noindex,
                  });
                  if (!res.ok) {
                    toast.error(res.error);
                    return;
                  }
                  toast.success(t("seo.seiten.gespeichert"));
                })
              }
              className="rounded-(--radius) bg-foreground px-4 py-2 text-sm font-semibold text-background transition disabled:opacity-40"
            >
              {speichert ? t("kopf.speichert") : t("seo.seiten.speichern")}
            </button>
            {/* Der Knopf ist bewusst manuell und nicht automatisch wie auf den
                anderen SEO-Seiten: hier sind mehrere Seiten gleichzeitig offen,
                und eine Autospeicherung würde bei jedem Tippen in einer Zeile
                eine Anfrage für DIESE Seite senden. Wer zwischen zwei Zeilen
                springt, verlöre den Überblick, was schon gespeichert ist. */}
            {geaendert ? (
              <span className="text-xs text-muted-foreground">
                {t("seo.seiten.ungespeichert")}
              </span>
            ) : null}
          </div>
        </div>
      ) : null}
    </li>
  );
}

export function SeoSeitenListe({
  pages,
  branding,
}: {
  pages: Page[];
  branding: Branding;
}) {
  const t = useTranslations("website");
  const [offen, setOffen] = useState<string | null>(null);
  const offeneLuecken = pages.filter((p) => fehlt(p).length > 0).length;

  return (
    <div className="flex flex-col gap-6">
      <EinstellungenKopf
        titel={t("seo.seiten.titel")}
        beschreibung={t("seo.seiten.hinweis")}
      />

      {pages.length === 0 ? (
        <p className="rounded-(--radius) border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          {t("seo.seiten.keine")}
        </p>
      ) : (
        <>
          {/* Die Zahl oben, nicht nur die Markierungen in der Liste: bei zwölf
              Seiten sieht man sonst nicht, ob es um eine Lücke oder um neun
              geht. */}
          <p className="text-sm text-muted-foreground">
            {offeneLuecken === 0
              ? t("seo.seiten.alleGepflegt")
              : t("seo.seiten.offeneLuecken", { anzahl: offeneLuecken })}
          </p>
          <ul className="flex flex-col gap-2">
            {pages.map((seite) => (
              <SeitenZeile
                key={seite.id}
                seite={seite}
                branding={branding}
                offen={offen === seite.id}
                onOeffnen={() =>
                  setOffen((o) => (o === seite.id ? null : seite.id))
                }
              />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

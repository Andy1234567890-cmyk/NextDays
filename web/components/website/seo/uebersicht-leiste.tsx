"use client";

// SEO/AEO → Übersicht (0430): die site-weiten Angaben und die Dateien, die
// daraus entstehen.
//
// Die site-weiten Angaben sind der RÜCKFALL, nicht die Hauptsache. Deshalb
// steht der Hinweis darauf hier oben und nicht im Kleingedruckten: wer nur hier
// etwas einträgt, hat auf allen Seiten denselben Titel — und das ist für
// Suchmaschinen das Kennzeichen einer Website ohne Struktur. Die Arbeit
// passiert unter „Seiten".
//
// Der zweite Teil ist die Dateiliste. Sie ist der einzige Ort, an dem ein
// Betrieb erfährt, dass seine Website eine sitemap.xml, eine robots.txt und
// eine llms.txt ausliefert. Ohne diese Anzeige wäre die Arbeit unsichtbar —
// und niemand käme darauf, die Sitemap in der Google Search Console
// einzureichen, was der eine Schritt ist, der wirklich etwas beschleunigt.
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { type Branding, setBranding } from "@/lib/site-config";

import { EinstellungenKopf } from "../einstellungen/rahmen";
import { Schalter } from "../einstellungen/schalter";
import { SpeicherAnzeige } from "../schale";
import { useAutospeichern } from "../use-autospeichern";
import { SeoAbschnitt, SeoTextFeld, empfehlungFuer } from "./felder";

export function SeoUebersichtLeiste({
  branding,
  liveDomain,
  befunde,
}: {
  branding: Branding;
  /** Aktive Custom-Domain, oder `null`. Ohne sie gibt es die drei Dateien noch
   *  nicht — sie hängen an der Domain, nicht am Baukasten. Dann steht hier ein
   *  Hinweis statt drei toter Links. */
  liveDomain: string | null;
  /** Die Befundliste (Etappe B). Als Element und nicht als Daten, weil diese
   *  Ansicht eine Client-Komponente ist und die Prüfung serverseitig läuft. */
  befunde?: React.ReactNode;
}) {
  const t = useTranslations("website");
  const [entwurf, setEntwurf] = useState<Branding>(branding);
  const [bestaetigt, setBestaetigt] = useState<Branding>(branding);

  const auto = useAutospeichern<Branding>({
    wert: entwurf,
    bestaetigt,
    speichern: async (diff) => {
      const res = await setBranding(diff);
      if (!res.ok) return { ok: false as const, error: res.error };
      return { ok: true as const, data: res.data };
    },
  });

  useEffect(() => {
    if (auto.uebernommen) setBestaetigt(auto.uebernommen);
  }, [auto.uebernommen]);
  useEffect(() => {
    if (auto.fehler) toast.error(auto.fehler);
  }, [auto.fehler]);

  const basis = liveDomain ? `https://${liveDomain}` : null;

  return (
    <div className="flex flex-col gap-8">
      <EinstellungenKopf
        titel={t("seo.uebersicht.titel")}
        beschreibung={t("seo.uebersicht.hinweis")}
        aktion={
          <SpeicherAnzeige
            stand={auto.stand}
            texte={{
              speichert: t("kopf.speichert"),
              gespeichert: t("kopf.gespeichert"),
              fehler: t("kopf.speicherFehler"),
            }}
          />
        }
      />

      {befunde ? (
        <SeoAbschnitt
          titel={t("seo.pruefung.titel")}
          beschreibung={t("seo.pruefung.hinweis")}
        >
          {befunde}
        </SeoAbschnitt>
      ) : null}

      <SeoAbschnitt
        titel={t("seo.uebersicht.metaTitel")}
        beschreibung={t("seo.uebersicht.metaHinweis")}
      >
        <SeoTextFeld
          label={t("seo.felder.titel")}
          hinweis={t("seo.felder.titelHinweis")}
          wert={entwurf.seo_title}
          platzhalter={entwurf.site_name ?? ""}
          empfehlung={empfehlungFuer("titel")}
          maxLength={200}
          onWert={(v) => setEntwurf((e) => ({ ...e, seo_title: v }))}
        />
        <SeoTextFeld
          label={t("seo.felder.beschreibung")}
          hinweis={t("seo.felder.beschreibungHinweis")}
          wert={entwurf.seo_description}
          empfehlung={empfehlungFuer("beschreibung")}
          maxLength={500}
          mehrzeilig
          onWert={(v) => setEntwurf((e) => ({ ...e, seo_description: v }))}
        />
        <SeoTextFeld
          label={t("seo.felder.keywords")}
          hinweis={t("seo.felder.keywordsHinweis")}
          wert={entwurf.seo_keywords}
          maxLength={500}
          onWert={(v) => setEntwurf((e) => ({ ...e, seo_keywords: v }))}
        />
      </SeoAbschnitt>

      <SeoAbschnitt titel={t("seo.uebersicht.indexTitel")}>
        <Schalter
          titel={t("seo.uebersicht.noindex")}
          beschreibung={t("seo.uebersicht.noindexHinweis")}
          an={entwurf.noindex}
          onAn={(v) => setEntwurf((e) => ({ ...e, noindex: v }))}
        />
      </SeoAbschnitt>

      <SeoAbschnitt
        titel={t("seo.uebersicht.tempoTitel")}
        beschreibung={t("seo.uebersicht.tempoHinweis")}
      >
        <Schalter
          titel={t("seo.uebersicht.lazy")}
          beschreibung={t("seo.uebersicht.lazyHinweis")}
          an={entwurf.lazy_loading}
          onAn={(v) => setEntwurf((e) => ({ ...e, lazy_loading: v }))}
        />
        <Schalter
          titel={t("seo.uebersicht.systemschrift")}
          beschreibung={t("seo.uebersicht.systemschriftHinweis")}
          an={entwurf.system_fonts_first}
          onAn={(v) => setEntwurf((e) => ({ ...e, system_fonts_first: v }))}
        />
      </SeoAbschnitt>

      <SeoAbschnitt
        titel={t("seo.uebersicht.dateienTitel")}
        beschreibung={t("seo.uebersicht.dateienHinweis")}
      >
        {basis ? (
          <ul className="flex flex-col gap-2">
            {(
              [
                ["sitemap.xml", "sitemap"],
                ["robots.txt", "robots"],
                ["llms.txt", "llms"],
              ] as const
            ).map(([datei, schluessel]) => (
              <li
                key={datei}
                className="flex flex-wrap items-baseline justify-between gap-2 rounded-(--radius) border border-border px-4 py-3"
              >
                <div className="min-w-0">
                  <a
                    href={`${basis}/${datei}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-sm underline"
                  >
                    /{datei}
                  </a>
                  <p className="pt-1 text-sm text-muted-foreground">
                    {t(`seo.uebersicht.datei.${schluessel}`)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-(--radius) border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            {t("seo.uebersicht.keineDomain")}
          </p>
        )}
        {/* Der Schalter oben nimmt die ganze Website aus dem Index. Dann liefert
            die robots.txt `Disallow: /` und die Sitemap gar nichts — das muss
            hier stehen, sonst klickt jemand auf den Link und findet eine 404,
            deren Grund drei Abschnitte weiter oben steht. */}
        {entwurf.noindex ? (
          <p className="text-sm font-medium text-destructive">
            {t("seo.uebersicht.noindexWarnung")}
          </p>
        ) : null}
      </SeoAbschnitt>
    </div>
  );
}

"use client";

// SEO/AEO → Strukturierte Daten (0430).
//
// Vier Schalter, alle standardmäßig AN. Das ist der Unterschied zu Hostaway:
// dort generiert der Baukasten ein Schema für den Betrieb, und für alles andere
// verweist die Hilfe auf drei fremde Generatoren („Merkle's Technical SEO Schema
// Generator", „Rank Ranger") — den erzeugten Code soll man dann per Hand ins
// Kopf-HTML einer Seite kleben. Genau das ist die Stelle, an der eine Anschrift
// veraltet, ohne dass es jemand merkt.
//
// Hier entsteht das JSON-LD bei jedem Aufruf aus den echten Feldern: dem
// Firmenprofil, dem Seitenpfad, den Objektdaten. Wer umzieht, ändert seine
// Adresse im Konto und das Schema stimmt weiter.
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { type Branding, setBranding } from "@/lib/site-config";

import { EinstellungenKopf } from "../einstellungen/rahmen";
import { Schalter } from "../einstellungen/schalter";
import { SpeicherAnzeige } from "../schale";
import { useAutospeichern } from "../use-autospeichern";
import { SeoAbschnitt } from "./felder";

export function SeoSchemaLeiste({ branding }: { branding: Branding }) {
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

  return (
    <div className="flex flex-col gap-8">
      <EinstellungenKopf
        titel={t("seo.schema.titel")}
        beschreibung={t("seo.schema.hinweis")}
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

      <SeoAbschnitt titel={t("seo.schema.typenTitel")}>
        <Schalter
          titel={t("seo.schema.organization")}
          beschreibung={t("seo.schema.organizationHinweis")}
          an={entwurf.schema_organization}
          onAn={(v) => setEntwurf((e) => ({ ...e, schema_organization: v }))}
        />
        <Schalter
          titel={t("seo.schema.lodging")}
          beschreibung={t("seo.schema.lodgingHinweis")}
          an={entwurf.schema_lodging}
          onAn={(v) => setEntwurf((e) => ({ ...e, schema_lodging: v }))}
        />
        <Schalter
          titel={t("seo.schema.breadcrumbs")}
          beschreibung={t("seo.schema.breadcrumbsHinweis")}
          an={entwurf.schema_breadcrumbs}
          onAn={(v) => setEntwurf((e) => ({ ...e, schema_breadcrumbs: v }))}
        />
        <Schalter
          titel={t("seo.schema.faq")}
          beschreibung={t("seo.schema.faqHinweis")}
          an={entwurf.schema_faq}
          onAn={(v) => setEntwurf((e) => ({ ...e, schema_faq: v }))}
        />
      </SeoAbschnitt>

      {/* Die Quelle der Angaben. Sie steht hier, weil der häufigste Grund für
          ein fehlendes Schema keine Einstellung ist, sondern ein leeres
          Firmenprofil — und wer das nicht weiß, dreht am Schalter. */}
      <SeoAbschnitt
        titel={t("seo.schema.quelleTitel")}
        beschreibung={t("seo.schema.quelleHinweis")}
      >
        <a
          href="/konto/profil"
          className="self-start rounded-(--radius) border border-border px-4 py-2 text-sm font-semibold transition hover:bg-secondary"
        >
          {t("seo.schema.quelleKnopf")}
        </a>
      </SeoAbschnitt>
    </div>
  );
}

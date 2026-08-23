"use client";

// Anzeigeeinstellungen der Kunden-Website (0426).
//
// Zwei Schalter, die beide echte Wirkung im Renderer haben — das ist die
// Bedingung, unter der sie hier stehen. Ein Schalter, der nur gespeichert wird,
// ist eine Attrappe: der Kunde stellt etwas ein, sieht keine Änderung und hält
// den Baukasten für kaputt.
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { type Branding, setBranding } from "@/lib/site-config";

import { SpeicherAnzeige } from "../schale";
import { useAutospeichern } from "../use-autospeichern";
import { EinstellungenKopf } from "./rahmen";
import { Schalter } from "./schalter";

export function AnzeigeLeiste({ branding }: { branding: Branding }) {
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
        titel={t("einstellungen.anzeige.titel")}
        beschreibung={t("einstellungen.anzeige.hinweis")}
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

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-base font-extrabold">
          {t("einstellungen.anzeige.suchfeldTitel")}
        </h2>
        <Schalter
          titel={t("einstellungen.anzeige.gaesteAufschluesseln")}
          beschreibung={t("einstellungen.anzeige.gaesteAufschluesselnHinweis")}
          an={entwurf.show_guest_breakdown}
          onAn={(v) => setEntwurf((e) => ({ ...e, show_guest_breakdown: v }))}
        />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-base font-extrabold">
          {t("einstellungen.anzeige.preiseTitel")}
        </h2>
        <Schalter
          titel={t("einstellungen.anzeige.basispreise")}
          beschreibung={t("einstellungen.anzeige.basispreiseHinweis")}
          an={entwurf.show_base_prices}
          onAn={(v) => setEntwurf((e) => ({ ...e, show_base_prices: v }))}
        />
      </section>
    </div>
  );
}

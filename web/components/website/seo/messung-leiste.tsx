"use client";

// SEO/AEO → Messung (0430): die Google-Kennung des Betriebs.
//
// EIN Feld für vier Produkte. Google liefert für Analytics (G-), den Altbestand
// (UA-), Ads (AW-) und Campaign Manager (DC-) dasselbe Skript; welches Produkt
// gemeint ist, entscheidet das Präfix. Vier Felder anzubieten wäre also eine
// erfundene Unterscheidung.
//
// Der Abschnitt darunter ist der eigentliche Punkt: was mit der Zustimmung
// passiert. Hostaways Hilfe räumt für ihren Weg offen ein, dass ein
// Consent-Banner den Code nicht aufhalten kann, wenn er im Kopf-HTML steht
// („Consent management apps are not able to prevent code from running prior to
// consent"). Hier lädt das Skript mit allen Signalen auf „denied" — messen darf
// es erst nach dem Klick im Cookie-Hinweis.
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { type Branding, setBranding } from "@/lib/site-config";

import { EinstellungenKopf } from "../einstellungen/rahmen";
import { SpeicherAnzeige } from "../schale";
import { useAutospeichern } from "../use-autospeichern";
import { SeoAbschnitt, SeoTextFeld } from "./felder";

/** Erlaubte Form einer Google-Kennung. Dieselbe Prüfung steht im Backend-Schema
 *  und als CHECK in der Datenbank — hier, damit der Kunde eine Meldung sieht,
 *  bevor gespeichert wird, und nicht einen 422. */
const GTAG_MUSTER = /^(G|UA|AW|DC)-[A-Za-z0-9-]{4,24}$/;

export function SeoMessungLeiste({ branding }: { branding: Branding }) {
  const t = useTranslations("website");
  const [entwurf, setEntwurf] = useState<Branding>(branding);
  const [bestaetigt, setBestaetigt] = useState<Branding>(branding);

  const kennung = entwurf.gtag_id?.trim() ?? "";
  const formFehler = kennung.length > 0 && !GTAG_MUSTER.test(kennung);

  const auto = useAutospeichern<Branding>({
    // Eine ungültige Kennung wird NICHT gesendet: der Server lehnt sie ab, und
    // die Autospeicherung würde bei jedem getippten Zeichen eine Fehlermeldung
    // zeigen. Stattdessen bleibt der letzte gültige Stand stehen, und unter dem
    // Feld steht, was fehlt.
    wert: formFehler ? bestaetigt : entwurf,
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
        titel={t("seo.messung.titel")}
        beschreibung={t("seo.messung.hinweis")}
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

      <SeoAbschnitt
        titel={t("seo.messung.kennungTitel")}
        beschreibung={t("seo.messung.kennungHinweis")}
      >
        <SeoTextFeld
          label={t("seo.messung.kennung")}
          hinweis={t("seo.messung.kennungFormat")}
          wert={entwurf.gtag_id}
          platzhalter="G-XXXXXXXXXX"
          maxLength={32}
          onWert={(v) => setEntwurf((e) => ({ ...e, gtag_id: v }))}
        />
        {formFehler ? (
          <p className="text-sm font-medium text-destructive">
            {t("seo.messung.kennungFehler")}
          </p>
        ) : null}
      </SeoAbschnitt>

      <SeoAbschnitt
        titel={t("seo.messung.zustimmungTitel")}
        beschreibung={t("seo.messung.zustimmungHinweis")}
      >
        {/* Ohne Cookie-Hinweis gibt es niemanden, der die Zustimmung erteilen
            könnte — dann misst das Skript sofort. Das ist keine Umgehung,
            sondern die Folge einer Entscheidung, die der Betrieb unter
            Einstellungen → Fortgeschritten trifft. Sie muss hier stehen, wo die
            Kennung eingetragen wird. */}
        <div
          className={
            "rounded-(--radius) border px-4 py-3 text-sm " +
            (branding.cookie_banner
              ? "border-border text-muted-foreground"
              : "border-destructive/40 text-foreground")
          }
        >
          {branding.cookie_banner
            ? t("seo.messung.zustimmungAktiv")
            : t("seo.messung.zustimmungFehlt")}
        </div>
        {branding.cookie_banner ? null : (
          <a
            href="/website/einstellungen/erweitert"
            className="self-start rounded-(--radius) border border-border px-4 py-2 text-sm font-semibold transition hover:bg-secondary"
          >
            {t("seo.messung.zumHinweis")}
          </a>
        )}
      </SeoAbschnitt>
    </div>
  );
}

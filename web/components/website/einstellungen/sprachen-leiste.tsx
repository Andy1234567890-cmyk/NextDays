"use client";

// Sprachen der Kunden-Website (0426).
//
// Zwei Entscheidungen an einer Stelle: WELCHE Sprachen die Website führt, und
// welche davon die Standardsprache ist. Sie gehören zusammen, weil die eine ohne
// die andere keinen Sinn hat — eine Standardsprache, die die Website nicht
// führt, wäre ein Widerspruch (Backend und DB lehnen sie ab).
//
// Warum das überhaupt nötig ist: der Renderer stand bis 0426 auf einem festen
// „de". Eine dänische Website, deren Texte in `da` UND `de` gepflegt waren,
// zeigte ihren Gästen Deutsch. Erst mit dieser Einstellung weiß der Renderer,
// welche Fassung gilt.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { LOCALES, LOCALE_LABELS, type Locale } from "@/i18n/locales";
import { type Branding, setBranding } from "@/lib/site-config";

import { SpeicherAnzeige } from "../schale";
import { useAutospeichern } from "../use-autospeichern";
import { BereichsKopf } from "../bereichs-kopf";

export function SprachenLeiste({ branding }: { branding: Branding }) {
  const t = useTranslations("website");
  const [entwurf, setEntwurf] = useState<Branding>(branding);
  const [bestaetigt, setBestaetigt] = useState<Branding>(branding);

  const auto = useAutospeichern<Branding>({
    wert: entwurf,
    bestaetigt,
    // Die Standardsprache muss in der Liste stehen — sonst antwortet das
    // Backend mit 422. Hier vorab geprüft, damit der Kunde nicht bei jedem
    // Klick einen roten Toast bekommt, während er umsortiert.
    gueltig: (b) =>
      !b.default_language ||
      (b.languages ?? []).includes(b.default_language),
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

  const gefuehrt = entwurf.languages ?? [];
  const standard = entwurf.default_language;

  function umschalten(code: Locale) {
    setEntwurf((e) => {
      const liste = e.languages ?? [];
      const drin = liste.includes(code);
      // Die letzte Sprache lässt sich nicht entfernen: eine Website ohne Sprache
      // ist kein gültiger Zustand, und der Renderer müsste raten.
      if (drin && liste.length === 1) return e;
      const neu = drin
        ? liste.filter((c) => c !== code)
        : // Neue Sprachen hinten anhängen, nicht in Alphabet-Ordnung
          // einsortieren: die Reihenfolge ist die des Sprachwählers auf der
          // Website, und der Kunde soll sie selbst bestimmen können.
          [...liste, code];
      return {
        ...e,
        languages: neu,
        // Gegenzustand (Wurzel 1): war die entfernte Sprache die
        // Standardsprache, muss die Standardsprache mitwandern. Ohne das bliebe
        // ein Verweis auf eine Sprache, die die Website nicht mehr führt — das
        // Backend lehnt es ab, und der Kunde sieht nur einen Fehler ohne Grund.
        default_language:
          e.default_language && neu.includes(e.default_language)
            ? e.default_language
            : (neu[0] ?? null),
      };
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <BereichsKopf
        titel={t("einstellungen.sprachen.titel")}
        beschreibung={t("einstellungen.sprachen.hinweis")}
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

      {gefuehrt.length === 0 ? (
        <p className="rounded-(--radius) border border-border bg-secondary/40 p-4 text-sm text-muted-foreground">
          {t("einstellungen.sprachen.nochKeine")}
        </p>
      ) : null}

      <ul className="divide-y divide-border rounded-(--radius) border border-border">
        {LOCALES.map((code) => {
          const drin = gefuehrt.includes(code);
          const istStandard = standard === code;
          return (
            <li
              key={code}
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
            >
              <label className="flex min-w-0 items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={drin}
                  // Die letzte geführte Sprache bleibt gesetzt — deaktiviert
                  // statt stumm wirkungslos, damit der Kunde sieht, warum der
                  // Klick nichts tut.
                  disabled={drin && gefuehrt.length === 1}
                  onChange={() => umschalten(code)}
                  className="size-4 accent-foreground"
                />
                <span className={drin ? "font-medium" : ""}>
                  {LOCALE_LABELS[code]}
                </span>
                <span className="text-xs uppercase text-muted-foreground">
                  {code}
                </span>
              </label>

              {drin ? (
                istStandard ? (
                  <span className="flex items-center gap-1.5 text-xs font-semibold">
                    <Icon icon="ph:check-circle-fill" className="size-4" />
                    {t("einstellungen.sprachen.standard")}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      setEntwurf((e) => ({ ...e, default_language: code }))
                    }
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    {t("einstellungen.sprachen.zurStandardMachen")}
                  </button>
                )
              ) : null}
            </li>
          );
        })}
      </ul>

      <p className="text-xs text-muted-foreground">
        {t("einstellungen.sprachen.reihenfolgeHinweis")}
      </p>
    </div>
  );
}

"use client";

// Vorlagen-Regeln: acht fertige Regeln zum Übernehmen.
//
// Das ist zugleich der leere Zustand. Wer vor einer leeren Regelliste steht,
// legt keine an — er weiß nicht, wie eine gute Regel aussieht, und ein leerer
// Textbereich sagt es ihm nicht.
//
// Die AUTOMATISCHEN Vorlagen sind standardmäßig AUS. Eine Vorlage ist ein
// Angebot, keine stillschweigende Erlaubnis, an Gäste zu schreiben — wer sie
// übernimmt, soll den Schalter bewusst umlegen.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";

import { Button } from "@nextdays/ui/button";
import type { KiRegelUpsert } from "@/lib/inbox";

/** Die acht Vorlagen. `schluessel` zeigt auf Name und Anweisung im Sprachkatalog
 *  — der Text muss übersetzt sein, sonst bekäme ein dänischer Betrieb deutsche
 *  Anweisungen in seinen Prompt. */
const VORLAGEN: {
  schluessel: string;
  zustellart: KiRegelUpsert["zustellart"];
  eskalation?: boolean;
}[] = [
  { schluessel: "language", zustellart: "entwurf" },
  { schluessel: "allQuestions", zustellart: "entwurf" },
  { schluessel: "houseRules", zustellart: "entwurf" },
  { schluessel: "noDiscounts", zustellart: "entwurf" },
  { schluessel: "accessLate", zustellart: "entwurf" },
  { schluessel: "wifiArrival", zustellart: "automatisch" },
  { schluessel: "localTips", zustellart: "automatisch" },
  { schluessel: "complaints", zustellart: "entwurf", eskalation: true },
];

export function KiVorlagenRegeln({
  onUebernehmen,
  onWeg,
}: {
  onUebernehmen: (vorlage: KiRegelUpsert) => void;
  onWeg: () => void;
}) {
  const t = useTranslations("inbox");

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-medium">{t("kiTemplatesTitle")}</h4>
          <p className="text-xs text-muted-foreground">{t("kiTemplatesHint")}</p>
        </div>
        <button
          type="button"
          onClick={onWeg}
          className="text-muted-foreground hover:text-foreground"
          aria-label={t("kiTemplatesDismiss")}
        >
          <Icon icon="ph:x" className="size-4" />
        </button>
      </div>

      <ul className="flex flex-col divide-y divide-border">
        {VORLAGEN.map((v) => (
          <li key={v.schluessel} className="flex items-start gap-3 py-3">
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium">
                  {t(`kiTemplate_${v.schluessel}_name` as never)}
                </span>
                {v.eskalation ? (
                  <span className="ki-abzeichen-aus rounded-full px-2 py-0.5 text-xs font-medium">
                    {t("kiBadgeEscalation")}
                  </span>
                ) : v.zustellart === "automatisch" ? (
                  <span className="ki-abzeichen-auto rounded-full border px-2 py-0.5 text-xs font-medium">
                    {t("kiBadgeAutomatic")}
                  </span>
                ) : null}
              </div>
              <p className="line-clamp-2 text-xs text-muted-foreground">
                {t(`kiTemplate_${v.schluessel}_text` as never)}
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                onUebernehmen({
                  name: t(`kiTemplate_${v.schluessel}_name` as never),
                  // Automatische und Eskalations-Vorlagen starten AUS.
                  aktiv: v.zustellart === "entwurf" && !v.eskalation,
                  gilt_fuer: "alle",
                  zustellart: v.zustellart,
                  anweisung: t(`kiTemplate_${v.schluessel}_text` as never),
                  ist_eskalation: !!v.eskalation,
                  eskalation_posteingang: !!v.eskalation,
                  benachrichtigen: false,
                  property_ids: [],
                })
              }
            >
              {t("kiTemplateUse")}
            </Button>
          </li>
        ))}
      </ul>
    </section>
  );
}

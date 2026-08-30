"use client";

// Was die Bewertungstexte SAGEN — nicht nur, welche Note sie tragen.
//
// Die Notenstatistik nebenan beantwortet „wie gut ist das Objekt". Sie
// beantwortet nie „warum". Genau das ist die Frage des Betriebs, wenn er auf
// eine 4,1 schaut, und bis hierher blieb sie unbeantwortet.
//
// Zwei Dinge stehen bewusst getrennt:
//   * Die Übersicht (Stimmung, Themen, Verlauf) ist reines Rechnen über
//     gespeicherte Deutungen — sie lädt mit der Seite, kostet nichts.
//   * Die Bilanz je Objekt ist EIN Modellaufruf über bis zu 60 Texte. Sie
//     läuft nur auf Klick. Sie beim Seitenaufruf mitzuziehen hieße, jeden
//     Besuch mit einem Vertex-Aufruf zu bezahlen — für einen Text, den sich
//     niemand jedes Mal neu durchliest.
import { useEffect, useState, useTransition } from "react";
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";

import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import { InfoHinweis } from "@nextdays/ui/info-hinweis";
import { NativeSelect } from "@nextdays/ui/native-select";
import {
  type AiBilanz,
  type AiInsights,
  type AiSentiment,
  type AiThemeCount,
  type QualityProperty,
  reviewAiBilanz,
  reviewAiDeuten,
  reviewAiInsights,
} from "@/lib/reviews";
import { formatDate } from "@/lib/utils";

const ZEITRAEUME = [30, 90, 365] as const;

function vorTagen(tage: number): string {
  const d = new Date();
  d.setDate(d.getDate() - tage);
  return d.toISOString().slice(0, 10);
}

/** Farbe je Stimmung. Bewusst dieselben drei im ganzen Baustein, damit ein
 *  grüner Balken im Verlauf und ein grüner Punkt an einem Thema dasselbe
 *  bedeuten. */
const TON: Record<AiSentiment, string> = {
  positiv: "bg-emerald-500",
  neutral: "bg-muted-foreground/40",
  negativ: "bg-destructive",
};

export function KiAuswertung({
  objekte,
}: {
  /** Die Objekte aus dem Qualitäts-Dashboard — für die Bilanz-Auswahl. Ohne
   *  sie gäbe es nichts auszuwählen, und ein leeres Dropdown wäre eine
   *  Attrappe. */
  objekte: QualityProperty[];
}) {
  const t = useTranslations("reviews");
  const tGemein = useTranslations("common");
  const locale = useLocale();

  const [tage, setTage] = useState<number>(90);
  const [daten, setDaten] = useState<AiInsights | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laedt, startLaden] = useTransition();

  useEffect(() => {
    startLaden(async () => {
      const res = await reviewAiInsights({ from: vorTagen(tage) });
      if (res.ok) {
        setDaten(res.data);
        setFehler(null);
      } else {
        setFehler(res.error);
      }
    });
  }, [tage]);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-1.5 text-sm font-medium">
          {t("aiTitle")}
          <InfoHinweis
            titel={t("aiTitle")}
            text={t("aiHint")}
            ariaLabel={tGemein("explain", { label: t("aiTitle") })}
          />
        </h2>
        <NativeSelect
          value={String(tage)}
          onChange={(e) => setTage(Number(e.target.value))}
          aria-label={t("qualityRange")}
        >
          {ZEITRAEUME.map((n) => (
            <option key={n} value={n}>
              {t("qualityLastDays", { days: n })}
            </option>
          ))}
        </NativeSelect>
      </header>

      {fehler && <Card className="p-4 text-sm text-destructive">{fehler}</Card>}

      {daten && <Uebersicht daten={daten} locale={locale} />}
      {laedt && !daten && (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      )}

      {daten && <Bilanzblock objekte={objekte} tage={tage} />}
    </div>
  );
}

function Uebersicht({ daten, locale }: { daten: AiInsights; locale: string }) {
  const t = useTranslations("reviews");

  // Nichts ausgewertet? Dann sagt der Baustein das und bietet den Nachlauf an,
  // statt leere Balken zu zeigen. Eine leere Auswertung sieht sonst aus wie
  // „keine Beschwerden" — die gefährlichste aller Falschaussagen hier.
  if (daten.ausgewertet === 0) {
    return <NochNichts gesamt={daten.gesamt} />;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Der Anteil zuerst: eine Themenrangliste aus 12 von 400 Bewertungen
          ist keine Aussage über das Objekt, und das muss man sehen können,
          bevor man die Rangliste liest. */}
      <p className="text-xs text-muted-foreground">
        {t("aiBasis", { ausgewertet: daten.ausgewertet, gesamt: daten.gesamt })}
      </p>

      <div className="grid gap-3 sm:grid-cols-3">
        <StimmungsKachel
          label={t("aiPositive")}
          anzahl={daten.positiv}
          von={daten.ausgewertet}
          ton="positiv"
        />
        <StimmungsKachel
          label={t("aiNeutral")}
          anzahl={daten.neutral}
          von={daten.ausgewertet}
          ton="neutral"
        />
        <StimmungsKachel
          label={t("aiNegative")}
          anzahl={daten.negativ}
          von={daten.ausgewertet}
          ton="negativ"
        />
      </div>

      {daten.themen.length > 0 && (
        <Card className="flex flex-col gap-3 p-5">
          <h3 className="text-sm font-medium">{t("aiThemes")}</h3>
          <div className="flex flex-col gap-2.5">
            {daten.themen.map((th) => (
              <Themenzeile key={th.thema} thema={th} />
            ))}
          </div>
        </Card>
      )}

      {daten.series.length > 0 && (
        <Card className="flex flex-col gap-3 p-5">
          <h3 className="text-sm font-medium">{t("aiTrend")}</h3>
          {/* Gestapelte Balken statt einer Linie: die Frage ist nicht „wie
              hoch war die Stimmung", sondern „wie viele waren negativ" — eine
              gemittelte Stimmungslinie würde zwei negative unter zwanzig
              positiven unsichtbar machen. */}
          <div className="flex h-28 items-end gap-0.5">
            {daten.series.map((p) => {
              const summe = p.positiv + p.neutral + p.negativ;
              return (
                <span
                  key={p.date}
                  title={`${formatDate(p.date, locale)} · ${t("aiDayCounts", {
                    positiv: p.positiv,
                    neutral: p.neutral,
                    negativ: p.negativ,
                  })}`}
                  className="flex h-full flex-1 flex-col justify-end"
                  style={{ minWidth: "2px" }}
                >
                  {(["negativ", "neutral", "positiv"] as const).map((art) =>
                    p[art] > 0 ? (
                      <span
                        key={art}
                        className={TON[art]}
                        style={{ height: `${(p[art] / summe) * 100}%` }}
                      />
                    ) : null,
                  )}
                </span>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

/** Ein Thema mit seinen drei Richtungen als geteilter Balken.
 *
 *  Die Aufteilung ist der Punkt: „Lage: 40-mal genannt" sagt nichts, „Lage:
 *  38 positiv, 2 negativ" ist ein Befund. Ein Balken, der nur die Häufigkeit
 *  zeigt, ließe ein gelobtes Objekt wie ein bemängeltes aussehen. */
function Themenzeile({ thema }: { thema: AiThemeCount }) {
  const t = useTranslations("reviews");
  const summe = thema.positiv + thema.neutral + thema.negativ;
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 shrink-0 text-sm text-muted-foreground">
        {t(`aiTheme.${thema.thema}`)}
      </span>
      <span className="flex h-2 flex-1 overflow-hidden rounded-full bg-secondary">
        {(["positiv", "neutral", "negativ"] as const).map((art) =>
          thema[art] > 0 ? (
            <span
              key={art}
              className={TON[art]}
              style={{ width: `${(thema[art] / summe) * 100}%` }}
              title={`${t(`ai${art === "positiv" ? "Positive" : art === "neutral" ? "Neutral" : "Negative"}`)}: ${thema[art]}`}
            />
          ) : null,
        )}
      </span>
      <span className="w-8 shrink-0 text-right text-sm tabular-nums">{summe}</span>
    </div>
  );
}

function StimmungsKachel({
  label,
  anzahl,
  von,
  ton,
}: {
  label: string;
  anzahl: number;
  von: number;
  ton: AiSentiment;
}) {
  const farbe =
    ton === "positiv"
      ? "text-emerald-600"
      : ton === "negativ"
        ? "text-destructive"
        : "";
  return (
    <Card className="flex flex-col gap-1 p-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="flex items-baseline gap-1">
        <span className={`text-2xl font-semibold ${farbe}`}>{anzahl}</span>
        <span className="text-sm text-muted-foreground">/ {von}</span>
      </span>
    </Card>
  );
}

/** Noch keine Auswertung. Statt leerer Balken: sagen, was fehlt, und den
 *  Nachlauf anbieten. */
function NochNichts({ gesamt }: { gesamt: number }) {
  const t = useTranslations("reviews");
  const [meldung, setMeldung] = useState<string | null>(null);
  const [laeuft, starte] = useTransition();

  return (
    <Card className="flex flex-col items-start gap-3 p-6">
      <p className="text-sm text-muted-foreground">
        {gesamt === 0 ? t("aiNoReviews") : t("aiNotYetAnalysed", { count: gesamt })}
      </p>
      {gesamt > 0 && (
        <>
          <Button
            variant="outline"
            disabled={laeuft}
            onClick={() =>
              starte(async () => {
                const res = await reviewAiDeuten();
                setMeldung(
                  res.ok
                    ? t("aiRunDone", {
                        count: res.data.gedeutet,
                        errors: res.data.fehler,
                      })
                    : res.error,
                );
              })
            }
          >
            <Icon icon="ph:sparkle" className="size-4" />
            {laeuft ? t("aiRunning") : t("aiRunNow")}
          </Button>
          {meldung && <p className="text-sm">{meldung}</p>}
        </>
      )}
    </Card>
  );
}

/** Die Verbesserungs-Bilanz eines Objekts — ein Modellaufruf auf Klick. */
function Bilanzblock({
  objekte,
  tage,
}: {
  objekte: QualityProperty[];
  tage: number;
}) {
  const t = useTranslations("reviews");
  const [objektId, setObjektId] = useState<string>(
    objekte[0]?.property_id ?? "",
  );
  const [bilanz, setBilanz] = useState<AiBilanz | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, starte] = useTransition();

  if (objekte.length === 0) return null;

  return (
    <Card className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <h3 className="text-sm font-medium">{t("aiBilanzTitle")}</h3>
          <p className="text-xs text-muted-foreground">{t("aiBilanzHint")}</p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <NativeSelect
            value={objektId}
            onChange={(e) => {
              setObjektId(e.target.value);
              // Die alte Bilanz gehört zum alten Objekt. Sie stehen zu lassen
              // wäre eine Aussage über das falsche Haus (Wurzel 1: eine
              // Auswahl, die einen Inhalt gegenstandslos macht, räumt ihn ab).
              setBilanz(null);
              setFehler(null);
            }}
            aria-label={t("aiBilanzProperty")}
          >
            {objekte.map((o) => (
              <option key={o.property_id} value={o.property_id}>
                {o.title ?? o.property_id}
              </option>
            ))}
          </NativeSelect>
          <Button
            disabled={laeuft || !objektId}
            onClick={() =>
              starte(async () => {
                const res = await reviewAiBilanz(objektId, {
                  from: vorTagen(tage),
                });
                if (res.ok) {
                  setBilanz(res.data);
                  setFehler(null);
                } else {
                  setBilanz(null);
                  setFehler(res.error);
                }
              })
            }
          >
            <Icon icon="ph:sparkle" className="size-4" />
            {laeuft ? t("aiBilanzRunning") : t("aiBilanzRun")}
          </Button>
        </div>
      </div>

      {fehler && <p className="text-sm text-destructive">{fehler}</p>}

      {bilanz && (
        <div className="flex flex-col gap-4 border-t border-border pt-4">
          {/* Die Grundlage zuerst, nicht als Fußnote: eine Empfehlung aus
              sechs Texten ist etwas anderes als eine aus sechzig, und wer
              danach handelt, muss das wissen. */}
          <p className="text-xs text-muted-foreground">
            {t("aiBilanzBasis", { count: bilanz.grundlage })}
          </p>
          {bilanz.zusammenfassung && (
            <p className="text-sm">{bilanz.zusammenfassung}</p>
          )}
          <div className="grid gap-4 sm:grid-cols-3">
            <Liste
              titel={t("aiStrengths")}
              icon="ph:thumbs-up"
              farbe="text-emerald-600"
              eintraege={bilanz.staerken}
            />
            <Liste
              titel={t("aiWeaknesses")}
              icon="ph:thumbs-down"
              farbe="text-destructive"
              eintraege={bilanz.schwaechen}
            />
            <Liste
              titel={t("aiRecommendations")}
              icon="ph:lightbulb"
              farbe="text-amber-600"
              eintraege={bilanz.empfehlungen}
            />
          </div>
        </div>
      )}
    </Card>
  );
}

function Liste({
  titel,
  icon,
  farbe,
  eintraege,
}: {
  titel: string;
  icon: string;
  farbe: string;
  eintraege: string[];
}) {
  const t = useTranslations("reviews");
  return (
    <div className="flex flex-col gap-2">
      <h4 className="flex items-center gap-1.5 text-xs font-medium">
        <Icon icon={icon} className={`size-4 ${farbe}`} />
        {titel}
      </h4>
      {eintraege.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("aiNothingFound")}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {eintraege.map((e) => (
            <li key={e} className="text-sm leading-snug">
              {e}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

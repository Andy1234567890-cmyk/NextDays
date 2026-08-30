"use client";

// Qualitäts-Dashboard: Kennzahlen, Tagesverlauf, Kategorien und die Rangliste
// der Objekte über einen wählbaren Zeitraum.
//
// Beide Skalen sind serverseitig auf 5 Sterne normalisiert, damit ein
// Booking-Zehntel und eine myBestDays-Note im selben Verlauf stehen dürfen.
// Tage ohne Bewertung haben KEINEN Wert — die Linie bricht dort ab, statt auf
// null zu fallen und einen Einbruch vorzutäuschen.
import { useEffect, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";

import { Card } from "@nextdays/ui/card";
import { InfoHinweis } from "@nextdays/ui/info-hinweis";
import { NativeSelect } from "@nextdays/ui/native-select";
import { channelLabelLoose, channelLogoLoose } from "@/lib/channel-logos";
import { KiAuswertung } from "./ki-auswertung";
import { type CategoryScore, type QualityDashboard, reviewQuality } from "@/lib/reviews";
import { formatDate } from "@/lib/utils";

// Kategorien mit Übersetzung; alles andere erscheint als Rohschlüssel des
// Kanals, statt als MISSING_MESSAGE die Zeile zu zerlegen.
const KATEGORIEN = new Set([
  "cleanliness", "communication", "location", "value", "accuracy", "checkin",
  "clean", "comfort", "facilities", "staff", "services",
]);

const ZEITRAEUME = [7, 30, 90, 365] as const;

function vorTagen(tage: number): string {
  const d = new Date();
  d.setDate(d.getDate() - tage);
  return d.toISOString().slice(0, 10);
}

export function Qualitaet({ initial }: { initial: QualityDashboard }) {
  const t = useTranslations("reviews");
  // aria-Label des Info-Punkts: app-weit dieselbe Formulierung, deshalb aus
  // `common` und nicht je Fläche neu erfunden.
  const tGemein = useTranslations("common");
  const locale = useLocale();
  const [daten, setDaten] = useState(initial);
  const [tage, setTage] = useState<number>(30);
  const [fehler, setFehler] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const [erstLauf, setErstLauf] = useState(true);
  useEffect(() => {
    if (erstLauf) {
      setErstLauf(false);
      return;
    }
    startTransition(async () => {
      const res = await reviewQuality({ from: vorTagen(tage) });
      if (res.ok) {
        setDaten(res.data);
        setFehler(null);
      } else {
        setFehler(res.error);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tage]);

  // Unbeantwortete über alle Objekte. Die Rangliste führt sie je Objekt; die
  // Kachel braucht die Summe, und sie zweimal aus verschiedenen Quellen zu
  // holen wäre eine Gelegenheit, dass sie auseinanderlaufen.
  const offen = daten.by_property.reduce((s, o) => s + o.unanswered, 0);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{t("qualityTitle")}</h1>
          <p className="text-sm text-muted-foreground">
            {formatDate(daten.from_date, locale)} – {formatDate(daten.to_date, locale)}
          </p>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">
            {t("qualityRange")}
          </span>
          <NativeSelect
            value={String(tage)}
            onChange={(e) => setTage(Number(e.target.value))}
          >
            {ZEITRAEUME.map((n) => (
              <option key={n} value={n}>
                {t("qualityLastDays", { days: n })}
              </option>
            ))}
          </NativeSelect>
        </label>
      </header>

      {fehler && <Card className="p-4 text-sm text-destructive">{fehler}</Card>}

      <div className="grid gap-3 sm:grid-cols-4">
        <Kachel
          label={t("kpiAverage")}
          wert={daten.average_5 == null ? "–" : daten.average_5.toFixed(2)}
        />
        <Kachel label={t("kpiCount")} wert={String(daten.count)} />
        <Kachel
          label={t("qualityFiveStar")}
          wert={
            daten.five_star_rate == null
              ? "–"
              : `${Math.round(daten.five_star_rate * 100)} %`
          }
        />
        {/* Als ANTEIL, nicht als Quote: „155 / 175 beantwortet" sagt sofort,
            wie viel Arbeit offen ist. „89 %" verlangt Kopfrechnen, und bei
            vier Bewertungen behaupten 75 % eine Genauigkeit, die es nicht
            gibt. Der Ton warnt erst, wenn wirklich etwas liegen bleibt. */}
        <Kachel
          label={t("qualityAnswered")}
          wert={String(daten.count - offen)}
          von={daten.count}
          ton={offen === 0 ? "gut" : offen > daten.count / 4 ? "warnung" : undefined}
        />
      </div>

      {daten.categories.length > 0 && (
        <Card className="flex flex-col gap-3 p-5">
          <h2 className="text-sm font-medium">{t("qualityCategories")}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {daten.categories.map((c) => (
              <Kategoriezeile key={c.key} kategorie={c} />
            ))}
          </div>
        </Card>
      )}

      <Verlauf daten={daten} />

      <KiAuswertung objekte={daten.by_property} />

      {daten.by_property.length > 0 && (
        <Card className="flex flex-col gap-3 p-5">
          {/* Wie die Liste sortiert ist („Das schwächste Objekt steht oben"),
              steckt hinter dem „i" an der Überschrift statt als eigene Zeile
              darunter. `InfoHinweis` ist ein Popover, kein Tooltip: es öffnet
              auf Klick und ist damit auch auf dem Tablet erreichbar. */}
          <h2 className="flex items-center gap-1.5 text-sm font-medium">
            {t("qualityByProperty")}
            <InfoHinweis
              titel={t("qualityByProperty")}
              text={t("qualityByPropertyHint")}
              ariaLabel={tGemein("explain", { label: t("qualityByProperty") })}
            />
          </h2>
          <div className="flex flex-col gap-2">
            {daten.by_property.map((o) => (
              <div
                key={o.property_id}
                className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-2 text-sm first:border-0 first:pt-0"
              >
                <span className="min-w-0 flex-1 truncate">
                  {o.title ?? o.property_id}
                </span>
                <span className="text-muted-foreground">
                  {t("qualityReviewCount", { count: o.count })}
                </span>
                {o.unanswered > 0 && (
                  <span className="text-amber-600">
                    {t("qualityOpen", { count: o.unanswered })}
                  </span>
                )}
                <span className="w-12 text-right font-medium">
                  {o.average_5 == null ? "–" : o.average_5.toFixed(2)}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {pending && <p className="text-sm text-muted-foreground">{t("loading")}</p>}
    </div>
  );
}

/** Eine Kategorie mit ihrem Wert UND den Kanälen, aus denen er stammt.
 *
 *  Die Logos sind nicht Zierde. Kategorien sind je Portal verschieden:
 *  „Comfort", „Facilities" und „Staff" gibt es nur bei Booking.com, „Accuracy"
 *  und „Checkin" nur bei Airbnb. Ein Durchschnitt über verschiedene
 *  Grundgesamtheiten ohne diesen Hinweis behauptet Vergleichbarkeit, die es
 *  nicht gibt — bis hierher zeigten wir genau das. */
function Kategoriezeile({ kategorie: c }: { kategorie: CategoryScore }) {
  const t = useTranslations("reviews");
  return (
    <div className="flex items-center gap-3">
      <span className="w-36 shrink-0 text-sm text-muted-foreground">
        {KATEGORIEN.has(c.key) ? t(`category.${c.key}`) : c.key}
      </span>
      <span className="h-1 flex-1 overflow-hidden rounded-full bg-secondary">
        <span
          className="block h-full rounded-full bg-foreground"
          style={{ width: `${(c.score / 5) * 100}%` }}
        />
      </span>
      <Kanalherkunft kanaele={c.channels} />
      <span className="w-10 shrink-0 text-right text-sm">{c.score.toFixed(2)}</span>
    </div>
  );
}

/** Die Kanäle hinter einer Kennzahl, als echte Portal-Logos.
 *
 *  Kein generisches Ersatz-Icon für unbekannte Kanäle (Nutzer-Vorgabe): wer
 *  kein Logo hat, erscheint als Kürzel. Der `title` nennt alle Kanäle im
 *  Klartext — die Logos allein sind für einen Screenreader nichts. */
function Kanalherkunft({ kanaele }: { kanaele: string[] }) {
  const t = useTranslations("reviews");
  if (kanaele.length === 0) return null;
  const namen = kanaele.map((k) => channelLabelLoose(k));
  return (
    <span
      className="flex shrink-0 items-center -space-x-1"
      title={t("qualityCategorySources", { channels: namen.join(", ") })}
    >
      {kanaele.map((kanal, i) => {
        const logo = channelLogoLoose(kanal);
        return logo ? (
          // 16px-Portal-Logo aus dem eigenen public/-Ordner. next/image lohnt
          // dafür nicht und brächte einen Optimierungs-Roundtrip je Kachel.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={kanal}
            src={logo}
            alt={namen[i] ?? kanal}
            className="size-4 rounded-full bg-background ring-1 ring-border"
          />
        ) : (
          <span
            key={kanal}
            className="grid size-4 place-items-center rounded-full bg-secondary text-[0.5rem] font-medium ring-1 ring-border"
          >
            {(namen[i] ?? kanal).slice(0, 1).toUpperCase()}
          </span>
        );
      })}
    </span>
  );
}

/** Eine Kennzahl. Mit `von` wird sie zum ANTEIL: „155 / 175" statt „155".
 *
 *  Der Unterschied ist nicht kosmetisch. „155 unbeantwortet" sagt nichts,
 *  solange man nicht weiß, ob es 160 oder 4 000 Bewertungen gibt. Nur der
 *  Zähler ist groß und eingefärbt, der Nenner bleibt klein und grau — man
 *  liest zuerst die Zahl, dann ihren Bezug. */
function Kachel({
  label,
  wert,
  von,
  ton,
}: {
  label: string;
  wert: string;
  von?: number;
  ton?: "gut" | "warnung" | "schlecht";
}) {
  const farbe =
    ton === "gut"
      ? "text-emerald-600"
      : ton === "warnung"
        ? "text-amber-600"
        : ton === "schlecht"
          ? "text-destructive"
          : "";
  return (
    <Card className="flex flex-col gap-1 p-4">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="flex items-baseline gap-1">
        <span className={`text-2xl font-semibold ${farbe}`}>{wert}</span>
        {von != null && (
          <span className="text-sm text-muted-foreground">/ {von}</span>
        )}
      </span>
    </Card>
  );
}

/** Tagesverlauf als schlanke Balken — ein Balken je Tag mit Bewertung.
 *  Bewusst ohne Chart-Bibliothek: eine Skala von 0..5 über ein paar Dutzend
 *  Tage braucht keine. */
function Verlauf({ daten }: { daten: QualityDashboard }) {
  const t = useTranslations("reviews");
  const locale = useLocale();
  const mitWert = daten.series.filter((p) => p.average_5 != null);
  if (mitWert.length === 0) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">{t("qualityNoData")}</Card>
    );
  }
  return (
    <Card className="flex flex-col gap-3 p-5">
      <h2 className="text-sm font-medium">{t("qualityTrend")}</h2>
      <div className="flex h-32 items-end gap-0.5">
        {daten.series.map((p) => (
          <span
            key={p.date}
            title={`${formatDate(p.date, locale)} · ${
              p.average_5 == null ? "–" : p.average_5.toFixed(2)
            }`}
            className="flex-1 rounded-t-sm bg-foreground/80"
            style={{
              // Tage ohne Bewertung bleiben leer statt auf 0 zu fallen.
              height: p.average_5 == null ? 0 : `${(p.average_5 / 5) * 100}%`,
              minWidth: "2px",
            }}
          />
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{formatDate(daten.from_date, locale)}</span>
        <span>{formatDate(daten.to_date, locale)}</span>
      </div>
    </Card>
  );
}

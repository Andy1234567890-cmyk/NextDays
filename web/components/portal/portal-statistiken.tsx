"use client";

// Eigentümer-Portal · Statistiken (pm_nonrevenue_charts, read-only).
//
// WARUM EINE EIGENE ANSICHT UND NICHT `components/reservierungen/stats-cards.tsx`
// oder `components/eigentuemer/reporting/statistik-ansicht.tsx`: beide sind
// Geld-Auswertungen (Umsatz, gezahlte Beträge, Kategorien in Währung). Der
// Eigentümer hat `pm_revenue_charts` NICHT (§4.3) — eine Umsatz-Komponente
// „ohne Geldspalte" wäre dieselbe Fläche mit ausgeblendeter Wahrheit. Diese
// Fläche kennt gar keine Beträge: der Typ `PortalStatisticsResponse` führt kein
// Betrags-, Preis- oder Währungsfeld, also kann hier auch keins auf eine Achse
// geraten.
//
// Wiederverwendet wird ausschließlich die Diagramm-Basis, die das Dashboard
// schon nutzt: recharts + `@nextdays/ui/chart` (ChartContainer/Tooltip) — keine
// neue Abhängigkeit.
//
// Zeitraum und Objekt stehen in der URL: der Server holt die Zahlen, der Client
// schiebt nur die Adresse weiter. So bleibt das Rechnen im Backend (PROJECT.md
// §2) und ein Link auf einen Zeitraum ist teilbar.
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMemo, useTransition } from "react";

import { PortalRealtime } from "@/components/portal/portal-realtime";
import { Card, CardContent } from "@nextdays/ui/card";
import { InfoHinweis } from "@nextdays/ui/info-hinweis";
// ALLES aus EINER Quelle — auch die recharts-Primitiven. Sie direkt aus
// "recharts" zu holen, holt im Monorepo eine ZWEITE Modulinstanz (packages/ui
// und web haben je eine eigene Kopie). recharts reicht die berechnete
// Diagrammgröße über einen React-Context weiter, und der ist an die Instanz
// gebunden: der Provider des `ChartContainer` füllte dann einen Context, den
// `BarChart` nie liest. Ergebnis war ein korrekt bemessener, aber komplett
// leerer Kasten — kein SVG, keine Fehlermeldung. Siehe packages/ui/src/chart.tsx.
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  Pie,
  PieChart,
  XAxis,
  YAxis,
  type ChartConfig,
} from "@nextdays/ui/chart";
import { DatePicker } from "@nextdays/ui/date-picker";
import { Label } from "@nextdays/ui/label";
import { NativeSelect } from "@nextdays/ui/native-select";
import { channelLabelLoose, channelLogoLoose } from "@/lib/channel-logos";
import type { PortalProperty, PortalStatisticsResponse } from "@/lib/portal";

/** Farbtopf der Oberfläche. Die Zuordnung Kanal → Farbe läuft über den
 *  SORTIERTEN Kanalnamen, nicht über die Reihenfolge in der Antwort: sonst wäre
 *  Airbnb im Juli grün und im August violett, sobald ein Kanal ohne Buchung
 *  wegfällt (dieselbe Lehre wie in der Bilanzstatistik). */
const FARBEN = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

function kanalFarbe(kanal: string, sortiert: string[]): string {
  const i = sortiert.indexOf(kanal);
  return FARBEN[(i < 0 ? 0 : i) % FARBEN.length];
}

export function PortalStatistiken({
  properties,
  propertyId,
  von,
  bis,
  statistik,
  error,
}: {
  properties: PortalProperty[];
  /** null = alle zugeordneten Objekte zusammen. */
  propertyId: string | null;
  von: string;
  bis: string;
  statistik: PortalStatisticsResponse | null;
  /** Ladefehler ODER 422 (Zeitraum > 730 Tage) ODER 404 (fremdes Objekt).
   *  Der Grund kommt vom Server und wird wörtlich gezeigt — nicht zu „keine
   *  Daten" verkürzt (Wurzel 4/5). */
  error: string | null;
}) {
  const t = useTranslations("portal.statistics");
  // aria-Label der Info-Punkte: app-weit dieselbe Formulierung, deshalb in
  // `common` und nicht je Fläche neu erfunden.
  const tGemein = useTranslations("common");
  // Rückfall-Namen für Kanäle ohne `ota_name` — derselbe Namensraum wie im
  // Kalender, damit ein Kanal überall gleich heißt.
  const tKalender = useTranslations("calendar");
  const locale = useLocale();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const zahl = useMemo(() => new Intl.NumberFormat(locale), [locale]);
  const zahl1 = useMemo(
    () =>
      new Intl.NumberFormat(locale, {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
      }),
    [locale],
  );
  const monatsFormat = useMemo(
    () => new Intl.DateTimeFormat(locale, { month: "short", year: "2-digit" }),
    [locale],
  );

  const gehe = (naechste: {
    objekt?: string | null;
    von?: string;
    bis?: string;
  }) => {
    const p = new URLSearchParams();
    const objekt =
      naechste.objekt === undefined ? propertyId : naechste.objekt;
    if (objekt) p.set("objekt", objekt);
    p.set("von", naechste.von ?? von);
    p.set("bis", naechste.bis ?? bis);
    startTransition(() => router.push(`/portal/statistiken?${p.toString()}`));
  };

  // „2026-08" → „Aug. 26". Auf den ERSTEN des Monats in UTC gelegt, damit die
  // Zeitzone des Browsers den Monat nicht um einen Tag zurückschiebt.
  const monatsLabel = (monat: string) => {
    const d = new Date(`${monat}-01T00:00:00Z`);
    return Number.isNaN(d.getTime()) ? monat : monatsFormat.format(d);
  };

  const monate = useMemo(
    () =>
      (statistik?.months ?? []).map((m) => ({
        ...m,
        label: monatsLabel(m.month),
      })),
    // monatsLabel hängt nur an monatsFormat.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [statistik, monatsFormat],
  );

  // Ein Kanal-Eintrag, wie ihn die Fläche braucht: EIN stabiler Schlüssel und
  // EIN Anzeigename. `ota_name` hat Vorrang vor `channel` — das ist im Projekt
  // der Weg (components/reservierungen/stats-cards.tsx): `channel` ist der
  // interne Wert („portal", „ota"), `ota_name` der echte Portalname
  // („Booking.com", „myBestDays"), und nur er trägt Logo und Marke.
  const kanaele = useMemo(
    () =>
      [...(statistik?.by_channel ?? [])]
        .map((c) => {
          const key = c.ota_name ?? c.channel;
          return {
            key,
            // Kein blinder t(`channel.${…}`)-Aufruf: ein Backend-Kanalwert ohne
            // Übersetzungskette rendert sonst als MISSING_MESSAGE (CLAUDE.md,
            // Kanal/Enum-Gate). Fehlt der Schlüssel, steht der echte Wert da.
            label: c.ota_name
              ? channelLabelLoose(c.ota_name)
              : tKalender.has(`channel.${c.channel}`)
                ? tKalender(`channel.${c.channel}`)
                : channelLabelLoose(c.channel),
            logo: channelLogoLoose(c.ota_name ?? c.channel),
            reservations: c.reservations,
            nights: c.nights,
          };
        })
        .sort((a, b) => b.reservations - a.reservations),
    [statistik, tKalender],
  );

  // Farbzuordnung über den SORTIERTEN Schlüssel, nicht über die Reihenfolge der
  // Antwort (siehe FARBEN oben).
  const kanaeleSortiert = useMemo(
    () => kanaele.map((c) => c.key).sort((a, b) => a.localeCompare(b)),
    [kanaele],
  );

  const belegungConfig: ChartConfig = {
    occupancy_rate: {
      label: t("charts.occupancyByMonth"),
      color: "var(--chart-1)",
    },
  };
  // Zwei Reihen, gestapelt: die Eigennutzung steckt in der Belegungsquote, also
  // muss sie im Nächte-Diagramm sichtbar sein — sonst erklärt die Kurve die
  // Quote nicht (Auftrag: Eigennutzung getrennt ausweisen).
  const naechteConfig: ChartConfig = {
    nights_booked: { label: t("series.guestNights"), color: "var(--chart-2)" },
    owner_stay_nights: {
      label: t("series.ownerStay"),
      color: "var(--chart-4)",
    },
  };
  const kanalConfig: ChartConfig = Object.fromEntries(
    kanaele.map((c) => [
      c.key,
      { label: c.label, color: kanalFarbe(c.key, kanaeleSortiert) },
    ]),
  );

  /** Kennzahl-Kachel. `null` heißt „nicht berechenbar" und wird zu „—" — nie
   *  zu einer 0 (Wurzel 4). */
  const Kennzahl = ({
    label,
    wert,
    hinweis,
    icon,
  }: {
    label: string;
    wert: string | null;
    hinweis?: string;
    icon: string;
  }) => (
    <Card>
      <CardContent className="flex flex-col gap-1 py-5">
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <Icon icon={icon} className="size-4" />
          {label}
          {/* Die Erklärung steckt hinter dem „i", statt als Absatz unter der
              Zahl zu stehen. Vier Kacheln nebeneinander mit je drei Zeilen
              Fließtext drückten die Zahl — also das, wofür die Kachel da ist —
              optisch an den Rand. `InfoHinweis` ist ein Popover, kein Tooltip:
              es öffnet auf Klick und ist damit auch auf dem Tablet erreichbar
              (packages/ui/src/info-hinweis.tsx). */}
          {hinweis && (
            <InfoHinweis
              titel={label}
              text={hinweis}
              ariaLabel={tGemein("explain", { label })}
            />
          )}
        </span>
        <span className="font-display text-2xl font-extrabold tabular-nums">
          {wert ?? t("noValue")}
        </span>
      </CardContent>
    </Card>
  );

  const hatDaten = statistik !== null && monate.length > 0;

  return (
    <div className="flex flex-col gap-6">
      {/* Belegung und Aufenthalte entstehen aus Reservierungen und
          Verfügbarkeit — beide sind geprüfte Realtime-Quellen. */}
      <PortalRealtime
        quellen={["reservations", "availability"]}
        onChange={() => router.refresh()}
      />

      <header className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-extrabold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
      </header>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-4 py-5">
          {/* Die Objektwahl erscheint NUR, wenn es etwas zu wählen gibt.
              Bei genau einem zugeordneten Objekt sind „Alle Objekte" und
              dieses eine Objekt dieselbe Menge: die Auswahl änderte keine
              einzige Zahl und sah dadurch kaputt aus („ich stelle einen Filter
              ein und sehe trotzdem alles"). Ein Bedienelement, das nichts
              bewirken KANN, ist kein Komfort, sondern eine Falschaussage über
              die Fläche. */}
          {properties.length > 1 && (
            <label className="flex min-w-52 flex-col gap-1.5">
              <Label asChild>
                <span>{t("property")}</span>
              </Label>
              <NativeSelect
                value={propertyId ?? ""}
                disabled={pending}
                onChange={(e) =>
                  gehe({ objekt: e.target.value === "" ? null : e.target.value })
                }
              >
                <option value="">{t("allProperties")}</option>
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </NativeSelect>
            </label>
          )}
          {/* Der DatePicker rendert einen Knopf ohne eigene id — deshalb hier
              ein umschließendes <label> statt eines htmlFor, das ins Leere
              zeigt. */}
          <label className="flex min-w-40 flex-col gap-1.5">
            <Label asChild>
              <span>{t("from")}</span>
            </Label>
            <DatePicker
              value={von}
              onChange={(v) => gehe({ von: v })}
              disabled={pending}
            />
          </label>
          <label className="flex min-w-40 flex-col gap-1.5">
            <Label asChild>
              <span>{t("to")}</span>
            </Label>
            <DatePicker
              value={bis}
              onChange={(v) => gehe({ bis: v })}
              disabled={pending}
            />
          </label>
          {/* Kein Dauerhinweis auf die 730-Tage-Grenze: die Regel steht im
              Backend und meldet sich dort mit einer eigenen 422-Begründung,
              die diese Fläche unten wörtlich anzeigt. Ein zweiter Satz daneben
              wäre eine Kopie derselben Regel, die beim nächsten Ändern der
              Grenze still falsch wird — und er stand permanent da, als sei er
              eine Fehlermeldung. */}
        </CardContent>
      </Card>

      {error ? (
        <div className="rounded-(--radius) border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </div>
      ) : !hatDaten ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
              <Icon icon="ph:chart-bar" className="size-6" />
            </span>
            <p className="text-sm text-muted-foreground">{t("empty")}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* ZWEI BEZUGSGRÖSSEN, getrennt überschrieben. Unbeschriftet läse
              sich das Ergebnis als Widerspruch — „12 Buchungen, aber 400
              Nächte" — obwohl beide Zahlen stimmen: die eine zählt Nächte IM
              Zeitraum, die andere ANREISEN im Zeitraum. */}
          <section className="flex flex-col gap-3">
            <div className="flex flex-col gap-0.5">
              <h2 className="font-display text-xl font-extrabold flex items-center gap-2">
                {t("basis.nightsTitle")}
                <InfoHinweis
                  titel={t("basis.nightsTitle")}
                  text={t("basis.nightsHint")}
                  ariaLabel={tGemein("explain", { label: t("basis.nightsTitle") })}
                />
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Kennzahl
                icon="ph:chart-pie-slice"
                label={t("kpi.occupancy")}
                hinweis={t("kpi.occupancyHint")}
                wert={
                  statistik.occupancy_rate === null
                    ? null
                    : `${zahl1.format(statistik.occupancy_rate)} %`
                }
              />
              <Kennzahl
                icon="ph:bed"
                label={t("kpi.guestNights")}
                wert={zahl.format(statistik.nights_booked)}
              />
              {/* Eigennutzung getrennt: sie belegt den Kalender und zählt in
                  die Quote oben, ist aber keine Vermarktungsleistung. In der
                  Quote allein verschwände die eigene Ferienwoche als
                  „Auslastung". */}
              <Kennzahl
                icon="ph:house-line"
                label={t("kpi.ownerStay")}
                hinweis={t("kpi.ownerStayHint")}
                wert={zahl.format(statistik.owner_stay_nights)}
              />
              <Kennzahl
                icon="ph:stack"
                label={t("kpi.capacity")}
                hinweis={t("kpi.capacityHint", {
                  units: statistik.units_total,
                })}
                wert={zahl.format(statistik.capacity_unit_nights)}
              />
            </div>
          </section>

          <section className="flex flex-col gap-3">
            <div className="flex flex-col gap-0.5">
              <h2 className="font-display text-xl font-extrabold flex items-center gap-2">
                {t("basis.arrivalsTitle")}
                <InfoHinweis
                  titel={t("basis.arrivalsTitle")}
                  text={t("basis.arrivalsHint")}
                  ariaLabel={tGemein("explain", { label: t("basis.arrivalsTitle") })}
                />
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <Kennzahl
                icon="ph:ticket"
                label={t("kpi.bookings")}
                wert={zahl.format(statistik.reservations)}
              />
              <Kennzahl
                icon="ph:moon-stars"
                label={t("kpi.avgStay")}
                hinweis={t("kpi.avgStayHint")}
                wert={
                  statistik.avg_stay_nights === null
                    ? null
                    : `${zahl1.format(statistik.avg_stay_nights)} ${t("units.nights")}`
                }
              />
              {/* Die Vorlaufzeit beruht NUR auf Buchungen mit bekanntem
                  Buchungszeitpunkt (`booked_at`, nie `created_at` — Wurzel 5b).
                  Auf wie vielen, steht dabei: ein Schnitt aus 3 von 40
                  Buchungen ist eine andere Aussage als einer aus 40. */}
              <Kennzahl
                icon="ph:hourglass-medium"
                label={t("kpi.leadTime")}
                hinweis={t("kpi.leadTimeBasis", {
                  count: statistik.avg_lead_time_basis,
                })}
                wert={
                  statistik.avg_lead_time_days === null
                    ? null
                    : `${zahl1.format(statistik.avg_lead_time_days)} ${t("units.days")}`
                }
              />
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardContent className="flex flex-col gap-4 py-5">
                <h2 className="font-display text-lg font-extrabold">
                  {t("charts.occupancyByMonth")}
                </h2>
                <ChartContainer config={belegungConfig} className="h-56 w-full">
                  {/* `top: 16` und die breitere Achse sind kein Geschmack:
                      der oberste Tick heißt „100 %" und wurde bei `top: 8`
                      oben angeschnitten, bei `width={40}` brach er zusätzlich
                      hinter der Zahl um. Beides zusammen ließ die Skala
                      unleserlich aussehen, obwohl die Werte stimmten. */}
                  <BarChart
                    data={monate}
                    margin={{ top: 16, right: 8, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      fontSize={12}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      width={52}
                      fontSize={12}
                      domain={[0, 100]}
                      tickFormatter={(v) => `${v} %`}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value) =>
                            `${zahl1.format(Number(value))} %`
                          }
                        />
                      }
                    />
                    <Bar
                      dataKey="occupancy_rate"
                      fill="var(--chart-1)"
                      radius={4}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="flex flex-col gap-4 py-5">
                <div className="flex flex-col gap-1">
                  <h2 className="flex items-center gap-2 font-display text-lg font-extrabold">
                    {t("charts.nightsByMonth")}
                    <InfoHinweis
                      titel={t("charts.nightsByMonth")}
                      text={t("charts.nightsByMonthHint")}
                      ariaLabel={tGemein("explain", { label: t("charts.nightsByMonth") })}
                    />
                  </h2>
                </div>
                {/* GESTAPELT, nicht nebeneinander und nicht als eine Reihe:
                    beide Anteile zusammen ergeben die Balkenhöhe, die genau
                    die Belegungsquote oben erklärt. Als eine einzige Reihe
                    verschwände die Eigennutzung in der Kurve; nebeneinander
                    verlöre man, dass sie sich zur belegten Nacht addieren. */}
                <ChartContainer config={naechteConfig} className="h-56 w-full">
                  <BarChart
                    data={monate}
                    margin={{ top: 16, right: 8, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid vertical={false} strokeDasharray="3 3" />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                      fontSize={12}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      width={44}
                      fontSize={12}
                      allowDecimals={false}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value, name) =>
                            `${naechteConfig[name as string]?.label ?? name}: ${zahl.format(Number(value))} ${t("units.nights")}`
                          }
                        />
                      }
                    />
                    <Bar
                      dataKey="nights_booked"
                      stackId="naechte"
                      fill="var(--chart-2)"
                      isAnimationActive={false}
                    />
                    <Bar
                      dataKey="owner_stay_nights"
                      stackId="naechte"
                      fill="var(--chart-4)"
                      radius={[4, 4, 0, 0]}
                      isAnimationActive={false}
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                  </BarChart>
                </ChartContainer>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="flex flex-col gap-4 py-5">
              <div className="flex flex-col gap-1">
                <h2 className="flex items-center gap-2 font-display text-lg font-extrabold">
                  {t("charts.bookingsByChannel")}
                  <InfoHinweis
                    titel={t("charts.bookingsByChannel")}
                    text={t("charts.bookingsByChannelHint")}
                    ariaLabel={tGemein("explain", { label: t("charts.bookingsByChannel") })}
                  />
                </h2>
              </div>
              {kanaele.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {t("charts.noChannels")}
                </p>
              ) : (
                <div className="flex flex-col items-center gap-6 sm:flex-row">
                  <ChartContainer
                    config={kanalConfig}
                    className="h-56 w-full sm:w-56"
                  >
                    <PieChart>
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            formatter={(value) =>
                              `${zahl.format(Number(value))} ${t("units.bookings")}`
                            }
                          />
                        }
                      />
                      <Pie
                        data={kanaele}
                        dataKey="reservations"
                        nameKey="key"
                        innerRadius="55%"
                        outerRadius="85%"
                        isAnimationActive={false}
                      >
                        {kanaele.map((c) => (
                          <Cell
                            key={c.key}
                            fill={kanalFarbe(c.key, kanaeleSortiert)}
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ChartContainer>
                  <ul className="flex w-full flex-col gap-2 text-sm">
                    {kanaele.map((c) => (
                        <li
                          key={c.key}
                          className="flex items-center justify-between gap-3"
                        >
                          <span className="flex min-w-0 items-center gap-2">
                            <span
                              className="size-2.5 shrink-0 rounded-full"
                              style={{
                                background: kanalFarbe(c.key, kanaeleSortiert),
                              }}
                            />
                            {/* Echtes Portal-Logo oder gar keins — kein
                                generisches Ersatz-Icon (Regel „Portal-Logos
                                nur echt"). Gesucht wird über `ota_name`, weil
                                nur der echte Portalname eine Marke trägt. */}
                            {c.logo && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={c.logo}
                                alt=""
                                className="size-4 shrink-0 rounded-sm object-contain"
                              />
                            )}
                            <span className="truncate">{c.label}</span>
                          </span>
                          <span className="shrink-0 tabular-nums">
                            {zahl.format(c.reservations)} ·{" "}
                            <span className="text-muted-foreground">
                              {zahl.format(c.nights)} {t("units.nights")}
                            </span>
                          </span>
                        </li>
                      ))}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

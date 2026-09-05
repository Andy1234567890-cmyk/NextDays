"use client";

// Marktkarte: wo dein Preis gegenüber der Umgebung steht.
//
// WAS HIER BEWUSST NICHT STEHT
// ============================
// Keine fremden Objektnamen, keine Links auf fremde Inserate. Gezeigt wird
// je Tag jeder beobachtete Angebotspreis der Region als Punkt (Ort auf ~100 m
// gerundet) und darüber der Median. Ein Punkt sagt „hier kostet eine Nacht X",
// nicht „das ist das Haus von Y". Eine Liste benannter Wettbewerber wäre ein
// anderes Produkt (und rechtlich etwas anderes).
//
// WARUM EINZELPUNKTE UND KEINE TEILGEBIETE
// ========================================
// Die erste Fassung fasste Angebote zu Teilgebieten von ~11 km zusammen und
// zeigte ein Gebiet erst ab fünf Objekten. In Nordjütland fielen damit fast
// alle unter die Schwelle, die Karte blieb an einzelnen Tagen leer — und ein
// Erklärtext auf der leeren Karte wurde vom Nutzer ausdrücklich abgelehnt
// („ich will das es geht"). Seit 04.09.2026: jeder Preis ein Punkt, keine
// Schwelle, an jedem Stichtag.
//
// WARUM GOOGLE MAPS
// =================
// Dieselbe Bibliothek wie die Objekt-Standortkarte (@vis.gl/react-google-maps,
// `googleMaps: true` in next.config.ts, Key in NEXT_PUBLIC_GOOGLE_MAPS_API_KEY).
// Keine zweite Kartentechnik, keine neue CSP-Freigabe.
//
// Fehlt der Key, wird das BENANNT — eine leere graue Fläche sieht aus wie ein
// Defekt (Wurzel 4: kein stiller Ersatz).
import { APIProvider, Map, AdvancedMarker } from "@vis.gl/react-google-maps";
import { useMemo, useState } from "react";

import { Icon } from "@iconify/react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "@nextdays/ui/chart";

import { formatCurrency } from "@/lib/currency";
import type { MarktAngebot, MarktPunkt, MarktStand } from "@/lib/dynamic-pricing";

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

type Props = {
  stand: MarktStand;
  /** Standort des eigenen Objekts — Mitte der Karte und Marker. */
  lat: number | null;
  lng: number | null;
  titel?: string | null;
};

/** Farbe eines Angebots nach seinem Preisniveau in der Region.
    Die Skala ist RELATIV zum gezeigten Tag und zur gezeigten Region, nicht
    absolut: ein Angebot ist „teuer" im Vergleich zu seinen Nachbarn, nicht im
    Vergleich zu Kopenhagen. Grenzen sind die Quartile, nicht Min/Max — ein
    einzelnes Luxushaus für 6 000 DKK würde sonst alle anderen grün färben. */
function angebotsFarbe(preis: number, p25: number, p75: number): string {
  if (p75 <= p25) return "#0891b2";
  const t = (preis - p25) / (p75 - p25);
  if (t < 0) return "#22c55e";
  if (t < 0.33) return "#84cc16";
  if (t < 0.66) return "#eab308";
  if (t <= 1) return "#f97316";
  return "#dc2626";
}

/** Farbe nach Abstand zum Markt: unter Markt = Chance, über Markt = Vorsicht. */
function farbeFuer(abweichungPct: number | null): string {
  if (abweichungPct === null) return "#94a3b8"; // kein Vergleich möglich
  if (abweichungPct <= -20) return "#dc2626"; // deutlich unter Markt
  if (abweichungPct <= -8) return "#f97316";
  if (abweichungPct < 8) return "#16a34a"; // am Markt
  if (abweichungPct < 20) return "#0891b2";
  return "#7c3aed"; // deutlich über Markt
}

function abweichung(p: MarktPunkt): number | null {
  if (p.eigener_preis === null || p.markt_median <= 0) return null;
  return ((p.eigener_preis - p.markt_median) / p.markt_median) * 100;
}

/** Quartilsgrenzen der gezeigten Angebote (für die Farbskala). */
function quartile(werte: number[]): readonly [number, number] {
  if (werte.length === 0) return [0, 0] as const;
  const s = [...werte].sort((a, b) => a - b);
  return [s[Math.floor(s.length / 4)], s[Math.floor((s.length * 3) / 4)]] as const;
}

export function MarktKarte({ stand, lat, lng, titel }: Props) {
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  const waehrung = stand.waehrung ?? "";

  const punkt = useMemo(() => {
    if (gewaehlt) return stand.verlauf.find((p) => p.tag === gewaehlt) ?? null;
    return stand.verlauf[0] ?? null;
  }, [gewaehlt, stand.verlauf]);

  const abw = punkt ? abweichung(punkt) : null;

  // Die Zeitleiste: ein Punkt je Stichtag, Farbe = Abstand des eigenen
  // Preises zum Markt an diesem Tag.
  const zeitleiste = useMemo(
    () =>
      stand.verlauf.map((p) => ({
        tag: p.tag,
        kurz: new Date(p.tag).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }),
        lang: new Date(p.tag).toLocaleDateString("de-DE"),
        markt: p.markt_median,
        eigen: p.eigener_preis,
        farbe: farbeFuer(abweichung(p)),
      })),
    [stand.verlauf],
  );

  // Nur die Angebote des gewählten Tages: die Karte muss beim Umschalten
  // mitwechseln, sonst zeigt sie stillschweigend ein anderes Datum.
  const angeboteHeute = useMemo(
    () => stand.angebote.filter((a) => a.tag === punkt?.tag),
    [stand.angebote, punkt?.tag],
  );

  const [q25, q75] = useMemo(
    () => quartile(angeboteHeute.map((a) => a.preis)),
    [angeboteHeute],
  );

  if (stand.hinweis) {
    return (
      <div className="rounded-(--radius) bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
        {stand.hinweis}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Kennzahl zuerst: die eine Aussage, wegen der man herschaut. */}
      {punkt && (
        <div className="rounded-(--radius) border p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div>
              <p className="text-xs text-muted-foreground">
                Umgebung am {new Date(punkt.tag).toLocaleDateString("de-DE")}
              </p>
              <p className="text-2xl font-semibold">
                {formatCurrency(punkt.markt_median, waehrung)}
              </p>
              <p className="text-xs text-muted-foreground">
                Median aus {punkt.anzahl} Angeboten
                {punkt.p25 !== null && punkt.p75 !== null && (
                  <>
                    {" · "}
                    mittleres Feld {formatCurrency(punkt.p25, waehrung)} bis{" "}
                    {formatCurrency(punkt.p75, waehrung)}
                  </>
                )}
              </p>
            </div>
            {punkt.eigener_preis !== null && (
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Dein Preis</p>
                <p className="text-2xl font-semibold">
                  {formatCurrency(punkt.eigener_preis, waehrung)}
                </p>
                {abw !== null && (
                  <p
                    className="text-sm font-medium"
                    style={{ color: farbeFuer(abw) }}
                  >
                    {abw > 0 ? "+" : ""}
                    {abw.toFixed(0)} % zum Markt
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Karte: alle Angebote der Region am gewählten Tag, das eigene Objekt obenauf. */}
      {API_KEY && lat !== null && lng !== null ? (
        <div className="h-72 overflow-hidden rounded-(--radius)">
          <APIProvider apiKey={API_KEY}>
            <Map
              defaultCenter={{ lat, lng }}
              defaultZoom={9}
              gestureHandling="cooperative"
              disableDefaultUI
              mapId="markt-karte"
            >
              {/* Angebote zuerst, damit das eigene Objekt obenauf liegt.
                  Schlüssel aus Ort UND Preis: mehrere Angebote können
                  denselben (gerundeten) Ort tragen — ein Mehrfamilienhaus. */}
              {angeboteHeute.map((a: MarktAngebot, i) => (
                <AdvancedMarker
                  key={`${a.lat}:${a.lng}:${a.preis}:${i}`}
                  position={{ lat: a.lat, lng: a.lng }}
                  title={`Angebot · ${formatCurrency(a.preis, waehrung)} je Nacht`}
                >
                  <div
                    className="rounded-full px-1.5 py-0.5 text-[0.65rem] font-medium text-white opacity-90 shadow"
                    style={{ background: angebotsFarbe(a.preis, q25, q75) }}
                  >
                    {formatCurrency(a.preis, waehrung)}
                  </div>
                </AdvancedMarker>
              ))}
              <AdvancedMarker position={{ lat, lng }} title={titel ?? undefined}>
                <div
                  className="rounded-full border-2 border-white px-2 py-1 text-xs font-semibold text-white shadow-lg"
                  style={{ background: farbeFuer(abw) }}
                >
                  {punkt?.eigener_preis !== null && punkt
                    ? formatCurrency(punkt.eigener_preis!, waehrung)
                    : "Dein Objekt"}
                </div>
              </AdvancedMarker>
            </Map>
          </APIProvider>
        </div>
      ) : (
        <div className="rounded-(--radius) bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
          {API_KEY
            ? "Für dieses Objekt sind keine Koordinaten hinterlegt — ohne Standort keine Karte."
            : "Kartendienst nicht eingerichtet (NEXT_PUBLIC_GOOGLE_MAPS_API_KEY fehlt)."}
        </div>
      )}

      {/* Der Normalfall ist: jeder Stichtag hat Punkte (der Lauf schreibt sie
          ohne Schwelle). Bleibt ein Tag trotzdem leer, ist der Abruf für
          genau diesen Tag ausgefallen — das wird benannt, nicht erklärt
          (Wurzel 5: kein stiller Zustand, aber auch kein Ausredentext). */}
      {punkt && angeboteHeute.length === 0 && (
        <p className="rounded-(--radius) bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          Für den {new Date(punkt.tag).toLocaleDateString("de-DE")} sind keine
          Angebote abgerufen worden. Der nächste tägliche Lauf holt sie nach.
        </p>
      )}

      {/* Verlauf: die beobachteten Stichtage als ZEITLEISTE, nicht als 22
          rote Pillen (Screenshot 05.09.2026 — „da müssen wir ein besseres UI
          erstellen"). Median der Umgebung als Linie, der eigene Preis
          gestrichelt, der gewählte Stichtag als Punkt. Ein Klick auf die
          Kurve wechselt den Tag der Karte. Die Farbe des Punkts ist der
          Abstand zum Markt — dieselbe Skala wie der eigene Marker. */}
      <div className="rounded-(--radius) border p-2">
        <ChartContainer
          config={{
            markt: { label: "Umgebung (Median)", color: "var(--chart-1)" },
            eigen: { label: "Dein Preis", color: "var(--foreground)" },
          }}
          className="h-28 w-full"
        >
          <LineChart
            data={zeitleiste}
            onClick={(e) => {
              // recharts tippt den Klick eng; die Nutzlast des aktiven Punkts
              // liegt trotzdem unter `activePayload`.
              const roh = e as unknown as { activePayload?: { payload?: { tag?: string } }[] } | null;
              const tag = roh?.activePayload?.[0]?.payload?.tag;
              if (tag) setGewaehlt(tag);
            }}
            style={{ cursor: "pointer" }}
          >
            <XAxis dataKey="kurz" tickLine={false} axisLine={false} fontSize={10} interval="preserveStartEnd" />
            <YAxis hide domain={["auto", "auto"]} />
            <ChartTooltip
              content={<ChartTooltipContent labelFormatter={(_, p) => String(p?.[0]?.payload?.lang ?? "")} />}
            />
            <Line
              type="monotone"
              dataKey="eigen"
              stroke="var(--color-eigen)"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
              connectNulls
              isAnimationActive={false}
            />
            <Line
              type="monotone"
              dataKey="markt"
              stroke="var(--color-markt)"
              strokeWidth={2}
              isAnimationActive={false}
              dot={(props: { cx?: number; cy?: number; payload?: { tag?: string; farbe?: string } }) => {
                const aktivTag = gewaehlt ?? stand.verlauf[0]?.tag;
                const ist = props.payload?.tag === aktivTag;
                return (
                  <circle
                    key={props.payload?.tag}
                    cx={props.cx}
                    cy={props.cy}
                    r={ist ? 5 : 2.5}
                    fill={props.payload?.farbe ?? "var(--color-markt)"}
                    stroke={ist ? "white" : "none"}
                    strokeWidth={ist ? 2 : 0}
                  />
                );
              }}
            />
          </LineChart>
        </ChartContainer>
        <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
          <span>
            {stand.verlauf.length} Stichtage ·{" "}
            {new Date(stand.verlauf[0]?.tag ?? "").toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}
            {" – "}
            {new Date(stand.verlauf[stand.verlauf.length - 1]?.tag ?? "").toLocaleDateString("de-DE", {
              day: "2-digit",
              month: "2-digit",
              year: "2-digit",
            })}
          </span>
          <span>Klick auf die Kurve wechselt den Tag der Karte</span>
        </div>
      </div>

      {/* Herkunft der Zahlen, klar als UNSERE Uhr benannt (Wurzel 5b). */}
      <p className="flex items-center gap-1 text-xs text-muted-foreground">
        <Icon icon="solar:info-circle-linear" className="size-3.5" />
        {angeboteHeute.length > 0 && <>{angeboteHeute.length} Angebote · </>}
        beobachtetes Gebiet rund {stand.radius_km.toFixed(0)} km · zuletzt bei
        uns abgerufen{" "}
        {stand.stand_vom
          ? new Date(stand.stand_vom).toLocaleString("de-DE")
          : "—"}
      </p>
    </div>
  );
}

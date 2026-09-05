"use client";

// 30-Tage-Preisvorschau pro Objekt im Hostaway-Stil: Wochenraster (Mo–So),
// pro Tag der empfohlene Preis oben rechts, Tageszahl unten links, „Heute“-
// Marker. Bei dynamischem Preis ein Blitz + „Warum dieser Preis?"-Popup.
// Read-only — manuelle Tagespreise setzt man im Kalender; sie greifen, sobald
// Dynamic Pricing für das Objekt abgeschaltet wird.
import { useLocale } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { DayAvailability } from "@/lib/calendar";
import { Card } from "@nextdays/ui/card";
import { useRouter } from "next/navigation";

import { DpPortalstandLeiste } from "./dp-portalstand-leiste";
import { DpTagesmodusDialog } from "./dp-tagesmodus-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@nextdays/ui/dialog";
import { formatCurrency } from "@/lib/currency";
import { explainFactors } from "@/lib/dp-factors";
import {
  explainDpPrice,
  getVorschau,
  type Portalstand,
  type VorschauTag,
} from "@/lib/dynamic-pricing";

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

// Ein Monat als fortlaufende Zahl (Jahr*12 + Monat) — Vor/Zurueck ist damit
// reines Rechnen, ohne Jahreswechsel-Sonderfall (gleiches Muster wie im
// Kalender-Monatsraster, month-grid-view.tsx).
function monatsIndex(iso: string): number {
  const jahr = Number(iso.slice(0, 4));
  const monat = Number(iso.slice(5, 7)) - 1;
  return jahr * 12 + monat;
}
function indexJahr(i: number): number {
  return Math.floor(i / 12);
}
function indexMonat(i: number): number {
  return ((i % 12) + 12) % 12;
}
/** Wetterlage als Symbol — aus Bewölkung und Niederschlag, nicht aus dem Score:
 *  der Score ist eine Nachfrage-Bewertung, das Symbol soll das WETTER zeigen. */
function wetterSymbol(
  regenMm: number | null | undefined,
  wolkenPct: number | null | undefined,
): string {
  if (regenMm != null && regenMm >= 2) return "🌧️";
  if (regenMm != null && regenMm >= 0.3) return "🌦️";
  if (wolkenPct != null && wolkenPct >= 80) return "☁️";
  if (wolkenPct != null && wolkenPct >= 40) return "⛅";
  return "☀️";
}

function monatsName(i: number, locale: string): string {
  return new Date(indexJahr(i), indexMonat(i), 1).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });
}

// Preis in der OBJEKT-Währung (aus dem Rate-Plan) — kein €-Hardcode (27 EU-Länder).
// Centgenau wie Kalender/Channex: EINE Zahl überall — eine gerundete „119 €"
// neben „118,68 €" im Kalender las sich als Fehler in der Preisführung.
function fmt(value: number | null, currency: string | null, locale: string): string {
  if (value === null) return "—";
  return formatCurrency(value, currency, locale);
}

// Mo=0 … So=6 (JS getDay: So=0).
function mondayIndex(iso: string): number {
  return (new Date(iso + "T00:00:00").getDay() + 6) % 7;
}

function todayIso(): string {
  // Lokale Zeitzone, nicht toISOString(): das rechnet nach UTC um und liefert
  // östlich von Greenwich bis 2 Uhr morgens den VORTAG. Live am 04.09.2026
  // stand der „Heute"-Kreis auf dem 3. (dasselbe Muster wie isoMonatsErster
  // in der Seite).
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const t = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${t}`;
}

// Hostaway „Upcoming weeks": die naechsten fuenf Wochen als Liste statt Monat.
const WOCHEN_ANSICHT_TAGE = 35;

export function DpPreviewGrid({
  days,
  propertyId,
  currency,
  automatikAn = true,
}: {
  days: DayAvailability[];
  propertyId: string;
  currency: string | null;
  /** Bei „aus" zeigt der Kalender die Kurve als Vorschau (grau, gestrichelt):
   *  so saehe es mit Automatik aus — Hostaway „Subscribe & Review". */
  automatikAn?: boolean;
}) {
  // Die Seite ist eine Server-Komponente; nach einer Änderung holt
  // router.refresh() die neuen Preise, ohne dass der Nutzer neu lädt.
  const router = useRouter();
  const locale = useLocale();
  // Geladene KI-Erklärung je Tag (ISO → Text | "…" beim Laden | Fehlertext).
  const [explained, setExplained] = useState<Record<string, string>>({});
  const [loadingDay, setLoadingDay] = useState<string | null>(null);
  // Tag, dessen Erklärung im Popup steht. Inline war der Text in der Zelle
  // unlesbar: er sprengte die Zeilenhöhe und drückte die Tageszahl weg.
  const [offenerTag, setOffenerTag] = useState<string | null>(null);
  // Tag, für den „Preise verwalten" offen ist (null = zu).
  const [modusTag, setModusTag] = useState<string | null>(null);
  // Angezeigter Monat. Vorgabe ist der laufende Monat; die Navigation bewegt
  // sich nur innerhalb der geladenen Monate (kein Nachladen, kein leeres Blatt).
  const monate = useMemo(() => {
    const menge = new Set(days.map((d) => monatsIndex(d.date)));
    return [...menge].sort((a, b) => a - b);
  }, [days]);
  const [monat, setMonat] = useState<number | null>(null);
  const aktiverMonat = monat ?? monate[0] ?? monatsIndex(todayIso());
  const posic = monate.indexOf(aktiverMonat);
  // Kalender (Monat) oder „Naechste Wochen" (Hostaway „Upcoming weeks").
  const [ansicht, setAnsicht] = useState<"kalender" | "wochen">("kalender");
  // Soll/Ist je Tag von der Portalstand-Leiste — markiert abweichende Tage.
  const [portal, setPortal] = useState<Record<string, number>>({});
  const portalStand = useCallback((st: Portalstand) => {
    const map: Record<string, number> = {};
    for (const t of st.tage) {
      if (t.abweichung_pct !== null && Math.abs(t.abweichung_pct) > 0.5 && t.portal !== null) {
        map[t.date] = t.portal;
      }
    }
    setPortal(map);
  }, []);
  // Vorschau-Kurve bei ausgeschalteter Automatik: fuer den angezeigten Monat.
  const [vorschau, setVorschau] = useState<Record<string, VorschauTag>>({});
  useEffect(() => {
    if (automatikAn) return;
    const tage = days.filter((d) => monatsIndex(d.date) === aktiverMonat);
    if (tage.length === 0) return;
    const heute = todayIso();
    const von = tage[0].date < heute ? heute : tage[0].date;
    const bis = tage[tage.length - 1].date;
    if (bis < von) return;
    let aktiv = true;
    getVorschau(propertyId, von, bis).then((res) => {
      if (!aktiv || !res.ok) return;
      setVorschau((prev) => {
        const next = { ...prev };
        for (const v of res.data) next[v.date] = v;
        return next;
      });
    });
    return () => {
      aktiv = false;
    };
  }, [automatikAn, aktiverMonat, days, propertyId]);

  async function loadExplanation(day: string) {
    setOffenerTag(day);
    if (explained[day] || loadingDay) return;
    setLoadingDay(day);
    const res = await explainDpPrice(propertyId, day);
    setExplained((prev) => ({
      ...prev,
      [day]: res.ok ? res.data.explanation : res.error,
    }));
    setLoadingDay(null);
  }

  if (days.length === 0) {
    return (
      <Card className="p-6 text-sm text-muted-foreground">
        Keine Preise im Vorschauzeitraum.
      </Card>
    );
  }
  const today = todayIso();
  // Nur die Tage des angezeigten Monats — der Kalender zeigt einen Monat,
  // nicht den ganzen geladenen Zeitraum am Stueck.
  const monatsTage = days.filter((d) => monatsIndex(d.date) === aktiverMonat);
  // Führende Leerzellen, damit der erste Tag unter seinem Wochentag steht.
  const lead = monatsTage.length > 0 ? mondayIndex(monatsTage[0].date) : 0;
  const cells: (DayAvailability | null)[] = [
    ...Array(lead).fill(null),
    ...monatsTage,
  ];
  // Auf volle Wochen auffüllen.
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <Card className="overflow-hidden p-0">
      {/* Monatsnavigation: Vor/Zurueck plus Direktsprung (z. B. "Juni" im
          Folgejahr), damit man sich nicht durch 18 Monate klicken muss. */}
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <button
          type="button"
          onClick={() => setMonat(monate[posic - 1] ?? aktiverMonat)}
          disabled={posic <= 0}
          aria-label="Voriger Monat"
          className="rounded-(--radius) border px-2 py-1 text-sm disabled:opacity-40"
        >
          ←
        </button>
        <select
          value={aktiverMonat}
          onChange={(e) => setMonat(Number(e.target.value))}
          aria-label="Monat wählen"
          className="rounded-(--radius) border bg-transparent px-2 py-1 text-sm font-semibold"
        >
          {monate.map((m) => (
            <option key={m} value={m}>
              {monatsName(m, locale)}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setMonat(monate[posic + 1] ?? aktiverMonat)}
          disabled={posic < 0 || posic >= monate.length - 1}
          aria-label="Nächster Monat"
          className="rounded-(--radius) border px-2 py-1 text-sm disabled:opacity-40"
        >
          →
        </button>
        {aktiverMonat !== monate[0] && (
          <button
            type="button"
            onClick={() => setMonat(monate[0])}
            className="rounded-(--radius) px-2 py-1 text-sm text-accent hover:underline"
          >
            Heute
          </button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <div className="flex rounded-(--radius) border text-xs">
            <button
              type="button"
              onClick={() => setAnsicht("kalender")}
              className={`px-2.5 py-1 ${ansicht === "kalender" ? "bg-muted font-semibold" : "text-muted-foreground"}`}
            >
              Kalender
            </button>
            <button
              type="button"
              onClick={() => setAnsicht("wochen")}
              className={`px-2.5 py-1 ${ansicht === "wochen" ? "bg-muted font-semibold" : "text-muted-foreground"}`}
            >
              Nächste Wochen
            </button>
          </div>
          <span className="text-xs text-muted-foreground">{monatsTage.length} Tage</span>
        </div>
      </div>
      <div className="px-3 pt-3 empty:hidden">
        <DpPortalstandLeiste propertyId={propertyId} onStand={portalStand} />
      </div>
      {!automatikAn && (
        <p className="border-b bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          Automatik ist aus. Grau gestrichelt siehst du, was Dynamic Pricing mit
          deinen Einstellungen rechnen würde — gespeichert oder gesendet wird
          davon nichts, bis du einschaltest.
        </p>
      )}
      {ansicht === "wochen" && (
        <WochenListe
          days={days}
          currency={currency}
          locale={locale}
          portal={portal}
          onTag={(d) => setModusTag(d)}
        />
      )}
      {ansicht === "kalender" && (<>
      <div className="grid grid-cols-7 border-b">
        {WEEKDAYS.map((w) => (
          <div
            key={w}
            className="px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
          >
            {w}
          </div>
        ))}
      </div>
      {monatsTage.length === 0 && (
        <p className="px-3 py-6 text-sm text-muted-foreground">
          Für diesen Monat liegen keine berechneten Preise vor.
        </p>
      )}
      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          if (!d) {
            return (
              <div
                key={`empty-${i}`}
                className="min-h-24 border-b border-r bg-muted/20"
              />
            );
          }
          const dayNum = Number(d.date.slice(8, 10));
          const isToday = d.date === today;
          const isDynamic = d.price_source === "dynamic";
          const isOverride = d.price_source === "override";
          const why = explainFactors(d.price_factors);
          // Jede Zelle erklärt ihre Preisquelle — eine nackte 333 € neben
          // lauter Blitz-Preisen las sich als Fehler statt als bewusst
          // gesetzter Preis.
          const quelle = isDynamic
            ? why || "Dynamisch berechneter Tagespreis"
            : isOverride
              ? "Manuell gesetzter Tagespreis (Dynamic Pricing ist für diesen Tag aus)"
              : "Grund-/Wochentagspreis (kein dynamischer Preis für diesen Tag)";
          return (
            <div
              key={d.date}
              title={quelle}
              className="relative flex min-h-24 flex-col justify-between border-b border-r p-2"
            >
              {/* Preis oben rechts, anklickbar: er ist der Einstieg in
                  „Preise verwalten" für diesen Tag oder Zeitraum. */}
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => setModusTag(d.date)}
                  title="Preise verwalten"
                  className={`flex items-center gap-1 rounded px-1 text-sm hover:bg-muted ${
                    d.price === null
                      ? "text-muted-foreground"
                      : "font-semibold"
                  }`}
                >
                  {isDynamic && (
                    <span className="text-accent" aria-label="dynamisch">
                      ⚡
                    </span>
                  )}
                  {isOverride && (
                    <span
                      className="text-muted-foreground"
                      aria-label="manuell gesetzt"
                    >
                      ✎
                    </span>
                  )}
                  {/* Gilt hier schon, kennen die Portale aber noch nicht.
                      Ohne diese Marke stünde im Kalender eine Zahl, von der
                      niemand weiss, ob Airbnb sie hat. */}
                  {d.preis_wartet_auf_freigabe && (
                    <span
                      className="text-amber-600 dark:text-amber-400"
                      aria-label="wartet auf Freigabe"
                      title="Gilt hier bereits — noch nicht an die Portale gesendet"
                    >
                      ○
                    </span>
                  )}
                  {fmt(d.price, currency, locale)}
                </button>
              </div>
              {/* Vorschau bei Automatik aus: so würde die Automatik rechnen. */}
              {!automatikAn && vorschau[d.date] && (
                <span
                  className="mt-0.5 self-end rounded border border-dashed px-1 text-[0.65rem] text-muted-foreground"
                  title={explainFactors(vorschau[d.date].factors) || "Vorschau der Automatik"}
                >
                  ⚡ {fmt(vorschau[d.date].price, currency, locale)}
                </span>
              )}
              {/* Portal weicht ab: die Zahl, die Airbnb/Booking gerade zeigen. */}
              {portal[d.date] !== undefined && (
                <span
                  className="mt-0.5 self-end rounded bg-red-100 px-1 text-[0.65rem] font-medium text-red-800 dark:bg-red-950 dark:text-red-300"
                  title="An den Portalen steht ein anderer Preis als hier berechnet"
                >
                  Portal {fmt(portal[d.date], currency, locale)}
                </span>
              )}
              {/* Wetter am Standort des Objekts. Die Herkunft steht dabei:
                  eine Vorhersage gibt es nur wenige Tage weit, danach ist es
                  das langjährige Mittel dieses Kalendertages. */}
              {d.wetter_score != null && (
                <span
                  className="mt-1 flex items-center justify-end gap-1 text-[0.65rem] text-muted-foreground"
                  title={
                    (d.wetter_quelle === "saisonal"
                      ? "Langjähriges Mittel für diesen Kalendertag (keine Vorhersage)"
                      : "Wettervorhersage") +
                    (d.wetter_temp_c != null
                      ? ` · ${d.wetter_temp_c.toFixed(0)} °C`
                      : "") +
                    (d.wetter_niederschlag_mm != null
                      ? ` · ${d.wetter_niederschlag_mm.toFixed(1)} mm`
                      : "") +
                    (d.wetter_bewoelkung_pct != null
                      ? ` · ${d.wetter_bewoelkung_pct.toFixed(0)} % Wolken`
                      : "")
                  }
                >
                  <span aria-hidden>
                    {wetterSymbol(d.wetter_niederschlag_mm, d.wetter_bewoelkung_pct)}
                  </span>
                  {d.wetter_temp_c != null && (
                    <span>{d.wetter_temp_c.toFixed(0)}°</span>
                  )}
                  {/* Ein Mittelwert darf nicht wie eine Prognose aussehen. */}
                  {d.wetter_quelle === "saisonal" && (
                    <span className="opacity-60">⌀</span>
                  )}
                </span>
              )}
              {/* KI-Erklärung: bei dynamischem Preis on-demand abrufbar */}
              {isDynamic && (
                <button
                  type="button"
                  onClick={() => loadExplanation(d.date)}
                  className="mt-1 self-end text-[0.65rem] text-accent hover:underline disabled:opacity-60"
                  disabled={loadingDay === d.date}
                >
                  {loadingDay === d.date ? "lädt…" : "Warum? (KI)"}
                </button>
              )}
              {/* Tageszahl unten links, Heute hervorgehoben */}
              <span
                className={
                  isToday
                    ? "flex size-7 items-center justify-center self-start rounded-full bg-accent text-sm font-semibold text-accent-foreground"
                    : "self-start text-sm text-muted-foreground"
                }
              >
                {dayNum}
              </span>
            </div>
          );
        })}
      </div>
      </>)}
      {/* Erklärung als Popup statt in der Zelle: der Fließtext ist mehrere
          Zeilen lang und war im 7-Spalten-Raster nicht lesbar. */}
      <Dialog
        open={offenerTag !== null}
        onOpenChange={(o) => !o && setOffenerTag(null)}
      >
        <DialogContent className="max-w-md">
          <DialogTitle>
            {offenerTag
              ? `Warum dieser Preis? — ${new Date(
                  offenerTag + "T00:00:00",
                ).toLocaleDateString(locale, {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}`
              : "Warum dieser Preis?"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            KI-Erklärung des berechneten Tagespreises.
          </DialogDescription>
          {offenerTag && (
            <>
              <p className="text-sm font-semibold">
                {fmt(
                  days.find((x) => x.date === offenerTag)?.price ?? null,
                  currency,
                  locale,
                )}
              </p>
              {/* Faktor-Kurzform aus den gespeicherten Werten — steht sofort,
                  auch während die KI-Langfassung noch lädt. */}
              {(() => {
                const kurz = explainFactors(
                  days.find((x) => x.date === offenerTag)?.price_factors,
                );
                return kurz ? (
                  <p className="text-xs text-muted-foreground">{kurz}</p>
                ) : null;
              })()}
              <p className="mt-2 text-sm leading-relaxed whitespace-pre-line">
                {loadingDay === offenerTag
                  ? "Erklärung wird erstellt…"
                  : (explained[offenerTag] ?? "")}
              </p>
            </>
          )}
        </DialogContent>
      </Dialog>

      {modusTag && (() => {
        const tag = days.find((x) => x.date === modusTag);
        // Der Zustand des Tages aus dem, was der Kalender ohnehin weiß:
        // `override` = fester Preis; ein Faktor `tagesanpassung` = Anpassung
        // (der gespeicherte Preis ist bereits verschoben, die Vorschau
        // braucht den rohen).
        const faktor = tag?.price_factors?.tagesanpassung;
        const anpassung = faktor != null && faktor !== 1;
        const startModus =
          tag?.price_source === "override"
            ? "manuell"
            : anpassung
              ? "anpassung"
              : "dynamisch";
        const roh =
          tag?.price == null ? null : anpassung ? tag.price / faktor : tag.price;
        return (
        <DpTagesmodusDialog
          propertyId={propertyId}
          currency={currency}
          startDatum={modusTag}
          startModus={startModus}
          startAnpassungPct={anpassung ? Math.round((faktor - 1) * 100) : null}
          berechneterPreis={roh}
          offen
          onSchliessen={() => setModusTag(null)}
          onGespeichert={() => router.refresh()}
        />
        );
      })()}
    </Card>
  );
}


/** „Nächste Wochen" (Hostaway „Upcoming weeks"): die kommenden 35 Tage als
 *  Liste — Datum, Preis, Herkunft, Portalstand. Zum Überfliegen, nicht zum
 *  Blättern. */
function WochenListe({
  days,
  currency,
  locale,
  portal,
  onTag,
}: {
  days: DayAvailability[];
  currency: string | null;
  locale: string;
  portal: Record<string, number>;
  onTag: (iso: string) => void;
}) {
  const heute = todayIso();
  const liste = days.filter((d) => d.date >= heute).slice(0, WOCHEN_ANSICHT_TAGE);
  if (liste.length === 0) {
    return <p className="px-3 py-6 text-sm text-muted-foreground">Keine Tage im Zeitraum.</p>;
  }
  return (
    <ul className="divide-y">
      {liste.map((d) => {
        const dt = new Date(d.date + "T00:00:00");
        const wochenstart = dt.getDay() === 1;
        return (
          <li
            key={d.date}
            className={`flex items-center gap-3 px-3 py-1.5 text-sm ${wochenstart ? "border-t-2" : ""}`}
          >
            <span className="w-28 text-muted-foreground">
              {dt.toLocaleDateString(locale, { weekday: "short", day: "2-digit", month: "2-digit" })}
            </span>
            <button
              type="button"
              onClick={() => onTag(d.date)}
              className="font-semibold hover:underline"
              title="Preise verwalten"
            >
              {d.price_source === "dynamic" && <span className="text-accent">⚡ </span>}
              {d.price_source === "override" && <span className="text-muted-foreground">✎ </span>}
              {fmt(d.price, currency, locale)}
            </button>
            {d.preis_wartet_auf_freigabe && (
              <span className="text-xs text-amber-700 dark:text-amber-300">wartet auf Freigabe</span>
            )}
            {portal[d.date] !== undefined && (
              <span className="rounded bg-red-100 px-1.5 text-xs font-medium text-red-800 dark:bg-red-950 dark:text-red-300">
                Portal {fmt(portal[d.date], currency, locale)}
              </span>
            )}
            <span className="ml-auto text-xs text-muted-foreground">
              {d.status !== "open" ? "belegt/gesperrt" : d.min_stay ? `min. ${d.min_stay} N.` : ""}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

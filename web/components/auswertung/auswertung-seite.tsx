"use client";

// Die Auswertung — Filter, Kopfaktionen, Kennzahlen, zehn Reiter.
//
// EIN Abruf für acht der zehn Reiter. Sie teilen Zeitraum, Bezug und
// Objektfilter, und ihre Zahlen müssen übereinstimmen; getrennte Abrufe je
// Reiter wären genau der Fehler, den Hostaway im September 2025 nachbessern
// musste („Einheitliche Zahlen auf allen Seiten" — vorher rechneten
// Analytics, Mietaktivität und Auslastung verschieden). Der Reiterwechsel
// löst dort KEINEN neuen Abruf aus, er blendet einen anderen Teil derselben
// Antwort ein.
//
// AUSNAHMEN: „Kennzahlen" (das am 30.08.2026 hierher gezogene Kontrollzentrum,
// liest `getTenantStats` für Sparklines) und „Pace" (blickt immer von heute
// nach vorn, kennt keinen Zeitraum). Beide bekommen denselben Filterstand.
//
// GESPEICHERTE ANSICHTEN (Hostaway „Custom Views", 0563) halten Filter,
// Schnellwahl-Schlüssel, Spalten und Reiter-Optionen je Nutzer. Laden setzt
// alles auf einmal; der Schnellwahl-Schlüssel wird neu aufgelöst.
//
// EXPORT nimmt die Zahlen, die auf dem Bildschirm stehen (lib/auswertung-
// export.ts) — kein zweiter Rechenweg.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";

import { Card } from "@nextdays/ui/card";
import { getAuswertung } from "@/lib/auswertung";
import type { Ansicht, Auswertung, PaceBericht, Reiter, Schnell } from "@/lib/auswertung-typen";
import { REITER, SCHNELLWAHL } from "@/lib/auswertung-typen";
import {
  exportCsv,
  exportPdf,
  exportXlsx,
  type ExportFormat,
  type ExportTabelle,
} from "@/lib/auswertung-export";
import type { AvailabilitySource } from "@/lib/calendar";
import { channelLabelLoose } from "@/lib/channel-logos";
import { useCalendarLabels } from "@/lib/use-calendar-labels";

import { AuswertungNav } from "./auswertung-nav";
import {
  Filterleiste,
  vergleichMoeglich,
  zeitraumAufloesen,
  type FilterStand,
} from "./filterleiste";
import { KennzahlKacheln } from "./kennzahl-kacheln";
import { KopfAktionen } from "./kopf-aktionen";
import { ANALYTICS_VORGABE, ReiterAnalytics, type AnalyticsOptionen } from "./reiter-analytics";
import { ReiterAusgaben } from "./reiter-ausgaben";
import { ReiterAuslastung, type AuslastungOptionen } from "./reiter-auslastung";
import {
  BUCHUNG_SPALTEN,
  BUCHUNG_VORGABE,
  ReiterBuchungen,
  type BuchungOptionen,
  type BuchungSpalte,
} from "./reiter-buchungen";
import { ReiterGaeste } from "./reiter-gaeste";
import { ReiterKennzahlen } from "./reiter-kennzahlen";
import { ReiterKanaele } from "./reiter-kanaele";
import { ReiterMuster, wochentagName } from "./reiter-muster";
import { ReiterPace } from "./reiter-pace";
import { ReiterStornos } from "./reiter-stornos";

const SPEICHER_SPALTEN = "auswertung.buchungen.spalten";

function vorgabe(): FilterStand {
  return {
    ...zeitraumAufloesen("monat"),
    schnell: "monat",
    bezug: "anreise",
    propertyIds: [],
    channels: [],
    status: [],
    vergleich: "keiner",
  };
}

export function AuswertungSeite({
  objekte,
  kanaele,
}: {
  objekte: readonly { value: string; label: string }[];
  kanaele: readonly { value: string; label: string }[];
}) {
  const t = useTranslations("analysis");
  const locale = useLocale();
  const { channelLabel } = useCalendarLabels();
  const [stand, setStand] = useState<FilterStand>(vorgabe);
  // Wird der Zeitraum über die Vergleichsgrenze hinaus verlängert, fällt der
  // Vergleich mit. Ohne das schickte die Seite einen Wert weiter, den das
  // Backend mit 422 abweist.
  const setzenGeprueft = useCallback((s: FilterStand) => {
    setStand(vergleichMoeglich(s.von, s.bis) ? s : { ...s, vergleich: "keiner" });
  }, []);

  const [reiter, setReiter] = useState<Reiter>("kennzahlen");
  const [daten, setDaten] = useState<Auswertung | null>(null);
  const [pace, setPace] = useState<PaceBericht | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [exportLaeuft, setExportLaeuft] = useState(false);
  const [exportFehler, setExportFehler] = useState<string | null>(null);

  // Reiter-Optionen und Spalten — Teil einer gespeicherten Ansicht.
  const [spalten, setSpalten] = useState<BuchungSpalte[]>(BUCHUNG_VORGABE);
  const [buchungOpt, setBuchungOpt] = useState<BuchungOptionen>({ ansicht: "buchung", leereObjekte: false });
  const [auslastungOpt, setAuslastungOpt] = useState<AuslastungOptionen>({ jeMonat: false });
  const [analyticsOpt, setAnalyticsOpt] = useState<AnalyticsOptionen>(ANALYTICS_VORGABE);

  // Spaltenwahl überlebt den Seitenwechsel (localStorage, pro Betrachter) —
  // auch ohne gespeicherte Ansicht. Erst nach dem Mounten lesen (Hydration).
  useEffect(() => {
    try {
      const roh = window.localStorage.getItem(SPEICHER_SPALTEN);
      if (!roh) return;
      const geparst: unknown = JSON.parse(roh);
      if (Array.isArray(geparst)) {
        const gueltig = geparst.filter((s): s is BuchungSpalte =>
          (BUCHUNG_SPALTEN as readonly string[]).includes(String(s)),
        );
        if (gueltig.length) setSpalten(gueltig);
      }
    } catch {
      // Privater Modus, gesperrte Site-Daten: Vorgabe behalten.
    }
  }, []);
  const spaltenSetzen = useCallback((s: BuchungSpalte[]) => {
    setSpalten(s);
    try {
      window.localStorage.setItem(SPEICHER_SPALTEN, JSON.stringify(s));
    } catch {
      // Speichern ist Komfort, kein Muss.
    }
  }, []);

  const laden = useCallback(async (s: FilterStand) => {
    setLaedt(true);
    setFehler(null);
    const res = await getAuswertung({
      von: s.von,
      bis: s.bis,
      bezug: s.bezug,
      propertyIds: s.propertyIds,
      channels: s.channels,
      status: s.status,
      vergleich: s.vergleich,
    });
    if (res.ok) setDaten(res.data);
    else {
      setFehler(res.error);
      // Alte Zahlen stehen lassen wäre schlimmer als nichts: sie gehörten zu
      // einem anderen Filter und niemand sähe den Unterschied.
      setDaten(null);
    }
    setLaedt(false);
  }, []);

  useEffect(() => {
    void laden(stand);
  }, [laden, stand]);

  // ---- Gespeicherte Ansichten ---------------------------------------------

  const ansichtErfassen = useCallback(
    () => ({
      filter: {
        schnell: stand.schnell,
        von: stand.schnell ? null : stand.von,
        bis: stand.schnell ? null : stand.bis,
        bezug: stand.bezug,
        propertyIds: stand.propertyIds,
        channels: stand.channels,
        status: stand.status,
        vergleich: stand.vergleich,
      },
      spalten: [...spalten],
      optionen: {
        buchungen: buchungOpt,
        auslastung: auslastungOpt,
        analytics: analyticsOpt,
      },
    }),
    [stand, spalten, buchungOpt, auslastungOpt, analyticsOpt],
  );

  const ansichtLaden = useCallback(
    (a: Ansicht) => {
      const f = a.filter as Partial<Record<string, unknown>>;
      const schnell = (SCHNELLWAHL as readonly string[]).includes(String(f.schnell))
        ? (f.schnell as Schnell)
        : null;
      const basis = vorgabe();
      // Der Schnellwahl-Schlüssel wird NEU aufgelöst — „Vormonat" ist der
      // Vormonat von heute, nicht der vom Tag des Speicherns.
      const zeit = schnell
        ? zeitraumAufloesen(schnell)
        : {
            von: typeof f.von === "string" ? f.von : basis.von,
            bis: typeof f.bis === "string" ? f.bis : basis.bis,
          };
      const liste = (v: unknown) =>
        Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
      setzenGeprueft({
        ...zeit,
        schnell,
        bezug: (f.bezug as FilterStand["bezug"]) ?? "anreise",
        propertyIds: liste(f.propertyIds),
        channels: liste(f.channels),
        status: liste(f.status),
        vergleich: (f.vergleich as FilterStand["vergleich"]) ?? "keiner",
      });
      const sp = a.spalten.filter((s): s is BuchungSpalte =>
        (BUCHUNG_SPALTEN as readonly string[]).includes(s),
      );
      if (sp.length) spaltenSetzen(sp);
      const o = a.optionen as Partial<{
        buchungen: BuchungOptionen;
        auslastung: AuslastungOptionen;
        analytics: AnalyticsOptionen;
      }>;
      if (o.buchungen) setBuchungOpt({ ...buchungOpt, ...o.buchungen });
      if (o.auslastung) setAuslastungOpt({ ...auslastungOpt, ...o.auslastung });
      if (o.analytics) setAnalyticsOpt({ ...analyticsOpt, ...o.analytics });
      if ((REITER as readonly string[]).includes(a.reiter)) setReiter(a.reiter as Reiter);
    },
    [setzenGeprueft, spaltenSetzen, buchungOpt, auslastungOpt, analyticsOpt],
  );

  // ---- Export -------------------------------------------------------------

  const datum = useCallback(
    (iso: string) =>
      iso ? new Date(iso.length === 10 ? `${iso}T00:00:00` : iso).toLocaleDateString(locale) : "",
    [locale],
  );

  /** Die Tabelle(n) des aktiven Reiters als Exportdaten — dieselben Zahlen,
   *  die auf dem Bildschirm stehen. */
  const exportTabellen = useMemo((): ExportTabelle[] => {
    if (!daten) return [];
    const a = daten;
    const cur = a.currency;
    const geld = (v: number | null | undefined): number | null =>
      v === null || v === undefined ? null : Math.round(v * 100) / 100;
    const kanal = (ch: string, ota: string | null) =>
      ota ? channelLabelLoose(ota) : channelLabel(ch as AvailabilitySource);
    const einheit = cur ? ` (${cur})` : "";

    switch (reiter) {
      case "kennzahlen":
      case "analytics": {
        const k = a.kennzahlen;
        return [
          {
            titel: t("tab.kennzahlen"),
            kopf: [t("col.name"), t("col.value")],
            zeilen: [
              [t("kpi.revenue") + einheit, geld(k.umsatz)],
              [t("kpi.nights"), k.naechte],
              [t("col.bookingsShort"), k.buchungen],
              [t("guests.total"), k.gaeste],
              [t("col.bookable"), k.naechte_buchbar],
              [t("kpi.occupancy") + " (%)", k.auslastung_pct],
              [t("kpi.adr") + einheit, geld(k.adr)],
              [t("kpi.revpar") + einheit, geld(k.revpar)],
              [t("guests.avgStay"), k.aufenthalt_schnitt],
              [t("patterns.leadTime"), k.vorlauf_tage],
              [t("kpi.cancellations") + " (%)", k.stornoquote_pct],
            ],
          },
          {
            titel: t("chart.revenueOverTime"),
            kopf: [t("col.period"), t("kpi.revenue") + einheit, t("kpi.nights"), t("col.bookingsShort")],
            zeilen: a.verlauf.map((p) => [p.period, geld(p.umsatz), p.naechte, p.buchungen]),
          },
        ];
      }
      case "buchungen": {
        if (buchungOpt.ansicht === "objekt") {
          const zeilen = buchungOpt.leereObjekte
            ? a.objekte_finanzen
            : a.objekte_finanzen.filter((o) => o.buchungen > 0);
          return [
            {
              titel: t("tab.buchungen"),
              kopf: [
                t("col.property"), t("col.bookingsShort"), t("col.nights"),
                t("col.revenue") + einheit, t("col.accommodation") + einheit,
                t("col.cleaning") + einheit, t("col.otherFees") + einheit,
                t("col.addons") + einheit, t("col.gross") + einheit,
                t("col.commission") + einheit, t("col.paymentFee") + einheit,
                t("col.net") + einheit, t("bookings.withoutBreakdownShort"),
              ],
              zeilen: zeilen.map((o) => [
                o.title, o.buchungen, o.naechte, geld(o.umsatz), geld(o.uebernachtung),
                geld(o.reinigung), geld(o.sonstige_gebuehren), geld(o.zusatzleistungen),
                geld(o.brutto), geld(o.provision), geld(o.zahlungsgebuehr), geld(o.netto),
                o.ohne_zerlegung,
              ]),
            },
          ];
        }
        return [
          {
            titel: t("tab.buchungen"),
            kopf: [
              t("col.property"), t("col.channel"), t("col.checkIn"), t("col.checkOut"),
              t("col.nights"), t("col.guests"), t("col.status"), t("col.bookedAt"),
              t("col.revenue"), t("col.currency"), t("col.accommodation"), t("col.cleaning"),
              t("col.otherFees"), t("col.addons"), t("col.gross"), t("col.commission"),
              t("col.paymentFee"), t("col.net"), t("col.source"),
            ],
            zeilen: a.buchungen.map((b) => [
              b.property_title, kanal(b.channel, b.ota_name), datum(b.check_in), datum(b.check_out),
              b.naechte, b.gaeste, b.status, b.booked_at ? datum(b.booked_at) : null,
              geld(b.umsatz), b.currency, geld(b.uebernachtung), geld(b.reinigung),
              geld(b.sonstige_gebuehren), geld(b.zusatzleistungen), geld(b.brutto),
              geld(b.provision), geld(b.zahlungsgebuehr), geld(b.netto), b.finanz_quelle,
            ]),
          },
        ];
      }
      case "auslastung": {
        const kopf = [
          t("col.property"), ...(auslastungOpt.jeMonat ? [t("col.month")] : []),
          t("col.bookable"), t("col.booked"), t("col.ownerNights"), t("col.blocked"),
          t("col.stopSell"), t("kpi.occupancy") + " (%)", t("col.arrivals"),
          t("kpi.revenue") + einheit, t("kpi.adr") + einheit, t("kpi.revpar") + einheit,
          t("col.cancellations"),
        ];
        const zeile = (o: (typeof a.objekte)[number], monat?: string) => [
          o.title, ...(monat ? [monat] : []), o.naechte_buchbar, o.naechte_gebucht,
          o.naechte_eigennutzung, o.naechte_gesperrt, o.naechte_stop_sell, o.auslastung_pct,
          o.anreisen, geld(o.umsatz), geld(o.adr), geld(o.revpar), o.stornos,
        ];
        return [
          {
            titel: t("tab.auslastung"),
            kopf,
            zeilen: auslastungOpt.jeMonat
              ? a.objekte_monatlich.map((o) => zeile(o, o.monat))
              : a.objekte.map((o) => zeile(o)),
          },
        ];
      }
      case "ausgaben":
        return [
          {
            titel: t("tab.ausgaben"),
            kopf: [t("col.date"), t("col.name"), t("col.category"), t("col.property"), t("col.kind"), t("col.amount"), t("col.currency"), t("col.receipt")],
            zeilen: a.ausgaben.posten.map((p) => [
              datum(p.date), p.name, p.kategorie, p.property_title, t(`expenses.kind.${p.art}`),
              p.art === "ausgabe" ? -p.betrag : p.betrag, p.currency, p.hat_beleg ? "✓" : "",
            ]),
          },
        ];
      case "kanaele":
        return [
          {
            titel: t("tab.kanaele"),
            kopf: [t("col.channel"), t("col.bookingsShort"), t("col.nights"), t("kpi.revenue") + einheit, t("col.commission") + einheit, t("col.net") + einheit, t("col.share") + " (%)"],
            zeilen: a.kanaele.map((k) => [
              k.channel === "owner_stay" ? t("ownerStay") : kanal(k.channel, k.ota_name),
              k.buchungen, k.naechte, geld(k.umsatz), geld(k.provision), geld(k.netto), k.anteil_pct,
            ]),
          },
        ];
      case "gaeste":
        return [
          {
            titel: t("tab.gaeste"),
            kopf: [t("col.country"), t("guests.total"), t("col.bookingsShort"), t("col.nights"), t("col.share") + " (%)"],
            zeilen: a.gaeste.herkunft.map((h) => [h.land ?? t("guests.unknownCountry"), h.gaeste, h.buchungen, h.naechte, h.anteil_pct]),
          },
        ];
      case "pace":
        return pace
          ? [
              {
                titel: t("tab.pace"),
                kopf: [t("col.month"), t("pace.nowNights"), t("pace.nowRevenue"), t("pace.lastYearSameDayNights"), t("pace.delta") + " (%)", t("pace.lastYearFinalNights"), t("pace.lastYearFinalRevenue")],
                zeilen: pace.monate.map((m) => [
                  m.monat, m.jetzt_naechte, geld(m.jetzt_umsatz), m.vorjahr_stichtag_naechte,
                  m.delta_naechte_pct, m.vorjahr_ende_naechte, geld(m.vorjahr_ende_umsatz),
                ]),
              },
            ]
          : [];
      case "muster":
        return [
          {
            titel: t("patterns.weekday"),
            kopf: [t("col.weekday"), t("col.bookable"), t("col.booked"), t("kpi.occupancy") + " (%)", t("col.arrivals"), t("kpi.revenue") + einheit, t("kpi.adr") + einheit],
            zeilen: a.wochentage.map((w) => [wochentagName(w.wochentag, locale, "long"), w.naechte_buchbar, w.naechte_gebucht, w.auslastung_pct, w.anreisen, geld(w.umsatz), geld(w.adr)]),
          },
          {
            titel: t("patterns.leadTime"),
            kopf: [t("patterns.days"), t("col.bookingsShort"), t("col.share") + " (%)", t("col.nights"), t("kpi.revenue") + einheit],
            zeilen: a.buchungsfenster.map((z) => [z.schluessel, z.buchungen, z.anteil_pct, z.naechte, geld(z.umsatz)]),
          },
          {
            titel: t("patterns.stayLength"),
            kopf: [t("patterns.nights"), t("col.bookingsShort"), t("col.share") + " (%)", t("col.nights"), t("kpi.revenue") + einheit],
            zeilen: a.aufenthaltsdauer.map((z) => [z.schluessel, z.buchungen, z.anteil_pct, z.naechte, geld(z.umsatz)]),
          },
        ];
      case "stornos":
        return [
          {
            titel: t("cancellations.byChannel"),
            kopf: [t("col.channel"), t("col.cancellations"), t("col.nights"), t("cancellations.lostRevenue") + einheit, t("cancellations.leadTime")],
            zeilen: a.stornos.kanaele.map((k) => [kanal(k.channel, k.ota_name), k.stornos, k.naechte, geld(k.umsatz_entgangen), k.vorlauf_tage]),
          },
          {
            titel: t("cancellations.byReason"),
            kopf: [t("col.reason"), t("col.count")],
            zeilen: a.stornos.gruende.map((g) => [g.grund ?? t("cancellations.noReason"), g.anzahl]),
          },
        ];
    }
  }, [daten, reiter, buchungOpt, auslastungOpt, pace, t, locale, datum, channelLabel]);

  const exportieren = useCallback(
    async (format: ExportFormat) => {
      if (!daten) return;
      setExportLaeuft(true);
      setExportFehler(null);
      const name = `auswertung-${reiter}-${stand.von}_${stand.bis}`;
      const filter = [
        `${datum(stand.von)} – ${datum(stand.bis)}`,
        t(`basis.${stand.bezug}`),
        stand.propertyIds.length
          ? stand.propertyIds.map((id) => objekte.find((o) => o.value === id)?.label ?? id).join(", ")
          : t("filter.allProperties"),
        stand.channels.length
          ? stand.channels.map((c) => kanaele.find((k) => k.value === c)?.label ?? c).join(", ")
          : t("filter.allChannels"),
        ...(stand.status.length ? [stand.status.map((s) => t(`status.${s}`)).join(", ")] : []),
        ...(stand.vergleich !== "keiner" ? [t(`compare.${stand.vergleich}`)] : []),
      ];
      try {
        if (format === "csv") {
          // CSV kann nur EINE Tabelle tragen: die erste ist die Haupttabelle
          // des Reiters, die Übrigen gibt es in Excel und PDF.
          const [erste] = exportTabellen;
          if (erste) exportCsv(erste, name);
        } else if (format === "xlsx") {
          exportXlsx(exportTabellen, name);
        } else {
          await exportPdf(
            {
              titel: `${t("title")} · ${t(`tab.${reiter}`)}`,
              untertitel: t("subtitle"),
              filter,
              erzeugt: t("export.generated", { when: new Date().toLocaleString(locale) }),
            },
            exportTabellen,
            name,
          );
        }
      } catch (exc) {
        setExportFehler(exc instanceof Error ? exc.message : t("export.failed"));
      } finally {
        setExportLaeuft(false);
      }
    },
    [daten, reiter, stand, exportTabellen, t, locale, datum, objekte, kanaele],
  );

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-2xl font-extrabold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        {/* Hostaway: Ansichten und Download rechts oben. */}
        <KopfAktionen
          reiter={reiter}
          ansichtLaden={ansichtLaden}
          ansichtErfassen={ansichtErfassen}
          exportieren={exportieren}
          exportLaeuft={exportLaeuft}
        />
      </header>

      <Filterleiste
        stand={stand}
        setzen={setzenGeprueft}
        objekte={objekte}
        kanaele={kanaele}
        laedt={laedt}
      />

      {(fehler || exportFehler) && (
        <Card className="flex items-center gap-2 p-4 text-sm text-destructive">
          <Icon icon="ph:warning-circle" className="size-4 shrink-0" />
          {fehler ?? exportFehler}
        </Card>
      )}

      {daten && (
        <KennzahlKacheln
          k={daten.kennzahlen}
          waehrungen={daten.waehrungen}
          vorher={daten.vorher}
        />
      )}

      <AuswertungNav aktiv={reiter} wechseln={setReiter} />

      {laedt && !daten ? (
        <Card className="flex items-center justify-center gap-2 p-12 text-sm text-muted-foreground">
          <Icon icon="ph:spinner" className="size-4 animate-spin" />
          {t("loading")}
        </Card>
      ) : daten ? (
        <div className={laedt ? "opacity-60 transition-opacity" : undefined}>
          {reiter === "kennzahlen" && <ReiterKennzahlen stand={stand} />}
          {reiter === "analytics" && (
            <ReiterAnalytics a={daten} optionen={analyticsOpt} setOptionen={setAnalyticsOpt} />
          )}
          {reiter === "buchungen" && (
            <ReiterBuchungen
              a={daten}
              spalten={spalten}
              setSpalten={spaltenSetzen}
              optionen={buchungOpt}
              setOptionen={setBuchungOpt}
            />
          )}
          {reiter === "auslastung" && (
            <ReiterAuslastung a={daten} optionen={auslastungOpt} setOptionen={setAuslastungOpt} />
          )}
          {reiter === "ausgaben" && <ReiterAusgaben a={daten} />}
          {reiter === "kanaele" && <ReiterKanaele a={daten} />}
          {reiter === "gaeste" && <ReiterGaeste a={daten} />}
          {reiter === "pace" && (
            <ReiterPace propertyIds={stand.propertyIds} channels={stand.channels} onDaten={setPace} />
          )}
          {reiter === "muster" && <ReiterMuster a={daten} />}
          {reiter === "stornos" && <ReiterStornos a={daten} />}
        </div>
      ) : null}
    </div>
  );
}

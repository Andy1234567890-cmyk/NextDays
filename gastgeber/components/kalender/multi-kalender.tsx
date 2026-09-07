"use client";

// Multi-Kalender — alle Objekte des Gastgebers untereinander, die Tage
// nebeneinander. Aufbau 1:1 nach dem Vorbild (Airbnb-Multikalender, am
// 06.09.2026 im Browser ausgemessen):
//
//   ┌ Werkzeugleiste: Monatswahl · Heute · Ebenen ────────────────────────┐
//   ├ Inserate (17,5 rem) ┬ Monatstitel + ‹ › + Tageskopf (Spalte 5 rem) ─┤
//   │ Bild · Titel · Adr. │ Preiszellen (3 rem hoch) + Buchungsbalken     │
//   └─────────────────────┴───────────────────────────────────────────────┘
//
// Drei getrennte Rollbereiche, die synchron laufen: die Inserate-Liste folgt
// dem senkrechten Rollen des Rasters, der Tageskopf dem waagerechten. Das ist
// der Weg des Vorbilds und hält Kopf und Seitenleiste ohne `position: sticky`
// über tausenden Zellen an Ort und Stelle.
//
// Auswahl: ziehen über Zellen wählt ein RECHTECK aus Objekten × Tagen — genau
// wie dort. Die Auswahl öffnet rechts das Bearbeiten-Panel (Verfügbarkeit,
// Preis); ein Klick auf einen Buchungsbalken öffnet stattdessen die Buchung.
//
// Was NICHT nachgebaut ist und warum: „14 verfügbare Chancen" (dahinter liegt
// Airbnbs Empfehlungs-Engine, die es bei uns nicht gibt) und die Regel-Ebene
// mit Saisonsätzen — Saisons gibt es, sie hängen aber am Objekt und nicht am
// Kalendertag; eine Ebene, die immer leer bliebe, wäre eine Attrappe.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { formatCurrency } from "@nextdays/currency";

import { useFormatierung } from "@/lib/formatierung";
import {
  alsDatum,
  isoTag,
  monatsAnfang,
  tagPlus,
  tageZwischen,
  tagesReihe,
} from "@/lib/kalender-datum";
import {
  ladeKalenderFenster,
  ladeRabatte,
  ladeSaisons,
  wendeRegelsatzAn,
} from "@/lib/kalender-actions";
import type {
  KalenderBuchung,
  KalenderFenster,
  KalenderTag,
  Rabatt,
  Saison,
} from "@/lib/kalender";
import {
  BALKEN_REM,
  KOPF_REM,
  LEISTE_REM,
  NAV_REM,
  SEITE_REM,
  TAGKOPF_REM,
  SPALTE_REM,
  SCHRAFFUR,
  ZEILE_REM,
  balkenGeometrie,
} from "@/lib/kalender-mass";
import type { Property } from "@/lib/properties";
import { useRealtime } from "@/lib/use-realtime";

import { BearbeitenPanel } from "./bearbeiten-panel";
import { BuchungPanel } from "./buchung-panel";
import {
  FilterPanel,
  LEERER_FILTER,
  istGefiltert,
  trifftFilter,
  type InseratFilter,
} from "./filter-panel";
import { SaisonPanel } from "./saison-panel";

/** Wie viele Monate vor und nach heute die Monatswahl anbietet. */
const MONATE_ZURUECK = 12;
const MONATE_VOR = 24;
/** Nachgeladen wird immer ein ganzer Block, nicht Tag für Tag. */
const NACHLADE_TAGE = 60;

export type Ebenen = {
  preis: boolean;
  mindestaufenthalt: boolean;
  gast: boolean;
  saison: boolean;
};

type Auswahl = { zeileVon: number; zeileBis: number; spalteVon: number; spalteBis: number };

function sortiert(a: number, b: number): [number, number] {
  return a <= b ? [a, b] : [b, a];
}

export function MultiKalender({
  objekte,
  fenster: start,
  heute,
}: {
  objekte: Property[];
  fenster: KalenderFenster;
  /** Heutiger Tag, serverseitig gebildet — der Client bestätigt ihn beim Mount
   *  aus seiner eigenen Zeitzone (die des Gastgebers ist die maßgebliche). */
  heute: string;
}) {
  const t = useTranslations("kalender");
  const f = useFormatierung();

  const [fenster, setFenster] = useState(start);
  const [heuteLokal, setHeuteLokal] = useState(heute);
  const [suche, setSuche] = useState("");
  const [ebenen, setEbenen] = useState<Ebenen>({
    preis: true,
    mindestaufenthalt: false,
    gast: true,
    saison: false,
  });
  const [ebenenOffen, setEbenenOffen] = useState(false);
  const [auswahl, setAuswahl] = useState<Auswahl | null>(null);
  // Das Ziehen läuft über einen Ref, NICHT über State: `pointerenter` der
  // nächsten Zelle kommt oft noch im selben Tick wie `pointerdown` — ein
  // State-Wert wäre dort noch der alte (false), und die Auswahl bliebe bei
  // einer einzigen Zelle stehen. Live nachgestellt am 06.09.2026.
  const zieht = useRef(false);
  const [buchungId, setBuchungId] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);
  const [filter, setFilter] = useState<InseratFilter>(LEERER_FILTER);
  const [filterOffen, setFilterOffen] = useState(false);
  const [saisons, setSaisons] = useState<Saison[] | null>(null);
  const [rabatte, setRabatte] = useState<Rabatt[]>([]);
  const [saisonsLaden, setSaisonsLaden] = useState(false);
  const [saisonPanelZu, setSaisonPanelZu] = useState(false);
  // Ein per „Anwenden" vorgemerkter Regelsatz. Er wartet auf die nächste
  // Auswahl — dasselbe Vorgehen wie im Vorbild, dessen Editor in Schritt 3
  // sagt: „Wähle die Reisedaten und Inserate ... in deinem Kalender aus."
  // Ohne diesen Zwischenzustand hätte der Knopf nichts, worauf er wirken kann:
  // sobald etwas ausgewählt ist, steht an der Stelle des Regelsatz-Panels das
  // Bearbeiten-Panel.
  const [vorgemerkt, setVorgemerkt] = useState<Saison | null>(null);
  const [wendetAn, setWendetAn] = useState(false);

  const kopfRef = useRef<HTMLDivElement>(null);
  const rasterRef = useRef<HTMLDivElement>(null);
  const seiteRef = useRef<HTMLDivElement>(null);
  // Der zuletzt gemeldete Fehler — ein zweiter identischer Toast beim nächsten
  // Rollen wäre Lärm statt Information.
  const letzterFehler = useRef<string | null>(null);

  // Die Zeitzone des Betrachters entscheidet, welcher Tag „heute" ist. Der
  // Server kennt sie nicht (Wurzel 5b) — beim Mount wird sein Wert bestätigt
  // oder ersetzt, nicht blind übernommen.
  useEffect(() => {
    const lokal = isoTag(new Date());
    if (lokal !== heute) setHeuteLokal(lokal);
  }, [heute]);

  const tage = useMemo(
    () => tagesReihe(fenster.start, fenster.end),
    [fenster.start, fenster.end],
  );

  const gefilterte = useMemo(() => {
    const q = suche.trim().toLowerCase();
    return objekte.filter((o) => {
      if (!trifftFilter(o, filter)) return false;
      if (!q) return true;
      return [o.title, o.street, o.city, o.postal_code]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [objekte, suche, filter]);

  // Tagesdaten je Objekt als Nachschlagewerk: das Raster fragt pro Zelle
  // genau einmal, statt in jeder Zelle durch eine Liste zu laufen.
  const tagesDaten = useMemo(() => {
    const karte = new Map<string, Map<string, KalenderTag>>();
    for (const o of fenster.objekte) {
      karte.set(o.property_id, new Map(o.days.map((d) => [d.date, d])));
    }
    return karte;
  }, [fenster.objekte]);

  const waehrungen = useMemo(() => {
    const karte = new Map<string, string | null>();
    for (const o of fenster.objekte) karte.set(o.property_id, o.currency);
    return karte;
  }, [fenster.objekte]);

  const buchungenJeObjekt = useMemo(() => {
    const karte = new Map<string, KalenderBuchung[]>();
    for (const b of fenster.buchungen) {
      const liste = karte.get(b.property_id);
      if (liste) liste.push(b);
      else karte.set(b.property_id, [b]);
    }
    return karte;
  }, [fenster.buchungen]);

  const neuLaden = useCallback(
    async (neuStart: string, neuEnde: string) => {
      setLaedt(true);
      const res = await ladeKalenderFenster(
        objekte.map((o) => o.id),
        neuStart,
        neuEnde,
      );
      setLaedt(false);
      if (res.ok) {
        setFenster(res.data);
        letzterFehler.current = null;
      } else if (letzterFehler.current !== res.fehler) {
        letzterFehler.current = res.fehler;
        toast.error(res.fehler);
      }
    },
    [objekte],
  );

  // Eine neue Buchung (Marktplatz oder Portal) erscheint ohne Neuladen der
  // Seite. `availability` speist die Zellen, kommt aber nicht durch die
  // Publikation — `reservations` ist die erlaubte Quelle, und jede Buchung
  // schreibt dort ohnehin (Wurzel 1: die Nächte folgen der Reservierung).
  useRealtime({
    table: "reservations",
    onChange: () => void neuLaden(fenster.start, fenster.end),
  });

  // Saisons werden erst geholt, wenn sie jemand sehen will — als Ebene, im
  // Standard-Panel oder im Bearbeiten-Panel. Sie kosten je Objekt einen
  // Aufruf; sie beim Seitenaufbau blind zu laden hieße, 20 Anfragen für eine
  // Ansicht zu stellen, die viele nie öffnen.
  const saisonsHolen = useCallback(
    async (erzwingen = false) => {
      if (!erzwingen && (saisons !== null || saisonsLaden)) return;
      setSaisonsLaden(true);
      const ids = objekte.map((o) => o.id);
      // Saisons UND Rabatte gehören zum selben Regelsatz — sie zusammen zu
      // holen erspart der Karte einen halb gefüllten Zwischenzustand.
      const [s, r] = await Promise.all([ladeSaisons(ids), ladeRabatte(ids)]);
      setSaisonsLaden(false);
      if (s.ok) setSaisons(s.data);
      else toast.error(s.fehler);
      if (r.ok) setRabatte(r.data);
    },
    [objekte, saisons, saisonsLaden],
  );

  // Saison-Tage als Nachschlagewerk: Objekt → Tag → Saison.
  const saisonTage = useMemo(() => {
    const karte = new Map<string, Map<string, Saison>>();
    for (const s of saisons ?? []) {
      const je = karte.get(s.property_id) ?? new Map<string, Saison>();
      for (const a of s.assignments) {
        for (let tag = a.start_date; tag <= a.end_date; tag = tagPlus(tag, 1)) {
          je.set(tag, s);
        }
      }
      karte.set(s.property_id, je);
    }
    return karte;
  }, [saisons]);

  // Das Standard-Panel zeigt die Saisons — also werden sie geholt, sobald es
  // sichtbar ist (nichts ausgewählt, Panel nicht eingeklappt).
  useEffect(() => {
    if (!auswahl && !buchungId && !saisonPanelZu) void saisonsHolen();
  }, [auswahl, buchungId, saisonPanelZu, saisonsHolen]);

  // Rollen gleichschalten: das Raster führt, Kopf und Seitenleiste folgen.
  function beimRollen(e: React.UIEvent<HTMLDivElement>) {
    const el = e.currentTarget;
    if (kopfRef.current) kopfRef.current.scrollLeft = el.scrollLeft;
    if (seiteRef.current) seiteRef.current.scrollTop = el.scrollTop;
  }

  // Ein Ziehen endet auch dann, wenn die Maus außerhalb des Rasters losgelassen
  // wird — sonst bliebe die Auswahl am Zeiger kleben.
  useEffect(() => {
    const auf = () => {
      zieht.current = false;
    };
    window.addEventListener("pointerup", auf);
    return () => window.removeEventListener("pointerup", auf);
  }, []);

  function springeZu(monat: string) {
    const neuStart = tagPlus(monat, -7);
    void neuLaden(neuStart, tagPlus(neuStart, NACHLADE_TAGE + 14));
    rasterRef.current?.scrollTo({ left: 7 * 16 * SPALTE_REM, behavior: "auto" });
  }

  function blaettere(tage: number) {
    const el = rasterRef.current;
    if (!el) return;
    const schritt = tage * SPALTE_REM * 16;
    const ziel = el.scrollLeft + schritt;
    // Am Rand des geladenen Fensters wird nachgeladen statt am Anschlag zu
    // hängen — der Gastgeber merkt vom Nachladen nur die kurze Ladeanzeige.
    if (ziel < 0) {
      void neuLaden(tagPlus(fenster.start, -NACHLADE_TAGE), fenster.end);
      return;
    }
    if (ziel + el.clientWidth > el.scrollWidth) {
      void neuLaden(fenster.start, tagPlus(fenster.end, NACHLADE_TAGE));
    }
    el.scrollTo({ left: Math.max(0, ziel), behavior: "smooth" });
  }

  function zuHeute() {
    const index = tageZwischen(fenster.start, heuteLokal);
    if (index < 0 || index >= tage.length) {
      springeZu(monatsAnfang(heuteLokal));
      return;
    }
    rasterRef.current?.scrollTo({
      left: Math.max(0, (index - 1) * SPALTE_REM * 16),
      behavior: "smooth",
    });
  }

  const monate = useMemo(() => {
    const aus: string[] = [];
    const [y, m] = monatsAnfang(heuteLokal).split("-").map(Number);
    for (let i = -MONATE_ZURUECK; i <= MONATE_VOR; i++) {
      const d = new Date(y, m - 1 + i, 1);
      aus.push(isoTag(d));
    }
    return aus;
  }, [heuteLokal]);

  const sichtbarerMonat = useMemo(() => {
    // Der Monat, in dem die Mitte des sichtbaren Bereichs liegt — dieselbe
    // Regel wie im Vorbild, wo die Überschrift beim Rollen mitwandert.
    return monatsAnfang(tage[Math.min(7, tage.length - 1)] ?? fenster.start);
  }, [tage, fenster.start]);

  const gewaehlteObjekte = auswahl
    ? gefilterte
        .slice(
          ...sortiert(auswahl.zeileVon, auswahl.zeileBis).map((n, i) =>
            i === 1 ? n + 1 : n,
          ),
        )
        .map((o) => o.id)
    : [];
  const [spalteA, spalteB] = auswahl
    ? sortiert(auswahl.spalteVon, auswahl.spalteBis)
    : [0, 0];
  const gewaehltVon = auswahl ? tage[spalteA] : null;
  const gewaehltBis = auswahl ? tage[spalteB] : null;

  /**
   * Zeitraum aus den Datumsfeldern des Panels übernehmen. Liegt ein Datum
   * außerhalb des geladenen Fensters, wird nachgeladen — sonst zeigte das
   * Raster eine Auswahl, die es gar nicht darstellen kann.
   */
  function zeitraumSetzen(neuVon: string, neuBis: string) {
    const a = tageZwischen(fenster.start, neuVon);
    const b = tageZwischen(fenster.start, neuBis);
    if (a < 0 || b >= tage.length) {
      void neuLaden(
        a < 0 ? tagPlus(neuVon, -7) : fenster.start,
        b >= tage.length ? tagPlus(neuBis, 7) : fenster.end,
      );
      return;
    }
    setAuswahl((alt) =>
      alt ? { ...alt, spalteVon: a, spalteBis: b } : alt,
    );
  }

  /**
   * Den vorgemerkten Regelsatz auf die aktuelle Auswahl anwenden.
   *
   * Objekte, die den Satz noch nicht haben, bekommen ihn als eigenständige
   * Kopie (die Action erledigt das) — genau das leistet im Vorbild die
   * konto-weite Wiederverwendbarkeit eines Regelsatzes. Was NICHT gesetzt
   * werden konnte, wird benannt statt geschluckt (Wurzel 5).
   */
  async function vorgemerktAnwenden() {
    if (!vorgemerkt || !gewaehltVon || !gewaehltBis || gewaehlteObjekte.length === 0) {
      return;
    }
    setWendetAn(true);
    const res = await wendeRegelsatzAn(
      vorgemerkt, gewaehlteObjekte, gewaehltVon, gewaehltBis,
    );
    setWendetAn(false);
    if (!res.ok) {
      toast.error(res.fehler);
      return;
    }
    if (res.data.gesetzt.length > 0) {
      toast.success(
        t("regelsatzAngewendet", {
          name: vorgemerkt.name,
          anzahl: res.data.gesetzt.length,
        }),
      );
    }
    if (res.data.fehlgeschlagen.length > 0) {
      toast.error(
        t("regelsatzTeilweise", { anzahl: res.data.fehlgeschlagen.length }),
      );
    }
    setVorgemerkt(null);
    setAuswahl(null);
    void neuLaden(fenster.start, fenster.end);
    void saisonsHolen(true);
  }

  function zelleGewaehlt(zeile: number, spalte: number): boolean {
    if (!auswahl) return false;
    const [z1, z2] = sortiert(auswahl.zeileVon, auswahl.zeileBis);
    const [s1, s2] = sortiert(auswahl.spalteVon, auswahl.spalteBis);
    return zeile >= z1 && zeile <= z2 && spalte >= s1 && spalte <= s2;
  }

  const rasterBreite = `${tage.length * SPALTE_REM}rem`;

  if (objekte.length === 0) {
    return (
      <div className="mx-auto max-w-xl px-8 py-20 text-center">
        <p className="font-display text-2xl font-semibold">{t("keineObjekte")}</p>
        <Link
          href="/objekt-einstellen"
          className="mt-6 inline-flex rounded-full bg-foreground px-7 py-3 text-sm font-medium text-background"
        >
          {t("objektAnlegen")}
        </Link>
      </div>
    );
  }

  const werkzeugleiste = (
    <div
      style={{ height: `${LEISTE_REM}rem` }}
      className="flex items-center gap-3 border-b border-border px-4"
    >
        <select
          value={sichtbarerMonat}
          onChange={(e) => springeZu(e.target.value)}
          aria-label={t("monatWaehlen")}
          className="h-8 rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:border-foreground"
        >
          {monate.map((m) => (
            <option key={m} value={m}>
              {f.datum(alsDatum(m), { month: "long", year: "numeric" })}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={zuHeute}
          className="h-8 rounded-lg border border-border px-4 text-sm transition-colors hover:bg-muted"
        >
          {t("heute")}
        </button>

        {laedt && (
          <span className="flex items-center gap-2 text-sm text-muted-foreground">
            <Icon icon="ph:spinner" className="size-4 animate-spin" />
            {t("laedt")}
          </span>
        )}

        <div className="relative ms-auto">
          <button
            type="button"
            onClick={() => setEbenenOffen(!ebenenOffen)}
            aria-expanded={ebenenOffen}
            aria-label={`${t("ebenen")} — ${t("ebenenHinweis")}`}
            className="flex h-8 items-center gap-2 rounded-lg border border-border px-4 text-sm transition-colors hover:bg-muted"
          >
            {t("ebenen")}
            <Icon icon="ph:caret-down" className="size-3.5" aria-hidden="true" />
          </button>
          {ebenenOffen && (
            <>
              {/* Klick daneben schließt — ohne diese Fläche bliebe das Menü
                  offen und läge über dem Raster. */}
              <button
                type="button"
                aria-label={t("schliessen")}
                onClick={() => setEbenenOffen(false)}
                className="fixed inset-0 z-40 cursor-default"
              />
              <div className="absolute end-0 z-50 mt-2 w-60 rounded-xl border border-border bg-background p-2 shadow-lg">
                {(
                  [
                    ["preis", "ebenePreis"],
                    ["mindestaufenthalt", "ebeneMindestaufenthalt"],
                    ["gast", "ebeneGast"],
                    ["saison", "ebeneSaison"],
                  ] as const
                ).map(([key, label]) => (
                  <label
                    key={key}
                    className="flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm hover:bg-muted"
                  >
                    <input
                      type="checkbox"
                      checked={ebenen[key]}
                      onChange={(e) => {
                        setEbenen({ ...ebenen, [key]: e.target.checked });
                        if (key === "saison" && e.target.checked) void saisonsHolen();
                      }}
                      className="size-4 accent-foreground"
                    />
                    {t(label)}
                  </label>
                ))}
              </div>
            </>
          )}
        </div>
    </div>
  );

  return (
    <div className="flex h-[calc(100svh-5rem)]">
        {/* Inserate-Spalte */}
        <aside
          style={{ width: `${SEITE_REM}rem` }}
          className="flex shrink-0 flex-col border-e border-border"
        >
          <div
            style={{ height: `${KOPF_REM}rem` }}
            className="flex flex-col justify-end border-b border-border px-4 pb-3"
          >
            <p className="font-display text-xl font-semibold tracking-tight">
              {objekte.length === 1
                ? t("einInserat")
                : t("inserate", { anzahl: objekte.length })}
            </p>
            <div className="relative mt-3 flex items-center gap-2">
              <div className="flex flex-1 items-center gap-2 rounded-full border border-border px-3">
                <Icon
                  icon="ph:magnifying-glass"
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <input
                  value={suche}
                  onChange={(e) => setSuche(e.target.value)}
                  placeholder={t("suchePlatzhalter")}
                  aria-label={t("suchePlatzhalter")}
                  className="h-9 w-full bg-transparent text-sm outline-none"
                />
              </div>
              <button
                type="button"
                onClick={() => setFilterOffen(!filterOffen)}
                aria-expanded={filterOffen}
                aria-label={t("filterTitel")}
                className={`flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors ${
                  istGefiltert(filter)
                    ? "border-foreground bg-foreground text-background"
                    : "border-border hover:bg-muted"
                }`}
              >
                <Icon icon="ph:sliders-horizontal" className="size-4" />
              </button>
              {filterOffen && (
                <FilterPanel
                  filter={filter}
                  onAnwenden={(f) => {
                    setFilter(f);
                    setFilterOffen(false);
                  }}
                  onSchliessen={() => setFilterOffen(false)}
                />
              )}
            </div>
          </div>
          {/* Rollt nicht selbst — der senkrechte Stand kommt vom Raster. */}
          <div ref={seiteRef} className="flex-1 overflow-hidden">
            {gefilterte.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">
                {t("keinTreffer")}
              </p>
            ) : (
              gefilterte.map((o) => (
                // Der Klick auf ein Objekt führt in SEINEN Kalender, nicht in
                // den Objekt-Editor — wie im Vorbild, wo dasselbe zu
                // `/multicalendar/{listing_id}` führt. Aus dem Rasterblick über
                // zwanzig Objekte wird so der Monatsblick auf eines; der Weg in
                // die Stammdaten steht dort im rechten Panel.
                <Link
                  key={o.id}
                  href={`/kalender/${o.id}`}
                  style={{ height: `${ZEILE_REM}rem` }}
                  className="flex items-center gap-3 border-b border-border px-2 transition-colors hover:bg-muted/60"
                >
                  <span className="relative flex size-8 w-10 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
                    {o.photos[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={o.photos[0]}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      <Icon
                        icon="solar:home-2-bold-duotone"
                        className="size-5 text-muted-foreground"
                      />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span
                        aria-hidden="true"
                        className={`size-1.5 shrink-0 rounded-full ${
                          o.status === "active" ? "bg-emerald-500" : "bg-muted-foreground/40"
                        }`}
                      />
                      <span className="truncate text-xs font-medium">{o.title}</span>
                    </span>
                    <span className="block truncate text-xs text-muted-foreground">
                      {[o.street, o.house_number].filter(Boolean).join(" ") ||
                        o.city ||
                        t("ohneAdresse")}
                    </span>
                  </span>
                </Link>
              ))
            )}
          </div>
        </aside>

        {/* Raster */}
        <div className="flex min-w-0 flex-1 flex-col">
          {werkzeugleiste}

          {/* Band während einer Vormerkung: der Regelsatz wartet sichtbar auf
              seine Auswahl. Ohne diese Zeile wäre „Anwenden" ein Klick ohne
              Rückmeldung — der Gastgeber wüsste nicht, dass der Kalender jetzt
              auf ihn wartet. */}
          {vorgemerkt && (
            <div className="flex items-center gap-3 border-b border-border bg-muted/40 px-4 py-2">
              <span
                aria-hidden="true"
                style={{ backgroundColor: `${vorgemerkt.color}1a` }}
                className="size-4 shrink-0 rounded"
              />
              <p className="min-w-0 flex-1 truncate text-sm">
                {gewaehlteObjekte.length > 0
                  ? t("regelsatzBereit", {
                      name: vorgemerkt.name,
                      anzahl: gewaehlteObjekte.length,
                    })
                  : t("regelsatzWaehleAuswahl", { name: vorgemerkt.name })}
              </p>
              <button
                type="button"
                onClick={() => void vorgemerktAnwenden()}
                disabled={wendetAn || gewaehlteObjekte.length === 0}
                className="h-8 shrink-0 rounded-lg bg-foreground px-4 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {wendetAn ? t("wirdGespeichert") : t("regelsatzAnwenden")}
              </button>
              <button
                type="button"
                onClick={() => setVorgemerkt(null)}
                disabled={wendetAn}
                className="h-8 shrink-0 rounded-lg border border-border px-4 text-sm transition-colors hover:bg-muted"
              >
                {t("abbrechen")}
              </button>
            </div>
          )}
          <div
            style={{ height: `${NAV_REM}rem` }}
            className="flex items-center gap-2 px-4"
          >
            <button
              type="button"
              onClick={() => blaettere(-7)}
              aria-label={t("vorherigeWoche")}
              className="flex size-7 items-center justify-center rounded-full transition-colors hover:bg-muted"
            >
              <Icon icon="ph:caret-left" className="size-4" />
            </button>
            <p className="font-display text-base font-semibold">
              {f.datum(alsDatum(sichtbarerMonat), { month: "long", year: "numeric" })}
            </p>
            <button
              type="button"
              onClick={() => blaettere(7)}
              aria-label={t("naechsteWoche")}
              className="flex size-7 items-center justify-center rounded-full transition-colors hover:bg-muted"
            >
              <Icon icon="ph:caret-right" className="size-4" />
            </button>
          </div>

          {/* Tageskopf — folgt dem waagerechten Rollen des Rasters */}
          <div
            ref={kopfRef}
            style={{ height: `${TAGKOPF_REM}rem` }}
            className="overflow-hidden border-b border-border"
          >
            <div style={{ width: rasterBreite }} className="flex">
              {tage.map((tag) => {
                const istHeute = tag === heuteLokal;
                return (
                  <div
                    key={tag}
                    style={{ width: `${SPALTE_REM}rem` }}
                    className="flex shrink-0 flex-col items-center py-2"
                  >
                    <span className="text-xs text-muted-foreground">
                      {f.datum(alsDatum(tag), { weekday: "short" })}
                    </span>
                    <span
                      className={`mt-0.5 flex size-7 items-center justify-center rounded-md text-sm ${
                        istHeute
                          ? "bg-buchung font-bold text-white"
                          : "font-medium text-foreground"
                      }`}
                    >
                      {f.datum(alsDatum(tag), { day: "numeric" })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div ref={rasterRef} onScroll={beimRollen} className="flex-1 overflow-auto">
            <div style={{ width: rasterBreite }} className="relative">
              {gefilterte.map((objekt, zeile) => {
                const daten = tagesDaten.get(objekt.id);
                const waehrung = waehrungen.get(objekt.id) ?? objekt.currency;
                const buchungen = buchungenJeObjekt.get(objekt.id) ?? [];
                return (
                  <div
                    key={objekt.id}
                    style={{ height: `${ZEILE_REM}rem` }}
                    className="relative flex border-b border-border"
                  >
                    {tage.map((tag, spalte) => {
                      const d = daten?.get(tag);
                      const vergangen = tag < heuteLokal;
                      const gesperrt = d?.status === "blocked";
                      const gebucht = d?.status === "booked";
                      const gewaehlt = zelleGewaehlt(zeile, spalte);
                      const saison = ebenen.saison
                        ? saisonTage.get(objekt.id)?.get(tag)
                        : undefined;
                      return (
                        <button
                          key={tag}
                          type="button"
                          disabled={vergangen}
                          onPointerDown={() => {
                            if (vergangen) return;
                            setBuchungId(null);
                            void saisonsHolen();
                            zieht.current = true;
                            setAuswahl({
                              zeileVon: zeile,
                              zeileBis: zeile,
                              spalteVon: spalte,
                              spalteBis: spalte,
                            });
                          }}
                          onPointerEnter={() => {
                            if (!zieht.current || vergangen) return;
                            setAuswahl((a) =>
                              a ? { ...a, zeileBis: zeile, spalteBis: spalte } : a,
                            );
                          }}
                          /* Beschriftung wie im Vorbild: Objekt, Datum,
                             „Nicht verfügbar" wenn belegt, dann was ein Klick
                             tut. Für Screenreader ist das die ganze Zelle. */
                          aria-label={[
                            objekt.title,
                            f.datum(alsDatum(tag), {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            }),
                            gesperrt || gebucht ? t("nichtVerfuegbar") : null,
                            saison?.name,
                            vergangen ? t("vergangen") : t("alsStartdatum"),
                          ]
                            .filter(Boolean)
                            .join(", ")}
                          style={{ width: `${SPALTE_REM}rem` }}
                          className={`relative shrink-0 border-e border-border text-start outline-none ${
                            vergangen ? "cursor-default bg-muted/40" : "hover:bg-muted/40"
                          } ${gewaehlt ? "z-10 ring-2 ring-inset ring-foreground" : ""}`}
                        >
                          {gesperrt && (
                            <span
                              aria-hidden="true"
                              style={SCHRAFFUR}
                              className="absolute inset-0"
                            />
                          )}
                          {/* Saison als schmaler Streifen am unteren Rand —
                              die Farbe ist die der Saison selbst, damit Karte
                              im Panel und Tag im Raster zusammenfinden. */}
                          {saison && (
                            <span
                              aria-hidden="true"
                              title={saison.name}
                              style={{ backgroundColor: saison.color }}
                              className="absolute inset-x-0 bottom-0 h-1"
                            />
                          )}
                          {ebenen.preis && d?.price != null && (
                            <span
                              className={`absolute inset-x-0 top-1.5 text-center text-xs tabular-nums ${
                                vergangen ? "text-muted-foreground" : "text-foreground"
                              }`}
                            >
                              {formatCurrency(d.price, waehrung)}
                            </span>
                          )}
                          {ebenen.mindestaufenthalt && d?.min_stay != null && (
                            <span className="absolute inset-x-0 bottom-1 text-center text-[0.625rem] text-muted-foreground">
                              {d.min_stay === 1
                                ? t("mindestEine")
                                : t("mindestKurz", { naechte: d.min_stay })}
                            </span>
                          )}
                        </button>
                      );
                    })}

                    {/* Buchungsbalken über den Zellen */}
                    {buchungen.map((b) => {
                      const vonIdx = Math.max(
                        0,
                        tageZwischen(fenster.start, b.check_in),
                      );
                      const bisIdx = Math.min(
                        tage.length,
                        tageZwischen(fenster.start, b.check_out),
                      );
                      const naechte = bisIdx - vonIdx;
                      if (naechte <= 0) return null;
                      const geo = balkenGeometrie(vonIdx, naechte);
                      const betrag =
                        b.total_amount != null
                          ? formatCurrency(b.total_amount, b.currency)
                          : null;
                      return (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => {
                            setAuswahl(null);
                            setBuchungId(b.id);
                          }}
                          style={{
                            ...geo,
                            height: `${BALKEN_REM}rem`,
                            top: `${(ZEILE_REM - BALKEN_REM) / 2}rem`,
                          }}
                          className={`absolute z-20 flex items-center gap-2 overflow-hidden rounded-full px-3 text-xs font-bold text-white transition-opacity hover:opacity-90 ${
                            b.is_owner_stay ? "bg-buchung-fahl" : "bg-buchung"
                          }`}
                          title={`${b.guest_name} · ${f.datum(alsDatum(b.check_in), {
                            day: "2-digit",
                            month: "short",
                          })} – ${f.datum(alsDatum(b.check_out), {
                            day: "2-digit",
                            month: "short",
                          })}`}
                        >
                          {ebenen.gast && (
                            <span className="truncate">
                              {b.is_owner_stay ? t("eigennutzung") : b.guest_name}
                            </span>
                          )}
                          {betrag && !b.is_owner_stay && (
                            <span className="truncate font-normal tabular-nums">
                              {betrag}
                            </span>
                          )}
                          {/* Rechtsbündig am Balkenende, wie im Vorbild: bei
                              einem laufenden Aufenthalt „Aktueller Gast",
                              sonst der Buchungsstatus. Nur wenn der Balken
                              breit genug ist — sonst verdrängt es den Namen. */}
                          {naechte >= 2 && (
                            <span className="ms-auto shrink-0 ps-2 font-normal opacity-90">
                              {b.check_in <= heuteLokal && b.check_out > heuteLokal
                                ? t("aktuellerGast")
                                : t(
                                    b.status === "pending"
                                      ? "statusPending"
                                      : b.status === "completed"
                                        ? "statusCompleted"
                                        : "statusConfirmed",
                                  )}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Rechtes Panel: Auswahl bearbeiten ODER Buchung ansehen */}
        {gewaehltVon && gewaehltBis && gewaehlteObjekte.length > 0 ? (
          <BearbeitenPanel
            objektIds={gewaehlteObjekte}
            von={gewaehltVon}
            bis={gewaehltBis}
            tagesDaten={tagesDaten}
            saisons={saisons ?? []}
            waehrung={waehrungen.get(gewaehlteObjekte[0]) ?? null}
            onZeitraum={zeitraumSetzen}
            onSchliessen={() => setAuswahl(null)}
            onGespeichert={() => {
              void neuLaden(fenster.start, fenster.end);
              void saisonsHolen(true);
            }}
          />
        ) : buchungId ? (
          <BuchungPanel id={buchungId} onSchliessen={() => setBuchungId(null)} />
        ) : (
          <SaisonPanel
            saisons={saisons ?? []}
            rabatte={rabatte}
            objekte={objekte}
            laedt={saisonsLaden}
            eingeklappt={saisonPanelZu}
            onUmschalten={() => setSaisonPanelZu(!saisonPanelZu)}
            onGeaendert={() => {
              void saisonsHolen(true);
              void neuLaden(fenster.start, fenster.end);
            }}
            onAnwenden={(s) => setVorgemerkt(s)}
          />
        )}
    </div>
  );
}

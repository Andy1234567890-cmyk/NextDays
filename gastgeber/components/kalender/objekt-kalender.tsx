"use client";

// Kalender EINES Objekts — Vorbild: Airbnbs `/multicalendar/{listing_id}`,
// am 06.09.2026 im Browser ausgemessen (docs/AIRBNB-MULTIKALENDER-ANALYSE.md,
// Abschnitt M):
//
//   ┌ Fotoleiste ┬ Monatsraster (Mo–So, Kacheln 169 × 132) ┬ Einstellungen ┐
//   │ 56 × 60 je │ Datum · Status · „Preis pro Nacht" + Be- │ 364 px breit  │
//   │ Objekt     │ trag; Buchungen als Balken über die Zeile│ mit Chevrons  │
//   └────────────┴──────────────────────────────────────────┴───────────────┘
//
// Der Unterschied zum Multikalender ist die Blickrichtung: dort zwanzig
// Objekte über wenige Wochen, hier EIN Objekt über viele Monate. Deshalb liegen
// die Monate untereinander und werden beim Rollen nachgeladen.
//
// Die Auswahl von Tagen führt zum SELBEN Bearbeiten-Panel wie im Multikalender
// (`BearbeitenPanel`) — im Vorbild ist das eine eigene Adresse
// (`/edit-selected-dates/{von}/{bis}`), inhaltlich dieselbe Maske. Zwei
// Masken für dieselbe Handlung wären zwei Stellen, an denen eine Regel fehlen
// kann (Wurzel 1).
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
} from "@/lib/kalender-datum";
import { ladeKalenderFenster, ladeSaisons } from "@/lib/kalender-actions";
import type {
  KalenderBuchung,
  KalenderFenster,
  KalenderTag,
  Saison,
} from "@/lib/kalender";
import type { Buchungsbedingung } from "@/lib/buchungsbedingungen";
import type { PreisStand } from "@/lib/preise";
import type { Property } from "@/lib/properties";
import { useRealtime } from "@/lib/use-realtime";

import { BearbeitenPanel } from "./bearbeiten-panel";
import { BuchungPanel } from "./buchung-panel";
import { ObjektEinstellungen } from "./objekt-einstellungen";

/** Wie viele Monate der Kopf zur Auswahl anbietet. */
const MONATE_ZURUECK = 12;
const MONATE_VOR = 24;
/** Nachgeladen wird ein ganzer Block, nicht Tag für Tag. */
const NACHLADE_TAGE = 90;

/** Alle Tage eines Monats, vorne mit Leerfeldern bis zum ersten Montag. */
function monatsRaster(monat: string): (string | null)[] {
  const erster = alsDatum(monat);
  // getDay(): 0 = Sonntag. Wir beginnen montags wie das Vorbild.
  const versatz = (erster.getDay() + 6) % 7;
  const tage: (string | null)[] = Array.from({ length: versatz }, () => null);
  const naechster = monatsAnfang(tagPlus(monat, 32));
  for (let t = monat; t < naechster; t = tagPlus(t, 1)) tage.push(t);
  return tage;
}

function sortiert(a: string, b: string): [string, string] {
  return a <= b ? [a, b] : [b, a];
}

export function ObjektKalender({
  objekt,
  objekte,
  fenster: start,
  preisStand,
  bedingungen,
  heute,
}: {
  objekt: Property;
  objekte: Property[];
  fenster: KalenderFenster;
  preisStand: PreisStand | null;
  bedingungen: Buchungsbedingung[];
  heute: string;
}) {
  const t = useTranslations("kalender");
  const f = useFormatierung();

  const [fenster, setFenster] = useState(start);
  const [heuteLokal, setHeuteLokal] = useState(heute);
  const [laedt, setLaedt] = useState(false);
  const [von, setVon] = useState<string | null>(null);
  const [bis, setBis] = useState<string | null>(null);
  const zieht = useRef(false);
  const [buchungId, setBuchungId] = useState<string | null>(null);
  const [saisons, setSaisons] = useState<Saison[]>([]);
  const [leisteOffen, setLeisteOffen] = useState(false);

  const rollRef = useRef<HTMLDivElement>(null);
  const monatsMarken = useRef(new Map<string, HTMLDivElement | null>());

  useEffect(() => {
    // Der Server bildet „heute" in seiner Zone; maßgeblich ist die des
    // Gastgebers (Wurzel 5b: eine fremde Uhr ist nicht unsere Wahrheit).
    setHeuteLokal(isoTag(new Date()));
  }, []);

  const tagesDaten = useMemo(() => {
    const karte = new Map<string, Map<string, KalenderTag>>();
    for (const o of fenster.objekte) {
      karte.set(o.property_id, new Map(o.days.map((d) => [d.date, d])));
    }
    return karte;
  }, [fenster]);

  const eigeneTage = tagesDaten.get(objekt.id);
  const waehrung =
    fenster.objekte.find((o) => o.property_id === objekt.id)?.currency ?? null;

  const buchungen = useMemo(
    () => fenster.buchungen.filter((b) => b.property_id === objekt.id),
    [fenster.buchungen, objekt.id],
  );

  /** Buchung, die diese Nacht belegt (Abreisetag zählt nicht mehr). */
  const buchungAmTag = useCallback(
    (tag: string): KalenderBuchung | undefined =>
      buchungen.find((b) => b.check_in <= tag && tag < b.check_out),
    [buchungen],
  );

  const neuLaden = useCallback(
    async (neuStart: string, neuEnd: string) => {
      setLaedt(true);
      const res = await ladeKalenderFenster([objekt.id], neuStart, neuEnd);
      setLaedt(false);
      if (res.ok) setFenster(res.data);
      else toast.error(res.fehler);
    },
    [objekt.id],
  );

  const saisonsHolen = useCallback(async () => {
    const res = await ladeSaisons([objekt.id]);
    if (res.ok) setSaisons(res.data);
  }, [objekt.id]);

  useEffect(() => {
    void saisonsHolen();
  }, [saisonsHolen]);

  // Live: eine Buchung, die woanders entsteht, gehört sofort ins Bild.
  useRealtime({
    table: "reservations",
    onChange: () => void neuLaden(fenster.start, fenster.end),
  });

  useEffect(() => {
    const auf = () => {
      zieht.current = false;
    };
    window.addEventListener("pointerup", auf);
    return () => window.removeEventListener("pointerup", auf);
  }, []);

  const monate = useMemo(() => {
    const aus: string[] = [];
    for (let m = monatsAnfang(fenster.start); m <= fenster.end; m = monatsAnfang(tagPlus(m, 32))) {
      aus.push(m);
    }
    return aus;
  }, [fenster.start, fenster.end]);

  const waehlbareMonate = useMemo(() => {
    const aus: string[] = [];
    const [y, m] = monatsAnfang(heuteLokal).split("-").map(Number);
    for (let i = -MONATE_ZURUECK; i <= MONATE_VOR; i++) {
      aus.push(isoTag(new Date(y, m - 1 + i, 1)));
    }
    return aus;
  }, [heuteLokal]);

  /** Zu einem Monat rollen; liegt er außerhalb des Fensters, erst nachladen. */
  async function springeZu(monat: string) {
    if (monat < fenster.start || monat > fenster.end) {
      await neuLaden(
        monatsAnfang(tagPlus(monat, -31)),
        tagPlus(monat, NACHLADE_TAGE),
      );
      // Nach dem Nachladen steht die Marke erst im nächsten Rendern.
      setTimeout(() => {
        monatsMarken.current.get(monat)?.scrollIntoView({ block: "start" });
      }, 60);
      return;
    }
    monatsMarken.current.get(monat)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const [kopfMonat, setKopfMonat] = useState(monatsAnfang(heuteLokal));

  // Welcher Monat oben im Bild steht, entscheidet der Rollstand — nicht die
  // letzte Auswahl im Feld. Ohne diesen Abgleich steht in der Überschrift
  // „September", während der Leser den August ansieht.
  useEffect(() => {
    const roller = rollRef.current;
    if (!roller) return;
    const beobachter = new IntersectionObserver(
      (eintraege) => {
        const sichtbar = eintraege
          .filter((e) => e.isIntersecting)
          .map((e) => (e.target as HTMLElement).dataset.monat)
          .filter((m): m is string => Boolean(m))
          .sort();
        if (sichtbar[0]) setKopfMonat(sichtbar[0]);
      },
      { root: roller, rootMargin: "-10% 0px -80% 0px" },
    );
    for (const el of monatsMarken.current.values()) if (el) beobachter.observe(el);
    return () => beobachter.disconnect();
  }, [monate]);

  const [a, b] = von && bis ? sortiert(von, bis) : [null, null];
  const gewaehlt = useCallback(
    (tag: string) => (a && b ? tag >= a && tag <= b : false),
    [a, b],
  );

  return (
    <div className="flex h-[calc(100svh-5rem)]">
      {/* Fotoleiste aller Objekte — im Vorbild 56 × 60 je Eintrag. Sie ist der
          Weg zurück in den Rasterblick UND zum nächsten Objekt, ohne dazwischen
          eine Liste öffnen zu müssen. */}
      <aside
        className={`flex shrink-0 flex-col gap-3 overflow-y-auto border-e border-border py-4 transition-[width] ${
          leisteOffen ? "w-64 px-3" : "w-[5.5rem] items-center"
        }`}
      >
        <Link
          href="/kalender"
          aria-label={t("zurueckZumRaster")}
          className="flex size-10 shrink-0 items-center justify-center rounded-full border border-border transition-colors hover:bg-muted"
        >
          <Icon icon="ph:squares-four" className="size-5" aria-hidden="true" />
        </Link>
        {objekte.map((o) => {
          const aktiv = o.id === objekt.id;
          return (
            <Link
              key={o.id}
              href={`/kalender/${o.id}`}
              title={o.title}
              className={`flex shrink-0 items-center gap-3 rounded-xl ${
                leisteOffen ? "p-1" : ""
              } ${aktiv ? "ring-2 ring-foreground" : "hover:opacity-80"}`}
            >
              <span className="relative block size-14 shrink-0 overflow-hidden rounded-lg bg-muted">
                {o.photos[0] ? (
                  // Kein `next/image`: die Objektfotos liegen im Supabase-
                  // Storage, dessen Host in `next.config.js` nicht als
                  // Bild-Host steht. Der Multikalender macht es an derselben
                  // Stelle genauso — eine zweite Regelung für dieselben Bilder
                  // wäre nur eine weitere Stelle, die man vergessen kann.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={o.photos[0]}
                    alt=""
                    className="absolute inset-0 size-full object-cover"
                  />
                ) : (
                  <Icon
                    icon="ph:house"
                    className="absolute inset-0 m-auto size-5 text-muted-foreground"
                    aria-hidden="true"
                  />
                )}
              </span>
              {leisteOffen && (
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{o.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[o.street, o.house_number].filter(Boolean).join(" ")}
                  </span>
                </span>
              )}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={() => setLeisteOffen(!leisteOffen)}
          aria-label={leisteOffen ? t("leisteEinklappen") : t("leisteAusklappen")}
          className="mt-2 flex size-10 shrink-0 items-center justify-center rounded-full border border-border transition-colors hover:bg-muted"
        >
          <Icon
            icon={leisteOffen ? "ph:caret-left" : "ph:caret-right"}
            className="size-4"
            aria-hidden="true"
          />
        </button>
      </aside>

      {/* Mitte: Monatsraster */}
      <div className="relative flex min-w-0 flex-1 flex-col">
        {/* Kopf wie im Vorbild: der Monatsname IST der Umschalter (großer Titel
            mit Chevron), nicht Titel plus Auswahlfeld daneben. Das Feld liegt
            unsichtbar darüber, damit Tastatur und Vorlesegerät weiterhin eine
            echte Auswahlliste bedienen. */}
        <div className="flex items-center gap-3 px-6 py-4">
          <div className="relative">
            <span
              aria-hidden="true"
              className="flex items-center gap-2 font-display text-[2.5rem] font-medium leading-[2.75rem] tracking-[-0.075rem]"
            >
              {f.datum(alsDatum(kopfMonat), { month: "long", year: "numeric" })}
              <Icon icon="ph:caret-down" className="size-5" />
            </span>
            <select
              value={kopfMonat}
              onChange={(e) => {
                setKopfMonat(e.target.value);
                void springeZu(e.target.value);
              }}
              aria-label={t("monatWaehlen")}
              className="absolute inset-0 cursor-pointer opacity-0"
            >
              {waehlbareMonate.map((m) => (
                <option key={m} value={m}>
                  {f.datum(alsDatum(m), { month: "long", year: "numeric" })}
                </option>
              ))}
            </select>
          </div>
          {laedt && (
            <span className="flex items-center gap-2 text-sm text-muted-foreground">
              <Icon icon="ph:spinner" className="size-4 animate-spin" />
              {t("laedt")}
            </span>
          )}
        </div>

        <div className="grid grid-cols-7 border-b border-border px-6 py-3 text-sm leading-[1.125rem] text-muted-foreground">
          {/* Kurzform wie im Vorbild („Mo. Di. …"). Die Langform der
              `wochentag_*`-Schlüssel gehört in die Sperrlisten des Regelsatzes,
              wo ganze Sätze stehen — im Tageskopf würde sie die Spalten
              sprengen. */}
          {[5, 6, 7, 8, 9, 10, 11].map((tag) => (
            <span key={tag} className="text-center">
              {f.datum(new Date(2026, 0, tag), { weekday: "short" })}
            </span>
          ))}
        </div>

        <div ref={rollRef} className="flex-1 overflow-y-auto px-6 pb-16">
          {monate.map((monat) => (
            <div
              key={monat}
              ref={(el) => {
                monatsMarken.current.set(monat, el);
              }}
              data-monat={monat}
              className="pt-8"
            >
              <h2 className="mb-4 font-display text-[2.5rem] font-semibold leading-[2.75rem] tracking-[-0.075rem]">
                {f.datum(alsDatum(monat), { month: "long", year: "numeric" })}
              </h2>
              <div className="grid grid-cols-7 gap-2">
                {monatsRaster(monat).map((tag, i) => {
                  if (!tag) return <span key={`leer-${monat}-${i}`} />;
                  const d = eigeneTage?.get(tag);
                  const buchung = buchungAmTag(tag);
                  const istHeute = tag === heuteLokal;
                  const markiert = gewaehlt(tag);
                  const nichtBuchbar =
                    d?.status === "blocked" || Boolean(buchung) || tag < heuteLokal;
                  return (
                    <button
                      key={tag}
                      type="button"
                      onPointerDown={() => {
                        if (buchung) {
                          setBuchungId(buchung.id);
                          setVon(null);
                          setBis(null);
                          return;
                        }
                        zieht.current = true;
                        setBuchungId(null);
                        setVon(tag);
                        setBis(tag);
                      }}
                      onPointerEnter={() => {
                        if (zieht.current) setBis(tag);
                      }}
                      aria-pressed={markiert}
                      // Gesperrt/vergangen liest man im Vorbild an ZWEI
                      // Zeichen: graue Kachel und durchgestrichene Zahl. Ein
                      // zusätzliches „Nicht verfügbar" stünde in jeder zweiten
                      // Kachel und verdeckte den Preis, der dort die Antwort
                      // auf die eigentliche Frage ist.
                      className={`flex min-h-[8.25rem] flex-col items-center justify-center gap-1 rounded-xl border p-3 text-center transition-colors ${
                        markiert
                          ? "border-foreground bg-muted"
                          : "border-border hover:border-foreground/40"
                      } ${nichtBuchbar ? "bg-muted/50" : ""}`}
                    >
                      <span
                        className={`flex size-8 items-center justify-center rounded-full text-[1.125rem] font-medium leading-8 ${
                          istHeute
                            ? "bg-accent text-accent-foreground"
                            : "text-muted-foreground"
                        } ${nichtBuchbar && !istHeute ? "line-through" : ""}`}
                      >
                        {Number(tag.slice(8, 10))}
                      </span>
                      {buchung ? (
                        <span className="w-full truncate text-[1.125rem] leading-[1.625rem]">
                          {buchung.guest_name}
                        </span>
                      ) : (
                        <span>
                          {d?.price != null && (
                            <span className="block text-[1.125rem] leading-[1.625rem] text-muted-foreground tabular-nums">
                              {formatCurrency(d.price, waehrung)}
                            </span>
                          )}
                          {d?.min_stay != null && d.min_stay > 1 && (
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {t("minKurz", { naechte: d.min_stay })}
                            </span>
                          )}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          <div className="pt-8 text-center">
            <button
              type="button"
              onClick={() =>
                void neuLaden(fenster.start, tagPlus(fenster.end, NACHLADE_TAGE))
              }
              disabled={laedt}
              className="rounded-full border border-border px-6 py-2 text-sm transition-colors hover:bg-muted disabled:opacity-40"
            >
              {t("weitereMonate")}
            </button>
          </div>
        </div>

        {/* „Heute" und die Währung schweben im Vorbild unten rechts über dem
            Raster — dort, wo die Hand ist, wenn man sich verscrollt hat. Oben
            im Kopf säßen sie neben dem Monatsnamen und nähmen dem Titel die
            Ruhe. */}
        <div className="pointer-events-none absolute bottom-6 end-6 flex flex-col items-end gap-3">
          <button
            type="button"
            onClick={() => {
              const m = monatsAnfang(heuteLokal);
              setKopfMonat(m);
              void springeZu(m);
            }}
            className="pointer-events-auto flex items-center gap-2 rounded-full bg-background px-5 py-3 text-sm font-medium shadow-[0_2px_12px_rgba(0,0,0,0.18)] transition-transform hover:scale-[1.02]"
          >
            <Icon icon="ph:arrow-up" className="size-4" aria-hidden="true" />
            {t("heute")}
          </button>
          {waehrung && (
            <span className="pointer-events-auto rounded-full bg-background px-5 py-3 text-sm font-medium shadow-[0_2px_12px_rgba(0,0,0,0.18)]">
              {waehrung}
            </span>
          )}
        </div>
      </div>

      {/* Rechts: Auswahl bearbeiten, Buchung ansehen — sonst die Einstellungen,
          die für ALLE Nächte gelten (wie im Vorbild). */}
      {a && b ? (
        <BearbeitenPanel
          objektIds={[objekt.id]}
          von={a}
          bis={b}
          tagesDaten={tagesDaten}
          saisons={saisons}
          waehrung={waehrung}
          onZeitraum={(nv, nb) => {
            setVon(nv);
            setBis(nb);
          }}
          onSchliessen={() => {
            setVon(null);
            setBis(null);
          }}
          onGespeichert={() => {
            void neuLaden(fenster.start, fenster.end);
            void saisonsHolen();
          }}
        />
      ) : buchungId ? (
        <BuchungPanel id={buchungId} onSchliessen={() => setBuchungId(null)} />
      ) : (
        <ObjektEinstellungen
          objekt={objekt}
          preisStand={preisStand}
          bedingungen={bedingungen}
          waehrung={waehrung}
          onGeaendert={() => void neuLaden(fenster.start, fenster.end)}
        />
      )}
    </div>
  );
}

"use client";

// Eigentümer-Portal · Belegungskalender (Monatsgitter, read-only).
//
// ENTSCHEIDUNG: eigener schlanker Kalender statt Wiederverwendung von
// components/kalender/calendar-board.tsx. Begründung:
//   * CalendarBoard ist ~108 KB, kennt heute KEINE Rolle und rendert für jede
//     Rolle den vollen Gastnamen (calendar-board.tsx:433) und den Tagespreis
//     des GASTES (:1834). Beides darf ein Eigentümer nicht sehen (§4.2).
//   * Um es rollенfest zu machen, müsste man Masken quer durch die Datei
//     einziehen — jeder Fehler dort träfe die Agentur-Ansicht mit. Eine
//     Maskierung, die man vergessen kann, ist keine Maskierung.
//   * Der Eigentümer braucht ein anderes Werkzeug: keine Drag-Sperren, kein
//     Bulk-Edit, keine Restriktionen — nur lesen. Ein eigener, kleiner
//     Kalender ist hier die sichere und die ehrlichere Lösung.
//
// Was hier sichtbar ist: Saison-Farbe (aus property_seasons, dieselbe Quelle
// wie components/objekte/season-calendar.tsx), Belegungsstatus, der VORNAME des
// Gastes und die Buchungsquelle als echtes Portal-Logo. Was NICHT sichtbar ist:
// der volle Gastname und jeder Gast-Gesamtpreis (§4.2). Der einzige Betrag ist
// die persönliche Netto-Auszahlung des Eigentümers.
//
// DARSTELLUNG: ein Chip je AUFENTHALT und Einheit, über seine Nächte gespannt
// (Overlay-Ebene je Wochenzeile, dieselbe Technik wie der PMS-Kalender), in der
// KANALFARBE, mit der Summe des Aufenthalts. Vorher stand in jeder Nacht ein
// eigener Kasten: der zeigte `bookings[0]` — EINEN Vornamen, EIN Logo —
// darunter aber `owner_payout_per_night`, die SUMME aller Einheiten dieser
// Nacht. Der Betrag stimmte, die Zuordnung war falsch: bei zwei belegten
// Einheiten las sich das Geld beider Gäste als Ertrag des einen genannten.
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { PortalRealtime } from "@/components/portal/portal-realtime";
import { Card, CardContent } from "@nextdays/ui/card";
import { NativeSelect } from "@nextdays/ui/native-select";
import { channelLabelLoose, channelLogoLoose } from "@/lib/channel-logos";
import { type Season, listSeasons } from "@/lib/calendar";
import { formatCurrency } from "@/lib/currency";
import {
  type PortalCalendarDay,
  type PortalProperty,
  getOwnerCalendar,
} from "@/lib/portal";

// --- Datums-Hilfen (alles UTC, damit kein Zeitzonen-Versatz entsteht) -------

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(isoDate: string, n: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
}
/** Wochentag Mo=0 … So=6. */
function mondayIndex(d: Date): number {
  return (d.getUTCDay() + 6) % 7;
}

type Monat = { jahr: number; monat: number }; // monat: 0-basiert

function monatVerschieben(m: Monat, delta: number): Monat {
  const d = new Date(Date.UTC(m.jahr, m.monat + delta, 1));
  return { jahr: d.getUTCFullYear(), monat: d.getUTCMonth() };
}

/** Stabiler Schlüssel eines Monats („2026-08") — React-Key und Map-Schlüssel. */
function monatsSchluessel(m: Monat): string {
  return `${m.jahr}-${String(m.monat + 1).padStart(2, "0")}`;
}

/** Abstand zweier Monate in Monaten (b − a). */
function monatsAbstand(a: Monat, b: Monat): number {
  return (b.jahr - a.jahr) * 12 + (b.monat - a.monat);
}

// --- Grenzen des Scroll-Bands ----------------------------------------------
//
// Wurzel 8: kein unbegrenzter Bereich. Das Band lädt NICHT beliebig weit in
// Vergangenheit/Zukunft nach, sonst wäre „ewig scrollen" ein Dauerfeuer von
// Monatsabrufen. Gewählt: 24 Monate zurück, 24 Monate voraus, jeweils vom
// heutigen Monat aus. Begründung: Eigentümer prüfen rückwirkend ihre
// Abrechnung (2 Saisons reichen dafür) und vorausschauend die Belegung des
// nächsten Jahres; darüber hinaus gibt es im Portal nichts zu sehen, weil so
// weit weder Buchungen noch Saisons gepflegt sind.
const MONATE_ZURUECK = 24;
const MONATE_VORAUS = 24;

/**
 * Für jeden Tag: welche Saison gilt. Letzte Zuweisung gewinnt — identisch zur
 * Agentur-Ansicht (components/objekte/season-calendar.tsx), damit Eigentümer
 * und Verwaltung dieselben Farben sehen.
 */
function saisonProTag(seasons: Season[]): Map<string, Season> {
  const map = new Map<string, Season>();
  for (const s of seasons) {
    for (const a of s.assignments) {
      let cur = a.start_date;
      // end_date ist inklusiv.
      while (cur <= a.end_date) {
        map.set(cur, s);
        cur = addDays(cur, 1);
      }
    }
  }
  return map;
}

// --- Kanal → Farbe ----------------------------------------------------------
//
// `booking_source` ist entweder der Klarname des Portals (`ota_name`, z. B.
// „Booking.com") ODER der Kanal-Code der Reservierung (`channel`, z. B.
// „booking"). Beides landet hier, deshalb wird normalisiert verglichen — wie
// in lib/channel-logos.ts. Was sich keinem bekannten Kanal zuordnen lässt,
// bekommt den Sammelton `ota_other`: das ist eine ehrliche Aussage
// („irgendein Portal"), keine geratene Marke.
const KANAL_FARBE: Record<string, string> = {
  bookingcom: "bg-channel-booking",
  booking: "bg-channel-booking",
  airbnb: "bg-channel-airbnb",
  vrbo: "bg-channel-vrbo",
  fewodirekt: "bg-channel-vrbo",
  portal: "bg-channel-portal",
  mybestdays: "bg-channel-portal",
  direct: "bg-channel-direct",
  direkt: "bg-channel-direct",
};

function kanalFarbe(quelle: string | null | undefined): string {
  if (!quelle) return "bg-channel-ota-other";
  const key = quelle.toLowerCase().replace(/[^a-z0-9]/g, "");
  return KANAL_FARBE[key] ?? "bg-channel-ota-other";
}

// --- Aufenthalte statt Nächte ----------------------------------------------

/**
 * Ein Chip im Gitter: EIN Aufenthalt EINER Einheit, über seine Nächte gespannt.
 *
 * Vorher rendete jede Nacht ihren eigenen Kasten mit dem NACHTBETRAG. Ein
 * Betrag, der über fünf gleiche Kästen wiederholt wird, liest sich wie fünfmal
 * dieselbe Buchung; steht er nur einmal groß da, liest er sich als Gesamtpreis.
 * Ein Chip über den Aufenthalt mit der SUMME beantwortet beides eindeutig.
 */
type Aufenthalt = {
  reservationId: string;
  /** Zusammen mit `reservationId` der React-Key; unterscheidet die Einheiten
   *  eines Typs, wenn mehrere davon dieselbe Reservierungs-ID trügen. */
  unitId: string | null;
  /** Erste belegte Nacht IM GELADENEN FENSTER (nicht zwingend der Anreisetag). */
  von: string;
  /** Letzte belegte Nacht im Fenster. */
  bis: string;
  naechte: number;
  /** Netto-Auszahlung der ERSTEN Nacht des Aufenthalts im Fenster. Die
   *  Spezifikation gibt den Wert PRO NACHT vor, nicht die Aufenthaltssumme. */
  proNacht: number | null;
  /** Kleinster/größter Nachtwert des Aufenthalts. Weichen sie voneinander ab
   *  (Saisonwechsel), nennt der Tooltip die Spanne — es wird KEIN Durchschnitt
   *  gebildet, der in keiner einzigen Nacht wirklich gilt (Wurzel 4). */
  minProNacht: number | null;
  maxProNacht: number | null;
  /** Mindestens eine Nacht ohne bestimmbaren Wert → die Spanne ist unvollständig. */
  luecke: boolean;
  currency: string | null;
  gast: string | null;
  quelle: string | null;
};

/**
 * Gruppiert die Nächte des Fensters zu Aufenthalten.
 *
 * Der Schlüssel ist `reservation_id` + `unit_id`: dieselbe Reservierung auf
 * zwei Einheiten (Typ mit mehreren identischen Studios) sind zwei Chips, denn
 * es sind zwei belegte Einheiten und zwei Beträge.
 */
function aufenthalteBilden(tage: PortalCalendarDay[]): Aufenthalt[] {
  const map = new Map<string, Aufenthalt>();
  // Nach Datum sortieren, damit `von`/`bis` unabhängig von der Reihenfolge der
  // Server-Antwort stimmen.
  const sortiert = [...tage].sort((a, b) => a.date.localeCompare(b.date));
  for (const tag of sortiert) {
    for (const b of tag.bookings ?? []) {
      const key = `${b.reservation_id}|${b.unit_id ?? ""}`;
      const vorhanden = map.get(key);
      const wert = b.owner_payout_per_night;
      if (!vorhanden) {
        map.set(key, {
          reservationId: b.reservation_id,
          unitId: b.unit_id,
          von: tag.date,
          bis: tag.date,
          naechte: 1,
          // Die Tage sind nach Datum sortiert, also ist das hier wirklich die
          // erste Nacht des Aufenthalts im Fenster.
          proNacht: wert,
          minProNacht: wert,
          maxProNacht: wert,
          luecke: wert == null,
          currency: b.currency,
          gast: b.guest_first_name?.trim() || null,
          quelle: b.booking_source?.trim() || null,
        });
        continue;
      }
      vorhanden.bis = tag.date;
      vorhanden.naechte += 1;
      // `proNacht` bleibt der Wert der ERSTEN Nacht und wird nicht fortgeschrieben.
      // Nur die Spanne wächst mit — sie speist den Tooltip bei Saisonwechsel.
      if (wert == null) {
        vorhanden.luecke = true;
      } else {
        vorhanden.minProNacht =
          vorhanden.minProNacht == null ? wert : Math.min(vorhanden.minProNacht, wert);
        vorhanden.maxProNacht =
          vorhanden.maxProNacht == null ? wert : Math.max(vorhanden.maxProNacht, wert);
      }
      // Verschiedene Währungen innerhalb eines Aufenthalts sind ein Datenfehler
      // — dann gibt es keinen ausweisbaren Betrag.
      if (vorhanden.currency !== b.currency) {
        vorhanden.currency = null;
        vorhanden.proNacht = null;
        vorhanden.minProNacht = null;
        vorhanden.maxProNacht = null;
      }
    }
  }
  return [...map.values()].sort(
    (a, b) => a.von.localeCompare(b.von) || a.reservationId.localeCompare(b.reservationId),
  );
}

/** Ein sichtbares Chip-Stück innerhalb EINER Wochenzeile. */
type Segment = {
  key: string;
  aufenthalt: Aufenthalt;
  /** Spalte 0–6 innerhalb der Woche, an der das Stück beginnt. */
  spalte: number;
  /** Wie viele Spalten das Stück überdeckt. */
  breite: number;
  /** Beginnt hier die echte erste Nacht des Aufenthalts (im Fenster)? */
  echterAnfang: boolean;
  /** Endet hier die echte letzte Nacht? */
  echtesEnde: boolean;
};

// Anreise-/Abreisemitte (Hotel-Standard, wie der PMS-Kalender): der Chip
// beginnt am Anreisetag zur Tagesmitte und läuft in den Abreisetag bis zu
// dessen Mitte. So sieht man am Wechseltag, dass zwei Aufenthalte ihn teilen,
// statt einer scheinbaren Doppelbuchung.
const HALF_DAY = 0.5;

export function PortalKalender({
  properties,
  initialPropertyId,
  error,
}: {
  properties: PortalProperty[];
  initialPropertyId: string | null;
  error: string | null;
}) {
  const t = useTranslations("portal");
  const locale = useLocale();

  const monatsNamen = useMemo(
    () => t("calendar.months").split(","),
    [t],
  );
  const wochentage = useMemo(
    () => t("calendar.weekdays").split(","),
    [t],
  );

  const [propertyId, setPropertyId] = useState<string | null>(initialPropertyId);
  // Der heutige Monat ist der Anker des Bandes: Grenzen und Startposition
  // beziehen sich auf ihn. Einmal beim Mounten festgehalten, damit ein
  // Neu-Rendern das Band nicht verschiebt.
  const [heutigerMonat] = useState<Monat>(() => {
    const j = new Date();
    return { jahr: j.getUTCFullYear(), monat: j.getUTCMonth() };
  });
  // Sichtbarer Ausschnitt des Bandes: von `ersterMonat` an `anzahlMonate`
  // Monate abwärts. Beim Öffnen genau der aktuelle Monat plus je ein Puffer,
  // damit sofort in beide Richtungen gescrollt werden kann.
  const [ersterMonat, setErsterMonat] = useState<Monat>(() =>
    monatVerschieben(heutigerMonat, -1),
  );
  const [anzahlMonate, setAnzahlMonate] = useState(3);
  /** Geladene Tage je Monatsschlüssel. Ein bereits geladener Monat wird NICHT
   *  erneut abgerufen — der Schlüssel im Map ist der Beleg dafür. */
  const [monatsTage, setMonatsTage] = useState<Map<string, PortalCalendarDay[]>>(
    () => new Map(),
  );
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [ladeFehler, setLadeFehler] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);

  // Harte Grenzen des Bandes (Wurzel 8).
  const grenzeFrueh = useMemo(
    () => monatVerschieben(heutigerMonat, -MONATE_ZURUECK),
    [heutigerMonat],
  );
  const grenzeSpaet = useMemo(
    () => monatVerschieben(heutigerMonat, MONATE_VORAUS),
    [heutigerMonat],
  );

  /** Die Monate des Bandes, in Reihenfolge. */
  const monate = useMemo(
    () =>
      Array.from({ length: anzahlMonate }, (_, i) =>
        monatVerschieben(ersterMonat, i),
      ),
    [ersterMonat, anzahlMonate],
  );

  // Ein Objektwechsel verwirft alle geladenen Monate: die Tage des alten
  // Objekts dürfen unter dem neuen Namen nicht stehenbleiben.
  useEffect(() => {
    setMonatsTage(new Map());
    setSeasons([]);
    setLadeFehler(null);
  }, [propertyId]);

  /**
   * Lädt genau die Monate des Bandes, die noch nicht im Cache liegen.
   * `neuLaden` erzwingt den Abruf (Realtime-Ereignis) — dann werden alle
   * aktuell sichtbaren Monate frisch geholt.
   */
  const laden = useCallback(
    async (neuLaden = false) => {
      if (!propertyId) {
        setMonatsTage(new Map());
        setSeasons([]);
        return;
      }
      const offen = neuLaden
        ? monate
        : monate.filter((m) => !monatsTage.has(monatsSchluessel(m)));
      // Saisons hängen am Objekt, nicht am Monat — sie werden nur geholt,
      // wenn sie fehlen oder ein Realtime-Ereignis sie erneuert.
      const saisonsNoetig = neuLaden || seasons.length === 0;
      if (offen.length === 0 && !saisonsNoetig) return;

      setLaedt(true);
      const [ergebnisse, sea] = await Promise.all([
        Promise.all(
          offen.map(async (m) => {
            const von = `${monatsSchluessel(m)}-01`;
            // Letzter Tag des Monats: der 0. des Folgemonats.
            const bis = iso(new Date(Date.UTC(m.jahr, m.monat + 1, 0)));
            return {
              key: monatsSchluessel(m),
              antwort: await getOwnerCalendar(propertyId, von, bis),
            };
          }),
        ),
        saisonsNoetig ? listSeasons(propertyId) : Promise.resolve(null),
      ]);
      setLaedt(false);

      // Ein Ladefehler ist nicht „nichts gebucht": beide Aussagen sind
      // verschieden und müssen es auch in der UI bleiben (Wurzel 4/5).
      const fehler = ergebnisse.find((e) => !e.antwort.ok);
      setLadeFehler(fehler && !fehler.antwort.ok ? fehler.antwort.error : null);
      setMonatsTage((vorher) => {
        const naechster = new Map(vorher);
        for (const e of ergebnisse) {
          // Nur erfolgreiche Monate in den Cache — ein fehlgeschlagener Monat
          // darf nicht als „geladen, leer" gelten, sonst wird er nie erneut
          // versucht und behauptet dauerhaft „nichts gebucht".
          if (e.antwort.ok) naechster.set(e.key, e.antwort.data.days);
        }
        return naechster;
      });
      // Saisons sind Schmuck, kein Kerninhalt: scheitern sie, bleibt der
      // Kalender nutzbar und zeigt nur keine Saison-Farben.
      if (sea) setSeasons(sea.ok ? sea.data.items : []);
    },
    [propertyId, monate, monatsTage, seasons.length],
  );

  useEffect(() => {
    void laden();
  }, [laden]);

  // Alle geladenen Tage über ALLE Monate. Ein Aufenthalt, der über eine
  // Monatsgrenze läuft, muss aus dem GANZEN Band gebildet werden — sonst
  // entstünden am 31./1. zwei Aufenthalte mit je einer „echten" Kante und der
  // Chip bekäme dort eine Rundung, die eine Abreise behauptet, die es nicht gibt.
  const alleTage = useMemo(() => {
    const out: PortalCalendarDay[] = [];
    for (const m of monate) {
      const t = monatsTage.get(monatsSchluessel(m));
      if (t) out.push(...t);
    }
    return out;
  }, [monate, monatsTage]);

  const tagMap = useMemo(() => {
    const m = new Map<string, PortalCalendarDay>();
    for (const d of alleTage) m.set(d.date, d);
    return m;
  }, [alleTage]);

  const saisonMap = useMemo(() => saisonProTag(seasons), [seasons]);

  const heute = iso(new Date());

  // Aufenthalte über das GANZE Band (siehe `alleTage`).
  const aufenthalte = useMemo(() => aufenthalteBilden(alleTage), [alleTage]);

  // Kanäle, die im Band wirklich vorkommen — Grundlage der Legende.
  // Zusammengefasst nach Farbe: „Booking.com" und „booking" sind derselbe
  // Kanal und dürfen nicht zweimal in der Legende stehen.
  const kanaeleImMonat = useMemo(() => {
    const proFarbe = new Map<string, string>();
    for (const a of aufenthalte) {
      if (!a.quelle) continue;
      const farbe = kanalFarbe(a.quelle);
      if (!proFarbe.has(farbe)) proFarbe.set(farbe, a.quelle);
    }
    return [...proFarbe.values()].sort((x, y) => x.localeCompare(y));
  }, [aufenthalte]);

  /**
   * Das Band: je Monat seine Wochenzeilen samt Chip-Segmenten.
   *
   * Ein Aufenthalt wird an JEDER Zeilengrenze geschnitten — Wochen- wie
   * Monatsgrenze. `echterAnfang`/`echtesEnde` bezeichnen ausschließlich die
   * ECHTEN Kanten des Aufenthalts (erste/letzte Nacht im Band); an einer
   * bloßen Schnittkante bleibt das Segment ungerundet, damit ein
   * durchlaufender Aufenthalt nicht wie zwei getrennte Buchungen aussieht.
   * Weil die Aufenthalte aus `alleTage` stammen, gilt das über den
   * Monatswechsel hinweg genauso wie innerhalb eines Monats.
   */
  const band = useMemo(() => {
    return monate.map((m) => {
      const schluessel = monatsSchluessel(m);
      const leerVorne = mondayIndex(new Date(Date.UTC(m.jahr, m.monat, 1)));
      const tageImMonat = new Date(Date.UTC(m.jahr, m.monat + 1, 0)).getUTCDate();

      const felder: (string | null)[] = [];
      for (let i = 0; i < leerVorne; i += 1) felder.push(null);
      for (let tag = 1; tag <= tageImMonat; tag += 1) {
        felder.push(`${schluessel}-${String(tag).padStart(2, "0")}`);
      }
      while (felder.length % 7 !== 0) felder.push(null);
      const wochen: (string | null)[][] = [];
      for (let i = 0; i < felder.length; i += 7) wochen.push(felder.slice(i, i + 7));

      const segmenteJeWoche = wochen.map((woche) => {
        const segmente: Segment[] = [];
        for (const a of aufenthalte) {
          // Spaltenindizes der Nächte dieses Aufenthalts INNERHALB dieser Woche.
          const treffer: number[] = [];
          for (let i = 0; i < woche.length; i += 1) {
            const d = woche[i];
            if (d && d >= a.von && d <= a.bis) treffer.push(i);
          }
          if (treffer.length === 0) continue;
          const start = treffer[0];
          const ende = treffer[treffer.length - 1];
          segmente.push({
            key: `${a.reservationId}|${a.unitId ?? ""}|${woche[start]}`,
            aufenthalt: a,
            spalte: start,
            breite: ende - start + 1,
            echterAnfang: woche[start] === a.von,
            echtesEnde: woche[ende] === a.bis,
          });
        }
        return segmente;
      });

      return { monat: m, schluessel, wochen, segmenteJeWoche };
    });
  }, [monate, aufenthalte]);

  // --- Scrollen: ältere/kommende Monate nachladen ---------------------------
  const bandRef = useRef<HTMLDivElement | null>(null);
  // Vor dem Voranstellen gemerkte Scroll-Metrik: nach dem Einfügen wird die
  // Position korrigiert, sonst springt der Inhalt unter dem Cursor weg.
  const vorHoeheRef = useRef<number | null>(null);

  const kannFrueher = monatsAbstand(grenzeFrueh, ersterMonat) > 0;
  const kannSpaeter =
    monatsAbstand(monate[monate.length - 1] ?? ersterMonat, grenzeSpaet) > 0;

  const frueherLaden = useCallback(() => {
    if (!kannFrueher) return;
    const el = bandRef.current;
    vorHoeheRef.current = el ? el.scrollHeight - el.scrollTop : null;
    setErsterMonat((m) => monatVerschieben(m, -1));
    setAnzahlMonate((n) => n + 1);
  }, [kannFrueher]);

  const spaeterLaden = useCallback(() => {
    if (!kannSpaeter) return;
    setAnzahlMonate((n) => n + 1);
  }, [kannSpaeter]);

  // Nach dem Voranstellen die Scroll-Position so korrigieren, dass der zuvor
  // sichtbare Monat unter dem Cursor stehen bleibt (sonst „springt" das Band).
  useLayoutEffect(() => {
    const el = bandRef.current;
    if (!el || vorHoeheRef.current == null) return;
    el.scrollTop = el.scrollHeight - vorHoeheRef.current;
    vorHoeheRef.current = null;
  }, [ersterMonat]);

  /** Scrollt einen Monat an den oberen Rand des Bandes. */
  const zuMonat = useCallback(
    (ziel: Monat) => {
      // Außerhalb der Grenzen gibt es nichts anzuspringen.
      if (monatsAbstand(grenzeFrueh, ziel) < 0 || monatsAbstand(ziel, grenzeSpaet) < 0) {
        return;
      }
      // Liegt der Monat noch nicht im Band, wird das Band bis dorthin erweitert.
      if (monatsAbstand(ersterMonat, ziel) < 0) {
        setErsterMonat(ziel);
        setAnzahlMonate((n) => n + monatsAbstand(ziel, ersterMonat) + 1);
      } else {
        const noetig = monatsAbstand(ersterMonat, ziel) + 1;
        setAnzahlMonate((n) => Math.max(n, noetig));
      }
      setZielMonat(monatsSchluessel(ziel));
    },
    [ersterMonat, grenzeFrueh, grenzeSpaet],
  );

  // Anzuspringender Monat; wird ausgeführt, sobald er wirklich im DOM steht.
  const [zielMonat, setZielMonat] = useState<string | null>(
    monatsSchluessel(heutigerMonat),
  );

  useLayoutEffect(() => {
    if (!zielMonat) return;
    const el = bandRef.current?.querySelector<HTMLElement>(
      `[data-monat="${zielMonat}"]`,
    );
    if (!el) return;
    // `scrollTop` statt `scrollIntoView`: letzteres scrollt auch die SEITE,
    // nicht nur das Band, und riss die Kopfzeile aus dem Bild.
    const el2 = bandRef.current;
    if (el2) el2.scrollTop = el.offsetTop - el2.offsetTop;
    setZielMonat(null);
  }, [zielMonat, band]);

  /** Monat, der gerade oben im Band steht — speist Titel und Pfeil-Navigation. */
  const [sichtbarerMonat, setSichtbarerMonat] = useState<Monat>(heutigerMonat);

  /**
   * Scroll-Beobachter: hält `sichtbarerMonat` nach und stößt das Nachladen an,
   * wenn ein Rand des Bandes erreicht wird. Ein Beobachter für das ganze Band,
   * nicht einer je Monat.
   */
  const beiScroll = useCallback(() => {
    const el = bandRef.current;
    if (!el) return;
    // Oberster Monat, dessen Kopf noch über der Bandmitte liegt.
    const kopf = el.getBoundingClientRect().top;
    let aktuell: Monat | null = null;
    for (const b of band) {
      const kind = el.querySelector<HTMLElement>(`[data-monat="${b.schluessel}"]`);
      if (!kind) continue;
      if (kind.getBoundingClientRect().top - kopf <= 8) aktuell = b.monat;
    }
    if (aktuell && monatsAbstand(sichtbarerMonat, aktuell) !== 0) {
      setSichtbarerMonat(aktuell);
    }
    // Nachladen, sobald der Rand in Sichtweite kommt (eine Bildschirmhöhe).
    const puffer = el.clientHeight;
    if (el.scrollTop < puffer) frueherLaden();
    if (el.scrollHeight - el.scrollTop - el.clientHeight < puffer) spaeterLaden();
  }, [band, sichtbarerMonat, frueherLaden, spaeterLaden]);

  return (
    <div className="flex flex-col gap-6">
      {/* Realtime: Buchungen und Verfügbarkeit speisen dieses Gitter.
          `properties` liefert Objektwechsel (z. B. neu zugeordnet).
          EIN Abo je Tabelle — PortalRealtime wird genau einmal gerendert und
          hat eine feste Quellenliste; das Band vervielfacht die Abos also
          nicht, egal wie viele Monate nachgeladen sind.
          `laden(true)` ist hier Pflicht: ohne das Flag würden nur noch NICHT
          geladene Monate geholt, und ein Ereignis in einem bereits geladenen
          Monat käme nie an — das Gitter sähe live aus und bliebe alt. */}
      <PortalRealtime
        quellen={["reservations", "availability", "stop_sell", "properties"]}
        onChange={() => void laden(true)}
      />

      <header className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-extrabold">
          {t("calendar.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("calendar.subtitle")}
        </p>
      </header>

      {(error || ladeFehler) && (
        <div className="rounded-(--radius) border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error ?? ladeFehler}
        </div>
      )}

      {properties.length === 0 && !error ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
              <Icon icon="ph:house-line" className="size-6" />
            </span>
            <p className="text-sm text-muted-foreground">
              {t("properties.empty")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Steuerleiste: Objekt + Monat */}
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">
                {t("calendar.selectProperty")}
              </span>
              <NativeSelect
                value={propertyId ?? ""}
                onChange={(e) => setPropertyId(e.target.value || null)}
                className="min-w-56"
              >
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </NativeSelect>
            </label>

            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                aria-label={t("calendar.prevMonth")}
                // Pfeile springen im Band, statt den Monat auszutauschen.
                disabled={monatsAbstand(grenzeFrueh, sichtbarerMonat) <= 0}
                onClick={() => zuMonat(monatVerschieben(sichtbarerMonat, -1))}
                className="flex size-9 items-center justify-center rounded-full bg-secondary text-secondary-foreground transition-colors hover:bg-secondary/80 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Icon icon="ph:caret-left" className="size-4" />
              </button>
              <span className="min-w-44 text-center font-display text-sm font-extrabold">
                {monatsNamen[sichtbarerMonat.monat]} {sichtbarerMonat.jahr}
              </span>
              <button
                type="button"
                aria-label={t("calendar.nextMonth")}
                disabled={monatsAbstand(sichtbarerMonat, grenzeSpaet) <= 0}
                onClick={() => zuMonat(monatVerschieben(sichtbarerMonat, 1))}
                className="flex size-9 items-center justify-center rounded-full bg-secondary text-secondary-foreground transition-colors hover:bg-secondary/80 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Icon icon="ph:caret-right" className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => zuMonat(heutigerMonat)}
                className="rounded-full bg-secondary px-4 py-2 text-sm text-secondary-foreground transition-colors hover:bg-secondary/80"
              >
                {t("calendar.today")}
              </button>
            </div>
          </div>

          {/* Das Band: mehrere Monatsgitter untereinander in EINEM Scroll-
              bereich. Die Wochentagsleiste steht außerhalb des Bandes, weil
              sie für alle Monate gilt und beim Scrollen nicht mitwandern soll. */}
          <Card>
            <CardContent className="py-4">
              <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
                {wochentage.map((w) => (
                  <span key={w}>{w}</span>
                ))}
              </div>
              <div
                ref={bandRef}
                onScroll={beiScroll}
                aria-busy={laedt || undefined}
                // Feste Höhe = der Scrollbereich. Ohne sie gäbe es kein „unten",
                // an dem das Nachladen auslösen könnte. `scrollbar-hide`
                // blendet nur die LEISTE aus — gescrollt wird weiterhin per
                // Mausrad, Trackpad und Tastatur (siehe globals.css).
                className="max-h-[60vh] overflow-y-auto scrollbar-hide"
              >
                {/* Obere Grenze des Bandes: sichtbar machen, dass hier bewusst
                    Schluss ist — eine stumm endende Liste sähe aus wie ein
                    Ladefehler. */}
                {!kannFrueher && (
                  <p className="py-2 text-center text-xs text-muted-foreground">
                    {t("calendar.bandStart")}
                  </p>
                )}
                {band.map(({ monat: m, schluessel, wochen, segmenteJeWoche }) => (
                  <section key={schluessel} data-monat={schluessel}>
                    {/* Monatsname bleibt beim Scrollen stehen, damit immer klar
                        ist, welcher Monat unter dem Cursor liegt. */}
                    <h2 className="sticky top-0 z-10 bg-card py-1.5 font-display text-sm font-extrabold">
                      {monatsNamen[m.monat]} {m.jahr}
                    </h2>
                    <div className="flex flex-col gap-1 pb-3">
                      {wochen.map((woche, wi) => (
                        <Wochenzeile
                          key={woche.find(Boolean) ?? `${schluessel}-w${wi}`}
                          woche={woche}
                          segmente={segmenteJeWoche[wi]}
                          heute={heute}
                          tagMap={tagMap}
                          saisonMap={saisonMap}
                          locale={locale}
                        />
                      ))}
                    </div>
                  </section>
                ))}
                {!kannSpaeter && (
                  <p className="py-2 text-center text-xs text-muted-foreground">
                    {t("calendar.bandEnd")}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Legende */}
          <div className="flex flex-col gap-4 sm:flex-row sm:gap-10">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                {t("calendar.legendStatus")}
              </span>
              {/* Die Chips tragen die KANALFARBE, also nennt die Legende die
                  Kanäle — und zwar nur die, die in diesem Monat wirklich
                  vorkommen. Ein Punkt in `bg-primary` für „belegt" wäre eine
                  Farbe, die im Gitter gar nicht mehr auftaucht. */}
              <div className="flex flex-wrap items-center gap-3 text-xs">
                {kanaeleImMonat.map((k) => (
                  <LegendenPunkt key={k} klasse={kanalFarbe(k)} label={channelLabelLoose(k)} />
                ))}
                <LegendenPunkt
                  klasse="bg-muted-foreground"
                  label={t("calendar.status.blocked")}
                />
                <LegendenPunkt
                  klasse="bg-secondary"
                  label={t("calendar.status.open")}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                {t("calendar.legendSeasons")}
              </span>
              {seasons.length === 0 ? (
                <span className="text-xs text-muted-foreground">
                  {t("calendar.noSeasons")}
                </span>
              ) : (
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  {seasons.map((s) => (
                    <span key={s.id} className="flex items-center gap-1.5">
                      {/* Saison-Farbe kommt als Hex AUS DER DB (property_seasons)
                          — das ist ein Datenwert, keine im Code hartkodierte
                          Arbitrary-Farbe. */}
                      <span
                        className="size-3 shrink-0 rounded-full"
                        style={{ backgroundColor: s.color }}
                      />
                      <span>{s.name}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Der Eigentümer darf nicht sperren, nur beantragen (§4.2).
              Deshalb führt der einzige Weg von hier auf den Antrag — es gibt
              keinen Knopf, der auf /calendar/block zeigt. */}
          <Card className="border-dashed">
            <CardContent className="flex flex-wrap items-center gap-3 py-4">
              <Icon
                icon="ph:info"
                className="size-5 shrink-0 text-muted-foreground"
              />
              <p className="min-w-0 flex-1 text-sm text-muted-foreground">
                {t("calendar.blockHint")}
              </p>
              <Link
                href="/portal/sperrungen"
                className="shrink-0 rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground transition-colors hover:bg-primary/90"
              >
                {t("calendar.blockCta")}
              </Link>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function LegendenPunkt({ klasse, label }: { klasse: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`size-3 shrink-0 rounded-full ${klasse}`} />
      <span>{label}</span>
    </span>
  );
}

// Geometrie des Overlays. Eine Spalte ist 1/7 der Zeilenbreite; alles andere
// in rem, damit es mit der Schriftgröße mitwächst (Projektregel „rem statt px").
const SPALTE = 100 / 7; // Prozent je Wochentag
/** Chip-Höhe — exakt die des PMS-Balkens (calendar-board.tsx: `height: 1.75rem`). */
const CHIP_HOEHE = 1.75; // rem
const CHIP_ABSTAND = 0.25; // rem zwischen zwei Chip-Bahnen
/** Kopfzone der Zelle: Tageszahl + Einheiten-Zähler. Darunter liegt die
 *  Chip-Zone — beides gehört IN dieselbe Zelle, nicht darunter. */
const KOPF_HOEHE = 1.5; // rem
/** Innenabstand der Zelle unten, damit der letzte Chip nicht auf der Kante klebt. */
const FUSS_HOEHE = 0.375; // rem
/** Ab so vielen gleichzeitigen Chips wird zusammengefasst („+n"). */
const MAX_BAHNEN = 2;
/**
 * Zeilenhöhe. Feste Höhe statt `minHeight`: `h-full` einer Zelle kann sich nur
 * gegen eine BESTIMMTE Höhe auflösen. Gegen `min-height` löst es zu `auto` auf —
 * genau daran sind die Zellen auf Inhaltshöhe (24 px) zusammengefallen, während
 * die Zeile 55 px hoch blieb. Die Chips lagen dann sichtbar UNTER der Zelle, in
 * der Lücke zwischen zwei Wochen. Alle Wochenzeilen sind gleich hoch, damit das
 * Gitter ruhig bleibt (auch wenn eine Woche nur eine Bahn braucht).
 */
const ZEILEN_HOEHE = KOPF_HOEHE + MAX_BAHNEN * (CHIP_HOEHE + CHIP_ABSTAND) + FUSS_HOEHE;

/** Ein Aufenthalt oder eine Zusammenfassung, auf einer Bahn der Wochenzeile. */
type Bahn = { segment: Segment; bahn: number };

/**
 * Verteilt die Segmente einer Woche auf Bahnen (erste freie Bahn gewinnt) und
 * fasst alles ab der dritten gleichzeitigen Buchung zu einem „+n"-Chip je
 * Spalte zusammen. Ein Objekt kann seit 0265 n Einheiten führen — fünf belegte
 * Studios ergäben sonst fünf Bahnen und eine unlesbare Zeile.
 */
function bahnenVerteilen(segmente: Segment[]): {
  sichtbar: Bahn[];
  ueberlauf: Map<number, { anzahl: number; summe: number | null; currency: string | null }>;
} {
  // Genau MAX_BAHNEN Bahnen, fest angelegt: es wird bewusst KEINE weitere
  // erzeugt. Was in keine davon passt, geht in den „+n"-Chip.
  const belegt: number[][] = Array.from({ length: MAX_BAHNEN }, () => []);
  const sichtbar: Bahn[] = [];
  const ueberlauf = new Map<
    number,
    { anzahl: number; summe: number | null; currency: string | null }
  >();
  // Stabil: früherer Beginn zuerst, dann längerer Aufenthalt.
  const sortiert = [...segmente].sort(
    (a, b) => a.spalte - b.spalte || b.breite - a.breite || a.key.localeCompare(b.key),
  );
  for (const seg of sortiert) {
    const spalten = Array.from({ length: seg.breite }, (_, i) => seg.spalte + i);
    const bahn = belegt.findIndex((b) => spalten.every((s) => !b.includes(s)));
    if (bahn === -1) {
      // Nicht mehr eigenständig darstellbar → in die „+n"-Zusammenfassung.
      // Sie zählt je SPALTE, damit „+2" wirklich an den Tagen steht, an denen
      // zwei weitere Einheiten belegt sind — und nicht über den ganzen
      // Aufenthalt hinweg eine Zahl behauptet, die nur am ersten Tag stimmt.
      for (const s of spalten) {
        const vorhanden = ueberlauf.get(s);
        if (!vorhanden) {
          ueberlauf.set(s, {
            anzahl: 1,
            summe: seg.aufenthalt.proNacht,
            currency: seg.aufenthalt.currency,
          });
          continue;
        }
        vorhanden.anzahl += 1;
        // Wie bei einem einzelnen Aufenthalt: eine unbestimmte Position macht
        // den Wert unbestimmt, es wird keine Teilsumme gezeigt (Wurzel 4).
        vorhanden.summe =
          vorhanden.summe == null || seg.aufenthalt.proNacht == null
            ? null
            : vorhanden.summe + seg.aufenthalt.proNacht;
        if (vorhanden.currency !== seg.aufenthalt.currency) {
          vorhanden.currency = null;
          vorhanden.summe = null;
        }
      }
      continue;
    }
    belegt[bahn].push(...spalten);
    sichtbar.push({ segment: seg, bahn });
  }
  return { sichtbar, ueberlauf };
}

function Wochenzeile({
  woche,
  segmente,
  heute,
  tagMap,
  saisonMap,
  locale,
}: {
  woche: (string | null)[];
  segmente: Segment[];
  heute: string;
  tagMap: Map<string, PortalCalendarDay>;
  saisonMap: Map<string, Season>;
  locale: string;
}) {
  const t = useTranslations("portal");
  const { sichtbar, ueberlauf } = useMemo(
    () => bahnenVerteilen(segmente),
    [segmente],
  );

  // Feste, für alle Wochen gleiche Höhe (siehe ZEILEN_HOEHE). Nur wenn eine
  // Woche wirklich einen „+n"-Chip trägt, kommt dessen Bahn oben drauf —
  // sonst hätte JEDE Woche dauerhaft Platz für einen Fall, der selten eintritt.
  const hoehe = ueberlauf.size > 0
    ? ZEILEN_HOEHE + (CHIP_HOEHE + CHIP_ABSTAND)
    : ZEILEN_HOEHE;

  return (
    <div className="relative" style={{ height: `${hoehe}rem` }}>
      <div className="grid h-full grid-cols-7 gap-1">
        {woche.map((datum, i) =>
          datum ? (
            <Tageszelle
              key={datum}
              datum={datum}
              istHeute={datum === heute}
              info={tagMap.get(datum) ?? null}
              saison={saisonMap.get(datum) ?? null}
            />
          ) : (
            <span key={`leer-${woche[0] ?? "x"}-${i}`} />
          ),
        )}
      </div>

      {/* Chip-Ebene: liegt über den Zellen, fängt aber keine Klicks ab —
          die Zelle bleibt für Tooltip und Fokus zuständig. */}
      <div className="pointer-events-none absolute inset-0">
        {sichtbar.map(({ segment, bahn }) => (
          <AufenthaltChip
            key={segment.key}
            segment={segment}
            bahn={bahn}
            locale={locale}
          />
        ))}
        {[...ueberlauf.entries()].map(([spalte, rest]) => (
          <SammelChip
            key={`plus-${woche[spalte] ?? spalte}`}
            spalte={spalte}
            anzahl={rest.anzahl}
            summe={rest.summe}
            currency={rest.currency}
            bahn={MAX_BAHNEN}
            locale={locale}
            label={t("calendar.moreUnits", { count: rest.anzahl })}
          />
        ))}
      </div>
    </div>
  );
}

/** Oberkante einer Chip-Bahn in rem. */
function bahnOben(bahn: number): string {
  return `${KOPF_HOEHE + bahn * (CHIP_HOEHE + CHIP_ABSTAND)}rem`;
}

/**
 * Waagerechte Lage eines Chips innerhalb der Wochenzeile, in Prozent.
 *
 * Die halben Tage an Anreise/Abreise dürfen die Zeile nicht sprengen: ein
 * 7-Nächte-Aufenthalt ab Montag ergab `links 7,14 %` + `breite 100 %` = 107 %
 * — der Chip lief rechts aus dem Kalender heraus und schnitt den Betrag ab
 * („9.389 D…"). Deshalb wird die Breite auf den verbleibenden Platz begrenzt,
 * statt sie am Container per `overflow` abzuschneiden: der Betrag muss
 * vollständig lesbar bleiben, also muss die GEOMETRIE stimmen.
 */
function chipLage(segment: Segment): { links: number; breite: number } {
  const linksVersatz = segment.echterAnfang ? HALF_DAY : 0;
  const rechtsZugabe = segment.echtesEnde ? HALF_DAY : 0;
  const links = (segment.spalte + linksVersatz) * SPALTE;
  const roh = (segment.breite - linksVersatz + rechtsZugabe) * SPALTE;
  return { links, breite: Math.min(roh, 100 - links) };
}

function AufenthaltChip({
  segment,
  bahn,
  locale,
}: {
  segment: Segment;
  bahn: number;
  locale: string;
}) {
  const t = useTranslations("portal");
  const a = segment.aufenthalt;

  const logo = channelLogoLoose(a.quelle);
  const kanalLabel = channelLabelLoose(a.quelle);

  // Der NACHTWERT, nicht die Aufenthaltssumme: der Eigentümer sieht laut
  // Spezifikation ausschließlich seine persönliche Netto-Auszahlung PRO NACHT.
  // Vorher stand hier die Summe über alle Nächte (9.389 DKK für 7 Nächte) —
  // dieselbe Zahl, aber die falsche Aussage.
  const betrag =
    a.proNacht == null ? null : formatCurrency(a.proNacht, a.currency, locale, 0);

  // Schwanken die Nachtwerte im Segment (Saisonwechsel), nennt der Tooltip die
  // Spanne. Der Chip selbst bleibt bei der ersten Nacht — ein Durchschnitt wäre
  // ein Wert, den der Eigentümer in keiner einzigen Nacht bekommt (Wurzel 4).
  const spanne =
    a.minProNacht != null &&
    a.maxProNacht != null &&
    a.minProNacht !== a.maxProNacht
      ? `${formatCurrency(a.minProNacht, a.currency, locale, 0)} – ${formatCurrency(
          a.maxProNacht,
          a.currency,
          locale,
          0,
        )}`
      : null;

  const titel = [
    `${a.von} – ${a.bis}`,
    t("calendar.nights", { count: a.naechte }),
    a.gast ? `${t("calendar.guest")}: ${a.gast}` : null,
    kanalLabel ? `${t("calendar.channel")}: ${kanalLabel}` : null,
    `${t("calendar.payoutPerNight")}: ${spanne ?? betrag ?? "—"}`,
  ]
    .filter(Boolean)
    .join(" · ");

  // Halbtags-Versatz nur an ECHTEN Kanten: an einer bloßen Wochengrenze läuft
  // der Chip bündig weiter, sonst entstünde dort eine Lücke, die wie ein
  // freier Tag aussieht.
  const { links, breite } = chipLage(segment);

  return (
    <div
      title={titel}
      // `ring-1 ring-background` trennt den Chip sichtbar von der getönten
      // Zelle darunter — ohne diese Kante verschwimmen Kanalfarbe und
      // Saisonfarbe ineinander.
      // Wie der PMS-Balken: die Bahn gibt die Mitte vor, der Chip sitzt mit
      // `-translate-y-1/2` mittig darin — nicht auf ihrer Oberkante.
      className={`pointer-events-auto absolute flex -translate-y-1/2 items-center gap-1 px-2 text-[0.6875rem] font-medium text-white ring-1 ring-background ${kanalFarbe(a.quelle)} ${
        segment.echterAnfang ? "rounded-l-full" : ""
      } ${segment.echtesEnde ? "rounded-r-full" : ""}`}
      style={{
        left: `calc(${links}% + 0.125rem)`,
        width: `calc(${breite}% - 0.25rem)`,
        top: `calc(${bahnOben(bahn)} + ${CHIP_HOEHE / 2}rem)`,
        height: `${CHIP_HOEHE}rem`,
      }}
    >
      {logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo}
          alt={kanalLabel}
          // HÖHE vorgeben, Breite läuft mit (`w-auto`) — die Marken-SVGs sind
          // WORTMARKEN, keine quadratischen Icons (Airbnb: 300×94, also 3,2:1).
          // In ein 12×12-Quadrat mit `object-contain` gezwungen, schrumpfte das
          // Logo auf 12×3,75 px und war nicht mehr lesbar; sichtbar blieb vor
          // allem der weiße 12×12-Grund — genau der „graue Kasten". Ohne feste
          // Breite behält die Wortmarke ihr Seitenverhältnis und bleibt
          // erkennbar. Der weiße Grund bleibt (mit etwas Luft), weil dunkle
          // Marken-SVGs auf der Kanalfarbe sonst untergehen.
          className="h-3 w-auto max-w-16 shrink-0 rounded-xs bg-white px-0.5"
        />
      ) : kanalLabel ? (
        // Kein offizielles Logo hinterlegt → Klartext, nie ein generisches
        // Ersatz-Icon für eine fremde Marke.
        <span className="shrink-0 truncate opacity-90">{kanalLabel}</span>
      ) : null}
      {/* Nur der VORNAME (§4.2) — der volle Name existiert in dieser Antwort
          gar nicht. Er ist das EINZIGE Element, das nachgeben darf: der Betrag
          bleibt vollständig (`shrink-0`), damit nie wieder „9.389 D…" dasteht. */}
      {a.gast && <span className="min-w-0 truncate">{a.gast}</span>}
      {/* Der Betrag steht NUR auf dem Stück mit dem echten Ende. Ein Aufenthalt
          über mehrere Wochen-/Monatszeilen wiederholte ihn sonst auf jedem
          Stück — vier Segmente lasen sich dann wie vier getrennte Zahlungen
          statt wie ein Nachtwert. Das echte Ende trägt ihn, weil dort auch die
          runde Abschlusskante sitzt. */}
      {segment.echtesEnde && (
        <span className="ml-auto shrink-0 font-semibold">{betrag ?? "—"}</span>
      )}
    </div>
  );
}

/** „+n" für die Einheiten, die nicht mehr als eigener Chip passen. */
function SammelChip({
  spalte,
  anzahl,
  summe,
  currency,
  bahn,
  locale,
  label,
}: {
  spalte: number;
  anzahl: number;
  summe: number | null;
  currency: string | null;
  bahn: number;
  locale: string;
  label: string;
}) {
  const t = useTranslations("portal");
  // Ebenfalls der Nachtwert (Summe der Nachtwerte der zusammengefassten
  // Einheiten für DIESEN Tag) — nicht deren Aufenthaltssummen.
  const betrag = summe == null ? null : formatCurrency(summe, currency, locale, 0);
  return (
    <div
      title={`${label} · ${t("calendar.payoutPerNight")}: ${betrag ?? "—"}`}
      className="pointer-events-auto absolute flex -translate-y-1/2 items-center justify-between gap-1 rounded-full bg-secondary px-2 text-[0.6875rem] font-medium text-secondary-foreground ring-1 ring-background"
      style={{
        left: `calc(${spalte * SPALTE}% + 0.125rem)`,
        width: `calc(${SPALTE}% - 0.25rem)`,
        top: `calc(${bahnOben(bahn)} + ${CHIP_HOEHE / 2}rem)`,
        height: `${CHIP_HOEHE}rem`,
      }}
    >
      <span className="shrink-0">+{anzahl}</span>
      <span className="shrink-0 font-semibold">{betrag ?? "—"}</span>
    </div>
  );
}

function Tageszelle({
  datum,
  istHeute,
  info,
  saison,
}: {
  datum: string;
  istHeute: boolean;
  info: PortalCalendarDay | null;
  saison: Season | null;
}) {
  const t = useTranslations("portal");

  const status = info?.status ?? "open";
  const statusLabel = t(
    status === "booked"
      ? "calendar.status.booked"
      : status === "blocked"
        ? "calendar.status.blocked"
        : "calendar.status.open",
  );

  const tag = Number(datum.slice(8, 10));
  const einheiten =
    info && info.units_total > 1
      ? t("calendar.unitsBooked", {
          booked: info.units_booked,
          total: info.units_total,
        })
      : null;

  const titel = [datum, statusLabel, saison ? saison.name : null, einheiten]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      title={titel}
      className={`relative flex h-full flex-col rounded-(--radius) border ${
        istHeute ? "border-accent" : "border-border"
      } ${status === "blocked" ? "bg-muted-foreground/15" : "bg-card"}`}
    >
      {/* Saison als kurze Marke an der INNEREN linken Kante, in voller
          Deckkraft. Zwei Anforderungen stoßen hier aufeinander: die Farbe muss
          mit dem Legendenpunkt (100 %) abgleichbar bleiben — eine 13-%-Tönung
          war nachweislich eine ANDERE Farbe und ließ sich nicht zuordnen —,
          darf die Zelle aber nicht dominieren. Ein voll deckender Streifen ÜBER
          der Zellkante löste nur die erste Hälfte: er sah aus wie ein Deckel
          auf der Zelle. Als schmale Marke INNERHALB der Zelle, neben der
          Tageszahl, bleibt die Farbe unverfälscht vergleichbar und liest sich
          als Eigenschaft dieses Tages statt als Bauteil des Rahmens. Der Hex
          kommt aus der DB (property_seasons) — ein Datenwert, deshalb `style`. */}
      <div className="flex items-center gap-1.5 px-1.5 pt-1 text-xs">
        {saison && (
          <span
            className="h-3.5 w-1 shrink-0 rounded-full"
            style={{ backgroundColor: saison.color }}
          />
        )}
        {istHeute ? (
          // „Heute" als gefüllter Punkt: eine Akzent-Rahmenlinie ging auf
          // getönten Zellen unter.
          <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-accent text-[0.625rem] font-bold text-accent-foreground">
            {tag}
          </span>
        ) : (
          <span className="font-medium">{tag}</span>
        )}
        {einheiten && (
          <span className="ml-auto shrink-0 text-[0.625rem] text-muted-foreground">
            {info?.units_booked}/{info?.units_total}
          </span>
        )}
      </div>
    </div>
  );
}

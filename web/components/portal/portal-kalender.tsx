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
// Was hier sichtbar ist: Belegungsstatus, der VORNAME des
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
import { Dialog, DialogContent, DialogTitle } from "@nextdays/ui/dialog";
import { NativeSelect } from "@nextdays/ui/native-select";
import { channelLabelLoose, channelLogoLoose } from "@/lib/channel-logos";
import { formatCurrency } from "@/lib/currency";
import { isoKalenderwoche } from "@/lib/dates";
import {
  type PortalCalendarDay,
  type PortalProperty,
  getOwnerCalendar,
} from "@/lib/portal";

// --- Datums-Hilfen (alles UTC, damit kein Zeitzonen-Versatz entsteht) -------

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
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

/**
 * Farbe der EIGENNUTZUNG (0241) — bewusst kein Kanalton.
 *
 * Die eigene Sperre ist keine Buchung über einen Vertriebsweg; sie in einer
 * Kanalfarbe zu zeichnen (und sei es der Sammelton `ota_other`) behauptete
 * genau das. `bg-muted-foreground` ist derselbe Ton, den die Zelle für
 * `status='blocked'` trägt — gesperrt sieht damit überall gleich aus.
 */
const EIGENNUTZUNG_FARBE = "bg-muted-foreground";

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
  /** WARUM kein Betrag ausweisbar ist (`provision` | `betrag` | `naechte`), aus
   *  `payout_unknown_reason` der Buchung. Ohne diesen Grund stand im Chip nur
   *  ein „—", und der Eigentümer konnte nicht unterscheiden zwischen „diese
   *  Nacht bringt nichts" und „bei uns fehlt eine Stammdatenangabe" — der
   *  Betrag wurde berechnet, verworfen und nie erklärt. */
  grund: string | null;
  currency: string | null;
  /** Vorname des Gastes (immer nur das erste Namenstoken). */
  gast: string | null;
  /** Nachname — nur mit VIEW_GUEST_NAME, sonst null. Steht getrennt, damit der
   *  Chip bei knappem Platz den Vornamen behalten und den Nachnamen abschneiden
   *  kann, statt beides zu verlieren. */
  nachname: string | null;
  nationalitaet: string | null;
  /** Wohnsitzland der Buchung — getrennt von der Staatsangehörigkeit. */
  land: string | null;
  /** Besetzung und Haustiere der Buchung. `null` = nicht erfasst; bei Haustieren
   *  ist `0` ausdrücklich etwas anderes („keins dabei"). */
  gaeste: number | null;
  erwachsene: number | null;
  kinder: number | null;
  haustiere: number | null;
  quelle: string | null;
  /** Eigennutzung des Eigentümers (0241) statt einer Gastbuchung. Sie trägt
   *  weder Gast noch Portal und bringt keinen Umsatz — der Chip zeigt darum
   *  „Eigennutzung" statt Logo/Vorname und gar keinen Betrag. */
  eigennutzung: boolean;
};

/**
 * Übersetzt den maschinenlesbaren Grund in Klartext.
 *
 * Ein unbekannter Grund fällt bewusst auf das allgemeine Label zurück statt auf
 * den rohen Slug: ein neuer Backend-Grund darf in der Oberfläche nie als
 * `provision_ungueltig` erscheinen. Er bekommt dann kein `MISSING_MESSAGE`,
 * sondern die ehrliche Kurzaussage „nicht ausweisbar".
 */
const GRUND_KEYS: Record<string, string> = {
  provision: "calendar.payoutUnknown.provision",
  provision_ungueltig: "calendar.payoutUnknown.provisionUngueltig",
  // Eigentümer und Vertrag existieren — der Vertrag gilt nur nicht für DIESEN
  // Aufenthalt (Stichtag ist die Abreise, 0343). Ein eigener Grund, weil
  // „Provision fehlt" hier in die Irre führt: live gesucht am 13.08.2026, als
  // ein Vertrag ab 12.08. eine am 09.08. abgereiste Buchung nicht abdeckte.
  provision_zeitraum: "calendar.payoutUnknown.provisionZeitraum",
  betrag: "calendar.payoutUnknown.betrag",
  naechte: "calendar.payoutUnknown.naechte",
  // Pauschale/Mindestprovision des Vertrags lauten auf eine andere Währung als
  // die Buchung (0343). Bewusst kein Umrechnen, darum ein eigener Grund.
  waehrung_vertrag: "calendar.payoutUnknown.waehrungVertrag",
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
          // Eine Eigennutzung hat KEINE Lücke: es fehlt nichts, es gibt nichts
          // auszuzahlen. Ohne diese Ausnahme trüge der Chip der eigenen Sperre
          // „k. A." und der Tooltip „nicht ausweisbar" — der Eigentümer suchte
          // einen Datenfehler, den es nicht gibt (Wurzel 4).
          luecke: !b.is_owner_stay && wert == null,
          grund:
            !b.is_owner_stay && wert == null ? b.payout_unknown_reason : null,
          currency: b.currency,
          gast: b.guest_first_name?.trim() || null,
          nachname: b.guest_last_name?.trim() || null,
          nationalitaet: b.guest_nationality?.trim() || null,
          land: b.guest_country?.trim() || null,
          // Bewusst `?? null` statt `|| null`: eine 0 ist hier eine ECHTE
          // Aussage („keine Haustiere") und darf nicht zu „keine Angabe"
          // werden. `||` hätte genau das getan.
          gaeste: b.num_guests ?? null,
          erwachsene: b.adults ?? null,
          kinder: b.children ?? null,
          haustiere: b.pets ?? null,
          quelle: b.booking_source?.trim() || null,
          eigennutzung: b.is_owner_stay,
        });
        continue;
      }
      vorhanden.bis = tag.date;
      vorhanden.naechte += 1;
      // Bei einer Eigennutzung gibt es nichts fortzuschreiben: kein Betrag,
      // keine Spanne, keine Währung. Ohne dieses frühe Weiter liefe sie in den
      // Währungsvergleich unten und setzte `grund='betrag'` — die eigene Sperre
      // behauptete dann einen Datenfehler, weil `currency` erwartungsgemäß
      // `null` ist. Nur `bis`/`naechte` wachsen mit (oben bereits erledigt).
      if (b.is_owner_stay) continue;
      // `proNacht` bleibt der Wert der ERSTEN Nacht und wird nicht fortgeschrieben.
      // Nur die Spanne wächst mit — sie speist den Tooltip bei Saisonwechsel.
      if (wert == null) {
        vorhanden.luecke = true;
        // Der ERSTE auftretende Grund bleibt stehen. Tragen die Nächte eines
        // Aufenthalts verschiedene Gründe, ist der erste der aussagekräftigste
        // (die Ursachen `provision`/`betrag` gelten ohnehin der ganzen Buchung);
        // ein Überschreiben ließe den Text je Monatswechsel springen.
        vorhanden.grund = vorhanden.grund ?? b.payout_unknown_reason;
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
        // Auch dieser Zweig muss einen Grund setzen: er verwirft gerade einen
        // Betrag, der vom Server SEHR WOHL kam. Ohne ihn entstünde hier erneut
        // ein stummes „—". `betrag` ist der zutreffende Grund — die Beträge
        // dieser Buchung sind zueinander nicht summierbar.
        vorhanden.luecke = true;
        vorhanden.grund = vorhanden.grund ?? "betrag";
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

  // Welche Monate in diesem Anlauf schon ABGERUFEN wurden — erfolgreich oder
  // nicht. Ein Ref und kein State, denn er darf `laden` nicht neu erzeugen.
  //
  // WARUM ES DEN MERKER BRAUCHT (18.09.2026, live beobachtet): `laden` hängt
  // in seinen Dependencies an `monatsTage`, und der Effekt darunter feuert bei
  // jeder neuen `laden`-Identität. Schlug ein Monat fehl, kam er bewusst NICHT
  // in den Cache (ein fehlgeschlagener Monat darf nicht als „geladen, leer"
  // gelten) — `setMonatsTage` baute aber trotzdem `new Map(vorher)` und damit
  // eine neue Identität. Ergebnis: Abruf schlägt fehl → neue Map → neues
  // `laden` → Effekt → Abruf schlägt fehl. Im Serverlog stand daraufhin ein
  // `POST /portal/kalender` alle 30 ms, dauerhaft, solange die Seite offen war.
  //
  // Der Merker hält die Absicht von damals aufrecht — ein Fehlmonat bleibt aus
  // dem Cache und wird beim nächsten ECHTEN Anlass erneut versucht (Objekt-
  // wechsel, Realtime-Ereignis, weitergescrolltes Band) — nimmt ihm aber den
  // sofortigen Wiederholungs-Sturm.
  const versuchteMonate = useRef<Set<string>>(new Set());

  // Der angetippte Aufenthalt — Quelle des Detailblatts. `null` = zu.
  const [detail, setDetail] = useState<Aufenthalt | null>(null);

  // Ein Objektwechsel verwirft alle geladenen Monate: die Tage des alten
  // Objekts dürfen unter dem neuen Namen nicht stehenbleiben.
  useEffect(() => {
    setMonatsTage(new Map());
    versuchteMonate.current = new Set();
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
        return;
      }
      // `neuLaden` (Realtime/Objektwahl) ist ein ECHTER Anlass: der Merker
      // wird verworfen, damit auch zuvor fehlgeschlagene Monate erneut drankommen.
      if (neuLaden) versuchteMonate.current = new Set();
      const offen = neuLaden
        ? monate
        : monate.filter((m) => {
            const k = monatsSchluessel(m);
            return !monatsTage.has(k) && !versuchteMonate.current.has(k);
          });
      if (offen.length === 0) return;
      // VOR dem Abruf vormerken, nicht danach: zwei gleichzeitig laufende
      // Durchgänge (Effekt und Realtime-Ereignis) holten denselben Monat sonst
      // doppelt.
      for (const m of offen) versuchteMonate.current.add(monatsSchluessel(m));

      setLaedt(true);
      const ergebnisse = await Promise.all(
          offen.map(async (m) => {
            const von = `${monatsSchluessel(m)}-01`;
            // Letzter Tag des Monats: der 0. des Folgemonats.
            const bis = iso(new Date(Date.UTC(m.jahr, m.monat + 1, 0)));
            return {
              key: monatsSchluessel(m),
              antwort: await getOwnerCalendar(propertyId, von, bis),
            };
          }),
        );
      setLaedt(false);

      // Ein Ladefehler ist nicht „nichts gebucht": beide Aussagen sind
      // verschieden und müssen es auch in der UI bleiben (Wurzel 4/5).
      const fehler = ergebnisse.find((e) => !e.antwort.ok);
      setLadeFehler(fehler && !fehler.antwort.ok ? fehler.antwort.error : null);
      // Nur erfolgreiche Monate in den Cache — ein fehlgeschlagener Monat darf
      // nicht als „geladen, leer" gelten, sonst behauptete er dauerhaft
      // „nichts gebucht".
      const erfolgreich = ergebnisse.filter((e) => e.antwort.ok);
      setMonatsTage((vorher) => {
        // Kam NICHTS dazu, bleibt die alte Map — samt ihrer Identität. Ein
        // `new Map(vorher)` an dieser Stelle war die Ursache der Endlosschleife
        // (siehe `versuchteMonate`): es sah für React wie ein neuer Zustand aus,
        // obwohl sich kein einziger Tag geändert hatte.
        if (erfolgreich.length === 0) return vorher;
        const naechster = new Map(vorher);
        for (const e of erfolgreich) {
          if (e.antwort.ok) naechster.set(e.key, e.antwort.data.days);
        }
        return naechster;
      });
    },
    [propertyId, monate, monatsTage],
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

  const heute = iso(new Date());

  // Aufenthalte über das GANZE Band (siehe `alleTage`).
  const aufenthalte = useMemo(() => aufenthalteBilden(alleTage), [alleTage]);

  // Kanäle, die im Band wirklich vorkommen — Grundlage der Legende.
  // Zusammengefasst nach Farbe: „Booking.com" und „booking" sind derselbe
  // Kanal und dürfen nicht zweimal in der Legende stehen.
  const kanaeleImMonat = useMemo(() => {
    const proFarbe = new Map<string, string>();
    for (const a of aufenthalte) {
      // Eigennutzungen tragen keinen Kanal und haben ihren eigenen
      // Legendeneintrag (siehe `eigennutzungImBand`).
      if (a.eigennutzung || !a.quelle) continue;
      const farbe = kanalFarbe(a.quelle);
      if (!proFarbe.has(farbe)) proFarbe.set(farbe, a.quelle);
    }
    return [...proFarbe.values()].sort((x, y) => x.localeCompare(y));
  }, [aufenthalte]);

  // Steht im sichtbaren Band überhaupt eine Eigennutzung? Nur dann bekommt sie
  // einen Legendenpunkt — wie bei den Kanälen wird nichts erklärt, was gerade
  // nirgends zu sehen ist.
  const eigennutzungImBand = useMemo(
    () => aufenthalte.some((a) => a.eigennutzung),
    [aufenthalte],
  );

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
              {/* Derselbe Versatz wie in der Wochenzeile (w-6 + gap-1), sonst
                  stünde „Mo" über der Wochennummer statt über dem Montag. */}
              <div className="mb-2 flex items-stretch gap-1">
                <span aria-hidden className="w-6 shrink-0" />
                <div className="grid min-w-0 flex-1 grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
                  {wochentage.map((w) => (
                    <span key={w}>{w}</span>
                  ))}
                </div>
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
                          locale={locale}
                          aufOeffnen={setDetail}
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

          {/* Detailblatt. Es ersetzt den nativen `title`-Tooltip als WEG zu den
          Angaben — nicht als Zugabe: ein `title` braucht eine Sekunde Hover
          und erscheint auf Tablet und Telefon gar nicht. Gemeldet am
          18.09.2026 mit „tooltip sieht man nicht", und das war zutreffend:
          Gäste, Haustiere und Herkunft waren dort für jeden Touch-Nutzer
          unerreichbar. Dieselben Zeilen wie im Detailblatt der Eigentümer-App
          — eine Fläche, zwei Oberflächen, dieselbe Auskunft. */}
      <AufenthaltBlatt
        aufenthalt={detail}
        locale={locale}
        schliessen={() => setDetail(null)}
      />

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
                {eigennutzungImBand && (
                  <LegendenPunkt
                    klasse={EIGENNUTZUNG_FARBE}
                    label={t("calendar.ownerStay")}
                  />
                )}
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
  ueberlauf: Map<
    number,
    { anzahl: number; summe: number | null; currency: string | null; grund: string | null }
  >;
} {
  // Genau MAX_BAHNEN Bahnen, fest angelegt: es wird bewusst KEINE weitere
  // erzeugt. Was in keine davon passt, geht in den „+n"-Chip.
  const belegt: number[][] = Array.from({ length: MAX_BAHNEN }, () => []);
  const sichtbar: Bahn[] = [];
  const ueberlauf = new Map<
    number,
    { anzahl: number; summe: number | null; currency: string | null; grund: string | null }
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
      // Eine Eigennutzung wird MITGEZÄHLT (sie belegt eine Einheit), trägt aber
      // NICHTS zur Summe bei: sie hat weder Betrag noch Währung. Ohne diese
      // Trennung zöge sie die Sammelsumme auf `null` und der „+n"-Chip zeigte
      // „k. A.", obwohl die übrigen Einheiten sehr wohl einen Payout haben.
      const eigen = seg.aufenthalt.eigennutzung;
      const beitrag = eigen ? null : seg.aufenthalt.proNacht;
      const beitragWaehrung = eigen ? null : seg.aufenthalt.currency;
      for (const s of spalten) {
        const vorhanden = ueberlauf.get(s);
        if (!vorhanden) {
          ueberlauf.set(s, {
            anzahl: 1,
            summe: beitrag,
            currency: beitragWaehrung,
            grund: eigen || beitrag != null ? null : seg.aufenthalt.grund,
          });
          continue;
        }
        vorhanden.anzahl += 1;
        if (eigen) continue;
        // Wie bei einem einzelnen Aufenthalt: eine unbestimmte Position macht
        // den Wert unbestimmt, es wird keine Teilsumme gezeigt (Wurzel 4).
        vorhanden.summe =
          vorhanden.summe == null || beitrag == null
            ? null
            : vorhanden.summe + beitrag;
        // Der Grund der ersten unbestimmten Position trägt die Erklärung — auch
        // hier darf kein wortloses „—" entstehen.
        if (beitrag == null) {
          vorhanden.grund = vorhanden.grund ?? seg.aufenthalt.grund;
        }
        if (vorhanden.currency !== beitragWaehrung) {
          vorhanden.currency = null;
          vorhanden.summe = null;
          vorhanden.grund = vorhanden.grund ?? "betrag";
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
  locale,
  aufOeffnen,
}: {
  woche: (string | null)[];
  segmente: Segment[];
  heute: string;
  tagMap: Map<string, PortalCalendarDay>;
  locale: string;
  aufOeffnen: (a: Aufenthalt) => void;
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

  // Die Wochennummer steht in einer eigenen Spalte NEBEN dem Sieben-Tage-
  // Gitter, nicht als achte Spalte darin. Grund: die Chip-Ebene positioniert in
  // Prozent der Gitterbreite (`SPALTE = 100 / 7`). Eine achte Spalte im selben
  // Gitter hätte jeden Chip um ein Achtel nach rechts versetzt — und zwar
  // genau so wenig, dass es wie ein Rundungsfehler aussieht statt wie ein
  // kaputtes Layout.
  //
  // Die Nummer der Woche ist die ihres ERSTEN belegten Tages: am Monatsanfang
  // sind die führenden Zellen leer, `woche[0]` kann also null sein.
  const ersterTag = woche.find(Boolean) ?? null;

  return (
    <div className="flex items-stretch gap-1">
      <span
        aria-hidden
        className="flex w-6 shrink-0 items-start justify-end pt-1 text-[0.625rem] tabular-nums text-muted-foreground/70"
      >
        {ersterTag ? isoKalenderwoche(ersterTag) : null}
      </span>
      <div
        className="relative min-w-0 flex-1"
        style={{ height: `${hoehe}rem` }}
      >
      <div className="grid h-full grid-cols-7 gap-1">
        {woche.map((datum, i) =>
          datum ? (
            <Tageszelle
              key={datum}
              datum={datum}
              istHeute={datum === heute}
              info={tagMap.get(datum) ?? null}
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
            aufOeffnen={aufOeffnen}
          />
        ))}
        {[...ueberlauf.entries()].map(([spalte, rest]) => (
          <SammelChip
            key={`plus-${woche[spalte] ?? spalte}`}
            spalte={spalte}
            anzahl={rest.anzahl}
            summe={rest.summe}
            currency={rest.currency}
            grund={rest.grund}
            bahn={MAX_BAHNEN}
            locale={locale}
            label={t("calendar.moreUnits", { count: rest.anzahl })}
          />
        ))}
      </div>
      </div>
    </div>
  );
}

type Uebersetzer = ReturnType<typeof useTranslations<"portal">>;

/**
 * Die Besetzung als EIN Satzstück: „4 (2 Erwachsene, 2 Kinder)" oder „4".
 *
 * `null`, wenn die Personenzahl gar nicht erfasst ist — dann steht die Zeile
 * nicht da, statt eine 1 zu erfinden (Wurzel 4). Die Aufteilung kommt nur
 * dazu, wenn sie WIRKLICH vorliegt: „4 (2 Erwachsene, 0 Kinder)" bei
 * ungepflegten Feldern wäre eine Angabe, die niemand erfasst hat.
 */
function besetzungText(a: Aufenthalt, t: Uebersetzer): string | null {
  if (a.gaeste == null) return null;
  const teile = [
    a.erwachsene == null ? null : t("calendar.adultsCount", { count: a.erwachsene }),
    a.kinder == null ? null : t("calendar.childrenCount", { count: a.kinder }),
  ].filter(Boolean);
  return teile.length ? `${a.gaeste} (${teile.join(", ")})` : String(a.gaeste);
}

/**
 * Haustiere als Text. `0` und `null` sind ZWEI Aussagen: 0 heißt „gefragt,
 * keins dabei" und wird ausgeschrieben, `null` heißt „nicht erfasst" und
 * liefert `null` — die Zeile entfällt dann ganz.
 */
function haustierText(a: Aufenthalt, t: Uebersetzer): string | null {
  if (a.haustiere == null) return null;
  return a.haustiere > 0 ? String(a.haustiere) : t("calendar.noPets");
}

/**
 * Was in der Auszahlungszeile steht: Spanne, Einzelwert oder der GRUND.
 *
 * EINE Stelle für Chip und Detailblatt. Beide zeigten dieselbe Zahl, und beide
 * hatten die Ableitung eigenständig stehen — inklusive der Regel, dass ein
 * fehlender Betrag den Grund nennt statt eines Gedankenstrichs. Zwei Kopien
 * derselben Regel laufen beim ersten neuen Grund auseinander.
 *
 * Kein Durchschnitt bei schwankenden Nächten: den bekäme der Eigentümer in
 * keiner einzigen Nacht (Wurzel 4).
 */
function auszahlungText(
  a: Aufenthalt,
  t: Uebersetzer,
  locale: string,
  nachkommastellen?: number,
): string {
  const geld = (v: number) =>
    formatCurrency(v, a.currency, locale, nachkommastellen);
  if (
    a.minProNacht != null &&
    a.maxProNacht != null &&
    a.minProNacht !== a.maxProNacht
  ) {
    return `${geld(a.minProNacht)} – ${geld(a.maxProNacht)}`;
  }
  if (a.proNacht != null) return geld(a.proNacht);
  return a.grund && a.grund in GRUND_KEYS
    ? t(GRUND_KEYS[a.grund])
    : t("calendar.payoutUnknown.label");
}

/**
 * Das Detailblatt EINES Aufenthalts — alles, was der Chip nicht zeigen kann.
 *
 * Die Reihenfolge folgt dem Blatt der Eigentümer-App (`mobile-owner`):
 * Zeitraum, Nächte, Quelle, Auszahlung, dann Herkunft und Besetzung. Zwei
 * Oberflächen mit derselben Auskunft in derselben Reihenfolge — wer zwischen
 * App und Portal wechselt, sucht sonst jedes Mal neu.
 *
 * Eine Zeile, deren Wert fehlt, wird WEGGELASSEN statt mit „—" gefüllt: eine
 * leere Zeile „Nationalität" behauptet, wir hätten die Angabe erhoben und sie
 * sei leer. Für dieses Objekt trifft das Gegenteil zu — die Portale liefern sie
 * schlicht nicht (gemessen 18.09.2026: Land bei 4 von 79 Buchungen,
 * Nationalität bei keiner).
 */
function AufenthaltBlatt({
  aufenthalt: a,
  locale,
  schliessen,
}: {
  aufenthalt: Aufenthalt | null;
  locale: string;
  schliessen: () => void;
}) {
  const t = useTranslations("portal");
  if (!a) return null;

  // Eine Zeile mit `null` als Wert wird unten WEGGELASSEN statt mit „—"
  // gefüllt: eine leere Zeile „Nationalität" behauptet, wir hätten die Angabe
  // erhoben und sie sei leer. Für dieses Objekt trifft das Gegenteil zu — die
  // Portale liefern sie nicht mit.
  //
  // Eigennutzung trägt NUR Zeitraum und Nächte: kein Gast, kein Kanal, keine
  // Betragszeile („nicht ausweisbar" wäre dort eine Falschaussage, es gibt
  // nichts auszuzahlen). Dass es die eigene Sperre ist, sagt der Titel.
  const zeilen: [string, string | null][] = [
    [t("calendar.period"), `${a.von} – ${a.bis}`],
    [t("calendar.nightsLabel"), String(a.naechte)],
    ...(a.eigennutzung
      ? []
      : ([
          [t("calendar.channel"), channelLabelLoose(a.quelle)],
          [t("calendar.payoutPerNight"), auszahlungText(a, t, locale)],
          [t("calendar.nationality"), a.nationalitaet],
          [t("calendar.country"), a.land],
          [t("calendar.guests"), besetzungText(a, t)],
          [t("calendar.pets"), haustierText(a, t)],
        ] as [string, string | null][])),
  ];

  const titel = a.eigennutzung
    ? t("calendar.ownerStay")
    : [a.gast, a.nachname].filter(Boolean).join(" ") || t("calendar.booking");

  return (
    <Dialog open onOpenChange={(offen) => !offen && schliessen()}>
      <DialogContent className="max-w-md gap-3">
        <DialogTitle className="pr-8 text-base font-semibold">
          {titel}
        </DialogTitle>
        <dl className="divide-y divide-border overflow-hidden rounded-(--radius) border border-border">
          {zeilen
            .filter((z): z is [string, string] => z[1] != null)
            .map(([k, v]) => (
              <div
                key={k}
                className="flex items-center justify-between gap-4 px-3 py-2.5"
              >
                <dt className="text-sm text-muted-foreground">{k}</dt>
                <dd className="text-right text-sm font-semibold">{v}</dd>
              </div>
            ))}
        </dl>
      </DialogContent>
    </Dialog>
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
  aufOeffnen,
}: {
  segment: Segment;
  bahn: number;
  locale: string;
  /** Klick auf den Chip öffnet das Detailblatt. Der native `title`-Tooltip
   *  bleibt als Zugabe, ist aber NICHT der Weg: er braucht eine Sekunde Hover
   *  und erscheint auf Tablet und Telefon überhaupt nicht — dort waren Gäste,
   *  Haustiere und Herkunft schlicht unerreichbar. */
  aufOeffnen: (a: Aufenthalt) => void;
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
  // Kurzform für den Chip selbst — auf der schmalen Fläche ist kein Platz für
  // den Klartext. Der ganze Satz steht im Tooltip und im Detailblatt.
  const kurz = t("calendar.payoutUnknown.short");

  // Die Eigennutzung bekommt einen eigenen Tooltip: kein Gast, kein Kanal, und
  // vor allem KEINE Betragszeile. „Auszahlung/Nacht: nicht ausweisbar" wäre
  // hier eine Falschaussage — es gibt schlicht nichts auszuzahlen.
  const titel = a.eigennutzung
    ? [
        `${a.von} – ${a.bis}`,
        t("calendar.nights", { count: a.naechte }),
        t("calendar.ownerStay"),
      ].join(" · ")
    : [
        `${a.von} – ${a.bis}`,
        t("calendar.nights", { count: a.naechte }),
        a.gast
          ? `${t("calendar.guest")}: ${[a.gast, a.nachname]
              .filter(Boolean)
              .join(" ")}`
          : null,
        a.nationalitaet
          ? `${t("calendar.nationality")}: ${a.nationalitaet}`
          : null,
        a.land ? `${t("calendar.country")}: ${a.land}` : null,
        // `!= null` statt truthy: 0 Haustiere ist eine Aussage, die der
        // Eigentümer sehen will („es kommt kein Hund"). Bei den Personen gibt
        // es keine sinnvolle 0, dort ist die Prüfung nur der Vollständigkeit
        // halber gleich geschrieben.
        a.gaeste != null ? `${t("calendar.guests")}: ${a.gaeste}` : null,
        a.haustiere != null
          ? a.haustiere > 0
            ? `${t("calendar.pets")}: ${a.haustiere}`
            : t("calendar.noPets")
          : null,
        kanalLabel ? `${t("calendar.channel")}: ${kanalLabel}` : null,
        // Fehlt der Betrag, nennt der Tooltip den GRUND statt eines Gedankenstrichs.
        // Spanne, Einzelwert oder Grund — über den GETEILTEN Helfer, denselben
        // wie das Detailblatt. Stünde die Ableitung hier ein zweites Mal,
        // liefen Tooltip und Blatt beim ersten neuen Grund auseinander.
        `${t("calendar.payoutPerNight")}: ${auszahlungText(a, t, locale, 0)}`,
      ]
        .filter(Boolean)
        .join(" · ");

  // Halbtags-Versatz nur an ECHTEN Kanten: an einer bloßen Wochengrenze läuft
  // der Chip bündig weiter, sonst entstünde dort eine Lücke, die wie ein
  // freier Tag aussieht.
  const { links, breite } = chipLage(segment);

  // Gemeinsame Geometrie beider Chip-Arten — sie unterscheiden sich nur in
  // Farbe und Inhalt, nicht in Lage und Kantenrundung.
  const lage = {
    left: `calc(${links}% + 0.125rem)`,
    width: `calc(${breite}% - 0.25rem)`,
    top: `calc(${bahnOben(bahn)} + ${CHIP_HOEHE / 2}rem)`,
    height: `${CHIP_HOEHE}rem`,
  };
  const kanten = `${segment.echterAnfang ? "rounded-l-full" : ""} ${
    segment.echtesEnde ? "rounded-r-full" : ""
  }`;

  // EIGENNUTZUNG (0241): eigener Chip statt der Gast-Darstellung. Kein
  // Portal-Logo (es gab kein Portal), kein Vorname (es gibt keinen Gast) und
  // keine Betragszeile — nicht einmal die Kurzform „k. A.", die hier einen
  // fehlenden Wert behauptete, wo gar keiner vorgesehen ist.
  if (a.eigennutzung) {
    return (
      <button
        type="button"
        onClick={() => aufOeffnen(a)}
        title={titel}
        className={`pointer-events-auto absolute flex -translate-y-1/2 cursor-pointer items-center gap-1 px-2 text-left text-[0.6875rem] font-medium text-background ring-1 ring-background transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-foreground ${EIGENNUTZUNG_FARBE} ${kanten}`}
        style={lage}
      >
        <Icon icon="ph:lock-simple-fill" className="size-3 shrink-0" />
        <span className="min-w-0 truncate">{t("calendar.ownerStay")}</span>
        <Icon
          icon="ph:info"
          aria-hidden
          className="ml-auto size-3 shrink-0 opacity-70"
        />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => aufOeffnen(a)}
      title={titel}
      // `ring-1 ring-background` trennt den Chip sichtbar von der getönten
      // Zelle darunter — ohne diese Kante verschwimmen Kanalfarbe und
      // Saisonfarbe ineinander.
      // Wie der PMS-Balken: die Bahn gibt die Mitte vor, der Chip sitzt mit
      // `-translate-y-1/2` mittig darin — nicht auf ihrer Oberkante.
      className={`pointer-events-auto absolute flex -translate-y-1/2 cursor-pointer items-center gap-1 px-2 text-left text-[0.6875rem] font-medium text-white ring-1 ring-background transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-foreground ${kanalFarbe(a.quelle)} ${kanten}`}
      style={lage}
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
      {/* Vor- und Nachname als EIN Textknoten, damit `truncate` bei schmalem
          Chip hinten abschneidet („Erika Muster…") statt den Nachnamen als
          eigenes Element ganz verschwinden zu lassen. */}
      {a.gast && (
        <span className="min-w-0 truncate">
          {[a.gast, a.nachname].filter(Boolean).join(" ")}
        </span>
      )}
      {/* Der Betrag steht NUR auf dem Stück mit dem echten Ende. Ein Aufenthalt
          über mehrere Wochen-/Monatszeilen wiederholte ihn sonst auf jedem
          Stück — vier Segmente lasen sich dann wie vier getrennte Zahlungen
          statt wie ein Nachtwert. Das echte Ende trägt ihn, weil dort auch die
          runde Abschlusskante sitzt. */}
      {segment.echtesEnde && (
        // Der Betrag wird BENANNT: „netto/Nacht 578 DKK". Ohne die Benennung
        // stand dort eine nackte Zahl, die sich genauso als Gesamtpreis des
        // Aufenthalts oder als Gastpreis lesen ließ — beides falsch. Das Label
        // weicht als ERSTES, wenn der Chip zu schmal wird (`truncate`), der
        // Betrag bleibt vollständig (`shrink-0`).
        <span className="ml-auto flex min-w-0 shrink-0 items-baseline gap-1">
          <span className="min-w-0 truncate text-[0.625rem] font-normal opacity-75">
            {t("calendar.payoutPerNightShort")}
          </span>
          {/* Ohne Betrag steht hier die Kurzform („k. A.") statt eines
              Gedankenstrichs. Den Grund liefert der Tooltip (`titel`). */}
          <span
            className={
              betrag ? "shrink-0 font-semibold" : "shrink-0 font-normal italic opacity-90"
            }
          >
            {betrag ?? kurz}
          </span>
        </span>
      )}
        {/* Sichtbares „i": der Chip ist anklickbar, und das muss man SEHEN.
            Ein reiner Hover-Tooltip war der vorherige Weg — auf Tablet und
            Telefon gibt es ihn gar nicht, und mit der Maus findet ihn nur, wer
            zufällig stehen bleibt. Das Icon ist rein dekorativ (`aria-hidden`):
            anklickbar ist der ganze Chip, es wäre sonst ein zweites Ziel für
            dieselbe Handlung. */}
        <Icon
          icon="ph:info"
          aria-hidden
          className={`size-3 shrink-0 opacity-70 ${segment.echtesEnde ? "" : "ml-auto"}`}
        />
    </button>
  );
}

/** „+n" für die Einheiten, die nicht mehr als eigener Chip passen. */
function SammelChip({
  spalte,
  anzahl,
  summe,
  currency,
  grund,
  bahn,
  locale,
  label,
}: {
  spalte: number;
  anzahl: number;
  summe: number | null;
  currency: string | null;
  grund: string | null;
  bahn: number;
  locale: string;
  label: string;
}) {
  const t = useTranslations("portal");
  // Ebenfalls der Nachtwert (Summe der Nachtwerte der zusammengefassten
  // Einheiten für DIESEN Tag) — nicht deren Aufenthaltssummen.
  const betrag = summe == null ? null : formatCurrency(summe, currency, locale, 0);
  const kurz = t("calendar.payoutUnknown.short");
  const grundText =
    grund && GRUND_KEYS[grund]
      ? t(GRUND_KEYS[grund])
      : t("calendar.payoutUnknown.label");
  return (
    <div
      title={`${label} · ${t("calendar.payoutPerNight")}: ${betrag ?? grundText}`}
      className="pointer-events-auto absolute flex -translate-y-1/2 items-center justify-between gap-1 rounded-full bg-secondary px-2 text-[0.6875rem] font-medium text-secondary-foreground ring-1 ring-background"
      style={{
        left: `calc(${spalte * SPALTE}% + 0.125rem)`,
        width: `calc(${SPALTE}% - 0.25rem)`,
        top: `calc(${bahnOben(bahn)} + ${CHIP_HOEHE / 2}rem)`,
        height: `${CHIP_HOEHE}rem`,
      }}
    >
      <span className="shrink-0">+{anzahl}</span>
      {/* Auch hier benannt — im „+n"-Chip ist die Summe der zusammengefassten
          Einheiten gemeint, ebenfalls je Nacht. */}
      <span className="flex min-w-0 items-baseline gap-1">
        <span className="min-w-0 truncate text-[0.625rem] font-normal opacity-75">
          {t("calendar.payoutPerNightShort")}
        </span>
        <span
          className={
            betrag ? "shrink-0 font-semibold" : "shrink-0 font-normal italic opacity-90"
          }
        >
          {betrag ?? kurz}
        </span>
      </span>
    </div>
  );
}

function Tageszelle({
  datum,
  istHeute,
  info,
}: {
  datum: string;
  istHeute: boolean;
  info: PortalCalendarDay | null;
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

  // Ist die Nacht belegt, aber kein Betrag ausweisbar, nennt auch die ZELLE den
  // Grund. Der Chip liegt über der Zelle, deckt sie aber nicht vollständig ab —
  // wer den freien Rand trifft, bekam sonst einen Tooltip ohne jeden Hinweis
  // darauf, dass hier Geld fehlt.
  const grund =
    info && info.status === "booked" && info.owner_payout_per_night == null
      ? (info.owner_payout_unknown_reason &&
        GRUND_KEYS[info.owner_payout_unknown_reason]
          ? t(GRUND_KEYS[info.owner_payout_unknown_reason])
          : t("calendar.payoutUnknown.label"))
      : null;

  const titel = [
    datum,
    statusLabel,
    einheiten,
    grund ? `${t("calendar.payoutPerNight")}: ${grund}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      title={titel}
      className={`relative flex h-full flex-col rounded-(--radius) border ${
        istHeute ? "border-accent" : "border-border"
      } ${status === "blocked" ? "bg-muted-foreground/15" : "bg-card"}`}
    >
      <div className="flex items-center gap-1.5 px-1.5 pt-1 text-xs">
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

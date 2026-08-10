"use client";

// Kalender-Raster (Timeline): rollierend ab HEUTE, links
// Objektzeilen (Foto/Name/Adresse), rechts scrollende Tagespalten mit
// Wochentag+Datum. Zellen zeigen Gäste + Preis-Platzhalter; belegte/gesperrte
// Zeiträume als Balken. Scrollt INNERHALB des Containers (kein Seiten-Overflow).
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import { NativeSelect } from "@nextdays/ui/native-select";
import {
  type ViewOptions,
  CalendarHeader,
  DEFAULT_VIEW,
} from "@/components/kalender/calendar-header";
import { CalendarActionMenu } from "@/components/kalender/calendar-action-menu";
import { BulkEditDialog } from "@/components/kalender/bulk-edit-dialog";
import { ReservationDetailSlider } from "@/components/kalender/reservation-detail-slider";
import { PropertyLabel } from "@/components/kalender/property-label";
import { ReservationWizard } from "@/components/kalender/reservation-wizard";
import {
  type AvailabilitySource,
  type AvailabilityStatus,
  type DayAvailability,
  blockRange,
  unblockRange,
  clearStopSell,
  type StopSellDay,
  type StopSellSource,
  getBoard,
} from "@/lib/calendar";
import {
  type AgencyOption,
  StopSellPanel,
  type StopSellSelection,
} from "@/components/stop-sell/stop-sell-panel";
import { listAgencies } from "@/lib/travel-agencies";
import { CHANNEL_META, CHANNEL_SOURCES, channelMeta } from "@/lib/calendar-channels";
import { ChannelLogo } from "@/components/channel-logo";
import { explainFactors } from "@/lib/dp-factors";
import {
  type DisplayStatus,
  OWNER_STAY_BAR,
  OWNER_STAY_ICON,
  STATUS_META,
  reservationStatus,
} from "@/lib/calendar-status";
import type { PropertyType } from "@/lib/properties";
import { useCalendarLabels } from "@/lib/use-calendar-labels";
import { usePropertyLabels } from "@/lib/use-property-labels";
import { channelLabelLoose } from "@/lib/channel-logos";
import { getRateGrid } from "@/lib/rates";
import { Input } from "@nextdays/ui/input";
import {
  type Reservation,
  listReservations,
  moveReservation,
} from "@/lib/reservations";
import { toast } from "sonner";
import { useRealtime } from "@/lib/use-realtime";

export type Prop = {
  id: string;
  title: string;
  type: PropertyType;
  photo: string | null;
  address: string;
  city: string;
  maxGuests: number;
  // Dynamic Pricing für dieses Objekt aktiv → Blitz-Markierung in der Zeile.
  dynamicEnabled?: boolean;
};

// Wochentags-/Monatslabels aus t (Modul-Level-Konstanten können kein useTranslations
// nutzen) — Funktionen erhalten t als Parameter, aufgerufen innerhalb der Komponente.
const WEEKDAY_KEYS = ["so", "mo", "di", "mi", "do", "fr", "sa"] as const;
const MONTH_KEYS = [
  "januar", "februar", "maerz", "april", "mai", "juni",
  "juli", "august", "september", "oktober", "november", "dezember",
] as const;
function weekdayLabels(t: (key: string) => string): string[] {
  return WEEKDAY_KEYS.map((k) => t(`calendarBoard.weekdays.${k}`));
}
function monthLabels(t: (key: string) => string): string[] {
  return MONTH_KEYS.map((k) => t(`calendarBoard.months.${k}`));
}

const COL = 5.5; // rem pro Tagesspalte (breit & lesbar, konstant)
const LABEL = 17; // rem für die Objektspalte
const ROW_H = 3.5; // rem Zeilenhöhe (kompakter — mehr Objekte pro Bildschirm)
// Halbtags-Versatz der Buchungsbalken (Anreise ab Spaltenmitte, Auslauf bis zur
// Mitte des Abreisetags). EINE Quelle für Balken-Rendering UND Geister-Vorschau,
// damit beide denselben Wechseltag optisch teilen (kein zweites verstreutes 0.5).
const HALF_DAY = 0.5;


// Durchgehende Timeline: Bereich vom 1. Januar des LAUFENDEN Jahres bis Ende des
// FOLGEJAHRES — so reicht das Scrollen zurück bis 01.01. UND mehr als ein Jahr
// voraus. Die Spaltenbreite bleibt konstant (lesbar); gescrollt wird durchgehend.
// Gerendert wird nur ein virtualisiertes Sub-Fenster; die Index-Geometrie
// (Drag/Balken) bleibt ABSOLUT in `dates`, damit sie unverändert weiterrechnet.
// Grenzen hängen vom heutigen Datum ab → zur Laufzeit berechnet (siehe Component).
function rangeStart(now: Date): Date {
  return new Date(now.getFullYear(), 0, 1); // 1. Januar, laufendes Jahr
}
function rangeEnd(now: Date): Date {
  return new Date(now.getFullYear() + 1, 11, 31); // 31. Dezember, Folgejahr
}
function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}
// Wie viele Spalten links/rechts des sichtbaren Fensters zusätzlich gerendert
// werden (Puffer gegen Leerflächen beim schnellen Scrollen).
const OVERSCAN = 24;
// Chunk-Größe (Tage) für das Nachladen der Tagesdaten beim Scrollen.
const CHUNK_DAYS = 90;
// Vorlauf-Fenster (Tage) um heute, das im Hintergrund vorgeladen wird. Früher
// wurde das GANZE Jahr (~730 Tage) vorgeladen — beim Batch-Board sind das zwar
// wenige Requests, aber je ~0,5 MB. Wir laden nur ein halbes Jahr voraus + ein
// Vierteljahr zurück; alles Weitere zieht der Scroll-Handler bedarfsgesteuert
// über ensureLoaded nach (das existiert bereits). Spart Erst-Last-Bandbreite.
const PREFETCH_AHEAD_DAYS = 180;
const PREFETCH_BEHIND_DAYS = 90;

// Segment-Status: availability-Status plus zwei Stop-Sell-Zustände. Sperre und
// Stop-Sell sind ZWEI GETRENNTE ACHSEN und können am selben Tag gleichzeitig
// gelten:
//   blocked            — Verfügbarkeit 0 (availability.blocked). Der Tag ist zu.
//   stop_sell          — Tag verfügbar, wird aber nicht aktiv verkauft
//                        (stop_sell-Zeile mit Grund/Adressat).
//   blocked_stop_sell  — BEIDES gilt. Früher gewann der Stop-Sell die Anzeige
//                        und die Sperre darunter war unsichtbar; ein Nutzer hat
//                        deshalb eine echte Sperre für einen Stop-Sell gehalten.
type SegStatus = AvailabilityStatus | "stop_sell" | "blocked_stop_sell";

// Jeder Zustand hat eine EIGENE, auf einen Blick unterscheidbare Darstellung:
// Sperre = massiver neutraler Block, Stop-Sell = Warnfarbe mit Schrägstreifen,
// beides = neutraler Block MIT Warnstreifen darüber (weder das eine noch das
// andere für sich). Farben aus den semantischen Tokens (keine Hex-Werte).
const SEG_STYLE: Record<SegStatus, string> = {
  open: "",
  booked: "bg-accent/85 text-white",
  blocked: "bg-foreground text-background",
  stop_sell: "stop-sell-stripes text-warning-foreground",
  blocked_stop_sell: "bg-foreground blocked-stop-sell-stripes text-background",
};

/** Zu welchen Zuständen gehört ein Stop-Sell? (Balken-Details, Kontextmenü) */
function hasStopSell(status: SegStatus): boolean {
  return status === "stop_sell" || status === "blocked_stop_sell";
}
/** Zu welchen Zuständen gehört eine availability-Sperre? */
function hasBlock(status: SegStatus): boolean {
  return status === "blocked" || status === "blocked_stop_sell";
}
// STATUS_LABEL aus t (Modul-Level-Konstante kann kein useTranslations nutzen) —
// Funktion erhält t als Parameter, aufgerufen innerhalb der Komponente.
function statusLabels(t: (key: string) => string): Record<SegStatus, string> {
  return {
    open: t("calendarBoard.status.open"),
    booked: t("calendarBoard.status.booked"),
    blocked: t("calendarBoard.status.blocked"),
    stop_sell: t("calendarBoard.status.stopSell"),
    blocked_stop_sell: t("calendarBoard.status.blockedAndStopSell"),
  };
}

function pad(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}
function key(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

// Einen [checkIn, checkOut)-Zeitraum in Worten MIT Monatsnamen ausgeben
// („1.–20. November 2026") — der Belegungsplan zeigt in den Spalten nur die
// Tageszahl, deshalb muss der Bulk-Dialog den Monat unmissverständlich nennen.
function spellDateRange(checkIn: string, checkOut: string): string {
  const fmt = new Intl.DateTimeFormat(undefined, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  const s = new Date(`${checkIn}T00:00:00Z`);
  const lastNight = new Date(`${checkOut}T00:00:00Z`);
  lastNight.setUTCDate(lastNight.getUTCDate() - 1); // checkOut ist exklusiv
  return `${fmt.format(s)} – ${fmt.format(lastNight)}`;
}
// Aus einem laufenden Bar-Drag den Ziel-Zeitraum (YYYY-MM-DD, end exklusiv)
// ableiten. Verschieben/Resize verändern check_in/out gemäß mode + dayOffset;
// min. 1 Nacht bleibt erhalten.
function barDragTarget(d: BarDrag): { ci: string; co: string; pid: string } {
  const ci0 = new Date(`${d.res.check_in}T00:00:00`);
  const co0 = new Date(`${d.res.check_out}T00:00:00`);
  if (d.mode === "move") {
    return {
      ci: key(addDays(ci0, d.dayOffset)),
      co: key(addDays(co0, d.dayOffset)),
      pid: d.targetPid,
    };
  }
  if (d.mode === "start") {
    // Check-in verschieben, aber nie auf/über Check-out.
    let ci = addDays(ci0, d.dayOffset);
    const lastNight = addDays(co0, -1);
    if (ci > lastNight) ci = lastNight;
    return { ci: key(ci), co: key(co0), pid: d.res.property_id };
  }
  // "end": Check-out verschieben, aber nie auf/vor Check-in (min. 1 Nacht).
  let co = addDays(co0, d.dayOffset);
  const firstCheckout = addDays(ci0, 1);
  if (co < firstCheckout) co = firstCheckout;
  return { ci: key(ci0), co: key(co), pid: d.res.property_id };
}

// Tagespreis fürs Raster. null (kein Rate-Plan) → „–" statt erfundener 0.
// Währung wird durchgereicht (kein €-Hardcode, 27 EU-Länder); ein leerer/ungültiger
// Code ergibt eine reine Zahl (kein falsches Symbol, kein Crash) — analog zu
// lib/currency.ts::formatCurrency. Centgenau wie Rate-Grid/Vorschau/Channex:
// EINE Zahl überall — ein gerundetes „119 €" neben „118,68 €" im Rate-Grid
// las sich als Fehler in der Preisführung.
function fmtPrice(price: number | null | undefined, currency: string | null | undefined, locale: string): string {
  if (price == null) return "–";
  const code = typeof currency === "string" ? currency.trim().toUpperCase() : "";
  const valid = /^[A-Z]{3}$/.test(code);
  return price.toLocaleString(locale, {
    ...(valid ? { style: "currency", currency: code } : {}),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// Tagespreis IM RASTER: nur die Zahl, ohne Währung und ohne Nachkommastellen.
// Eine Tagesspalte ist 5,5rem breit; „750,00 DKK" füllt sie fast vollständig und
// lässt die Zeile überladen wirken (dreistellige Beträge in Kronen/Forint sind
// der Normalfall, nicht die Ausnahme). Die Währung steht deshalb EINMAL an der
// Objektzeile statt 30-mal im Raster. Centbeträge behalten ihre Nachkommastellen
// nur dort, wo sie zählen (Tooltip, Rate-Grid, Vorschau) — im Überblicksraster
// ist der gerundete Betrag die Information. Kein Fallback-Wert: fehlt der Preis,
// bleibt es „–" (Wurzel 4).
function fmtPriceKompakt(price: number | null | undefined, locale: string): string {
  if (price == null) return "–";
  return price.toLocaleString(locale, { maximumFractionDigits: 0 });
}

type Segment = {
  start: number;
  span: number;
  status: SegStatus;
  source: AvailabilitySource;
  reservation?: Reservation; // verknüpfte Buchung (falls gefunden)
  stopSell?: StopSellDay; // Stop-Sell-Details (Grund/Adressat) bei status=stop_sell
};

// Rechtsklick-Kontextmenü auf einem Sperr-/Stop-Sell-Balken: Position am Cursor
// plus alles, was die Einträge zum Handeln brauchen. `stopSellSource` entscheidet
// über die Zulässigkeit von „Stop-Sell aufheben" — ein Portal-Stopp (channex)
// spiegelt den Stand BEIM PORTAL und darf hier nicht lokal weggewischt werden.
type BarMenu = {
  x: number;
  y: number;
  pid: string;
  title: string;
  start: string; // YYYY-MM-DD, inklusiv
  end: string; // YYYY-MM-DD, EXKLUSIV (wie blockRange/unblockRange)
  status: SegStatus;
  blockSource: AvailabilitySource;
  stopSellSource?: StopSellSource;
};

// Laufendes Verschieben/Resizen eines bestehenden Buchungsbalkens.
// mode: "move" = ganzer Balken (Tag- + Objektwechsel), "start"/"end" = Kante.
type BarDrag = {
  res: Reservation;
  mode: "move" | "start" | "end";
  startPid: string; // Objekt, in dem der Zug begann
  // Verschiebung in Tagen, gerundet aus dem Pixel-Delta zum Greifpunkt
  // (barDownPos in onMove) — greifpunkt-invariant, kein Kanten-Floor.
  dayOffset: number;
  targetPid: string; // aktuelles Ziel-Objekt (nur move)
};

// Debug: Herkunft einer Sperre/Buchung in Klartext — zeigt WELCHE Quelle den Tag
// gesperrt hat (availability-Quelle + Typ; bei Stop-Sell zusätzlich scope/Kanäle),
// damit sichtbar wird, welche Plattform die Sperre gesetzt hat.
function debugOrigin(seg: Segment): string {
  const typ =
    seg.status === "blocked"
      ? "SPERRE (availability.blocked)"
      : seg.status === "blocked_stop_sell"
        ? "SPERRE (availability.blocked) + STOP-SELL"
        : seg.status === "stop_sell"
          ? "STOP-SELL"
          : seg.status === "booked"
            ? "BUCHUNG"
            : "FREI";
  const parts = [typ, `Quelle: ${seg.source}`];
  if (hasStopSell(seg.status) && seg.stopSell) {
    const st = seg.stopSell;
    parts.push(`stop_sell.source: ${st.source}`);
    parts.push(`scope: ${st.scope ?? "all"}`);
    if (st.channels && st.channels.length > 0) {
      parts.push(`channels: ${st.channels.join(", ")}`);
    }
    if (st.reason) parts.push(`Grund: ${st.reason}`);
    if (st.agency_name) parts.push(`Adressat: ${st.agency_name}`);
  }
  return parts.join(" · ");
}

// Kanal-Logo eines Balkens (Iconify-Brand-Icon ODER lokales SVG).
// Aufeinanderfolgende Tage gleichen (nicht-offenen) Status+Quelle bündeln.
// resByDay ordnet jedem belegten Tag die zugehörige Buchung zu (für Gastname +
// Detail-Popover); ein Segmentwechsel erfolgt auch bei einem Buchungswechsel.
function toSegments(
  statusByDay: Record<string, AvailabilityStatus>,
  sourceByDay: Record<string, AvailabilitySource>,
  resByDay: Record<string, Reservation>,
  dates: Date[],
  stopSellByDay: Record<string, StopSellDay> = {},
): Segment[] {
  const segs: Segment[] = [];
  let cur: Segment | null = null;
  dates.forEach((d, i) => {
    const res = resByDay[key(d)];
    // EINE Wahrheit für „gebucht": ausschließlich `reservations` (inkrementell per
    // Realtime immer aktuell). Ein availability-`booked` OHNE zugehörige Buchung ist
    // ein GEISTERZUSTAND (z. B. eingefrorener availability-Rest nach einem Move, den
    // der Vollreload noch nicht überschrieben hat) → er darf KEINEN Buchungsbalken
    // erzeugen. Wir behandeln availability-`booked` ohne Buchung daher wie `open`.
    // `blocked`/`open` aus availability bleiben eigenständige Zustände; „gebucht"
    // kommt nur aus der Buchung. (Wurzel 1: der availability-Gegenzustand nach einem
    // Move ist nicht mehr die Quelle des Balkens → kein Split-Brain zweier Quellen.)
    const rawAvail = statusByDay[key(d)] ?? "open";
    const rawStatus: AvailabilityStatus = rawAvail === "booked" && !res ? "open" : rawAvail;
    // Stop-Sell: der Tag wird nicht verkauft — eigener Balken mit Grund/Adressat
    // statt nur „Gesperrt". Sperre und Stop-Sell sind ZWEI Achsen und liegen an
    // denselben Tagen oft BEIDE an (OTAs/Channex setzen häufig blocked +
    // stop_sell). Früher gewann der Stop-Sell die Anzeige und die Sperre darunter
    // war unsichtbar — beides sah gleich aus, und ein Nutzer hielt eine echte
    // Sperre für einen Stop-Sell. Jetzt bekommt die Überlagerung einen EIGENEN
    // Zustand mit eigener Darstellung; nur eine echte Buchung sticht beides.
    const stop = !res ? stopSellByDay[key(d)] : undefined;
    const s: SegStatus = res
      ? "booked"
      : stop
        ? rawStatus === "blocked"
          ? "blocked_stop_sell"
          : "stop_sell"
        : rawStatus;
    // Kanal eines gebuchten Tages kommt aus der BUCHUNG, nicht aus availability.
    // availability.source hat den Kanal nur für Tage, die auch geladen wurden —
    // eine Buchung, die vor dem sichtbaren Fenster beginnt, hat dort keine Zeile.
    // Früher sprang der Balken dann auf einen erfundenen Wert ("booking" bzw.
    // "manual") und eine Airbnb-Buchung erschien schwarz wie eine Handsperre
    // (Wurzel 4: kein Ersatzwert, wenn die Wahrheit vorliegt — res.channel).
    // Ein Stop-Sell-Tag trägt seine Herkunft in der stop_sell-Zeile selbst —
    // eine availability-Zeile muss dafür gar nicht existieren (Portal-Stops
    // haben oft keine). Der frühere Fallback behauptete dort "manual", also
    // eine Handsperre, die es nie gab (Wurzel 4), und zerriss den Balken
    // zusätzlich an der Chunk-Grenze in zwei Segmente mit verschiedener Quelle,
    // weil `toSegments` bei source-Wechsel splittet.
    const src: AvailabilitySource = res
      ? res.channel
      : (sourceByDay[key(d)] ??
        (stop?.source === "channex" ? "portal" : "manual"));
    if (s === "open") {
      cur = null;
      return;
    }
    // Stop-Sell-Segmente nur bündeln, wenn Grund + Adressat gleich bleiben
    // (sonst verschluckt ein Balken die Details des nächsten).
    const sameStop =
      !hasStopSell(s) ||
      (cur?.stopSell?.reason === stop?.reason &&
        cur?.stopSell?.agency_id === stop?.agency_id &&
        cur?.stopSell?.source === stop?.source);
    if (
      cur &&
      cur.status === s &&
      cur.source === src &&
      cur.reservation?.id === res?.id &&
      sameStop &&
      cur.start + cur.span === i
    ) {
      cur.span += 1;
    } else {
      cur = {
        start: i,
        span: 1,
        status: s,
        source: src,
        reservation: res,
        stopSell: stop,
      };
      segs.push(cur);
    }
  });
  return segs;
}

// Buchungen eines Objekts auf Tages-Keys abbilden: jeder Übernachtungstag
// [check_in, check_out) → Reservierung. So findet ein belegtes Segment seinen Gast.
// Tages-Keys der Nächte einer Buchung [check_in, check_out) — für den lokalen
// availability-Gegenzustand beim optimistischen Move (dieselbe Halb-offen-Logik
// wie reservationsByDay, nur die Keys statt der Buchung).
function nightKeys(checkIn: string, checkOut: string): string[] {
  const out: string[] = [];
  const co = new Date(`${checkOut}T00:00:00`);
  for (let d = new Date(`${checkIn}T00:00:00`); d < co; d = addDays(d, 1)) {
    out.push(key(d));
  }
  return out;
}

function reservationsByDay(reservations: Reservation[]): Record<string, Reservation> {
  const map: Record<string, Reservation> = {};
  for (const r of reservations) {
    if (r.status === "cancelled") continue;
    const ci = new Date(`${r.check_in}T00:00:00`);
    const co = new Date(`${r.check_out}T00:00:00`);
    for (let d = new Date(ci); d < co; d = addDays(d, 1)) {
      map[key(d)] = r;
    }
  }
  return map;
}

// ── Inkrementelle, ID-basierte State-Übergänge für resByProp (Record<pid, Res[]>).
// Reine Funktionen: alter State rein, neuer State raus — die einzige Wahrheit ist
// die Buchungs-`id`. Alle Operationen sind IDEMPOTENT (Wurzel 2: das eigene
// Realtime-Echo, ein Doppelklick oder eine Webhook-Redelivery desselben Events
// darf keinen Doppel-Zustand erzeugen). Genutzt vom Realtime-onEvent-Handler UND
// vom optimistischen Move — beide teilen sich dieselben Übergänge, damit das Echo
// des eigenen Moves exakt denselben Endzustand ergibt (kein Flackern).

type ResByProp = Record<string, Reservation[]>;

// Eine Buchung ohne Doppel in ein Objekt legen (erst per id herausfiltern, dann
// anhängen — idempotent gegen Mehrfach-Zustellung).
function upsertInto(list: Reservation[], r: Reservation): Reservation[] {
  return [...list.filter((x) => x.id !== r.id), r];
}

// Buchung mit dieser id aus ALLEN Objekten entfernen (Move/Storno/Delete).
function removeEverywhere(state: ResByProp, id: string): ResByProp {
  const next: ResByProp = {};
  for (const [pid, list] of Object.entries(state)) {
    const filtered = list.filter((r) => r.id !== id);
    if (filtered.length) next[pid] = filtered;
  }
  return next;
}

// Zentraler Übergang für eine (neue/aktualisierte/verschobene) Buchung. ATOMAR in
// EINEM Ergebnis-State: aus dem alten Objekt raus (falls property_id wechselte)
// UND ins Ziel-Objekt rein — nie zwei getrennte Updates (sonst Zwischen-Render mit
// der Buchung in beiden Zeilen). Stornierte Buchung → überall entfernen.
function applyReservation(state: ResByProp, r: Reservation): ResByProp {
  if (r.status === "cancelled") return removeEverywhere(state, r.id);
  // Erst überall per id entfernen (auch aus dem alten Objekt bei Objektwechsel),
  // dann genau einmal ins Ziel-Objekt legen — ein einziger neuer State.
  const cleaned = removeEverywhere(state, r.id);
  return {
    ...cleaned,
    [r.property_id]: upsertInto(cleaned[r.property_id] ?? [], r),
  };
}

// Menschliches Herkunfts-/Gastlabel für einen Buchungsbalken.
function segmentLabel(
  seg: Segment,
  t: (key: string) => string,
  channelLabel: (s: AvailabilitySource) => string,
): string {
  if (hasStopSell(seg.status)) {
    // Adressat sichtbar machen: Reisebüro-Name (z. B. TUI), sonst Reichweite.
    //
    // Der Stopp gilt IMMER für alle Kanäle — die Vorgabe kommt von uns, die
    // Portale führen sie nur aus. `source='channex'` heißt nicht „das Portal
    // wollte das", sondern nur, dass der Import diese Zeile aus dem Feed
    // zurückgeschrieben hat (`bookings_sync.py:1991`). Das frühere Label „OTA"
    // behauptete eine fremde Entscheidung und war der Grund, warum das
    // Aufheben gesperrt schien.
    const who =
      seg.stopSell?.agency_name || t("calendarBoard.stopSellAllChannels");
    // Liegt zusätzlich eine Sperre darauf, führt das Label mit BEIDEM — sonst
    // liest sich der Balken wie ein reiner Stop-Sell (Tag wäre noch verfügbar).
    return [statusLabels(t)[seg.status], who, seg.stopSell?.reason]
      .filter(Boolean)
      .join(" · ");
  }
  if (seg.status !== "booked") return statusLabels(t)[seg.status];
  const guest = seg.reservation?.guest_name?.trim();
  // Eigentümer-Aufenthalt: ohne Namen NICHT auf den Kanal zurückfallen — das
  // liest sich sonst wie eine Portalbuchung, obwohl gar keine dahintersteht.
  if (seg.reservation?.is_owner_stay) {
    return guest || t("calendarBoard.ownerStay");
  }
  return guest || channelLabelLoose(seg.reservation?.ota_name) || channelLabel(seg.source);
}

export function CalendarBoard({
  properties,
  viewSwitcher,
  accommodationType,
}: {
  properties: Prop[];
  // Ansicht-Dropdown (Timeline/Buchungen/…), wird in die Kopfzeile links neben
  // den Titel gereicht, damit alles in einer Zeile steht.
  viewSwitcher?: ReactNode;
  // Betriebsart (0090): steuert die Typ-Filter-Liste (Zimmertypen vs.
  // Ferienobjekt-Typen).
  accommodationType?: "vacation_rental" | "hotel" | null;
}) {
  const t = useTranslations("calendar");
  const locale = useLocale();
  const { typeOptionsFor } = usePropertyLabels();
  const { channelLabel, statusLabel } = useCalendarLabels();
  // Startdatum (rollierend). null bis der Client das heutige Datum kennt.
  const [start, setStart] = useState<Date | null>(null);
  const [todayKey, setTodayKey] = useState("");
  const [avail, setAvail] = useState<Record<string, Record<string, AvailabilityStatus>>>({});
  const [sources, setSources] = useState<Record<string, Record<string, AvailabilitySource>>>({});
  // Tagespreis + Min-Stay je Objekt/Tag (aus get_availability) für die Anzeige.
  const [prices, setPrices] = useState<Record<string, Record<string, number | null>>>({});
  // Objekt-Währung je property_id (aus dem Board/Rate-Plan) für die Tagespreise.
  const [currencyByProp, setCurrencyByProp] = useState<Record<string, string | null>>({});
  const [priceSources, setPriceSources] = useState<Record<string, Record<string, string>>>({});
  const [priceFactors, setPriceFactors] = useState<Record<string, Record<string, Record<string, number>>>>({});
  const [minStays, setMinStays] = useState<Record<string, Record<string, number | null>>>({});
  // CTA/CTD je Objekt × Tag: [arrivalGesperrt, departureGesperrt].
  const [restrictions, setRestrictions] = useState<
    Record<string, Record<string, [boolean, boolean]>>
  >({});
  // Stop-Sells je Objekt × Tag (stop_sell mit Grund/Adressat) — eigener
  // Balken-Typ, damit „Stop-Sell · TUI · Grund" sichtbar ist statt nur „Gesperrt".
  const [stopSell, setStopSell] = useState<
    Record<string, Record<string, StopSellDay>>
  >({});
  // Buchungen je Objekt → Tages-Map (Gastname im Balken + Detail-Popover).
  // Buchungen pro Objekt als ID-basierte LISTE (nicht Tag-Map): Realtime pflegt
  // sie inkrementell per id (UPDATE ersetzt, INSERT hängt an, DELETE filtert,
  // MOVE entfernt+fügt atomar ein). Die Tag→Buchung-Map für das Segment-Rendering
  // wird beim Rendern pro Objekt aus dieser Liste abgeleitet (reservationsByDay).
  const [resByProp, setResByProp] = useState<Record<string, Reservation[]>>({});
  // Aktuell geöffnetes Buchungsdetail (per Klick auf einen Balken).
  // Geöffnetes Buchungsdetail: nur die Reservierungs-ID (Slider lädt die Daten).
  const [detail, setDetail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  // Ladefehler des Belegungs-Boards (z. B. 403) sichtbar machen statt still
  // leere Tage zu rendern (Wurzel 5).
  const [boardError, setBoardError] = useState<string | null>(null);
  const [view, setView] = useState<ViewOptions>(DEFAULT_VIEW);
  // Horizontaler Scroll-Container des Rasters — Navigation (◀/▶/Heute/Sprung)
  // scrollt ihn, statt das Startdatum zu verschieben (durchgehende Timeline).
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // --- Auto-Scroll am Rand während eines Zugs ------------------------------
  // Zieht der Nutzer eine Auswahl (oder einen Balken) bis an den rechten Rand,
  // muss die Timeline mitlaufen. Ohne das endet jede neue Buchung dort, wo der
  // sichtbare Ausschnitt endet — bei Monatsansicht nach ~4 Tagen, und man muss
  // loslassen, scrollen, neu ansetzen.
  //
  // Der Zug darf NICHT an `onMouseEnter` der Zellen hängen: am Rand gibt es
  // keine nächste Zelle, die feuern könnte, und während des reinen Scrollens
  // (Cursor steht still) feuert ohnehin kein Maus-Event. Deshalb läuft hier ein
  // rAF-Loop, der aus der zuletzt bekannten Cursor-Position + dem aktuellen
  // scrollLeft die Zielspalte GEOMETRISCH bestimmt — dieselbe Rechnung wie der
  // Balken-Zug, nur für die Zell-Auswahl.
  const cursorRef = useRef<{ x: number; y: number } | null>(null);
  // scrollLeft beim Greifen. Der Balken-Zug misst sein dayOffset als Pixel-Delta
  // zum Greifpunkt; scrollt der Container darunter weg, ist der Bildschirm-Delta
  // allein falsch. Die seither gescrollte Strecke gehört additiv dazu.
  const dragScrollLeft = useRef(0);

  // Rand-Zone und Tempo. Bewusst konservativ: die Zone ist schmal genug, dass
  // man am Rand noch normal zielen kann, und das Tempo skaliert mit der
  // Eindringtiefe, damit ein knapper Rand-Kontakt nicht sofort wegrast.
  const EDGE = 4.5; // rem Randzone, in der Auto-Scroll greift
  const EDGE_SPEED = 22; // px pro Frame bei voller Eindringtiefe
  // Filter & Suche (Paket 4b). Leerer Filter = alles sichtbar.
  const [query, setQuery] = useState("");
  const [channelFilter, setChannelFilter] = useState<AvailabilitySource | "all">("all");
  const [statusFilter, setStatusFilter] = useState<DisplayStatus | "all">("all");
  const [typeFilter, setTypeFilter] = useState<PropertyType | "all">("all");

  // Interaktion: Anfangstag drücken → bis Endtag ziehen → loslassen.
  // `drag` ist nur die Vorschau WÄHREND des Ziehens; `sel` wird ERST beim
  // Loslassen gesetzt und löst dann die Bestätigungsleiste aus.
  const [drag, setDrag] = useState<{ pid: string; from: number; to: number } | null>(null);
  const [sel, setSel] = useState<{ pid: string; from: number; to: number } | null>(null);
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null);
  // Reservierungs-Assistent: Zeitraum (YYYY-MM-DD) + Objekt, wenn offen.
  // ownerStay: der Assistent startet dann mit vorbelegter Art „Eigennutzung".
  const [wizard, setWizard] = useState<{
    pid: string;
    checkIn: string;
    checkOut: string;
    ownerStay?: boolean;
  } | null>(null);
  // Bulk-Edit-Dialog: Objekt + Zeitraum der aufgezogenen Selektion.
  const [bulk, setBulk] = useState<{ pid: string; checkIn: string; checkOut: string } | null>(null);
  // Hotel: Preispläne des Objekts, für das der Bulk-Dialog offen ist — damit eine
  // Restriktions-Zeile gezielt EINEN Plan treffen kann (Twin/BAR ≠ Double/B&B)
  // statt an allen Plänen gespiegelt zu werden. FeWo: bleibt leer.
  const [bulkPlans, setBulkPlans] = useState<
    { id: string; label: string; propertyId?: string }[]
  >([]);
  // Die Preispläne laden, sobald der Bulk-Dialog aufgeht. Hotel: die Pläne ALLER
  // Zimmer (mit Zimmer-Präfix + propertyId) — eine Bulk-Aktion kann Zeilen über
  // mehrere Zimmer haben, die als EIN Portale-Call gesendet werden (Zert-Tests
  // 3-8; die Zimmer teilen sich eine Channex-Property). FeWo: nur das eine
  // Objekt. Nur bei mehr als einem Plan sinnvoll (ein Plan = keine Auswahl).
  useEffect(() => {
    if (!bulk) {
      setBulkPlans([]);
      return;
    }
    let cancelled = false;
    const from = bulk.checkIn;
    const to = key(addDays(new Date(`${bulk.checkIn}T00:00:00`), 1));
    const targets =
      accommodationType === "hotel"
        ? properties.map((p) => ({ id: p.id, title: p.title }))
        : [{ id: bulk.pid, title: "" }];
    void Promise.all(
      targets.map(async (t) => {
        const res = await getRateGrid(t.id, from, to);
        if (!res.ok) return [];
        return res.data.plans.map((p) => ({
          id: p.id,
          label: targets.length > 1 ? `${t.title} · ${p.name}` : p.name,
          propertyId: t.id,
        }));
      }),
    ).then((lists) => {
      if (cancelled) return;
      const plans = lists.flat();
      setBulkPlans(plans.length > 1 ? plans : []);
    });
    return () => {
      cancelled = true;
    };
  }, [bulk, accommodationType, properties]);

  // Sperre-aufheben-Popup: geklickter Sperr-Balken (Objekt + Zeitraum, end exkl.).
  const [unblockAt, setUnblockAt] = useState<
    { pid: string; title: string; start: string; end: string } | null
  >(null);
  const [saving, setSaving] = useState(false);

  // Stop-Sell aus dem Belegungsplan heraus: dasselbe Panel wie im Stop-Sell-
  // Kalender (EINE Wahrheit — keine zweite Kopie der Stop-Sell-Logik), nur mit
  // vorbelegtem Objekt + Zeitraum und als Overlay von rechts.
  const [stopSellSel, setStopSellSel] = useState<StopSellSelection | null>(null);
  // Reisebüros/Veranstalter für die Adressaten-Auswahl im Panel. Erst geladen,
  // wenn das Panel wirklich aufgeht (der Belegungsplan braucht sie sonst nie).
  const [agencies, setAgencies] = useState<AgencyOption[]>([]);
  useEffect(() => {
    if (!stopSellSel) return;
    let cancelled = false;
    void listAgencies().then((res) => {
      // Fehler hier NICHT verschlucken (Wurzel 5): ohne Partnerliste ist der
      // Stop-Sell trotzdem setzbar (Adressat „alle"), aber der Nutzer soll
      // sehen, dass die Auswahl fehlt statt ein leeres Select zu deuten.
      if (cancelled) return;
      if (res.ok) setAgencies(res.data.items.map((a) => ({ id: a.id, name: a.name })));
      else toast.error(res.error);
    });
    return () => {
      cancelled = true;
    };
  }, [stopSellSel]);

  // Rechtsklick-Kontextmenü auf einem Balken (Sperre/Stop-Sell aufheben).
  const [barMenu, setBarMenu] = useState<BarMenu | null>(null);

  // Balken-Interaktion: bestehende Buchung verschieben (move) ODER an den
  // Kanten resizen (Check-in/out). `barDrag` hält den laufenden Zug; `dayOffset`
  // bzw. `rowOffset` werden während der Mausbewegung über den Listener gesetzt.
  const [barDrag, setBarDrag] = useState<BarDrag | null>(null);
  const barDragRef = useRef<BarDrag | null>(null);
  barDragRef.current = barDrag;
  // Maus-Startposition beim Balken-mousedown + ob seither nennenswert bewegt
  // wurde. So unterscheiden wir einen reinen KLICK (→ Detail-Slider öffnen) von
  // einem echten DRAG (→ verschieben/resizen). Ohne das schluckt der sofort
  // gesetzte barDrag den onClick und der Slider ging nie auf.
  const barDownPos = useRef<{ x: number; y: number } | null>(null);
  const barMoved = useRef(false);
  // Ref auf den Tagesbereich (Zeilen-Container) für die Geometrie-Berechnung
  // beim Ziehen — robuster als onMouseEnter (unabhängig von überdeckenden Balken).
  const gridRef = useRef<HTMLDivElement | null>(null);

  // Ausstehende Verschiebung/Resize, die der Nutzer ERST bestätigen muss
  // (Schutz vor versehentlichem Verschieben per Drag).
  const [pendingMove, setPendingMove] = useState<{
    res: Reservation;
    mode: BarDrag["mode"];
    targetPid: string;
    ci: string;
    co: string;
  } | null>(null);

  // Drag-Ende: keine echte Änderung → verwerfen; sonst Bestätigung anfordern.
  const commitBarDrag = useCallback(
    (d: BarDrag, targetPid: string, ci: string, co: string) => {
      if (targetPid === d.res.property_id && ci === d.res.check_in && co === d.res.check_out) {
        return;
      }
      setPendingMove({ res: d.res, mode: d.mode, targetPid, ci, co });
    },
    [],
  );

  // Bestätigte Verschiebung: OPTIMISTISCH + reines Realtime (kein manuelles Reload).
  // Ablauf (Notion-Muster):
  //   1) Move SOFORT lokal anwenden (applyReservation, atomar: raus aus altem Objekt,
  //      rein ins neue) → der Balken springt ohne Latenz. Snapshot vorher sichern.
  //   2) Server-PATCH im Hintergrund.
  //   3a) Erfolg: nichts weiter tun — das reservations-Realtime-Event wendet DENSELBEN
  //       idempotenten applyReservation mit der echten Server-Zeile an (gleiche id →
  //       ersetzt, kein Doppel, kein Flackern).
  //   3b) Fehler (z. B. 409 Konflikt): auf den Snapshot zurückrollen und Grund melden.
  // reprice=true → Upsell (Preis fürs Zielobjekt neu berechnen); sonst Preis
  // behalten (kostenloses Upgrade / bindender Preis, protel-Modell).
  const confirmMove = useCallback(async (reprice?: boolean) => {
    const m = pendingMove;
    if (!m) return;
    setPendingMove(null);
    setSaving(true);
    // Optimistische Ziel-Buchung: dieselbe id/Buchung, nur Objekt+Zeitraum neu.
    const optimistic: Reservation = {
      ...m.res,
      property_id: m.targetPid,
      check_in: m.ci,
      check_out: m.co,
    };
    // Optimistisch ALLE betroffenen Records atomar mitpflegen (Notion-Muster):
    // die Buchung selbst UND den availability-Gegenzustand (Wurzel 1). Snapshots
    // für Rollback bei Server-Ablehnung.
    let snapResByProp: Record<string, Reservation[]> | null = null;
    let snapAvail: Record<string, Record<string, AvailabilityStatus>> | null = null;
    let snapSources: Record<string, Record<string, AvailabilitySource>> | null = null;
    setResByProp((prev) => {
      snapResByProp = prev;
      return applyReservation(prev, optimistic);
    });
    // Gegenzustand: ALTE Nächte (Quell-Objekt) freigeben, NEUE Nächte (Ziel-Objekt)
    // belegen — in-memory, damit der Balken sofort in genau einer Zeile steht.
    const oldNights = nightKeys(m.res.check_in, m.res.check_out);
    const newNights = nightKeys(m.ci, m.co);
    setAvail((prev) => {
      snapAvail = prev;
      const next = { ...prev };
      const src = { ...(next[m.res.property_id] ?? {}) };
      for (const dk of oldNights) src[dk] = "open";
      next[m.res.property_id] = src;
      const dst = { ...(next[m.targetPid] ?? {}) };
      for (const dk of newNights) dst[dk] = "booked";
      next[m.targetPid] = dst;
      return next;
    });
    setSources((prev) => {
      snapSources = prev;
      const next = { ...prev };
      const dst = { ...(next[m.targetPid] ?? {}) };
      for (const dk of newNights) dst[dk] = m.res.channel as AvailabilitySource;
      next[m.targetPid] = dst;
      return next;
    });
    try {
      const res = await moveReservation(m.res.id, m.targetPid, m.ci, m.co, reprice);
      if (res.ok) {
        toast.success(
          reprice ? "Verschoben & Preis neu berechnet." : "Reservierung verschoben.",
        );
        // Kein Reload: die Realtime-Events (reservations + availability) bestätigen/
        // korrigieren den Stand idempotent mit den echten Server-Zeilen.
      } else {
        // Server lehnt ab → ALLE optimistischen Änderungen zurücknehmen.
        if (snapResByProp) setResByProp(snapResByProp);
        if (snapAvail) setAvail(snapAvail);
        if (snapSources) setSources(snapSources);
        toast.error(res.error || t("board.moveFailed"));
      }
    } catch (err) {
      if (snapResByProp) setResByProp(snapResByProp);
      if (snapAvail) setAvail(snapAvail);
      if (snapSources) setSources(snapSources);
      toast.error(t("board.moveFailed"));
      throw err;
    } finally {
      setSaving(false);
    }
  }, [pendingMove, t]);

  // Hervorhebung: während des Ziehens die Vorschau, sonst die fertige Auswahl.
  const isSelected = useCallback(
    (pid: string, di: number) => {
      const active = drag ?? sel;
      if (!active || active.pid !== pid) return false;
      const lo = Math.min(active.from, active.to);
      const hi = Math.max(active.from, active.to);
      return di >= lo && di <= hi;
    },
    [drag, sel],
  );

  const onCellDown = useCallback(
    (pid: string, di: number, ev: React.MouseEvent) => {
      // Native Text-Selektion beim Aufziehen einer Zell-Auswahl unterbinden.
      ev.preventDefault();
      // Neuer Zug startet: alte Auswahl/Leiste verwerfen.
      setSel(null);
      // Bezugspunkte für den Auto-Scroll am Rand: ohne die erste Cursor-Position
      // liefe der rAF-Loop bis zum ersten mousemove blind.
      cursorRef.current = { x: ev.clientX, y: ev.clientY };
      dragScrollLeft.current = scrollRef.current?.scrollLeft ?? 0;
      setDrag({ pid, from: di, to: di });
    },
    [],
  );

  const onCellEnter = useCallback(
    (pid: string, di: number) => {
      // NUR die Zell-Auswahl (Sperren/Preise) pflegt hier ihre Endzelle. Der
      // Balken-Zug (barDrag) wird AUSSCHLIESSLICH im window-mousemove-Handler
      // fortgeschrieben (gerundetes Pixel-Delta) — kein zweiter, kanten-
      // quantisierter Schreibpfad, der sich damit überschreibt.
      setDrag((cur) => (cur && cur.pid === pid ? { ...cur, to: di } : cur));
    },
    [],
  );

  // Balken-Zug starten (auf einem belegten Buchungsbalken). mode unterscheidet
  // Verschieben vs. Resizen an den Kanten. `startDi` wird NICHT vom Aufrufer
  // (Segment-Geometrie) übergeben, sondern hier aus der Cursor-Position gemessen
  // — genau wie in onMove. Nur so ist `dayOffset = di_jetzt − startDi` ein reines
  // Cursor-Delta (greifpunkt-invariant): rein vertikales Ziehen ⇒ dayOffset 0,
  // der Balken springt nicht mehr um den Halbtags-Überhang.
  const onBarDown = useCallback(
    (
      res: Reservation,
      pid: string,
      mode: BarDrag["mode"],
      ev: React.MouseEvent,
    ) => {
      // Native Text-Selektion beim Ziehen unterbinden — sonst markiert der
      // Browser den Balken-/Zellentext (blaue Auswahl) und der Drag „bugt rum".
      ev.preventDefault();
      setSel(null);
      setDrag(null);
      // Klick-vs-Drag-Erkennung + Greif-Referenz für das Pixel-Delta in onMove:
      // die Cursor-Startposition ist der einzige Bezugspunkt, aus dem der
      // Tag-Offset gerundet wird (greifpunkt-invariant, kein Kanten-Floor).
      barDownPos.current = { x: ev.clientX, y: ev.clientY };
      barMoved.current = false;
      // Bezugspunkte für den Auto-Scroll am Rand (siehe dort).
      cursorRef.current = { x: ev.clientX, y: ev.clientY };
      dragScrollLeft.current = scrollRef.current?.scrollLeft ?? 0;
      setBarDrag({
        res,
        mode,
        startPid: pid,
        dayOffset: 0,
        targetPid: pid,
      });
    },
    [],
  );

  // Während eines Balken-Zugs die Mausposition global tracken und daraus —
  // rein geometrisch — Tag-Spalte + Ziel-Objektzeile bestimmen. Robuster als
  // onMouseEnter der Zellen (das von überdeckenden Balken verschluckt würde).
  const shownRef = useRef<Prop[]>([]);
  useEffect(() => {
    if (!barDrag) return;
    const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const colPx = COL * remPx;
    const onMove = (e: MouseEvent) => {
      const grid = gridRef.current;
      const bd = barDragRef.current;
      const down = barDownPos.current;
      // fail-closed (Wurzel 5): fehlt die Greif-Referenz, keine Verschiebung
      // raten — bei 0 bleiben, bis wieder ein sauberer Bezug da ist.
      if (!grid || !bd || !down) return;
      // Ab ~4px Bewegung gilt es als echtes Ziehen (nicht mehr als Klick).
      if (Math.abs(e.clientX - down.x) > 4 || Math.abs(e.clientY - down.y) > 4) {
        barMoved.current = true;
      }
      // Tag-Offset aus dem KONTINUIERLICHEN Pixel-Delta zum Greifpunkt runden —
      // NICHT aus der Differenz zweier kanten-gefloorter Tag-Indizes. Die Balken
      // liegen halbtags versetzt über den Spaltenkanten; ihre Greifpunkte
      // (Mitte/Enden) fallen exakt auf eine Kante, wo Math.floor pro Pixel kippt
      // (der „halbe Tag"). Math.round auf dem Delta ist greifpunkt-invariant:
      // bei 0 Drift bleibt der Offset 0, erst ab ~½ Spalte kippt der Tag.
      // Die seit dem Greifen gescrollte Strecke gehört zum Delta: scrollt der
      // Auto-Scroll das Raster unter dem Cursor weg, ist der Bildschirm-Anteil
      // allein zu klein und der Balken bliebe beim Rand-Ziehen stehen.
      const gescrollt = (scrollRef.current?.scrollLeft ?? 0) - dragScrollLeft.current;
      let dayOffset = Math.round((e.clientX - down.x + gescrollt) / colPx);
      // Steht der Cursor über der linken (sticky) LABEL-Spalte, verdeckt diese
      // die Tagesspalten → der X-Anteil wäre unsinnig (weggescrollte/negative
      // Spalten). Dann X einfrieren (letzten Offset behalten), nur die Zielzeile
      // weiter aktualisieren.
      const scroll = scrollRef.current;
      if (scroll) {
        const sr = scroll.getBoundingClientRect();
        if (e.clientX < sr.left + LABEL * remPx) dayOffset = bd.dayOffset;
      }
      // Ziel-Objektzeile per DOM-Treffer bestimmen, NICHT über eine konstante
      // Zeilenhöhe: die reale Zeilenhöhe schwankt (PropertyLabel mit Bild/mehreren
      // Textzeilen ist höher als ROW_H). Jede Zeile trägt data-row-pid;
      // elementFromPoint findet die echte Zeile unabhängig von ihrer Höhe.
      const hit = document.elementFromPoint(e.clientX, e.clientY);
      const rowEl = hit?.closest<HTMLElement>("[data-row-pid]");
      const overPid = rowEl?.dataset.rowPid ?? bd.startPid;
      setBarDrag((cur) =>
        cur
          ? {
            ...cur,
            dayOffset,
            targetPid: cur.mode === "move" ? overPid : cur.res.property_id,
          }
          : cur,
      );
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [barDrag]);

  // Maus loslassen beendet das Ziehen. Ein laufender BALKEN-Zug (move/resize)
  // hat Vorrang und wird an den Server geschickt; sonst Vorschau→Auswahl und
  // das Aktionsmenü am Cursor (Block/Reservierung).
  useEffect(() => {
    const up = (e: MouseEvent) => {
      const bd = barDragRef.current;
      if (bd) {
        setBarDrag(null);
        // Reiner Klick (keine nennenswerte Bewegung) → Buchungsdetail öffnen,
        // NICHT als Null-Verschiebung an den Server schicken.
        if (!barMoved.current) {
          barDownPos.current = null;
          setDetail(bd.res.id);
          return;
        }
        barDownPos.current = null;
        const { ci, co, pid } = barDragTarget(bd);
        void commitBarDrag(bd, pid, ci, co);
        return;
      }
      setDrag((cur) => {
        if (cur) {
          setSel(cur);
          setMenuAt({ x: e.clientX, y: e.clientY });
        }
        return null;
      });
    };
    window.addEventListener("mouseup", up);
    return () => window.removeEventListener("mouseup", up);
  }, [commitBarDrag]);

  useEffect(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    // Durchgehende Timeline: Raster beginnt am 1. Januar des laufenden Jahres
    // (Anker des Index-0-Tages). Navigiert wird durch Scrollen, nicht durch
    // Verschieben von `start`.
    setStart(rangeStart(now));
    setTodayKey(key(now));
  }, []);

  // Gesamtzahl der Tage im Bereich (1. Jan laufendes Jahr .. 31. Dez Folgejahr).
  // Hängt vom heutigen Datum ab → aus `start` abgeleitet (nach Mount gesetzt).
  const totalDays = useMemo(
    () => (start ? daysBetween(start, rangeEnd(start)) + 1 : 0),
    [start],
  );
  // Volles Datums-Array über den ganzen Scroll-Bereich. Nur Date-Objekte →
  // billig; gerendert wird daraus ein virtualisiertes Sub-Fenster.
  const dates = useMemo(
    () => (start ? Array.from({ length: totalDays }, (_, i) => addDays(start, i)) : []),
    [start, totalDays],
  );
  // Index des heutigen Tages im dates-Array (Tage vom 1. Jan bis heute).
  const todayIndex = useMemo(() => {
    if (!start || !todayKey) return 0;
    return daysBetween(start, new Date(`${todayKey}T00:00:00`));
  }, [start, todayKey]);
  // Einmaliger Auto-Scroll auf „heute" beim ersten Aufbau; Ref-Flag verhindert
  // Zurückspringen bei späteren Realtime-Reloads.
  const didInitialScroll = useRef(false);

  useEffect(() => {
    // Nur während eines echten Zugs. `drag` = Zell-Auswahl, `barDrag` = Balken.
    if (!drag && !barDrag) return;
    const el = scrollRef.current;
    if (!el) return;
    const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    const colPx = COL * remPx;
    const edgePx = EDGE * remPx;
    let raf = 0;

    const frame = () => {
      raf = requestAnimationFrame(frame);
      const cur = cursorRef.current;
      if (!cur) return;
      const r = el.getBoundingClientRect();
      // Die linke Objektspalte liegt sticky ÜBER dem Raster — die Randzone
      // beginnt erst rechts davon, sonst scrollt es schon beim Überfahren der
      // Objektnamen zurück.
      const innerLeft = r.left + LABEL * remPx;
      // Nur scrollen, solange der Cursor ÜBER dem Raster steht. Wandert er
      // darüber hinaus (auf die Objektspalte links, aus dem Fenster rechts,
      // oder vertikal aus dem Board), ist die Rand-Nähe kein Zielsignal mehr:
      // ohne diese Schranke rast die Timeline zurück, sobald man die Maus über
      // die Objektnamen zieht — dort ist der Abstand zu `innerLeft` maximal.
      const imRaster =
        cur.x >= innerLeft && cur.x <= r.right && cur.y >= r.top && cur.y <= r.bottom;
      let dx = 0;
      if (imRaster) {
        if (cur.x > r.right - edgePx) {
          dx = Math.min(1, (cur.x - (r.right - edgePx)) / edgePx) * EDGE_SPEED;
        } else if (cur.x < innerLeft + edgePx) {
          dx = -Math.min(1, (innerLeft + edgePx - cur.x) / edgePx) * EDGE_SPEED;
        }
      }
      if (dx === 0) return;
      const vorher = el.scrollLeft;
      el.scrollLeft = vorher + dx;
      // Am Anschlag (Anfang/Ende der Timeline) passiert nichts mehr — dann auch
      // die Auswahl nicht weiterzählen, sonst wüchse sie ins Leere.
      if (el.scrollLeft === vorher) return;

      // Zell-Auswahl geometrisch nachziehen: Spalte unter dem Cursor aus
      // scrollLeft + Cursor-X. Dieselbe Rechnung wie beim Rendern der Spalten.
      setDrag((d) => {
        if (!d) return d;
        const x = el.scrollLeft + (cur.x - innerLeft);
        const di = Math.floor(x / colPx);
        const clamped = Math.max(0, Math.min(dates.length - 1, di));
        return clamped === d.to ? d : { ...d, to: clamped };
      });
      // Balken-Zug: sein dayOffset ist ein Pixel-Delta zum Greifpunkt. Der
      // window-mousemove rechnet nur den Bildschirm-Anteil; die gescrollte
      // Strecke kommt hier dazu, sonst bleibt der Balken beim Scrollen stehen.
      setBarDrag((b) => {
        const down = barDownPos.current;
        if (!b || !down) return b;
        const gescrollt = el.scrollLeft - dragScrollLeft.current;
        const offset = Math.round((cur.x - down.x + gescrollt) / colPx);
        return offset === b.dayOffset ? b : { ...b, dayOffset: offset };
      });
    };

    const onMove = (e: MouseEvent) => {
      cursorRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener("mousemove", onMove);
    raf = requestAnimationFrame(frame);
    return () => {
      window.removeEventListener("mousemove", onMove);
      cancelAnimationFrame(raf);
    };
  }, [drag, barDrag, dates.length]);

  // rem→px (Spaltenbreite in px = COL * rem).
  const remPx = useCallback(
    () => parseFloat(getComputedStyle(document.documentElement).fontSize) || 16,
    [],
  );
  // Container so scrollen, dass Tagesspalte `di` direkt rechts der (sticky)
  // Objektspalte erscheint, geklemmt auf den Gesamtbereich.
  const scrollToIndex = useCallback(
    (di: number, behavior: ScrollBehavior = "smooth") => {
      const el = scrollRef.current;
      if (!el) return;
      el.scrollTo({ left: Math.max(0, di * COL * remPx()), behavior });
    },
    [remPx],
  );
  const currentLeftIndex = useCallback((): number => {
    const el = scrollRef.current;
    if (!el) return todayIndex;
    return Math.round(el.scrollLeft / (COL * remPx()));
  }, [remPx, todayIndex]);

  // --- Virtualisierung: nur das sichtbare Index-Fenster (+Overscan) rendern ---
  // scrollLeft + clientWidth → [visFrom, visTo). Per rAF gedrosselt.
  // Initiales Fenster (wird vom recomputeWindow-/Auto-Scroll-Effect sofort auf
  // den heutigen Bereich korrigiert, sobald Breite + start feststehen).
  const [visFrom, setVisFrom] = useState(0);
  const [visTo, setVisTo] = useState(60 + OVERSCAN);
  // Der linkeste WIRKLICH sichtbare Spaltenindex (ohne OVERSCAN-Puffer) — Quelle
  // für Titelmonat und Date-Picker, direkt aus scrollLeft. Getrennt von visFrom,
  // das den Overscan-Rand enthält.
  const [leftIndex, setLeftIndex] = useState(0);
  const recomputeWindow = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const colPx = COL * remPx();
    const leftmost = Math.round(el.scrollLeft / colPx);
    const from = Math.max(0, leftmost - OVERSCAN);
    const visibleCols = Math.ceil(el.clientWidth / colPx);
    const to = Math.min(totalDays, from + visibleCols + OVERSCAN * 2);
    setLeftIndex(Math.max(0, Math.min(totalDays - 1, leftmost)));
    setVisFrom(from);
    setVisTo(to);
  }, [remPx, totalDays]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let raf = 0;
    // Der Container scrollt jetzt beide Achsen; das Spaltenfenster hängt aber
    // nur an scrollLeft — vertikales Scrollen darf nichts neu berechnen.
    let lastLeft = el.scrollLeft;
    const onScroll = () => {
      if (el.scrollLeft === lastLeft) return;
      lastLeft = el.scrollLeft;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        recomputeWindow();
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    // Einmal initial berechnen (Breite steht erst nach Mount fest).
    recomputeWindow();
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [recomputeWindow]);

  // Objekt-Filter: Freitext (Titel/Adresse/Stadt/Gastname) + Objekttyp. Ein
  // Objekt bleibt sichtbar, wenn es selbst passt ODER eine seiner Buchungen
  // den Suchtext im Gastnamen trägt.
  const q = query.trim().toLowerCase();
  const shown = useMemo(() => {
    return properties.filter((p) => {
      if (typeFilter !== "all" && p.type !== typeFilter) return false;
      if (!q) return true;
      const inProp =
        p.title.toLowerCase().includes(q) ||
        p.address.toLowerCase().includes(q) ||
        p.city.toLowerCase().includes(q);
      if (inProp) return true;
      const guests = resByProp[p.id] ?? [];
      return guests.some((r) => r.guest_name?.toLowerCase().includes(q));
    });
  }, [properties, typeFilter, q, resByProp]);
  // Aktuelle sichtbare Objektliste für den Drag-Geometrie-Effect bereitstellen.
  shownRef.current = shown;

  // Sichtbarkeit eines Segments unter Kanal-/Status-Filter (gefilterte Balken
  // werden gedimmt statt entfernt, damit Belegung erkennbar bleibt).
  const segMatchesFilters = useCallback(
    (seg: Segment): boolean => {
      if (channelFilter !== "all" && seg.source !== channelFilter) return false;
      if (statusFilter !== "all") {
        if (!seg.reservation) return false;
        if (reservationStatus(seg.reservation, todayKey) !== statusFilter) return false;
      }
      return true;
    },
    [channelFilter, statusFilter, todayKey],
  );
  const filtersActive = channelFilter !== "all" || statusFilter !== "all";

  // Kennzahlenleiste (sichtbarer Zeitraum × sichtbare Objekte):
  //  - Belegung %: gebuchte Objekt-Tage / (Objekte × Tage)
  //  - Umsatz/ADR: nur aus Buchungen mit sichtbarem Betrag (maskierungskonform;
  //    total_amount === null = keine Berechtigung → fließt NICHT ein)
  const metrics = useMemo(() => {
    if (!start || shown.length === 0 || dates.length === 0) {
      return { occupancy: 0, bookedNights: 0, totalNights: 0, revenue: 0, adr: null as number | null, amountsHidden: false, currency: null as string | null };
    }
    // Nur das SICHTBARE Fenster: ab der linken sichtbaren Spalte über die
    // gewählte Granularität (view.rangeDays). „Belegung 80 %" gilt damit für das,
    // was der Nutzer gerade sieht — nicht für den ganzen ~395-Tage-Bereich.
    const winFrom = Math.min(visFrom + OVERSCAN, Math.max(0, totalDays - view.rangeDays));
    const winDays = dates.slice(winFrom, winFrom + view.rangeDays);
    if (winDays.length === 0) {
      return { occupancy: 0, bookedNights: 0, totalNights: 0, revenue: 0, adr: null as number | null, amountsHidden: false, currency: null as string | null };
    }
    const dayKeys = winDays.map((d) => key(d));
    let bookedNights = 0;
    for (const p of shown) {
      const statusMap = avail[p.id] ?? {};
      for (const dk of dayKeys) if (statusMap[dk] === "booked") bookedNights += 1;
    }
    const totalNights = shown.length * dayKeys.length;

    // Umsatz: Buchungen der sichtbaren Objekte, deren Nächte in den sichtbaren
    // Zeitraum fallen — anteilig (Nacht-Anteil im Fenster / Gesamtnächte).
    const winStart = dayKeys[0];
    const winEnd = key(addDays(winDays[0], winDays.length)); // exklusiv
    const seen = new Set<string>();
    let amountsHidden = false;
    // Umsatz + Nächte PRO Währung getrennt aggregieren — EUR und CHF dürfen nie
    // zu einer Zahl addiert werden (inkommensurable Beträge). Erst am Ende wird
    // entschieden, ob genau eine Währung vorliegt (dann echte KPI) oder mehrere
    // (dann keine sinnlose Mischsumme). Währung aus den Buchungsdaten, kein €-Hardcode.
    const revByCur = new Map<string, number>();
    const nightsByCur = new Map<string, number>();
    for (const p of shown) {
      for (const r of resByProp[p.id] ?? []) {
        if (seen.has(r.id) || r.status === "cancelled") continue;
        seen.add(r.id);
        if (r.total_amount == null) {
          amountsHidden = true;
          continue;
        }
        // currency kann "" sein (nullable seit 0078 bzw. maskiert) — leere
        // Strings sind KEIN gültiger ISO-Code (toLocaleString wirft sonst).
        if (!r.currency) {
          amountsHidden = true;
          continue;
        }
        const ci = r.check_in < winStart ? winStart : r.check_in;
        const co = r.check_out > winEnd ? winEnd : r.check_out;
        const nightsInWin = Math.max(
          0,
          Math.round((new Date(`${co}T00:00:00`).getTime() - new Date(`${ci}T00:00:00`).getTime()) / 86400000),
        );
        const totalResNights = Math.max(
          1,
          Math.round((new Date(`${r.check_out}T00:00:00`).getTime() - new Date(`${r.check_in}T00:00:00`).getTime()) / 86400000),
        );
        const cur = r.currency;
        revByCur.set(cur, (revByCur.get(cur) ?? 0) + (r.total_amount * nightsInWin) / totalResNights);
        nightsByCur.set(cur, (nightsByCur.get(cur) ?? 0) + nightsInWin);
      }
    }
    const currencies = [...revByCur.keys()];
    // Genau eine Währung → echte Umsatz-/ADR-Zahl. Mehrere → mixedCurrency=true,
    // die KPI-Leiste zeigt dann keinen (physikalisch sinnlosen) Mischbetrag.
    const singleCur = currencies.length === 1 ? currencies[0] : null;
    const revenue = singleCur ? (revByCur.get(singleCur) ?? 0) : 0;
    const revenueNights = singleCur ? (nightsByCur.get(singleCur) ?? 0) : 0;
    return {
      occupancy: totalNights ? bookedNights / totalNights : 0,
      bookedNights,
      totalNights,
      revenue,
      adr: revenueNights > 0 ? revenue / revenueNights : null,
      amountsHidden,
      currency: singleCur,
      mixedCurrency: currencies.length > 1,
    };
  }, [start, shown, dates, avail, resByProp, visFrom, view.rangeDays, totalDays]);

  // Geladenes Index-Intervall [from, to) der Tagesdaten (chunked). Ref, weil der
  // Scroll-Handler es liest, ohne ein Neu-Rendern auszulösen.
  const loadedRange = useRef<{ from: number; to: number } | null>(null);
  // In-Flight-Guard (Wurzel 2 — Idempotenz): welche [from,to)-Chunks gerade laden.
  // loadedRange wird erst NACH der Server-Antwort fortgeschrieben; ohne diesen
  // Ref feuert der Scroll-Effekt pro Animationsframe denselben Fetch erneut und
  // stapelt Dutzende identische Requests → Update-Depth-Überlauf. Synchron VOR
  // dem await setzen, im finally lösen.
  const pendingRanges = useRef<Set<string>>(new Set());

  // Buchungen separat laden — EIN Call, günstig, sofort sichtbar (entkoppelt von
  // der schwereren chunked Tagesdaten-Last). Balken erscheinen also sofort.
  const loadReservations = useCallback(async () => {
    const resAll = await listReservations();
    if (!resAll.ok) return;
    // Nur der EINMALIGE Initial-Load (bzw. Realtime-Re-Enable-Nachholung).
    // Danach pflegt der onEvent-Handler die Listen inkrementell — kein Vollreload
    // nach eigenen Aktionen. Stornierte Buchungen tragen keinen Balken → raus.
    const byProp: Record<string, Reservation[]> = {};
    for (const r of resAll.data.items) {
      if (r.status === "cancelled") continue;
      (byProp[r.property_id] ??= []).push(r);
    }
    setResByProp(byProp);
  }, []);

  // Tagesdaten (Status/Preis/Min-Stay/CTA-CTD) für ein Index-Fenster laden und
  // additiv in die State-Maps mergen. `replace` löscht vorher die alten Tagesdaten
  // (für Realtime-Reload des geladenen Bereichs), sonst wird nur ergänzt.
  const loadDays = useCallback(
    async (fromIdx: number, toIdx: number, replace = false) => {
      if (!start || properties.length === 0) return;
      const from = Math.max(0, fromIdx);
      const to = Math.min(totalDays, toIdx);
      if (to <= from) return;
      // In-Flight-Guard: denselben [from,to)-Bereich nicht doppelt anfordern,
      // solange ein Fetch läuft (replace bewusst getrennt gekennzeichnet, damit
      // ein Realtime-Reload einen laufenden reinen Nachlade-Fetch nicht blockt).
      const rangeKey = `${replace ? "r" : ""}${from}:${to}`;
      if (pendingRanges.current.has(rangeKey)) return;
      pendingRanges.current.add(rangeKey);
      setLoading(true);
      const s = key(addDays(start, from));
      const e = key(addDays(start, to)); // exklusiv
      try {
        // EIN Batch-Call für ALLE Objekte (statt früher 2 Calls je Objekt = N+1).
        // Der Board-Endpunkt liefert Verfügbarkeit + Preise + Min-Stay + Stop-Sell
        // gebündelt; das Merge-Format [pid, days, stops] bleibt unverändert.
        const board = await getBoard(
        properties.map((p) => p.id),
        s,
        e,
      );
      // Fehler NIE verschlucken: ohne diesen Zweig zeigte das Board bei 403 nur
      // leere Tage und wirkte „kaputt".
      setBoardError(board.ok ? null : board.error);
      const byPid = new Map(
        board.ok ? board.data.items.map((it) => [it.property_id, it]) : [],
      );
      // Objekt-Währung aus dem Board (Rate-Plan) — die zuverlässige Preisquelle,
      // unabhängig davon, ob das Objekt Buchungen hat.
      if (board.ok) {
        setCurrencyByProp((prev) => {
          const next = { ...prev };
          for (const it of board.data.items) next[it.property_id] = it.currency;
          return next;
        });
      }
      const results = properties.map((p) => {
        const it = byPid.get(p.id);
        const days: DayAvailability[] = it?.days ?? [];
        const stops: StopSellDay[] = it?.stop_sell ?? [];
        return [p.id, days, stops] as const;
      });
      // Diagnose (nur Entwicklung): was der Server WIRKLICH als gesperrt sendet.
      // Zusammen mit der [SPERRE]-Ausgabe beim Zeichnen zeigt das, ob der Status
      // schon in der Antwort fehlt oder erst danach verloren geht.
      // Merge-Helfer: pro State-Map die neuen Tage einspielen (replace = ersetzen).
      const mergeInto = <V,>(
        prev: Record<string, Record<string, V>>,
        pick: (d: DayAvailability) => [string, V] | null,
      ): Record<string, Record<string, V>> => {
        const next: Record<string, Record<string, V>> = { ...prev };
        for (const [pid, days] of results) {
          const base = replace ? {} : { ...(next[pid] ?? {}) };
          for (const d of days) {
            const kv = pick(d);
            if (kv) base[kv[0]] = kv[1];
          }
          next[pid] = base;
        }
        return next;
      };
      setAvail((prev: Record<string, Record<string, AvailabilityStatus>>) =>
        mergeInto(prev, (d) => [d.date, d.status]),
      );
      setSources((prev: Record<string, Record<string, AvailabilitySource>>) =>
        mergeInto(prev, (d) => [d.date, d.source]),
      );
      setPrices((prev: Record<string, Record<string, number | null>>) =>
        mergeInto(prev, (d) => [d.date, d.price]),
      );
      setPriceSources((prev: Record<string, Record<string, string>>) =>
        mergeInto(prev, (d) => [d.date, d.price_source ?? "none"]),
      );
      setPriceFactors((prev: Record<string, Record<string, Record<string, number>>>) =>
        mergeInto(prev, (d) => (d.price_factors ? [d.date, d.price_factors] : null)),
      );
      setMinStays((prev: Record<string, Record<string, number | null>>) =>
        mergeInto(prev, (d) => [d.date, d.min_stay]),
      );
      setRestrictions((prev: Record<string, Record<string, [boolean, boolean]>>) =>
        mergeInto(prev, (d) =>
          d.closed_to_arrival || d.closed_to_departure
            ? [d.date, [!!d.closed_to_arrival, !!d.closed_to_departure]]
            : null,
        ),
      );
      setStopSell((prev: Record<string, Record<string, StopSellDay>>) => {
        const next = { ...prev };
        for (const [pid, , stops] of results) {
          const base = replace ? {} : { ...(next[pid] ?? {}) };
          for (const d of stops) base[d.date] = d;
          next[pid] = base;
        }
        return next;
      });
      // Geladenes Intervall fortschreiben (Vereinigung), bei replace zurücksetzen.
      const cur = replace ? null : loadedRange.current;
      loadedRange.current = cur
        ? { from: Math.min(cur.from, from), to: Math.max(cur.to, to) }
        : { from, to };
      } finally {
        // Guard IMMER lösen (auch bei Fehler/Abbruch) — sonst bliebe der Bereich
        // dauerhaft „pending" und würde nie mehr nachgeladen.
        pendingRanges.current.delete(rangeKey);
        setLoading(false);
      }
    },
    [start, properties, totalDays],
  );

  // Sicherstellen, dass das sichtbare Index-Fenster (+Puffer) geladen ist; sonst
  // den fehlenden CHUNK_DAYS-Block nachladen (links ODER rechts). Kein Voll-Load.
  const ensureLoaded = useCallback(
    (fromIdx: number, toIdx: number) => {
      const cur = loadedRange.current;
      if (cur && fromIdx >= cur.from && toIdx <= cur.to) return; // alles da
      // Läuft schon ein Nachlade-Fetch, nicht erneut anstoßen: er schiebt
      // loadedRange fort, der nächste Scroll-Tick greift dann. Ohne diesen Guard
      // feuert der Scroll-Effekt pro Frame denselben Chunk-Fetch (Update-Depth).
      if (pendingRanges.current.size > 0) return;
      if (!cur) {
        void loadDays(fromIdx, toIdx);
        return;
      }
      // Fehlt links?
      if (fromIdx < cur.from) {
        void loadDays(Math.max(0, cur.from - CHUNK_DAYS), cur.from);
      }
      // Fehlt rechts?
      if (toIdx > cur.to) {
        void loadDays(cur.to, Math.min(totalDays, cur.to + CHUNK_DAYS));
      }
    },
    [loadDays, totalDays],
  );

  // Realtime-/Erst-Reload: Buchungen frisch + den AKTUELL geladenen Tagesbereich
  // neu (replace). Lädt NICHT die ganzen ~395 Tage.
  //
  // Sequenz-Token als Backstop gegen überlappende Vollreload-Läufe (Wurzel 2):
  // load() ist zweistufig (loadReservations → loadDays), jeder Schritt schreibt
  // State. Rennen zwei durch verschiedene Realtime-Tabellen ausgelöste Läufe, darf
  // der ÄLTERE nach dem jüngeren nichts mehr überschreiben. Jeder Aufruf zieht ein
  // Token; nach jedem await bricht ein überholter Lauf ab, bevor er erneut schreibt
  // — der jüngste Lauf setzt immer den korrekten Endzustand. (reservations läuft
  // separat inkrementell und nutzt load() nicht mehr.)
  const loadSeq = useRef(0);
  const load = useCallback(async () => {
    const myToken = ++loadSeq.current;
    await loadReservations();
    if (myToken !== loadSeq.current) return; // überholt → nicht weiter schreiben
    const cur = loadedRange.current;
    if (cur) await loadDays(cur.from, cur.to, true);
  }, [loadReservations, loadDays]);

  // Erst-Last + Hintergrund-Vorladen des GANZEN Jahres: Zuerst der Block um heute
  // (schneller Start), dann werden die restlichen ~395 Tage Block für Block im
  // Hintergrund nachgezogen — sequenziell (nicht alle auf einmal, sonst
  // überlastet es Browser/Backend). Beim Scrollen ist dann alles schon da, kein
  // „lädt…". Vorrang nach vorn (Zukunft), dann nach hinten (Vergangenheit).
  const prefetchToken = useRef(0);
  useEffect(() => {
    if (!start || properties.length === 0) return;
    const myToken = ++prefetchToken.current;
    void loadReservations();
    // Begrenztes Vorlauf-Fenster um heute (statt des ganzen Jahres). Alles
    // außerhalb lädt der Scroll-Handler (ensureLoaded) bei Bedarf nach.
    const loFrom = Math.max(0, todayIndex - PREFETCH_BEHIND_DAYS);
    const hiTo = Math.min(totalDays, todayIndex + PREFETCH_AHEAD_DAYS);
    (async () => {
      // 1) Sichtbarer Block um heute zuerst.
      await loadDays(
        Math.max(0, todayIndex - CHUNK_DAYS / 3),
        Math.min(hiTo, todayIndex + CHUNK_DAYS),
      );
      // 2) Rest des Vorlauf-Fensters [loFrom, hiTo) in Blöcken nachziehen.
      //    Abbruch, wenn ein neuer Lauf gestartet wurde (Objektwechsel/Remount).
      let guard = 0;
      while (myToken === prefetchToken.current && guard < 64) {
        guard += 1;
        const cur = loadedRange.current;
        if (!cur) break;
        if (cur.to < hiTo) {
          await loadDays(cur.to, Math.min(hiTo, cur.to + CHUNK_DAYS));
        } else if (cur.from > loFrom) {
          await loadDays(Math.max(loFrom, cur.from - CHUNK_DAYS), cur.from);
        } else {
          break; // Vorlauf-Fenster geladen
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, properties]);

  // Beim Scrollen: fehlende Blöcke um das sichtbare Fenster nachladen.
  // ensureLoaded über eine ref, NICHT in den Deps: es hängt (via loadDays) an
  // `properties`, das bei jedem router.refresh() eine neue Array-Referenz bekommt.
  // Stünde ensureLoaded in den Deps, feuerte der Effect bei jedem Render neu
  // (Maximum update depth exceeded). Der Effect soll NUR auf das sichtbare Fenster
  // reagieren; die stets aktuelle ensureLoaded-Funktion kommt aus der ref.
  const ensureLoadedRef = useRef(ensureLoaded);
  ensureLoadedRef.current = ensureLoaded;
  useEffect(() => {
    ensureLoadedRef.current(visFrom, visTo);
  }, [visFrom, visTo]);

  // Beim ersten gerenderten Raster sofort (ohne Animation) auf „heute" scrollen,
  // damit der Nutzer nicht im Vergangenheits-Puffer landet. Nur einmal.
  useEffect(() => {
    if (didInitialScroll.current) return;
    // Erst scrollen, wenn alles steht: start, gerendertes Raster UND der echte
    // todayIndex (>0, sobald todayKey gesetzt ist) — sonst landet der Erst-Scroll
    // fälschlich auf dem 1. Januar (Index 0).
    if (!start || dates.length === 0 || !todayKey || todayIndex <= 0) return;
    didInitialScroll.current = true;
    scrollToIndex(todayIndex, "auto");
    recomputeWindow();
  }, [start, dates.length, todayKey, todayIndex, scrollToIndex, recomputeWindow]);

  // reservations: REIN inkrementelles Realtime (Notion-Muster) — kein Vollreload.
  // Der onEvent-Handler pflegt die Buchungslisten gezielt aus payload.new/old per
  // id (Wurzel 2 — idempotent gegen das eigene Echo, Doppelklick, Redelivery). Das
  // Abo wird bewusst NICHT pausiert: das durch die eigene Aktion ausgelöste Event
  // MUSS ankommen; da der Übergang idempotent ist und keinen Vollreload auslöst,
  // stört es auch während eines Drags nicht (kein Flackern, keine Race mit load()).
  useRealtime<Reservation>({
    table: "reservations",
    onEvent: (payload) => {
      setResByProp((prev) => {
        if (payload.eventType === "DELETE") {
          const oldId = (payload.old as Partial<Reservation>).id;
          return oldId ? removeEverywhere(prev, oldId) : prev;
        }
        // INSERT/UPDATE (inkl. Move: property_id und/oder Zeitraum geändert).
        const row = payload.new as Reservation;
        if (!row?.id) return prev;
        return applyReservation(prev, row);
      });
    },
  });

  // availability: REIN inkrementelles Realtime (wie reservations) — eine Wahrheit
  // pro (property_id, date), gepflegt aus dem Payload, KEIN Vollreload. Jede Zeile
  // betrifft genau einen Tag → avail[pid][date]=status, sources[pid][date]=source.
  // Das Abo pausiert NICHT (auch nicht beim Drag): der Übergang ist idempotent und
  // löst keinen Reload aus. So bleibt der Tagesstatus in Echtzeit konsistent mit
  // den Buchungen — kein eingefrorener availability-Rest mehr (Notion-Muster:
  // atomare Records, Client zieht die geänderte Zeile gezielt nach).
  type AvailabilityRow = {
    property_id: string;
    date: string;
    status: AvailabilityStatus;
    source: AvailabilitySource;
  };
  useRealtime<AvailabilityRow>({
    table: "availability",
    onEvent: (payload) => {
      const row = (payload.eventType === "DELETE" ? payload.old : payload.new) as AvailabilityRow;
      if (!row?.property_id || !row?.date) return;
      const del = payload.eventType === "DELETE";
      // Status setzen/entfernen (DELETE → Tag fällt auf implizit „open" zurück).
      setAvail((prev) => {
        const day = { ...(prev[row.property_id] ?? {}) };
        if (del) delete day[row.date];
        else day[row.date] = row.status;
        return { ...prev, [row.property_id]: day };
      });
      setSources((prev) => {
        const day = { ...(prev[row.property_id] ?? {}) };
        if (del) delete day[row.date];
        else day[row.date] = row.source;
        return { ...prev, [row.property_id]: day };
      });
    },
  });

  // Preise/Stop-Sell: weiterhin Vollreload der Tagesdaten (chunked, komplex — noch
  // kein inkrementelles Modell). Diese Abos pausieren während einer aktiven
  // Interaktion (Drag/Resize/Selektion), damit kein Reload sie unterbricht; beim
  // Re-Enable holt der Hook einmal nach.
  const interacting = !!barDrag || !!drag || !!sel;
  useRealtime({ table: "price_overrides", onChange: load, enabled: !interacting });
  useRealtime({ table: "stop_sell", onChange: load, enabled: !interacting });
  // Preisänderungen live: Basispreis (rate_plans) + Pricing-Konfig
  // (property_pricing_config) fließen über den Resolver in die Tagespreise →
  // im Objekt geänderte Preise erscheinen sofort im Kalender (kein Reload).
  useRealtime({ table: "rate_plans", onChange: load, enabled: !interacting });
  useRealtime({ table: "property_pricing_config", onChange: load, enabled: !interacting });
  // Dynamic Pricing live: neu berechnete Tagespreise (dynamic_prices) und das
  // An-/Ausschalten je Objekt (dp_settings) erscheinen sofort im Kalender —
  // echtes Realtime (Supabase postgres_changes), kein Polling.
  useRealtime({ table: "dynamic_prices", onChange: load, enabled: !interacting });
  useRealtime({ table: "dp_settings", onChange: load, enabled: !interacting });

  // Ausgewählten Zeitraum sperren (blockRange, end exklusiv).
  //
  // KEIN load() nach der eigenen Aktion (Projektregel „Realtime, kein manuelles
  // Reload"): blockRange schreibt `availability`, und das availability-Abo oben
  // ist inkrementell und live (Grant + Publikation gegen die Live-DB geprüft,
  // scripts/realtime/abos-pruefen.sh). Die geschriebenen Tage kommen als
  // INSERT/UPDATE zurück und landen per Payload in avail/sources — ein
  // Vollreload würde dasselbe Ergebnis nur teurer und mit Flackern erzeugen.
  const confirmBlock = useCallback(async () => {
    if (!sel || !start) return;
    const lo = Math.min(sel.from, sel.to);
    const hi = Math.max(sel.from, sel.to);
    const s = key(addDays(start, lo));
    const e = key(addDays(start, hi + 1)); // end exklusiv
    setSaving(true);
    const res = await blockRange(sel.pid, s, e);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    // Eigene Änderung SOFORT anwenden, statt allein auf das availability-Abo zu
    // warten. Eine Sperre schreibt seit dem Einheiten-Modell (0266) EINE ZEILE
    // JE EINHEIT — das Abo bekommt also n Ereignisse für denselben Tag und
    // setzt sie nacheinander. Bleibt eines aus oder kommt es verspätet, blieb
    // der Tag hier auf „frei" stehen, während die Datenbank längst `blocked`
    // sagte: die Sperre war gesetzt und trotzdem unsichtbar (live beobachtet).
    // Das Abo bestätigt/korrigiert diesen Stand danach idempotent.
    const nights: string[] = [];
    for (let i = lo; i <= hi; i += 1) nights.push(key(addDays(start, i)));
    setAvail((prev) => {
      const day = { ...(prev[sel.pid] ?? {}) };
      for (const dk of nights) day[dk] = "blocked";
      return { ...prev, [sel.pid]: day };
    });
    setSources((prev) => {
      const day = { ...(prev[sel.pid] ?? {}) };
      for (const dk of nights) day[dk] = "manual";
      return { ...prev, [sel.pid]: day };
    });
    setSel(null);
    setMenuAt(null);
  }, [sel, start]);

  // Geklickte manuelle Sperre aufheben (unblockRange, gibt frei gewordene Tage
  // an Channex zurück). Der Gegenzustand wird — wie beim Sperren — sofort
  // angewendet: das DELETE trifft eine Zeile JE EINHEIT, und auf n einzelne
  // Abo-Ereignisse zu warten hieße, den Balken bis zum letzten stehen zu lassen.
  const confirmUnblock = useCallback(async () => {
    if (!unblockAt) return;
    setSaving(true);
    const res = await unblockRange(unblockAt.pid, unblockAt.start, unblockAt.end);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setAvail((prev) => {
      const day = { ...(prev[unblockAt.pid] ?? {}) };
      // `end` ist exklusiv — der letzte Tag der Sperre ist end-1.
      for (
        let d = new Date(`${unblockAt.start}T00:00:00`);
        key(d) < unblockAt.end;
        d = addDays(d, 1)
      ) {
        delete day[key(d)];
      }
      return { ...prev, [unblockAt.pid]: day };
    });
    setUnblockAt(null);
  }, [unblockAt]);

  // Stop-Sell eines Balkens aufheben (Rechtsklick → Kontextmenü). Läuft über den
  // VORHANDENEN Weg `clearStopSell` (derselbe, den das Stop-Sell-Panel nutzt).
  //
  // `include_portal` ist IMMER true, und das ist kein Vorschlaghammer: Der
  // Betrieb entscheidet über seine Verfügbarkeit, nicht das Portal. Ein
  // `source='channex'`-Stopp ist fast nie eine fremde Entscheidung, sondern
  // unser eigener Stopp, den der Import aus dem Channex-Feed zurückgespiegelt
  // hat (`bookings_sync.py:1991`) — die Herkunftsangabe beschreibt den WEG,
  // über den die Zeile zu uns kam, nicht wer sie wollte. Ohne das Flag löscht
  // der Backend-Weg nur `source='manual'`, der Klick tat sichtbar nichts, und
  // der Balken blieb stehen.
  //
  // Der Backend-Weg pusht `stop_sell=false` NUR für Tage, die danach wirklich
  // keinen Stopp mehr tragen (plan-genaue Hotel-Stopps bleiben unberührt) —
  // die Tage werden also auch an den OTAs wieder geöffnet.
  const confirmClearStopSell = useCallback(async () => {
    if (!barMenu) return;
    setSaving(true);
    // `include_rate_plans` ist hier ebenfalls immer an: Der Belegungsplan zeigt
    // eine Zeile je OBJEKT und kennt keine Rate-Pläne. Sein Balken steht auch
    // dann da, wenn der Stopp an einem Plan hängt — ohne das Flag warf der
    // Server genau diese Zeile weg und der Klick blieb wirkungslos.
    const res = await clearStopSell(
      barMenu.pid, barMenu.start, barMenu.end, undefined, true, true,
    );
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    // Ein Aufruf, der nichts gefunden hat, darf sich nicht wie ein Erfolg
    // anfühlen: vorher meldete der Server „ok", während der Balken stehen
    // blieb, und der Nutzer klickte ins Leere (Wurzel 5).
    if (res.data?.cleared_days === 0) {
      toast.error(t("board.stopSellClearNothing"));
      return;
    }
    setBarMenu(null);
    // Das stop_sell-Abo (Vollreload-Modus) zieht die Zellen nach.
  }, [barMenu, t]);

  // ◀/▶: im „Monat"-Fenster echte KALENDERMONATE springen (auf den 1. des Vor-/
  // Folgemonats), sonst um den Granularitäts-Schritt. Der 28-Tage-Sprung ließ den
  // Nutzer über die Monatsgrenze driften — er glaubte „November", war aber im
  // Oktober (Ursache des Datumsversatzes). Alles relativ zum Anker `start`.
  function shift(deltaDays: number) {
    if (view.rangeDays === 28 && start) {
      const leftIdx = currentLeftIndex();
      const cur = addDays(start, Math.max(0, leftIdx));
      // Erster des Monats, dann ±1 Kalendermonat (Richtung aus deltaDays).
      const target = new Date(cur.getFullYear(), cur.getMonth(), 1);
      target.setMonth(target.getMonth() + (deltaDays < 0 ? -1 : 1));
      const di = Math.round((target.getTime() - start.getTime()) / 86_400_000);
      scrollToIndex(Math.min(totalDays - 1, Math.max(0, di)));
      return;
    }
    scrollToIndex(currentLeftIndex() + deltaDays);
  }
  function goToday() {
    scrollToIndex(todayIndex);
  }
  // Auf ein gewähltes Datum springen (Date-Picker im Kopf): zum Index scrollen.
  function jumpTo(isoDate: string) {
    if (!start) return;
    const d = new Date(`${isoDate}T00:00:00`);
    if (Number.isNaN(d.getTime())) return;
    const di = Math.round((d.getTime() - start.getTime()) / 86_400_000);
    scrollToIndex(Math.min(totalDays - 1, Math.max(0, di)));
  }

  // Monatsbänder für den Spaltenkopf: MUSS vor dem frühen Return für „keine
  // Objekte" stehen — ein Hook hinter einem Return ändert die Hook-Reihenfolge,
  // sobald das erste Objekt existiert (React-Fehler, Zustandssalat).
  // Segmente je Kalendermonat: zusammenhängende Segmente je Kalendermonat
  // (Label + Spaltenanzahl), damit das Band die volle Monatsbreite überspannt.
  const monthBands = useMemo(() => {
    const out: { key: string; label: string; span: number }[] = [];
    for (const d of dates) {
      const k = `${d.getFullYear()}-${d.getMonth()}`;
      const last = out[out.length - 1];
      if (last && last.key === k) {
        last.span += 1;
      } else {
        out.push({
          key: k,
          label: `${monthLabels(t)[d.getMonth()]} ${d.getFullYear()}`,
          span: 1,
        });
      }
    }
    return out;
  }, [dates, t]);

  if (properties.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <h2 className="font-display text-2xl font-extrabold">Kalender</h2>
        <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-secondary">
            <Icon icon="ph:calendar-blank" className="size-7 text-muted-foreground" />
          </span>
          <p className="font-display text-lg font-extrabold">{t("board.noProperties")}</p>
          <p className="text-sm text-muted-foreground">
            Lege zuerst ein Objekt an, dann erscheint hier der Kalender.
          </p>
          <Button asChild>
            <Link href="/objekte">{t("board.toProperties")}</Link>
          </Button>
        </Card>
      </div>
    );
  }

  // Titel + Datums-Sprung zeigen den AKTUELL SICHTBAREN Tag, NICHT den fixen
  // Timeline-Anker `start` (immer 1. Januar). Der linkeste sichtbare Index wird
  // DIREKT aus dem Scroll abgeleitet (nicht `visFrom + OVERSCAN`, das bei der
  // 0-Klemmung driftete und den Titelmonat falsch anzeigte → Nutzer glaubte den
  // falschen Monat). Fällt auf `start` zurück, solange das Fenster noch nicht steht.
  const visibleDay =
    dates[Math.min(dates.length - 1, Math.max(0, leftIndex))] ?? start ?? null;
  const titleMonth = visibleDay ? monthLabels(t)[visibleDay.getMonth()] : "";
  const titleYear = visibleDay ? `${visibleDay.getFullYear()}` : "";

  // „Erstellen"-Menü im Kopf: Sperren geschieht im Raster per Ziehen;
  // „Reservierung" öffnet den Assistenten mit dem ersten Objekt ab morgen.
  function onCreate(kind: "booking" | "blocked") {
    if (kind === "booking" && start && properties[0]) {
      setWizard({
        pid: properties[0].id,
        checkIn: key(addDays(start, 1)),
        checkOut: key(addDays(start, 3)),
      });
    }
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      {/* Kopfbereich (eigenes Element) */}
      <CalendarHeader
        title={{ month: titleMonth, year: titleYear }}
        view={view}
        onView={setView}
        onPrev={() => shift(-view.rangeDays)}
        onNext={() => shift(view.rangeDays)}
        onToday={goToday}
        onJump={jumpTo}
        jumpValue={visibleDay ? key(visibleDay) : ""}
        onCreate={onCreate}
        viewSwitcher={viewSwitcher}
      />

      {boardError && (
        <div className="rounded-(--radius) border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {boardError}
        </div>
      )}

      {/* Filter & Suche (Objekt/Typ/Kanal/Status/Gastname) */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Icon
            icon="ph:magnifying-glass"
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("board.searchPlaceholder")}
            className="h-9 w-56 rounded-full pl-9"
            aria-label="Suche"
          />
        </div>
        <FilterSelect
          value={typeFilter}
          onChange={(v) => setTypeFilter(v as PropertyType | "all")}
          allLabel={t("board.allTypes")}
          options={typeOptionsFor(accommodationType)}
        />
        <FilterSelect
          value={channelFilter}
          onChange={(v) => setChannelFilter(v as AvailabilitySource | "all")}
          allLabel={t("board.allChannels")}
          options={CHANNEL_SOURCES.map((s) => ({ value: s, label: channelLabel(s) }))}
        />
        <FilterSelect
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as DisplayStatus | "all")}
          allLabel={t("board.allStatus")}
          options={(["confirmed", "pending", "in_house", "completed", "cancelled"] as const).map(
            (s) => ({ value: s, label: statusLabel(s) }),
          )}
        />
        {(query || typeFilter !== "all" || channelFilter !== "all" || statusFilter !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQuery("");
              setTypeFilter("all");
              setChannelFilter("all");
              setStatusFilter("all");
            }}
          >
            <Icon icon="ph:x" className="size-3.5" /> Zurücksetzen
          </Button>
        )}
      </div>

      {/* Legende: Status + Vertriebskanäle (Herkunft je Farbe/Logo). */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        {/* Sperre, Stop-Sell und die Überlagerung beider sind drei eigene
            Einträge — sie sehen im Raster verschieden aus und bedeuten
            Verschiedenes (Sperre = zu, Stop-Sell = frei, aber nicht verkauft). */}
        {(["open", "blocked", "stop_sell", "blocked_stop_sell"] as SegStatus[]).map((s) => (
          <span key={s} className="flex items-center gap-1.5">
            <span
              className={`inline-block size-3 rounded-sm border ${s === "open" ? "bg-background" : SEG_STYLE[s]}`}
            />
            {statusLabels(t)[s]}
          </span>
        ))}
        {/* Eigentümer-Aufenthalt (0241): belegt, aber kein Kanal und kein Umsatz. */}
        <span className="flex items-center gap-1.5">
          <span
            className={`inline-flex size-4 items-center justify-center rounded-sm ${OWNER_STAY_BAR}`}
          >
            <Icon icon={OWNER_STAY_ICON} className="size-2.5" />
          </span>
          {t("calendarBoard.ownerStay")}
        </span>
        <span className="h-3 w-px bg-border" aria-hidden />
        {CHANNEL_SOURCES.map((src) => (
          <span key={src} className="flex items-center gap-1.5">
            <span
              className={`inline-flex size-4 items-center justify-center rounded-sm text-white ${CHANNEL_META[src].dotBg}`}
            >
              <ChannelLogo source={src} className="size-2.5" />
            </span>
            {channelLabel(src)}
          </span>
        ))}
        <span className="h-3 w-px bg-border" aria-hidden />
        {(["confirmed", "pending", "in_house", "completed", "cancelled"] as const).map(
          (s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className={`size-2 rounded-full ${STATUS_META[s].dotBg}`} />
              {statusLabel(s)}
            </span>
          ),
        )}
        <span className="h-3 w-px bg-border" aria-hidden />
        <span className="flex items-center gap-1.5">
          <Icon icon="ph:sign-in" className="size-3.5 text-destructive/80" />
          {t("board.ctaBlocked")}
        </span>
        <span className="flex items-center gap-1.5">
          <Icon icon="ph:sign-out" className="size-3.5 text-destructive/80" />
          {t("board.ctdBlocked")}
        </span>
        {loading && <span>{t("board.loading")}</span>}
      </div>

      {/* Aktionsmenü am Cursor nach dem Ziehen (eigene Komponente) */}
      {sel && menuAt && start && (
        <CalendarActionMenu
          at={menuAt}
          rangeLabel={(() => {
            const lo = Math.min(sel.from, sel.to);
            const hi = Math.max(sel.from, sel.to);
            const f = addDays(start, lo);
            const t = addDays(start, hi);
            const fmt = (d: Date) => `${d.getDate()}.${d.getMonth() + 1}.`;
            const n = hi - lo + 1;
            return `${fmt(f)} – ${fmt(t)} · ${n} Tag${n > 1 ? "e" : ""}`;
          })()}
          saving={saving}
          onAction={(action) => {
            if (action === "closed") {
              confirmBlock();
              return;
            }
            const lo = Math.min(sel.from, sel.to);
            const hi = Math.max(sel.from, sel.to);
            const checkIn = key(addDays(start, lo));
            const checkOut = key(addDays(start, hi + 1)); // end exklusiv
            if (action === "stop_sell") {
              // Vorhandenes Stop-Sell-Panel mit vorbelegtem Objekt + Zeitraum
              // öffnen (Enden INKLUSIV, so erwartet es die Auswahl dort).
              setStopSellSel({
                propertyId: sel.pid,
                propertyTitle:
                  properties.find((p) => p.id === sel.pid)?.title ?? "",
                start: checkIn,
                end: key(addDays(start, hi)),
              });
            } else if (action === "bulk") {
              setBulk({ pid: sel.pid, checkIn, checkOut });
            } else {
              // Reservierung/Eigennutzung: Wizard mit gezogenem Zeitraum öffnen.
              setWizard({
                pid: sel.pid,
                checkIn,
                checkOut,
                ownerStay: action === "owner_stay",
              });
            }
            setMenuAt(null);
            setSel(null);
          }}
          onClose={() => {
            setMenuAt(null);
            setSel(null);
          }}
        />
      )}

      {/* Kennzahlenleiste (sichtbarer Zeitraum): Auslastung, ADR, Umsatz.
          Beträge nur, wenn der Nutzer sie sehen darf (sonst Hinweis). */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 rounded-(--radius) border bg-secondary/40 px-4 py-2.5 text-sm">
        <Metric
          icon="ph:chart-pie-slice"
          label={t("board.occupancy")}
          value={`${Math.round(metrics.occupancy * 100)} %`}
          hint={t("board.propertyNights", { booked: metrics.bookedNights, total: metrics.totalNights })}
        />
        <Metric
          icon="ph:currency-circle-dollar"
          label={t("board.revenue")}
          value={
            metrics.mixedCurrency ||
              !metrics.currency ||
              (metrics.amountsHidden && metrics.revenue === 0)
              ? "—"
              : metrics.revenue.toLocaleString(locale, {
                style: "currency",
                currency: metrics.currency,
                maximumFractionDigits: 0,
              })
          }
          hint={
            metrics.mixedCurrency
              ? "gemischte Währungen"
              : metrics.amountsHidden
                ? "ohne gesperrte Beträge"
                : t("board.inPeriod")
          }
        />
        <Metric
          icon="ph:bed"
          label={t("board.adr")}
          value={
            metrics.mixedCurrency || metrics.adr == null || !metrics.currency
              ? "—"
              : metrics.adr.toLocaleString(locale, {
                style: "currency",
                currency: metrics.currency,
                maximumFractionDigits: 0,
              })
          }
          hint={metrics.mixedCurrency ? t("board.mixedCurrencies") : t("board.avgNightPrice")}
        />
      </div>

      {/* Raster — scrollt INNERHALB dieses Containers (min-w-0 begrenzt Breite) */}
      {/* overflow-clip statt overflow-hidden: clippt Inhalte an Rundungen, ohne */}
      {/* einen Scroll-Kontext zu erzeugen — sonst bricht sticky left-0. */}
      <Card className="min-w-0 overflow-clip p-0">
        {/* Während eines Zugs (Move/Resize/Zell-Auswahl) Text-Selektion global
            unterbinden — Backstop zu ev.preventDefault (kein blaues Markieren). */}
        {/* Höhe begrenzt + beide Achsen HIER: sonst wächst der Container mit der
            Objektliste und die horizontale Leiste sitzt unter der letzten Zeile —
            bei vielen Objekten erst nach ganz-unten-Scrollen erreichbar. */}
        <div
          ref={scrollRef}
          className={
            "max-h-[calc(100vh-20rem)] overflow-auto " +
            (interacting ? "select-none" : "")
          }
        >
          <div style={{ width: `${LABEL + dates.length * COL}rem` }}>
            {/* Monatsband — nennt über den Tagesspalten den Monat, damit ein
                Drag-Ziel monats-eindeutig ist (die Tageskopfzeile zeigt nur die
                Tageszahl; ohne dieses Band verwechselt man Okt/Nov an der Grenze). */}
            <div className="flex border-b bg-secondary/40">
              <div
                className="sticky left-0 z-20 shrink-0 border-r bg-secondary/40"
                style={{ width: `${LABEL}rem` }}
              />
              {monthBands.map((b) => (
                <div
                  key={b.key}
                  className="shrink-0 truncate border-r px-3 py-1 text-xs font-semibold text-foreground"
                  style={{ width: `${b.span * COL}rem` }}
                >
                  {b.label}
                </div>
              ))}
            </div>
            {/* Tageskopf — virtualisiert: Spacer + nur sichtbare Spalten. */}
            <div className="flex border-b">
              <div
                className="sticky left-0 z-20 flex shrink-0 items-center border-r bg-card px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
                style={{ width: `${LABEL}rem` }}
              >
                Objekt
              </div>
              <div className="flex">
                {/* Spacer links (alle Spalten vor dem sichtbaren Fenster). */}
                <div style={{ width: `${visFrom * COL}rem` }} className="shrink-0" />
                {dates.slice(visFrom, visTo).map((d) => {
                  const wd = d.getDay();
                  const isToday = key(d) === todayKey;
                  return (
                    <div
                      key={key(d)}
                      className="flex shrink-0 flex-col items-center border-r py-2 text-sm"
                      style={{ width: `${COL}rem` }}
                    >
                      <span className="text-xs text-muted-foreground">{weekdayLabels(t)[wd]}</span>
                      <span className={`mt-1 flex size-8 items-center justify-center rounded-full text-base font-semibold ${isToday ? "bg-accent text-white" : ""}`}>
                        {d.getDate()}
                      </span>
                    </div>
                  );
                })}
                {/* Spacer rechts (alle Spalten nach dem sichtbaren Fenster). */}
                <div style={{ width: `${(totalDays - visTo) * COL}rem` }} className="shrink-0" />
              </div>
            </div>

            {/* Objektzeilen */}
            <div ref={gridRef}>
              {shown.map((p) => {
                const statusMap = avail[p.id] ?? {};
                const sourceMap = sources[p.id] ?? {};
                const priceMap = prices[p.id] ?? {};
                const priceSrcMap = priceSources[p.id] ?? {};
                const factorsMap = priceFactors[p.id] ?? {};
                const minStayMap = minStays[p.id] ?? {};
                const restrictMap = restrictions[p.id] ?? {};
                const resList = resByProp[p.id] ?? [];
                // Tag→Buchung-Map fürs Segment-Rendering aus der ID-Liste ableiten
                // (single source of truth = die Liste; Realtime pflegt nur die Liste).
                const resMap = reservationsByDay(resList);
                const stopMap = stopSell[p.id] ?? {};
                // Objekt-Währung aus dem Board (Rate-Plan) — die zuverlässige
                // Preisquelle; fällt auf die Reservierungs-Währung zurück, falls
                // (noch) keine Board-Währung vorliegt. Kein €-Hardcode.
                const propCurrency =
                  currencyByProp[p.id] ??
                  resList.find((r) => r.currency)?.currency ??
                  null;
                const segs = toSegments(statusMap, sourceMap, resMap, dates, stopMap);
                // Diagnose (nur Entwicklung): zeigt je Objekt, welche Tage der
                // Server als gesperrt liefert und ob daraus ein Balken wurde.
                // Entfernen, sobald die Sperr-Anzeige belegt funktioniert.
                return (
                  <div key={p.id} data-row-pid={p.id} className="flex border-b last:border-b-0">
                    {/* Objektspalte (eigene Komponente, sticky links) */}
                    <PropertyLabel
                      p={p}
                      width={LABEL}
                      showPicture={view.showPicture}
                      showInternalName={view.showInternalName}
                      showId={view.showId}
                      isHotel={accommodationType === "hotel"}
                    />

                    {/* Tagesbereich — volle Breite (für absolut positionierte
                      Balken), Zellen virtualisiert mit Spacern; di bleibt
                      ABSOLUT (= visFrom + i), damit Drag/Selektion stimmen. */}
                    <div className="relative flex self-stretch" style={{ width: `${dates.length * COL}rem`, minHeight: `${ROW_H}rem` }}>
                      {/* Spacer links (Zellen vor dem sichtbaren Fenster). */}
                      <div style={{ width: `${visFrom * COL}rem` }} className="shrink-0" />
                      {/* Zellen mit Gäste + Preis-Platzhalter — klickbar (sperren/freigeben) */}
                      {dates.slice(visFrom, visTo).map((d, i) => {
                        const di = visFrom + i;
                        const isToday = key(d) === todayKey;
                        const status = statusMap[key(d)] ?? "open";
                        const inSel = isSelected(p.id, di);
                        return (
                          <button
                            type="button"
                            key={key(d)}
                            onMouseDown={(ev) => onCellDown(p.id, di, ev)}
                            onMouseEnter={() => onCellEnter(p.id, di)}
                            className={`flex shrink-0 cursor-pointer flex-col items-center justify-center gap-0.5 self-stretch border-r text-sm transition-colors ${inSel
                              ? "bg-neutral-800 text-white"
                              : `hover:bg-accent/10 ${isToday ? "bg-accent/5" : ""}`
                              }`}
                            style={{ width: `${COL}rem`, minHeight: `${ROW_H}rem` }}
                          >
                            {status === "open" && (
                              <>
                                {/* Personenzahl steht als Badge hinter dem Zimmernamen
                                    (konstant je Objekt) → in der Tageszelle nur Preis,
                                    Mindestaufenthalt und An-/Abreise-Sperren. Der
                                    Tagespreis kommt aus dem Board-Endpunkt (effektiver
                                    Objektpreis); bei mehreren Plänen werden Details in
                                    der Ansicht „Preise" gepflegt. */}
                                {view.showPrice && (
                                  <span className={`flex items-center gap-1 ${inSel ? "text-white" : "text-muted-foreground"}`}>
                                    <span title={fmtPrice(priceMap[key(d)], propCurrency, locale)}>
                                      {fmtPriceKompakt(priceMap[key(d)], locale)}
                                    </span>
                                    {priceSrcMap[key(d)] === "dynamic" && (
                                      <span
                                        title={
                                          explainFactors(factorsMap[key(d)]) ||
                                          t("board.dynamicPriceTitle")
                                        }
                                        aria-label={t("board.dynamicPrice")}
                                        className={`flex cursor-help items-center rounded px-0.5 leading-tight ${inSel ? "text-white" : "text-accent"}`}
                                      >
                                        <Icon icon="ph:lightning-fill" className="size-2.5" />
                                      </span>
                                    )}
                                  </span>
                                )}
                                {view.showMinStay && (
                                  <span className={`flex items-center gap-0.5 text-[0.65rem] ${inSel ? "text-white/80" : "text-muted-foreground/70"}`}>
                                    <Icon icon="ph:moon" className="size-3" />
                                    {minStayMap[key(d)] != null ? `${minStayMap[key(d)]}` : "–"}
                                  </span>
                                )}
                                {/* CTA/CTD: Anreise- bzw. Abreise-Sperre je Tag. */}
                                {(restrictMap[key(d)]?.[0] ||
                                  restrictMap[key(d)]?.[1]) && (
                                    <span className="flex items-center gap-0.5">
                                      {restrictMap[key(d)]?.[0] && (
                                        <span title={t("board.ctaBlocked")} className="flex">
                                          <Icon
                                            icon="ph:sign-in"
                                            className={`size-3 ${inSel ? "text-white/90" : "text-destructive/80"}`}
                                          />
                                        </span>
                                      )}
                                      {restrictMap[key(d)]?.[1] && (
                                        <span title={t("board.ctdBlocked")} className="flex">
                                          <Icon
                                            icon="ph:sign-out"
                                            className={`size-3 ${inSel ? "text-white/90" : "text-destructive/80"}`}
                                          />
                                        </span>
                                      )}
                                    </span>
                                  )}
                              </>
                            )}
                          </button>
                        );
                      })}
                      {/* Spacer rechts (Zellen nach dem sichtbaren Fenster). */}
                      <div style={{ width: `${(totalDays - visTo) * COL}rem` }} className="shrink-0" />

                      {/* Gestrichelter Rahmen um den ausgewählten Block */}
                      {(() => {
                        const active = drag ?? sel;
                        if (!active || active.pid !== p.id) return null;
                        const lo = Math.min(active.from, active.to);
                        const hi = Math.max(active.from, active.to);
                        return (
                          <div
                            className="pointer-events-none absolute inset-y-0 border-2 border-dashed border-neutral-500"
                            style={{
                              left: `calc(${lo} * ${COL}rem)`,
                              width: `calc(${hi - lo + 1} * ${COL}rem)`,
                            }}
                          />
                        );
                      })()}

                      {/* Balken über belegte/gesperrte Zeiträume. Gebuchte Balken
                        zeigen den Gastnamen + Kanal-Icon und sind klickbar
                        (Detail-Popover). */}
                      {segs.map((seg, i) => {
                        const clickable = seg.status === "booked" && !!seg.reservation;
                        // Gebuchte Balken: Kanal-Farbakzent + Logo (Herkunft sofort
                        // erkennbar). Gesperrte: neutraler Block-Stil.
                        const meta = channelMeta(seg.source);
                        // Anzeige-Status (inkl. abgeleitetem „eingecheckt") für
                        // Farb-Punkt + reichen Tooltip.
                        const dispStatus: DisplayStatus | null = seg.reservation
                          ? reservationStatus(seg.reservation, todayKey)
                          : null;
                        const statusMeta = dispStatus ? STATUS_META[dispStatus] : null;
                        // Eigentümer-Aufenthalt (0241): belegt wie eine Buchung,
                        // aber kein Vertriebskanal und kein Umsatz — deshalb weder
                        // Kanalfarbe noch Kanal-Logo, sondern eigene Kennzeichnung.
                        const ownerStay =
                          seg.status === "booked" && !!seg.reservation?.is_owner_stay;
                        const nights = seg.span;
                        const barTitle = view.showDebug
                          ? debugOrigin(seg)
                          : seg.status === "booked"
                            ? [
                              segmentLabel(seg, t, channelLabel),
                              ownerStay
                                ? t("calendarBoard.ownerStay")
                                : channelLabel(seg.source as AvailabilitySource),
                              dispStatus ? statusLabel(dispStatus) : null,
                              t("calendarBoard.nightsCount", { count: nights }),
                            ]
                              .filter(Boolean)
                              .join(" · ")
                            : `${segmentLabel(seg, t, channelLabel)} · ${t("calendarBoard.daysCount", { count: seg.span })}`;
                        // Kanal-/Status-Filter: nicht passende Balken dimmen
                        // (Belegung bleibt erkennbar, Treffer stechen hervor).
                        const dimmed = filtersActive && !segMatchesFilters(seg);
                        // Option/vorläufig (pending) bekommt einen eigenen, klar
                        // unterscheidbaren Balken (amber + gestrichelt) statt der
                        // Kanalfarbe — eine Option darf nicht wie eine feste
                        // Buchung aussehen. Bestätigt/eingecheckt unverändert.
                        // Eigentümer-Aufenthalt vor allem anderen: er ist per
                        // Definition bestätigt, hat also nie den Options-Stil.
                        const bookedBar = ownerStay
                          ? OWNER_STAY_BAR
                          : (statusMeta?.barClass ?? `${meta.barBg} ${meta.barFg}`);
                        const barClass = `${seg.status === "booked"
                          ? bookedBar
                          : SEG_STYLE[seg.status]
                          } ${dimmed ? "opacity-25" : ""}`;
                        // Während IRGENDEIN Balken gezogen wird, lassen alle Balken
                        // Mausereignisse durch (damit die Zell-onMouseEnter feuert
                        // und den Tag-Offset liefert).
                        const dragging = !!barDrag;
                        const isThisDragged =
                          barDrag?.res.id === seg.reservation?.id && !!seg.reservation;
                        // Halbtags-Logik (Hotel-Standard) — gilt für JEDEN Balken,
                        // nicht nur für Buchungen: der Tag gehört morgens noch der
                        // Abreise und ab nachmittags der Anreise. Ein Balken beginnt
                        // deshalb zur Tagesmitte und läuft am letzten Tag bis zur
                        // Tagesmitte aus. So teilen sich zwei aufeinanderfolgende
                        // Belegungen den Wechseltag, statt sich zu überlagern.
                        //
                        // Früher galt das NUR für Buchungen. Eine Sperre direkt nach
                        // einer Abreise startete hart am linken Spaltenrand und schob
                        // sich sichtbar unter den abreisenden Gast — der Wechseltag
                        // sah aus wie eine Doppelbelegung.
                        //
                        // seg.span = belegte Nächte [start .. ende); am Fensterrand
                        // abgeschnittene Kanten bleiben voll, weil dort die echte
                        // Kante außerhalb liegt und ein Versatz eine Kante vortäuschte.
                        const firstDayKey = key(dates[0]);
                        const lastDayKey = key(dates[dates.length - 1]);
                        const isBooking = seg.status === "booked" && !!seg.reservation;
                        // Vorne: echte Kante im Fenster? Bei Buchungen entscheidet das
                        // Check-in-Datum. Ein Nicht-Buchungs-Balken (Sperre,
                        // Stop-Sell) bekommt den Versatz NUR, wenn direkt davor eine
                        // Buchung endet — dort läuft der Buchungsbalken bis zur
                        // Tagesmitte, und ohne Versatz schöbe sich die Sperre
                        // sichtbar darunter. Steht davor nichts, beginnt sie bündig:
                        // ein Versatz ins Leere täuschte eine Anreise vor.
                        const vortag = dates[seg.start - 1];
                        const nachAbreise =
                          !isBooking && !!vortag && !!resMap[key(vortag)];
                        const startsAtCheckIn = isBooking
                          ? seg.reservation!.check_in >= firstDayKey
                          : nachAbreise;
                        // Hinten: nur Buchungen laufen in den Abreisetag aus.
                        const endsAtCheckOut =
                          isBooking && seg.reservation!.check_out <= lastDayKey;
                        const leftPad = startsAtCheckIn ? HALF_DAY : 0;
                        // Breite: Nächte minus halbe Anreise-Spalte, plus halbe
                        // Auslauf-Spalte in den Abreisetag.
                        const widthCols =
                          seg.span
                          - (startsAtCheckIn ? HALF_DAY : 0)
                          + (endsAtCheckOut ? HALF_DAY : 0);
                        const barStyle = {
                          left: `calc(${seg.start + leftPad} * ${COL}rem + 0.25rem)`,
                          width: `calc(${widthCols} * ${COL}rem - 0.5rem)`,
                          height: "1.75rem",
                        };
                        const barInner = (
                          <>
                            {seg.status === "booked" &&
                              (ownerStay ? (
                                <Icon
                                  icon={OWNER_STAY_ICON}
                                  className="size-3 shrink-0"
                                />
                              ) : (
                                <ChannelLogo source={seg.source} />
                              ))}
                            {/* Zwei Achsen, zwei Symbole: Schloss = Sperre
                                (Verfügbarkeit 0), Verbotszeichen = Stop-Sell.
                                Liegt beides auf dem Tag, stehen BEIDE Symbole
                                nebeneinander — der Balken ist dann weder als
                                reine Sperre noch als reiner Stop-Sell lesbar. */}
                            {hasBlock(seg.status) && (
                              <Icon icon="ph:lock-simple" className="size-3 shrink-0" />
                            )}
                            {hasStopSell(seg.status) && (
                              <Icon icon="ph:prohibit" className="size-3 shrink-0" />
                            )}
                            {/* Status-Punkt (OPERA-Stil): bestätigt/Option/
                              eingecheckt/ausgecheckt/storniert. Beim Eigentümer-
                              Aufenthalt entfällt er — er ist immer bestätigt. */}
                            {statusMeta && !ownerStay && (
                              <span
                                className={`size-1.5 shrink-0 rounded-full ring-1 ring-white/60 ${statusMeta.dotBg}`}
                              />
                            )}
                            <span className="truncate">
                              {view.showDebug
                                ? `⟨${seg.status}⟩ ${seg.source}${
                                    hasStopSell(seg.status)
                                      ? ` /ss:${seg.stopSell?.source ?? "?"}:${
                                          seg.stopSell?.scope ?? "all"
                                        }`
                                      : ""
                                  }`
                                : segmentLabel(seg, t, channelLabel)}
                            </span>
                            {/* Indikatoren rechts: Gästezahl + Nächte (sofern Platz). */}
                            {seg.status === "booked" && seg.reservation && (
                              <span className="ml-auto flex shrink-0 items-center gap-1 text-[0.65rem] opacity-90">
                                <span className="flex items-center gap-0.5">
                                  <Icon icon="ph:user-fill" className="size-2.5" />
                                  {seg.reservation.num_guests}
                                </span>
                                {nights >= 3 && <span>· {nights}N</span>}
                              </span>
                            )}
                          </>
                        );
                        // Rechtsklick auf einen Sperr-/Stop-Sell-Balken öffnet das
                        // Kontextmenü (aufheben / Grund ändern). Einheitlich für
                        // BEIDE Achsen — der Nutzer sieht ja auch beide Balken.
                        // Buchungsbalken bleiben davon unberührt (sie haben Klick
                        // + Drag + Detail-Slider).
                        const contextable =
                          !!start && (hasBlock(seg.status) || hasStopSell(seg.status));
                        const onBarContextMenu = contextable
                          ? (ev: React.MouseEvent) => {
                            ev.preventDefault();
                            ev.stopPropagation();
                            setBarMenu({
                              x: ev.clientX,
                              y: ev.clientY,
                              pid: p.id,
                              title: p.title,
                              start: key(addDays(start, seg.start)),
                              end: key(addDays(start, seg.start + seg.span)),
                              status: seg.status,
                              blockSource: seg.source,
                              stopSellSource: seg.stopSell?.source,
                            });
                          }
                          : undefined;
                        // Manuelle Sperre ist per Klick aufhebbar (Popup) — OTA-/
                        // gebuchte Sperren nicht. Öffnet das Unblock-Popup mit dem
                        // Zeitraum des Balkens (Spalten → ISO, end exklusiv).
                        // Bei blocked_stop_sell bleibt der Klick auf der SPERRE:
                        // sie ist der Zustand, der den Tag wirklich zumacht; der
                        // Stop-Sell darunter läuft über das Rechtsklick-Menü.
                        const unblockable =
                          hasBlock(seg.status) &&
                          seg.source === "manual" &&
                          !!start;
                        if (unblockable) {
                          return (
                            <button
                              key={i}
                              type="button"
                              title={barTitle}
                              onContextMenu={onBarContextMenu}
                              onClick={(ev) => {
                                ev.stopPropagation();
                                setUnblockAt({
                                  pid: p.id,
                                  title: p.title,
                                  start: key(addDays(start, seg.start)),
                                  end: key(addDays(start, seg.start + seg.span)),
                                });
                              }}
                              className={`group absolute top-1/2 flex -translate-y-1/2 cursor-pointer items-center gap-1 overflow-hidden rounded-full px-2 text-xs font-medium transition-shadow hover:ring-2 hover:ring-accent/40 ${barClass} ${dragging ? "pointer-events-none" : ""}`}
                              style={barStyle}
                            >
                              {barInner}
                            </button>
                          );
                        }
                        if (!clickable) {
                          return (
                            <div
                              key={i}
                              title={barTitle}
                              onContextMenu={onBarContextMenu}
                              className={`absolute top-1/2 flex -translate-y-1/2 items-center gap-1 overflow-hidden rounded-full px-2 text-xs font-medium ${barClass} ${dragging ? "pointer-events-none" : ""}`}
                              style={barStyle}
                            >
                              {barInner}
                            </div>
                          );
                        }
                        const res = seg.reservation as Reservation;
                        return (
                          <div
                            key={i}
                            title={barTitle}
                            onMouseDown={(ev) => {
                              ev.stopPropagation();
                              onBarDown(res, p.id, "move", ev);
                            }}
                            // Während IRGENDEIN Balken gezogen wird, müssen ALLE
                            // Balken — auch der gezogene — Mausereignisse durch-
                            // lassen, sonst klebt der gezogene Balken am Cursor und
                            // die Zell-onMouseEnter der Zielzeile/Kante feuern nie
                            // (→ Move in andere Objekte & Resize blieben wirkungslos).
                            className={`group absolute top-1/2 flex -translate-y-1/2 cursor-grab items-center gap-1 overflow-hidden rounded-full px-2 text-xs font-medium transition-shadow hover:ring-2 hover:ring-accent/40 ${barClass} ${isThisDragged ? "opacity-60 ring-2 ring-accent" : ""} ${dragging ? "pointer-events-none" : ""}`}
                            style={barStyle}
                          >
                            {/* Resize-Kante links (Check-in). */}
                            <span
                              role="presentation"
                              onMouseDown={(ev) => {
                                ev.stopPropagation();
                                onBarDown(res, p.id, "start", ev);
                              }}
                              className="absolute left-0 top-0 h-full w-2 cursor-ew-resize opacity-0 group-hover:opacity-100"
                            />
                            {barInner}
                            {/* Resize-Kante rechts (Check-out). */}
                            <span
                              role="presentation"
                              onMouseDown={(ev) => {
                                ev.stopPropagation();
                                onBarDown(res, p.id, "end", ev);
                              }}
                              className="absolute right-0 top-0 h-full w-2 cursor-ew-resize opacity-0 group-hover:opacity-100"
                            />
                          </div>
                        );
                      })}

                      {/* Geister-Vorschau des verschobenen/resizten Balkens in
                        DIESER Zeile (Zielobjekt bei move, sonst gleiches Objekt). */}
                      {barDrag && start && (() => {
                        const { ci, co, pid } = barDragTarget(barDrag);
                        if (pid !== p.id) return null;
                        const ciIdx = Math.round(
                          (new Date(`${ci}T00:00:00`).getTime() - start.getTime()) / 86400000,
                        );
                        const coIdx = Math.round(
                          (new Date(`${co}T00:00:00`).getTime() - start.getTime()) / 86400000,
                        );
                        const span = Math.max(1, coIdx - ciIdx);
                        return (
                          <div
                            className="pointer-events-none absolute top-1/2 -translate-y-1/2 rounded-full border-2 border-dashed border-accent bg-accent/15"
                            // Halbtags wie die echten Balken (HALF_DAY): startet in der
                            // Anreisemitte und läuft bis zur Abreisemitte — so deckt die
                            // Vorschau exakt den Zielzustand und teilt sich den Wechseltag
                            // sichtbar mit einem Bestandsbalken (statt ganztags zu wirken).
                            style={{
                              left: `calc(${ciIdx + HALF_DAY} * ${COL}rem + 0.25rem)`,
                              width: `calc(${span} * ${COL}rem - 0.5rem)`,
                              height: "1.75rem",
                            }}
                          />
                        );
                      })()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Card>

      {/* Stop-Sell aus dem Belegungsplan: DASSELBE Panel wie im Stop-Sell-
          Kalender (Grundauswahl, Notiz, Wochentagsmaske, Adressat) — nur mit
          vorbelegtem Objekt/Zeitraum und als Overlay. Bewusst keine zweite
          Kopie der Stop-Sell-Logik. */}
      {stopSellSel && (
        <StopSellPanel
          variant="overlay"
          selection={stopSellSel}
          stops={Object.values(stopSell[stopSellSel.propertyId] ?? {})}
          bookedDates={
            new Set(
              Object.keys(
                reservationsByDay(resByProp[stopSellSel.propertyId] ?? []),
              ),
            )
          }
          agencies={agencies}
          onClose={() => setStopSellSel(null)}
          // Kein load(): das stop_sell-Abo liefert die neuen Zeilen.
          onDone={() => setStopSellSel(null)}
        />
      )}

      {/* Rechtsklick-Menü auf einem Sperr-/Stop-Sell-Balken */}
      {barMenu && (
        <>
          <div className="fixed inset-0 z-40" onMouseDown={() => setBarMenu(null)} />
          <div
            className="fixed z-50 w-64 overflow-hidden rounded-(--radius) border bg-popover py-1 text-popover-foreground shadow-md"
            style={{
              left: `min(${barMenu.x}px, calc(100vw - 17rem))`,
              top: `${barMenu.y + 8}px`,
            }}
          >
            <p className="px-3 py-1.5 text-xs text-muted-foreground">
              {barMenu.title} · {statusLabels(t)[barMenu.status]}
            </p>
            <div className="my-1 h-px bg-border" />

            {/* Sperre aufheben — nur bei einer EIGENEN (manuellen) Sperre.
                Eine vom Portal/aus einer Buchung stammende Sperre gehört uns
                nicht; dafür gibt es hier keinen Weg. */}
            {hasBlock(barMenu.status) && barMenu.blockSource === "manual" && (
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setUnblockAt({
                    pid: barMenu.pid,
                    title: barMenu.title,
                    start: barMenu.start,
                    end: barMenu.end,
                  });
                  setBarMenu(null);
                }}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-accent/10 disabled:pointer-events-none disabled:text-muted-foreground/50"
              >
                <Icon icon="ph:lock-simple-open" className="size-4 shrink-0 text-muted-foreground" />
                {t("board.unblock")}
              </button>
            )}

            {/* Stop-Sell aufheben — für JEDEN Stopp, unabhängig von der
                Herkunft. Über die eigene Verfügbarkeit entscheidet der Betrieb;
                `source` sagt nur, über welchen Weg die Zeile hereinkam. */}
            {hasStopSell(barMenu.status) && (
              <button
                type="button"
                disabled={saving}
                onClick={confirmClearStopSell}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-accent/10 disabled:pointer-events-none disabled:text-muted-foreground/50"
              >
                <Icon icon="ph:prohibit" className="size-4 shrink-0 text-muted-foreground" />
                {saving
                  ? t("board.stopSellClearing")
                  : t("board.stopSellClear")}
              </button>
            )}

            {/* Grund ändern = neu setzen mit Grund (dasselbe Panel). Auch für
                importierte Stopps: das Neusetzen schreibt eine eigene Zeile mit
                Grund und macht aus dem herkunftslosen Balken einen erklärten. */}
            {hasStopSell(barMenu.status) && (
              <button
                type="button"
                disabled={saving}
                onClick={() => {
                  setStopSellSel({
                    propertyId: barMenu.pid,
                    propertyTitle: barMenu.title,
                    start: barMenu.start,
                    // Panel erwartet das Ende INKLUSIV, barMenu.end ist exklusiv.
                    end: key(addDays(new Date(`${barMenu.end}T00:00:00`), -1)),
                  });
                  setBarMenu(null);
                }}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-accent/10 disabled:pointer-events-none disabled:text-muted-foreground/50"
              >
                <Icon icon="ph:note-pencil" className="size-4 shrink-0 text-muted-foreground" />
                {t("board.stopSellEditReason")}
              </button>
            )}
          </div>
        </>
      )}

      {/* Reservierungs-Assistent (3 Schritte, eigene Komponente) */}
      {wizard && (
        <ReservationWizard
          open
          onClose={() => setWizard(null)}
          onSaved={() => load()}
          properties={properties.map((p) => ({ id: p.id, title: p.title }))}
          initialPropertyId={wizard.pid}
          checkIn={wizard.checkIn}
          checkOut={wizard.checkOut}
          basePrice={0}
          initialOwnerStay={wizard.ownerStay ?? false}
        />
      )}

      {/* Bulk-Edit (Preis/Min-Stay/Sperre über Zeitraum × Objekte) */}
      {bulk && start && (
        <BulkEditDialog
          open
          rangeLabel={spellDateRange(bulk.checkIn, bulk.checkOut)}
          start={bulk.checkIn}
          end={bulk.checkOut}
          primaryProperty={{
            id: bulk.pid,
            title: properties.find((p) => p.id === bulk.pid)?.title ?? "Objekt",
          }}
          allProperties={properties.map((p) => ({ id: p.id, title: p.title }))}
          ratePlans={bulkPlans}
          onClose={() => {
            setBulk(null);
            setBulkPlans([]);
          }}
          onApplied={() => load()}
        />
      )}

      {/* Buchungsdetail (Klick auf einen Balken) — voller Slider von rechts */}
      {detail && (
        <ReservationDetailSlider
          reservationId={detail}
          todayKey={todayKey}
          onClose={() => setDetail(null)}
          onCancelled={() => {
            setDetail(null);
            load();
          }}
          onChanged={load}
        />
      )}

      {/* Bestätigung vor dem Verschieben/Resizen (Schutz vor Versehen) */}
      {unblockAt && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/40 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="mb-2 flex items-center gap-2">
              <Icon icon="ph:lock-simple-open" className="size-5 text-accent" />
              <h3 className="font-display text-lg font-extrabold">{t("board.unblockTitle")}</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              {t("board.unblockText", {
                title: unblockAt.title,
                start: unblockAt.start,
              })}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="ghost"
                onClick={() => setUnblockAt(null)}
                disabled={saving}
              >
                {t("board.cancel")}
              </Button>
              <Button onClick={confirmUnblock} disabled={saving}>
                {saving ? t("board.unblocking") : t("board.unblock")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {pendingMove && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-foreground/40 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <div className="mb-2 flex items-center gap-2">
              <Icon icon="ph:arrows-left-right" className="size-5 text-accent" />
              <h3 className="font-display text-lg font-extrabold">
                {pendingMove.mode === "move"
                  ? t("board.moveTitle")
                  : t("board.resizeTitle")}
              </h3>
            </div>
            <p className="text-sm text-muted-foreground">
              {pendingMove.res.guest_name?.trim() || t("board.bookingFallback")} →{" "}
              <span className="font-medium text-foreground">
                {properties.find((p) => p.id === pendingMove.targetPid)?.title ?? t("board.propertyFallback")}
              </span>
              , {pendingMove.ci} – {pendingMove.co}.
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("board.moveRecheck")}
            </p>
            {/* Preisverhalten bei echtem OBJEKTWECHSEL (nicht Resize): protel-Modell
                — „Preis behalten" (kostenloses Upgrade / vereinbarter Preis bleibt
                bindend) ODER „Preis neu berechnen" (Upsell, Ziel-Objekt-Rate + der
                korrekte Beherbergungs-Steuersatz je Objekt-Land). Bei Resize am
                selben Objekt gibt es nur das schlichte Verschieben. */}
            {pendingMove.targetPid !== pendingMove.res.property_id ? (
              <>
                <p className="mt-3 text-xs text-muted-foreground">
                  {t.rich("board.movePriceHint", {
                    b: (c) => <b>{c}</b>,
                  })}
                </p>
                <div className="mt-5 flex flex-col gap-2">
                  <Button onClick={() => confirmMove(false)} disabled={saving}>
                    {saving ? t("board.moving") : t("board.moveKeepPrice")}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => confirmMove(true)}
                    disabled={saving}
                  >
                    {saving ? t("board.moving") : t("board.moveRecalcPrice")}
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setPendingMove(null)}
                    disabled={saving}
                  >
                    {t("board.cancel")}
                  </Button>
                </div>
              </>
            ) : (
              <div className="mt-5 flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => setPendingMove(null)}
                  disabled={saving}
                >
                  {t("board.cancel")}
                </Button>
                <Button onClick={() => confirmMove(false)} disabled={saving}>
                  {saving ? "Verschiebe…" : "Verschieben"}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// Eine Kennzahl in der Auslastungsleiste.
function Metric({
  icon,
  label,
  value,
  hint,
}: {
  icon: string;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <div className="flex items-center gap-2">
      <Icon icon={icon} className="size-4 text-muted-foreground" />
      <div className="flex flex-col leading-tight">
        <span className="font-display font-extrabold">{value}</span>
        <span className="text-xs text-muted-foreground">
          {label} · {hint}
        </span>
      </div>
    </div>
  );
}

// Kompaktes Filter-Dropdown (natives select, zugänglich + tastaturbedienbar).
function FilterSelect({
  value,
  onChange,
  allLabel,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  allLabel: string;
  options: { value: string; label: string }[];
}) {
  return (
    <NativeSelect
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label={allLabel}
      className="h-9 w-auto"
    >
      <option value="all">{allLabel}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </NativeSelect>
  );
}


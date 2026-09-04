"use client";

// Einzelansicht (klassischer 7×N-Kalender wie Airbnb/Booking-Host):
// EIN Objekt, ENDLOS scrollbare Monate untereinander. Jede Zelle zeigt Status
// (frei/gebucht/gesperrt aus der availability), Tagespreis, Mindestaufenthalt
// und CTA/CTD-Sperren als Schloss-Icons. Darüber liegen die BUCHUNGSBALKEN mit
// Gastname und Kanalfarbe — wie in der Timeline: „gebucht" allein sagt nicht,
// WER da ist. Realtime auf den relevanten Tabellen, kein Polling.
//
// BEARBEITBAR SEIT 31.08.2026. Bis dahin war diese Ansicht ein reines Schaubild:
// im ganzen Gitter gab es genau EINEN Klick-Handler („Heute"), die 42 Zellen je
// Monat waren tote Fläche und die Buchungsbalken trugen `pointer-events-none`.
// Gemeldet als „in der Einzelansicht vom Kalender eines Hauses kann ich gar
// nichts bearbeiten, keine Sperrungen reinlegen oder löschen oder verschieben".
//
// Jetzt kann sie, was der Belegungsplan kann:
//   * über Tage ZIEHEN → Aktionsmenü (Sperrzeitraum, Reservierung,
//     Eigennutzung, Stop-Sell, Preis/Min-Stay)
//   * Klick auf eine bestehende SPERRE → aufheben
//   * Klick auf einen BALKEN → Buchungsdetail (dort auch verschieben)
//
// WARUM DIESELBEN BAUSTEINE, NICHT EIGENE: `CalendarActionMenu`,
// `ReservationWizard`, `BulkEditDialog`, `StopSellPanel` und
// `ReservationDetailSlider` sind exakt die Elemente des Belegungsplans. Eine
// zweite Umsetzung wäre eine zweite Wahrheit, die beim nächsten Feature
// auseinanderläuft — und die Nächte-Rechnung (`checkOut = letzter Tag + 1`)
// muss ohnehin identisch sein, sonst sperrt dieselbe Geste in zwei Ansichten
// verschiedene Zeiträume.
//
// Scrollen ist unbegrenzt (keine Datumsgrenze). Begrenzt ist NUR, wie viele
// Monate gleichzeitig im DOM hängen (WINDOW): beim Scrollen wandert das Fenster
// mit, alte Monate fallen raus und werden beim Zurückscrollen neu aufgebaut.
// Ohne das lägen nach längerem Scrollen hunderte Gitter à 42 Zellen im Browser.
import { Icon } from "@iconify/react";
import { useTranslations, useLocale } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { toast } from "sonner";

import type { Prop } from "@/components/kalender/calendar-board";
import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import { NativeSelect } from "@nextdays/ui/native-select";
import { BulkEditDialog } from "@/components/kalender/bulk-edit-dialog";
import { CalendarActionMenu } from "@/components/kalender/calendar-action-menu";
import { ReservationDetailSlider } from "@/components/kalender/reservation-detail-slider";
import { ReservationWizard } from "@/components/kalender/reservation-wizard";
import {
  type AgencyOption,
  StopSellPanel,
  type StopSellSelection,
} from "@/components/stop-sell/stop-sell-panel";
import {
  type DayAvailability,
  type StopSellDay,
  blockRange,
  getAvailability,
  unblockRange,
} from "@/lib/calendar";
import { channelMeta } from "@/lib/calendar-channels";
import {
  OWNER_STAY_BAR,
  OWNER_STAY_ICON,
  STATUS_META,
  reservationStatus,
} from "@/lib/calendar-status";
import { barSegments, channelSource, dateKey } from "@/lib/calendar-views";
import { type Reservation, listReservations } from "@/lib/reservations";
import { listAgencies } from "@/lib/travel-agencies";
import { formatCurrency } from "@/lib/utils";
import { getBoard } from "@/lib/calendar";
import { useRealtime } from "@/lib/use-realtime";

// Monate gleichzeitig im DOM. Beim Scrollen wandert das Fenster mit.
const WINDOW = 12;
// Der laufende Monat steht oben; so viele folgen beim ersten Rendern.
// Vergangenheit kommt erst beim Hochscrollen dazu.
const INITIAL_FORWARD = 4;

// Ein Monat als fortlaufende Zahl (Jahr*12 + Monat) — damit Vor/Zurück reines
// Rechnen ist und kein Jahreswechsel-Sonderfall entsteht.
type MonthIndex = number;

function toIndex(year: number, month: number): MonthIndex {
  return year * 12 + month;
}
function indexYear(i: MonthIndex): number {
  return Math.floor(i / 12);
}
function indexMonth(i: MonthIndex): number {
  return ((i % 12) + 12) % 12;
}

// Erster Gittertag (Montag der Woche, in der der Monatserste liegt) und Anzahl
// der 7er-Wochen für den Monat. Mo=0 … So=6.
function gridStart(year: number, month: number): Date {
  const first = new Date(year, month, 1);
  const dow = (first.getDay() + 6) % 7; // Mo=0
  const d = new Date(first);
  d.setDate(first.getDate() - dow);
  return d;
}
function weeksInMonth(year: number, month: number): number {
  const start = gridStart(year, month);
  const lastDay = new Date(year, month + 1, 0);
  const diff = Math.round(
    (lastDay.getTime() - start.getTime()) / 86_400_000,
  );
  return Math.ceil((diff + 1) / 7);
}

export function CalendarMonthGridView({
  properties,
  initialPropertyId,
  viewSwitcher,
}: {
  properties: Prop[];
  initialPropertyId?: string | null;
  /** Ansicht-Umschalter des Kalenders — steht in DIESER Steuerzeile, damit
   *  nicht zwei Auswahlfelder untereinander stehen. */
  viewSwitcher?: React.ReactNode;
}) {
  const t = useTranslations("calendar");
  // „Abbrechen" steht app-weit in `common` — keine vierte Kopie desselben Worts.
  const tGemein = useTranslations("common");
  const today = useMemo(() => new Date(), []);
  const todayIndex = useMemo(
    () => toIndex(today.getFullYear(), today.getMonth()),
    [today],
  );
  const [propertyId, setPropertyId] = useState<string>(
    initialPropertyId || properties[0]?.id || "",
  );

  // Sichtbares Monatsfenster [from, to] — wächst beim Scrollen an einem Ende
  // und schrumpft am anderen, sobald WINDOW überschritten wird.
  const [from, setFrom] = useState<MonthIndex>(todayIndex);
  const [to, setTo] = useState<MonthIndex>(todayIndex + INITIAL_FORWARD);

  // Buchungen + Währung liegen beim Elternteil: sie gelten fürs ganze Objekt,
  // nicht je Monat. Ein einziger Call statt einem pro Monatsblock.
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [currency, setCurrency] = useState<string | null>(null);

  // --- Bearbeiten: Auswahl, Menü, Dialoge -----------------------------------
  // Gezogener Zeitraum in TAGESSCHLÜSSELN (nicht Indizes wie im Belegungsplan):
  // dort ist der Zeitstrahl ein durchgehendes Array, hier sind es getrennte
  // Monatsgitter, deren Zellen auch in den Nachbarmonat ragen. Ein Index wäre
  // je Monatsblock ein anderer.
  const [zug, setZug] = useState<{ von: string; bis: string } | null>(null);
  const [sel, setSel] = useState<{ von: string; bis: string } | null>(null);
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null);
  const [saving, setSaving] = useState(false);
  // Sperre, die per Klick aufgehoben werden soll (Rückfrage vor dem Schreiben).
  const [unblockAt, setUnblockAt] = useState<{ start: string; end: string } | null>(
    null,
  );
  const [wizard, setWizard] = useState<{
    checkIn: string;
    checkOut: string;
    ownerStay?: boolean;
  } | null>(null);
  const [bulk, setBulk] = useState<{ checkIn: string; checkOut: string } | null>(
    null,
  );
  const [stopSellSel, setStopSellSel] = useState<StopSellSelection | null>(null);
  // Vorhandene Stop-Sell-Tage des Objekts (Eingabe für das Panel).
  const [stops, setStops] = useState<StopSellDay[]>([]);
  const [agencies, setAgencies] = useState<AgencyOption[]>([]);
  // Geöffnetes Buchungsdetail (Klick auf einen Balken) — der Slider lädt selbst.
  const [detail, setDetail] = useState<string | null>(null);
  // Vom Elternteil sofort angewandte Tagesänderungen, die die Monatsblöcke
  // überlagern. WARUM: Eine Sperre schreibt seit dem Einheiten-Modell (0266)
  // EINE ZEILE JE EINHEIT — das availability-Abo liefert also n Ereignisse für
  // denselben Tag. Bleibt eines aus oder kommt verspätet, stünde der Tag
  // weiter auf „frei", während die Datenbank längst `blocked` sagt: die Sperre
  // wäre gesetzt und trotzdem unsichtbar (im Belegungsplan live beobachtet,
  // siehe `confirmBlock` dort). Das Abo bestätigt diesen Stand danach
  // idempotent.
  const [ueberlagerung, setUeberlagerung] = useState<
    Record<string, DayAvailability["status"] | null>
  >({});

  const todayKey = useMemo(() => dateKey(today), [today]);

  const weekdays = useMemo(
    () => [
      t("monthGridView.weekdayMon"),
      t("monthGridView.weekdayTue"),
      t("monthGridView.weekdayWed"),
      t("monthGridView.weekdayThu"),
      t("monthGridView.weekdayFri"),
      t("monthGridView.weekdaySat"),
      t("monthGridView.weekdaySun"),
    ],
    [t],
  );
  const months = useMemo(
    () => [
      t("monthGridView.monthJanuary"),
      t("monthGridView.monthFebruary"),
      t("monthGridView.monthMarch"),
      t("monthGridView.monthApril"),
      t("monthGridView.monthMay"),
      t("monthGridView.monthJune"),
      t("monthGridView.monthJuly"),
      t("monthGridView.monthAugust"),
      t("monthGridView.monthSeptember"),
      t("monthGridView.monthOctober"),
      t("monthGridView.monthNovember"),
      t("monthGridView.monthDecember"),
    ],
    [t],
  );

  // Objektweite Daten (Buchungen für die Balken, Währung für die Preise).
  const loadProperty = useCallback(async () => {
    if (!propertyId) {
      setReservations([]);
      setCurrency(null);
      return;
    }
    const res = await listReservations(propertyId);
    if (res.ok) setReservations(res.data.items);
  }, [propertyId]);

  useEffect(() => {
    void loadProperty();
  }, [loadProperty]);

  // Währung aus dem Rate-Plan (zuverlässige Preisquelle, unabhängig von
  // Buchungen) UND die Stop-Sell-Tage des Objekts.
  //
  // Beides aus DEMSELBEN Board-Call: er liefert Tagesdaten und Stop-Sells in
  // einem Rutsch, und das Stop-Sell-Panel verlangt die vorhandenen Stopps, um
  // Überschneidungen zu melden. Ein zweiter Endpunkt dafür wäre ein zweiter
  // Weg zu denselben Daten.
  //
  // Der Zeitraum ist hier ein JAHR um den Fensteranfang, nicht eine Woche wie
  // zuvor: für die Währung genügte ein kurzer Ausschnitt, für die Stopps nicht
  // — sonst kennte das Panel nur die Stopps der ersten Woche und meldete eine
  // Überschneidung nicht, die es gibt (Wurzel 5: eine Prüfung, die stumm
  // danebengreift, ist schlimmer als keine).
  useEffect(() => {
    if (!propertyId) return;
    let aktiv = true;
    const start = gridStart(indexYear(from), indexMonth(from));
    const endExcl = new Date(start);
    endExcl.setFullYear(start.getFullYear() + 1);
    void getBoard([propertyId], dateKey(start), dateKey(endExcl)).then((b) => {
      if (!aktiv || !b.ok) return;
      const item = b.data.items.find((it) => it.property_id === propertyId);
      setCurrency(item?.currency ?? null);
      setStops(item?.stop_sell ?? []);
    });
    return () => {
      aktiv = false;
    };
    // `from` bewusst NICHT in den Deps: Währung und Stopps hängen am Objekt,
    // nicht am Monat — sonst liefe bei jedem Scrollschritt ein Board-Call mit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertyId]);

  // Gebuchte Tage des Objekts: für Stop-Sell tabu, das Panel schließt sie aus
  // der Auswahl aus. Aus den ohnehin geladenen Buchungen abgeleitet, kein
  // eigener Abruf.
  const bookedDates = useMemo(() => {
    const out = new Set<string>();
    for (const r of reservations) {
      if (r.status === "cancelled") continue;
      const end = new Date(`${r.check_out}T00:00:00`);
      for (
        let d = new Date(`${r.check_in}T00:00:00`);
        d < end;
        d.setDate(d.getDate() + 1)
      ) {
        out.add(dateKey(d));
      }
    }
    return out;
  }, [reservations]);

  // Reisebüros als Stop-Sell-Adressaten (nur wenn das Panel aufgeht gebraucht,
  // aber einmalig geladen — die Liste ist kurz und ändert sich selten).
  useEffect(() => {
    void listAgencies().then((r) => {
      if (r.ok) setAgencies(r.data.items.map((a) => ({ id: a.id, name: a.name })));
    });
  }, []);

  // --- Auswahl per Ziehen ---------------------------------------------------
  // Gezogen wird über TAGE, nicht über Indizes: die Auswahl darf über einen
  // Monatswechsel hinauslaufen (Sperre vom 28.09. bis 03.10.), und die
  // Monatsblöcke sind getrennte Gitter.
  const zugAktiv = useRef(false);

  const zugStart = useCallback((tag: string) => {
    zugAktiv.current = true;
    setZug({ von: tag, bis: tag });
    setSel(null);
    setMenuAt(null);
  }, []);

  const zugUeber = useCallback((tag: string) => {
    if (!zugAktiv.current) return;
    setZug((z) => (z ? { ...z, bis: tag } : null));
  }, []);

  // Loslassen wird GLOBAL abgefangen, nicht je Zelle: lässt der Nutzer außerhalb
  // des Gitters los (über der Kopfzeile, neben dem Kasten), käme sonst nie ein
  // Ende — die Auswahl bliebe kleben und jede weitere Mausbewegung würde sie
  // verändern.
  useEffect(() => {
    function ende(e: MouseEvent) {
      if (!zugAktiv.current) return;
      zugAktiv.current = false;
      setZug((z) => {
        if (z) {
          setSel(z);
          setMenuAt({ x: e.clientX, y: e.clientY });
        }
        return null;
      });
    }
    window.addEventListener("mouseup", ende);
    return () => window.removeEventListener("mouseup", ende);
  }, []);

  // Auswahl (gezogen oder festgestellt) als Menge von Tagesschlüsseln — die
  // Monatsblöcke fragen damit je Zelle „bin ich markiert?".
  const markiert = useMemo(() => {
    const a = zug ?? sel;
    if (!a) return new Set<string>();
    const [lo, hi] = a.von <= a.bis ? [a.von, a.bis] : [a.bis, a.von];
    const out = new Set<string>();
    for (let d = new Date(`${lo}T00:00:00`); dateKey(d) <= hi; d.setDate(d.getDate() + 1)) {
      out.add(dateKey(d));
    }
    return out;
  }, [zug, sel]);

  /** Auswahl als Zeitraum. `ende` ist EXKLUSIV (Abreisetag), `letzter` der
   *  letzte belegte Tag — genau die Rechnung des Belegungsplans: eine markierte
   *  Zelle ist die NACHT auf den Folgetag, nicht ein Kalendertag. Wer hier in
   *  Tagen rechnet, sperrt eine Nacht zu wenig. */
  const zeitraum = useCallback((a: { von: string; bis: string }) => {
    const [lo, hi] = a.von <= a.bis ? [a.von, a.bis] : [a.bis, a.von];
    const nachTag = new Date(`${hi}T00:00:00`);
    nachTag.setDate(nachTag.getDate() + 1);
    let n = 0;
    for (let d = new Date(`${lo}T00:00:00`); dateKey(d) <= hi; d.setDate(d.getDate() + 1)) {
      n += 1;
    }
    return { start: lo, letzter: hi, ende: dateKey(nachTag), naechte: n };
  }, []);

  const auswahlZuruecksetzen = useCallback(() => {
    setSel(null);
    setMenuAt(null);
  }, []);

  /** Sperre setzen. Der lokale Sofort-Stand ist Pflicht, nicht Kosmetik —
   *  Begründung an `ueberlagerung`. */
  const sperren = useCallback(async () => {
    if (!sel || !propertyId) return;
    const { start, letzter, ende } = zeitraum(sel);
    setSaving(true);
    const res = await blockRange(propertyId, start, ende);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setUeberlagerung((prev) => {
      const next = { ...prev };
      for (let d = new Date(`${start}T00:00:00`); dateKey(d) <= letzter; d.setDate(d.getDate() + 1)) {
        next[dateKey(d)] = "blocked";
      }
      return next;
    });
    auswahlZuruecksetzen();
  }, [sel, propertyId, zeitraum, auswahlZuruecksetzen]);

  /** Sperre aufheben. `end` ist exklusiv, der letzte gesperrte Tag ist end-1. */
  const entsperren = useCallback(async () => {
    if (!unblockAt || !propertyId) return;
    setSaving(true);
    const res = await unblockRange(propertyId, unblockAt.start, unblockAt.end);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setUeberlagerung((prev) => {
      const next = { ...prev };
      for (
        let d = new Date(`${unblockAt.start}T00:00:00`);
        dateKey(d) < unblockAt.end;
        d.setDate(d.getDate() + 1)
      ) {
        // null = „dieser Tag ist NICHT mehr gesperrt", bis das Abo den echten
        // Stand nachliefert. Ein `delete` würde stattdessen den alten
        // Server-Stand („blocked") wieder durchscheinen lassen.
        next[dateKey(d)] = null;
      }
      return next;
    });
    setUnblockAt(null);
  }, [unblockAt, propertyId]);

  // Realtime: Buchungen speisen die Balken. Preis/Belegung je Monat hört der
  // jeweilige MonthBlock selbst ab (er kennt seinen Zeitraum).
  useRealtime({ table: "reservations", onChange: loadProperty });

  // Objektwechsel: zurück zum Startfenster ab heute.
  const scrollBox = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    setFrom(todayIndex);
    setTo(todayIndex + INITIAL_FORWARD);
    scrollBox.current?.scrollTo({ top: 0 });
  }, [propertyId, todayIndex]);

  const sentinelDown = useRef<HTMLDivElement | null>(null);
  const sentinelUp = useRef<HTMLDivElement | null>(null);
  // Sperre je Richtung: nach einem Nachladen bleibt die Sentinel im Blick
  // (sie wird ans neue Listenende mitgeschoben) und der Observer meldet
  // sofort erneut „sichtbar". Ohne die Sperre lädt er in einem Rutsch bis
  // zum WINDOW-Anschlag durch — die Seite wächst, ohne dass jemand scrollt.
  // Freigegeben wird erst, wenn die Sentinel den Blick wirklich verlassen hat.
  const sperreUnten = useRef(false);
  const sperreOben = useRef(false);

  // Beide Observer messen gegen den Scroll-Kasten (`root`), nicht gegen das
  // Browserfenster — sonst gälte ein Sentinel als sichtbar, sobald der KASTEN
  // im Blick ist, und es liefe endlos nach.
  useEffect(() => {
    const el = sentinelDown.current;
    const box = scrollBox.current;
    if (!el || !box) return;
    const io = new IntersectionObserver((entries) => {
      const sichtbar = entries[0]?.isIntersecting ?? false;
      if (!sichtbar) {
        sperreUnten.current = false;
        return;
      }
      if (sperreUnten.current) return;
      sperreUnten.current = true;
      // Beide Enden aus EINER Wahrheit rechnen: das neue Ende bestimmt, ob
      // vorne einer rausfällt. `to` aus der Closure wäre hier veraltet.
      setTo((prevTo) => {
        const nextTo = prevTo + 1;
        setFrom((prevFrom) =>
          nextTo - prevFrom + 1 > WINDOW ? prevFrom + 1 : prevFrom,
        );
        return nextTo;
      });
    }, { root: box });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Vergangenheit lädt NUR auf echtes Hochscrollen nach — sonst wandert das
  // Fenster beim ersten Rendern rückwärts und man landet statt auf heute im
  // letzten Jahr.
  useEffect(() => {
    const el = sentinelUp.current;
    const box = scrollBox.current;
    if (!el || !box) return;
    const io = new IntersectionObserver((entries) => {
      const sichtbar = entries[0]?.isIntersecting ?? false;
      if (!sichtbar) {
        sperreOben.current = false;
        return;
      }
      if (sperreOben.current) return;
      if (box.scrollTop <= 0) return; // ganz oben: erst scrollen, dann laden
      sperreOben.current = true;
      // Höhe VOR dem Einfügen merken und die Scrollposition um den Zuwachs
      // korrigieren — sonst springt der Blick, sobald oben ein Monat
      // eingehängt wird.
      const vorher = box.scrollHeight;
      setFrom((prevFrom) => {
        const nextFrom = prevFrom - 1;
        setTo((prevTo) =>
          prevTo - nextFrom + 1 > WINDOW ? prevTo - 1 : prevTo,
        );
        return nextFrom;
      });
      requestAnimationFrame(() => {
        box.scrollTop += box.scrollHeight - vorher;
      });
    }, { root: box });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const goToday = () => {
    setFrom(todayIndex);
    setTo(todayIndex + INITIAL_FORWARD);
    scrollBox.current?.scrollTo({ top: 0 });
  };

  // Ziehen zum Scrollen: die Scrollbar ist ausgeblendet, und ohne Mausrad
  // (Trackpad-lose Maus, Touchscreen-Kiosk) gäbe es sonst keinen Weg durch die
  // Monate. Pointer Events statt Mouse Events, damit Maus, Stift und Finger
  // denselben Pfad nehmen.
  const zieht = useRef(false);
  const startY = useRef(0);
  const startTop = useRef(0);
  // Nur WÄHREND des Ziehens die Textauswahl aussetzen — dauerhaft gesetzt
  // könnte man einen Gastnamen nie markieren und kopieren.
  const [ziehtAktiv, setZiehtAktiv] = useState(false);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // Nur die primäre Taste; Rechts-/Mittelklick bleiben dem Browser.
    if (e.button !== 0) return;
    // Auf einer TAGESZELLE gewinnt das Aufziehen einer Auswahl, nicht das
    // Greif-Scrollen: beide Gesten sind „linke Taste halten und ziehen" und
    // schließen einander aus. Ohne diese Trennung scrollt der Kasten weg,
    // während der Nutzer eine Sperre markieren will — die Auswahl bliebe bei
    // einem einzigen Tag stehen. Überall sonst (Rand, Wochentagszeile,
    // Zwischenraum zwischen den Monaten) bleibt das Greif-Scrollen, das ohne
    // Mausrad der einzige Weg durch die Monate ist.
    if ((e.target as HTMLElement).closest("[data-tageszelle]")) return;
    const box = scrollBox.current;
    if (!box) return;
    zieht.current = true;
    startY.current = e.clientY;
    startTop.current = box.scrollTop;
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const box = scrollBox.current;
    if (!zieht.current || !box) return;
    const delta = e.clientY - startY.current;
    // Erst ab einer kleinen Schwelle greifen, sonst verschluckt schon ein
    // Wackeln beim Klicken den Klick.
    if (Math.abs(delta) < 3) return;
    // Pointer einfangen, damit das Ziehen weiterläuft, wenn der Zeiger den
    // Kasten verlässt — und der Browser keine Textauswahl startet.
    if (e.currentTarget.hasPointerCapture(e.pointerId) === false) {
      e.currentTarget.setPointerCapture(e.pointerId);
      setZiehtAktiv(true);
    }
    // Inhalt folgt der Hand: nach oben ziehen scrollt nach unten.
    box.scrollTop = startTop.current - delta;
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    zieht.current = false;
    setZiehtAktiv(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }, []);

  const sichtbar = useMemo(() => {
    const out: MonthIndex[] = [];
    for (let i = from; i <= to; i += 1) out.push(i);
    return out;
  }, [from, to]);

  return (
    <div className="flex flex-col gap-4">
      {/* Steuerung: Ansicht + Objekt nebeneinander, „Heute" rechts. */}
      <div className="flex flex-wrap items-center gap-2">
        {viewSwitcher}
        <NativeSelect
          value={propertyId}
          onChange={(e) => setPropertyId(e.target.value)}
          className="h-9 w-auto"
        >
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </NativeSelect>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="outline" onClick={goToday}>
            {t("monthGridView.today")}
          </Button>
        </div>
      </div>

      <Card className="p-3">
        {/* Wochentagszeile: steht FEST über dem Scroll-Kasten, scrollt also
            nie mit — kein sticky nötig. */}
        <div className="grid grid-cols-7 bg-card">
          {weekdays.map((w) => (
            <div
              key={w}
              className="px-2 py-1.5 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              {w}
            </div>
          ))}
        </div>

        {/* Eigener Scroll-Kasten mit fester Höhe: die SEITE behält damit ihre
            Höhe, egal wie weit man durch die Monate scrollt. Die Scrollbar
            selbst ist ausgeblendet (scrollbar-hide) — gescrollt wird weiter
            per Rad, Trackpad und Tastatur. */}
        <div
          ref={scrollBox}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className={`scrollbar-hide h-[70vh] touch-pan-y overflow-y-auto overscroll-contain ${
            ziehtAktiv ? "cursor-grabbing select-none" : "cursor-grab"
          }`}
        >
          <div ref={sentinelUp} className="h-px" />
          {sichtbar.map((mi) => (
            <MonthBlock
              key={mi}
              monthIndex={mi}
              label={`${months[indexMonth(mi)]} ${indexYear(mi)}`}
              propertyId={propertyId}
              reservations={reservations}
              currency={currency}
              todayKey={todayKey}
              markiert={markiert}
              ueberlagerung={ueberlagerung}
              onZugStart={zugStart}
              onZugUeber={zugUeber}
              onSperreKlick={setUnblockAt}
              onBalkenKlick={setDetail}
            />
          ))}
          <div ref={sentinelDown} className="h-px" />
        </div>
      </Card>

      {/* Legende */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm border bg-card" /> {t("monthGridView.statusOpen")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-accent/15" /> {t("monthGridView.statusBooked")}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-sm bg-neutral-200 dark:bg-neutral-800" />{" "}
          {t("monthGridView.statusBlocked")}
        </span>
        <span className="flex items-center gap-1.5">
          <Icon icon="ph:sign-in" className="size-3.5 text-destructive" />{" "}
          {t("monthGridView.arrivalBlocked")}
        </span>
        <span className="flex items-center gap-1.5">
          <Icon icon="ph:sign-out" className="size-3.5 text-destructive" />{" "}
          {t("monthGridView.departureBlocked")}
        </span>
      </div>

      {/* --- Bearbeiten: Menü und Dialoge ---------------------------------- */}
      {/* Aktionsmenü nach dem Aufziehen — dasselbe Element wie im
          Belegungsplan, samt seiner Nächte-Beschriftung. */}
      {sel && menuAt && (
        <CalendarActionMenu
          at={menuAt}
          rangeLabel={(() => {
            const { start, ende, naechte } = zeitraum(sel);
            const fmt = (iso: string) => {
              const d = new Date(`${iso}T00:00:00`);
              return `${d.getDate()}.${d.getMonth() + 1}.`;
            };
            return `${fmt(start)} – ${fmt(ende)} · ${naechte} ${
              naechte > 1 ? t("monthGridView.nights") : t("monthGridView.night")
            }`;
          })()}
          saving={saving}
          onAction={(action) => {
            if (action === "closed") {
              void sperren();
              return;
            }
            const { start, letzter, ende } = zeitraum(sel);
            if (action === "stop_sell") {
              // Enden INKLUSIV — so erwartet es das Panel.
              setStopSellSel({
                propertyId,
                propertyTitle:
                  properties.find((p) => p.id === propertyId)?.title ?? "",
                start,
                end: letzter,
              });
            } else if (action === "bulk") {
              setBulk({ checkIn: start, checkOut: ende });
            } else {
              setWizard({
                checkIn: start,
                checkOut: ende,
                ownerStay: action === "owner_stay",
              });
            }
            auswahlZuruecksetzen();
          }}
          onClose={auswahlZuruecksetzen}
        />
      )}

      {/* Sperre aufheben — mit Rückfrage, weil ein Fehlklick auf einem
          gesperrten Tag sonst still Verfügbarkeit an die Portale meldet. */}
      {unblockAt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6 shadow-2xl">
            <h3 className="font-display text-lg font-bold">
              {t("monthGridView.releaseBlockTitle")}
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("monthGridView.releaseBlockBody", {
                von: unblockAt.start,
                bis: unblockAt.end,
              })}
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setUnblockAt(null)}>
                {tGemein("cancel")}
              </Button>
              <Button disabled={saving} onClick={() => void entsperren()}>
                {saving
                  ? t("monthGridView.saving")
                  : t("monthGridView.releaseBlockConfirm")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {wizard && (
        <ReservationWizard
          open
          onClose={() => setWizard(null)}
          onSaved={() => {
            setWizard(null);
            void loadProperty();
          }}
          properties={properties.map((p) => ({ id: p.id, title: p.title }))}
          initialPropertyId={propertyId}
          checkIn={wizard.checkIn}
          checkOut={wizard.checkOut}
          basePrice={0}
          initialOwnerStay={wizard.ownerStay ?? false}
        />
      )}

      {bulk && (
        <BulkEditDialog
          open
          rangeLabel={`${bulk.checkIn} – ${bulk.checkOut}`}
          start={bulk.checkIn}
          end={bulk.checkOut}
          primaryProperty={{
            id: propertyId,
            title: properties.find((p) => p.id === propertyId)?.title ?? "",
          }}
          allProperties={properties.map((p) => ({ id: p.id, title: p.title }))}
          onClose={() => setBulk(null)}
          onApplied={() => setBulk(null)}
        />
      )}

      {stopSellSel && (
        <StopSellPanel
          selection={stopSellSel}
          stops={stops}
          bookedDates={bookedDates}
          agencies={agencies}
          variant="overlay"
          onClose={() => setStopSellSel(null)}
          onDone={() => setStopSellSel(null)}
        />
      )}

      {detail && (
        <ReservationDetailSlider
          reservationId={detail}
          todayKey={todayKey}
          onClose={() => setDetail(null)}
          onCancelled={() => {
            setDetail(null);
            void loadProperty();
          }}
          onChanged={() => void loadProperty()}
        />
      )}
    </div>
  );
}

// Ein Monat im Scrollstrom. Lädt seine Verfügbarkeit selbst (er kennt seinen
// Zeitraum) und hört auf die Tabellen, die Preis/Min-Stay/Belegung speisen.
// Buchungen und Währung kommen vom Elternteil — die gelten objektweit.
function MonthBlock({
  monthIndex,
  label,
  propertyId,
  reservations,
  currency,
  todayKey,
  markiert,
  ueberlagerung,
  onZugStart,
  onZugUeber,
  onSperreKlick,
  onBalkenKlick,
}: {
  monthIndex: MonthIndex;
  label: string;
  propertyId: string;
  reservations: Reservation[];
  currency: string | null;
  todayKey: string;
  /** Tage der laufenden Auswahl (Elternteil führt sie objektweit, weil eine
   *  Auswahl über den Monatswechsel laufen darf). */
  markiert: Set<string>;
  /** Sofort angewandte eigene Änderungen; überschreibt den Server-Stand, bis
   *  das Realtime-Abo ihn bestätigt. `null` = ausdrücklich nicht mehr gesperrt. */
  ueberlagerung: Record<string, DayAvailability["status"] | null>;
  onZugStart: (tag: string) => void;
  onZugUeber: (tag: string) => void;
  /** Klick auf eine bestehende manuelle Sperre → Rückfrage zum Aufheben. */
  onSperreKlick: (bereich: { start: string; end: string }) => void;
  /** Klick auf einen Buchungsbalken → Detail (dort auch verschieben/stornieren). */
  onBalkenKlick: (reservationId: string) => void;
}) {
  const t = useTranslations("calendar");
  const locale = useLocale();
  const year = indexYear(monthIndex);
  const month = indexMonth(monthIndex);

  const start = useMemo(() => gridStart(year, month), [year, month]);
  const weeks = useMemo(() => weeksInMonth(year, month), [year, month]);
  const [days, setDays] = useState<Record<string, DayAvailability>>({});

  const statusCell = useMemo(
    (): Record<DayAvailability["status"], { cls: string; label: string }> => ({
      open: { cls: "bg-card", label: t("monthGridView.statusOpen") },
      booked: { cls: "bg-accent/15", label: t("monthGridView.statusBooked") },
      blocked: {
        cls: "bg-neutral-200 dark:bg-neutral-800",
        label: t("monthGridView.statusBlocked"),
      },
    }),
    [t],
  );

  const load = useCallback(async () => {
    if (!propertyId) {
      setDays({});
      return;
    }
    const endExcl = new Date(start);
    endExcl.setDate(start.getDate() + weeks * 7);
    const av = await getAvailability(
      propertyId,
      dateKey(start),
      dateKey(endExcl),
    );
    if (!av.ok) return;
    const map: Record<string, DayAvailability> = {};
    for (const d of av.data) map[d.date] = d;
    setDays(map);
  }, [propertyId, start, weeks]);

  useEffect(() => {
    void load();
  }, [load]);

  // Der Preis kommt aus dem Resolver über dynamic_prices (bei aktivem DP) > price_overrides >
  // weekday (property_pricing_config) > base (rate_plans); dp_settings schaltet
  // Dynamic Pricing je Objekt; stop_sell beeinflusst die als 'blocked' gezeigte
  // Belegung. Ohne diese Abos bliebe der Monat stale (Realtime-Pflicht).
  useRealtime({ table: "availability", onChange: load });
  useRealtime({ table: "price_overrides", onChange: load });
  useRealtime({ table: "stop_sell", onChange: load });
  useRealtime({ table: "rate_plans", onChange: load });
  useRealtime({ table: "property_pricing_config", onChange: load });
  useRealtime({ table: "dynamic_prices", onChange: load });
  useRealtime({ table: "dp_settings", onChange: load });

  const cells = useMemo(() => {
    const out: Date[] = [];
    for (let i = 0; i < weeks * 7; i += 1) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      out.push(d);
    }
    return out;
  }, [start, weeks]);

  // Balkenstücke je Gitterwoche — eine Buchung über den Wochenwechsel ergibt
  // mehrere Stücke, weil ein Grid-Kind keine Zeile umbrechen kann.
  const segmentsByWeek = useMemo(() => {
    const all = barSegments(reservations, start, weeks);
    const out: ReturnType<typeof barSegments>[] = Array.from(
      { length: weeks },
      () => [],
    );
    for (const seg of all) out[seg.week]?.push(seg);
    // Innerhalb der Woche nach Startspalte, damit gestapelte Balken bei
    // Mehrfachbelegung (Einheiten) in stabiler Reihenfolge liegen.
    for (const row of out) row.sort((a, b) => a.col - b.col);
    return out;
  }, [reservations, start, weeks]);

  function priceText(price: number | null | undefined): string {
    if (price == null) return "–";
    return currency
      ? formatCurrency(price, currency)
      : price.toLocaleString(locale, { maximumFractionDigits: 0 });
  }

  /** Der EFFEKTIVE Status eines Tages: eigene Sofort-Änderung schlägt den
   *  Server-Stand, bis das Abo ihn bestätigt (siehe `ueberlagerung`). */
  function statusVon(k: string): DayAvailability["status"] {
    const eigen = ueberlagerung[k];
    if (eigen !== undefined) return eigen ?? "open";
    return days[k]?.status ?? "open";
  }

  /** Die zusammenhängende manuelle Sperre um `k` herum — als Zeitraum mit
   *  EXKLUSIVEM Ende, wie `unblockRange` ihn erwartet.
   *
   *  WARUM ÜBER DEN TAG HINAUS GESUCHT WIRD: Der Nutzer sieht einen Block
   *  gesperrter Tage und klickt irgendwo hinein — gemeint ist der ganze Block,
   *  nicht die eine Zelle. Nur diesen einen Tag freizugeben ließe die Sperre
   *  scheinbar unverändert stehen (ein Loch in der Mitte fällt kaum auf), und
   *  der Nutzer klickte weiter.
   *
   *  Die Suche endet an den Rändern des GELADENEN Monats. Reicht die Sperre
   *  darüber hinaus, wird der sichtbare Teil freigegeben — das ist ehrlich
   *  begrenzt statt geraten, und der Rest ist einen Klick weiter erreichbar. */
  function sperrBereich(k: string): { start: string; end: string } | null {
    if (statusVon(k) !== "blocked") return null;
    // `source` unterscheidet eine HANDsperre von einer Portal-/Buchungssperre.
    // Nur die eigene lässt sich hier aufheben.
    if (days[k]?.source && days[k]?.source !== "manual") return null;
    const first = dateKey(cells[0]);
    const last = dateKey(cells[cells.length - 1]);
    let von = k;
    for (;;) {
      const d = new Date(`${von}T00:00:00`);
      d.setDate(d.getDate() - 1);
      const vk = dateKey(d);
      if (vk < first || statusVon(vk) !== "blocked") break;
      if (days[vk]?.source && days[vk]?.source !== "manual") break;
      von = vk;
    }
    let bis = k;
    for (;;) {
      const d = new Date(`${bis}T00:00:00`);
      d.setDate(d.getDate() + 1);
      const nk = dateKey(d);
      if (nk > last || statusVon(nk) !== "blocked") break;
      if (days[nk]?.source && days[nk]?.source !== "manual") break;
      bis = nk;
    }
    const endExcl = new Date(`${bis}T00:00:00`);
    endExcl.setDate(endExcl.getDate() + 1);
    return { start: von, end: dateKey(endExcl) };
  }

  return (
    <section className="pt-4 first:pt-0">
      <h3 className="px-1 pb-2 font-display text-lg font-bold">{label}</h3>
      {/* Tageszellen, Woche für Woche. Jede Woche ist ein eigenes Raster mit
          zwei Lagen: unten die Tagesfelder (Preis/Status), darüber die
          Buchungsbalken. */}
      <div className="flex flex-col gap-1">
        {Array.from({ length: weeks }, (_, w) => (
          <div key={w} className="relative">
            <div className="grid grid-cols-7 gap-1">
              {cells.slice(w * 7, w * 7 + 7).map((d) => {
                const k = dateKey(d);
                const inMonth = d.getMonth() === month;
                const da = days[k];
                const status = statusVon(k);
                const meta = statusCell[status];
                const isToday = k === todayKey;
                const istMarkiert = markiert.has(k);
                const bereich = sperrBereich(k);
                return (
                  <div
                    key={k}
                    // Trägt die Trennung der beiden Ziehgesten: auf einer
                    // Tageszelle zieht man eine Auswahl auf, daneben scrollt
                    // man den Kasten (siehe `onPointerDown` oben).
                    data-tageszelle
                    role="button"
                    tabIndex={0}
                    onMouseDown={(e) => {
                      if (e.button !== 0) return;
                      // Eine bestehende Handsperre ist ein KLICK-Ziel
                      // („aufheben?"), kein Startpunkt für eine neue Auswahl —
                      // sonst könnte man eine Sperre nie mehr treffen, weil
                      // jeder Druck darauf ein Aufziehen beginnt.
                      if (bereich) return;
                      e.preventDefault(); // keine Textauswahl beim Ziehen
                      onZugStart(k);
                    }}
                    onMouseEnter={() => onZugUeber(k)}
                    onClick={() => {
                      if (bereich) onSperreKlick(bereich);
                    }}
                    onKeyDown={(e) => {
                      if (e.key !== "Enter" && e.key !== " ") return;
                      e.preventDefault();
                      if (bereich) onSperreKlick(bereich);
                      else {
                        // Tastaturweg: ein Tag = eine Nacht. Ziehen über
                        // mehrere Tage bleibt der Maus vorbehalten.
                        onZugStart(k);
                        onZugUeber(k);
                      }
                    }}
                    title={
                      bereich
                        ? t("monthGridView.blockedClickToRelease")
                        : t("monthGridView.dragToSelect")
                    }
                    className={`flex min-h-[6.5rem] cursor-pointer flex-col rounded-xl border p-1.5 transition-colors ${
                      meta.cls
                    } ${inMonth ? "" : "opacity-40"} ${
                      isToday ? "ring-2 ring-accent" : ""
                    } ${
                      istMarkiert
                        ? "ring-2 ring-accent ring-offset-1 brightness-95"
                        : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-xs font-semibold ${isToday ? "text-accent" : ""}`}>
                        {d.getDate()}
                      </span>
                      <span className="flex items-center gap-0.5">
                        {/* CTA = Anreise gesperrt, CTD = Abreise gesperrt. */}
                        {da?.closed_to_arrival && (
                          <span title={t("monthGridView.arrivalBlocked")} className="flex">
                            <Icon icon="ph:sign-in" className="size-3.5 text-destructive" />
                          </span>
                        )}
                        {da?.closed_to_departure && (
                          <span title={t("monthGridView.departureBlocked")} className="flex">
                            <Icon icon="ph:sign-out" className="size-3.5 text-destructive" />
                          </span>
                        )}
                      </span>
                    </div>
                    {da && (
                      <div className="mt-auto flex flex-col gap-0.5">
                        <span className="text-xs font-medium tabular-nums">
                          {priceText(da.price)}
                        </span>
                        <div className="flex items-center justify-between text-[0.625rem] text-muted-foreground">
                          <span>{meta.label}</span>
                          {da.min_stay != null && da.min_stay > 1 && (
                            <span
                              title={t("monthGridView.minStayTitle", { count: da.min_stay })}
                            >
                              ≥{da.min_stay}
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Balkenlage: sitzt unter der Datumszeile, über den Preisen.
                Die LAGE bleibt durchlässig (pointer-events-none), sonst
                blockierte sie das Aufziehen einer Auswahl über gebuchte Tage
                hinweg. Die einzelnen BALKEN sind dagegen anklickbar
                (pointer-events-auto) und öffnen das Buchungsdetail. */}
            <div className="pointer-events-none absolute inset-x-0 top-7 grid grid-cols-7 gap-1">
              {segmentsByWeek[w]?.map((seg) => {
                const st = reservationStatus(seg.res, todayKey);
                const cm = channelMeta(channelSource(seg.res));
                const owner = seg.res.is_owner_stay;
                const bar = owner
                  ? OWNER_STAY_BAR
                  : STATUS_META[st].barClass ?? `${cm.barBg} ${cm.barFg}`;
                return (
                  <button
                    type="button"
                    key={`${seg.res.id}-${seg.week}-${seg.col}`}
                    title={`${seg.res.guest_name} · ${seg.res.check_in} → ${seg.res.check_out}`}
                    onClick={(e) => {
                      // Nicht bis zur Zelle durchreichen: dort läge sonst
                      // gleichzeitig ein Auswahl-Start.
                      e.stopPropagation();
                      onBalkenKlick(seg.res.id);
                    }}
                    onMouseDown={(e) => e.stopPropagation()}
                    style={{
                      gridColumn: `${seg.col + 1} / span ${seg.span}`,
                    }}
                    className={`pointer-events-auto flex h-6 cursor-pointer items-center gap-1 overflow-hidden px-1.5 text-left text-[0.6875rem] font-medium transition-opacity hover:opacity-85 ${bar} ${
                      seg.startsHere ? "ml-1 rounded-l-full" : ""
                    } ${seg.endsHere ? "mr-1 rounded-r-full" : ""}`}
                  >
                    <Icon
                      icon={owner ? OWNER_STAY_ICON : cm.logo.kind === "icon" ? cm.logo.icon : "ph:globe-simple-fill"}
                      className="size-3 shrink-0"
                    />
                    {/* Name nur im ersten Stück — sonst stünde er nach jedem
                        Wochenwechsel erneut mitten in der Buchung. */}
                    {seg.startsHere && (
                      <span className="truncate">{seg.res.guest_name}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

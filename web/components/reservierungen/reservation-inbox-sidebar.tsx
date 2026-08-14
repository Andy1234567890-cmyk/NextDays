"use client";

// Buchungs-Sidebar des Buchungsdetails (Lodgify-Posteingang-Struktur): links
// die durchsuch- und filterbare Liste aller Buchungen, rechts das Detail der
// gewählten. Ein Klick wechselt die Buchung, ohne die Liste zu verlassen.
//
// Warum hier die Liste steht: im Detail arbeitet man an EINER Buchung und
// springt zur nächsten — genau das ist der Posteingang.
//
// Datenlage: ein listReservations()-Call speist die Liste, EIN Realtime-Abo
// (Pflicht, CLAUDE.md) hält sie live — kein Polling, kein Reload nach eigener
// Aktion. Beträge kommen maskiert aus dem Backend (null → kein Betrag, kein
// 0-Fallback); die Währung kommt je Zeile aus den Daten (Wurzel 4).
//
// Zeitangabe der Zeile: `booked_at` ist der Zeitpunkt der FREMDEN Handlung
// (Gast hat beim Portal gebucht). Fehlt er, zeigt die Zeile `created_at` und
// benennt es als Eingang bei uns — unsere Uhr wird nie als Buchungszeitpunkt
// ausgegeben (Wurzel 5b).
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ReservationWizard } from "@/components/kalender/reservation-wizard";
import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";
import { channelMeta } from "@/lib/calendar-channels";
import {
  type DisplayStatus,
  OWNER_STAY_ICON,
  STATUS_META,
} from "@/lib/calendar-status";
import {
  channelSource,
  dateKey,
  displayStatusOf,
  nights,
  occupiesNight,
} from "@/lib/calendar-views";
import { channelLabelLoose } from "@/lib/channel-logos";
import { formatCurrency } from "@/lib/currency";
import {
  type Reservation,
  type ReservationChannel,
  listReservations,
} from "@/lib/reservations";
import { useCalendarLabels } from "@/lib/use-calendar-labels";
import { useRealtime } from "@/lib/use-realtime";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

/** Objekt-Stammdaten, die die Liste für Titel, Thumbnail und Objektfilter
 *  braucht. `photo` = Titelbild (properties.photos[0] — der Spiegel von
 *  property_photos, Cover zuerst). Optional, weil derselbe Typ auch den
 *  Buchungs-Wizard speist, der nur id/title braucht. */
export type InboxProperty = { id: string; title: string; photo?: string | null };

/** Zeitachsen-Filter (Lodgify „DATUM"): genau einer aktiv. */
type DateScope = "all" | "today" | "upcoming" | "past";

/** Aufenthalts-Filter (Lodgify „AUFENTHALT"): Mehrfachauswahl, leer = alle. */
type StayFlag = "checkin" | "checkout" | "hosting";

/** Prozess-Filter: nur Merkmale, die wirklich in den Daten stehen.
 *  `archived` ist ein Sonderfall — siehe `matches`: die Ablage ist keine
 *  zusätzliche Auswahl, sondern eine ANDERE Liste. */
type ProcessFlag = "openBalance" | "ownerStay" | "archived";

const DATE_SCOPES: DateScope[] = ["all", "today", "upcoming", "past"];
const STAY_FLAGS: StayFlag[] = ["checkin", "checkout", "hosting"];
const PROCESS_FLAGS: ProcessFlag[] = ["openBalance", "ownerStay", "archived"];

// Kanalachse in der Reihenfolge, in der die Kanäle im Betrieb vorkommen.
// Spiegelt ReservationChannel — ein neuer Kanalwert fällt hier sofort auf,
// weil TypeScript die Liste gegen den Union-Typ prüft.
const CHANNELS: ReservationChannel[] = [
  "direct",
  "website",
  "portal",
  "booking",
  "airbnb",
  "vrbo",
  "ota_other",
];

// Anzeige-Status inkl. des abgeleiteten „im Haus" (0091) — dieselbe Achse, die
// die Liste auch anzeigt, damit Filter und Badge nie auseinanderlaufen.
const STATUSES: DisplayStatus[] = [
  "pending",
  "confirmed",
  "in_house",
  "completed",
  "cancelled",
];

const VOREINSTELLUNG_KEY = "nextdays.reservation-inbox.filter";

type FilterState = {
  scope: DateScope;
  stay: StayFlag[];
  channels: ReservationChannel[];
  statuses: string[];
  process: ProcessFlag[];
};

const LEERER_FILTER: FilterState = {
  scope: "all",
  stay: [],
  channels: [],
  statuses: [],
  process: [],
};

/** Anzahl gesetzter Einschränkungen (Kopfzeile „n ausgewählt"). */
function filterCount(f: FilterState): number {
  return (
    (f.scope === "all" ? 0 : 1) +
    f.stay.length +
    f.channels.length +
    f.statuses.length +
    f.process.length
  );
}

// Zeitraum der Zeile: Tag + Monat OHNE Wochentag. In der schmalen Spalte
// verdrängt „Mo., 26. Juli" das Ende des Zeitraums, und dann fehlt die Abreise
// — die wichtigere Hälfte der Angabe.
function tagKurz(key: string, locale: string): string {
  return new Date(`${key}T00:00:00`).toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
  });
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value)
    ? list.filter((v) => v !== value)
    : [...list, value];
}

/** Trifft die Buchung die gesetzten Filter? */
function matches(
  r: Reservation,
  f: FilterState,
  todayKey: string,
): boolean {
  const status = displayStatusOf(r, todayKey);

  // Die Ablage ist eine eigene Liste, keine Zusatz-Auswahl: ohne den Filter
  // „Ablage" ist eine archivierte Buchung unsichtbar, mit ihm sieht man
  // ausschliesslich die Ablage. Würde sie beides gleichzeitig sein, hätte
  // Archivieren keine Wirkung — der Vorgang stünde weiter in der Arbeitsliste.
  const nurAblage = f.process.includes("archived");
  if (nurAblage !== !!r.archived_at) return false;

  if (f.scope === "today" && !occupiesNight(r, todayKey)) return false;
  if (f.scope === "upcoming" && r.check_in <= todayKey) return false;
  if (f.scope === "past" && r.check_out >= todayKey) return false;

  if (f.stay.length > 0) {
    const trifft = f.stay.some((flag) =>
      flag === "checkin"
        ? r.check_in === todayKey
        : flag === "checkout"
          ? r.check_out === todayKey
          : occupiesNight(r, todayKey),
    );
    if (!trifft) return false;
  }

  if (f.channels.length > 0 && !f.channels.includes(r.channel)) return false;
  if (f.statuses.length > 0 && !f.statuses.includes(status)) return false;

  const weitere = f.process.filter((flag) => flag !== "archived");
  if (weitere.length > 0) {
    const trifft = weitere.some((flag) =>
      flag === "ownerStay"
        ? r.is_owner_stay
        : // Offener Betrag nur behaupten, wenn beide Beträge sichtbar sind —
          // ohne Betrags-Sichtbarkeit ist die Aussage nicht ableitbar.
          r.total_amount != null &&
          r.paid_amount != null &&
          r.total_amount - r.paid_amount > 0,
    );
    if (!trifft) return false;
  }

  return true;
}

export function ReservationInboxSidebar({
  activeId,
  properties,
}: {
  activeId: string;
  properties: InboxProperty[];
}) {
  const t = useTranslations("reservations");
  const locale = useLocale();
  const router = useRouter();
  const { channelLabel, statusLabel } = useCalendarLabels();

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterState>(LEERER_FILTER);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [wizardOpen, setWizardOpen] = useState(false);

  const todayKey = useMemo(() => dateKey(new Date()), []);

  const titleOf = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of properties) map[p.id] = p.title;
    return map;
  }, [properties]);

  // property_id → Titelbild (Thumbnail je Zeile).
  const photoOf = useMemo(() => {
    const map: Record<string, string | null> = {};
    for (const p of properties) map[p.id] = p.photo ?? null;
    return map;
  }, [properties]);

  const load = useCallback(async () => {
    const res = await listReservations();
    if (res.ok) {
      setReservations(res.data.items);
      console.debug(
        "[ReservationInbox] geladen",
        res.data.items.length,
        "Buchungen",
      );
    } else {
      console.debug("[ReservationInbox] Laden fehlgeschlagen:", res.error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useRealtime({ table: "reservations", onChange: load });
  // Titel + Titelbild kommen serverseitig aus dem Layout — ein gewechseltes
  // Cover oder ein umbenanntes Objekt erschiene sonst erst nach manuellem
  // Reload. router.refresh() statt load(), weil load() nur die Buchungen holt.
  useRealtime({ table: "properties", onChange: () => router.refresh() });

  // Gespeicherte Filter-Voreinstellung des Nutzers (Lodgify „Filter-
  // Einstellungen speichern"). Bewusst lokal: es ist eine Ansichtsvorliebe,
  // keine Betriebsdaten.
  useEffect(() => {
    try {
      const roh = window.localStorage.getItem(VOREINSTELLUNG_KEY);
      if (roh) setFilter({ ...LEERER_FILTER, ...JSON.parse(roh) });
    } catch (exc) {
      console.debug("[ReservationInbox] Voreinstellung unlesbar:", exc);
    }
  }, []);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reservations
      .filter((r) => matches(r, filter, todayKey))
      .filter((r) => {
        if (!q) return true;
        const hay = `${r.guest_name} ${titleOf[r.property_id] ?? ""} ${
          r.ota_name ?? ""
        } ${r.external_ref ?? ""}`.toLowerCase();
        return hay.includes(q);
      })
      // Neueste Buchung zuerst — über den Zeitpunkt der Buchung selbst, nicht
      // über unsere Bearbeitungsspalte (Wurzel 5b). Fehlt er, greift unser
      // Eingang, danach der Anreisetag.
      .sort((a, b) => {
        const av = a.booked_at ?? a.created_at ?? a.check_in;
        const bv = b.booked_at ?? b.created_at ?? b.check_in;
        return av === bv ? 0 : av < bv ? 1 : -1;
      });
  }, [reservations, filter, query, titleOf, todayKey]);

  const alleWaehlen = () => {
    setSelected(rows.map((r) => r.id));
  };

  // Auswahl-Export (Lodgify-Download-Icon): CSV der SICHTBAREN Spalten. Beträge
  // nur, wenn sie sichtbar sind — sonst bleibt die Zelle leer statt 0 zu
  // behaupten (Wurzel 4).
  const exportCsv = () => {
    const quelle = selectMode
      ? rows.filter((r) => selected.includes(r.id))
      : rows;
    const kopf = [
      t("inboxSidebar.csv.reference"),
      t("inboxSidebar.csv.guest"),
      t("inboxSidebar.csv.property"),
      t("inboxSidebar.csv.checkIn"),
      t("inboxSidebar.csv.checkOut"),
      t("inboxSidebar.csv.nights"),
      t("inboxSidebar.csv.guests"),
      t("inboxSidebar.csv.channel"),
      t("inboxSidebar.csv.status"),
      t("inboxSidebar.csv.total"),
      t("inboxSidebar.csv.currency"),
      t("inboxSidebar.csv.bookedAt"),
      t("inboxSidebar.csv.receivedAt"),
    ];
    const zellen = (r: Reservation) => [
      r.external_ref ?? r.id,
      r.guest_name,
      titleOf[r.property_id] ?? "",
      r.check_in,
      r.check_out,
      String(nights(r.check_in, r.check_out)),
      String(r.num_guests),
      r.ota_name ?? channelLabel(channelSource(r)),
      statusLabel(displayStatusOf(r, todayKey)),
      r.total_amount == null ? "" : String(r.total_amount),
      r.total_amount == null ? "" : r.currency,
      r.booked_at ?? "",
      r.created_at ?? "",
    ];
    const escape = (v: string) => `"${v.replaceAll('"', '""')}"`;
    const csv = [kopf, ...quelle.map(zellen)]
      .map((zeile) => zeile.map(escape).join(";"))
      .join("\r\n");
    // BOM (U+FEFF) voranstellen, sonst zeigt Excel die Umlaute als Mojibake.
    // Als Escape-Sequenz statt als echtes Zeichen: literal wäre es unsichtbarer
    // Whitespace mitten im Quelltext.
    const blob = new Blob([`\uFEFF${csv}`], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `buchungen-${todayKey}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    console.debug("[ReservationInbox] CSV exportiert:", quelle.length, "Zeilen");
  };

  const aktiveFilter = filterCount(filter);

  // Höhe kommt vom Eltern-Flex (siehe reservierungen/[id]/layout.tsx), nicht
  // aus einer geschätzten `calc(100vh-…)`: die Liste füllt die Spalte und
  // scrollt intern. `min-h-0` erlaubt das Schrumpfen im Flex-Container.
  return (
    <aside className="flex min-h-0 w-full shrink-0 flex-col border-b lg:w-[19rem] lg:border-b-0 lg:border-r">
      {/* Kopf: Titel + Zähler, Filter, Suche */}
      {searchOpen ? (
        <div className="flex items-center gap-2 border-b px-3 py-2.5">
          <Input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("inboxSidebar.searchPlaceholder")}
            className="h-9 flex-1"
          />
          <button
            type="button"
            onClick={() => {
              setSearchOpen(false);
              setQuery("");
            }}
            className="shrink-0 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            {t("inboxSidebar.cancel")}
          </button>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-2 border-b px-3 py-2.5">
          <div className="min-w-0">
            <p className="truncate font-display text-base font-extrabold">
              {t("inboxSidebar.title")}
            </p>
            <p className="text-xs text-muted-foreground">
              {t("inboxSidebar.count", { count: rows.length })}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              aria-label={t("inboxSidebar.filter")}
              aria-expanded={filterOpen}
              title={t("inboxSidebar.filter")}
              onClick={() => setFilterOpen((v) => !v)}
              className={cn(
                "relative rounded-full p-2 transition-colors",
                filterOpen || aktiveFilter > 0
                  ? "bg-accent/10 text-accent"
                  : "text-muted-foreground hover:bg-secondary/60",
              )}
            >
              <Icon icon="ph:funnel" className="size-4.5" />
              {aktiveFilter > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex size-4 items-center justify-center rounded-full bg-accent text-[0.625rem] font-bold text-accent-foreground">
                  {aktiveFilter}
                </span>
              )}
            </button>
            <button
              type="button"
              aria-label={t("inboxSidebar.search")}
              title={t("inboxSidebar.search")}
              onClick={() => setSearchOpen(true)}
              className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-secondary/60"
            >
              <Icon icon="ph:magnifying-glass" className="size-4.5" />
            </button>
          </div>
        </div>
      )}

      {/* Filter-Panel (Lodgify-Achsen auf unsere Werte) */}
      {filterOpen && (
        <div className="max-h-[60vh] overflow-y-auto border-b bg-secondary/20 px-3 py-3">
          <FilterGroup title={t("inboxSidebar.groups.date")}>
            {DATE_SCOPES.map((s) => (
              <label
                key={s}
                className="flex cursor-pointer items-center justify-between gap-2 py-1 text-sm"
              >
                {t(`inboxSidebar.date.${s}`)}
                <input
                  type="radio"
                  name="inbox-date-scope"
                  checked={filter.scope === s}
                  onChange={() => setFilter((f) => ({ ...f, scope: s }))}
                  className="size-4 accent-accent"
                />
              </label>
            ))}
          </FilterGroup>

          <FilterGroup title={t("inboxSidebar.groups.stay")}>
            {STAY_FLAGS.map((s) => (
              <CheckRow
                key={s}
                label={t(`inboxSidebar.stay.${s}`)}
                checked={filter.stay.includes(s)}
                onChange={() =>
                  setFilter((f) => ({ ...f, stay: toggle(f.stay, s) }))
                }
              />
            ))}
          </FilterGroup>

          <FilterGroup title={t("inboxSidebar.groups.channels")}>
            {CHANNELS.map((c) => (
              <CheckRow
                key={c}
                label={channelLabel(c)}
                checked={filter.channels.includes(c)}
                onChange={() =>
                  setFilter((f) => ({ ...f, channels: toggle(f.channels, c) }))
                }
              />
            ))}
          </FilterGroup>

          <FilterGroup title={t("inboxSidebar.groups.status")}>
            {STATUSES.map((s) => (
              <CheckRow
                key={s}
                label={statusLabel(s)}
                checked={filter.statuses.includes(s)}
                onChange={() =>
                  setFilter((f) => ({ ...f, statuses: toggle(f.statuses, s) }))
                }
              />
            ))}
          </FilterGroup>

          <FilterGroup title={t("inboxSidebar.groups.process")}>
            {PROCESS_FLAGS.map((p) => (
              <CheckRow
                key={p}
                label={t(`inboxSidebar.process.${p}`)}
                checked={filter.process.includes(p)}
                onChange={() =>
                  setFilter((f) => ({ ...f, process: toggle(f.process, p) }))
                }
              />
            ))}
          </FilterGroup>

          <div className="mt-3 flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setFilter(LEERER_FILTER);
                window.localStorage.removeItem(VOREINSTELLUNG_KEY);
              }}
            >
              {t("inboxSidebar.reset")}
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={() => {
                window.localStorage.setItem(
                  VOREINSTELLUNG_KEY,
                  JSON.stringify(filter),
                );
                setFilterOpen(false);
              }}
            >
              {t("inboxSidebar.savePreset")}
            </Button>
          </div>
        </div>
      )}

      {/* Liste */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading && (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">
            {t("inboxSidebar.loading")}
          </p>
        )}
        {!loading && rows.length === 0 && (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">
            {t("inboxSidebar.empty")}
          </p>
        )}
        {rows.map((r) => (
          <InboxRow
            key={r.id}
            r={r}
            active={r.id === activeId}
            title={titleOf[r.property_id] ?? "—"}
            photo={photoOf[r.property_id] ?? null}
            todayKey={todayKey}
            locale={locale}
            selectMode={selectMode}
            checked={selected.includes(r.id)}
            onCheck={() => setSelected((s) => toggle(s, r.id))}
            t={t}
          />
        ))}
      </div>

      {/* Fuß: Auswahl, Export, neue Buchung */}
      <div className="flex flex-col gap-2 border-t px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          {selectMode ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setSelectMode(false);
                  setSelected([]);
                }}
                className="text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                {t("inboxSidebar.cancel")}
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={alleWaehlen}
                  className="text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  {t("inboxSidebar.selectAll")}
                </button>
                <button
                  type="button"
                  disabled={selected.length === 0}
                  onClick={exportCsv}
                  className="text-sm font-semibold text-accent disabled:opacity-40"
                >
                  {t("inboxSidebar.exportSelected", {
                    count: selected.length,
                  })}
                </button>
              </div>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setSelectMode(true)}
                className="text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                {t("inboxSidebar.select")}
              </button>
              <button
                type="button"
                aria-label={t("inboxSidebar.export")}
                title={t("inboxSidebar.export")}
                onClick={exportCsv}
                className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-secondary/60"
              >
                <Icon icon="ph:download-simple" className="size-4.5" />
              </button>
            </>
          )}
        </div>
        <Button
          type="button"
          className="w-full"
          disabled={properties.length === 0}
          onClick={() => setWizardOpen(true)}
        >
          <Icon icon="ph:plus" className="size-4" />
          {t("inboxSidebar.createBooking")}
        </Button>
      </div>

      {wizardOpen && properties.length > 0 && (
        <ReservationWizard
          open
          onClose={() => setWizardOpen(false)}
          onSaved={() => setWizardOpen(false)}
          properties={properties}
          initialPropertyId={properties[0].id}
          checkIn={todayKey}
          checkOut={dateKey(new Date(Date.now() + 86_400_000))}
          basePrice={0}
          editableDates
        />
      )}
    </aside>
  );
}

function FilterGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-3">
      <p className="pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      {children}
    </div>
  );
}

function CheckRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-2 py-1 text-sm">
      <span className="truncate">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="size-4 shrink-0 accent-accent"
      />
    </label>
  );
}

function InboxRow({
  r,
  active,
  title,
  photo,
  todayKey,
  locale,
  selectMode,
  checked,
  onCheck,
  t,
}: {
  r: Reservation;
  active: boolean;
  title: string;
  photo: string | null;
  todayKey: string;
  locale: string;
  selectMode: boolean;
  checked: boolean;
  onCheck: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const { channelLabel, statusLabel } = useCalendarLabels();
  const ds = displayStatusOf(r, todayKey);
  const sm = STATUS_META[ds];
  const cm = channelMeta(channelSource(r));

  // Zeitstempel der Zeile: die fremde Handlung, sonst ausdrücklich unser
  // Eingang (Wurzel 5b) — der Titel sagt, welches von beidem gilt.
  const stempel = r.booked_at ?? r.created_at ?? null;
  const stempelIstEingang = !r.booked_at && !!r.created_at;
  const stempelText = stempel
    ? new Date(stempel).toLocaleDateString(locale, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <div
      className={cn(
        "flex items-start gap-2 border-b px-3 py-2.5 transition-colors last:border-0",
        active ? "bg-secondary/70" : "hover:bg-secondary/40",
      )}
    >
      {selectMode && (
        <input
          type="checkbox"
          checked={checked}
          onChange={onCheck}
          aria-label={t("inboxSidebar.selectRow", { guest: r.guest_name })}
          className="mt-1 size-4 shrink-0 accent-accent"
        />
      )}
      <Link
        href={`/reservierungen/${r.id}`}
        className="flex min-w-0 flex-1 items-start gap-2.5"
      >
        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-(--radius) bg-secondary text-muted-foreground">
          {photo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo} alt="" className="size-full object-cover" />
          ) : (
            <Icon icon="ph:image" className="size-4.5" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline justify-between gap-2">
            <span className="inline-flex min-w-0 items-center gap-1.5 text-xs font-semibold">
              <span className={cn("size-2 shrink-0 rounded-full", sm.dotBg)} />
              <span className="truncate">{statusLabel(ds)}</span>
            </span>
            {stempelText && (
              <span
                className="shrink-0 text-xs text-muted-foreground"
                title={
                  stempelIstEingang
                    ? t("inboxSidebar.receivedAtHint")
                    : t("inboxSidebar.bookedAtHint")
                }
              >
                {stempelIstEingang ? "≈ " : ""}
                {stempelText}
              </span>
            )}
          </span>
          <span className="flex items-baseline justify-between gap-2">
            <span className="truncate text-sm font-semibold">
              {r.guest_name || title}
            </span>
            {/* Geld nur, wo es welches gibt. Eine Eigennutzung trägt per
                DB-Constraint 0,00 (0241) — dort steht die Art des Aufenthalts,
                nicht ein Betrag, der eine Gratis-Buchung behauptet. Ohne
                Betrags-Sichtbarkeit (§4.3) kommt null und die Zeile bleibt leer. */}
            {r.is_owner_stay ? (
              <span className="shrink-0 text-xs font-medium text-muted-foreground">
                {t("inboxSidebar.ownerStay")}
              </span>
            ) : r.total_amount != null && r.total_amount > 0 ? (
              <span className="shrink-0 text-sm font-semibold tabular-nums">
                {formatCurrency(r.total_amount, r.currency)}
              </span>
            ) : null}
          </span>
          {/* Das OBJEKT gehört in die Zeile: zwei Eigennutzungen desselben
              Namens in verschiedenen Häusern sahen ohne es wie Duplikate aus
              (live 13.08.2026: „Jannick" in Feriehus Line und Feriehus Britt,
              gleicher Zeitraum). */}
          <span className="block truncate text-xs text-muted-foreground">
            {title}
          </span>
          <span className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
            {r.is_owner_stay ? (
              <Icon
                icon={OWNER_STAY_ICON}
                className="size-3.5 shrink-0"
                aria-label={t("inboxSidebar.ownerStay")}
              />
            ) : cm.logo.kind === "icon" ? (
              <Icon
                icon={cm.logo.icon}
                className={cn("size-3.5 shrink-0", cm.textFg)}
                aria-label={
                  r.ota_name
                    ? channelLabelLoose(r.ota_name)
                    : channelLabel(channelSource(r))
                }
              />
            ) : null}
            <span className="truncate">
              {tagKurz(r.check_in, locale)} – {tagKurz(r.check_out, locale)}
            </span>
            <span className="inline-flex shrink-0 items-center gap-0.5">
              <Icon icon="ph:moon" className="size-3.5" />
              {nights(r.check_in, r.check_out)}
            </span>
            <span className="inline-flex shrink-0 items-center gap-0.5">
              <Icon icon="ph:users" className="size-3.5" />
              {r.num_guests}
            </span>
          </span>
        </span>
      </Link>
    </div>
  );
}

"use client";

// Buchungsliste der PM-Fläche — flache Reservierungstabelle im Hostaway-Zuschnitt:
//   Kopfzeile:   Titel · Limit ▾ · Spalten ▾ · Export ▾ · Hinzufügen
//   Filterzeile: Schnellfilter ▾ · Weitere Filter (aufklappbares Panel)
//   Tabelle:     Kalender · Details · Kontakt · Gastname · Check-in ·
//                Check-out · Kanal · Gesamtpreis · Status · Objekt
//
// Die früheren fünf Reiter (Belegt/Ankünfte/Abfahrten/Zukunft/Vergangen) leben
// als Schnellfilter weiter — dieselbe Semantik (`matchesQuick`), nur als
// Dropdown statt als Reiterleiste; „Alle" ist neu und der Startwert.
//
// REIHENFOLGE: oben steht, was ANSTEHT (noch nicht abgereist), nächste
// Anreise zuerst; Abgereistes darunter, das Jüngste davon oben. Nur die
// Sicht „Vergangen" dreht komplett um. Es wird nichts ausgeblendet —
// die Liste beginnt nur dort, wo die Arbeit ist.
//
// Ein listReservations()-Call speist die Liste; EIN Realtime-Abo (Pflicht,
// CLAUDE.md) hält sie live. Beträge kommen bereits maskiert aus dem Backend
// (null → „—", kein 0-Fallback), Währung IMMER aus der Zeile (Wurzel 4).
import { Icon } from "@iconify/react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { BookingsFilter } from "@/components/reservierungen/bookings-filter";
import { ReservationWizard } from "@/components/kalender/reservation-wizard";
import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import { Input } from "@nextdays/ui/input";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@nextdays/ui/dropdown-menu";
import { channelMeta } from "@/lib/calendar-channels";
import { useCalendarLabels } from "@/lib/use-calendar-labels";
import { OWNER_STAY_ICON, STATUS_META } from "@/lib/calendar-status";
import type { DisplayStatus } from "@/lib/calendar-status";
import {
  channelSource,
  dateKey,
  displayStatusOf,
  occupiesNight,
} from "@/lib/calendar-views";
import { formatCurrency } from "@/lib/currency";
import type { PropertyType } from "@/lib/properties";
import { channelLabelLoose } from "@/lib/channel-logos";
import { type Reservation, listReservations } from "@/lib/reservations";
import { useRealtime } from "@/lib/use-realtime";

type Prop = {
  id: string;
  title: string;
  property_type: PropertyType;
  /** Titelbild (properties.photos[0] = Cover, siehe page.tsx). null = keins
   *  hinterlegt → Platzhalter-Icon statt eines erfundenen Ersatzbildes. */
  photo: string | null;
};

/** Schnellfilter: „alle" plus die fünf früheren Reiter-Prädikate. */
type QuickKey =
  | "all"
  | "occupied"
  | "arrivals"
  | "departures"
  | "future"
  | "past";

const QUICK_KEYS: QuickKey[] = [
  "all",
  "occupied",
  "arrivals",
  "departures",
  "future",
  "past",
];

/** Spalten, die über „Spalten ▾" abschaltbar sind (die drei Icon-Spalten und
 *  der Gastname bleiben immer stehen — ohne sie ist die Zeile nicht bedienbar
 *  bzw. nicht identifizierbar). */
type ColumnKey =
  | "calendar"
  | "details"
  | "contact"
  | "checkIn"
  | "checkOut"
  | "channel"
  | "totalPrice"
  | "status"
  | "listing";

const COLUMN_KEYS: ColumnKey[] = [
  "calendar",
  "details",
  "contact",
  "checkIn",
  "checkOut",
  "channel",
  "totalPrice",
  "status",
  "listing",
];

/** Auswahl der Zeilenbegrenzung. `0` = ohne Begrenzung („Alle"). */
const LIMITS = [25, 50, 100, 200, 0];

// Ein Schnellfilter = ein Prädikat auf eine (nicht-stornierte, außer
// „Vergangen") Reservierung, gemessen am heutigen Tag. Kapselt die Semantik an
// EINER Stelle, damit Dropdown-Zähler und Tabelle garantiert dasselbe filtern.
function matchesQuick(r: Reservation, key: QuickKey, todayKey: string): boolean {
  const done = displayStatusOf(r, todayKey);
  switch (key) {
    case "all":
      return true;
    case "occupied":
      // Heute im Haus: belegt heute UND nicht bereits ausgecheckt/storniert.
      return occupiesNight(r, todayKey) && done !== "completed";
    case "arrivals":
      return r.status !== "cancelled" && r.check_in >= todayKey;
    case "departures":
      return r.status !== "cancelled" && r.check_out >= todayKey;
    case "future":
      return r.status !== "cancelled" && r.check_in > todayKey;
    case "past":
      // Vergangen sammelt alles Abgeschlossene: abgereist, ausgecheckt oder
      // storniert — die Historie. (Stornos erscheinen NUR hier und in „Alle".)
      return (
        r.check_out < todayKey || done === "completed" || done === "cancelled"
      );
    default:
      return false;
  }
}

/** CSV-Feld: Trennzeichen/Anführungszeichen/Zeilenumbrüche einbetten statt
 *  die Spalte zu zerreißen (RFC 4180). */
function csvField(value: string): string {
  return /[",\n;]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

export function BookingsBoard({ properties }: { properties: Prop[] }) {
  const t = useTranslations("reservations");
  const locale = useLocale();
  const { statusLabel, channelLabel } = useCalendarLabels();
  const router = useRouter();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [quick, setQuick] = useState<QuickKey>("all");
  const [limit, setLimit] = useState(50);
  const [hidden, setHidden] = useState<ColumnKey[]>([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [query, setQuery] = useState("");
  // Multiselect-Filter (leer = alle): einzelne Objekte + Unterkunftsarten.
  const [propFilter, setPropFilter] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<DisplayStatus | "all">("all");

  const todayKey = useMemo(() => dateKey(new Date()), []);
  const shows = useCallback(
    (key: ColumnKey) => !hidden.includes(key),
    [hidden],
  );

  const titleOf = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of properties) map[p.id] = p.title;
    return map;
  }, [properties]);

  // property_id → property_type (für den Ressourcen-Filter).
  const typeOf = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of properties) map[p.id] = p.property_type;
    return map;
  }, [properties]);

  const load = useCallback(async () => {
    const res = await listReservations();
    if (res.ok) setReservations(res.data.items);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useRealtime({ table: "reservations", onChange: load });
  // Titel kommen serverseitig (page.tsx) — ein umbenanntes Objekt erschiene
  // sonst erst nach manuellem Reload. router.refresh() statt load(), weil
  // load() nur die Reservierungen holt.
  useRealtime({ table: "properties", onChange: () => router.refresh() });

  // Zähler je Schnellfilter (aus demselben Datensatz — kein zweiter Call).
  const counts = useMemo(() => {
    const c = {} as Record<QuickKey, number>;
    for (const key of QUICK_KEYS) c[key] = 0;
    for (const r of reservations) {
      for (const key of QUICK_KEYS) if (matchesQuick(r, key, todayKey)) c[key] += 1;
    }
    return c;
  }, [reservations, todayKey]);

  // Alle passenden Zeilen — die Limit-Auswahl schneidet erst danach ab, damit
  // die Trefferzahl den vollen Umfang nennt und nicht die gezeigte Seite.
  const matched = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reservations
      .filter((r) => matchesQuick(r, quick, todayKey))
      // Multiselect-Filter (leer = alle): Objekt UND Unterkunftsart müssen passen.
      .filter((r) => propFilter.length === 0 || propFilter.includes(r.property_id))
      .filter(
        (r) =>
          typeFilter.length === 0 ||
          typeFilter.includes(typeOf[r.property_id] ?? ""),
      )
      .filter(
        (r) =>
          statusFilter === "all" ||
          displayStatusOf(r, todayKey) === statusFilter,
      )
      .filter((r) => {
        if (!q) return true;
        const hay = `${r.guest_name} ${titleOf[r.property_id] ?? ""} ${r.ota_name ?? ""
          } ${r.external_ref ?? ""}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => {
        // „Vergangen" ist die Historie: das Jüngste oben, absteigend.
        if (quick === "past") {
          return a.check_in === b.check_in ? 0 : a.check_in < b.check_in ? 1 : -1;
        }
        const key = quick === "departures" ? "check_out" : "check_in";
        // In jeder anderen Sicht steht oben, was ANSTEHT. „Alle" (der
        // Startwert) sortierte bis 23.08.2026 absteigend und begann deshalb
        // mit der am weitesten entfernten Buchung — live mit August 2027,
        // während die Anreise dieser Woche 40 Zeilen tiefer stand. Der
        // Anreisetag ist kein Neuheitsmaß: „neuste zuerst" hieß hier in
        // Wahrheit „reist am spätesten an".
        const aAn = a.check_out >= todayKey;
        const bAn = b.check_out >= todayKey;
        if (aAn !== bAn) return aAn ? -1 : 1;
        const av = a[key];
        const bv = b[key];
        if (av === bv) return 0;
        // Anstehendes aufsteigend (die nächste Anreise oben), Abgereistes
        // absteigend — von heute aus gesehen ist beides „das Nächstliegende".
        return (av < bv ? -1 : 1) * (aAn ? 1 : -1);
      });
  }, [
    reservations,
    quick,
    query,
    propFilter,
    typeFilter,
    statusFilter,
    typeOf,
    todayKey,
    titleOf,
  ]);

  const rows = useMemo(
    () => (limit > 0 ? matched.slice(0, limit) : matched),
    [matched, limit],
  );

  // Export: exakt die sichtbaren Zeilen in der sichtbaren Spaltenauswahl —
  // was exportiert wird, ist damit das, was auf dem Schirm steht.
  const exportCsv = useCallback(() => {
    const cols: ColumnKey[] = COLUMN_KEYS.filter(
      (c) => c !== "calendar" && c !== "details" && c !== "contact" && shows(c),
    );
    const header = [
      t("bookingsBoard.columns.guestName"),
      ...cols.map((c) => t(`bookingsBoard.columns.${c}`)),
    ];
    const body = rows.map((r) => {
      const cells: Record<string, string> = {
        checkIn: r.check_in,
        checkOut: r.check_out,
        channel: r.is_owner_stay
          ? t("bookingsBoard.ownerStay")
          : r.ota_name
            ? channelLabelLoose(r.ota_name)
            : channelLabel(channelSource(r)),
        totalPrice:
          r.total_amount == null
            ? ""
            : formatCurrency(r.total_amount, r.currency, locale),
        status: statusLabel(displayStatusOf(r, todayKey)),
        listing: titleOf[r.property_id] ?? "",
      };
      return [r.guest_name, ...cols.map((c) => cells[c] ?? "")];
    });
    const csv = [header, ...body]
      .map((line) => line.map(csvField).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${t("bookingsBoard.title")}_${todayKey}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [
    rows,
    shows,
    t,
    locale,
    channelLabel,
    statusLabel,
    titleOf,
    todayKey,
  ]);

  const activeFilters =
    propFilter.length + typeFilter.length + (statusFilter === "all" ? 0 : 1);

  const colCount =
    1 + COLUMN_KEYS.filter((c) => shows(c)).length; // Gastname + sichtbare

  return (
    <div className="flex flex-col gap-4">
      {/* Kopfzeile: Titel links, Werkzeuge rechts. */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold">
          {t("bookingsBoard.title")}
        </h1>

        <div className="flex flex-wrap items-center gap-2">
          {/* Limit ▾ — Zeilenbegrenzung der Liste. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="gap-1.5">
                {limit > 0
                  ? t("bookingsBoard.limit", { count: limit })
                  : t("bookingsBoard.limitAll")}
                <Icon icon="ph:caret-down" className="size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup
                value={String(limit)}
                onValueChange={(v) => setLimit(Number(v))}
              >
                {LIMITS.map((n) => (
                  <DropdownMenuRadioItem key={n} value={String(n)}>
                    {n > 0 ? n : t("bookingsBoard.limitAll")}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Spalten ▾ — sichtbare Spalten wählen. */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="gap-1.5">
                {t("bookingsBoard.columnsMenu")}
                <Icon icon="ph:caret-down" className="size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>
                {t("bookingsBoard.columnsMenu")}
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {COLUMN_KEYS.map((key) => (
                <DropdownMenuCheckboxItem
                  key={key}
                  checked={shows(key)}
                  onCheckedChange={(on) =>
                    setHidden((prev) =>
                      on ? prev.filter((k) => k !== key) : [...prev, key],
                    )
                  }
                  onSelect={(e) => e.preventDefault()}
                >
                  {t(`bookingsBoard.columns.${key}`)}
                </DropdownMenuCheckboxItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Export ▾ */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" size="sm" className="gap-1.5">
                {t("bookingsBoard.exportMenu")}
                <Icon icon="ph:caret-down" className="size-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={exportCsv} className="gap-2">
                <Icon icon="ph:file-csv" className="size-4" />
                {t("bookingsBoard.exportCsv")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            type="button"
            size="sm"
            className="gap-1.5"
            disabled={properties.length === 0}
            onClick={() => setWizardOpen(true)}
          >
            {t("bookingsBoard.add")}
            <Icon icon="ph:plus-circle" className="size-4" />
          </Button>
        </div>
      </div>

      {/* Filterzeile: Schnellfilter + „Weitere Filter". */}
      <div className="flex flex-wrap items-center gap-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="min-w-56 justify-between gap-2 font-normal text-muted-foreground"
            >
              {quick === "all"
                ? t("bookingsBoard.quickFilters")
                : t(`bookingsBoard.tabs.${quick}`)}
              <Icon icon="ph:caret-down" className="size-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            <DropdownMenuRadioGroup
              value={quick}
              onValueChange={(v) => setQuick(v as QuickKey)}
            >
              {QUICK_KEYS.map((key) => (
                <DropdownMenuRadioItem key={key} value={key}>
                  <span className="flex w-full items-center justify-between gap-3">
                    {key === "all"
                      ? t("bookingsBoard.quickFiltersAll")
                      : t(`bookingsBoard.tabs.${key}`)}
                    <span className="text-xs text-muted-foreground">
                      {counts[key]}
                    </span>
                  </span>
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          aria-expanded={filtersOpen}
          className="gap-2"
        >
          <Icon icon="ph:gear-six-fill" className="size-4" />
          {t("bookingsBoard.moreFilters")}
          {activeFilters > 0 && (
            <span className="rounded-full bg-primary-foreground/25 px-1.5 text-xs font-semibold">
              {activeFilters}
            </span>
          )}
        </Button>

        <span className="ml-auto text-sm text-muted-foreground">
          {t("bookingsBoard.entriesCount", { count: matched.length })}
        </span>
      </div>

      {/* Ausgeklappte Filter: Suche, Objekte/Ressourcen, Status. */}
      {filtersOpen && (
        <Card className="flex flex-wrap items-center gap-2 p-3">
          <div className="relative">
            <Icon
              icon="ph:magnifying-glass"
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("bookingsBoard.searchPlaceholder")}
              className="w-64 pl-9"
            />
          </div>
          <BookingsFilter
            properties={properties}
            selectedProps={propFilter}
            onProps={setPropFilter}
            selectedTypes={typeFilter}
            onTypes={setTypeFilter}
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline" className="gap-2">
                <Icon
                  icon="ph:circle-half-tilt"
                  className="size-4 text-muted-foreground"
                />
                <span className="text-sm">
                  {statusFilter === "all"
                    ? t("bookingsBoard.allStatuses")
                    : statusLabel(statusFilter)}
                </span>
                <Icon icon="ph:caret-down" className="size-3 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-52">
              <DropdownMenuRadioGroup
                value={statusFilter}
                onValueChange={(v) => setStatusFilter(v as DisplayStatus | "all")}
              >
                <DropdownMenuRadioItem value="all">
                  {t("bookingsBoard.allStatuses")}
                </DropdownMenuRadioItem>
                {(
                  Object.keys(STATUS_META) as DisplayStatus[]
                ).map((s) => (
                  <DropdownMenuRadioItem key={s} value={s}>
                    {statusLabel(s)}
                  </DropdownMenuRadioItem>
                ))}
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </Card>
      )}

      {/* Tabelle */}
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[64rem] text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                {shows("calendar") && (
                  <th className="px-3 py-2.5 font-normal">
                    {t("bookingsBoard.columns.calendar")}
                  </th>
                )}
                {shows("details") && (
                  <th className="px-3 py-2.5 font-normal">
                    {t("bookingsBoard.columns.details")}
                  </th>
                )}
                {shows("contact") && (
                  <th className="px-3 py-2.5 font-normal">
                    {t("bookingsBoard.columns.contact")}
                  </th>
                )}
                <th className="px-3 py-2.5 font-normal">
                  {t("bookingsBoard.columns.guestName")}
                </th>
                {shows("checkIn") && (
                  <th className="px-3 py-2.5 font-normal">
                    {t("bookingsBoard.columns.checkIn")}
                  </th>
                )}
                {shows("checkOut") && (
                  <th className="px-3 py-2.5 font-normal">
                    {t("bookingsBoard.columns.checkOut")}
                  </th>
                )}
                {shows("channel") && (
                  <th className="px-3 py-2.5 font-normal">
                    {t("bookingsBoard.columns.channel")}
                  </th>
                )}
                {shows("totalPrice") && (
                  <th className="px-3 py-2.5 font-normal">
                    {t("bookingsBoard.columns.totalPrice")}
                  </th>
                )}
                {shows("status") && (
                  <th className="px-3 py-2.5 font-normal">
                    {t("bookingsBoard.columns.status")}
                  </th>
                )}
                {shows("listing") && (
                  <th className="px-3 py-2.5 font-normal">
                    {t("bookingsBoard.columns.listing")}
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <BookingRow
                  key={r.id}
                  r={r}
                  title={titleOf[r.property_id] ?? "—"}
                  todayKey={todayKey}
                  shows={shows}
                  onOpen={() => router.push(`/reservierungen/${r.id}`)}
                  t={t}
                />
              ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td
                    colSpan={colCount}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    {t("bookingsBoard.emptyState")}
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td
                    colSpan={colCount}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    {t("bookingsBoard.loading")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* „Hinzufügen" öffnet denselben Anlege-Assistenten wie Kalender und
          Posteingang — eine Anlege-Strecke, kein zweiter Weg. */}
      {wizardOpen && properties.length > 0 && (
        <ReservationWizard
          open
          onClose={() => setWizardOpen(false)}
          onSaved={() => {
            setWizardOpen(false);
            void load();
          }}
          properties={properties.map((p) => ({ id: p.id, title: p.title }))}
          initialPropertyId={properties[0].id}
          checkIn={todayKey}
          checkOut={dateKey(new Date(Date.now() + 86_400_000))}
          basePrice={0}
          editableDates
        />
      )}
    </div>
  );
}

/** Icon-Knopf einer Zeile — stoppt die Klick-Weitergabe an die Zeile, damit
 *  der Sprung ins Ziel geht und nicht auf die Detailseite. */
function RowAction({
  icon,
  label,
  onClick,
  disabled,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="text-accent transition-colors hover:text-accent/70 disabled:cursor-not-allowed disabled:text-muted-foreground/40"
    >
      <Icon icon={icon} className="size-5" />
    </button>
  );
}

function BookingRow({
  r,
  title,
  todayKey,
  shows,
  onOpen,
  t,
}: {
  r: Reservation;
  title: string;
  todayKey: string;
  shows: (key: ColumnKey) => boolean;
  onOpen: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const locale = useLocale();
  const router = useRouter();
  const { channelLabel, statusLabel } = useCalendarLabels();
  const ds = displayStatusOf(r, todayKey);
  const sm = STATUS_META[ds];
  const cm = channelMeta(channelSource(r));

  return (
    <tr
      onClick={onOpen}
      className="cursor-pointer border-b transition-colors even:bg-secondary/40 last:border-0 hover:bg-secondary/70"
    >
      {shows("calendar") && (
        <td className="px-3 py-3">
          <RowAction
            icon="ph:calendar-blank"
            label={t("bookingsBoard.openCalendar")}
            onClick={() => router.push(`/kalender?reservation=${r.id}`)}
          />
        </td>
      )}
      {shows("details") && (
        <td className="px-3 py-3">
          <RowAction
            icon="ph:list-dashes"
            label={t("bookingsBoard.openDetails")}
            onClick={onOpen}
          />
        </td>
      )}
      {shows("contact") && (
        <td className="px-3 py-3">
          {/* Kein verknüpfter Gast (Eigennutzung, Sperre) → Knopf sichtbar
              deaktiviert statt eines Links ins Leere (Wurzel 4). */}
          <RowAction
            icon="ph:chats-circle-fill"
            label={
              r.guest_id
                ? t("bookingsBoard.openContact")
                : t("bookingsBoard.noContact")
            }
            disabled={!r.guest_id}
            onClick={() => router.push(`/gaeste/${r.guest_id}`)}
          />
        </td>
      )}
      <td className="px-3 py-3 font-medium">
        <span className="flex items-center gap-1.5">
          {r.is_owner_stay && (
            <span
              title={t("bookingsBoard.ownerStay")}
              aria-label={t("bookingsBoard.ownerStay")}
            >
              <Icon
                icon={OWNER_STAY_ICON}
                className="size-4 shrink-0 text-muted-foreground"
              />
            </span>
          )}
          <span className="truncate">{r.guest_name}</span>
        </span>
      </td>
      {shows("checkIn") && (
        <td className="whitespace-nowrap px-3 py-3 tabular-nums">{r.check_in}</td>
      )}
      {shows("checkOut") && (
        <td className="whitespace-nowrap px-3 py-3 tabular-nums">{r.check_out}</td>
      )}
      {shows("channel") && (
        <td className="px-3 py-3">
          {/* Kanal als Marken-Logo in Kanalfarbe (Token, kein Inline-Hex).
              Eigentümer-Aufenthalt (0241) hat keinen Vertriebskanal — dort
              steht die Art statt eines irreführenden „Direkt". */}
          {r.is_owner_stay ? (
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <Icon icon={OWNER_STAY_ICON} className="size-4" />
              {t("bookingsBoard.ownerStay")}
            </span>
          ) : (
            <span className={"inline-flex items-center gap-1.5 " + cm.textFg}>
              {cm.logo.kind === "icon" ? (
                <Icon icon={cm.logo.icon} className="size-4" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={cm.logo.src} alt="" className="h-4" />
              )}
              <span className="font-medium">
                {r.ota_name
                  ? channelLabelLoose(r.ota_name)
                  : channelLabel(channelSource(r))}
              </span>
            </span>
          )}
        </td>
      )}
      {shows("totalPrice") && (
        <td className="whitespace-nowrap px-3 py-3 tabular-nums">
          {/* Betrag maskiert (Rollen ohne Finanzeinblick) → „—", kein
              0-Fallback. Währung IMMER aus der Zeile (Wurzel 4). */}
          {r.total_amount == null ? (
            <span className="text-muted-foreground">—</span>
          ) : (
            formatCurrency(r.total_amount, r.currency, locale)
          )}
        </td>
      )}
      {shows("status") && (
        <td className="px-3 py-3">
          <span
            className="inline-flex items-center gap-1.5"
            title={statusLabel(ds)}
          >
            <Icon
              icon={sm.icon}
              className={"size-5 " + STATUS_ICON_FG[ds]}
              aria-label={statusLabel(ds)}
            />
            <span className={"text-xs " + STATUS_ICON_FG[ds]}>
              {statusLabel(ds)}
            </span>
          </span>
        </td>
      )}
      {shows("listing") && (
        <td className="max-w-64 truncate px-3 py-3 text-muted-foreground">
          {title}
        </td>
      )}
    </tr>
  );
}

/** Statusfarbe der Icon-Spalte — dieselbe Semantik wie die Kalender-Punkte
 *  (STATUS_META.dotBg), nur als Vordergrund-Token. */
const STATUS_ICON_FG: Record<DisplayStatus, string> = {
  pending: "text-warning",
  confirmed: "text-success",
  in_house: "text-channel-vrbo",
  completed: "text-muted-foreground",
  cancelled: "text-destructive",
};

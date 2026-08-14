"use client";

// Buchungstabelle der PM-Fläche mit den fünf ..-Reitern:
//   Belegt   – Aufenthalte, die HEUTE laufen (heute belegt, aktiv)
//   Ankünfte – Anreisen ab heute (heute + zukünftig)
//   Abfahrten– Abreisen ab heute
//   Zukunft  – Anreisen NACH heute
//   Vergangen– abgereist / ausgecheckt / vergangen
// Der Klick auf eine Zeile führt auf die Detail-Vollseite /reservierungen/{id}.
//
// Ein listReservations()-Call speist alle Reiter; EIN Realtime-Abo (Pflicht,
// CLAUDE.md) hält sie live. Beträge kommen bereits maskiert aus dem Backend
// (null → „—", kein 0-Fallback); Bezahlt-% nur wenn ein Betrag sichtbar ist.
import { Icon } from "@iconify/react";
import { useTranslations, useLocale } from "next-intl";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { BookingsFilter } from "@/components/reservierungen/bookings-filter";
import { Card } from "@nextdays/ui/card";
import { Input } from "@nextdays/ui/input";
import { channelMeta } from "@/lib/calendar-channels";
import { useCalendarLabels } from "@/lib/use-calendar-labels";
import { OWNER_STAY_ICON, STATUS_META } from "@/lib/calendar-status";
import {
  channelSource,
  dateKey,
  displayStatusOf,
  fmtDayShort,
  nights,
  occupiesNight,
} from "@/lib/calendar-views";
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

type TabKey = "occupied" | "arrivals" | "departures" | "future" | "past";

const TAB_KEYS: TabKey[] = [
  "occupied",
  "arrivals",
  "departures",
  "future",
  "past",
];

// Ein Reiter = ein Prädikat auf eine (nicht-stornierte, außer „Vergangen")
// Reservierung, gemessen am heutigen Tag. Kapselt die Reiter-Semantik an EINER
// Stelle, damit Tab-Zähler und Tabelle garantiert dasselbe filtern.
function matchesTab(r: Reservation, tab: TabKey, todayKey: string): boolean {
  const done = displayStatusOf(r, todayKey);
  switch (tab) {
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
      // storniert — die Historie. (Stornos erscheinen NUR hier.)
      return (
        r.check_out < todayKey || done === "completed" || done === "cancelled"
      );
    default:
      return false;
  }
}

export function BookingsBoard({ properties }: { properties: Prop[] }) {
  const t = useTranslations("reservations");
  const router = useRouter();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("occupied");
  const [query, setQuery] = useState("");
  // Multiselect-Filter (leer = alle): einzelne Objekte + Unterkunftsarten.
  const [propFilter, setPropFilter] = useState<string[]>([]);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);

  const todayKey = useMemo(() => dateKey(new Date()), []);

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

  // property_id → Titelbild (Thumbnail in der Unterkunft-Spalte).
  const photoOf = useMemo(() => {
    const map: Record<string, string | null> = {};
    for (const p of properties) map[p.id] = p.photo;
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
  // Titel + Titelbild kommen serverseitig (page.tsx) — ein gewechseltes Cover
  // oder ein umbenanntes Objekt erschiene sonst erst nach manuellem Reload.
  // router.refresh() statt load(), weil load() nur die Reservierungen holt.
  useRealtime({ table: "properties", onChange: () => router.refresh() });

  // Zähler je Reiter (aus demselben Datensatz — kein zweiter Call).
  const counts = useMemo(() => {
    const c: Record<TabKey, number> = {
      occupied: 0,
      arrivals: 0,
      departures: 0,
      future: 0,
      past: 0,
    };
    for (const r of reservations) {
      for (const key of TAB_KEYS) if (matchesTab(r, key, todayKey)) c[key] += 1;
    }
    return c;
  }, [reservations, todayKey]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reservations
      .filter((r) => matchesTab(r, tab, todayKey))
      // Multiselect-Filter (leer = alle): Objekt UND Unterkunftsart müssen passen.
      .filter((r) => propFilter.length === 0 || propFilter.includes(r.property_id))
      .filter(
        (r) =>
          typeFilter.length === 0 ||
          typeFilter.includes(typeOf[r.property_id] ?? ""),
      )
      .filter((r) => {
        if (!q) return true;
        const hay = `${r.guest_name} ${titleOf[r.property_id] ?? ""} ${r.ota_name ?? ""
          } ${r.external_ref ?? ""}`.toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => {
        // Ankünfte/Zukunft aufsteigend (was kommt zuerst?), sonst neuste zuerst.
        const asc = tab === "arrivals" || tab === "future";
        const key = tab === "departures" ? "check_out" : "check_in";
        const av = a[key];
        const bv = b[key];
        if (av === bv) return 0;
        return (av < bv ? -1 : 1) * (asc ? 1 : -1);
      });
  }, [reservations, tab, query, propFilter, typeFilter, typeOf, todayKey, titleOf]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold">
          {t("bookingsBoard.title")}
        </h1>
        <span className="text-sm text-muted-foreground">
          {t("bookingsBoard.totalCount", { count: reservations.length })}
        </span>
      </div>

      {/* Reiter (..-Tabs): GROß, zentriert, gleichmäßig über die Breite
          verteilt; Zähler dezent als Suffix. */}
      <div className="flex border-b">
        {TAB_KEYS.map((key) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              aria-current={active ? "true" : undefined}
              onClick={() => setTab(key)}
              className={
                "-mb-px flex flex-1 items-center justify-center gap-2 border-b-2 px-3 py-3 text-sm font-bold uppercase tracking-wide transition-colors " +
                (active
                  ? "border-accent text-accent"
                  : "border-transparent text-muted-foreground hover:text-foreground")
              }
            >
              {t(`bookingsBoard.tabs.${key}`)}
              <span
                className={
                  "text-xs font-semibold " +
                  (active ? "text-accent/70" : "text-muted-foreground/70")
                }
              >
                {counts[key]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filterzeile: Suche + Unterkünfte-/Ressourcen-Filter (..) */}
      <div className="flex flex-wrap items-center gap-2">
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
        <span className="ml-auto text-sm text-muted-foreground">
          {t("bookingsBoard.entriesCount", { count: rows.length })}
        </span>
      </div>

      {/* Tabelle (..-Spalten) */}
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[60rem] text-sm">
            <thead>
              <tr className="border-b bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 font-semibold">
                  {t("bookingsBoard.columns.status")}
                </th>
                <th className="px-4 py-2.5 font-semibold">
                  {t("bookingsBoard.columns.accommodation")}
                </th>
                <th className="px-4 py-2.5 font-semibold">
                  {t("bookingsBoard.columns.dates")}
                </th>
                <th className="px-4 py-2.5 font-semibold">
                  {t("bookingsBoard.columns.source")}
                </th>
                <th className="px-4 py-2.5 text-right font-semibold">
                  {t("bookingsBoard.columns.guests")}
                </th>
                <th className="px-4 py-2.5 text-right font-semibold">
                  {t("bookingsBoard.columns.paid")}
                </th>
                <th className="px-4 py-2.5 font-semibold">
                  {t("bookingsBoard.columns.reference")}
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <BookingRow
                  key={r.id}
                  r={r}
                  title={titleOf[r.property_id] ?? "—"}
                  photo={photoOf[r.property_id] ?? null}
                  todayKey={todayKey}
                  onOpen={() => router.push(`/reservierungen/${r.id}`)}
                  t={t}
                />
              ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    {t("bookingsBoard.emptyState")}
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td
                    colSpan={7}
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
    </div>
  );
}

function BookingRow({
  r,
  title,
  photo,
  todayKey,
  onOpen,
  t,
}: {
  r: Reservation;
  title: string;
  photo: string | null;
  todayKey: string;
  onOpen: () => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const locale = useLocale();
  const { channelLabel, statusLabel } = useCalendarLabels();
  const ds = displayStatusOf(r, todayKey);
  const sm = STATUS_META[ds];
  const cm = channelMeta(channelSource(r));

  // Bezahlt-Anteil (..-Spalte): echter Prozentsatz aus paid/total. Nur wenn
  // Beträge sichtbar sind (mask.amounts → total_amount nicht null); sonst „—"
  // (DSGVO-Daten-Split, kein erfundener Wert). total_amount == 0 → kein Prozent
  // (Division), stattdessen „—".
  const paidPct =
    r.total_amount == null || r.paid_amount == null || r.total_amount <= 0
      ? null
      : Math.min(100, Math.round((r.paid_amount / r.total_amount) * 100));

  return (
    <tr
      onClick={onOpen}
      className="cursor-pointer border-b transition-colors last:border-0 hover:bg-secondary/40"
    >
      <td className="px-4 py-3">
        <span
          className="inline-flex items-center gap-1.5"
          title={statusLabel(ds)}
          aria-label={statusLabel(ds)}
        >
          <Icon icon={sm.icon} className="size-4.5 text-muted-foreground" />
        </span>
      </td>
      <td className="px-4 py-3 font-medium">
        <span className="flex items-center gap-3">
          <span className="size-10 shrink-0 overflow-hidden rounded-lg bg-secondary">
            {photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={photo} alt="" className="size-full object-cover" />
            ) : (
              <span className="flex size-full items-center justify-center text-muted-foreground">
                <Icon icon="ph:house-line" className="size-5" />
              </span>
            )}
          </span>
          <span className="min-w-0">{title}</span>
        </span>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
        {fmtDayShort(r.check_in, locale)} – {fmtDayShort(r.check_out, locale)}
        <span className="ml-2 text-xs">
          ({t("bookingsBoard.nights", { count: nights(r.check_in, r.check_out) })})
        </span>
      </td>
      <td className="px-4 py-3">
        {/* Quelle in Kanalfarbe mit #-Präfix (.. „#booking.com"/„#airbnb").
            Farbe aus channelMeta.textFg (Token-System), kein Inline-Hex.
            Eigentümer-Aufenthalt (0241) hat keinen Vertriebskanal — dort steht
            die Art statt eines irreführenden „#Direkt". */}
        {r.is_owner_stay ? (
          <span className="inline-flex items-center gap-1.5 font-semibold text-muted-foreground">
            <Icon icon={OWNER_STAY_ICON} className="size-4" />
            {t("bookingsBoard.ownerStay")}
          </span>
        ) : (
          <span
            className={"inline-flex items-center gap-1.5 font-semibold " + cm.textFg}
          >
            {cm.logo.kind === "icon" ? (
              <Icon icon={cm.logo.icon} className="size-4" />
            ) : null}
            #{r.ota_name ? channelLabelLoose(r.ota_name) : channelLabel(channelSource(r))}
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-right tabular-nums">
        {/* Gäste: Personen-Icon + Zahl; Kinder-Icon nur wenn Kinder dabei sind
            (echte Aufschlüsselung aus den Daten — kein erfundener Wert). */}
        <span className="inline-flex items-center justify-end gap-1.5">
          <span className="inline-flex items-center gap-1">
            <Icon icon="ph:users" className="size-4 text-muted-foreground" />
            {r.num_guests}
          </span>
          {r.children > 0 && (
            <span
              className="inline-flex items-center gap-0.5 text-muted-foreground"
              title={t("bookingsBoard.children", { count: r.children })}
              aria-label={t("bookingsBoard.children", { count: r.children })}
            >
              <Icon icon="ph:baby" className="size-4" />
              {r.children}
            </span>
          )}
        </span>
      </td>
      <td className="px-4 py-3 text-right tabular-nums">
        {paidPct == null ? (
          <span className="text-muted-foreground">—</span>
        ) : (
          <span
            className={
              "font-semibold " +
              (paidPct >= 100
                ? "text-success"
                : paidPct <= 0
                  ? "text-destructive"
                  : "text-warning")
            }
          >
            {paidPct}%
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-1 font-medium text-accent">
          {r.external_ref ?? r.id.slice(0, 8)}
          <Icon icon="ph:arrow-square-out" className="size-3.5" />
        </span>
      </td>
    </tr>
  );
}

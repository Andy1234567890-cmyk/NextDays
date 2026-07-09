"use client";

// Buchungstabelle der PM-Fläche mit den fünf Lodgify-Reitern:
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
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { channelMeta } from "@/lib/calendar-channels";
import { STATUS_META } from "@/lib/calendar-status";
import {
  channelSource,
  dateKey,
  displayStatusOf,
  fmtDayShort,
  nights,
  occupiesNight,
} from "@/lib/calendar-views";
import { type Reservation, listReservations } from "@/lib/reservations";
import { useRealtime } from "@/lib/use-realtime";

type Prop = { id: string; title: string };

type TabKey = "occupied" | "arrivals" | "departures" | "future" | "past";

const TABS: { key: TabKey; label: string }[] = [
  { key: "occupied", label: "Belegt" },
  { key: "arrivals", label: "Ankünfte" },
  { key: "departures", label: "Abfahrten" },
  { key: "future", label: "Zukunft" },
  { key: "past", label: "Vergangen" },
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
  const router = useRouter();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<TabKey>("occupied");
  const [query, setQuery] = useState("");
  const [propFilter, setPropFilter] = useState<string>("all");

  const todayKey = useMemo(() => dateKey(new Date()), []);

  const titleOf = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of properties) map[p.id] = p.title;
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
      for (const t of TABS) if (matchesTab(r, t.key, todayKey)) c[t.key] += 1;
    }
    return c;
  }, [reservations, todayKey]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return reservations
      .filter((r) => matchesTab(r, tab, todayKey))
      .filter((r) => propFilter === "all" || r.property_id === propFilter)
      .filter((r) => {
        if (!q) return true;
        const hay = `${r.guest_name} ${titleOf[r.property_id] ?? ""} ${
          r.ota_name ?? ""
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
  }, [reservations, tab, query, propFilter, todayKey, titleOf]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-2xl font-extrabold">Buchungen</h1>
        <span className="text-sm text-muted-foreground">
          {reservations.length}{" "}
          {reservations.length === 1 ? "Buchung" : "Buchungen"} gesamt
        </span>
      </div>

      {/* Reiter (Lodgify-Tabs) */}
      <div className="flex flex-wrap gap-2 border-b">
        {TABS.map((t) => {
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              aria-current={active ? "true" : undefined}
              onClick={() => setTab(t.key)}
              className={
                "-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors " +
                (active
                  ? "border-accent text-accent"
                  : "border-transparent text-muted-foreground hover:text-foreground")
              }
            >
              {t.label}
              <span
                className={
                  "rounded-full px-2 py-0.5 text-xs font-bold " +
                  (active
                    ? "bg-accent/10 text-accent"
                    : "bg-secondary text-muted-foreground")
                }
              >
                {counts[t.key]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filterzeile */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Icon
            icon="ph:magnifying-glass"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Gast, Objekt, Referenz…"
            className="w-64 pl-9"
          />
        </div>
        <NativeSelect
          value={propFilter}
          onChange={(e) => setPropFilter(e.target.value)}
          className="h-9 w-auto"
        >
          <option value="all">Alle Unterkünfte</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </NativeSelect>
        <span className="ml-auto text-sm text-muted-foreground">
          {rows.length} {rows.length === 1 ? "Eintrag" : "Einträge"}
        </span>
      </div>

      {/* Tabelle (Lodgify-Spalten) */}
      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[60rem] text-sm">
            <thead>
              <tr className="border-b bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 font-semibold">Status</th>
                <th className="px-4 py-2.5 font-semibold">Unterkunft</th>
                <th className="px-4 py-2.5 font-semibold">Daten</th>
                <th className="px-4 py-2.5 font-semibold">Quelle</th>
                <th className="px-4 py-2.5 text-right font-semibold">Gäste</th>
                <th className="px-4 py-2.5 text-right font-semibold">Bezahlt</th>
                <th className="px-4 py-2.5 font-semibold">Referenz</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <BookingRow
                  key={r.id}
                  r={r}
                  title={titleOf[r.property_id] ?? "—"}
                  todayKey={todayKey}
                  onOpen={() => router.push(`/reservierungen/${r.id}`)}
                />
              ))}
              {!loading && rows.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    Keine Buchungen in diesem Reiter.
                  </td>
                </tr>
              )}
              {loading && (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    Lädt…
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
  todayKey,
  onOpen,
}: {
  r: Reservation;
  title: string;
  todayKey: string;
  onOpen: () => void;
}) {
  const ds = displayStatusOf(r, todayKey);
  const sm = STATUS_META[ds];
  const cm = channelMeta(channelSource(r));

  // Bezahlt-Anteil (Lodgify-Spalte): echter Prozentsatz aus paid/total. Nur wenn
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
          title={sm.label}
          aria-label={sm.label}
        >
          <Icon icon={sm.icon} className="size-4.5 text-muted-foreground" />
        </span>
      </td>
      <td className="px-4 py-3 font-medium">{title}</td>
      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
        {fmtDayShort(r.check_in)} – {fmtDayShort(r.check_out)}
        <span className="ml-2 text-xs">
          ({nights(r.check_in, r.check_out)}{" "}
          {nights(r.check_in, r.check_out) === 1 ? "Nacht" : "Nächte"})
        </span>
      </td>
      <td className="px-4 py-3">
        <span className="inline-flex items-center gap-1.5">
          {cm.logo.kind === "icon" ? (
            <Icon icon={cm.logo.icon} className="size-4" />
          ) : null}
          {r.ota_name ?? cm.label}
        </span>
      </td>
      <td className="px-4 py-3 text-right tabular-nums">
        <span className="inline-flex items-center justify-end gap-1">
          <Icon icon="ph:users" className="size-4 text-muted-foreground" />
          {r.num_guests}
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

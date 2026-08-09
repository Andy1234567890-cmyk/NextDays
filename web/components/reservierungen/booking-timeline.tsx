"use client";

// Ereignis-Zeitleiste einer Buchung (.. „Zeitleiste") — der KOMPLETTE Flow:
// Buchung erstellt (auch OTA-Import Booking/Airbnb), verschoben, Preis neu
// berechnet, ein-/ausgecheckt, storniert, Nachrichten, Aufgaben, Zahlungen,
// Zusatzleistungen. Chronologisch, neueste zuerst — als Karten mit Objekt-
// Thumbnail, reichen Detailzeilen, Kontext-Badges und Datums-Fußzeile.
// [[buchungs-zeitleiste-kompletter-flow]]
//
// Datenquelle: GET /reservations/{id}/timeline. Realtime nach dem Notion-Muster:
// KEIN Reload — jede speisende Tabelle ist abonniert, neue Ereignisse kommen live
// ([[realtime-kein-manuelles-reload]] / [[realtime-websocket-pflicht]]).
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import { LearnButton } from "@/components/reservierungen/learn-dialog";
import { formatCurrency } from "@/lib/currency";
import {
  type Timeline,
  type TimelineEvent,
  getReservationTimeline,
} from "@/lib/reservations";
import { useRealtime } from "@/lib/use-realtime";
import { channelLabelLoose } from "@/lib/channel-logos";

// Icon (auf der Achse) + Beschriftung + Filter-Kategorie je Ereignis-Art. Der
// Kunde sieht nie „Channex"/Fachjargon ([[ui-nie-channex-nennen]]).
type Category = "booking" | "message" | "task" | "payment";
type T = ReturnType<typeof useTranslations>;
// icon = Achsen-Symbol (groß, kräftig, wie ..: Häkchen/$/…). labelKey = Key
// für die fette Titelzeile über der Karte.
const KIND_META: Record<
  string,
  { icon: string; labelKey: string; tone: string; cat: Category }
> = {
  created: { icon: "ph:currency-circle-dollar-fill", labelKey: "kind.created", tone: "text-success", cat: "booking" },
  moved: { icon: "ph:arrows-left-right", labelKey: "kind.moved", tone: "text-foreground", cat: "booking" },
  repriced: { icon: "ph:currency-eur", labelKey: "kind.repriced", tone: "text-foreground", cat: "booking" },
  checked_in: { icon: "ph:door-open", labelKey: "kind.checkedIn", tone: "text-success", cat: "booking" },
  checked_out: { icon: "ph:flag-checkered-fill", labelKey: "kind.checkedOut", tone: "text-foreground", cat: "booking" },
  cancelled: { icon: "ph:x-circle-fill", labelKey: "kind.cancelled", tone: "text-destructive", cat: "booking" },
  task_created: { icon: "ph:check-circle-fill", labelKey: "kind.taskCreated", tone: "text-foreground", cat: "task" },
  message: { icon: "ph:chat-circle-text-fill", labelKey: "kind.message", tone: "text-foreground", cat: "message" },
  payment: { icon: "ph:currency-circle-dollar-fill", labelKey: "kind.payment", tone: "text-success", cat: "payment" },
  addon: { icon: "ph:sparkle-fill", labelKey: "kind.addon", tone: "text-foreground", cat: "payment" },
};

function useFilters(t: T): { key: Category; label: string }[] {
  return [
    { key: "booking", label: t("bookingTimeline.filters.booking") },
    { key: "message", label: t("bookingTimeline.filters.message") },
    { key: "task", label: t("bookingTimeline.filters.task") },
    { key: "payment", label: t("bookingTimeline.filters.payment") },
  ];
}

// Kanal-Klartext (nie „direct" roh zeigen; eigene Plattform ist ein Kanal).
function channelLabel(t: T, channel: string): string {
  const map: Record<string, string> = {
    direct: t("bookingTimeline.channel.direct"),
    portal: "myBestDays",
    booking: "Booking.com",
    airbnb: "Airbnb",
    vrbo: "Vrbo",
  };
  return map[channel] ?? channel;
}

function metaFor(t: T, kind: string) {
  const meta = KIND_META[kind];
  if (!meta) {
    return {
      icon: "ph:dot-outline",
      label: kind,
      tone: "text-muted-foreground",
      cat: "booking" as Category,
    };
  }
  return { ...meta, label: t(`bookingTimeline.${meta.labelKey}`) };
}

const s = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const n = (v: unknown): number | null => (typeof v === "number" ? v : null);

function fmtDate(iso: string, locale: string, withTime = false): string {
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

// Ausführliche Fußzeile (Wochentag, Datum, Uhrzeit) — wie .. unter der Karte.
function fmtFooter(iso: string, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function pickName(name: unknown): string | null {
  if (typeof name === "string") return name || null;
  if (name && typeof name === "object") {
    const o = name as Record<string, unknown>;
    const v = o.de ?? o.en ?? Object.values(o)[0];
    return typeof v === "string" ? v : null;
  }
  return null;
}

// Titelzeile der Karte (fett, oben) — je Ereignis kontextbezogen.
function cardTitle(t: T, ev: TimelineEvent, propertyTitle: string): string {
  const d = ev.detail || {};
  const on = propertyTitle ? t("bookingTimeline.title.onProperty", { property: propertyTitle }) : "";
  switch (ev.kind) {
    case "created": {
      const ota = channelLabelLoose(s(d.ota_name)) || null;
      const ch = s(d.channel);
      const src = ota ?? (ch ? channelLabel(t, ch) : null);
      return src
        ? t("bookingTimeline.title.newBookingFrom", { source: src, on })
        : t("bookingTimeline.title.bookingCreated", { on });
    }
    case "task_created":
      return `${s(d.title) ?? t("bookingTimeline.title.task")}${on}`;
    case "message": {
      const sender = s(d.sender);
      return sender
        ? t("bookingTimeline.title.messageFrom", { sender })
        : t("bookingTimeline.title.newMessage");
    }
    default:
      return metaFor(t, ev.kind).label + on;
  }
}

// Detailzeilen (Label: Wert) je Ereignis — nur vorhandene Felder (Wurzel 4).
function cardRows(t: T, ev: TimelineEvent, currency: string, locale: string): [string, string][] {
  const d = ev.detail || {};
  const cur = s(d.currency) ?? currency;
  const money = (v: unknown) =>
    n(v) != null && cur ? formatCurrency(n(v) as number, cur) : null;
  const rows: [string, string][] = [];
  const push = (label: string, val: string | null) => {
    if (val) rows.push([label, val]);
  };
  switch (ev.kind) {
    case "created":
      push(t("bookingTimeline.row.checkIn"), s(d.check_in) ? fmtDate(s(d.check_in) as string, locale) : null);
      push(t("bookingTimeline.row.checkOut"), s(d.check_out) ? fmtDate(s(d.check_out) as string, locale) : null);
      push(t("bookingTimeline.row.guests"), n(d.num_guests) != null ? String(n(d.num_guests)) : null);
      push(t("bookingTimeline.row.price"), money(d.total_amount));
      break;
    case "task_created":
      push(t("bookingTimeline.row.status"), s(d.status));
      push(t("bookingTimeline.row.assignee"), s(d.assignee));
      push(
        t("bookingTimeline.row.dueAt"),
        s(d.due_at) ? fmtDate(s(d.due_at) as string, locale, true) : null,
      );
      break;
    case "moved":
      push(
        t("bookingTimeline.row.change"),
        d.same_property === true
          ? t("bookingTimeline.row.periodChanged")
          : t("bookingTimeline.row.movedToOtherProperty"),
      );
      push(t("bookingTimeline.row.checkIn"), s(d.check_in) ? fmtDate(s(d.check_in) as string, locale) : null);
      push(t("bookingTimeline.row.checkOut"), s(d.check_out) ? fmtDate(s(d.check_out) as string, locale) : null);
      break;
    case "repriced":
      push(t("bookingTimeline.row.newPrice"), money(d.total_amount) ?? t("bookingTimeline.row.recalculated"));
      break;
    case "checked_out":
      push(t("bookingTimeline.row.invoice"), s(d.invoice_number));
      break;
    case "cancelled":
      push(t("bookingTimeline.row.reason"), s(d.reason));
      break;
    case "message":
      push(t("bookingTimeline.row.channel"), s(d.channel) ? channelLabel(t, s(d.channel) as string) : null);
      push(t("bookingTimeline.row.text"), s(d.preview));
      break;
    case "payment":
      push(t("bookingTimeline.row.amount"), money(d.amount));
      push(t("bookingTimeline.row.type"), s(d.type));
      push(t("bookingTimeline.row.status"), s(d.status));
      break;
    case "addon":
      push(t("bookingTimeline.row.service"), pickName(d.name));
      push(t("bookingTimeline.row.price"), money(d.price));
      push(t("bookingTimeline.row.status"), s(d.status));
      break;
    default:
      break;
  }
  return rows;
}

export function BookingTimeline({
  reservationId,
  currency,
  variant = "tab",
}: {
  reservationId: string;
  currency: string;
  variant?: "tab" | "compact";
}) {
  const t = useTranslations("reservations");
  const locale = useLocale();
  const FILTERS = useFilters(t);
  const [tl, setTl] = useState<Timeline | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState<Set<Category>>(new Set());

  const load = () =>
    getReservationTimeline(reservationId).then((res) => {
      if (res.ok) setTl(res.data);
      else setError(res.error);
    });

  useEffect(() => {
    let alive = true;
    setTl(null);
    setError(null);
    getReservationTimeline(reservationId).then((res) => {
      if (!alive) return;
      if (res.ok) setTl(res.data);
      else setError(res.error);
    });
    return () => {
      alive = false;
    };
  }, [reservationId]);

  // Realtime (Notion-Muster) auf ALLEN speisenden Tabellen — kein Polling: jeder
  // refetch ist durch ein echtes postgres_changes-Event der jeweiligen Tabelle
  // getriggert. reservation_events zusätzlich inkrementell (schnellster Pfad).
  useRealtime<{ id?: string; kind?: string; created_at?: string; detail?: unknown }>({
    table: "reservation_events",
    filter: `reservation_id=eq.${reservationId}`,
    onEvent: (payload) => {
      const row = payload.new;
      if (!row?.id || !row.created_at) return;
      setTl((prev) => {
        if (!prev) return prev;
        if (prev.items.some((e) => e.id === row.id)) return prev;
        const next: TimelineEvent = {
          id: String(row.id),
          kind: String(row.kind ?? ""),
          at: String(row.created_at),
          by_user_id: null,
          detail:
            row.detail && typeof row.detail === "object"
              ? (row.detail as Record<string, unknown>)
              : {},
          synthetic: false,
        };
        const items = [next, ...prev.items].sort((a, b) => (a.at < b.at ? 1 : -1));
        return { ...prev, items };
      });
    },
  });
  // messages ist für authenticated gesperrt (Wurzel 6, Migration 0337):
  // Nachrichteninhalt an der Buchung, den §4.3 vor staff/cleaner verbirgt. Ein
  // Abo darauf liefert kein Event mehr.
  // KEIN Umhängen auf reservation_events: geprüft im Backend — der Nachrichten-
  // Pfad ruft _log_event() nicht auf, es entsteht also KEINE Event-Zeile zu
  // einer Nachricht. Ein Abo dort wäre dieselbe Attrappe unter anderem Namen.
  // Entfällt: eine neue Nachricht erscheint nicht mehr von selbst in der
  // Zeitleiste. Die übrigen Zweige (Ereignisse, Aufgaben, Reservierung,
  // Zusatzleistungen) bleiben live — siehe die Abos direkt darunter.
  useRealtime({ table: "tasks", filter: `reservation_id=eq.${reservationId}`, onChange: load });
  // payments ist für authenticated bewusst gesperrt (Wurzel 6). Jede Zahlung setzt
  // aber reservations.payment_status — deshalb hängt der Zahlungs-Zweig der
  // Zeitleiste an der Reservierung selbst.
  useRealtime({ table: "reservations", filter: `id=eq.${reservationId}`, onChange: load });
  useRealtime({ table: "reservation_addons", filter: `reservation_id=eq.${reservationId}`, onChange: load });

  const events = tl?.items ?? null;
  const shown = useMemo(() => {
    if (!events) return events;
    if (active.size === 0) return events;
    return events.filter((e) => active.has(metaFor(t, e.kind).cat));
  }, [events, active, t]);

  const toggle = (c: Category) =>
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });

  const isTab = variant === "tab";
  const photo = tl?.property_photo ?? null;
  const propTitle = tl?.property_title ?? "";
  const propId = tl?.property_id ?? "";

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2
            className={
              isTab
                ? "font-display text-2xl font-extrabold"
                : "font-display text-lg font-bold"
            }
          >
            {t("bookingTimeline.heading")}
          </h2>
          {/* „Lernen"-Button (wie ..) mit dem Zeitleiste-Erklärtext. */}
          <LearnButton title={t("bookingTimeline.heading")}>
            <p className="text-sm text-muted-foreground">
              {t("bookingTimeline.learnText")}
            </p>
          </LearnButton>
        </div>

        {isTab && (
          <div className="flex flex-wrap items-center gap-2">
            {FILTERS.map((f) => {
              const on = active.has(f.key);
              return (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => toggle(f.key)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${on
                      ? "border-accent bg-accent/10 text-accent"
                      : "border-border text-muted-foreground hover:text-foreground"
                    }`}
                >
                  {f.label}
                </button>
              );
            })}
            {active.size > 0 && (
              <button
                type="button"
                onClick={() => setActive(new Set())}
                className="text-xs text-muted-foreground hover:text-foreground hover:underline"
              >
                {t("bookingTimeline.resetAll")}
              </button>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!error && events === null && (
        <p className="text-sm text-muted-foreground">{t("bookingTimeline.loading")}</p>
      )}

      {!error && shown && shown.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {events && events.length > 0
            ? t("bookingTimeline.emptyFiltered")
            : t("bookingTimeline.emptyNone")}
        </p>
      )}

      {shown && shown.length > 0 && (
        <ol className="flex flex-col">
          {shown.map((ev, i) => {
            const m = metaFor(t, ev.kind);
            const rows = cardRows(t, ev, currency, locale);
            const last = i === shown.length - 1;
            return (
              <li key={ev.id} className="flex gap-5">
                {/* Achse: großes Icon direkt auf der Linie (wie ..) +
                    durchgehende vertikale Linie bis zum nächsten Eintrag. */}
                <div className="flex flex-col items-center">
                  <Icon icon={m.icon} className={`size-7 shrink-0 ${m.tone}`} />
                  {!last && <span className="mt-1 w-0.5 flex-1 bg-border" />}
                </div>

                <div className={`min-w-0 flex-1 ${last ? "pb-1" : "pb-9"}`}>
                  {/* Fette Titelzeile über der Karte. */}
                  <p className="text-base font-bold">{m.label}</p>

                  {/* Ereignis-Karte: rundes Objekt-Thumbnail + Detailzeilen. */}
                  <div className="mt-3 flex gap-4">
                    <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full border bg-secondary">
                      {photo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={photo} alt="" className="size-full object-cover" />
                      ) : (
                        <Icon
                          icon="ph:house-line"
                          className="size-7 text-muted-foreground"
                        />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">
                        {cardTitle(t, ev, propTitle)}
                      </p>
                      {rows.length > 0 && (
                        <dl className="mt-1.5 flex flex-col gap-1 text-sm">
                          {rows.map(([label, val], k) => (
                            <div key={k} className="flex flex-wrap gap-1.5">
                              <dt className="shrink-0 font-semibold">{label}:</dt>
                              <dd className="min-w-0 text-muted-foreground">
                                {val}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      )}
                      {/* Kontext-Badges (klickbar, wie ..): Objekt → dessen
                          Kalender-Seite, „Buchung" → die Buchungs-Übersicht. Der
                          Objekt-Badge erscheint, sobald ein Titel da ist; klickbar
                          nur mit property_id (sonst nicht-verlinkt, aber sichtbar). */}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {propTitle &&
                          (propId ? (
                            <Link
                              href={`/reservierungen/unterkuenfte/${propId}/kalender`}
                              className="rounded-(--radius) border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-accent hover:text-accent"
                            >
                              {propTitle}
                            </Link>
                          ) : (
                            <span className="rounded-(--radius) border px-2.5 py-1 text-xs font-medium text-muted-foreground">
                              {propTitle}
                            </span>
                          ))}
                        <Link
                          href={`/reservierungen/${reservationId}`}
                          className="rounded-(--radius) border px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:border-accent hover:text-accent"
                        >
                          {t("bookingTimeline.bookingLink")}
                        </Link>
                      </div>

                      {/* Datums-Fußzeile (fett), wie .. unter der Karte. */}
                      <p className="mt-3 text-xs font-bold text-foreground">
                        {fmtFooter(ev.at, locale)}
                      </p>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

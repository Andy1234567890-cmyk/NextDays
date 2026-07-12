"use client";

// Ereignis-Zeitleiste einer Buchung (Lodgify „Zeitleiste") — der KOMPLETTE Flow:
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
import { useEffect, useMemo, useState } from "react";

import { LearnButton } from "@/components/reservierungen/learn-dialog";
import { formatCurrency } from "@/lib/currency";
import {
  type Timeline,
  type TimelineEvent,
  getReservationTimeline,
} from "@/lib/reservations";
import { useRealtime } from "@/lib/use-realtime";

// Icon (auf der Achse) + Beschriftung + Filter-Kategorie je Ereignis-Art. Der
// Kunde sieht nie „Channex"/Fachjargon ([[ui-nie-channex-nennen]]).
type Category = "booking" | "message" | "task" | "payment";
// icon = Achsen-Symbol (groß, kräftig, wie Lodgify: Häkchen/$/…). tone = Icon-
// Farbe. label = fette Titelzeile über der Karte.
const KIND_META: Record<
  string,
  { icon: string; label: string; tone: string; cat: Category }
> = {
  created: { icon: "ph:currency-circle-dollar-fill", label: "Buchung erstellt", tone: "text-success", cat: "booking" },
  moved: { icon: "ph:arrows-left-right", label: "Verschoben", tone: "text-foreground", cat: "booking" },
  repriced: { icon: "ph:currency-eur", label: "Preis neu berechnet", tone: "text-foreground", cat: "booking" },
  checked_in: { icon: "ph:door-open", label: "Eingecheckt", tone: "text-success", cat: "booking" },
  checked_out: { icon: "ph:flag-checkered-fill", label: "Ausgecheckt", tone: "text-foreground", cat: "booking" },
  cancelled: { icon: "ph:x-circle-fill", label: "Storniert", tone: "text-destructive", cat: "booking" },
  task_created: { icon: "ph:check-circle-fill", label: "Aufgabe erstellt", tone: "text-foreground", cat: "task" },
  message: { icon: "ph:chat-circle-text-fill", label: "Nachricht", tone: "text-foreground", cat: "message" },
  payment: { icon: "ph:currency-circle-dollar-fill", label: "Zahlung", tone: "text-success", cat: "payment" },
  addon: { icon: "ph:sparkle-fill", label: "Zusatzleistung", tone: "text-foreground", cat: "payment" },
};

const FILTERS: { key: Category; label: string }[] = [
  { key: "booking", label: "Buchung" },
  { key: "message", label: "Nachrichten" },
  { key: "task", label: "Aufgaben" },
  { key: "payment", label: "Zahlungen" },
];

// Kanal-Klartext (nie „direct" roh zeigen; eigene Plattform ist ein Kanal).
const CHANNEL_LABEL: Record<string, string> = {
  direct: "Direkt",
  portal: "myNextDays",
  booking: "Booking.com",
  airbnb: "Airbnb",
  vrbo: "Vrbo",
};

function metaFor(kind: string) {
  return (
    KIND_META[kind] ?? {
      icon: "ph:dot-outline",
      label: kind,
      tone: "text-muted-foreground",
      cat: "booking" as Category,
    }
  );
}

const s = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
const n = (v: unknown): number | null => (typeof v === "number" ? v : null);

function fmtDate(iso: string, withTime = false): string {
  const d = new Date(iso.length <= 10 ? `${iso}T00:00:00` : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("de-DE", {
    day: "numeric",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

// Ausführliche Fußzeile (Wochentag, Datum, Uhrzeit) — wie Lodgify unter der Karte.
function fmtFooter(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("de-DE", {
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
function cardTitle(ev: TimelineEvent, propertyTitle: string): string {
  const d = ev.detail || {};
  const on = propertyTitle ? ` auf ${propertyTitle}` : "";
  switch (ev.kind) {
    case "created": {
      const ota = s(d.ota_name);
      const ch = s(d.channel);
      const src = ota ?? (ch ? CHANNEL_LABEL[ch] ?? ch : null);
      return src
        ? `Neue Buchung erhalten von ${src}${on}`
        : `Buchung erstellt${on}`;
    }
    case "task_created":
      return `${s(d.title) ?? "Aufgabe"}${on}`;
    case "message": {
      const sender = s(d.sender);
      return sender ? `Nachricht von ${sender}` : "Neue Nachricht";
    }
    default:
      return metaFor(ev.kind).label + on;
  }
}

// Detailzeilen (Label: Wert) je Ereignis — nur vorhandene Felder (Wurzel 4).
function cardRows(ev: TimelineEvent, currency: string): [string, string][] {
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
      push("Anreise", s(d.check_in) ? fmtDate(s(d.check_in) as string) : null);
      push("Abreise", s(d.check_out) ? fmtDate(s(d.check_out) as string) : null);
      push("Gäste", n(d.num_guests) != null ? String(n(d.num_guests)) : null);
      push("Preis", money(d.total_amount));
      break;
    case "task_created":
      push("Status", s(d.status));
      push("Zuständig", s(d.assignee));
      push(
        "Fällig bis",
        s(d.due_at) ? fmtDate(s(d.due_at) as string, true) : null,
      );
      break;
    case "moved":
      push(
        "Änderung",
        d.same_property === true
          ? "Zeitraum geändert"
          : "In anderes Objekt verschoben",
      );
      push("Anreise", s(d.check_in) ? fmtDate(s(d.check_in) as string) : null);
      push("Abreise", s(d.check_out) ? fmtDate(s(d.check_out) as string) : null);
      break;
    case "repriced":
      push("Neuer Preis", money(d.total_amount) ?? "neu berechnet");
      break;
    case "checked_out":
      push("Rechnung", s(d.invoice_number));
      break;
    case "cancelled":
      push("Grund", s(d.reason));
      break;
    case "message":
      push("Kanal", s(d.channel) ? CHANNEL_LABEL[s(d.channel) as string] ?? s(d.channel) : null);
      push("Text", s(d.preview));
      break;
    case "payment":
      push("Betrag", money(d.amount));
      push("Art", s(d.type));
      push("Status", s(d.status));
      break;
    case "addon":
      push("Leistung", pickName(d.name));
      push("Preis", money(d.price));
      push("Status", s(d.status));
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
  useRealtime({ table: "messages", filter: `reservation_id=eq.${reservationId}`, onChange: load });
  useRealtime({ table: "tasks", filter: `reservation_id=eq.${reservationId}`, onChange: load });
  useRealtime({ table: "payments", filter: `reservation_id=eq.${reservationId}`, onChange: load });
  useRealtime({ table: "reservation_addons", filter: `reservation_id=eq.${reservationId}`, onChange: load });

  const events = tl?.items ?? null;
  const shown = useMemo(() => {
    if (!events) return events;
    if (active.size === 0) return events;
    return events.filter((e) => active.has(metaFor(e.kind).cat));
  }, [events, active]);

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
            Zeitleiste
          </h2>
          {/* „Lernen"-Button (wie Lodgify) mit dem Zeitleiste-Erklärtext. */}
          <LearnButton title="Zeitleiste">
            <p className="text-sm text-muted-foreground">
              Dies ist die Zeitleiste der Ereignisse, die wir für Ihr Team
              aufgezeichnet haben. Sie haben nur Zugriff auf die Ereignisse, die
              sich auf Ihre Objektberechtigungen beziehen.
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
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    on
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
                Alles zurücksetzen
              </button>
            )}
          </div>
        )}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!error && events === null && (
        <p className="text-sm text-muted-foreground">Lädt…</p>
      )}

      {!error && shown && shown.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {events && events.length > 0
            ? "Keine Ereignisse für diesen Filter."
            : "Noch keine Ereignisse zu dieser Buchung."}
        </p>
      )}

      {shown && shown.length > 0 && (
        <ol className="flex flex-col">
          {shown.map((ev, i) => {
            const m = metaFor(ev.kind);
            const rows = cardRows(ev, currency);
            const last = i === shown.length - 1;
            return (
              <li key={ev.id} className="flex gap-5">
                {/* Achse: großes Icon direkt auf der Linie (wie Lodgify) +
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
                        {cardTitle(ev, propTitle)}
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
                      {/* Kontext-Badges (klickbar, wie Lodgify): Objekt → dessen
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
                          Buchung
                        </Link>
                      </div>

                      {/* Datums-Fußzeile (fett), wie Lodgify unter der Karte. */}
                      <p className="mt-3 text-xs font-bold text-foreground">
                        {fmtFooter(ev.at)}
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

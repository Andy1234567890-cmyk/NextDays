"use client";

// Reservierungspanel (rechte Spalte des Posteingangs): Buchungskarte, Aufenthalt,
// Beträge, Gästedaten, Notizen und der Aufenthaltskalender. Aus `inbox-list.tsx`
// herausgelöst (reine Verschiebung, kein Verhaltenswechsel).
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { ChannelMark, DetailLine } from "@/components/inbox/inbox-darstellung";
import { Button } from "@nextdays/ui/button";
import { formatCurrency } from "@/lib/currency";
import {
  type InboxThread,
  type ReservationDetail,
  getInboxReservation,
  updateThreadFlags,
} from "@/lib/inbox";

// --- Reservierungs-Panel (rechts) — Karte + Gästedaten + Notizen ------------
export function ReservationPanel({
  thread,
  openNoteSignal,
  onWhatsApp,
}: {
  thread: InboxThread;
  openNoteSignal: number;
  onWhatsApp: (phone: string) => void;
}) {
  const t = useTranslations("inbox");
  const locale = useLocale();
  const [res, setRes] = useState<ReservationDetail | null>(null);
  const [noteEdit, setNoteEdit] = useState(false);
  const [note, setNote] = useState("");
  const noteRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const r = await getInboxReservation(thread.id);
      if (active && r.ok) {
        setRes(r.data);
        setNote(r.data.note ?? "");
      }
    })();
    return () => {
      active = false;
    };
  }, [thread.id]);

  // Notiz-/Gastprofil-Icon im Kopf → Notizfeld öffnen + hinscrollen.
  useEffect(() => {
    if (openNoteSignal > 0) {
      setNoteEdit(true);
      noteRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [openNoteSignal]);

  if (!res) {
    return <div className="p-4 text-sm text-muted-foreground">…</div>;
  }

  const money = (v: number | null) =>
    v == null
      ? null
      : res.currency
        ? formatCurrency(v, res.currency)
        : v.toLocaleString(locale);
  const total = money(res.total_amount);
  const due = money(res.total_amount);
  const paid = money(res.paid_amount ?? 0);
  const fmtDay = (s: string | null) =>
    s
      ? new Date(`${s}T00:00:00`).toLocaleDateString(locale, {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "2-digit",
      })
      : "—";
  const guests = [
    res.adults != null ? `${res.adults} Erwachsene` : null,
    res.children != null ? `${res.children} Kinder` : null,
  ]
    .filter(Boolean)
    .join(", ");

  async function saveNote() {
    setNoteEdit(false);
    await updateThreadFlags(thread.id, { note });
  }

  return (
    <div className="flex flex-col gap-5 p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-extrabold">
          {t("reservation")}
          {res.ota_reservation_code ? ` ${res.ota_reservation_code}` : ""}
        </h2>
      </div>

      {/* Reservierungs-Karte */}
      <div className="flex flex-col rounded-2xl border border-border">
        <div className="flex items-start gap-3 p-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="w-fit rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
              {t("resBooked")}
            </span>
            <span className="font-display text-lg font-extrabold">
              {res.guest_name ?? t("unknownGuest")}
            </span>
            {guests && <span className="text-sm text-muted-foreground">{guests}</span>}
            <span className="text-sm text-muted-foreground">
              {res.nights != null ? `${res.nights} Nächte` : ""}
              {res.ota_name ? `, von ${res.ota_name}` : ""}
            </span>
            {res.ota_reservation_code && (
              <span className="text-sm text-muted-foreground">
                {t("reservationId")}: {res.ota_reservation_code}
              </span>
            )}
          </div>
          {/* Herkunft als echtes Portal-Logo (wie bei Lodgify oben rechts in
              der Buchungskarte); ohne echtes Logo bleibt das Kanal-Symbol. */}
          <ChannelMark name={res.ota_name} />
        </div>

        {/* Unterkunft */}
        {(res.listing_name || res.address) && (
          <div className="flex items-start gap-3 border-t border-border p-4">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="font-medium">{res.listing_name}</span>
              {res.address && (
                <span className="text-sm text-muted-foreground">{res.address}</span>
              )}
              {res.rental_id && (
                <span className="text-xs text-muted-foreground">
                  {t("rentalId")}: {res.rental_id.slice(0, 8)}
                </span>
              )}
            </div>
            {res.listing_photo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={res.listing_photo}
                alt=""
                className="size-12 shrink-0 rounded-(--radius) object-cover"
              />
            )}
          </div>
        )}

        {/* Check-in / Check-out */}
        <div className="grid grid-cols-2 border-t border-border">
          <div className="flex flex-col gap-0.5 border-r border-border p-4">
            <span className="font-display text-base font-bold">{fmtDay(res.check_in)}</span>
            <span className="text-xs text-muted-foreground">{t("checkIn")}</span>
          </div>
          <div className="flex flex-col gap-0.5 p-4">
            <span className="font-display text-base font-bold">{fmtDay(res.check_out)}</span>
            <span className="text-xs text-muted-foreground">{t("checkOut")}</span>
          </div>
        </div>

        {/* Beträge */}
        {total && (
          <div className="flex flex-col gap-1 border-t border-border p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("due")}</span>
              <span>{due}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>{t("paid")}</span>
              <span>{paid}</span>
            </div>
            <div className="flex justify-between font-display text-base font-extrabold">
              <span>{t("total")}</span>
              <span>{total}</span>
            </div>
          </div>
        )}
      </div>

      {/* Gästedaten */}
      <div className="flex flex-col gap-3">
        <h3 className="font-display text-base font-extrabold">{t("guestDetails")}</h3>
        {/* Feste Zeilen wie im Vorbild: Der Rahmen der Gästekarte steht immer,
            ein fehlender Wert zeigt „—". Vorher verschwand jede leere Zeile —
            dann sah eine Buchung ohne Telefonnummer aus, als gäbe es das Feld
            gar nicht, und niemand konnte erkennen, was die OTA nicht liefert. */}
        <DetailLine icon="ph:users" label={t("guestName")} value={res.guest_name} always />
        <DetailLine icon="ph:envelope" label={t("email")} value={res.guest_email} always />
        <DetailLine
          icon="ph:map-pin"
          label={t("guestLocation")}
          value={res.guest_location}
          always
        />
        <DetailLine icon="ph:translate" label={t("language")} value={res.guest_language} always />
        <DetailLine icon="ph:device-mobile" label={t("phone")} value={res.guest_phone} always />
        <DetailLine
          icon="ph:sign-in"
          label={t("estCheckin")}
          value={res.checkin_time}
          always
        />
        <DetailLine
          icon="ph:sign-out"
          label={t("estCheckout")}
          value={res.checkout_time}
          always
        />
        {res.guest_phone && (
          <button
            type="button"
            onClick={() => onWhatsApp(res.guest_phone!)}
            className="flex w-fit items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-sm font-medium hover:bg-secondary/80"
          >
            <Icon icon="ph:whatsapp-logo" className="size-4 text-emerald-600" />
            {t("whatsappOpenChat")}
          </button>
        )}
      </div>

      {/* Notizen */}
      <div ref={noteRef} className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-extrabold">{t("notes")}</h3>
          {!noteEdit && (
            <Button type="button" variant="outline" size="sm" onClick={() => setNoteEdit(true)}>
              {t("noteEdit")}
            </Button>
          )}
        </div>
        {noteEdit ? (
          <div className="flex flex-col gap-2">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="resize-none rounded-(--radius) border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
            />
            <Button type="button" size="sm" onClick={saveNote} className="self-end">
              {t("noteSave")}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{note || t("notesEmpty")}</p>
        )}
      </div>

      {/* Kalender: Aufenthaltszeitraum der Reservierung im Monat markiert */}
      {res.check_in && (
        <StayCalendar checkIn={res.check_in} checkOut={res.check_out} />
      )}

      {thread.reservation_id && (
        <Button asChild variant="outline" size="sm">
          <Link href={`/kalender?reservation=${thread.reservation_id}`}>
            <Icon icon="ph:calendar-check" className="size-4" />
            {t("openReservation")}
          </Link>
        </Button>
      )}

      {thread.guest_id && (
        <Button asChild variant="outline" size="sm">
          <Link href={`/gaeste/${thread.guest_id}`}>
            <Icon icon="ph:identification-card" className="size-4" />
            {t("openGuest")}
          </Link>
        </Button>
      )}
    </div>
  );
}

/**
 * Kompakter Monatskalender, der den Aufenthalt (check_in … check_out,
 * Check-out exklusiv) hervorhebt. Navigierbar zwischen Monaten; startet im
 * Anreisemonat. Reine Datums-Mathematik, keine zusätzlichen Daten nötig.
 */
function StayCalendar({
  checkIn,
  checkOut,
}: {
  checkIn: string;
  checkOut: string | null;
}) {
  const locale = useLocale();
  const ci = new Date(`${checkIn}T00:00:00`);
  const co = checkOut ? new Date(`${checkOut}T00:00:00`) : null;
  const [month, setMonth] = useState(
    () => new Date(ci.getFullYear(), ci.getMonth(), 1),
  );

  const year = month.getFullYear();
  const mon = month.getMonth();
  const monthLabel = month.toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });
  // Wochenstart Montag: getDay() So=0 → auf Mo=0 verschieben.
  const firstWeekday = (new Date(year, mon, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, mon + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const inStay = (day: number) => {
    const d = new Date(year, mon, day);
    if (d < new Date(ci.getFullYear(), ci.getMonth(), ci.getDate())) return false;
    // Check-out-Tag ist Abreisetag → exklusiv markieren bis zum Tag davor.
    if (co) {
      const lastNight = new Date(co.getFullYear(), co.getMonth(), co.getDate() - 1);
      return d <= lastNight;
    }
    return d.getTime() === ci.getTime();
  };
  const isStart = (day: number) =>
    year === ci.getFullYear() && mon === ci.getMonth() && day === ci.getDate();
  const isEnd = (day: number) =>
    !!co && year === co.getFullYear() && mon === co.getMonth() && day === co.getDate();

  const wd = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border p-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label="Vormonat"
          onClick={() => setMonth(new Date(year, mon - 1, 1))}
          className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
        >
          <Icon icon="ph:caret-left" className="size-4" />
        </button>
        <span className="font-display text-sm font-bold capitalize">{monthLabel}</span>
        <button
          type="button"
          aria-label="Folgemonat"
          onClick={() => setMonth(new Date(year, mon + 1, 1))}
          className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
        >
          <Icon icon="ph:caret-right" className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {wd.map((d) => (
          <span key={d} className="py-1">
            {d}
          </span>
        ))}
        {cells.map((day, i) =>
          day == null ? (
            <span key={`e${i}`} />
          ) : (
            <span
              key={day}
              className={`flex aspect-square items-center justify-center rounded-full text-sm ${inStay(day)
                  ? isStart(day) || isEnd(day)
                    ? "bg-accent font-semibold text-white"
                    : "bg-accent/15 text-accent"
                  : "text-foreground"
                }`}
            >
              {day}
            </span>
          ),
        )}
      </div>
    </div>
  );
}

"use client";

// Die Listen-Karten der Startseite (Check-outs, Check-ins, Freigabe nötig,
// Anstehend, Gäste im Haus). Jede trägt statt eines festen Abzeichens einen
// Zeitfenster-Selektor und lädt beim Wechsel NUR ihre eigene Liste nach.
//
// Client-Komponente, weil der Selektor Zustand braucht; die übrige Startseite
// bleibt serverseitig gerendert.
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useId, useState, useTransition } from "react";

import { Card, CardContent } from "@nextdays/ui/card";
import { InfoHinweis } from "@nextdays/ui/info-hinweis";
import { ChannelLogo } from "@/components/channel-logo";
import { KachelKopf } from "@/components/dashboard/kachel-kopf";
import type { AvailabilitySource } from "@/lib/calendar";
import { OWNER_STAY_ICON } from "@/lib/calendar-status";
import { channelLabelLoose } from "@/lib/channel-logos";
import { fmtDate } from "@/lib/dashboard-format";
import { lokalisiert } from "@/lib/lokalisiert";
import { useCalendarLabels } from "@/lib/use-calendar-labels";
import type {
  DashboardAddon,
  DashboardEntry,
  DashboardFenster,
  DashboardListe,
} from "@/lib/reservations";
import { getDashboardListe } from "@/lib/reservations";

// Reihenfolge der Auswahlliste. Die Menge selbst kommt aus dem Backend
// (`DashboardFenster`) — ein hier erfundener fünfter Wert würde mit 422
// abgewiesen.
// Reihenfolge des Selektors. Die Spannen zählen ab HEUTE vorwärts, „1d"/„2d"
// schließen den heutigen Tag also ein — deshalb heißen sie in den Katalogen
// „Bis morgen"/„Bis übermorgen" und nicht „Morgen"/„Übermorgen".
const FENSTER: DashboardFenster[] = ["heute", "1d", "2d", "7d", "30d", "alle"];

// Gebuchte Zusatzleistungen der Buchung. Zeigt, was das Team vorzubereiten hat
// („2× Wäschepaket"), und ob es beim Check-in noch zu kassieren ist: ein
// offener Posten sticht farblich hervor, ein bezahlter bleibt ruhig.
function AddonBadges({ addons }: { addons?: DashboardAddon[] }) {
  const t = useTranslations("reservations");
  const tc = useTranslations("calendar");
  const locale = useLocale();
  // Optional, nicht weil das Backend das Feld auslässt, sondern weil eine noch
  // im Cache liegende Antwort von vor dieser Änderung es nicht kennt.
  if (!addons?.length) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1">
      {addons.map((a, i) => (
        <span
          key={`${a.name.de ?? ""}-${i}`}
          title={a.paid ? t("dashboard.addonPaid") : t("dashboard.addonOpen")}
          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
            a.paid
              ? "bg-secondary text-muted-foreground"
              : "bg-accent/15 text-accent"
          }`}
        >
          <Icon
            icon={a.paid ? "ph:check-circle" : "ph:sparkle"}
            className="size-3"
          />
          {a.qty > 1 ? `${a.qty}× ` : ""}
          {lokalisiert(
            a.name,
            locale,
            tc("reservationAddonsSection.fallbackAddonName"),
          )}
        </span>
      ))}
    </div>
  );
}

/**
 * Wechseltag: in DERSELBEN Einheit reist heute ein Gast ab und ein anderer an.
 *
 * Warum ein eigenes Abzeichen und nicht nur eine Randfarbe: der Tag ist für die
 * Reinigung der teuerste des Jahres (drehen statt leer stehen lassen), und in
 * den Listen steht die Buchung sonst zweimal unauffällig da — einmal bei den
 * Abreisen, einmal bei den Anreisen, ohne dass etwas den Zusammenhang zeigt.
 *
 * Icon UND Text UND Farbe, nicht Farbe allein: eine Rotgrünsehschwäche trifft
 * rund 8 % der Männer, und ein reines Farbsignal ist für sie kein Signal.
 *
 * `unbekannt` bekommt eine eigene, zurückhaltende Form. Es als Wechsel zu
 * zeigen behauptete eine Reinigung, die vielleicht nicht ansteht; es
 * wegzulassen verschwiege die Lücke (Wurzel 4).
 */
function WechselAbzeichen({ wechsel }: { wechsel: DashboardEntry["wechsel"] }) {
  const tr = useTranslations("reservations");
  if (wechsel === "nein") return null;
  const sicher = wechsel === "ja";
  return (
    <span
      className={
        sicher
          ? "inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200"
          : "inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground"
      }
      title={sicher ? tr("dashboard.wechselHint") : tr("dashboard.wechselUnklarHint")}
    >
      <Icon
        icon={sicher ? "ph:arrows-clockwise-bold" : "ph:question"}
        className="size-3"
        aria-hidden
      />
      {sicher ? tr("dashboard.wechsel") : tr("dashboard.wechselUnklar")}
    </span>
  );
}

function EntryRow({ entry }: { entry: DashboardEntry }) {
  const t = useTranslations("calendar");
  const tr = useTranslations("reservations");
  const { channelLabel } = useCalendarLabels();
  // Der Klarname des Portals ist genauer als das Sammellabel des Kanals
  // („Expedia" statt „Anderes Portal"), also hat er Vorrang. Ein Eigentümer-
  // Aufenthalt (0241) kommt von keinem Kanal — dort steht die Art.
  const channel = entry.is_owner_stay
    ? t("calendarBoard.ownerStay")
    : entry.ota_name
      ? channelLabelLoose(entry.ota_name)
      : channelLabel(entry.channel as AvailabilitySource);
  return (
    <li className="flex items-center gap-3 py-2">
      <Link
        href={`/reservierungen/${entry.reservation_id}`}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl transition-colors hover:bg-secondary/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
      >
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary text-muted-foreground">
          {entry.is_owner_stay ? (
            <Icon icon={OWNER_STAY_ICON} className="size-4" />
          ) : (
            <ChannelLogo source={entry.channel as AvailabilitySource} className="size-4" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">
            {/* Der Ersatztext war deutsch fest verdrahtet — in einer Oberfläche
                mit 24 Sprachen stand er damit für 23 davon falsch da. */}
            {entry.guest_name || tr("dashboard.unknownGuest")}
            {entry.property_title ? (
              <span className="text-muted-foreground">, {entry.property_title}</span>
            ) : null}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {channel} · {fmtDate(entry.check_in)} – {fmtDate(entry.check_out)}
          </p>
          <div className="flex flex-wrap items-center gap-1">
            <WechselAbzeichen wechsel={entry.wechsel} />
            <AddonBadges addons={entry.addons} />
          </div>
        </div>
      </Link>
      {/* Die drei Wege, die man von einer Zeile aus wirklich geht: in den
          Kalender, in die Buchung, in den Verlauf. Sie liegen NEBEN dem
          Zeilen-Link, nicht darin — verschachtelte `<a>` sind ungültiges HTML
          und die inneren Ziele wären nicht anklickbar. */}
      <span className="flex shrink-0 items-center gap-1">
        <ZeilenAktion
          href={`/kalender?reservation=${entry.reservation_id}`}
          icon="ph:calendar-blank"
          label={tr("dashboard.rowOpenCalendar")}
        />
        <ZeilenAktion
          href={`/reservierungen/${entry.reservation_id}`}
          icon="ph:calendar-check"
          label={tr("dashboard.rowOpenBooking")}
        />
        {/* Nur mit echtem Verlauf: ohne Thread führte der Knopf auf eine leere
            Ansicht — ein Element ohne Wirkung (Wurzel 4). */}
        {entry.message_thread_id ? (
          <ZeilenAktion
            href={`/posteingang?thread=${encodeURIComponent(entry.message_thread_id)}`}
            icon="ph:chat-circle-dots"
            label={tr("dashboard.rowOpenInbox")}
          />
        ) : null}
      </span>
    </li>
  );
}

// Ein Aktions-Icon einer Listenzeile. Eigene Komponente, damit Trefferfläche,
// Fokusring und Beschriftung an allen dreien gleich sind.
function ZeilenAktion({
  href,
  icon,
  label,
}: {
  href: string;
  icon: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <Icon icon={icon} className="size-4" />
    </Link>
  );
}

/**
 * Der Fenster-Selektor an der Stelle, an der vorher das Abzeichen stand.
 *
 * Natives `<select>` im Pill-Kleid: tastaturbedienbar, öffnet auf dem Telefon
 * die System-Auswahl und braucht kein Overlay in einer Karte, die scrollt.
 */
function FensterSelektor({
  wert,
  onWechsel,
  laedt,
  label,
}: {
  wert: DashboardFenster;
  onWechsel: (neu: DashboardFenster) => void;
  laedt: boolean;
  label: string;
}) {
  const t = useTranslations("reservations");
  const id = useId();
  return (
    <span className="relative shrink-0">
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <select
        id={id}
        value={wert}
        disabled={laedt}
        onChange={(e) => onWechsel(e.target.value as DashboardFenster)}
        className="cursor-pointer appearance-none rounded-full bg-secondary py-1 pl-3 pr-7 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-wait disabled:opacity-60"
      >
        {FENSTER.map((f) => (
          <option key={f} value={f}>
            {t(`dashboard.fenster.${f}`)}
          </option>
        ))}
      </select>
      <Icon
        icon={laedt ? "ph:circle-notch" : "ph:caret-down"}
        className={`pointer-events-none absolute right-2 top-1/2 size-3 -translate-y-1/2 text-muted-foreground ${
          laedt ? "animate-spin" : ""
        }`}
        aria-hidden
      />
    </span>
  );
}

/**
 * Eine Listen-Karte: Zahl, Beschriftung und die ersten Zeilen dahinter.
 *
 * Die Liste scrollt in sich, damit alle Karten eines Rasters gleich hoch
 * bleiben — sonst bestimmte die vollste Karte die Höhe der ganzen Reihe.
 */
export function ListenKarte({
  icon,
  title,
  liste,
  standardFenster,
  count,
  countLabel,
  entries,
  empty,
}: {
  icon: string;
  title: string;
  liste: DashboardListe;
  // Das Fenster, in dem die Startseite diese Liste geliefert hat. Ein fester
  // Startwert für alle Karten wäre falsch: „Heutige Check-outs" kommt mit
  // `heute`, „Anstehend" mit `alle` — der Selektor muss zeigen, was da steht.
  standardFenster: DashboardFenster;
  count: number;
  countLabel: string;
  entries: DashboardEntry[];
  empty: string;
}) {
  const t = useTranslations("reservations");
  // aria-Label der Info-Punkte: app-weit dieselbe Formulierung, deshalb aus
  // `common` und nicht je Fläche neu erfunden.
  const tGemein = useTranslations("common");
  const [fenster, setFenster] = useState<DashboardFenster>(standardFenster);
  const [zeilen, setZeilen] = useState<DashboardEntry[]>(entries);
  const [gesamt, setGesamt] = useState(count);
  const [fehler, setFehler] = useState(false);
  const [laedt, starten] = useTransition();

  const wechsel = (neu: DashboardFenster) => {
    setFenster(neu);
    starten(async () => {
      const antwort = await getDashboardListe(liste, neu);
      if (!antwort.ok) {
        // Gesagt statt verschluckt: den alten Inhalt unter dem neuen Fenster
        // stehen zu lassen wäre die plausible Falschaussage (Wurzel 5).
        setFehler(true);
        setZeilen([]);
        setGesamt(0);
        return;
      }
      setFehler(false);
      setZeilen(antwort.data.items);
      setGesamt(antwort.data.gesamt);
    });
  };

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-6">
        {/* Der Titel bleibt einzeilig und kürzt sich bei Enge selbst — der
            volle Text steht im `title` und hinter dem „i". Umgebrochen zöge er
            die Kopfzeile in die Höhe und die Karten einer Reihe würden
            unterschiedlich hoch. */}
        <KachelKopf
          icon={icon}
          title={title}
          info={
            /* Was die Zahl zählt („Offene, unbestätigte Reservierungen"),
               steckt hinter dem „i" statt als Zeile unter der Zahl zu stehen.
               `InfoHinweis` ist ein Popover, kein Tooltip: es öffnet auf
               Klick und ist damit auch auf dem Tablet erreichbar. */
            <InfoHinweis
              titel={title}
              text={countLabel}
              ariaLabel={tGemein("explain", { label: title })}
            />
          }
          rechts={
            <FensterSelektor
              wert={fenster}
              onWechsel={wechsel}
              laedt={laedt}
              label={t("dashboard.fenster.label", { kachel: title })}
            />
          }
        />
        <div>
          <p className="font-display text-4xl font-extrabold leading-none tabular-nums">
            {gesamt}
          </p>
        </div>
        {fehler ? (
          <p className="border-t border-border pt-3 text-sm text-destructive">
            {t("dashboard.zeitraum.ladefehler")}
          </p>
        ) : zeilen.length ? (
          <ul className="max-h-56 divide-y divide-border overflow-y-auto border-t border-border">
            {zeilen.map((e) => (
              <EntryRow key={e.reservation_id} entry={e} />
            ))}
          </ul>
        ) : (
          <p className="border-t border-border pt-3 text-sm text-muted-foreground">
            {empty}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

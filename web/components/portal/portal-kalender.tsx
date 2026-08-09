"use client";

// Eigentümer-Portal · Belegungskalender (Monatsgitter, read-only).
//
// ENTSCHEIDUNG: eigener schlanker Kalender statt Wiederverwendung von
// components/kalender/calendar-board.tsx. Begründung:
//   * CalendarBoard ist ~108 KB, kennt heute KEINE Rolle und rendert für jede
//     Rolle den vollen Gastnamen (calendar-board.tsx:433) und den Tagespreis
//     des GASTES (:1834). Beides darf ein Eigentümer nicht sehen (§4.2).
//   * Um es rollенfest zu machen, müsste man Masken quer durch die Datei
//     einziehen — jeder Fehler dort träfe die Agentur-Ansicht mit. Eine
//     Maskierung, die man vergessen kann, ist keine Maskierung.
//   * Der Eigentümer braucht ein anderes Werkzeug: keine Drag-Sperren, kein
//     Bulk-Edit, keine Restriktionen — nur lesen. Ein eigener, kleiner
//     Kalender ist hier die sichere und die ehrlichere Lösung.
//
// Was hier sichtbar ist: Saison-Farbe (aus property_seasons, dieselbe Quelle
// wie components/objekte/season-calendar.tsx), Belegungsstatus, der VORNAME des
// Gastes und die Buchungsquelle als echtes Portal-Logo. Was NICHT sichtbar ist:
// der volle Gastname und jeder Gast-Gesamtpreis. Der einzige Betrag ist die
// persönliche Netto-Auszahlung des Eigentümers pro Nacht.
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { PortalRealtime } from "@/components/portal/portal-realtime";
import { Card, CardContent } from "@nextdays/ui/card";
import { NativeSelect } from "@nextdays/ui/native-select";
import { CHANNEL_LOGO } from "@/lib/channel-logos";
import { type Season, listSeasons } from "@/lib/calendar";
import { formatCurrency } from "@/lib/currency";
import { type PortalCalendarDay, type PortalProperty, getOwnerCalendar } from "@/lib/portal";

// --- Datums-Hilfen (alles UTC, damit kein Zeitzonen-Versatz entsteht) -------

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function addDays(isoDate: string, n: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return iso(d);
}
/** Wochentag Mo=0 … So=6. */
function mondayIndex(d: Date): number {
  return (d.getUTCDay() + 6) % 7;
}

type Monat = { jahr: number; monat: number }; // monat: 0-basiert

function monatVerschieben(m: Monat, delta: number): Monat {
  const d = new Date(Date.UTC(m.jahr, m.monat + delta, 1));
  return { jahr: d.getUTCFullYear(), monat: d.getUTCMonth() };
}

/**
 * Für jeden Tag: welche Saison gilt. Letzte Zuweisung gewinnt — identisch zur
 * Agentur-Ansicht (components/objekte/season-calendar.tsx), damit Eigentümer
 * und Verwaltung dieselben Farben sehen.
 */
function saisonProTag(seasons: Season[]): Map<string, Season> {
  const map = new Map<string, Season>();
  for (const s of seasons) {
    for (const a of s.assignments) {
      let cur = a.start_date;
      // end_date ist inklusiv.
      while (cur <= a.end_date) {
        map.set(cur, s);
        cur = addDays(cur, 1);
      }
    }
  }
  return map;
}

/** Kanal-Code → echtes Portal-Logo. Ohne Logo zeigt die UI nur den Namen
 *  (Projektregel: kein generisches Fallback-Icon für eine Marke). */
function logoFuer(channel: string | null | undefined): string | null {
  if (!channel) return null;
  const direkt = CHANNEL_LOGO[channel];
  if (direkt) return direkt;
  // Kanal-Codes kommen je nach Quelle in verschiedener Schreibweise
  // (airbnb / AirBNB). Ein Vergleich ohne Groß-/Kleinschreibung findet das
  // echte Logo, statt es fälschlich als „unbekannt" zu behandeln.
  const key = Object.keys(CHANNEL_LOGO).find(
    (k) => k.toLowerCase() === channel.toLowerCase(),
  );
  return key ? CHANNEL_LOGO[key] : null;
}

export function PortalKalender({
  properties,
  initialPropertyId,
  error,
}: {
  properties: PortalProperty[];
  initialPropertyId: string | null;
  error: string | null;
}) {
  const t = useTranslations("portal");
  const locale = useLocale();

  const monatsNamen = useMemo(
    () => t("calendar.months").split(","),
    [t],
  );
  const wochentage = useMemo(
    () => t("calendar.weekdays").split(","),
    [t],
  );

  const [propertyId, setPropertyId] = useState<string | null>(initialPropertyId);
  const [monat, setMonat] = useState<Monat>(() => {
    const j = new Date();
    return { jahr: j.getUTCFullYear(), monat: j.getUTCMonth() };
  });
  const [tage, setTage] = useState<PortalCalendarDay[]>([]);
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [ladeFehler, setLadeFehler] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);

  const von = `${monat.jahr}-${String(monat.monat + 1).padStart(2, "0")}-01`;
  // Letzter Tag des Monats: der 0. des Folgemonats.
  const bis = iso(new Date(Date.UTC(monat.jahr, monat.monat + 1, 0)));

  const laden = useCallback(async () => {
    if (!propertyId) {
      setTage([]);
      setSeasons([]);
      return;
    }
    setLaedt(true);
    const [kal, sea] = await Promise.all([
      getOwnerCalendar(propertyId, von, bis),
      listSeasons(propertyId),
    ]);
    setLaedt(false);
    // Ein Ladefehler ist nicht „nichts gebucht": beide Aussagen sind
    // verschieden und müssen es auch in der UI bleiben (Wurzel 4/5).
    if (!kal.ok) {
      setLadeFehler(kal.error);
      setTage([]);
    } else {
      setLadeFehler(null);
      setTage(kal.data.days);
    }
    // Saisons sind Schmuck, kein Kerninhalt: scheitern sie, bleibt der
    // Kalender nutzbar und zeigt nur keine Saison-Farben.
    setSeasons(sea.ok ? sea.data.items : []);
  }, [propertyId, von, bis]);

  useEffect(() => {
    void laden();
  }, [laden]);

  const tagMap = useMemo(() => {
    const m = new Map<string, PortalCalendarDay>();
    for (const d of tage) m.set(d.date, d);
    return m;
  }, [tage]);

  const saisonMap = useMemo(() => saisonProTag(seasons), [seasons]);

  // Gitter: führende Leerzellen bis zum ersten Wochentag + alle Tage des Monats.
  const ersterTag = new Date(Date.UTC(monat.jahr, monat.monat, 1));
  const leerVorne = mondayIndex(ersterTag);
  const tageImMonat = new Date(
    Date.UTC(monat.jahr, monat.monat + 1, 0),
  ).getUTCDate();

  const heute = iso(new Date());

  return (
    <div className="flex flex-col gap-6">
      {/* Realtime: Buchungen und Verfügbarkeit speisen dieses Gitter.
          `properties` liefert Objektwechsel (z. B. neu zugeordnet). */}
      <PortalRealtime
        quellen={["reservations", "availability", "stop_sell", "properties"]}
        onChange={() => void laden()}
      />

      <header className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-extrabold">
          {t("calendar.title")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t("calendar.subtitle")}
        </p>
      </header>

      {(error || ladeFehler) && (
        <div className="rounded-(--radius) border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          {error ?? ladeFehler}
        </div>
      )}

      {properties.length === 0 && !error ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
            <span className="flex size-12 items-center justify-center rounded-full bg-secondary text-muted-foreground">
              <Icon icon="ph:house-line" className="size-6" />
            </span>
            <p className="text-sm text-muted-foreground">
              {t("properties.empty")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Steuerleiste: Objekt + Monat */}
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">
                {t("calendar.selectProperty")}
              </span>
              <NativeSelect
                value={propertyId ?? ""}
                onChange={(e) => setPropertyId(e.target.value || null)}
                className="min-w-56"
              >
                {properties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </NativeSelect>
            </label>

            <div className="ml-auto flex items-center gap-1">
              <button
                type="button"
                aria-label={t("calendar.prevMonth")}
                onClick={() => setMonat((m) => monatVerschieben(m, -1))}
                className="flex size-9 items-center justify-center rounded-full bg-secondary text-secondary-foreground transition-colors hover:bg-secondary/80"
              >
                <Icon icon="ph:caret-left" className="size-4" />
              </button>
              <span className="min-w-44 text-center font-display text-sm font-extrabold">
                {monatsNamen[monat.monat]} {monat.jahr}
              </span>
              <button
                type="button"
                aria-label={t("calendar.nextMonth")}
                onClick={() => setMonat((m) => monatVerschieben(m, 1))}
                className="flex size-9 items-center justify-center rounded-full bg-secondary text-secondary-foreground transition-colors hover:bg-secondary/80"
              >
                <Icon icon="ph:caret-right" className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  const j = new Date();
                  setMonat({ jahr: j.getUTCFullYear(), monat: j.getUTCMonth() });
                }}
                className="rounded-full bg-secondary px-4 py-2 text-sm text-secondary-foreground transition-colors hover:bg-secondary/80"
              >
                {t("calendar.today")}
              </button>
            </div>
          </div>

          {/* Monatsgitter */}
          <Card>
            <CardContent className="py-4">
              <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
                {wochentage.map((w) => (
                  <span key={w}>{w}</span>
                ))}
              </div>
              <div
                className="grid grid-cols-7 gap-1"
                aria-busy={laedt || undefined}
              >
                {Array.from({ length: leerVorne }, (_, i) => (
                  <span key={`leer-${i}`} />
                ))}
                {Array.from({ length: tageImMonat }, (_, i) => {
                  const tag = i + 1;
                  const datum = `${monat.jahr}-${String(monat.monat + 1).padStart(2, "0")}-${String(tag).padStart(2, "0")}`;
                  return (
                    <Tageszelle
                      key={datum}
                      datum={datum}
                      tag={tag}
                      istHeute={datum === heute}
                      info={tagMap.get(datum) ?? null}
                      saison={saisonMap.get(datum) ?? null}
                      locale={locale}
                    />
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Legende */}
          <div className="flex flex-col gap-4 sm:flex-row sm:gap-10">
            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                {t("calendar.legendStatus")}
              </span>
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <LegendenPunkt
                  klasse="bg-secondary"
                  label={t("calendar.status.open")}
                />
                <LegendenPunkt
                  klasse="bg-primary"
                  label={t("calendar.status.booked")}
                />
                <LegendenPunkt
                  klasse="bg-muted-foreground"
                  label={t("calendar.status.blocked")}
                />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                {t("calendar.legendSeasons")}
              </span>
              {seasons.length === 0 ? (
                <span className="text-xs text-muted-foreground">
                  {t("calendar.noSeasons")}
                </span>
              ) : (
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  {seasons.map((s) => (
                    <span key={s.id} className="flex items-center gap-1.5">
                      {/* Saison-Farbe kommt als Hex AUS DER DB (property_seasons)
                          — das ist ein Datenwert, keine im Code hartkodierte
                          Arbitrary-Farbe. */}
                      <span
                        className="size-3 shrink-0 rounded-full"
                        style={{ backgroundColor: s.color }}
                      />
                      <span>{s.name}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Der Eigentümer darf nicht sperren, nur beantragen (§4.2).
              Deshalb führt der einzige Weg von hier auf den Antrag — es gibt
              keinen Knopf, der auf /calendar/block zeigt. */}
          <Card className="border-dashed">
            <CardContent className="flex flex-wrap items-center gap-3 py-4">
              <Icon
                icon="ph:info"
                className="size-5 shrink-0 text-muted-foreground"
              />
              <p className="min-w-0 flex-1 text-sm text-muted-foreground">
                {t("calendar.blockHint")}
              </p>
              <Link
                href="/portal/sperrungen"
                className="shrink-0 rounded-full bg-primary px-4 py-2 text-sm text-primary-foreground transition-colors hover:bg-primary/90"
              >
                {t("calendar.blockCta")}
              </Link>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function LegendenPunkt({ klasse, label }: { klasse: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`size-3 shrink-0 rounded-full ${klasse}`} />
      <span>{label}</span>
    </span>
  );
}

function Tageszelle({
  datum,
  tag,
  istHeute,
  info,
  saison,
  locale,
}: {
  datum: string;
  tag: number;
  istHeute: boolean;
  info: PortalCalendarDay | null;
  saison: Season | null;
  locale: string;
}) {
  const t = useTranslations("portal");

  const status = info?.status ?? "open";
  const statusLabel = t(
    status === "booked"
      ? "calendar.status.booked"
      : status === "blocked"
        ? "calendar.status.blocked"
        : "calendar.status.open",
  );

  // Nur der VORNAME — serverseitig über die zentrale GuestMask gekürzt. Der
  // volle Name existiert in dieser Antwort gar nicht.
  const vorname = info?.guest_first_name?.trim() || null;
  // Buchungsquelle: der Server liefert ota_name, sonst den Kanal.
  const kanalName = info?.booking_source?.trim() || null;
  const logo = logoFuer(kanalName);

  // Der EINZIGE Betrag im Eigentümer-Pfad: seine Netto-Auszahlung dieser Nacht.
  // `info.price` (Gast-Verkaufspreis) wird BEWUSST NICHT gerendert — er ist für
  // den Eigentümer ohnehin immer null, und ihn hier anzufassen wäre der Anfang
  // eines Lecks. `null` → „—" (Wurzel 4, nie 0).
  const auszahlung =
    info?.owner_payout_per_night == null
      ? null
      : formatCurrency(
          info.owner_payout_per_night,
          info.currency ?? null,
          locale,
          0,
        );

  const titel = [
    datum,
    statusLabel,
    saison ? saison.name : null,
    vorname ? `${t("calendar.guest")}: ${vorname}` : null,
    kanalName ? `${t("calendar.channel")}: ${kanalName}` : null,
    auszahlung ? `${t("calendar.payoutPerNight")}: ${auszahlung}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  // Hintergrund: Saison-Farbe hat Vorrang (sie ist die fachliche Aussage über
  // den Zeitraum), der Status wird als Balken darunter gezeigt.
  const statusKlasse =
    status === "booked"
      ? "bg-primary"
      : status === "blocked"
        ? "bg-muted-foreground"
        : "bg-transparent";

  return (
    <div
      title={titel}
      className={`flex min-h-20 flex-col gap-0.5 rounded-(--radius) border p-1.5 text-xs ${
        istHeute ? "border-accent" : "border-border"
      }`}
      style={
        // Saison-Hex aus der DB, dezent hinterlegt, damit der Inhalt lesbar
        // bleibt. Kein Tailwind-Arbitrary — ein Datenwert gehört in style.
        saison ? { backgroundColor: `${saison.color}22` } : undefined
      }
    >
      <div className="flex items-center justify-between gap-1">
        <span className={istHeute ? "font-bold text-accent" : "font-medium"}>
          {tag}
        </span>
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logo}
            alt={kanalName ?? ""}
            title={kanalName ?? undefined}
            className="size-3.5 shrink-0 object-contain"
          />
        ) : kanalName ? (
          // Kein offizielles Logo hinterlegt → nur der Name, nie ein
          // generisches Ersatz-Icon für eine fremde Marke.
          <span className="truncate text-[0.625rem] text-muted-foreground">
            {kanalName}
          </span>
        ) : null}
      </div>

      <span className={`h-1 w-full shrink-0 rounded-full ${statusKlasse}`} />

      {vorname && (
        <span className="truncate text-muted-foreground">{vorname}</span>
      )}

      {auszahlung && (
        <span className="mt-auto truncate font-semibold">{auszahlung}</span>
      )}
    </div>
  );
}

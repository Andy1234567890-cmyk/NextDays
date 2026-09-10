// Startseite des Betriebs: drei Abschnitte — Reservierungen, Nachrichten,
// Objekte —, aufgebaut nach dem Vorbild eines etablierten PMS-Dashboards
// (Hostaway), aber vollständig im myNextDays-Branding (semantische Tokens,
// rem, pill-Buttons, unsere Kanal-Logos).
//
// Jede Zahl stammt aus echten Daten: die Reservierungs- und Objektzahlen aus
// `/reservations/dashboard`, die Nachrichtenzahlen aus `/inbox/kennzahlen`.
// Fehlt etwas, zeigt die Karte ehrlich „nichts" oder „—" statt eines
// plausiblen Ersatzwerts (Wurzel 4).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { Fragment } from "react";

import { Card, CardContent } from "@nextdays/ui/card";
import { InfoHinweis } from "@nextdays/ui/info-hinweis";
import type { EigentuemerVorgaenge } from "@/lib/calendar";
import type { NachrichtenMetrik } from "@/components/dashboard/kpi-kachel";
import { KpiKachel, NachrichtenKachel } from "@/components/dashboard/kpi-kachel";
import { EigentuemerKachel } from "@/components/dashboard/eigentuemer-kachel";
import {
  KachelKopf,
  PeriodBadge,
} from "@/components/dashboard/kachel-kopf";
import { ListenKarte } from "@/components/dashboard/listen-karte";
import { fmtDate } from "@/lib/dashboard-format";
import { kanalAbzeichen } from "@/lib/kanal-marke";
import type { NachrichtenKennzahl, NachrichtenKennzahlen } from "@/lib/inbox";
import { channelLabelLoose } from "@/lib/channel-logos";
import type { Dashboard } from "@/lib/reservations";

// Kopfzeile eines Abschnitts — die breite Leiste über einer Kartengruppe.
function SectionHeader({ icon, title }: { icon: string; title: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-6 py-4">
      <Icon icon={icon} className="size-6 text-muted-foreground" />
      <h2 className="font-display text-xl font-bold">{title}</h2>
    </div>
  );
}

// --- Abschnitt „Nachrichten" -------------------------------------------------

function NachrichtenAbschnitt({ daten }: { daten: NachrichtenKennzahlen }) {
  const t = useTranslations("reservations");
  // aria-Label der Info-Punkte: app-weit dieselbe Formulierung, deshalb aus
  // `common` und nicht je Fläche neu erfunden.
  const tGemein = useTranslations("common");

  const paare: {
    key: NachrichtenMetrik;
    icon: string;
    title: string;
    unitLabel: string;
    avgTitle: string;
    avgUnitLabel: string;
    kennzahl: NachrichtenKennzahl;
  }[] = [
    {
      key: "gesendet",
      icon: "ph:paper-plane-tilt",
      title: t("dashboard.messagesSent"),
      unitLabel: t("dashboard.messagesSentLabel"),
      avgTitle: t("dashboard.messagesAvgSent"),
      avgUnitLabel: t("dashboard.messagesAvgSentLabel"),
      kennzahl: daten.gesendet,
    },
    {
      key: "empfangen",
      icon: "ph:tray-arrow-down",
      title: t("dashboard.messagesReceived"),
      unitLabel: t("dashboard.messagesReceivedLabel"),
      avgTitle: t("dashboard.messagesAvgReceived"),
      avgUnitLabel: t("dashboard.messagesAvgReceivedLabel"),
      kennzahl: daten.empfangen,
    },
    {
      key: "automation",
      icon: "ph:robot",
      title: t("dashboard.messagesAutomation"),
      unitLabel: t("dashboard.messagesAutomationLabel"),
      avgTitle: t("dashboard.messagesAvgAutomation"),
      avgUnitLabel: t("dashboard.messagesAvgAutomationLabel"),
      kennzahl: daten.automation,
    },
  ];

  return (
    <>
      <SectionHeader icon="ph:chats-circle" title={t("dashboard.sectionMessages")} />
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="grid gap-6 sm:grid-cols-2">
          {paare.map((p) => (
            // Fragment statt eines umschließenden `div`: Summe und Tagesschnitt
            // sollen zwei Zellen des Rasters füllen, nicht eine geteilte.
            <Fragment key={p.key}>
              <NachrichtenKachel
                icon={p.icon}
                title={p.title}
                unitLabel={p.unitLabel}
                metrik={p.key}
                variante="summe"
                kennzahl={p.kennzahl}
              />
              <NachrichtenKachel
                icon={p.icon}
                title={p.avgTitle}
                unitLabel={p.avgUnitLabel}
                metrik={p.key}
                variante="schnitt"
                kennzahl={p.kennzahl}
              />
            </Fragment>
          ))}
        </div>
        <Card>
          <CardContent className="flex flex-col gap-4 p-6">
            <KachelKopf
              icon="ph:envelope-open"
              title={t("dashboard.unreadConversations")}
              gross
              info={
                /* Was die Zahl bedeutet („Konversationen warten auf
                   Antwort"), steckt hinter dem „i" statt als Zeile unter der
                   Zahl zu stehen. */
                <InfoHinweis
                  titel={t("dashboard.unreadConversations")}
                  text={t("dashboard.unreadConversationsLabel")}
                  ariaLabel={tGemein("explain", {
                    label: t("dashboard.unreadConversations"),
                  })}
                />
              }
              rechts={<PeriodBadge label={t("dashboard.badgeCurrent")} />}
            />
            <div>
              <p className="font-display text-4xl font-extrabold leading-none">
                {daten.ungelesen}
              </p>
            </div>
            {daten.ungelesen_threads.length ? (
              <ul className="max-h-72 divide-y divide-border overflow-y-auto border-t border-border">
                {daten.ungelesen_threads.map((thread) => {
                  // Die Bildmarke, NICHT die Wortmarke aus `channelLogoLoose`:
                  // „Booking.com" & Co. sind breite Schriftzüge und werden im
                  // 2-rem-Kreis zum Fleck (dieselbe Erkenntnis wie im
                  // Posteingang, daher derselbe Helfer statt einer Kopie).
                  const marke = kanalAbzeichen(thread.ota_name);
                  return (
                    <li key={thread.id}>
                      <Link
                        href="/posteingang"
                        className="flex items-center gap-3 rounded-xl py-2 transition-colors hover:bg-secondary/60 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                      >
                        <span
                          className={`flex size-8 shrink-0 items-center justify-center rounded-full bg-secondary ${marke.fg}`}
                          title={channelLabelLoose(thread.ota_name) || undefined}
                        >
                          <Icon icon={marke.icon} className="size-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {thread.guest_name || t("dashboard.unknownGuest")}
                          </p>
                          {thread.arrival_date && thread.departure_date ? (
                            <p className="truncate text-xs text-muted-foreground">
                              {fmtDate(thread.arrival_date)} –{" "}
                              {fmtDate(thread.departure_date)}
                            </p>
                          ) : null}
                        </div>
                        <Icon
                          icon="ph:caret-right"
                          className="size-4 shrink-0 text-muted-foreground"
                        />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="border-t border-border pt-3 text-sm text-muted-foreground">
                {t("dashboard.noUnread")}
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

export function ReservationsDashboard({
  data,
  nachrichten,
  vorgaenge,
}: {
  data: Dashboard;
  // null, wenn der Posteingang für diese Rolle nicht zugänglich ist. Dann
  // entfällt der ganze Abschnitt — leere Nachrichtenzahlen anzuzeigen hieße
  // „nichts los", obwohl in Wahrheit nichts geladen wurde.
  nachrichten: NachrichtenKennzahlen | null;
  // null, wenn die Rolle nicht über Sperranträge entscheiden darf
  // (APPROVE_BLOCK). Dieselbe Regel wie bei `nachrichten`: die Kachel entfällt
  // dann ganz, statt Nullen zu zeigen, die „nichts offen" behaupten würden.
  vorgaenge: EigentuemerVorgaenge | null;
}) {
  const t = useTranslations("reservations");
  return (
    <div className="flex flex-col gap-6">
      <SectionHeader
        icon="ph:calendar-check"
        title={t("dashboard.sectionReservations")}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <ListenKarte
          icon="ph:calendar-x"
          title={t("dashboard.todayCheckouts")}
          liste="checkouts"
          standardFenster="heute"
          count={data.checkouts_today.length}
          countLabel={t("dashboard.checkoutsTodayLabel")}
          entries={data.checkouts_today}
          empty={t("dashboard.noDeparturesToday")}
        />
        <ListenKarte
          icon="ph:calendar-check"
          title={t("dashboard.todayCheckins")}
          liste="checkins"
          standardFenster="heute"
          count={data.checkins_today.length}
          countLabel={t("dashboard.checkinsTodayLabel")}
          entries={data.checkins_today}
          empty={t("dashboard.noArrivalsToday")}
        />
        <ListenKarte
          icon="ph:hourglass-medium"
          title={t("dashboard.approvalNeeded")}
          liste="freigabe"
          standardFenster="alle"
          count={data.freigabe_gesamt}
          countLabel={t("dashboard.approvalLabel")}
          entries={data.freigabe_noetig}
          empty={t("dashboard.noApproval")}
        />
        <ListenKarte
          icon="ph:calendar-dots"
          title={t("dashboard.upcoming")}
          liste="upcoming"
          standardFenster="alle"
          // Die ungedeckelte Zahl, nicht `entries.length` — die Liste
          // schneidet bei 50 ab und zeigte sonst „50" als Bestand.
          count={data.upcoming_gesamt}
          countLabel={t("dashboard.upcomingLabel")}
          entries={data.upcoming}
          empty={t("dashboard.noUpcoming")}
        />
        <ListenKarte
          icon="ph:house-line"
          title={t("dashboard.stayingGuests")}
          liste="im_haus"
          standardFenster="heute"
          count={data.im_haus_gesamt}
          countLabel={t("dashboard.stayingGuestsLabel")}
          entries={data.im_haus}
          empty={t("dashboard.noStayingGuests")}
        />
        {/* Der sechste Platz im zweispaltigen Raster stand leer. Hier gehört
            er hin: Eigentümer-Vorgänge sind Entscheidungen des Betriebs wie
            die Buchungs-Freigabe daneben, nur aus der anderen Richtung — der
            Eigentümer will sein Objekt selbst nutzen. */}
        {vorgaenge && <EigentuemerKachel daten={vorgaenge} />}
      </div>

      <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        <KpiKachel
          icon="ph:sign-in"
          title={t("dashboard.checkIn")}
          unitLabel={t("dashboard.guestCheckins")}
          metrik="checkins"
          kpi={data.checkins_30d}
          currency={data.currency}
          istBetrag={false}
        />
        {/* Beide Umsatz-Kacheln nur, wenn der Nutzer Beträge sehen darf. Für
            einen Owner ohne PM_BOOKING_TOTAL liefert das Backend null (§4.2) —
            auch für den Schnitt, sonst wäre er das Leck zurück zur Summe. Der
            Nachlade-Endpunkt prüft dasselbe noch einmal: die Kachel gar nicht
            zu rendern ist Darstellung, nicht Schutz (Wurzel 9). */}
        {data.revenue_per_booking_30d && (
          <KpiKachel
            icon="ph:chart-line-up"
            title={t("dashboard.revenuePerBooking")}
            unitLabel={t("dashboard.revenuePerBookingLabel")}
            metrik="revenue_per_booking"
            kpi={data.revenue_per_booking_30d}
            currency={data.currency}
            istBetrag
          />
        )}
        {data.revenue_30d && (
          <KpiKachel
            icon="ph:currency-circle-dollar"
            title={t("dashboard.revenue")}
            unitLabel={t("dashboard.totalRevenue")}
            metrik="revenue"
            kpi={data.revenue_30d}
            currency={data.currency}
            istBetrag
          />
        )}
        <KpiKachel
          icon="ph:check-circle"
          title={t("dashboard.confirmed")}
          unitLabel={t("dashboard.confirmedReservations")}
          metrik="confirmed"
          kpi={data.confirmed_30d}
          currency={data.currency}
          istBetrag={false}
        />
      </div>

      {nachrichten && (
<NachrichtenAbschnitt daten={nachrichten} />
      )}

      <SectionHeader icon="ph:buildings" title={t("dashboard.sectionListings")} />
      {/* Vier statt drei Spalten: „Aktiv" fehlte, und damit die Zahl, nach der
          ein Betrieb zuerst sieht. Aus Gesamt/Inaktiv/Entwurf liess sie sich
          nicht verlaesslich erraten (09.09.2026). */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <ObjektKachel
          icon="ph:buildings"
          title={t("dashboard.listingsTotal")}
          value={data.objekte_gesamt}
          label={t("dashboard.listingsTotalLabel")}
        />
        <ObjektKachel
          icon="ph:storefront"
          title={t("dashboard.listingsActive")}
          value={data.objekte_aktiv}
          label={t("dashboard.listingsActiveLabel")}
        />
        <ObjektKachel
          icon="ph:pause-circle"
          title={t("dashboard.listingsInactive")}
          value={data.objekte_inaktiv}
          label={t("dashboard.listingsInactiveLabel")}
        />
        <ObjektKachel
          icon="ph:pencil-simple-line"
          title={t("dashboard.listingsDraft")}
          value={data.objekte_entwurf}
          label={t("dashboard.listingsDraftLabel")}
        />
      </div>
    </div>
  );
}

// Objekt-Zahlen tragen keinen Zeitraum und keine Veränderung — sie sind ein
// Bestand, kein Verlauf. Eine „Letzte 30 Tage"-Angabe daneben wäre schlicht
// falsch, deshalb eine eigene, schlankere Kachel statt `KpiCard`.
function ObjektKachel({
  icon,
  title,
  value,
  label,
}: {
  icon: string;
  title: string;
  value: number;
  label: string;
}) {
  const tGemein = useTranslations("common");
  // Der Link liegt als Fläche ÜBER der Karte, nicht mehr um sie herum. Grund
  // ist der Info-Punkt: sein Auslöser ist ein echter `<button>`, und ein
  // `<button>` in einem `<a>` ist weder gültiges HTML noch bedienbar — der
  // Klick auf das „i" wäre am Popover vorbei zur Navigation durchgeschlagen
  // und die Erklärung nie zu sehen gewesen. Die ganze Karte bleibt trotzdem
  // anklickbar; der Info-Punkt liegt mit `z-10` darüber.
  return (
    <Card className="relative h-full transition-colors hover:border-accent/40">
      <CardContent className="flex flex-col gap-4 p-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon icon={icon} className="size-5" />
          <h3 className="font-semibold text-foreground">{title}</h3>
          {/* Was die Zahl zählt („Unvollständige Objekte"), steckt hinter dem
              „i" statt als Zeile unter der Zahl zu stehen. */}
          <span className="relative z-10">
            <InfoHinweis
              titel={title}
              text={label}
              ariaLabel={tGemein("explain", { label: title })}
            />
          </span>
        </div>
        <div>
          <p className="font-display text-4xl font-extrabold leading-none">
            {value}
          </p>
        </div>
        <Link
          href="/objekte"
          className="absolute inset-0 rounded-2xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {/* Der Link trägt seinen Namen unsichtbar: eine leere Fläche ohne
              Text ist für Screenreader ein Ziel ohne Beschriftung. */}
          <span className="sr-only">{title}</span>
        </Link>
      </CardContent>
    </Card>
  );
}

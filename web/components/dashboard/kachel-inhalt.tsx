"use client";

// Rendert den INHALT einer Kachel anhand ihrer Katalog-ID — die Verdrahtung
// zwischen `lib/dashboard-katalog.ts` und den bestehenden Dashboard-Bausteinen
// (ListenKarte, KpiKachel, NachrichtenKachel, UngelesenKarte, ObjektKachel,
// EigentuemerKachel). Nichts davon ist neu; das starre Dashboard hat genau
// diese Komponenten mit genau diesen Props gerendert.
//
// Das `switch` deckt jede ID ab — `scripts/diagnose/dashboard-kacheln-pruefen.mjs`
// liest die `case`-Zeilen und vergleicht sie mit dem Katalog, damit eine neue
// Kachel ohne Renderer nicht als leere Fläche durchgeht.
import { useTranslations } from "next-intl";

import { AufgabenKachel } from "@/components/dashboard/aufgaben-kachel";
import { EigentuemerKachel } from "@/components/dashboard/eigentuemer-kachel";
import { KpiKachel, NachrichtenKachel } from "@/components/dashboard/kpi-kachel";
import { ListenKarte } from "@/components/dashboard/listen-karte";
import { ObjektKachel } from "@/components/dashboard/objekt-kachel";
import { UngelesenKarte } from "@/components/dashboard/ungelesen-karte";
import type { EigentuemerVorgaenge } from "@/lib/calendar";
import type { KachelId } from "@/lib/dashboard-katalog";
import type { NachrichtenKennzahlen } from "@/lib/inbox";
import type { Dashboard } from "@/lib/reservations";
import type { TeamaufgabenStand } from "@/lib/tasks";

export type KachelDaten = {
  dashboard: Dashboard;
  /** null = Posteingang für diese Rolle nicht zugänglich (403). */
  nachrichten: NachrichtenKennzahlen | null;
  /** null = keine APPROVE_BLOCK-Fähigkeit (403). */
  vorgaenge: EigentuemerVorgaenge | null;
  /** null = keine MANAGE_TASKS-Fähigkeit (403) — derselbe Guard wie die
   *  Team-Liste, deren Zahlen die Kachel zusammenfasst (Wurzel 9). */
  aufgaben: TeamaufgabenStand | null;
};

/**
 * Ob für diese Kachel Daten DA sind. Zugang (Rolle/Berechtigung) prüft der
 * Katalog; hier geht es um die zweite Bedingung: der Server hat den Wert auch
 * geliefert. Eine Umsatz-Kachel mit `null` würde „—" zeigen und behaupten,
 * es gäbe keinen Umsatz — falsch, es gibt nur keinen Einblick (Wurzel 4).
 */
export function kachelHatDaten(id: KachelId, daten: KachelDaten): boolean {
  switch (id) {
    case "kpi:revenue":
      return daten.dashboard.revenue_30d !== null;
    case "kpi:revenue_per_booking":
      return daten.dashboard.revenue_per_booking_30d !== null;
    case "nachricht:gesendet:summe":
    case "nachricht:gesendet:schnitt":
    case "nachricht:empfangen:summe":
    case "nachricht:empfangen:schnitt":
    case "nachricht:automation:summe":
    case "nachricht:automation:schnitt":
    case "nachricht:ungelesen":
      return daten.nachrichten !== null;
    case "vorgaenge:eigentuemer":
      return daten.vorgaenge !== null;
    case "aufgaben:team":
      // Ohne Zugang KEINE Kachel: „0 offene Aufgaben" wäre die Behauptung, es
      // liege nichts an — richtig ist, dass es keinen Einblick gibt (Wurzel 4).
      return daten.aufgaben !== null;
    default:
      return true;
  }
}

export function KachelInhalt({ id, daten }: { id: KachelId; daten: KachelDaten }) {
  const t = useTranslations("reservations");
  const d = daten.dashboard;
  const n = daten.nachrichten;

  switch (id) {
    // --- Listen ---------------------------------------------------------
    case "liste:checkouts":
      return (
        <ListenKarte
          icon="ph:calendar-x"
          title={t("dashboard.todayCheckouts")}
          liste="checkouts"
          standardFenster="heute"
          count={d.checkouts_today.length}
          countLabel={t("dashboard.checkoutsTodayLabel")}
          entries={d.checkouts_today}
          empty={t("dashboard.noDeparturesToday")}
        />
      );
    case "liste:checkins":
      return (
        <ListenKarte
          icon="ph:calendar-check"
          title={t("dashboard.todayCheckins")}
          liste="checkins"
          standardFenster="heute"
          count={d.checkins_today.length}
          countLabel={t("dashboard.checkinsTodayLabel")}
          entries={d.checkins_today}
          empty={t("dashboard.noArrivalsToday")}
        />
      );
    case "liste:freigabe":
      return (
        <ListenKarte
          icon="ph:hourglass-medium"
          title={t("dashboard.approvalNeeded")}
          liste="freigabe"
          standardFenster="alle"
          count={d.freigabe_gesamt}
          countLabel={t("dashboard.approvalLabel")}
          entries={d.freigabe_noetig}
          empty={t("dashboard.noApproval")}
        />
      );
    case "liste:upcoming":
      return (
        <ListenKarte
          icon="ph:calendar-dots"
          title={t("dashboard.upcoming")}
          liste="upcoming"
          standardFenster="alle"
          // Die ungedeckelte Zahl, nicht `entries.length` — die Liste
          // schneidet bei 50 ab und zeigte sonst „50" als Bestand.
          count={d.upcoming_gesamt}
          countLabel={t("dashboard.upcomingLabel")}
          entries={d.upcoming}
          empty={t("dashboard.noUpcoming")}
        />
      );
    case "liste:im_haus":
      return (
        <ListenKarte
          icon="ph:house-line"
          title={t("dashboard.stayingGuests")}
          liste="im_haus"
          standardFenster="heute"
          count={d.im_haus_gesamt}
          countLabel={t("dashboard.stayingGuestsLabel")}
          entries={d.im_haus}
          empty={t("dashboard.noStayingGuests")}
        />
      );
    case "vorgaenge:eigentuemer":
      return daten.vorgaenge ? <EigentuemerKachel daten={daten.vorgaenge} /> : null;

    // --- Kennzahlen -----------------------------------------------------
    case "kpi:checkins":
      return (
        <KpiKachel
          icon="ph:sign-in"
          title={t("dashboard.checkIn")}
          unitLabel={t("dashboard.guestCheckins")}
          metrik="checkins"
          kpi={d.checkins_30d}
          currency={d.currency}
          istBetrag={false}
        />
      );
    case "kpi:revenue_per_booking":
      // Beide Umsatz-Kacheln nur mit Wert: für einen Owner ohne
      // PM_BOOKING_TOTAL liefert das Backend null (§4.2). Der Nachlade-Endpunkt
      // prüft dasselbe noch einmal — Nicht-Rendern ist Darstellung, nicht
      // Schutz (Wurzel 9).
      return d.revenue_per_booking_30d ? (
        <KpiKachel
          icon="ph:chart-line-up"
          title={t("dashboard.revenuePerBooking")}
          unitLabel={t("dashboard.revenuePerBookingLabel")}
          metrik="revenue_per_booking"
          kpi={d.revenue_per_booking_30d}
          currency={d.currency}
          istBetrag
        />
      ) : null;
    case "kpi:revenue":
      return d.revenue_30d ? (
        <KpiKachel
          icon="ph:currency-circle-dollar"
          title={t("dashboard.revenue")}
          unitLabel={t("dashboard.totalRevenue")}
          metrik="revenue"
          kpi={d.revenue_30d}
          currency={d.currency}
          istBetrag
        />
      ) : null;
    case "kpi:confirmed":
      return (
        <KpiKachel
          icon="ph:check-circle"
          title={t("dashboard.confirmed")}
          unitLabel={t("dashboard.confirmedReservations")}
          metrik="confirmed"
          kpi={d.confirmed_30d}
          currency={d.currency}
          istBetrag={false}
        />
      );

    // --- Nachrichten ----------------------------------------------------
    case "nachricht:gesendet:summe":
      return n ? (
        <NachrichtenKachel
          icon="ph:paper-plane-tilt"
          title={t("dashboard.messagesSent")}
          unitLabel={t("dashboard.messagesSentLabel")}
          metrik="gesendet"
          variante="summe"
          kennzahl={n.gesendet}
        />
      ) : null;
    case "nachricht:gesendet:schnitt":
      return n ? (
        <NachrichtenKachel
          icon="ph:paper-plane-tilt"
          title={t("dashboard.messagesAvgSent")}
          unitLabel={t("dashboard.messagesAvgSentLabel")}
          metrik="gesendet"
          variante="schnitt"
          kennzahl={n.gesendet}
        />
      ) : null;
    case "nachricht:empfangen:summe":
      return n ? (
        <NachrichtenKachel
          icon="ph:tray-arrow-down"
          title={t("dashboard.messagesReceived")}
          unitLabel={t("dashboard.messagesReceivedLabel")}
          metrik="empfangen"
          variante="summe"
          kennzahl={n.empfangen}
        />
      ) : null;
    case "nachricht:empfangen:schnitt":
      return n ? (
        <NachrichtenKachel
          icon="ph:tray-arrow-down"
          title={t("dashboard.messagesAvgReceived")}
          unitLabel={t("dashboard.messagesAvgReceivedLabel")}
          metrik="empfangen"
          variante="schnitt"
          kennzahl={n.empfangen}
        />
      ) : null;
    case "nachricht:automation:summe":
      return n ? (
        <NachrichtenKachel
          icon="ph:robot"
          title={t("dashboard.messagesAutomation")}
          unitLabel={t("dashboard.messagesAutomationLabel")}
          metrik="automation"
          variante="summe"
          kennzahl={n.automation}
        />
      ) : null;
    case "nachricht:automation:schnitt":
      return n ? (
        <NachrichtenKachel
          icon="ph:robot"
          title={t("dashboard.messagesAvgAutomation")}
          unitLabel={t("dashboard.messagesAvgAutomationLabel")}
          metrik="automation"
          variante="schnitt"
          kennzahl={n.automation}
        />
      ) : null;
    case "nachricht:ungelesen":
      return n ? <UngelesenKarte daten={n} /> : null;

    // --- Objekte --------------------------------------------------------
    case "objekt:gesamt":
      return (
        <ObjektKachel
          icon="ph:buildings"
          title={t("dashboard.listingsTotal")}
          value={d.objekte_gesamt}
          label={t("dashboard.listingsTotalLabel")}
        />
      );
    case "objekt:aktiv":
      return (
        <ObjektKachel
          icon="ph:storefront"
          title={t("dashboard.listingsActive")}
          value={d.objekte_aktiv}
          label={t("dashboard.listingsActiveLabel")}
        />
      );
    case "objekt:inaktiv":
      return (
        <ObjektKachel
          icon="ph:pause-circle"
          title={t("dashboard.listingsInactive")}
          value={d.objekte_inaktiv}
          label={t("dashboard.listingsInactiveLabel")}
        />
      );
    case "objekt:entwurf":
      return (
        <ObjektKachel
          icon="ph:pencil-simple-line"
          title={t("dashboard.listingsDraft")}
          value={d.objekte_entwurf}
          label={t("dashboard.listingsDraftLabel")}
        />
      );
    case "aufgaben:team":
      return daten.aufgaben ? <AufgabenKachel daten={daten.aufgaben} /> : null;
    default: {
      // Erschöpfend: eine neue ID ohne `case` ist ein Typfehler, kein
      // stilles Loch.
      const _nie: never = id;
      return _nie;
    }
  }
}

// Buchung abschließen — echte Buchungsstrecke gegen den booking_engine-Slice
// (POST /api/v1/booking-engine/reservations). Objekt, Zeitraum und Gästezahl
// kommen als Route-Parameter aus dem Detail; Preis und Nächte liefert der
// Server für GENAU diesen Zeitraum.
//
// Wichtig:
// - Der Betrag ist ein ANZEIGEWERT; verbindlich rechnet der Server (Client-
//   Beträge werden dort nicht vertraut). Fehlt ein Preis, wird gar keiner
//   angezeigt — kein 0-Wert, keine erfundene Gebühr (Wurzel 4).
// - Absenden ist gegen Doppeltipp/Retry gesperrt (Wurzel 2): ein laufender oder
//   bereits erfolgreicher Versuch löst keinen zweiten POST aus.
//
// DREI SCHRITTE, in dieser Reihenfolge (Airbnb-Muster, live abgelesen am
// 19.08.2026 auf airbnb.de/book/stays/… ohne Anmeldung):
//   1. Konto — ohne angemeldeten Gast geht es nicht weiter. Vorher stand hier
//      ein freies Kontaktformular: jeder konnte mit beliebigem Namen buchen,
//      und die Buchung hing an keinem Konto.
//   2. Zahlung — das PaymentSheet von Stripe (`lib/zahlung.ts`). Kein
//      nachgebautes Kartenfeld: die Kartendaten sehen wir nie.
//   3. Prüfen und auslösen — der Knopf unten.
//
// KEINE BUCHUNG OHNE ZAHLUNG (Migration 0409): Der Server antwortet bei
// Sofortbuchung mit `status="zahlung_offen"` + `client_secret` und legt NICHTS
// an; die Reservierung entsteht erst, wenn der Stripe-Webhook die Zahlung
// einlöst. Bis 19.08.2026 las die App diese Felder nicht und meldete „Buchung
// bestätigt" — für eine Buchung, die es nicht gab. Deshalb sagt dieser Screen
// „bestätigt" erst, wenn die Buchung in „Reisen" wirklich auftaucht.
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AnmeldeBlatt } from "@/components/AnmeldeBlatt";
import { Icon } from "@/components/ui/Icon";
import { Btn, Col, Photo, Row, Spinner, Txt } from "@/components/ui/kit";
import { EmptyState } from "@/components/ui/patterns";
import { useGuestAuth } from "@/contexts/GuestAuthContext";
import { formatCurrency } from "@/lib/currency";
import { formatZeitraum } from "@/lib/datum";
import { listGuestBookings } from "@/lib/guestBookings";
import {
  createBooking,
  getListing,
  getQuote,
  listingOrt,
  naechte,
  type ListingDetail,
  type Quote,
} from "@/lib/listings";
import { zahleBuchung } from "@/lib/zahlung";
import type { RootStackParamList } from "@/navigation/types";
import { useTheme } from "@/theme/ThemeProvider";

// Obergrenze der Tierauswahl im Formular (der Server deckelt bei 50). Mehr als
// vier Tiere ist ein Fall für die Nachricht an den Gastgeber, kein Formularwert.
const MAX_TIERE = 4;

// E-Mail nur grob prüfen (die verbindliche Prüfung macht Pydantic serverseitig).
function istEmail(wert: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(wert.trim());
}

export default function Checkout() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "Checkout">>();
  const { listingId, checkIn, checkOut, guests } = route.params;
  const { guest } = useGuestAuth();

  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [ladeFehler, setLadeFehler] = useState<string | null>(null);
  // Tiere wählt der Gast hier, nicht in der Suche: erst hier steht fest, ob
  // dieses Objekt sie erlaubt.
  const [tiere, setTiere] = useState(0);
  const [angebot, setAngebot] = useState<Quote | null>(null);

  const [sendet, setSendet] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  // Schritt 1 des Checkouts (Airbnb-Reihenfolge): ohne Konto geht es nicht
  // weiter. Das Blatt trägt E-Mail → Code → Name.
  const [anmeldeOffen, setAnmeldeOffen] = useState(false);
  // Was gerade läuft — der Knopf sagt es dem Gast, statt nur „lädt".
  const [phase, setPhase] = useState<"" | "absicht" | "zahlung" | "bestaetigung">("");
  // `zahlungOffen` = der Server hat eine Buchungsabsicht angelegt, aber KEINE
  // Buchung (0409). Der Zustand ist getrennt von `anfrage`: eine Anfrage ist
  // beim Gastgeber, eine offene Zahlung liegt beim Gast.
  const [erfolg, setErfolg] = useState<
    {
      id: string;
      anfrage: boolean;
      // Zahlung nötig, aber NICHT geleistet (abgebrochen oder nicht angebunden).
      zahlungOffen: boolean;
      // Stripe hat die Zahlung angenommen. Die Buchung entsteht daraufhin per
      // Webhook — `bestaetigt` sagt, ob wir sie schon sehen.
      bezahlt?: boolean;
      bestaetigt?: boolean;
    } | null
  >(null);

  const load = useCallback(async () => {
    const res = await getListing(listingId, { start: checkIn, end: checkOut });
    if (res.ok) {
      setListing(res.data);
      setLadeFehler(null);
    } else {
      setLadeFehler(res.error);
    }
  }, [listingId, checkIn, checkOut]);

  useEffect(() => {
    load();
  }, [load]);

  // Verbindliche Aufschlüsselung vom Server — Gebühren, Haustiergebühr und
  // Abgaben inbegriffen. Nächte × Grundpreis (der alte Weg) verschwieg sie.
  useEffect(() => {
    let abgebrochen = false;
    void getQuote({
      property_id: listingId,
      check_in: checkIn,
      check_out: checkOut,
      guests,
      pets: tiere,
    }).then((res) => {
      if (!abgebrochen) setAngebot(res.ok ? res.data : null);
    });
    return () => {
      abgebrochen = true;
    };
  }, [listingId, checkIn, checkOut, guests, tiere]);

  const nights = angebot?.nights ?? listing?.nights ?? naechte(checkIn, checkOut);
  const waehrung = angebot?.currency || listing?.currency;
  const gesamt = angebot && !angebot.priceless ? angebot.total : null;
  const tiereErlaubt = angebot?.pets_allowed ?? false;

  // Kontaktdaten kommen AUS DEM KONTO, nicht aus einem freien Formular: der
  // Gast ist seit dem Umbau angemeldet, bevor er hierher kommt. Der Name wird
  // am ersten Leerzeichen getrennt (der Server verlangt Vor- und Nachname).
  const angemeldet = guest !== null;
  const kontakt = (() => {
    const teile = (guest?.name ?? "").trim().split(/\s+/).filter(Boolean);
    return {
      first_name: teile[0] ?? "",
      last_name: teile.slice(1).join(" "),
      email: guest?.email ?? "",
      phone: guest?.phone ?? undefined,
    };
  })();
  const kontaktOk =
    angemeldet && kontakt.first_name.length > 0 && istEmail(kontakt.email);

  /** Sucht die frisch bezahlte Buchung in „Reisen" — bis sie da ist, sagt die
   *  App NICHT „bestätigt". Die Buchung entsteht über den Stripe-Webhook, also
   *  einige Sekunden nach dem Sheet; Stripe warnt ausdrücklich davor, sich auf
   *  den Client-Callback zu verlassen. */
  const warteAufBuchung = async (): Promise<boolean> => {
    for (let versuch = 0; versuch < 6; versuch += 1) {
      const res = await listGuestBookings("upcoming");
      if (
        res.ok &&
        res.data.items.some(
          (b: { property: { id: string }; check_in: string; check_out: string }) =>
            b.property.id === listingId &&
            b.check_in === checkIn &&
            b.check_out === checkOut,
        )
      ) {
        return true;
      }
      await new Promise<void>((fertig) => {
        setTimeout(fertig, 1500);
      });
    }
    return false;
  };

  const buchen = async () => {
    // Doppel-Guard (Wurzel 2): ein laufender oder erfolgreicher Versuch löst
    // keinen zweiten Vorgang aus — ein zweiter Intent wäre ein zweites Mal Geld.
    if (sendet || erfolg || !listing) return;
    if (!kontaktOk) {
      setAnmeldeOffen(true);
      return;
    }
    setSendet(true);
    setFehler(null);
    setPhase("absicht");
    const res = await createBooking({
      property_id: listing.id,
      check_in: checkIn,
      check_out: checkOut,
      guests,
      pets: tiere,
      contact: kontakt,
      // Anzeigewert; der Server bepreist verbindlich neu.
      ...(gesamt != null ? { total_amount: gesamt } : {}),
    });
    if (!res.ok) {
      setFehler(res.error);
      setPhase("");
      setSendet(false);
      return;
    }
    const daten = res.data;

    // Anfrage-Objekt: der Gastgeber muss zusagen, es wird (noch) nicht gezahlt.
    if (daten.is_request || daten.zahlung_erforderlich !== true) {
      setErfolg({ id: daten.id, anfrage: daten.is_request, zahlungOffen: false });
      setPhase("");
      setSendet(false);
      return;
    }

    // Sofortbuchung: erst zahlen, dann existiert eine Buchung (0409).
    if (!daten.client_secret || !daten.publishable_key) {
      // Der Server sagt „Zahlung erforderlich", liefert aber keine Zahlungsdaten
      // — dann ist hier nichts zu bezahlen und schon gar nichts bestätigt.
      setErfolg({ id: daten.id, anfrage: false, zahlungOffen: true });
      setPhase("");
      setSendet(false);
      return;
    }
    setPhase("zahlung");
    const zahlung = await zahleBuchung({
      clientSecret: daten.client_secret,
      publishableKey: daten.publishable_key,
      name: guest?.name ?? null,
      email: guest?.email ?? null,
    });
    if (zahlung.art === "abgebrochen") {
      // Kein Fehler, aber auch keine Buchung: der Zeitraum ist NICHT reserviert.
      setFehler(
        "Zahlung abgebrochen — die Unterkunft ist noch nicht gebucht. Du kannst es erneut versuchen.",
      );
      setPhase("");
      setSendet(false);
      return;
    }
    if (zahlung.art === "fehler") {
      setFehler(zahlung.meldung);
      setPhase("");
      setSendet(false);
      return;
    }
    setPhase("bestaetigung");
    const bestaetigt = await warteAufBuchung();
    setErfolg({
      id: daten.id,
      anfrage: false,
      zahlungOffen: false,
      bezahlt: true,
      bestaetigt,
    });
    setPhase("");
    setSendet(false);
  };

  if (!listing) {
    return (
      <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
        <Row style={{ paddingHorizontal: 12, paddingVertical: 8 }}>
          <ZurueckKnopf onPress={() => navigation.goBack()} />
        </Row>
        {ladeFehler ? (
          <EmptyState icon="info" titel="Nicht verfügbar" text={ladeFehler} />
        ) : (
          <Spinner />
        )}
      </View>
    );
  }

  // Erfolgszustand: klare Unterscheidung Anfrage (Host muss zusagen) vs. Buchung.
  if (erfolg) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: t.palette.bg,
          paddingTop: insets.top,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 28,
          justifyContent: "center",
        }}
      >
        <Col gap={14} style={{ alignItems: "flex-start" }}>
          <Icon
            n={erfolg.zahlungOffen ? "info" : "check"}
            s={40}
            sw={2.2}
            c={t.palette.ink}
          />
          <Txt v="display">
            {erfolg.zahlungOffen
              ? "Noch nicht gebucht"
              : erfolg.anfrage
                ? "Anfrage gesendet"
                : erfolg.bezahlt && !erfolg.bestaetigt
                  ? "Zahlung erfolgreich"
                  : "Buchung bestätigt"}
          </Txt>
          {/* Bei offener Zahlung wird NICHTS bestätigt und nichts zu „Reisen“
              geschickt: dort steht keine Buchung, weil keine entstanden ist.
              Lieber die unbequeme Wahrheit als ein Häkchen, auf das sich
              jemand verlässt (Wurzel 4). */}
          <Txt v="body" soft>
            {erfolg.zahlungOffen
              ? "Diese Unterkunft wird sofort bestätigt — dafür muss zuerst bezahlt werden. Es kam aber keine Zahlungsmöglichkeit zurück. Deine Nächte sind NICHT reserviert; versuche es später erneut oder buche im Browser auf myBestDays."
              : erfolg.anfrage
                ? "Der Gastgeber bestätigt deine Anfrage. Du siehst den Status unter „Reisen“."
                : erfolg.bezahlt && !erfolg.bestaetigt
                  ? "Die Zahlung ist angenommen. Wir verbuchen sie gerade — die Buchung erscheint gleich unter „Reisen“. Falls nicht, melde dich bei uns; das Geld ist nicht verloren."
                  : "Deine Buchung steht unter „Reisen“ bereit."}
          </Txt>
          {erfolg.zahlungOffen && !erfolg.bezahlt ? (
            <Btn
              variant="dark"
              block
              style={{ marginTop: 10 }}
              onPress={() => navigation.goBack()}
            >
              Zurück zur Unterkunft
            </Btn>
          ) : (
            <Btn
              variant="dark"
              block
              style={{ marginTop: 10 }}
              onPress={() => navigation.navigate("GuestTabs", { screen: "Trips" })}
            >
              Zu meinen Reisen
            </Btn>
          )}
        </Col>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
      <Row style={{ paddingHorizontal: 12, paddingVertical: 8 }}>
        <ZurueckKnopf onPress={() => navigation.goBack()} />
      </Row>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 32, gap: 24 }}
        keyboardShouldPersistTaps="handled"
      >
        <Txt v="display">Buchung prüfen</Txt>

        {/* Objekt-Kopf */}
        <Row gap={14}>
          <Photo src={listing.photos[0]} grad="grad1" h={78} w={92} r={t.radius.img} />
          <Col gap={3} style={{ flex: 1 }}>
            <Txt v="title" numberOfLines={2}>
              {listing.title}
            </Txt>
            <Txt v="sm" soft numberOfLines={1}>
              {listingOrt(listing) || "—"}
            </Txt>
          </Col>
        </Row>

        <Trennlinie />

        <Col gap={14}>
          <Txt v="h2">Deine Reise</Txt>
          <Row style={{ justifyContent: "space-between", gap: 16 }}>
            <Txt v="body" soft>
              Zeitraum
            </Txt>
            <Txt v="body" style={{ flexShrink: 1, textAlign: "right" }}>
              {formatZeitraum(checkIn, checkOut) || `${checkIn} – ${checkOut}`}
            </Txt>
          </Row>
          <Row style={{ justifyContent: "space-between", gap: 16 }}>
            <Txt v="body" soft>
              Gäste
            </Txt>
            <Txt v="body">
              {guests} {guests === 1 ? "Gast" : "Gäste"}
            </Txt>
          </Row>
          {tiereErlaubt && (
            <Row style={{ justifyContent: "space-between", gap: 16 }}>
              <Col gap={2} style={{ flex: 1 }}>
                <Txt v="body" soft>
                  Haustiere
                </Txt>
                <Txt v="xs" soft>
                  Gebühren können anfallen
                </Txt>
              </Col>
              <Row gap={12} style={{ alignItems: "center" }}>
                <Pressable
                  accessibilityLabel="Haustiere verringern"
                  disabled={tiere <= 0}
                  onPress={() => setTiere((x) => Math.max(0, x - 1))}
                  style={{ opacity: tiere <= 0 ? 0.4 : 1, padding: 6 }}
                >
                  <Icon n="minus" s={18} sw={2} c={t.palette.ink} />
                </Pressable>
                <Txt v="body">{tiere}</Txt>
                <Pressable
                  accessibilityLabel="Haustiere erhöhen"
                  disabled={tiere >= MAX_TIERE}
                  onPress={() => setTiere((x) => Math.min(MAX_TIERE, x + 1))}
                  style={{ opacity: tiere >= MAX_TIERE ? 0.4 : 1, padding: 6 }}
                >
                  <Icon n="plus" s={18} sw={2} c={t.palette.ink} />
                </Pressable>
              </Row>
            </Row>
          )}
        </Col>

        <Trennlinie />

        {/* Preis: ausschließlich die Zeilen des Servers — dieselbe Rechnung,
            die beim Buchen greift. */}
        <Col gap={14}>
          <Txt v="h2">Preisdetails</Txt>
          {angebot && !angebot.priceless ? (
            <>
              {angebot.lines.map((zeile, i) => (
                <Row
                  key={`${zeile.label}-${i}`}
                  style={{ justifyContent: "space-between", gap: 16 }}
                >
                  <Txt v="body" soft style={{ flex: 1 }}>
                    {zeile.label}
                  </Txt>
                  <Txt v="body">{formatCurrency(zeile.amount, waehrung)}</Txt>
                </Row>
              ))}
              <Trennlinie />
              <Row style={{ justifyContent: "space-between", gap: 16 }}>
                <Txt v="body" style={{ fontFamily: t.fonts.semibold }}>
                  Gesamt
                </Txt>
                <Txt v="body" style={{ fontFamily: t.fonts.semibold }}>
                  {formatCurrency(angebot.total, waehrung)}
                </Txt>
              </Row>
            </>
          ) : (
            <Txt v="body" soft>
              Für diesen Zeitraum ist kein Preis hinterlegt — der Gastgeber meldet
              sich mit einem Angebot.
            </Txt>
          )}
        </Col>

        <Trennlinie />

        {/* SCHRITT 1 — Konto. Bei Airbnb ist das der erste Schritt des
            Checkouts und die Zahlung erst der zweite (live abgelesen am
            19.08.2026). Vorher stand hier ein freies Kontaktformular: jeder
            konnte mit irgendeinem Namen buchen, und die Buchung hing an keinem
            Konto. */}
        <Col gap={14}>
          <Txt v="h2">1 · Dein Konto</Txt>
          {angemeldet ? (
            <Col gap={4}>
              <Txt v="body">{guest?.name}</Txt>
              <Txt v="sm" soft>
                {guest?.email}
                {guest?.phone ? ` · ${guest.phone}` : ""}
              </Txt>
              <Txt v="xs" soft>
                Aus deinem Konto. Ändern kannst du das unter „Profil".
              </Txt>
            </Col>
          ) : (
            <Col gap={10}>
              <Txt v="body" soft>
                Zum Buchen brauchst du ein Konto — wir schicken dir einen Code
                per E-Mail, ein Passwort ist nicht nötig.
              </Txt>
              <Btn variant="dark" block onPress={() => setAnmeldeOffen(true)}>
                Anmelden oder Konto anlegen
              </Btn>
            </Col>
          )}
        </Col>

        <Trennlinie />

        {/* SCHRITT 2 — Zahlung. Das Kartenformular ist das PaymentSheet von
            Stripe; es öffnet sich beim Buchen. Hier steht deshalb nur, WAS
            passiert — kein nachgebautes Kartenfeld (die Kartendaten sehen wir
            nie, und ein eigenes Feld wäre PCI-pflichtig). */}
        <Col gap={14}>
          <Txt v="h2">2 · Zahlung</Txt>
          <Txt v="body" soft>
            {gesamt != null
              ? "Beim Buchen öffnet sich das Zahlungsfenster von Stripe. Die Buchung entsteht erst, wenn die Zahlung durch ist — vorher sind die Nächte nicht reserviert."
              : "Für diesen Zeitraum gibt es keinen Preis: der Gastgeber bekommt eine Anfrage und meldet sich. Bezahlt wird erst nach seiner Zusage."}
          </Txt>
        </Col>

        {fehler && (
          <Row gap={8} style={{ alignItems: "flex-start" }}>
            <Icon n="info" s={17} sw={1.9} c={t.palette.accent} />
            <Txt v="sm" accent style={{ flex: 1 }}>
              {fehler}
            </Txt>
          </Row>
        )}
      </ScrollView>

      <Row
        style={{
          paddingHorizontal: 24,
          paddingTop: 16,
          paddingBottom: insets.bottom + 16,
          gap: 16,
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: t.palette.surface,
          borderTopWidth: 1,
          borderTopColor: t.palette.line,
        }}
      >
        <Col gap={2} style={{ flexShrink: 1 }}>
          {gesamt != null ? (
            <>
              <Txt v="body" style={{ fontFamily: t.fonts.semibold }}>
                {formatCurrency(gesamt, listing.currency)}
              </Txt>
              <Txt v="xs" soft numberOfLines={1}>
                {nights} {nights === 1 ? "Nacht" : "Nächte"}
              </Txt>
            </>
          ) : (
            <Txt v="body" soft>
              Preis auf Anfrage
            </Txt>
          )}
        </Col>
        {/* Der Knopf benennt den nächsten Schritt: ohne Konto führt er ins
            Anmelde-Blatt, mit Konto zur Zahlung. „Verbindlich buchen" wäre hier
            falsch — verbindlich wird es erst mit der Zahlung. */}
        <Btn variant={!sendet ? "primary" : "ghost"} onPress={buchen}>
          {phase === "absicht"
            ? "Preis wird geprüft …"
            : phase === "zahlung"
              ? "Zahlung läuft …"
              : phase === "bestaetigung"
                ? "Buchung wird bestätigt …"
                : !angemeldet
                  ? "Anmelden und weiter"
                  : gesamt != null
                    ? "Weiter zur Zahlung"
                    : "Anfragen"}
        </Btn>
      </Row>

      {/* Nach erfolgreicher Anmeldung KEIN automatisches Buchen: der Gast soll
          den Preis noch einmal sehen und selbst auslösen. */}
      <AnmeldeBlatt
        open={anmeldeOffen}
        onClose={() => setAnmeldeOffen(false)}
        onFertig={() => setAnmeldeOffen(false)}
      />
    </View>
  );
}

// --- Bausteine --------------------------------------------------------------

function Trennlinie() {
  const t = useTheme();
  return <View style={{ height: 1, backgroundColor: t.palette.line }} />;
}

function ZurueckKnopf({ onPress }: { onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Zurück"
      onPress={onPress}
      hitSlop={10}
      style={({ pressed }) => ({ padding: 8, opacity: pressed ? 0.6 : 1 })}
    >
      <Icon n="back" s={22} sw={2} c={t.palette.ink} />
    </Pressable>
  );
}



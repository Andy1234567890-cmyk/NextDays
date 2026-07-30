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
// - Eine echte Zahlungsabwicklung ist an dieser Stelle NICHT angebunden (der
//   öffentliche Endpunkt legt die Reservierung an); es wird deshalb auch keine
//   Zahlungsmethode vorgetäuscht.
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useEffect, useState } from "react";
import { ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/Icon";
import { Btn, Card, Col, Divider, Flat, IconBtn, Photo, Row, Spinner, Txt } from "@/components/ui/kit";
import { useGuestAuth } from "@/contexts/GuestAuthContext";
import { formatCurrency } from "@/lib/currency";
import { formatZeitraum } from "@/lib/datum";
import {
  createBooking,
  getListing,
  listingOrt,
  naechte,
  type ListingDetail,
} from "@/lib/listings";
import type { RootStackParamList } from "@/navigation/types";
import { useTheme } from "@/theme/ThemeProvider";

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

  // Kontaktdaten: aus dem Gast-Konto vorbelegt, wenn eines angemeldet ist.
  // Der Name wird am ersten Leerzeichen getrennt; hat das Konto nur einen
  // Namensteil, bleibt der Nachname leer und muss ergänzt werden.
  const [vorname, setVorname] = useState("");
  const [nachname, setNachname] = useState("");
  const [email, setEmail] = useState("");
  const [telefon, setTelefon] = useState("");

  const [sendet, setSendet] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [erfolg, setErfolg] = useState<{ id: string; anfrage: boolean } | null>(null);

  useEffect(() => {
    if (!guest) return;
    const teile = (guest.name ?? "").trim().split(/\s+/).filter(Boolean);
    if (teile.length > 0) {
      setVorname((v) => v || teile[0]);
      setNachname((n) => n || teile.slice(1).join(" "));
    }
    setEmail((e) => e || guest.email);
    if (guest.phone) setTelefon((p) => p || guest.phone!);
  }, [guest]);

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

  const nights = listing?.nights ?? naechte(checkIn, checkOut);
  const proNacht = listing?.price ?? listing?.price_from ?? null;
  const gesamt = proNacht != null && nights > 0 ? proNacht * nights : null;

  const formularOk =
    vorname.trim().length > 0 && nachname.trim().length > 0 && istEmail(email);

  const buchen = async () => {
    if (sendet || erfolg || !listing || !formularOk) return; // Doppel-Guard
    setSendet(true);
    setFehler(null);
    const res = await createBooking({
      property_id: listing.id,
      check_in: checkIn,
      check_out: checkOut,
      guests,
      contact: {
        first_name: vorname.trim(),
        last_name: nachname.trim(),
        email: email.trim(),
        phone: telefon.trim() || undefined,
      },
      // Anzeigewert; der Server bepreist verbindlich neu.
      ...(gesamt != null ? { total_amount: gesamt } : {}),
    });
    if (res.ok) {
      setErfolg({ id: res.data.id, anfrage: res.data.is_request });
    } else {
      setFehler(res.error);
    }
    setSendet(false);
  };

  if (!listing) {
    return (
      <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
        <Row style={{ paddingHorizontal: 20, paddingVertical: 8, gap: 14 }}>
          <IconBtn icon="back" flat bg={t.palette.surface2} onPress={() => navigation.goBack()} />
          <Txt v="h2">Buchen</Txt>
        </Row>
        {ladeFehler ? (
          <Txt v="sm" soft style={{ padding: 20 }}>
            {ladeFehler}
          </Txt>
        ) : (
          <Spinner />
        )}
      </View>
    );
  }

  // Erfolgszustand: klare Unterscheidung Anfrage (Host muss zusagen) vs. Buchung.
  if (erfolg) {
    return (
      <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
        <Col style={{ padding: 24, gap: 18, flex: 1, justifyContent: "center", alignItems: "center" }}>
          <Icon n="check" s={44} sw={2} c={t.palette.accent} />
          <Txt v="h1" style={{ textAlign: "center" }}>
            {erfolg.anfrage ? "Anfrage gesendet" : "Buchung bestätigt"}
          </Txt>
          <Txt v="sm" soft style={{ textAlign: "center" }}>
            {erfolg.anfrage
              ? "Der Gastgeber bestätigt deine Anfrage. Du siehst den Status unter „Reisen“."
              : "Deine Buchung steht unter „Reisen“ bereit."}
          </Txt>
          <Btn
            variant="primary"
            block
            onPress={() => navigation.navigate("GuestTabs", { screen: "Trips" })}
          >
            Zu meinen Reisen
          </Btn>
        </Col>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
      <Row style={{ paddingHorizontal: 20, paddingVertical: 8, gap: 14 }}>
        <IconBtn icon="back" flat bg={t.palette.surface2} onPress={() => navigation.goBack()} />
        <Txt v="h2">Buchung prüfen</Txt>
      </Row>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingTop: 8, gap: 16 }}>
        <Card style={{ flexDirection: "row", padding: 12, gap: 12 }}>
          <Photo src={listing.photos[0]} grad="grad1" h={70} w={84} r={14} />
          <Col gap={3} style={{ flex: 1 }}>
            <Txt v="title" numberOfLines={1}>
              {listing.title}
            </Txt>
            <Txt v="sm" soft numberOfLines={1}>
              {listingOrt(listing) || "—"}
            </Txt>
          </Col>
        </Card>

        <Flat style={{ padding: 16, gap: 12 }}>
          <Row style={{ justifyContent: "space-between" }}>
            <Col>
              <Txt v="xs" soft>
                ZEITRAUM
              </Txt>
              <Txt v="sm" style={{ fontFamily: t.type.semibold.fontFamily }}>
                {formatZeitraum(checkIn, checkOut) || `${checkIn} – ${checkOut}`}
              </Txt>
            </Col>
            <Icon n="cal" s={18} c={t.palette.accent} />
          </Row>
          <Divider />
          <Row style={{ justifyContent: "space-between" }}>
            <Col>
              <Txt v="xs" soft>
                GÄSTE
              </Txt>
              <Txt v="sm" style={{ fontFamily: t.type.semibold.fontFamily }}>
                {guests} {guests === 1 ? "Gast" : "Gäste"}
              </Txt>
            </Col>
            <Icon n="users" s={18} c={t.palette.accent} />
          </Row>
        </Flat>

        {/* Preis: nur echte Werte des Servers, keine erfundenen Gebühren. */}
        <Col gap={10}>
          <Txt v="title">Preis</Txt>
          {proNacht != null && nights > 0 ? (
            <>
              <Row style={{ justifyContent: "space-between" }}>
                <Txt v="body" soft>
                  {formatCurrency(proNacht, listing.currency)} × {nights}{" "}
                  {nights === 1 ? "Nacht" : "Nächte"}
                </Txt>
                <Txt v="sm">{formatCurrency(gesamt ?? 0, listing.currency)}</Txt>
              </Row>
              <Divider />
              <Row style={{ justifyContent: "space-between" }}>
                <Txt v="title">Gesamt</Txt>
                <Txt v="h2" accent>
                  {formatCurrency(gesamt ?? 0, listing.currency)}
                </Txt>
              </Row>
              <Txt v="xs" soft>
                Verbindlich rechnet der Gastgeber ab; Zusatzleistungen und Steuern
                können hinzukommen.
              </Txt>
            </>
          ) : (
            <Txt v="sm" soft>
              Für diesen Zeitraum ist kein Preis hinterlegt — der Gastgeber meldet
              sich mit einem Angebot.
            </Txt>
          )}
        </Col>

        <Divider />

        <Col gap={10}>
          <Txt v="title">Kontaktdaten</Txt>
          <Feld label="Vorname" value={vorname} onChange={setVorname} />
          <Feld label="Nachname" value={nachname} onChange={setNachname} />
          <Feld
            label="E-Mail"
            value={email}
            onChange={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          <Feld label="Telefon (optional)" value={telefon} onChange={setTelefon} keyboardType="phone-pad" />
          {!formularOk && (
            <Txt v="xs" soft>
              Vorname, Nachname und eine gültige E-Mail sind nötig — daran hängt
              die Bestätigung deiner Buchung.
            </Txt>
          )}
        </Col>

        {fehler && (
          <Txt v="sm" style={{ color: "#B02A2A" }}>
            {fehler}
          </Txt>
        )}
      </ScrollView>

      <Col
        style={{
          padding: 20,
          paddingBottom: insets.bottom + 16,
          gap: 8,
          backgroundColor: t.palette.surface,
          borderTopWidth: 1,
          borderTopColor: t.palette.line,
        }}
      >
        <Btn
          variant={formularOk && !sendet ? "primary" : "ghost"}
          block
          icon="shield"
          onPress={buchen}
        >
          {sendet
            ? "Wird gesendet …"
            : gesamt != null
              ? `Verbindlich buchen · ${formatCurrency(gesamt, listing.currency)}`
              : "Verbindlich anfragen"}
        </Btn>
      </Col>
    </View>
  );
}

function Feld({
  label,
  value,
  onChange,
  keyboardType,
  autoCapitalize,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  keyboardType?: "default" | "email-address" | "phone-pad";
  autoCapitalize?: "none" | "sentences" | "words";
}) {
  const t = useTheme();
  return (
    <Col gap={4}>
      <Txt v="xs" soft>
        {label.toUpperCase()}
      </Txt>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType ?? "default"}
        autoCapitalize={autoCapitalize ?? "words"}
        autoCorrect={false}
        style={{
          borderWidth: 1,
          borderColor: t.palette.line,
          borderRadius: t.radius.btn,
          paddingHorizontal: 14,
          paddingVertical: 12,
          color: t.palette.ink,
          fontFamily: t.type.medium.fontFamily,
          backgroundColor: t.palette.surface,
        }}
      />
    </Col>
  );
}

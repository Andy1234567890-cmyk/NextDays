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
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/Icon";
import { Btn, Col, Photo, Row, Spinner, Txt } from "@/components/ui/kit";
import { EmptyState } from "@/components/ui/patterns";
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
          <Icon n="check" s={40} sw={2.2} c={t.palette.ink} />
          <Txt v="display">{erfolg.anfrage ? "Anfrage gesendet" : "Buchung bestätigt"}</Txt>
          <Txt v="body" soft>
            {erfolg.anfrage
              ? "Der Gastgeber bestätigt deine Anfrage. Du siehst den Status unter „Reisen“."
              : "Deine Buchung steht unter „Reisen“ bereit."}
          </Txt>
          <Btn
            variant="dark"
            block
            style={{ marginTop: 10 }}
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
        </Col>

        <Trennlinie />

        {/* Preis: nur echte Werte des Servers, keine erfundenen Gebühren. */}
        <Col gap={14}>
          <Txt v="h2">Preisdetails</Txt>
          {proNacht != null && nights > 0 ? (
            <>
              <Row style={{ justifyContent: "space-between", gap: 16 }}>
                <Txt v="body" soft>
                  {formatCurrency(proNacht, listing.currency)} × {nights}{" "}
                  {nights === 1 ? "Nacht" : "Nächte"}
                </Txt>
                <Txt v="body">{formatCurrency(gesamt ?? 0, listing.currency)}</Txt>
              </Row>
              <Trennlinie />
              <Row style={{ justifyContent: "space-between", gap: 16 }}>
                <Txt v="body" style={{ fontFamily: t.fonts.semibold }}>
                  Gesamt
                </Txt>
                <Txt v="body" style={{ fontFamily: t.fonts.semibold }}>
                  {formatCurrency(gesamt ?? 0, listing.currency)}
                </Txt>
              </Row>
              <Txt v="xs" soft>
                Verbindlich rechnet der Gastgeber ab; Zusatzleistungen und Steuern
                können hinzukommen.
              </Txt>
            </>
          ) : (
            <Txt v="body" soft>
              Für diesen Zeitraum ist kein Preis hinterlegt — der Gastgeber meldet
              sich mit einem Angebot.
            </Txt>
          )}
        </Col>

        <Trennlinie />

        <Col gap={14}>
          <Txt v="h2">Kontaktdaten</Txt>
          <Col gap={0}>
            <Feld label="Vorname" value={vorname} onChange={setVorname} position="oben" />
            <Feld label="Nachname" value={nachname} onChange={setNachname} position="mitte" />
            <Feld
              label="E-Mail"
              value={email}
              onChange={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              position="mitte"
            />
            <Feld
              label="Telefon (optional)"
              value={telefon}
              onChange={setTelefon}
              keyboardType="phone-pad"
              position="unten"
            />
          </Col>
          {!formularOk && (
            <Txt v="xs" soft>
              Vorname, Nachname und eine gültige E-Mail sind nötig — daran hängt
              die Bestätigung deiner Buchung.
            </Txt>
          )}
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
        <Btn variant={formularOk && !sendet ? "primary" : "ghost"} onPress={buchen}>
          {sendet ? "Wird gesendet …" : gesamt != null ? "Verbindlich buchen" : "Anfragen"}
        </Btn>
      </Row>
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

// Feld einer zusammenhängenden Gruppe: außen gerundet, innen geteilte Linie.
function Feld({
  label,
  value,
  onChange,
  keyboardType,
  autoCapitalize,
  position,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  keyboardType?: "default" | "email-address" | "phone-pad";
  autoCapitalize?: "none" | "sentences" | "words";
  position: "oben" | "mitte" | "unten";
}) {
  const t = useTheme();
  const r = 14;
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: t.palette.line,
        borderTopWidth: position === "oben" ? 1 : 0,
        borderTopLeftRadius: position === "oben" ? r : 0,
        borderTopRightRadius: position === "oben" ? r : 0,
        borderBottomLeftRadius: position === "unten" ? r : 0,
        borderBottomRightRadius: position === "unten" ? r : 0,
        paddingHorizontal: 16,
        paddingTop: 10,
        paddingBottom: 8,
        backgroundColor: t.palette.surface,
      }}
    >
      <Txt v="xs" soft>
        {label}
      </Txt>
      <TextInput
        value={value}
        onChangeText={onChange}
        keyboardType={keyboardType ?? "default"}
        autoCapitalize={autoCapitalize ?? "words"}
        autoCorrect={false}
        style={{ color: t.palette.ink, fontFamily: t.fonts.regular, fontSize: 16, paddingVertical: 6 }}
      />
    </View>
  );
}

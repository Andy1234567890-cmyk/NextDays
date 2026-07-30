// Gäste · Reisen. Echte Buchungen des angemeldeten Portal-Gastes aus
// /api/v1/guest-bookings — serverseitig auf die eigene guest_id gescopet
// (die App filtert nichts nach). Ohne Gast-Konto gibt es hier nichts zu sehen:
// dann führt der Screen zur Anmeldung statt einen leeren Zustand vorzutäuschen.
//
// Aufbau wie in den Marktplatz-Apps: große Überschrift, Filter als Chip-Zeile,
// darunter die Buchungen als Karten mit quadratischem Bild und Textblock.
//
// Beträge sind maskierungsfest: `total_amount === null` heißt „nicht
// ausgewiesen" und wird als „—" gerendert, nie als 0 (Wurzel 4). Die Währung
// kommt aus der Buchung/dem Objekt.
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GuestGate } from "@/components/GuestGate";
import { Btn, Chip, Col, Photo, Row, Spinner, Txt } from "@/components/ui/kit";
import { EmptyState } from "@/components/ui/patterns";
import { useGuestAuth } from "@/contexts/GuestAuthContext";
import { formatCurrency } from "@/lib/currency";
import { formatTagKurz, tageBis } from "@/lib/datum";
import {
  bookingStatusLabel,
  listGuestBookings,
  type BookingStatusFilter,
  type GuestBookingSummary,
} from "@/lib/guestBookings";
import type { RootStackParamList } from "@/navigation/types";
import { useTheme } from "@/theme/ThemeProvider";

const FILTER: BookingStatusFilter[] = ["upcoming", "past", "cancelled"];
const FILTER_LABEL = ["Anstehend", "Vergangen", "Storniert"];

// Status → Badge-Farbe (identisch zur Gastgeber-Sicht, damit dieselbe Buchung
// in beiden Welten gleich aussieht).
const STATUS_TONE: Record<string, { bg: string; fg: string }> = {
  confirmed: { bg: "#E6F4EA", fg: "#1E7A46" },
  checked_in: { bg: "#E6F4EA", fg: "#1E7A46" },
  checked_out: { bg: "#EDEDED", fg: "#555555" },
  requested: { bg: "#FCF0DA", fg: "#9A6B12" },
  cancelled: { bg: "#FBE4E4", fg: "#B02A2A" },
  no_show: { bg: "#FBE4E4", fg: "#B02A2A" },
};

export default function GuestTrips() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { status: gastStatus } = useGuestAuth();

  const [seg, setSeg] = useState(0);
  const [items, setItems] = useState<GuestBookingSummary[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (gastStatus !== "signedIn") return;
    const res = await listGuestBookings(FILTER[seg]);
    if (res.ok) {
      setItems(res.data.items);
      setFehler(null);
    } else {
      setItems(null);
      setFehler(res.error);
    }
  }, [gastStatus, seg]);

  // Beim Zurückkehren (z. B. nach einer Buchung oder einem Check-in) neu laden.
  // Für reservations gibt es KEIN Realtime für Gäste: die Tabelle ist per RLS
  // nur tenant-/owner-/staff-sichtbar, ein Gast bekäme über den anon-Key
  // ohnehin keine Events (bewusst so — die Maskierung passiert in der API).
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (gastStatus === "loading") {
    return (
      <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top + 40 }}>
        <Spinner />
      </View>
    );
  }

  if (gastStatus !== "signedIn") {
    return (
      <GuestGate
        titel="Reisen"
        hinweis="Melde dich mit deinem Gast-Konto an, um Buchungen, Check-in-Infos und Belege zu sehen."
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
      <Col gap={16} style={{ paddingTop: 12, paddingBottom: 16 }}>
        <Txt v="display" style={{ paddingHorizontal: 24 }}>
          Reisen
        </Txt>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 8, paddingHorizontal: 24 }}
        >
          {FILTER_LABEL.map((label, i) => (
            <Pressable
              key={label}
              accessibilityRole="button"
              accessibilityState={{ selected: i === seg }}
              onPress={() => {
                setSeg(i);
                setItems(null);
              }}
            >
              <Chip variant={i === seg ? "on" : ""}>{label}</Chip>
            </Pressable>
          ))}
        </ScrollView>
      </Col>

      {!items && !fehler && <Spinner />}

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40, gap: 28 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
      >
        {fehler && <EmptyState icon="info" titel="Nicht geladen" text={fehler} />}

        {items && items.length === 0 && !fehler && (
          <EmptyState
            icon="suitcase"
            titel="Keine Buchungen"
            text="In diesem Bereich liegt gerade nichts. Deine gebuchten Reisen erscheinen hier."
          />
        )}

        {items?.map((b) => (
          <BuchungsKarte
            key={b.id}
            buchung={b}
            onPress={() => navigation.navigate("TripDetail", { id: b.id })}
            onCheckin={() => navigation.navigate("Checkin", { reservationId: b.id })}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function BuchungsKarte({
  buchung,
  onPress,
  onCheckin,
}: {
  buchung: GuestBookingSummary;
  onPress: () => void;
  onCheckin: () => void;
}) {
  const t = useTheme();
  const tone = STATUS_TONE[buchung.status] ?? { bg: t.palette.surface2, fg: t.palette.soft };
  const tage = tageBis(buchung.check_in);
  // „In x Tagen" nur für tatsächlich bevorstehende, gültige Buchungen.
  const bald =
    tage != null && tage >= 0 && buchung.status !== "cancelled"
      ? tage === 0
        ? "Heute"
        : `In ${tage} ${tage === 1 ? "Tag" : "Tagen"}`
      : null;

  const zeitraum = [formatTagKurz(buchung.check_in) || buchung.check_in, formatTagKurz(buchung.check_out) || buchung.check_out]
    .filter(Boolean)
    .join(" – ");

  return (
    <Col gap={12}>
      <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
        <Col gap={12}>
          <Photo src={buchung.property.photo ?? undefined} grad="grad1" r={t.radius.img} style={{ aspectRatio: 16 / 10 }}>
            <Row style={{ position: "absolute", top: 10, left: 10, right: 10, justifyContent: "space-between" }}>
              {bald ? (
                <View
                  style={{
                    paddingVertical: 6,
                    paddingHorizontal: 12,
                    borderRadius: t.radius.pill,
                    backgroundColor: "rgba(255,255,255,0.95)",
                  }}
                >
                  <Txt v="xs" color="#181614" style={{ fontFamily: t.fonts.semibold }}>
                    {bald}
                  </Txt>
                </View>
              ) : (
                <View />
              )}
              <View
                style={{
                  backgroundColor: tone.bg,
                  borderRadius: t.radius.pill,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                }}
              >
                <Txt v="xs" color={tone.fg} style={{ fontFamily: t.fonts.semibold }}>
                  {bookingStatusLabel(buchung.status)}
                </Txt>
              </View>
            </Row>
          </Photo>

          <Col gap={3}>
            <Txt v="title" numberOfLines={1}>
              {buchung.property.title}
            </Txt>
            {buchung.property.address ? (
              <Txt v="sm" soft numberOfLines={1}>
                {buchung.property.address}
              </Txt>
            ) : null}
            <Txt v="sm" soft numberOfLines={1}>
              {zeitraum} · {buchung.num_guests} {buchung.num_guests === 1 ? "Gast" : "Gäste"}
            </Txt>
            {/* null = vom Server nicht ausgewiesen → „—", nie 0 (Wurzel 4). */}
            <Txt v="sm" soft>
              <Txt v="sm" style={{ fontFamily: t.fonts.semibold }}>
                {buchung.total_amount != null
                  ? formatCurrency(buchung.total_amount, buchung.currency)
                  : "—"}
              </Txt>
              {" Gesamtpreis"}
            </Txt>
          </Col>
        </Col>
      </Pressable>

      {(buchung.status === "confirmed" || buchung.status === "checked_in") && (
        <Btn variant="outline" block icon="key" onPress={onCheckin}>
          Check-in-Infos ansehen
        </Btn>
      )}
    </Col>
  );
}

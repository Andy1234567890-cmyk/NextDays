// Gäste · Meine Reisen. Echte Buchungen des angemeldeten Portal-Gastes aus
// /api/v1/guest-bookings — serverseitig auf die eigene guest_id gescopet
// (die App filtert nichts nach). Ohne Gast-Konto gibt es hier nichts zu sehen:
// dann führt der Screen zur Anmeldung statt einen leeren Zustand vorzutäuschen.
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
import { Btn, Card, Chip, Col, Photo, Row, Segmented, Spinner, Txt } from "@/components/ui/kit";
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
      setItems([]);
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
      <View style={{ flex: 1, backgroundColor: t.palette.bg }}>
        <Spinner />
      </View>
    );
  }

  if (gastStatus !== "signedIn") {
    return (
      <GuestGate
        icon="key"
        titel="Meine Reisen"
        hinweis="Melde dich mit deinem Gast-Konto an, um Buchungen, Check-in-Infos und Belege zu sehen."
      />
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
      <Col style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12, gap: 12 }}>
        <Txt v="h1">Meine Reisen</Txt>
        <Segmented
          options={FILTER_LABEL}
          value={seg}
          onChange={(i) => {
            setSeg(i);
            setItems(null);
          }}
        />
      </Col>

      {!items && <Spinner />}

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 16 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
      >
        {items && items.length === 0 && (
          <Txt v="sm" soft style={{ textAlign: "center", marginTop: 40 }}>
            {fehler ?? "Keine Buchungen in diesem Bereich."}
          </Txt>
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

  return (
    <Card style={{ overflow: "hidden" }}>
      <Pressable onPress={onPress}>
        <Photo src={buchung.property.photo ?? undefined} grad="grad1" h={150}>
          <View style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.28)" }} />
          {bald && (
            <Chip variant="accent" style={{ position: "absolute", top: 12, left: 12 }}>
              {bald}
            </Chip>
          )}
          <View
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              backgroundColor: tone.bg,
              borderRadius: 999,
              paddingHorizontal: 10,
              paddingVertical: 4,
            }}
          >
            <Txt v="xs" color={tone.fg}>
              {bookingStatusLabel(buchung.status)}
            </Txt>
          </View>
          <Col style={{ position: "absolute", bottom: 12, left: 14, right: 14 }}>
            <Txt v="title" color="#fff" numberOfLines={1}>
              {buchung.property.title}
            </Txt>
            {buchung.property.address && (
              <Txt v="xs" color="rgba(255,255,255,0.85)" numberOfLines={1}>
                {buchung.property.address}
              </Txt>
            )}
          </Col>
        </Photo>
      </Pressable>

      <Col style={{ padding: 16, gap: 14 }}>
        <Row style={{ justifyContent: "space-between" }}>
          <Col>
            <Txt v="xs" soft>
              CHECK-IN
            </Txt>
            <Txt v="sm" style={{ fontFamily: t.type.bold.fontFamily }}>
              {formatTagKurz(buchung.check_in) || buchung.check_in}
            </Txt>
          </Col>
          <Col style={{ alignItems: "flex-end" }}>
            <Txt v="xs" soft>
              CHECK-OUT
            </Txt>
            <Txt v="sm" style={{ fontFamily: t.type.bold.fontFamily }}>
              {formatTagKurz(buchung.check_out) || buchung.check_out}
            </Txt>
          </Col>
        </Row>

        <Row style={{ justifyContent: "space-between", alignItems: "center" }}>
          <Txt v="xs" soft>
            {buchung.num_guests} {buchung.num_guests === 1 ? "Gast" : "Gäste"}
          </Txt>
          {/* null = vom Server nicht ausgewiesen → „—", nie 0 (Wurzel 4). */}
          <Txt v="sm" style={{ fontFamily: t.type.semibold.fontFamily }}>
            {buchung.total_amount != null
              ? formatCurrency(buchung.total_amount, buchung.currency)
              : "—"}
          </Txt>
        </Row>

        {(buchung.status === "confirmed" || buchung.status === "checked_in") && (
          <Btn variant="dark" block icon="key" onPress={onCheckin}>
            Check-in-Infos ansehen
          </Btn>
        )}
      </Col>
    </Card>
  );
}

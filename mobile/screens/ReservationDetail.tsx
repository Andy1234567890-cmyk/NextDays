// Reservierungs-Detail. Status · Zeitraum · Kanal · Gast (ggf. nur Vorname) ·
// Beträge. Maskierungskonform: total_amount/paid_amount/due_amount null → „—"
// (nie 0). Die App füllt maskierte Felder NICHT auf.
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/Icon";
import { Chip, Col, Row, Spinner, Txt } from "@/components/ui/kit";
import { EmptyState } from "@/components/ui/patterns";
import { formatCurrency } from "@/lib/currency";
import { getReservationDetail, type ReservationDetail as Detail } from "@/lib/reservations";
import type { RootStackParamList } from "@/navigation/types";
import { useTheme } from "@/theme/ThemeProvider";

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

// Betrag maskierungskonform: null → „—" (nie 0). Währung aus den Daten.
function amount(value: number | null, currency: string): string {
  return value != null ? formatCurrency(value, currency) : "—";
}

export default function ReservationDetail() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "ReservationDetail">>();
  const { id } = route.params;

  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getReservationDetail(id).then((res) => {
      if (!active) return;
      if (res.ok) setDetail(res.data);
      else setError(res.error);
      setLoading(false);
    });
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top + 40 }}>
        <Spinner />
      </View>
    );
  }

  if (!detail) {
    return (
      <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
        <Row style={{ paddingHorizontal: 12, paddingVertical: 8 }}>
          <ZurueckKnopf onPress={() => navigation.goBack()} />
        </Row>
        <EmptyState icon="info" titel="Nicht gefunden" text={error ?? "Reservierung nicht gefunden."} />
      </View>
    );
  }

  const location = [detail.property_city, detail.property_country].filter(Boolean).join(", ");

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
      <Row style={{ paddingHorizontal: 12, paddingVertical: 8, justifyContent: "space-between" }}>
        <ZurueckKnopf onPress={() => navigation.goBack()} />
        <Chip variant={detail.status === "confirmed" ? "on" : ""}>{detail.status}</Chip>
      </Row>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40, gap: 24 }}>
        <Col gap={6}>
          <Txt v="display">{detail.guest_name || "Gast"}</Txt>
          <Txt v="body" soft>
            {detail.property_title}
            {location ? ` · ${location}` : ""}
          </Txt>
        </Col>

        <Trennlinie />

        <Col gap={14}>
          <Txt v="h2">Buchung</Txt>
          <DetailRow
            label="Zeitraum"
            value={`${fmtDate(detail.check_in)} – ${fmtDate(detail.check_out)} · ${detail.nights} N`}
          />
          <DetailRow label="Kanal" value={detail.ota_name ?? detail.channel} />
          <DetailRow
            label="Gäste"
            value={`${detail.num_guests} (${detail.adults} Erw.${detail.children ? `, ${detail.children} Kinder` : ""})`}
          />
          {detail.external_ref && <DetailRow label="Referenz" value={detail.external_ref} />}
        </Col>

        <Trennlinie />

        {/* Beträge — maskiert (null → „—"). */}
        <Col gap={14}>
          <Txt v="h2">Beträge</Txt>
          <DetailRow label="Gesamt" value={amount(detail.total_amount, detail.currency)} strong />
          <DetailRow label="Bezahlt" value={amount(detail.paid_amount, detail.currency)} />
          <DetailRow label="Offen" value={amount(detail.due_amount, detail.currency)} />
        </Col>

        {detail.note && (
          <>
            <Trennlinie />
            <Col gap={10}>
              <Txt v="h2">Notiz</Txt>
              <Txt v="body" soft>
                {detail.note}
              </Txt>
            </Col>
          </>
        )}
      </ScrollView>
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

function DetailRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  const t = useTheme();
  return (
    <Row style={{ justifyContent: "space-between", alignItems: "center", gap: 16 }}>
      <Txt v="body" soft>
        {label}
      </Txt>
      <Txt
        v="body"
        numberOfLines={2}
        style={[{ flex: 1, textAlign: "right" }, strong ? { fontFamily: t.fonts.semibold } : null]}
      >
        {value}
      </Txt>
    </Row>
  );
}

// Reservierungs-Detail. Status · Zeitraum · Kanal · Gast (ggf. nur Vorname) ·
// Beträge. Maskierungskonform: total_amount/paid_amount/due_amount null → „—"
// (nie 0). Die App füllt maskierte Felder NICHT auf.
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useEffect, useState } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card, Chip, Col, Divider, IconBtn, Row, Spinner, Txt } from "@/components/ui/kit";
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
      <View style={{ flex: 1, backgroundColor: t.palette.bg }}>
        <Spinner />
      </View>
    );
  }

  if (!detail) {
    return (
      <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top + 20, paddingHorizontal: 20, gap: 16 }}>
        <IconBtn icon="back" onPress={() => navigation.goBack()} />
        <Txt v="sm" soft>
          {error ?? "Reservierung nicht gefunden."}
        </Txt>
      </View>
    );
  }

  const location = [detail.property_city, detail.property_country].filter(Boolean).join(", ");

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: 20, paddingBottom: 40, gap: 16 }}>
        <Row style={{ justifyContent: "space-between", alignItems: "center" }}>
          <IconBtn icon="back" onPress={() => navigation.goBack()} />
          <Chip variant={detail.status === "confirmed" ? "accent" : ""}>{detail.status}</Chip>
        </Row>

        <Col gap={4}>
          <Txt v="h1">{detail.guest_name || "Gast"}</Txt>
          <Txt v="sm" soft>
            {detail.property_title}
            {location ? ` · ${location}` : ""}
          </Txt>
        </Col>

        <Card style={{ padding: 16, gap: 12 }}>
          <DetailRow label="Zeitraum" value={`${fmtDate(detail.check_in)} – ${fmtDate(detail.check_out)} · ${detail.nights} N`} />
          <Divider />
          <DetailRow label="Kanal" value={detail.ota_name ?? detail.channel} />
          <Divider />
          <DetailRow label="Gäste" value={`${detail.num_guests} (${detail.adults} Erw.${detail.children ? `, ${detail.children} Kinder` : ""})`} />
          {detail.external_ref && (
            <>
              <Divider />
              <DetailRow label="Referenz" value={detail.external_ref} />
            </>
          )}
        </Card>

        {/* Beträge — maskiert (null → „—"). */}
        <Card style={{ padding: 16, gap: 12 }}>
          <DetailRow label="Gesamt" value={amount(detail.total_amount, detail.currency)} strong />
          <Divider />
          <DetailRow label="Bezahlt" value={amount(detail.paid_amount, detail.currency)} />
          <Divider />
          <DetailRow label="Offen" value={amount(detail.due_amount, detail.currency)} />
        </Card>

        {detail.note && (
          <Card style={{ padding: 16, gap: 6 }}>
            <Txt v="xs" soft>
              NOTIZ
            </Txt>
            <Txt v="sm">{detail.note}</Txt>
          </Card>
        )}
      </ScrollView>
    </View>
  );
}

function DetailRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  const t = useTheme();
  return (
    <Row style={{ justifyContent: "space-between", alignItems: "center" }}>
      <Txt v="sm" soft>
        {label}
      </Txt>
      <Txt v="sm" style={strong ? { fontFamily: t.type.bold.fontFamily } : undefined}>
        {value}
      </Txt>
    </Row>
  );
}

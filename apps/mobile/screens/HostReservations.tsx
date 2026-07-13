// Gastgeber · Reservierungen. Liste mit Filter (anstehend/aktuell/vergangen) und
// Navigation ins Detail. Beträge maskierungskonform: total_amount null → „—"
// (nie 0). Gastname kommt ggf. nur als Vorname (Backend-Maskierung) — die App
// rendert, was sie bekommt, ohne aufzufüllen.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card, Chip, Col, Row, Segmented, Spinner, Txt } from "@/components/ui/kit";
import { formatCurrency } from "@/lib/currency";
import {
  listReservations,
  type Reservation,
  type ReservationStatus,
} from "@/lib/reservations";
import { useTheme } from "@/theme/ThemeProvider";

const FILTERS = ["Anstehend", "Aktuell", "Vergangen"];

function todayIso(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function bucketOf(r: Reservation, today: string): number {
  // Vergleich rein lexikografisch auf YYYY-MM-DD (kein Date/UTC-Versatz).
  if (r.check_in > today) return 0; // anstehend
  if (r.check_out > today) return 1; // aktuell (check_out exklusiv)
  return 2; // vergangen
}

const STATUS_LABEL: Record<ReservationStatus, string> = {
  pending: "Angefragt",
  confirmed: "Bestätigt",
  cancelled: "Storniert",
  completed: "Abgeschlossen",
};

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y.slice(2)}`;
}

export default function HostReservations({ navigation }: { navigation: any }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState(0);
  const [items, setItems] = useState<Reservation[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const today = useMemo(() => todayIso(), []);

  const load = useCallback(async () => {
    const res = await listReservations();
    if (res.ok) {
      setItems(res.data.items);
      setError(null);
    } else {
      setItems([]);
      setError(res.error);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = (items ?? []).filter((r) => bucketOf(r, today) === filter);

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
      <Col style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12, gap: 12 }}>
        <Txt v="h1">Reservierungen</Txt>
        <Segmented options={FILTERS} value={filter} onChange={setFilter} />
      </Col>

      {!items && <Spinner />}
      <ScrollView
        contentContainerStyle={{ padding: 20, paddingTop: 4, gap: 12 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
      >
        {items && filtered.length === 0 && (
          <Txt v="sm" soft style={{ textAlign: "center", marginTop: 40 }}>
            {error ?? "Keine Reservierungen in dieser Ansicht."}
          </Txt>
        )}
        {filtered.map((r) => (
          <Pressable
            key={r.id}
            onPress={() => navigation.navigate("ReservationDetail", { id: r.id })}
          >
            <Card style={{ padding: 16, gap: 10 }}>
              <Row style={{ justifyContent: "space-between", gap: 8 }}>
                <Txt v="title" numberOfLines={1} style={{ flex: 1 }}>
                  {r.guest_name || "Gast"}
                </Txt>
                <Chip variant={r.status === "confirmed" ? "accent" : ""}>
                  {STATUS_LABEL[r.status]}
                </Chip>
              </Row>
              <Row style={{ justifyContent: "space-between", alignItems: "center" }}>
                <Txt v="sm" soft>
                  {fmtDate(r.check_in)} – {fmtDate(r.check_out)}
                </Txt>
                <Txt v="sm" style={{ fontFamily: t.type.bold.fontFamily }}>
                  {/* Maskierung: null → „—" (nie 0/Fantasiewert). */}
                  {r.total_amount != null ? formatCurrency(r.total_amount, r.currency) : "—"}
                </Txt>
              </Row>
              {r.ota_name && (
                <Row>
                  <Chip variant="ghost">{r.ota_name}</Chip>
                </Row>
              )}
            </Card>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

// Gastgeber · Buchungen (Referenz-Mockup): Suche + Filter-Chips (Objekt/Status/
// Kanal), Karten mit großem Foto links (Status-Badge oben, Kanal-Marke unten)
// und rechts Zeitraum, Buchungsref., Objekt, Gast · Gäste, Preis. Beträge
// maskierungskonform: total_amount null → „—" (nie 0). Gastname ggf. nur Vorname
// (Backend-Maskierung) — die App füllt nichts auf.
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/Icon";
import { Card, Col, IconBtn, Photo, Row, Spinner, Txt } from "@/components/ui/kit";
import { channelMeta } from "@/lib/calendar-channels";
import { formatCurrency } from "@/lib/currency";
import { listProperties, type Property } from "@/lib/properties";
import {
  listReservations,
  type Reservation,
  type ReservationChannel,
  type ReservationStatus,
} from "@/lib/reservations";
import { useTheme } from "@/theme/ThemeProvider";

const STATUS_LABEL: Record<ReservationStatus, string> = {
  pending: "Angefragt",
  confirmed: "Bestätigt",
  cancelled: "Storniert",
  completed: "Abgeschlossen",
};

// Status → Badge-Farbe (grün bestätigt/abgeschlossen, gelb angefragt, rot storno).
const STATUS_TONE: Record<ReservationStatus, { bg: string; fg: string }> = {
  confirmed: { bg: "#E6F4EA", fg: "#1E7A46" },
  completed: { bg: "#E6F4EA", fg: "#1E7A46" },
  pending: { bg: "#FCF0DA", fg: "#9A6B12" },
  cancelled: { bg: "#FBE4E4", fg: "#B02A2A" },
};

// Filter-Dimensionen (Chips wie im Mockup).
type StatusFilter = "all" | ReservationStatus;
const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Alle" },
  { key: "confirmed", label: "Bestätigt" },
  { key: "pending", label: "Angefragt" },
  { key: "cancelled", label: "Storniert" },
  { key: "completed", label: "Abgeschlossen" },
];

const MONTHS = [
  "Jan", "Feb", "Mär", "Apr", "Mai", "Jun",
  "Jul", "Aug", "Sep", "Okt", "Nov", "Dez",
];

function fmtRange(inIso: string, outIso: string): string {
  const f = (iso: string) => {
    const [y, m, d] = iso.split("-");
    return `${Number(d)}. ${MONTHS[Number(m) - 1]} ${y}`;
  };
  return `${f(inIso)} – ${f(outIso)}`;
}

// Buchungsref.: external_ref (OTA) oder kurze Groß-ID als Fallback (echte Daten).
function bookingRef(r: Reservation): string {
  if (r.external_ref) return `#${r.external_ref}`;
  return `#${r.id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

export default function HostReservations({ navigation }: { navigation: any }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Reservation[] | null>(null);
  const [props, setProps] = useState<Property[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [channelFilter, setChannelFilter] = useState<ReservationChannel | "all">("all");
  const [propFilter, setPropFilter] = useState<string | "all">("all");
  const [newestFirst, setNewestFirst] = useState(true);

  const load = useCallback(async () => {
    const [r, p] = await Promise.all([listReservations(), listProperties()]);
    if (r.ok) {
      setItems(r.data.items);
      setError(null);
    } else {
      setItems([]);
      setError(r.error);
    }
    if (p.ok) setProps(p.data.items);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const propById = useMemo(() => {
    const m = new Map<string, Property>();
    for (const p of props) m.set(p.id, p);
    return m;
  }, [props]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (items ?? []).filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (channelFilter !== "all" && r.channel !== channelFilter) return false;
      if (propFilter !== "all" && r.property_id !== propFilter) return false;
      if (q) {
        const title = propById.get(r.property_id)?.title ?? "";
        const hay = `${r.guest_name} ${bookingRef(r)} ${title}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    // Sortierung nach Check-in (neu/alt zuerst) — lexikografisch auf YYYY-MM-DD.
    return [...list].sort((a, b) =>
      newestFirst ? b.check_in.localeCompare(a.check_in) : a.check_in.localeCompare(b.check_in),
    );
  }, [items, query, statusFilter, channelFilter, propFilter, newestFirst, propById]);

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
      <Col style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 10, gap: 12 }}>
        <Row style={{ justifyContent: "space-between", alignItems: "center" }}>
          <Txt v="h1">Buchungen</Txt>
          <IconBtn
            icon="filter"
            flat
            onPress={() => setNewestFirst((v) => !v)}
          />
        </Row>

        {/* Suchleiste */}
        <Row
          style={{
            alignItems: "center",
            gap: 8,
            paddingHorizontal: 12,
            height: 44,
            borderRadius: t.radius.card,
            backgroundColor: t.palette.surface,
            borderWidth: 1,
            borderColor: t.palette.line,
          }}
        >
          <Icon n="search" s={18} sw={2} c={t.palette.soft} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Nach Buchungsref. oder Gast suchen"
            placeholderTextColor={t.palette.faint}
            style={{ flex: 1, fontFamily: t.type.body.fontFamily, fontSize: 14, color: t.palette.ink }}
          />
        </Row>

        {/* Filter-Chips: Status + Kanal + Objekt */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Row gap={8} style={{ paddingRight: 20 }}>
            {STATUS_FILTERS.map((s) => (
              <FilterChip
                key={s.key}
                label={s.label}
                active={statusFilter === s.key}
                onPress={() => setStatusFilter(s.key)}
              />
            ))}
            <FilterChip
              label="Alle Kanäle"
              active={channelFilter === "all"}
              onPress={() => setChannelFilter("all")}
            />
            {(["direct", "portal", "booking", "airbnb", "vrbo"] as ReservationChannel[]).map((c) => (
              <FilterChip
                key={c}
                label={channelMeta(c).label}
                active={channelFilter === c}
                onPress={() => setChannelFilter((v) => (v === c ? "all" : c))}
              />
            ))}
            <FilterChip
              label="Alle Objekte"
              active={propFilter === "all"}
              onPress={() => setPropFilter("all")}
            />
            {props.map((p) => (
              <FilterChip
                key={p.id}
                label={p.title}
                active={propFilter === p.id}
                onPress={() => setPropFilter((v) => (v === p.id ? "all" : p.id))}
              />
            ))}
          </Row>
        </ScrollView>
      </Col>

      {!items && <Spinner />}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: insets.bottom + 32, gap: 14 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
        showsVerticalScrollIndicator={false}
      >
        {items && visible.length === 0 && (
          <Txt v="sm" soft style={{ textAlign: "center", marginTop: 40 }}>
            {error ?? "Keine Buchungen für diese Filter."}
          </Txt>
        )}
        {visible.map((r) => (
          <BookingCard
            key={r.id}
            r={r}
            property={propById.get(r.property_id)}
            onPress={() => navigation.navigate("ReservationDetail", { id: r.id })}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function BookingCard({
  r,
  property,
  onPress,
}: {
  r: Reservation;
  property: Property | undefined;
  onPress: () => void;
}) {
  const t = useTheme();
  const tone = STATUS_TONE[r.status];
  const ch = channelMeta(r.channel);

  return (
    <Pressable onPress={onPress}>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <Row style={{ alignItems: "stretch" }}>
          {/* Foto mit Status-Badge (oben) und Kanal-Marke (unten). */}
          <View style={{ width: 116 }}>
            <Photo src={property?.photos?.[0]} h={148} w={116} r={0} />
            <View
              style={{
                position: "absolute",
                top: 8,
                left: 8,
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: 999,
                backgroundColor: tone.bg,
              }}
            >
              <Txt v="xs" color={tone.fg} style={{ fontFamily: t.type.semibold.fontFamily }}>
                {STATUS_LABEL[r.status]}
              </Txt>
            </View>
            <View
              style={{
                position: "absolute",
                bottom: 8,
                left: 8,
                width: 30,
                height: 30,
                borderRadius: 15,
                backgroundColor: ch.bar,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 2,
                borderColor: "#FFFFFF",
              }}
            >
              <Txt v="xs" color={ch.text} style={{ fontFamily: t.type.bold.fontFamily }}>
                {ch.label.slice(0, 1)}
              </Txt>
            </View>
          </View>

          {/* Info-Spalte */}
          <Col style={{ flex: 1, padding: 12, gap: 3, justifyContent: "center" }}>
            <Txt v="xs" soft>{fmtRange(r.check_in, r.check_out)}</Txt>
            <Txt v="title" numberOfLines={1}>{bookingRef(r)}</Txt>
            <Txt v="sm" soft numberOfLines={1}>
              {property?.title ?? "—"}
            </Txt>
            <Txt v="sm" numberOfLines={1}>
              {r.guest_name || "Gast"}
              <Txt v="sm" soft>{`   ·   ${r.num_guests} ${r.num_guests === 1 ? "Gast" : "Gäste"}`}</Txt>
            </Txt>
            <Txt v="title" style={{ fontFamily: t.type.bold.fontFamily, marginTop: 2 }}>
              {/* Maskierung: null → „—" (nie 0/Fantasiewert). */}
              {r.total_amount != null ? formatCurrency(r.total_amount, r.currency) : "—"}
            </Txt>
          </Col>
        </Row>
      </Card>
    </Pressable>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: active ? t.palette.ink : t.palette.line,
        backgroundColor: active ? t.palette.ink : t.palette.surface,
      }}
    >
      <Txt v="sm" color={active ? t.palette.surface : t.palette.ink}>{label}</Txt>
    </Pressable>
  );
}

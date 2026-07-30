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
import { Col, Photo, Row, Spinner, Txt } from "@/components/ui/kit";
import { EmptyState } from "@/components/ui/patterns";
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
      setItems(null);
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
      <Col style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 14, gap: 16 }}>
        <Row style={{ justifyContent: "space-between", alignItems: "center" }}>
          <Txt v="display">Buchungen</Txt>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={newestFirst ? "Älteste zuerst" : "Neueste zuerst"}
            onPress={() => setNewestFirst((v) => !v)}
            hitSlop={10}
            style={({ pressed }) => ({ padding: 6, opacity: pressed ? 0.6 : 1 })}
          >
            <Icon n="sliders" s={22} sw={1.8} c={t.palette.ink} />
          </Pressable>
        </Row>

        {/* Suchleiste */}
        <Row
          style={{
            alignItems: "center",
            gap: 10,
            paddingHorizontal: 16,
            height: 48,
            borderRadius: t.radius.pill,
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
            style={{ flex: 1, fontFamily: t.fonts.regular, fontSize: 15, color: t.palette.ink }}
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

      {!items && !error && <Spinner />}
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: 4,
          paddingBottom: insets.bottom + 32,
          gap: 24,
        }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
        showsVerticalScrollIndicator={false}
      >
        {items && visible.length === 0 && (
          <EmptyState
            icon={error ? "info" : "suitcase"}
            titel={error ? "Nicht geladen" : "Keine Buchungen"}
            text={error ?? "Für diese Filter liegt nichts vor."}
          />
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
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
    >
      <Row gap={14} style={{ alignItems: "flex-start" }}>
        {/* Foto mit Kanal-Marke. */}
        <View>
          <Photo src={property?.photos?.[0]} h={96} w={96} r={t.radius.img} />
          <View
            style={{
              position: "absolute",
              bottom: 6,
              left: 6,
              width: 26,
              height: 26,
              borderRadius: 13,
              backgroundColor: ch.bar,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 2,
              borderColor: "#FFFFFF",
            }}
          >
            <Txt v="xs" color={ch.text} style={{ fontFamily: t.fonts.bold, fontSize: 11 }}>
              {ch.label.slice(0, 1)}
            </Txt>
          </View>
        </View>

        {/* Info-Spalte */}
        <Col style={{ flex: 1 }} gap={3}>
          <Row gap={8} style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
            <Txt v="title" numberOfLines={1} style={{ flex: 1 }}>
              {bookingRef(r)}
            </Txt>
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: t.radius.pill,
                backgroundColor: tone.bg,
              }}
            >
              <Txt v="xs" color={tone.fg} style={{ fontFamily: t.fonts.semibold }}>
                {STATUS_LABEL[r.status]}
              </Txt>
            </View>
          </Row>
          <Txt v="sm" soft numberOfLines={1}>
            {property?.title ?? "—"}
          </Txt>
          <Txt v="sm" soft numberOfLines={1}>
            {fmtRange(r.check_in, r.check_out)} · {r.num_guests}{" "}
            {r.num_guests === 1 ? "Gast" : "Gäste"}
          </Txt>
          <Txt v="sm" numberOfLines={1}>
            {r.guest_name || "Gast"}
          </Txt>
          <Txt v="body" style={{ fontFamily: t.fonts.semibold, marginTop: 2 }}>
            {/* Maskierung: null → „—" (nie 0/Fantasiewert). */}
            {r.total_amount != null ? formatCurrency(r.total_amount, r.currency) : "—"}
          </Txt>
        </Col>
      </Row>
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

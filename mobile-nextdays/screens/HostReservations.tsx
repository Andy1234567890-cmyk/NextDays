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

import { KanalMarke } from "@/components/KanalMarke";
import { BuchungsPanel } from "@/components/buchung/BuchungsPanel";
import { Icon } from "@/components/ui/Icon";
import { Col, Photo, Row, Spinner, Txt } from "@/components/ui/kit";
import { EmptyState } from "@/components/ui/patterns";
import { STATUS_LABEL, STATUS_TONE, anzeigeStatus } from "@/lib/buchungsstatus";
import { channelMeta } from "@/lib/calendar-channels";
import { formatCurrency } from "@/lib/currency";
import { MONATE, heuteIso, naechte } from "@/lib/kalendertag";
import { listProperties, type Property } from "@/lib/properties";
import {
  listReservations,
  type Reservation,
  type ReservationChannel,
  type ReservationStatus,
} from "@/lib/reservations";
import { useUnterkante } from "@/lib/unterkante";
import { useTheme } from "@/theme/ThemeProvider";

// Filter-Dimensionen (Chips wie im Mockup).
type StatusFilter = "all" | ReservationStatus;
const STATUS_FILTERS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Alle" },
  { key: "confirmed", label: "Bestätigt" },
  { key: "pending", label: "Angefragt" },
  { key: "cancelled", label: "Storniert" },
  { key: "completed", label: "Abgeschlossen" },
];


// Zeitraum kompakt: Jahr und Monat nur nennen, wenn sie sich unterscheiden —
// „26. Dez 2026 – 28. Dez 2026" ist dreimal dieselbe Information.
function fmtRange(inIso: string, outIso: string): string {
  const [y1, m1, d1] = inIso.split("-");
  const [y2, m2, d2] = outIso.split("-");
  const mo = (m: string) => MONATE[Number(m) - 1];
  if (y1 === y2 && m1 === m2) return `${Number(d1)}.–${Number(d2)}. ${mo(m2)} ${y2}`;
  if (y1 === y2) return `${Number(d1)}. ${mo(m1)} – ${Number(d2)}. ${mo(m2)} ${y2}`;
  return `${Number(d1)}. ${mo(m1)} ${y1} – ${Number(d2)}. ${mo(m2)} ${y2}`;
}

// Buchungsref.: external_ref (OTA) oder kurze Groß-ID als Fallback (echte Daten).
function bookingRef(r: Reservation): string {
  if (r.external_ref) return `#${r.external_ref}`;
  return `#${r.id.replace(/-/g, "").slice(0, 8).toUpperCase()}`;
}

export default function HostReservations({
  navigation,
  route,
}: {
  navigation: any;
  route?: { params?: { status?: ReservationStatus } };
}) {
  const t = useTheme();
  // Unten frei bleiben MUSS die Tab-Leiste (lib/unterkante).
  const unterkante = useUnterkante();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<Reservation[] | null>(null);
  const [props, setProps] = useState<Property[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  // Vorgabe aus der Navigation (Übersicht → „Anfragen warten auf Freigabe").
  // Nur als STARTWERT: danach gehört der Filter dem Nutzer, ein späteres
  // Zurücksetzen auf den Parameter würde seine Auswahl überschreiben.
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    route?.params?.status ?? "all",
  );
  const [channelFilter, setChannelFilter] = useState<ReservationChannel | "all">("all");
  const [propFilter, setPropFilter] = useState<string | "all">("all");
  const [newestFirst, setNewestFirst] = useState(true);
  // Angetippte Buchung → Panel. Kein Screen-Wechsel: die gesetzten Filter und
  // die Scrollposition sollen erhalten bleiben.
  const [offeneBuchung, setOffeneBuchung] = useState<string | null>(null);

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
            {(
              ["direct", "portal", "booking", "airbnb", "vrbo", "ota_other"] as ReservationChannel[]
            ).map((c) => (
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
          paddingBottom: unterkante + 24,
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
            onPress={() => setOffeneBuchung(r.id)}
          />
        ))}
      </ScrollView>

      {/* Dasselbe Panel wie im Kalender — es öffnet ÜBER der Liste, damit Suche,
          Filter und Scrollposition beim Schließen erhalten bleiben. Vorher
          navigierte die Zeile auf einen eigenen Detail-Screen, der weder
          Check-in noch Storno kannte. */}
      {offeneBuchung && (
        <BuchungsPanel
          reservationId={offeneBuchung}
          heuteIso={heuteIso()}
          onClose={() => setOffeneBuchung(null)}
          onGeaendert={load}
          onNachrichtOeffnen={(threadId) => {
            setOffeneBuchung(null);
            navigation.navigate("HostInbox", { threadId });
          }}
        />
      )}
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
  // Der ANZEIGE-Status, nicht der rohe: ein eingecheckter Gast steht als „Im
  // Haus" da, nicht als „Bestätigt" (0091).
  const status = anzeigeStatus(r.status, r.checked_in_at, r.checked_out_at);
  const tone = STATUS_TONE[status];
  const n = naechte(r.check_in, r.check_out);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
    >
      <Row gap={14} style={{ alignItems: "flex-start" }}>
        {/* Foto mit Kanal-Marke: das ECHTE Portal-Logo, wenn es eines gibt.
            Für „Direkt" und den eigenen Marktplatz gibt es keines — dort steht
            ein Punkt in der Kanalfarbe, kein gebastelter Buchstabe. */}
        <View>
          <Photo src={property?.photos?.[0]} h={96} w={96} r={t.radius.img} />
          <View style={{ position: "absolute", bottom: 6, left: 6 }}>
            {r.is_owner_stay ? (
              /* Eigentümer-Aufenthalt (0241): keine Kanal-Herkunft, sondern
                 die Einordnung — er kommt über keinen Vertriebsweg. */
              <View
                style={{
                  height: 22,
                  paddingHorizontal: 8,
                  borderRadius: 11,
                  backgroundColor: "#FFFFFF",
                  justifyContent: "center",
                  ...t.shadow.sm,
                }}
              >
                <Txt v="xs" style={{ fontFamily: t.fonts.semibold }}>
                  Eigentümer
                </Txt>
              </View>
            ) : (
              <KanalMarke channel={r.channel} randfarbe="#FFFFFF" />
            )}
          </View>
        </View>

        {/* Info-Spalte: der GAST trägt die Zeile, nicht die OTA-Referenz — im
            Betrieb sucht man nach Personen und Objekten, die Referenz ist
            Nachschlagewert. */}
        <Col style={{ flex: 1 }} gap={3}>
          <Row gap={8} style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
            <Txt v="title" numberOfLines={1} style={{ flex: 1 }}>
              {r.guest_name || "Gast"}
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
                {STATUS_LABEL[status]}
              </Txt>
            </View>
          </Row>
          <Txt v="sm" soft numberOfLines={1}>
            {property?.title ?? "—"}
          </Txt>
          <Txt v="sm" soft numberOfLines={1}>
            {fmtRange(r.check_in, r.check_out)} · {n} {n === 1 ? "Nacht" : "Nächte"}
          </Txt>
          <Row gap={8} style={{ alignItems: "baseline", marginTop: 2 }}>
            <Txt v="body" style={{ fontFamily: t.fonts.semibold }}>
              {/* Maskierung: null → „—" (nie 0/Fantasiewert). */}
              {r.total_amount != null ? formatCurrency(r.total_amount, r.currency) : "—"}
            </Txt>
            <Txt v="xs" faint numberOfLines={1} style={{ flex: 1 }}>
              {bookingRef(r)} · {r.num_guests} {r.num_guests === 1 ? "Gast" : "Gäste"}
            </Txt>
          </Row>
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

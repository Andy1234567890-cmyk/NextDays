// Gäste · Buchungsdetail (/api/v1/guest-bookings/{id} + /timeline + /cancel).
// Alles serverseitig auf die eigene guest_id gescopet — die App prüft keine
// Zugehörigkeit selbst und zeigt nur, was sie bekommt (Wurzel 3/9).
//
// Beträge/Positionen kommen 1:1 aus der Antwort: fehlende Werte bleiben „—"
// (nie 0), die Währung stammt aus der Buchung (kein €-Hardcode, Wurzel 4).
// Stornieren ist gegen Doppeltipp gesperrt und nur möglich, wenn der SERVER
// `can_cancel` sagt — kein clientseitiges „Aufmachen".
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/Icon";
import { Btn, Col, Photo, Row, Spinner, Txt } from "@/components/ui/kit";
import { EmptyState, Sheet } from "@/components/ui/patterns";
import { formatCurrency } from "@/lib/currency";
import { formatTag, formatZeitraum } from "@/lib/datum";
import {
  bookingStatusLabel,
  cancelGuestBooking,
  getGuestBooking,
  getGuestBookingTimeline,
  type GuestBookingDetail,
  type TimelineEvent,
} from "@/lib/guestBookings";
import type { RootStackParamList } from "@/navigation/types";
import { useTheme } from "@/theme/ThemeProvider";

// Ereignis-Arten der Zeitleiste in Klartext. Unbekannte Arten werden roh
// angezeigt statt weggelassen — der Gast soll den vollständigen Verlauf sehen.
const EVENT_LABEL: Record<string, string> = {
  created: "Buchung angelegt",
  confirmed: "Buchung bestätigt",
  cancelled: "Buchung storniert",
  payment: "Zahlung",
  message: "Nachricht",
  checked_in: "Check-in",
  checked_out: "Check-out",
  modified: "Buchung geändert",
};

export default function TripDetail() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "TripDetail">>();
  const { id } = route.params;

  const [buchung, setBuchung] = useState<GuestBookingDetail | null>(null);
  const [verlauf, setVerlauf] = useState<TimelineEvent[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  const [grund, setGrund] = useState("");
  const [stornoOffen, setStornoOffen] = useState(false);
  const [storniert, setStorniert] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [b, v] = await Promise.all([getGuestBooking(id), getGuestBookingTimeline(id)]);
    if (b.ok) {
      setBuchung(b.data);
      setFehler(null);
    } else {
      setFehler(b.error);
    }
    if (v.ok) setVerlauf(v.data.items);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const stornieren = async () => {
    if (busy || storniert) return; // Wurzel 2: kein zweiter Storno-Request
    setBusy(true);
    const res = await cancelGuestBooking(id, grund.trim());
    if (res.ok) {
      setStorniert(true);
      setStornoOffen(false);
      await load();
    } else {
      setFehler(res.error);
    }
    setBusy(false);
  };

  if (!buchung) {
    return (
      <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
        <Row style={{ paddingHorizontal: 12, paddingVertical: 8 }}>
          <ZurueckKnopf onPress={() => navigation.goBack()} />
        </Row>
        {fehler ? <EmptyState icon="info" titel="Nicht geladen" text={fehler} /> : <Spinner />}
      </View>
    );
  }

  const waehrung = buchung.currency || buchung.property.currency;
  const betrag = (wert: number | null) => (wert != null ? formatCurrency(wert, waehrung) : "—");

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
      <Row style={{ paddingHorizontal: 12, paddingVertical: 8 }}>
        <ZurueckKnopf onPress={() => navigation.goBack()} />
      </Row>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 48, gap: 24 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
      >
        <Col gap={6}>
          <Txt v="display">Buchung</Txt>
          <Txt v="body" soft>
            {bookingStatusLabel(buchung.status)}
          </Txt>
        </Col>

        <Row gap={14}>
          <Photo src={buchung.property.photo ?? undefined} grad="grad1" h={78} w={92} r={t.radius.img} />
          <Col gap={3} style={{ flex: 1 }}>
            <Txt v="title" numberOfLines={2}>
              {buchung.property.title}
            </Txt>
            {buchung.property.address && (
              <Txt v="sm" soft numberOfLines={2}>
                {buchung.property.address}
              </Txt>
            )}
          </Col>
        </Row>

        <Trennlinie />

        <Col gap={14}>
          <Txt v="h2">Deine Reise</Txt>
          <Zeile
            label="Zeitraum"
            wert={
              formatZeitraum(buchung.check_in, buchung.check_out) ||
              `${buchung.check_in} – ${buchung.check_out}`
            }
          />
          {buchung.checkin_time && <Zeile label="Anreisezeit" wert={buchung.checkin_time} />}
          {buchung.checkout_time && <Zeile label="Abreisezeit" wert={buchung.checkout_time} />}
          <Zeile
            label="Gäste"
            wert={`${buchung.num_guests} (${buchung.adults} Erw., ${buchung.children} Kinder)`}
          />
          <Zeile label="Kanal" wert={buchung.channel} />
          {buchung.payment_status && <Zeile label="Zahlung" wert={buchung.payment_status} />}
        </Col>

        <Trennlinie />

        <Col gap={14}>
          <Txt v="h2">Beträge</Txt>
          {buchung.quote_items.map((q, i) => (
            <Row key={`${q.label ?? "pos"}-${i}`} style={{ justifyContent: "space-between", gap: 12 }}>
              <Txt v="body" soft style={{ flex: 1 }} numberOfLines={1}>
                {q.label ?? "Position"}
                {q.quantity != null ? ` × ${q.quantity}` : ""}
              </Txt>
              <Txt v="body">{betrag(q.amount ?? null)}</Txt>
            </Row>
          ))}
          {buchung.quote_items.length > 0 && <Trennlinie />}
          <Row style={{ justifyContent: "space-between", gap: 12 }}>
            <Txt v="body" style={{ fontFamily: t.fonts.semibold }}>
              Gesamt
            </Txt>
            <Txt v="body" style={{ fontFamily: t.fonts.semibold }}>
              {betrag(buchung.total_amount)}
            </Txt>
          </Row>
          <Zeile label="Bezahlt" wert={betrag(buchung.paid_amount)} />
          <Zeile label="Offen" wert={betrag(buchung.balance_due)} />
        </Col>

        {buchung.note && (
          <>
            <Trennlinie />
            <Col gap={10}>
              <Txt v="h2">Hinweis</Txt>
              <Txt v="body" soft>
                {buchung.note}
              </Txt>
            </Col>
          </>
        )}

        {verlauf.length > 0 && (
          <>
            <Trennlinie />
            <Col gap={14}>
              <Txt v="h2">Verlauf</Txt>
              {verlauf.map((e, i) => (
                <Row
                  key={`${e.kind}-${e.created_at}-${i}`}
                  style={{ justifyContent: "space-between", gap: 12 }}
                >
                  <Txt v="body" style={{ flex: 1 }}>
                    {EVENT_LABEL[e.kind] ?? e.kind}
                  </Txt>
                  <Txt v="sm" soft>
                    {formatTag(e.created_at) || e.created_at.slice(0, 10)}
                  </Txt>
                </Row>
              ))}
            </Col>
          </>
        )}

        {buchung.checked_in_at && (
          <Txt v="sm" soft>
            Eingecheckt am {formatTag(buchung.checked_in_at)}
          </Txt>
        )}
        {buchung.cancelled_at && (
          <Txt v="sm" soft>
            Storniert am {formatTag(buchung.cancelled_at)}
          </Txt>
        )}

        {fehler && (
          <Row gap={8} style={{ alignItems: "flex-start" }}>
            <Icon n="info" s={17} sw={1.9} c={t.palette.accent} />
            <Txt v="sm" accent style={{ flex: 1 }}>
              {fehler}
            </Txt>
          </Row>
        )}

        {/* Der Weg zum Gastgeber gehört an die BUCHUNG: hier weiß man, worum es
            geht, und die Frage entsteht beim Lesen der Details („wo ist der
            Schlüssel?"). Auch bei einer stornierten Buchung sichtbar — offene
            Fragen enden nicht mit dem Storno. */}
        <Trennlinie />
        <Btn
          variant="dark"
          block
          icon="chat"
          onPress={() =>
            navigation.navigate("GuestMessages", { reservationId: id })
          }
        >
          Gastgeber schreiben
        </Btn>

        {/* Storno nur, wenn der Server es erlaubt. */}
        {buchung.can_cancel && !storniert && (
          <>
            <Trennlinie />
            <Btn variant="outline" block onPress={() => setStornoOffen(true)}>
              Buchung stornieren
            </Btn>
          </>
        )}
      </ScrollView>

      <Sheet
        open={stornoOffen}
        onClose={() => setStornoOffen(false)}
        header={<Txt v="h2">Buchung stornieren</Txt>}
      >
        <Col gap={16} style={{ paddingHorizontal: 20, paddingTop: 18 }}>
          <Txt v="sm" soft>
            Der Gastgeber wird über die Stornierung informiert. Ein Grund hilft ihm
            dabei — Pflicht ist er nicht.
          </Txt>
          <TextInput
            value={grund}
            onChangeText={(v) => setGrund(v.slice(0, 1000))}
            placeholder="Grund (optional)"
            placeholderTextColor={t.palette.faint}
            multiline
            style={{
              borderWidth: 1,
              borderColor: t.palette.line,
              borderRadius: 14,
              padding: 16,
              minHeight: 96,
              color: t.palette.ink,
              fontFamily: t.fonts.regular,
              fontSize: 16,
              textAlignVertical: "top",
            }}
          />
          <Btn variant="primary" block onPress={stornieren}>
            {busy ? "Wird storniert …" : "Stornierung bestätigen"}
          </Btn>
        </Col>
      </Sheet>
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

function Zeile({ label, wert }: { label: string; wert: string }) {
  return (
    <Row style={{ justifyContent: "space-between", gap: 12 }}>
      <Txt v="body" soft>
        {label}
      </Txt>
      <Txt v="body" style={{ flex: 1, textAlign: "right" }} numberOfLines={2}>
        {wert}
      </Txt>
    </Row>
  );
}

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
import { RefreshControl, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Btn, Card, Col, Divider, Flat, IconBtn, Photo, Row, Spinner, Txt } from "@/components/ui/kit";
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
        <Row style={{ paddingHorizontal: 20, paddingVertical: 8, gap: 14 }}>
          <IconBtn icon="back" flat bg={t.palette.surface2} onPress={() => navigation.goBack()} />
          <Txt v="h2">Buchung</Txt>
        </Row>
        {fehler ? (
          <Txt v="sm" soft style={{ padding: 20 }}>
            {fehler}
          </Txt>
        ) : (
          <Spinner />
        )}
      </View>
    );
  }

  const waehrung = buchung.currency || buchung.property.currency;
  const betrag = (wert: number | null) => (wert != null ? formatCurrency(wert, waehrung) : "—");

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
      <Row style={{ paddingHorizontal: 20, paddingVertical: 8, gap: 14 }}>
        <IconBtn icon="back" flat bg={t.palette.surface2} onPress={() => navigation.goBack()} />
        <Txt v="h2">Buchung</Txt>
      </Row>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingTop: 8, gap: 16, paddingBottom: 60 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
      >
        <Card style={{ flexDirection: "row", padding: 12, gap: 12 }}>
          <Photo src={buchung.property.photo ?? undefined} grad="grad1" h={70} w={84} r={14} />
          <Col gap={3} style={{ flex: 1 }}>
            <Txt v="title" numberOfLines={1}>
              {buchung.property.title}
            </Txt>
            {buchung.property.address && (
              <Txt v="sm" soft numberOfLines={1}>
                {buchung.property.address}
              </Txt>
            )}
            <Txt v="xs" accent>
              {bookingStatusLabel(buchung.status)}
            </Txt>
          </Col>
        </Card>

        <Flat style={{ padding: 16, gap: 10 }}>
          <Zeile label="Zeitraum" wert={formatZeitraum(buchung.check_in, buchung.check_out) || `${buchung.check_in} – ${buchung.check_out}`} />
          {buchung.checkin_time && <Zeile label="Anreisezeit" wert={buchung.checkin_time} />}
          {buchung.checkout_time && <Zeile label="Abreisezeit" wert={buchung.checkout_time} />}
          <Zeile
            label="Gäste"
            wert={`${buchung.num_guests} (${buchung.adults} Erw., ${buchung.children} Kinder)`}
          />
          <Zeile label="Kanal" wert={buchung.channel} />
          {buchung.payment_status && <Zeile label="Zahlung" wert={buchung.payment_status} />}
        </Flat>

        <Col gap={10}>
          <Txt v="title">Beträge</Txt>
          {buchung.quote_items.length > 0 &&
            buchung.quote_items.map((q, i) => (
              <Row key={`${q.label ?? "pos"}-${i}`} style={{ justifyContent: "space-between" }}>
                <Txt v="body" soft style={{ flex: 1 }} numberOfLines={1}>
                  {q.label ?? "Position"}
                  {q.quantity != null ? ` × ${q.quantity}` : ""}
                </Txt>
                <Txt v="sm">{betrag(q.amount ?? null)}</Txt>
              </Row>
            ))}
          <Divider />
          <Row style={{ justifyContent: "space-between" }}>
            <Txt v="sm" soft>
              Gesamt
            </Txt>
            <Txt v="title">{betrag(buchung.total_amount)}</Txt>
          </Row>
          <Row style={{ justifyContent: "space-between" }}>
            <Txt v="sm" soft>
              Bezahlt
            </Txt>
            <Txt v="sm">{betrag(buchung.paid_amount)}</Txt>
          </Row>
          <Row style={{ justifyContent: "space-between" }}>
            <Txt v="sm" soft>
              Offen
            </Txt>
            <Txt v="sm">{betrag(buchung.balance_due)}</Txt>
          </Row>
        </Col>

        {buchung.note && (
          <>
            <Divider />
            <Col gap={6}>
              <Txt v="title">Hinweis</Txt>
              <Txt v="body" soft>
                {buchung.note}
              </Txt>
            </Col>
          </>
        )}

        {verlauf.length > 0 && (
          <>
            <Divider />
            <Col gap={10}>
              <Txt v="title">Verlauf</Txt>
              {verlauf.map((e, i) => (
                <Row key={`${e.kind}-${e.created_at}-${i}`} style={{ justifyContent: "space-between" }}>
                  <Txt v="sm" style={{ flex: 1 }}>
                    {EVENT_LABEL[e.kind] ?? e.kind}
                  </Txt>
                  <Txt v="xs" soft>
                    {formatTag(e.created_at) || e.created_at.slice(0, 10)}
                  </Txt>
                </Row>
              ))}
            </Col>
          </>
        )}

        {buchung.checked_in_at && (
          <Txt v="xs" soft>
            Eingecheckt am {formatTag(buchung.checked_in_at)}
          </Txt>
        )}
        {buchung.cancelled_at && (
          <Txt v="xs" soft>
            Storniert am {formatTag(buchung.cancelled_at)}
          </Txt>
        )}

        {/* Storno nur, wenn der Server es erlaubt. */}
        {buchung.can_cancel && !storniert && (
          <Col gap={10}>
            <Divider />
            {stornoOffen ? (
              <>
                <Txt v="title">Buchung stornieren</Txt>
                <TextInput
                  value={grund}
                  onChangeText={(v) => setGrund(v.slice(0, 1000))}
                  placeholder="Grund (optional)"
                  placeholderTextColor={t.palette.faint}
                  multiline
                  style={{
                    borderWidth: 1,
                    borderColor: t.palette.line,
                    borderRadius: t.radius.btn,
                    padding: 12,
                    minHeight: 80,
                    color: t.palette.ink,
                    fontFamily: t.type.medium.fontFamily,
                    textAlignVertical: "top",
                  }}
                />
                <Row gap={10}>
                  <Btn variant="ghost" style={{ flex: 1 }} onPress={() => setStornoOffen(false)}>
                    Zurück
                  </Btn>
                  <Btn variant="primary" style={{ flex: 1 }} onPress={stornieren}>
                    {busy ? "Wird storniert …" : "Stornieren"}
                  </Btn>
                </Row>
              </>
            ) : (
              <Btn variant="ghost" block onPress={() => setStornoOffen(true)}>
                Buchung stornieren
              </Btn>
            )}
          </Col>
        )}

        {fehler && (
          <Txt v="sm" style={{ color: "#B02A2A" }}>
            {fehler}
          </Txt>
        )}
      </ScrollView>
    </View>
  );
}

function Zeile({ label, wert }: { label: string; wert: string }) {
  return (
    <Row style={{ justifyContent: "space-between", gap: 12 }}>
      <Txt v="sm" soft>
        {label}
      </Txt>
      <Txt v="sm" style={{ flex: 1, textAlign: "right" }} numberOfLines={2}>
        {wert}
      </Txt>
    </Row>
  );
}

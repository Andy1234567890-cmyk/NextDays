// Gäste · Check-in / Gastmappe einer EIGENEN Buchung (/api/v1/guest-stay/{id}).
// Türcode, Anfahrt, WLAN, Hausordnung und Kontakt kommen ausschließlich vom
// Server; der Türcode NUR, wenn dessen Freigaberegeln erfüllt sind — fehlt er,
// nennt das Backend den Grund und die App zeigt genau diesen (kein erfundener
// Code, keine erfundene Uhrzeit, Wurzel 4).
//
// Der Self-Check-in ist gegen Doppeltipp gesperrt; das Backend meldet einen
// bereits erfolgten Check-in idempotent zurück (Wurzel 2).
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useEffect, useState } from "react";
import { Linking, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, type IconName } from "@/components/ui/Icon";
import { Btn, Card, Col, Flat, IconBtn, Row, Spinner, Txt } from "@/components/ui/kit";
import { formatTag, formatZeitraum } from "@/lib/datum";
import { getStay, localized, selfCheckIn, type Stay } from "@/lib/guestStay";
import type { RootStackParamList } from "@/navigation/types";
import { useTheme } from "@/theme/ThemeProvider";

// Info-Blöcke der Gastmappe in fester Reihenfolge; leere Blöcke entfallen.
const BLOECKE: { key: keyof Stay["messaging"]; titel: string; icon: IconName }[] = [
  { key: "check_in", titel: "Anreise", icon: "key" },
  { key: "directions", titel: "Anfahrt", icon: "map" },
  { key: "door_instructions", titel: "Zugang", icon: "shield" },
  { key: "wifi", titel: "WLAN", icon: "wifi" },
  { key: "rules", titel: "Hausordnung", icon: "shield" },
  { key: "local_guide", titel: "Tipps vor Ort", icon: "pin" },
  { key: "check_out", titel: "Abreise", icon: "fwd" },
  { key: "emergency", titel: "Notfall", icon: "bell" },
];

export default function Checkin() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "Checkin">>();
  const { reservationId } = route.params;

  const [stay, setStay] = useState<Stay | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [hinweis, setHinweis] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await getStay(reservationId);
    if (res.ok) {
      setStay(res.data);
      setFehler(null);
    } else {
      setFehler(res.error);
    }
  }, [reservationId]);

  useEffect(() => {
    load();
  }, [load]);

  const einchecken = async () => {
    if (busy || stay?.checked_in_at) return; // Wurzel 2
    setBusy(true);
    const res = await selfCheckIn(reservationId);
    if (res.ok) {
      setHinweis(
        res.data.already_checked_in
          ? "Du warst bereits eingecheckt."
          : "Check-in bestätigt. Willkommen!",
      );
      await load();
    } else {
      setHinweis(res.error);
    }
    setBusy(false);
  };

  if (!stay) {
    return (
      <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
        <Row style={{ paddingHorizontal: 20, paddingVertical: 8, gap: 14 }}>
          <IconBtn icon="back" flat bg={t.palette.surface2} onPress={() => navigation.goBack()} />
          <Txt v="h2">Check-in</Txt>
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

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
      <Row style={{ paddingHorizontal: 20, paddingVertical: 8, gap: 14 }}>
        <IconBtn icon="back" flat bg={t.palette.surface2} onPress={() => navigation.goBack()} />
        <Txt v="h2">Check-in</Txt>
      </Row>

      <ScrollView
        contentContainerStyle={{ padding: 20, paddingTop: 6, gap: 16, paddingBottom: 50 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
      >
        <Col gap={4}>
          <Txt v="h1">{stay.property_title}</Txt>
          <Txt v="sm" soft>
            {formatZeitraum(stay.check_in, stay.check_out) ||
              `${stay.check_in} – ${stay.check_out}`}
          </Txt>
        </Col>

        {/* Türcode: echter Code ODER der Grund des Servers — nie beides erfunden. */}
        <Card style={{ padding: 22, gap: 10, alignItems: "center", backgroundColor: t.palette.ink }}>
          <Icon n="key" s={26} c={t.palette.bg} />
          <Txt v="xs" color={t.palette.bg} style={{ opacity: 0.7, letterSpacing: 1.4 }}>
            TÜRCODE
          </Txt>
          {stay.door_code ? (
            <Txt
              color={t.palette.bg}
              style={{ fontFamily: t.type.extrabold.fontFamily, fontSize: 44, letterSpacing: 6 }}
            >
              {stay.door_code}
            </Txt>
          ) : (
            <Txt v="sm" color={t.palette.bg} style={{ opacity: 0.8, textAlign: "center" }}>
              {stay.door_code_hidden_reason ?? "Noch nicht freigegeben."}
            </Txt>
          )}
        </Card>

        {stay.property_address && (
          <Flat style={{ flexDirection: "row", alignItems: "center", padding: 14, gap: 12 }}>
            <Icon n="pin" s={22} c={t.palette.accent} />
            <Col style={{ flex: 1 }}>
              <Txt v="sm" style={{ fontFamily: t.type.semibold.fontFamily }}>
                {stay.property_address}
              </Txt>
            </Col>
          </Flat>
        )}

        {/* Kontakt: nur echte Nummern, per Tap wählbar. */}
        {(stay.contact_phone || stay.maintenance_phone) && (
          <Flat style={{ padding: 14, gap: 10 }}>
            <Txt v="title">Kontakt</Txt>
            {stay.contact_phone && (
              <Row style={{ justifyContent: "space-between", alignItems: "center" }}>
                <Txt v="sm">{stay.contact_name ?? "Gastgeber"}</Txt>
                <Btn variant="ghost" onPress={() => Linking.openURL(`tel:${stay.contact_phone}`)}>
                  {stay.contact_phone}
                </Btn>
              </Row>
            )}
            {stay.maintenance_phone && (
              <Row style={{ justifyContent: "space-between", alignItems: "center" }}>
                <Txt v="sm">Technischer Notdienst</Txt>
                <Btn variant="ghost" onPress={() => Linking.openURL(`tel:${stay.maintenance_phone}`)}>
                  {stay.maintenance_phone}
                </Btn>
              </Row>
            )}
          </Flat>
        )}

        {/* Info-Blöcke der Gastmappe (Plaintext, serverseitig auf bekannte Keys
            gefiltert — hier wird kein HTML gerendert, Wurzel 8). */}
        {BLOECKE.map((b) => {
          const text = localized(stay.messaging[b.key]);
          if (!text) return null;
          return (
            <Flat key={b.key} style={{ padding: 14, gap: 8 }}>
              <Row gap={8} style={{ alignItems: "center" }}>
                <Icon n={b.icon} s={18} c={t.palette.accent} />
                <Txt v="title">{b.titel}</Txt>
              </Row>
              <Txt v="body" soft>
                {text}
              </Txt>
            </Flat>
          );
        })}

        {hinweis && (
          <Txt v="sm" soft>
            {hinweis}
          </Txt>
        )}

        {stay.checked_in_at ? (
          <Txt v="sm" accent style={{ textAlign: "center" }}>
            Eingecheckt am {formatTag(stay.checked_in_at)}
          </Txt>
        ) : stay.self_checkin ? (
          <Btn variant="primary" block icon="check" onPress={einchecken}>
            {busy ? "Wird gesendet …" : "Ich bin angekommen"}
          </Btn>
        ) : (
          <Txt v="xs" soft style={{ textAlign: "center" }}>
            Der Check-in erfolgt vor Ort beim Gastgeber.
          </Txt>
        )}
      </ScrollView>
    </View>
  );
}

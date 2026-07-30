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
import { Linking, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, type IconName } from "@/components/ui/Icon";
import { Btn, Col, Row, Spinner, Txt } from "@/components/ui/kit";
import { EmptyState } from "@/components/ui/patterns";
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
        <Row style={{ paddingHorizontal: 12, paddingVertical: 8 }}>
          <ZurueckKnopf onPress={() => navigation.goBack()} />
        </Row>
        {fehler ? <EmptyState icon="info" titel="Nicht geladen" text={fehler} /> : <Spinner />}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
      <Row style={{ paddingHorizontal: 12, paddingVertical: 8 }}>
        <ZurueckKnopf onPress={() => navigation.goBack()} />
      </Row>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 44, gap: 24 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
      >
        <Col gap={6}>
          <Txt v="display">Check-in</Txt>
          <Txt v="body" soft>
            {stay.property_title}
          </Txt>
          <Txt v="sm" soft>
            {formatZeitraum(stay.check_in, stay.check_out) ||
              `${stay.check_in} – ${stay.check_out}`}
          </Txt>
        </Col>

        {/* Türcode: echter Code ODER der Grund des Servers — nie beides erfunden. */}
        <Col
          gap={10}
          style={{
            alignItems: "center",
            paddingVertical: 28,
            paddingHorizontal: 20,
            borderRadius: 18,
            backgroundColor: t.palette.ink,
          }}
        >
          <Icon n="key" s={24} sw={1.8} c={t.palette.bg} />
          <Txt v="xs" color={t.palette.bg} style={{ opacity: 0.7, letterSpacing: 1.4 }}>
            TÜRCODE
          </Txt>
          {stay.door_code ? (
            <Txt
              color={t.palette.bg}
              style={{ fontFamily: t.fonts.extrabold, fontSize: 42, letterSpacing: 6 }}
            >
              {stay.door_code}
            </Txt>
          ) : (
            <Txt v="sm" color={t.palette.bg} style={{ opacity: 0.8, textAlign: "center" }}>
              {stay.door_code_hidden_reason ?? "Noch nicht freigegeben."}
            </Txt>
          )}
        </Col>

        {stay.property_address && (
          <>
            <Trennlinie />
            <Row gap={14}>
              <Icon n="pin" s={22} sw={1.7} c={t.palette.ink} />
              <Txt v="body" style={{ flex: 1 }}>
                {stay.property_address}
              </Txt>
            </Row>
          </>
        )}

        {/* Kontakt: nur echte Nummern, per Tap wählbar. */}
        {(stay.contact_phone || stay.maintenance_phone) && (
          <>
            <Trennlinie />
            <Col gap={14}>
              <Txt v="h2">Kontakt</Txt>
              {stay.contact_phone && (
                <Row style={{ justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <Txt v="body" soft style={{ flexShrink: 1 }}>
                    {stay.contact_name ?? "Gastgeber"}
                  </Txt>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => Linking.openURL(`tel:${stay.contact_phone}`)}
                    style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                  >
                    <Txt v="body" style={{ textDecorationLine: "underline" }}>
                      {stay.contact_phone}
                    </Txt>
                  </Pressable>
                </Row>
              )}
              {stay.maintenance_phone && (
                <Row style={{ justifyContent: "space-between", alignItems: "center", gap: 12 }}>
                  <Txt v="body" soft style={{ flexShrink: 1 }}>
                    Technischer Notdienst
                  </Txt>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => Linking.openURL(`tel:${stay.maintenance_phone}`)}
                    style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                  >
                    <Txt v="body" style={{ textDecorationLine: "underline" }}>
                      {stay.maintenance_phone}
                    </Txt>
                  </Pressable>
                </Row>
              )}
            </Col>
          </>
        )}

        {/* Info-Blöcke der Gastmappe (Plaintext, serverseitig auf bekannte Keys
            gefiltert — hier wird kein HTML gerendert, Wurzel 8). */}
        {BLOECKE.map((b) => {
          const text = localized(stay.messaging[b.key]);
          if (!text) return null;
          return (
            <View key={b.key}>
              <Trennlinie />
              <Col gap={10} style={{ paddingTop: 24 }}>
                <Row gap={10}>
                  <Icon n={b.icon} s={20} sw={1.7} c={t.palette.ink} />
                  <Txt v="h2">{b.titel}</Txt>
                </Row>
                <Txt v="body" soft>
                  {text}
                </Txt>
              </Col>
            </View>
          );
        })}

        {hinweis && (
          <Txt v="sm" soft>
            {hinweis}
          </Txt>
        )}

        {stay.checked_in_at ? (
          <Txt v="sm" soft style={{ textAlign: "center" }}>
            Eingecheckt am {formatTag(stay.checked_in_at)}
          </Txt>
        ) : stay.self_checkin ? (
          <Btn variant="dark" block onPress={einchecken}>
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

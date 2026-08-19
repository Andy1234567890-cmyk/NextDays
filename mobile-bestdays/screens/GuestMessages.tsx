// Nachrichten des Gasts mit seinem Gastgeber (myBestDays).
//
// ZWEI WEGE HINEIN, ein Screen:
//   * OHNE Parameter — die Liste aller Verläufe, erreichbar aus dem Profil. Ohne
//     sie findet man eine Antwort des Gastgebers nur, wenn man zufällig die
//     richtige Buchung öffnet.
//   * MIT `reservationId` — direkt der Verlauf zu dieser Buchung, aufgerufen aus
//     dem Buchungsdetail. Der Thread wird dabei per `createGuestThread` geholt:
//     der Endpunkt ist idempotent, ein vorhandener kommt zurück (Wurzel 2).
//     Deshalb braucht es hier kein „gibt es schon einen?"-Vorabruf.
//
// DAS IST NICHT DER POSTEINGANG DES BETRIEBS. Der liest im PMS OTA-Verläufe
// (`inbox`); hier läuft der Chat zu einer myBestDays-Buchung über
// `guest_messages` — eigene Tabelle, eigene Auth-Welt (Gast-JWT).
import {
  useNavigation,
  useRoute,
  type RouteProp,
} from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/Icon";
import { Badge, Col, Divider, Row, Spinner, Txt } from "@/components/ui/kit";
import { EmptyState } from "@/components/ui/patterns";
import {
  createGuestThread,
  getGuestThread,
  listGuestThreads,
  sendGuestMessage,
  type GuestMessage,
  type GuestThread,
} from "@/lib/guestMessages";
import type { RootStackParamList } from "@/navigation/types";
import { useTheme } from "@/theme/ThemeProvider";

/** Datum einer Nachricht, kurz. */
function zeit(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const heute = new Date();
  const gleicherTag = d.toDateString() === heute.toDateString();
  return gleicherTag
    ? d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
}

export default function GuestMessages() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "GuestMessages">>();
  const reservationId = route.params?.reservationId ?? null;

  const [threads, setThreads] = useState<GuestThread[] | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<GuestMessage[] | null>(null);
  const [titel, setTitel] = useState<string | null>(null);
  const [entwurf, setEntwurf] = useState("");
  const [sendet, setSendet] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const verlauf = useRef<ScrollView>(null);

  // --- Liste ----------------------------------------------------------------
  const listeLaden = useCallback(async () => {
    const res = await listGuestThreads();
    if (!res.ok) {
      setThreads([]);
      setFehler(res.error);
      return;
    }
    setThreads(res.data.threads);
  }, []);

  // --- Verlauf --------------------------------------------------------------
  // Bewusst NUR beim Öffnen: `getGuestThread` markiert die Nachrichten des
  // Gastgebers als gelesen. Vorzuladen hiesse, etwas als gelesen zu melden, das
  // niemand gesehen hat.
  const verlaufLaden = useCallback(async (id: string) => {
    const res = await getGuestThread(id);
    if (!res.ok) {
      setFehler(res.error);
      return;
    }
    setMessages(res.data.messages);
  }, []);

  useEffect(() => {
    if (reservationId) {
      // Direkter Einstieg aus der Buchung: Thread holen bzw. anlegen.
      (async () => {
        const res = await createGuestThread(reservationId);
        if (!res.ok) {
          setFehler(res.error);
          setMessages([]);
          return;
        }
        setThreadId(res.data.id);
        setMessages(res.data.messages);
      })();
      return;
    }
    listeLaden();
  }, [reservationId, listeLaden]);

  const oeffnen = (th: GuestThread) => {
    setThreadId(th.id);
    setTitel(th.property_title ?? null);
    setMessages(null);
    verlaufLaden(th.id);
  };

  const senden = async () => {
    const text = entwurf.trim();
    if (!text || sendet || !threadId) return;
    setSendet(true);
    setEntwurf("");
    const res = await sendGuestMessage(threadId, text);
    setSendet(false);
    if (!res.ok) {
      // Entwurf zurückgeben statt ihn zu verlieren — er ist die Arbeit des
      // Gastes, nicht unsere.
      setEntwurf(text);
      setFehler(res.error);
      return;
    }
    setMessages((prev) => [...(prev ?? []), res.data]);
  };

  // --- Ansicht: Verlauf -----------------------------------------------------
  if (threadId || reservationId) {
    return (
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: t.palette.bg }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Row
          style={{
            paddingTop: insets.top + 8,
            paddingHorizontal: 12,
            paddingBottom: 10,
            gap: 6,
            alignItems: "center",
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Zurück"
            onPress={() => {
              // Aus der Buchung gekommen: zurück dorthin. Aus der Liste: zurück
              // in die Liste, ohne den Screen zu verlassen.
              if (reservationId) navigation.goBack();
              else {
                setThreadId(null);
                setMessages(null);
                listeLaden();
              }
            }}
            hitSlop={10}
            style={({ pressed }) => ({ padding: 8, opacity: pressed ? 0.6 : 1 })}
          >
            <Icon n="back" s={22} sw={2} c={t.palette.ink} />
          </Pressable>
          <Col style={{ flex: 1 }}>
            <Txt v="title" numberOfLines={1}>
              {titel ?? "Gastgeber"}
            </Txt>
            <Txt v="xs" soft>
              Antwort kommt vom Gastgeber deiner Buchung
            </Txt>
          </Col>
        </Row>

        {!messages && <Spinner />}
        <ScrollView
          ref={verlauf}
          contentContainerStyle={{ padding: 16, gap: 10 }}
          onContentSizeChange={() =>
            verlauf.current?.scrollToEnd({ animated: false })
          }
        >
          {messages?.length === 0 && (
            <Txt v="sm" soft style={{ textAlign: "center", marginTop: 24 }}>
              Noch keine Nachrichten. Schreib deinem Gastgeber.
            </Txt>
          )}
          {messages?.map((m) => {
            const meine = m.sender === "guest";
            return (
              <View
                key={m.id}
                style={{
                  alignSelf: meine ? "flex-end" : "flex-start",
                  maxWidth: "82%",
                }}
              >
                <View
                  style={{
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    borderRadius: 20,
                    borderBottomRightRadius: meine ? 6 : 20,
                    borderBottomLeftRadius: meine ? 20 : 6,
                    backgroundColor: meine
                      ? t.palette.ink
                      : t.palette.surface2,
                  }}
                >
                  <Txt v="body" color={meine ? t.palette.bg : t.palette.ink}>
                    {m.body}
                  </Txt>
                </View>
                <Txt
                  v="xs"
                  soft
                  style={{
                    marginTop: 4,
                    textAlign: meine ? "right" : "left",
                  }}
                >
                  {zeit(m.created_at)}
                </Txt>
              </View>
            );
          })}
        </ScrollView>

        {fehler && (
          <Pressable onPress={() => setFehler(null)} style={{ padding: 12 }}>
            <Txt v="xs" color={t.palette.accent}>
              {fehler}
            </Txt>
          </Pressable>
        )}

        <Row
          style={{
            padding: 12,
            paddingBottom: insets.bottom + 8,
            gap: 8,
            alignItems: "flex-end",
            borderTopWidth: 1,
            borderTopColor: t.palette.line,
            backgroundColor: t.palette.surface,
          }}
        >
          <TextInput
            style={{
              flex: 1,
              backgroundColor: t.palette.bg,
              borderRadius: 20,
              paddingHorizontal: 16,
              paddingVertical: 10,
              fontSize: 15,
              color: t.palette.ink,
              maxHeight: 120,
            }}
            placeholder="Nachricht schreiben …"
            placeholderTextColor={t.palette.faint}
            value={entwurf}
            onChangeText={setEntwurf}
            multiline
            editable={!sendet}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Senden"
            onPress={senden}
            disabled={sendet || !entwurf.trim()}
            style={{
              width: 42,
              height: 42,
              borderRadius: 999,
              backgroundColor: entwurf.trim()
                ? t.palette.ink
                : t.palette.surface2,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon
              n="send"
              s={20}
              c={entwurf.trim() ? t.palette.bg : t.palette.faint}
            />
          </Pressable>
        </Row>
      </KeyboardAvoidingView>
    );
  }

  // --- Ansicht: Liste -------------------------------------------------------
  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
      <Row
        style={{
          paddingHorizontal: 12,
          paddingTop: 8,
          paddingBottom: 6,
          gap: 6,
          alignItems: "center",
        }}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Zurück"
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={({ pressed }) => ({ padding: 8, opacity: pressed ? 0.6 : 1 })}
        >
          <Icon n="back" s={22} sw={2} c={t.palette.ink} />
        </Pressable>
        <Txt v="display">Nachrichten</Txt>
      </Row>

      {!threads && <Spinner />}
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + 32,
        }}
        refreshControl={
          <RefreshControl refreshing={false} onRefresh={listeLaden} />
        }
      >
        {threads?.length === 0 && (
          <EmptyState
            icon="chat"
            titel="Keine Nachrichten"
            text="Sobald du eine Buchung hast, kannst du deinem Gastgeber hier schreiben."
          />
        )}
        {threads?.map((th, i) => (
          <View key={th.id}>
            {i > 0 && <Divider />}
            <Pressable
              onPress={() => oeffnen(th)}
              style={({ pressed }) => ({
                paddingVertical: 16,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Row style={{ gap: 12, alignItems: "center" }}>
                <Col style={{ flex: 1 }}>
                  <Txt v="title" numberOfLines={1}>
                    {th.property_title ?? "Buchung"}
                  </Txt>
                  <Txt v="xs" soft>
                    {th.check_in && th.check_out
                      ? `${th.check_in} – ${th.check_out}`
                      : "Zeitraum unbekannt"}
                  </Txt>
                </Col>
                <Col style={{ alignItems: "flex-end", gap: 4 }}>
                  <Txt v="xs" soft>
                    {zeit(th.last_message_at)}
                  </Txt>
                  {/* Ungelesen zählt NUR Nachrichten des Gastgebers — die
                      eigenen hat man ja gelesen. */}
                  {th.unread_count > 0 && <Badge>{th.unread_count}</Badge>}
                </Col>
              </Row>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

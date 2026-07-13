// Gastgeber · Posteingang. Echte Threads + Chat über /api/v1/inbox. Antworten
// werden optimistisch angezeigt und bei Fehler zurückgerollt. Realtime: die
// Liste abonniert channex_booking + whatsapp_conversation, der offene Thread
// sandbox_message + inbox_thread_note (dieselben speisenden Tabellen wie der
// Web-Inbox, apps/web/components/inbox/inbox-list.tsx). Cleanup bei unmount
// übernimmt useRealtime.
import type { RouteProp } from "@react-navigation/native";
import { useRoute } from "@react-navigation/native";
import { useCallback, useEffect, useState } from "react";
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
import { Avatar, Card, Chip, Col, Divider, IconBtn, Row, Spinner, Txt } from "@/components/ui/kit";
import {
  getInboxMessages,
  listInboxThreads,
  sendInboxMessage,
  type InboxMessage,
  type InboxThread,
} from "@/lib/inbox";
import { useRealtime } from "@/lib/realtime";
import type { HostTabParamList } from "@/navigation/types";
import { useTheme } from "@/theme/ThemeProvider";

export default function HostInbox() {
  // Deep-Link nextdays://host/inbox/:threadId → diesen Thread vorauswählen.
  const route = useRoute<RouteProp<HostTabParamList, "HostInbox">>();
  const linkedThreadId = route.params?.threadId ?? null;
  const [openThread, setOpenThread] = useState<InboxThread | null>(null);

  if (openThread) {
    return <ThreadView thread={openThread} onBack={() => setOpenThread(null)} />;
  }
  return <ThreadList onOpen={setOpenThread} autoOpenId={linkedThreadId} />;
}

// --- Thread-Liste ---

function ThreadList({
  onOpen,
  autoOpenId,
}: {
  onOpen: (t: InboxThread) => void;
  autoOpenId: string | null;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [threads, setThreads] = useState<InboxThread[] | null>(null);
  // Deep-Link nur EINMAL öffnen (nicht bei jedem Realtime-Reload erneut).
  const [autoOpened, setAutoOpened] = useState(false);

  const load = useCallback(async () => {
    const res = await listInboxThreads();
    setThreads(res.ok ? res.data.items : []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Verlinkten Thread öffnen, sobald die Liste geladen ist.
  useEffect(() => {
    if (autoOpened || !autoOpenId || !threads) return;
    const match = threads.find((th) => th.id === autoOpenId);
    if (match) {
      setAutoOpened(true);
      onOpen(match);
    }
  }, [autoOpened, autoOpenId, threads, onOpen]);

  // Speisende Tabellen der Liste (wie Web): neue/aktualisierte Konversationen.
  useRealtime({ table: "channex_booking", onChange: load });
  useRealtime({ table: "whatsapp_conversation", onChange: load });

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
      <Col style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12 }}>
        <Txt v="h1">Posteingang</Txt>
      </Col>

      {!threads && <Spinner />}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
      >
        {threads && threads.length === 0 && (
          <Txt v="sm" soft style={{ textAlign: "center", marginTop: 40 }}>
            Keine Konversationen.
          </Txt>
        )}
        {threads?.map((thread, i) => (
          <View key={thread.id}>
            {i > 0 && <Divider style={{ marginHorizontal: 4 }} />}
            <Pressable onPress={() => onOpen(thread)}>
              <Row style={{ paddingVertical: 12, paddingHorizontal: 4, gap: 12, alignItems: "flex-start" }}>
                <Avatar s={48} icon="user" />
                <Col gap={3} style={{ flex: 1 }}>
                  <Row style={{ justifyContent: "space-between" }}>
                    <Txt v="sm" style={{ fontFamily: t.type.bold.fontFamily }} numberOfLines={1}>
                      {thread.guest_name || "Gast"}
                    </Txt>
                    <Txt v="xs" soft>
                      {thread.updated_at ? new Date(thread.updated_at).toLocaleDateString("de-DE") : ""}
                    </Txt>
                  </Row>
                  <Txt v="sm" soft={thread.is_read} numberOfLines={1}>
                    {thread.last_message ?? "—"}
                  </Txt>
                  <Row style={{ justifyContent: "space-between", marginTop: 2, alignItems: "center" }}>
                    {thread.ota_name ? <Chip variant="ghost">{thread.ota_name}</Chip> : <View />}
                    {!thread.is_read && (
                      <View style={{ width: 9, height: 9, borderRadius: 999, backgroundColor: t.palette.accent }} />
                    )}
                  </Row>
                </Col>
              </Row>
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// --- Chat eines Threads ---

// Optimistische Nachricht bekommt eine temporäre negative Kennung, damit der
// Rollback sie eindeutig entfernen kann.
let tempSeq = 0;

function ThreadView({ thread, onBack }: { thread: InboxThread; onBack: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<InboxMessage[] | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    const res = await getInboxMessages(thread.id);
    setMessages(res.ok ? res.data.items : []);
  }, [thread.id]);

  useEffect(() => {
    load();
  }, [load]);

  // Offener Thread live (wie Web): neue Nachrichten + Notizen.
  useRealtime({ table: "sandbox_message", filter: `thread_id=eq.${thread.id}`, onChange: load });
  useRealtime({ table: "inbox_thread_note", filter: `thread_id=eq.${thread.id}`, onChange: load });

  const send = async () => {
    const text = draft.trim();
    if (!text || sending) return; // Doppel-Tap-Sperre (Wurzel 2)
    setSending(true);

    // Optimistisch anhängen (temporäre id).
    const tempId = `temp-${--tempSeq}`;
    const optimistic: InboxMessage = {
      id: tempId,
      message: text,
      sender: "property",
      sent_at: new Date().toISOString(),
    };
    setMessages((prev) => [...(prev ?? []), optimistic]);
    setDraft("");

    const res = await sendInboxMessage(thread.id, text);
    setSending(false);
    if (res.ok) {
      // Temp durch die echte Nachricht ersetzen (Realtime lädt ohnehin nach).
      setMessages((prev) =>
        (prev ?? []).map((m) => (m.id === tempId ? res.data : m)),
      );
    } else {
      // Rollback: optimistische Nachricht entfernen, Entwurf wiederherstellen.
      setMessages((prev) => (prev ?? []).filter((m) => m.id !== tempId));
      setDraft(text);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.palette.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Row style={{ paddingTop: insets.top + 8, paddingHorizontal: 16, paddingBottom: 8, gap: 10, alignItems: "center" }}>
        <IconBtn icon="back" onPress={onBack} />
        <Col style={{ flex: 1 }}>
          <Txt v="title" numberOfLines={1}>
            {thread.guest_name || "Gast"}
          </Txt>
          {thread.property_title && (
            <Txt v="xs" soft numberOfLines={1}>
              {thread.property_title}
            </Txt>
          )}
        </Col>
      </Row>

      {!messages && <Spinner />}
      <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }}>
        {messages?.map((m, i) => {
          const mine = m.sender === "property";
          const note = m.sender === "note";
          return (
            <View
              key={m.id ?? `i${i}`}
              style={{
                alignSelf: mine ? "flex-end" : "flex-start",
                maxWidth: "82%",
              }}
            >
              <Card
                style={{
                  padding: 12,
                  backgroundColor: note
                    ? t.palette.accentSoft
                    : mine
                      ? t.palette.accent
                      : t.palette.surface2,
                }}
              >
                <Txt v="sm" color={mine && !note ? "#fff" : t.palette.ink}>
                  {m.message}
                </Txt>
              </Card>
            </View>
          );
        })}
      </ScrollView>

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
          placeholder="Antwort schreiben …"
          placeholderTextColor={t.palette.faint}
          value={draft}
          onChangeText={setDraft}
          multiline
          editable={!sending}
        />
        <Pressable
          onPress={send}
          disabled={sending || !draft.trim()}
          style={{
            width: 42,
            height: 42,
            borderRadius: 999,
            backgroundColor: t.palette.accent,
            alignItems: "center",
            justifyContent: "center",
            opacity: sending || !draft.trim() ? 0.5 : 1,
          }}
        >
          <Icon n="send" s={20} c="#fff" />
        </Pressable>
      </Row>
    </KeyboardAvoidingView>
  );
}

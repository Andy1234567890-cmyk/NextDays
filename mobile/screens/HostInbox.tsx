// Gastgeber · Posteingang. Echte Threads + Chat über /api/v1/inbox. Antworten
// werden optimistisch angezeigt und bei Fehler zurückgerollt. Realtime: die
// Liste abonniert channex_booking + whatsapp_conversation, der offene Thread
// sandbox_message + inbox_thread_note (dieselben speisenden Tabellen wie der
// Web-Inbox, apps/web/components/inbox/inbox-list.tsx). Cleanup bei unmount
// übernimmt useRealtime.
import type { RouteProp } from "@react-navigation/native";
import { useRoute } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { Chip, Col, Row, Spinner, Txt } from "@/components/ui/kit";
import { EmptyState } from "@/components/ui/patterns";
import { channelMeta } from "@/lib/calendar-channels";
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

  const [query, setQuery] = useState("");
  const [readFilter, setReadFilter] = useState<"all" | "unread">("all");
  const [channelFilter, setChannelFilter] = useState<string | "all">("all");

  const channels = useMemo(() => {
    const set = new Set<string>();
    for (const th of threads ?? []) if (th.ota_name) set.add(th.ota_name);
    return [...set];
  }, [threads]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (threads ?? []).filter((th) => {
      if (readFilter === "unread" && th.is_read) return false;
      if (channelFilter !== "all" && th.ota_name !== channelFilter) return false;
      if (q) {
        const hay = `${th.guest_name ?? ""} ${th.property_title ?? ""} ${th.ota_reservation_code ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [threads, query, readFilter, channelFilter]);

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
      <Col style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 14, gap: 16 }}>
        <Txt v="display">Nachrichten</Txt>

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

        {/* Filter-Chips: Kanal + Konversationsstatus */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Row gap={8} style={{ paddingRight: 20 }}>
            <FilterChip label="Alle Kanäle" active={channelFilter === "all"} onPress={() => setChannelFilter("all")} />
            {channels.map((c) => (
              <FilterChip
                key={c}
                label={c}
                active={channelFilter === c}
                onPress={() => setChannelFilter((v) => (v === c ? "all" : c))}
              />
            ))}
            <FilterChip label="Alle" active={readFilter === "all"} onPress={() => setReadFilter("all")} />
            <FilterChip label="Ungelesen" active={readFilter === "unread"} onPress={() => setReadFilter("unread")} />
          </Row>
        </ScrollView>
      </Col>

      {!threads && <Spinner />}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: insets.bottom + 32 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
        showsVerticalScrollIndicator={false}
      >
        {threads && visible.length === 0 && (
          <EmptyState
            icon="chat"
            titel="Keine Konversationen"
            text="Für diese Filter liegt gerade nichts vor."
          />
        )}
        {visible.map((thread, i) => (
          <View key={thread.id}>
            {i > 0 && <View style={{ height: 1, backgroundColor: t.palette.line }} />}
            <ThreadRow thread={thread} onPress={() => onOpen(thread)} />
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

// Relative Zeit „vor X" aus einem ISO-Timestamp (echte Daten, kein Mock).
function relTime(iso: string | null): string {
  if (!iso) return "";
  const then = new Date(iso).getTime();
  const diff = Date.now() - then;
  const min = Math.round(diff / 60000);
  if (min < 1) return "gerade eben";
  if (min < 60) return `vor ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `vor ${h} Std.`;
  const d = Math.round(h / 24);
  if (d < 7) return `vor ${d} Tg.`;
  return new Date(iso).toLocaleDateString("de-DE");
}

function fmtShortDate(iso: string | null): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${Number(d)}.${m}.${y}`;
}

// ota_name (Freitext) → Kanal-Key für die Badge-Farbe. Unbekannt → Direkt.
function channelKeyOf(ota: string | null): "direct" | "portal" | "booking" | "airbnb" | "vrbo" {
  const s = (ota ?? "").toLowerCase();
  if (s.includes("booking")) return "booking";
  if (s.includes("airbnb")) return "airbnb";
  if (s.includes("vrbo") || s.includes("expedia")) return "vrbo";
  if (s.includes("mynextdays") || s.includes("nextdays")) return "portal";
  return "direct";
}

const STATUS_LABEL: Record<string, string> = {
  confirmed: "Bestätigt",
  pending: "Angefragt",
  cancelled: "Storniert",
  completed: "Abgeschlossen",
};

function initials(name: string | null): string {
  return (name ?? "—")
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// Deterministische Avatar-Tönung aus dem Namen (feste Palette, kein Zufall).
const AVATAR_TINTS = ["#FCE3C6", "#DCE6F5", "#F7D6DA", "#D8ECD9", "#EADBF6", "#F5E5C8"];
function tintOf(name: string | null): string {
  const s = name ?? "";
  let h = 0;
  for (let i = 0; i < s.length; i += 1) h = (h + s.charCodeAt(i)) % AVATAR_TINTS.length;
  return AVATAR_TINTS[h];
}

function ThreadRow({ thread, onPress }: { thread: InboxThread; onPress: () => void }) {
  const t = useTheme();
  const ch = channelMeta(channelKeyOf(thread.ota_name));
  const statusLabel = thread.status ? STATUS_LABEL[thread.status] ?? thread.status : null;

  return (
    <Pressable onPress={onPress}>
      <Row style={{ paddingVertical: 12, paddingHorizontal: 4, gap: 12, alignItems: "flex-start" }}>
        {/* Avatar mit Initialen + Kanal-Badge unten rechts. */}
        <View style={{ width: 52, height: 52 }}>
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: tintOf(thread.guest_name),
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Txt v="sm" style={{ fontFamily: t.type.bold.fontFamily }} color={t.palette.ink}>
              {initials(thread.guest_name)}
            </Txt>
          </View>
          <View
            style={{
              position: "absolute",
              right: -2,
              bottom: -2,
              width: 22,
              height: 22,
              borderRadius: 11,
              backgroundColor: ch.bar,
              alignItems: "center",
              justifyContent: "center",
              borderWidth: 2,
              borderColor: t.palette.bg,
            }}
          >
            <Txt v="xs" color={ch.text} style={{ fontFamily: t.type.bold.fontFamily, fontSize: 10 }}>
              {ch.label.slice(0, 1)}
            </Txt>
          </View>
        </View>

        <Col gap={2} style={{ flex: 1 }}>
          <Row style={{ justifyContent: "space-between", alignItems: "center" }}>
            <Row gap={7} style={{ flex: 1, alignItems: "center" }}>
              <Txt v="sm" style={{ fontFamily: t.type.bold.fontFamily }} numberOfLines={1}>
                {thread.guest_name || "Gast"}
              </Txt>
              {statusLabel && (
                <Chip variant={thread.status === "confirmed" ? "accent" : "ghost"}>{statusLabel}</Chip>
              )}
            </Row>
            <Txt v="xs" soft>{relTime(thread.updated_at)}</Txt>
          </Row>

          {(thread.property_title || thread.arrival_date) && (
            <Txt v="xs" soft numberOfLines={1}>
              {thread.property_title ?? ""}
              {thread.property_title && thread.arrival_date ? "  ·  " : ""}
              {fmtShortDate(thread.arrival_date)}
            </Txt>
          )}

          <Row style={{ justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
            <Txt v="sm" soft={thread.is_read} numberOfLines={2} style={{ flex: 1 }}>
              {thread.last_message ?? "—"}
            </Txt>
            {!thread.is_read && (
              <View style={{ width: 9, height: 9, borderRadius: 999, marginTop: 5, backgroundColor: t.palette.accent }} />
            )}
          </Row>
        </Col>
      </Row>
    </Pressable>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
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
      <Row style={{ paddingTop: insets.top + 8, paddingHorizontal: 12, paddingBottom: 10, gap: 6, alignItems: "center" }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Zurück"
          onPress={onBack}
          hitSlop={10}
          style={({ pressed }) => ({ padding: 8, opacity: pressed ? 0.6 : 1 })}
        >
          <Icon n="back" s={22} sw={2} c={t.palette.ink} />
        </Pressable>
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
              <View
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 12,
                  // Blase: eigene Nachricht dunkel, fremde hell, Notiz getönt.
                  borderRadius: 20,
                  borderBottomRightRadius: mine && !note ? 6 : 20,
                  borderBottomLeftRadius: !mine && !note ? 6 : 20,
                  backgroundColor: note
                    ? t.palette.accentSoft
                    : mine
                      ? t.palette.ink
                      : t.palette.surface2,
                }}
              >
                <Txt v="body" color={mine && !note ? t.palette.bg : t.palette.ink}>
                  {m.message}
                </Txt>
              </View>
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

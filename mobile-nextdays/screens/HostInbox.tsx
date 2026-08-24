// Gastgeber · Posteingang. Echte Threads + Chat über /api/v1/inbox. Antworten
// werden optimistisch angezeigt und bei Fehler zurückgerollt. Kein Realtime
// mehr: alle speisenden Tabellen des Posteingangs (channex_booking,
// whatsapp_conversation, inbox_thread_note) sind seit Migration 0337 für
// `authenticated` gesperrt (Wurzel 6) — Begründung jeweils an der Stelle der
// ehemaligen Abos. Aktualisiert wird beim Öffnen, beim Senden und per
// Zug-zum-Aktualisieren.
import type { RouteProp } from "@react-navigation/native";
import { useRoute } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DemoBand } from "@/components/DemoBand";
import { ZeitWahl, type ZeitOption } from "@/components/dashboard/ZeitWahl";
import { BuchungsPanel } from "@/components/buchung/BuchungsPanel";
import { AnfrageKarte } from "@/components/inbox/AnfrageKarte";
import {
  aktiveFilter,
  FilterSheet,
  LEER_FILTER,
  type InboxFilter,
} from "@/components/inbox/FilterSheet";
import { VerwaltenSheet } from "@/components/inbox/VerwaltenSheet";
import { AntwortWerkzeuge } from "@/components/inbox/AntwortWerkzeuge";
import { VorgangSheet } from "@/components/inbox/VorgangSheet";
import { Icon } from "@/components/ui/Icon";
import { Chip, Col, Row, Spinner, Txt } from "@/components/ui/kit";
import { EmptyState } from "@/components/ui/patterns";
import { useAuth } from "@/contexts/AuthContext";
import { channelMeta } from "@/lib/calendar-channels";
import { inboxAccessFor } from "@/lib/inbox-access";
import { heuteIso } from "@/lib/kalendertag";
import { portalLabel } from "@/lib/portal-logos";
import {
  getAnfrage,
  getInboxMessages,
  istAnfrageThread,
  listInboxThreads,
  markInboxThreadRead,
  nachAktivitaet,
  NUR_ANHANG_TEXT,
  sendInboxMessage,
  type AnfrageDetail,
  translateText,
  type InboxMessage,
  type InboxThread,
} from "@/lib/inbox";
import type { ReservationChannel } from "@/lib/reservations";
import type { HostTabParamList } from "@/navigation/types";
import { useUnterkante } from "@/lib/unterkante";
import { useTheme } from "@/theme/ThemeProvider";

export default function HostInbox() {
  // Deep-Link mynextdays://inbox/:threadId → diesen Thread vorauswählen.
  const route = useRoute<RouteProp<HostTabParamList, "HostInbox">>();
  const linkedThreadId = route.params?.threadId ?? null;
  const [openThread, setOpenThread] = useState<InboxThread | null>(null);

  if (openThread) {
    return <ThreadView thread={openThread} onBack={() => setOpenThread(null)} />;
  }
  return <ThreadList onOpen={setOpenThread} autoOpenId={linkedThreadId} />;
}

// --- Thread-Liste ---

// Die drei Ansichten des Posteingangs. Getrennte MENGEN des Servers, keine
// Filter: der Parameter `status` entscheidet, was überhaupt geliefert wird.
const ANSICHTEN: ZeitOption<"active" | "archived" | "trashed">[] = [
  { wert: "active", label: "Posteingang", lang: "Posteingang" },
  { wert: "archived", label: "Archiv", lang: "Archiv" },
  { wert: "trashed", label: "Papierkorb", lang: "Papierkorb" },
];

function ThreadList({
  onOpen,
  autoOpenId,
}: {
  onOpen: (t: InboxThread) => void;
  autoOpenId: string | null;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  // Die LISTE liegt im Tab-Erlebnis: unten muss die Tab-Leiste frei bleiben
  // (lib/unterkante). Die Thread-Ansicht darunter hat ihre eigene Eingabezeile
  // am Rand und rechnet weiter mit der Systemleiste.
  const unterkante = useUnterkante();
  const [threads, setThreads] = useState<InboxThread[] | null>(null);
  // Deep-Link nur EINMAL öffnen (nicht bei jedem Realtime-Reload erneut).
  const [autoOpened, setAutoOpened] = useState(false);
  // Die drei Ansichten des Web-Posteingangs. Der Server filtert (Parameter
  // `status`), nicht die App: Archiv und Papierkorb sind eigene Mengen, und sie
  // clientseitig aus der aktiven Liste zu schneiden würde Threads zeigen, die
  // der Server gar nicht geliefert hat.
  const [ansicht, setAnsicht] = useState<"active" | "archived" | "trashed">(
    "active",
  );
  // Ein Objekt statt fünf Einzelwerten: das Sheet bekommt und setzt es als
  // Ganzes, „Zurücksetzen" ist damit eine Zuweisung und keine Aufzählung.
  const [filter, setFilter] = useState<InboxFilter>(LEER_FILTER);
  const [filterOffen, setFilterOffen] = useState(false);
  const [verwaltenOffen, setVerwaltenOffen] = useState(false);
  const { me } = useAuth();
  // Verwalten hängt an `inbox_manage_config` — wer es nicht hat, sieht den
  // Zugang gar nicht (nicht ausgegraut: ein Knopf, der nie geht, ist Ballast).
  const access = useMemo(() => inboxAccessFor(me), [me]);

  const load = useCallback(async () => {
    const res = await listInboxThreads({ status: ansicht });
    setThreads(res.ok ? res.data.items : []);
  }, [ansicht]);

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

  // Kein Realtime auf der Liste. `channex_booking` und `whatsapp_conversation`
  // sind seit Migration 0337 für `authenticated` gesperrt (Wurzel 6: revoke +
  // raus aus der Publikation supabase_realtime) — die Abos verbanden sauber und
  // bekamen nie ein Event. Eine Ersatzquelle gibt es nicht: eine neue
  // Konversation entsteht aus dem Channex-/WhatsApp-Feed und schlägt sich in
  // keiner offenen Tabelle nieder (`reservations` trägt die Buchung, nicht den
  // Nachrichtenstand). Ehrlich: ein neuer Thread und eine eingehende Nachricht
  // heben die Liste nicht mehr von selbst an — sichtbar erst beim Öffnen des
  // Tabs oder per Zug-zum-Aktualisieren (RefreshControl).

  const [query, setQuery] = useState("");

  const channels = useMemo(() => {
    const set = new Set<string>();
    for (const th of threads ?? []) if (th.ota_name) set.add(th.ota_name);
    return [...set];
  }, [threads]);

  const gesetzteFilter = aktiveFilter(filter);
  // Was gerade gilt, als kurzer Text neben dem Knopf. Nur die eingrenzenden
  // Angaben, nicht die Sortierung — sie schränkt nichts ein.
  const filterText = useMemo(() => {
    const teile: string[] = [];
    if (filter.kanal !== "all") teile.push(portalLabel(filter.kanal));
    if (filter.lesestand === "unread") teile.push("ungelesen");
    if (filter.nurZugewiesen) teile.push("zugewiesen");
    if (filter.nurFavoriten) teile.push("Favoriten");
    return teile.join(" · ");
  }, [filter]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const gefiltert = (threads ?? []).filter((th) => {
      if (filter.lesestand === "unread" && th.is_read) return false;
      if (filter.kanal !== "all" && th.ota_name !== filter.kanal) return false;
      if (filter.nurZugewiesen && !th.assigned_user_id) return false;
      if (filter.nurFavoriten && !th.is_starred) return false;
      if (q) {
        const hay = `${th.guest_name ?? ""} ${th.property_title ?? ""} ${th.ota_reservation_code ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    // Kopie sortieren, nie die Zustandsliste selbst (`sort` mutiert).
    return [...gefiltert].sort((a, b) => {
      if (filter.sortierung === "anreise") {
        // Ohne Anreisedatum nach hinten, statt es als „1970" vorne einzureihen.
        const av = a.arrival_date ?? "9999-12-31";
        const bv = b.arrival_date ?? "9999-12-31";
        return av.localeCompare(bv);
      }
      if (filter.sortierung === "name") {
        return (a.guest_name ?? "").localeCompare(b.guest_name ?? "", "de");
      }
      // Neueste zuerst — die Regel steht in `lib/inbox.nachAktivitaet`,
      // damit sie prüfbar ist und nicht in dieser Ansicht vergraben liegt.
      return nachAktivitaet(a, b);
    });
  }, [threads, query, filter]);

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
      <DemoBand />
      <Col style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 14, gap: 16 }}>
        <Row style={{ justifyContent: "space-between", alignItems: "center" }}>
          <Txt v="display">Nachrichten</Txt>
          {/* Dieselbe Auswahl wie der Zeitraum der Übersicht — die Ansicht ist
              keine Filterpille, sondern der Wechsel in eine andere Menge. */}
          <Row style={{ gap: 4, alignItems: "center" }}>
            {access.canManageConfig && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Posteingang verwalten"
                onPress={() => setVerwaltenOffen(true)}
                hitSlop={8}
                style={({ pressed }) => ({ padding: 8, opacity: pressed ? 0.6 : 1 })}
              >
                <Icon n="cog" s={20} sw={2} c={t.palette.ink} />
              </Pressable>
            )}
            <ZeitWahl
              optionen={ANSICHTEN}
              wert={ansicht}
              onWechsel={setAnsicht}
              label="Ansicht"
              laedt={!threads}
            />
          </Row>
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

        {/* Ein Knopf statt zehn Pillen: die Zahl sagt, wie viele Filter gesetzt
            sind — ohne sie wüsste man nicht, warum die Liste kurz ist. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Filter"
          onPress={() => setFilterOffen(true)}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Row style={{ gap: 8, alignItems: "center" }}>
            <Icon n="sliders" s={16} sw={2} c={t.palette.ink} />
            <Txt v="sm" style={{ fontFamily: t.fonts.semibold }}>
              Filter
            </Txt>
            {gesetzteFilter > 0 && (
              <View
                style={{
                  minWidth: 18,
                  height: 18,
                  paddingHorizontal: 5,
                  borderRadius: 999,
                  backgroundColor: t.palette.ink,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Txt v="xs" color={t.palette.bg}>
                  {gesetzteFilter}
                </Txt>
              </View>
            )}
            {/* Was gerade gilt, in Worten — sonst muss man das Sheet öffnen, um
                es zu erfahren. */}
            <Txt v="xs" soft numberOfLines={1} style={{ flexShrink: 1 }}>
              {filterText}
            </Txt>
          </Row>
        </Pressable>
      </Col>

      {!threads && <Spinner />}
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: unterkante + 24 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
        showsVerticalScrollIndicator={false}
      >
        {threads && visible.length === 0 && (
          <EmptyState
            icon="chat"
            titel={
              ansicht === "archived"
                ? "Archiv ist leer"
                : ansicht === "trashed"
                  ? "Papierkorb ist leer"
                  : "Keine Konversationen"
            }
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

      <VerwaltenSheet
        open={verwaltenOffen}
        onClose={() => setVerwaltenOffen(false)}
      />

      <FilterSheet
        open={filterOffen}
        onClose={() => setFilterOffen(false)}
        filter={filter}
        onFilter={setFilter}
        kanaele={channels}
      />
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

// ota_name (Freitext) → Kanal-Key für die Badge-Farbe. Spiegelt die Zuordnung
// des Backends (channel_manager/bookings_sync.py:_channel_of): ein Portal ohne
// eigenen Kanalwert — Expedia, Agoda und alles Unbekannte — ist `ota_other`,
// NICHT „Direkt". Ohne ota_name ist es eine echte Direktbuchung.
function channelKeyOf(ota: string | null): ReservationChannel {
  const s = (ota ?? "").trim().toLowerCase();
  if (!s) return "direct";
  if (s.includes("booking")) return "booking";
  if (s.includes("airbnb")) return "airbnb";
  if (s.includes("vrbo")) return "vrbo";
  // Altbestand trägt noch „myNextDays" als ota_name, neue Buchungen „myBestDays".
  if (s.includes("mybestdays") || s.includes("mynextdays") || s.includes("nextdays"))
    return "portal";
  return "ota_other";
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
            {/* Der Portal-Zeitpunkt, nicht unsere Schreibzeit. Fehlt er,
                gibt `relTime` einen leeren Text zurück — besser als ein
                plausibler falscher Zeitpunkt (Wurzel 4). */}
            <Txt v="xs" soft>{relTime(thread.letzte_aktivitaet)}</Txt>
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
              {/* Reine Bildnachricht: der Server legt ein sprachneutrales
                  Kürzel ab (er kennt die Sprache des Betrachters nicht) — roh
                  stünde hier wörtlich „[attachment]". Die App führt noch kein
                  i18n, deshalb wie überall hier fester deutscher Text. */}
              {thread.last_message === NUR_ANHANG_TEXT
                ? "Foto"
                : (thread.last_message ?? "—")}
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


// --- Chat eines Threads ---

// Optimistische Nachricht bekommt eine temporäre negative Kennung, damit der
// Rollback sie eindeutig entfernen kann.
let tempSeq = 0;

// Ab wann eine Nachricht gekürzt wird. Gemessen an den echten Automails dieses
// Betriebs: die Anreise-Info hat rund 40 Zeilen, eine normale Gastantwort zwei
// bis vier. 12 angezeigte Zeilen zeigen den Anfang und lassen den Rest des
// Verlaufs sichtbar.
const LANG_AB_ZEICHEN = 420;

function istLang(text: string): boolean {
  return text.length > LANG_AB_ZEICHEN;
}

function ThreadView({ thread, onBack }: { thread: InboxThread; onBack: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { me } = useAuth();
  // Rechte aus GET /auth/me, gespiegelt aus web/lib/inbox-access.ts. Die
  // MASKIERUNG der Felder macht der Server; hier hängen nur die AKTIONEN dran.
  const access = useMemo(() => inboxAccessFor(me), [me]);
  const [messages, setMessages] = useState<InboxMessage[] | null>(null);
  // Eine Anfrage ist kein Chat mit Verlauf, sondern eine Entscheidung mit Frist
  // — sie steht deshalb ÜBER dem Verlauf, nicht darin.
  const [anfrage, setAnfrage] = useState<AnfrageDetail | null>(null);
  // Übersetzung je Nachricht — Schalter unter der Blase, wie bei Airbnb und
  // Booking. Nie automatisch beim Öffnen: das kostet je Zeichen und übersetzt
  // Nachrichten, die niemand liest.
  //
  // Das Ergebnis wird NICHT gespeichert. Es ist eine Lesehilfe, keine
  // Tatsache — geschrieben hat der Gast sein Original, und das bleibt die
  // Quelle (Wurzel 4).
  const [uebersetzt, setUebersetzt] = useState<Record<string, string>>({});
  // Welche langen Nachrichten der Nutzer aufgeklappt hat.
  const [entfaltet, setEntfaltet] = useState<Record<string, boolean>>({});
  const [uebersetzeGerade, setUebersetzeGerade] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [vorgangOffen, setVorgangOffen] = useState(false);
  const [werkzeugeOffen, setWerkzeugeOffen] = useState(false);
  // Zahl der geplanten Nachrichten: markiert den Werkzeug-Knopf mit einem Punkt.
  // Ein Punkt, keine Zahl — die genaue Menge steht im Sheet, hier zählt nur
  // „da liegt etwas in der Warteschlange".
  const [geplantZahl, setGeplantZahl] = useState(0);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  // Die Buchung hinter diesem Gespräch — als dasselbe Panel, das Kalender,
  // Buchungsliste und Übersicht öffnen (`components/buchung/BuchungsPanel`).
  //
  // Hier stand bis 24.08.2026 eine EIGENE, aufklappbare Karte im Verlauf: eine
  // dritte Fassung derselben Buchung, dünner als die anderen beiden (keine
  // Aktionen, kein Zahlungsstand, kein Storno) und obendrein unsichtbar, weil
  // sie ÜBER dem Chat wuchs und die Ansicht sofort wieder ans Ende sprang. Sie
  // ist ersatzlos weg — nicht repariert: zwei Oberflächen für dieselbe Sache
  // heißt, jede Änderung zweimal pflegen, und die schwächere fällt still
  // zurück (dieselbe Begründung wie in `screens/ReservationDetail.tsx`).
  const [buchungOffen, setBuchungOffen] = useState(false);
  const verlauf = useRef<ScrollView>(null);
  // Steht der Verlauf am unteren Rand? Startet auf `true`, damit der erste
  // Aufbau eines frisch geöffneten Threads immer unten landet.
  const amEnde = useRef(true);

  const load = useCallback(async () => {
    const res = await getInboxMessages(thread.id);
    setMessages(res.ok ? res.data.items : []);
  }, [thread.id]);

  useEffect(() => {
    load();
  }, [load]);

  // Anfrage-Detail: NUR für Anfrage-Threads. Für eine gewöhnliche Buchung
  // antwortet der Endpunkt 404 — ihn dort zu rufen, wäre eine Fehlermeldung je
  // geöffnetem Thread.
  const anfrageLaden = useCallback(async () => {
    if (!istAnfrageThread(thread.id)) {
      setAnfrage(null);
      return;
    }
    const res = await getAnfrage(thread.id);
    setAnfrage(res.ok ? res.data : null);
  }, [thread.id]);

  useEffect(() => {
    anfrageLaden();
  }, [anfrageLaden]);

  // Geöffnet heißt gelesen — dasselbe Verhalten wie im Web
  // (`web/components/inbox/inbox-list.tsx`). Die App zeigte den Verlauf und
  // ließ den Thread ungelesen: der Ungelesen-Zähler blieb stehen, obwohl die
  // Nachricht auf dem Bildschirm stand. Die Liste holt sich den neuen Stand
  // beim Zurückgehen selbst (sie wird dabei neu aufgebaut).
  useEffect(() => {
    if (thread.is_read) return;
    void markInboxThreadRead(thread.id);
  }, [thread.id, thread.is_read]);

  // Ein Chat wird von unten gelesen: die neueste Nachricht ist die, um die es
  // geht. Die `ScrollView` startet oben — bei einem langen Thread landete man
  // beim Öffnen bei der ÄLTESTEN Nachricht (gleiche Ursache wie im Web,
  // `web/components/inbox/inbox-konversation.tsx`).
  //
  // Der Sprung hängt an `onContentSizeChange` der ScrollView, NICHT an einem
  // Effekt: `scrollToEnd` rechnet mit der zuletzt GEMESSENEN Inhaltshöhe, und
  // die meldet React Native asynchron über genau dieses Ereignis. Ein Effekt
  // (auch mit `setTimeout(0)`) läuft davor und träfe bei langen Threads noch
  // die alte Höhe — der Verlauf bliebe stehen. Es deckt zusätzlich das
  // Aufgehen der Tastatur ab, bei dem sich kein Zustand ändert.
  //
  // `animated: false`, weil den Ausgangspunkt beim Öffnen niemand sehen will.
  const ansEndeSpringen = useCallback(() => {
    // Nur wenn der Nutzer bereits unten steht (oder gerade erst geöffnet hat):
    // `load()` läuft auch nach dem Senden und beim Zug-zum-Aktualisieren. Ohne
    // diese Sperre risse es einen Nutzer, der weiter oben liest, unvermittelt
    // nach unten.
    if (amEnde.current) verlauf.current?.scrollToEnd({ animated: false });
  }, []);

  // Kein Realtime im offenen Thread.
  //
  // Hier stand zuletzt ein Abo auf dem inhaltsfreien Signal
  // `channex_booking.last_message_at` (0305) plus eines auf `inbox_thread_note`.
  // Migration 0337 hat beide Tabellen für `authenticated` gesperrt (Wurzel 6:
  // revoke + raus aus der Publikation supabase_realtime) — sie verbanden sauber
  // und bekamen nie ein Event. Davor stand hier `sandbox_message` — eine
  // Test-Tabelle (0036), die im Produktivpfad nie geschrieben wird, ebenfalls
  // ohne ein einziges Event. `portal_messages` trägt den Klartext der
  // Gastnachrichten und war schon vorher gesperrt.
  //
  // Eine Ersatzquelle gibt es nicht: keine für `authenticated` offene Tabelle
  // trägt eine eingehende Gastnachricht oder eine interne Notiz. Ehrlich: eine
  // Antwort des Gastes und eine von einem Kollegen angelegte Notiz erscheinen
  // nicht mehr von selbst — der Verlauf lädt beim Öffnen des Threads und nach
  // dem eigenen Senden neu.

  /** Eine Nachricht übersetzen bzw. das Original zurückholen (Wechsel). */
  const umschaltenUebersetzung = async (id: string, text: string) => {
    if (uebersetzt[id]) {
      setUebersetzt((prev) => {
        const rest = { ...prev };
        delete rest[id];
        return rest;
      });
      return;
    }
    setUebersetzeGerade(id);
    // Zielsprache ist die Sprache des Betrachters — der Betrieb liest in
    // seiner, nicht in der des Gastes.
    const res = await translateText(text, "de");
    setUebersetzeGerade(null);
    if (!res.ok) {
      setHinweis(res.error);
      return;
    }
    setUebersetzt((prev) => ({ ...prev, [id]: res.data.text }));
  };

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
      <View style={{ paddingTop: insets.top }}>
        <DemoBand />
      </View>
      <Row style={{ paddingTop: 8, paddingHorizontal: 12, paddingBottom: 10, gap: 6, alignItems: "center" }}>
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Vorgang"
          onPress={() => setVorgangOffen(true)}
          hitSlop={10}
          style={({ pressed }) => ({ padding: 8, opacity: pressed ? 0.6 : 1 })}
        >
          <Icon n="more" s={20} sw={2} c={t.palette.ink} />
        </Pressable>
      </Row>

      {!messages && <Spinner />}
      <ScrollView
        ref={verlauf}
        contentContainerStyle={{ padding: 16, gap: 10 }}
        onContentSizeChange={ansEndeSpringen}
        scrollEventThrottle={16}
        onScroll={(e) => {
          const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
          const rest = contentSize.height - contentOffset.y - layoutMeasurement.height;
          amEnde.current = rest < 80; // Toleranz: „praktisch unten"
        }}
      >
        {/* Die Anfrage steht ÜBER dem Verlauf: sie ist die Handlung, um die es
            geht, und ihre Frist läuft ab — der Chat darunter ist Beiwerk. */}
        {anfrage && (
          <AnfrageKarte
            detail={anfrage}
            darfEntscheiden={access.canReply}
            onEntschieden={() => {
              // Nach der Entscheidung beides neu holen: das Portal setzt den
              // Status, und die Bestätigung erscheint als Nachricht im Verlauf.
              anfrageLaden();
              load();
            }}
          />
        )}

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
              {/* Die Blase entfällt, wenn der Gast NUR ein Foto geschickt hat
                  (Channex liefert die Nachricht dann ohne Text) — sonst stünde
                  hier ein leerer Kasten. */}
              {!!m.message.trim() && (
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
                  <Txt
                    v="body"
                    color={mine && !note ? t.palette.bg : t.palette.ink}
                    {...(m.id && !entfaltet[m.id] && istLang(m.message)
                      ? { numberOfLines: 12 }
                      : {})}
                  >
                    {/* Übersetzt, solange der Schalter an ist — das Original
                        bleibt einen Tipp entfernt. */}
                    {(m.id && uebersetzt[m.id]) || m.message}
                  </Txt>
                  {/* Automails sind lang (Anreise-Infos, Rabattlisten,
                      Checkout-Regeln). Ungekürzt füllt EINE Nachricht den
                      Bildschirm, und der Verlauf ist nicht mehr zu lesen. */}
                  {m.id && istLang(m.message) && (
                    <Pressable
                      onPress={() =>
                        setEntfaltet((prev) => ({
                          ...prev,
                          [m.id!]: !prev[m.id!],
                        }))
                      }
                      hitSlop={6}
                      style={({ pressed }) => ({
                        marginTop: 6,
                        opacity: pressed ? 0.6 : 1,
                      })}
                    >
                      <Txt
                        v="xs"
                        color={
                          mine && !note ? t.palette.bg : t.palette.soft
                        }
                        style={{ textDecorationLine: "underline" }}
                      >
                        {entfaltet[m.id] ? "Weniger" : "Mehr anzeigen"}
                      </Txt>
                    </Pressable>
                  )}
                </View>
              )}

              {/* Nur bei GASTnachrichten mit Text: die eigene übersetzt niemand,
                  und eine interne Notiz ist ohnehin in der eigenen Sprache. */}
              {!mine && !note && !!m.message.trim() && m.id && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => umschaltenUebersetzung(m.id!, m.message)}
                  hitSlop={6}
                  style={({ pressed }) => ({
                    marginTop: 4,
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  <Txt v="xs" soft style={{ textDecorationLine: "underline" }}>
                    {uebersetzeGerade === m.id
                      ? "Übersetzt …"
                      : uebersetzt[m.id]
                        ? "Original anzeigen"
                        : "Übersetzen"}
                  </Txt>
                </Pressable>
              )}

              {/* Bildanhänge. Die URLs hat der Server auf https + bekannten
                  Host geprüft — hier wird nichts nachgebessert. */}
              {m.attachments?.map((url) => (
                <Image
                  key={url}
                  source={{ uri: url }}
                  style={{
                    width: "100%",
                    aspectRatio: 4 / 3,
                    borderRadius: 20,
                    marginTop: m.message.trim() ? 6 : 0,
                    backgroundColor: t.palette.surface2,
                  }}
                  resizeMode="cover"
                />
              ))}
            </View>
          );
        })}
      </ScrollView>

      {/* Ohne Antwortrecht KEIN Eingabefeld.
          Vorher stand es für jeden da: ein Mitarbeiter ohne `inbox_reply` tippte
          eine Antwort, drückte senden und bekam erst dort einen Fehler — die
          Arbeit war weg. Der Server hat das immer schon abgewiesen; falsch war
          das Versprechen der Oberfläche.
          Eine Anfrage hat ebenfalls kein Chat-Feld: dort wird entschieden, nicht
          geplaudert (die Antwort an den Gast steckt in der Karte oben). */}
      {/* Im Vorführ-Zugang GAR KEIN Eingabefeld: der Server lehnt das Senden mit
          405 ab. Ein Feld, in das man tippen kann und dessen Senden nichts tut,
          ist die schlechteste aller Varianten — genau daran ist es aufgefallen. */}
      {me?.is_demo ? (
        <Row
          style={{
            padding: 16,
            paddingBottom: insets.bottom + 12,
            borderTopWidth: 1,
            borderTopColor: t.palette.line,
            backgroundColor: t.palette.surface,
            gap: 8,
          }}
        >
          <Icon n="lock" s={16} sw={2} c={t.palette.soft} />
          <Txt v="sm" soft style={{ flexShrink: 1 }}>
            Vorführung: Antworten, Vorlagen und KI-Vorschläge sind abgeschaltet.
          </Txt>
        </Row>
      ) : !access.canReply ? (
        <Row
          style={{
            padding: 16,
            paddingBottom: insets.bottom + 12,
            borderTopWidth: 1,
            borderTopColor: t.palette.line,
            backgroundColor: t.palette.surface,
            gap: 8,
          }}
        >
          <Icon n="lock" s={16} sw={2} c={t.palette.soft} />
          <Txt v="sm" soft>
            Du kannst mitlesen, aber nicht antworten.
          </Txt>
        </Row>
      ) : anfrage ? (
        <Row
          style={{
            padding: 16,
            paddingBottom: insets.bottom + 12,
            borderTopWidth: 1,
            borderTopColor: t.palette.line,
            backgroundColor: t.palette.surface,
            gap: 8,
          }}
        >
          <Icon n="info" s={16} sw={2} c={t.palette.soft} />
          <Txt v="sm" soft>
            Anfrage — die Antwort geht über die Entscheidung oben.
          </Txt>
        </Row>
      ) : (
      <View
        style={{
          borderTopWidth: 1,
          borderTopColor: t.palette.line,
          backgroundColor: t.palette.surface,
        }}
      >
        {/* Kurzer Hinweis statt eines Alerts: ein fehlgeschlagenes Übersetzen
            darf den Lesefluss nicht mit einem Dialog unterbrechen. */}
        {hinweis && (
          <Pressable onPress={() => setHinweis(null)} style={{ padding: 12 }}>
            <Txt v="xs" color={t.palette.accent}>
              {hinweis}
            </Txt>
          </Pressable>
        )}
        <AntwortWerkzeuge
          threadId={thread.id}
          entwurf={draft}
          offen={werkzeugeOffen}
          onSchliessen={() => setWerkzeugeOffen(false)}
          onEntwurf={setDraft}
          onGeplant={() => {
            setDraft("");
            setHinweis("Nachricht ist eingeplant.");
          }}
          onGeplantZahl={setGeplantZahl}
        />
      <Row
        style={{
          padding: 12,
          paddingBottom: insets.bottom + 8,
          gap: 8,
          alignItems: "flex-end",
        }}
      >
        {/* Werkzeuge: ein Knopf statt vier Chips über dem Feld. Der Punkt zeigt,
            dass für diesen Vorgang etwas geplant ist — sonst wüsste das
            niemand, ohne das Sheet zu öffnen. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Antwort-Werkzeuge"
          onPress={() => setWerkzeugeOffen(true)}
          hitSlop={8}
          style={({ pressed }) => ({
            width: 42,
            height: 42,
            borderRadius: 999,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: t.palette.bg,
            opacity: pressed ? 0.6 : 1,
          })}
        >
          <Icon n="plus" s={20} sw={2} c={t.palette.ink} />
          {geplantZahl > 0 && (
            <View
              style={{
                position: "absolute",
                top: 8,
                right: 8,
                width: 8,
                height: 8,
                borderRadius: 999,
                backgroundColor: t.palette.accent,
              }}
            />
          )}
        </Pressable>
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
        {/* Zwei klare Zustände statt einer halbdurchsichtigen Farbe: leer =
            ruhige Fläche mit dunklem Pfeil, bereit = gefüllt. Eine auf 50 %
            gestellte Akzentfarbe wird zu blassem Rosa — das sah nicht
            „inaktiv" aus, sondern nach einem Fehler in der Farbe. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Senden"
          onPress={send}
          disabled={sending || !draft.trim()}
          style={{
            width: 42,
            height: 42,
            borderRadius: 999,
            backgroundColor: draft.trim() ? t.palette.ink : t.palette.surface2,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon
            n="send"
            s={20}
            c={draft.trim() ? t.palette.bg : t.palette.faint}
          />
        </Pressable>
      </Row>
      </View>
      )}

      <VorgangSheet
        open={vorgangOffen}
        onClose={() => setVorgangOffen(false)}
        thread={thread}
        access={access}
        hatDetails={!!thread.reservation_id}
        onDetails={() => setBuchungOffen(true)}
        onGeaendert={(verlassen) => {
          // Nach einem Status-Wechsel gehört der Thread nicht mehr in diese
          // Ansicht — zurück zur Liste, die sich beim Aufbau neu holt. Sonst
          // stünde man in einem Verlauf, den die Liste nicht mehr führt.
          if (verlassen) onBack();
          else load();
        }}
      />

      {/* Dieselbe Buchungsansicht wie überall sonst — sie fährt ÜBER dem
          Gespräch ein, damit der Verlauf stehen bleibt, aus dem man kommt.
          `reservation_id` kann fehlen (Thread ohne verknüpfte Reservierung);
          dann bietet das Sheet den Punkt gar nicht erst an (Wurzel 4). */}
      {buchungOffen && thread.reservation_id && (
        <BuchungsPanel
          reservationId={thread.reservation_id}
          heuteIso={heuteIso()}
          onClose={() => setBuchungOffen(false)}
        />
      )}
    </KeyboardAvoidingView>
  );
}

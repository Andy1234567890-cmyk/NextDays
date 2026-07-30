"use client";

// Live-Chat mit dem myNextDays-Team — das Widget im Dashboard.
//
// Aufbau nach dem Muster der etablierten Messenger (Intercom, Zendesk
// Messaging, Crisp), auf das Nötige reduziert:
//   • Öffnen springt dorthin, wo der Kunde weitermachen würde: keine
//     Konversation → direkt schreiben; genau eine laufende → hinein; sonst die
//     Liste (Zendesk-Regel).
//   • Der Kopf sagt, ob gerade jemand da ist (Presence) — sonst die
//     realistische Antwortzeit statt eines Versprechens.
//   • Nachrichten erscheinen über Realtime, nie über Nachladen. Die eigene
//     Nachricht steht sofort da (optimistisch) und wird beim Echo über die
//     client_msg_id ERSETZT, nicht ein zweites Mal einsortiert.
//
// Was hier bewusst NICHT passiert: kein direkter Datenbankzugriff (alles über
// die Server-Actions in lib/support-chat.ts), keine Anzeige interner
// Team-Notizen (die filtert der Server heraus und liefert sie gar nicht erst
// aus), keine hartkodierten Texte (i18n-Namespace „supportChat").
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  type ChatConversation,
  type ChatMessage,
  getConversation,
  listConversations,
  markRead,
  rateConversation,
  sendMessage,
  startConversation,
  unreadSummary,
} from "@/lib/support-chat";
import { useRealtime } from "@/lib/use-realtime";
import { useTeamPresence, useTypingChannel } from "@/lib/use-support-channel";

// --- Kontext -----------------------------------------------------------------

type SupportChatKontext = {
  offen: boolean;
  oeffnen: () => void;
  schliessen: () => void;
  /** Konversationen mit ungelesener Team-Antwort (Badge-Zahl). */
  ungelesen: number;
};

const Kontext = createContext<SupportChatKontext | null>(null);

/** Zugriff auf das Chat-Widget (Öffnen aus dem Konto-Menü, Badge). */
export function useSupportChat(): SupportChatKontext {
  const ctx = useContext(Kontext);
  if (!ctx) {
    // Kein stiller Fallback: ohne Provider wäre der Menüpunkt eine Attrappe.
    throw new Error("useSupportChat braucht den SupportChatProvider.");
  }
  return ctx;
}

export function SupportChatProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [offen, setOffen] = useState(false);
  const [ungelesen, setUngelesen] = useState(0);

  const ungelesenLaden = useCallback(async () => {
    const res = await unreadSummary();
    if (res.ok) setUngelesen(res.data.conversations);
  }, []);

  useEffect(() => {
    void ungelesenLaden();
  }, [ungelesenLaden]);

  // Realtime statt Polling: jede neue Nachricht aktualisiert den Zähler. Die
  // RLS-Policy (0205) liefert nur eigene/betriebseigene Konversationen aus —
  // ein Filter ist deshalb nicht nötig und wäre sogar zu eng (es sind mehrere
  // Konversationen).
  useRealtime({
    table: "support_messages",
    onChange: () => void ungelesenLaden(),
  });
  useRealtime({
    table: "support_tickets",
    onChange: () => void ungelesenLaden(),
  });

  const wert = useMemo<SupportChatKontext>(
    () => ({
      offen,
      oeffnen: () => setOffen(true),
      schliessen: () => setOffen(false),
      ungelesen,
    }),
    [offen, ungelesen],
  );

  return (
    <Kontext.Provider value={wert}>
      {children}
      {offen && <ChatPanel aufUngelesen={ungelesenLaden} />}
    </Kontext.Provider>
  );
}

// --- Panel -------------------------------------------------------------------

type Ansicht =
  | { art: "liste" }
  | { art: "neu" }
  | { art: "verlauf"; id: string };

function ChatPanel({ aufUngelesen }: { aufUngelesen: () => Promise<void> }) {
  const t = useTranslations("supportChat");
  const { schliessen } = useSupportChat();
  const [konversationen, setKonversationen] = useState<ChatConversation[]>([]);
  const [geladen, setGeladen] = useState(false);
  const [ansicht, setAnsicht] = useState<Ansicht>({ art: "liste" });
  const { teamOnline } = useTeamPresence();

  const listeLaden = useCallback(async () => {
    const res = await listConversations();
    if (res.ok) setKonversationen(res.data.items);
    return res.ok ? res.data.items : [];
  }, []);

  // Einstiegsbildschirm: dorthin, wo der Kunde weitermachen würde.
  useEffect(() => {
    void (async () => {
      const items = await listeLaden();
      const laufend = items.filter((k) => k.status !== "geloest");
      if (items.length === 0) setAnsicht({ art: "neu" });
      else if (laufend.length === 1) {
        setAnsicht({ art: "verlauf", id: laufend[0].id });
      } else setAnsicht({ art: "liste" });
      setGeladen(true);
    })();
  }, [listeLaden]);

  useRealtime({
    table: "support_tickets",
    onChange: () => void listeLaden(),
  });

  const aktualisieren = useCallback(async () => {
    await listeLaden();
    await aufUngelesen();
  }, [listeLaden, aufUngelesen]);

  return (
    <div
      role="dialog"
      aria-label={t("titel")}
      className="fixed bottom-6 right-6 z-[60] flex h-[min(38rem,calc(100vh-4rem))] w-[min(24rem,calc(100vw-2rem))] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
    >
      <header className="flex items-start gap-3 border-b border-border px-4 py-3">
        {ansicht.art !== "liste" && konversationen.length > 0 && (
          <button
            type="button"
            onClick={() => setAnsicht({ art: "liste" })}
            aria-label={t("zurueck")}
            className="mt-0.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            <Icon icon="ph:arrow-left" className="size-5" />
          </button>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{t("titel")}</p>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              aria-hidden
              className={`size-2 rounded-full ${
                teamOnline ? "bg-emerald-500" : "bg-muted-foreground/40"
              }`}
            />
            {teamOnline ? t("online") : t("offline")}
          </p>
        </div>
        <button
          type="button"
          onClick={schliessen}
          aria-label={t("schliessen")}
          className="mt-0.5 text-muted-foreground transition-colors hover:text-foreground"
        >
          <Icon icon="ph:x" className="size-5" />
        </button>
      </header>

      {!geladen ? (
        <p className="p-4 text-sm text-muted-foreground">{t("laden")}</p>
      ) : ansicht.art === "liste" ? (
        <Liste
          konversationen={konversationen}
          aufOeffnen={(id) => setAnsicht({ art: "verlauf", id })}
          aufNeu={() => setAnsicht({ art: "neu" })}
        />
      ) : ansicht.art === "neu" ? (
        <NeueKonversation
          aufAngelegt={async (id) => {
            await aktualisieren();
            setAnsicht({ art: "verlauf", id });
          }}
        />
      ) : (
        <Verlauf
          conversationId={ansicht.id}
          aufAenderung={aktualisieren}
        />
      )}
    </div>
  );
}

// --- Liste -------------------------------------------------------------------

function Liste({
  konversationen,
  aufOeffnen,
  aufNeu,
}: {
  konversationen: ChatConversation[];
  aufOeffnen: (id: string) => void;
  aufNeu: () => void;
}) {
  const t = useTranslations("supportChat");
  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <ul className="divide-y divide-border">
          {konversationen.map((k) => (
            <li key={k.id}>
              <button
                type="button"
                onClick={() => aufOeffnen(k.id)}
                className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
              >
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span
                      className={`truncate text-sm ${
                        k.unread > 0 ? "font-semibold" : "font-medium"
                      }`}
                    >
                      {k.subject}
                    </span>
                    {k.status === "geloest" && (
                      <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[0.6875rem] text-muted-foreground">
                        {t("statusGeloest")}
                      </span>
                    )}
                  </span>
                  {/* Vorschau kommt vom Server und enthält nie interne Notizen. */}
                  {k.last_message_preview && (
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {k.last_message_kind === "reporter"
                        ? `${t("absenderSelbst")}: ${k.last_message_preview}`
                        : k.last_message_preview}
                    </span>
                  )}
                </span>
                {k.unread > 0 && (
                  <span className="mt-0.5 shrink-0 rounded-full bg-primary px-2 py-0.5 text-[0.6875rem] font-semibold text-primary-foreground">
                    {k.unread}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
      <Fuss>
        <button
          type="button"
          onClick={aufNeu}
          className="w-full rounded-full bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
        >
          {t("neueUnterhaltung")}
        </button>
      </Fuss>
    </>
  );
}

// --- Neue Konversation -------------------------------------------------------

function NeueKonversation({
  aufAngelegt,
}: {
  aufAngelegt: (id: string) => Promise<void>;
}) {
  const t = useTranslations("supportChat");
  const [text, setText] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  // Einmal je Entwurf erzeugt: ein Retry nach Timeout eröffnet dadurch keine
  // zweite Unterhaltung (Wurzel 2).
  const clientIdRef = useRef(crypto.randomUUID());

  async function senden() {
    const inhalt = text.trim();
    if (!inhalt || laeuft) return;
    setLaeuft(true);
    setFehler(null);
    const res = await startConversation(inhalt, clientIdRef.current);
    setLaeuft(false);
    if (!res.ok) {
      setFehler(res.error);
      return;
    }
    setText("");
    clientIdRef.current = crypto.randomUUID();
    await aufAngelegt(res.data.id);
  }

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
        <p className="text-sm font-semibold">{t("begruessung")}</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("begruessungText")}
        </p>
        <HilfeCenterHinweis />
      </div>
      <Fuss>
        {fehler && <p className="mb-2 text-xs text-destructive">{fehler}</p>}
        <Eingabe
          text={text}
          setText={setText}
          laeuft={laeuft}
          aufSenden={senden}
          platzhalter={t("platzhalterNeu")}
        />
      </Fuss>
    </>
  );
}

// --- Verlauf -----------------------------------------------------------------

function Verlauf({
  conversationId,
  aufAenderung,
}: {
  conversationId: string;
  aufAenderung: () => Promise<void>;
}) {
  const t = useTranslations("supportChat");
  const [nachrichten, setNachrichten] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<ChatConversation["status"]>(
    "in_bearbeitung",
  );
  const [agentGelesenAm, setAgentGelesenAm] = useState<string | null>(null);
  const [bewertung, setBewertung] = useState<number | null>(null);
  const [text, setText] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const endeRef = useRef<HTMLDivElement | null>(null);
  const clientIdRef = useRef(crypto.randomUUID());
  const { gegenseiteTippt, tippen } = useTypingChannel(
    conversationId,
    "reporter",
  );

  const laden = useCallback(async () => {
    const res = await getConversation(conversationId);
    if (!res.ok) return;
    setNachrichten(res.data.messages);
    setStatus(res.data.status);
    setAgentGelesenAm(res.data.agent_last_read_at);
    setBewertung(res.data.rating);
  }, [conversationId]);

  useEffect(() => {
    void (async () => {
      await laden();
      await markRead(conversationId);
      await aufAenderung();
    })();
    // aufAenderung ist stabil (useCallback), laden hängt an der Konversation.
  }, [laden, conversationId, aufAenderung]);

  // Team-Antworten erscheinen sofort. Eigene Nachrichten kommen als Echo
  // zurück — die optimistische Zeile wird über die client_msg_id ersetzt,
  // sonst stünde sie doppelt da.
  useRealtime<{
    id: string;
    author_kind: "reporter" | "agent";
    body: string;
    created_at: string;
    client_msg_id: string | null;
  }>({
    table: "support_messages",
    filter: `ticket_id=eq.${conversationId}`,
    onEvent: (payload) => {
      if (payload.eventType !== "INSERT") return;
      const neu = payload.new as ChatMessage;
      if (!neu?.id) return;
      setNachrichten((bisher) => {
        const ersetzt = bisher.some(
          (m) =>
            m.id === neu.id ||
            (!!neu.client_msg_id && m.client_msg_id === neu.client_msg_id),
        );
        if (ersetzt) {
          return bisher.map((m) =>
            m.id === neu.id ||
            (!!neu.client_msg_id && m.client_msg_id === neu.client_msg_id)
              ? neu
              : m,
          );
        }
        return [...bisher, neu];
      });
      if (neu.author_kind === "agent") {
        void markRead(conversationId).then(() => aufAenderung());
      }
    },
  });

  // Statuswechsel (gelöst/wieder geöffnet) und der Lese-Cursor des Teams.
  useRealtime<{ status: string; agent_last_read_at: string | null }>({
    table: "support_tickets",
    filter: `id=eq.${conversationId}`,
    onEvent: () => void laden(),
  });

  useEffect(() => {
    endeRef.current?.scrollIntoView({ block: "end" });
  }, [nachrichten, gegenseiteTippt]);

  async function senden() {
    const inhalt = text.trim();
    if (!inhalt || laeuft) return;
    const clientId = clientIdRef.current;
    setLaeuft(true);
    setFehler(null);
    // Optimistisch anzeigen: die Nachricht steht sofort im Verlauf.
    const optimistisch: ChatMessage = {
      id: `lokal-${clientId}`,
      author_kind: "reporter",
      body: inhalt,
      created_at: new Date().toISOString(),
      client_msg_id: clientId,
    };
    setNachrichten((bisher) => [...bisher, optimistisch]);
    setText("");
    const res = await sendMessage(conversationId, inhalt, clientId);
    setLaeuft(false);
    if (!res.ok) {
      setNachrichten((bisher) => bisher.filter((m) => m.id !== optimistisch.id));
      setText(inhalt);
      setFehler(res.error);
      return;
    }
    clientIdRef.current = crypto.randomUUID();
    setNachrichten((bisher) =>
      bisher.map((m) => (m.id === optimistisch.id ? res.data : m)),
    );
    await aufAenderung();
  }

  const letzteEigene = [...nachrichten]
    .reverse()
    .find((m) => m.author_kind === "reporter");
  const eigeneGelesen =
    !!letzteEigene &&
    !!agentGelesenAm &&
    agentGelesenAm >= letzteEigene.created_at;

  return (
    <>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {nachrichten.map((m) => (
          <Blase key={m.id} nachricht={m} />
        ))}
        {eigeneGelesen && (
          <p className="text-right text-[0.6875rem] text-muted-foreground">
            {t("gelesen")}
          </p>
        )}
        {gegenseiteTippt && (
          <p className="text-xs text-muted-foreground">{t("tippt")}</p>
        )}
        {status === "geloest" && (
          <Bewertung
            conversationId={conversationId}
            bewertung={bewertung}
            aufBewertet={setBewertung}
          />
        )}
        <div ref={endeRef} />
      </div>
      <Fuss>
        {fehler && <p className="mb-2 text-xs text-destructive">{fehler}</p>}
        <Eingabe
          text={text}
          setText={(v) => {
            setText(v);
            tippen();
          }}
          laeuft={laeuft}
          aufSenden={senden}
          platzhalter={t("platzhalterAntwort")}
        />
      </Fuss>
    </>
  );
}

function Blase({ nachricht }: { nachricht: ChatMessage }) {
  const t = useTranslations("supportChat");
  const vomTeam = nachricht.author_kind === "agent";
  const zeit = new Date(nachricht.created_at).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <div className={`flex ${vomTeam ? "justify-start" : "justify-end"}`}>
      <div
        className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 ${
          vomTeam ? "bg-muted" : "bg-foreground text-background"
        }`}
      >
        <p className="whitespace-pre-wrap text-sm leading-relaxed">
          {nachricht.body}
        </p>
        <p
          className={`mt-1 text-[0.6875rem] ${
            vomTeam ? "text-muted-foreground" : "text-background/70"
          }`}
        >
          {vomTeam ? `${t("team")} · ${zeit}` : zeit}
        </p>
      </div>
    </div>
  );
}

function Bewertung({
  conversationId,
  bewertung,
  aufBewertet,
}: {
  conversationId: string;
  bewertung: number | null;
  aufBewertet: (wert: number) => void;
}) {
  const t = useTranslations("supportChat");
  const [laeuft, setLaeuft] = useState(false);
  const stufen = ["😠", "🙁", "😐", "🙂", "😀"];

  if (bewertung) {
    return (
      <p className="rounded-2xl bg-muted/50 px-3.5 py-2.5 text-xs text-muted-foreground">
        {t("bewertungDanke")}
      </p>
    );
  }
  return (
    <div className="rounded-2xl bg-muted/50 px-3.5 py-3">
      <p className="text-xs text-muted-foreground">{t("bewertungFrage")}</p>
      <div className="mt-2 flex gap-1">
        {stufen.map((emoji, i) => (
          <button
            key={emoji}
            type="button"
            disabled={laeuft}
            onClick={async () => {
              setLaeuft(true);
              const res = await rateConversation(conversationId, i + 1);
              setLaeuft(false);
              if (res.ok) aufBewertet(i + 1);
            }}
            aria-label={t("bewertungStufe", { stufe: i + 1 })}
            className="rounded-full px-1.5 py-1 text-lg transition-transform hover:scale-110 disabled:opacity-50"
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  );
}

// --- Bausteine ---------------------------------------------------------------

function Fuss({ children }: { children: React.ReactNode }) {
  return <div className="border-t border-border p-3">{children}</div>;
}

function HilfeCenterHinweis() {
  const t = useTranslations("supportChat");
  return (
    <Link
      href="/hilfe"
      target="_blank"
      rel="noopener noreferrer"
      className="mt-5 flex items-center gap-2 rounded-2xl border border-border px-3.5 py-3 text-sm transition-colors hover:border-foreground"
    >
      <Icon icon="ph:lifebuoy" className="size-5 text-muted-foreground" />
      <span className="min-w-0 flex-1">{t("hilfeCenter")}</span>
      <Icon icon="ph:arrow-up-right" className="size-4 text-muted-foreground" />
    </Link>
  );
}

function Eingabe({
  text,
  setText,
  laeuft,
  aufSenden,
  platzhalter,
}: {
  text: string;
  setText: (wert: string) => void;
  laeuft: boolean;
  aufSenden: () => void | Promise<void>;
  platzhalter: string;
}) {
  const t = useTranslations("supportChat");
  return (
    <div className="flex items-end gap-2">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          // Enter sendet, Shift+Enter macht einen Absatz — Chat-Konvention.
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            void aufSenden();
          }
        }}
        rows={2}
        maxLength={5000}
        placeholder={platzhalter}
        className="max-h-32 min-h-[2.75rem] flex-1 resize-none rounded-2xl border border-border bg-transparent px-3.5 py-2.5 text-sm outline-none focus:border-foreground"
      />
      <button
        type="button"
        disabled={laeuft || !text.trim()}
        onClick={() => void aufSenden()}
        aria-label={t("senden")}
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        <Icon icon="ph:paper-plane-tilt-fill" className="size-4" />
      </button>
    </div>
  );
}

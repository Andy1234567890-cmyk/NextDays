"use client";

// Konversationsspalte des Posteingangs (OTA-Threads): Verlauf, interne Notizen,
// KI-Antwortvorschlag, Vorlagen, geplantes Senden und die Kopf-Aktionsleiste.
// Aus `inbox-list.tsx` herausgelöst — die Datei trug Seitengerüst, Thread-Liste,
// Konversation und Reservierungspanel in einem Stück (2178 Zeilen). Reine
// Verschiebung, kein Verhaltenswechsel.
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import {
  Fragment,
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";

import { ComposerEditor } from "@/components/inbox/composer-editor";
import { istUebernahme } from "@/components/inbox/inbox-uebernahme-threads";
import {
  sprachName,
  uebersetzbar,
  useUebersetzung,
} from "@/components/inbox/chat-uebersetzung";
import {
  GuestAvatar,
  HeadAction,
  MenuAction,
} from "@/components/inbox/inbox-darstellung";
import { WhatsAppChat } from "@/components/inbox/whatsapp-panel";
import { Button } from "@nextdays/ui/button";
import { tagLabel, tagWechsel, uhrzeit, zeitpunktLang } from "@/lib/chat-format";
import {
  type Attachment,
  type InboxMessage,
  type InboxStatus,
  type InboxThread,
  type MessageTemplate,
  type ScheduledMessage,
  type TeamMember,
  addNote,
  assignThread,
  cancelScheduled,
  deleteAttachment,
  getAiReply,
  getInboxMessages,
  listAttachments,
  listScheduled,
  listTeam,
  listTemplates,
  renderForThread,
  scheduleMessage,
  sendInboxMessage,
  updateThreadFlags,
  uploadAttachment,
} from "@/lib/inbox";
import { type InboxAccess } from "@/lib/inbox-access";
import { channelLabelLoose } from "@/lib/channel-logos";

// --- Konversation (Chat + KI-Vorschlag + Antwortfeld) -----------------------
export function Conversation({
  thread,
  view,
  access,
  onMarkUnread,
  onStatus,
  onNext,
  onOpenNote,
  onAssigned,
  whatsapp,
  onCloseWhatsapp,
}: {
  thread: InboxThread;
  view: InboxStatus;
  access: InboxAccess;
  onMarkUnread: () => void;
  onStatus: (status: "active" | "archived" | "trashed" | "deleted") => void;
  onNext: () => void;
  onOpenNote: () => void;
  onAssigned: (userId: string | null, name: string | null) => void;
  /** Aus der Gästekarte eingeblendeter WhatsApp-Verlauf desselben Gastes. */
  whatsapp?: { phone: string; conversationId: string | null } | null;
  onCloseWhatsapp?: () => void;
}) {
  const t = useTranslations("inbox");
  const locale = useLocale();
  const [messages, setMessages] = useState<InboxMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, startSend] = useTransition();
  const [ai, setAi] = useState<string | null>(null);
  const [aiEditing, setAiEditing] = useState(false);
  const [aiLoading, startAi] = useTransition();
  const [templates, setTemplates] = useState<MessageTemplate[]>([]);
  const [showTemplates, setShowTemplates] = useState(false);
  const [starred, setStarred] = useState(thread.is_starred);
  // Zuweisen / Snooze / Geplant-senden.
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [showAssign, setShowAssign] = useState(false);
  const [showSnooze, setShowSnooze] = useState(false);
  // Überlaufmenü der Kopfleiste (seltene Aktionen mit Text statt Icon-Reihe).
  const [showMore, setShowMore] = useState(false);
  const [scheduled, setScheduled] = useState<ScheduledMessage[]>([]);
  const [showSchedule, setShowSchedule] = useState(false);
  // Anhänge (Bilder/PDF) dieser Konversation.
  const [anhaenge, setAnhaenge] = useState<Attachment[]>([]);
  const [anhangLaeuft, setAnhangLaeuft] = useState(false);
  const dateiFeld = useRef<HTMLInputElement>(null);
  // Sentinel am Listenende — Sprungziel beim Öffnen/Nachrücken.
  const ende = useRef<HTMLDivElement>(null);
  // Grund, warum der Portal-Chat nichts liefert (z. B. Chat für dieses Objekt
  // bei den Portalen nicht freigeschaltet). Ohne diesen Hinweis sieht die
  // Konversation aus wie „der Gast hat nichts geschrieben".
  const [chatGesperrt, setChatGesperrt] = useState<string | null>(null);
  // Lesestand des Gastes (0297): bis zu diesem Zeitpunkt hat er gelesen.
  // null = der Kanal meldet keinen — dann bleibt jedes Häkchen aus.
  const [gelesenBis, setGelesenBis] = useState<string | null>(null);
  // Übersetzung je Nachricht. Zielsprache ist die Oberflächensprache: wer den
  // Posteingang auf Dänisch bedient, will Dänisch lesen.
  const { stand: uebersetzung, umschalten: uebersetzen } =
    useUebersetzung(locale);

  /**
   * Hat der Gast diese Nachricht gelesen?
   *
   * Der Lesestand ist EIN Zeitpunkt („war bis hierher"), kein Häkchen je
   * Nachricht — alles, was davor gesendet wurde, ist damit gelesen. Ohne
   * gemeldeten Lesestand ist die Antwort `false`, und die Oberfläche zeigt
   * dann gar nichts: „wir wissen es nicht" ist nicht „nicht gelesen".
   */
  const gelesen = useCallback(
    (sentAt: string | null) => {
      if (!gelesenBis || !sentAt) return false;
      // Über Zeitwerte, NICHT über String-Vergleich: die Quellen schreiben
      // unterschiedlich („…T08:13:03+00:00" vs. „…T08:13:03Z"), und „Z" sortiert
      // hinter „+" — ein Textvergleich hielte dieselbe Sekunde für später.
      const a = Date.parse(sentAt);
      const b = Date.parse(gelesenBis);
      return Number.isFinite(a) && Number.isFinite(b) && a <= b;
    },
    [gelesenBis],
  );

  const load = useCallback(async () => {
    setLoading(true);
    const res = await getInboxMessages(thread.id);
    setMessages(res.ok ? res.data.items : []);
    setChatGesperrt(res.ok ? (res.data.unavailable ?? null) : null);
    setGelesenBis(res.ok ? (res.data.guest_read_at ?? null) : null);
    if (!res.ok) setError(res.error);
    setLoading(false);
  }, [thread.id]);

  const loadScheduled = useCallback(async () => {
    const res = await listScheduled(thread.id);
    if (res.ok) setScheduled(res.data.items);
  }, [thread.id]);

  const loadAnhaenge = useCallback(async () => {
    const res = await listAttachments(thread.id);
    if (res.ok) setAnhaenge(res.data.items);
  }, [thread.id]);

  useEffect(() => {
    load();
    loadScheduled();
    loadAnhaenge();
  }, [load, loadScheduled, loadAnhaenge]);

  // Ein Chat wird von unten gelesen: die neueste Nachricht ist die, um die es
  // geht. Der Verlauf ist ein normaler `overflow-y-auto`-Container und startet
  // deshalb IMMER oben — bei einem langen Thread landete man beim Öffnen bei
  // der ältesten Nachricht und musste zur eigenen gerade gesendeten Antwort
  // erst runterscrollen.
  //
  // Über ein Sentinel-Element am Listenende statt `scrollTop = scrollHeight`
  // (Muster wie `gastgeber/.../chat-spalte.tsx`, `admin/.../support-konsole.tsx`):
  // `scrollIntoView` misst beim Ausführen selbst, während eine gesetzte Höhe
  // den Stand von VOR dem Nachladen der Iconify-Icons träfe und dann knapp
  // über dem Ende landet.
  //
  // Abhängig von der ANZAHL, nicht vom Array: `load()` setzt bei jedem Lauf
  // eine neue Referenz — jeder eigene Versand und jeder Threadwechsel löst
  // einen Lauf aus. Über die Referenz würde die Ansicht dem Nutzer dabei nach
  // unten springen, während er weiter oben liest.
  useEffect(() => {
    ende.current?.scrollIntoView({ block: "end" });
  }, [messages.length, thread.id]);

  // Der KI-Vorschlag hängt sich ans Ende des Verlaufs. Steht der schon am
  // unteren Rand, liegt der neue Block knapp darunter — man klickt und sieht
  // scheinbar nichts passieren. Das Scrollen gehört in einen Effekt: `suggest`
  // rendert über eine Transition, ein requestAnimationFrame im Klick-Handler
  // läuft daher noch VOR dem Commit und trifft die alte Höhe.
  useEffect(() => {
    if (ai !== null) ende.current?.scrollIntoView({ block: "end" });
  }, [ai]);

  // KEIN Realtime-Abo mehr für den offenen Chat. Alle drei Quellen, die diese
  // Ansicht speisen, sind seit Migration 0337 für `authenticated` gesperrt
  // (Wurzel 6):
  //   - `channex_booking` (trug bis dahin das inhaltsfreie Signal
  //     `last_message_at` aus 0305) — die Spalten `customer`/`raw` enthalten
  //     die Gast-Stammdaten aus dem OTA-Payload,
  //   - `inbox_thread_note` — interne Notizen zum Gast im Klartext,
  //   - `inbox_scheduled_message` — der Text der geplanten Nachricht.
  // Ohne SELECT-Grant passt für `authenticated` keine Policy mehr; ein Abo
  // darauf verbindet sich und bekommt nie ein Event.
  //
  // Eine erlaubte Ersatzquelle gibt es für keine der drei. `reservations` wäre
  // ein stiller Ersatz und damit falsch: weder eine eingehende Nachricht noch
  // eine Notiz noch der Cron-Versand einer geplanten Nachricht berührt eine
  // Zeile in `reservations`. Ein Abo darauf sähe live aus und verpasste genau
  // die Ereignisse, um die es hier geht.
  //
  // WAS DADURCH ENTFÄLLT:
  //   - Eine eingehende Gastnachricht erscheint nicht mehr von selbst im
  //     offenen Verlauf; der eigene Versand lädt weiterhin über `load()` nach.
  //   - Notizen eines Kollegen erscheinen erst beim erneuten Öffnen des
  //     Threads; die eigene Notiz lädt die Liste selbst nach.
  //   - Eine geplante Nachricht verschwindet beim Cron-Versand nicht mehr
  //     selbsttätig aus der Liste, sondern erst beim nächsten Öffnen.
  // Der Threadwechsel lädt beides ohnehin frisch.
  //
  // Dasselbe galt schon vorher für `inbox_attachment` (Migration 0259 — an
  // einem Anhang hängt der Türcode): auch dort kein Abo, aus demselben Grund.

  /** Vorlage einsetzen — serverseitig für DIESEN Thread aufgelöst, damit im
   *  Feld der fertige Text steht und nicht `{{guest_name}}`. Fehlt der Wert
   *  eines Feldes (422), wird der Rohtext eingesetzt und der Grund gezeigt:
   *  besser sichtbar unvollständig als klammheimlich falsch.
   *
   *  Übergeben wird `tpl.body` (KLARTEXT), nicht `tpl.body_html`: der
   *  Chat-Composer ist und bleibt Klartext, weil die Portale im Gast-Chat
   *  keinen Rich-Text übertragen. `body` ist genau der serverseitig aus dem
   *  HTML abgeleitete Text — die Gliederung (Listen, Absätze, Links) steckt
   *  darin bereits als Zeichen, und `textZuHtml` im Composer macht daraus im
   *  Editor wieder echte Knoten. */
  function vorlageEinfuegen(body: string) {
    setShowTemplates(false);
    void (async () => {
      const res = await renderForThread(thread.id, body);
      const eingesetzt = res.ok ? res.data.text : body;
      if (!res.ok) setError(res.error);
      setText((prev) => (prev ? `${prev}\n${eingesetzt}` : eingesetzt));
    })();
  }

  /** Datei anhängen. Der Text im Feld reist als Begleitnachricht mit. */
  function anhangHochladen(datei: File) {
    setError(null);
    setAnhangLaeuft(true);
    void (async () => {
      const res = await uploadAttachment(thread.id, datei, text.trim() || undefined);
      if (res.ok) {
        setText("");
        // Der Kanal kann die Datei ablehnen (Airbnb nimmt kein PDF). Das steht
        // an der Zeile und wird hier sichtbar gemacht statt verschluckt.
        if (res.data.channel_error) setError(res.data.channel_error);
        await loadAnhaenge();
      } else {
        setError(res.error);
      }
      setAnhangLaeuft(false);
    })();
  }

  function anhangEntfernen(id: string) {
    void (async () => {
      await deleteAttachment(id);
      await loadAnhaenge();
    })();
  }

  // Vorlagen + Team einmal laden.
  useEffect(() => {
    (async () => {
      const [tpl, tm] = await Promise.all([listTemplates(), listTeam()]);
      if (tpl.ok) setTemplates(tpl.data.items);
      if (tm.ok) setTeam(tm.data.items);
    })();
  }, []);

  // Interne Notiz (gelb) hinzufügen → sofort im Verlauf zeigen.
  function addInternalNote() {
    const body = window.prompt(t("notePrompt"));
    if (!body?.trim()) return;
    startSend(async () => {
      const res = await addNote(thread.id, body.trim());
      if (res.ok) setMessages((m) => [...m, res.data]);
      else setError(res.error);
    });
  }

  // Konversation zuweisen.
  function assign(member: TeamMember | null) {
    setShowAssign(false);
    startSend(async () => {
      const res = await assignThread(thread.id, member?.id ?? null);
      if (res.ok) onAssigned(member?.id ?? null, member?.name ?? null);
      else setError(res.error);
    });
  }

  // Snooze: Erinnerung relativ zu jetzt (Minuten) setzen.
  function snooze(minutes: number) {
    setShowSnooze(false);
    const at = new Date(Date.now() + minutes * 60_000).toISOString();
    updateThreadFlags(thread.id, { remind_at: at });
  }

  // Nachricht zeitversetzt planen.
  function planMessage(sendAtIso: string) {
    const body = text.trim();
    if (!body) return;
    startSend(async () => {
      const res = await scheduleMessage(thread.id, body, sendAtIso);
      if (res.ok) {
        setScheduled((s) => [...s, res.data]);
        setText("");
        setShowSchedule(false);
      } else {
        setError(res.error);
      }
    });
  }

  async function dropScheduled(id: string) {
    await cancelScheduled(id);
    setScheduled((s) => s.filter((x) => x.id !== id));
  }

  function send(message: string) {
    const msg = message.trim();
    if (!msg) return;
    setError(null);
    startSend(async () => {
      const res = await sendInboxMessage(thread.id, msg);
      if (res.ok) {
        setMessages((m) => [...m, res.data]);
        setText("");
        setAi(null);
        setAiEditing(false);
      } else {
        setError(res.error);
      }
    });
  }

  function suggest() {
    setError(null);
    setAiEditing(false);
    startAi(async () => {
      const res = await getAiReply(thread.id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setAi(res.data.reply);
    });
  }

  return (
    <>
      {/* Kopf mit Aktions-Leiste (wie im Vorbild) */}
      <div className="flex items-center gap-3 border-b border-border p-3">
        <GuestAvatar
          name={thread.guest_name}
          bildUrl={thread.guest_avatar_url}
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-semibold">
            {thread.guest_name ?? t("unknownGuest")}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {/* Objekt zuerst: es beantwortet die häufigste Rückfrage beim Lesen
                eines Threads („welche Unterkunft?"). */}
            {thread.property_title ? `${thread.property_title} · ` : ""}
            {thread.ota_name ? channelLabelLoose(thread.ota_name) : t("directChannel")}
            {thread.ota_reservation_code ? ` · ${thread.ota_reservation_code}` : ""}
          </span>
        </div>
        {/* Aktionsleiste: die vier täglichen Handgriffe stehen offen, der Rest
            liegt im Überlaufmenü. Neun gleich aussehende Icons nebeneinander
            (vorheriger Stand) sind nicht lesbar — beide Vorbilder zeigen
            höchstens fünf und schieben den Rest hinter „⋮". */}
        <div className="flex items-center gap-1 text-muted-foreground">
          {/* Notiz: gelben Eintrag in den Verlauf legen */}
          <HeadAction
            icon="ph:note"
            title={t("addNote")}
            onClick={addInternalNote}
          />
          <HeadAction
            icon={starred ? "ph:star-fill" : "ph:star"}
            title={t("favorite")}
            active={starred}
            onClick={() => {
              const next = !starred;
              setStarred(next);
              updateThreadFlags(thread.id, { is_starred: next });
            }}
          />
          {/* Zuweisen an Team-Benutzer — nur mit INBOX_ASSIGN */}
          {access.canAssign && (
            <div className="relative">
              <HeadAction
                icon="ph:user-circle-gear"
                title={t("assign")}
                active={!!thread.assigned_user_id}
                onClick={() => setShowAssign((v) => !v)}
              />
              {showAssign && (
                <div className="absolute right-0 top-9 z-20 max-h-72 w-56 overflow-y-auto rounded-2xl border border-border bg-card p-1 shadow-xl">
                  <p className="px-2 py-1 text-xs font-semibold text-muted-foreground">
                    {t("assignTo")}
                  </p>
                  {team.length === 0 && (
                    <p className="px-2 py-2 text-xs text-muted-foreground">
                      {t("assignEmpty")}
                    </p>
                  )}
                  {team.map((member) => (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() => assign(member)}
                      className={
                        "flex w-full items-center gap-2 rounded-(--radius) px-2 py-1.5 text-left text-sm hover:bg-muted/50 " +
                        (thread.assigned_user_id === member.id ? "text-accent" : "")
                      }
                    >
                      <Icon icon="ph:user" className="size-4" />
                      {member.name}
                    </button>
                  ))}
                  {thread.assigned_user_id && (
                    <button
                      type="button"
                      onClick={() => assign(null)}
                      className="mt-1 flex w-full items-center gap-2 rounded-(--radius) px-2 py-1.5 text-left text-sm text-destructive hover:bg-muted/50"
                    >
                      <Icon icon="ph:user-minus" className="size-4" />
                      {t("assignNone")}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          {/* Wiederherstellen, wenn nicht in der aktiven Ansicht */}
          {view !== "active" && (
            <HeadAction
              icon="ph:arrow-counter-clockwise"
              title={t("restore")}
              onClick={() => onStatus("active")}
            />
          )}
          {/* Archivieren nur aus der aktiven Ansicht */}
          {view === "active" && (
            <HeadAction
              icon="ph:archive-box"
              title={t("archive")}
              onClick={() => onStatus("archived")}
            />
          )}
          {/* Überlaufmenü: seltener gebrauchte Aktionen — MIT Text, nicht als
              weitere namenlose Icons. */}
          <div className="relative">
            <HeadAction
              icon="ph:dots-three-vertical"
              title={t("moreActions")}
              onClick={() => setShowMore((v) => !v)}
            />
            {showMore && (
              <div className="absolute right-0 top-9 z-20 w-56 rounded-2xl border border-border bg-card p-1 shadow-xl">
                <MenuAction
                  icon="ph:eye-slash"
                  label={t("markUnread")}
                  onClick={() => {
                    setShowMore(false);
                    onMarkUnread();
                  }}
                />
                {/* Snooze mit Untermenü der Fristen */}
                <button
                  type="button"
                  onClick={() => setShowSnooze((v) => !v)}
                  className="flex w-full items-center gap-2 rounded-(--radius) px-2 py-1.5 text-left text-sm hover:bg-muted/50"
                >
                  <Icon icon="ph:alarm" className="size-4 text-muted-foreground" />
                  <span className="flex-1">{t("snooze")}</span>
                  <Icon
                    icon={showSnooze ? "ph:caret-up" : "ph:caret-down"}
                    className="size-3.5 text-muted-foreground"
                  />
                </button>
                {showSnooze &&
                  [
                    { label: t("snooze20m"), m: 20 },
                    { label: t("snooze1h"), m: 60 },
                    { label: t("snooze3h"), m: 180 },
                    { label: t("snooze6h"), m: 360 },
                    { label: t("snooze1d"), m: 1440 },
                  ].map((opt) => (
                    <button
                      key={opt.m}
                      type="button"
                      onClick={() => {
                        setShowMore(false);
                        snooze(opt.m);
                      }}
                      className="flex w-full rounded-(--radius) py-1.5 pl-8 pr-2 text-left text-sm hover:bg-muted/50"
                    >
                      {opt.label}
                    </button>
                  ))}
                <MenuAction
                  icon="ph:user"
                  label={t("guestProfile")}
                  onClick={() => {
                    setShowMore(false);
                    onOpenNote();
                  }}
                />
                <MenuAction
                  icon="ph:caret-right"
                  label={t("next")}
                  onClick={() => {
                    setShowMore(false);
                    onNext();
                  }}
                />
                <div className="my-1 border-t border-border" />
                {/* Papierkorb bzw. endgültig löschen (im Papierkorb) */}
                {view === "trashed" ? (
                  <MenuAction
                    icon="ph:trash-simple"
                    label={t("deleteForever")}
                    destructive
                    onClick={() => {
                      setShowMore(false);
                      if (window.confirm(t("deleteConfirm"))) onStatus("deleted");
                    }}
                  />
                ) : (
                  <MenuAction
                    icon="ph:trash"
                    label={t("trash")}
                    destructive
                    onClick={() => {
                      setShowMore(false);
                      onStatus("trashed");
                    }}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Verlauf */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">…</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noMessages")}</p>
        ) : (
          messages.map((m, i) => (
            <Fragment key={m.id ?? i}>
              {/* Datums-Trenner: beide Vorbilder gliedern den Verlauf nach Tagen
                  statt jede Nachricht mit vollem Datum zu beschriften. */}
              {tagWechsel(messages[i - 1]?.sent_at ?? null, m.sent_at) && (
                <div className="flex items-center gap-3 py-1">
                  <span className="h-px flex-1 bg-border" />
                  <span className="rounded-full bg-secondary px-3 py-1 text-[0.7rem] font-medium text-muted-foreground">
                    {tagLabel(m.sent_at, locale, t)}
                  </span>
                  <span className="h-px flex-1 bg-border" />
                </div>
              )}
              {m.sender === "event" ? (
                <EventCard message={m} locale={locale} />
              ) : m.sender === "note" ? (
              // Interne Notiz — gelb, mittig (wie im Vorbild).
              <div className="flex flex-col items-center gap-1">
                <div className="max-w-[85%] rounded-2xl border border-amber-300 bg-amber-100 px-3 py-2 text-sm text-amber-900">
                  <span className="mb-0.5 flex items-center gap-1 text-[0.65rem] font-semibold uppercase tracking-wide text-amber-700">
                    <Icon icon="ph:note-pencil" className="size-3.5" />
                    {t("internalNote")}
                    {m.author_name ? ` · ${m.author_name}` : ""}
                  </span>
                  <span className="whitespace-pre-wrap">{m.message}</span>
                </div>
                {m.sent_at && (
                  <span
                    className="text-[0.65rem] text-muted-foreground"
                    title={zeitpunktLang(m.sent_at, locale)}
                  >
                    {uhrzeit(m.sent_at, locale)}
                  </span>
                )}
              </div>
            ) : (
              <div
                className={
                  "flex flex-col gap-1 " +
                  (m.sender === "property" ? "items-end" : "items-start")
                }
              >
                {/* `whitespace-pre-wrap`: die Portale liefern den Text mit
                    echten Zeilenumbrüchen (\n) — ohne das rendert eine
                    gegliederte Willkommensnachricht als eine Textwand, in der
                    Check-in-Zeit und Türcode untergehen. `break-words` fängt
                    die langen Links ab, die sonst über die Blase hinauslaufen. */}
                {/* Die Textblase entfällt, wenn der Gast NUR ein Foto
                    geschickt hat (Channex liefert die Nachricht dann mit
                    leerem Text) — sonst stünde hier ein leerer grauer Kasten,
                    genau der Zustand vor diesem Fix. */}
                {m.message.trim() && (
                  <div
                    className={
                      "max-w-[80%] whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm " +
                      (m.sender === "property"
                        ? "bg-accent text-white"
                        : "bg-muted text-foreground")
                    }
                  >
                    {/* Übersetzung ersetzt den Text nur, solange sie
                        eingeschaltet ist — das Original ist immer einen Klick
                        entfernt und bleibt die Quelle (Wurzel 4). */}
                    {uebersetzung[m.id ?? ""]?.sichtbar
                      ? uebersetzung[m.id ?? ""]?.text
                      : m.message}
                  </div>
                )}

                {/* „Übersetzen" / „Original anzeigen" — Form von Airbnb und
                    Booking übernommen: unscheinbarer Textknopf unter der
                    Blase, nie automatisch. Automatisches Übersetzen kostet je
                    Zeichen und träfe auch Nachrichten, die niemand liest. */}
                {uebersetzbar(m.sender, m.message) && m.id && (
                  <div className="flex max-w-[80%] flex-col items-start gap-0.5">
                    <button
                      type="button"
                      onClick={() => void uebersetzen(m.id as string, m.message)}
                      disabled={uebersetzung[m.id]?.laeuft}
                      className="flex items-center gap-1 text-[0.7rem] font-medium text-muted-foreground hover:text-accent disabled:opacity-60"
                    >
                      <Icon
                        icon={
                          uebersetzung[m.id]?.laeuft
                            ? "ph:spinner"
                            : "ph:translate"
                        }
                        className={
                          "size-3.5 " +
                          (uebersetzung[m.id]?.laeuft ? "animate-spin" : "")
                        }
                      />
                      {uebersetzung[m.id]?.sichtbar
                        ? t("showOriginal")
                        : t("translate")}
                    </button>
                    {/* Woher der Text stammt, sobald übersetzt wurde — sonst
                        wüsste niemand, ob „Übersetzen" etwas getan hat, wenn
                        Gast und Betrieb dieselbe Sprache sprechen. */}
                    {uebersetzung[m.id]?.sichtbar &&
                      uebersetzung[m.id]?.quelle && (
                        <span className="text-[0.65rem] text-muted-foreground">
                          {t("translatedFrom", {
                            sprache: sprachName(
                              uebersetzung[m.id]?.quelle as string,
                              locale,
                            ),
                          })}
                        </span>
                      )}
                    {/* Fehler stehen an der Nachricht, nicht in einem Toast,
                        der weg ist, bevor man ihn liest. */}
                    {uebersetzung[m.id]?.fehler && (
                      <span className="text-[0.65rem] text-destructive">
                        {uebersetzung[m.id]?.fehler}
                      </span>
                    )}
                  </div>
                )}

                {/* Bildanhänge. Jede URL hat serverseitig die Prüfung auf
                    https + bekannten Host passiert (`_sichere_anhaenge`) —
                    hier wird nichts nachgebessert, was dort durchfiel.
                    `rel="noreferrer"`, damit das Öffnen im neuen Tab dem
                    fremden Host nicht verrät, aus welchem Thread es kam. */}
                {m.attachments?.map((url) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="max-w-[80%] overflow-hidden rounded-2xl border border-border"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element --
                        fremder Host, den `next/image` nicht optimieren kann. */}
                    <img
                      src={url}
                      alt={t("attachmentAlt")}
                      loading="lazy"
                      className="block max-h-80 w-auto object-cover"
                    />
                  </a>
                ))}
                {m.sent_at && (
                  <span
                    className="flex items-center gap-1 text-[0.65rem] text-muted-foreground"
                    title={zeitpunktLang(m.sent_at, locale)}
                  >
                    {uhrzeit(m.sent_at, locale)}
                    {/* Lesebestätigung nur an EIGENEN Nachrichten und nur, wenn
                        der Kanal einen Lesestand meldet (0297, aktuell Airbnb).
                        Fehlt er, steht hier NICHTS — ein graues Häkchen würde
                        „noch nicht gelesen" behaupten, was wir nicht wissen. */}
                    {m.sender === "property" && gelesen(m.sent_at) && (
                      <span title={t("readByGuest")} className="flex">
                        <Icon icon="ph:checks" className="size-3.5 text-accent" />
                      </span>
                    )}
                  </span>
                )}
              </div>
              )}
            </Fragment>
          ))
        )}

        {/* Kein Verlauf vom Portal — und zwar aus einem von zwei Gründen, die
            beide dastehen müssen, sonst wartet jemand auf eine Antwort, die
            nicht kommen kann: der Buchungskanal überträgt gar keine Nachrichten
            (Direkt, CRS, kleine Portale), oder das Portal ist gerade nicht
            erreichbar. Etwas zum Anklicken gibt es hier nicht — die Chat-
            Funktion hängt am verbundenen Objekt und richtet sich selbst. */}
        {chatGesperrt && (
          <div className="flex items-start gap-2 rounded-2xl border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
            <Icon icon="ph:info" className="mt-0.5 size-4 shrink-0" />
            <span>
              {chatGesperrt === "channel_no_chat"
                ? t("channelNoChat")
                : t("chatUnavailable")}
            </span>
          </div>
        )}

        {/* KI-Vorschlag INLINE im Chat-Verlauf (wie im Vorbild). 'Bearbeiten'
            macht den Vorschlag direkt im Block editierbar. */}
        {ai !== null && (
          <div className="rounded-2xl border border-accent/50 bg-accent/5 p-4">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-sm font-medium text-accent">
                <Icon icon="ph:sparkle" className="size-4" />
                {t("aiTitle")}
              </span>
              <button
                type="button"
                aria-label="Verwerfen"
                onClick={() => {
                  setAi(null);
                  setAiEditing(false);
                }}
                className="text-muted-foreground hover:text-foreground"
              >
                <Icon icon="ph:x" className="size-4" />
              </button>
            </div>

            {aiEditing ? (
              <textarea
                data-testid="inbox-ai-draft-textarea"
                value={ai}
                onChange={(e) => setAi(e.target.value)}
                rows={6}
                autoFocus
                className="w-full resize-none rounded-(--radius) border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
              />
            ) : (
              <p data-testid="inbox-ai-draft-preview" className="whitespace-pre-wrap text-sm">{ai}</p>
            )}

            <div className="mt-3 flex justify-end gap-2">
              {aiEditing ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAiEditing(false)}
                >
                  {t("aiDone")}
                </Button>
              ) : (
                <Button
                  data-testid="inbox-ai-edit-button"
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setAiEditing(true)}
                >
                  <Icon icon="ph:pencil-simple" className="size-4" />
                  {t("aiEdit")}
                </Button>
              )}
              <Button
                data-testid="inbox-ai-send-button"
                type="button"
                size="sm"
                onClick={() => send(ai)}
                disabled={sending || !ai.trim()}
              >
                <Icon icon="ph:paper-plane-tilt" className="size-4" />
                {t("send")}
              </Button>
            </div>
          </div>
        )}

        {/* Sprungziel „ganz unten". Steht NACH dem KI-Block, damit auch der
            beim Aufklappen vollständig sichtbar wird. */}
        <div ref={ende} />
      </div>

      {/* Anstehende geplante Nachrichten */}
      {scheduled.length > 0 && (
        <div className="mx-4 mb-2 rounded-2xl border border-border bg-muted/30 p-3">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <Icon icon="ph:clock-countdown" className="size-4" />
            {t("upcomingScheduled")}
          </p>
          <ul className="flex flex-col gap-1">
            {scheduled.map((s) => (
              <li key={s.id} className="flex items-center gap-2 text-sm">
                <span className="text-xs text-muted-foreground">
                  {new Date(s.send_at).toLocaleString(locale)}
                </span>
                <span className="min-w-0 flex-1 truncate">{s.body}</span>
                <button
                  type="button"
                  aria-label={t("cancel")}
                  onClick={() => dropScheduled(s.id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Icon icon="ph:x" className="size-4" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <p className="mx-4 mb-2 rounded-(--radius) bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* Übernommener Verlauf: eingefrorenes Archiv aus einem fremden PMS. Der
          Kanal, über den er lief, gehört uns nicht mehr — es gibt keinen Weg,
          auf dem eine Antwort den Gast erreichen würde. Deshalb gar kein
          Eingabefeld statt eines Sendeknopfes, der 422 zurückgibt. */}
      {istUebernahme(thread.id) ? (
        <div className="flex items-center gap-2 border-t border-border p-4 text-sm text-muted-foreground">
          <Icon icon="ph:archive" className="size-4" />
          {t("uebernahmeHint")}
        </div>
      ) : /* Antwortfeld — nur mit INBOX_REPLY; sonst Read-Only-Hinweis */
      !access.canReply ? (
        <div className="flex items-center gap-2 border-t border-border p-4 text-sm text-muted-foreground">
          <Icon icon="ph:lock-simple" className="size-4" />
          {t("readOnlyHint")}
        </div>
      ) : (
        // Composer als EINE Eingabe-Box (moderner Messenger-Stil): Textarea oben,
        // Werkzeug-Zeile (Vorlagen/KI/Geplant + Senden) INNEN unten rechts. So
        // bleibt das Textfeld in jeder Spaltenbreite voll breit — ohne Breakpoints.
        <div className="relative border-t border-border p-3">
          {anhaenge.length > 0 && (
            <ul className="mb-2 flex flex-wrap gap-2">
              {anhaenge.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center gap-2 rounded-full border border-border bg-muted/40 py-1 pr-1 pl-2.5 text-xs"
                >
                  <Icon
                    icon={
                      a.mime === "application/pdf" ? "ph:file-pdf" : "ph:image"
                    }
                    className="size-4 shrink-0 text-muted-foreground"
                  />
                  {a.url ? (
                    <a
                      href={a.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="max-w-[12rem] truncate hover:underline"
                    >
                      {a.filename}
                    </a>
                  ) : (
                    <span className="max-w-[12rem] truncate">{a.filename}</span>
                  )}
                  {/* Beim Gast angekommen oder nur bei uns? Der Unterschied ist
                      der Punkt — ein hochgeladener Anhang ist noch kein
                      zugestellter. */}
                  <span
                    title={
                      a.sent_at
                        ? t("attachSent")
                        : (a.channel_error ?? t("attachNotSent"))
                    }
                    className="shrink-0"
                  >
                    <Icon
                      icon={a.sent_at ? "ph:check-circle" : "ph:warning-circle"}
                      className={
                        "size-4 " +
                        (a.sent_at ? "text-emerald-600" : "text-amber-600")
                      }
                    />
                  </span>
                  <button
                    type="button"
                    onClick={() => anhangEntfernen(a.id)}
                    title={t("attachRemove")}
                    className="rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Icon icon="ph:x" className="size-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <div className="flex flex-col rounded-2xl border border-border bg-background focus-within:ring-2 focus-within:ring-accent/40">
            {/* Geplant-senden-Popover */}
            {showSchedule && (
              <SchedulePopover
                onClose={() => setShowSchedule(false)}
                onPick={planMessage}
                disabled={!text.trim()}
              />
            )}
            {/* Vorlagen-Dropdown */}
            {showTemplates && (
              <div className="absolute bottom-full left-3 z-10 mb-1 max-h-60 w-72 overflow-y-auto rounded-2xl border border-border bg-card p-1 shadow-xl">
                {templates.length === 0 ? (
                  <p className="p-3 text-sm text-muted-foreground">
                    {t("templatesEmpty")}
                  </p>
                ) : (
                  templates.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => vorlageEinfuegen(tpl.body)}
                      className="flex w-full flex-col gap-0.5 rounded-(--radius) p-2 text-left hover:bg-muted/50"
                    >
                      <span className="text-sm font-medium">{tpl.title}</span>
                      <span className="line-clamp-1 text-xs text-muted-foreground">
                        {tpl.body}
                      </span>
                    </button>
                  ))
                )}
              </div>
            )}
            <ComposerEditor
              wert={text}
              onChange={setText}
              onSenden={send}
              platzhalter={t("placeholder")}
              etiketten={{
                bold: t("formatBold"),
                italic: t("formatItalic"),
                underline: t("formatUnderline"),
                strike: t("formatStrike"),
                bulletList: t("formatBulletList"),
                orderedList: t("formatOrderedList"),
                link: t("formatLink"),
                code: t("formatCode"),
                linkPrompt: t("formatLinkPrompt"),
                resize: t("formatResize"),
              }}
            />
            {/* Werkzeuge links MIT Text (Lodgify beschriftet sie ebenfalls —
                drei namenlose Icons neben dem Senden-Knopf raten sich schlecht),
                der Text weicht erst in schmalen Spalten. */}
            <div className="flex items-center gap-1.5 px-2 pb-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                title={t("tabTemplates")}
                onClick={() => setShowTemplates((v) => !v)}
              >
                <Icon icon="ph:note" className="size-4" />
                <span className="hidden xl:inline">{t("tabTemplates")}</span>
              </Button>
              <Button
                data-testid="inbox-ai-reply-button"
                type="button"
                variant="ghost"
                size="sm"
                title={t("aiSuggest")}
                onClick={suggest}
                disabled={aiLoading}
              >
                <Icon
                  icon={aiLoading ? "ph:spinner" : "ph:sparkle"}
                  className={"size-4 " + (aiLoading ? "animate-spin" : "")}
                />
                <span className="hidden xl:inline">{t("aiSuggest")}</span>
              </Button>
              {/* Geplant senden (Uhr) */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                title={t("scheduleSend")}
                onClick={() => setShowSchedule((v) => !v)}
              >
                <Icon icon="ph:clock" className="size-4" />
                <span className="hidden xl:inline">{t("scheduleSend")}</span>
              </Button>
              {/* Anhang. Der Text im Feld reist als Begleitnachricht mit, damit
                  „Hier die Anfahrt:" und die Datei beim Gast zusammen ankommen. */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                title={t("attach")}
                onClick={() => dateiFeld.current?.click()}
                disabled={anhangLaeuft}
              >
                <Icon
                  icon={anhangLaeuft ? "ph:spinner" : "ph:paperclip"}
                  className={"size-4 " + (anhangLaeuft ? "animate-spin" : "")}
                />
                <span className="hidden xl:inline">{t("attach")}</span>
              </Button>
              <input
                ref={dateiFeld}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
                className="hidden"
                onChange={(e) => {
                  const datei = e.target.files?.[0];
                  // Wert zurücksetzen, sonst löst dieselbe Datei kein zweites
                  // change-Ereignis aus (bekannte Falle beim file-Input).
                  e.target.value = "";
                  if (datei) anhangHochladen(datei);
                }}
              />
              <span className="flex-1" />
              <Button data-testid="inbox-composer-send-button" type="button" onClick={() => send(text)} disabled={sending || !text.trim()}>
                <Icon
                  icon={sending ? "ph:spinner" : "ph:paper-plane-tilt"}
                  className={"size-4 " + (sending ? "animate-spin" : "")}
                />
                {sending ? t("sending") : t("send")}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp-Verlauf desselben Gastes — UNTER dem Kanal-Chat, sichtbar mit
          ihm verbunden. Er ersetzt den Buchungs-Chat nicht: Gast und Buchung
          bleiben oben stehen, WhatsApp ist der zweite Draht zur selben Person. */}
      {whatsapp && (
        <div className="flex min-h-0 shrink-0 basis-1/2 flex-col border-t-2 border-emerald-600/40">
          <div className="flex items-center gap-2 bg-emerald-500/5 px-3 py-2">
            <Icon icon="ph:whatsapp-logo" className="size-4 text-emerald-600" />
            <span className="text-sm font-semibold">
              {t("whatsappWithGuest", {
                name: thread.guest_name ?? t("unknownGuest"),
              })}
            </span>
            <span className="truncate text-xs text-muted-foreground">
              +{whatsapp.phone}
            </span>
            <button
              type="button"
              title={t("close")}
              aria-label={t("close")}
              onClick={onCloseWhatsapp}
              className="ml-auto flex size-7 items-center justify-center rounded-(--radius) text-muted-foreground hover:bg-muted/60 hover:text-foreground"
            >
              <Icon icon="ph:x" className="size-4" />
            </button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            <WhatsAppChat
              key={whatsapp.phone}
              conversationId={whatsapp.conversationId}
              phone={whatsapp.phone}
              name={thread.guest_name}
              onSent={() => undefined}
              kompakt
            />
          </div>
        </div>
      )}
    </>
  );
}

// --- Geplant senden (Popover über dem Antwortfeld) --------------------------
function SchedulePopover({
  onClose,
  onPick,
  disabled,
}: {
  onClose: () => void;
  onPick: (sendAtIso: string) => void;
  disabled: boolean;
}) {
  const t = useTranslations("inbox");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("09:00");

  function schedule() {
    if (!date) return;
    // Lokale Zeit → ISO (UTC) für die Speicherung.
    const local = new Date(`${date}T${time}:00`);
    onPick(local.toISOString());
  }

  return (
    <div className="absolute bottom-full right-3 z-20 mb-1 w-64 rounded-2xl border border-border bg-card p-3 shadow-xl">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold">{t("schedulePick")}</span>
        <button
          type="button"
          aria-label={t("close")}
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
        >
          <Icon icon="ph:x" className="size-4" />
        </button>
      </div>
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="mb-2 w-full rounded-(--radius) border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
      />
      <input
        type="time"
        value={time}
        onChange={(e) => setTime(e.target.value)}
        className="mb-3 w-full rounded-(--radius) border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
      />
      {disabled && (
        <p className="mb-2 text-xs text-muted-foreground">{t("scheduleNeedsText")}</p>
      )}
      <Button
        type="button"
        size="sm"
        className="w-full"
        onClick={schedule}
        disabled={disabled || !date}
      >
        <Icon icon="ph:clock" className="size-4" />
        {t("scheduleSend")}
      </Button>
    </div>
  );
}

/**
 * Ereignis der Reservierung im Verlauf — aufklappbar, wie bei Lodgify
 * („Gast macht Buchung · 22:18 · Booking.com · Mehr anzeigen").
 *
 * Jede Angabe stammt vom Portal: die Uhrzeit ist der Eingang der Buchung bei
 * den Portalen (nicht unser Import), der Kanal der von dort gemeldete Name, und
 * die aufgeklappten Zeilen sind Rohwerte — nur ihr Etikett wird übersetzt. Ein
 * fertig formulierter Satz käme sonst deutsch aus dem Server in eine Oberfläche
 * mit 24 Sprachen.
 */
function EventCard({
  message,
  locale,
}: {
  message: InboxMessage;
  locale: string;
}) {
  const t = useTranslations("inbox");
  const [offen, setOffen] = useState(false);
  const gebucht = message.event_title === "bookingReceived";
  const titel = gebucht ? t("eventBookingReceived") : t("eventStatusChanged");
  const fakten = message.event_facts ?? [];
  // Statuswechsel: der rohe Enum-Wert kommt aus dem Backend, die Worte hier.
  const status =
    message.event_detail === "cancelled"
      ? t("filterStatusCancelled")
      : message.event_detail === "modified"
        ? t("filterStatusModified")
        : message.event_detail;
  const aufklappbar = gebucht ? fakten.length > 0 : Boolean(status);

  return (
    <div
      className={
        "rounded-2xl border px-3 py-2 " +
        (gebucht
          ? "border-emerald-500/30 bg-emerald-500/5"
          : "border-border bg-muted/40")
      }
    >
      <div className="flex items-center gap-2 text-sm">
        <Icon
          icon={gebucht ? "ph:chat-circle-text" : "ph:arrows-left-right"}
          className="size-4 shrink-0 text-muted-foreground"
        />
        <span className="text-muted-foreground">{titel}</span>
        {message.sent_at && (
          <span
            className="text-muted-foreground"
            title={zeitpunktLang(message.sent_at, locale)}
          >
            · {uhrzeit(message.sent_at, locale)}
          </span>
        )}
        {gebucht && message.event_channel && (
          <span className="flex items-center gap-1 truncate font-medium text-emerald-600 dark:text-emerald-400">
            <Icon icon="ph:check-circle" className="size-4 shrink-0" />
            {message.event_channel}
          </span>
        )}
        {aufklappbar && (
          <button
            type="button"
            onClick={() => setOffen((v) => !v)}
            className="ml-auto flex shrink-0 items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            {offen ? t("eventLess") : t("eventMore")}
            <Icon icon={offen ? "ph:caret-up" : "ph:caret-down"} className="size-3.5" />
          </button>
        )}
      </div>
      {offen && (
        <div className="mt-2 space-y-1 border-t border-border/60 pt-2 text-sm">
          {!gebucht && status && <p>{status}</p>}
          {fakten.map((f) => (
            <p key={f.label} className="flex flex-wrap gap-x-2">
              <span className="text-muted-foreground">{eventFaktLabel(t, f.label)}</span>
              <span className="font-medium">{f.value}</span>
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Etikett einer Ereignis-Zeile. Der Server schickt ein Kürzel, keinen Satz —
 * unbekannte Kürzel (neuere API als Oberfläche) stehen roh da, statt die Seite
 * mit MISSING_MESSAGE abzubrechen.
 */
function eventFaktLabel(t: ReturnType<typeof useTranslations>, label: string) {
  switch (label) {
    case "reservationCode":
      return t("eventFactReservationCode");
    case "arrival":
      return t("eventFactArrival");
    case "departure":
      return t("eventFactDeparture");
    case "bookedAtOta":
      return t("eventFactBookedAtOta");
    case "importedAt":
      return t("eventFactImportedAt");
    default:
      return label;
  }
}

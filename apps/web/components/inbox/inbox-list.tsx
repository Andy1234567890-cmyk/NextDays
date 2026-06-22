"use client";

// Posteingang (Guest Messaging) im 3-Spalten-Layout — das Gerüst steht IMMER,
// auch wenn keine Nachrichten da sind (Tabs, Filterleiste, leere Spalten):
//   links   – Thread-Liste (Gast, Aufenthalt, Vorschau, Kanal-Icon, Suche)
//   mitte   – Chat-Verlauf + KI-Antwortvorschlag (Groq) + Antwortfeld
//   rechts  – Reservierungs-Panel (Unterkunft, Kontakt, Nächte, Preis, Daten)
// Nachrichten werden live über Channex gelesen/gesendet (Booking.com/Airbnb/Expedia);
// im Sandbox-Modus über den lokalen Mock-Speicher.
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { AiSettingsTab } from "@/components/inbox/ai-settings-tab";
import { AutomationsTab } from "@/components/inbox/automations-tab";
import { ManageTab } from "@/components/inbox/manage-tab";
import { TemplatesTab } from "@/components/inbox/templates-tab";
import { WhatsAppPanel } from "@/components/inbox/whatsapp-panel";
import { Button } from "@/components/ui/button";
import {
  type InboxMessage,
  type InboxThread,
  type MessageTemplate,
  type ReservationDetail,
  type ScheduledMessage,
  type TeamMember,
  addNote,
  assignThread,
  bulkUpdate,
  cancelScheduled,
  getAiReply,
  getInboxMessages,
  getInboxReservation,
  listInboxThreads,
  listScheduled,
  listTeam,
  listTemplates,
  scheduleMessage,
  sendInboxMessage,
  updateThreadFlags,
} from "@/lib/inbox";
import { useRealtime } from "@/lib/use-realtime";

type TabKey =
  | "tabInbox"
  | "tabWhatsApp"
  | "tabAiReplies"
  | "tabTemplates"
  | "tabAutomations"
  | "tabManage";

const OTA_ICON: Record<string, string> = {
  "booking.com": "simple-icons:bookingdotcom",
  airbnb: "simple-icons:airbnb",
  expedia: "simple-icons:expedia",
  vrbo: "ph:house",
};

function otaIcon(name: string | null): string {
  if (!name) return "ph:chat-circle";
  return OTA_ICON[name.trim().toLowerCase()] ?? "ph:globe";
}

function fmtRange(a: string | null, b: string | null): string {
  if (!a) return "";
  const f = (s: string) =>
    new Date(`${s}T00:00:00`).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "short",
      year: "2-digit",
    });
  return b ? `${f(a)} - ${f(b)}` : f(a);
}

export function InboxList({
  threads,
  error,
}: {
  threads: InboxThread[];
  error: string | null;
}) {
  const t = useTranslations("inbox");
  const [query, setQuery] = useState("");
  // Lokale Thread-Liste, damit Archivieren/Ungelesen sofort sichtbar werden.
  const [rows, setRows] = useState<InboxThread[]>(threads);
  const [active, setActive] = useState<string | null>(threads[0]?.id ?? null);
  const [tab, setTab] = useState<TabKey>("tabInbox");
  // Signal an das Panel: Notizfeld öffnen (Zähler erzwingt erneutes Auslösen).
  const [openNoteSignal, setOpenNoteSignal] = useState(0);
  // Nur „nicht zugewiesene" Konversationen anzeigen (Filter-Panel).
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);
  const [showFilter, setShowFilter] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  // Archiv-Ansicht: zeigt archivierte Konversationen statt der aktiven.
  const [showArchived, setShowArchived] = useState(false);
  const current = rows.find((x) => x.id === active) ?? null;

  // Threads je Modus (aktiv/archiviert) laden — auch für Realtime-Reload.
  const reloadThreads = useCallback(async () => {
    const res = await listInboxThreads({ archived: showArchived });
    if (res.ok) {
      setRows(res.data.items);
      setActive((cur) =>
        res.data.items.some((r) => r.id === cur) ? cur : res.data.items[0]?.id ?? null,
      );
    }
  }, [showArchived]);
  useEffect(() => {
    reloadThreads();
  }, [reloadThreads]);
  useRealtime({ table: "channex_booking", onChange: reloadThreads });

  const filtered = rows.filter(
    (th) =>
      (!onlyUnassigned || !th.assigned_user_id) &&
      (th.guest_name ?? "").toLowerCase().includes(query.trim().toLowerCase()),
  );

  // Eine Konversation lokal patchen (z.B. nach Ungelesen/Archiv/Favorit).
  function patchThread(id: string, patch: Partial<InboxThread>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  // Aktion: archivieren → aus aktiver Liste nehmen + nächste auswählen.
  async function archive(id: string) {
    await updateThreadFlags(id, { is_archived: true });
    const rest = filtered.filter((r) => r.id !== id);
    setRows((prev) => prev.filter((r) => r.id !== id));
    setActive(rest[0]?.id ?? null);
  }

  // Aktion: aus dem Archiv wiederherstellen → zurück in den aktiven Posteingang.
  async function restore(id: string) {
    await updateThreadFlags(id, { is_archived: false });
    const rest = filtered.filter((r) => r.id !== id);
    setRows((prev) => prev.filter((r) => r.id !== id));
    setActive(rest[0]?.id ?? null);
  }

  // Aktion: als ungelesen markieren.
  async function markUnread(id: string) {
    await updateThreadFlags(id, { is_read: false });
    patchThread(id, { is_read: false });
  }

  // Aktion: nächste Konversation in der gefilterten Liste.
  function gotoNext(id: string) {
    const idx = filtered.findIndex((r) => r.id === id);
    const next = filtered[idx + 1] ?? filtered[0];
    if (next) setActive(next.id);
  }

  // Thread öffnen → automatisch als gelesen markieren.
  function selectThread(id: string) {
    setActive(id);
    const th = rows.find((r) => r.id === id);
    if (th && !th.is_read) {
      patchThread(id, { is_read: true });
      updateThreadFlags(id, { is_read: true });
    }
  }

  const TABS: TabKey[] = [
    "tabInbox",
    "tabWhatsApp",
    "tabAiReplies",
    "tabTemplates",
    "tabAutomations",
    "tabManage",
  ];

  return (
    // Vollflächen-Tab: negativer Margin hebt das main-Padding (p-4/md:p-6) auf,
    // damit der Posteingang die gesamte Fläche nutzt. Eigene Nav-Bar (Titel+Tabs).
    <div className="-m-4 flex h-[calc(100vh-4rem)] flex-col md:-m-6">
      {/* Eigene Nav-Bar des Tabs: klickbare Tabs (Seitentitel steht in der Topbar) */}
      <header className="flex flex-wrap items-center gap-5 border-b border-border px-6 py-3 text-sm">
        {TABS.map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={
              key === tab
                ? "border-b-2 border-accent pb-1 font-semibold text-accent"
                : "pb-1 text-muted-foreground hover:text-foreground"
            }
          >
            {t(key)}
          </button>
        ))}
        {tab === "tabInbox" && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="ml-auto"
            onClick={() => setShowBulk(true)}
          >
            <Icon icon="ph:list-checks" className="size-4" />
            {t("bulkUpdate")}
          </Button>
        )}
      </header>

      {showBulk && (
        <BulkUpdateDialog
          onClose={() => setShowBulk(false)}
          onDone={(action) => {
            setShowBulk(false);
            // Lokal spiegeln: betroffene Threads als gelesen/archiviert.
            setRows((prev) =>
              prev.map((r) =>
                action === "archived"
                  ? { ...r, is_archived: true }
                  : { ...r, is_read: true },
              ),
            );
          }}
        />
      )}

      {/* Andere Tabs: eigene Inhalte */}
      {tab === "tabWhatsApp" ? (
        <WhatsAppPanel />
      ) : tab === "tabTemplates" ? (
        <TemplatesTab />
      ) : tab === "tabAiReplies" ? (
        <AiSettingsTab />
      ) : tab === "tabAutomations" ? (
        <AutomationsTab />
      ) : tab === "tabManage" ? (
        <ManageTab />
      ) : (
        <>
      {error && (
        <p className="mx-6 mt-3 rounded-(--radius) bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* 3-Spalten-Gerüst — IMMER sichtbar, füllt die restliche Fläche */}
      <div className="grid min-h-0 flex-1 grid-cols-12 gap-3 p-4">
        {/* Spalte 1: Thread-Liste */}
        <div className="col-span-12 flex min-h-0 flex-col rounded-2xl border border-border bg-card sm:col-span-4 lg:col-span-3 xl:col-span-3">
          {/* Filterleiste */}
          <div className="relative flex items-center gap-2 border-b border-border p-2">
            <button
              type="button"
              title={t("filter")}
              onClick={() => setShowFilter((v) => !v)}
              className={
                "flex size-8 items-center justify-center rounded-(--radius) " +
                (onlyUnassigned
                  ? "bg-accent/10 text-accent"
                  : "bg-secondary text-muted-foreground hover:text-foreground")
              }
            >
              <Icon icon="ph:funnel" className="size-4" />
            </button>
            {/* Aktiv / Archiv umschalten */}
            <button
              type="button"
              title={showArchived ? t("showActive") : t("showArchived")}
              onClick={() => {
                setShowArchived((v) => !v);
                setActive(null);
              }}
              className={
                "flex size-8 items-center justify-center rounded-(--radius) " +
                (showArchived
                  ? "bg-accent/10 text-accent"
                  : "bg-secondary text-muted-foreground hover:text-foreground")
              }
            >
              <Icon
                icon={showArchived ? "ph:tray" : "ph:archive-box"}
                className="size-4"
              />
            </button>
            <div className="flex flex-1 items-center gap-2 rounded-full border border-border px-3 py-1.5">
              <Icon icon="ph:magnifying-glass" className="size-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("searchGuests")}
                className="w-full bg-transparent text-sm outline-none"
              />
            </div>

            {/* Filter-Popover: derzeit „nicht zugewiesen" (white-label, real) */}
            {showFilter && (
              <div className="absolute left-2 top-12 z-20 w-60 rounded-2xl border border-border bg-card p-3 shadow-xl">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold">{t("filterTitle")}</span>
                  <button
                    type="button"
                    aria-label={t("close")}
                    onClick={() => setShowFilter(false)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <Icon icon="ph:x" className="size-4" />
                  </button>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={onlyUnassigned}
                    onChange={(e) => setOnlyUnassigned(e.target.checked)}
                    className="size-4 accent-[var(--color-accent)]"
                  />
                  {t("filterUnassigned")}
                </label>
                {onlyUnassigned && (
                  <button
                    type="button"
                    onClick={() => setOnlyUnassigned(false)}
                    className="mt-3 text-xs text-accent hover:underline"
                  >
                    {t("filterClear")}
                  </button>
                )}
              </div>
            )}
          </div>
          {/* Liste oder Leerzustand */}
          {filtered.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
              <Icon
                icon={showArchived ? "ph:archive-box" : "ph:chat-circle-dots"}
                className="size-8 text-muted-foreground/50"
              />
              <p className="text-sm text-muted-foreground">
                {showArchived ? t("emptyArchive") : t("emptyList")}
              </p>
            </div>
          ) : (
            <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
              {filtered.map((th) => (
                <li key={th.id}>
                  <button
                    type="button"
                    onClick={() => selectThread(th.id)}
                    className={
                      "flex w-full items-start gap-3 p-3 text-left " +
                      (th.id === active ? "bg-muted/60" : "hover:bg-muted/30")
                    }
                  >
                    <span className="relative mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary">
                      <Icon icon={otaIcon(th.ota_name)} className="size-5 text-muted-foreground" />
                      {/* Ungelesen-Punkt */}
                      {!th.is_read && (
                        <span className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-accent ring-2 ring-card" />
                      )}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col">
                      <span
                        className={
                          "flex items-center gap-1 truncate text-sm " +
                          (th.is_read ? "font-semibold" : "font-extrabold")
                        }
                      >
                        {th.guest_name ?? t("unknownGuest")}
                        {th.is_starred && (
                          <Icon icon="ph:star-fill" className="size-3.5 text-amber-500" />
                        )}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {fmtRange(th.arrival_date, th.departure_date)}
                      </span>
                      {th.last_message && (
                        <span className="truncate text-xs text-muted-foreground/80">
                          {th.last_message}
                        </span>
                      )}
                      {th.assigned_user_name && (
                        <span className="mt-0.5 flex w-fit items-center gap-1 rounded-full bg-secondary px-1.5 py-0.5 text-[0.65rem] text-muted-foreground">
                          <Icon icon="ph:user" className="size-3" />
                          {th.assigned_user_name}
                        </span>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Spalte 2: Konversation */}
        <div className="col-span-12 flex min-h-0 flex-col rounded-2xl border border-border bg-card sm:col-span-8 lg:col-span-5 xl:col-span-5">
          {current ? (
            <Conversation
              key={current.id}
              thread={current}
              archived={showArchived}
              onMarkUnread={() => markUnread(current.id)}
              onArchive={() => archive(current.id)}
              onRestore={() => restore(current.id)}
              onNext={() => gotoNext(current.id)}
              onOpenNote={() => setOpenNoteSignal((n) => n + 1)}
              onAssigned={(uid, name) =>
                patchThread(current.id, {
                  assigned_user_id: uid,
                  assigned_user_name: name,
                })
              }
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
              <Icon icon="ph:chats-circle" className="size-10 text-muted-foreground/40" />
              {t("emptyConversation")}
            </div>
          )}
        </div>

        {/* Spalte 3: Reservierungs-Panel */}
        <div className="col-span-12 hidden min-h-0 flex-col overflow-y-auto rounded-2xl border border-border bg-card lg:col-span-4 lg:flex xl:col-span-4">
          {current ? (
            <ReservationPanel
              key={`${current.id}-res`}
              thread={current}
              openNoteSignal={openNoteSignal}
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
              <Icon icon="ph:identification-card" className="size-8 text-muted-foreground/40" />
              {t("emptyReservation")}
            </div>
          )}
        </div>
      </div>
        </>
      )}
    </div>
  );
}

// --- Konversation (Chat + KI-Vorschlag + Antwortfeld) -----------------------
function Conversation({
  thread,
  archived,
  onMarkUnread,
  onArchive,
  onRestore,
  onNext,
  onOpenNote,
  onAssigned,
}: {
  thread: InboxThread;
  archived: boolean;
  onMarkUnread: () => void;
  onArchive: () => void;
  onRestore: () => void;
  onNext: () => void;
  onOpenNote: () => void;
  onAssigned: (userId: string | null, name: string | null) => void;
}) {
  const t = useTranslations("inbox");
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
  const [scheduled, setScheduled] = useState<ScheduledMessage[]>([]);
  const [showSchedule, setShowSchedule] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await getInboxMessages(thread.id);
    setMessages(res.ok ? res.data.items : []);
    if (!res.ok) setError(res.error);
    setLoading(false);
  }, [thread.id]);

  const loadScheduled = useCallback(async () => {
    const res = await listScheduled(thread.id);
    if (res.ok) setScheduled(res.data.items);
  }, [thread.id]);

  useEffect(() => {
    load();
    loadScheduled();
  }, [load, loadScheduled]);

  // Echtes Realtime für den offenen Chat: neue Nachrichten + Notizen sofort.
  useRealtime({
    table: "sandbox_message",
    filter: `thread_id=eq.${thread.id}`,
    onChange: load,
  });
  useRealtime({
    table: "inbox_thread_note",
    filter: `thread_id=eq.${thread.id}`,
    onChange: load,
  });
  // Geplante Nachrichten: bei Versand (Cron) aus der Liste verschwinden lassen.
  useRealtime({
    table: "inbox_scheduled_message",
    filter: `thread_id=eq.${thread.id}`,
    onChange: loadScheduled,
  });

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
      if (res.ok) setAi(res.data.reply);
      else setError(res.error);
    });
  }

  return (
    <>
      {/* Kopf mit Aktions-Leiste (wie im Vorbild) */}
      <div className="flex items-center gap-3 border-b border-border p-3">
        <span className="flex size-9 items-center justify-center rounded-full bg-secondary">
          <Icon icon={otaIcon(thread.ota_name)} className="size-5 text-accent" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-semibold">
            {thread.guest_name ?? t("unknownGuest")}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {thread.ota_name ?? t("directChannel")}
            {thread.ota_reservation_code ? ` · ${thread.ota_reservation_code}` : ""}
          </span>
        </div>
        {/* Aktions-Icons — alle funktional */}
        <div className="flex items-center gap-1 text-muted-foreground">
          <HeadAction
            icon="ph:eye-slash"
            title={t("markUnread")}
            onClick={onMarkUnread}
          />
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
          {/* Zuweisen an Team-Benutzer */}
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
          {archived ? (
            <HeadAction
              icon="ph:arrow-counter-clockwise"
              title={t("restore")}
              onClick={onRestore}
            />
          ) : (
            <HeadAction
              icon="ph:archive-box"
              title={t("archive")}
              onClick={onArchive}
            />
          )}
          {/* Snooze: Schnellauswahl */}
          <div className="relative">
            <HeadAction
              icon="ph:alarm"
              title={t("snooze")}
              onClick={() => setShowSnooze((v) => !v)}
            />
            {showSnooze && (
              <div className="absolute right-0 top-9 z-20 w-40 rounded-2xl border border-border bg-card p-1 shadow-xl">
                {[
                  { label: t("snooze20m"), m: 20 },
                  { label: t("snooze1h"), m: 60 },
                  { label: t("snooze3h"), m: 180 },
                  { label: t("snooze6h"), m: 360 },
                  { label: t("snooze1d"), m: 1440 },
                ].map((opt) => (
                  <button
                    key={opt.m}
                    type="button"
                    onClick={() => snooze(opt.m)}
                    className="flex w-full rounded-(--radius) px-2 py-1.5 text-left text-sm hover:bg-muted/50"
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <HeadAction
            icon="ph:user"
            title={t("guestProfile")}
            onClick={onOpenNote}
          />
          <HeadAction icon="ph:caret-right" title={t("next")} onClick={onNext} />
        </div>
      </div>

      {/* Verlauf */}
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        {loading ? (
          <p className="text-sm text-muted-foreground">…</p>
        ) : messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noMessages")}</p>
        ) : (
          messages.map((m, i) =>
            m.sender === "note" ? (
              // Interne Notiz — gelb, mittig (wie im Vorbild).
              <div key={m.id ?? i} className="flex flex-col items-center gap-1">
                <div className="max-w-[85%] rounded-2xl border border-amber-300 bg-amber-100 px-3 py-2 text-sm text-amber-900">
                  <span className="mb-0.5 flex items-center gap-1 text-[0.65rem] font-semibold uppercase tracking-wide text-amber-700">
                    <Icon icon="ph:note-pencil" className="size-3.5" />
                    {t("internalNote")}
                    {m.author_name ? ` · ${m.author_name}` : ""}
                  </span>
                  <span className="whitespace-pre-wrap">{m.message}</span>
                </div>
                {m.sent_at && (
                  <span className="text-[0.65rem] text-muted-foreground">
                    {new Date(m.sent_at).toLocaleString("de-DE")}
                  </span>
                )}
              </div>
            ) : (
              <div
                key={m.id ?? i}
                className={
                  "flex flex-col gap-1 " +
                  (m.sender === "property" ? "items-end" : "items-start")
                }
              >
                <div
                  className={
                    "max-w-[80%] rounded-2xl px-3 py-2 text-sm " +
                    (m.sender === "property"
                      ? "bg-accent text-white"
                      : "bg-muted text-foreground")
                  }
                >
                  {m.message}
                </div>
                {m.sent_at && (
                  <span className="text-[0.65rem] text-muted-foreground">
                    {new Date(m.sent_at).toLocaleString("de-DE")}
                  </span>
                )}
              </div>
            ),
          )
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
                value={ai}
                onChange={(e) => setAi(e.target.value)}
                rows={6}
                autoFocus
                className="w-full resize-none rounded-(--radius) border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
              />
            ) : (
              <p className="whitespace-pre-wrap text-sm">{ai}</p>
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
                  {new Date(s.send_at).toLocaleString("de-DE")}
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

      {/* Antwortfeld */}
      <div className="relative flex items-end gap-2 border-t border-border p-3">
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
          <div className="absolute bottom-16 left-3 z-10 max-h-60 w-72 overflow-y-auto rounded-2xl border border-border bg-card p-1 shadow-xl">
            {templates.length === 0 ? (
              <p className="p-3 text-sm text-muted-foreground">
                {t("templatesEmpty")}
              </p>
            ) : (
              templates.map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => {
                    setText((prev) => (prev ? `${prev}\n${tpl.body}` : tpl.body));
                    setShowTemplates(false);
                  }}
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
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("placeholder")}
          rows={2}
          className="min-h-[2.5rem] flex-1 resize-none rounded-(--radius) border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          title={t("tabTemplates")}
          onClick={() => setShowTemplates((v) => !v)}
        >
          <Icon icon="ph:note" className="size-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          title={t("aiSuggest")}
          onClick={suggest}
          disabled={aiLoading}
        >
          <Icon
            icon={aiLoading ? "ph:spinner" : "ph:sparkle"}
            className={"size-4 " + (aiLoading ? "animate-spin" : "")}
          />
        </Button>
        {/* Geplant senden (Uhr) */}
        <Button
          type="button"
          variant="outline"
          size="icon"
          title={t("scheduleSend")}
          onClick={() => setShowSchedule((v) => !v)}
        >
          <Icon icon="ph:clock" className="size-4" />
        </Button>
        <Button type="button" onClick={() => send(text)} disabled={sending || !text.trim()}>
          <Icon
            icon={sending ? "ph:spinner" : "ph:paper-plane-tilt"}
            className={"size-4 " + (sending ? "animate-spin" : "")}
          />
          {sending ? t("sending") : t("send")}
        </Button>
      </div>
    </>
  );
}

// --- Reservierungs-Panel (rechts) — Karte + Gästedaten + Notizen ------------
function ReservationPanel({
  thread,
  openNoteSignal,
}: {
  thread: InboxThread;
  openNoteSignal: number;
}) {
  const t = useTranslations("inbox");
  const [res, setRes] = useState<ReservationDetail | null>(null);
  const [noteEdit, setNoteEdit] = useState(false);
  const [note, setNote] = useState("");
  const noteRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const r = await getInboxReservation(thread.id);
      if (active && r.ok) {
        setRes(r.data);
        setNote(r.data.note ?? "");
      }
    })();
    return () => {
      active = false;
    };
  }, [thread.id]);

  // Notiz-/Gastprofil-Icon im Kopf → Notizfeld öffnen + hinscrollen.
  useEffect(() => {
    if (openNoteSignal > 0) {
      setNoteEdit(true);
      noteRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [openNoteSignal]);

  if (!res) {
    return <div className="p-4 text-sm text-muted-foreground">…</div>;
  }

  const money = (v: number | null) =>
    v == null
      ? null
      : v.toLocaleString("de-DE", { style: "currency", currency: res.currency || "EUR" });
  const total = money(res.total_amount);
  const due = money(res.total_amount);
  const paid = money(res.paid_amount ?? 0);
  const fmtDay = (s: string | null) =>
    s
      ? new Date(`${s}T00:00:00`).toLocaleDateString("de-DE", {
          weekday: "short",
          day: "2-digit",
          month: "short",
          year: "2-digit",
        })
      : "—";
  const guests = [
    res.adults != null ? `${res.adults} Erwachsene` : null,
    res.children != null ? `${res.children} Kinder` : null,
  ]
    .filter(Boolean)
    .join(", ");

  async function saveNote() {
    setNoteEdit(false);
    await updateThreadFlags(thread.id, { note });
  }

  return (
    <div className="flex flex-col gap-5 p-5">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-lg font-extrabold">
          {t("reservation")}
          {res.ota_reservation_code ? ` ${res.ota_reservation_code}` : ""}
        </h2>
      </div>

      {/* Reservierungs-Karte */}
      <div className="flex flex-col rounded-2xl border border-border">
        <div className="flex items-start gap-3 p-4">
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="w-fit rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
              {t("resBooked")}
            </span>
            <span className="font-display text-lg font-extrabold">
              {res.guest_name ?? t("unknownGuest")}
            </span>
            {guests && <span className="text-sm text-muted-foreground">{guests}</span>}
            <span className="text-sm text-muted-foreground">
              {res.nights != null ? `${res.nights} Nächte` : ""}
              {res.ota_name ? `, von ${res.ota_name}` : ""}
            </span>
            {res.ota_reservation_code && (
              <span className="text-sm text-muted-foreground">
                {t("reservationId")}: {res.ota_reservation_code}
              </span>
            )}
          </div>
          <Icon icon={otaIcon(res.ota_name)} className="size-7 shrink-0 text-accent" />
        </div>

        {/* Unterkunft */}
        {(res.listing_name || res.address) && (
          <div className="flex items-start gap-3 border-t border-border p-4">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="font-medium">{res.listing_name}</span>
              {res.address && (
                <span className="text-sm text-muted-foreground">{res.address}</span>
              )}
              {res.rental_id && (
                <span className="text-xs text-muted-foreground">
                  {t("rentalId")}: {res.rental_id.slice(0, 8)}
                </span>
              )}
            </div>
            {res.listing_photo && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={res.listing_photo}
                alt=""
                className="size-12 shrink-0 rounded-(--radius) object-cover"
              />
            )}
          </div>
        )}

        {/* Check-in / Check-out */}
        <div className="grid grid-cols-2 border-t border-border">
          <div className="flex flex-col gap-0.5 border-r border-border p-4">
            <span className="font-display text-base font-bold">{fmtDay(res.check_in)}</span>
            <span className="text-xs text-muted-foreground">{t("checkIn")}</span>
          </div>
          <div className="flex flex-col gap-0.5 p-4">
            <span className="font-display text-base font-bold">{fmtDay(res.check_out)}</span>
            <span className="text-xs text-muted-foreground">{t("checkOut")}</span>
          </div>
        </div>

        {/* Beträge */}
        {total && (
          <div className="flex flex-col gap-1 border-t border-border p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t("due")}</span>
              <span>{due}</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>{t("paid")}</span>
              <span>{paid}</span>
            </div>
            <div className="flex justify-between font-display text-base font-extrabold">
              <span>{t("total")}</span>
              <span>{total}</span>
            </div>
          </div>
        )}
      </div>

      {/* Gästedaten */}
      <div className="flex flex-col gap-3">
        <h3 className="font-display text-base font-extrabold">{t("guestDetails")}</h3>
        <DetailLine icon="ph:users" value={res.guest_name} />
        <DetailLine icon="ph:envelope" value={res.guest_email} />
        <DetailLine icon="ph:map-pin" value={res.address ?? "N/A"} />
        <DetailLine icon="ph:translate" value={res.guest_language} />
        <DetailLine icon="ph:device-mobile" value={res.guest_phone} />
        <DetailLine
          icon="ph:sign-in"
          value={
            res.checkin_time ? `${t("estCheckin")}: ${res.checkin_time}` : null
          }
        />
        <DetailLine
          icon="ph:sign-out"
          value={
            res.checkout_time ? `${t("estCheckout")}: ${res.checkout_time}` : null
          }
        />
        {res.guest_phone && (
          <a
            href={`https://wa.me/${res.guest_phone.replace(/[^0-9]/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-fit items-center gap-2 rounded-full bg-secondary px-3 py-1.5 text-sm font-medium hover:bg-secondary/80"
          >
            <Icon icon="ph:whatsapp-logo" className="size-4 text-emerald-600" />
            WhatsApp
          </a>
        )}
      </div>

      {/* Notizen */}
      <div ref={noteRef} className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-base font-extrabold">{t("notes")}</h3>
          {!noteEdit && (
            <Button type="button" variant="outline" size="sm" onClick={() => setNoteEdit(true)}>
              {t("noteEdit")}
            </Button>
          )}
        </div>
        {noteEdit ? (
          <div className="flex flex-col gap-2">
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              className="resize-none rounded-(--radius) border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
            />
            <Button type="button" size="sm" onClick={saveNote} className="self-end">
              {t("noteSave")}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{note || t("notesEmpty")}</p>
        )}
      </div>

      {/* Kalender: Aufenthaltszeitraum der Reservierung im Monat markiert */}
      {res.check_in && (
        <StayCalendar checkIn={res.check_in} checkOut={res.check_out} />
      )}

      {thread.reservation_id && (
        <Button asChild variant="outline" size="sm">
          <Link href={`/kalender?reservation=${thread.reservation_id}`}>
            <Icon icon="ph:calendar-check" className="size-4" />
            {t("openReservation")}
          </Link>
        </Button>
      )}
    </div>
  );
}

/**
 * Kompakter Monatskalender, der den Aufenthalt (check_in … check_out,
 * Check-out exklusiv) hervorhebt. Navigierbar zwischen Monaten; startet im
 * Anreisemonat. Reine Datums-Mathematik, keine zusätzlichen Daten nötig.
 */
function StayCalendar({
  checkIn,
  checkOut,
}: {
  checkIn: string;
  checkOut: string | null;
}) {
  const ci = new Date(`${checkIn}T00:00:00`);
  const co = checkOut ? new Date(`${checkOut}T00:00:00`) : null;
  const [month, setMonth] = useState(
    () => new Date(ci.getFullYear(), ci.getMonth(), 1),
  );

  const year = month.getFullYear();
  const mon = month.getMonth();
  const monthLabel = month.toLocaleDateString("de-DE", {
    month: "long",
    year: "numeric",
  });
  // Wochenstart Montag: getDay() So=0 → auf Mo=0 verschieben.
  const firstWeekday = (new Date(year, mon, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, mon + 1, 0).getDate();
  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  const inStay = (day: number) => {
    const d = new Date(year, mon, day);
    if (d < new Date(ci.getFullYear(), ci.getMonth(), ci.getDate())) return false;
    // Check-out-Tag ist Abreisetag → exklusiv markieren bis zum Tag davor.
    if (co) {
      const lastNight = new Date(co.getFullYear(), co.getMonth(), co.getDate() - 1);
      return d <= lastNight;
    }
    return d.getTime() === ci.getTime();
  };
  const isStart = (day: number) =>
    year === ci.getFullYear() && mon === ci.getMonth() && day === ci.getDate();
  const isEnd = (day: number) =>
    !!co && year === co.getFullYear() && mon === co.getMonth() && day === co.getDate();

  const wd = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-border p-4">
      <div className="flex items-center justify-between">
        <button
          type="button"
          aria-label="Vormonat"
          onClick={() => setMonth(new Date(year, mon - 1, 1))}
          className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
        >
          <Icon icon="ph:caret-left" className="size-4" />
        </button>
        <span className="font-display text-sm font-bold capitalize">{monthLabel}</span>
        <button
          type="button"
          aria-label="Folgemonat"
          onClick={() => setMonth(new Date(year, mon + 1, 1))}
          className="flex size-7 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary"
        >
          <Icon icon="ph:caret-right" className="size-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-muted-foreground">
        {wd.map((d) => (
          <span key={d} className="py-1">
            {d}
          </span>
        ))}
        {cells.map((day, i) =>
          day == null ? (
            <span key={`e${i}`} />
          ) : (
            <span
              key={day}
              className={`flex aspect-square items-center justify-center rounded-full text-sm ${
                inStay(day)
                  ? isStart(day) || isEnd(day)
                    ? "bg-accent font-semibold text-white"
                    : "bg-accent/15 text-accent"
                  : "text-foreground"
              }`}
            >
              {day}
            </span>
          ),
        )}
      </div>
    </div>
  );
}

function DetailLine({ icon, value }: { icon: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-3 text-sm">
      <Icon icon={icon} className="size-5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 break-words">{value}</span>
    </div>
  );
}

function HeadAction({
  icon,
  title,
  active,
  onClick,
}: {
  icon: string;
  title: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onClick={onClick}
      className={
        "flex size-8 items-center justify-center rounded-(--radius) hover:bg-muted/60 " +
        (active ? "text-amber-500" : "")
      }
    >
      <Icon icon={icon} className="size-4" />
    </button>
  );
}

// --- Massenaktualisierung (Dialog) ------------------------------------------
function BulkUpdateDialog({
  onClose,
  onDone,
}: {
  onClose: () => void;
  onDone: (action: "read" | "archived") => void;
}) {
  const t = useTranslations("inbox");
  const [action, setAction] = useState<"read" | "archived">("read");
  const [before, setBefore] = useState("");
  const [busy, startBusy] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function confirm() {
    if (!before) {
      setError(t("bulkDateRequired"));
      return;
    }
    setError(null);
    startBusy(async () => {
      const res = await bulkUpdate(action, before);
      if (res.ok) onDone(action);
      else setError(res.error);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-lg font-extrabold">{t("bulkUpdate")}</h3>
          <button
            type="button"
            aria-label={t("close")}
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
          >
            <Icon icon="ph:x" className="size-5" />
          </button>
        </div>

        <label className="mb-1 block text-sm font-medium">{t("bulkMarkAs")}</label>
        <select
          value={action}
          onChange={(e) => setAction(e.target.value as "read" | "archived")}
          className="mb-4 w-full rounded-(--radius) border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
        >
          <option value="read">{t("bulkRead")}</option>
          <option value="archived">{t("bulkArchived")}</option>
        </select>

        <label className="mb-1 block text-sm font-medium">{t("bulkBefore")}</label>
        <input
          type="date"
          value={before}
          onChange={(e) => setBefore(e.target.value)}
          className="mb-4 w-full rounded-(--radius) border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent/40"
        />

        {error && (
          <p className="mb-3 rounded-(--radius) bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button type="button" size="sm" onClick={confirm} disabled={busy}>
            {t("confirm")}
          </Button>
        </div>
      </div>
    </div>
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
    <div className="absolute bottom-16 right-3 z-20 w-64 rounded-2xl border border-border bg-card p-3 shadow-xl">
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

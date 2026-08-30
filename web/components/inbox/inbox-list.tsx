"use client";

// Posteingang (Guest Messaging) im 3-Spalten-Layout — das Gerüst steht IMMER,
// auch wenn keine Nachrichten da sind (Tabs, Filterleiste, leere Spalten):
//   links   – Thread-Liste (Gast, Aufenthalt, Vorschau, Kanal-Marke, Suche)
//   mitte   – Chat-Verlauf + KI-Antwortvorschlag (Groq) + Antwortfeld
//   rechts  – Reservierungs-Panel (Unterkunft, Kontakt, Nächte, Preis, Daten)
// Nachrichten werden live über Channex gelesen/gesendet (Booking.com/Airbnb/Expedia);
// im Sandbox-Modus über den lokalen Mock-Speicher.
//
// DIESE Datei hält nur noch das Seitengerüst und die Thread-Liste. Die großen
// Teile liegen daneben, weil die Datei auf 2178 Zeilen gewachsen war:
//   inbox-konversation.tsx        – mittlere Spalte (Verlauf, KI, Composer)
//   inbox-reservierung.tsx        – rechte Spalte (Buchung, Gast, Notizen)
//   inbox-massenaktualisierung.tsx– Dialog „Massenaktualisierung"
//   inbox-darstellung.tsx         – Avatar/Kanal-Marke/Status/Zeitformate
//   inbox-whatsapp-threads.ts     – WhatsApp-Konversation → InboxThread
import { Icon } from "@iconify/react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";

import { KiSeite } from "@/components/inbox/ki-seite";
import { AutomationsTab } from "@/components/inbox/automations-tab";
import { AutomatisierenPanel } from "@/components/inbox/automatisieren-panel";
import { ManageTab } from "@/components/inbox/manage-tab";
import { TemplatesTab } from "@/components/inbox/templates-tab";
import { WhatsAppVorlagen } from "@/components/inbox/whatsapp-vorlagen";
import {
  ChannelTag,
  GuestAvatar,
  StatusBadge,
  UngelesenBadge,
  fmtRange,
  kurzeZeit,
  zeitWert,
} from "@/components/inbox/inbox-darstellung";
import { Conversation } from "@/components/inbox/inbox-konversation";
import { BulkUpdateDialog } from "@/components/inbox/inbox-massenaktualisierung";
import { ReservationPanel } from "@/components/inbox/inbox-reservierung";
import {
  WA_NEW_PREFIX,
  WA_PREFIX,
  isWhatsApp,
  whatsAppDraftThread,
  whatsAppToThread,
} from "@/components/inbox/inbox-whatsapp-threads";
import { istUebernahme } from "@/components/inbox/inbox-uebernahme-threads";
import { istAnfrageThread } from "@/lib/inbox-anfrage-typen";
import { WhatsAppChat } from "@/components/inbox/whatsapp-panel";
import { Button } from "@nextdays/ui/button";
import { DatePicker } from "@nextdays/ui/date-picker";
import { MultiSelect } from "@nextdays/ui/multi-select";
import { NativeSelect } from "@nextdays/ui/native-select";
import { Popover, PopoverContent, PopoverTrigger } from "@nextdays/ui/popover";
import {
  type InboxStatus,
  type InboxThread,
  listInboxThreads,
  listKiEskalationen,
  setInboxStatus,
  updateThreadFlags,
} from "@/lib/inbox";
import { NUR_ANHANG_TEXT } from "@/lib/chat-format";
import { type InboxAccess } from "@/lib/inbox-access";
import { channelLabelLoose } from "@/lib/channel-logos";
import { useHydriert } from "@/lib/use-hydriert";
import {
  listWhatsAppConversations,
} from "@/lib/whatsapp-api";

// „KI-Antworten" ist EIN Reiter, nicht drei. Allgemein, Regeln und
// Wissensdatenbank stehen darunter (`ki-seite.tsx`) — als gleichrangige Reiter
// hier verbargen sie den Zusammenhang: wer die Wissensdatenbank pflegt, tut es
// FÜR die KI-Antwort, und den grossen Schalter fand man nur im ersten der drei.
type TabKey =
  | "tabInbox"
  | "tabAiReplies"
  | "tabTemplates"
  | "tabWhatsAppTemplates"
  | "tabAutomations"
  | "tabManage";

export function InboxList({
  threads,
  error,
  access,
  initialThreadId = null,
}: {
  threads: InboxThread[];
  error: string | null;
  access: InboxAccess;
  /** Vorausgewaehlter Verlauf aus dem Pfad `/posteingang/<thread>` — der Weg,
   *  den Benachrichtigungs-Mails und die Glocke nehmen. Getrennt vom
   *  `?thread=`-Parameter, weil beide Formen bestehen bleiben muessen: der
   *  Parameter kommt aus dem Buchungsdetail, der Pfad steht in bereits
   *  verschickten Mails. */
  initialThreadId?: string | null;
}) {
  const t = useTranslations("inbox");
  const locale = useLocale();
  const [query, setQuery] = useState("");
  // Lokale Thread-Liste, damit Archivieren/Ungelesen sofort sichtbar werden.
  const [rows, setRows] = useState<InboxThread[]>(threads);
  // Deep-Link auf einen einzelnen Verlauf. ZWEI Formen, beide gueltig:
  //   * `/posteingang/<thread>` — der Pfad, den der Benachrichtigungs-Dispatcher
  //     in Mails und in die Glocke schreibt (`ziel_pfad`).
  //   * `/posteingang?thread=<id>` — der Sprung aus dem Buchungsdetail.
  // Der Pfad hat Vorrang: er ist der spezifischere Aufruf. Ohne beides bleibt
  // es beim ersten Thread — der Posteingang soll nie leer starten.
  const searchParams = useSearchParams();
  // Relative Zeitangaben ("vor 5 Min.") erst nach der Hydration: sie haengen
  // an der aktuellen Uhr, die auf Server und Client verschieden steht (#418).
  const hydriert = useHydriert();
  const wunschThread = initialThreadId ?? searchParams.get("thread");
  const [active, setActive] = useState<string | null>(
    wunschThread ?? threads[0]?.id ?? null,
  );
  const [tab, setTab] = useState<TabKey>("tabInbox");
  // Signal an das Panel: Notizfeld öffnen (Zähler erzwingt erneutes Auslösen).
  const [openNoteSignal, setOpenNoteSignal] = useState(0);
  // Nur „nicht zugewiesene" Konversationen anzeigen (Filter-Panel).
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);
  // Erweiterte Filter (client-seitig auf der geladenen Liste).
  const [fChannels, setFChannels] = useState<string[]>([]); // leer = alle
  const [fProperties, setFProperties] = useState<string[]>([]); // leer = alle
  const [fStatus, setFStatus] = useState<string>(""); // "" = alle (new|modified|cancelled)
  const [fRead, setFRead] = useState<"all" | "unread" | "read">("all");
  const [fFrom, setFFrom] = useState(""); // Anreise von (YYYY-MM-DD)
  const [fTo, setFTo] = useState(""); // Anreise bis
  const [showFilter, setShowFilter] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [showAuto, setShowAuto] = useState(false);
  // Popover „Neue WhatsApp-Nummer anschreiben" (eigenes Feld statt window.prompt).
  const [showNewWa, setShowNewWa] = useState(false);
  const [newWaPhone, setNewWaPhone] = useState("");
  // Ansicht: Aktiv | Archiv | Papierkorb.
  const [view, setView] = useState<InboxStatus>("active");
  // „Eskaliert" ist KEIN InboxStatus, sondern ein Filter über der aktiven
  // Ansicht: ein eskalierter Verlauf ist weiterhin aktiv, er braucht nur
  // Aufmerksamkeit. Als vierter Status hätte er die Zeile aus „Aktiv"
  // verschwinden lassen — und dort sucht sie jeder.
  const [nurEskaliert, setNurEskaliert] = useState(false);
  const [eskalierteIds, setEskalierteIds] = useState<Set<string>>(new Set());
  // WhatsApp-Verlauf UNTER dem OTA-Verlauf desselben Gastes (aus der
  // Gästekarte geöffnet). Bewusst kein Thread-Wechsel: Buchung und
  // WhatsApp-Chat gehören zusammen und sollen zusammen sichtbar bleiben.
  const [waUnterChat, setWaUnterChat] = useState<{
    phone: string;
    conversationId: string | null;
  } | null>(null);
  // Sortierung der Thread-Liste (Hostaway-Muster: Schlüssel + Richtung).
  const [sortKey, setSortKey] = useState<"recent" | "arrival" | "name">("recent");
  const [sortDesc, setSortDesc] = useState(true);
  // Threads, die der Nutzer AUSDRÜCKLICH auf ungelesen gestellt hat. Sie sind
  // die einzige Ausnahme vom „offen = gelesen" unten: sonst würde der Effekt
  // die Markierung im selben Moment wieder wegnehmen, in dem sie gesetzt wird.
  const ungelesenGewollt = useRef<Set<string>>(new Set());
  const current = rows.find((x) => x.id === active) ?? null;

  // Threads je Ansicht laden — auch für Realtime-Reload. WhatsApp-Konversationen
  // werden (nur in der aktiven Ansicht) als gleichwertige Threads eingemischt, so
  // dass ein einziger Posteingang OTA- und WhatsApp-Chats zeigt.
  const reloadThreads = useCallback(async () => {
    const [otaRes, waRes] = await Promise.all([
      listInboxThreads({ status: view }),
      view === "active" ? listWhatsAppConversations() : Promise.resolve(null),
    ]);
    if (!otaRes.ok) return;
    const ota = otaRes.data.items;
    const wa: InboxThread[] =
      waRes && waRes.ok ? waRes.data.items.map(whatsAppToThread) : [];
    // Gemeinsame Liste nach Aktualität (neueste zuerst); null-Daten ans Ende.
    const merged = [...ota, ...wa].sort(
      (a, b) => zeitWert(b.letzte_aktivitaet) - zeitWert(a.letzte_aktivitaet),
    );
    setRows(merged);
    setActive((cur) =>
      merged.some((r) => r.id === cur) ? cur : merged[0]?.id ?? null,
    );
  }, [view]);
  useEffect(() => {
    reloadThreads();
  }, [reloadThreads]);
  // Der GEÖFFNETE Thread ist gelesen — und zwar auf BEIDEN Wegen dorthin.
  // Vorher hing das allein am Klick (`selectThread`), die Liste schlägt den
  // ersten Thread aber selbst auf (`reloadThreads`/Erstzustand). Genau der stand
  // dann offen und lesbar auf dem Bildschirm und trug weiter „Ungelesen" —
  // live im Screenshot vom 11.08.2026 der oberste Eintrag.
  useEffect(() => {
    if (!current || current.is_read || ungelesenGewollt.current.has(current.id)) return;
    setRows((prev) =>
      prev.map((r) => (r.id === current.id ? { ...r, is_read: true } : r)),
    );
    // WhatsApp-Threads laufen nicht über den inbox-Slice — nur lokal spiegeln.
    // Übernommene Verläufe (`ue:`) ebenso wenig: sie haben keine Zeile in
    // `channex_booking`, gegen die die Flags geschrieben würden — der Aufruf
    // liefe ins Leere (404). Ein eingefrorenes Archiv gilt ohnehin als gelesen.
    if (!isWhatsApp(current.id) && !istUebernahme(current.id)) {
      void updateThreadFlags(current.id, { is_read: true });
    }
  }, [current]);
  // KEIN Realtime-Abo mehr auf `channex_booking` und `whatsapp_conversation`:
  // beide Tabellen sind seit Migration 0337 für `authenticated` gesperrt
  // (Wurzel 6 — sie tragen Klartext-Nachrichten und die Gast-Stammdaten aus
  // dem OTA-Payload). Ohne SELECT-Grant passt keine Policy mehr, das Abo wäre
  // eine stumme Attrappe: verbindet sich, liefert nie ein Event.
  //
  // Eine erlaubte Ersatzquelle gibt es NICHT. `reservations` wäre ein stiller
  // Ersatz und damit falsch: eine eingehende OTA-Nachricht ändert
  // `channex_booking.last_message_at`, aber keine Zeile in `reservations` —
  // das Abo sähe live aus und verpasste genau das Ereignis, um das es hier
  // geht. Für WhatsApp gibt es überhaupt keine offene Tabelle.
  //
  // WAS DADURCH ENTFÄLLT: Neue Threads und neue Nachrichten von Kollegen oder
  // vom Portal erscheinen nicht mehr von selbst in dieser Liste. Der eigene
  // Versand lädt weiterhin über `reloadThreads` nach; fremde Vorgänge werden
  // beim Wechsel der Ansicht (Aktiv/Archiv/Papierkorb) oder beim erneuten
  // Öffnen des Posteingangs sichtbar.

  // Filter-Optionen aus den geladenen Threads ableiten (nur real vorkommende).
  const channelOptions = Array.from(
    new Set(rows.map((r) => r.ota_name).filter((x): x is string => !!x)),
  ).map((c) => ({ value: c, label: channelLabelLoose(c) }));
  const propertyOptions = Array.from(
    new Map(
      rows
        .filter((r) => r.property_id)
        .map((r) => [r.property_id as string, r.property_title || ""]),
    ).entries(),
  ).map(([value, label]) => ({ value, label }));

  const lc = (s: string | null) => (s ?? "").toLowerCase();
  useEffect(() => {
    // EIN Aufruf für die ganze Liste statt einer je Zeile: bei 50 Zeilen wären
    // das 50 Abfragen für ein Abzeichen.
    void listKiEskalationen().then((res) => {
      if (res.ok) setEskalierteIds(new Set(res.data.items.map((e) => e.thread_id)));
    });
  }, []);

  const gefiltert = rows.filter((th) => {
    if (onlyUnassigned && th.assigned_user_id) return false;
    if (!lc(th.guest_name).includes(query.trim().toLowerCase())) return false;
    if (fChannels.length && !(th.ota_name && fChannels.includes(th.ota_name)))
      return false;
    if (
      fProperties.length &&
      !(th.property_id && fProperties.includes(th.property_id))
    )
      return false;
    if (fStatus && th.status !== fStatus) return false;
    if (fRead === "unread" && th.is_read) return false;
    if (fRead === "read" && !th.is_read) return false;
    if (fFrom && (!th.arrival_date || th.arrival_date < fFrom)) return false;
    if (fTo && (!th.arrival_date || th.arrival_date > fTo)) return false;
    if (nurEskaliert && !eskalierteIds.has(th.id)) return false;
    return true;
  });
  // Sortierung wie bei Hostaway wählbar: nach letzter Aktivität (Standard),
  // nach Anreise (wer kommt als Nächstes?) oder alphabetisch.
  const filtered = [...gefiltert].sort((a, b) => {
    const richtung = sortDesc ? -1 : 1;
    if (sortKey === "arrival")
      return richtung * (a.arrival_date ?? "").localeCompare(b.arrival_date ?? "");
    if (sortKey === "name")
      return richtung * (a.guest_name ?? "").localeCompare(b.guest_name ?? "", locale);
    return (
      richtung * (zeitWert(a.letzte_aktivitaet) - zeitWert(b.letzte_aktivitaet))
    );
  });
  // Zusammengehörigkeit sichtbar machen: Ein WhatsApp-Verlauf mit der
  // Telefonnummer eines Gastes ist KEIN eigener Vorgang, sondern der zweite
  // Draht zu dessen Buchung. Er wird deshalb als eingerückter Unterpunkt unter
  // seiner Buchung geführt statt unverbunden in der Liste zu stehen.
  const waKinder = new Map<string, InboxThread[]>();
  const kindIds = new Set<string>();
  for (const wa of filtered) {
    if (!isWhatsApp(wa.id) || !wa.ota_reservation_code) continue;
    const eltern = filtered.find(
      (p) =>
        !isWhatsApp(p.id) &&
        (p.guest_phone ?? "").replace(/\D/g, "") === wa.ota_reservation_code,
    );
    if (!eltern) continue;
    waKinder.set(eltern.id, [...(waKinder.get(eltern.id) ?? []), wa]);
    kindIds.add(wa.id);
  }
  // Oberste Ebene = alles, was kein Unterpunkt ist.
  const sichtbar = filtered.filter((th) => !kindIds.has(th.id));

  // Ungelesene in der AKTUELLEN Ansicht — beide Vorbilder zeigen die Zahl
  // prominent, sonst sieht man Arbeit erst beim Durchscrollen.
  const unreadCount = rows.filter((r) => !r.is_read).length;
  const activeFilterCount =
    (onlyUnassigned ? 1 : 0) +
    (fChannels.length ? 1 : 0) +
    (fProperties.length ? 1 : 0) +
    (fStatus ? 1 : 0) +
    (fRead !== "all" ? 1 : 0) +
    (fFrom || fTo ? 1 : 0);

  // Eine Konversation lokal patchen (z.B. nach Ungelesen/Favorit).
  function patchThread(id: string, patch: Partial<InboxThread>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  // Lebenszyklus-Aktion: Status setzen → aus aktueller Ansicht nehmen.
  async function changeStatus(
    id: string,
    status: "active" | "archived" | "trashed" | "deleted",
  ) {
    const rest = filtered.filter((r) => r.id !== id);
    setRows((prev) => prev.filter((r) => r.id !== id));
    setActive(rest[0]?.id ?? null);
    await setInboxStatus(id, status);
  }

  // Aktion: als ungelesen markieren. Der Wunsch wird gemerkt, damit „offen =
  // gelesen" ihn nicht sofort überschreibt; beim nächsten bewussten Öffnen des
  // Threads gilt wieder die Regel.
  async function markUnread(id: string) {
    ungelesenGewollt.current.add(id);
    await updateThreadFlags(id, { is_read: false });
    patchThread(id, { is_read: false });
  }

  // Aktion: nächste Konversation in der gefilterten Liste.
  function gotoNext(id: string) {
    const idx = filtered.findIndex((r) => r.id === id);
    const next = filtered[idx + 1] ?? filtered[0];
    if (next) setActive(next.id);
  }

  // WhatsApp-Chat mit einer Nummer öffnen. Existiert bereits eine Konversation
  // für die Nummer, wird sie ausgewählt; sonst ein flüchtiger Entwurf
  // vorangestellt (real entsteht sie erst beim ersten Senden über den Webhook).
  /**
   * WhatsApp als EIGENEN Thread öffnen — für das Popover „Neue Nummer", wo es
   * (noch) keine Buchung gibt. Aus einer Buchung heraus wird stattdessen
   * `waUnterChat` benutzt: dort gehört der WhatsApp-Verlauf UNTER den
   * OTA-Verlauf, nicht an dessen Stelle.
   */
  function openWhatsAppThread(rawPhone: string) {
    const phone = rawPhone.replace(/\D/g, "");
    if (phone.length < 6) return;
    // WhatsApp-Chats leben in der aktiven Ansicht — von Archiv/Papierkorb wechseln.
    if (view !== "active") setView("active");
    const existing = rows.find(
      (r) => isWhatsApp(r.id) && r.ota_reservation_code === phone,
    );
    if (existing) {
      setActive(existing.id);
      return;
    }
    const id = `${WA_NEW_PREFIX}${phone}`;
    setRows((prev) =>
      prev.some((r) => r.id === id) ? prev : [whatsAppDraftThread(phone), ...prev],
    );
    setActive(id);
  }

  /** Aus der Gästekarte: WhatsApp-Verlauf unter dem offenen Chat einblenden. */
  function whatsAppUnterChat(rawPhone: string) {
    const phone = rawPhone.replace(/\D/g, "");
    if (phone.length < 6) return;
    // Gibt es zu der Nummer schon eine Konversation, zeigen wir DIESE — sonst
    // entstünde ein zweiter, leerer Verlauf neben dem echten.
    const vorhanden = rows.find(
      (r) => isWhatsApp(r.id) && r.ota_reservation_code === phone,
    );
    setWaUnterChat({
      phone,
      conversationId: vorhanden ? vorhanden.id.slice(WA_PREFIX.length) : null,
    });
  }

  // Aus dem Popover „Neue Nummer": Eingabe übernehmen, Popover schließen.
  function startWhatsApp() {
    openWhatsAppThread(newWaPhone);
    setNewWaPhone("");
    setShowNewWa(false);
  }

  // Thread öffnen. Als gelesen markiert ihn der Effekt oben — für den Klick und
  // für das automatische Aufschlagen mit derselben Regel.
  function selectThread(id: string) {
    setActive(id);
    // Der eingeblendete WhatsApp-Verlauf gehört zum vorherigen Gast.
    setWaUnterChat(null);
    // Bewusstes Öffnen hebt ein früheres „als ungelesen markieren" auf.
    ungelesenGewollt.current.delete(id);
  }

  // Konfigurations-Tabs (Vorlagen/Automationen/KI/Verwalten) nur mit
  // INBOX_MANAGE_CONFIG sichtbar (Enterprise-Achse „Aktionen").
  const TABS: TabKey[] = [
    "tabInbox",
    ...(access.canManageConfig
      ? ([
          "tabAiReplies",
          "tabTemplates",
          "tabWhatsAppTemplates",
          "tabAutomations",
          "tabManage",
        ] as TabKey[])
      : []),
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
          <div className="ml-auto flex items-center gap-2">
            {access.canManageConfig && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowAuto(true)}
              >
                <Icon icon="ph:arrows-clockwise" className="size-4" />
                {t("autoPanelOpen")}
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowBulk(true)}
            >
              <Icon icon="ph:list-checks" className="size-4" />
              {t("bulkUpdate")}
            </Button>
          </div>
        )}
      </header>

      <AutomatisierenPanel offen={showAuto} onOffenChange={setShowAuto} />

      {showBulk && (
        <BulkUpdateDialog
          onClose={() => setShowBulk(false)}
          onDone={() => {
            setShowBulk(false);
            // Frisch laden statt lokal raten. Der lokale Spiegel setzte vorher
            // JEDE geladene Zeile auf gelesen/archiviert — unabhängig vom
            // gewählten Datum, nach dem der Server gefiltert hat. Und
            // „archiviert" blieb dabei in der Ansicht „Aktiv" stehen, weil nur
            // `is_archived` gesetzt wurde, nicht `inbox_status`.
            void reloadThreads();
          }}
        />
      )}

      {/* Andere Tabs: eigene Inhalte */}
      {tab === "tabTemplates" ? (
        <TemplatesTab />
      ) : tab === "tabWhatsAppTemplates" ? (
        <WhatsAppVorlagen />
      ) : tab === "tabAiReplies" ? (
        <KiSeite />
      ) : tab === "tabAutomations" ? (
        <AutomationsTab />
      ) : tab === "tabManage" ? (
        <ManageTab onOpenTab={setTab} />
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
              {/* Ansicht: Aktiv | Archiv | Papierkorb */}
              <div className="flex items-center gap-1 border-b border-border p-2 text-xs">
                {([
                  { key: "active", icon: "ph:tray", label: t("viewActive") },
                  { key: "archived", icon: "ph:archive-box", label: t("viewArchive") },
                  { key: "trashed", icon: "ph:trash", label: t("viewTrash") },
                ] as const).map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => {
                      setView(v.key);
                      setNurEskaliert(false);
                      setActive(null);
                    }}
                    className={
                      "flex flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-1.5 font-medium transition-colors " +
                      (view === v.key
                        ? "bg-accent/10 text-accent"
                        : "text-muted-foreground hover:bg-muted/50")
                    }
                  >
                    <Icon icon={v.icon} className="size-4" />
                    {v.label}
                    {/* Ungelesen-Zähler nur an der Ansicht, in der man gerade
                        steht — die Zahl gilt für die geladenen Threads. */}
                    {v.key === view && unreadCount > 0 && (
                      <span className="rounded-full bg-accent px-1.5 text-[0.65rem] font-bold text-accent-foreground">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                ))}
                {/* „Eskaliert" steht neben den Ansichten, ist aber ein FILTER:
                    ein eskalierter Verlauf bleibt aktiv, er braucht nur
                    Aufmerksamkeit. Erscheint nur, wenn es welche gibt — ein
                    dauerhaft leerer Knopf ist Lärm. */}
                {eskalierteIds.size > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setNurEskaliert((v) => !v);
                      setView("active");
                      setActive(null);
                    }}
                    className={
                      "flex flex-1 items-center justify-center gap-1.5 rounded-full px-2 py-1.5 font-medium transition-colors " +
                      (nurEskaliert
                        ? "bg-destructive/10 text-destructive"
                        : "text-muted-foreground hover:bg-muted/50")
                    }
                  >
                    <Icon icon="ph:warning-circle" className="size-4" />
                    {t("kiFilterEscalated")}
                    <span className="rounded-full bg-destructive px-1.5 text-[0.65rem] font-bold text-destructive-foreground">
                      {eskalierteIds.size}
                    </span>
                  </button>
                )}
              </div>

              {/* Filterleiste */}
              <div className="relative flex items-center gap-2 border-b border-border p-2">
                <Popover open={showFilter} onOpenChange={setShowFilter}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      title={t("filter")}
                      className={
                        "relative flex size-8 items-center justify-center rounded-(--radius) " +
                        (activeFilterCount > 0
                          ? "bg-accent/10 text-accent"
                          : "bg-secondary text-muted-foreground hover:text-foreground")
                      }
                    >
                      <Icon icon="ph:funnel" className="size-4" />
                      {activeFilterCount > 0 && (
                        <span className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-accent text-[0.6rem] font-bold text-accent-foreground">
                          {activeFilterCount}
                        </span>
                      )}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    className="flex max-h-[80vh] w-72 flex-col gap-3 overflow-y-auto p-3"
                  >
                    <span className="text-sm font-semibold">{t("filterTitle")}</span>

                    {access.scope === "all" ? (
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={onlyUnassigned}
                          onChange={(e) => setOnlyUnassigned(e.target.checked)}
                          className="size-4 accent-[var(--color-accent)]"
                        />
                        {t("filterUnassigned")}
                      </label>
                    ) : (
                      <p className="text-xs text-muted-foreground">{t("filterAssignedOnly")}</p>
                    )}

                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-muted-foreground">{t("filterChannel")}</span>
                      <MultiSelect
                        options={channelOptions}
                        selected={fChannels}
                        onChange={setFChannels}
                        placeholder={t("filterAllChannels")}
                        searchPlaceholder={t("filterSearchChannel")}
                        allLabel={t("filterAllChannels")}
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-muted-foreground">{t("filterProperty")}</span>
                      <MultiSelect
                        options={propertyOptions}
                        selected={fProperties}
                        onChange={setFProperties}
                        placeholder={t("filterAllProperties")}
                        searchPlaceholder={t("filterSearchProperty")}
                        allLabel={t("filterAllProperties")}
                      />
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-muted-foreground">{t("filterStatus")}</span>
                      <NativeSelect value={fStatus} onChange={(e) => setFStatus(e.target.value)}>
                        <option value="">{t("filterStatusAll")}</option>
                        <option value="new">{t("filterStatusNew")}</option>
                        <option value="modified">{t("filterStatusModified")}</option>
                        <option value="cancelled">{t("filterStatusCancelled")}</option>
                      </NativeSelect>
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-muted-foreground">{t("filterRead")}</span>
                      <NativeSelect
                        value={fRead}
                        onChange={(e) => setFRead(e.target.value as "all" | "unread" | "read")}
                      >
                        <option value="all">{t("filterReadAll")}</option>
                        <option value="unread">{t("filterReadUnread")}</option>
                        <option value="read">{t("filterReadRead")}</option>
                      </NativeSelect>
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-muted-foreground">{t("filterArrivalRange")}</span>
                      <div className="grid grid-cols-2 gap-2">
                        <DatePicker value={fFrom} onChange={setFFrom} placeholder={t("filterFrom")} />
                        <DatePicker value={fTo} onChange={setFTo} placeholder={t("filterTo")} />
                      </div>
                    </div>

                    {activeFilterCount > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setOnlyUnassigned(false);
                          setFChannels([]);
                          setFProperties([]);
                          setFStatus("");
                          setFRead("all");
                          setFFrom("");
                          setFTo("");
                        }}
                        className="text-xs text-accent hover:underline"
                      >
                        {t("filterClear")}
                      </button>
                    )}
                  </PopoverContent>
                </Popover>
                <div className="flex flex-1 items-center gap-2 rounded-full border border-border px-3 py-1.5">
                  <Icon icon="ph:magnifying-glass" className="size-4 text-muted-foreground" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t("searchGuests")}
                    className="w-full bg-transparent text-sm outline-none"
                  />
                </div>
                <Popover open={showNewWa} onOpenChange={setShowNewWa}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      title={t("whatsappNewChat")}
                      className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 transition-colors hover:bg-emerald-200"
                    >
                      <Icon icon="ph:whatsapp-logo" className="size-4" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="flex w-64 flex-col gap-2 p-3">
                    <span className="text-sm font-semibold">{t("whatsappNewChat")}</span>
                    <input
                      autoFocus
                      value={newWaPhone}
                      onChange={(e) => setNewWaPhone(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") startWhatsApp();
                      }}
                      placeholder={t("whatsappNewPlaceholder")}
                      className="rounded-full border border-border bg-transparent px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-accent/40"
                    />
                    <Button
                      type="button"
                      size="sm"
                      className="self-end"
                      disabled={newWaPhone.replace(/\D/g, "").length < 6}
                      onClick={startWhatsApp}
                    >
                      <Icon icon="ph:chat-circle-text" className="size-4" />
                      {t("whatsappNewStart")}
                    </Button>
                  </PopoverContent>
                </Popover>
              </div>
              {/* Sortierzeile (Hostaway-Muster) — Schlüssel links, Richtung rechts */}
              <div className="flex items-center gap-1 border-b border-border px-2 py-1.5 text-xs">
                <label className="sr-only" htmlFor="inbox-sort">
                  {t("sortBy")}
                </label>
                <select
                  id="inbox-sort"
                  value={sortKey}
                  onChange={(e) => {
                    const naechster = e.target.value as
                      | "recent"
                      | "arrival"
                      | "name";
                    setSortKey(naechster);
                    // Richtung passend zur Frage vorbelegen, die die Sortierung
                    // beantwortet: „letzte Aktivität" heißt neueste zuerst
                    // (absteigend), „Anreise" heißt WER KOMMT ALS NÄCHSTES
                    // (aufsteigend), „Name" heißt A–Z. Ohne das blieb die
                    // Richtung auf absteigend stehen und „Anreise" zeigte die
                    // fernste Buchung oben — technisch sortiert, aber die
                    // Antwort auf niemandes Frage. Umschaltbar bleibt es.
                    setSortDesc(naechster === "recent");
                  }}
                  className="min-w-0 flex-1 cursor-pointer bg-transparent text-muted-foreground outline-none hover:text-foreground"
                >
                  <option value="recent">{t("sortRecent")}</option>
                  <option value="arrival">{t("sortArrival")}</option>
                  <option value="name">{t("sortName")}</option>
                </select>
                <button
                  type="button"
                  title={sortDesc ? t("sortDesc") : t("sortAsc")}
                  aria-label={sortDesc ? t("sortDesc") : t("sortAsc")}
                  onClick={() => setSortDesc((v) => !v)}
                  className="flex size-6 items-center justify-center rounded-(--radius) text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                >
                  <Icon
                    icon={sortDesc ? "ph:sort-descending" : "ph:sort-ascending"}
                    className="size-4"
                  />
                </button>
              </div>

              {/* Liste oder Leerzustand */}
              {filtered.length === 0 ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center">
                  <Icon
                    icon={
                      view === "trashed"
                        ? "ph:trash"
                        : view === "archived"
                          ? "ph:archive-box"
                          : "ph:chat-circle-dots"
                    }
                    className="size-8 text-muted-foreground/50"
                  />
                  <p className="text-sm text-muted-foreground">
                    {view === "trashed"
                      ? t("emptyTrash")
                      : view === "archived"
                        ? t("emptyArchive")
                        : t("emptyList")}
                  </p>
                </div>
              ) : (
                <ul className="min-h-0 flex-1 divide-y divide-border overflow-y-auto">
                  {sichtbar.map((th) => (
                    <li key={th.id}>
                      <button
                        data-testid="inbox-thread-item"
                        data-thread-id={th.id}
                        data-thread-guest={(th.guest_name ?? "").toLowerCase()}
                        type="button"
                        onClick={() => selectThread(th.id)}
                        className={
                          // Aktiver Thread bekommt links einen Farbbalken (Muster
                          // aus Hostaway) — im Blick über eine lange Liste sofort
                          // erkennbar, welcher Chat offen ist.
                          "flex w-full items-start gap-3 border-l-2 py-2.5 pl-2.5 pr-3 text-left transition-colors " +
                          (th.id === active
                            ? "border-l-accent bg-accent/5"
                            : "border-l-transparent hover:bg-muted/30")
                        }
                      >
                        <span className="mt-0.5">
                          <GuestAvatar
                            name={th.guest_name}
                            bildUrl={th.guest_avatar_url}
                            size="sm"
                            unread={!th.is_read}
                          />
                        </span>
                        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                          {/* Zeile 1: Name + Zeit der letzten Aktivität */}
                          <span className="flex items-baseline gap-2">
                            <span
                              className={
                                "flex min-w-0 flex-1 items-center gap-1 truncate text-sm " +
                                (th.is_read ? "font-semibold" : "font-extrabold")
                              }
                            >
                              <span className="truncate">
                                {th.guest_name ?? t("unknownGuest")}
                              </span>
                              {th.is_starred && (
                                <Icon icon="ph:star-fill" className="size-3.5 shrink-0 text-amber-500" />
                              )}
                              {/* Eskalation (0498): ein Punkt, kein Text —
                                  in einer 3 rem hohen Zeile ist ein Abzeichen
                                  mit Wort nicht unterzubringen, ohne den
                                  Gastnamen zu verdrängen. Der Titel nennt es. */}
                              {eskalierteIds.has(th.id) && (
                                <span
                                  className="shrink-0"
                                  title={t("kiEscalatedBadge")}
                                  aria-label={t("kiEscalatedBadge")}
                                >
                                  <Icon
                                    icon="ph:warning-circle-fill"
                                    className="size-3.5 text-destructive"
                                  />
                                </span>
                              )}
                            </span>
                            {/* Rechts steht der Wert, nach dem gerade sortiert
                                wird. Sonst sortiert die Liste nach Anreise,
                                zeigt aber die letzte Aktivität — und die
                                Reihenfolge sieht nach einem Fehler aus, weil
                                die sichtbaren Daten nicht dazu passen. */}
                            <span className="shrink-0 text-[0.7rem] text-muted-foreground">
                              {sortKey === "arrival"
                                ? kurzeZeit(th.arrival_date, locale, hydriert)
                                : kurzeZeit(th.letzte_aktivitaet, locale, hydriert)}
                            </span>
                          </span>
                          {/* Zeile 2: letzte Nachricht, mit Absender davor.
                              Der Pfeil beantwortet „habe ich schon
                              geantwortet?" — ohne ihn sieht ein Thread, in dem
                              der Gast wartet, aus wie ein erledigter. */}
                          {th.last_message && (
                            <span
                              className={
                                "flex items-center gap-1 truncate text-xs " +
                                (th.is_read ? "text-muted-foreground" : "text-foreground")
                              }
                            >
                              {th.last_sender && (
                                <span
                                  className="shrink-0"
                                  title={
                                    th.last_sender === "property"
                                      ? t("lastFromUs")
                                      : t("lastFromGuest")
                                  }
                                >
                                  <Icon
                                    icon={
                                      th.last_sender === "property"
                                        ? "ph:arrow-bend-up-right"
                                        : "ph:arrow-bend-down-left"
                                    }
                                    className={
                                      "size-3 " +
                                      (th.last_sender === "property"
                                        ? "text-muted-foreground/60"
                                        : "text-accent")
                                    }
                                  />
                                </span>
                              )}
                              {/* Reine Bildnachricht: der Server speichert ein
                                  sprachneutrales Kürzel (er kennt die Sprache
                                  des Betrachters nicht) — die Worte macht erst
                                  die Oberfläche. */}
                              <span className="truncate">
                                {th.last_message === NUR_ANHANG_TEXT
                                  ? t("attachmentPreview")
                                  : th.last_message}
                              </span>
                            </span>
                          )}
                          {/* Zeile 3: Objekt — beantwortet „um welche Unterkunft
                              geht es?" ohne den Thread zu öffnen */}
                          {th.property_title && (
                            <span className="truncate text-xs text-muted-foreground/70">
                              {th.property_title}
                            </span>
                          )}
                          {/* Zeile 4: Kanal-Logo + Aufenthalt + Status — wie bei
                              Lodgify/Hostaway in EINER Meta-Zeile. */}
                          <span className="flex items-center gap-2">
                            <ChannelTag channel={th.ota_name} />
                            <span className="min-w-0 flex-1 truncate text-[0.7rem] text-muted-foreground">
                              {fmtRange(th.arrival_date, th.departure_date, locale)}
                            </span>
                            {/* Ungelesen ZUERST: das ist die Information, nach
                                der man im Posteingang sucht. Der Buchungs-
                                status steht daneben und nur, wenn er etwas
                                Besonderes sagt (storniert/geändert). */}
                            {!th.is_read && <UngelesenBadge />}
                            {th.status && <StatusBadge status={th.status} />}
                          </span>
                          {th.assigned_user_name && (
                            <span className="mt-0.5 flex w-fit items-center gap-1 rounded-full bg-secondary px-1.5 py-0.5 text-[0.65rem] text-muted-foreground">
                              <Icon icon="ph:user" className="size-3" />
                              {th.assigned_user_name}
                            </span>
                          )}
                        </div>
                      </button>
                      {/* Unterpunkte: WhatsApp-Verläufe desselben Gastes.
                          Eingerückt und mit Verbindungslinie an die Buchung
                          gehängt, damit die Zugehörigkeit ohne Klick sichtbar
                          ist. Der Klick öffnet die Buchung UND blendet den
                          WhatsApp-Verlauf unter ihrem Chat ein. */}
                      {(waKinder.get(th.id) ?? []).map((kind) => (
                        <div key={kind.id} className="relative flex items-center">
                          {/* Verbindung als Ecke: aus der Buchungszeile herunter
                              und in den Unterpunkt hinein — dieselbe Sprache wie
                              ein Verzeichnisbaum, sofort als „gehört dazu"
                              lesbar. Endet auf halber Höhe des Unterpunkts. */}
                          <span
                            aria-hidden
                            className="absolute bottom-1/2 left-[1.4rem] top-0 w-3 rounded-bl-md border-b border-l border-border"
                          />
                          <button
                            type="button"
                            data-testid="inbox-thread-subitem"
                            data-thread-id={kind.id}
                            onClick={() => {
                              selectThread(th.id);
                              setWaUnterChat({
                                phone: kind.ota_reservation_code ?? "",
                                conversationId: kind.id.slice(WA_PREFIX.length),
                              });
                            }}
                            className="ml-[2.6rem] flex w-full items-center gap-2 py-2 pr-3 text-left hover:bg-muted/30"
                          >
                            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-500/20">
                              <Icon
                                icon="ph:whatsapp-logo"
                                className="size-3.5 text-emerald-600 dark:text-emerald-400"
                              />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span
                                className={
                                  "block truncate text-xs " +
                                  (kind.is_read ? "font-medium" : "font-bold")
                                }
                              >
                                WhatsApp
                              </span>
                              {kind.last_message && (
                                <span className="block truncate text-[0.7rem] text-muted-foreground">
                                  {kind.last_message}
                                </span>
                              )}
                            </span>
                            <span className="shrink-0 text-[0.7rem] text-muted-foreground">
                              {kurzeZeit(kind.letzte_aktivitaet, locale, hydriert)}
                            </span>
                          </button>
                        </div>
                      ))}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Spalte 2: Konversation — WhatsApp-Threads nutzen das WhatsApp-Chat-
            Panel (Meta Cloud API), OTA-Threads die Channex-Konversation. */}
            <div className="col-span-12 flex min-h-0 flex-col rounded-2xl border border-border bg-card sm:col-span-8 lg:col-span-5 xl:col-span-5">
              {!current ? (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
                  <Icon icon="ph:chats-circle" className="size-10 text-muted-foreground/40" />
                  {t("emptyConversation")}
                </div>
              ) : isWhatsApp(current.id) ? (
                <WhatsAppChat
                  key={current.id}
                  conversationId={
                    current.id.startsWith(WA_NEW_PREFIX)
                      ? null
                      : current.id.slice(WA_PREFIX.length)
                  }
                  phone={
                    current.id.startsWith(WA_NEW_PREFIX)
                      ? current.id.slice(WA_NEW_PREFIX.length)
                      : ""
                  }
                  name={current.guest_name}
                  onSent={reloadThreads}
                />
              ) : (
                <Conversation
                  key={current.id}
                  thread={current}
                  whatsapp={waUnterChat}
                  onCloseWhatsapp={() => setWaUnterChat(null)}
                  view={view}
                  access={access}
                  onMarkUnread={() => markUnread(current.id)}
                  onStatus={(s) => changeStatus(current.id, s)}
                  onNext={() => gotoNext(current.id)}
                  onOpenNote={() => setOpenNoteSignal((n) => n + 1)}
                  onAssigned={(uid, name) =>
                    patchThread(current.id, {
                      assigned_user_id: uid,
                      assigned_user_name: name,
                    })
                  }
                />
              )}
            </div>

            {/* Spalte 3: Reservierungs-Panel (nur für OTA-Threads; WhatsApp hat im
            inbox-Slice keinen Reservierungskontext, und eine noch offene
            Airbnb-Anfrage IST keine Reservierung — ihr Kontext steht in der
            Anfrage-Karte über dem Chat). */}
            <div className="col-span-12 hidden min-h-0 flex-col overflow-y-auto rounded-2xl border border-border bg-card lg:col-span-4 lg:flex xl:col-span-4">
              {current && !isWhatsApp(current.id) && !istAnfrageThread(current.id) ? (
                <ReservationPanel
                  key={`${current.id}-res`}
                  thread={current}
                  openNoteSignal={openNoteSignal}
                  onWhatsApp={whatsAppUnterChat}
                />
              ) : (
                <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
                  <Icon
                    icon={
                      current && isWhatsApp(current.id)
                        ? "ph:whatsapp-logo"
                        : "ph:identification-card"
                    }
                    className="size-8 text-muted-foreground/40"
                  />
                  {current && isWhatsApp(current.id)
                    ? t("whatsappNoReservation")
                    : t("emptyReservation")}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}







"use client";

// Support-Konsole: die Arbeitsfläche des Teams für Live-Chats und Anfragen.
//
// Aufbau wie die etablierten Agenten-Postfächer (Intercom Inbox, Crisp, Zendesk
// Agent Workspace): links die gefilterte Konversationsliste, in der Mitte der
// Verlauf mit Antwortfeld, rechts der Kontext zum Melder. Alles ist live —
// neue Nachrichten kommen über Supabase-Realtime, nicht über Nachladen.
//
// Zwei Dinge sind hier sicherheitsrelevant und deshalb sichtbar gemacht:
//   • INTERNE NOTIZEN sind farblich klar abgesetzt und der Umschalter steht
//     direkt am Senden-Knopf — versehentlich intern statt öffentlich zu
//     antworten ist der teuerste Fehler dieser Oberfläche.
//   • Der Realtime-Kanal liefert dem Team NUR das Signal; die vollständigen
//     Daten (inkl. interner Notizen) kommen weiterhin vom Server über
//     /platform/support, wo jeder Zugriff protokolliert wird.
import { Icon } from "@iconify/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import type {
  SupportMessage,
  SupportTicket,
  SupportTicketDetail,
  TicketStatus,
} from "@/lib/backoffice";
import {
  antworten,
  gelesenMarkieren,
  konversation,
  konversationen,
  statusSetzen,
  zuweisen,
} from "@/lib/support-actions";
import { useRealtime } from "@/lib/use-realtime";
import { useTeamPresence, useTypingChannel } from "@/lib/use-support-channel";

const STATUS_LABEL: Record<TicketStatus, string> = {
  open: "Offen",
  waiting: "Wartend",
  resolved: "Gelöst",
  closed: "Geschlossen",
};

const PRIO_LABEL: Record<string, string> = {
  urgent: "Dringend",
  high: "Hoch",
  normal: "Normal",
  low: "Niedrig",
};

// Textbausteine für die häufigsten Fälle. Bewusst im Code und nicht in der
// Datenbank: sie gehören zur Oberfläche des Betreiber-Teams, ändern sich selten
// und brauchen keine eigene Verwaltung — eine halbfertige Makro-Verwaltung wäre
// mehr Pflegeaufwand als Nutzen.
const BAUSTEINE: { kurz: string; text: string }[] = [
  {
    kurz: "Begrüßung",
    text: "Hallo, danke für Ihre Nachricht — ich schaue mir das sofort an.",
  },
  {
    kurz: "Rückfrage",
    text: "Damit ich das nachvollziehen kann: um welches Objekt und welchen Zeitraum geht es genau?",
  },
  {
    kurz: "In Arbeit",
    text: "Ich habe den Vorgang aufgenommen und melde mich, sobald ich mehr weiß.",
  },
  {
    kurz: "Abschluss",
    text: "Das sollte jetzt passen. Melden Sie sich gern wieder, wenn noch etwas offen ist.",
  },
];

type Filter = {
  status: TicketStatus | "alle";
  source: "form" | "chat" | "web" | "alle";
  mine: boolean;
};

export function SupportKonsole({
  eigeneUserId,
  startId,
}: {
  eigeneUserId: string;
  startId?: string;
}) {
  const [filter, setFilter] = useState<Filter>({
    status: "open",
    source: "alle",
    mine: false,
  });
  const [liste, setListe] = useState<SupportTicket[]>([]);
  const [aktiveId, setAktiveId] = useState<string | null>(startId ?? null);

  // Anwesenheit melden: solange die Konsole offen ist, sieht der Kunde im
  // Widget „Wir sind gerade da". Das darf laut RLS (0236) nur das Team.
  useTeamPresence({ melden: true });

  const listeLaden = useCallback(async () => {
    const res = await konversationen({
      status: filter.status === "alle" ? undefined : filter.status,
      source: filter.source === "alle" ? undefined : filter.source,
      mine: filter.mine,
    });
    if (res.ok) setListe(res.data.items);
  }, [filter]);

  useEffect(() => {
    void listeLaden();
  }, [listeLaden]);

  // Neue Konversationen und Antworten erscheinen ohne Neuladen —
  // mandantenübergreifend, seit 0206 (is_platform_admin()).
  useRealtime({ table: "support_tickets", onChange: () => void listeLaden() });
  useRealtime({ table: "support_messages", onChange: () => void listeLaden() });

  return (
    <div className="flex min-h-0 flex-1">
      <aside className="flex w-80 shrink-0 flex-col border-r border-border">
        {/* Die Filter liegen im Menü, nicht als Chip-Wand über der Liste: sie
            werden selten umgestellt, kosteten aber dauerhaft drei Zeilen Platz,
            die der Konversationsliste fehlen. */}
        <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
          <p className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            {filterText(filter)}
          </p>
          <FilterMenue filter={filter} setFilter={setFilter} />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {liste.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              Keine Konversationen in dieser Ansicht.
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {liste.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => setAktiveId(t.id)}
                    className={`flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-muted/40 ${
                      aktiveId === t.id ? "bg-muted/60" : ""
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <span
                        className={`min-w-0 flex-1 truncate text-sm ${
                          t.unread > 0 ? "font-semibold" : "font-medium"
                        }`}
                      >
                        {t.subject}
                      </span>
                      {t.unread > 0 && (
                        <span className="shrink-0 rounded-full bg-foreground px-2 py-0.5 text-[0.6875rem] font-semibold text-background">
                          {t.unread}
                        </span>
                      )}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {melderName(t)}
                      {t.source === "chat" ? " · Chat" : ""}
                      {t.source === "web" ? " · Website" : ""}
                      {" · "}
                      {PRIO_LABEL[t.priority] ?? t.priority}
                    </span>
                    {t.last_message_preview && (
                      <span className="truncate text-xs text-muted-foreground">
                        {t.last_message_kind === "agent" ? "Team: " : ""}
                        {t.last_message_preview}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>

      {aktiveId ? (
        <Verlauf
          key={aktiveId}
          ticketId={aktiveId}
          eigeneUserId={eigeneUserId}
          aufAenderung={listeLaden}
        />
      ) : (
        <div className="flex flex-1 items-center justify-center">
          <p className="text-sm text-muted-foreground">
            Konversation links auswählen.
          </p>
        </div>
      )}
    </div>
  );
}

/** Wer meldet? Betrieb, Plattform-Gast oder anonymer Website-Besucher. */
function melderName(ticket: {
  tenant_name: string | null;
  reporter_guest_id: string | null;
  reporter_name: string | null;
}): string {
  if (ticket.tenant_name) return ticket.tenant_name;
  if (ticket.reporter_name) return ticket.reporter_name;
  if (ticket.reporter_guest_id) return "Plattform-Gast";
  return "—";
}

const KANAL_TEXT: Record<"form" | "chat" | "web", string> = {
  form: " · Formular",
  chat: " · Live-Chat",
  web: " · Website-Anfrage",
};

const KANAL_LABEL: Record<Filter["source"], string> = {
  alle: "Alle Kanäle",
  chat: "Chat",
  form: "Formular",
  // Anfrage aus dem Widget der Marketing-Seite: ein Interessent OHNE Konto.
  web: "Website",
};

/** Aktuelle Filter in einer Zeile — die Liste soll ohne Klick erklärbar sein. */
function filterText(filter: Filter): string {
  const teile = [
    filter.status === "alle" ? "Alle Status" : STATUS_LABEL[filter.status],
    KANAL_LABEL[filter.source],
  ];
  if (filter.mine) teile.push("nur meine");
  return teile.join(" · ");
}

function FilterMenue({
  filter,
  setFilter,
}: {
  filter: Filter;
  setFilter: React.Dispatch<React.SetStateAction<Filter>>;
}) {
  const [offen, setOffen] = useState(false);
  const huelle = useRef<HTMLDivElement | null>(null);

  // Schließen bei Klick daneben und mit Escape — ein Menü, das offen bleibt,
  // verdeckt genau die Liste, für die es da ist.
  useEffect(() => {
    if (!offen) return;
    const beiKlick = (e: MouseEvent) => {
      if (!huelle.current?.contains(e.target as Node)) setOffen(false);
    };
    const beiTaste = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOffen(false);
    };
    document.addEventListener("mousedown", beiKlick);
    document.addEventListener("keydown", beiTaste);
    return () => {
      document.removeEventListener("mousedown", beiKlick);
      document.removeEventListener("keydown", beiTaste);
    };
  }, [offen]);

  return (
    <div ref={huelle} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOffen((v) => !v)}
        aria-label="Filter"
        aria-expanded={offen}
        className="flex size-8 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors hover:border-foreground hover:text-foreground"
      >
        <Icon icon="ph:dots-three-vertical-bold" className="size-4" />
      </button>

      {offen && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-56 rounded-2xl border border-border bg-card p-2 shadow-xl"
        >
          <p className="px-2 pb-1 pt-1.5 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
            Status
          </p>
          {(["open", "waiting", "resolved", "closed", "alle"] as const).map(
            (s) => (
              <MenuEintrag
                key={s}
                aktiv={filter.status === s}
                onClick={() => setFilter((f) => ({ ...f, status: s }))}
              >
                {s === "alle" ? "Alle Status" : STATUS_LABEL[s]}
              </MenuEintrag>
            ),
          )}

          <p className="mt-1 border-t border-border px-2 pb-1 pt-2 text-[0.6875rem] font-semibold uppercase tracking-wide text-muted-foreground">
            Kanal
          </p>
          {(["alle", "chat", "web", "form"] as const).map((q) => (
            <MenuEintrag
              key={q}
              aktiv={filter.source === q}
              onClick={() => setFilter((f) => ({ ...f, source: q }))}
            >
              {KANAL_LABEL[q]}
            </MenuEintrag>
          ))}

          <div className="mt-1 border-t border-border pt-1">
            <MenuEintrag
              aktiv={filter.mine}
              onClick={() => setFilter((f) => ({ ...f, mine: !f.mine }))}
            >
              Nur mir zugewiesene
            </MenuEintrag>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuEintrag({
  aktiv,
  onClick,
  children,
}: {
  aktiv: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={aktiv}
      onClick={onClick}
      className="flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-left text-sm transition-colors hover:bg-muted/60"
    >
      <Icon
        icon="ph:check"
        className={`size-4 shrink-0 ${aktiv ? "opacity-100" : "opacity-0"}`}
      />
      {children}
    </button>
  );
}

function FilterChip({
  aktiv,
  onClick,
  children,
}: {
  aktiv: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        aktiv
          ? "border-foreground bg-foreground text-background"
          : "border-border hover:border-foreground"
      }`}
    >
      {children}
    </button>
  );
}

// --- Verlauf + Antwortfeld ---------------------------------------------------

function Verlauf({
  ticketId,
  eigeneUserId,
  aufAenderung,
}: {
  ticketId: string;
  eigeneUserId: string;
  aufAenderung: () => Promise<void>;
}) {
  const [ticket, setTicket] = useState<SupportTicketDetail | null>(null);
  const [text, setText] = useState("");
  const [intern, setIntern] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const endeRef = useRef<HTMLDivElement | null>(null);
  const clientIdRef = useRef(crypto.randomUUID());
  const { gegenseiteTippt, tippen } = useTypingChannel(ticketId, "agent");

  const laden = useCallback(async () => {
    const res = await konversation(ticketId);
    if (res.ok) setTicket(res.data);
  }, [ticketId]);

  useEffect(() => {
    void (async () => {
      await laden();
      await gelesenMarkieren(ticketId);
      await aufAenderung();
    })();
  }, [laden, ticketId, aufAenderung]);

  // Signal genügt: die Wahrheit (inkl. interner Notizen) kommt vom Server.
  useRealtime({
    table: "support_messages",
    filter: `ticket_id=eq.${ticketId}`,
    onChange: () => {
      void (async () => {
        await laden();
        await gelesenMarkieren(ticketId);
        await aufAenderung();
      })();
    },
  });
  useRealtime({
    table: "support_tickets",
    filter: `id=eq.${ticketId}`,
    onChange: () => void laden(),
  });

  useEffect(() => {
    endeRef.current?.scrollIntoView({ block: "end" });
  }, [ticket?.messages.length, gegenseiteTippt]);

  async function senden() {
    const inhalt = text.trim();
    if (!inhalt || laeuft) return;
    setLaeuft(true);
    const res = await antworten(
      ticketId,
      inhalt,
      intern,
      clientIdRef.current,
    );
    setLaeuft(false);
    if (!res.ok) {
      toast.error(res.fehler);
      return;
    }
    clientIdRef.current = crypto.randomUUID();
    setText("");
    toast.success(intern ? "Notiz gespeichert." : "Antwort gesendet.");
    await laden();
    await aufAenderung();
  }

  async function statusWechseln(neu: TicketStatus) {
    const res = await statusSetzen(ticketId, neu);
    if (!res.ok) {
      toast.error(res.fehler);
      return;
    }
    toast.success(`Status: ${STATUS_LABEL[neu]}`);
    await laden();
    await aufAenderung();
  }

  async function mirZuweisen() {
    const res = await zuweisen(ticketId, eigeneUserId);
    if (!res.ok) {
      toast.error(res.fehler);
      return;
    }
    toast.success("Dir zugewiesen.");
    await laden();
    await aufAenderung();
  }

  if (!ticket) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">Wird geladen …</p>
      </div>
    );
  }

  return (
    <>
      <section className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-start gap-3 border-b border-border px-5 py-3">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold">{ticket.subject}</h2>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {melderName(ticket)}
              {KANAL_TEXT[ticket.source]}
              {ticket.category ? ` · ${ticket.category}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap gap-1.5">
            {(Object.keys(STATUS_LABEL) as TicketStatus[]).map((s) => (
              <FilterChip
                key={s}
                aktiv={s === ticket.status}
                onClick={() => void statusWechseln(s)}
              >
                {STATUS_LABEL[s]}
              </FilterChip>
            ))}
          </div>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {ticket.messages.map((m) => (
            <Nachricht key={m.id} nachricht={m} />
          ))}
          {gegenseiteTippt && (
            <p className="text-xs text-muted-foreground">
              Der Melder schreibt …
            </p>
          )}
          <div ref={endeRef} />
        </div>

        <div className="border-t border-border p-3">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {BAUSTEINE.map((b) => (
              <button
                key={b.kurz}
                type="button"
                onClick={() => setText((v) => (v ? `${v}\n${b.text}` : b.text))}
                className="rounded-full border border-border px-3 py-1 text-xs transition-colors hover:border-foreground"
              >
                {b.kurz}
              </button>
            ))}
          </div>
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              // Tippt-Anzeige nur bei ÖFFENTLICHEN Antworten: dass das Team
              // gerade eine interne Notiz schreibt, geht den Melder nichts an.
              if (!intern) tippen();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void senden();
              }
            }}
            rows={3}
            maxLength={5000}
            placeholder={
              intern ? "Interne Notiz fürs Team …" : "Antwort an den Melder …"
            }
            className={`w-full resize-none rounded-2xl border px-3.5 py-2.5 text-sm outline-none ${
              intern
                ? "border-dashed border-muted-foreground/50 bg-muted/40"
                : "border-border focus:border-foreground"
            }`}
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={intern}
                onChange={(e) => setIntern(e.target.checked)}
                className="size-4"
              />
              Interne Notiz (Melder sieht sie nicht)
            </label>
            <button
              type="button"
              disabled={laeuft || !text.trim()}
              onClick={() => void senden()}
              className="rounded-full bg-foreground px-5 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {laeuft ? "Wird gesendet …" : intern ? "Notiz speichern" : "Antworten"}
            </button>
          </div>
        </div>
      </section>

      <Kontext
        ticket={ticket}
        eigeneUserId={eigeneUserId}
        aufZuweisen={mirZuweisen}
      />
    </>
  );
}

function Nachricht({ nachricht }: { nachricht: SupportMessage }) {
  const vomTeam = nachricht.author_kind === "agent";
  return (
    <div
      className={`rounded-2xl border p-4 ${
        nachricht.internal
          ? "border-dashed border-muted-foreground/40 bg-muted/40"
          : vomTeam
            ? "border-border bg-muted/20"
            : "border-border"
      }`}
    >
      <div className="flex items-baseline justify-between gap-4">
        <span className="text-xs font-semibold">
          {vomTeam ? "Team" : "Melder"}
          {nachricht.internal && (
            <span className="ml-2 rounded-full bg-muted-foreground/20 px-2 py-0.5 text-[0.6875rem] font-medium">
              interne Notiz
            </span>
          )}
        </span>
        <span className="shrink-0 text-[0.6875rem] text-muted-foreground">
          {new Date(nachricht.created_at).toLocaleString("de-DE")}
        </span>
      </div>
      <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed">
        {nachricht.body}
      </p>
    </div>
  );
}

function Kontext({
  ticket,
  eigeneUserId,
  aufZuweisen,
}: {
  ticket: SupportTicketDetail;
  eigeneUserId: string;
  aufZuweisen: () => Promise<void>;
}) {
  const zeilen: { label: string; wert: React.ReactNode }[] = [
    {
      label: "Melder",
      wert: ticket.tenant_id ? (
        <a
          href={`/betriebe/${ticket.tenant_id}`}
          className="underline-offset-4 hover:underline"
        >
          {ticket.tenant_name ?? ticket.tenant_id}
        </a>
      ) : (
        melderName(ticket)
      ),
    },
    // Website-Anfragen haben kein Konto: E-Mail und Telefon sind der EINZIGE
    // Rückkanal, sobald der Besucher die Seite verlassen hat.
    ...(ticket.reporter_email
      ? [
          {
            label: "E-Mail",
            wert: (
              <a
                href={`mailto:${ticket.reporter_email}`}
                className="underline-offset-4 hover:underline"
              >
                {ticket.reporter_email}
              </a>
            ),
          },
        ]
      : []),
    ...(ticket.reporter_phone
      ? [
          {
            label: "Telefon",
            wert: (
              <a
                href={`tel:${ticket.reporter_phone.replace(/\s+/g, "")}`}
                className="underline-offset-4 hover:underline"
              >
                {ticket.reporter_phone}
              </a>
            ),
          },
        ]
      : []),
    { label: "Kanal", wert: KANAL_LABEL[ticket.source] },
    { label: "Thema", wert: ticket.category ?? "—" },
    {
      label: "Priorität",
      wert: PRIO_LABEL[ticket.priority] ?? ticket.priority,
    },
    {
      label: "Erstellt",
      wert: new Date(ticket.created_at).toLocaleString("de-DE"),
    },
    {
      label: "Letzte Nachricht",
      wert: ticket.last_message_at
        ? new Date(ticket.last_message_at).toLocaleString("de-DE")
        : "—",
    },
    {
      label: "Zuständig",
      wert:
        ticket.assignee_user_id === eigeneUserId
          ? "Du"
          : ticket.assignee_user_id
            ? "Kolleg:in"
            : "Niemand",
    },
    { label: "Buchung", wert: ticket.reservation_id ?? "—" },
    { label: "Objekt", wert: ticket.property_id ?? "—" },
    {
      label: "Bewertung",
      // Keine erfundene Note: ohne Bewertung bleibt das Feld leer (Wurzel 4).
      wert: ticket.rating ? `${ticket.rating}/5` : "—",
    },
  ];

  return (
    <aside className="hidden w-72 shrink-0 flex-col overflow-y-auto border-l border-border p-4 xl:flex">
      <button
        type="button"
        onClick={() => void aufZuweisen()}
        disabled={ticket.assignee_user_id === eigeneUserId}
        className="rounded-full border border-border px-4 py-2 text-sm font-medium transition-colors hover:border-foreground disabled:opacity-50"
      >
        Mir zuweisen
      </button>
      <dl className="mt-4 divide-y divide-border rounded-2xl border border-border">
        {zeilen.map((z) => (
          <div
            key={z.label}
            className="flex items-baseline justify-between gap-3 px-3 py-2"
          >
            <dt className="text-xs text-muted-foreground">{z.label}</dt>
            <dd className="min-w-0 truncate text-xs font-medium">{z.wert}</dd>
          </div>
        ))}
      </dl>
      {ticket.rating_comment && (
        <p className="mt-3 rounded-2xl bg-muted/40 p-3 text-xs text-muted-foreground">
          „{ticket.rating_comment}"
        </p>
      )}
    </aside>
  );
}

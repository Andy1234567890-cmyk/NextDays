"use client";

// Mittlere Spalte des Posteingangs (Airbnb-Chat): Kopf mit Gastname + „›"-Pfeil
// (öffnet das Reservierungs-Panel) + Menü (Blockieren / Archivieren), darunter
// der Nachrichtenverlauf (Datums-Trenner, Blasen) und unten die Eingabe mit
// Quick-Reply-Auswahl und Senden.
import { Icon } from "@iconify/react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@nextdays/ui/button";

import type {
  HostMessage,
  HostThreadDetail,
  HostThreadSummary,
  QuickReply,
} from "@/lib/posteingang";
import {
  blockiereGast,
  fuelleVorlage,
  sendeNachricht,
  setzeArchiviert,
} from "@/lib/posteingang-actions";

export function ChatSpalte({
  detail,
  thread,
  quickReplies,
  onGesendet,
  onArchiviert,
  onBlockiert,
  onPanelToggle,
  panelOffen,
}: {
  detail: HostThreadDetail | null;
  thread: HostThreadSummary | null;
  quickReplies: QuickReply[];
  onGesendet: (msg: HostMessage) => void;
  onArchiviert: (id: string, archiviert: boolean) => void;
  onBlockiert: () => void;
  onPanelToggle: () => void;
  panelOffen: boolean;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [menueOffen, setMenueOffen] = useState(false);
  const [vorlagenOffen, setVorlagenOffen] = useState(false);
  const endeRef = useRef<HTMLDivElement>(null);

  // Zum Ende scrollen, wenn Nachrichten wachsen / Thread wechselt.
  useEffect(() => {
    endeRef.current?.scrollIntoView({ block: "end" });
  }, [detail?.messages.length, detail?.id]);

  if (!detail) {
    return (
      <section className="flex h-full items-center justify-center border-r border-border bg-muted/20">
        <div className="flex flex-col items-center text-center">
          <span className="mb-4 flex size-16 items-center justify-center rounded-full bg-muted">
            <Icon
              icon="ph:chat-teardrop-text"
              className="size-8 text-muted-foreground"
            />
          </span>
          <p className="text-lg font-semibold">Deine Nachrichten</p>
          <p className="mt-1.5 max-w-xs text-sm leading-relaxed text-muted-foreground">
            Wähle links eine Konversation, um sie zu lesen und zu beantworten.
          </p>
        </div>
      </section>
    );
  }

  const name = detail.guest_name ?? detail.guest_email ?? "Gast";

  async function senden() {
    const wert = text.trim();
    if (!wert || !detail) return;
    setBusy(true);
    setFehler(null);
    const res = await sendeNachricht(detail.id, wert);
    setBusy(false);
    if (res.ok) {
      onGesendet(res.message);
      setText("");
    } else {
      setFehler(res.error);
    }
  }

  async function vorlageEinfuegen(qr: QuickReply) {
    setVorlagenOffen(false);
    if (!detail) return;
    const res = await fuelleVorlage(detail.id, qr.id);
    if (res.ok) setText((t) => (t ? `${t}\n${res.body}` : res.body));
    else setFehler(res.error);
  }

  async function archivieren() {
    setMenueOffen(false);
    if (!detail) return;
    const res = await setzeArchiviert(detail.id, !detail.is_archived);
    if (res.ok) onArchiviert(detail.id, !detail.is_archived);
    else setFehler(res.error);
  }

  async function blockieren() {
    setMenueOffen(false);
    if (!detail) return;
    const res = await blockiereGast(detail.portal_guest_id);
    if (res.ok) onBlockiert();
    else setFehler(res.error);
  }

  return (
    <section className="flex h-full flex-col border-r border-border">
      {/* Kopf */}
      <header className="flex items-center gap-3 border-b border-border px-6 py-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-muted to-muted/60 text-[0.9375rem] font-semibold">
          {name.slice(0, 1).toUpperCase()}
        </span>
        <button
          type="button"
          onClick={onPanelToggle}
          className="group flex min-w-0 items-center gap-2 text-left"
        >
          <span className="truncate text-[1.35rem] font-semibold tracking-tight">
            {name}
          </span>
          <span className="flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors group-hover:bg-muted">
            <Icon
              icon={panelOffen ? "ph:caret-left" : "ph:caret-right"}
              className="size-4"
            />
          </span>
        </button>
        {detail.is_blocked && (
          <span className="rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-600">
            Blockiert
          </span>
        )}

        <div className="relative ml-auto">
          <button
            type="button"
            aria-label="Weitere Aktionen"
            onClick={() => setMenueOffen((v) => !v)}
            className="flex size-10 items-center justify-center rounded-full text-foreground transition-colors hover:bg-muted"
          >
            <Icon icon="ph:dots-three" className="size-5" />
          </button>
          {menueOffen && (
            <div className="absolute right-0 top-12 z-10 w-56 overflow-hidden rounded-2xl border border-border bg-background p-1.5 shadow-xl">
              <button
                type="button"
                onClick={() => void archivieren()}
                className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium hover:bg-muted"
              >
                <Icon icon="ph:archive" className="size-[1.15rem] text-muted-foreground" />
                {detail.is_archived ? "Aus Archiv holen" : "Archivieren"}
              </button>
              {!detail.is_blocked && (
                <button
                  type="button"
                  onClick={() => void blockieren()}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-rose-600 hover:bg-rose-50"
                >
                  <Icon icon="ph:prohibit" className="size-[1.15rem]" />
                  Gast blockieren
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Verlauf */}
      <div className="min-h-0 flex-1 overflow-y-auto bg-muted/20 px-6 py-6">
        {detail.messages.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-muted-foreground">
              Noch keine Nachrichten in dieser Konversation.
            </p>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-3.5">
            {detail.messages.map((m) => (
              <Blase key={m.id} nachricht={m} />
            ))}
          </div>
        )}
        <div ref={endeRef} />
      </div>

      {/* Eingabe */}
      <div className="border-t border-border px-5 py-4">
        {fehler && (
          <p className="mb-2 px-2 text-sm text-destructive">{fehler}</p>
        )}
        <div className="relative rounded-[1.5rem] border border-border bg-background transition-colors focus-within:border-foreground/40 focus-within:ring-4 focus-within:ring-muted">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void senden();
              }
            }}
            placeholder="Nachricht schreiben…"
            rows={2}
            disabled={busy}
            className="w-full resize-none bg-transparent px-5 py-4 text-[0.9375rem] outline-none placeholder:text-muted-foreground"
          />
          <div className="flex items-center justify-between px-3 pb-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setVorlagenOffen((v) => !v)}
                disabled={quickReplies.length === 0}
                className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-40"
              >
                <Icon icon="ph:lightning" className="size-4" />
                Vorlagen
              </button>
              {vorlagenOffen && quickReplies.length > 0 && (
                <div className="absolute bottom-11 left-0 z-10 max-h-72 w-72 overflow-y-auto rounded-2xl border border-border bg-background py-1 shadow-lg">
                  {quickReplies.map((qr) => (
                    <button
                      key={qr.id}
                      type="button"
                      onClick={() => void vorlageEinfuegen(qr)}
                      className="block w-full px-4 py-2.5 text-left hover:bg-muted"
                    >
                      <span className="block text-sm font-medium">{qr.title}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {qr.body}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Button
              type="button"
              onClick={() => void senden()}
              disabled={busy || !text.trim()}
              className="size-9 rounded-full p-0"
              aria-label="Senden"
            >
              <Icon icon="ph:arrow-up" className="size-4" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

function Blase({ nachricht }: { nachricht: HostMessage }) {
  const vomHost = nachricht.sender === "host";
  return (
    <div className={`flex ${vomHost ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[78%] px-4 py-3 text-[0.9375rem] leading-relaxed ${
          vomHost
            ? "rounded-[1.25rem] rounded-br-md bg-foreground text-background"
            : "rounded-[1.25rem] rounded-bl-md bg-muted text-foreground"
        }`}
      >
        <p className="whitespace-pre-line">{nachricht.body}</p>
        <p
          className={`mt-1.5 text-right text-[0.6875rem] ${vomHost ? "text-background/55" : "text-muted-foreground"}`}
        >
          {uhrzeit(nachricht.created_at)}
        </p>
      </div>
    </div>
  );
}

function uhrzeit(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("de-DE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

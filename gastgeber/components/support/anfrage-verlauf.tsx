"use client";

// Verlauf einer Support-Anfrage + Antwortfeld.
//
// Der Verlauf enthält ausschließlich sichtbare Nachrichten — interne
// Team-Notizen filtert der Server heraus (support_messages.internal) und sie
// erreichen den Client gar nicht erst.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import type { TicketDetail } from "@/lib/support";
import { ticketAntworten } from "@/lib/support-actions";
import { useRealtime } from "@/lib/use-realtime";

import { STATUS_ANZEIGE, themaLabel } from "./themen-katalog";

export function AnfrageVerlauf({ ticket }: { ticket: TicketDetail }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [laeuft, setLaeuft] = useState(false);

  const anzeige = STATUS_ANZEIGE[ticket.status] ?? STATUS_ANZEIGE.in_bearbeitung;

  // Realtime: Antworten des Teams erscheinen sofort, ohne Neuladen. Die
  // RLS-Policy (0205) liefert nur sichtbare Nachrichten aus — interne Notizen
  // lösen hier gar kein Event aus.
  useRealtime({
    table: "support_messages",
    filter: `ticket_id=eq.${ticket.id}`,
    onChange: () => router.refresh(),
  });

  // Statuswechsel durch das Team (z. B. „Gelöst") ebenfalls live spiegeln.
  useRealtime({
    table: "support_tickets",
    filter: `id=eq.${ticket.id}`,
    onChange: () => router.refresh(),
  });

  async function senden() {
    if (!text.trim()) return;
    setLaeuft(true);
    const res = await ticketAntworten(ticket.id, text.trim());
    setLaeuft(false);
    if (res.ok) {
      setText("");
      toast.success("Antwort gesendet.");
    } else {
      toast.error(res.fehler);
    }
  }

  return (
    <>
      <div className="mt-4 flex items-start justify-between gap-4">
        <h1 className="font-sans text-[1.75rem] font-bold tracking-tight">
          {ticket.subject}
        </h1>
        <span
          className={`mt-1 shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
            anzeige.ton === "du"
              ? "bg-foreground text-background"
              : anzeige.ton === "fertig"
                ? "bg-muted text-muted-foreground"
                : "bg-muted text-foreground"
          }`}
        >
          {anzeige.label}
        </span>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        {themaLabel(ticket.category) ?? "Allgemein"} · Erstellt am{" "}
        {new Date(ticket.created_at).toLocaleDateString("de-DE")}
      </p>

      {/* Verlauf: eigene Nachrichten rechts, Team links (Chat-Anmutung). */}
      <div className="mt-8 space-y-4">
        {ticket.messages.map((m) => {
          const vomTeam = m.author_kind === "agent";
          return (
            <div
              key={m.id}
              className={`flex ${vomTeam ? "justify-start" : "justify-end"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-5 py-4 ${
                  vomTeam ? "bg-muted/50" : "border border-border"
                }`}
              >
                <p className="text-xs font-semibold text-muted-foreground">
                  {vomTeam ? "myNextDays Support" : "Du"} ·{" "}
                  {new Date(m.created_at).toLocaleString("de-DE")}
                </p>
                <p className="mt-1.5 whitespace-pre-wrap text-[0.9375rem] leading-relaxed">
                  {m.body}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Antwortfeld — auch bei gelösten Anfragen: eine Rückfrage öffnet den
          Vorgang serverseitig wieder, statt ins Leere zu laufen. */}
      <div className="mt-8 rounded-2xl border border-border p-5">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          maxLength={5000}
          placeholder="Antwort schreiben …"
          className="w-full resize-none bg-transparent text-[0.9375rem] outline-none"
        />
        <div className="mt-4 flex justify-end border-t border-border pt-4">
          <button
            type="button"
            disabled={laeuft || !text.trim()}
            onClick={() => void senden()}
            className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {laeuft ? "Wird gesendet …" : "Antworten"}
          </button>
        </div>
      </div>
    </>
  );
}

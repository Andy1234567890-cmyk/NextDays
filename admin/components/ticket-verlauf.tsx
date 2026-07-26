"use client";

// Verlauf eines Support-Tickets + Antwortfeld.
//
// Interne Notizen sind deutlich abgesetzt: sie sind NUR fürs Team und dürfen
// den Melder nie erreichen. Die Durchsetzung liegt serverseitig (ein künftiger
// Melder-Endpunkt filtert internal=true) — die farbliche Kennzeichnung hier
// verhindert, dass jemand versehentlich intern statt öffentlich antwortet.
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import type { SupportMessage, TicketStatus } from "@/lib/backoffice";
import { antworten, statusSetzen } from "@/lib/support-actions";
import { useRealtime } from "@/lib/use-realtime";

const STATUS_LABEL: Record<TicketStatus, string> = {
  open: "Offen",
  waiting: "Wartend",
  resolved: "Gelöst",
  closed: "Geschlossen",
};

export function TicketVerlauf({
  ticketId,
  status,
  nachrichten,
}: {
  ticketId: string;
  status: TicketStatus;
  nachrichten: SupportMessage[];
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [intern, setIntern] = useState(false);
  const [laeuft, setLaeuft] = useState(false);

  // Realtime: Antwortet der Melder, erscheint seine Nachricht sofort.
  //
  // ACHTUNG: Der Realtime-Client liest über die RLS-Policy (0205) und sieht
  // damit nur NICHT-interne Nachrichten. Für das Team ist das trotzdem
  // ausreichend, weil es interne Notizen selbst schreibt (die eigene Antwort
  // kommt über die Server Action zurück). Ein Event genügt als Auslöser — die
  // vollständigen Daten inkl. interner Notizen holt router.refresh() dann
  // serverseitig über /platform/support/{id}.
  useRealtime({
    table: "support_messages",
    filter: `ticket_id=eq.${ticketId}`,
    onChange: () => router.refresh(),
  });

  async function senden() {
    if (!text.trim()) return;
    setLaeuft(true);
    const res = await antworten(ticketId, text.trim(), intern);
    setLaeuft(false);
    if (res.ok) {
      setText("");
      toast.success(intern ? "Notiz gespeichert." : "Antwort gesendet.");
    } else {
      toast.error(res.fehler);
    }
  }

  async function statusWechseln(neu: TicketStatus) {
    const res = await statusSetzen(ticketId, neu);
    if (res.ok) toast.success(`Status: ${STATUS_LABEL[neu]}`);
    else toast.error(res.fehler);
  }

  return (
    <>
      <div className="mt-6 flex flex-wrap gap-2">
        {(Object.keys(STATUS_LABEL) as TicketStatus[]).map((s) => (
          <button
            key={s}
            type="button"
            disabled={s === status}
            onClick={() => void statusWechseln(s)}
            className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
              s === status
                ? "border-foreground bg-foreground text-background"
                : "border-border hover:border-foreground"
            }`}
          >
            {STATUS_LABEL[s]}
          </button>
        ))}
      </div>

      <div className="mt-8 space-y-4">
        {nachrichten.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Noch keine Nachrichten.
          </p>
        ) : (
          nachrichten.map((m) => (
            <div
              key={m.id}
              className={`rounded-2xl border p-5 ${
                m.internal
                  ? "border-dashed border-muted-foreground/40 bg-muted/40"
                  : m.author_kind === "agent"
                    ? "border-border bg-muted/20"
                    : "border-border"
              }`}
            >
              <div className="flex items-baseline justify-between gap-4">
                <span className="text-sm font-semibold">
                  {m.author_kind === "agent" ? "Team" : "Melder"}
                  {m.internal && (
                    <span className="ml-2 rounded-full bg-muted-foreground/20 px-2 py-0.5 text-xs font-medium">
                      interne Notiz
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {new Date(m.created_at).toLocaleString("de-DE")}
                </span>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-[0.9375rem] leading-relaxed">
                {m.body}
              </p>
            </div>
          ))
        )}
      </div>

      <div className="mt-8 rounded-2xl border border-border p-5">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          maxLength={5000}
          placeholder={
            intern ? "Interne Notiz fürs Team …" : "Antwort an den Melder …"
          }
          className="w-full resize-none bg-transparent text-[0.9375rem] outline-none"
        />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
          <label className="flex items-center gap-2 text-sm">
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
            className="rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {laeuft ? "Wird gesendet …" : intern ? "Notiz speichern" : "Antworten"}
          </button>
        </div>
      </div>
    </>
  );
}

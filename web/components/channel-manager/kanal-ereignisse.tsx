"use client";

// Kanal-Ereignisse: was die Portale uns per Webhook gemeldet haben.
//
// WARUM DIESE ANSICHT: Die Ereignisse liegen seit Langem in der Datenbank und
// die Endpunkte gibt es auch — nur gesehen hat sie nie jemand. Damit liefen
// Sync-Fehler, nicht zuordenbare Buchungen und vor allem fristgebundene
// Airbnb-Anfragen (~24 h bis zur automatischen Ablehnung) ins Leere.
//
// ZUR LIVE-AKTUALISIERUNG: `channex_webhook_event` ist für `authenticated`
// bewusst gesperrt (Wurzel 6, Migration 0337 — der Payload trägt Gast-PII) und
// liegt nicht in der Realtime-Publikation. Ein Abo darauf wäre eine stumme
// Attrappe: verbindet sich, liefert nie ein Event. Die Seite hört deshalb auf
// `reservations` — die erlaubte Quelle, die sich bei genau den Ereignissen
// mitbewegt, die zählen (neue/geänderte/stornierte OTA-Buchung). Ein reiner
// Sync-Fehler ohne Buchungsbezug erscheint erst beim nächsten Laden; der Knopf
// oben macht das ausdrücklich möglich, statt Frische vorzutäuschen.
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { kanalEreignisAbhaken, type KanalEreignis } from "@/lib/channex";

/** Dringlichkeit — Farbe UND Text, nie nur Farbe (WCAG 1.4.1). */
const SEVERITY: Record<string, { label: string; stil: string }> = {
  error: {
    label: "Fehler",
    stil: "bg-red-500/10 text-red-700 dark:text-red-400",
  },
  action: {
    label: "Handlung nötig",
    stil: "bg-amber-500/10 text-amber-700 dark:text-amber-400",
  },
  info: { label: "Hinweis", stil: "bg-muted text-muted-foreground" },
};

/** Klartext je Ereignis-Art. Was nicht hier steht, wird als Rohwert gezeigt —
 *  ein erfundener Text wäre schlimmer als ein technischer (Wurzel 4). */
const EREIGNIS_TEXT: Record<string, string> = {
  sync_error: "Ein Portal meldet einen Synchronisierungsfehler.",
  sync_warning: "Ein Portal meldet eine Warnung zur Synchronisierung.",
  rate_error: "Ein Preis wurde vom Portal abgelehnt.",
  general_error: "Das Portal meldet einen allgemeinen Fehler.",
  booking_unmapped_room:
    "Eine Buchung kam für eine Einheit, die keinem Objekt zugeordnet ist.",
  booking_unmapped_rate:
    "Eine Buchung kam für einen Preisplan, der nicht zugeordnet ist.",
  booking_without_property_id:
    "Eine Buchung kam ohne erkennbares Objekt an.",
  non_acked_booking:
    "Eine Buchung wurde noch nicht bestätigt und wird erneut gesendet.",
  reservation_request:
    "Eine Buchungsanfrage wartet auf Antwort — sie verfällt automatisch.",
  alteration_request: "Ein Gast möchte seine Buchung ändern.",
  inquiry: "Eine Gastanfrage ist eingegangen.",
  review: "Eine neue Bewertung ist eingegangen.",
  updated_review: "Eine Bewertung wurde geändert.",
  activate_channel: "Ein Kanal wurde aktiviert.",
  deactivate_channel: "Ein Kanal wurde deaktiviert.",
  disconnect_channel: "Die Verbindung zu einem Kanal wurde getrennt.",
  disconnect_listing: "Ein Inserat wurde vom Kanal getrennt.",
  wubook_flooding_detected: "Ein Portal drosselt uns wegen zu vieler Anfragen.",
};

function zeitText(wert: string | null): string {
  if (!wert) return "—";
  return new Date(wert).toLocaleString("de-DE");
}

export function KanalEreignisse({
  ereignisse,
  fehler,
}: {
  ereignisse: KanalEreignis[];
  fehler: string | null;
}) {
  const router = useRouter();
  const [nurOffene, setNurOffene] = useState(false);
  const [laeuft, starte] = useTransition();
  const [gerade, setGerade] = useState<string | null>(null);

  function abhaken(e: KanalEreignis) {
    setGerade(e.id);
    starte(async () => {
      const r = await kanalEreignisAbhaken(e.id);
      setGerade(null);
      if (r.ok) {
        toast.success("Ereignis abgehakt.");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  }

  if (fehler) {
    return (
      <div className="rounded-(--radius) border border-dashed p-8 text-center">
        <p className="text-sm font-medium">Ereignisse nicht ladbar</p>
        <p className="mt-2 text-sm text-muted-foreground">{fehler}</p>
      </div>
    );
  }

  const sichtbar = nurOffene
    ? ereignisse.filter((e) => !e.resolved)
    : ereignisse;
  const offen = ereignisse.filter((e) => !e.resolved).length;
  const handlung = ereignisse.filter(
    (e) => !e.resolved && e.severity === "action",
  ).length;

  return (
    <div className="flex flex-col gap-4">
      {/* Fristgebundenes zuerst: eine Airbnb-Anfrage verfällt von selbst. */}
      {handlung > 0 ? (
        <div className="rounded-(--radius) border border-amber-500/40 bg-amber-500/10 p-4">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
            {handlung === 1
              ? "1 Anfrage wartet auf eine Antwort"
              : `${handlung} Anfragen warten auf eine Antwort`}
          </p>
          <p className="mt-1 text-sm text-amber-800/80 dark:text-amber-300/80">
            Anfragen verfallen beim Portal automatisch, wenn sie unbeantwortet
            bleiben. Beantwortet werden sie im Portal selbst — „Abhaken" hier
            ist nur eine interne Notiz und ersetzt die Antwort nicht.
          </p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {ereignisse.length === 0
            ? "Keine Ereignisse"
            : `${ereignisse.length} Ereignis(se) · ${offen} offen`}
        </p>
        <div className="flex gap-2">
          {offen > 0 ? (
            <Button
              type="button"
              variant={nurOffene ? "default" : "outline"}
              size="sm"
              onClick={() => setNurOffene((v) => !v)}
              aria-pressed={nurOffene}
            >
              {nurOffene ? "Alle anzeigen" : `Nur offene (${offen})`}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => router.refresh()}
          >
            <Icon icon="ph:arrows-clockwise" className="size-4" />
            Aktualisieren
          </Button>
        </div>
      </div>

      {sichtbar.length === 0 ? (
        <div className="rounded-(--radius) border border-dashed p-8 text-center">
          <p className="text-sm font-medium">
            {nurOffene ? "Nichts Offenes." : "Noch keine Ereignisse."}
          </p>
          <p className="mt-2 text-sm text-muted-foreground">
            {nurOffene
              ? "Alle Ereignisse sind abgehakt."
              : "Sobald ein Portal etwas meldet, erscheint es hier."}
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {sichtbar.map((e) => {
            const sev = SEVERITY[e.severity] ?? SEVERITY.info;
            return (
              <li
                key={e.id}
                className={`rounded-(--radius) border p-4 ${
                  e.resolved
                    ? "opacity-60"
                    : e.severity === "error"
                      ? "border-red-500/30"
                      : e.severity === "action"
                        ? "border-amber-500/40"
                        : ""
                }`}
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span
                    className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${sev.stil}`}
                  >
                    {sev.label}
                  </span>
                  <span className="font-medium">
                    {EREIGNIS_TEXT[e.event] ?? e.event}
                  </span>
                  {e.resolved ? (
                    <span className="text-xs text-muted-foreground">
                      abgehakt
                    </span>
                  ) : null}
                  <span className="ml-auto text-xs text-muted-foreground">
                    {zeitText(e.created_at)}
                  </span>
                </div>

                {/* Die technische Art bleibt sichtbar — im Support ist genau
                    dieser Wert die Frage („welches Event kam rein?"). */}
                <p className="mt-1.5 font-mono text-xs text-muted-foreground">
                  {e.event}
                </p>

                {!e.resolved ? (
                  <div className="mt-3 flex justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => abhaken(e)}
                      disabled={laeuft && gerade === e.id}
                    >
                      {laeuft && gerade === e.id ? "…" : "Abhaken"}
                    </Button>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

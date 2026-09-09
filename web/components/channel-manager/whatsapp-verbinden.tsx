"use client";

// WhatsApp-Kanal verbinden (/channels/whatsapp) — Einstieg und Rückleitungsziel
// von Metas gehostetem Embedded Signup.
//
// Ablauf:
//  1. „Nummer verbinden" öffnet Metas Signup-Seite in einem EIGENEN Tab (Adresse
//     kommt vom Server, damit App- und Konfigurations-ID nicht im Bundle stehen).
//  2. Der Betrieb wählt dort sein Business-Portfolio, legt seine WABA an und
//     registriert seine Nummer.
//  3. Meta leitet in DIESEM Tab auf diese Seite zurück, mit `?code=…`.
//  4. Der Code lebt nur etwa 30 Sekunden — deshalb wird er sofort im ersten
//     Render eingetauscht, nicht auf Knopfdruck.
//  5. Der Tab, aus dem heraus gestartet wurde, lebt weiter und zeigt sonst
//     dauerhaft „nicht verbunden". Er erfährt vom Erfolg über einen
//     BroadcastChannel (gleicher Origin, keine DB nötig) und lädt den Status neu.
//
// Der Code wird nach dem Eintauschen aus der Adressleiste entfernt: ein Reload
// mit verbrauchtem Code brächte sonst eine irritierende Fehlermeldung, und der
// Code hätte nichts in der Browser-Historie zu suchen.
import { Icon } from "@iconify/react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import {
  connectWhatsApp,
  disconnectWhatsApp,
  getWhatsAppOnboardingStatus,
  getWhatsAppStartLink,
  type WhatsAppOnboardingResult,
  type WhatsAppOnboardingStatus,
} from "@/lib/whatsapp-api";

type Start = { available: boolean; url: string | null; reason: string | null };

// Name des Kanals, über den der Signup-Tab dem Ausgangstab Bescheid gibt.
const VERBUNDEN_KANAL = "whatsapp-onboarding";

// Kein tenantId-Prop: der Tenant kommt serverseitig aus dem JWT, und ohne
// Realtime-Abo (siehe unten) braucht die Komponente ihn hier nicht.
export function WhatsAppVerbinden() {
  const router = useRouter();
  const params = useSearchParams();
  const code = params.get("code");

  const [status, setStatus] = useState<WhatsAppOnboardingStatus | null>(null);
  const [start, setStart] = useState<Start | null>(null);
  const [tausche, setTausche] = useState(false);
  // Trennen ist ohne erneuten Meta-Durchlauf nicht umkehrbar, deshalb erst
  // fragen. Zwei Zustände statt eines Dialogs: der Knopf wird zur Rückfrage.
  const [trennFrage, setTrennFrage] = useState(false);
  const [trennt, setTrennt] = useState(false);
  const [ergebnis, setErgebnis] = useState<WhatsAppOnboardingResult | null>(null);
  // Gegen den doppelten Aufruf im React-Strict-Mode und gegen Doppelklick: ein
  // verbrauchter Code darf nicht zweimal eingetauscht werden (Wurzel 2).
  const eingetauscht = useRef<string | null>(null);

  async function laden() {
    const [s, l] = await Promise.all([
      getWhatsAppOnboardingStatus(),
      getWhatsAppStartLink(),
    ]);
    setStatus(s.ok ? s.data : null);
    setStart(l.ok ? l.data : { available: false, url: null, reason: l.error });
  }

  useEffect(() => {
    void laden();
  }, []);

  useEffect(() => {
    if (!code || eingetauscht.current === code) return;
    eingetauscht.current = code;
    setTausche(true);
    void (async () => {
      const res = await connectWhatsApp(code);
      if (res.ok) {
        setErgebnis(res.data);
        toast.success("WhatsApp-Nummer verbunden.");
        await laden();
        // Der Tab, aus dem heraus gestartet wurde, weiß davon nichts.
        new BroadcastChannel(VERBUNDEN_KANAL).postMessage("verbunden");
      } else {
        toast.error(res.error);
      }
      setTausche(false);
      router.replace("/channels/whatsapp");
    })();
  }, [code, router]);

  // Gegenstück zum Broadcast oben: hat ein anderer Tab die Nummer verbunden,
  // holt dieser hier seinen Status nach — sonst zeigte er bis zum manuellen
  // Reload weiter „nicht verbunden".
  useEffect(() => {
    const kanal = new BroadcastChannel(VERBUNDEN_KANAL);
    kanal.onmessage = () => void laden();
    return () => kanal.close();
  }, []);

  // KEIN Realtime-Abo auf `whatsapp_account`: die Tabelle ist für
  // `authenticated` bewusst gesperrt (Migration 0255, Wurzel 6 — dort liegt das
  // Zugangstoken des Kunden). Ein Abo darauf wäre eine stumme Attrappe: die
  // Seite sähe live aus und aktualisierte nie. Eine erlaubte Ersatzquelle gibt
  // es nicht, also lädt die Seite nach dem Verbinden einmal selbst neu.
  // Änderungen an Qualität/Sendelimit kommen über Metas Webhooks in die DB und
  // erscheinen beim nächsten Aufruf.

  if (tausche) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon icon="svg-spinners:180-ring" className="size-4" />
        Verbindung mit Meta wird abgeschlossen …
      </div>
    );
  }

  const verbunden = Boolean(status?.connected);

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-border bg-card p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Icon
              icon={verbunden ? "ph:plugs-connected" : "ph:plugs"}
              className={`mt-0.5 size-6 ${
                verbunden ? "text-emerald-600" : "text-muted-foreground"
              }`}
            />
            <div>
              <p className="font-display text-base font-extrabold">
                {verbunden
                  ? `Verbunden${
                      status?.display_phone_number
                        ? ` · ${status.display_phone_number}`
                        : ""
                    }`
                  : "Noch keine Nummer verbunden"}
              </p>
              <p className="text-sm text-muted-foreground">
                {verbunden
                  ? status?.verified_name ||
                    "Nachrichten laufen über die eigene Nummer des Betriebs."
                  : "Der Betrieb verbindet seine eigene WhatsApp-Business-Nummer. Gäste sehen dann den Namen des Betriebs, nicht myNextDays."}
              </p>
            </div>
          </div>
          {/* Eigener Tab: Meta verlangt für das Signup einen Facebook-Login,
              und der Betrieb soll dabei sein myNextDays-Fenster behalten. */}
          {!verbunden && start?.available && start.url && (
            <Button asChild>
              <a href={start.url} target="_blank" rel="noopener noreferrer">
                Nummer verbinden
                <Icon icon="ph:arrow-square-out" className="size-4" />
              </a>
            </Button>
          )}
          {/* Der Weg ZURÜCK. Ohne ihn war eine einmal verbundene Nummer
              endgültig: der Verbinden-Knopf oben erscheint nur bei
              `!verbunden`. Wer beim Aufsetzen Metas Testnummer erwischt hat
              — sie entsteht mit jedem neuen Business-Portfolio —, sah
              dauerhaft „+1 555…" statt der eigenen Nummer. */}
          {verbunden && !trennFrage && (
            <Button
              variant="outline"
              onClick={() => setTrennFrage(true)}
              disabled={trennt}
            >
              Nummer trennen
            </Button>
          )}
          {verbunden && trennFrage && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">
                Wirklich trennen?
              </span>
              <Button
                variant="destructive"
                disabled={trennt}
                onClick={() => {
                  setTrennt(true);
                  void (async () => {
                    const res = await disconnectWhatsApp();
                    if (res.ok) {
                      toast.success("WhatsApp-Nummer getrennt.");
                      setErgebnis(null);
                      await laden();
                    } else {
                      toast.error(res.error);
                    }
                    setTrennt(false);
                    setTrennFrage(false);
                  })();
                }}
              >
                {trennt ? "Trennt…" : "Ja, trennen"}
              </Button>
              <Button
                variant="ghost"
                disabled={trennt}
                onClick={() => setTrennFrage(false)}
              >
                Abbrechen
              </Button>
            </div>
          )}
        </div>

        {!verbunden && start && !start.available && (
          <p className="mt-4 rounded-2xl bg-muted px-4 py-3 text-sm text-muted-foreground">
            {start.reason ||
              "Das Verbinden ist derzeit nicht möglich."}
          </p>
        )}

        {/* Verbunden heißt nicht sendebereit: ohne Zahlungsmethode im
            Meta-Konto sperrt Meta business-initiierte Nachrichten (141006). */}
        {verbunden && status?.can_send_message === false && (
          <p className="mt-4 rounded-2xl bg-amber-500/10 px-4 py-3 text-sm text-amber-700">
            <strong>Versand gesperrt.</strong>{" "}
            {/* Metas Grund endet nicht mit Punkt; der Zusatz hing bis
                08.09.2026 unmittelbar daran und ergab „…im Meta-Konto Meist
                fehlt im Meta-Konto…". Der Zusatz kommt nur noch, wenn Meta
                gar keinen Grund geliefert hat — sonst sagt er dasselbe
                zweimal. */}
            {status.send_block_reason
              ? `${status.send_block_reason.replace(/[.\s]+$/, "")}.`
              : "Meta hat den Versand gesperrt. Meist fehlt im Meta-Konto des Betriebs eine Zahlungsmethode."}
          </p>
        )}

        {verbunden && (
          <dl className="mt-4 flex flex-wrap gap-8 border-t border-border pt-4 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">Qualität</dt>
              <dd className="mt-0.5 font-semibold">
                {status?.quality_rating || "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Sendelimit</dt>
              <dd className="mt-0.5 font-semibold">
                {status?.messaging_limit_tier || "—"}
              </dd>
            </div>
          </dl>
        )}
      </div>

      {/* Nach dem Verbinden: was Meta mit den Vorlagen gemacht hat. Ablehnungen
          werden gezeigt, nicht verschluckt — sonst fehlt später eine Vorlage
          ohne ersichtlichen Grund. */}
      {ergebnis && (
        <div className="rounded-2xl border border-border bg-card p-5">
          <p className="font-display text-base font-extrabold">
            Nachrichtenvorlagen
          </p>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">
            <li>{ergebnis.templates.angelegt.length} zur Prüfung eingereicht</li>
            {ergebnis.templates.uebersprungen.length > 0 && (
              <li>
                {ergebnis.templates.uebersprungen.length} waren schon vorhanden
              </li>
            )}
            {ergebnis.templates.fehler.map((f) => (
              <li key={f} className="text-amber-700">
                {f}
              </li>
            ))}
          </ul>
          <p className="mt-3 text-sm text-muted-foreground">
            Meta prüft jede Vorlage einzeln. Bis zur Freigabe können nur
            Antworten innerhalb des 24-Stunden-Fensters gesendet werden.
          </p>
        </div>
      )}

      <div className="rounded-2xl border border-border bg-card p-5">
        <p className="font-display text-base font-extrabold">
          Was der Betrieb dafür braucht
        </p>
        <ul className="mt-3 flex flex-col gap-2 text-sm text-muted-foreground">
          <li>
            Eine Telefonnummer, die <strong>noch nicht</strong> bei WhatsApp oder
            WhatsApp Business registriert ist. Wird sie dort zuerst gelöscht,
            braucht Meta rund zehn Minuten, bevor sie hier verbunden werden kann.
          </li>
          <li>
            Ein Meta-Business-Portfolio — es kann im Verbinden-Vorgang neu
            angelegt werden.
          </li>
          <li>
            Eine <strong>Zahlungsmethode im eigenen Meta-Konto</strong>. Die
            Nachrichtenkosten rechnet Meta direkt mit dem Betrieb ab, nicht über
            myNextDays.
          </li>
        </ul>
      </div>
    </div>
  );
}

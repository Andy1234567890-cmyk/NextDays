// Support-Chat der Marketing-Seite — Blase unten rechts.
//
// Der Besucher hat kein Konto: Er hinterlässt Name, E-Mail und optional
// Telefon, schickt seine Frage ab und bekommt dieselbe Konversation, in der
// das Backoffice antwortet (support_tickets, source='web'). Die Anfrage IST
// das Ticket — es gibt kein zweites Formular „oder Ticket erstellen".
//
// Neue Antworten werden abgefragt, nicht per Realtime empfangen: Realtime
// setzt ein JWT und eine RLS-Policy voraus. support_tickets ist für anon
// bewusst vollständig gesperrt (Wurzel 6) — ein Abo dafür zu öffnen, hieße den
// gesamten Support-Verlauf aller Kunden am anon-Key erreichbar zu machen.
// Deshalb: Abruf nur, solange das Fenster offen ist.
"use client";

import { useTranslations } from "next-intl";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  chatAntworten,
  chatEroeffnen,
  chatLaden,
  gespeichertesToken,
  type SupportConversation,
  type SupportMessage,
  tokenVerwerfen,
} from "@/lib/support";

// Abstand zwischen zwei Abrufen, solange das Fenster offen ist. 8 s ist der
// Wert, den Crisp und Chatwoot für ihren Fallback ohne Websocket nutzen:
// spürbar „live", ohne den öffentlichen Endpunkt zu fluten.
const ABRUF_MS = 8000;

function neueId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function SupportChat() {
  const t = useTranslations("chat");
  const [offen, setOffen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [verlauf, setVerlauf] = useState<SupportMessage[]>([]);
  const [entwurf, setEntwurf] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const endeRef = useRef<HTMLDivElement>(null);

  // Vorhandene Konversation nach einem Seitenwechsel wiederfinden.
  useEffect(() => {
    setToken(gespeichertesToken());
  }, []);

  const uebernehmen = useCallback((k: SupportConversation) => {
    setVerlauf(k.messages);
  }, []);

  // Verlauf laden und offen halten, solange das Fenster sichtbar ist.
  useEffect(() => {
    if (!offen || !token) return undefined;

    let aktiv = true;
    const holen = async () => {
      try {
        const k = await chatLaden(token);
        if (aktiv) uebernehmen(k);
      } catch {
        // Ein 404 heißt: das Token gehört zu keiner Konversation mehr (etwa
        // nach einem Datenbank-Reset). Dann lieber neu anfangen als dem
        // Besucher ein totes Fenster zeigen.
        if (aktiv) {
          tokenVerwerfen();
          setToken(null);
          setVerlauf([]);
        }
      }
    };

    void holen();
    const timer = window.setInterval(holen, ABRUF_MS);
    return () => {
      aktiv = false;
      window.clearInterval(timer);
    };
  }, [offen, token, uebernehmen]);

  // Immer die neueste Nachricht zeigen.
  useEffect(() => {
    endeRef.current?.scrollIntoView({ block: "end" });
  }, [verlauf.length, offen]);

  async function starten(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setLaeuft(true);
    setFehler(null);
    try {
      const k = await chatEroeffnen({
        name: String(form.get("name") ?? ""),
        email: String(form.get("email") ?? ""),
        phone: String(form.get("phone") ?? ""),
        body: String(form.get("body") ?? ""),
        clientMsgId: neueId(),
      });
      setToken(k.token ?? gespeichertesToken());
      uebernehmen(k);
    } catch (err) {
      setFehler(err instanceof Error ? err.message : t("fehler"));
    } finally {
      setLaeuft(false);
    }
  }

  async function senden(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const text = entwurf.trim();
    if (!text || !token) return;

    const clientMsgId = neueId();
    // Optimistisch anzeigen; der nächste Abruf ersetzt die Zeile.
    setVerlauf((bisher) => [
      ...bisher,
      {
        id: clientMsgId,
        author_kind: "reporter",
        body: text,
        created_at: new Date().toISOString(),
        client_msg_id: clientMsgId,
      },
    ]);
    setEntwurf("");
    setFehler(null);
    try {
      await chatAntworten(token, text, clientMsgId);
      uebernehmen(await chatLaden(token));
    } catch (err) {
      setFehler(err instanceof Error ? err.message : t("fehler"));
    }
  }

  return (
    <>
      {/* Blase */}
      <button
        type="button"
        onClick={() => setOffen((o) => !o)}
        aria-label={offen ? t("schliessen") : t("oeffnen")}
        className="fixed bottom-6 right-6 z-50 flex size-14 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-float-lg transition-transform hover:scale-105"
      >
        <Icon icon={offen ? "ph:x" : "ph:chat-circle-dots"} className="size-7" />
      </button>

      {offen ? (
        <section
          aria-label={t("titel")}
          className="fixed bottom-24 right-6 z-50 flex max-h-[min(32rem,calc(100vh-8rem))] w-[min(23rem,calc(100vw-3rem))] flex-col overflow-hidden rounded-3xl bg-card shadow-float-lg"
        >
          <header className="bg-primary px-5 py-4 text-primary-foreground">
            <p className="font-display text-lg font-semibold">{t("titel")}</p>
            <p className="mt-1 text-sm text-primary-foreground/70">
              {t("untertitel")}
            </p>
          </header>

          {token ? (
            <>
              <div className="flex-1 overflow-y-auto bg-surface-warm px-4 py-4">
                <ul className="flex flex-col gap-3">
                  {verlauf.map((m) => (
                    <li
                      key={m.id}
                      className={
                        "max-w-[85%] rounded-2xl px-4 py-2.5 text-sm " +
                        (m.author_kind === "agent"
                          ? "self-start rounded-bl-sm bg-card"
                          : "self-end rounded-br-sm bg-accent text-accent-foreground")
                      }
                    >
                      {m.body}
                    </li>
                  ))}
                </ul>
                <div ref={endeRef} />
              </div>

              <form onSubmit={senden} className="flex items-center gap-2 p-3">
                <Input
                  value={entwurf}
                  onChange={(e) => setEntwurf(e.target.value)}
                  placeholder={t("platzhalter")}
                  aria-label={t("platzhalter")}
                  maxLength={5000}
                />
                <Button
                  type="submit"
                  variant="accent"
                  size="icon"
                  aria-label={t("senden")}
                  disabled={!entwurf.trim()}
                >
                  <Icon icon="ph:paper-plane-tilt-fill" className="size-4" />
                </Button>
              </form>
            </>
          ) : (
            <form
              onSubmit={starten}
              className="flex flex-col gap-4 overflow-y-auto p-5"
            >
              <div className="flex flex-col gap-2">
                <Label htmlFor="chat-name">{t("name")}</Label>
                <Input id="chat-name" name="name" required minLength={2} />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="chat-email">{t("email")}</Label>
                <Input id="chat-email" name="email" type="email" required />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="chat-phone">{t("telefon")}</Label>
                <Input id="chat-phone" name="phone" type="tel" />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="chat-body">{t("nachricht")}</Label>
                <textarea
                  id="chat-body"
                  name="body"
                  required
                  rows={3}
                  maxLength={5000}
                  className="rounded-2xl border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <Button type="submit" variant="accent" disabled={laeuft}>
                {laeuft ? t("sendet") : t("absenden")}
              </Button>
              <p className="text-xs text-muted-foreground">{t("hinweis")}</p>
            </form>
          )}

          {fehler ? (
            <p role="alert" className="bg-surface-accent px-5 py-3 text-sm text-accent">
              {fehler}
            </p>
          ) : null}
        </section>
      ) : null}
    </>
  );
}

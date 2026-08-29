"use client";

// WhatsApp-Chat im Posteingang (Meta WhatsApp Cloud API). Wird vom gemeinsamen
// Posteingang (inbox-list) gerendert, wenn ein WhatsApp-Thread offen ist —
// bidirektional senden/empfangen, neue Nachrichten kommen live (Realtime).
import { Icon } from "@iconify/react";
import { Fragment, useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";

import { Button } from "@nextdays/ui/button";
import { FeldDialogKnopf } from "@/components/inbox/feld-picker";
import { WhatsAppComposerLeiste } from "@/components/inbox/whatsapp-composer-leiste";
import { WhatsAppMetaVorlagenMenue } from "@/components/inbox/whatsapp-meta-vorlagen-menue";
import { WhatsAppVorlagenMenue } from "@/components/inbox/whatsapp-vorlagen-menue";
import { tagLabel, tagWechsel, uhrzeit, zeitpunktLang } from "@/lib/chat-format";
import {
  type WhatsAppMessage,
  getWhatsAppAiReply,
  listWhatsAppMessages,
  sendWhatsApp,
  sendWhatsAppTemplate,
} from "@/lib/whatsapp-api";

export function WhatsAppChat({
  conversationId,
  phone,
  name,
  onSent,
  kompakt,
}: {
  conversationId: string | null;
  phone: string;
  name: string | null;
  onSent: () => void;
  /** Eingebettet unter einem Kanal-Chat: eigener Kopf entfällt, den trägt
   *  dort der Trennbalken („WhatsApp mit <Gast>"). */
  kompakt?: boolean;
}) {
  const t = useTranslations("whatsapp");
  // Tages-Trenner teilt sich die Wörter „Heute"/„Gestern" mit dem OTA-Verlauf.
  const tInbox = useTranslations("inbox");
  const locale = useLocale();
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sending, startSend] = useTransition();
  const [kiLaeuft, startKi] = useTransition();
  // Sprungziel „ganz unten" am Listenende.
  const ende = useRef<HTMLDivElement>(null);
  // Das Schreibfeld selbst — die Werkzeugleiste setzt Zeichen an der
  // Auswahl, dafuer braucht sie Zugriff auf Cursor und Markierung.
  const feld = useRef<HTMLTextAreaElement>(null);

  /** Text an der Cursorposition einsetzen (Platzhalter, Vorlage). */
  const einfuegen = useCallback((eingabe: string) => {
    const el = feld.current;
    if (!el) {
      setText((v) => v + eingabe);
      return;
    }
    const start = el.selectionStart ?? el.value.length;
    const ende_ = el.selectionEnd ?? start;
    setText(el.value.slice(0, start) + eingabe + el.value.slice(ende_));
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + eingabe.length;
      el.setSelectionRange(pos, pos);
    });
  }, []);

  const load = useCallback(async () => {
    if (!conversationId) {
      setMessages([]);
      return;
    }
    const res = await listWhatsAppMessages(conversationId);
    if (res.ok) setMessages(res.data.items);
  }, [conversationId]);

  useEffect(() => {
    load();
  }, [load]);

  // Ans Ende springen — ein Chat wird von unten gelesen, der Container startet
  // aber oben. Gleiches Sentinel-Muster wie im OTA-Verlauf nebenan
  // (`inbox-konversation.tsx`); an der ANZAHL aufgehängt, nicht am Array:
  // `load()` liefert bei jedem Aufruf eine neue Referenz und risse den Nutzer
  // sonst aus dem Lesen weiter oben.
  useEffect(() => {
    ende.current?.scrollIntoView({ block: "end" });
  }, [messages.length, conversationId]);

  // KEIN Realtime-Abo mehr auf `whatsapp_message`: die Tabelle ist seit
  // Migration 0337 für `authenticated` gesperrt (Wurzel 6 — sie trägt den
  // Klartext der Gastnachrichten, den sonst jede Rolle über den
  // PostgREST-Direktpfad lesen könnte, cleaner eingeschlossen). Ohne
  // SELECT-Grant passt keine Policy mehr; das Abo wäre eine stumme Attrappe.
  //
  // Eine erlaubte Ersatzquelle gibt es nicht: an einer WhatsApp-Nachricht
  // hängt keine offene Tabelle — sie berührt weder `reservations` noch
  // `guest_messages` (das ist der Marktplatz-Posteingang, ein anderer Kanal).
  //
  // WAS DADURCH ENTFÄLLT: Eine eingehende Antwort des Gastes erscheint nicht
  // mehr von selbst im offenen Chat. Der eigene Versand hängt die Nachricht
  // direkt an (`setMessages`); die Gegenseite wird beim Wechsel der
  // Konversation oder beim erneuten Öffnen des Verlaufs sichtbar.

  function send() {
    const body = text.trim();
    if (!body) return;
    setError(null);
    startSend(async () => {
      const res = await sendWhatsApp(
        conversationId ? { conversation_id: conversationId, body } : { to_phone: phone, body },
      );
      if (res.ok) {
        setMessages((m) => [...m, res.data]);
        setText("");
        onSent();
      } else {
        setError(res.error);
      }
    });
  }

  /** KI-Vorschlag ins Feld holen. Er wird NICHT gesendet: der Mitarbeiter
   *  liest, aendert und entscheidet — genau wie im Posteingang nebenan. */
  function kiVorschlag() {
    if (!conversationId) return;
    setError(null);
    startKi(async () => {
      const res = await getWhatsAppAiReply(conversationId);
      if (res.ok) setText(res.data.reply);
      else setError(res.error);
    });
  }

  /** Eine von Meta geprüfte Vorlage senden — der Weg, wenn das
   *  24-Stunden-Fenster zu ist. Sie geht direkt raus, nicht ins Feld. */
  function sendeVorlage(name: string, sprache: string) {
    setError(null);
    startSend(async () => {
      const res = await sendWhatsAppTemplate(
        conversationId
          ? {
              conversation_id: conversationId,
              template_name: name,
              language_code: sprache,
            }
          : { to_phone: phone, template_name: name, language_code: sprache },
      );
      if (res.ok) {
        setMessages((m) => [...m, res.data]);
        onSent();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <>
      {!kompakt && (
        <div className="flex items-center gap-3 border-b border-border p-3">
          <span className="flex size-9 items-center justify-center rounded-full bg-emerald-100">
            <Icon icon="ph:whatsapp-logo" className="size-5 text-emerald-600" />
          </span>
          <div className="flex min-w-0 flex-col">
            <span className="truncate font-semibold">{name || `+${phone}`}</span>
            <span className="truncate text-xs text-muted-foreground">WhatsApp</span>
          </div>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("noMessages")}</p>
        ) : (
          messages.map((m, i) => (
            <Fragment key={m.id ?? i}>
              {/* Tages-Trenner wie im OTA-Verlauf (lib/chat-format) */}
              {tagWechsel(messages[i - 1]?.sent_at ?? null, m.sent_at) && (
                <div className="flex items-center gap-3 py-1">
                  <span className="h-px flex-1 bg-border" />
                  <span className="rounded-full bg-secondary px-3 py-1 text-[0.7rem] font-medium text-muted-foreground">
                    {tagLabel(m.sent_at, locale, tInbox)}
                  </span>
                  <span className="h-px flex-1 bg-border" />
                </div>
              )}
              <div
                className={
                  "flex flex-col gap-1 " +
                  (m.direction === "out" ? "items-end" : "items-start")
                }
              >
                <div
                  className={
                    "max-w-[80%] rounded-2xl px-3 py-2 text-sm " +
                    (m.direction === "out"
                      ? "bg-emerald-600 text-white"
                      : "bg-muted text-foreground")
                  }
                >
                  {m.body}
                </div>
                {m.sent_at && (
                  <span
                    className="text-[0.65rem] text-muted-foreground"
                    title={zeitpunktLang(m.sent_at, locale)}
                  >
                    {uhrzeit(m.sent_at, locale)}
                    {m.direction === "out" ? ` · ${m.status}` : ""}
                  </span>
                )}
              </div>
            </Fragment>
          ))
        )}
        <div ref={ende} />
      </div>

      {error && (
        <p className="mx-4 mb-2 rounded-(--radius) bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* Eingabe-Box wie im Posteingang: Textarea oben, Senden INNEN unten
          rechts — bleibt in jeder Spaltenbreite voll breit. */}
      <div className="border-t border-border p-3">
        <div className="flex flex-col rounded-2xl border border-border bg-background focus-within:ring-2 focus-within:ring-accent/40">
          {/* Auszeichnung in WhatsApps eigener Schreibweise (*fett*, _kursiv_ …),
              nicht als HTML: Meta uebertraegt Markup sonst woertlich an den Gast. */}
          <WhatsAppComposerLeiste
            feld={feld}
            wert={text}
            onWert={setText}
            zusatz={
              <>
                <WhatsAppVorlagenMenue onEinfuegen={einfuegen} />
                {/* KI-Antwort: nur bei einer bestehenden Konversation — ohne
                    Verlauf gaebe es nichts, worauf sie antworten koennte. */}
                {conversationId && (
                  <button
                    type="button"
                    onClick={kiVorschlag}
                    disabled={kiLaeuft}
                    title={tInbox("aiSuggest")}
                    className="flex items-center gap-1 rounded-full px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
                  >
                    <Icon
                      icon={kiLaeuft ? "svg-spinners:180-ring" : "ph:sparkle"}
                      className="size-4"
                    />
                    {tInbox("aiSuggest")}
                  </button>
                )}
                {/* Metas geprüfte Vorlagen: sie werden gesendet, nicht
                    eingefügt — siehe die Erklärung in der Komponente. */}
                <WhatsAppMetaVorlagenMenue
                  onSenden={sendeVorlage}
                  laeuft={sending}
                />
                {/* Derselbe Platzhalter-Katalog wie ueberall sonst. Aufgeloest
                    wird serverseitig beim Senden — hier steht nur der Name. */}
                <FeldDialogKnopf onInsert={einfuegen} />
              </>
            }
          />
          <textarea
            ref={feld}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t("placeholder")}
            rows={2}
            className="min-h-[2.5rem] w-full resize-none bg-transparent px-3 pt-2.5 pb-1 text-sm outline-none"
          />
          <div className="flex items-center justify-end px-2 pb-2">
            <Button type="button" onClick={send} disabled={sending || !text.trim()}>
              <Icon
                icon={sending ? "ph:spinner" : "ph:paper-plane-tilt"}
                className={"size-4 " + (sending ? "animate-spin" : "")}
              />
              {t("send")}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}

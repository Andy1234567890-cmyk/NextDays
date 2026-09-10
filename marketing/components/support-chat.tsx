// Support-Chat der Marketing-Seite — Blase unten rechts.
//
// DREI ZUSTÄNDE, in dieser Reihenfolge:
//
//   1. BERATER (neu, 0626): Der Besucher fragt sofort, ohne Formular. Ein
//      RAG-Bot antwortet aus den Hilfe-Artikeln — belegt, mit Quellenlink.
//   2. ÜBERGABE: Kann der Bot es nicht belegen, erscheint das Kontaktformular
//      mit der bereits gestellten Frage darin. Nichts geht verloren.
//   3. TICKET: Ab dann derselbe Weg wie zuvor — support_tickets, source='web',
//      das Backoffice antwortet im selben Fenster.
//
// WARUM DER BOT VOR DAS FORMULAR GEHÖRT: Vorher stand Name, E-Mail und
// Telefon VOR der ersten Frage. Wer wissen will, ob die Software Airbnb
// anbindet, gibt dafür keine Telefonnummer heraus — er geht. Und jede Frage,
// die der Bot beantwortet, ist ein Ticket, das nie entsteht.
//
// Neue Antworten des Backoffice werden abgefragt, nicht per Realtime
// empfangen: Realtime setzt ein JWT und eine RLS-Policy voraus.
// support_tickets ist für anon bewusst vollständig gesperrt (Wurzel 6) — ein
// Abo dafür zu öffnen, hieße den gesamten Support-Verlauf aller Kunden am
// anon-Key erreichbar zu machen. Deshalb: Abruf nur, solange das Fenster offen
// ist.
"use client";

import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ereignisMelden } from "@/lib/analytics";
import {
  type BeraterQuelle,
  beraterFragen,
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

/** Eine Zeile im Berater-Verlauf, bevor ein Ticket existiert. */
type BeraterZeile = {
  id: string;
  von: "besucher" | "berater";
  text: string;
  quellen?: BeraterQuelle[];
};

export function SupportChat() {
  const t = useTranslations("chat");
  const locale = useLocale();
  const [offen, setOffen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [verlauf, setVerlauf] = useState<SupportMessage[]>([]);
  const [entwurf, setEntwurf] = useState("");
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const endeRef = useRef<HTMLDivElement>(null);

  // --- Berater-Zustand -------------------------------------------------------
  const [beraterVerlauf, setBeraterVerlauf] = useState<BeraterZeile[]>([]);
  const [beraterLaeuft, setBeraterLaeuft] = useState(false);
  // Gesetzt, sobald der Bot übergibt: die Frage, die er nicht beantworten
  // konnte. Sie füllt das Formular vor — der Besucher tippt sie nicht neu.
  const [offeneFrage, setOffeneFrage] = useState<string | null>(null);

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
  }, [verlauf.length, beraterVerlauf.length, offen]);

  /** Frage an den Berater — der Weg VOR dem Formular. */
  async function fragen(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const frage = entwurf.trim();
    if (!frage) return;

    setEntwurf("");
    setFehler(null);
    setBeraterVerlauf((bisher) => [
      ...bisher,
      { id: neueId(), von: "besucher", text: frage },
    ]);
    setBeraterLaeuft(true);
    try {
      const a = await beraterFragen(frage, locale);
      if (a.uebergeben) {
        // Der Bot weiß es nicht — Formular zeigen, Frage mitnehmen. KEIN
        // erfundener Ersatztext: was er nicht belegen kann, sagt er nicht.
        setOffeneFrage(frage);
        setBeraterVerlauf((bisher) => [
          ...bisher,
          { id: neueId(), von: "berater", text: t("beraterUebergabe") },
        ]);
        ereignisMelden("chat_uebergabe", undefined, locale);
      } else {
        setBeraterVerlauf((bisher) => [
          ...bisher,
          {
            id: neueId(),
            von: "berater",
            text: a.antwort,
            quellen: a.quellen,
          },
        ]);
        ereignisMelden("chat_berater_antwort", undefined, locale);
      }
    } catch (err) {
      setFehler(err instanceof Error ? err.message : t("fehler"));
      setOffeneFrage(frage);
    } finally {
      setBeraterLaeuft(false);
    }
  }

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
      setOffeneFrage(null);
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

  // Nur das ÖFFNEN ist die Handlung, die zählt: derselbe Knopf schließt auch,
  // und ein Ereignis für beides würde Bedarf und Abbruch in einer Zahl
  // vermischen. Die Meldung steht deshalb hier und nicht im State-Updater —
  // React ruft den im Entwicklungsmodus doppelt auf.
  function umschalten() {
    const neuOffen = !offen;
    setOffen(neuOffen);
    if (neuOffen) ereignisMelden("chat_geoeffnet", undefined, locale);
  }

  // Welcher der drei Zustände gilt. `token` schlägt alles: läuft ein Ticket,
  // ist der Berater vorbei — der Besucher spricht mit einem Menschen.
  const zustand = token ? "ticket" : offeneFrage !== null ? "formular" : "berater";

  return (
    <>
      {/* Blase */}
      <button
        type="button"
        onClick={umschalten}
        aria-label={offen ? t("schliessen") : t("oeffnen")}
        className="fixed bottom-6 right-6 z-50 flex size-14 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-float-lg transition-transform hover:scale-105"
      >
        <Icon icon={offen ? "ph:x" : "ph:chat-circle-dots"} className="size-7" />
      </button>

      {offen ? (
        <section
          aria-label={t("titel")}
          className="fixed bottom-24 right-6 z-50 flex max-h-[min(34rem,calc(100vh-8rem))] w-[min(23rem,calc(100vw-3rem))] flex-col overflow-hidden rounded-3xl bg-card shadow-float-lg"
        >
          <header className="flex items-center gap-3 border-b border-border px-5 py-4">
            {/* Kein Fantasie-Porträt und kein erfundener Vorname: der Berater
                ist eine Software, und das steht auch so da. Ein Bot, der sich
                als „Amy" ausgibt, ist eine Falschaussage über die Gegenseite
                — und beim ersten „bist du ein Mensch?" verbrannt. */}
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-accent text-accent">
              <Icon icon="ph:sparkle" className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="truncate font-display text-base font-semibold">
                {t("beraterTitel")}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {zustand === "ticket" ? t("untertitel") : t("beraterUnter")}
              </p>
            </div>
          </header>

          {zustand === "ticket" ? (
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
          ) : null}

          {zustand === "berater" ? (
            <BeraterFenster
              verlauf={beraterVerlauf}
              laeuft={beraterLaeuft}
              entwurf={entwurf}
              setEntwurf={setEntwurf}
              onFragen={fragen}
              endeRef={endeRef}
            />
          ) : null}

          {zustand === "formular" ? (
            <form
              onSubmit={starten}
              className="flex flex-col gap-4 overflow-y-auto p-5"
            >
              {/* Der Verlauf bleibt SICHTBAR über dem Formular. Vorher wurde
                  er beim Umschalten ersetzt — der Besucher sah plötzlich ein
                  Formular, ohne den Satz „das kann ich nicht sicher
                  beantworten" noch zu lesen, und damit ohne Grund für die
                  Abfrage seiner Daten. Am 10.09.2026 im Browser gesehen. */}
              {beraterVerlauf.length > 0 ? (
                <ul className="-mx-1 flex flex-col gap-2 border-b border-border pb-4">
                  {beraterVerlauf.map((z) => (
                    <li
                      key={z.id}
                      className={
                        z.von === "berater"
                          ? "max-w-[92%] self-start rounded-2xl rounded-bl-sm bg-surface-warm px-3.5 py-2 text-sm"
                          : "max-w-[88%] self-end rounded-2xl rounded-br-sm bg-accent px-3.5 py-2 text-sm text-accent-foreground"
                      }
                    >
                      {z.text}
                    </li>
                  ))}
                </ul>
              ) : null}
              <p className="text-sm text-muted-foreground">
                {t("beraterFormularHinweis")}
              </p>
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
                {/* Die Frage ist schon getippt — sie steht als Vorbelegung
                    drin, editierbar. Sie noch einmal zu verlangen wäre der
                    Moment, in dem jemand abbricht. */}
                <textarea
                  id="chat-body"
                  name="body"
                  required
                  rows={3}
                  maxLength={5000}
                  defaultValue={offeneFrage ?? ""}
                  className="rounded-2xl border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
              <Button type="submit" variant="accent" disabled={laeuft}>
                {laeuft ? t("sendet") : t("absenden")}
              </Button>
              <p className="text-xs text-muted-foreground">{t("hinweis")}</p>
            </form>
          ) : null}

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

/** Der Berater-Bereich: Begrüßung, Verlauf, Eingabe.
 *
 *  Eigene Komponente, weil `SupportChat` mit allen drei Zuständen in einer
 *  Funktion auf Komplexität 16 kam (Gate: 15). Das ist hier keine
 *  Formalie — die drei Zustände haben nichts gemeinsam ausser dem Rahmen,
 *  und getrennt liest jeder für sich. */
function BeraterFenster({
  verlauf,
  laeuft,
  entwurf,
  setEntwurf,
  onFragen,
  endeRef,
}: {
  verlauf: BeraterZeile[];
  laeuft: boolean;
  entwurf: string;
  setEntwurf: (wert: string) => void;
  onFragen: (e: FormEvent<HTMLFormElement>) => void;
  endeRef: React.RefObject<HTMLDivElement | null>;
}) {
  const t = useTranslations("chat");

  return (
    <>
      <div className="flex-1 overflow-y-auto bg-surface-warm px-4 py-4">
        {/* Begrüßung als erste Blase, nicht als Kopfzeile: so liest das
            Fenster von der ersten Sekunde als Gespräch. */}
        <ul className="flex flex-col gap-3">
          <li className="max-w-[90%] self-start rounded-2xl rounded-bl-sm bg-card px-4 py-2.5 text-sm">
            {t("beraterBegruessung")}
          </li>
          {verlauf.map((z) => (
            <li
              key={z.id}
              className={
                z.von === "berater"
                  ? "max-w-[90%] self-start rounded-2xl rounded-bl-sm bg-card px-4 py-2.5 text-sm"
                  : "max-w-[85%] self-end rounded-2xl rounded-br-sm bg-accent px-4 py-2.5 text-sm text-accent-foreground"
              }
            >
              <span className="whitespace-pre-wrap">{z.text}</span>

              {/* Quellen als Links. Sie sind der Beleg: der Besucher kann
                  nachlesen, statt dem Bot glauben zu müssen. */}
              {z.quellen && z.quellen.length > 0 ? (
                <span className="mt-3 flex flex-col gap-1 border-t border-border pt-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    {t("beraterQuellen")}
                  </span>
                  {z.quellen
                    .filter((q) => q.pfad)
                    .slice(0, 3)
                    .map((q) => (
                      <Link
                        key={q.pfad}
                        href={q.pfad as string}
                        className="text-xs text-accent underline-offset-2 hover:underline"
                      >
                        {q.titel}
                      </Link>
                    ))}
                </span>
              ) : null}
            </li>
          ))}
          {laeuft ? (
            <li className="self-start rounded-2xl rounded-bl-sm bg-card px-4 py-2.5 text-sm text-muted-foreground">
              {t("beraterDenkt")}
            </li>
          ) : null}
        </ul>
        <div ref={endeRef} />
      </div>

      <form onSubmit={onFragen} className="flex items-center gap-2 p-3">
        <Input
          value={entwurf}
          onChange={(e) => setEntwurf(e.target.value)}
          placeholder={t("beraterPlatzhalter")}
          aria-label={t("beraterPlatzhalter")}
          maxLength={1000}
          disabled={laeuft}
        />
        <Button
          type="submit"
          variant="accent"
          size="icon"
          aria-label={t("senden")}
          disabled={!entwurf.trim() || laeuft}
        >
          <Icon icon="ph:paper-plane-tilt-fill" className="size-4" />
        </Button>
      </form>
    </>
  );
}

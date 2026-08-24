"use client";

// Das Kontaktformular.
//
// Referenz-UX: Der zweispaltige Aufbau „Erklärung links, Karte rechts" ist
// derselbe wie in `marketing-trial.tsx` (abgelesen von hostaway.com) — die
// Seite soll nicht plötzlich anders aussehen, nur weil hier ein anderes
// Formular steht.
//
// WAS DIESES FORMULAR ANDERS MACHT ALS DAS AUF DER STARTSEITE: Es schickt
// wirklich etwas ab. Das Trial-Formular setzt bis heute nur einen Zustand
// (`setSubmitted(true)`) und verschickt nichts; hier geht die Nachricht über
// `lib/kontakt.ts` an die FastAPI und von dort über unseren eigenen Mailserver
// in das zuständige Postfach.
//
// DIE THEMENWAHL STEHT ZUERST, weil sie das Postfach bestimmt — und der Hinweis
// darunter sagt dem Besucher, welches. Die Zuordnung selbst passiert
// SERVERSEITIG (`features/contact/themen.py`); dieses Formular kann kein Ziel
// benennen, es gibt kein solches Feld (Wurzel 3).
//
// SPAMSCHUTZ in drei Stufen: unsichtbares Honigtopf-Feld (kostet nichts),
// reCAPTCHA-Enterprise-Token (wird serverseitig bewertet, `lib/captcha.ts`),
// und das IP-Rate-Limit der API. Das Token wird erst BEIM ABSENDEN geholt — es
// ist nur zwei Minuten gültig.
//
// DIE ZWEITE STUFE BRAUCHT EINE EINWILLIGUNG: reCAPTCHA ist der einzige
// Drittanbieter, den diese App im Browser lädt. Ohne erteilte Einwilligung lädt
// `lib/captcha.ts` nichts und das Token bleibt `null` — die API weist das
// fail-closed ab. Statt den Besucher in diesen Fehler laufen zu lassen, steht
// die Erlaubnis sichtbar VOR dem Absenden, zusammen mit dem Weg ohne Formular
// (E-Mail). Ablehnen bleibt damit eine echte Möglichkeit und kostet keinen
// Kontakt.
import { useLocale, useTranslations } from "next-intl";
import Link from "next/link";
import { type FormEvent, useRef, useState } from "react";

import { useEinwilligung } from "@/components/einwilligung/use-einwilligung";
import { SectionHeading } from "@/components/marketing/section-kit";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ANBIETER } from "@/content/legal/anbieter";
import { captchaVorbereiten } from "@/lib/captcha";
import { RECAPTCHA_SITE_KEY } from "@/lib/config";
import { NICHTS_ERLAUBT } from "@/lib/einwilligung";
import {
  KONTAKT_THEMEN,
  KontaktFehler,
  type KontaktThema,
  istTechnisch,
  kontaktSenden,
} from "@/lib/kontakt";

// Dieselben Grenzen wie im Backend-Schema (schemas.py). Sie stehen hier, damit
// der Besucher es merkt, BEVOR er 6000 Zeichen tippt — die Wahrheit ist und
// bleibt der Server.
const NACHRICHT_MAX = 5000;
const NACHRICHT_MIN = 20;

const SCHRITTE = ["eingang", "zuordnung", "antwort"] as const;

// Platzhalterwerte für alle Texte, die die beiden Postfächer nennen. EINE
// Quelle (content/legal/anbieter.ts) — in den Sprachdateien steht {info} und
// {technik}, nie die Adresse selbst.
const POSTFAECHER = {
  info: ANBIETER.email,
  technik: ANBIETER.emailTechnik,
} as const;

export function KontaktFormular() {
  const t = useTranslations("kontakt.formular");
  const tEin = useTranslations("einwilligung.kontakt");
  const locale = useLocale();
  const { entscheidung, geladen, speichern } = useEinwilligung();

  // Fehlt die Einwilligung, ist das Formular nicht absendbar — aber nur, wenn
  // überhaupt ein Schlüssel konfiguriert ist. Lokal (kein Schlüssel) lädt
  // nichts von Google, also ist auch nichts zu erlauben; dann darf hier kein
  // Hinweis stehen, der einen Dienst behauptet, den es nicht gibt.
  // `geladen` verhindert, dass der Hinweis vor dem Lesen des Speichers
  // aufblitzt und gleich wieder verschwindet.
  const spamschutzFehlt =
    RECAPTCHA_SITE_KEY !== "" &&
    geladen &&
    entscheidung?.auswahl.spamschutz !== true;

  // Fehlertext NACH STATUS, nicht der `detail` der API: die Seite läuft in 24
  // Sprachen, die API-Texte sind deutsch. Ein griechischer Besucher las bisher
  // „Kontaktformular ist nicht vollständig konfiguriert" — live gesehen am
  // 19.08.2026 auf der dänischen Fassung. Der Originaltext steht weiter in der
  // Konsole (lib/kontakt.ts), er ist für die Fehlersuche gedacht.
  //
  // 502 und 503 teilen einen Text: für den Besucher ist beides „geht gerade
  // nicht, versuch es später oder schreib direkt" — ob unser Mailserver oder
  // eine fehlende Umgebungsvariable dahintersteckt, ist NICHT sein Problem und
  // wäre eine unnötige Auskunft über unseren Betriebszustand.
  function fehlertext(exc: unknown): string {
    if (!(exc instanceof KontaktFehler)) return t("fehlerAllgemein");
    switch (exc.status) {
      case 403:
        return t("fehlerPruefung");
      case 422:
        return t("fehlerFelder");
      case 429:
        return t("fehlerZuOft");
      case 502:
      case 503:
        return t("fehlerSpaeter", { email: ANBIETER.email });
      default:
        return t("fehlerAllgemein");
    }
  }

  // Wann das Formular zum ERSTEN Mal angefasst wurde. Der Server prüft daraus,
  // ob eine plausible Tippzeit vergangen ist (spamnetz.MIN_SEKUNDEN) — ein
  // Skript füllt in Millisekunden.
  //
  // Ein `useRef` und kein `useState`: Der Wert wird nie gerendert, ein State
  // würde bei jedem Tastendruck ein Neuzeichnen auslösen. Absichtlich beim
  // ersten Fokus gesetzt und nicht beim Seitenaufruf — sonst zählte die Zeit
  // mit, in der jemand nur liest oder den Tab vergisst.
  const startZeit = useRef<number | null>(null);

  const [thema, setThema] = useState<KontaktThema>("allgemein");
  const [laeuft, setLaeuft] = useState(false);
  const [erfolg, setErfolg] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  async function absenden(ev: FormEvent<HTMLFormElement>) {
    ev.preventDefault();
    if (laeuft) return;
    // Rückhalt: der Knopf ist in diesem Fall schon deaktiviert. Ein Absenden
    // per Tastatur oder aus einem Skript soll aber nicht in einen 403 laufen.
    if (spamschutzFehlt) return;
    const formular = ev.currentTarget;
    const felder = new FormData(formular);

    setLaeuft(true);
    setFehler(null);
    try {
      const antwort = await kontaktSenden({
        name: String(felder.get("name") ?? ""),
        email: String(felder.get("email") ?? ""),
        firma: String(felder.get("firma") ?? ""),
        telefon: String(felder.get("telefon") ?? ""),
        thema,
        nachricht: String(felder.get("nachricht") ?? ""),
        locale,
        website: String(felder.get("website") ?? ""),
        // `undefined`, wenn der Fokus-Handler nie lief (Formular per Skript
        // abgeschickt, JavaScript teilweise aus). Der Server behandelt das
        // ausdrücklich NICHT als Verstoß und erfindet keine Dauer.
        dauerSekunden:
          startZeit.current === null
            ? undefined
            : (Date.now() - startZeit.current) / 1000,
      });
      setErfolg(antwort.detail);
      formular.reset();
    } catch (exc) {
      setFehler(fehlertext(exc));
    } finally {
      setLaeuft(false);
    }
  }

  return (
    <section id="formular" className="scroll-mt-24 bg-background">
      <div className="mx-auto max-w-7xl px-6 py-24">
        <SectionHeading
          eyebrow={t("eyebrow")}
          heading={t("heading")}
          sub={t("sub")}
        />

        <div className="mt-14 grid items-start gap-12 lg:grid-cols-[1fr_1.15fr]">
          {/* Links: was nach dem Absenden passiert. Steht hier, weil die
              häufigste Sorge vor einem Kontaktformular ist, dass niemand
              antwortet. */}
          <div className="lg:pt-4">
            <h3 className="font-display text-xl font-semibold">
              {t("ablaufTitel")}
            </h3>
            <ol className="mt-8 flex flex-col gap-6">
              {SCHRITTE.map((schritt, i) => (
                <li key={schritt} className="flex gap-4">
                  <span
                    aria-hidden
                    className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-accent font-display text-base font-semibold text-accent"
                  >
                    {i + 1}
                  </span>
                  <div>
                    <p className="font-semibold">
                      {t(`ablauf.${schritt}.titel`)}
                    </p>
                    <p className="text-muted-foreground">
                      {/* Die Adressen kommen aus ANBIETER, nicht aus dem Text —
                          sonst stünden sie in 24 Sprachdateien und ein
                          Postfachwechsel wäre 24 Änderungen. */}
                      {t(`ablauf.${schritt}.text`, POSTFAECHER)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>

            <p className="mt-8 rounded-2xl bg-surface-warm p-5 text-sm leading-relaxed text-muted-foreground">
              <Icon
                icon="ph:info"
                className="mr-2 inline size-4 align-[-0.2em] text-accent"
              />
              {t("hinweisPostfach", POSTFAECHER)}
            </p>
          </div>

          {/* Rechts: die Karte mit dem Formular. */}
          <div className="rounded-3xl border border-border bg-card p-8 shadow-soft sm:p-10">
            {erfolg ? (
              <div className="flex min-h-80 flex-col items-center justify-center gap-3 text-center">
                <Icon
                  icon="ph:check-circle-fill"
                  className="size-12 text-success"
                />
                <p className="font-display text-xl font-semibold">
                  {t("dankeTitel")}
                </p>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {erfolg}
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="mt-4"
                  onClick={() => setErfolg(null)}
                >
                  {t("nochEine")}
                </Button>
              </div>
            ) : (
              <form
                onSubmit={absenden}
                // Beim ersten Anfassen des Formulars zwei Dinge: das
                // Captcha-Skript holen (damit das Token beim Absenden ohne
                // Wartezeit da ist; vorher wird nichts von Google geladen,
                // siehe lib/captcha.ts) und die Uhr für die Zeitfalle starten.
                // `onFocus` feuert bei jedem Feldwechsel — die Zeit wird
                // deshalb nur beim ERSTEN Mal gesetzt, sonst würde sie sich mit
                // jedem Sprung ins nächste Feld zurückstellen.
                onFocus={() => {
                  startZeit.current ??= Date.now();
                  void captchaVorbereiten();
                }}
                className="flex flex-col gap-5"
              >
                <div className="flex flex-col gap-2">
                  <Label htmlFor="kontakt-thema">{t("thema")}</Label>
                  <Select
                    id="kontakt-thema"
                    name="thema"
                    value={thema}
                    onChange={(e) =>
                      setThema(e.target.value as KontaktThema)
                    }
                    required
                  >
                    {KONTAKT_THEMEN.map((wert) => (
                      <option key={wert} value={wert}>
                        {t(`themen.${wert}`)}
                      </option>
                    ))}
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {istTechnisch(thema)
                      ? t("zielTechnik", { email: ANBIETER.emailTechnik })
                      : t("zielAllgemein", { email: ANBIETER.email })}
                  </p>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="kontakt-name">{t("name")}</Label>
                    <Input
                      id="kontakt-name"
                      name="name"
                      autoComplete="name"
                      maxLength={120}
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="kontakt-email">{t("email")}</Label>
                    <Input
                      id="kontakt-email"
                      name="email"
                      type="email"
                      autoComplete="email"
                      placeholder={t("emailPlatzhalter")}
                      required
                    />
                  </div>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="kontakt-firma">
                      {t("firma")}{" "}
                      <span className="font-normal text-muted-foreground">
                        ({t("optional")})
                      </span>
                    </Label>
                    <Input
                      id="kontakt-firma"
                      name="firma"
                      autoComplete="organization"
                      maxLength={160}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="kontakt-telefon">
                      {t("telefon")}{" "}
                      <span className="font-normal text-muted-foreground">
                        ({t("optional")})
                      </span>
                    </Label>
                    <Input
                      id="kontakt-telefon"
                      name="telefon"
                      type="tel"
                      autoComplete="tel"
                      maxLength={40}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="kontakt-nachricht">{t("nachricht")}</Label>
                  <Textarea
                    id="kontakt-nachricht"
                    name="nachricht"
                    rows={6}
                    minLength={NACHRICHT_MIN}
                    maxLength={NACHRICHT_MAX}
                    placeholder={t("nachrichtPlatzhalter")}
                    required
                  />
                </div>

                {/* Honigtopf. Kein `display:none` — manche Bots überspringen
                    unsichtbare Felder gezielt; abseits der Bildfläche und aus
                    dem Tabulator-Lauf genommen sieht es für sie wie ein
                    normales Feld aus, für Menschen und Screenreader ist es
                    nicht vorhanden. */}
                <div
                  aria-hidden
                  className="pointer-events-none absolute left-[-9999px] h-0 w-0 overflow-hidden"
                >
                  <label htmlFor="kontakt-website">Website</label>
                  <input
                    id="kontakt-website"
                    name="website"
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                  />
                </div>

                {/* Einwilligung für den externen Spamschutz — erst hier,
                    nicht beim Seitenaufruf. Der Knopf erteilt genau DIESE
                    Kategorie und lässt alle anderen unberührt. */}
                {spamschutzFehlt ? (
                  <div className="min-w-0 rounded-2xl bg-surface-warm p-5">
                    <p className="break-words text-sm leading-relaxed text-muted-foreground">
                      <Icon
                        icon="ph:shield-check"
                        className="mr-2 inline size-4 align-[-0.2em] text-accent"
                      />
                      {tEin("hinweis")}
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-4 w-full sm:w-auto"
                      onClick={() =>
                        speichern({
                          ...(entscheidung?.auswahl ?? NICHTS_ERLAUBT),
                          spamschutz: true,
                        })
                      }
                    >
                      {tEin("erlauben")}
                    </Button>
                    <p className="mt-3 break-words text-xs leading-relaxed text-muted-foreground">
                      {tEin("alternative", { email: ANBIETER.email })}
                    </p>
                  </div>
                ) : null}

                <Button
                  type="submit"
                  variant="accent"
                  size="lg"
                  className="mt-2"
                  disabled={laeuft || spamschutzFehlt}
                >
                  {laeuft ? t("laeuft") : t("absenden")}
                </Button>

                {/* `t.rich` statt drei Textschnipsel, die im Code
                    zusammengeklebt werden: „Näheres in der …" ergibt nur auf
                    Deutsch diese Wortstellung. In 24 Sprachen steht der Link
                    an ganz anderer Stelle im Satz — mit Vor-/Nachtext-Feldern
                    wäre die Hälfte davon grammatisch falsch. So übersetzt
                    jede Sprache EINEN vollständigen Satz und setzt <link>
                    selbst dorthin, wo er hingehört. */}
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {t.rich("datenschutzHinweis", {
                    link: (teile) => (
                      <Link
                        href="/datenschutz"
                        className="text-accent underline underline-offset-4"
                      >
                        {teile}
                      </Link>
                    ),
                  })}
                </p>

                {/* Pflicht-Hinweis, weil das reCAPTCHA-Abzeichen auf dieser
                    Seite ausgeblendet ist (es läge sonst unter dem
                    Support-Chat, siehe app/globals.css). Google erlaubt das
                    Ausblenden ausdrücklich — unter der Bedingung, dass diese
                    Nennung sichtbar im Ablauf steht. */}
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {t.rich("recaptchaHinweis", {
                    datenschutz: (teile) => (
                      <a
                        href="https://policies.google.com/privacy"
                        target="_blank"
                        rel="noreferrer noopener"
                        className="underline underline-offset-4"
                      >
                        {teile}
                      </a>
                    ),
                    bedingungen: (teile) => (
                      <a
                        href="https://policies.google.com/terms"
                        target="_blank"
                        rel="noreferrer noopener"
                        className="underline underline-offset-4"
                      >
                        {teile}
                      </a>
                    ),
                  })}
                </p>

                {/* aria-live: die Meldung erscheint ohne Seitenwechsel, ein
                    Screenreader muss sie mitbekommen. */}
                <div aria-live="polite">
                  {fehler ? (
                    <p className="rounded-2xl bg-destructive/10 p-4 text-sm leading-relaxed text-destructive">
                      {fehler}
                    </p>
                  ) : null}
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

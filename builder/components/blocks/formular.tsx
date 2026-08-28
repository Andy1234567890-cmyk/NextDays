"use client";

// Formular-Abschnitt einer Kunden-Website (0436, ausgebaut 0444/0445).
//
// Client-Komponente, weil sie absendet — der einzige Abschnitt, der etwas
// zurückschickt. Alles andere im Renderer ist Server-Component.
//
// DER ABLAUF, wenn das Formular eine Datei annimmt, sind ZWEI Aufrufe:
//
//   1. `POST /site/form` mit den Antworten als JSON. Die Antwort trägt die
//      Kennung der Einsendung und ein kurzlebiges Ticket.
//   2. `POST /site/form/{id}/upload` mit der Datei als multipart, Ticket dabei.
//
// Warum nicht alles in einem: `submission_id` ist in der Datenbank NOT NULL
// (0444) — eine Datei ohne Einsendung wäre eine verwaiste Zeile. Die
// Begründung steht ausführlich in `formular_anlagen.py`.
//
// Und daraus folgt der wichtigste Satz dieser Datei: **wenn Schritt 2
// fehlschlägt, ist die Anfrage trotzdem angekommen.** Der Gast muss das
// erfahren, sonst schickt er alles noch einmal. Er liest deshalb keine
// Fehlermeldung, sondern die Bestätigung PLUS den Hinweis, dass die Datei
// nicht durchkam und er sie per E-Mail nachreichen kann (Wurzel 5: der
// Nebenpfad kippt den Hauptpfad nicht, aber er wird auch nicht verschwiegen).
//
// Was hier bewusst NICHT passiert:
//
//   · Keine eigene Feldprüfung als KONTROLLE. Die Browser-Prüfung (`required`,
//     `type="email"`) ist eine Bequemlichkeit für den Gast; die Kontrolle sitzt
//     am Endpunkt, weil ein POST sie umgeht.
//   · Kein Zurücksetzen des Formulars nach Fehler. Wer fünf Felder gefüllt hat
//     und einen Serverfehler bekommt, soll sie nicht neu tippen.
//   · Keine Erfolgsmeldung, die der Betrieb nicht geschrieben hat. Fehlt sein
//     Text, steht ein neutraler Satz da (Wurzel 4) — kein „Vielen Dank, wir
//     melden uns in Kürze!", das nicht stimmen muss.
import { useRef, useState } from "react";

import { captchaToken, captchaVorbereiten } from "@/lib/captcha";
import { type EditierModus, NICHT_EDITIERBAR, editierbar } from "@/lib/editier-kontext";
import { pickText } from "@/lib/i18n";
import type { SiteBranding } from "@/lib/site-context";
import { texte } from "@/lib/texte";

import { AbschnittLeer } from "./abschnitt-leer";

type Feld = {
  name?: unknown;
  type?: unknown;
  label?: unknown;
  placeholder?: unknown;
  required?: unknown;
  options?: unknown;
  seite?: unknown;
};

/** Feldarten, die der Renderer als einzeiliges Eingabefeld zeigt. Muss mit
 *  `FormFieldType` im Backend deckungsgleich sein — ein unbekannter Typ wird
 *  als einzeiliges Textfeld gerendert und NICHT weggelassen: der Gast soll das
 *  Feld ausfüllen können, auch wenn wir seine Sonderdarstellung nicht kennen. */
const EINZEILIG = new Set(["text", "email", "phone", "number", "date"]);

/** Höchstgröße einer Anlage. DIESELBE Zahl wie `MAX_BYTES` im Backend und wie
 *  das `file_size_limit` des Buckets (0445). Die Prüfung hier ist eine
 *  Freundlichkeit — sie erspart dem Gast, zehn Megabyte hochzuladen, um dann
 *  413 zu lesen. Die KONTROLLE sitzt im Backend, weil ein direkter POST diese
 *  Zeile nicht sieht. */
const MAX_MB = 10;
const MAX_BYTES = MAX_MB * 1024 * 1024;

/** Was der Datei-Dialog anbietet. Deckt sich mit den vier Typen, die
 *  `formular_anlagen.dateityp` an den Anfangsbytes erkennt. Ein `accept`, das
 *  mehr anbietet als das Backend annimmt, wäre eine Einladung zum Fehlschlag. */
const DATEI_ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

/** HTML-Eingabetyp zur Feldart. `phone` → `tel`, damit ein Telefon die
 *  Zifferntastatur zeigt; `number` bleibt `number`. */
function htmlTyp(art: string): string {
  if (art === "email") return "email";
  if (art === "phone") return "tel";
  if (art === "number") return "number";
  if (art === "date") return "date";
  return "text";
}

/** Der Host für den Absende-Endpunkt.
 *
 *  OHNE Port: die Backend-Auflösung vergleicht ihn mit `tenant_custom_domains`,
 *  und dort steht die Domain, nicht `domain:3200`. Der Aufruf lief vorher ganz
 *  ohne diesen Parameter — die Route verlangt ihn (`Query(min_length=3)`), und
 *  jedes Absenden endete mit 422, bevor irgendetwas geprüft wurde. */
function host(): string {
  return typeof window === "undefined" ? "" : window.location.hostname;
}

/** Ein Text mit `{name}`-Platzhaltern, gefüllt.
 *
 *  Winzig, aber es gehört an EINE Stelle: die Texte liegen in 24 Sprachen, und
 *  jede trägt dieselben Platzhalter. Wer sie an drei Stellen einzeln ersetzt,
 *  vergisst einen davon in einer Sprache, und der Gast liest „Schritt {n}". */
function fuellen(text: string, werte: Record<string, string | number>): string {
  return Object.entries(werte).reduce(
    (t, [k, v]) => t.replaceAll(`{${k}}`, String(v)),
    text,
  );
}

/** Eine Kopie ohne EINEN Schlüssel. `delete` auf dem Zustand selbst wäre eine
 *  Mutation, die React nicht sieht. */
function ohne<T>(karte: Record<string, T>, schluessel: string): Record<string, T> {
  const kopie = { ...karte };
  delete kopie[schluessel];
  return kopie;
}

/** Auf welcher Seite ein Feld steht. Fehlt oder ist der Wert Unsinn, ist es
 *  Seite 1 — ein Feld verschwinden zu lassen, weil eine Zahl fehlt, wäre der
 *  schlechtere Ausgang. */
function seiteVon(f: Feld): number {
  const n = typeof f.seite === "number" ? f.seite : 1;
  return Number.isFinite(n) && n >= 1 ? Math.floor(n) : 1;
}

type Stand = "ruht" | "sendet" | "fertig" | "fehler";

export function FormularBlock({
  content,
  modus = NICHT_EDITIERBAR,
  branding,
}: {
  content: Record<string, unknown>;
  modus?: EditierModus;
  /** Für den Datenschutz-Link am Zustimmungsfeld. */
  branding?: SiteBranding | null;
}) {
  const t = texte(modus.locale);
  const headline = pickText(content.headline, modus.locale);
  const intro = pickText(content.intro, modus.locale);
  const felder = (Array.isArray(content.fields) ? content.fields : []) as Feld[];
  const seitenTitel = (
    Array.isArray(content.seiten) ? content.seiten : []
  ) as Array<{ titel?: unknown }>;
  // Eine Seite ist der Normalfall: eine leere Seitenliste heißt „einseitig",
  // nicht „keine Seite" (dieselbe Lesart wie im Backend-Schema).
  const seitenAnzahl = Math.max(1, seitenTitel.length);

  const [stand, setStand] = useState<Stand>("ruht");
  const [meldung, setMeldung] = useState<string | null>(null);
  // Ob die Anfrage ankam, die DATEI aber nicht. Eigener Zustand und kein
  // Fehler: die Anfrage IST gespeichert, und ein rotes „Fehlgeschlagen" würde
  // den Gast dazu bringen, alles noch einmal zu schicken.
  const [anlageFehler, setAnlageFehler] = useState(false);
  // Ob eine Bestätigung per E-Mail an den Absender rausging (0444). Der
  // Server sagt es in seiner Antwort — nicht raten, ob ein E-Mail-Feld
  // existiert oder der Versand geklappt hat.
  const [bestaetigungGesendet, setBestaetigungGesendet] = useState(false);
  const [seite, setSeite] = useState(1);
  // Die Antworten aller Seiten. Nötig, weil immer nur die AKTIVE Seite im DOM
  // steht: ein `hidden` Pflichtfeld bricht die Browser-Prüfung („not
  // focusable"), ein `disabled` Feld fällt aus den FormData. Beim Blättern
  // wandert deshalb der Stand der Seite hierher und beim Zurückgehen als
  // `defaultValue` wieder in die Felder.
  const [werte, setWerte] = useState<Record<string, string>>({});
  const [dateien, setDateien] = useState<Record<string, File>>({});
  const [dateiFehler, setDateiFehler] = useState<Record<string, string>>({});
  const formRef = useRef<HTMLFormElement>(null);

  if (felder.length === 0) {
    return (
      <AbschnittLeer
        modus={modus}
        titel={headline || undefined}
        grund={t.leerFormular}
      />
    );
  }

  // Im ENTWURF wird nicht abgesendet: der Betrieb würde beim Ausprobieren
  // Einsendungen in seiner eigenen Antwortenliste erzeugen.
  const nurAnsicht = modus.aktiv;
  // Der Zurück-Knopf erscheint ab DREI Seiten — dieselbe Regel wie bei
  // Hostaway (`ZURUECK_AB_SEITEN` im Backend). Bei zwei Seiten ist der Weg
  // zurück kurz genug, dass ein zusätzlicher Knopf mehr stört als hilft.
  const zeigeZurueck = seitenAnzahl >= 3 && seite > 1;
  const letzteSeite = seite >= seitenAnzahl;

  if (stand === "fertig") {
    const eigener = pickText(content.success_text, modus.locale);
    return (
      <section className="mx-auto max-w-2xl px-6 py-16 text-center">
        <p className="text-lg font-semibold">{eigener || t.formularDanke}</p>
        {anlageFehler ? (
          <p role="alert" className="pt-3 text-sm text-destructive">
            {t.formularAnlageFehler}
          </p>
        ) : bestaetigungGesendet ? (
          // Nur eine ZUSÄTZLICHE Zeile, keine zweite Überschrift: die
          // Danke-Meldung des Betriebs bleibt der Haupttext.
          <p className="pt-3 text-sm text-muted-foreground">
            {t.formularBestaetigungGesendet}
          </p>
        ) : null}
      </section>
    );
  }

  /** Die Antworten der gerade sichtbaren Seite einsammeln. */
  function aktuelleWerte(form: HTMLFormElement): Record<string, string> {
    const daten = new FormData(form);
    const raus: Record<string, string> = {};
    for (const [k, v] of daten.entries()) {
      if (typeof v === "string") raus[k] = v;
    }
    return raus;
  }

  /** Die Datei nachreichen. Gibt zurück, OB es geklappt hat — der Aufrufer
   *  entscheidet, was der Gast liest. Wirft nie: die Anfrage ist an dieser
   *  Stelle gespeichert. */
  async function anlageSenden(
    id: string,
    ticket: string,
  ): Promise<boolean> {
    const eintraege = Object.entries(dateien);
    if (eintraege.length === 0) return true;
    for (const [feld, datei] of eintraege) {
      const koerper = new FormData();
      koerper.append("file", datei);
      koerper.append("ticket", ticket);
      koerper.append("feld", feld);
      try {
        const res = await fetch(
          `/api/v1/site/form/${encodeURIComponent(id)}/upload`,
          { method: "POST", body: koerper },
        );
        if (!res.ok) return false;
      } catch {
        return false;
      }
    }
    return true;
  }

  /** Rückfalltext bei einem Fehlschlag OHNE eigene Meldung des Servers
   *  (Netzfehler, 500). Eine konkrete Server-Meldung hat immer Vorrang — sie
   *  erklärt dem Gast, was zu tun ist. Fehlt der eigene Text des Betriebs,
   *  steht der neutrale Satz des Renderers da (Wurzel 4). */
  function eigenerFehlertext(): string {
    return pickText(content.error_text, modus.locale) || t.formularFehler;
  }

  async function absenden(alleWerte: Record<string, string>) {
    setStand("sendet");
    setMeldung(null);
    setAnlageFehler(false);
    setBestaetigungGesendet(false);
    try {
      // Das Token wird HIER geholt und nicht beim Seitenaufruf: es gilt zwei
      // Minuten und nur einmal. Fehlt der Schlüssel (lokal), kommt `null` —
      // die API entscheidet dann über ihre Sandbox, nicht der Browser.
      let token: string | null = null;
      try {
        token = await captchaToken();
      } catch {
        // Skript blockiert oder Netzfehler. `null` weitergeben und die API
        // antworten lassen: sie sagt fail-closed, ob ohne Token gesendet
        // werden darf. Hier zu entscheiden wäre die falsche Stelle.
        token = null;
      }
      const res = await fetch(
        `/api/v1/site/form?host=${encodeURIComponent(host())}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            block_id: content.__block_id ?? "",
            daten: alleWerte,
            recaptcha_token: token,
          }),
        },
      );
      if (!res.ok) {
        // Die Meldung des Servers zeigen, wenn es eine gibt: „Bitte stimmen
        // Sie der Datenverarbeitung zu" ist für den Gast brauchbar,
        // „Fehler 422" nicht.
        const körper = (await res.json().catch(() => null)) as {
          detail?: string;
        } | null;
        setMeldung(körper?.detail ?? eigenerFehlertext());
        setStand("fehler");
        return;
      }
      const antwort = (await res.json().catch(() => null)) as {
        weiterleitung?: string | null;
        bestaetigung_gesendet?: boolean | null;
        submission_id?: string | null;
        upload_ticket?: string | null;
      } | null;

      // Ab hier ist die Anfrage GESPEICHERT. Nichts, was jetzt noch
      // fehlschlägt, darf als „nicht angekommen" erscheinen.
      let anlagenOk = true;
      if (antwort?.submission_id && antwort?.upload_ticket) {
        anlagenOk = await anlageSenden(
          antwort.submission_id,
          antwort.upload_ticket,
        );
      }

      // Weiterleitung (0444). Sie steht in der ANTWORT und ist kein HTTP-302:
      // der Aufruf kommt aus JavaScript, ein 302 darauf lüde das Ziel per
      // fetch nach, statt den Browser dorthin zu schicken.
      //
      // Aber NICHT, wenn die Datei nicht durchkam: die Zielseite weiß davon
      // nichts, und der Gast führe weg, ohne je zu erfahren, dass sein
      // Grundriss fehlt.
      const ziel = (antwort?.weiterleitung ?? "").trim();
      if (ziel && anlagenOk) {
        window.location.assign(ziel);
        return;
      }
      setAnlageFehler(!anlagenOk);
      // Nur eine POSITIVE Aussage: `true` heißt „es ging wirklich raus". `false`
      // heißt nicht zwingend „es ist fehlgeschlagen" — es kann auch heißen,
      // dass keine Bestätigung eingeschaltet ist oder das Formular kein
      // E-Mail-Feld hat. Beides ist der Normalfall, kein Fehler, und darüber
      // schweigt der Renderer (kein erfundener Alarm, Wurzel 4).
      setBestaetigungGesendet(antwort?.bestaetigung_gesendet === true);
      setStand("fertig");
    } catch {
      // Netzfehler: die Eingaben bleiben stehen, damit niemand neu tippen muss.
      setMeldung(eigenerFehlertext());
      setStand("fehler");
    }
  }

  return (
    <section className="mx-auto max-w-2xl px-6 py-16">
      {headline ? (
        <h2
          {...editierbar(modus, "headline")}
          className="font-display text-3xl font-extrabold tracking-tight"
        >
          {headline}
        </h2>
      ) : null}
      {intro ? (
        <p
          {...editierbar(modus, "intro")}
          className="pt-3 text-muted-foreground"
        >
          {intro}
        </p>
      ) : null}

      {seitenAnzahl > 1 ? (
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 pt-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {fuellen(t.formularSchritt, { n: seite, m: seitenAnzahl })}
          </p>
          {/* Der Titel der Seite, wenn der Betrieb einen gepflegt hat. Fehlt
              er, steht nur der Fortschritt da — kein erfundener Zwischentitel
              (Wurzel 4). */}
          <p className="text-base font-semibold">
            {pickText(seitenTitel[seite - 1]?.titel, modus.locale)}
          </p>
        </div>
      ) : null}

      <form
        ref={formRef}
        className="flex flex-col gap-4 pt-8"
        // Das Skript wird beim ersten Anfassen geladen, nicht beim
        // Seitenaufruf: wer nur liest, löst keinen Request an google.com aus.
        onFocus={() => {
          captchaVorbereiten();
        }}
        onSubmit={(e) => {
          e.preventDefault();
          if (nurAnsicht) return;
          const form = e.currentTarget;
          const gesammelt = { ...werte, ...aktuelleWerte(form) };
          setWerte(gesammelt);
          if (!letzteSeite) {
            // Der „Weiter"-Knopf ist ein `submit` und kein `button`, und das
            // ist der ganze Trick: nur so prüft der Browser die Pflichtfelder
            // DIESER Seite, bevor es weitergeht. Ein eigener onClick-Handler
            // müsste die Prüfung nachbauen und liefe ihr hinterher.
            setSeite((s) => Math.min(s + 1, seitenAnzahl));
            return;
          }
          void absenden(gesammelt);
        }}
      >
        {felder.map((f, i) => {
          if (seiteVon(f) !== seite) return null;
          const name = typeof f.name === "string" ? f.name : `feld_${i}`;
          const art = typeof f.type === "string" ? f.type : "text";
          const label = pickText(f.label, modus.locale) || name;
          const platzhalter = pickText(f.placeholder, modus.locale);
          const pflicht = f.required === true;
          const vorbelegt = werte[name] ?? "";

          if (art === "file") {
            const gewaehlt = dateien[name];
            const fehler = dateiFehler[name];
            return (
              <label key={name} className="flex flex-col gap-1 text-sm">
                <span className="font-medium">{label}</span>
                <input
                  type="file"
                  name={name}
                  accept={DATEI_ACCEPT}
                  // Nur Pflicht, solange noch keine Datei gewählt ist: das Feld
                  // wird beim Blättern neu gerendert und verliert seine
                  // Auswahl im DOM — die Datei selbst liegt aber im Zustand.
                  // Ohne diese Unterscheidung könnte man eine dreiseitige
                  // Anfrage nicht mehr abschicken, nachdem man einmal
                  // zurückgeblättert hat.
                  required={pflicht && !gewaehlt}
                  onChange={(e) => {
                    const datei = e.target.files?.[0];
                    if (!datei) {
                      setDateien((v) => ohne(v, name));
                      setDateiFehler((v) => ohne(v, name));
                      return;
                    }
                    if (datei.size > MAX_BYTES) {
                      // Im Browser abfangen, damit niemand zehn Megabyte
                      // hochlädt, um dann 413 zu lesen. Die Auswahl wird
                      // verworfen — sonst stünde ein Dateiname da, der nie
                      // mitgeht.
                      e.target.value = "";
                      setDateien((v) => ohne(v, name));
                      setDateiFehler((v) => ({
                        ...v,
                        [name]: fuellen(t.formularDateiZuGross, { mb: MAX_MB }),
                      }));
                      return;
                    }
                    setDateiFehler((v) => ohne(v, name));
                    setDateien((v) => ({ ...v, [name]: datei }));
                  }}
                  className="rounded-(--radius) border border-border bg-transparent px-3 py-2 text-sm file:mr-3 file:rounded-(--radius) file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-semibold"
                />
                {fehler ? (
                  <span role="alert" className="text-xs text-destructive">
                    {fehler}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    {gewaehlt
                      ? gewaehlt.name
                      : fuellen(t.formularDateiHinweis, { mb: MAX_MB })}
                  </span>
                )}
              </label>
            );
          }

          if (art === "consent") {
            const ziel = branding?.privacy_policy_slug;
            return (
              <label key={name} className="flex items-start gap-2 text-sm">
                {/* Der Wert „ja" und nicht „on": der Betrieb liest die Antwort
                    in seiner Liste, nicht ein Programm. */}
                <input
                  type="checkbox"
                  name={name}
                  value="ja"
                  required
                  defaultChecked={vorbelegt === "ja"}
                  className="mt-1 size-4"
                />
                <span>
                  {label}
                  {ziel ? (
                    <>
                      {" "}
                      <a
                        href={`/${ziel}`}
                        className="underline"
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {t.datenschutzMehr}
                      </a>
                    </>
                  ) : null}
                </span>
              </label>
            );
          }

          if (art === "checkbox") {
            return (
              <label key={name} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  name={name}
                  value="ja"
                  required={pflicht}
                  defaultChecked={vorbelegt === "ja"}
                  className="mt-1 size-4"
                />
                <span>{label}</span>
              </label>
            );
          }

          if (art === "select") {
            const optionen = (
              Array.isArray(f.options) ? f.options : []
            ) as Array<Record<string, string>>;
            return (
              <label key={name} className="flex flex-col gap-1 text-sm">
                <span className="font-medium">{label}</span>
                <select
                  name={name}
                  required={pflicht}
                  defaultValue={vorbelegt}
                  className="rounded-(--radius) border border-border bg-transparent px-3 py-2"
                >
                  {/* Die leere erste Option: ohne sie ist die erste Wahl
                      vorausgewählt, und der Gast schickt sie ab, ohne sie
                      getroffen zu haben. */}
                  <option value="" disabled={pflicht}>
                    {platzhalter || "—"}
                  </option>
                  {optionen.map((o, j) => {
                    const text = pickText(o, modus.locale);
                    return text ? (
                      <option key={`${text}-${j}`} value={text}>
                        {text}
                      </option>
                    ) : null;
                  })}
                </select>
              </label>
            );
          }

          if (art === "textarea") {
            return (
              <label key={name} className="flex flex-col gap-1 text-sm">
                <span className="font-medium">{label}</span>
                <textarea
                  name={name}
                  rows={5}
                  required={pflicht}
                  placeholder={platzhalter || undefined}
                  defaultValue={vorbelegt}
                  maxLength={5000}
                  className="rounded-(--radius) border border-border bg-transparent px-3 py-2"
                />
              </label>
            );
          }

          return (
            <label key={name} className="flex flex-col gap-1 text-sm">
              <span className="font-medium">{label}</span>
              <input
                type={htmlTyp(EINZEILIG.has(art) ? art : "text")}
                name={name}
                required={pflicht}
                placeholder={platzhalter || undefined}
                defaultValue={vorbelegt}
                maxLength={5000}
                className="rounded-(--radius) border border-border bg-transparent px-3 py-2"
              />
            </label>
          );
        })}

        {meldung ? (
          <p role="alert" className="text-sm font-medium text-destructive">
            {meldung}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          {zeigeZurueck ? (
            <button
              type="button"
              onClick={() => {
                // Beim Zurückgehen wird der Stand der Seite mitgenommen —
                // sonst wäre alles weg, was auf ihr getippt wurde.
                const form = formRef.current;
                if (form) {
                  setWerte((v) => ({ ...v, ...aktuelleWerte(form) }));
                }
                setSeite((s) => Math.max(1, s - 1));
              }}
              className="rounded-full border border-border px-5 py-3 text-sm font-semibold transition hover:bg-secondary"
            >
              {t.formularZurueck}
            </button>
          ) : null}
          <button
            type="submit"
            disabled={stand === "sendet" || nurAnsicht}
            className="btn-marke btn-marke-primaer bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-50"
          >
            {letzteSeite
              ? pickText(content.submit_label, modus.locale) || t.formularSenden
              : t.formularWeiter}
          </button>
        </div>
      </form>
    </section>
  );
}

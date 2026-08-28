"use client";

// Die Bausteine der Buchungsstrecke (0474) — Buchung und Bestätigung.
//
// WAS SICH GEGENÜBER VORHER ÄNDERT
// Die Buchungsseite des Renderers war eine Attrappe: drei Kästen, von denen
// zwei leer und grau waren, ein „Weiter"-Knopf ohne Wirkung, kein Feld für den
// Namen des Gastes, keine Zahlung. Wer dort ankam, konnte nicht buchen — und
// die Seite sah aus, als könnte er es.
//
// Der Ablauf hier ist DERSELBE, den der Marktplatz fährt
// (`plattform/components/checkout-ablauf.tsx`, Airbnb-Zuschnitt vom
// 11.08.2026): Zahlungszeitpunkt (nur bei echter Ratenzahlung) → Kontaktdaten →
// prüfen und bezahlen. Keine zweite Erfindung: derselbe öffentliche
// booking_engine-Slice, dieselbe Reihenfolge, dasselbe Stripe-Element.
//
// WARUM ER TROTZDEM EINE EIGENE DATEI IST UND KEINE GETEILTE KOMPONENTE
// Der Marktplatz-Checkout ist eine SEITE mit festem Aufbau. Hier ist es ein
// BAUSTEIN, dessen Anordnung der Betrieb bestimmt: Zusammenfassung seitlich,
// oben oder unten, drei Stufen oder eine, eigener Vertrauens-Hinweis. Eine
// gemeinsame Komponente müsste all das als Parameter tragen und wäre in beiden
// Welten schwerer zu lesen als zwei Fassungen. Die geteilte Schicht ist die,
// die zählt: `lib/buchung.ts` ist eine byte-identische Kopie (Schwesterdatei),
// und der Zahlungsschritt `StripeCheckout` liegt in beiden Apps.
//
// WAS DER BETRIEB NICHT EINSTELLEN KANN
// Welche Zahlungsarten erscheinen (das entscheidet sein Stripe-Konto), welcher
// Betrag fällig ist (das rechnet der Server) und was das Ergebnis war (das sagt
// Stripe). Ein Feld dafür wäre eine zweite Wahrheit über Geld.
import { Icon } from "@iconify/react";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

import { StripeCheckout } from "@/components/stripe-checkout";
import { type EditierModus, NICHT_EDITIERBAR } from "@/lib/editier-kontext";
import { pickText } from "@/lib/i18n";
import { formatCurrency, type Listing } from "@/lib/listings";
import { texte } from "@/lib/texte";
import { type Angebot, bucheGast, ladeAngebot } from "@/lib/buchung";

import { AbschnittLeer } from "./abschnitt-leer";

/** Was die Checkout-Bausteine gemeinsam brauchen. */
type CheckoutProps = {
  content: Record<string, unknown>;
  modus?: EditierModus;
  /** Das Objekt, das gebucht wird. `null`, solange keines gewählt ist. */
  objekt?: Listing | null;
};

function fahne(v: unknown, standard: boolean): boolean {
  return typeof v === "boolean" ? v : standard;
}

/** Die Buchungsdaten aus der Adresse.
 *
 *  Sie stehen dort und nicht in einem Zustand, weil der Gast über einen Link
 *  aus dem Buchungs-Block ankommt (`?von=…&bis=…&gaeste=…`). Ein Zustand wäre
 *  nach einem Neuladen leer, und der Gast müsste seine Daten zweimal eingeben.
 *
 *  Fehlt etwas, wird NICHTS geraten: ohne Zeitraum gibt es keinen Preis, und
 *  ein erfundener Zeitraum würde einen Preis anzeigen, der für eine andere
 *  Reise gilt (Wurzel 4). */
function useBuchungsdaten() {
  const params = useSearchParams();
  const von = params.get("von");
  const bis = params.get("bis");
  return {
    von,
    bis,
    gaeste: Number(params.get("gaeste") || "1") || 1,
    tiere: Number(params.get("tiere") || "0") || 0,
    promo: params.get("code") || undefined,
    vollstaendig: Boolean(von && bis),
  };
}

// ---------------------------------------------------------------------------
// Der Buchungsabschluss — der Pflicht-Baustein
// ---------------------------------------------------------------------------

type Zustand =
  | { kind: "eingabe" }
  | { kind: "bucht" }
  | { kind: "fehler"; msg: string }
  | {
      kind: "bezahlen";
      reservationId: string;
      // Seit 0409 liefert der Buchungsaufruf die Zahlungsdaten gleich mit —
      // eine Reservierung, gegen die man den Intent nachladen könnte, gibt es
      // an dieser Stelle noch gar nicht.
      clientSecret?: string | null;
      publishableKey?: string | null;
    }
  | { kind: "fertig"; email: string };

/** Der Buchungsabschluss.
 *
 *  Die Reservierung entsteht ERST beim Bezahlen (`bucheGast` in Schritt 3) und
 *  wird unmittelbar danach bezahlt. Vorher wird nichts angelegt: ein Gast, der
 *  den Checkout verlässt, hinterlässt keine halbe Buchung im Kalender.
 */
export function CheckoutFormBlock({
  content,
  modus = NICHT_EDITIERBAR,
  objekt = null,
}: CheckoutProps) {
  const t = texte(modus.locale);
  const daten = useBuchungsdaten();
  const [angebot, setAngebot] = useState<Angebot | null>(null);
  const [angebotFehler, setAngebotFehler] = useState<string | null>(null);
  const [schritt, setSchritt] = useState(1);
  const [vorname, setVorname] = useState("");
  const [nachname, setNachname] = useState("");
  const [email, setEmail] = useState("");
  const [telefon, setTelefon] = useState("");
  const [zustand, setZustand] = useState<Zustand>({ kind: "eingabe" });

  const objektId = objekt?.id ?? null;
  const einstufig = content.steps === "one";

  // Das Angebot kommt vom Server, sobald Objekt und Zeitraum feststehen. Nicht
  // selbst rechnen: Nächte × Grundpreis verschweigt Reinigung, Haustiergebühr
  // und Kurtaxe, die der Server anschließend berechnet.
  useEffect(() => {
    if (!objektId || !daten.von || !daten.bis) return;
    let abgebrochen = false;
    void (async () => {
      const res = await ladeAngebot({
        property_id: objektId,
        check_in: daten.von!,
        check_out: daten.bis!,
        guests: daten.gaeste,
        pets: daten.tiere,
        promo_code: daten.promo,
        locale: modus.locale,
      });
      if (abgebrochen) return;
      if (res.ok) setAngebot(res.data);
      // Der Fehler wird GEZEIGT und nicht verschluckt: ohne Angebot gibt es
      // keinen Preis, und ein Checkout ohne Preis darf nicht aussehen, als
      // lade er noch (Wurzel 5).
      else setAngebotFehler(res.error);
    })();
    return () => {
      abgebrochen = true;
    };
  }, [
    objektId,
    daten.von,
    daten.bis,
    daten.gaeste,
    daten.tiere,
    daten.promo,
    modus.locale,
  ]);

  // Im Editor gibt es weder Objekt noch Zeitraum. Der Baustein zeigt dort, was
  // er ist, statt einen leeren Rahmen: derselbe Weg wie bei den
  // Objekt-Bausteinen.
  if (modus.aktiv && (!objektId || !daten.vollstaendig)) {
    return (
      <AbschnittLeer
        modus={modus}
        titel={pickText(content.headline, modus.locale) || undefined}
        grund={t.checkoutVorschauHinweis}
      />
    );
  }
  if (!objektId || !daten.vollstaendig) {
    return (
      <div className="mx-auto w-full max-w-2xl px-6 py-12 text-center">
        <p className="text-muted-foreground">{t.checkoutDatenFehlen}</p>
      </div>
    );
  }

  const plan = angebot?.payment_plan ?? null;
  const rate = plan != null && plan.due_later > 0;
  const waehrung = angebot?.currency ?? objekt?.currency ?? "";
  // Schritt 1 entfällt, wenn es nichts zu entscheiden gibt: ohne Ratenzahlung
  // ist der ganze Betrag jetzt fällig. Ein Schritt mit genau einer Option ist
  // eine Klick-Attrappe.
  const ersterSchritt = rate && !einstufig ? 1 : 2;
  const aktiv = einstufig ? 2 : Math.max(schritt, ersterSchritt);
  const stufenZeigen = fahne(content.show_step_labels, true) && !einstufig;

  async function buchenUndBezahlen() {
    if (!angebot) return;
    if (!vorname.trim() || !nachname.trim() || !email.trim()) {
      setZustand({ kind: "fehler", msg: t.checkoutKontaktFehlt });
      return;
    }
    setZustand({ kind: "bucht" });
    const res = await bucheGast({
      property_id: objektId!,
      check_in: daten.von!,
      check_out: daten.bis!,
      contact: {
        first_name: vorname.trim(),
        last_name: nachname.trim(),
        email: email.trim(),
        phone: telefon.trim() || undefined,
      },
      // Der Server rechnet erneut; dieser Betrag ist die Zustimmung des Gastes
      // zu dem, was ihm angezeigt wurde.
      total_amount: angebot.total,
      guests: daten.gaeste,
      pets: daten.tiere,
      promo_code: daten.promo,
      locale: modus.locale,
    });
    if (!res.ok) {
      setZustand({ kind: "fehler", msg: res.error });
      return;
    }
    // `res.data.id` ist seit 0409 die BuchungsABSICHT, nicht die Reservierung:
    // Die Buchung entsteht erst, wenn Stripe die Zahlung bestätigt hat. Bis
    // dahin ist nichts reserviert — deshalb hier auch kein „gebucht"-Zustand.
    setZustand({
      kind: "bezahlen",
      reservationId: res.data.id,
      clientSecret: res.data.client_secret,
      publishableKey: res.data.publishable_key,
    });
  }

  if (zustand.kind === "fertig") {
    return (
      <div className="flex flex-col items-start gap-3 rounded-2xl border border-emerald-300 bg-emerald-50 p-4 dark:border-emerald-800 dark:bg-emerald-950/40 sm:p-6">
        <Icon icon="ph:check-circle" className="size-8 text-emerald-700" />
        <h2 className="font-display text-xl font-semibold">
          {t.checkoutFertigTitel}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t.checkoutFertigText.replace("{email}", zustand.email)}
        </p>
      </div>
    );
  }

  const ueberschrift =
    pickText(content.headline, modus.locale) || t.checkoutTitel;
  const einleitung = pickText(content.intro, modus.locale);
  const hinweis = pickText(content.trust_note, modus.locale);
  const knopf =
    pickText(content.submit_label, modus.locale) || t.checkoutBezahlen;

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-8">
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        {ueberschrift}
      </h1>
      {einleitung ? (
        <p className="pt-2 text-muted-foreground">{einleitung}</p>
      ) : null}
      {angebotFehler ? (
        <p className="mt-4 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {angebotFehler}
        </p>
      ) : null}

      <div className="flex flex-col gap-6 pt-6">
        {/* Schritt 1 — Zahlungszeitpunkt, nur bei echter Ratenzahlung */}
        {rate && plan && !einstufig && (
          <Abschnitt
            nummer={1}
            titel={t.checkoutSchrittZahlung}
            aktiv={aktiv === 1}
            erledigt={aktiv > 1}
            nummerZeigen={stufenZeigen}
          >
            <div className="flex items-start justify-between gap-4 border-b border-border py-4">
              <span>
                <span className="block">
                  {t.checkoutJetztBetrag.replace(
                    "{betrag}",
                    formatCurrency(plan.due_now, waehrung),
                  )}
                </span>
                <span className="mt-1 block text-sm text-muted-foreground">
                  {plan.balance_due_date
                    ? t.checkoutRestBis
                        .replace(
                          "{betrag}",
                          formatCurrency(plan.due_later, waehrung),
                        )
                        .replace("{datum}", plan.balance_due_date)
                    : t.checkoutRestSpaeter.replace(
                        "{betrag}",
                        formatCurrency(plan.due_later, waehrung),
                      )}
                </span>
              </span>
              <Punkt aktiv />
            </div>
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setSchritt(2)}
                className="btn-marke btn-marke-primaer bg-primary px-7 py-3 font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                {t.formularWeiter}
              </button>
            </div>
          </Abschnitt>
        )}

        {/* Schritt 2 — Kontaktdaten */}
        <Abschnitt
          nummer={2}
          titel={t.checkoutSchrittKontakt}
          aktiv={aktiv === 2 || einstufig}
          erledigt={!einstufig && aktiv > 2}
          nummerZeigen={stufenZeigen}
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Feld
              label={t.vorname}
              wert={vorname}
              onChange={setVorname}
              autoComplete="given-name"
            />
            <Feld
              label={t.nachname}
              wert={nachname}
              onChange={setNachname}
              autoComplete="family-name"
            />
            <Feld
              label={t.email}
              wert={email}
              onChange={setEmail}
              typ="email"
              autoComplete="email"
            />
            <Feld
              label={t.checkoutTelefon}
              wert={telefon}
              onChange={setTelefon}
              typ="tel"
              autoComplete="tel"
            />
          </div>
          {!einstufig && (
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setSchritt(3)}
                disabled={!vorname.trim() || !nachname.trim() || !email.trim()}
                className="btn-marke btn-marke-primaer bg-primary px-7 py-3 font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {t.formularWeiter}
              </button>
            </div>
          )}
        </Abschnitt>

        {/* Schritt 3 — Prüfen und bezahlen. Einstufig: dieselbe Fläche, nur
            ohne eigenen Kasten und ohne Nummer. */}
        <Abschnitt
          nummer={3}
          titel={t.checkoutSchrittPruefen}
          aktiv={aktiv === 3 || einstufig}
          nummerZeigen={stufenZeigen}
        >
          {zustand.kind === "bezahlen" ? (
            <StripeCheckout
              reservationId={zustand.reservationId}
              clientSecret={zustand.clientSecret}
              publishableKey={zustand.publishableKey}
              sprache={modus.locale}
              onPaid={() => setZustand({ kind: "fertig", email })}
            />
          ) : (
            <>
              <div className="flex flex-col gap-2 text-sm">
                <Zeile
                  label={t.checkoutName}
                  wert={`${vorname} ${nachname}`.trim()}
                />
                <Zeile label={t.email} wert={email} />
                {angebot ? (
                  <Zeile
                    label={t.checkoutJetztFaellig}
                    wert={formatCurrency(
                      plan ? plan.due_now : angebot.total,
                      waehrung,
                    )}
                  />
                ) : null}
              </div>
              {hinweis ? (
                <p className="mt-3 text-xs text-muted-foreground">{hinweis}</p>
              ) : null}
              {zustand.kind === "fehler" && (
                <p className="mt-3 rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {zustand.msg}
                </p>
              )}
              <button
                type="button"
                onClick={buchenUndBezahlen}
                disabled={zustand.kind === "bucht" || !angebot}
                className="btn-marke btn-marke-primaer mt-4 flex min-h-12 w-full items-center justify-center gap-2 bg-primary px-5 font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {zustand.kind === "bucht" ? (
                  <Icon icon="ph:spinner" className="size-5 animate-spin" />
                ) : (
                  <Icon icon="ph:lock-simple" className="size-5" />
                )}
                {knopf}
              </button>
            </>
          )}
        </Abschnitt>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Die Zusammenfassung
// ---------------------------------------------------------------------------

/** Was gebucht wird — Objekt, Zeitraum, Preisaufstellung.
 *
 *  Die Posten kommen aus dem Angebot des Servers, nicht aus einer eigenen
 *  Rechnung: bei Prozent- oder Gast-Basis käme der Browser auf eine andere
 *  Zahl als der Server, und der Gast sähe im Checkout einen anderen Preis, als
 *  ihm berechnet wird.
 */
export function CheckoutSummaryBlock({
  content,
  modus = NICHT_EDITIERBAR,
  objekt = null,
}: CheckoutProps) {
  const t = texte(modus.locale);
  const daten = useBuchungsdaten();
  const [angebot, setAngebot] = useState<Angebot | null>(null);
  const objektId = objekt?.id ?? null;

  useEffect(() => {
    if (!objektId || !daten.von || !daten.bis) return;
    let abgebrochen = false;
    void (async () => {
      const res = await ladeAngebot({
        property_id: objektId,
        check_in: daten.von!,
        check_out: daten.bis!,
        guests: daten.gaeste,
        pets: daten.tiere,
        promo_code: daten.promo,
        locale: modus.locale,
      });
      if (!abgebrochen && res.ok) setAngebot(res.data);
    })();
    return () => {
      abgebrochen = true;
    };
  }, [
    objektId,
    daten.von,
    daten.bis,
    daten.gaeste,
    daten.tiere,
    daten.promo,
    modus.locale,
  ]);

  if (!objektId || !daten.vollstaendig) {
    return (
      <AbschnittLeer
        modus={modus}
        titel={pickText(content.headline, modus.locale) || undefined}
        grund={t.checkoutVorschauHinweis}
      />
    );
  }

  const ueberschrift =
    pickText(content.headline, modus.locale) || t.checkoutUebersicht;
  const foto = fahne(content.show_photo, true) ? objekt?.fotos?.[0] : null;
  const aufstellung = fahne(content.show_breakdown, true);
  const storno = fahne(content.show_cancellation, true);
  const waehrung = angebot?.currency ?? objekt?.currency ?? "";

  return (
    <aside className="rounded-2xl border border-border p-4 shadow-sm sm:p-6">
      <h2 className="font-display text-lg font-semibold">{ueberschrift}</h2>
      {foto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={foto}
          alt={objekt?.titel ?? ""}
          className="mt-4 aspect-[4/3] w-full rounded-xl object-cover"
        />
      ) : null}
      {objekt ? (
        <p className="mt-3 font-medium">{objekt.titel}</p>
      ) : null}
      <div className="mt-3 flex flex-col gap-1 text-sm text-muted-foreground">
        <span>
          {t.checkIn}: {daten.von}
        </span>
        <span>
          {t.checkOut}: {daten.bis}
        </span>
        <span>
          {t.sucheGaeste}: {daten.gaeste}
        </span>
      </div>

      {angebot && aufstellung ? (
        <div className="mt-4 flex flex-col gap-2 border-t border-border pt-4 text-sm">
          {angebot.lines.map((zeile, i) => (
            <Zeile
              key={`${zeile.label}-${i}`}
              label={zeile.label}
              wert={formatCurrency(zeile.amount, waehrung)}
            />
          ))}
        </div>
      ) : null}
      {angebot ? (
        <div className="mt-3 border-t border-border pt-3">
          <Zeile
            label={t.checkoutGesamt}
            wert={formatCurrency(angebot.total, waehrung)}
          />
        </div>
      ) : null}
      {angebot?.cancellation && storno ? (
        <p className="mt-3 text-xs text-muted-foreground">
          {t.checkoutStorno}
        </p>
      ) : null}
    </aside>
  );
}

// ---------------------------------------------------------------------------
// Das Zahlungsergebnis
// ---------------------------------------------------------------------------

/** Das Ergebnis einer umleitungsbasierten Zahlung (iDEAL, Giropay, …).
 *
 *  Stripe hängt `redirect_status` und `payment_intent` an die Adresse. Der
 *  endgültige „bezahlt"-Status kommt serverseitig über den Webhook; hier wird
 *  nur gezeigt, was Stripe zurückgemeldet hat — kein Status wird erfunden.
 */
export function CheckoutResultBlock({
  content,
  modus = NICHT_EDITIERBAR,
}: CheckoutProps) {
  const t = texte(modus.locale);
  const params = useSearchParams();
  const status = params.get("redirect_status");
  const ok = status === "succeeded";
  const offen = status === "pending" || status === "processing";

  // Ohne Parameter ist niemand von einer Zahlung zurückgekommen. Im Editor ist
  // das der Normalfall — dort wird der geglückte Ausgang gezeigt, weil er der
  // ist, den der Betrieb gestaltet. Live ohne Parameter: der neutrale Text,
  // kein erfundener Erfolg.
  const vorschau = modus.aktiv && !status;

  const [titelFeld, textFeld, symbol, farbe] =
    ok || vorschau
      ? ["success_headline", "success_text", "ph:check-circle", "text-emerald-600"]
      : offen
        ? ["pending_headline", "pending_text", "ph:clock", "text-amber-500"]
        : ["failed_headline", "failed_text", "ph:warning-circle", "text-red-600"];

  const standardTitel =
    ok || vorschau
      ? t.checkoutErgebnisOk
      : offen
        ? t.checkoutErgebnisOffen
        : t.checkoutErgebnisFehler;
  const standardText =
    ok || vorschau
      ? t.checkoutErgebnisOkText
      : offen
        ? t.checkoutErgebnisOffenText
        : t.checkoutErgebnisFehlerText;

  const titel = pickText(content[titelFeld], modus.locale) || standardTitel;
  const text = pickText(content[textFeld], modus.locale) || standardText;
  const nummer = params.get("payment_intent");

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <Icon icon={symbol} className={`size-14 ${farbe}`} />
      <h1 className="font-display text-2xl font-semibold tracking-tight">
        {titel}
      </h1>
      <p className="text-muted-foreground">{text}</p>
      {/* Die Buchungsnummer nur, wenn Stripe eine mitgeschickt hat. Kein
          Platzhalter „—": eine leere Nummer neben dem Wort „Buchungsnummer"
          liest sich wie ein Fehler in der Buchung. */}
      {fahne(content.show_booking_number, true) && nummer ? (
        <p className="text-sm text-muted-foreground">
          {t.checkoutNummer}: <span className="font-mono">{nummer}</span>
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bausteine der Darstellung
// ---------------------------------------------------------------------------

function Abschnitt({
  nummer,
  titel,
  aktiv,
  erledigt = false,
  nummerZeigen = true,
  children,
}: {
  nummer: number;
  titel: string;
  aktiv: boolean;
  erledigt?: boolean;
  nummerZeigen?: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border p-4 sm:p-6">
      <h2
        className={
          "flex items-center gap-2 font-display text-lg font-semibold " +
          (aktiv ? "" : "text-muted-foreground")
        }
      >
        {erledigt && (
          <Icon
            icon="ph:check-circle-fill"
            className="size-5 text-emerald-600"
          />
        )}
        {nummerZeigen ? `${nummer}. ` : ""}
        {titel}
      </h2>
      {aktiv && <div className="mt-4">{children}</div>}
    </section>
  );
}

function Punkt({ aktiv }: { aktiv: boolean }) {
  return (
    <span
      className={
        "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border-2 " +
        (aktiv ? "border-primary" : "border-muted-foreground/50")
      }
    >
      {aktiv && <span className="size-2.5 rounded-full bg-primary" />}
    </span>
  );
}

function Feld({
  label,
  wert,
  onChange,
  typ = "text",
  autoComplete,
}: {
  label: string;
  wert: string;
  onChange: (v: string) => void;
  typ?: "text" | "email" | "tel";
  autoComplete?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <input
        type={typ}
        value={wert}
        autoComplete={autoComplete}
        onChange={(e) => onChange(e.target.value)}
        // text-base ist Pflicht: unter 16 px zoomt iOS Safari beim Fokus in das
        // Feld, danach sitzt die ganze Seite verschoben. Ab sm wieder 14 px.
        className="h-12 rounded-xl border border-border bg-background px-3 text-base outline-none focus:border-foreground sm:h-11 sm:text-sm"
      />
    </label>
  );
}

function Zeile({ label, wert }: { label: string; wert: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{wert || "—"}</span>
    </div>
  );
}

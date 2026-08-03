"use client";

// Buchungs-Widget der Inserat-Seite — Datumswahl, Reisende, echte
// Verfügbarkeitsprüfung und Gastbuchung gegen den booking_engine-Slice. Der
// Buchungskalender im Backend ist die oberste Wahrheit: belegte Zeiträume werden
// mit 409 abgelehnt, eine erfolgreiche Buchung sperrt sofort alle Plattformen
// (Doppelbuchungsschutz).
//
// Der Preis wird NICHT hier gerechnet. Vorher stand „Grundpreis × Nächte" im
// Widget — das verschwieg Reinigung, Haustiergebühr und Kurtaxe, die der Server
// beim Buchen sehr wohl berechnet. Jetzt liefert `POST /booking-engine/quote`
// dieselbe Aufschlüsselung, die auch die Buchung verwendet.
import { Icon } from "@iconify/react";
import { useEffect, useState } from "react";

import { type Angebot, bucheGast, ladeAngebot, ladeVerfuegbarkeit } from "@/lib/buchung";
import { type Listing, formatCurrency } from "@/lib/listings";
import { StripeCheckout } from "@/components/stripe-checkout";

function naechte(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0;
  const a = new Date(checkIn + "T00:00:00Z").getTime();
  const b = new Date(checkOut + "T00:00:00Z").getTime();
  const n = Math.round((b - a) / 86_400_000);
  return n > 0 ? n : 0;
}

/** Ein Zähler wie in der Gäste-Auswahl der großen Portale: −/Wert/+. */
function Zaehler({
  titel,
  hinweis,
  wert,
  min,
  max,
  onChange,
}: {
  titel: string;
  hinweis?: string;
  wert: number;
  min: number;
  max: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2">
      <div>
        <p className="text-sm font-medium">{titel}</p>
        {hinweis && <p className="text-xs text-muted-foreground">{hinweis}</p>}
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={`${titel} verringern`}
          disabled={wert <= min}
          onClick={() => onChange(Math.max(min, wert - 1))}
          className="flex size-8 items-center justify-center rounded-full border border-border text-lg leading-none disabled:opacity-40"
        >
          −
        </button>
        <span className="min-w-6 text-center text-sm tabular-nums">{wert}</span>
        <button
          type="button"
          aria-label={`${titel} erhöhen`}
          disabled={wert >= max}
          onClick={() => onChange(Math.min(max, wert + 1))}
          className="flex size-8 items-center justify-center rounded-full border border-border text-lg leading-none disabled:opacity-40"
        >
          +
        </button>
      </div>
    </div>
  );
}

// Obergrenze der Tierauswahl. Der Server deckelt bei 50; im Widget wäre das
// sinnlos hoch — mehr als vier Tiere ist ein Fall für den Gastgeber-Kontakt.
const MAX_TIERE = 4;

export function BuchungsWidget({ listing }: { listing: Listing }) {
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [gaeste, setGaeste] = useState(1);
  const [tiere, setTiere] = useState(0);
  const [vorname, setVorname] = useState("");
  const [nachname, setNachname] = useState("");
  const [email, setEmail] = useState("");
  // Aktionscode des Gastes („Rabattcode einlösen"). `code` ist das Eingabefeld,
  // `codeAktiv` der EINGELÖSTE Code — erst beim Einlösen wird neu gerechnet,
  // sonst schickte jeder Tastendruck eine Anfrage.
  const [code, setCode] = useState("");
  const [codeAktiv, setCodeAktiv] = useState("");
  const [angebot, setAngebot] = useState<Angebot | null>(null);
  const [rechnet, setRechnet] = useState(false);
  const [status, setStatus] = useState<{
    kind: "idle" | "loading" | "error" | "done";
    msg?: string;
    reservationId?: string;
  }>({ kind: "idle" });

  const n = naechte(checkIn, checkOut);
  const preis = listing.preisProNacht; // null = Preis auf Anfrage
  const maxGaeste = Math.max(1, listing.gaeste || 1);

  // Angebot beim Server holen, sobald Zeitraum und Reisende feststehen. Es ist
  // die einzige Preis-Wahrheit im Widget — ohne gültigen Zeitraum gibt es keins.
  useEffect(() => {
    if (n <= 0) {
      setAngebot(null);
      return;
    }
    let abgebrochen = false;
    setRechnet(true);
    void ladeAngebot({
      property_id: listing.id,
      check_in: checkIn,
      check_out: checkOut,
      guests: gaeste,
      pets: tiere,
      promo_code: codeAktiv || undefined,
    }).then((res) => {
      if (abgebrochen) return;
      setRechnet(false);
      // Fehler hier NICHT als Buchungsfehler zeigen: der Gast hat noch nichts
      // ausgelöst. Ohne Angebot bleibt der Preisblock leer, das Buchen prüft
      // ohnehin erneut.
      setAngebot(res.ok ? res.data : null);
    });
    return () => {
      abgebrochen = true;
    };
  }, [listing.id, checkIn, checkOut, gaeste, tiere, n, codeAktiv]);

  // Tiere zurücksetzen, sobald das Objekt sie nicht (mehr) erlaubt — sonst
  // stünde eine Zahl im Zustand, die der Server mit 422 ablehnt.
  useEffect(() => {
    if (!listing.haustiereErlaubt && tiere !== 0) setTiere(0);
  }, [listing.haustiereErlaubt, tiere]);

  const buchbar = angebot != null && !angebot.priceless;

  async function reservieren() {
    if (n <= 0) {
      setStatus({ kind: "error", msg: "Bitte gültigen Zeitraum wählen." });
      return;
    }
    if (!vorname || !nachname || !email) {
      setStatus({ kind: "error", msg: "Bitte Kontaktdaten ausfüllen." });
      return;
    }
    if (!buchbar || angebot == null) {
      // Wurzel 4: kein 0-Fallback. Ohne serverseitig ermittelten Preis wird
      // keine Buchung angelegt.
      setStatus({
        kind: "error",
        msg: "Für diesen Zeitraum ist kein Preis hinterlegt — bitte den Gastgeber anfragen.",
      });
      return;
    }
    setStatus({ kind: "loading" });
    // Erst Verfügbarkeit prüfen (Buchungskalender = Wahrheit).
    const av = await ladeVerfuegbarkeit(listing.id, checkIn, checkOut);
    if (!av.ok) {
      setStatus({ kind: "error", msg: av.error });
      return;
    }
    if (av.data.days.some((d) => !d.available)) {
      setStatus({ kind: "error", msg: "Dieser Zeitraum ist nicht mehr verfügbar." });
      return;
    }
    const res = await bucheGast({
      property_id: listing.id,
      check_in: checkIn,
      check_out: checkOut,
      contact: { first_name: vorname, last_name: nachname, email },
      total_amount: angebot.total,
      guests: gaeste,
      pets: tiere,
      // Derselbe Code wie im Angebot — der Server rechnet den Preis erneut.
      promo_code: codeAktiv || undefined,
    });
    if (res.ok) {
      // Reservierung steht — weiter zum Bezahlschritt (Stripe Payment Element).
      setStatus({ kind: "done", reservationId: res.data.id });
    } else {
      setStatus({ kind: "error", msg: res.error });
    }
  }

  const waehrung = angebot?.currency || listing.currency;

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-lg">
      <p className="mb-4">
        {preis != null ? (
          <>
            <span className="text-xl font-semibold">
              {formatCurrency(preis, listing.currency)}
            </span>{" "}
            <span className="text-muted-foreground">Nacht</span>
          </>
        ) : (
          <span className="text-muted-foreground">Preis auf Anfrage</span>
        )}
      </p>

      <div className="overflow-hidden rounded-xl border border-border">
        <div className="grid grid-cols-2 divide-x divide-border border-b border-border">
          <label className="p-3">
            <span className="block text-[0.625rem] font-semibold uppercase tracking-wide">
              Check-in
            </span>
            <input
              type="date"
              value={checkIn}
              onChange={(e) => setCheckIn(e.target.value)}
              className="w-full bg-transparent text-sm text-foreground outline-none"
            />
          </label>
          <label className="p-3">
            <span className="block text-[0.625rem] font-semibold uppercase tracking-wide">
              Check-out
            </span>
            <input
              type="date"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              className="w-full bg-transparent text-sm text-foreground outline-none"
            />
          </label>
        </div>

        <div className="border-b border-border px-3 py-1">
          <span className="block pt-2 text-[0.625rem] font-semibold uppercase tracking-wide">
            Reisende
          </span>
          <Zaehler
            titel="Gäste"
            hinweis={`max. ${maxGaeste}`}
            wert={gaeste}
            min={1}
            max={maxGaeste}
            onChange={setGaeste}
          />
          {listing.haustiereErlaubt && (
            <Zaehler
              titel="Haustiere"
              hinweis="Gebühren können anfallen"
              wert={tiere}
              min={0}
              max={MAX_TIERE}
              onChange={setTiere}
            />
          )}
        </div>

        <div className="grid grid-cols-1 gap-2 p-3">
          <input
            placeholder="Vorname"
            value={vorname}
            onChange={(e) => setVorname(e.target.value)}
            className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none"
          />
          <input
            placeholder="Nachname"
            value={nachname}
            onChange={(e) => setNachname(e.target.value)}
            className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none"
          />
          <input
            type="email"
            placeholder="E-Mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none"
          />
        </div>
      </div>

      {/* Schritt 2: Bezahlen (Stripe Payment Element) — erscheint, sobald die
          Reservierung angelegt ist. */}
      {status.kind === "done" && status.reservationId ? (
        <div className="mt-4">
          <StripeCheckout reservationId={status.reservationId} />
        </div>
      ) : (
        <button
          type="button"
          onClick={reservieren}
          disabled={status.kind === "loading"}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-accent px-4 py-3 font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {status.kind === "loading" ? (
            <Icon icon="ph:spinner" className="size-4 animate-spin" />
          ) : null}
          Reservieren &amp; bezahlen
        </button>
      )}

      {status.msg && status.kind === "error" && (
        <p className="mt-3 text-center text-sm text-red-600">{status.msg}</p>
      )}

      {/* Aufschlüsselung des Servers: Übernachtung, Gebühren, Abgaben — Zeile
          für Zeile so, wie sie auch berechnet werden. */}
      {n > 0 && status.kind !== "done" && (
        <div className="mt-6 flex flex-col gap-3 text-sm">
          {rechnet && !angebot && (
            <p className="text-center text-muted-foreground">Preis wird berechnet …</p>
          )}
          {angebot && !angebot.priceless && (
            <>
              {angebot.lines.map((zeile, i) => (
                <div key={`${zeile.label}-${i}`} className="flex justify-between">
                  <span className={zeile.amount < 0 ? "text-emerald-700" : ""}>
                    {zeile.label}
                  </span>
                  <span className={zeile.amount < 0 ? "text-emerald-700" : ""}>
                    {formatCurrency(zeile.amount, waehrung)}
                  </span>
                </div>
              ))}
              {/* Aktionscode — Branchenstandard: der Gast löst ihn beim Buchen
                  ein, der Rabatt erscheint als eigene Zeile in der Übersicht.
                  Gerechnet wird ausschließlich serverseitig. */}
              <div className="mt-2 flex flex-col gap-2 border-t border-border pt-3">
                <label className="flex items-center gap-2">
                  <input
                    value={code}
                    maxLength={15}
                    placeholder="Aktionscode"
                    onChange={(e) => setCode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        setCodeAktiv(code.trim());
                      }
                    }}
                    className="h-10 min-w-0 flex-1 rounded-full border border-border bg-background px-4 text-sm"
                  />
                  <button
                    type="button"
                    disabled={!code.trim() || code.trim() === codeAktiv}
                    onClick={() => setCodeAktiv(code.trim())}
                    className="h-10 shrink-0 rounded-full border border-border px-4 text-sm font-medium disabled:opacity-40"
                  >
                    Einlösen
                  </button>
                </label>
                {/* Nur nach einem Einlöse-Versuch etwas sagen — und zwar die
                    Wahrheit: ein Rabatt in den Zeilen kann auch von einer
                    automatischen Aktion kommen, dann war der Code trotzdem
                    ungültig. */}
                {codeAktiv && (
                  <p
                    className={
                      angebot.promo_code_applied
                        ? "text-sm text-emerald-700"
                        : "text-sm text-destructive"
                    }
                  >
                    {angebot.promo_code_applied
                      ? "Aktionscode angewendet."
                      : "Dieser Aktionscode gilt für diese Buchung nicht."}
                  </p>
                )}
              </div>
              <div className="mt-2 flex justify-between border-t border-border pt-3 font-semibold">
                <span>Gesamt</span>
                <span>{formatCurrency(angebot.total, waehrung)}</span>
              </div>
            </>
          )}
          {angebot?.priceless && (
            <p className="text-center text-muted-foreground">
              Für diesen Zeitraum ist kein Preis hinterlegt.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

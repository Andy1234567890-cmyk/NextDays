"use client";

// Buchungs-Widget der Inserat-Seite — Datumswahl, echte Verfügbarkeitsprüfung
// und Gastbuchung gegen den booking_engine-Slice. Der Buchungskalender im Backend
// ist die oberste Wahrheit: belegte Zeiträume werden mit 409 abgelehnt, eine
// erfolgreiche Buchung sperrt sofort alle Plattformen (Doppelbuchungsschutz).
import { Icon } from "@iconify/react";
import { useState } from "react";

import { bucheGast, ladeVerfuegbarkeit } from "@/lib/buchung";
import { type Listing, formatCurrency } from "@/lib/listings";
import { texte } from "@/lib/texte";
import { StripeCheckout } from "@/components/stripe-checkout";

function naechte(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0;
  const a = new Date(checkIn + "T00:00:00Z").getTime();
  const b = new Date(checkOut + "T00:00:00Z").getTime();
  const n = Math.round((b - a) / 86_400_000);
  return n > 0 ? n : 0;
}

export function BuchungsWidget({
  listing,
  sprache,
  datenschutzPflicht = false,
  datenschutzHref = null,
  zahlungenBereit = true,
}: {
  listing: Listing;
  /** Sprache der Website — für die festen Beschriftungen (lib/texte.ts).
   *  Vorher standen hier deutsche Wörter im Markup, auf jeder Kundenseite. */
  sprache: string;
  /** true = der Gast muss der Datenschutzerklärung zustimmen, bevor reserviert
   *  wird (`privacy_consent`, 0426).
   *
   *  Diese Stelle und nicht der Kontakt-Abschnitt: HIER übermittelt der Gast
   *  seine personenbezogenen Daten. Der Kontakt-Abschnitt des Renderers zeigt
   *  nur Adresse und Telefon und hat gar kein Formular — ein Häkchen dort wäre
   *  eine Attrappe gewesen. */
  datenschutzPflicht?: boolean;
  /** Pfad zur Datenschutzerklärung. Fehlt sie, gibt es kein Link — aber das
   *  Häkchen bleibt: die Pflicht hängt an der Einstellung, nicht am Link. */
  datenschutzHref?: string | null;
  /** Kann der Betrieb online Geld annehmen (Stripe abrechnungsfähig oder
   *  PayPal hinterlegt)?
   *
   *  `false` schaltet auf den ANFRAGE-Weg: der Gast schickt eine Anfrage, der
   *  Betrieb antwortet. Das ist kein Notbehelf, sondern der richtige Zustand
   *  für einen Betrieb, dessen Zahlungskonto noch nicht freigeschaltet ist —
   *  die KYC-Prüfung bei Stripe dauert Tage.
   *
   *  Default `true`, damit ein fehlender Wert nicht stillschweigend die
   *  Zahlung abschaltet. Der Aufrufer setzt ihn aus dem Branding. */
  zahlungenBereit?: boolean;
}) {
  const txt = texte(sprache);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [vorname, setVorname] = useState("");
  const [nachname, setNachname] = useState("");
  const [email, setEmail] = useState("");
  const [zugestimmt, setZugestimmt] = useState(false);
  const [status, setStatus] = useState<{
    kind: "idle" | "loading" | "error" | "done";
    msg?: string;
    reservationId?: string;
  }>({ kind: "idle" });

  const n = naechte(checkIn, checkOut);
  const preis = listing.preisProNacht; // null = Preis auf Anfrage
  const zwischensumme = (preis ?? 0) * n;

  async function reservieren() {
    if (n <= 0) {
      setStatus({ kind: "error", msg: "Bitte gültigen Zeitraum wählen." });
      return;
    }
    if (!vorname || !nachname || !email) {
      setStatus({ kind: "error", msg: "Bitte Kontaktdaten ausfüllen." });
      return;
    }
    // Die Prüfung steht VOR dem ersten Netzaufruf: sonst wäre die
    // Verfügbarkeitsabfrage schon gelaufen, obwohl die Reservierung gar nicht
    // zulässig ist.
    if (datenschutzPflicht && !zugestimmt) {
      setStatus({ kind: "error", msg: txt.datenschutzPflicht });
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
      total_amount: zwischensumme,
    });
    if (res.ok) {
      // Reservierung steht — weiter zum Bezahlschritt (Stripe Payment Element).
      setStatus({ kind: "done", reservationId: res.data.id });
    } else {
      setStatus({ kind: "error", msg: res.error });
    }
  }

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
              {txt.checkIn}
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
              {txt.checkOut}
            </span>
            <input
              type="date"
              value={checkOut}
              onChange={(e) => setCheckOut(e.target.value)}
              className="w-full bg-transparent text-sm text-foreground outline-none"
            />
          </label>
        </div>
        <div className="grid grid-cols-1 gap-2 p-3">
          <input
            placeholder={txt.vorname}
            value={vorname}
            onChange={(e) => setVorname(e.target.value)}
            className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none"
          />
          <input
            placeholder={txt.nachname}
            value={nachname}
            onChange={(e) => setNachname(e.target.value)}
            className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none"
          />
          <input
            type="email"
            placeholder={txt.email}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-border bg-transparent px-3 py-2 text-sm outline-none"
          />
        </div>
      </div>

      {datenschutzPflicht ? (
        <label className="mt-3 flex items-start gap-2 text-xs">
          <input
            type="checkbox"
            checked={zugestimmt}
            onChange={(e) => setZugestimmt(e.target.checked)}
            className="mt-0.5 size-4 accent-foreground"
          />
          <span>
            {txt.datenschutzZustimmung}
            {datenschutzHref ? (
              <>
                {" "}
                <a
                  href={datenschutzHref}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  {txt.datenschutzMehr}
                </a>
              </>
            ) : null}
          </span>
        </label>
      ) : null}

      {/* Schritt 2: Bezahlen — ODER die Bestätigung der Anfrage.
          Welcher der beiden Wege gilt, entscheidet `zahlungenBereit`: es sagt,
          ob der Betrieb überhaupt Geld annehmen kann (Stripe abrechnungsfähig
          oder PayPal hinterlegt).

          Ohne diese Unterscheidung durchlief der Gast die ganze Strecke, die
          Reservierung entstand — und der Zahlungsschritt scheiterte mit einem
          409 („Stripe ist noch nicht abrechnungsfähig verbunden"). Der Betrieb
          erfuhr davon nichts, der Gast brach ab. */}
      {status.kind === "done" && status.reservationId ? (
        <div className="mt-4">
          {zahlungenBereit ? (
            <StripeCheckout reservationId={status.reservationId} />
          ) : (
            <p className="rounded-2xl border border-border px-4 py-3 text-center text-sm">
              {txt.anfrageGesendet}
            </p>
          )}
        </div>
      ) : (
        <>
          <button
            type="button"
            onClick={reservieren}
            disabled={status.kind === "loading"}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-accent px-4 py-3 font-medium text-accent-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {status.kind === "loading" ? (
              <Icon icon="ph:spinner" className="size-4 animate-spin" />
            ) : null}
            {/* Vorher stand hier „Reservieren & bezahlen" als deutscher Text
                im Markup — auf JEDER Kundenseite, auch der dänischen. */}
            {zahlungenBereit ? txt.reservierenBezahlen : txt.anfrageSenden}
          </button>
          {zahlungenBereit ? null : (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              {txt.anfrageHinweis}
            </p>
          )}
        </>
      )}

      {status.msg && status.kind === "error" && (
        <p className="mt-3 text-center text-sm text-red-600">{status.msg}</p>
      )}

      {n > 0 && preis != null && status.kind !== "done" && (
        <div className="mt-6 flex flex-col gap-3 text-sm">
          <div className="flex justify-between">
            <span className="underline">
              {formatCurrency(preis, listing.currency)} × {n} Nächte
            </span>
            <span>{formatCurrency(zwischensumme, listing.currency)}</span>
          </div>
          <div className="mt-2 flex justify-between border-t border-border pt-3 font-semibold">
            <span>Gesamt</span>
            <span>{formatCurrency(zwischensumme, listing.currency)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

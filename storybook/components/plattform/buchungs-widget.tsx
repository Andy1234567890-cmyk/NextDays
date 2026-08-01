// Buchungs-Widget der Inserat-Seite — Datumswahl + Preisaufstellung + Reservieren.
// Portiert aus plattform/. Das echte Pendant prüft die Verfügbarkeit gegen den
// booking_engine-Slice (409 bei Belegung) und legt eine Reservierung an; in der
// Storybook-Werkstatt gibt es kein Backend — „Reservieren" wechselt direkt zum
// (attrappierten) Bezahlschritt, damit der visuelle Flow prüfbar ist.
"use client";

import { useState } from "react";

import { type Listing, formatEuro } from "./_fixtures";
import { StripeCheckout } from "./stripe-checkout";

function naechte(checkIn: string, checkOut: string): number {
  if (!checkIn || !checkOut) return 0;
  const a = new Date(checkIn + "T00:00:00Z").getTime();
  const b = new Date(checkOut + "T00:00:00Z").getTime();
  const n = Math.round((b - a) / 86_400_000);
  return n > 0 ? n : 0;
}

export function BuchungsWidget({ listing }: { listing: Listing }) {
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [vorname, setVorname] = useState("");
  const [nachname, setNachname] = useState("");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<{
    kind: "idle" | "error" | "done";
    msg?: string;
  }>({ kind: "idle" });

  const n = naechte(checkIn, checkOut);
  const preis = listing.preisProNacht;
  const zwischensumme = (preis ?? 0) * n;

  function reservieren() {
    if (n <= 0) {
      setStatus({ kind: "error", msg: "Bitte gültigen Zeitraum wählen." });
      return;
    }
    if (!vorname || !nachname || !email) {
      setStatus({ kind: "error", msg: "Bitte Kontaktdaten ausfüllen." });
      return;
    }
    // Attrappe: kein Verfügbarkeits-Check/Backend — direkt zum Bezahlschritt.
    setStatus({ kind: "done" });
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-lg">
      <p className="mb-4">
        {preis != null ? (
          <>
            <span className="text-xl font-semibold">
              {formatEuro(preis, listing.currency)}
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

      {status.kind === "done" ? (
        <div className="mt-4">
          <StripeCheckout reservationId="demo" />
        </div>
      ) : (
        <button
          type="button"
          onClick={reservieren}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-accent px-4 py-3 font-medium text-accent-foreground transition-opacity hover:opacity-90"
        >
          Reservieren &amp; bezahlen
        </button>
      )}

      {status.msg && status.kind === "error" && (
        <p className="mt-3 text-center text-sm text-red-600">{status.msg}</p>
      )}

      {n > 0 && preis != null && status.kind !== "done" && (
        <div className="mt-6 flex flex-col gap-3 text-sm">
          <div className="flex justify-between">
            <span className="underline">
              {formatEuro(preis, listing.currency)} × {n} Nächte
            </span>
            <span>{formatEuro(zwischensumme, listing.currency)}</span>
          </div>
          <div className="mt-2 flex justify-between border-t border-border pt-3 font-semibold">
            <span>Gesamt</span>
            <span>{formatEuro(zwischensumme, listing.currency)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

// Die Annahmeseite eines Buchungsangebots (0586) — was der Gast sieht.
//
// ZWEI KNÖPFE, ZWEI WEGE:
//   „Verbindlich buchen und bezahlen" → POST /accept → Zahlungslink → Stripe.
//   „Angebot ablehnen"                → POST /decline, die Seite zeigt danach
//                                       den Endzustand.
//
// DER SERVER ENTSCHEIDET, ob überhaupt angenommen werden kann (`acceptable`,
// `blocked_reason`). Diese Seite rechnet weder Frist noch Zustand nach: sonst
// hätte sie irgendwann eine andere Meinung als der Endpunkt, der die Zahlung
// freigibt — und ein Gast würde auf einen Knopf klicken, der 409 antwortet.
//
// Zwischen Klick und Weiterleitung kann die Antwort 409 sein („Zeitraum
// inzwischen vergeben"). Das ist kein Fehler der Seite, sondern die bewusste
// Kehrseite davon, dass ein Angebot nichts reserviert — der Text sagt es
// vorher, und die Meldung sagt es danach.
import { useState } from "react";

import { formatCurrency } from "@nextdays/currency";
import type { OeffentlichesAngebot } from "@/lib/angebot";
import { backendBasis } from "@/lib/backend-basis";
import type { RendererTexte } from "@/lib/texte";

// Die Gründe, die der Server in `blocked_reason` schickt, auf ihren Text.
// Vollständig und ohne Rückfall auf einen erfundenen Satz: ein unbekannter
// Grund zeigt den allgemeinen Fehlertext, nicht „abgelaufen" (das wäre eine
// Aussage, die vielleicht nicht stimmt).
function grundText(t: RendererTexte, grund: string | null | undefined): string {
  switch (grund) {
    case "expired":
      return t.angebotAbgelaufen;
    case "cancelled":
      return t.angebotZurueckgezogen;
    case "declined":
      return t.angebotAbgelehnt;
    case "paid":
      return t.angebotBezahlt;
    case "in_payment":
      return t.angebotInZahlung;
    case "not_sent":
      return t.angebotNichtVerschickt;
    default:
      return t.angebotFehler;
  }
}

export function AngebotAnsicht({
  angebot,
  token,
  t,
}: {
  angebot: OeffentlichesAngebot;
  token: string;
  t: RendererTexte;
}) {
  const [laeuft, setLaeuft] = useState<"buchen" | "ablehnen" | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [abgelehnt, setAbgelehnt] = useState(false);

  const basis = `${backendBasis()}/api/v1/public/offers/${encodeURIComponent(token)}`;

  async function buchen() {
    setLaeuft("buchen");
    setFehler(null);
    try {
      const res = await fetch(`${basis}/accept`, {
        method: "POST",
        headers: { Accept: "application/json" },
      });
      const daten = (await res.json().catch(() => null)) as
        | { payment_url?: string; detail?: string }
        | null;
      if (!res.ok || !daten?.payment_url) {
        setFehler(daten?.detail ?? t.angebotFehler);
        setLaeuft(null);
        return;
      }
      // Weiter zu Stripe. Kein `router.push`: das Ziel liegt außerhalb dieser
      // Anwendung.
      window.location.href = daten.payment_url;
    } catch {
      setFehler(t.angebotFehler);
      setLaeuft(null);
    }
  }

  async function ablehnen() {
    setLaeuft("ablehnen");
    setFehler(null);
    try {
      const res = await fetch(`${basis}/decline`, {
        method: "POST",
        headers: { Accept: "application/json" },
      });
      setLaeuft(null);
      if (!res.ok) {
        setFehler(t.angebotFehler);
        return;
      }
      setAbgelehnt(true);
    } catch {
      setLaeuft(null);
      setFehler(t.angebotFehler);
    }
  }

  const offen = angebot.acceptable && !abgelehnt;
  const anzahlung = angebot.amount_due_now < angebot.total_amount;

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <p className="text-sm text-muted-foreground">{angebot.company_name}</p>
      <h1 className="mt-1 font-display text-3xl font-extrabold">
        {t.angebotTitel}
      </h1>
      <p className="mt-2 text-lg">
        {t.angebotFuer.replace("{objekt}", angebot.property_title)}
      </p>

      <section className="mt-6 rounded-2xl border p-5">
        <p className="text-sm">
          {t.angebotZeitraum
            .replace("{anreise}", angebot.check_in)
            .replace("{abreise}", angebot.check_out)
            .replace("{naechte}", String(angebot.nights))}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {t.angebotGaeste
            .replace("{erwachsene}", String(angebot.adults))
            .replace("{kinder}", String(angebot.children))}
        </p>

        <ul className="mt-4 space-y-1.5 text-sm">
          {angebot.lines.map((zeile) => (
            <li
              key={`${zeile.label}-${zeile.amount}`}
              className="flex justify-between gap-4"
            >
              <span className="text-muted-foreground">{zeile.label}</span>
              <span>{formatCurrency(zeile.amount, angebot.currency)}</span>
            </li>
          ))}
        </ul>

        <div className="mt-3 flex justify-between gap-4 border-t pt-3 font-semibold">
          <span>{t.angebotSumme}</span>
          <span>{formatCurrency(angebot.total_amount, angebot.currency)}</span>
        </div>
        {anzahlung && (
          <div className="mt-1 flex justify-between gap-4 text-sm">
            <span>{t.angebotJetztFaellig}</span>
            <span>
              {formatCurrency(angebot.amount_due_now, angebot.currency)}
            </span>
          </div>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          {t.angebotGueltigBis.replace(
            "{datum}",
            angebot.expires_at.slice(0, 10),
          )}
        </p>
      </section>

      {offen ? (
        <>
          <p className="mt-4 text-sm text-muted-foreground">
            {t.angebotHinweisKeineReservierung}
          </p>
          {fehler && <p className="mt-3 text-sm text-red-700">{fehler}</p>}
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void buchen()}
              disabled={laeuft !== null}
              className="rounded-full bg-black px-6 py-3 font-semibold text-white disabled:opacity-60"
            >
              {laeuft === "buchen" ? t.angebotWartet : t.angebotBuchen}
            </button>
            <button
              type="button"
              onClick={() => void ablehnen()}
              disabled={laeuft !== null}
              className="rounded-full border px-6 py-3 font-semibold disabled:opacity-60"
            >
              {t.angebotAblehnen}
            </button>
          </div>
        </>
      ) : (
        <p className="mt-5 rounded-2xl border border-dashed px-4 py-4 text-sm">
          {abgelehnt
            ? t.angebotAbgelehnt
            : grundText(t, angebot.blocked_reason)}
        </p>
      )}
    </main>
  );
}

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
import type { AngebotAufenthalt, OeffentlichesAngebot } from "@/lib/angebot";
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

type Datum = (iso: string) => string;
type Geld = (betrag: number) => string;

function Kachel({ titel, wert, zusatz }: { titel: string; wert: string; zusatz?: string | null }) {
  return (
    <div className="rounded-2xl border p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{titel}</p>
      <p className="mt-1 font-semibold">{wert}</p>
      {zusatz && <p className="text-xs text-muted-foreground">{zusatz}</p>}
    </div>
  );
}

function Aufenthalt({
  angebot,
  t,
  datum,
}: {
  angebot: OeffentlichesAngebot;
  t: RendererTexte;
  datum: Datum;
}) {
  const stay = angebot.stay ?? null;
  return (
    <section className="mt-6 grid grid-cols-3 gap-3">
      <Kachel
        titel={t.angebotAnreise}
        wert={datum(angebot.check_in)}
        zusatz={stay?.check_in_time ? t.angebotCheckInAb.replace("{zeit}", stay.check_in_time) : null}
      />
      <Kachel
        titel={t.angebotAbreise}
        wert={datum(angebot.check_out)}
        zusatz={stay?.check_out_time ? t.angebotCheckOutBis.replace("{zeit}", stay.check_out_time) : null}
      />
      <Kachel
        titel={t.angebotGaesteTitel}
        wert={t.angebotGaeste
          .replace("{erwachsene}", String(angebot.adults))
          .replace("{kinder}", String(angebot.children))}
        zusatz={t.angebotNaechte.replace("{naechte}", String(angebot.nights))}
      />
    </section>
  );
}

function Preis({
  angebot,
  t,
  datum,
  geld,
}: {
  angebot: OeffentlichesAngebot;
  t: RendererTexte;
  datum: Datum;
  geld: Geld;
}) {
  const plan = angebot.stay?.payment_plan ?? null;
  const anzahlung = angebot.amount_due_now < angebot.total_amount;
  const restText =
    plan && plan.due_later > 0
      ? plan.balance_due_date
        ? t.angebotRestbetrag
            .replace("{betrag}", geld(plan.due_later))
            .replace("{datum}", datum(plan.balance_due_date))
        : t.angebotRestbetragVorAnreise.replace("{betrag}", geld(plan.due_later))
      : null;
  return (
    <section className="mt-4 rounded-2xl border p-5">
      <h2 className="text-sm font-semibold">{t.angebotPreisTitel}</h2>
      <ul className="mt-3 space-y-1.5 text-sm">
        {angebot.lines.map((zeile) => (
          <li key={`${zeile.label}-${zeile.amount}`} className="flex justify-between gap-4">
            <span className="text-muted-foreground">{zeile.label}</span>
            <span>{geld(zeile.amount)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex justify-between gap-4 border-t pt-3 font-semibold">
        <span>{t.angebotInklMwst}</span>
        <span>{geld(angebot.total_amount)}</span>
      </div>
      {anzahlung && (
        <div className="mt-1 flex justify-between gap-4 text-sm">
          <span>{t.angebotJetztFaellig}</span>
          <span>{geld(angebot.amount_due_now)}</span>
        </div>
      )}
      {restText && <p className="mt-1 text-sm text-muted-foreground">{restText}</p>}
      <p className="mt-3 text-xs text-muted-foreground">
        {t.angebotGueltigBis.replace("{datum}", datum(angebot.expires_at))}
      </p>
    </section>
  );
}

function Storno({ storno, t }: { storno: NonNullable<AngebotAufenthalt["cancellation"]>; t: RendererTexte }) {
  if (storno.mode === "non_refundable") return <p className="mt-1 text-muted-foreground">{t.angebotStornoNichtErstattbar}</p>;
  if (storno.mode === "refundable") return <p className="mt-1 text-muted-foreground">{t.angebotStornoKostenlos}</p>;
  return (
    <>
      {storno.rules.map((r) => (
        <p key={r.days_before_arrival} className="mt-1 text-muted-foreground">
          {t.angebotStornoStaffel
            .replace("{tage}", String(r.days_before_arrival))
            .replace("{prozent}", String(r.refund_percent))}
        </p>
      ))}
    </>
  );
}

function Bedingungen({ stay, t }: { stay: AngebotAufenthalt | null; t: RendererTexte }) {
  const storno = stay?.cancellation ?? null;
  if (!storno && !stay?.house_rules) return null;
  return (
    <section className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
      {storno && (
        <div className="rounded-2xl border p-4">
          <h2 className="font-semibold">{t.angebotStorno}</h2>
          <Storno storno={storno} t={t} />
        </div>
      )}
      {stay?.house_rules && (
        <div className="rounded-2xl border p-4">
          <h2 className="font-semibold">{t.angebotHausregeln}</h2>
          <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{stay.house_rules}</p>
        </div>
      )}
    </section>
  );
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
  const stay = angebot.stay ?? null;
  const sprache = angebot.language || "en";
  const datum: Datum = (iso) => {
    const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
    return Number.isNaN(d.getTime())
      ? iso.slice(0, 10)
      : d.toLocaleDateString(sprache, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
  };
  const geld: Geld = (betrag) => formatCurrency(betrag, angebot.currency);
  const ort = stay
    ? [stay.address, [stay.postal_code, stay.city].filter(Boolean).join(" ")].filter(Boolean).join(", ")
    : angebot.property_city ?? "";

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <p className="text-sm text-muted-foreground">{angebot.company_name}</p>
      {stay?.cover_url && (
        // Externes Objektfoto aus dem Storage — kein next/image (fremde Domain,
        // Renderer ohne Bild-Allowlist je Betrieb).
        // eslint-disable-next-line @next/next/no-img-element
        <img src={stay.cover_url} alt={stay.title} className="mt-3 h-64 w-full rounded-2xl object-cover" />
      )}
      <h1 className="mt-4 font-display text-3xl font-extrabold">{stay?.title || angebot.property_title}</h1>
      {ort && <p className="mt-1 text-sm text-muted-foreground">{ort}</p>}
      <p className="mt-2 text-lg">{t.angebotTitel}</p>

      <Aufenthalt angebot={angebot} t={t} datum={datum} />
      <Preis angebot={angebot} t={t} datum={datum} geld={geld} />
      <Bedingungen stay={stay} t={t} />

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

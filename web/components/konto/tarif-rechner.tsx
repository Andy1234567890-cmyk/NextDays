"use client";

// Tarifrechner ("Der Plan, der mit Ihnen wächst") — Lodgify-Layout, aber für
// UNSER Preismodell: myNextDays hat EINEN Tarif mit Objekt-Staffel, keine drei
// Pakete. Statt Paket-Spalten zeigen wir deshalb den Regler für die Objektzahl
// und rechnen den echten Staffelpreis daraus aus.
//
// Alle Beträge kommen aus Stripe (getPricing) — nichts hier hardcoden
// (Wurzel 4). Die Staffel wird exakt so gerechnet, wie Stripe sie als
// `graduated` abrechnet: jeder Tier gilt nur für die Objekte IN seiner Spanne.
import { Icon } from "@iconify/react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { formatCurrency } from "@/lib/currency";
import {
  getPricing,
  getSubscriptionStatus,
  startCheckout,
  type Pricing,
  type SubscriptionStatus,
} from "@/lib/subscriptions";

const MAX_OBJEKTE = 500;

// Was im Tarif enthalten ist. Reine Anzeige-Liste (keine Preislogik) — die
// Funktionen sind im Produkt vorhanden, nicht paketabhängig. Bewusst
// vollständig: bei den üblichen Anbietern sind Channel Manager, Aufgaben und
// Eigentümer-Reporting auf teurere Pakete verteilt, hier ist alles in einem.
const ENTHALTEN: readonly { icon: string; text: string }[] = [
  { icon: "lucide:globe", text: "Eigene Buchungswebsite" },
  { icon: "lucide:share-2", text: "Portale: Booking, Airbnb & Co." },
  { icon: "lucide:calendar-days", text: "Kalender & Belegungsplan" },
  { icon: "lucide:message-square", text: "Posteingang & Gästenachrichten" },
  { icon: "lucide:sparkles", text: "Reinigung & Aufgaben" },
  { icon: "lucide:key-round", text: "Automatisierter Check-in" },
  { icon: "lucide:bar-chart-3", text: "Auswertungen & Berichte" },
  { icon: "lucide:file-text", text: "Eigentümer-Abrechnungen" },
  { icon: "lucide:receipt", text: "Gastrechnungen" },
  { icon: "lucide:users", text: "Mitarbeiter & Rollen" },
  { icon: "lucide:trending-up", text: "Dynamische Preise" },
  { icon: "lucide:life-buoy", text: "Persönlicher Support" },
];

// Wettbewerbspreise, recherchiert 29.07.2026 von den OFFIZIELLEN Preisseiten.
// Jede Zahl trägt ihre Quelle — wer sie später prüft, muss nicht raten. Nur
// belegte Werte; wo ein Anbieter keine Preise veröffentlicht, steht das so da
// (kein geschätzter Betrag, Wurzel 4).
//
// Referenz ist bewusst der Tarif, der UNSEREN Funktionsumfang abdeckt: bei
// Lodgify ist das Ultimate (Reinigung/Aufgaben + Eigentümer-Reporting stecken
// erst dort), nicht Starter für 68 € ohne Channel Manager.
const WETTBEWERB: readonly {
  name: string;
  tarif: string;
  preis20: number | null; // EUR/Monat bei 20 Objekten, null = nicht veröffentlicht
  hinweis: string;
  quelle: string;
}[] = [
  {
    name: "Smoobu",
    tarif: "Professional",
    preis20: 210.4,
    hinweis: "28 € + 19 × 9,60 €; Aufgaben nur über Schreib-Konten (12 €/Monat)",
    quelle: "smoobu.com/de/preise",
  },
  {
    name: "Lodgify",
    tarif: "Ultimate",
    preis20: 335,
    hinweis: "Reinigung & Aufgaben erst ab Ultimate; Professional 261 €",
    quelle: "lodgify.com/pricing",
  },
  {
    name: "Apaleo",
    tarif: "PMS",
    preis20: 400,
    hinweis: "8 €/Zimmer, aber Mindestpreis 400 €; Channel Manager kostet extra",
    quelle: "apaleo.com/pricing",
  },
  {
    name: "Hostaway",
    tarif: "auf Anfrage",
    preis20: null,
    hinweis: "veröffentlicht keine Preise",
    quelle: "hostaway.com/pricing",
  },
  {
    name: "Cloudbeds",
    tarif: "auf Anfrage",
    preis20: null,
    hinweis: "veröffentlicht keine Preise",
    quelle: "cloudbeds.com/pricing",
  },
];

/**
 * Monatspreis für `anzahl` Objekte nach Stripe-`graduated`-Logik.
 *
 * Jeder Tier gilt NUR für die Objekte innerhalb seiner Spanne: `flat_amount`
 * fällt einmal an, sobald der Tier erreicht ist, `unit_amount` je Objekt in
 * dieser Spanne. Rückgabe in Cent — oder null, wenn die Staffel unvollständig
 * ist (dann zeigen wir keinen erfundenen Preis).
 */
function preisFuer(pricing: Pricing, anzahl: number): number | null {
  if (pricing.grundtarif_tiers.length === 0) return null;
  return rechnungsPosten(pricing, anzahl).reduce((s, p) => s + p.cent, 0);
}

/**
 * Die einzelnen Positionen der Rechnung für `anzahl` Objekte — nur die Tiers,
 * die tatsächlich greifen. Bei 5 Objekten entsteht also keine Zeile für
 * „51–100", die den Nutzer nichts angeht.
 *
 * Einzige Quelle der Staffel-Arithmetik: `preisFuer` summiert genau diese
 * Posten. So können Aufschlüsselung und Endbetrag nicht auseinanderlaufen.
 */
function rechnungsPosten(
  pricing: Pricing,
  anzahl: number,
): { text: string; cent: number }[] {
  const posten: { text: string; cent: number }[] = [];
  let untergrenze = 0; // bereits abgedeckte Objekte
  for (const t of pricing.grundtarif_tiers) {
    if (untergrenze >= anzahl) break;
    const obergrenze = t.up_to ?? anzahl;
    const inDiesemTier = Math.min(anzahl, obergrenze) - untergrenze;
    if (inDiesemTier > 0) {
      if (t.flat_amount != null) {
        posten.push({
          text: "Grundgebühr (inkl. 1. Objekt)",
          cent: t.flat_amount,
        });
      }
      if (t.unit_amount != null) {
        // Stückpreis über formatCurrency — kein €-Hardcode (Wurzel 4).
        const je = formatCurrency(t.unit_amount / 100, pricing.currency);
        posten.push({
          text:
            `${inDiesemTier} ${inDiesemTier === 1 ? "weiteres Objekt" : "weitere Objekte"}` +
            ` × ${je}`,
          cent: t.unit_amount * inDiesemTier,
        });
      }
    }
    if (t.up_to == null) break;
    untergrenze = t.up_to;
  }
  return posten;
}

export function TarifRechner({ onBack }: { onBack: () => void }) {
  const [pricing, setPricing] = useState<Pricing | null>(null);
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [anzahl, setAnzahl] = useState(1);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const [p, s] = await Promise.all([getPricing(), getSubscriptionStatus()]);
      if (p.ok) setPricing(p.data);
      else setError(p.error);
      if (s.ok) {
        setStatus(s.data);
        // Mit der echten Objektzahl starten — der Regler zeigt dann sofort den
        // Preis, der den Betrieb tatsächlich betrifft.
        setAnzahl(Math.max(1, s.data.property_count));
      }
    })();
  }, []);

  const monatlich = useMemo(
    () => (pricing ? preisFuer(pricing, anzahl) : null),
    [pricing, anzahl],
  );

  async function onCheckout() {
    setBusy(true);
    try {
      const origin = window.location.origin;
      const res = await startCheckout({
        moduleKeys: [],
        successUrl: `${origin}/konto/tarif?abo=ok`,
        cancelUrl: `${origin}/konto/tarif?abo=abbruch`,
        // Die eingestellte Objektzahl mitgeben, sonst rechnet Stripe mit den
        // aktuell angelegten Objekten und zeigt einen anderen Betrag.
        propertyCount: anzahl,
      });
      if (res.ok) window.location.href = res.data.checkout_url;
      else toast.error(res.error);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col gap-6">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1 self-start text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <Icon icon="lucide:chevron-left" className="size-4" />
        Abrechnung
      </button>

      <div className="text-center">
        <h3 className="font-display text-2xl font-extrabold">
          Der Tarif, der mit Ihnen wächst
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">
          Ein Tarif, keine Pakete. Sie zahlen die Grundgebühr plus einen Betrag
          je zusätzlichem Objekt — je mehr Objekte, desto günstiger wird jedes.
        </p>
      </div>

      {error && (
        <p className="rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {!pricing && !error && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Icon icon="svg-spinners:180-ring" className="size-4" />
          Preise werden geladen …
        </div>
      )}

      {pricing && (
        <>
          {/* Objektzahl-Regler */}
          <div className="flex flex-col items-center gap-2">
            <span className="text-sm text-muted-foreground">Objekte</span>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setAnzahl((n) => Math.max(1, n - 1))}
                disabled={anzahl <= 1}
                aria-label="Ein Objekt weniger"
                className="inline-flex size-10 items-center justify-center rounded-full border border-border hover:bg-muted disabled:opacity-40"
              >
                <Icon icon="lucide:minus" className="size-4" />
              </button>
              <input
                type="number"
                min={1}
                max={MAX_OBJEKTE}
                value={anzahl}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (Number.isFinite(n)) {
                    setAnzahl(Math.min(MAX_OBJEKTE, Math.max(1, Math.trunc(n))));
                  }
                }}
                // Native Spinner-Pfeile aus: die Objektzahl wird über die
                // Plus/Minus-Buttons daneben geändert, zwei Bedienelemente
                // fürs selbe wären verwirrend.
                className="w-20 rounded-full border border-border bg-card px-3 py-2 text-center font-display text-lg font-extrabold [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                aria-label="Anzahl Objekte"
              />
              <button
                type="button"
                onClick={() => setAnzahl((n) => Math.min(MAX_OBJEKTE, n + 1))}
                disabled={anzahl >= MAX_OBJEKTE}
                aria-label="Ein Objekt mehr"
                className="inline-flex size-10 items-center justify-center rounded-full border border-border hover:bg-muted disabled:opacity-40"
              >
                <Icon icon="lucide:plus" className="size-4" />
              </button>
            </div>
          </div>

          {/* Preis-Karte */}
          <div className="mx-auto w-full max-w-xl rounded-2xl border border-border bg-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-display text-xl font-extrabold">
                  myNextDays
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Alles inklusive — für {anzahl}{" "}
                  {anzahl === 1 ? "Objekt" : "Objekte"}.
                </p>
              </div>
              {status?.has_subscription && (
                <span className="rounded-full bg-emerald-500/15 px-3 py-0.5 text-xs font-semibold text-emerald-600">
                  Aktuelles Paket
                </span>
              )}
            </div>

            <div className="mt-5 border-t border-border pt-5">
              {monatlich != null ? (
                <div className="flex items-baseline gap-2">
                  <span className="font-display text-4xl font-extrabold">
                    {formatCurrency(monatlich / 100, pricing.currency)}
                  </span>
                  <span className="text-muted-foreground">monatlich</span>
                </div>
              ) : (
                // Unvollständige Staffel → keinen Preis erfinden (Wurzel 4).
                <p className="text-sm text-destructive">
                  Die Preisstaffel ist unvollständig. Bitte den Support
                  kontaktieren.
                </p>
              )}
              <p className="mt-1 text-sm text-muted-foreground">
                zzgl. Provision je nach Buchungskanal
              </p>

              {/* Provision hängt am KANAL, nicht am Paket (payments/service.py
                  _platform_fee_bps). Alle drei Sätze offen ausweisen — die 8 %
                  auf dem Marktplatz zu verschweigen wäre irreführend. */}
              <div className="mt-4 flex flex-col gap-2 rounded-xl bg-muted/50 p-3 text-sm">
                <div className="font-medium">Provision je Buchungskanal</div>
                <KanalZeile
                  kanal="Eigene Website"
                  satz="0 %"
                  hinweis="Ihre Direktbuchungen bleiben provisionsfrei"
                  hervorheben
                />
                <KanalZeile
                  kanal="Booking, Airbnb & Co."
                  satz="1 %"
                  hinweis="ab 101 Objekten 0,5 %"
                />
                <KanalZeile
                  kanal="myNextDays-Marktplatz"
                  satz="8 %"
                  hinweis="nur wenn wir Ihnen den Gast bringen"
                />
              </div>
            </div>

            <div className="mt-5">
              {status?.has_subscription ? (
                <Button disabled className="w-full">
                  Aktuelles Paket
                </Button>
              ) : (
                <Button
                  onClick={onCheckout}
                  disabled={busy || monatlich == null}
                  className="w-full gap-2"
                >
                  {busy && (
                    <Icon icon="svg-spinners:180-ring" className="size-4" />
                  )}
                  Abo abschließen
                </Button>
              )}
            </div>

            <div className="mt-6 border-t border-border pt-5">
              <div className="mb-3 text-sm font-semibold">Was ist enthalten</div>
              <ul className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                {ENTHALTEN.map((f) => (
                  <li key={f.text} className="flex items-center gap-2">
                    <Icon
                      icon={f.icon}
                      className="size-4 shrink-0 text-muted-foreground"
                    />
                    {f.text}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Die KONKRETE Rechnung für die eingestellte Objektzahl — nicht die
              abstrakte Staffel. Bei 5 Objekten sind die Tiers 51–100 und ab 101
              irrelevant und würden nur verwirren. */}
          <div className="mx-auto w-full max-w-xl rounded-2xl border border-border bg-card p-6">
            <div className="mb-3 font-display text-base font-extrabold">
              So setzt sich Ihr Preis zusammen
            </div>
            <dl className="flex flex-col gap-2 text-sm">
              {rechnungsPosten(pricing, anzahl).map((p) => (
                <div key={p.text} className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{p.text}</dt>
                  <dd className="shrink-0 tabular-nums">
                    {formatCurrency(p.cent / 100, pricing.currency)}
                  </dd>
                </div>
              ))}
              {monatlich != null && (
                <div className="mt-1 flex justify-between gap-4 border-t border-border pt-2 font-semibold">
                  <dt>Gesamt monatlich</dt>
                  <dd className="shrink-0 tabular-nums">
                    {formatCurrency(monatlich / 100, pricing.currency)}
                  </dd>
                </div>
              )}
            </dl>

            {/* Die volle Staffel als Kontext — zeigt, dass es ab 51 bzw. 101
                Objekten günstiger wird (das Versprechen der Überschrift). */}
            <details className="mt-4">
              <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                Vollständige Staffel anzeigen
              </summary>
              <ul className="mt-2 flex flex-col gap-1 text-sm text-muted-foreground">
                {staffelZeilen(pricing).map((z) => (
                  <li key={z}>{z}</li>
                ))}
              </ul>
            </details>
          </div>

          <p className="mx-auto max-w-xl text-center text-sm text-muted-foreground">
            Die angegebenen Preise verstehen sich zzgl. der gesetzlichen
            Umsatzsteuer.
          </p>
        </>
      )}
    </div>
  );
}

// Eine Zeile der Kanal-Provisionsübersicht.
function KanalZeile({
  kanal,
  satz,
  hinweis,
  hervorheben = false,
}: {
  kanal: string;
  satz: string;
  hinweis: string;
  hervorheben?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <div className="min-w-0">
        <span className={hervorheben ? "font-medium" : undefined}>{kanal}</span>
        <div className="text-xs text-muted-foreground">{hinweis}</div>
      </div>
      <span
        className={`shrink-0 font-semibold ${
          hervorheben ? "text-emerald-600" : ""
        }`}
      >
        {satz}
      </span>
    </div>
  );
}

// Staffel als Klartext, Beträge aus Stripe.
function staffelZeilen(pricing: Pricing): string[] {
  const cur = pricing.currency;
  const zeilen: string[] = [];
  let prev = 0;
  pricing.grundtarif_tiers.forEach((t) => {
    if (t.flat_amount != null) {
      zeilen.push(
        `Grundgebühr (inkl. 1. Objekt): ${formatCurrency(t.flat_amount / 100, cur)} / Monat`,
      );
    } else if (t.unit_amount != null) {
      const von = prev + 1;
      const spanne = t.up_to != null ? `${von}–${t.up_to}` : `ab ${von}`;
      zeilen.push(
        `Objekt ${spanne}: +${formatCurrency(t.unit_amount / 100, cur)} / Monat`,
      );
    }
    if (t.up_to != null) prev = t.up_to;
  });
  return zeilen;
}

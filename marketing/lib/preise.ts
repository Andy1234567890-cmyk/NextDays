// Die Preisliste für die öffentliche Preisseite — geholt, nicht geschrieben.
//
// WARUM NICHT AUS DEN SPRACHDATEIEN:
// Die Beträge stehen in Stripe (deploy/billing/seed_stripe_prices.py). Sie in
// die 24 messages/*.json zu schreiben hieße, 24 Kopien einer Preisliste zu
// pflegen — beim ersten Preiswechsel stimmt eine davon nicht mehr, und die
// Seite bewirbt einen Preis, den die Abrechnung nicht kennt (Wurzel 4). Der
// Endpunkt `/subscriptions/public/pricing` liefert deshalb dieselben Zahlen,
// die auch der Tarifrechner im Konto zeigt, plus die Provisionskonditionen.
//
// Fehlt die Preisliste (Stripe nicht erreichbar, Preise nicht geseedet), gibt
// diese Datei `null` zurück und die Seite sagt das — sie erfindet keinen Preis.
import { API_BASE } from "@/lib/config";

/** Eine Stufe des graduated Grundtarifs, wie das Backend sie liefert (Cent). */
export type PreisStufe = {
  up_to: number | null;
  flat_amount: number | null;
  unit_amount: number | null;
};

/** Ein buchbares Zusatzmodul mit seinem echten Stripe-Preis. */
export type ModulPreis = {
  module_key: string;
  lookup_key: string;
  /** Monatsbetrag in Cent. 0 bei nutzungsabhängigen Modulen. */
  unit_amount: number;
  /** „Nutzer"/„Zimmer" bei Preisen je Stück, sonst null. */
  per_unit_label: string | null;
  tiers: PreisStufe[] | null;
  /** Prozentsatz vom Umsatz statt Monatsbetrag (Dynamische Preise: 0,5). */
  usage_percent: number | null;
};

export type Preisliste = {
  currency: string;
  grundtarif_tiers: PreisStufe[];
  modules: ModulPreis[];
  /** myBestDays-Marktplatz, all-in (Prozent). */
  commission_marketplace_percent: number;
  /** Externe Portale wie Booking/Airbnb (Prozent). */
  commission_external_percent: number;
  /** Monatsdeckel der Portal-Provision … */
  commission_external_cap_amount: number;
  /** … in dieser Währung (der Deckel ohne Währung wäre sinnlos). */
  commission_external_cap_currency: string;
};

/**
 * Preisliste vom Backend holen. Serverseitig aufzurufen (Server Component):
 * so sieht der Besucher die Preise im ersten Rendern, ohne Wartezustand.
 *
 * `revalidate: 600` deckt sich mit dem TTL-Cache im Backend
 * (`PUBLIC_PRICING_TTL_SEKUNDEN`) — Stripe-Preise sind immutable, sie ändern
 * sich nur, wenn wir einen neuen Preis anlegen.
 */
export async function holePreisliste(): Promise<Preisliste | null> {
  try {
    const res = await fetch(`${API_BASE}/subscriptions/public/pricing`, {
      next: { revalidate: 600 },
    });
    if (!res.ok) return null;
    const daten = (await res.json()) as Preisliste;
    // Ohne Staffel gibt es keinen Preis zu zeigen. Lieber der Hinweis „Preise
    // gerade nicht abrufbar" als eine Zahl, die aus dem Nichts kommt.
    if (!Array.isArray(daten.grundtarif_tiers) || daten.grundtarif_tiers.length === 0) {
      return null;
    }
    return daten;
  } catch {
    return null;
  }
}

/** Modul aus der Liste holen — `undefined`, wenn der Preis fehlt (nicht raten). */
export function modul(liste: Preisliste, lookupKey: string): ModulPreis | undefined {
  return liste.modules.find((m) => m.lookup_key === lookupKey);
}

/** Nutzungsabhängiges Modul (kein Monatsbetrag, sondern ein Prozentsatz). */
export function modulNachKey(
  liste: Preisliste,
  moduleKey: string,
): ModulPreis | undefined {
  return liste.modules.find((m) => m.module_key === moduleKey);
}

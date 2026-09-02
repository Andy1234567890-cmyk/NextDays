// Die Staffel des Partnerprogramms — serverseitig aus der API (0517).
//
// Wie die Preisliste: die Zahl steht in der Datenbank (`affiliate_tiers`), nicht
// in 24 Sprachdateien. Fällt die API aus, zeigt die Seite „gerade nicht
// abrufbar" statt einer geratenen Staffel (Wurzel 4).
import { API_BASE } from "@/lib/config";

export type Rang = {
  id: string;
  name: string;
  min_customers: number;
  max_customers: number | null;
  /** Satz als Faktor („0.15"). */
  rate: string;
  /** Außer Dienst (0525): Team-Provision ist die Differenz der Sätze. Immer "0". */
  override_rate: string;
  /** Superprovision als Faktor („0.025" ab Elite), ohne Laufzeitgrenze (0525). */
  lifetime_rate: string;
  /** Darf dieser Rang Team-Partner führen? */
  team_allowed: boolean;
  /** Einmaliger Aufstiegsbonus beim Erreichen, je Währung. */
  bonus: { amount: string; currency: string }[];
};

export async function holeStaffel(): Promise<Rang[] | null> {
  try {
    const res = await fetch(`${API_BASE}/affiliates/tiers`, { next: { revalidate: 600 } });
    if (!res.ok) return null;
    const daten = (await res.json()) as Rang[];
    return Array.isArray(daten) && daten.length > 0 ? daten : null;
  } catch {
    return null;
  }
}

/** Satz als Prozentzahl ohne Nachkommastellen, wenn glatt („30"). */
export function prozent(rate: string): string {
  const n = Number(rate) * 100;
  if (!Number.isFinite(n)) return rate;
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** Der höchste Satz — für „bis zu {max} %" im Hero. Ohne Staffel „–". */
export function maxSatzProzent(staffel: Rang[] | null): string {
  if (!staffel) return "–";
  return prozent(staffel.reduce((m, r) => (Number(r.rate) > Number(m.rate) ? r : m)).rate);
}

/** Der höchste Superprovisions-Satz der Staffel („2.5"). Ohne Staffel „–". */
export function maxSuperProzent(staffel: Rang[] | null): string {
  if (!staffel) return "–";
  return prozent(
    staffel.reduce((m, r) => (Number(r.lifetime_rate) > Number(m.lifetime_rate) ? r : m)).lifetime_rate,
  );
}

/** Bonus eines Rangs als „50,00 EUR" (erste Währung); leer, wenn keiner. */
export function bonusText(r: Rang): string | null {
  const b = r.bonus?.[0];
  return b ? `${b.amount} ${b.currency}` : null;
}

// Objekt-Staffel des Grundtarifs — genau die Arithmetik, mit der Stripe einen
// `graduated`-Preis abrechnet.
//
// WARUM EIN GETEILTES PAKET:
// Die Staffel wird an zwei Stellen gerechnet — im Tarifrechner des Dashboards
// (`web/components/konto/tarif-rechner.tsx`) und auf der öffentlichen
// Preisseite (`marketing/app/preise`). Zwei Kopien derselben Formel laufen
// zwangsläufig auseinander, und dann zeigt die Marketing-Seite einen anderen
// Preis als das Konto — eine Falschaussage, die niemand als Bug erkennt, weil
// beide Zahlen plausibel aussehen (Wurzel 4).
//
// Die Beträge selbst stehen NICHT hier: sie kommen aus Stripe über
// `GET /subscriptions/pricing` bzw. `/subscriptions/public/pricing`. Dieses
// Paket rechnet nur.

/** Eine Stufe des graduated Preises, wie Stripe sie liefert (Beträge in Cent). */
export type PriceTier = {
  /** Obergrenze der Stufe; `null` = letzte, unbegrenzte Stufe. */
  up_to: number | null;
  /** Einmalbetrag, sobald die Stufe erreicht ist (Grundgebühr). */
  flat_amount?: number | null;
  /** Betrag je Objekt INNERHALB dieser Stufe. */
  unit_amount?: number | null;
};

/**
 * Eine Position der Rechnung. Bewusst OHNE Text: die Beschriftung hängt an der
 * Sprache des Frontends (24 Sprachen), die Arithmetik nicht. Ein Posten mit
 * fertigem deutschen Text wäre in der Marketing-App unbrauchbar.
 */
export type StaffelPosten =
  | {
      art: "grundgebuehr";
      /** Einmalbetrag der ersten Stufe in Cent. */
      cent: number;
    }
  | {
      art: "objekte";
      /** Wie viele Objekte in dieser Stufe liegen. */
      anzahl: number;
      /** Preis je Objekt in dieser Stufe (Cent). */
      jeObjektCent: number;
      /** anzahl × jeObjektCent. */
      cent: number;
    };

/**
 * Die Positionen für `anzahl` Objekte — nur die Stufen, die tatsächlich greifen.
 *
 * Jede Stufe gilt NUR für die Objekte innerhalb ihrer Spanne (das ist der
 * Unterschied zwischen `graduated` und `volume`): `flat_amount` fällt einmal
 * an, sobald die Stufe erreicht ist, `unit_amount` je Objekt in dieser Spanne.
 * Bei 5 Objekten entsteht also keine Zeile für „51–100", die den Kunden nichts
 * angeht.
 */
export function staffelPosten(
  tiers: readonly PriceTier[],
  anzahl: number,
): StaffelPosten[] {
  const posten: StaffelPosten[] = [];
  let untergrenze = 0; // bereits abgedeckte Objekte
  for (const t of tiers) {
    if (untergrenze >= anzahl) break;
    const obergrenze = t.up_to ?? anzahl;
    const inDiesemTier = Math.min(anzahl, obergrenze) - untergrenze;
    if (inDiesemTier > 0) {
      if (t.flat_amount != null) {
        posten.push({ art: "grundgebuehr", cent: t.flat_amount });
      }
      if (t.unit_amount != null) {
        posten.push({
          art: "objekte",
          anzahl: inDiesemTier,
          jeObjektCent: t.unit_amount,
          cent: t.unit_amount * inDiesemTier,
        });
      }
    }
    if (t.up_to == null) break;
    untergrenze = t.up_to;
  }
  return posten;
}

/**
 * Monatspreis für `anzahl` Objekte in Cent — oder `null`, wenn keine Staffel
 * vorliegt. Kein Ersatzpreis: eine leere Staffel bedeutet, dass die Preisliste
 * nicht gelesen werden konnte, und dann darf keine Zahl erscheinen (Wurzel 4).
 *
 * Summiert genau `staffelPosten`, damit Aufschlüsselung und Endbetrag nicht
 * auseinanderlaufen können.
 */
export function staffelPreisCent(
  tiers: readonly PriceTier[],
  anzahl: number,
): number | null {
  if (tiers.length === 0) return null;
  return staffelPosten(tiers, anzahl).reduce((s, p) => s + p.cent, 0);
}

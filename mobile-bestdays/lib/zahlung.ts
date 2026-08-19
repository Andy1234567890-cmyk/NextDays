// Zahlung im PaymentSheet von Stripe (nativ).
//
// WARUM ÜBERHAUPT: Bis 19.08.2026 legte die App eine Buchung an und meldete
// „Buchung bestätigt" — bezahlt wurde nie. Seit Migration 0409 antwortet der
// Server auf eine Sofortbuchung mit `zahlung_erforderlich=true` und legt KEINE
// Buchung an, sondern eine Buchungsabsicht plus PaymentIntent. Erst der
// bestätigte Zahlungseingang macht daraus eine Reservierung.
//
// VERBUNDKONTEN (8 %): Eine Marktplatz-Buchung läuft NICHT als Direct Charge im
// Konto des Betriebs, sondern über UNSER Stripe-Konto — `_traegt_haftung` ist
// für `channel='portal'` wahr (payments/service.py), der Intent entsteht also
// mit `on_behalf_of` auf das Betriebskonto und unserer Provision als
// `application_fee_amount`. Deshalb wird hier KEIN `stripeAccountId` gesetzt:
// der Intent liegt im Plattformkonto, und mit gesetztem Konto-Header würde
// Stripe mit „No such payment_intent" antworten. Das Feld `stripe_account` aus
// der Server-Antwort gilt nur für den PMS-Kanal (Direct Charge) — die
// Web-Strecke macht es genauso (`loadStripe(pk)` ohne `stripeAccount`).
//
// Der Publishable Key kommt AUS DER SERVER-ANTWORT, nicht aus `lib/config.ts`:
// so kann er nie zum Intent unpassend sein (Test-Key gegen Live-Intent), und
// die App trägt keinen Schlüssel mit sich herum (Wurzel 4).
import {
  initPaymentSheet,
  initStripe,
  presentPaymentSheet,
} from "@stripe/stripe-react-native";

import { marke } from "@/theme/marke";

// Rückweg in die App, wenn 3-D Secure oder eine Bank-App den Gast hinausführt.
// MUSS zu einem registrierten URL-Schema passen (Info.plist bzw. AndroidManifest);
// `mybestdays://` ist das Schema dieser App.
const RUECKWEG = "mybestdays://stripe-redirect";
const SCHEMA = "mybestdays";

export type ZahlungErgebnis =
  | { art: "bezahlt" }
  | { art: "abgebrochen" }
  | { art: "fehler"; meldung: string };

/**
 * Zahlt eine Buchungsabsicht mit dem PaymentSheet.
 *
 * `bezahlt` heißt: Stripe hat die Zahlung angenommen. Die BUCHUNG entsteht
 * daraufhin serverseitig über den Stripe-Webhook (`absicht.einloesen`) — nicht
 * hier. Die Oberfläche darf deshalb erst dann „bestätigt" sagen, wenn sie die
 * Buchung wirklich sieht (Stripe empfiehlt genau das: nie auf den Client-Callback
 * allein bauen).
 */
export async function zahleBuchung(input: {
  clientSecret: string;
  publishableKey: string;
  name?: string | null;
  email?: string | null;
}): Promise<ZahlungErgebnis> {
  try {
    await initStripe({
      publishableKey: input.publishableKey,
      urlScheme: SCHEMA,
      // Kein merchantIdentifier: Apple Pay ist (noch) nicht eingerichtet. Ein
      // gesetzter, aber nicht registrierter Identifier bringt eine Apple-Pay-
      // Schaltfläche, die beim Tippen scheitert.
    });
    const vorbereitet = await initPaymentSheet({
      merchantDisplayName: marke.name,
      paymentIntentClientSecret: input.clientSecret,
      returnURL: RUECKWEG,
      // FALSE mit Absicht: verzögerte Methoden (SEPA-Lastschrift & Co.) sind
      // beim Schließen des Sheets noch nicht endgültig. Eine Buchung, deren
      // Zahlung erst Tage später gelingt oder scheitert, würde Nächte
      // blockieren — genau das verhindert 0409.
      allowsDelayedPaymentMethods: false,
      defaultBillingDetails: {
        name: input.name ?? undefined,
        email: input.email ?? undefined,
      },
    });
    if (vorbereitet.error) {
      return { art: "fehler", meldung: vorbereitet.error.message };
    }
    const ergebnis = await presentPaymentSheet();
    if (ergebnis.error) {
      // „Canceled" ist kein Fehler: der Gast hat das Sheet zugemacht. Als Fehler
      // gemeldet, sähe jeder Abbruch nach einer kaputten Zahlung aus.
      if (ergebnis.error.code === "Canceled") return { art: "abgebrochen" };
      return { art: "fehler", meldung: ergebnis.error.message };
    }
    return { art: "bezahlt" };
  } catch (exc) {
    // Native Fehler (Modul nicht gelinkt, kein Netz) kommen als Exception. Sie
    // dürfen nicht als „bezahlt" durchgehen (fail-closed, Wurzel 5).
    return {
      art: "fehler",
      meldung: exc instanceof Error ? exc.message : "Zahlung fehlgeschlagen.",
    };
  }
}

// Vermieterdaten aus den persoenlichen Informationen ergaenzen.
//
// Es sind ZWEI Datensaetze: die persoenlichen Informationen des Kontos und die
// Vermieterdaten des Betriebs, aus denen das Auszahlungskonto entsteht. Fuer
// einen PRIVATEN Vermieter beschreiben beide dieselbe natuerliche Person —
// dieselbe Anschrift, dieselbe Telefonnummer, dieselbe E-Mail-Adresse. Wer sie
// oben eingetragen hat, sah sie unten trotzdem als „Nicht angegeben" und haette
// sie ein zweites Mal tippen muessen.
//
// Das ist KEIN erfundener Ersatzwert (Wurzel 4): geliehen wird ausschliesslich,
// was derselbe Nutzer selbst hinterlegt hat, und nur dort, wo das Feld der
// Vermieterdaten leer ist. Ein eingetragener Wert wird nie ueberschrieben.
//
// GEWERBLICH gilt das NICHT: die Geschaeftsanschrift einer Firma ist nicht die
// Wohnanschrift ihres Geschaeftsfuehrers, und Stripe prueft sie gegen das
// Register. Dort bleibt jedes Feld leer, bis es jemand fuellt.
//
// Eine Stelle fuer beide Verwender: der Vermieterdaten-Reiter (Anzeige und
// Speichern) und das Bankformular, das beim Anlegen des Auszahlungskontos
// denselben Stand sendet. Zwei Kopien waeren zwei Gelegenheiten, verschieden zu
// ergaenzen.
import type { Account } from "./konto";
import type { Unternehmensprofil } from "./unternehmen";

/** Privat oder gewerblich — der Backend-Standard ist `individual`. */
export function istPrivat(profil: Unternehmensprofil): boolean {
  return profil.accountType !== "company";
}

export function ausKontoErgaenzen(
  profil: Unternehmensprofil,
  account: Account | null,
): Unternehmensprofil {
  if (!account || !istPrivat(profil)) return profil;
  const oder = (wert: string, ersatz: string | null | undefined): string =>
    wert || ersatz || "";
  return {
    ...profil,
    companyStreet: oder(profil.companyStreet, account.residential_street),
    companyPostalCode: oder(
      profil.companyPostalCode,
      account.residential_postal_code,
    ),
    companyCity: oder(profil.companyCity, account.residential_city),
    // Wohnsitzland zuerst; das Land des Betriebs ist die zweite Quelle, weil es
    // bei der Registrierung gesetzt wurde und nicht vom Nutzer stammt.
    companyCountry: oder(
      profil.companyCountry,
      account.residential_country ?? account.tenant_country,
    ),
    phoneNumber: oder(profil.phoneNumber, account.phone),
    email: oder(profil.email, account.email),
  };
}

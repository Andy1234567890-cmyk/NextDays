// Einstellungen → Kontakt & Social.
//
// Die Kontaktdaten kommen aus dem FIRMENPROFIL (Konto → Profil) und werden hier
// nur angezeigt. Es gibt bewusst kein zweites Formular dafür: sonst pflegt der
// Betrieb seine Adresse an zwei Stellen und eine davon veraltet still.
import { RealtimeRefresh } from "@/components/realtime-refresh";
import { KontaktLeiste } from "@/components/website/einstellungen/kontakt-leiste";
import { getFirmenProfil } from "@/lib/firmenprofil";

import { ladeBaukasten } from "../../daten";

/** Ein Wert aus dem Firmenprofil, oder `null`. Leerstrings werden zu `null`:
 *  „" " ist keine Angabe, und die Anzeige soll „nicht gesetzt" sagen statt eine
 *  leere Zeile zu zeigen. */
function feld(profil: Record<string, unknown>, ...schluessel: string[]) {
  for (const k of schluessel) {
    const v = profil[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

/** Straße + Hausnummer + PLZ + Ort in eine Zeile. Nur aus den Teilen, die es
 *  gibt — kein „, ," bei fehlender Hausnummer. */
function anschrift(profil: Record<string, unknown>): string | null {
  const strasse = [
    feld(profil, "company_street", "companyStreet"),
    feld(profil, "company_house_number", "companyHouseNumber"),
  ]
    .filter(Boolean)
    .join(" ");
  const ort = [
    feld(profil, "company_postal_code", "companyPostalCode"),
    feld(profil, "company_city", "companyCity"),
  ]
    .filter(Boolean)
    .join(" ");
  const teile = [strasse, ort].filter(Boolean);
  return teile.length > 0 ? teile.join(", ") : null;
}

export default async function KontaktSeite() {
  const [{ branding }, profilRes] = await Promise.all([
    ladeBaukasten(),
    getFirmenProfil(),
  ]);
  // Kein Profil (403/404) heißt: keine Firmendaten anzeigen. Nicht: erfundene
  // Platzhalter (Wurzel 4).
  const profil = profilRes.ok ? profilRes.data : {};

  return (
    <>
      <RealtimeRefresh tables={["tenant_site_config"]} />
      <KontaktLeiste
        branding={branding}
        firma={{
          name: feld(profil, "company_name", "companyName", "legal_name"),
          anschrift: anschrift(profil),
          email: feld(profil, "email"),
          telefon: feld(profil, "phone_number", "phoneNumber"),
          logoUrl: feld(profil, "company_logo_url", "companyLogoUrl"),
        }}
      />
    </>
  );
}

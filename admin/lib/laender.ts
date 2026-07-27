// Ländernamen für die Oberfläche — ISO-3166-1 alpha-2 bleibt der Datenwert.
//
// Gespeichert und übertragen wird AUSSCHLIESSLICH der ISO-Code („DE", „NZ");
// der ausgeschriebene Name entsteht erst beim Rendern.
//
// Warum keine gepflegte Namensliste: Die Länder kommen aus `tax_country_rules`
// in der DB. Eine zweite Liste im Frontend lief zwangsläufig auseinander — sie
// hatte 26 Einträge, die DB 42, und für die Differenz erschien in der Prüfsicht
// das rohe Kürzel („AU", „CR", „SG"). `Intl.DisplayNames` kennt jeden gültigen
// ISO-Code und kann deshalb nicht unvollständig sein.

const SPRACHE = "de";

const ANZEIGE = new Intl.DisplayNames([SPRACHE], {
  type: "region",
  // Unbekannte Codes liefern den Code zurück statt zu werfen — ein erfundener
  // Name wäre in einer Prüfsicht schlimmer als das Kürzel (Wurzel 4).
  fallback: "code",
});

/** Ländername zum ISO-Code. Unbekannte Codes kommen unverändert zurück. */
export function landName(code: string): string {
  const iso = code.trim().toUpperCase();
  if (iso.length !== 2) return iso;
  try {
    return ANZEIGE.of(iso) ?? iso;
  } catch {
    return iso;
  }
}

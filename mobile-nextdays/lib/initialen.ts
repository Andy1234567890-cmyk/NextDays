// Initialen für Avatare — EINE Stelle für alle Kopfzeilen.
//
// WOFÜR: Wo kein Profilbild hinterlegt ist, stand ein anonymes Personen-Symbol.
// Das sieht aus wie ein Bild, das nicht geladen hat — genau so wurde es
// gemeldet („Logo wird nicht angezeigt"). Initialen sagen dagegen „hier ist kein
// Bild", ohne einen Fehler vorzutäuschen.
//
// Reihenfolge der Quellen: Anzeigename (zwei Buchstaben), sonst E-Mail (einer).
// NIE ein Platzhalter-Buchstabe wie „U" für User — das wäre eine Erfindung.

export function initialenAus(
  name: string | null | undefined,
  email: string | null | undefined,
): string | undefined {
  const quelle = (name ?? "").trim();
  if (quelle) {
    const teile = quelle.split(/\s+/).filter(Boolean);
    const erste = teile[0]?.[0] ?? "";
    const zweite = teile.length > 1 ? (teile[teile.length - 1]?.[0] ?? "") : "";
    const kurz = (erste + zweite).toUpperCase();
    if (kurz) return kurz;
  }
  const mail = (email ?? "").trim();
  return mail ? mail.slice(0, 1).toUpperCase() : undefined;
}

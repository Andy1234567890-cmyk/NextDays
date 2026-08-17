// Ziel der „myBestDays für Gastgeber"-Einstiege auf dem Gäste-Marktplatz.
//
// EINE Quelle der Wahrheit: der Wert stand vorher dreifach kopiert in
// plattform-nav.tsx, site-header.tsx und konto-button.tsx — jeweils mit dem
// Fallback `https://mynextdays.com`. Das war doppelt falsch:
//   1. Marke: myNextDays ist das PMS (Betrieb zahlt Abo + Provision), myBestDays
//      ist der Marktplatz. Ein Marktplatz-Gastgeber gehört zu myBestDays
//      (gastgeber/, ADR-0015) — nie auf die myNextDays-Seite.
//   2. Ziel: der Button soll zur REGISTRIERUNG führen, nicht auf eine Startseite.
//      In gastgeber/ ist `/anmelden` Login UND Registrierung (auth-form.tsx).
//
// Die Domain kommt aus NEXT_PUBLIC_GASTGEBER_URL (pro Umgebung gesetzt). Fehlt
// sie, wird KEINE Domain geraten (Wurzel 4) — dann bleibt der relative Pfad, der
// im Reverse-Proxy-Setup auf dieselbe Origin zeigt und sichtbar ins Leere läuft,
// statt still auf der falschen Marke zu landen.

/** Registrierungs-/Login-Pfad im Gastgeber-Frontend (myBestDays für Gastgeber). */
const REGISTRIERUNG_PFAD = "/anmelden";

/** Absolute URL zur myBestDays-Gastgeber-Registrierung. */
export function gastgeberRegistrierungUrl(): string {
  const basis = (process.env.NEXT_PUBLIC_GASTGEBER_URL ?? "").trim();
  if (!basis) return REGISTRIERUNG_PFAD;
  return `${basis.replace(/\/+$/, "")}${REGISTRIERUNG_PFAD}`;
}

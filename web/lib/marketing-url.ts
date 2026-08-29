// Adressen, die auf die MARKETING-App zeigen — nicht auf dieses Dashboard.
//
// Warum es dieses Modul gibt: Das Hilfe-Center lag bis eben in dieser App
// (`app/(public)/hilfe`) und war damit über einen relativen Link erreichbar.
// Es ist umgezogen in die Marketing-App, weil es öffentlich sein MUSS — auf
// `app.mynextdays.com` fanden es nur angemeldete Nutzer, obwohl es nie einen
// Login verlangte. Damit sind die Hilfe-Links aus dem Dashboard heraus
// app-fremd und brauchen eine absolute URL.
//
// Die Alternative wäre gewesen, `https://mynextdays.com/hilfe` an neun Stellen
// einzutippen. Genau daran scheitert später der Domainwechsel: eine der neun
// wird vergessen und zeigt still ins Leere. Deshalb EINE Quelle.

// Basis der Marketing-App. Denselben Namen benutzt `components/demo-band.tsx`
// bereits für den Voranmelde-Anker — hier zentral, damit es nicht zwei
// Wahrheiten gibt.
//
// Der Vorgabewert ist die echte Produktionsdomain und KEIN Platzhalter: die
// Marketing-Seite ist öffentlich erreichbar, anders als das Dashboard. Ein
// leerer Wert würde hier zu `href="/hilfe"` führen — einem 404 in dieser App,
// seit die Route dort weg ist (Wurzel 4: kein Ersatzwert, der plausibel aussieht
// und ins Nichts zeigt).
const MARKETING_BASIS = (
  process.env.NEXT_PUBLIC_MARKETING_URL ?? "https://mynextdays.com"
).replace(/\/$/, "");

/** Startseite des Hilfe-Centers. */
export const HILFE_URL = `${MARKETING_BASIS}/hilfe`;

/**
 * Ein einzelner Hilfe-Pfad, z. B. `hilfeUrl("konto-abo")` oder
 * `hilfeUrl("preise-raten/dynamische-preise")`.
 *
 * Nimmt den Pfad OHNE führenden Schrägstrich, verträgt ihn aber — sonst
 * entstünde bei einem Aufrufer mit `/` ein doppelter Schrägstrich, der auf
 * manchen Proxys eine andere Route trifft als gemeint.
 */
export function hilfeUrl(pfad: string): string {
  return `${HILFE_URL}/${pfad.replace(/^\//, "")}`;
}

/**
 * Entwickler-Dokumentation der öffentlichen API.
 *
 * Liegt in der Marketing-App (`/entwickler`) und nicht im Dashboard: sie ist
 * für Entwickler gedacht, die noch keinen Zugang haben, und muss ohne Login
 * lesbar sein. Die interaktive Referenz liegt noch einmal woanders — beim
 * API-Dienst selbst (open-api.mynextdays.com/docs); die Seite hier verlinkt sie.
 */
export const ENTWICKLER_URL = `${MARKETING_BASIS}/entwickler`;

/** Anker der Voranmeldung auf der Marketing-Startseite. */
export const VORANMELDUNG_URL = `${MARKETING_BASIS}/#voranmeldung`;

/** Startseite der Marketing-App. */
export const MARKETING_START = MARKETING_BASIS || "/";

/**
 * Die Rechtsdokumente. Bis auf die AGB liegen sie AUSSCHLIESSLICH in der
 * Marketing-App — diese App hat nur `content/legal/agb`. Ein relativer Link
 * auf `/datenschutz` waere hier also ein 404.
 *
 * Die AGB stehen bewusst als eigene Route dieser App (`/agb`): Registrierung
 * und Zahlungs-Freischaltung verlinken sie mitten aus einem Formular heraus,
 * und ein Sprung auf eine fremde Domain waere dort ein Abbruch des Vorgangs.
 */
export const RECHTS_LINKS = [
  { label: "AGB", href: "/agb" },
  { label: "Datenschutz", href: `${MARKETING_BASIS}/datenschutz` },
  { label: "Impressum", href: `${MARKETING_BASIS}/impressum` },
  { label: "Cookie-Richtlinie", href: `${MARKETING_BASIS}/cookie-richtlinie` },
  {
    label: "Auftragsverarbeitung",
    href: `${MARKETING_BASIS}/auftragsverarbeitung`,
  },
] as const;

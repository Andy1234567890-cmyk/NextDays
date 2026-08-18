// Ziele der Handlungsaufrufe („Anmelden", „Kostenlos starten", AGB, Hilfe).
//
// VOR DEM START verlässt KEIN Link diese Marketing-Seite Richtung Dashboard.
// Die Plattform ist bis zum 1. September 2026 nicht öffentlich; ein Besucher,
// der im Login-Formular landet, kann sich weder anmelden noch registrieren.
// Deshalb sind die Knöpfe keine echten Links, sondern Auslöser für das
// Voranmelde-Popup (`components/voranmeldung-popup.tsx`).
//
// Umgesetzt über ein reines Marker-Ziel statt einer App-URL: Das Popup
// erkennt Klicks an diesem Marker, nicht an einer Domain. Damit hängt das
// Verhalten NICHT mehr an `NEXT_PUBLIC_LOGIN_URL` — früher wäre beim
// Domain-Wechsel die Erkennung stillschweigend kaputtgegangen und die Knöpfe
// hätten Besucher ungewollt ins Dashboard geschickt.
//
// ZUM START: `VOR_DEM_START` in `voranmeldung-popup.tsx` auf `false` setzen und
// unten `DASHBOARD_URL` befüllen (bzw. `NEXT_PUBLIC_APP_URL` in Coolify setzen).
// Dann führen dieselben Knöpfe wieder in die App — ohne dass ein einziger
// Marketing-Baustein angefasst werden muss.

/**
 * Marker-Ziel der Voranmelde-Knöpfe.
 *
 * Bewusst KEINE echte URL: `#voranmeldung` bleibt auf der Seite, auch wenn das
 * JavaScript noch nicht geladen ist oder scheitert. Ein Besucher landet damit
 * im schlimmsten Fall nirgendwo — statt in einem Login, das er nicht benutzen
 * kann.
 */
export const VORANMELDUNG_ZIEL = "#voranmeldung";

/**
 * Basis-URL des Dashboards. Leer, solange die Plattform nicht öffentlich ist.
 * Wird erst zum Start gesetzt (Env `NEXT_PUBLIC_APP_URL`, z. B.
 * `https://app.mynextdays.com`).
 */
export const DASHBOARD_URL = process.env.NEXT_PUBLIC_APP_URL ?? "";

/** Führen die Knöpfe schon in die App? Nur wenn eine Dashboard-URL gesetzt ist. */
export const APP_ERREICHBAR = DASHBOARD_URL !== "";

export const LOGIN_URL = APP_ERREICHBAR
  ? `${DASHBOARD_URL}/login`
  : VORANMELDUNG_ZIEL;

export const SIGNUP_URL = APP_ERREICHBAR
  ? `${DASHBOARD_URL}/signup`
  : VORANMELDUNG_ZIEL;

/**
 * Route der AGB — eine eigene Seite IN dieser App (`app/agb`).
 *
 * Früher ein absoluter Link ins Dashboard, der vor dem Start auf "" fiel. Das
 * war an drei Stellen ein kaputter Link (`[AGB]()` in Datenschutz und AVV,
 * leeres href im Impressum) und im Google-OAuth-Zustimmungsbildschirm ein 404
 * auf der geprüften Adresse `mynextdays.com/agb`. Die AGB liegen deshalb jetzt
 * hier — unabhängig davon, ob das Dashboard schon öffentlich ist.
 */
export const AGB_URL = "/agb";

// Das Hilfe-Center liegt weiter in der web-App. Vor dem Start gibt es dorthin
// keinen öffentlichen Zugang — der Link entfällt dann (siehe Footer, der leere
// Ziele auslässt, statt auf eine tote Adresse zu zeigen).
export const HILFE_URL = APP_ERREICHBAR ? `${DASHBOARD_URL}/hilfe` : "";

/**
 * Ziel des Knopfs „Demo ansehen" (0407).
 *
 * Führt in die ECHTE Anwendung, angemeldet im Vorführ-Mandanten — kein
 * eingefrorener Schnappschuss, wie ihn Storylane & Co. ausliefern (Vergleich
 * in `docs/ANALYSE-storylane-technik.md`). Der Zugang kann ausschließlich
 * lesen; jede schreibende Anfrage wird serverseitig abgelehnt (`demo_gate`).
 *
 * Vor dem Start dasselbe Verhalten wie alle anderen Knöpfe: Voranmelde-Popup
 * statt eines Ziels, das der Besucher nicht benutzen kann. Der Grund ist hier
 * derselbe wie bei LOGIN_URL — nur die Begründung ist eine andere: die
 * Vorführung FUNKTIONIERT technisch schon, aber sie zeigt einen Betrieb mit
 * erfundenen Buchungen. Vor dem offiziellen Start ist das eher verwirrend als
 * überzeugend.
 *
 * Zum Start: `NEXT_PUBLIC_APP_URL` setzen — dann führt der Knopf in die Demo,
 * ohne dass hier etwas geändert werden muss.
 */
export const DEMO_URL = APP_ERREICHBAR
  ? `${DASHBOARD_URL}/demo`
  : VORANMELDUNG_ZIEL;

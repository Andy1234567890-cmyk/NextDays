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

// AGB und Hilfe-Center liegen in der web-App. Vor dem Start gibt es dorthin
// keinen öffentlichen Zugang — die Links entfallen dann (siehe Footer, der
// leere Ziele auslässt, statt auf eine tote Adresse zu zeigen).
export const AGB_URL = APP_ERREICHBAR ? `${DASHBOARD_URL}/agb` : "";
export const HILFE_URL = APP_ERREICHBAR ? `${DASHBOARD_URL}/hilfe` : "";

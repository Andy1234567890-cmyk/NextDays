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
 *
 * FOLGE FÜR DIE MESSUNG: vor dem Start tragen `LOGIN_URL`, `SIGNUP_URL` und
 * `DEMO_URL` alle DIESEN Wert — am `href` ist also nicht erkennbar, welcher
 * Knopf gedrückt wurde. Deshalb trägt jeder dieser Links zusätzlich ein
 * `data-cta="login" | "signup" | "demo"`; der Klick-Abfang in
 * `components/voranmeldung-popup.tsx` liest es als GA4-Parameter `ziel`. Wer
 * hier einen vierten Knopf ergänzt, setzt das Attribut mit.
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

// Das Hilfe-Center ist KEINE App-URL mehr: es liegt seit dem Umzug in dieser
// App unter `/hilfe` und wird als normaler interner Link angesprochen. Die
// frühere Konstante hing an `NEXT_PUBLIC_APP_URL` und war damit an die Frage
// gekoppelt, ob sich jemand registrieren kann — mit der Folge, dass das
// fertige, 24-sprachige Hilfe-Center aus dem Footer auf "#" zeigte. Wer hier
// eine `HILFE_URL` sucht: es gibt keine, der Pfad steht direkt im Footer und
// in `components/kontakt/kontakt-wege.tsx`.

/**
 * Basis-URL der Vorführung — EIGENE Variable, nicht `NEXT_PUBLIC_APP_URL`.
 *
 * Warum getrennt: `NEXT_PUBLIC_APP_URL` schaltet ALLE Knöpfe ins Dashboard
 * („Anmelden", „Kostenlos starten"). Das ist die Start-Entscheidung der
 * Plattform und hat mit der Vorführung nichts zu tun — die kann man zeigen,
 * lange bevor sich jemand registrieren darf. Mit einer eigenen Variablen ist
 * die Demo einzeln schaltbar, ohne den Start vorzuziehen.
 *
 * Fällt auf `NEXT_PUBLIC_APP_URL` zurück, wenn gesetzt: nach dem Start braucht
 * es keine zweite Variable mehr, und eine vergessene wäre ein toter Knopf.
 */
export const DEMO_BASIS = (
  process.env.NEXT_PUBLIC_DEMO_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  ""
).replace(/\/$/, "");

/**
 * Ziel des Knopfs „Demo ansehen" (0407).
 *
 * Führt in die ECHTE Anwendung, angemeldet im Vorführ-Mandanten — kein
 * eingefrorener Schnappschuss, wie ihn Storylane & Co. ausliefern (Vergleich
 * in `docs/ANALYSE-storylane-technik.md`). Der Zugang kann ausschließlich
 * lesen; jede schreibende Anfrage wird serverseitig abgelehnt (`demo_gate`).
 *
 * Ohne gesetzte `DEMO_BASIS` fällt der Knopf auf das Voranmelde-Popup zurück —
 * dasselbe Verhalten wie bei allen anderen, damit kein Besucher auf einer
 * Adresse landet, die er nicht benutzen kann.
 */
export const DEMO_URL = DEMO_BASIS ? `${DEMO_BASIS}/demo` : VORANMELDUNG_ZIEL;

/**
 * Öffentliche Statusseite (Uptime Kuma).
 *
 * Ersetzt im Footer den Platzhalter „Webinare", der auf `#` zeigte — also ein
 * Link war, der nichts tat. Ein Statuslink ist an dieser Stelle das, was
 * Besucher bei einer Betriebssoftware wirklich suchen: läuft es gerade.
 *
 * KEIN Fallback auf die interne Coolify-Adresse (`*.sslip.io`). Die wäre
 * schlechter als kein Link: sie nennt die Server-IP im Klartext, trägt ein
 * Zertifikat auf einen Fremd-Hostnamen und ändert sich beim nächsten Deploy.
 * Ist die Variable leer, entfällt der Eintrag (Wurzel 4 — kein erfundener
 * Ersatzwert; der Footer lässt leere Ziele bereits aus).
 *
 * Gesetzt wird sie in Coolify als `NEXT_PUBLIC_STATUS_URL` auf
 * `https://status.mynextdays.com`, sobald der DNS-Eintrag steht und Coolify
 * ein Zertifikat dafür ausgestellt hat. Anleitung samt Reihenfolge:
 * `docs/STATUSSEITE.md`.
 *
 * Bis dahin bleibt sie leer und der Footer-Eintrag entfällt — bewusst, denn
 * ein Link auf eine Domain ohne DNS ist ein Fehler, den der Besucher uns
 * zuschreibt.
 */
export const STATUS_URL = (process.env.NEXT_PUBLIC_STATUS_URL ?? "").replace(
  /\/$/,
  "",
);

/**
 * Adresse, die der SERVER abfragt — getrennt von `STATUS_URL`.
 *
 * Zwei Variablen, weil es zwei verschiedene Dinge sind: `STATUS_URL` ist der
 * Link, den ein Besucher anklickt (muss öffentlich und hübsch sein),
 * `STATUS_BASIS` ist die Adresse, unter der unser eigener Server Kuma
 * erreicht. Die darf die interne Coolify-Adresse sein, denn sie erscheint
 * nirgends im Browser — die Route in `app/api/status` gibt nur die verdichtete
 * Lage heraus, nie die Kuma-Antwort.
 *
 * Praktischer Nutzen der Trennung: der Statuspunkt funktioniert schon, bevor
 * `status.mynextdays.com` im DNS steht. Fällt `STATUS_SERVER_URL` weg, greift
 * `NEXT_PUBLIC_STATUS_URL` — nach dem Umzug braucht es keine zweite Variable.
 *
 * KEIN eingebauter Standardwert: eine hier hartcodierte `sslip.io`-Adresse
 * würde beim nächsten Coolify-Deploy still ins Leere zeigen (Wurzel 4).
 */
export const STATUS_BASIS = (
  process.env.STATUS_SERVER_URL ??
  process.env.NEXT_PUBLIC_STATUS_URL ??
  ""
).replace(/\/$/, "");

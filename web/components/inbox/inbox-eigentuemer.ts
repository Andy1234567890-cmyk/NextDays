// Eigentümer-Chat im Web-Posteingang (0611, ADR-0029).
//
// DIE GRENZE, um die es hier geht — und sie ist gewollt: Das Web kann diese
// Nachrichten NICHT lesen. Der private Schlüssel liegt in der Keychain bzw. im
// Android Keystore des Telefons; im Browser gibt es dafür keinen
// gleichwertigen Ort. Ihn in `localStorage` oder IndexedDB zu legen wäre genau
// die Hintertür, die ADR-0029 ausschließt: ein Schlüssel, den eine Webseite
// hält, ist ein Schlüssel, den ein XSS holt.
//
// Was der Posteingang deshalb tut: Er ZEIGT den Thread (die Agentur muss
// sehen, dass eine Eigentümerfrage offen ist), aber statt des Verlaufs steht
// dort der Grund und der Weg — die mobile App. Was er NICHT tut: Chiffretext
// anzeigen, eine leere Liste zeigen oder den Thread verschweigen. Alle drei
// sähen aus wie ein kaputter oder leerer Chat (Wurzel 5).
//
// Sollte das Web den Chat später lesen können, ist der Weg NICHT ein Schlüssel
// im Browser, sondern WebAuthn/Passkeys mit hardwaregebundenem Schlüssel —
// eigener Umbau, eigene Entscheidung.

/** Stabiler Präfix des Servers (`inbox/eigentuemer.py`). */
export const EIGENTUEMER_PREFIX = "eig:";

export function istEigentuemerThread(threadId: string): boolean {
  return threadId.startsWith(EIGENTUEMER_PREFIX);
}

/**
 * Hat dieser Thread eine Zeile in `channex_booking`?
 *
 * Nur solche Threads kennen die Flag-, Archiv- und Zuweisungs-Endpunkte des
 * inbox-Slice. Alle Nebenquellen (`eig:`, `ue:`, WhatsApp) haben dort keine
 * Zeile — ein Aufruf läuft in einen 404, und weil das Ergebnis in der
 * Oberfläche per `void` verworfen wird, bleibt der Fehler STUMM: der Thread
 * wird nie als gelesen markiert und zählt dauerhaft im Ungelesen-Zähler mit.
 *
 * EINE Stelle für diese Frage, statt an jedem Aufruf eine eigene Liste von
 * Präfixen — sonst kennt die eine Stelle `eig:` und die nächste nicht.
 */
export function hatBuchungszeile(threadId: string): boolean {
  return !NEBENQUELLEN_PREFIXE.some((p) => threadId.startsWith(p));
}

/**
 * Kann dieser Thread einen KI-Antwortvorschlag bekommen?
 *
 * Nicht dasselbe wie `hatBuchungszeile`, und genau darum eine eigene Funktion:
 * Der Eigentümer-Chat hat keine Buchungszeile, bekommt aber seit 0708 einen
 * eigenen Vorschlag — aus Objekt, offenen Aufgaben und Belegung statt aus
 * Buchung und Gästemappe (`inbox/ki_eigentuemer.py`).
 *
 * Für Anfragen, Marktplatz, Übernahmen und WhatsApp gibt es serverseitig
 * keinen Vorschlagsweg; dort lief der Knopf bis zum 15.09.2026 in den 404
 * „Konversation nicht gefunden" und gab ihn als Ergebnis aus.
 */
export function kannKiVorschlag(threadId: string): boolean {
  return hatBuchungszeile(threadId) || istEigentuemerThread(threadId);
}

/**
 * Die Präfixe des Servers (`inbox/service.py:_NEBENQUELLEN_PRAEFIXE`).
 *
 * Handkopie — es gibt kein Prüfskript, das beide Listen deckungsgleich hält.
 * Eine vergessene sechste Nebenquelle führt hier zu einem stummen 404: Der
 * Thread gilt für immer als ungelesen, und niemand erfährt den Grund.
 *
 * `wa-neu:` stand hier zuerst und existiert nicht — der echte Präfix des
 * neuen WhatsApp-Fadens ist `wa:new:`, und den deckt `wa:` bereits ab.
 */
const NEBENQUELLEN_PREFIXE = ["anfrage:", "eig:", "mb:", "ue:", "wa:"];

// Schranke fuer Ziele, die aus einer BENACHRICHTIGUNG heraus geoeffnet werden.
//
// WARUM ES DAS GIBT (live 24.08.2026): Der Link „neue Aufgabe" aus einer Mail
// landete in der Vorfuehrung. Ursache war keine Luecke in der Aufgaben-Seite,
// sondern eine Eigenschaft der Sitzung: die Demo legt ihr Token in DIESELBEN
// Cookies wie ein echter Login (`nd_access`/`nd_refresh`). Fuer jede
// Server Component sieht ein Demo-Besucher damit aus wie ein angemeldeter
// Nutzer — nur eben im falschen Mandanten. Der Detail-Endpunkt scopte danach
// korrekt und antwortete 404, und die Oberflaeche meldete „gibt es nicht mehr
// oder ist dir nicht zugeteilt". Jeder Schritt richtig, das Ergebnis eine
// Falschaussage: der Datensatz existiert, nur nicht hier.
//
// Ein Benachrichtigungs-Link ist an EINEN Empfaenger gerichtet. Die Vorfuehrung
// kann dieser Empfaenger nie sein. Deshalb biegt sie ab, BEVOR geladen wird.
//
// WARUM ZENTRAL: der Dispatcher verschickt sechs Arten von Zielen
// (`/aufgaben/<id>`, `/reservierungen/<id>`, `/posteingang/<thread>`,
// `/objekte/<id>`, `/kalender/sperrantraege`, `/channels`). Als Kopie in jeder
// Seite waere die naechste neue Mail-Route wieder der Fall, den niemand
// mitpflegt (Wurzel 1).
//
// NUR AUF REINE MAIL-ZIELE ANWENDEN — das ist die Bedingung, nicht die
// Herkunft des Links. `/aufgaben/<id>` existiert AUSSCHLIESSLICH als Ziel einer
// Benachrichtigung und steht in keiner Navigation; dort ist die Weiche
// richtig. `/reservierungen/<id>`, `/objekte/<id>` und `/posteingang` sind
// dagegen regulaere Punkte der Sidebar: dieselbe Weiche haette dort einen
// Besucher der Vorfuehrung beim Klick auf eine Buchung hinausgeworfen und die
// Vorfuehrung damit zerstoert (beim Bau versucht und wieder entfernt,
// 24.08.2026). Wer eine neue Route anhaengt, prueft ZUERST, ob sie auch aus der
// Navigation erreichbar ist.
import { redirect } from "next/navigation";

import { getMe } from "@/lib/auth";
import { loginMitZiel } from "@/lib/rueckziel";

/**
 * Stellt sicher, dass das Ziel einer Benachrichtigung im RICHTIGEN Konto
 * geoeffnet wird, und gibt das Profil zurueck.
 *
 * `zielPfad` ist der Pfad DIESER Seite (mit ID) — er wird als Rueckziel an die
 * Anmeldung gehaengt, damit sie dort endet, wo der Empfaenger hin wollte.
 *
 * Leitet um, wenn die Sitzung eine Vorfuehrung ist. Ohne Sitzung leitet im
 * Normalfall bereits das Dashboard-Layout um (mit Rueckziel aus dem
 * Pfad-Header); die Pruefung hier ist die Absicherung fuer den Fall, dass eine
 * Seite ausserhalb dieses Layouts haengt.
 *
 * Was diese Funktion NICHT tut: entscheiden, ob der Nutzer den Datensatz sehen
 * darf. Das bleibt beim Endpunkt nah an den Daten (Wurzel 3/9).
 */
export async function benachrichtigungsZiel(zielPfad: string) {
  const me = await getMe();
  if (!me || me.is_demo) redirect(loginMitZiel(zielPfad));
  return me;
}

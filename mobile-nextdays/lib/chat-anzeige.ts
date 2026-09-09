// Entscheidungen der Chat-Oberfläche — ohne React, ohne native Krypto.
//
// SCHWESTERDATEI: die gleichnamige Datei in mobile-nextdays — identisch halten.
// Beide Apps beantworten dieselben drei Fragen über dieselben Daten; zwei
// Fassungen hießen, dass eine Nachricht in der einen App lesbar wäre und in
// der anderen als „nicht lesbar" erschiene.
//
// WOZU EIN EIGENES MODUL: Diese drei Fragen entscheiden, was der Nutzer SIEHT,
// und jede hat eine falsche Antwort, die plausibel aussieht:
//   * „nicht lesbar" wie eine leere Nachricht zu behandeln (Wurzel 5)
//   * eine fremde Nachricht rechts als eigene zu zeigen
//   * einen lokalen Tag über UTC zu bestimmen (verschiebt „heute" auf
//     „gestern" — dieselbe Wurzel wie im Aufgaben-Kalender)
// Im Screen wären sie nur über das Rendern prüfbar; hier sind sie es direkt.
import type { ChatNachricht } from "@/lib/chat";

/**
 * Kann DIESES Gerät die Nachricht öffnen?
 *
 * Beides muss da sein: der für uns verpackte Inhaltsschlüssel UND der
 * Schlüssel des Gegenübers (siehe `gegenueberVon`). Eine leere Zeichenkette
 * zählt als fehlend — sonst liefe die Entschlüsselung an und bräche mit einem
 * Krypto-Fehler ab, statt die Nachricht sauber als unlesbar zu markieren.
 *
 * Diese Funktion läuft im PRODUKTIVPFAD (`chat.ts:nachrichtOeffnen`), nicht
 * nur im Test — sonst prüfte der Test eine Eigenschaft, die die Anwendung
 * nicht besitzt.
 */
export function istLesbar(
  n: Pick<ChatNachricht, "wrapped_key" | "sender_key" | "wrapper_key">,
): boolean {
  return Boolean(n.wrapped_key) && Boolean(gegenueberVon(n));
}

/**
 * Hat diese Nachricht überhaupt einen Text?
 *
 * `chiffre` ist bei einer reinen BILDNACHRICHT leer — das ist gewollt
 * (`nachrichtVerschluesseln`), damit keine leere Blase entsteht. Wer diesen
 * leeren Wert trotzdem an `entschluesseln` gibt, bekommt einen Krypto-Fehler
 * (0 Byte → „Invalid initialization vector"), und der sieht aus wie
 * Manipulation.
 *
 * Genau das ist am 09.09.2026 passiert: Die Trennung „manipuliert" vs. „zu
 * alt" war gebaut, aber der dritte Fall — „gar kein Text" — fehlte. Jedes
 * Foto ohne Begleittext löste damit eine rote Warnung aus, die einen Angriff
 * behauptet. Eine Falschaussage in die andere Richtung.
 */
export function hatText(n: Pick<ChatNachricht, "chiffre">): boolean {
  return Boolean(n.chiffre);
}

/**
 * Gegen WELCHEN öffentlichen Schlüssel diese Nachricht zu öffnen ist.
 *
 * Normalfall: der Absender. Nach einer Freigabe: das Gerät, das neu verpackt
 * hat (`wrapper_key`, Migration 0614). Blind gegen `sender_key` zu entpacken
 * ergäbe dort ein anderes Geheimnis — die Nachricht ginge nie auf, ohne dass
 * etwas fehlschlüge.
 */
export function gegenueberVon(
  n: Pick<ChatNachricht, "sender_key" | "wrapper_key">,
): string | null {
  return n.wrapper_key || n.sender_key || null;
}

/**
 * Steht diese Nachricht auf der eigenen Seite (rechts)?
 *
 * Fail-closed: alles außer `owner` gilt als fremd. Eine fremde Nachricht als
 * eigene darzustellen wäre eine Falschaussage darüber, wer etwas gesagt hat —
 * bei einem Streit über eine Abrechnung keine Kleinigkeit.
 */
export function seiteIstEigene(sender: string): boolean {
  return sender === "owner";
}

export type TagesLabel = "heute" | "gestern" | "datum";

/**
 * Welcher Tag ist das, aus Sicht des Betrachters?
 *
 * `jetzt` ist ein Parameter statt `new Date()` im Rumpf — damit ist die
 * Funktion prüfbar, ohne die Systemuhr zu stellen (die Lehre aus den
 * zeitabhängigen Tests, die nur an bestimmten Wochentagen grün waren).
 *
 * Verglichen werden LOKALE Kalendertage, nie `toISOString()`: in Kopenhagen
 * verschöbe das um ein bis zwei Stunden und beschriftete eine Nachricht von
 * 00:30 als „gestern".
 */
export function tagesLabel(wann: Date, jetzt: Date): TagesLabel {
  if (gleicherTag(wann, jetzt)) return "heute";
  const gestern = new Date(jetzt);
  gestern.setDate(jetzt.getDate() - 1);
  if (gleicherTag(wann, gestern)) return "gestern";
  return "datum";
}

function gleicherTag(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

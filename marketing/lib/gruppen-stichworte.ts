// Die Stichwortzeile einer Funktionsgruppe (`features.gruppen.<key>.items`).
//
// WARUM EIN EIGENER HELFER UND NICHT SECHSMAL DERSELBE AUSDRUCK:
// Diese Zeile wird an SECHS Stellen gerendert — Startseite
// (`marketing-features.tsx`), Megamenü (`marketing-nav.tsx`), Preisseite
// (`preis-rechner.tsx`, `PreisInklusive`), Funktions-Hub (`app/funktionen`) und
// zweimal auf der Funktions-Unterseite (`app/funktionen/[slug]`: Hero-Zeile
// und die Karten „weiter zu"). Trägt eine Stichwortzeile einen Provisionssatz,
// müssen ihn ALLE sechs Aufrufe mitgeben, sonst steht dort bei next-intl der
// rohe Platzhalter statt der Zahl.
//
// Seit dem 26.08.2026 nennt KEINE Gruppe mehr einen Satz: „direkt" sagt jetzt,
// dass Direktbuchungen provisionsfrei sind, statt „{satz} statt 15–18 %
// OTA-Provision" — das las sich, als koste die Direktbuchung 0,5 %, obwohl der
// Satz die Portal-Buchungen betrifft. Der Helfer bleibt trotzdem der eine Weg
// zu dieser Zeile: die nächste Gruppe, die eine Live-Zahl nennt, soll sie nicht
// wieder sechsmal einzeln einsetzen müssen.
//
// Ein Helfer garantiert, dass der Ersatzwert bei fehlender Preisliste an allen
// sechs Stellen derselbe ist. Sechs Inline-Kopien wären genau die Stelle, an
// der die siebte vergessen wird — und dann steht auf EINER Seite „{satz}" im
// Fließtext, während die fünf anderen die Zahl zeigen.
//
// BEWUSST OHNE Import aus `lib/provisionstexte.ts`: der Helfer dort holt die
// Preisliste serverseitig. Diese Datei ist rein und wird auch von
// `"use client"`-Komponenten (Megamenü, Preisrechner) importiert; sie darf
// deshalb nichts mitziehen, was nur auf dem Server laufen kann.

/**
 * Stichwortzeile der Gruppe `gruppe`, mit eingesetztem Provisionssatz.
 *
 * `uebersetzer` ist die `features.gruppen`-Instanz des Aufrufers (`t`/`tg`/`tf`),
 * damit hier kein zweiter Übersetzer-Kontext aufgebaut wird — der Aufrufer
 * weiß, ob er in einer Server- oder Client-Komponente steht.
 *
 * `satzExtern` kommt fertig formatiert vom Server (`holeProvisionssaetze`).
 * `null` heißt: die Preisliste war nicht abrufbar. Dann tritt das übersetzte
 * Ersatzwort `direkt.satzUnbekannt` ein statt einer Lücke im Satz — die
 * ausführliche Begründung steht in `components/marketing/marketing-faq.tsx`.
 * Erfunden wird keine Zahl (Wurzel 4).
 */
export function gruppenStichworte(
  uebersetzer: (key: string, werte?: Record<string, string>) => string,
  gruppe: string,
  satzExtern: string | null,
): string {
  return uebersetzer(`${gruppe}.items`, {
    satz: satzExtern ?? uebersetzer("direkt.satzUnbekannt"),
  });
}

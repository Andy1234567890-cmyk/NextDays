// Cookies eines Drittanbieters wieder loswerden — der Gegenzustand zu jedem
// einwilligungsbasierten Skript (Wurzel 1).
//
// WARUM ZENTRAL: Diese Logik brauchen beide Dienste, die auf Einwilligung
// laden (Reichweitenmessung und Spamschutz). Als Kopie in beiden Modulen wäre
// sie zweimal zu pflegen, und die zweite Kopie hätte die Domain-Falle unten
// erneut — dieselbe Klasse Fehler, die schon einmal dagestanden hat.
//
// DIE DOMAIN-FALLE: Ein Cookie lässt sich per `document.cookie` nur mit GENAU
// der Domain entfernen, auf der es gesetzt wurde. Der naheliegende Weg, die
// registrierbare Domain per `hostname.split(".").slice(-2)` zu raten, ist
// falsch: bei einem zweistufigen Suffix liefert er `.co.uk` statt
// `.beispiel.co.uk`. Das ist eine Public Suffix, der Browser verwirft das
// Löschen stillschweigend, und das Cookie bleibt liegen — während der
// Rechtstext zusichert, dass es verschwindet. Bei 27 EU-Ländern (`.co.uk`,
// `.com.mt`, `.gov.ie`) ist das kein Randfall.
//
// Deshalb wird nicht geraten, sondern jedes Suffix von rechts nach links
// durchprobiert. Ein Löschversuch auf einer Public Suffix ist folgenlos, ein
// verpasster nicht — also lieber einer zu viel.

/** Alle Domain-Kandidaten für das aktuelle Fenster, vom Host aufwärts. */
function domainKandidaten(): string[] {
  const teile = window.location.hostname.split(".");
  const domains = [window.location.hostname];
  for (let i = teile.length - 2; i >= 0; i -= 1) {
    domains.push(`.${teile.slice(i).join(".")}`);
  }
  return domains;
}

/** Namen aller gesetzten Cookies, die auf `passt` zutreffen. */
function vorhandene(passt: (name: string) => boolean): string[] {
  return document.cookie
    .split(";")
    .map((eintrag) => eintrag.split("=")[0]?.trim() ?? "")
    .filter((name) => name !== "" && passt(name));
}

/**
 * Löscht alle Cookies, deren Name `passt` erfüllt — auf jeder möglichen Domain.
 *
 * `melder` beschreibt den Dienst und erscheint in der Warnung, falls etwas
 * überlebt. Ein halber Widerruf, der stumm bleibt, ist derselbe Fehler wie ein
 * verschluckter Exception (Wurzel 5) — und hier zugleich eine unwahre
 * Zusicherung im Rechtstext.
 *
 * Rückgabe: die Namen, die NICHT weggingen (leer = alles gelöscht).
 */
export function cookiesLoeschen(
  passt: (name: string) => boolean,
  melder: string,
): string[] {
  if (typeof window === "undefined") return [];
  const domains = domainKandidaten();

  for (const name of vorhandene(passt)) {
    for (const domain of domains) {
      document.cookie = `${name}=; path=/; domain=${domain}; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    }
    // Auch ohne Domain-Angabe — deckt den Fall ab, dass das Cookie
    // hostgebunden gesetzt wurde (localhost, IP-Adresse).
    document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  }

  const rest = vorhandene(passt);
  if (rest.length > 0) {
    console.warn(
      `[${melder}] Widerruf unvollständig — diese Cookies blieben stehen:`,
      rest.join(", "),
    );
  }
  return rest;
}

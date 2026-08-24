// Rücksprungziel nach dem Login („weiter"-Parameter).
//
// WARUM ES DAS BRAUCHT: Benachrichtigungs-Mails verlinken auf einen konkreten
// Pfad (`/aufgaben/<id>`, `/reservierungen/<id>`, `/posteingang/<thread>` …).
// Wer beim Klick keine passende Sitzung hat, wurde bisher auf `/login`
// geworfen und landete nach der Anmeldung auf dem Dashboard — die Aufgabe aus
// der Mail musste er sich von Hand wiedersuchen. Der Grund war, dass KEINE der
// fünf `redirect("/login")`-Stellen ein Ziel mitgab und die Login-Seite fest
// `router.replace("/")` machte.
//
// WARUM DIE PRÜFUNG (Wurzel 8): der Wert kommt aus der URL, also vom
// Angreifer. Ungeprüft übernommen wäre `?weiter=https://boese.example` ein
// offener Redirect — die eigene Domain leitet dann auf eine fremde
// Anmeldemaske weiter, was Phishing glaubwürdig macht. Erlaubt ist deshalb NUR
// ein eigener, relativer Pfad. Alles andere wird nicht korrigiert, sondern
// verworfen (fail-closed, Wurzel 5) — das Dashboard ist ein sicheres Ziel.
//
// Abgewiesen werden insbesondere:
//   * absolute URLs (`https://…`, `//boese.example` — protokollrelativ!)
//   * alles, was nicht mit genau einem `/` beginnt
//   * `\` als Trenner (manche Browser lesen `/\boese.example` als Host)
//   * Steuerzeichen, mit denen sich der Header brechen lässt
//   * `/login` selbst und die anderen Auth-Wege (sonst Schleife)

/** Auth-Pfade taugen nicht als Rücksprungziel: nach dem Login dorthin
 *  zurückzuschicken ergibt eine Schleife oder eine sinnlose Station. */
const AUTH_PFADE = [
  "/login",
  "/signup",
  "/demo",
  "/einladung",
  "/passwort-vergessen",
  "/passwort-neu",
] as const;

/**
 * Prüft ein Rücksprungziel und gibt es zurück — oder `null`.
 *
 * `null` heißt „kein brauchbares Ziel", nicht „Fehler": der Aufrufer nimmt
 * dann das Dashboard. Nie einen geratenen Ersatzpfad zurückgeben (Wurzel 4).
 */
export function rueckzielPruefen(
  rohwert: string | null | undefined,
): string | null {
  if (typeof rohwert !== "string" || rohwert === "") return null;
  // Steuerzeichen (inkl. CR/LF) und Leerzeichen: nie Teil eines Pfades. Als
  // Codepoint-Prüfung, nicht als Regex mit rohen Steuerzeichen im Quelltext.
  for (const zeichen of rohwert) {
    const code = zeichen.codePointAt(0) ?? 0;
    if (code <= 0x20 || code === 0x7f) return null;
  }
  // Genau EIN führender Schrägstrich. `//host` wäre protokollrelativ und damit
  // eine fremde Domain, `\` liest mancher Browser als Trenner.
  if (!rohwert.startsWith("/")) return null;
  if (rohwert.startsWith("//")) return null;
  if (rohwert.includes("\\")) return null;
  // Kein `://` irgendwo — schliesst `/weiter?x=https://…` als Ziel aus.
  if (rohwert.includes("://")) return null;
  // `..` verwerfen. Sonst umgeht ein Ziel die Auth-Sperre unten, indem es sich
  // erst beim Navigieren zusammenfaltet: `/aufgaben/../../login` normalisiert
  // der Browser zu `/login` — die Pruefung unten sieht aber den ungefalteten
  // Pfad und laesst ihn durch, was eine Anmelde-Schleife ergibt. Ein echtes
  // Ziel aus einer Benachrichtigung braucht `..` nie.
  const pfad = rohwert.split(/[?#]/)[0];
  if (pfad.split("/").includes("..")) return null;
  if (AUTH_PFADE.some((p) => pfad === p || pfad.startsWith(`${p}/`))) {
    return null;
  }
  return rohwert;
}

/**
 * Baut die Login-Adresse mit Rücksprungziel.
 *
 * Ohne brauchbares Ziel bleibt es das nackte `/login` — kein leerer Parameter,
 * der in Protokollen und Lesezeichen mitgeschleppt wird.
 */
export function loginMitZiel(ziel: string | null | undefined): string {
  const geprueft = rueckzielPruefen(ziel);
  return geprueft ? `/login?weiter=${encodeURIComponent(geprueft)}` : "/login";
}

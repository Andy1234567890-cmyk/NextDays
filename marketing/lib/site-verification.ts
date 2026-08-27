// Eigentumsnachweise der Suchmaschinen — die Zeichenketten, mit denen Google
// (und später Bing/Yandex) prüfen, dass diese Domain uns gehört.
//
// Warum im Code und nicht nur in einer Umgebungsvariablen: `NEXT_PUBLIC_*`
// wird beim BAUEN eingesetzt, und marketing/Dockerfile übergibt keine
// Build-ARGs. Eine Variable, die nur in Coolify steht, wäre im fertigen Image
// leer — der Nachweis fehlte still, und das fällt erst auf, wenn die
// Verifizierung in der Search Console fehlschlägt (Wurzel 5: ein fehlender
// Konfigurationswert muss laut sein, nicht stumm). Der Wert ist KEIN Geheimnis:
// er steht öffentlich im HTML jeder Seite, das ist sein Zweck. Er identifiziert
// die Domain, er berechtigt zu nichts.
//
// Überschreibbar bleibt er trotzdem: hat eine andere Auslieferungsdomain
// (Staging, Vorschau) ihre eigene Property in der Search Console, setzt man
// dort `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` und baut neu. Leerer Wert =
// bewusst kein Meta-Tag (`undefined`), nicht ein leeres Tag.

/** Nachweis für die Produktionsdomain (Search-Console-Property mynextdays.com). */
const GOOGLE_STANDARD = "pDUYBvVflztYVL9ulcb-oKBu9YG9kNxruzpyQuxP5kE";

/**
 * Google-Eigentumsnachweis für `<meta name="google-site-verification">`.
 *
 * `undefined`, wenn die Variable ausdrücklich leer gesetzt ist — Next lässt das
 * Tag dann weg, statt eines mit leerem `content` zu rendern.
 */
export const GOOGLE_SITE_VERIFICATION: string | undefined =
  (process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ?? GOOGLE_STANDARD).trim() || undefined;

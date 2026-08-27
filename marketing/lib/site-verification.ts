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
// dort `NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` und baut neu. Ein LEERER Wert
// gilt dabei nicht als „bewusst keiner", sondern als „nicht gesetzt" — siehe
// die Begründung unten am Fallback.

/** Nachweis für die Produktionsdomain (Search-Console-Property mynextdays.com). */
const GOOGLE_STANDARD = "pDUYBvVflztYVL9ulcb-oKBu9YG9kNxruzpyQuxP5kE";

/**
 * Google-Eigentumsnachweis für `<meta name="google-site-verification">`.
 *
 * Immer belegt: eine leere oder fehlende Umgebungsvariable fällt auf den
 * Standardwert zurück. Der Typ bleibt `string | undefined`, weil Next das
 * Metadata-Feld so erwartet.
 */
// WARUM `|| GOOGLE_STANDARD` UND NICHT `??`: Ein `ARG` im Dockerfile ohne
// Vorgabewert setzt die Variable auf einen LEEREN STRING, nicht auf
// „nicht vorhanden". `??` greift nur bei `undefined`/`null` — der Fallback war
// damit im Container wirkungslos, und genau das ist live passiert (27.08.2026):
// mynextdays.com lieferte kein `<meta name="google-site-verification">`, obwohl
// der Wert hier im Code stand. Der Nachweis fehlte still, die Search Console
// hätte die Domain irgendwann verworfen. `||` behandelt leer und fehlend
// gleich — das ist hier die einzige richtige Bedeutung von „nicht gesetzt".
const AUS_UMGEBUNG = (process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION ?? "").trim();

export const GOOGLE_SITE_VERIFICATION: string | undefined =
  AUS_UMGEBUNG || GOOGLE_STANDARD;

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

// ---------------------------------------------------------------------------
// Meta (Facebook) — Domain-Verifizierung
// ---------------------------------------------------------------------------
// Nicht dasselbe wie der Pixel: dieser Nachweis sagt Meta, dass mynextdays.com
// UNS gehört. Er ist Voraussetzung dafür, dass Meta Web-Conversions dieser
// Domain zuordnet, und er verhindert, dass fremde Werbekonten Events für sie
// melden. NICHT dafür da, „Aggregated Event Measurement" freizuschalten: den
// AEM-Tab und die manuelle Priorisierung der acht Events hat Meta für
// Web-Conversions Mitte 2025 entfernt und aggregiert seitdem automatisch (das
// alte Modell gilt nur noch für iOS-App-Kampagnen).
//
// ZWEITER NACHWEIS, ABSICHTLICH. Verifiziert ist die Domain seit dem
// 27.08.2026 über den DNS-TXT-Eintrag bei DanDomain — mynextdays.com liegt
// dort, nicht bei Cloudflare wie mynextdays.dk und mybestdays.dk. Meta
// akzeptiert beide Wege gleichzeitig; dieser hier hält die Verifizierung, wenn
// die Zone einmal umzieht oder der TXT-Eintrag verloren geht. Der Wert ist in
// beiden Wegen derselbe.
//
// Meta verlangt ausdrücklich, dass das Tag im server-gelieferten `<head>`
// steht: „Die Verifizierung wird fehlschlagen, wenn der Meta-Tag-Code
// außerhalb des <head>-Abschnitts oder in einem Abschnitt eingefügt wird, der
// dynamisch durch JavaScript geladen wird." Next rendert `metadata.verification`
// serverseitig in den `<head>` — deshalb steht der Wert hier und nicht in einer
// Client-Komponente.
//
// Warum im Code statt in Coolify: identische Begründung wie oben bei Google —
// marketing/Dockerfile übergibt keine Build-ARGs, eine reine Coolify-Variable
// wäre im Image leer und der Nachweis fehlte STILL.

/** Nachweis für die Produktionsdomain (Meta-Portfolio Mynextdays ApS). */
const FACEBOOK_STANDARD = "ncv4li3vghg63hc9rn9rgkhvbpkjai";

const FACEBOOK_AUS_UMGEBUNG = (
  process.env.NEXT_PUBLIC_FACEBOOK_DOMAIN_VERIFICATION ?? ""
).trim();

/** Wert für `<meta name="facebook-domain-verification">`. */
export const FACEBOOK_DOMAIN_VERIFICATION: string =
  FACEBOOK_AUS_UMGEBUNG || FACEBOOK_STANDARD;

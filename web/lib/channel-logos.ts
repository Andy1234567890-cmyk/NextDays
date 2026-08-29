// Zentrale Zuordnung Channex-Portal-Code → ECHTES Original-Logo (public/channels/*).
// Eine Wahrheit für Grid, Sidebar, Connect-Wizard und den Objekt-Kanäle-Tab.
//
// Wurzel 4 / ausdrückliche Nutzer-Vorgabe: NUR echte, offiziell beschaffte
// Markenlogos (Wikimedia Commons, offizielle Brand-Assets). KEIN generisches
// Fallback-Icon und KEIN selbst gezeichnetes Markenlogo. Portale, für die kein
// offizielles Logo frei auffindbar ist (Channex-Sandbox-/Mock-Namen, blockierte
// Anbieter), tragen bewusst KEIN Logo → die UI zeigt dann nur den Namen.
//
// Bewusst OHNE Logo (kein offizielles frei auffindbar / keine echte Marke,
// NICHT geraten): Hostelworld (kein freies offizielles SVG), Reserva, More.com,
// Room Panda, und die Channex-Sandbox-/Test-/API-Codes: BookDirectOpen,
// CakrahubBookingEngine, Crewdogs, DolceBot, Gopaddi, Guirez, Heytrip,
// HopperHomes, JulianAlpsBooking, Padelbound, RevChill, RukiyeZara, SelahComfort,
// Tripnera, WeSpeakOpen, ZenithBookingEngine, OpenChannel/OpenShopping
// (Channex-interne API-Konzepte, keine Marke). Diese zeigen nur den Namen.

export const CHANNEL_LOGO: Record<string, string> = {
  // Unser eigener Marktplatz — kein OTA und kein Channex-Portal, steht in der
  // Kanal-Auswahl aber gleichberechtigt daneben (für den Betrieb ist er ein
  // Vertriebskanal wie jeder andere). Eigenes Logo, keine Fremdmarke.
  myBestDays: "/channels/mybestdays.png",
  // Große OTAs (echte, hochwertige Logos)
  BookingCom: "/channels/booking.svg",
  AirBNB: "/channels/airbnb.svg",
  Expedia: "/channels/expedia.svg",
  // Vrbo (in Europa „FeWo-direkt") — die Logodatei lag längst im Ordner, war
  // aber nie eingetragen, deshalb blieb der Kanal ohne Zeichen. Beide
  // Schreibweisen zeigen auf dasselbe Logo, weil es dieselbe Marke ist.
  Vrbo: "/channels/vrbo.svg",
  FeWoDirekt: "/channels/vrbo.svg",
  Agoda: "/channels/agoda.svg",
  CTrip: "/channels/tripcom.svg",
  GoogleHotelARI: "/channels/google.svg",
  DespegarV2: "/channels/despegar.svg",
  Goibibo: "/channels/goibibo.svg",
  Yatra: "/channels/yatra.svg",
  Hopper: "/channels/hopper.svg",
  Hipcamp: "/channels/hipcamp.png",
  Ostrovok: "/channels/ostrovok.svg",
  // Mietwagen-Marken (Wikimedia SVG)
  Avis: "/channels/avis.svg",
  Budget: "/channels/budget.svg",
  Hertz: "/channels/hertz.svg",
  Europcar: "/channels/europcar.svg",
  Payless: "/channels/payless.svg",
  // Nischen-Anbieter mit echtem, verlässlichem Original-Logo
  HotelTrader: "/channels/hoteltrader.svg",
  JoodBooking: "/channels/joodbooking.svg",
  Levart: "/channels/levart.svg",
  Travia: "/channels/travia.svg",
  HotelPoint: "/channels/hotelpoint.png",
  HotelRez: "/channels/hotelrez.png",
  GlampingHub: "/channels/glampinghub.png",
  OneHotelRez: "/channels/onehotelrez.png",
  WigwamHolidays: "/channels/wigwam.svg",
  WebBeds: "/channels/webbeds.svg",
  WeSpeak: "/channels/wespeak.png",
  Revenatium: "/channels/revenatium.png",
  GuruHotel: "/channels/guruhotel.png",
};

// Manche Katalog-Codes heißen im Titel „Make My Trip"/„Trip.com" — MakeMyTrip
// selbst hat den Code `Goibibo` (Titel „Make My Trip"), daher kein separater
// Eintrag. Für MakeMyTrip als eigenständiges Logo liegt makemytrip.svg bereit,
// falls Channex den Code später trennt.

/** Echtes Original-Logo eines Portals oder null (dann nur Name zeigen, KEIN
 *  generisches Ersatz-Icon — ausdrückliche Nutzer-Vorgabe). */
export function channelLogo(code: string | null | undefined): string | null {
  if (!code) return null;
  return CHANNEL_LOGO[code] ?? null;
}

// Schreibweisen-tolerante Suche: dieselbe Marke steht je nach Quelle als
// Katalog-Code (`BookingCom`), Klarname (`Booking.com`) oder in anderer
// Groß-/Kleinschreibung in den Daten. Nur Zeichen normalisieren — es wird KEIN
// Logo geraten, nur dasselbe echte Logo wiedergefunden.
const NORMALISIERT: Record<string, string> = Object.fromEntries(
  Object.entries(CHANNEL_LOGO).map(([code, pfad]) => [
    code.toLowerCase().replace(/[^a-z0-9]/g, ""),
    pfad,
  ]),
);

/** Wie `channelLogo`, akzeptiert aber auch Klarnamen („Booking.com"). */
export function channelLogoLoose(name: string | null | undefined): string | null {
  if (!name) return null;
  return NORMALISIERT[name.toLowerCase().replace(/[^a-z0-9]/g, "")] ?? null;
}

// Portal-Codes, deren technischer Name nicht der Markenname ist. Alle anderen
// Codes SIND der Markenname („Agoda", „Expedia") und werden unverändert
// gezeigt — hier wird nichts geraten und nichts übersetzt.
const CHANNEL_LABEL: Record<string, string> = {
  BookingCom: "Booking.com",
  AirBNB: "Airbnb",
  GoogleHotelARI: "Google",
  CTrip: "Trip.com",
  DespegarV2: "Despegar",
  OpenChannel: "Testkanal",
};

/** Anzeigename eines Kanals. Unbekannte Codes werden unverändert gezeigt —
 *  besser der echte Code als ein erfundener Klarname. */
export function channelLabel(code: string | null | undefined): string {
  if (!code) return "";
  return CHANNEL_LABEL[code] ?? code;
}

// Dieselbe Tabelle schreibweisen-tolerant — für Werte, die nicht aus unserem
// Katalog kommen, sondern aus fremden Daten (`ota_name` einer Buchung).
const LABEL_NORMALISIERT: Record<string, string> = Object.fromEntries(
  Object.entries(CHANNEL_LABEL).map(([code, label]) => [
    code.toLowerCase().replace(/[^a-z0-9]/g, ""),
    label,
  ]),
);

/** Wie `channelLabel`, akzeptiert aber auch fremde Schreibweisen.
 *
 *  Für Werte aus `ota_name`: Channex schreibt seinen Kanalcode `BookingCom`
 *  ohne Punkt, und der stand so in der Buchungskarte („von BookingCom"),
 *  direkt neben dem korrekt gerenderten Booking.com-Logo. Unbekannte Namen
 *  bleiben unverändert — es wird nichts geraten. */
export function channelLabelLoose(name: string | null | undefined): string {
  if (!name) return "";
  return LABEL_NORMALISIERT[name.toLowerCase().replace(/[^a-z0-9]/g, "")] ?? name;
}

/* ------------------------------------------------------------------ */
/* Markenfarben                                                        */
/* ------------------------------------------------------------------ */

/** Die MARKENFARBE eines Portals (offizielle Brand-Farbe), und dazu die
 *  Bildmarke in der Variante, die AUF dieser Farbe funktioniert.
 *
 *  Warum das hier steht und nicht an der Schaltfläche: dieselben zwei Angaben
 *  wurden schon an zwei Stellen gebraucht (Connect-Knopf, USP-Miniaturen) und
 *  drohten damit die dritte Kopie zu werden — genau das Muster, das Wurzel 4
 *  verbietet. Die Logo-Zuordnung ist die vorhandene Wahrheit über Portale, also
 *  gehören sie daneben.
 *
 *  `mark` ist bewusst die BILDMARKE ohne Schriftzug: neben einer Beschriftung
 *  „Airbnb verbinden" stünde der Markenname sonst zweimal. Sie ist in der Datei
 *  WEISS eingefärbt, weil sie immer auf der Markenfarbe sitzt — `currentColor`
 *  wäre hier eine Falle: ein per `<img>` geladenes SVG rendert als eigenes
 *  Dokument ohne den Farb-Kontext der Seite und fiele auf Schwarz zurück.
 *
 *  Nur Portale mit einer eindeutigen, offiziellen Markenfarbe stehen hier. Für
 *  alle anderen gibt es KEINEN Eintrag und die Oberfläche bleibt bei ihrer
 *  neutralen Gestalt — nie eine geratene Farbe (Wurzel 4). */
export const CHANNEL_BRAND: Record<
  string,
  { farbe: string; text: string; mark: string }
> = {
  // Airbnb „Rausch". Der Wert steht NICHT hier, sondern kommt aus
  // `--channel-airbnb` (globals.css) — dieselbe Farbe faerbt bereits die
  // Airbnb-Balken im Kalender, und zwei Stellen mit demselben Rot laufen
  // frueher oder spaeter auseinander. `var(...)` funktioniert ueberall dort,
  // wo ein CSS-Farbwert erwartet wird, also auch im `style`-Attribut.
  AirBNB: {
    farbe: "var(--channel-airbnb)",
    text: "#FFFFFF",
    mark: "/channels/airbnb-mark-weiss.svg",
  },
  // Booking.com steht bewusst NICHT hier, obwohl seine Markenfarbe (#003580)
  // bekannt ist: das vorliegende Logo ist mehrfarbig und traegt selbst ein
  // dunkles Blau (#273b7d), das auf blauem Grund verschwindet. Ein Knopf, auf
  // dem die Marke unlesbar wird, ist schlechter als der neutrale. Sobald eine
  // einfarbige Bildmarke vorliegt, kommt der Eintrag dazu — bis dahin lieber
  // kein Eintrag als ein falscher (Wurzel 4).
};

/** Markenfarbe + passende Bildmarke eines Portals, oder `null`.
 *
 *  `null` heißt „für dieses Portal ist keine Markenfarbe hinterlegt" — die
 *  Oberfläche bleibt dann bei ihrer neutralen Gestalt. Kein Ersatzwert. */
export function channelBrand(
  code: string | null | undefined,
): { farbe: string; text: string; mark: string } | null {
  if (!code) return null;
  return CHANNEL_BRAND[code] ?? null;
}

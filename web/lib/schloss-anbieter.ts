// Katalog der Schloss-Anbieter — je Anbieter ein buchbares Modul (0577).
//
// WARUM JE ANBIETER UND NICHT EIN SAMMELMODUL: Entscheidung vom 06.09.2026.
// Der Betrieb bucht genau den Hersteller, dessen Schlösser er besitzt, und
// sieht in der Erweiterungs-Übersicht die Marke, die er kennt — nicht ein
// abstraktes „Schlösser".
//
// DIE KENNUNG IST SEAMS PROVIDER-NAME (`igloohome`, `salto_ks`, …), nicht ein
// eigener Schlüssel. Damit ist die Verbindung zwischen gebuchtem Modul und dem
// Provider-Filter im Connect Webview eindeutig: ohne gebuchtes Modul erscheint
// der Hersteller dort nicht. Ein zweiter Namensraum hätte bedeutet, dass eine
// Marke bei uns anders heißt als bei Seam — und beim nächsten neuen Anbieter
// ordnet sie niemand mehr richtig zu.
//
// LOGOS: `web/public/schloesser/<kennung>.svg`. Fehlt die Datei, zeigt die
// Kachel den Markennamen — dasselbe Verhalten wie `ChannelCard` für die
// Portale. Bewusst KEINE selbst gezeichneten Logos: ein nachgebautes
// Hersteller-Logo ist kein Original, sondern eine Fälschung, und die Rechte
// liegen beim Hersteller. Die Dateien kommen aus Seams Partner-Kit bzw. den
// Presskits der Hersteller.
//
// KATEGORIEN sind Seams eigene (`consumer_smartlocks`,
// `access_control_systems`), am 06.09.2026 live abgefragt — nicht geraten.

export type SchlossAnbieter = {
  /** Seams Provider-Kennung. Zugleich Modul-Schlüssel und Logo-Dateiname. */
  kennung: string;
  /** Markenname in der Schreibweise des Herstellers. */
  name: string;
  /** URL-Segment unter /erweiterungen. */
  slug: string;
  /** `smartlock` = Endkunden-Schlösser, `acs` = Zutrittssysteme für Gebäude. */
  art: "smartlock" | "acs" | "keybox";
  /** Ein Satz, der sagt, für wen das Gerät gedacht ist. */
  kurz: string;
  /** Codes ohne Netz am Objekt (algoPIN & Co.) — nicht widerrufbar. */
  offline: boolean;
};

export const SCHLOSS_ANBIETER: readonly SchlossAnbieter[] = [
  // --- Endkunden-Schlösser (Seam: consumer_smartlocks) --------------------
  {
    kennung: "igloohome",
    name: "igloohome",
    slug: "schloss-igloohome",
    art: "smartlock",
    kurz:
      "Codes entstehen ohne Internet am Objekt — das Schloss rechnet sie " +
      "selbst nach. Für Ferienobjekte ohne stabiles Netz.",
    offline: true,
  },
  {
    kennung: "nuki",
    name: "Nuki",
    slug: "schloss-nuki",
    art: "smartlock",
    kurz:
      "Nachrüstbar auf den vorhandenen Zylinder, sekundengenaue Zeitfenster " +
      "und Codes, die sich jederzeit zurückziehen lassen.",
    offline: false,
  },
  {
    kennung: "ttlock",
    name: "TTLock",
    slug: "schloss-ttlock",
    art: "smartlock",
    kurz:
      "Weit verbreitete, günstige Schlösser. Für Fernzugriff und Widerruf " +
      "ist ein Gateway des Herstellers nötig.",
    offline: false,
  },
  {
    kennung: "yale",
    name: "Yale",
    slug: "schloss-yale",
    art: "smartlock",
    kurz: "Türschlösser und Keypads der Marke Yale, per Bridge angebunden.",
    offline: false,
  },
  {
    kennung: "august",
    name: "August",
    slug: "schloss-august",
    art: "smartlock",
    kurz:
      "Nachrüstbare Schlösser für den Innenzylinder, Codes über das Keypad.",
    offline: false,
  },
  {
    kennung: "tedee",
    name: "Tedee",
    slug: "schloss-tedee",
    art: "smartlock",
    kurz: "Kompakte Nachrüstschlösser mit Bridge, europäischer Hersteller.",
    offline: false,
  },
  {
    kennung: "schlage",
    name: "Schlage",
    slug: "schloss-schlage",
    art: "smartlock",
    kurz: "Verbreitete Türschlösser in Nordamerika, Codes per Tastenfeld.",
    offline: false,
  },
  {
    kennung: "kwikset",
    name: "Kwikset",
    slug: "schloss-kwikset",
    art: "smartlock",
    kurz: "Türschlösser mit Zahlenfeld, überwiegend nordamerikanischer Markt.",
    offline: false,
  },
  {
    kennung: "lockly",
    name: "Lockly",
    slug: "schloss-lockly",
    art: "smartlock",
    kurz:
      "Schlösser mit wechselnder Tastenanordnung. Codes entstehen teils ohne " +
      "Netzverbindung und sind dann nicht vorzeitig entziehbar.",
    offline: true,
  },
  {
    kennung: "smartthings",
    name: "SmartThings",
    slug: "schloss-smartthings",
    art: "smartlock",
    kurz:
      "Samsungs Hub-Plattform. Bindet Schlösser verschiedener Hersteller " +
      "über einen gemeinsamen Hub an.",
    offline: false,
  },
  {
    kennung: "akiles",
    name: "Akiles",
    slug: "schloss-akiles",
    art: "smartlock",
    kurz: "Zutrittslösung für Wohnanlagen und Ferienobjekte, spanischer Hersteller.",
    offline: false,
  },
  {
    kennung: "ultraloq",
    name: "Ultraloq",
    slug: "schloss-ultraloq",
    art: "smartlock",
    kurz: "Türschlösser mit Fingerabdruck und Zahlenfeld, Bridge für Fernzugriff.",
    offline: false,
  },
  {
    kennung: "wyze",
    name: "Wyze",
    slug: "schloss-wyze",
    art: "smartlock",
    kurz: "Preiswerte Schlösser mit Keypad, Anbindung über die Wyze-Bridge.",
    offline: false,
  },
  {
    kennung: "keyincode",
    name: "KeyInCode",
    slug: "schloss-keyincode",
    art: "smartlock",
    kurz: "Schlösser und Keyboxen für Vermietung und Gewerbe.",
    offline: false,
  },
  {
    kennung: "korelock",
    name: "KoreLock",
    slug: "schloss-korelock",
    art: "smartlock",
    kurz: "Schlösser mit eigenem Funkmodul, für Mehrfamilien- und Ferienobjekte.",
    offline: false,
  },
  {
    kennung: "sifely",
    name: "Sifely",
    slug: "schloss-sifely",
    art: "smartlock",
    kurz: "Nachrüstbare Türschlösser mit Gateway, überwiegend für Vermietung.",
    offline: false,
  },
  {
    kennung: "dusaw",
    name: "Dusaw",
    slug: "schloss-dusaw",
    art: "smartlock",
    kurz: "Schlösser mit Zahlenfeld für Ferienobjekte und Gewerbe.",
    offline: false,
  },
  {
    kennung: "yacan",
    name: "Yacan",
    slug: "schloss-yacan",
    art: "smartlock",
    kurz: "Zutrittsschlösser mit Code- und Kartenleser.",
    offline: false,
  },
  {
    kennung: "thirty_three_lock",
    name: "33Lock",
    slug: "schloss-33lock",
    art: "smartlock",
    kurz: "Schlösser für Kurzzeitvermietung mit Code-Verwaltung über die Cloud.",
    offline: false,
  },
  {
    kennung: "dormakaba_oracode",
    name: "dormakaba Oracode",
    slug: "schloss-dormakaba-oracode",
    art: "smartlock",
    kurz:
      "Codes werden rechnerisch erzeugt und brauchen keine Verbindung zum " +
      "Schloss — dafür sind sie nach der Ausgabe nicht mehr entziehbar.",
    offline: true,
  },

  // --- Schlüsselboxen ----------------------------------------------------
  {
    kennung: "keynest",
    name: "KeyNest",
    slug: "schloss-keynest",
    art: "keybox",
    kurz:
      "Physische Schlüsselübergabe über Schließfächer und Abholstellen. Für " +
      "Objekte, an denen kein Smart Lock möglich ist — Altbau, Denkmalschutz, " +
      "Mietwohnung ohne Umbaurecht.",
    offline: false,
  },

  // --- Zutrittssysteme für Gebäude (Seam: access_control_systems) --------
  {
    kennung: "salto_ks",
    name: "Salto KS",
    slug: "schloss-salto-ks",
    art: "acs",
    kurz:
      "Cloud-Zutrittssystem für Hotels und Wohnanlagen. Die PIN wird von " +
      "Salto selbst erzeugt, nicht von uns vorgegeben.",
    offline: false,
  },
  {
    kennung: "salto_space",
    name: "Salto Space",
    slug: "schloss-salto-space",
    art: "acs",
    kurz: "Salto-Zutrittssystem für Anlagen mit eigenem Server vor Ort.",
    offline: false,
  },
  {
    kennung: "assa_abloy_vostio",
    name: "ASSA ABLOY Vostio",
    slug: "schloss-assa-abloy-vostio",
    art: "acs",
    kurz: "Cloud-Zutrittssystem für Hotels, mobile Schlüssel und Karten.",
    offline: false,
  },
  {
    kennung: "assa_abloy_credential_service",
    name: "ASSA ABLOY Credential Service",
    slug: "schloss-assa-abloy-credential",
    art: "acs",
    kurz: "Ausgabe mobiler Zutrittsberechtigungen für ASSA-ABLOY-Anlagen.",
    offline: false,
  },
  {
    kennung: "dormakaba_ambiance",
    name: "dormakaba Ambiance",
    slug: "schloss-dormakaba-ambiance",
    art: "acs",
    kurz: "Hotel-Zutrittssystem von dormakaba mit Karten und mobilen Schlüsseln.",
    offline: false,
  },
  {
    kennung: "dormakaba_community",
    name: "dormakaba Community",
    slug: "schloss-dormakaba-community",
    art: "acs",
    kurz: "Zutrittssystem für Wohnanlagen und gemischt genutzte Gebäude.",
    offline: false,
  },
  {
    kennung: "visionline",
    name: "ASSA ABLOY Visionline",
    slug: "schloss-visionline",
    art: "acs",
    kurz: "Hotel-Schließanlage mit Server vor Ort, Karten und mobile Schlüssel.",
    offline: false,
  },
  {
    kennung: "hotek",
    name: "Hotek",
    slug: "schloss-hotek",
    art: "acs",
    kurz: "Hotel-Schließsystem, niederländischer Hersteller.",
    offline: false,
  },
  {
    kennung: "latch",
    name: "Latch",
    slug: "schloss-latch",
    art: "acs",
    kurz: "Zutrittssystem für Wohngebäude, Haustür bis Wohnungstür.",
    offline: false,
  },
  {
    kennung: "brivo",
    name: "Brivo",
    slug: "schloss-brivo",
    art: "acs",
    kurz: "Cloud-Zutrittskontrolle für Gewerbe- und Wohngebäude.",
    offline: false,
  },
  {
    kennung: "legic_connect",
    name: "LEGIC Connect",
    slug: "schloss-legic-connect",
    art: "acs",
    kurz: "Plattform für mobile Zutrittsberechtigungen in LEGIC-Anlagen.",
    offline: false,
  },
];

/** Der Modul-Schlüssel eines Anbieters, wie er im Abo steht.
 *
 *  Präfix, damit ein Anbieter-Modul im Abo nicht mit einem Produktmodul
 *  (`modul3_buchhaltung` …) verwechselt werden kann und der Server es an
 *  einer Stelle erkennen kann.
 */
export function anbieterModulKey(kennung: string): string {
  return `schloss_${kennung}`;
}

/** Umkehrung — aus dem Modul-Schlüssel die Seam-Kennung. */
export function kennungAusModulKey(moduleKey: string): string | null {
  return moduleKey.startsWith("schloss_")
    ? moduleKey.slice("schloss_".length)
    : null;
}

/** Gehört dieser Modul-Schlüssel zu einem Schloss-Anbieter?
 *
 *  Prüft gegen den KATALOG, nicht nur gegen das Präfix: `schloss_erfunden`
 *  wäre sonst „ein Schloss-Modul", obwohl es keinen solchen Anbieter gibt. */
export function istSchlossModul(moduleKey: string): boolean {
  const kennung = kennungAusModulKey(moduleKey);
  return kennung !== null && anbieterFuerKennung(kennung) !== null;
}

export function anbieterFuerSlug(slug: string): SchlossAnbieter | null {
  return SCHLOSS_ANBIETER.find((a) => a.slug === slug) ?? null;
}

export function anbieterFuerKennung(
  kennung: string,
): SchlossAnbieter | null {
  return SCHLOSS_ANBIETER.find((a) => a.kennung === kennung) ?? null;
}

/** Dateiendung des vorliegenden Original-Logos je Marke.
 *
 *  WARUM EINE LISTE UND KEIN FESTES `.svg`: die Hersteller liefern, was sie
 *  liefern. Nuki, Yale, Schlage, LEGIC und igloohome stellen ein SVG bereit,
 *  Brivo, Lockly, KeyNest, Sifely, Ultraloq und Wyze nur ein PNG. Ein fest
 *  angenommenes `.svg` hätte für diese sechs auf eine nicht existierende Datei
 *  gezeigt — die Kachel wäre stumm auf den Markennamen zurückgefallen, und
 *  niemand hätte gesehen, dass das Logo eigentlich da ist.
 *
 *  NUR ORIGINALE: jede Datei kommt von der Website oder dem Presskit des
 *  Herstellers. Marken ohne Eintrag haben kein beschaffbares Original — ihre
 *  Kachel zeigt den Markennamen. Ein nachgezeichnetes Logo wäre kein Original,
 *  sondern eine Fälschung, und die Rechte liegen beim Hersteller. */
const LOGO_ENDUNG: Readonly<Record<string, "svg" | "png">> = {
  igloohome: "svg",
  nuki: "svg",
  ttlock: "png",
  yale: "svg",
  august: "svg",
  tedee: "svg",
  schlage: "svg",
  kwikset: "svg",
  lockly: "png",
  smartthings: "svg",
  akiles: "svg",
  ultraloq: "png",
  wyze: "png",
  keyincode: "png",
  korelock: "png",
  sifely: "png",
  dusaw: "svg",
  yacan: "png",
  thirty_three_lock: "svg",
  dormakaba_oracode: "svg",
  keynest: "png",
  salto_ks: "svg",
  salto_space: "svg",
  assa_abloy_vostio: "svg",
  assa_abloy_credential_service: "svg",
  dormakaba_ambiance: "svg",
  dormakaba_community: "svg",
  visionline: "svg",
  hotek: "png",
  brivo: "png",
  legic_connect: "svg",
};

/** Marken, deren Original-Logo einfarbig WEISS ist (der Hersteller stellt
 *  keine dunkle Fassung öffentlich bereit). Auf der hellen Kachel wäre es
 *  unsichtbar, deshalb bekommt genau dieses Logo eine dunkle Fläche
 *  hinterlegt. Das Logo selbst wird NICHT verändert — Umfärben wäre ein
 *  Eingriff in die Marke. */
export const LOGO_BRAUCHT_DUNKEL: readonly string[] = ["wyze", "dusaw"];

/** Pfad des Logos, oder `null`, wenn für die Marke kein Original vorliegt.
 *
 *  `null` statt eines geratenen Pfads (Wurzel 4): die Kachel zeigt dann den
 *  Markennamen, statt eine 404 zu laden und auf `onError` zu warten. */
export function anbieterLogo(kennung: string): string | null {
  const endung = LOGO_ENDUNG[kennung];
  return endung ? `/schloesser/${kennung}.${endung}` : null;
}

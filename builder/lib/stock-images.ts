// Kuratierte, hochwertige Platzhalter-Fotos (Ferien/Immobilien) für Templates,
// Hero-Vollbilder, Galerien und Leerzustände. KEINE grauen Kästen — der Builder
// soll beim Öffnen sofort wie ein Premium-Template wirken.
//
// Quelle: Unsplash (frei nutzbar). Feste, kuratierte IDs mit Größen-/Crop-
// Parametern. Eine Familie pro Stimmung, damit Templates konsistent wirken.

type Variante = { w: number; h: number };

/** Unsplash-URL mit Crop/Qualität (deterministisch, kein Zufall). */
function u(id: string, { w, h }: Variante): string {
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;
}

// Stimmungs-Sets: Berg/Chalet (warm), Küste/See (hell), Stadt (urban).
const IDS = {
  berg: [
    "1568605114967-8130f3a36994", // Holz-Chalet im Schnee
    "1610641818989-c2051b5e2cfd", // Bergpanorama Fenster
    "1502672260266-1c1ef2d93688", // helles Wohnzimmer Holz
    "1521783988139-89397d761dce", // Kamin / gemütlich
    "1449158743715-0a90ebb6d2d8", // Hütte am Hang
    "1586375300773-8384e3e4916f", // Schlafzimmer warm
  ],
  kueste: [
    "1507525428034-b723cf961d3e", // Strand türkis
    "1505142468610-359e7d316be0", // Küste Klippe
    "1499793983690-e29da59ef1c2", // helle Terrasse Meer
    "1559827260-dc66d52bef19", // luftiges Interieur weiß
    "1471922694854-ff1b63b20054", // Steg / See
    "1520250497591-112f2f40a3f4", // Schlafzimmer hell Meer
  ],
  stadt: [
    "1502672260266-1c1ef2d93688", // modernes Loft
    "1493809842364-78817add7ffb", // Wohnzimmer urban
    "1522708323590-d24dbb6b0267", // Designer-Apartment
    "1556020685-ae41abfc9365", // Küche modern
    "1560448204-e02f11c3d0e2", // Schlafzimmer minimal
    "1505691938895-1758d7feb511", // Arbeitsplatz hell
  ],
  city: [
    "1449824913935-59a10b8d2000", // Skyline
    "1486406146926-c627a92ad1ab", // Hochhäuser
  ],
} as const;

export type Stimmung = "berg" | "kueste" | "stadt";

/** Hero-Vollbild (Querformat) der gewählten Stimmung. */
export function heroImage(stimmung: Stimmung): string {
  return u(IDS[stimmung][0], { w: 2000, h: 1200 });
}

/** Galerie-/Karten-Set einer Stimmung in quadratischem Crop. */
export function gridImages(stimmung: Stimmung, n = 6): string[] {
  return IDS[stimmung].slice(0, n).map((id) => u(id, { w: 800, h: 800 }));
}

/** Querformat-Bild für Über-uns/Feature-Sektionen. */
export function featureImage(stimmung: Stimmung, idx = 1): string {
  const list = IDS[stimmung];
  return u(list[idx % list.length], { w: 1400, h: 1000 });
}

/** Stadt-Skyline (für Stadt-Template-Hero alternativ). */
export function skylineImage(): string {
  return u(IDS.city[0], { w: 2000, h: 1200 });
}

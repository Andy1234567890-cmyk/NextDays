// Kuratierte Premium-Platzhalter-Fotos für den Editor-Canvas (spiegelt
// builder/lib/stock-images.ts). Damit ein neuer Hero/eine neue Galerie sofort
// hochwertig aussieht statt grau.
function u(id: string, w: number, h: number): string {
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&h=${h}&q=80`;
}

const IDS = {
  berg: ["1568605114967-8130f3a36994", "1610641818989-c2051b5e2cfd", "1502672260266-1c1ef2d93688", "1521783988139-89397d761dce", "1449158743715-0a90ebb6d2d8", "1586375300773-8384e3e4916f"],
  kueste: ["1507525428034-b723cf961d3e", "1505142468610-359e7d316be0", "1499793983690-e29da59ef1c2", "1559827260-dc66d52bef19", "1471922694854-ff1b63b20054", "1520250497591-112f2f40a3f4"],
  stadt: ["1502672260266-1c1ef2d93688", "1493809842364-78817add7ffb", "1522708323590-d24dbb6b0267", "1556020685-ae41abfc9365", "1560448204-e02f11c3d0e2", "1505691938895-1758d7feb511"],
} as const;

export type Stimmung = "berg" | "kueste" | "stadt";

export function heroImage(s: Stimmung = "berg"): string {
  return u(IDS[s][0], 2000, 1200);
}
export function gridImages(s: Stimmung = "berg", n = 6): string[] {
  return IDS[s].slice(0, n).map((id) => u(id, 800, 800));
}
export function featureImage(s: Stimmung = "berg", idx = 1): string {
  return u(IDS[s][idx % IDS[s].length], 1400, 1000);
}

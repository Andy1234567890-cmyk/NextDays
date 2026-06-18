// Kuratierte Unsplash-Foto-IDs (stabil) aus dem Design-Kit (app-kit.jsx).
// Dienen als Demo-Bilder, bis echte Objekt-Fotos aus dem Backend kommen.
export const ND_PHOTOS = {
  villa: "1512917774080-9991f1c4c750",
  modern: "1564013799919-ab600027ffc6",
  living: "1600585154340-be6161a56a0c",
  bright: "1502672260266-1c1ef2d93688",
  bed: "1505691938895-1758d7feb511",
  beach: "1507525428034-b723cf961d3e",
  cabin: "1449158743715-0a90ebb6d2d8",
  pool: "1571003123894-1f0594d2b5d9",
  loft: "1493809842364-78817add7ffb",
  kitchen: "1556909212-d5b604d0c90d",
  coast: "1506929562872-bb421503ef21",
  city: "1513584684374-8bab748fbf90",
} as const;

export function PH(id: string, w = 800): string {
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&q=80`;
}

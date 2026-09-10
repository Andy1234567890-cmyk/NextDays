// Icon-Set — 1:1 portiert aus dem Design-Kit (app-kit.jsx NIC).
// Jeder Eintrag ist ein SVG-Pfad-String; bei mehreren Subpaths wird an "M"
// gesplittet (wie im Original). Stroke-Icons (fill=none), 24×24-Viewbox.
import type { ColorValue } from "react-native";
import Svg, { Path } from "react-native-svg";

export const NIC: Record<string, string> = {
  search: "M11 11m-7 0a7 7 0 1014 0 7 7 0 10-14 0M20.5 20.5L16.5 16.5",
  heart:
    "M12 20.5C5.5 16.2 3 12.5 3 9.2 3 6.6 5 4.7 7.4 4.7c1.6 0 3.1.9 3.7 2.2.6-1.3 2.1-2.2 3.7-2.2 2.4 0 4.4 1.9 4.4 4.5 0 3.3-2.5 7-9 11.3z",
  star: "M12 3.2l2.6 5.3 5.8.8-4.2 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.4 9.3l5.8-.8z",
  pin: "M12 21.5s7-6.4 7-11.5a7 7 0 10-14 0c0 5.1 7 11.5 7 11.5zM12 12.2a2.2 2.2 0 100-4.4 2.2 2.2 0 000 4.4",
  cal: "M4 6.5a2 2 0 012-2h12a2 2 0 012 2v12a2 2 0 01-2 2H6a2 2 0 01-2-2zM4 10h16M8 3v4M16 3v4",
  user: "M4 20c1-4 4.4-5.5 8-5.5s7 1.5 8 5.5M12 11.5a3.8 3.8 0 100-7.6 3.8 3.8 0 000 7.6",
  home: "M3 11l9-7.5L21 11M5.5 9.5V20h13V9.5M10 20v-5.5h4V20",
  chat: "M4 5.5h16v10H10l-4.5 4v-4H4zM8.5 10h7M8.5 13h4",
  bell: "M6 16.5V10a6 6 0 0112 0v6.5l1.8 2H4.2zM9.5 21.5a2.5 2.5 0 005 0",
  cog: "M12 9a3 3 0 100 6 3 3 0 000-6M19.4 13l1.5-1-1.6-3.3-1.8.6-1.6-.9-.7-1.9h-3.6l-.7 1.9-1.6.9-1.8-.6L4.6 12l1.5 1v.1l-1.5 1 1.6 3.3 1.8-.6 1.6.9.7 1.9h3.6l.7-1.9 1.6-.9 1.8.6 1.6-3.3-1.5-1z",
  back: "M15 4.5l-7 7.5 7 7.5",
  fwd: "M9 4.5l7 7.5-7 7.5",
  plus: "M12 5v14M5 12h14",
  minus: "M5 12h14",
  filter: "M3 5.5h18M6 12h12M10 18.5h4",
  wifi: "M4 10a13 13 0 0116 0M7 13.5a8 8 0 0110 0M10 17a3 3 0 014 0M12 20.5h.01",
  key: "M15.5 7.5a4 4 0 11-3.6 6L5 20.5 7.5 23M15.5 7.5l2-2M10.5 13l2.5 2.5",
  share: "M16 6l-4-3-4 3M12 3v13M5 12v7a1 1 0 001 1h12a1 1 0 001-1v-7",
  check: "M5 12.5l4.5 4.5L19 7",
  clock: "M12 21a9 9 0 100-18 9 9 0 000 18zM12 8v4.5l3 1.8",
  // Kamera (Foto-Nachweis an Aufgaben). Unbekannte Namen fallen auf `dot`
  // zurück — ein fehlendes Icon wäre also ein STILLER Punkt statt einer
  // Fehlermeldung; deshalb steht jedes benutzte Motiv hier.
  cam: "M4 8.5h3l1.6-2.2h6.8L17 8.5h3v10H4zM12 16.6a3.1 3.1 0 100-6.2 3.1 3.1 0 000 6.2",
  card: "M3 7.5h18v9H3zM3 11h18M7 14h3",
  // ACHTUNG: ein echter Euro-Glyph. NUR verwenden, wo tatsächlich Euro gemeint
  // ist — nicht als Symbol für „Geld/Umsatz". Der Betrieb kann in Kronen,
  // Zloty oder Forint rechnen; dann ist dieses Zeichen eine Falschaussage
  // (CLAUDE.md Wurzel 4). Für Beträge allgemein: `card`.
  euro: "M16 7.5c-1-1.2-2.6-2-4.3-2C8.5 5.5 6 8.4 6 12s2.5 6.5 5.7 6.5c1.7 0 3.3-.8 4.3-2M5 10.5h7M5 13.5h6",
  grid: "M4 4.5h6.5v6.5H4zM13.5 4.5H20v6.5h-6.5zM4 13.5h6.5V20H4zM13.5 13.5H20V20h-6.5z",
  list: "M8 6.5h12M8 12h12M8 17.5h12M4 6.5h.01M4 12h.01M4 17.5h.01",
  map: "M9 4.5L3.5 6.5v13l5.5-2 6 2 5.5-2v-13l-5.5 2-6-2zM9 4.5v13M15 6.5v13",
  send: "M4.5 12l15.5-7.5L14 20l-2-6.5z",
  more: "M5 12h.01M12 12h.01M19 12h.01",
  x: "M6 6l12 12M18 6L6 18",
  moon: "M20.5 14.5a8.5 8.5 0 11-9.8-11.4 6.7 6.7 0 009.8 11.4z",
  sun: "M12 4V2M12 22v-2M5 5L3.5 3.5M20.5 20.5L19 19M4 12H2M22 12h-2M5 19l-1.5 1.5M20.5 3.5L19 5M12 8a4 4 0 100 8 4 4 0 000-8",
  shield: "M12 3l7 2.5v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10v-5z",
  bed: "M3 18v-7m0 0V8h13a4 4 0 014 4v6m-17-7h10m-10 0v3h17M6.5 10.5V9h3v1.5",
  bath: "M5 11V6a2 2 0 012-2h1.5M5 11h15v3a4 4 0 01-4 4H9a4 4 0 01-4-4zM4 21l1-2M20 21l-1-2M8.5 7l1.5-1.5",
  users:
    "M9 11a3.5 3.5 0 100-7 3.5 3.5 0 000 7M2.5 20c.8-3.2 3.3-4.5 6.5-4.5s5.7 1.3 6.5 4.5M16 11.5a3 3 0 000-6M21.5 20c-.6-2.6-2.2-3.8-4.5-4.2",
  sparkle:
    "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM18.5 4.5l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z",
  chart: "M5 20V5M5 20h15M9 16v-4M13 16V8M17 16v-6",
  download: "M12 3v11m0 0l-4-4m4 4l4-4M5 20h14",
  arrowup: "M12 19V6M6 11l6-6 6 6",
  caretdown: "M6 9l6 6 6-6",
  dot: "M12 12h.01",
  // Wechseltag: zwei gegenlaeufige Pfeile — einer geht, einer kommt. Genau das
  // passiert an diesem Tag in derselben Einheit.
  wechsel: "M4 9h13l-3.5-3.5M20 15H7l3.5 3.5",
  // Wechsel UNKLAR: die Einheit einer der beiden Buchungen fehlt, die Frage
  // ist offen. Ein eigenes Motiv, weil „unklar" und „kein Wechsel" zwei
  // verschiedene Aussagen sind (Wurzel 4).
  frage: "M9.2 9a2.9 2.9 0 115.6 1c0 1.9-2.8 2.3-2.8 4M12 18.5h.01",
  globe:
    "M12 3a9 9 0 100 18 9 9 0 000-18M3 12h18M12 3c2.5 2.4 3.8 5.6 3.8 9s-1.3 6.6-3.8 9c-2.5-2.4-3.8-5.6-3.8-9S9.5 5.4 12 3",
  coffee:
    "M4 9h13v4a5 5 0 01-5 5H9a5 5 0 01-5-5zM17 10h2a2 2 0 010 4h-2M7 5.5c0-.8.5-1.2.5-2M11 5.5c0-.8.5-1.2.5-2",
  tv: "M4 6h16v10H4zM9 20h6M8 16l4-3 4 3",
  beach: "M12 21.5s7-6.4 7-11.5a7 7 0 10-14 0c0 5.1 7 11.5 7 11.5zM12 12.2a2.2 2.2 0 100-4.4 2.2 2.2 0 000 4.4",
  cabin: "M3 11l9-7.5L21 11M5.5 9.5V20h13V9.5M10 20v-5.5h4V20",
  city: "M4 20.5V8l6-3v15.5M10 20.5h8V11l-8-3M7 11h.01M7 14h.01M7 17h.01M13.5 13h.01M13.5 16h.01",
  pool: "M4 14c2 0 2-1.5 4-1.5S10 14 12 14s2-1.5 4-1.5S18 14 20 14M4 18c2 0 2-1.5 4-1.5S10 18 12 18s2-1.5 4-1.5S18 18 20 18M8 12V5a2 2 0 014 0M8 8.5h4",
  // Tab-Bar & Sheets (Airbnb-Muster): Koffer für Reisen, Sliders für Filter,
  // Kompass fürs Entdecken, Chevrons für Listenzeilen.
  suitcase: "M4 8.5h16a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1v-9a1 1 0 011-1M9 8.5V6a1.5 1.5 0 011.5-1.5h3A1.5 1.5 0 0115 6v2.5M3 13h18",
  compass: "M12 3a9 9 0 100 18 9 9 0 000-18M15.5 8.5l-2 5-5 2 2-5z",
  sliders: "M4 8h10M18 8h2M4 16h4M12 16h8M16 8m-2 0a2 2 0 104 0 2 2 0 10-4 0M10 16m-2 0a2 2 0 104 0 2 2 0 10-4 0",
  chevron: "M9 5l7 7-7 7",
  bellhop: "M4 19h16M5.5 19v-2a6.5 6.5 0 0113 0v2M12 10.5V8M10 8h4",
  balloon: "M12 15.5c3 0 5.5-2.8 5.5-6.2S15 3 12 3 6.5 5.9 6.5 9.3s2.5 6.2 5.5 6.2zM10.5 15.5h3l-.7 2.5h-1.6zM11 21h2M10.8 18h2.4l.4 3h-3.2z",
  lock: "M6 11h12v9H6zM8.5 11V8a3.5 3.5 0 017 0v3",
  // Passwort-Sichtbarkeit. `eye` = derzeit verborgen (Antippen zeigt),
  // `eyeoff` = derzeit sichtbar (Antippen verbirgt) — das Icon zeigt die
  // AKTION, nicht den Zustand, wie in iOS/Android-Passwortfeldern ueblich.
  eye: "M2.5 12s3.5-6.5 9.5-6.5S21.5 12 21.5 12s-3.5 6.5-9.5 6.5S2.5 12 2.5 12M12 14.6a2.6 2.6 0 100-5.2 2.6 2.6 0 000 5.2",
  eyeoff:
    "M4 4l16 16M9.9 5.7A9.6 9.6 0 0112 5.5c6 0 9.5 6.5 9.5 6.5a17 17 0 01-2.4 3.3M6.4 8.2A17 17 0 002.5 12S6 18.5 12 18.5a9 9 0 003.2-.6M10.2 10.3a2.6 2.6 0 003.6 3.6",
  logout: "M15 5H6a1 1 0 00-1 1v12a1 1 0 001 1h9M18.5 12H10M15.5 8.5l3.5 3.5-3.5 3.5",
  info: "M12 21a9 9 0 100-18 9 9 0 000 18M12 11v5.5M12 7.6h.01",
  doc: "M6 3.5h8l4 4V20.5H6zM14 3.5V8h4M9 12.5h6M9 16h4",
  hand: "M8.5 12V5.5a1.5 1.5 0 013 0V11m0-.5V4.5a1.5 1.5 0 113 0V11m0-.5v-2a1.5 1.5 0 113 0V15a6 6 0 01-6 6h-1a5 5 0 01-5-5v-3.5a1.5 1.5 0 013 0",
};

export type IconName = keyof typeof NIC | string;

export function Icon({
  n,
  s = 22,
  sw = 1.7,
  c = "currentColor",
  fill,
}: {
  n: IconName;
  s?: number;
  sw?: number;
  c?: ColorValue;
  // Gefüllte Variante (gesetztes Herz, Stern). Ohne `fill` bleibt das Icon
  // eine reine Outline — das ist der Normalfall.
  fill?: ColorValue;
}) {
  const d = NIC[n] || NIC.dot;
  // An "M" splitten → mehrere Subpaths (wie im Original-Kit).
  const subpaths = d.split("M").filter(Boolean);
  return (
    <Svg width={s} height={s} viewBox="0 0 24 24" fill="none">
      {subpaths.map((sp, i) => (
        <Path
          key={i}
          d={"M" + sp}
          stroke={c}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill={fill ?? "none"}
        />
      ))}
    </Svg>
  );
}

// Illustrations-Kacheln für Reiseziel-Vorschläge: farbige Strichzeichnungen
// auf getönter Fläche, ein Motiv je Zielart (Küste, Berge, Stadt, Altstadt,
// Insel, See, Standort). Eigenes Set — bewusst generische Motive statt
// nachgezeichneter Wahrzeichen.
//
// Welches Motiv ein Ort bekommt, entscheidet `motivFuerOrt`: erst über
// bekannte Stichworte im Namen, sonst über eine stabile Streuung (derselbe
// Ort bekommt immer dasselbe Bild — kein Flackern beim Neu-Rendern).
import { View } from "react-native";
import Svg, { Circle, Path, Rect } from "react-native-svg";

export type Motiv = "kueste" | "berge" | "stadt" | "altstadt" | "insel" | "see" | "standort";

type Farben = { flaeche: string; strich: string; akzent: string };

// Tönung je Motiv — hell, damit die Strichzeichnung trägt.
const FARBEN: Record<Motiv, Farben> = {
  kueste: { flaeche: "#EAF4F7", strich: "#2C7A96", akzent: "#F0A868" },
  berge: { flaeche: "#EDF2EC", strich: "#3F6B4A", akzent: "#8FB08C" },
  stadt: { flaeche: "#F1F0F6", strich: "#4A4A7A", akzent: "#A9A5C9" },
  altstadt: { flaeche: "#FAF1E8", strich: "#B26A3C", akzent: "#E0A46B" },
  insel: { flaeche: "#EAF6F0", strich: "#2F8567", akzent: "#7FC3A0" },
  see: { flaeche: "#EDF3FA", strich: "#3B6EA5", akzent: "#8FB6DD" },
  standort: { flaeche: "#EEF3FC", strich: "#3B6EA5", akzent: "#7FA8E0" },
};

// Stichworte, die ein Motiv sicher bestimmen. Bewusst knapp gehalten: was
// nicht erkannt wird, bekommt ein neutrales Motiv statt einer Falschaussage.
const STICHWORTE: [RegExp, Motiv][] = [
  [/strand|beach|küste|kuste|coast|mar |playa|plage|sylt|rügen|rugen|usedom|ostsee|nordsee/i, "kueste"],
  [/alp|berg|mountain|tirol|dolomit|ski|schwarzwald|harz|allgäu|allgau|zell am see/i, "berge"],
  [/insel|island|isla|mallorca|ibiza|kreta|korfu|rhodos|madeira|teneriffa|fuerteventura/i, "insel"],
  [/see$|see |lake|lago|bodensee|chiemsee|gardasee|starnberg/i, "see"],
  [/altstadt|old town|historisch|dorf|village|burg|schloss/i, "altstadt"],
];

const REIHENFOLGE: Motiv[] = ["stadt", "kueste", "berge", "altstadt", "insel", "see"];

/** Motiv für einen Ortsnamen — stabil für denselben Namen. */
export function motivFuerOrt(ort: string): Motiv {
  for (const [muster, motiv] of STICHWORTE) {
    if (muster.test(ort)) return motiv;
  }
  // Stabile Streuung über die Zeichensumme: gleicher Ort → gleiches Motiv.
  let summe = 0;
  for (let i = 0; i < ort.length; i++) summe += ort.charCodeAt(i);
  return REIHENFOLGE[summe % REIHENFOLGE.length];
}

export function PlaceIllustration({ motiv, size = 52 }: { motiv: Motiv; size?: number }) {
  const f = FARBEN[motiv];
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: 14,
        backgroundColor: f.flaeche,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      <Svg width={size * 0.68} height={size * 0.68} viewBox="0 0 32 32" fill="none">
        {zeichne(motiv, f)}
      </Svg>
    </View>
  );
}

function zeichne(motiv: Motiv, f: Farben) {
  const strich = {
    stroke: f.strich,
    strokeWidth: 1.6,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    fill: "none",
  };

  switch (motiv) {
    case "kueste":
      return (
        <>
          {/* Sonne über Wasser mit Wellenlinien */}
          <Circle cx={22} cy={9} r={4} fill={f.akzent} />
          <Path d="M3 19c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2 2.5-2 5-2" {...strich} />
          <Path d="M3 25c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2 2.5-2 5-2" {...strich} />
          <Path d="M6 15c1.6-3.4 4-5 6.5-5" {...strich} />
        </>
      );
    case "berge":
      return (
        <>
          {/* Zwei Gipfel, vorderer mit Schneekappe */}
          <Circle cx={24} cy={8} r={3} fill={f.akzent} />
          <Path d="M2 25l8-13 5 8" {...strich} />
          <Path d="M11 25l7-11 8 11z" {...strich} />
          <Path d="M15.5 18.5c1.3 1 3.7 1 5 0" {...strich} />
          <Path d="M2 25h28" {...strich} />
        </>
      );
    case "stadt":
      return (
        <>
          {/* Häuserzeile unterschiedlicher Höhe mit Fensterrhythmus */}
          <Rect x={4} y={13} width={8} height={13} rx={1} {...strich} />
          <Rect x={13} y={8} width={7} height={18} rx={1} {...strich} />
          <Rect x={21} y={16} width={7} height={10} rx={1} fill={f.akzent} stroke="none" />
          <Path d="M6.5 16.5h3M6.5 20h3M15 11.5h3M15 15h3M15 18.5h3" {...strich} />
          <Path d="M2 26h28" {...strich} />
        </>
      );
    case "altstadt":
      return (
        <>
          {/* Giebelhäuser mit Torbogen */}
          <Path d="M4 26V15l5-4 5 4v11" {...strich} />
          <Path d="M14 26V12l6-4 6 4v14" {...strich} />
          <Path d="M17.5 26v-6a2.5 2.5 0 015 0v6" fill={f.akzent} stroke="none" />
          <Path d="M7.5 17.5h3v3h-3z" {...strich} />
          <Path d="M2 26h28" {...strich} />
        </>
      );
    case "insel":
      return (
        <>
          {/* Palme auf Sandbank */}
          <Path d="M16 24v-9" {...strich} />
          <Path d="M16 15c-3-3-6-2.5-7.5-1 2-3.5 5.5-3.5 7.5-1" fill={f.akzent} stroke="none" />
          <Path d="M16 15c3-3 6-2.5 7.5-1-2-3.5-5.5-3.5-7.5-1" fill={f.akzent} stroke="none" />
          <Path d="M16 13c0-3 1.5-5 4-5.5-2 2-2.5 3.5-2.5 5.5" {...strich} />
          <Path d="M6 24c3 0 4-1.5 10-1.5S23 24 26 24" {...strich} />
          <Path d="M3 28c3 0 3-1.5 6-1.5S12 28 15 28s3-1.5 6-1.5S24 28 27 28" {...strich} />
        </>
      );
    case "see":
      return (
        <>
          {/* Segelboot auf ruhigem Wasser, Ufer im Hintergrund */}
          <Path d="M4 18l5-6 4 6" {...strich} />
          <Path d="M16 20V8l7 12z" fill={f.akzent} stroke="none" />
          <Path d="M14 20h11l-2 4H16z" {...strich} />
          <Path d="M3 27c3 0 3-1.5 6-1.5S12 27 15 27s3-1.5 6-1.5S24 27 27 27" {...strich} />
        </>
      );
    case "standort":
      return (
        <>
          {/* Navigationspfeil — „In der Nähe" */}
          <Path d="M27 6L5 15l9 3 3 9z" fill={f.akzent} stroke="none" />
          <Path d="M27 6L5 15l9 3 3 9z" {...strich} />
          <Path d="M27 6l-13 12" {...strich} />
        </>
      );
  }
}

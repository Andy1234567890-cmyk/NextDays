// Theme-Context: stellt Palette (Light/Dark), Akzentfarbe und Dichte bereit.
// Entspricht den Tweaks im Design-Mockup (Akzent, Dark Mode, Dichte).
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useColorScheme } from "react-native";

import {
  darkPalette,
  density as densityMap,
  fonts,
  lightPalette,
  radius,
  shadow,
  type,
  type Density,
  type Marke,
  type Palette,
} from "@/theme/tokens";

type ThemeValue = {
  palette: Palette;
  dark: boolean;
  accent: string;
  /** Name, Logo und Schwester-App dieser Marke (theme/marke.ts). */
  marke: Marke;
  density: { pad: number; gap: number };
  radius: typeof radius;
  shadow: typeof shadow;
  type: typeof type;
  fonts: typeof fonts;
  setAccent: (c: string) => void;
  setDark: (v: boolean) => void;
  setDensity: (d: Density) => void;
};

const ThemeContext = createContext<ThemeValue | null>(null);

// `marke` ist PFLICHT: die Akzentfarbe hat keinen Default mehr, sonst wäre sie
// ein erfundener Ersatzwert (Wurzel 4). Der App-Root reicht sie durch.
export function ThemeProvider({ marke, children }: { marke: Marke; children: ReactNode }) {
  const system = useColorScheme();
  const [accent, setAccent] = useState(marke.akzent);
  const [darkOverride, setDark] = useState<boolean | null>(null);
  const [densityKey, setDensity] = useState<Density>("regular");

  const dark = darkOverride ?? system === "dark";

  const value = useMemo<ThemeValue>(() => {
    const palette = dark ? darkPalette(accent) : lightPalette(accent);
    return {
      palette,
      dark,
      accent,
      marke,
      density: densityMap[densityKey],
      radius,
      shadow,
      type,
      fonts,
      setAccent,
      setDark: (v: boolean) => setDark(v),
      setDensity,
    };
  }, [dark, accent, marke, densityKey]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme muss innerhalb von ThemeProvider genutzt werden.");
  return ctx;
}

// Theme-Context: stellt Palette (Light/Dark), Akzentfarbe und Dichte bereit.
// Entspricht den Tweaks im Design-Mockup (Akzent, Dark Mode, Dichte).
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { useColorScheme } from "react-native";

import {
  ACCENT_DEFAULT,
  darkPalette,
  density as densityMap,
  fonts,
  lightPalette,
  radius,
  shadow,
  type,
  type Density,
  type Palette,
} from "@/theme/tokens";

type ThemeValue = {
  palette: Palette;
  dark: boolean;
  accent: string;
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

export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [accent, setAccent] = useState(ACCENT_DEFAULT);
  const [darkOverride, setDark] = useState<boolean | null>(null);
  const [densityKey, setDensity] = useState<Density>("regular");

  const dark = darkOverride ?? system === "dark";

  const value = useMemo<ThemeValue>(() => {
    const palette = dark ? darkPalette(accent) : lightPalette(accent);
    return {
      palette,
      dark,
      accent,
      density: densityMap[densityKey],
      radius,
      shadow,
      type,
      fonts,
      setAccent,
      setDark: (v: boolean) => setDark(v),
      setDensity,
    };
  }, [dark, accent, densityKey]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme muss innerhalb von ThemeProvider genutzt werden.");
  return ctx;
}

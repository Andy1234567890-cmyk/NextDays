// Gemeinsamer Story-Decorator für die Mobile-UI-Bausteine: stellt den
// ThemeProvider bereit (die kit-Komponenten lesen useTheme) und rahmt die
// react-native-web-Ausgabe in einer schmalen „Geräte"-Bühne mit App-Grund.
import type { ReactNode } from "react";
import { View } from "react-native";

import { ThemeProvider, useTheme } from "./ThemeProvider";

function Stage({ children, pad = 20 }: { children: ReactNode; pad?: number }) {
  const t = useTheme();
  return (
    <View style={{ backgroundColor: t.palette.bg, padding: pad, maxWidth: 390, gap: 14 }}>
      {children}
    </View>
  );
}

export function withMobileTheme(pad?: number) {
  return (Story: () => ReactNode) => (
    <ThemeProvider>
      <Stage pad={pad}>
        <Story />
      </Stage>
    </ThemeProvider>
  );
}

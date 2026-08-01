// Splash-Overlay: zeigt beim App-Start das Marken-Logo und blendet sich nach
// kurzer Zeit sanft aus (über dem nativen LaunchScreen, damit der Übergang ins
// App-UI ohne Flackern wirkt). Logo und Grundfarbe kommen aus dem Theme —
// nichts ist hier hartkodiert, damit beide Apps dieselbe Datei nutzen können.
//
// SCHWESTERDATEI: die gleichnamige Datei der Schwester-App — identisch halten.
import { useEffect, useRef, useState } from "react";
import { Animated, Image, StyleSheet, View } from "react-native";

import { useTheme } from "@/theme/ThemeProvider";

export function Splash() {
  const t = useTheme();
  const opacity = useRef(new Animated.Value(1)).current;
  const [done, setDone] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 320, useNativeDriver: true }).start(() => setDone(true));
    }, 1000);
    return () => clearTimeout(timer);
  }, [opacity]);

  if (done) return null;

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.wrap, { backgroundColor: t.palette.bg, opacity }]}
    >
      <View style={styles.center}>
        <Image source={t.marke.logo} style={styles.logo} resizeMode="contain" />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { zIndex: 100 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 48 },
  logo: { width: "100%", height: 250 },
});

// Splash-Overlay: zeigt beim App-Start das NextDays-Logo auf cremigem Grund
// und blendet sich nach kurzer Zeit sanft aus (über dem nativen LaunchScreen,
// damit der Übergang ins App-UI ohne Flackern wirkt).
import { useEffect, useRef, useState } from "react";
import { Animated, Image, StyleSheet, View } from "react-native";

import { lightPalette } from "@/theme/tokens";

const BG = lightPalette("#C42B3A").bg;

export function Splash() {
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
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.wrap, { opacity }]}>
      <View style={styles.center}>
        <Image source={require("@/assets/img/Logo_transparent.png")} style={styles.logo} resizeMode="contain" />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: BG, zIndex: 100 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 48 },
  logo: { width: "100%", height: 250 },
});

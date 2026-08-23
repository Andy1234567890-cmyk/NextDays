// Splash-Overlay: das Logo fliegt von links in die Mitte, dann blendet sich das
// Overlay aus (über dem nativen LaunchScreen, damit der Übergang ins App-UI ohne
// Flackern wirkt).
//
// Die Bewegung ist der Grund, warum hier ein VEKTOR-Lockup steht und kein PNG:
// Chevrons und Wortmarke sollen getrennt einfliegen, und in einem PNG sitzen
// beide in denselben Pixeln. `LogoVektor` liefert sie als zwei Komponenten aus
// denselben Figma-Pfaden.
//
// KEINE SCHWESTERDATEI mehr: myBestDays behält sein ruhiges Einblenden. Der
// CI-Job `mobile-konsistenz` hat den Eintrag deshalb verloren — die Animation
// ist UI und darf nach ADR-0016 divergieren („Mut zur Duplikation"), anders als
// alles, was Zahlen, Ziele oder Zustände bestimmt.
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from "react-native";

import { LOCKUP_HOEHE, LogoChevron, LogoWortmarke } from "@/components/ui/LogoVektor";
import { useTheme } from "@/theme/ThemeProvider";

// Höhe des Lockups auf dem Splash. Die Breiten rechnet `LogoVektor` daraus.
const HOEHE = 44;
// Die Wortmarke startet später als die Chevrons — sie folgt ihnen, statt
// gemeinsam mit ihnen anzukommen. Ohne diesen Versatz wäre die Trennung in zwei
// Teile nicht sichtbar und der ganze Vektor-Aufwand ohne Wirkung.
const VERSATZ_MS = 130;
const FLUG_MS = 620;
// Standzeit NACH dem Flug, damit das fertige Logo einen Moment ruhig steht.
const HALTEN_MS = 420;
const AUSBLENDEN_MS = 320;

export function Splash() {
  const t = useTheme();
  const { width } = useWindowDimensions();
  // Ein Wert je Teil: 0 = am Startpunkt links, 1 = an seinem Platz.
  const chevron = useRef(new Animated.Value(0)).current;
  const wort = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const [done, setDone] = useState(false);

  useEffect(() => {
    const flug = (wert: Animated.Value, verzoegerung: number) =>
      Animated.timing(wert, {
        toValue: 1,
        duration: FLUG_MS,
        delay: verzoegerung,
        // Schnell los, sanft ankommen — ein linearer Flug sieht mechanisch aus,
        // und ein Federn am Ende ließe das Logo nachwackeln.
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      });

    const lauf = Animated.sequence([
      Animated.parallel([flug(chevron, 0), flug(wort, VERSATZ_MS)]),
      Animated.delay(HALTEN_MS),
      Animated.timing(opacity, {
        toValue: 0,
        duration: AUSBLENDEN_MS,
        useNativeDriver: true,
      }),
    ]);
    lauf.start(({ finished }) => {
      // Nur bei regulärem Ende schließen: ein abgebrochener Lauf (Unmount)
      // dürfte den Zustand nicht mehr anfassen.
      if (finished) setDone(true);
    });
    return () => lauf.stop();
  }, [chevron, wort, opacity]);

  if (done) return null;

  // Startpunkt: eine halbe Bildschirmbreite links vom Ziel — weit genug, dass
  // beide Teile außerhalb beginnen, ohne dass die Strecke auf einem Tablet
  // lächerlich lang wird.
  const weg = -(width / 2 + 120);
  const schieben = (wert: Animated.Value) => ({
    transform: [{ translateX: wert.interpolate({ inputRange: [0, 1], outputRange: [weg, 0] }) }],
    // Mit-Einblenden, damit die Teile nicht als harte Kanten hereinfahren.
    opacity: wert,
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.wrap, { backgroundColor: t.palette.bg, opacity }]}
    >
      <View style={styles.center}>
        {/* Eine Zeile, beide Teile in ihrer Lockup-Reihenfolge. Der Abstand ist
            der Zwischenraum der Vorlage (x 34 → 55.9, auf HOEHE skaliert). */}
        <Animated.View style={schieben(chevron)}>
          <LogoChevron hoehe={HOEHE} negativ={t.dark} />
        </Animated.View>
        <Animated.View style={[schieben(wort), { marginLeft: (HOEHE / LOCKUP_HOEHE) * 18 }]}>
          <LogoWortmarke hoehe={HOEHE} negativ={t.dark} />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { zIndex: 100 },
  center: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
});

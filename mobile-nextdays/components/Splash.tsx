// Splash-Overlay: das Logo fliegt von links in die Mitte, steht kurz still und
// blendet sich aus (über dem nativen LaunchScreen, damit der Übergang ins
// App-UI ohne Flackern wirkt).
//
// SCHWESTERDATEI: die gleichnamige Datei der Schwester-Apps — identisch halten.
// Sie stand bis zum 09.09.2026 NICHT unter CI-Aufsicht, und genau das ist
// schiefgegangen: myNextDays und die Eigentümer-App bekamen den Einflug aus dem
// Vektor-Lockup (1490 ms), myBestDays behielt ein Standbild aus einem PNG
// (1320 ms). Zwei verschiedene Startbilder in drei Apps derselben Plattform —
// gemeldet als „läuft zu schnell und ist nicht gleichmäßig in allen Apps".
// Die Bewegung ist deshalb JETZT geteilte Logik, kein UI-Geschmack mehr
// (ADR-0016 gilt weiter für kit/patterns/Icon, nicht für diese Datei).
//
// Was die Apps unterscheiden DÜRFEN, liefert `components/ui/SplashLogo.tsx`:
// myNextDays und die Eigentümer-App trennen Chevron und Wortmarke (dafür gibt
// es eine Vektor-Vorlage), myBestDays hat nur PNGs und fliegt als ein Stück
// ein. Die Zeitachse hier ist in allen drei Fällen dieselbe.
import { useEffect, useRef, useState } from "react";
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from "react-native";

import { SplashLogoTeile } from "@/components/ui/SplashLogo";
import { useTheme } from "@/theme/ThemeProvider";

// ── Zeitachse (gemeinsam, Summe ~2200 ms) ───────────────────────────────────
// Vorher lag sie bei ~1500 ms und wirkte gehetzt. Die Werte hängen zusammen:
// wer FLUG_MS ändert, ohne HALTEN_MS mitzuziehen, bekommt eine Bewegung, die
// ankommt und sofort verschwindet.
const FLUG_MS = 900;
// Das zweite Teil startet später als das erste — es FOLGT ihm, statt gemeinsam
// anzukommen. Ohne den Versatz ist die Zweiteilung nicht zu sehen und der
// Vektor-Aufwand ohne Wirkung. Bei einteiligen Logos (myBestDays) bleibt er
// wirkungslos, weil es kein zweites Teil gibt.
const VERSATZ_MS = 200;
// Standzeit NACH dem Flug, damit das fertige Logo einen Moment ruhig steht.
const HALTEN_MS = 650;
const AUSBLENDEN_MS = 450;

export function Splash() {
  const t = useTheme();
  const { width } = useWindowDimensions();
  // Ein Wert je Teil: 0 = am Startpunkt links, 1 = an seinem Platz. Auch eine
  // einteilige Marke nutzt `erst`; `zweit` läuft dann leer mit.
  const erst = useRef(new Animated.Value(0)).current;
  const zweit = useRef(new Animated.Value(0)).current;
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
      Animated.parallel([flug(erst, 0), flug(zweit, VERSATZ_MS)]),
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
  }, [erst, zweit, opacity]);

  if (done) return null;

  // Startpunkt: eine halbe Bildschirmbreite links vom Ziel — weit genug, dass
  // die Teile außerhalb beginnen, ohne dass die Strecke auf einem Tablet
  // lächerlich lang wird.
  const weg = -(width / 2 + 120);
  const schieben = (wert: Animated.Value) => ({
    transform: [{ translateX: wert.interpolate({ inputRange: [0, 1], outputRange: [weg, 0] }) }],
    // Mit-Einblenden, damit die Teile nicht als harte Kanten hereinfahren.
    opacity: wert,
  });

  // `marke` kommt aus dem Theme und wird durchgereicht, statt dass der Adapter
  // sie selbst importiert: Markenwerte fliessen ueber den ThemeProvider, und
  // so bleibt der Adapter frei von einem zweiten Bezugsweg auf theme/marke.ts.
  const teile = SplashLogoTeile({ negativ: t.dark, marke: t.marke });

  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, styles.wrap, { backgroundColor: t.palette.bg, opacity }]}
    >
      <View style={styles.center}>
        {teile.map((teil, i) => (
          <Animated.View
            key={teil.key}
            style={[schieben(i === 0 ? erst : zweit), i > 0 && { marginLeft: teil.abstand ?? 0 }]}
          >
            {teil.knoten}
          </Animated.View>
        ))}
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

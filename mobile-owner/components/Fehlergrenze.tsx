// SCHWESTERDATEI: die gleichnamige Datei der Schwester-App — byte-identisch halten.
//
// Die Auffangschale um den ganzen Baum.
//
// Ohne sie ist JEDER unbehandelte Fehler im Release ein harter Prozessabbruch:
// React wirft den Baum weg, die Activity stirbt, und Android zaehlt einen
// Absturz. Genau daraus baut Samsungs Geraetewartung ihre Meldung „stuerzt
// haeufig ab" — ohne dass irgendwo eine Spur bliebe, warum.
//
// Sie ersetzt keine Fehlerbehandlung an der Quelle. Sie ist das Netz darunter:
// was durchrutscht, wird SICHTBAR statt toedlich.
//
// WAS DER KUNDE SIEHT
// ===================
// Im Release NUR eine ruhige Meldung und einen Knopf — kein Stacktrace, keine
// Fehlermeldung, keine Kennung. Technische Angaben sind fuer den Betrieb
// wertlos, wirken wie ein kaputtes Produkt und koennen interne Pfade,
// Feldnamen oder Endpunkte verraten. Die Diagnose gehoert ins Protokoll, nicht
// auf den Bildschirm des Kunden.
//
// Im Debug-Build (`__DEV__`) steht die Meldung dagegen vollstaendig da — dort
// sieht sie nur, wer entwickelt.
import { Component, type ErrorInfo, type ReactNode } from "react";
import { Appearance, Pressable, ScrollView, Text, View } from "react-native";

import { protokolliereAbsturz } from "@/lib/absturzmeldung";

type Props = { children: ReactNode };
type State = { fehler: Error | null };

export class Fehlergrenze extends Component<Props, State> {
  state: State = { fehler: null };

  static getDerivedStateFromError(fehler: Error): State {
    return { fehler };
  }

  componentDidCatch(fehler: Error, info: ErrorInfo) {
    protokolliereAbsturz(fehler, info?.componentStack ?? undefined);
  }

  render() {
    const { fehler } = this.state;
    if (!fehler) return this.props.children;
    // FARBEN OHNE `useTheme` — mit Absicht, und nicht aus Bequemlichkeit.
    //
    // Das hier ist die letzte Auffangstelle. Sie faengt auch einen Absturz IM
    // Theme oder in einem Provider darueber; haenge sie an den Context, faellt
    // sie mit ihm. `Appearance` kommt direkt aus React Native und braucht
    // weder Hook (die Klasse hat keinen) noch App-Code, der gerade gestorben
    // sein koennte. Die Werte sind deshalb ausnahmsweise hart, entsprechen
    // aber `palette.bg`/`palette.ink` beider Faelle aus theme/tokens.ts.
    //
    // Vorher stand hier ein festes `backgroundColor: "#fff"`, und die beiden
    // <Text> waren die EINZIGEN der ganzen App ohne `color`. Ohne `color`
    // setzt React Native keinen ForegroundColorSpan, die Schrift kommt dann
    // aus dem Activity-Theme (DayNight) — im Dunkelmodus also fast weiss auf
    // dem fest weissen Grund. Ausgerechnet der Bildschirm nach einem Absturz
    // war damit leer, bis auf den Knopf.
    const dunkel = Appearance.getColorScheme() === "dark";
    const grund = dunkel ? "#141210" : "#FFFFFF";
    const schrift = dunkel ? "#F4F1ED" : "#181614";

    return (
      <View
        style={{
          flex: 1,
          padding: 24,
          justifyContent: "center",
          backgroundColor: grund,
        }}
      >
        <Text
          style={{
            fontSize: 18,
            fontWeight: "600",
            marginBottom: 8,
            color: schrift,
          }}
        >
          Da ist etwas schiefgegangen
        </Text>
        <Text
          style={{
            marginBottom: 24,
            opacity: 0.7,
            lineHeight: 20,
            color: schrift,
          }}
        >
          Die App konnte nicht weiterarbeiten. Bitte versuche es erneut — deine
          Daten sind gespeichert.
        </Text>
        {/* Nur fuer Entwickler. Im Release ist dieser Block nicht vorhanden. */}
        {__DEV__ ? (
          <ScrollView style={{ maxHeight: 220, marginBottom: 16 }}>
            <Text
              style={{
                fontFamily: "monospace",
                fontSize: 12,
                opacity: 0.6,
                color: schrift,
              }}
            >
              {String(fehler?.stack ?? fehler?.message ?? fehler)}
            </Text>
          </ScrollView>
        ) : null}
        <Pressable
          onPress={() => this.setState({ fehler: null })}
          style={{
            // Umgekehrt zum Grund, damit der Knopf in beiden Faellen traegt.
            backgroundColor: schrift,
            borderRadius: 999,
            paddingVertical: 14,
            alignItems: "center",
          }}
        >
          <Text style={{ color: grund, fontWeight: "600" }}>
            Erneut versuchen
          </Text>
        </Pressable>
      </View>
    );
  }
}

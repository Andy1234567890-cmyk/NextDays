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
import { Pressable, ScrollView, Text, View } from "react-native";

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
    return (
      <View
        style={{
          flex: 1,
          padding: 24,
          justifyContent: "center",
          backgroundColor: "#fff",
        }}
      >
        <Text style={{ fontSize: 18, fontWeight: "600", marginBottom: 8 }}>
          Da ist etwas schiefgegangen
        </Text>
        <Text style={{ marginBottom: 24, opacity: 0.7, lineHeight: 20 }}>
          Die App konnte nicht weiterarbeiten. Bitte versuche es erneut — deine
          Daten sind gespeichert.
        </Text>
        {/* Nur fuer Entwickler. Im Release ist dieser Block nicht vorhanden. */}
        {__DEV__ ? (
          <ScrollView style={{ maxHeight: 220, marginBottom: 16 }}>
            <Text style={{ fontFamily: "monospace", fontSize: 12, opacity: 0.6 }}>
              {String(fehler?.stack ?? fehler?.message ?? fehler)}
            </Text>
          </ScrollView>
        ) : null}
        <Pressable
          onPress={() => this.setState({ fehler: null })}
          style={{
            backgroundColor: "#111",
            borderRadius: 999,
            paddingVertical: 14,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "600" }}>
            Erneut versuchen
          </Text>
        </Pressable>
      </View>
    );
  }
}

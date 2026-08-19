// Buchung als eigener Screen — der Einstieg über den Deep-Link
// `mynextdays://reservierungen/:id` (Mail, Push, geteilter Link).
//
// Der Screen zeigt NUR das Buchungs-Panel. Bis August 2026 war er eine zweite,
// eigenständige Detailansicht neben dem Web-Slider: dieselben Daten, andere
// Anordnung, andere Reife — die Aktionen (Check-in, Check-out, Storno,
// Zusatzleistungen) fehlten hier komplett, und der Gast-Kontakt sowie die
// Rechnung standen nicht einmal im Typ. Zwei Oberflächen für dieselbe Sache
// heißt: jede Änderung zweimal pflegen, und die schwächere fällt still zurück.
// Deshalb gibt es jetzt genau EINEN Baustein
// (`components/buchung/BuchungsPanel`), und dieser Screen ist sein Rahmen für
// den Deep-Link-Fall.
//
// Aus Kalender, Buchungsliste und Übersicht wird dasselbe Panel dagegen ÜBER
// der Liste geöffnet, ohne zu navigieren — dort soll der Zusammenhang stehen
// bleiben, aus dem man kommt.
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback } from "react";
import { View } from "react-native";

import { BuchungsPanel } from "@/components/buchung/BuchungsPanel";
import { heuteIso } from "@/lib/kalendertag";
import type { RootStackParamList } from "@/navigation/types";
import { useTheme } from "@/theme/ThemeProvider";

export default function ReservationDetail() {
  const t = useTheme();
  const route = useRoute<RouteProp<RootStackParamList, "ReservationDetail">>();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { id } = route.params;

  // Schließen heißt hier zurück. Kann der Stack nicht zurück (Kaltstart über
  // den Deep-Link — es gibt keine Vorgeschichte), führt es in die Buchungen,
  // statt auf einer leeren Fläche zu enden.
  const schliessen = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.replace("HostTabs", { screen: "Reservations" });
  }, [navigation]);

  const zumThread = useCallback(
    (threadId: string) =>
      navigation.replace("HostTabs", {
        screen: "HostInbox",
        params: { threadId },
      }),
    [navigation],
  );

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg }}>
      <BuchungsPanel
        reservationId={id}
        heuteIso={heuteIso()}
        onClose={schliessen}
        onNachrichtOeffnen={zumThread}
      />
    </View>
  );
}

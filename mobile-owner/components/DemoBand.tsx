// Das Band über der Vorführung (0407) — Pendant zu web/components/demo-band.tsx.
//
// WARUM ES DAS BRAUCHT: Der Vorführ-Zugang darf nichts speichern; `demo_gate`
// im Backend lehnt jede schreibende Anfrage mit 405 ab. Ohne diesen Hinweis
// erlebt man das als DEFEKT — man tippt eine Antwort, drückt senden, nichts
// passiert. Live so aufgefallen (19.08.2026): „hier stimmt was nicht, wird nicht
// geladen", während in Wahrheit der Schutz griff.
//
// WARUM DURCHGEHEND und nicht einmal beim Start: wer sich zehn Minuten durch
// Kalender und Posteingang klickt, hat einen Einstiegstext längst vergessen. Das
// Band beantwortet die Frage in dem Moment, in dem sie entsteht.
//
// WARUM OHNE „Schließen": geschlossen wäre es genau in der Sitzung weg, in der
// es gebraucht wird. Deshalb flach und ruhig statt wegklickbar.
import { View } from "react-native";

import { Icon } from "@/components/ui/Icon";
import { Row, Txt } from "@/components/ui/kit";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/theme/ThemeProvider";

export function DemoBand() {
  const t = useTheme();
  const { me } = useAuth();
  if (!me?.is_demo) return null;
  return (
    <View
      // `note`, nicht `alert`: eine dauerhafte Randbedingung, keine Meldung auf
      // ein Ereignis — sonst unterbricht der Screenreader jeden Seitenwechsel.
      accessibilityRole="summary"
      style={{
        backgroundColor: t.palette.surface2,
        borderBottomWidth: 1,
        borderBottomColor: t.palette.line,
        paddingHorizontal: 16,
        paddingVertical: 8,
      }}
    >
      <Row style={{ gap: 8, justifyContent: "center" }}>
        <Icon n="lock" s={14} sw={2} c={t.palette.soft} />
        <Txt v="xs" soft style={{ flexShrink: 1 }}>
          Vorführung — ansehen ja, speichern nein.
        </Txt>
      </Row>
    </View>
  );
}

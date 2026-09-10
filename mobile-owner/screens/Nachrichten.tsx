// Nachrichten — ein Gespräch je Objekt (0611, ADR-0029).
//
// OBJEKTE OHNE GESPRÄCH stehen mit in der Liste, mit leerem `thread_id`. Ohne
// sie gäbe es für ein Haus, über das noch nie gesprochen wurde, keinen Weg,
// eines zu beginnen — der Eigentümer sähe eine leere Seite ohne Knopf. Der
// Faden entsteht serverseitig mit der ersten Nachricht.
import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, TouchableOpacity, View } from "react-native";

import { useFocusEffect } from "@react-navigation/native";

import { Icon } from "@/components/ui/Icon";
import { Kachel, Spinner, Txt } from "@/components/ui/kit";
import { useT } from "@/contexts/SprachContext";
import { tagesLabel } from "@/lib/chat-anzeige";
import { getChatFaeden, type ChatFaden } from "@/lib/chat";
import { KARTE_ABSTAND } from "@/theme/flaechen";
import { useTheme } from "@/theme/ThemeProvider";

type Props = {
  navigation: {
    navigate: {
      (ziel: "Chat", params: { propertyId: string; threadId: string }): void;
      (ziel: "ChatGeraete"): void;
    };
  };
};

export function Nachrichten({ navigation }: Props) {
  const t = useT();
  const theme = useTheme();
  const [faeden, setFaeden] = useState<ChatFaden[]>([]);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = useCallback(async () => {
    setLaedt(true);
    const res = await getChatFaeden();
    if (!res.ok) {
      setFehler(t("chat.fehlerLaden"));
      setLaedt(false);
      return;
    }
    setFaeden(res.data.items);
    setFehler(null);
    setLaedt(false);
  }, [t]);

  // Beim Fokus neu laden: die Liste hat kein Realtime-Abo, weil
  // `owner_threads` bewusst kein SELECT für `authenticated` trägt (Wurzel 6,
  // Migration 0611). Ein Abo darauf wäre eine stumme Attrappe.
  useFocusEffect(
    useCallback(() => {
      void laden();
    }, [laden]),
  );

  if (laedt && faeden.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <Spinner />
      </View>
    );
  }

  return (
    <ScrollView
      contentContainerStyle={{ padding: KARTE_ABSTAND, gap: 10 }}
      refreshControl={
        <RefreshControl refreshing={laedt} onRefresh={() => void laden()} />
      }
    >
      {fehler ? (
        <Txt v="klein" color={theme.palette.star}>
          {fehler}
        </Txt>
      ) : null}

      {/* Der Weg zur Geräteliste. Hier stand bis zum 09.09.2026
          „Ende-zu-Ende verschlüsselt" — eine Zusage, die seit dem Umbau auf
          serverseitige Verschlüsselung nicht mehr gilt. Die Frage dahinter
          bleibt dieselbe und ist weiterhin beantwortbar: WER kann mitlesen. */}
      <TouchableOpacity
        onPress={() => navigation.navigate("ChatGeraete")}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          alignSelf: "center",
          paddingVertical: 4,
        }}
      >
        <Icon n="lock" s={12} c={theme.palette.soft} />
        <Txt v="klein" soft>
          {t("chat.geraete")}
        </Txt>
      </TouchableOpacity>

      {faeden.map((f) => (
        <TouchableOpacity
          key={f.property_id}
          onPress={() =>
            navigation.navigate("Chat", {
              propertyId: f.property_id,
              threadId: f.thread_id,
            })
          }
        >
          <Kachel>
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <Txt numberOfLines={1} style={{ flex: 1 }}>
                {f.property_title || "—"}
              </Txt>
              {f.ungelesen ? (
                <View
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    backgroundColor: theme.accent,
                  }}
                />
              ) : null}
            </View>
            {/*
              KEINE Nachrichtenvorschau — der Server kann den Inhalt nicht
              lesen (ADR-0029). Statt eines Textes steht hier nur, DASS etwas
              da ist. Wer je eine Vorschau einbaut, hat entweder Chiffretext
              angezeigt oder die Verschlüsselung aufgehoben.
            */}
            <Txt v="klein" soft>
              {/* Kein Datum = noch kein Gespräch. Hier steht ein Strich, kein
                  ganzer Satz: `chat.leer` ist die Aufforderung im leeren
                  Verlauf, nicht die Zeitangabe einer Listenzeile. */}
              {f.last_message_at ? beschriftung(f.last_message_at, t) : "—"}
            </Txt>
          </Kachel>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

/** Datum der letzten Nachricht — heute/gestern ausgeschrieben. */
function beschriftung(
  iso: string,
  t: (s: "chat.heute" | "chat.gestern") => string,
): string {
  const wann = new Date(iso);
  const label = tagesLabel(wann, new Date());
  if (label === "heute") return t("chat.heute");
  if (label === "gestern") return t("chat.gestern");
  return wann.toLocaleDateString();
}

export default Nachrichten;

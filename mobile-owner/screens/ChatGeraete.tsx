// Meine Chat-Geräte (0611, ADR-0029).
//
// WARUM ES DIESEN SCREEN GEBEN MUSS: Bei Ende-zu-Ende-Verschlüsselung ist die
// Geräteliste der EINZIGE Schutz gegen einen untergeschobenen Mitleser.
// Kryptografie kann ihn nicht leisten — sie verhindert, dass Unbefugte
// mitlesen, aber nicht, dass ein zusätzlich registriertes Gerät zum Kreis der
// Befugten gehört. Nur wer seine Geräte SIEHT, kann ein fremdes bemerken.
//
// Der Server erschwert das bereits (Besitznachweis per Signatur beim
// Registrieren, `owner_chat/geraete.py`), aber ein übernommenes Konto könnte
// ein eigenes Gerät eintragen. Dann steht es hier.
//
// SPERREN, NICHT LÖSCHEN (Wurzel 1): Die bereits verpackten Schlüssel bleiben
// stehen. Sie zu entfernen würde den Verlauf für die übrigen Geräte nicht
// retten, sondern Lücken reißen.
import { useCallback, useState } from "react";
import { Alert, RefreshControl, ScrollView, View } from "react-native";

import { useFocusEffect } from "@react-navigation/native";

import { Btn, Kachel, Spinner, Txt } from "@/components/ui/kit";
import { useT } from "@/contexts/SprachContext";
import { getGeraete, geraetSperren, type GeraetInfo } from "@/lib/chat";
import { geraeteIdLesen } from "@/lib/chat-krypto";
import { KARTE_ABSTAND } from "@/theme/flaechen";
import { useTheme } from "@/theme/ThemeProvider";

export function ChatGeraete() {
  const t = useT();
  const theme = useTheme();
  const [geraete, setGeraete] = useState<GeraetInfo[]>([]);
  const [eigenes, setEigenes] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(true);
  // Wurzel 2: je Gerät höchstens eine laufende Sperrung.
  const [sperrt, setSperrt] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = useCallback(async () => {
    setLaedt(true);
    const [liste, id] = await Promise.all([getGeraete(), geraeteIdLesen()]);
    setEigenes(id);
    if (!liste.ok) {
      setFehler(t("chat.fehlerLaden"));
      setLaedt(false);
      return;
    }
    setGeraete(liste.data.items);
    setFehler(null);
    setLaedt(false);
  }, [t]);

  useFocusEffect(
    useCallback(() => {
      void laden();
    }, [laden]),
  );

  const sperren = useCallback(
    (g: GeraetInfo) => {
      if (sperrt) return;
      Alert.alert(t("chat.geraetEntfernen"), t("chat.geraetEntfernenFrage"), [
        { text: t("chat.abbrechen"), style: "cancel" },
        {
          text: t("chat.geraetEntfernen"),
          style: "destructive",
          onPress: () => {
            void (async () => {
              setSperrt(g.id);
              const res = await geraetSperren(g.id);
              setSperrt(null);
              if (!res.ok) {
                setFehler(res.error);
                return;
              }
              await laden();
            })();
          },
        },
      ]);
    },
    [sperrt, laden, t],
  );

  if (laedt && geraete.length === 0) {
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
      <Txt v="titel">{t("chat.geraete")}</Txt>
      <Txt v="klein" soft>
        {t("chat.geraeteText")}
      </Txt>

      {fehler ? (
        <Txt v="klein" color={theme.palette.accentText}>
          {fehler}
        </Txt>
      ) : null}

      {geraete.map((g) => (
        <Kachel key={g.id}>
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 8,
            }}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Txt numberOfLines={1}>{g.geraet_name}</Txt>
              <Txt v="klein" soft>
                {g.id === eigenes ? t("chat.geraetDiesesGeraet") : null}
                {g.gesperrt_am ? t("chat.geraetGesperrt") : null}
                {/* ZULETZT AKTIV, nicht das Anlagedatum: Ein Gerät, das der
                    Nutzer nicht kennt und das heute gelesen hat, ist der
                    Alarm — ein altes Gerät, das seit Monaten still ist, nicht.
                    Fehlt beides, steht GAR NICHTS da statt der heutigen Uhr:
                    ein erfundenes Datum wäre hier die schlechteste Antwort,
                    weil es ein fremdes Gerät jung und harmlos aussehen ließe
                    (Wurzel 4). */}
                {!g.gesperrt_am && g.id !== eigenes && (g.zuletzt_aktiv || g.created_at)
                  ? t("chat.geraetSeitdem", {
                      datum: new Date(
                        (g.zuletzt_aktiv || g.created_at)!,
                      ).toLocaleDateString(),
                    })
                  : null}
              </Txt>
            </View>
            {/* Das EIGENE Gerät lässt sich hier nicht sperren: das sperrte den
                Nutzer aus seinem eigenen Verlauf aus, ohne Weg zurück außer
                dem Sicherungscode. Verlorene Geräte werden von einem ANDEREN
                Gerät aus gesperrt — dafür ist diese Liste da. */}
            {!g.gesperrt_am && g.id !== eigenes ? (
              <Btn
                variant="ghost"
                onPress={() => sperren(g)}
                disabled={sperrt === g.id}
              >
                {t("chat.geraetEntfernen")}
              </Btn>
            ) : null}
          </View>
        </Kachel>
      ))}
    </ScrollView>
  );
}

export default ChatGeraete;

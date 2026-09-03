// Mehr — Konto, App-Wechsel, Rechtliches, Abmelden.
//
// Der Sprung in die PMS-App ist ein APP-WECHSEL, keine Navigation
// (`lib/appwechsel.ts`, ADR-0019): ist sie nicht installiert, führt der Weg in
// den Store. Er steht hier, weil manche Eigentümer ihre Objekte auch selbst
// verwalten — dann brauchen sie beide Apps, und dieser Weg ist der einzige.
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DemoBand } from "@/components/DemoBand";
import { RechtlichesBlock } from "@/components/RechtlichesBlock";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Btn, Kachel, Txt } from "@/components/ui/kit";
import { Kopf } from "@/components/ui/Kopf";
import { useAuth } from "@/contexts/AuthContext";
import { zurAnderenApp } from "@/lib/appwechsel";
import { useUnterkante } from "@/lib/unterkante";
import { KARTE_ABSTAND } from "@/theme/flaechen";
import { useTheme } from "@/theme/ThemeProvider";

type Nav = { navigate: (name: string, params?: Record<string, unknown>) => void };

export default function Mehr({ navigation }: { navigation: Nav }) {
  const t = useTheme();
  const { me, logout } = useAuth();
  const insets = useSafeAreaInsets();
  const unterkante = useUnterkante();
  const [meldet, setMeldet] = useState(false);

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
      <Kopf titel="Mehr" />
      {me?.is_demo ? <DemoBand /> : null}
      <ScrollView
        contentContainerStyle={{
          padding: t.density.pad,
          paddingTop: 0,
          paddingBottom: unterkante + 24,
          gap: KARTE_ABSTAND,
        }}
      >
        <Kachel>
          <Txt v="title">{me?.full_name ?? me?.email ?? "Ihr Zugang"}</Txt>
          {me?.full_name && me?.email ? (
            <Txt v="xs" soft style={{ marginTop: 2 }}>
              {me.email}
            </Txt>
          ) : null}
          <Txt v="xs" faint style={{ marginTop: 6 }}>
            Eigentümer-Zugang
          </Txt>
        </Kachel>

        <Kachel pad={0}>
          <Reihe
            icon="doc"
            titel="Abrechnungen"
            unter="Abgeschlossene Abrechnungen"
            auf={() => navigation.navigate("Abrechnungen")}
          />
          <Reihe
            icon="cam"
            titel="Fotoalbum"
            unter="Bilder aller Objekte"
            auf={() => navigation.navigate("Fotoalbum")}
            erste={false}
          />
          <Reihe
            icon="cal"
            titel="Eigennutzung beantragen"
            unter="Zeitraum für sich freihalten"
            auf={() => navigation.navigate("SperrAntrag")}
            erste={false}
          />
        </Kachel>

        <Pressable onPress={() => void zurAnderenApp(t.marke.andereApp, "")}>
          <Kachel>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Icon n="share" s={22} c={t.palette.accent} />
              <View style={{ flex: 1 }}>
                <Txt v="title">{t.marke.andereApp.name} öffnen</Txt>
                <Txt v="xs" soft>
                  Die App für die Verwaltung — falls Sie selbst vermieten
                </Txt>
              </View>
              <Icon n="fwd" s={18} c={t.palette.faint} />
            </View>
          </Kachel>
        </Pressable>

        <RechtlichesBlock />

        <Btn
          variant="outline"
          onPress={() => {
            setMeldet(true);
            void logout();
          }}
          disabled={meldet}
          block
        >
          {meldet ? "Wird abgemeldet …" : "Abmelden"}
        </Btn>
      </ScrollView>
    </View>
  );
}

function Reihe({
  icon,
  titel,
  unter,
  auf,
  erste = true,
}: {
  icon: IconName;
  titel: string;
  unter: string;
  auf: () => void;
  erste?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={auf}
      accessibilityRole="button"
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        padding: 14,
        borderTopWidth: erste ? 0 : 1,
        borderTopColor: t.palette.line,
      }}
    >
      <Icon n={icon} s={20} c={t.palette.soft} />
      <View style={{ flex: 1 }}>
        <Txt v="title">{titel}</Txt>
        <Txt v="xs" soft>
          {unter}
        </Txt>
      </View>
      <Icon n="fwd" s={16} c={t.palette.faint} />
    </Pressable>
  );
}

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
import { KontoLoeschenBlock } from "@/components/KontoLoeschenBlock";
import { RechtlichesBlock } from "@/components/RechtlichesBlock";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Btn, Kachel, Txt } from "@/components/ui/kit";
import { Kopf } from "@/components/ui/Kopf";
import { useAuth } from "@/contexts/AuthContext";
import { useSprache } from "@/contexts/SprachContext";
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
  const { t: txt, sprache } = useSprache();

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
      <Kopf titel={txt("mehr.titel")} />
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
          <Txt v="title">{me?.full_name ?? me?.email ?? txt("mehr.ihrZugang")}</Txt>
          {me?.full_name && me?.email ? (
            <Txt v="xs" soft style={{ marginTop: 2 }}>
              {me.email}
            </Txt>
          ) : null}
          <Txt v="xs" faint style={{ marginTop: 6 }}>
            {txt("mehr.eigentuemerZugang")}
          </Txt>
        </Kachel>

        <Kachel pad={0}>
          {/* Ganz oben: der Chat ist der einzige Weg, die Verwaltung ZU
              ERREICHEN — alles andere in dieser Liste ist Nachschlagen. */}
          <Reihe
            icon="chat"
            titel={txt("chat.titel")}
            unter={txt("chat.verschluesselt")}
            auf={() => navigation.navigate("Nachrichten")}
          />
          <Reihe
            icon="check"
            titel={txt("mehr.aufgaben")}
            unter={txt("mehr.aufgabenText")}
            auf={() => navigation.navigate("Aufgaben")}
            erste={false}
          />
          <Reihe
            icon="card"
            titel={txt("auszahlung.titel")}
            unter={txt("auszahlung.jeObjekt")}
            auf={() => navigation.navigate("Auszahlungen")}
            erste={false}
          />
          <Reihe
            icon="chart"
            titel={txt("mehr.auslastung")}
            unter={txt("mehr.auslastungText")}
            auf={() => navigation.navigate("Statistik")}
            erste={false}
          />
          <Reihe
            icon="home"
            titel={txt("obj.titel")}
            unter={txt("obj.zaehlerstaende")}
            auf={() => navigation.navigate("Objekte")}
            erste={false}
          />
          <Reihe
            icon="cam"
            titel={txt("foto.titel")}
            unter={txt("obj.fotoalbumText")}
            auf={() => navigation.navigate("Fotoalbum")}
            erste={false}
          />
          <Reihe
            icon="bed"
            titel={txt("kal.aufenthaltBuchen")}
            unter={txt("obj.eigennutzungText")}
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
                  {txt("mehr.andereAppText")}
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
          {meldet ? txt("mehr.wirdAbgemeldet") : txt("mehr.abmelden")}
        </Btn>

        {/* Ganz unten und hinter „Abmelden": Google verlangt den Löschweg IN
            der App, wenn sie Konto-Anlage anbietet — das tut diese nicht, der
            Weg steht trotzdem hier (siehe `lib/konto.ts`). Die Stelle ist
            bewusst die letzte: eine Löschung gehört nicht neben die täglichen
            Wege. Nach dem Vollzug meldet die App ab, sonst hielte sie ein
            Token, hinter dem kein Konto mehr steht. */}
        <KontoLoeschenBlock sprache={sprache} onGeloescht={() => void logout()} />
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

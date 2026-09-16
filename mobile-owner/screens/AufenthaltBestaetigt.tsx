// Bestätigung nach „Aufenthalt beantragen" (Vorlage: Hostaway „4-night
// upcoming stay": Haken, Objekt, Check-in → Check-out, Gäste, Notizen, zwei
// Wege zurück).
//
// WORTWAHL: „beantragt", nicht „gebucht". Der Antrag ist offen, bis die
// Verwaltung entscheidet (CLAUDE.md Regel 2) — der Bildschirm sagt das, statt
// eine Zusage vorzutäuschen, die noch niemand gegeben hat.
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/Icon";
import { Btn, Kachel, Photo, Txt } from "@/components/ui/kit";
import { useT } from "@/contexts/SprachContext";
import { aufenthaltNaechte, gaesteText } from "@/lib/aufenthalt";
import type { BlockRequest } from "@/lib/ownerPortal";
import { datumKurz } from "@/lib/zeitraum";
import { KARTE_ABSTAND } from "@/theme/flaechen";
import { useTheme } from "@/theme/ThemeProvider";

type Nav = { navigate: (name: string, params?: Record<string, unknown>) => void };
export type BestaetigtParams = {
  antrag: BlockRequest;
  objekt: { title: string; photo: string | null; adresse: string | null };
  checkIn: string;
  checkOut: string;
  gaeste: number;
  kinder: number;
  haustiere: number;
  notizen: string | null;
};
type Route = { params: BestaetigtParams };

export default function AufenthaltBestaetigt({ navigation, route }: { navigation: Nav; route: Route }) {
  const txt = useT();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { objekt, checkIn, checkOut, gaeste, kinder, haustiere, notizen } = route.params;
  const n = aufenthaltNaechte(checkIn, checkOut);

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
      <ScrollView contentContainerStyle={{ padding: t.density.pad, gap: KARTE_ABSTAND, paddingBottom: 150 }}>
        <View style={{ alignItems: "center", paddingVertical: 20, gap: 14 }}>
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: t.palette.accent,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon n="check" s={32} sw={2.6} c={t.palette.accentInk} />
          </View>
          <Txt v="h1" style={{ textAlign: "center" }}>
            {txt("best.beantragt", { anzahl: n, einheit: txt(n === 1 ? "allg.nacht" : "allg.naechte") })}
          </Txt>
          <Txt v="sm" soft style={{ textAlign: "center" }}>
            {txt("best.hinweis")}
          </Txt>
        </View>

        <Kachel pad={12}>
          <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
            <Photo src={objekt.photo ?? undefined} h={72} w={100} r={10} />
            <View style={{ flex: 1 }}>
              <Txt v="title" numberOfLines={1}>
                {objekt.title}
              </Txt>
              {objekt.adresse ? (
                <Txt v="xs" soft numberOfLines={1} style={{ marginTop: 2 }}>
                  {objekt.adresse}
                </Txt>
              ) : null}
            </View>
          </View>
        </Kachel>

        <Kachel>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <View style={{ flex: 1 }}>
              <Txt v="eyebrow" soft>
                {txt("best.checkIn")}
              </Txt>
              <Txt v="h2" style={{ marginTop: 4 }}>
                {datumKurz(txt, checkIn)}
              </Txt>
            </View>
            <Icon n="fwd" s={20} c={t.palette.soft} />
            <View style={{ flex: 1, alignItems: "flex-end" }}>
              <Txt v="eyebrow" soft>
                {txt("best.checkOut")}
              </Txt>
              <Txt v="h2" style={{ marginTop: 4 }}>
                {datumKurz(txt, checkOut)}
              </Txt>
            </View>
          </View>
        </Kachel>

        <Kachel>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <Icon n="users" s={20} c={t.palette.ink} />
            <Txt v="title">{gaesteText(txt, gaeste)}</Txt>
          </View>
          {/* Nur zeigen, was angegeben wurde: „0 Kinder" auf der Bestätigung
              wäre eine Angabe, die niemand gemacht hat. */}
          {kinder > 0 ? (
            <Txt v="sm" soft style={{ marginTop: 4, marginLeft: 30 }}>
              {txt("buchen.kinderHinweis", { anzahl: kinder })}
            </Txt>
          ) : null}
          {haustiere > 0 ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 }}>
              <Icon n="pet" s={20} c={t.palette.ink} />
              <Txt v="title">
                {haustiere === 1
                  ? txt("buchen.einHaustier")
                  : txt("buchen.anzahlHaustiere", { anzahl: haustiere })}
              </Txt>
            </View>
          ) : null}
        </Kachel>

        {notizen ? (
          <Kachel>
            <Txt v="eyebrow" soft>
              {txt("buchen.notizen")}
            </Txt>
            <Txt v="sm" style={{ marginTop: 6 }}>
              {notizen}
            </Txt>
          </Kachel>
        ) : null}
      </ScrollView>

      <View
        style={{
          position: "absolute",
          left: t.density.pad,
          right: t.density.pad,
          bottom: insets.bottom + 16,
          gap: 8,
        }}
      >
        <Btn variant="ghost" block onPress={() => navigation.navigate("Tabs", { screen: "Start" })}>
          {txt("best.zurStartseite")}
        </Btn>
        <Btn variant="primary" block onPress={() => navigation.navigate("Tabs", { screen: "Aufenthalte" })}>
          {txt("best.zuAufenthalten")}
        </Btn>
      </View>
    </View>
  );
}

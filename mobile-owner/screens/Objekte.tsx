// Meine Objekte — die Liste der zugeordneten Objekte.
//
// Struktur nach der Vorlage: Foto-Kachel mit Titel und Ort, gerahmt und mit
// weichem Schatten. Der Eigentümer sieht ausschließlich SEINE Objekte; die
// Auswahl trifft der Server (`/public-portal/properties`, Owner-Scope), nicht
// diese Liste — hier wird nichts gefiltert, was der Server nicht schon
// gefiltert hat.
import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DemoBand } from "@/components/DemoBand";
import { Icon } from "@/components/ui/Icon";
import { Kachel, Photo, Spinner, Txt } from "@/components/ui/kit";
import { Kopf } from "@/components/ui/Kopf";
import { useAuth } from "@/contexts/AuthContext";
import { useT } from "@/contexts/SprachContext";
import { getOwnerProperties, type PortalProperty } from "@/lib/ownerPortal";
import { KARTE_ABSTAND } from "@/theme/flaechen";
import { useTheme } from "@/theme/ThemeProvider";

type Nav = { navigate: (name: string, params?: Record<string, unknown>) => void };

export default function Objekte({ navigation }: { navigation: Nav }) {
  const txt = useT();
  const t = useTheme();
  const { me } = useAuth();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<PortalProperty[] | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = useCallback(async () => {
    setFehler(null);
    const res = await getOwnerProperties();
    if (res.ok) setItems(res.data.items);
    else setFehler(res.error);
    setLaedt(false);
  }, []);

  useEffect(() => {
    void laden();
  }, [laden]);

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
      <Kopf
        titel={txt("obj.titel")}
        name={me?.full_name}
        email={me?.email}
        aufProfil={() => navigation.navigate("Mehr")}
      />
      {me?.is_demo ? <DemoBand /> : null}
      <ScrollView
        contentContainerStyle={{ padding: t.density.pad, paddingTop: 0, gap: KARTE_ABSTAND }}
        refreshControl={<RefreshControl refreshing={laedt} onRefresh={() => void laden()} />}
      >
        <Pressable onPress={() => navigation.navigate("Fotoalbum")}>
          <Kachel>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
              <Icon n="cam" s={22} c={t.palette.accent} />
              <View style={{ flex: 1 }}>
                <Txt v="title">{txt("obj.fotoalbum")}</Txt>
                <Txt v="xs" soft>
                  {txt("obj.fotoalbumText")}
                </Txt>
              </View>
              <Icon n="fwd" s={18} c={t.palette.faint} />
            </View>
          </Kachel>
        </Pressable>

        {fehler ? (
          <Kachel>
            <Txt v="title">{txt("obj.nichtGeladen")}</Txt>
            <Txt v="sm" soft style={{ marginTop: 4 }}>
              {fehler}
            </Txt>
          </Kachel>
        ) : null}

        {laedt && !items ? (
          <Kachel>
            <Spinner />
          </Kachel>
        ) : null}

        {items?.length === 0 ? (
          <Kachel>
            <Txt v="title">{txt("start.keinObjekt")}</Txt>
            <Txt v="sm" soft style={{ marginTop: 4 }}>
              Sobald Ihre Verwaltung Ihnen ein Objekt zuordnet, erscheint es hier.
            </Txt>
          </Kachel>
        ) : null}

        {items?.map((obj) => (
          <Pressable
            key={obj.id}
            onPress={() => navigation.navigate("ObjektDetail", { id: obj.id, titel: obj.title })}
          >
            <Kachel pad={0}>
              {/* `photo` kann fehlen — dann zeigt `Photo` seine Fläche, kein
                  gebrochenes Bildsymbol. */}
              <Photo src={obj.photo ?? undefined} h={150} w="100%" r={12} />
              <View style={{ padding: 14 }}>
                <Txt v="title" numberOfLines={1}>
                  {obj.title}
                </Txt>
                {obj.city ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                    <Icon n="pin" s={13} c={t.palette.soft} />
                    <Txt v="xs" soft>
                      {obj.city}
                    </Txt>
                  </View>
                ) : null}
              </View>
            </Kachel>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

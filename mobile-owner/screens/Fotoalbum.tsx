// Fotoalbum — alle Bilder aller eigenen Objekte, nach Objekt gruppiert
// (`GET /public-portal/photo-album`, Recht `pm_photo_album`).
//
// Die Bild-URLs sind absolut und öffentlich (Bucket `property-images`,
// Migration 0062) — hier ist nichts zu signieren. `total` kommt vom Server und
// wird NICHT selbst zusammengezählt (der Contract sagt das ausdrücklich).
import { useCallback, useEffect, useState } from "react";
import { Image, RefreshControl, ScrollView, View } from "react-native";

import { Kachel, KachelKopf, Spinner, Txt } from "@/components/ui/kit";
import { getOwnerPhotoAlbum, type PortalPhotoAlbum } from "@/lib/ownerPortal";
import { KARTE_ABSTAND } from "@/theme/flaechen";
import { useTheme } from "@/theme/ThemeProvider";

const SPALTEN = 3;
const LUECKE = 4;

export default function Fotoalbum() {
  const t = useTheme();
  const [album, setAlbum] = useState<PortalPhotoAlbum | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = useCallback(async () => {
    setFehler(null);
    const res = await getOwnerPhotoAlbum();
    if (res.ok) setAlbum(res.data);
    else setFehler(res.error);
    setLaedt(false);
  }, []);

  useEffect(() => {
    void laden();
  }, [laden]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.palette.bg }}
      contentContainerStyle={{ padding: t.density.pad, gap: KARTE_ABSTAND }}
      refreshControl={<RefreshControl refreshing={laedt} onRefresh={() => void laden()} />}
    >
      {fehler ? (
        <Kachel>
          <Txt v="title">Album nicht geladen</Txt>
          <Txt v="sm" soft style={{ marginTop: 4 }}>
            {fehler}
          </Txt>
        </Kachel>
      ) : null}

      {laedt && !album ? (
        <Kachel>
          <Spinner />
        </Kachel>
      ) : null}

      {album && album.total === 0 ? (
        <Kachel>
          <Txt v="title">Noch keine Bilder</Txt>
          <Txt v="sm" soft style={{ marginTop: 4 }}>
            Sobald Ihre Verwaltung Bilder hinterlegt, erscheinen sie hier.
          </Txt>
        </Kachel>
      ) : null}

      {album?.groups.map((gruppe) => (
        <Kachel key={gruppe.property_id}>
          <KachelKopf
            titel={gruppe.title}
            rechts={
              <Txt v="xs" soft>
                {gruppe.total}
              </Txt>
            }
          />
          {gruppe.city ? (
            <Txt v="xs" soft style={{ marginTop: -8, marginBottom: 10 }}>
              {gruppe.city}
            </Txt>
          ) : null}
          <View style={{ flexDirection: "row", flexWrap: "wrap", margin: -LUECKE }}>
            {gruppe.items.map((bild) => (
              <View key={bild.id} style={{ width: `${100 / SPALTEN}%`, padding: LUECKE }}>
                <Image
                  source={{ uri: bild.url }}
                  style={{
                    width: "100%",
                    aspectRatio: 1,
                    borderRadius: 8,
                    backgroundColor: t.palette.surface2,
                  }}
                  resizeMode="cover"
                  // Bildbeschriftung, wenn eine hinterlegt ist. Die App führt
                  // eine Sprache (Deutsch) und greift `de` ab, ohne einen
                  // anderen Eintrag zu erfinden.
                  accessibilityLabel={bild.caption?.de ?? gruppe.title}
                />
              </View>
            ))}
          </View>
        </Kachel>
      ))}
    </ScrollView>
  );
}

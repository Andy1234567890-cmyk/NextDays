// Eigentümer · Fotoalbum. Die Bilder ALLER zugeordneten Objekte, je Objekt
// gruppiert (GET /public-portal/photo-album, Recht `pm_photo_album`).
//
// Read-only: kein Hochladen, kein Löschen, kein Sortieren — das Album ist die
// Ansicht auf den Bestand, nicht seine Verwaltung. Ein Tipp auf ein Bild öffnet
// es groß in der App; ein Download-/Teilen-Weg existiert bewusst nicht (der
// Contract kennt nur GET).
//
// Kein eigener Tab: Das Album ist eine Stöber-Fläche, keine Arbeitsfläche —
// es hängt am Kopf der Objektliste, damit die Leiste bei vier bis fünf
// Arbeits-Tabs bleibt (Regel „max 5 Tabs", navigation/HostTabs.tsx).
import { useCallback, useEffect, useState } from "react";
import { Dimensions, Modal, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/Icon";
import { Btn, Col, Photo, Row, Spinner, Txt } from "@/components/ui/kit";
import { EmptyState } from "@/components/ui/patterns";
import { getOwnerPhotoAlbum, type PortalAlbumGroup } from "@/lib/ownerPortal";
import { useRealtime } from "@/lib/realtime";
import { useTheme } from "@/theme/ThemeProvider";

export default function OwnerPhotoAlbum({ navigation }: { navigation: any }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  // `gruppen` = je Objekt eine Gruppe; `gesamt` ist die Summe des SERVERS —
  // nicht selbst zusammengezählt (der Server sagt, wie viele Bilder es sind).
  const [gruppen, setGruppen] = useState<PortalAlbumGroup[] | null>(null);
  const [gesamt, setGesamt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gross, setGross] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await getOwnerPhotoAlbum();
    if (res.ok) {
      setGruppen(res.data.groups);
      setGesamt(res.data.total);
      setError(null);
    } else {
      // Ein Ladefehler ist NICHT „keine Bilder" (Wurzel 4/5).
      setGruppen(null);
      setGesamt(null);
      setError(res.error);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // `properties` ist die einzige geprüfte Quelle dieser Fläche (die Spalte
  // `photos` spiegelt den Bestand). `property_photos` wird BEWUSST NICHT
  // abonniert: die Tabelle trägt seit 0248 kein pauschales SELECT-Grant für
  // `authenticated` mehr — ein Abo darauf wäre eine stumme Attrappe, die live
  // aussieht und nie ein Event bekommt (Wurzel 5). Dieselbe Entscheidung wie
  // im Web (`web/components/portal/portal-fotoalbum.tsx`).
  useRealtime({ table: "properties", onChange: load });

  const breite = Dimensions.get("window").width;
  // Drei Spalten mit 20er Außen- und 6er Innenabstand.
  const kachel = Math.floor((breite - 20 * 2 - 6 * 2) / 3);

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
      <Row gap={10} style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Zurück"
          onPress={() => navigation.goBack()}
          hitSlop={12}
          style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
        >
          <Icon n="back" s={20} sw={2} c={t.palette.ink} />
        </Pressable>
        <Col gap={2} style={{ flex: 1 }}>
          <Txt v="h1">Fotoalbum</Txt>
          {gesamt != null && (
            <Txt v="sm" soft>
              {gesamt === 1 ? "1 Bild" : `${gesamt} Bilder`}
            </Txt>
          )}
        </Col>
      </Row>

      {!gruppen && !error && <Spinner />}

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: insets.bottom + 32, gap: 24 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
      >
        {error && (
          <EmptyState icon="info" titel="Nicht geladen" text={error}>
            <Btn variant="outline" onPress={load} style={{ marginTop: 6 }}>
              Erneut versuchen
            </Btn>
          </EmptyState>
        )}

        {gruppen && gesamt === 0 && !error && (
          <EmptyState
            icon="cam"
            titel="Keine Bilder"
            text="Für deine Objekte sind noch keine Bilder hinterlegt."
          />
        )}

        {gruppen?.map((gruppe) => (
          <Col key={gruppe.property_id} gap={10}>
            <Row gap={10} style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
              <Col gap={2} style={{ flex: 1 }}>
                <Txt v="h2" numberOfLines={1}>
                  {gruppe.title}
                </Txt>
                {/* Der Ort steht unter dem Namen — dieselbe Anordnung wie in
                    der Objektliste. Er trennt zwei gleich benannte Objekte
                    („Studio 1") an verschiedenen Standorten; ohne hinterlegten
                    Ort steht dort nichts (kein Platzhalter). */}
                {gruppe.city ? (
                  <Txt v="sm" soft numberOfLines={1}>
                    {gruppe.city}
                  </Txt>
                ) : null}
              </Col>
              <Txt v="sm" soft>
                {gruppe.total}
              </Txt>
            </Row>
            {gruppe.items.length === 0 ? (
              <Txt v="sm" soft>
                Für dieses Objekt sind keine Bilder hinterlegt.
              </Txt>
            ) : (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {gruppe.items.map((bild) => (
                  <Pressable
                    key={bild.id}
                    accessibilityRole="imagebutton"
                    // Bildunterschrift, wenn es eine deutsche gibt — die App
                    // führt genau eine Sprache; ein fremdsprachiger Eintrag
                    // wird NICHT ersatzweise vorgelesen.
                    accessibilityLabel={
                      gruppe.title + (bild.caption?.de ? ` — ${bild.caption.de}` : "")
                    }
                    onPress={() => setGross(bild.url)}
                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                  >
                    <Photo src={bild.url} w={kachel} h={kachel} r={10}>
                      {/* Welches Bild draußen als Titelbild läuft, sieht der
                          Eigentümer sonst nirgends. */}
                      {bild.is_cover && (
                        <View
                          style={{
                            position: "absolute",
                            left: 6,
                            bottom: 6,
                            paddingHorizontal: 8,
                            paddingVertical: 3,
                            borderRadius: t.radius.pill,
                            backgroundColor: "rgba(0,0,0,0.55)",
                          }}
                        >
                          <Txt v="xs" color="#FFFFFF">
                            Titelbild
                          </Txt>
                        </View>
                      )}
                    </Photo>
                  </Pressable>
                ))}
              </View>
            )}
          </Col>
        ))}
      </ScrollView>

      {/* Großansicht: nur ansehen und schließen. */}
      <Modal visible={gross != null} transparent animationType="fade" onRequestClose={() => setGross(null)}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Bild schließen"
          onPress={() => setGross(null)}
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.92)",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          {gross && <Photo src={gross} w={breite - 32} h={Math.round((breite - 32) * 0.75)} r={12} />}
        </Pressable>
      </Modal>
    </View>
  );
}

// Ein Objekt — Stammdaten und Bilder, LESEND (`pm_property_area`).
//
// BEWUSST OHNE JEDES GELDFELD: der Contract (`PortalPropertyDetail`) führt
// keinen Preis, keine Währung, keinen Umsatz. Der Eigentümer sieht hier das
// HAUS, nicht das Geschäft — Beträge stehen in „Auszahlungen" und unterliegen
// dort der Maske. Wer hier ein Geldfeld ergänzt, umgeht den Rollen-Datensplit.
//
// Ein fremdes Objekt beantwortet der Server mit 404 (nie 403 — die Existenz
// wird nicht verraten). Die App zeigt „nicht gefunden", nicht „kein Zugriff":
// sie weiß es schlicht nicht besser.
import { useCallback, useEffect, useState } from "react";
import { Image, Pressable, RefreshControl, ScrollView, View } from "react-native";

import { useT } from "@/contexts/SprachContext";
import { Icon } from "@/components/ui/Icon";
import { Kachel, KachelKopf, Spinner, Txt } from "@/components/ui/kit";
import { ausstattungLabel } from "@/lib/ausstattung";
import {
  getOwnerProperty,
  getOwnerPropertyImages,
  type PortalImage,
  type PortalPropertyDetail,
} from "@/lib/ownerPortal";
import { KARTE_ABSTAND } from "@/theme/flaechen";
import { useTheme } from "@/theme/ThemeProvider";

type Nav = { navigate: (name: string, params?: Record<string, unknown>) => void };
type Route = { params: { id: string; titel: string } };

export default function ObjektDetail({
  navigation,
  route,
}: {
  navigation: Nav;
  route: Route;
}) {
  const txt = useT();
  const t = useTheme();
  const { id, titel } = route.params;
  const [objekt, setObjekt] = useState<PortalPropertyDetail | null>(null);
  const [bilder, setBilder] = useState<PortalImage[]>([]);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = useCallback(async () => {
    setFehler(null);
    const [detail, fotos] = await Promise.all([
      getOwnerProperty(id),
      getOwnerPropertyImages(id),
    ]);
    if (detail.ok) setObjekt(detail.data);
    else setFehler(detail.error);
    // Fehlende Bilder sind kein Grund, die Stammdaten zu verwerfen — sie
    // bleiben dann einfach leer.
    if (fotos.ok) setBilder(fotos.data.items);
    setLaedt(false);
  }, [id]);

  useEffect(() => {
    void laden();
  }, [laden]);

  const adresse = objekt
    ? [
        [objekt.street, objekt.house_number].filter(Boolean).join(" "),
        [objekt.postal_code, objekt.city].filter(Boolean).join(" "),
        objekt.country,
      ]
        .filter((z) => z && z.trim().length > 0)
        .join(", ")
    : "";

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.palette.bg }}
      contentContainerStyle={{ padding: t.density.pad, gap: KARTE_ABSTAND }}
      refreshControl={<RefreshControl refreshing={laedt} onRefresh={() => void laden()} />}
    >
      {fehler ? (
        <Kachel>
          <Txt v="title">{txt("obj.nichtGefunden")}</Txt>
          <Txt v="sm" soft style={{ marginTop: 4 }}>
            {fehler}
          </Txt>
        </Kachel>
      ) : null}

      {laedt && !objekt ? (
        <Kachel>
          <Spinner />
        </Kachel>
      ) : null}

      {bilder.length > 0 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {bilder.map((b) => (
              <Image
                key={b.id}
                source={{ uri: b.url }}
                style={{
                  width: 220,
                  height: 150,
                  borderRadius: 12,
                  backgroundColor: t.palette.surface2,
                }}
                resizeMode="cover"
                accessibilityLabel={b.caption?.de ?? titel}
              />
            ))}
          </View>
        </ScrollView>
      ) : null}

      {objekt ? (
        <>
          <Kachel>
            <Txt v="h2">{objekt.title}</Txt>
            {adresse ? (
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                <Icon n="pin" s={14} c={t.palette.soft} />
                <Txt v="sm" soft style={{ flex: 1 }}>
                  {adresse}
                </Txt>
              </View>
            ) : null}
            {objekt.description ? (
              <Txt v="sm" soft style={{ marginTop: 10 }}>
                {objekt.description}
              </Txt>
            ) : null}
          </Kachel>

          <Kachel>
            <KachelKopf titel="Eckdaten" />
            <Zeile label={txt("obj.einheiten")} wert={String(objekt.units_total)} />
            <Zeile label={txt("obj.gaesteMaximal")} wert={objekt.max_guests} />
            <Zeile label={txt("obj.zimmer")} wert={objekt.total_rooms} />
            <Zeile
              label={txt("obj.wohnflaeche")}
              wert={
                objekt.size_value === null
                  ? null
                  : `${objekt.size_value}${flaechenEinheit(objekt.size_unit)}`
              }
            />
            <Zeile label={txt("obj.baujahr")} wert={objekt.year_built} />
            <Zeile label={txt("obj.etage")} wert={objekt.floor_number} />
            <Zeile label={txt("obj.bfeNummer")} wert={objekt.bfe_number} />
          </Kachel>

          {objekt.amenities.length > 0 ? (
            <Kachel>
              <KachelKopf titel={txt("obj.ausstattung")} />
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {objekt.amenities.map((slug) => (
                  <View
                    key={slug}
                    style={{
                      paddingVertical: 5,
                      paddingHorizontal: 10,
                      borderRadius: 999,
                      backgroundColor: t.palette.surface2,
                    }}
                  >
                    {/* `ausstattungLabel` gibt bei unbekanntem Slug `null` —
                        dann stünde hier eine LEERE Pille (React rendert null
                        stumm). Der rohe Slug ist die ehrlichere Anzeige und
                        macht das fehlende Merkmal im Katalog sichtbar. */}
                    <Txt v="xs">{ausstattungLabel(slug) ?? slug}</Txt>
                  </View>
                ))}
              </View>
            </Kachel>
          ) : null}

          <Pressable
            onPress={() => navigation.navigate("Zaehlerstand", { propertyId: id, titel })}
          >
            <Kachel>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <Icon n="sliders" s={22} c={t.palette.accentText} />
                <View style={{ flex: 1 }}>
                  <Txt v="title">{txt("zaehler.titel")}</Txt>
                  <Txt v="xs" soft>
                    Ablesungen ansehen und erfassen
                  </Txt>
                </View>
                <Icon n="fwd" s={18} c={t.palette.faint} />
              </View>
            </Kachel>
          </Pressable>
        </>
      ) : null}
    </ScrollView>
  );
}

/**
 * Die Flächeneinheit als Zeichen, nicht als Datenbank-Kürzel.
 *
 * `properties.size_unit` trägt `sqm` bzw. `sqft` — ein Speicherwert, kein
 * Text für den Bildschirm. Bis zum 15.09.2026 stand er hier ROH in der
 * Zeile, und ein deutscher Eigentümer las „65 sqm". Das PMS bildet ihn längst
 * ab (`web/components/objekte/property-overview.tsx`), nur diese App nicht —
 * dieselbe Klasse wie das Wort „None" aus dem Kanal-Backstop (CLAUDE.md).
 *
 * `m²`/`ft²` sind Zeichen und keine Wörter, sie brauchen keine Übersetzung.
 * Ein UNBEKANNTES Kürzel wird unverändert durchgereicht statt geraten: dann
 * steht ein fremdes Kürzel da, und das ist sichtbar falsch — ein stillschweigend
 * angenommenes „m²" wäre eine Falschaussage über die Grösse (Wurzel 4).
 */
export function flaechenEinheit(einheit: string | null): string {
  if (!einheit) return "";
  if (einheit === "sqm") return " m²";
  if (einheit === "sqft") return " ft²";
  return ` ${einheit}`;
}

/** Eine Eckdaten-Zeile. Fehlender Wert → „—", nie 0 oder erfunden (Wurzel 4). */
function Zeile({ label, wert }: { label: string; wert: string | number | null }) {
  const t = useTheme();
  const text =
    wert === null || wert === undefined || String(wert).trim() === "" ? "—" : String(wert);
  return (
    <View
      style={{
        flexDirection: "row",
        justifyContent: "space-between",
        paddingVertical: 7,
        borderTopWidth: 1,
        borderTopColor: t.palette.line,
      }}
    >
      <Txt v="sm" soft>
        {label}
      </Txt>
      <Txt v="sm">{text}</Txt>
    </View>
  );
}

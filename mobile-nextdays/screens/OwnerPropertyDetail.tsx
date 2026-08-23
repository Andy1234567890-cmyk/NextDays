// Eigentümer · Objekt (lesend). Was der Eigentümer über SEIN Haus sehen darf:
// Adresse, Kernmerkmale, Beschreibung, Ausstattung — und, mit eigenem Recht,
// die Bilder. Quelle sind ausschließlich die owner-gescopten Endpunkte
// GET /public-portal/properties/{id} und …/{id}/images.
//
// STRIKT READ-ONLY: kein Bearbeiten-Knopf, kein Speichern, kein Navigationsweg
// in einen Agentur-Screen (der Eigentümer-Zweig bleibt hermetisch — das
// Gegenstück `screens/PropertyDetail.tsx` liegt auf /properties und würde einem
// Owner 403 liefern). Und KEIN Geldfeld: Preise/Umsätze gehören nicht in den
// Objektbereich (Contract).
//
// Fremde/unbekannte ID beantwortet der Server mit 404 — angezeigt wird
// „Objekt nicht gefunden", nicht „kein Zugriff": mehr weiß die App nicht.
import { useCallback, useEffect, useState } from "react";
import { Dimensions, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, type IconName } from "@/components/ui/Icon";
import { Btn, Card, Col, Divider, Photo, Row, Spinner, Txt } from "@/components/ui/kit";
import { EmptyState } from "@/components/ui/patterns";
import { useAuth } from "@/contexts/AuthContext";
import { ausstattungLabel } from "@/lib/ausstattung";
import { ownerFlaechenFor } from "@/lib/owner-flaechen";
import {
  getOwnerProperty,
  getOwnerPropertyImages,
  type PortalImage,
  type PortalPropertyDetail,
} from "@/lib/ownerPortal";
import { propertyTypeLabel } from "@/lib/properties";
import { useRealtime } from "@/lib/realtime";
import { useTheme } from "@/theme/ThemeProvider";

// Wie viele Ausstattungsmerkmale direkt stehen; der Rest kommt per Tipp dazu —
// wie im Verwalter-Detail, Objekte tragen im Katalog schnell 40+ Merkmale.
const AUSSTATTUNG_KURZ = 8;

// Objekt-Status in der Sprache des Eigentümers (wie im Verwalter-Detail).
const STATUS_LABEL: Record<string, string> = {
  active: "Live",
  draft: "Entwurf",
  inactive: "Inaktiv",
};

const ANGEBOTSART_LABEL: Record<string, string> = {
  entire_place: "Ganze Unterkunft",
  private_room: "Privatzimmer",
  shared_room: "Gemeinsames Zimmer",
};

function adresse(p: PortalPropertyDetail): string {
  const strasse = [p.street, p.house_number].filter(Boolean).join(" ");
  const ort = [p.postal_code, p.city].filter(Boolean).join(" ");
  return [strasse, ort, p.country].filter(Boolean).join(", ");
}

export default function OwnerPropertyDetail({
  route,
  navigation,
}: {
  route: any;
  navigation: any;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { me } = useAuth();
  const flaechen = ownerFlaechenFor(me);
  const id: string = route.params.id;

  const [p, setP] = useState<PortalPropertyDetail | null>(null);
  const [bilder, setBilder] = useState<PortalImage[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await getOwnerProperty(id);
    if (res.ok) {
      setP(res.data);
      setError(null);
    } else {
      setP(null);
      setError(res.error);
    }
  }, [id]);

  // Bilder sind ein EIGENES Recht (`pm_view_property_images`) und ein eigener
  // Endpunkt. Ohne das Recht wird gar nicht erst geladen — ein 403, den die App
  // dann verschluckt, wäre derselbe Effekt mit unnötigem Aufruf.
  const ladeBilder = useCallback(async () => {
    if (!flaechen.objektbilder) return;
    const res = await getOwnerPropertyImages(id);
    // Ein Ladefehler darf hier NICHT als „keine Bilder" erscheinen (Wurzel 4/5):
    // null hält den Abschnitt im Ladezustand statt eine leere Aussage zu machen.
    setBilder(res.ok ? res.data.items : null);
  }, [id, flaechen.objektbilder]);

  useEffect(() => {
    load();
  }, [load]);
  useEffect(() => {
    ladeBilder();
  }, [ladeBilder]);

  const aktualisieren = useCallback(() => {
    load();
    ladeBilder();
  }, [load, ladeBilder]);

  // Live: Stammdaten, Texte und der Foto-Spiegel hängen an `properties`; RLS
  // filtert die Events serverseitig auf die zugeordneten Objekte. NICHT
  // `property_photos`: dort hat `authenticated` seit 0248 kein pauschales
  // SELECT mehr, das Abo wäre eine stumme Attrappe (Wurzel 5).
  useRealtime({ table: "properties", filter: `id=eq.${id}`, onChange: aktualisieren });

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top + 12 }}>
        <Kopfleiste onBack={() => navigation.goBack()} />
        <EmptyState icon="info" titel="Objekt nicht geladen" text={error}>
          <Btn variant="outline" onPress={aktualisieren} style={{ marginTop: 6 }}>
            Erneut versuchen
          </Btn>
        </EmptyState>
      </View>
    );
  }

  if (!p) {
    return (
      <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top + 40 }}>
        <Spinner />
      </View>
    );
  }

  const anschrift = adresse(p);
  const beschreibung = p.description?.trim() ?? "";

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={aktualisieren} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Titelbild: dasselbe Bild, das schon die Objektliste zeigt. Der
            BILDER-Abschnitt weiter unten hängt dagegen am eigenen Recht. */}
        <Photo
          src={p.cover_image_url ?? undefined}
          grad="grad1"
          h={Math.round(Dimensions.get("window").width * 0.6)}
        />
        <Kopfleiste onBack={() => navigation.goBack()} ueberFoto insets={insets.top} />

        <Col gap={22} style={{ paddingHorizontal: 24, paddingTop: 20 }}>
          <Col gap={6}>
            <Txt v="h1">{p.title}</Txt>
            {/* Objektnummer: die Katasternummer, wenn es eine gibt — sonst
                nichts. Eine ersatzweise ID hilft dem Eigentümer nicht. */}
            {p.bfe_number ? (
              <Txt v="sm" soft>
                Nr. {p.bfe_number}
              </Txt>
            ) : null}
            {anschrift ? (
              <Row gap={6} style={{ alignItems: "flex-start" }}>
                <Icon n="pin" s={15} sw={1.8} c={t.palette.soft} />
                <Txt v="sm" soft style={{ flex: 1 }}>
                  {anschrift}
                </Txt>
              </Row>
            ) : null}
            {/* Gleicher Hinweis wie im Web (`portal.propertyArea.readOnlyHint`).
                Er steht hier, damit niemand nach einem Bearbeiten-Knopf sucht,
                den es bewusst nicht gibt. */}
            <Txt v="xs" faint style={{ marginTop: 2 }}>
              Diese Ansicht ist reines Lesen. Änderungen nimmt deine Verwaltung vor.
            </Txt>
          </Col>

          {/* Nur ausgeben, was gesetzt ist — eine „0 Gäste"-Zeile wäre eine
              Falschaussage über das Objekt (Wurzel 4). */}
          <Row gap={20} style={{ flexWrap: "wrap" }}>
            {p.max_guests != null ? (
              <Merkmal
                icon="users"
                wert={`${p.max_guests}`}
                label={p.max_guests === 1 ? "Gast" : "Gäste"}
              />
            ) : null}
            {p.total_rooms ? <Merkmal icon="bed" wert={p.total_rooms} label="Zimmer" /> : null}
            {p.size_value != null && p.size_unit ? (
              <Merkmal icon="grid" wert={`${p.size_value}`} label={p.size_unit} />
            ) : null}
            {/* Mehrere gleiche Einheiten unter EINEM Typ (0265). Bei genau
                einer Einheit steht hier nichts — das ist der Normalfall und
                keine Information. */}
            {p.units_total > 1 ? (
              <Merkmal icon="home" wert={`${p.units_total}`} label="Einheiten" />
            ) : null}
          </Row>

          <Divider />

          <Col gap={10}>
            <Txt v="h2">Beschreibung</Txt>
            <Txt v="body" soft>
              {beschreibung || "Für dieses Objekt ist keine Beschreibung hinterlegt."}
            </Txt>
          </Col>

          {flaechen.objektbilder && (
            <>
              <Divider />
              <Bilderabschnitt bilder={bilder} />
            </>
          )}

          <Divider />

          <Ausstattungsblock
            titel="Ausstattung"
            slugs={p.amenities}
            leerText="Für dieses Objekt ist keine Ausstattung hinterlegt."
          />

          {/* Zweiter, GETRENNTER Katalog (0243): Zimmerausstattung. Nur wenn
              gepflegt — eine leere Rubrik täuschte eine Funktion vor. Nie mit
              der Objektausstattung in eine Liste geworfen. */}
          {p.room_amenities.length > 0 && (
            <>
              <Divider />
              <Ausstattungsblock titel="Zimmerausstattung" slugs={p.room_amenities} />
            </>
          )}

          <Divider />

          <Col gap={12}>
            <Txt v="h2">Details</Txt>
            <Card>
              {/* Bewusst OHNE Währungszeile: der Objektbereich des Eigentümers
                  führt keine Geld-Angaben (Contract). */}
              {p.property_type ? (
                <Detailzeile label="Objekttyp" wert={propertyTypeLabel(p.property_type)} />
              ) : null}
              {/* Status = wird das Objekt gerade verkauft? Unbekannter Wert
                  steht roh da statt als geratenes Label (Wurzel 4). */}
              {p.status ? (
                <Detailzeile label="Status" wert={STATUS_LABEL[p.status] ?? p.status} />
              ) : null}
              {p.listing_type ? (
                <Detailzeile
                  label="Angebotsart"
                  wert={ANGEBOTSART_LABEL[p.listing_type] ?? p.listing_type}
                />
              ) : null}
              {p.floor_number != null ? <Detailzeile label="Etage" wert={`${p.floor_number}`} /> : null}
              {p.floors_total != null ? (
                <Detailzeile label="Etagen im Gebäude" wert={`${p.floors_total}`} />
              ) : null}
              {p.year_built != null ? (
                <Detailzeile label="Baujahr" wert={`${p.year_built}`} letzte />
              ) : null}
            </Card>
          </Col>
        </Col>
      </ScrollView>
    </View>
  );
}

// Eine Ausstattungsliste (Objekt- ODER Zimmerkatalog). Lange Listen werden
// gekürzt und per Tipp ausgeklappt — Objekte tragen im Katalog schnell 40+
// Merkmale.
function Ausstattungsblock({
  titel,
  slugs,
  leerText,
}: {
  titel: string;
  slugs: string[];
  leerText?: string;
}) {
  const t = useTheme();
  const [alle, setAlle] = useState(false);
  const sichtbar = alle ? slugs : slugs.slice(0, AUSSTATTUNG_KURZ);
  const rest = slugs.length - sichtbar.length;

  return (
    <Col gap={12}>
      <Txt v="h2">{titel}</Txt>
      {slugs.length === 0 ? (
        <Txt v="body" soft>
          {leerText ?? "Nichts hinterlegt."}
        </Txt>
      ) : (
        <>
          <Col gap={0}>
            {sichtbar.map((slug) => (
              <Row key={slug} gap={10} style={{ paddingVertical: 9, alignItems: "center" }}>
                <Icon n="check" s={15} sw={2} c={t.palette.soft} />
                <Txt v="sm" style={{ flex: 1 }}>
                  {/* Ohne Katalogeintrag steht der Slug da — ein sichtbarer
                      Datenfehler, den der Eigentümer melden kann, statt eines
                      stillschweigend weggelassenen Merkmals. */}
                  {ausstattungLabel(slug) ?? slug}
                </Txt>
              </Row>
            ))}
          </Col>
          {rest > 0 && (
            <Pressable
              accessibilityRole="button"
              onPress={() => setAlle(true)}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <Txt v="sm" style={{ fontFamily: t.fonts.semibold, textDecorationLine: "underline" }}>
                Alle {slugs.length} anzeigen
              </Txt>
            </Pressable>
          )}
        </>
      )}
    </Col>
  );
}

// Bilder eines Objekts. Drei ehrliche Zustände: lädt · keine Bilder · Bilder.
// `null` ist NICHT „leer" — es heißt „noch nicht (oder nicht) geladen".
function Bilderabschnitt({ bilder }: { bilder: PortalImage[] | null }) {
  const breite = Dimensions.get("window").width;
  // Zwei Spalten mit 24er Außen- und 10er Innenabstand.
  const kachel = Math.floor((breite - 24 * 2 - 10) / 2);
  return (
    <Col gap={12}>
      <Txt v="h2">Bilder</Txt>
      {!bilder && <Spinner />}
      {bilder && bilder.length === 0 && (
        <Txt v="body" soft>
          Für dieses Objekt sind keine Bilder hinterlegt.
        </Txt>
      )}
      {bilder && bilder.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
          {bilder.map((bild) => (
            <Photo key={bild.id} src={bild.url} w={kachel} h={Math.round(kachel * 0.72)} r={12} />
          ))}
        </View>
      )}
    </Col>
  );
}

// Zurück-Knopf — über dem Foto schwebend, sonst normal in der Zeile.
function Kopfleiste({
  onBack,
  ueberFoto,
  insets,
}: {
  onBack: () => void;
  ueberFoto?: boolean;
  insets?: number;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Zurück"
      onPress={onBack}
      hitSlop={10}
      style={({ pressed }) => ({
        opacity: pressed ? 0.6 : 1,
        ...(ueberFoto
          ? {
              position: "absolute",
              top: (insets ?? 0) + 10,
              left: 16,
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: "rgba(255,255,255,0.92)",
              alignItems: "center",
              justifyContent: "center",
            }
          : { paddingHorizontal: 24, paddingBottom: 8 }),
      })}
    >
      <Icon n="back" s={20} sw={2} c={t.palette.ink} />
    </Pressable>
  );
}

function Merkmal({ icon, wert, label }: { icon: IconName; wert: string; label: string }) {
  const t = useTheme();
  return (
    <Row gap={8} style={{ alignItems: "center" }}>
      <Icon n={icon} s={17} sw={1.8} c={t.palette.soft} />
      <Txt v="sm">
        {wert} {label}
      </Txt>
    </Row>
  );
}

function Detailzeile({ label, wert, letzte }: { label: string; wert: string; letzte?: boolean }) {
  return (
    <View>
      <Row style={{ paddingVertical: 13, paddingHorizontal: 16, justifyContent: "space-between" }}>
        <Txt v="sm" soft>
          {label}
        </Txt>
        <Txt v="sm">{wert}</Txt>
      </Row>
      {!letzte && <Divider />}
    </View>
  );
}

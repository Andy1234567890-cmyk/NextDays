// Gastgeber · Objekt-Detail. Aufbau nach der Referenz-App (Hostaway
// „Listing Details"): oben Foto, Name, Nummer, Adresse und die Kernmerkmale,
// darunter Inhaltsabschnitte.
//
// Es stehen NUR Abschnitte hier, die der properties-Slice wirklich liefert.
// Hausregeln und Stornobedingungen kennt unser Objektmodell (noch) nicht — sie
// werden bewusst NICHT als leere Rubrik gezeigt, sonst sieht die App nach einer
// Funktion aus, die es nicht gibt (Wurzel 4).
import { useCallback, useEffect, useState } from "react";
import { Dimensions, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, type IconName } from "@/components/ui/Icon";
import { Btn, Card, Col, Divider, Photo, Row, Spinner, Txt } from "@/components/ui/kit";
import { EmptyState } from "@/components/ui/patterns";
import { ausstattungLabel } from "@/lib/ausstattung";
import {
  getProperty,
  propertyTypeLabel,
  type ChannelState,
  type Property,
} from "@/lib/properties";
import { useRealtime } from "@/lib/realtime";
import { useTheme } from "@/theme/ThemeProvider";

// Wie viele Ausstattungsmerkmale direkt stehen; der Rest kommt per Tipp dazu.
// Objekte tragen im Channex-Katalog schnell 40+ Merkmale.
const AUSSTATTUNG_KURZ = 8;

const STATUS_LABEL: Record<Property["status"], string> = {
  active: "Live",
  draft: "Entwurf",
  inactive: "Inaktiv",
};

const KANAL_LABEL = { website: "Website", marketplace: "Plattform", portals: "Portale" } as const;
type KanalKey = keyof typeof KANAL_LABEL;

// Angebotsart (listing_type) — Spiegel der Taxonomie aus dem Web-Dashboard.
const ANGEBOTSART_LABEL: Record<string, string> = {
  entire_place: "Ganze Unterkunft",
  private_room: "Privatzimmer",
  shared_room: "Gemeinsames Zimmer",
};

function adresse(p: Property): string {
  const strasse = [p.street, p.house_number].filter(Boolean).join(" ");
  const ort = [p.postal_code, p.city].filter(Boolean).join(" ");
  return [strasse, ort, p.country].filter(Boolean).join(", ");
}

export default function PropertyDetail({ route, navigation }: { route: any; navigation: any }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const id: string = route.params.id;
  const [p, setP] = useState<Property | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [alleMerkmale, setAlleMerkmale] = useState(false);

  const load = useCallback(async () => {
    const res = await getProperty(id);
    if (res.ok) {
      setP(res.data);
      setError(null);
    } else {
      setP(null);
      setError(res.error);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Live: Status, Kanal-Sichtbarkeit, Fotos und Texte kommen aus properties.
  useRealtime({ table: "properties", filter: `id=eq.${id}`, onChange: load });

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top + 12 }}>
        <Kopfleiste onBack={() => navigation.goBack()} />
        <EmptyState icon="info" titel="Objekt nicht geladen" text={error}>
          <Btn variant="outline" onPress={load} style={{ marginTop: 6 }}>
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

  const merkmale = alleMerkmale ? p.amenities : p.amenities.slice(0, AUSSTATTUNG_KURZ);
  const rest = p.amenities.length - merkmale.length;
  const anschrift = adresse(p);
  // Kurzbeschreibung: der volle Text lebt im eigenen Screen (Lesen/Bearbeiten).
  const beschreibung = p.description?.trim() || "";

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
        showsVerticalScrollIndicator={false}
      >
        <Fotostreifen fotos={p.photos} />
        <Kopfleiste onBack={() => navigation.goBack()} ueberFoto insets={insets.top} />

        <Col gap={22} style={{ paddingHorizontal: 24, paddingTop: 20 }}>
          <Col gap={6}>
            <Row gap={8} style={{ alignItems: "center" }}>
              <Txt v="h1" style={{ flex: 1 }}>
                {p.title}
              </Txt>
              <StatusBadge status={p.status} />
            </Row>
            {/* Objektnummer: die Katasternummer, sonst die kurze ID — nie beides
                erfinden. Ohne bfe_number steht die ID da, damit der Support
                überhaupt etwas zum Nachschlagen hat. */}
            <Txt v="sm" soft>
              {p.bfe_number ? `Nr. ${p.bfe_number}` : `ID ${p.id.slice(0, 8).toUpperCase()}`}
            </Txt>
            {anschrift ? (
              <Row gap={6} style={{ alignItems: "flex-start" }}>
                <Icon n="pin" s={15} sw={1.8} c={t.palette.soft} />
                <Txt v="sm" soft style={{ flex: 1 }}>
                  {anschrift}
                </Txt>
              </Row>
            ) : null}
          </Col>

          {/* Kernmerkmale: nur ausgeben, was gesetzt ist. Eine „0 Gäste"- oder
              „— m²"-Zeile wäre eine Falschaussage über das Objekt. */}
          <Row gap={20} style={{ flexWrap: "wrap" }}>
            <Merkmal icon="users" wert={`${p.max_guests}`} label={p.max_guests === 1 ? "Gast" : "Gäste"} />
            {p.total_rooms ? <Merkmal icon="bed" wert={p.total_rooms} label="Zimmer" /> : null}
            {p.size_value != null && p.size_unit ? (
              <Merkmal icon="grid" wert={`${p.size_value}`} label={p.size_unit} />
            ) : null}
          </Row>

          <Divider />

          <Abschnitt
            titel="Beschreibung"
            hinweis={beschreibung ? undefined : "Noch keine Beschreibung hinterlegt."}
            onPress={() => navigation.navigate("PropertyDescription", { id: p.id })}
          >
            {beschreibung ? (
              <Txt v="body" soft numberOfLines={3}>
                {beschreibung}
              </Txt>
            ) : null}
          </Abschnitt>

          <Divider />

          <Abschnitt
            titel="Zusatzfelder"
            hinweis="Eigene Angaben deines Betriebs zu diesem Objekt."
            onPress={() => navigation.navigate("PropertyCustomFields", { id: p.id })}
          />

          <Divider />

          <Col gap={12}>
            <Txt v="h2">Ausstattung</Txt>
            {p.amenities.length === 0 ? (
              <Txt v="body" soft>
                Noch keine Ausstattung hinterlegt.
              </Txt>
            ) : (
              <>
                <Col gap={0}>
                  {merkmale.map((slug) => (
                    <Row key={slug} gap={10} style={{ paddingVertical: 9, alignItems: "center" }}>
                      <Icon n="check" s={15} sw={2} c={t.palette.soft} />
                      <Txt v="sm" style={{ flex: 1 }}>
                        {ausstattungLabel(slug)}
                      </Txt>
                    </Row>
                  ))}
                </Col>
                {rest > 0 && (
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => setAlleMerkmale(true)}
                    style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                  >
                    <Txt v="sm" style={{ fontFamily: t.fonts.semibold, textDecorationLine: "underline" }}>
                      Alle {p.amenities.length} anzeigen
                    </Txt>
                  </Pressable>
                )}
              </>
            )}
          </Col>

          <Divider />

          <Col gap={12}>
            <Txt v="h2">Details</Txt>
            <Card>
              <Detailzeile label="Objekttyp" wert={propertyTypeLabel(p.property_type)} />
              {p.listing_type ? (
                <Detailzeile
                  label="Angebotsart"
                  wert={ANGEBOTSART_LABEL[p.listing_type] ?? p.listing_type}
                />
              ) : null}
              {p.floor_number != null ? (
                <Detailzeile label="Etage" wert={`${p.floor_number}`} />
              ) : null}
              {p.floors_total != null ? (
                <Detailzeile label="Etagen im Gebäude" wert={`${p.floors_total}`} />
              ) : null}
              {p.year_built != null ? (
                <Detailzeile label="Baujahr" wert={`${p.year_built}`} />
              ) : null}
              {/* Währung ohne Betrag: sie gilt für alle Preise des Objekts. */}
              {p.currency ? <Detailzeile label="Währung" wert={p.currency} letzte /> : null}
            </Card>
          </Col>

          <Divider />

          {/* Unser Gegenstück zu „Listing Channels": die drei Vertriebsachsen.
              Kein OTA-Logo-Raster erfinden — die App zeigt den Zustand, den der
              Server je Achse wirklich kennt. */}
          <Col gap={12}>
            <Txt v="h2">Vertriebskanäle</Txt>
            {p.channels ? (
              <Card>
                {(Object.keys(KANAL_LABEL) as KanalKey[]).map((k, i, arr) => (
                  <Kanalzeile
                    key={k}
                    label={KANAL_LABEL[k]}
                    state={p.channels![k]}
                    letzte={i === arr.length - 1}
                  />
                ))}
              </Card>
            ) : (
              <Txt v="body" soft>
                Kanal-Zustand wurde vom Server nicht mitgeliefert.
              </Txt>
            )}
          </Col>
        </Col>
      </ScrollView>
    </View>
  );
}

// Foto-Streifen: seitlich blätterbar, ein Punkt je Bild. Ohne Fotos bleibt der
// Platzhalter-Verlauf stehen (wie in der Objektliste).
function Fotostreifen({ fotos }: { fotos: string[] }) {
  const t = useTheme();
  const breite = Dimensions.get("window").width;
  const hoehe = Math.round(breite * 0.66);
  const [index, setIndex] = useState(0);

  if (!fotos || fotos.length === 0) {
    return <Photo grad="grad1" h={hoehe} />;
  }

  return (
    <View>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) =>
          setIndex(Math.round(e.nativeEvent.contentOffset.x / breite))
        }
      >
        {fotos.map((src) => (
          <Photo key={src} src={src} h={hoehe} w={breite} />
        ))}
      </ScrollView>
      {fotos.length > 1 && (
        <Row
          gap={6}
          style={{ position: "absolute", bottom: 12, alignSelf: "center", justifyContent: "center" }}
        >
          {fotos.map((src, i) => (
            <View
              key={src}
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: i === index ? "#FFFFFF" : "rgba(255,255,255,0.5)",
              }}
            />
          ))}
        </Row>
      )}
      {fotos.length > 1 && (
        <View
          style={{
            position: "absolute",
            right: 14,
            bottom: 12,
            paddingHorizontal: 10,
            paddingVertical: 4,
            borderRadius: t.radius.pill,
            backgroundColor: "rgba(0,0,0,0.45)",
          }}
        >
          <Txt v="xs" color="#FFFFFF">
            {index + 1}/{fotos.length}
          </Txt>
        </View>
      )}
    </View>
  );
}

// Zurück-Knopf. Über dem Foto schwebt er auf einer runden Fläche, sonst steht
// er normal in der Zeile (Fehler-/Ladezustand hat kein Foto).
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

function StatusBadge({ status }: { status: Property["status"] }) {
  const t = useTheme();
  const ton =
    status === "active"
      ? { bg: "#E6F4EA", fg: "#1E7A46" }
      : status === "draft"
        ? { bg: "#FCF0DA", fg: "#9A6B12" }
        : { bg: t.palette.surface2, fg: t.palette.soft };
  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: t.radius.pill,
        backgroundColor: ton.bg,
      }}
    >
      <Txt v="xs" color={ton.fg} style={{ fontFamily: t.fonts.semibold }}>
        {STATUS_LABEL[status]}
      </Txt>
    </View>
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

// Antippbarer Inhaltsabschnitt mit Chevron (Referenz-Muster).
function Abschnitt({
  titel,
  hinweis,
  onPress,
  children,
}: {
  titel: string;
  hinweis?: string;
  onPress: () => void;
  children?: React.ReactNode;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
    >
      <Col gap={8}>
        <Row gap={8} style={{ alignItems: "center" }}>
          <Txt v="h2" style={{ flex: 1 }}>
            {titel}
          </Txt>
          <Icon n="fwd" s={16} sw={2} c={t.palette.faint} />
        </Row>
        {children}
        {hinweis ? (
          <Txt v="body" soft>
            {hinweis}
          </Txt>
        ) : null}
      </Col>
    </Pressable>
  );
}

function Detailzeile({
  label,
  wert,
  letzte,
}: {
  label: string;
  wert: string;
  letzte?: boolean;
}) {
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

function Kanalzeile({
  label,
  state,
  letzte,
}: {
  label: string;
  state: ChannelState;
  letzte?: boolean;
}) {
  const t = useTheme();
  // paused/not_connected sind neutral (Nutzer-Wille bzw. nicht eingerichtet),
  // nur error ist rot — bewusst getrennt, wie in der Objektliste.
  const farbe: Record<ChannelState, string> = {
    active: "#10B981",
    paused: t.palette.soft,
    not_connected: t.palette.faint,
    error: "#DC2626",
  };
  const text: Record<ChannelState, string> = {
    active: "Aktiv",
    paused: "Pausiert",
    not_connected: "Nicht eingerichtet",
    error: "Fehler",
  };
  return (
    <View>
      <Row style={{ paddingVertical: 13, paddingHorizontal: 16, justifyContent: "space-between" }}>
        <Txt v="sm">{label}</Txt>
        <Row gap={7} style={{ alignItems: "center" }}>
          <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: farbe[state] }} />
          <Txt v="sm" soft>
            {text[state]}
          </Txt>
        </Row>
      </Row>
      {!letzte && <Divider />}
    </View>
  );
}

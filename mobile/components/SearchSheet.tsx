// Such-Maske als Vollflächen-Sheet: Akkordeon aus drei Schritten (Wo · Wann ·
// Wer). Der offene Schritt zeigt seine Eingabe, die geschlossenen nur eine
// Zusammenfassungszeile. Über dem Sheet bleiben die Kategorie-Reiter sichtbar,
// daneben das Schließen-Kreuz — Aufbau wie in der Marktplatz-Referenz.
//
// Vorgeschlagene Reiseziele kommen aus den ECHTEN Inseraten (Städte mit
// Angebot), nicht aus einer erfundenen Liste (Wurzel 4). Der Zeitraum wird im
// Kalender gewählt, nie getippt.
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DateRangePicker } from "@/components/DateRangePicker";
import { Icon, type IconName } from "@/components/ui/Icon";
import { PlaceIllustration, motivFuerOrt, type Motiv } from "@/components/ui/PlaceIllustration";
import { Col, Row, Txt } from "@/components/ui/kit";
import { CategoryTabs, type CategoryTab } from "@/components/ui/patterns";
import { formatZeitraum } from "@/lib/datum";
import { aktuellerStandort, type Position } from "@/lib/standort";
import { useTheme } from "@/theme/ThemeProvider";

export type SucheWerte = {
  ort: string;
  von: string | null;
  bis: string | null;
  gaeste: number | null;
  // Gesetzt, wenn „In der Nähe" gewählt wurde: dann sucht der Server im
  // Umkreis dieser Position statt über den Ortsnamen.
  umkreis: Position | null;
};

export const LEERE_SUCHE: SucheWerte = {
  ort: "",
  von: null,
  bis: null,
  gaeste: null,
  umkreis: null,
};

// Umkreis der Standortsuche. Bewusst großzügig: bei dünnem Angebot wäre ein
// enger Radius eine leere Ergebnisliste, obwohl 60 km entfernt etwas frei ist.
export const UMKREIS_KM = 150;

type Schritt = "wo" | "wann" | "wer";

export function SearchSheet({
  open,
  onClose,
  werte,
  onSubmit,
  // Städte mit tatsächlichem Angebot — Grundlage der Vorschläge.
  vorschlaege,
  tabs,
  tab,
  onTabChange,
}: {
  open: boolean;
  onClose: () => void;
  werte: SucheWerte;
  onSubmit: (w: SucheWerte) => void;
  vorschlaege: string[];
  tabs: CategoryTab[];
  tab: string;
  onTabChange: (key: string) => void;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  const [schritt, setSchritt] = useState<Schritt>("wo");
  const [entwurf, setEntwurf] = useState<SucheWerte>(werte);

  // Beim Öffnen den aktuellen Suchzustand übernehmen und oben beginnen.
  const [warOffen, setWarOffen] = useState(false);
  if (open !== warOffen) {
    setWarOffen(open);
    if (open) {
      setEntwurf(werte);
      setSchritt("wo");
    }
  }

  // Die Maske fährt von OBEN herein (klappt über den Bildschirm herunter).
  // Die Animation liegt auf dem Inhalt statt auf `animationType`, damit
  // Richtung und Tempo hier bestimmt werden.
  const y = useRef(new Animated.Value(-height)).current;
  useEffect(() => {
    Animated.timing(y, {
      toValue: open ? 0 : -height,
      duration: open ? 520 : 380,
      useNativeDriver: true,
    }).start();
  }, [open, height, y]);

  const [standortLaeuft, setStandortLaeuft] = useState(false);
  const [standortFehler, setStandortFehler] = useState<string | null>(null);

  const inDerNaehe = async () => {
    if (standortLaeuft) return; // Doppeltipp-Guard (Wurzel 2)
    setStandortLaeuft(true);
    setStandortFehler(null);
    const res = await aktuellerStandort();
    setStandortLaeuft(false);
    if (!res.ok) {
      setStandortFehler(res.text);
      return;
    }
    // Ortsname leeren: gesucht wird jetzt über die Position, nicht über Text.
    setEntwurf((e) => ({ ...e, ort: "", umkreis: res.position }));
    setSchritt("wann");
  };

  const gefiltert = useMemo(() => {
    const q = entwurf.ort.trim().toLowerCase();
    if (!q) return vorschlaege;
    return vorschlaege.filter((s) => s.toLowerCase().includes(q));
  }, [entwurf.ort, vorschlaege]);

  const zeitraumText =
    entwurf.von && entwurf.bis
      ? formatZeitraum(entwurf.von, entwurf.bis)
      : entwurf.von
        ? "Abreise wählen"
        : null;

  const gaesteText = entwurf.gaeste ? `${entwurf.gaeste} ${entwurf.gaeste === 1 ? "Gast" : "Gäste"}` : null;

  return (
    <Modal visible={open} animationType="none" transparent statusBarTranslucent onRequestClose={onClose}>
      <Animated.View
        style={{
          flex: 1,
          backgroundColor: t.palette.surface2,
          paddingTop: insets.top,
          transform: [{ translateY: y }],
        }}
      >
        {/* Kopf: Kategorie-Reiter + Schließen */}
        <Row style={{ paddingRight: 16, paddingBottom: 8, justifyContent: "space-between" }}>
          <CategoryTabs tabs={tabs} value={tab} onChange={onTabChange} style={{ flex: 1 }} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Suche schließen"
            onPress={onClose}
            style={({ pressed }) => [
              {
                width: 44,
                height: 44,
                borderRadius: 22,
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: t.palette.surface,
                opacity: pressed ? 0.8 : 1,
              },
              t.shadow.sm,
            ]}
          >
            <Icon n="x" s={20} sw={2} c={t.palette.ink} />
          </Pressable>
        </Row>

        <ScrollView
          contentContainerStyle={{ padding: 12, gap: 12, paddingBottom: 24 }}
          keyboardShouldPersistTaps="handled"
        >
          {/* --- Wo? --- */}
          <SchrittKarte
            offen={schritt === "wo"}
            label="Wo"
            wert={entwurf.ort.trim() || (entwurf.umkreis ? "In der Nähe" : null)}
            platzhalter="Reiseziel hinzufügen"
            titel="Wo?"
            onOeffnen={() => setSchritt("wo")}
          >
            <Col gap={18}>
              <Row
                gap={12}
                style={{
                  borderWidth: 1,
                  borderColor: t.palette.line,
                  borderRadius: 14,
                  paddingHorizontal: 16,
                }}
              >
                <Icon n="search" s={20} sw={2} c={t.palette.ink} />
                <TextInput
                  value={entwurf.ort}
                  // Ein getippter Ort ersetzt die Standortsuche — sonst lägen
                  // zwei Ortsfilter gleichzeitig an.
                  onChangeText={(v) => setEntwurf((e) => ({ ...e, ort: v, umkreis: null }))}
                  placeholder="Reiseziele suchen"
                  placeholderTextColor={t.palette.faint}
                  returnKeyType="search"
                  onSubmitEditing={() => setSchritt("wann")}
                  style={{
                    flex: 1,
                    color: t.palette.ink,
                    fontFamily: t.fonts.regular,
                    fontSize: 16,
                    paddingVertical: 16,
                  }}
                />
              </Row>

              <Col gap={4}>
                <Txt v="sm" soft>
                  Vorgeschlagene Reiseziele
                </Txt>

                {/* „In der Nähe" holt die echte Position des Geräts und sucht
                    im Umkreis. Schlägt das fehl (keine Freigabe, kein Fix),
                    steht der Grund da — es wird NICHT still auf „überall"
                    zurückgefallen (Wurzel 5). */}
                <ZielZeile
                  motiv="standort"
                  titel="In der Nähe"
                  untertitel={
                    standortLaeuft
                      ? "Standort wird bestimmt …"
                      : (standortFehler ?? "Finde heraus, was es in deiner Nähe gibt.")
                  }
                  onPress={inDerNaehe}
                />

                {gefiltert.slice(0, 6).map((ziel) => (
                  <ZielZeile
                    key={ziel}
                    motiv={motivFuerOrt(ziel)}
                    titel={ziel}
                    onPress={() => {
                      setEntwurf((e) => ({ ...e, ort: ziel, umkreis: null }));
                      setSchritt("wann");
                    }}
                  />
                ))}
              </Col>
            </Col>
          </SchrittKarte>

          {/* --- Wann? --- */}
          <SchrittKarte
            offen={schritt === "wann"}
            label="Wann"
            wert={zeitraumText}
            platzhalter="Zeitraum hinzufügen"
            titel="Wann möchtest du reisen?"
            onOeffnen={() => setSchritt("wann")}
          >
            <View style={{ maxHeight: height * 0.5 }}>
              <ScrollView showsVerticalScrollIndicator={false} nestedScrollEnabled>
                <DateRangePicker
                  von={entwurf.von}
                  bis={entwurf.bis}
                  onChange={(von, bis) => {
                    setEntwurf((e) => ({ ...e, von, bis }));
                    if (von && bis) setSchritt("wer");
                  }}
                />
              </ScrollView>
            </View>
          </SchrittKarte>

          {/* --- Wer? --- */}
          <SchrittKarte
            offen={schritt === "wer"}
            label="Wer"
            wert={gaesteText}
            platzhalter="Gäste hinzufügen"
            titel="Wer kommt mit?"
            onOeffnen={() => setSchritt("wer")}
          >
            <Row style={{ justifyContent: "space-between", paddingVertical: 8 }}>
              <Col gap={2}>
                <Txt v="body" style={{ fontFamily: t.fonts.semibold }}>
                  Gäste
                </Txt>
                <Txt v="sm" soft>
                  Anzahl der reisenden Personen
                </Txt>
              </Col>
              <Row gap={16}>
                <ZaehlerKnopf
                  icon="x"
                  label="Weniger Gäste"
                  disabled={!entwurf.gaeste}
                  onPress={() =>
                    setEntwurf((e) => {
                      const n = (e.gaeste ?? 0) - 1;
                      return { ...e, gaeste: n > 0 ? n : null };
                    })
                  }
                />
                <Txt v="body" style={{ minWidth: 24, textAlign: "center" }}>
                  {entwurf.gaeste ?? 0}
                </Txt>
                <ZaehlerKnopf
                  icon="plus"
                  label="Mehr Gäste"
                  // Harte Obergrenze statt unbegrenzter Zahl (Wurzel 8).
                  disabled={(entwurf.gaeste ?? 0) >= 16}
                  onPress={() => setEntwurf((e) => ({ ...e, gaeste: Math.min((e.gaeste ?? 0) + 1, 16) }))}
                />
              </Row>
            </Row>
          </SchrittKarte>
        </ScrollView>

        {/* Fußzeile: zurücksetzen + suchen */}
        <Row
          style={{
            justifyContent: "space-between",
            paddingHorizontal: 20,
            paddingTop: 12,
            paddingBottom: insets.bottom + 12,
            backgroundColor: t.palette.surface,
            borderTopWidth: 1,
            borderTopColor: t.palette.line,
          }}
        >
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setEntwurf(LEERE_SUCHE);
              setSchritt("wo");
            }}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, paddingVertical: 8 })}
          >
            <Txt v="body" style={{ fontFamily: t.fonts.semibold, textDecorationLine: "underline" }}>
              Alle löschen
            </Txt>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => onSubmit(entwurf)}
            style={({ pressed }) => ({
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              paddingHorizontal: 26,
              paddingVertical: 15,
              borderRadius: t.radius.pill,
              backgroundColor: t.palette.accent,
              opacity: pressed ? 0.88 : 1,
            })}
          >
            <Icon n="search" s={18} sw={2.4} c={t.palette.accentInk} />
            <Txt v="body" color={t.palette.accentInk} style={{ fontFamily: t.fonts.semibold }}>
              Suche
            </Txt>
          </Pressable>
        </Row>
      </Animated.View>
    </Modal>
  );
}

// --- Bausteine --------------------------------------------------------------

// Eine Akkordeon-Karte: geschlossen eine Zeile (Label links, Wert rechts),
// offen die Überschrift plus Inhalt.
function SchrittKarte({
  offen,
  label,
  wert,
  platzhalter,
  titel,
  onOeffnen,
  children,
}: {
  offen: boolean;
  label: string;
  wert: string | null;
  platzhalter: string;
  titel: string;
  onOeffnen: () => void;
  children: React.ReactNode;
}) {
  const t = useTheme();

  if (!offen) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${wert ?? platzhalter}`}
        onPress={onOeffnen}
        style={({ pressed }) => [
          {
            backgroundColor: t.palette.surface,
            borderRadius: 18,
            paddingHorizontal: 22,
            paddingVertical: 20,
            opacity: pressed ? 0.9 : 1,
          },
          t.shadow.sm,
        ]}
      >
        <Row style={{ justifyContent: "space-between", gap: 16 }}>
          <Txt v="sm" soft>
            {label}
          </Txt>
          <Txt v="sm" numberOfLines={1} style={{ fontFamily: t.fonts.semibold, flexShrink: 1 }}>
            {wert ?? platzhalter}
          </Txt>
        </Row>
      </Pressable>
    );
  }

  return (
    <View
      style={[
        {
          backgroundColor: t.palette.surface,
          borderRadius: 18,
          paddingHorizontal: 22,
          paddingTop: 22,
          paddingBottom: 18,
          gap: 18,
        },
        t.shadow.sm,
      ]}
    >
      <Txt v="h2">{titel}</Txt>
      {children}
    </View>
  );
}

// Vorschlagszeile: Illustrations-Kachel links, Titel und optionaler
// Erklärsatz rechts.
function ZielZeile({
  motiv,
  titel,
  untertitel,
  onPress,
}: {
  motiv: Motiv;
  titel: string;
  untertitel?: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={untertitel ? `${titel}, ${untertitel}` : titel}
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
    >
      <Row gap={14} style={{ paddingVertical: 10 }}>
        <PlaceIllustration motiv={motiv} />
        <Col gap={2} style={{ flex: 1 }}>
          <Txt v="title" numberOfLines={1}>
            {titel}
          </Txt>
          {untertitel ? (
            <Txt v="sm" soft numberOfLines={2}>
              {untertitel}
            </Txt>
          ) : null}
        </Col>
      </Row>
    </Pressable>
  );
}

function ZaehlerKnopf({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: IconName;
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 34,
        height: 34,
        borderRadius: 17,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: t.palette.line,
        opacity: disabled ? 0.35 : pressed ? 0.6 : 1,
      })}
    >
      <Icon n={icon} s={16} sw={2} c={t.palette.ink} />
    </Pressable>
  );
}

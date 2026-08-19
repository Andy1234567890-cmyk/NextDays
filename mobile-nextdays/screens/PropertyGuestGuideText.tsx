// Gastgeber · EIN Block der Gästemappe, je Sprache lesen und bearbeiten.
//
// Aufbau wie `PropertyDescription`: Lesemodus mit „Mehr anzeigen"/„Kopieren",
// Bearbeitungsmodus mit Abbrechen/Speichern und Rückfrage bei ungespeicherten
// Änderungen. Zusätzlich der Sprach-Umschalter (de/en/da) — die Texte sind
// mehrsprachig, weil der Gast sie in SEINER Sprache liest
// (`apps/api/.../inbox/feld_kontext.py`).
//
// RICH-TEXT: Im Web entstehen diese Texte in einem Formatierungs-Editor, in der
// DB steht HTML. Die App zeigt Klartext (`htmlZuText`) und wandelt beim
// Speichern zurück (`textZuHtml`). Fett, kursiv und Link-Ziele überleben das
// nicht — deshalb fragt der Screen VOR dem Bearbeiten, statt die Formatierung
// still zu verlieren.
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Clipboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/Icon";
import { Btn, Col, Row, Segmented, Spinner, Txt } from "@/components/ui/kit";
import { EmptyState } from "@/components/ui/patterns";
import { useAuth } from "@/contexts/AuthContext";
import {
  SPRACHEN,
  SPRACH_LABEL,
  hatFormatierung,
  htmlZuText,
  leseGaestemappe,
  mappeSchreiben,
  mappenFeld,
  textZuHtml,
  type MappenFeld,
  type Sprache,
} from "@/lib/gaestemappe";
import { can } from "@/lib/permissions";
import { getProperty, updateProperty, type Property } from "@/lib/properties";
import { useTheme } from "@/theme/ThemeProvider";

// Ab dieser Länge wird im Lesemodus gekürzt und „Mehr anzeigen" eingeblendet.
const KURZ_ZEILEN = 12;

export default function PropertyGuestGuideText({
  route,
  navigation,
}: {
  route: any;
  navigation: any;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { me } = useAuth();
  const id: string = route.params.id;
  const feld = mappenFeld(route.params.feld as MappenFeld);
  const darfBearbeiten = can(me, "manage_properties");

  const [p, setP] = useState<Property | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sprachIndex, setSprachIndex] = useState(0);
  const [bearbeiten, setBearbeiten] = useState(false);
  const [entwurf, setEntwurf] = useState("");
  const [ausgeklappt, setAusgeklappt] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hinweis, setHinweis] = useState<string | null>(null);

  const sprache: Sprache = SPRACHEN[sprachIndex];
  const html = p ? leseGaestemappe(p.type_attributes)[feld.key][sprache] : "";
  const gespeichert = htmlZuText(html);
  const geaendert = bearbeiten && entwurf !== gespeichert;

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

  const speichern = async (): Promise<boolean> => {
    if (busy || !p) return false;
    setBusy(true);
    setHinweis(null);
    // `type_attributes` wird vom Endpoint als GANZES ersetzt — deshalb den
    // vorhandenen Stand mitgeben und nur diesen einen Text tauschen
    // (`mappeSchreiben`). Der Stand kommt aus dem letzten Laden; eine parallele
    // Änderung im Web an einem anderen Block ist damit noch nicht abgedeckt —
    // dasselbe Verhalten wie im Web-Formular.
    const res = await updateProperty(id, {
      type_attributes: mappeSchreiben(p, feld.key, sprache, textZuHtml(entwurf)),
    });
    setBusy(false);
    if (!res.ok) {
      setHinweis(res.error);
      return false;
    }
    setP(res.data);
    setBearbeiten(false);
    return true;
  };

  // Wächter gegen Datenverlust: Zurück mit ungespeicherten Änderungen fragt
  // nach, statt die Eingabe stillschweigend zu verwerfen.
  useEffect(() => {
    const ab = navigation.addListener("beforeRemove", (e: any) => {
      if (!geaendert) return;
      e.preventDefault();
      Alert.alert("Ungespeicherte Änderungen", "Was soll damit passieren?", [
        { text: "Abbrechen", style: "cancel" },
        { text: "Verwerfen", style: "destructive", onPress: () => navigation.dispatch(e.data.action) },
        {
          text: "Speichern",
          onPress: async () => {
            const ok = await speichern();
            if (ok) navigation.dispatch(e.data.action);
          },
        },
      ]);
    });
    return ab;
    // `speichern` ist unten stabil genug für diesen Effekt; bewusst nur an
    // `geaendert` gehängt, damit der Listener nicht bei jedem Tastendruck neu
    // registriert wird.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, geaendert]);

  const bearbeitenStarten = () => {
    const los = () => {
      setEntwurf(gespeichert);
      setBearbeiten(true);
      setHinweis(null);
    };
    if (hatFormatierung(html)) {
      Alert.alert(
        "Formatierung geht verloren",
        "Dieser Text wurde am Rechner mit Formatierung angelegt (fett, Links, " +
          "verschachtelte Listen). Die App bearbeitet reinen Text — beim " +
          "Speichern bleibt der Wortlaut, die Formatierung nicht.",
        [
          { text: "Abbrechen", style: "cancel" },
          { text: "Trotzdem bearbeiten", onPress: los },
        ],
      );
      return;
    }
    los();
  };

  const kopieren = () => {
    // Clipboard aus dem RN-Kern ist als veraltet markiert (Warnung nur im
    // Dev-Build). Der Ersatz @react-native-clipboard/clipboard ist ein natives
    // Modul und braucht ein `pod install` — bewusst als eigener Schritt.
    Clipboard.setString(gespeichert || feld.shortcode);
    setHinweis("In die Zwischenablage kopiert.");
  };

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top + 12 }}>
        <EmptyState icon="info" titel={`${feld.titel} nicht geladen`} text={error}>
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

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Row style={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Zurück"
          onPress={() => navigation.goBack()}
          hitSlop={10}
          style={({ pressed }) => ({ padding: 6, opacity: pressed ? 0.6 : 1 })}
        >
          <Icon n="back" s={20} sw={2} c={t.palette.ink} />
        </Pressable>
        <Txt v="h2" style={{ flex: 1 }} numberOfLines={1}>
          {feld.titel}
        </Txt>
        {/* Ohne manage_properties gibt es den Bearbeiten-Weg gar nicht — die
            Berechtigung kommt aus /auth/me, nicht aus einer lokalen Annahme. */}
        {!bearbeiten && darfBearbeiten && (
          <Pressable
            accessibilityRole="button"
            onPress={bearbeitenStarten}
            hitSlop={10}
            style={({ pressed }) => ({ padding: 6, opacity: pressed ? 0.6 : 1 })}
          >
            <Txt v="sm" style={{ fontFamily: t.fonts.semibold }}>
              Bearbeiten
            </Txt>
          </Pressable>
        )}
      </Row>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + 32,
          gap: 18,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Col gap={8}>
          <Txt v="sm" soft>
            {feld.hinweis}
          </Txt>
          {/* Der Platzhalter ist die eigentliche Verwendung dieses Textes —
              ohne ihn wüsste niemand, wie der Block in eine Nachricht kommt. */}
          <Txt v="xs" soft style={{ fontFamily: t.fonts.semibold }}>
            {feld.shortcode}
          </Txt>
          <Segmented
            options={SPRACHEN.map((s) => SPRACH_LABEL[s])}
            value={sprachIndex}
            onChange={(i) => {
              if (geaendert) {
                setHinweis("Erst speichern oder abbrechen — sonst geht der Text verloren.");
                return;
              }
              setSprachIndex(i);
              setBearbeiten(false);
              setAusgeklappt(false);
              setHinweis(null);
            }}
          />
        </Col>

        {bearbeiten ? (
          <TextInput
            value={entwurf}
            onChangeText={setEntwurf}
            multiline
            textAlignVertical="top"
            autoFocus
            placeholder={feld.platzhalter}
            placeholderTextColor={t.palette.faint}
            style={{
              minHeight: 260,
              padding: 16,
              borderRadius: t.radius.card,
              borderWidth: 1,
              borderColor: t.palette.line,
              backgroundColor: t.palette.surface,
              fontFamily: t.fonts.regular,
              fontSize: 15,
              lineHeight: 22,
              color: t.palette.ink,
            }}
          />
        ) : gespeichert ? (
          <Col gap={10}>
            <Txt v="body" numberOfLines={ausgeklappt ? undefined : KURZ_ZEILEN}>
              {gespeichert}
            </Txt>
            <Row gap={18}>
              {!ausgeklappt && (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setAusgeklappt(true)}
                  style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                >
                  <Txt v="sm" style={{ fontFamily: t.fonts.semibold, textDecorationLine: "underline" }}>
                    Mehr anzeigen
                  </Txt>
                </Pressable>
              )}
              <Pressable
                accessibilityRole="button"
                onPress={kopieren}
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              >
                <Row gap={6} style={{ alignItems: "center" }}>
                  <Icon n="doc" s={15} sw={1.8} c={t.palette.ink} />
                  <Txt v="sm" style={{ fontFamily: t.fonts.semibold }}>
                    Kopieren
                  </Txt>
                </Row>
              </Pressable>
            </Row>
          </Col>
        ) : (
          <Txt v="body" soft>
            In {SPRACH_LABEL[sprache]} ist für diesen Block noch kein Text
            hinterlegt.
          </Txt>
        )}

        {hinweis && (
          <Txt v="sm" soft>
            {hinweis}
          </Txt>
        )}
      </ScrollView>

      {bearbeiten && (
        <Row
          gap={12}
          style={{
            paddingHorizontal: 24,
            paddingTop: 12,
            paddingBottom: insets.bottom + 12,
            borderTopWidth: 1,
            borderTopColor: t.palette.line,
            backgroundColor: t.palette.surface,
          }}
        >
          <Btn
            variant="outline"
            style={{ flex: 1 }}
            onPress={() => {
              setBearbeiten(false);
              setEntwurf(gespeichert);
              setHinweis(null);
            }}
          >
            Abbrechen
          </Btn>
          <Btn variant="primary" style={{ flex: 1 }} onPress={speichern}>
            {busy ? "Speichert …" : "Speichern"}
          </Btn>
        </Row>
      )}
    </KeyboardAvoidingView>
  );
}

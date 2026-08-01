// Gastgeber · Objektbeschreibung lesen und bearbeiten. Aufbau nach der
// Referenz-App: Lesemodus mit „Mehr anzeigen" und „Kopieren", Bearbeitungsmodus
// mit Abbrechen/Speichern und einer Rückfrage bei ungespeicherten Änderungen.
//
// Wir haben ZWEI Texte, nicht beliebig viele kanalspezifische: `description`
// (gilt überall) und `platform_description` (nur der eigene Marktplatz). Genau
// diese beiden stehen im Umschalter — es wird kein Text je OTA vorgetäuscht,
// den das Datenmodell nicht führt.
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
import { can } from "@/lib/permissions";
import { getProperty, updateProperty, type Property } from "@/lib/properties";
import { useTheme } from "@/theme/ThemeProvider";

// Ab dieser Länge wird im Lesemodus gekürzt und „Mehr anzeigen" eingeblendet.
const KURZ_ZEILEN = 12;

type Feld = "description" | "platform_description";
const FELDER: { key: Feld; label: string; hinweis: string }[] = [
  {
    key: "description",
    label: "Allgemein",
    hinweis: "Gilt überall, wo kein eigener Text hinterlegt ist.",
  },
  {
    key: "platform_description",
    label: "Marktplatz",
    hinweis: "Nur für myBestDays. Leer heißt: der allgemeine Text gilt.",
  },
];

export default function PropertyDescription({
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
  const darfBearbeiten = can(me, "manage_properties");

  const [p, setP] = useState<Property | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feldIndex, setFeldIndex] = useState(0);
  const [bearbeiten, setBearbeiten] = useState(false);
  const [entwurf, setEntwurf] = useState("");
  const [ausgeklappt, setAusgeklappt] = useState(false);
  const [busy, setBusy] = useState(false);
  const [hinweis, setHinweis] = useState<string | null>(null);

  const feld = FELDER[feldIndex];
  const gespeichert = (p?.[feld.key] ?? "") || "";
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
    // `speichern` ist unten definiert und stabil genug für diesen Effekt;
    // bewusst nur an `geaendert` gehängt, damit der Listener nicht bei jedem
    // Tastendruck neu registriert wird.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigation, geaendert]);

  const speichern = async (): Promise<boolean> => {
    if (busy || !p) return false;
    setBusy(true);
    setHinweis(null);
    // PATCH mit GENAU einem Feld — der Endpoint ist ein Teil-Update; das ganze
    // Objekt zurückzuschreiben würde fremde Änderungen überbügeln (Wurzel 1).
    const res = await updateProperty(id, { [feld.key]: entwurf.trim() || null } as any);
    setBusy(false);
    if (!res.ok) {
      setHinweis(res.error);
      return false;
    }
    setP(res.data);
    setBearbeiten(false);
    return true;
  };

  const kopieren = () => {
    // Clipboard aus dem RN-Kern ist als veraltet markiert (Warnung nur im
    // Dev-Build). Der Ersatz @react-native-clipboard/clipboard ist ein
    // natives Modul und braucht ein `pod install` — bewusst als eigener
    // Schritt, nicht nebenbei hier.
    Clipboard.setString(gespeichert);
    setHinweis("In die Zwischenablage kopiert.");
  };

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top + 12 }}>
        <EmptyState icon="info" titel="Beschreibung nicht geladen" text={error}>
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
          Beschreibung
        </Txt>
        {/* Ohne manage_properties gibt es den Bearbeiten-Weg gar nicht — die
            Berechtigung kommt aus /auth/me, nicht aus einer lokalen Annahme. */}
        {!bearbeiten && darfBearbeiten && (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              setEntwurf(gespeichert);
              setBearbeiten(true);
              setHinweis(null);
            }}
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
          <Txt v="title" numberOfLines={1}>
            {p.title}
          </Txt>
          <Segmented
            options={FELDER.map((f) => f.label)}
            value={feldIndex}
            onChange={(i) => {
              if (geaendert) {
                setHinweis("Erst speichern oder abbrechen — sonst geht der Text verloren.");
                return;
              }
              setFeldIndex(i);
              setBearbeiten(false);
              setAusgeklappt(false);
              setHinweis(null);
            }}
          />
          <Txt v="xs" soft>
            {feld.hinweis}
          </Txt>
        </Col>

        {bearbeiten ? (
          <TextInput
            value={entwurf}
            onChangeText={setEntwurf}
            multiline
            textAlignVertical="top"
            autoFocus
            placeholder="Beschreibung eingeben"
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
            Für diesen Bereich ist noch kein Text hinterlegt.
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

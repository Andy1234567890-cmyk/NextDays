// Gastgeber · Zusatzfelder eines Objekts. Aufbau nach der Referenz-App:
// Liste aller Felder mit ihrem aktuellen Wert, Tippen öffnet die Bearbeitung,
// Abbrechen/Speichern unten.
//
// Es werden ALLE definierten Felder gezeigt, auch die leeren — sonst sieht der
// Nutzer nur, was schon gepflegt ist, und weiß nicht, was er pflegen könnte.
// Ein leerer Wert steht als „—", nie als „0" oder „nein" (Wurzel 4).
//
// Bearbeiten verlangt manage_properties; die Berechtigung kommt aus /auth/me,
// nicht aus einer lokalen Annahme. Der Server prüft sie ohnehin erneut.
import { useCallback, useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Switch,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/Icon";
import { Btn, Card, Col, Divider, Row, Spinner, Txt } from "@/components/ui/kit";
import { EmptyState } from "@/components/ui/patterns";
import { useAuth } from "@/contexts/AuthContext";
import { can } from "@/lib/permissions";
import {
  listZusatzfelder,
  setZusatzfeldWert,
  type ZusatzfeldMitWert,
} from "@/lib/zusatzfelder";
import { useTheme } from "@/theme/ThemeProvider";

export default function PropertyCustomFields({
  route,
  navigation,
}: {
  route: any;
  navigation: any;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { me } = useAuth();
  const propertyId: string = route.params.id;
  const darfBearbeiten = can(me, "manage_properties");

  const [felder, setFelder] = useState<ZusatzfeldMitWert[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Das Feld, das gerade bearbeitet wird (id), plus sein Entwurf.
  const [offen, setOffen] = useState<string | null>(null);
  const [entwurf, setEntwurf] = useState("");
  const [busy, setBusy] = useState(false);
  const [hinweis, setHinweis] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await listZusatzfelder(propertyId);
    if (res.ok) {
      setFelder(res.data);
      setError(null);
    } else {
      setFelder(null);
      setError(res.error);
    }
  }, [propertyId]);

  useEffect(() => {
    load();
  }, [load]);

  const speichern = async (eintrag: ZusatzfeldMitWert) => {
    if (busy) return;
    setBusy(true);
    setHinweis(null);
    const wert = entwurf.trim();
    const res = await setZusatzfeldWert(propertyId, eintrag.field.id, wert || null);
    setBusy(false);
    if (!res.ok) {
      setHinweis(res.error);
      return;
    }
    // Nur die eine Zeile ersetzen — kein Neuladen der ganzen Liste, das würde
    // den Scroll zurücksetzen.
    setFelder((alt) =>
      (alt ?? []).map((e) => (e.field.id === eintrag.field.id ? res.data : e)),
    );
    setOffen(null);
  };

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top + 12 }}>
        <Kopf onBack={() => navigation.goBack()} />
        <EmptyState icon="info" titel="Zusatzfelder nicht geladen" text={error}>
          <Btn variant="outline" onPress={load} style={{ marginTop: 6 }}>
            Erneut versuchen
          </Btn>
        </EmptyState>
      </View>
    );
  }

  if (!felder) {
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
      <Kopf onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + 32,
          gap: 16,
        }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {felder.length === 0 ? (
          <EmptyState
            icon="doc"
            titel="Keine Zusatzfelder"
            text="Dein Betrieb hat noch keine eigenen Felder angelegt. Sie gelten dann für alle Objekte."
          />
        ) : (
          <Card>
            {felder.map((e, i) => (
              <View key={e.field.id}>
                {i > 0 && <Divider />}
                {offen === e.field.id ? (
                  <Bearbeiten
                    eintrag={e}
                    entwurf={entwurf}
                    setEntwurf={setEntwurf}
                    busy={busy}
                    onAbbrechen={() => {
                      setOffen(null);
                      setHinweis(null);
                    }}
                    onSpeichern={() => speichern(e)}
                  />
                ) : (
                  <Zeile
                    eintrag={e}
                    antippbar={darfBearbeiten}
                    onPress={() => {
                      setOffen(e.field.id);
                      setEntwurf(e.value ?? "");
                      setHinweis(null);
                    }}
                  />
                )}
              </View>
            ))}
          </Card>
        )}

        {hinweis && (
          <Txt v="sm" soft>
            {hinweis}
          </Txt>
        )}

        {!darfBearbeiten && felder.length > 0 && (
          <Txt v="xs" soft>
            Zum Ändern fehlt deiner Rolle die Berechtigung für Objekte.
          </Txt>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Kopf({ onBack }: { onBack: () => void }) {
  const t = useTheme();
  return (
    <Row style={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Zurück"
        onPress={onBack}
        hitSlop={10}
        style={({ pressed }) => ({ padding: 6, opacity: pressed ? 0.6 : 1 })}
      >
        <Icon n="back" s={20} sw={2} c={t.palette.ink} />
      </Pressable>
      <Txt v="h2" style={{ flex: 1 }}>
        Zusatzfelder
      </Txt>
    </Row>
  );
}

// Anzeige-Zeile: Feldname fett, Wert darunter, Chevron als Hinweis aufs Tippen.
function Zeile({
  eintrag,
  antippbar,
  onPress,
}: {
  eintrag: ZusatzfeldMitWert;
  antippbar: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  const wert = eintrag.value?.trim();
  const anzeige =
    eintrag.field.field_type === "checkbox" && wert ? (wert === "ja" ? "Ja" : "Nein") : wert;

  return (
    <Pressable
      accessibilityRole={antippbar ? "button" : undefined}
      onPress={antippbar ? onPress : undefined}
      disabled={!antippbar}
      style={({ pressed }) => ({
        paddingVertical: 14,
        paddingHorizontal: 16,
        opacity: pressed && antippbar ? 0.7 : 1,
      })}
    >
      <Row gap={12} style={{ alignItems: "center" }}>
        <Col gap={3} style={{ flex: 1 }}>
          <Row gap={7} style={{ alignItems: "center" }}>
            <Txt v="title" numberOfLines={1}>
              {eintrag.field.label}
            </Txt>
            {/* „Öffentlich" ist ein Hinweis, keine Schaltfläche: geändert wird
                das im Web-Dashboard. */}
            {eintrag.field.is_public && (
              <View
                style={{
                  paddingHorizontal: 7,
                  paddingVertical: 2,
                  borderRadius: t.radius.pill,
                  backgroundColor: t.palette.surface2,
                }}
              >
                <Txt v="xs" soft>
                  öffentlich
                </Txt>
              </View>
            )}
          </Row>
          {/* Ohne Wert ein Strich — kein „0", kein „nein". */}
          <Txt v="sm" soft numberOfLines={2}>
            {anzeige || "—"}
          </Txt>
        </Col>
        {antippbar && <Icon n="fwd" s={15} sw={2} c={t.palette.faint} />}
      </Row>
    </Pressable>
  );
}

// Bearbeitungsmaske. Die Eingabeart folgt dem Feldtyp aus der Definition.
function Bearbeiten({
  eintrag,
  entwurf,
  setEntwurf,
  busy,
  onAbbrechen,
  onSpeichern,
}: {
  eintrag: ZusatzfeldMitWert;
  entwurf: string;
  setEntwurf: (v: string) => void;
  busy: boolean;
  onAbbrechen: () => void;
  onSpeichern: () => void;
}) {
  const t = useTheme();
  const feld = eintrag.field;
  const eingabeStil = {
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: t.radius.btn,
    borderWidth: 1,
    borderColor: t.palette.line,
    backgroundColor: t.palette.bg,
    fontFamily: t.fonts.regular,
    fontSize: 15,
    color: t.palette.ink,
  } as const;

  return (
    <Col gap={12} style={{ paddingVertical: 16, paddingHorizontal: 16 }}>
      <Txt v="title">{feld.label}</Txt>

      {feld.field_type === "checkbox" ? (
        <Row gap={12} style={{ alignItems: "center" }}>
          <Switch
            value={entwurf === "ja"}
            onValueChange={(an) => setEntwurf(an ? "ja" : "nein")}
            trackColor={{ true: t.palette.accent, false: t.palette.surface2 }}
          />
          <Txt v="sm">{entwurf === "ja" ? "Ja" : "Nein"}</Txt>
        </Row>
      ) : feld.field_type === "select" ? (
        <Col gap={8}>
          {feld.options.map((o) => {
            const gewaehlt = entwurf === o;
            return (
              <Pressable
                key={o}
                accessibilityRole="radio"
                accessibilityState={{ selected: gewaehlt }}
                // Nochmaliges Tippen wählt ab — sonst ließe sich ein einmal
                // gesetztes Auswahlfeld nie wieder leeren.
                onPress={() => setEntwurf(gewaehlt ? "" : o)}
                style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
              >
                <Row
                  gap={10}
                  style={{
                    alignItems: "center",
                    paddingVertical: 11,
                    paddingHorizontal: 14,
                    borderRadius: t.radius.btn,
                    borderWidth: 1,
                    borderColor: gewaehlt ? t.palette.ink : t.palette.line,
                  }}
                >
                  <Icon
                    n={gewaehlt ? "check" : "dot"}
                    s={16}
                    sw={2}
                    c={gewaehlt ? t.palette.ink : t.palette.faint}
                  />
                  <Txt v="sm" style={{ flex: 1 }}>
                    {o}
                  </Txt>
                </Row>
              </Pressable>
            );
          })}
        </Col>
      ) : (
        <TextInput
          value={entwurf}
          onChangeText={setEntwurf}
          autoFocus
          multiline={feld.field_type === "textarea"}
          textAlignVertical={feld.field_type === "textarea" ? "top" : "center"}
          keyboardType={feld.field_type === "number" ? "decimal-pad" : "default"}
          placeholder={feld.field_type === "number" ? "Zahl eingeben" : "Wert eingeben"}
          placeholderTextColor={t.palette.faint}
          style={[eingabeStil, feld.field_type === "textarea" ? { minHeight: 120 } : null]}
        />
      )}

      <Row gap={10}>
        <Btn variant="outline" style={{ flex: 1 }} onPress={onAbbrechen}>
          Abbrechen
        </Btn>
        <Btn variant="primary" style={{ flex: 1 }} onPress={onSpeichern}>
          {busy ? "Speichert …" : "Speichern"}
        </Btn>
      </Row>
    </Col>
  );
}

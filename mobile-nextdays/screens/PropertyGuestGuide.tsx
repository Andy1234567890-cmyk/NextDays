// Gastgeber · Gästemappe eines Objekts — Übersicht der acht Blöcke.
//
// Dieselben Daten wie im Web (Objekt → „Gästemappe" bzw. „Nachrichten"):
// `properties.type_attributes.messaging`, Feldliste in `lib/gaestemappe.ts`.
// Hier steht bewusst NUR die Liste mit Pflegestand; der Text selbst wird im
// eigenen Screen gelesen und bearbeitet (`PropertyGuestGuideText`) — acht
// mehrsprachige Freitexte auf einer Telefonseite wären eine Textwand, in der
// niemand den einen Block findet, den er sucht.
import { useCallback, useEffect, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/Icon";
import { Btn, Col, Divider, Row, Spinner, Txt } from "@/components/ui/kit";
import { EmptyState } from "@/components/ui/patterns";
import { useAuth } from "@/contexts/AuthContext";
import {
  MAPPEN_FELDER,
  SPRACH_LABEL,
  anzahlGepflegt,
  gepflegteSprachen,
  leseGaestemappe,
  type Gaestemappe,
} from "@/lib/gaestemappe";
import { can } from "@/lib/permissions";
import { getProperty, type Property } from "@/lib/properties";
import { useTheme } from "@/theme/ThemeProvider";

export default function PropertyGuestGuide({
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
  const [mappe, setMappe] = useState<Gaestemappe | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await getProperty(id);
    if (res.ok) {
      setP(res.data);
      setMappe(leseGaestemappe(res.data.type_attributes));
      setError(null);
    } else {
      setP(null);
      setMappe(null);
      setError(res.error);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Nach dem Speichern im Text-Screen zurück: neu laden, damit der Pflegestand
  // in dieser Liste stimmt (kein hausgemachter Zwischenspeicher, der driftet).
  useEffect(() => navigation.addListener("focus", load), [navigation, load]);

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top + 12 }}>
        <EmptyState icon="info" titel="Gästemappe nicht geladen" text={error}>
          <Btn variant="outline" onPress={load} style={{ marginTop: 6 }}>
            Erneut versuchen
          </Btn>
        </EmptyState>
      </View>
    );
  }

  if (!p || !mappe) {
    return (
      <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top + 40 }}>
        <Spinner />
      </View>
    );
  }

  const gepflegt = anzahlGepflegt(mappe);

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
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
          Gästemappe
        </Txt>
      </Row>

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + 32,
          gap: 18,
        }}
        showsVerticalScrollIndicator={false}
      >
        <Col gap={8}>
          <Txt v="title" numberOfLines={1}>
            {p.title}
          </Txt>
          <Txt v="sm" soft>
            {gepflegt} von {MAPPEN_FELDER.length} Blöcken gepflegt. Diese Texte
            gehen als Platzhalter in automatische Gästenachrichten — in der
            Sprache des Gastes, sonst Englisch, sonst Deutsch.
          </Txt>
          {!darfBearbeiten && (
            <Txt v="xs" soft>
              Du kannst die Texte lesen, aber nicht ändern.
            </Txt>
          )}
        </Col>

        <Divider />

        <Col gap={0}>
          {MAPPEN_FELDER.map((f, i) => {
            const sprachen = gepflegteSprachen(mappe[f.key]);
            return (
              <Pressable
                key={f.key}
                accessibilityRole="button"
                onPress={() =>
                  navigation.navigate("PropertyGuestGuideText", { id: p.id, feld: f.key })
                }
                style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
              >
                <Row gap={16} style={{ paddingVertical: 16 }}>
                  <Icon n={f.icon} s={22} sw={1.6} c={t.palette.ink} />
                  <Col gap={3} style={{ flex: 1 }}>
                    <Txt v="body">{f.titel}</Txt>
                    {/* Pflegestand statt Textvorschau: welche SPRACHEN fehlen,
                        ist die Information, die hier zählt — der Text selbst
                        steht eine Ebene tiefer. */}
                    <Txt v="xs" soft>
                      {sprachen.length === 0
                        ? "Noch kein Text"
                        : sprachen.map((s) => SPRACH_LABEL[s]).join(" · ")}
                    </Txt>
                  </Col>
                  <Icon n="chevron" s={17} sw={1.8} c={t.palette.faint} />
                </Row>
                {i < MAPPEN_FELDER.length - 1 && (
                  <View style={{ height: 1, backgroundColor: t.palette.line }} />
                )}
              </Pressable>
            );
          })}
        </Col>
      </ScrollView>
    </View>
  );
}

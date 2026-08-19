// Eine aufklappbare Abschnitts-Zeile: Icon, Titel, optionale Kurzangabe rechts,
// Chevron. Zugeklappt eine Zeile, aufgeklappt der Inhalt darunter.
//
// Warum aufklappen statt alles offen: die Web-Detailansicht zeigt zehn
// Abschnitte gleichzeitig — auf einem Telefon ist das eine Scrollstrecke, in der
// man die eine gesuchte Angabe nicht findet. Hostaway löst Detailseiten in der
// App genauso (Amenities, House rules, Cancellation policy je eine Zeile mit
// Chevron), und die Kurzangabe rechts sagt schon zugeklappt das Wichtigste.
import { useState } from "react";
import { LayoutAnimation, Platform, Pressable, UIManager, View } from "react-native";

import { Icon, type IconName } from "@/components/ui/Icon";
import { Card, Col, Divider, Row, Txt } from "@/components/ui/kit";
import { useTheme } from "@/theme/ThemeProvider";

// Android braucht die Freigabe für LayoutAnimation ausdrücklich, sonst springt
// das Aufklappen ohne Übergang.
if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export function Aufklapper({
  icon,
  titel,
  // Steht zugeklappt rechts neben dem Titel — die Zahl, die man meistens sucht
  // („1.240 kr", „3 Positionen"). null = nichts anzeigen, kein Platzhalter.
  kurz,
  // Offen starten für den Abschnitt, der beim Öffnen wirklich gebraucht wird
  // (Preis & Rechnung); der Rest bleibt zu.
  standardOffen = false,
  children,
}: {
  icon: IconName;
  titel: string;
  kurz?: string | null;
  standardOffen?: boolean;
  children: React.ReactNode;
}) {
  const t = useTheme();
  const [offen, setOffen] = useState(standardOffen);

  return (
    <Card>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: offen }}
        accessibilityLabel={titel}
        onPress={() => {
          LayoutAnimation.configureNext(
            LayoutAnimation.create(160, "easeInEaseOut", "opacity"),
          );
          setOffen((v) => !v);
        }}
        style={({ pressed }) => ({
          paddingVertical: 14,
          paddingHorizontal: 16,
          opacity: pressed ? 0.7 : 1,
        })}
      >
        <Row gap={10} style={{ alignItems: "center" }}>
          <Icon n={icon} s={17} sw={1.8} c={t.palette.soft} />
          <Txt v="title" numberOfLines={1} style={{ flex: 1 }}>
            {titel}
          </Txt>
          {kurz ? (
            <Txt v="sm" soft numberOfLines={1}>
              {kurz}
            </Txt>
          ) : null}
          {/* Der Pfeil dreht sich, statt das Symbol zu tauschen: gleiche Fläche,
              gleiche Position, nur die Richtung sagt den Zustand. */}
          <View style={{ transform: [{ rotate: offen ? "180deg" : "0deg" }] }}>
            <Icon n="caretdown" s={13} sw={2.2} c={t.palette.soft} />
          </View>
        </Row>
      </Pressable>

      {offen && (
        <>
          <Divider />
          <Col style={{ padding: 16, gap: 10 }}>{children}</Col>
        </>
      )}
    </Card>
  );
}

/** Eine Label-Wert-Zeile. Fehlt der Wert, entfällt die Zeile ganz — ein „—"
 *  für jedes nicht gelieferte Feld füllt den Abschnitt mit Strichen. */
export function Angabe({
  label,
  wert,
}: {
  label: string;
  wert: string | null | undefined;
}) {
  if (!wert) return null;
  return (
    <Row gap={12} style={{ alignItems: "flex-start" }}>
      <Txt v="sm" soft style={{ flexShrink: 0 }}>
        {label}
      </Txt>
      <Txt v="sm" numberOfLines={2} style={{ flex: 1, textAlign: "right" }}>
        {wert}
      </Txt>
    </Row>
  );
}

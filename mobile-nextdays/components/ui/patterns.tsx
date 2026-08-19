// Wiederkehrende Layout-Muster der App — Struktur nach dem Airbnb-App-Vorbild
// (Such-Pill, Kategorie-Tabs, Sektion mit Pfeil-Button, Bottom-Sheet,
// Listenzeile, Bild-Kachel), Farben/Typo aus den Design-Tokens.
//
// Diese Datei enthält NUR Darstellung: keine Datenbeschaffung, keine Preis-
// oder Währungslogik. Beträge kommen fertig formatiert von außen.
import { useEffect, useRef } from "react";
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, type IconName } from "@/components/ui/Icon";
import { Col, Row, Txt } from "@/components/ui/kit";
import { useTheme } from "@/theme/ThemeProvider";

// --- Such-Pill --------------------------------------------------------------

// Die zusammengeklappte Suchleiste am Kopf der Startseite: eine schwebende
// Pille, die das Such-Sheet öffnet. `label` zeigt die aktive Suche an, solange
// eine gesetzt ist — sonst den Aufforderungstext.
export function SearchPill({
  label,
  detail,
  onPress,
  onFilter,
}: {
  label: string;
  detail?: string | null;
  onPress: () => void;
  onFilter?: () => void;
}) {
  const t = useTheme();
  return (
    <Row gap={10} style={{ paddingHorizontal: 16 }}>
      <Pressable
        accessibilityRole="search"
        accessibilityLabel={detail ? `${label}, ${detail}` : label}
        onPress={onPress}
        style={({ pressed }) => [
          {
            flex: 1,
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            height: 54,
            paddingHorizontal: 20,
            borderRadius: t.radius.pill,
            backgroundColor: t.palette.surface,
            borderWidth: 1,
            borderColor: t.palette.line,
            opacity: pressed ? 0.9 : 1,
          },
          t.shadow.sm,
        ]}
      >
        <Icon n="search" s={19} sw={2.2} c={t.palette.ink} />
        <Col style={{ flexShrink: 1 }}>
          <Txt v="title" numberOfLines={1}>
            {label}
          </Txt>
          {detail ? (
            <Txt v="xs" soft numberOfLines={1}>
              {detail}
            </Txt>
          ) : null}
        </Col>
      </Pressable>
      {onFilter && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Filter"
          onPress={onFilter}
          style={({ pressed }) => [
            {
              width: 54,
              height: 54,
              borderRadius: 27,
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: t.palette.surface,
              borderWidth: 1,
              borderColor: t.palette.line,
              opacity: pressed ? 0.9 : 1,
            },
            t.shadow.sm,
          ]}
        >
          <Icon n="sliders" s={20} sw={1.9} c={t.palette.ink} />
        </Pressable>
      )}
    </Row>
  );
}

// --- Kategorie-Tabs ---------------------------------------------------------

export type CategoryTab = { key: string; label: string; icon: IconName; badge?: string };

// Die Reiter unter der Suchleiste (Unterkünfte · Erlebnisse · Services):
// Icon über Label, aktiver Reiter mit Unterstrich.
export function CategoryTabs({
  tabs,
  value,
  onChange,
  style,
}: {
  tabs: CategoryTab[];
  value: string;
  onChange: (key: string) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  return (
    <Row gap={0} style={[{ justifyContent: "center" }, style]}>
      {tabs.map((tab) => {
        const on = tab.key === value;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            onPress={() => onChange(tab.key)}
            style={{ alignItems: "center", paddingHorizontal: 18, paddingTop: 6 }}
          >
            <View>
              <Icon n={tab.icon} s={26} sw={1.6} c={on ? t.palette.ink : t.palette.faint} />
              {tab.badge ? (
                <View
                  style={{
                    position: "absolute",
                    top: -8,
                    left: 18,
                    paddingHorizontal: 6,
                    paddingVertical: 2,
                    borderRadius: t.radius.pill,
                    backgroundColor: t.palette.accent,
                  }}
                >
                  <Txt v="xs" color={t.palette.accentInk} style={{ fontSize: 9, lineHeight: 12 }}>
                    {tab.badge}
                  </Txt>
                </View>
              ) : null}
            </View>
            <Txt
              v="xs"
              soft={!on}
              numberOfLines={1}
              style={{ marginTop: 6, fontFamily: on ? t.fonts.semibold : t.fonts.regular }}
            >
              {tab.label}
            </Txt>
            <View
              style={{
                marginTop: 6,
                height: 2,
                width: "100%",
                borderRadius: 2,
                backgroundColor: on ? t.palette.ink : "transparent",
              }}
            />
          </Pressable>
        );
      })}
    </Row>
  );
}

// --- Sektion mit Pfeil-Button ----------------------------------------------

export function SectionHeader({
  title,
  subtitle,
  onPress,
  style,
}: {
  title: string;
  subtitle?: string | null;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  return (
    <Row style={[{ justifyContent: "space-between", alignItems: "flex-start", gap: 12 }, style]}>
      <Col gap={4} style={{ flex: 1 }}>
        <Txt v="h2">{title}</Txt>
        {subtitle ? (
          <Txt v="sm" soft>
            {subtitle}
          </Txt>
        ) : null}
      </Col>
      {onPress && (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${title} — alle anzeigen`}
          onPress={onPress}
          style={({ pressed }) => ({
            width: 34,
            height: 34,
            borderRadius: 17,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: t.palette.surface2,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Icon n="chevron" s={17} sw={2.2} c={t.palette.ink} />
        </Pressable>
      )}
    </Row>
  );
}

// --- Horizontales Karussell -------------------------------------------------

// Karussell mit angeschnittener Folgekachel (wie in der Referenz): der
// Content läuft randlos aus, das Padding sitzt im Container.
export function Carousel({
  children,
  gap = 12,
  pad = 16,
}: {
  children: React.ReactNode;
  gap?: number;
  pad?: number;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      contentContainerStyle={{ gap, paddingHorizontal: pad }}
    >
      {children}
    </ScrollView>
  );
}

// --- Listenzeile (Profil/Einstellungen) -------------------------------------

export function ListRow({
  icon,
  label,
  hint,
  onPress,
  danger,
  last,
}: {
  icon?: IconName;
  label: string;
  hint?: string | null;
  onPress?: () => void;
  danger?: boolean;
  // Letzte Zeile einer Gruppe: ohne Trennlinie.
  last?: boolean;
}) {
  const t = useTheme();
  const farbe = danger ? t.palette.accent : t.palette.ink;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({ opacity: pressed && onPress ? 0.6 : 1 })}
    >
      <Row gap={16} style={{ paddingVertical: 18 }}>
        {icon && <Icon n={icon} s={22} sw={1.6} c={farbe} />}
        <Col gap={2} style={{ flex: 1 }}>
          <Txt v="body" color={farbe}>
            {label}
          </Txt>
          {hint ? (
            <Txt v="xs" soft>
              {hint}
            </Txt>
          ) : null}
        </Col>
        {onPress && <Icon n="chevron" s={17} sw={1.8} c={t.palette.faint} />}
      </Row>
      {!last && <View style={{ height: 1, backgroundColor: t.palette.line }} />}
    </Pressable>
  );
}

// --- Bottom-Sheet -----------------------------------------------------------

// Modales Sheet, das von unten einfährt — Träger für Login, Suche und Filter.
// `full` lässt es fast die ganze Höhe einnehmen (Suchmaske), sonst wächst es
// mit dem Inhalt (Login).
export function Sheet({
  open,
  onClose,
  children,
  full,
  header,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  full?: boolean;
  header?: React.ReactNode;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const y = useRef(new Animated.Value(height)).current;

  useEffect(() => {
    Animated.timing(y, {
      toValue: open ? 0 : height,
      duration: open ? 260 : 200,
      useNativeDriver: true,
    }).start();
  }, [open, height, y]);

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" }}>
        <Pressable accessibilityLabel="Schließen" style={{ flex: 1 }} onPress={onClose} />
        <Animated.View
          style={[
            {
              transform: [{ translateY: y }],
              backgroundColor: t.palette.surface,
              borderTopLeftRadius: t.radius.sheet,
              borderTopRightRadius: t.radius.sheet,
              paddingBottom: insets.bottom + 12,
              maxHeight: height - insets.top - 12,
              ...(full ? { minHeight: height * 0.86 } : {}),
            },
            t.shadow.card,
          ]}
        >
          <Row style={{ justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 18 }}>
            <View style={{ flex: 1 }}>{header}</View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Schließen"
              onPress={onClose}
              hitSlop={10}
              style={{ padding: 4 }}
            >
              <Icon n="x" s={20} sw={2} c={t.palette.ink} />
            </Pressable>
          </Row>
          {/* Der Inhalt SCROLLT. Vorher stand er direkt im Sheet: was über
              `maxHeight` hinausging, war abgeschnitten und mit keiner Geste
              erreichbar — bei einer Liste mit zwanzig Vorlagen also die Hälfte.
              `flexShrink: 1` statt `flex: 1`, damit ein kurzer Inhalt das Sheet
              weiterhin nur so hoch macht, wie er ist.
              Das horizontale Padding sitzt hier und nicht in jedem Aufrufer:
              sonst klebt der Text am Rand, während die Kopfzeile eingerückt
              ist — genau so sah es aus. */}
          <ScrollView
            style={{ flexShrink: 1 }}
            contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 10 }}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

// --- Leerzustand ------------------------------------------------------------

export function EmptyState({
  icon,
  titel,
  text,
  children,
}: {
  icon: IconName;
  titel: string;
  text?: string;
  children?: React.ReactNode;
}) {
  const t = useTheme();
  return (
    <Col gap={10} style={{ alignItems: "center", paddingHorizontal: 32, paddingVertical: 48 }}>
      <Icon n={icon} s={34} sw={1.5} c={t.palette.faint} />
      <Txt v="h2" style={{ textAlign: "center" }}>
        {titel}
      </Txt>
      {text ? (
        <Txt v="sm" soft style={{ textAlign: "center" }}>
          {text}
        </Txt>
      ) : null}
      {children}
    </Col>
  );
}

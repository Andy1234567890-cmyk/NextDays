// Blatt — das Bottom-Sheet dieser App (Vorlage: „Financial settings" der
// Hostaway Owner App: ✕ links, Titel mittig, ✓ rechts im Akzentkreis).
//
// Ein Modal statt einer Navigations-Route: das Blatt ändert Einstellungen
// des Screens darunter und gehört zu ihm; als Route hätte es eigenen Zustand
// und einen Zurück-Stack, den niemand braucht.
import { Modal, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/Icon";
import { Txt } from "@/components/ui/kit";
import { useT } from "@/contexts/SprachContext";
import { useTheme } from "@/theme/ThemeProvider";

export function Blatt({
  offen,
  titel,
  schliessen,
  bestaetigen,
  zurueck,
  children,
  fuss,
}: {
  offen: boolean;
  titel: string;
  /** ✕ — verwirft. */
  schliessen: () => void;
  /** ✓ — übernimmt. Ohne diesen Callback fehlt der Haken (reine Auswahl-Seiten). */
  bestaetigen?: () => void;
  /** ‹ statt ✕ — eine Unterseite im Blatt. */
  zurueck?: () => void;
  children: React.ReactNode;
  /** Fest unten, außerhalb des Scrollbereichs (z. B. „Alles zurücksetzen"). */
  fuss?: React.ReactNode;
}) {
  const txt = useT();
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={offen} animationType="slide" transparent onRequestClose={schliessen}>
      {/* Abdunkelung: Tipp außerhalb schließt wie ✕. */}
      <Pressable
        onPress={schliessen}
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.35)" }}
        accessibilityLabel={txt("blatt.schliessen")}
      />
      <View
        style={{
          backgroundColor: t.palette.surface,
          borderTopLeftRadius: t.radius.sheet,
          borderTopRightRadius: t.radius.sheet,
          maxHeight: "88%",
          paddingBottom: insets.bottom + 12,
          ...t.shadow.card,
        }}
      >
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            paddingHorizontal: 16,
            paddingTop: 14,
            paddingBottom: 10,
          }}
        >
          <Pressable
            onPress={zurueck ?? schliessen}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={txt(zurueck ? "allg.zurueck" : "allg.schliessen")}
            style={{
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: t.palette.surface2,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon n={zurueck ? "back" : "x"} s={18} sw={2} c={t.palette.ink} />
          </Pressable>
          <Txt v="title" style={{ flex: 1, textAlign: "center", fontSize: 17 }}>
            {titel}
          </Txt>
          {bestaetigen ? (
            <Pressable
              onPress={bestaetigen}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={txt("blatt.uebernehmen")}
              style={{
                width: 36,
                height: 36,
                borderRadius: 18,
                backgroundColor: t.palette.accent,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon n="check" s={18} sw={2.4} c={t.palette.accentInk} />
            </Pressable>
          ) : (
            <View style={{ width: 36 }} />
          )}
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 12 }}>{children}</ScrollView>
        {fuss ? <View style={{ paddingHorizontal: 16, paddingTop: 8 }}>{fuss}</View> : null}
      </View>
    </Modal>
  );
}

/** Eine Einstellungszeile „Label ……… Wert ›" (Vorlage: Report settings). */
export function BlattZeile({
  label,
  wert,
  auf,
  erste,
}: {
  label: string;
  wert: string;
  auf: () => void;
  erste?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={auf}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${wert}`}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 14,
        paddingHorizontal: 14,
        borderTopWidth: erste ? 0 : 1,
        borderTopColor: t.palette.line,
      }}
    >
      <Txt v="sm" style={{ flex: 1 }}>
        {label}
      </Txt>
      <Txt v="sm" soft numberOfLines={1} style={{ maxWidth: "55%" }}>
        {wert}
      </Txt>
      <Icon n="fwd" s={14} c={t.palette.faint} />
    </Pressable>
  );
}

/** Eine Auswahlzeile mit Haken (Vorlage: „Select comparison period"). */
export function BlattOption({
  label,
  hinweis,
  aktiv,
  auf,
  erste,
}: {
  label: string;
  hinweis?: string;
  aktiv: boolean;
  auf: () => void;
  erste?: boolean;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={auf}
      accessibilityRole="radio"
      accessibilityState={{ selected: aktiv }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 14,
        paddingHorizontal: 14,
        borderTopWidth: erste ? 0 : 1,
        borderTopColor: t.palette.line,
      }}
    >
      <View style={{ flex: 1 }}>
        <Txt v="sm">{label}</Txt>
        {hinweis ? (
          <Txt v="xs" faint style={{ marginTop: 2 }}>
            {hinweis}
          </Txt>
        ) : null}
      </View>
      {aktiv ? <Icon n="check" s={18} sw={2.2} c={t.palette.accent} /> : null}
    </Pressable>
  );
}

/** Gruppen-Überschrift im Blatt („Berichtseinstellungen"). */
export function BlattGruppe({ titel, children }: { titel: string; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <View style={{ marginTop: 8 }}>
      <Txt v="sm" soft style={{ marginBottom: 6, marginLeft: 2 }}>
        {titel}
      </Txt>
      <View style={{ backgroundColor: t.palette.surface2, borderRadius: 12, overflow: "hidden" }}>{children}</View>
    </View>
  );
}

// Eingabefeld — EINE Stelle für alle Formulare dieser App.
//
// WARUM ZENTRAL: im Vorbild (mobile-nextdays/screens/HostLogin.tsx) standen
// Rahmen und Textstil als zwei getrennte Stilblöcke im Screen, mit dem
// ausdrücklichen Kommentar, dass genau das die Stelle ist, an der sie
// auseinanderlaufen. Hier ist es eine Komponente, also gibt es die Stelle nicht.
//
// Das Passwort-Auge sitzt IM Feld: der Rahmen liegt deshalb auf dem
// umgebenden View, das `TextInput` darin ist rahmenlos.
import { useState } from "react";
import {
  Pressable,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type TextInputProps,
} from "react-native";

import { Icon } from "@/components/ui/Icon";
import { Txt } from "@/components/ui/kit";
import { useT } from "@/contexts/SprachContext";
import { useTheme } from "@/theme/ThemeProvider";

export function Feld({
  label,
  wert,
  aendern,
  geheim,
  hinweis,
  keyboardType,
  autoComplete,
  autoCapitalize,
  maxLength,
  editierbar = true,
}: {
  label: string;
  wert: string;
  aendern: (v: string) => void;
  /** Passwortfeld: startet VERBORGEN, Umschalten ist die Ausnahme. */
  geheim?: boolean;
  hinweis?: string;
  keyboardType?: KeyboardTypeOptions;
  autoComplete?: TextInputProps["autoComplete"];
  autoCapitalize?: TextInputProps["autoCapitalize"];
  maxLength?: number;
  editierbar?: boolean;
}) {
  const txt = useT();
  const t = useTheme();
  const [sichtbar, setSichtbar] = useState(false);
  const verborgen = Boolean(geheim) && !sichtbar;

  return (
    <View>
      <Txt v="xs" soft style={{ marginBottom: 6 }}>
        {label}
      </Txt>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          backgroundColor: editierbar ? t.palette.surface : t.palette.surface2,
          borderWidth: 1,
          borderColor: t.palette.line,
          borderRadius: 12,
          paddingHorizontal: 14,
        }}
      >
        <TextInput
          value={wert}
          onChangeText={aendern}
          secureTextEntry={verborgen}
          keyboardType={keyboardType}
          autoComplete={autoComplete}
          autoCapitalize={autoCapitalize}
          maxLength={maxLength}
          editable={editierbar}
          placeholderTextColor={t.palette.faint}
          style={{
            flex: 1,
            paddingVertical: 13,
            fontSize: 16,
            fontFamily: t.fonts.regular,
            color: t.palette.ink,
          }}
        />
        {geheim ? (
          <Pressable
            onPress={() => setSichtbar((v) => !v)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={sichtbar ? txt("login.passwortVerbergen") : txt("login.passwortAnzeigen")}
          >
            <Icon n={sichtbar ? "eyeoff" : "eye"} s={20} c={t.palette.soft} />
          </Pressable>
        ) : null}
      </View>
      {hinweis ? (
        <Txt v="xs" faint style={{ marginTop: 4 }}>
          {hinweis}
        </Txt>
      ) : null}
    </View>
  );
}

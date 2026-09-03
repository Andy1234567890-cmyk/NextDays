// Kern-UI-Komponenten — portiert aus dem Design-Kit
// (app-kit.jsx). CSS-Klassen → RN-Komponenten mit Theme-Tokens.
//  Txt, Btn, Chip, Card, Flat, Divider, Star, Avatar, Toggle, Photo, Badge,
//  Progress, Segmented, IconBtn.
//
// Für Seitenaufbau (Such-Pille, Kategorie-Reiter, Sektionen, Bottom-Sheet,
// Listenzeilen, Leerzustände) liegen die Muster in `patterns.tsx` — dort sitzt
// die Marktplatz-Struktur, hier nur die einzelnen Bausteine.
//
// DIVERGENZ ZU DEN SCHWESTER-APPS (erlaubt, ADR-0016 „Mut zur Duplikation";
// `kit.tsx` steht bewusst NICHT auf der CI-Konsistenzliste): diese App führt
// zusätzlich `Kachel` — die gerahmte Karte MIT weichem Schatten aus der
// Smoobu-Formensprache (`theme/flaechen.ts`). `Card`/`Flat` bleiben unverändert
// erhalten, damit übernommene Screens weiter passen.
import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from "react-native";

import { Icon, type IconName } from "@/components/ui/Icon";
import { KARTE_PAD, karte, kartenTitel } from "@/theme/flaechen";
import { useTheme } from "@/theme/ThemeProvider";

// --- Text -------------------------------------------------------------------

type TxtVariant = keyof ReturnType<typeof useTheme>["type"];

export function Txt({
  v = "body",
  color,
  soft,
  faint,
  accent,
  style,
  numberOfLines,
  selectable,
  children,
}: {
  v?: TxtVariant;
  color?: string;
  soft?: boolean;
  faint?: boolean;
  accent?: boolean;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
  /**
   * Text zum Markieren/Kopieren freigeben. Gebraucht für Werte, die man
   * WEITERGEBEN muss und nicht abtippen sollte: TOTP-Schlüssel,
   * Wiederherstellungscodes, Portal-Kennungen. Standard bleibt aus — ein
   * markierbarer Fließtext fängt Wischgesten ab.
   */
  selectable?: boolean;
  children: React.ReactNode;
}) {
  const t = useTheme();
  const c =
    color ??
    (accent
      ? t.palette.accent
      : soft
        ? t.palette.soft
        : faint
          ? t.palette.faint
          : t.palette.ink);
  return (
    <Text
      numberOfLines={numberOfLines}
      selectable={selectable}
      style={[t.type[v], { color: c }, style]}
    >
      {children}
    </Text>
  );
}

// --- Surfaces ---------------------------------------------------------------

// Fläche mit feinem Rand statt Schatten — im Airbnb-Muster grenzt eine Karte
// über eine Linie ab, nicht über Tiefe. Schwebende Elemente (Such-Pill, Sheet)
// bringen ihren Schatten selbst mit.
export function Card({ style, children }: { style?: StyleProp<ViewStyle>; children?: React.ReactNode }) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: t.palette.surface,
          borderRadius: t.radius.card,
          borderWidth: 1,
          borderColor: t.palette.line,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Flat({ style, children }: { style?: StyleProp<ViewStyle>; children?: React.ReactNode }) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          backgroundColor: t.palette.surface,
          borderRadius: t.radius.card,
          borderWidth: 1,
          borderColor: t.palette.line,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/**
 * Die Karte dieser App: gerahmt UND mit weichem Schatten, plus Innenabstand.
 * Struktur nach der Vorlage (docs/SMOOBU-UI-ANALYSE.md), Farben aus unserer
 * Palette. Wer den Innenabstand selbst setzt, gibt `pad={0}` mit.
 */
export function Kachel({
  style,
  pad = KARTE_PAD,
  children,
}: {
  style?: StyleProp<ViewStyle>;
  pad?: number;
  children?: React.ReactNode;
}) {
  const t = useTheme();
  return <View style={[karte(t.palette), { padding: pad }, style]}>{children}</View>;
}

/** Kartenkopf — Titel links, optional ein Element rechts (Filter, Zeitwahl). */
export function KachelKopf({
  titel,
  rechts,
}: {
  titel: string;
  rechts?: React.ReactNode;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 12,
      }}
    >
      <Text style={kartenTitel(t.palette, t.fonts.semibold)}>{titel}</Text>
      {rechts}
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return <View style={[{ height: 1, backgroundColor: t.palette.line }, style]} />;
}

// --- Buttons ----------------------------------------------------------------

type BtnVariant = "primary" | "dark" | "ghost" | "outline";

export function Btn({
  children,
  variant = "primary",
  block,
  icon,
  iconR,
  onPress,
  // Gesperrt, solange die Aktion läuft. Ohne das löst ein zweiter Druck
  // denselben Vorgang erneut aus — bei Check-out oder Storno ist das kein
  // Schönheitsfehler, sondern ein doppelter Seiteneffekt (Wurzel 2).
  disabled,
  style,
}: {
  children: React.ReactNode;
  variant?: BtnVariant;
  block?: boolean;
  icon?: IconName;
  iconR?: IconName;
  onPress?: () => void;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  const bg = {
    primary: t.palette.accent,
    dark: t.palette.ink,
    ghost: t.palette.surface2,
    outline: "transparent",
  }[variant];
  const fg = {
    primary: t.palette.accentInk,
    dark: t.palette.bg,
    ghost: t.palette.ink,
    outline: t.palette.ink,
  }[variant];
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [
        {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          // Vollrunde Pille mit kräftiger Höhe (Airbnb-CTA).
          borderRadius: t.radius.pill,
          paddingVertical: 15,
          paddingHorizontal: 22,
          backgroundColor: bg,
          borderWidth: variant === "outline" ? 1 : 0,
          borderColor: t.palette.line,
          opacity: disabled ? 0.45 : pressed ? 0.88 : 1,
        },
        block ? { alignSelf: "stretch" } : undefined,
        style,
      ]}
    >
      {icon && <Icon n={icon} s={18} sw={2} c={fg} />}
      <Text style={{ fontFamily: t.fonts.semibold, fontSize: 16, color: fg, letterSpacing: -0.15 }}>
        {children}
      </Text>
      {iconR && <Icon n={iconR} s={18} sw={2} c={fg} />}
    </Pressable>
  );
}

export function IconBtn({
  icon,
  s = 40,
  bg,
  color,
  flat,
  badge,
  onPress,
  style,
}: {
  icon: IconName;
  s?: number;
  bg?: string;
  color?: string;
  flat?: boolean;
  badge?: number;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        {
          width: s,
          height: s,
          borderRadius: s / 2,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: bg ?? t.palette.surface,
        },
        !flat && !bg ? t.shadow.sm : undefined,
        style,
      ]}
    >
      <Icon n={icon} s={s * 0.5} sw={1.8} c={color ?? t.palette.ink} />
      {typeof badge === "number" && badge > 0 && <Badge style={{ position: "absolute", top: -3, right: -3 }}>{badge}</Badge>}
    </Pressable>
  );
}

// --- Chips & Badges ---------------------------------------------------------

type ChipVariant = "" | "on" | "accent" | "ghost";

export function Chip({
  children,
  variant = "",
  icon,
  style,
  textColor,
}: {
  children?: React.ReactNode;
  variant?: ChipVariant;
  icon?: IconName;
  style?: StyleProp<ViewStyle>;
  textColor?: string;
}) {
  const t = useTheme();
  const bg = {
    "": t.palette.surface,
    on: t.palette.ink,
    accent: t.palette.accent,
    ghost: "transparent",
  }[variant];
  const fg =
    textColor ??
    {
      "": t.palette.ink,
      on: t.palette.bg,
      accent: "#fff",
      ghost: t.palette.soft,
    }[variant];
  return (
    <View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 6,
          paddingVertical: 9,
          paddingHorizontal: 16,
          borderRadius: t.radius.pill,
          backgroundColor: bg,
          // Ruhender Chip grenzt über eine Linie ab, der aktive über die Füllung.
          borderWidth: variant === "on" || variant === "accent" ? 0 : 1,
          borderColor: t.palette.line,
        },
        style,
      ]}
    >
      {icon && <Icon n={icon} s={14} sw={2} c={fg} />}
      {children != null && (
        <Text style={{ fontFamily: t.fonts.semibold, fontSize: 14, color: fg }}>{children}</Text>
      )}
    </View>
  );
}

export function Badge({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          minWidth: 20,
          height: 20,
          paddingHorizontal: 6,
          borderRadius: 999,
          backgroundColor: t.palette.accent,
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      <Text style={{ color: "#fff", fontSize: 11, fontWeight: "700" }}>{children}</Text>
    </View>
  );
}

// --- Star / Avatar / Toggle -------------------------------------------------

export function Star({ s = 13 }: { s?: number }) {
  const t = useTheme();
  return <Icon n="star" s={s} c={t.palette.star} sw={0} />;
}

export function Avatar({
  s = 40,
  src,
  icon = "user",
  initialen,
}: {
  s?: number;
  src?: string;
  icon?: IconName;
  /**
   * Fällt zurück auf INITIALEN, wenn kein Bild hinterlegt ist. Ein anonymes
   * Personen-Symbol sieht aus wie ein Bild, das nicht geladen hat — Initialen
   * sagen dagegen „hier ist kein Bild", ohne einen Fehler vorzutäuschen.
   */
  initialen?: string;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        width: s,
        height: s,
        borderRadius: s / 2,
        backgroundColor: t.palette.surface2,
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
      }}
    >
      {src ? (
        <Image source={{ uri: src }} style={{ width: s, height: s }} />
      ) : initialen ? (
        <Text
          style={{
            fontFamily: t.fonts.semibold,
            fontSize: s * 0.36,
            color: t.palette.soft,
          }}
        >
          {initialen}
        </Text>
      ) : (
        <Icon n={icon} s={s * 0.5} c={t.palette.soft} />
      )}
    </View>
  );
}

export function Toggle({ on }: { on?: boolean }) {
  const t = useTheme();
  return (
    <View
      style={{
        width: 46,
        height: 28,
        borderRadius: 999,
        backgroundColor: on ? t.palette.accent : t.palette.surface2,
        justifyContent: "center",
      }}
    >
      <View
        style={{
          position: "absolute",
          top: 3,
          left: on ? 21 : 3,
          width: 22,
          height: 22,
          borderRadius: 11,
          backgroundColor: "#fff",
          shadowColor: "#000",
          shadowOpacity: 0.2,
          shadowRadius: 3,
          shadowOffset: { width: 0, height: 1 },
          elevation: 2,
        }}
      />
    </View>
  );
}

// --- Photo (mit Gradient-Fallback) ------------------------------------------

const GRADS: Record<string, [string, string]> = {
  grad1: ["#c9b6a0", "#8a7a6a"],
  grad2: ["#9fb4c0", "#5f7585"],
  grad3: ["#d8b9a0", "#b07d63"],
};

export function Photo({
  src,
  grad = "grad1",
  h,
  w,
  r,
  style,
  children,
}: {
  src?: string;
  grad?: keyof typeof GRADS;
  h?: number;
  w?: number | string;
  r?: number;
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}) {
  const fallback = GRADS[grad]?.[0] ?? "#c9b6a0";
  return (
    <View
      style={[
        {
          // Höhe optional: Kacheln setzen stattdessen `aspectRatio` per style.
          ...(h != null ? { height: h } : {}),
          width: (w as number) ?? "100%",
          borderRadius: r,
          backgroundColor: fallback,
          overflow: "hidden",
        },
        style,
      ]}
    >
      {src && (
        <Image source={{ uri: src }} style={{ position: "absolute", width: "100%", height: "100%" }} resizeMode="cover" />
      )}
      {children}
    </View>
  );
}

// --- Progress / Segmented ---------------------------------------------------

export function Progress({ pct }: { pct: number }) {
  const t = useTheme();
  return (
    <View style={{ height: 6, borderRadius: 999, backgroundColor: t.palette.surface2, overflow: "hidden" }}>
      <View style={{ height: "100%", width: `${pct}%`, backgroundColor: t.palette.accent, borderRadius: 999 }} />
    </View>
  );
}

export function Segmented({
  options,
  value,
  onChange,
  style,
}: {
  options: string[];
  value: number;
  onChange?: (i: number) => void;
  style?: StyleProp<ViewStyle>;
}) {
  const t = useTheme();
  return (
    <View
      style={[
        { flexDirection: "row", backgroundColor: t.palette.surface2, borderRadius: 12, padding: 3 },
        style,
      ]}
    >
      {options.map((o, i) => {
        const on = i === value;
        return (
          <Pressable
            key={o}
            onPress={() => onChange?.(i)}
            style={[
              { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 9 },
              on ? [{ backgroundColor: t.palette.surface }, t.shadow.sm] : undefined,
            ]}
          >
            <Text
              style={{
                fontFamily: t.type.sm.fontFamily,
                fontSize: 13,
                color: on ? t.palette.ink : t.palette.soft,
              }}
            >
              {o}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

// --- Layout-Helfer (row/col) ------------------------------------------------

export function Row({ style, children, gap }: { style?: StyleProp<ViewStyle>; children?: React.ReactNode; gap?: number }) {
  return <View style={[{ flexDirection: "row", alignItems: "center", gap: gap ?? 12 }, style]}>{children}</View>;
}
export function Col({ style, children, gap }: { style?: StyleProp<ViewStyle>; children?: React.ReactNode; gap?: number }) {
  return <View style={[{ flexDirection: "column", gap }, style]}>{children}</View>;
}

export function Spinner() {
  const t = useTheme();
  return <ActivityIndicator color={t.palette.accent} />;
}

// Re-Export für bequemen Import in Screens.
export { useState };

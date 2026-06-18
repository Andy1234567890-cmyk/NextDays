// Screen-Wrapper: SafeArea + Hintergrund + optionaler Scroll-Container mit der
// Dichte-abhängigen Polsterung (entspricht .screen/.scroll aus dem Kit).
import { ScrollView, View, type StyleProp, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useTheme } from "@/theme/ThemeProvider";

export function Screen({
  children,
  scroll = true,
  style,
  contentStyle,
  topInset = true,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  topInset?: boolean;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const pad = t.density.pad;

  const base: ViewStyle = {
    flex: 1,
    backgroundColor: t.palette.bg,
    paddingTop: topInset ? insets.top : 0,
  };

  if (!scroll) {
    return <View style={[base, style]}>{children}</View>;
  }

  return (
    <View style={[base, style]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          { padding: pad, gap: t.density.gap, paddingBottom: pad + 24 },
          contentStyle,
        ]}
      >
        {children}
      </ScrollView>
    </View>
  );
}

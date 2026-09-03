// Kopfzeile im Muster der Vorlage: links die Wortmarke, rechts Glocke und
// Avatar (docs/SMOOBU-UI-ANALYSE.md — Hamburger · Lupe · Logo · Avatar).
//
// ABWEICHUNG MIT GRUND: kein Hamburger. Die Vorlage braucht ihn für ein
// Web-Menü mit zwei Dutzend Einträgen; diese App hat fünf Tabs unten, und ein
// zweites Navigationsmenü daneben wäre ein zweiter Weg zum selben Ziel. Die
// Lupe fehlt aus demselben Grund: ein Eigentümer hat im Normalfall ein bis
// fünf Objekte — die Liste ist kürzer als der Weg über ein Suchfeld. Sobald
// jemand mit vielen Objekten das braucht, gehört sie in die Objektliste, nicht
// in jede Kopfzeile.
import { Image, Pressable, View } from "react-native";

import { Avatar, Txt } from "@/components/ui/kit";
import { initialenAus } from "@/lib/initialen";
import { useTheme } from "@/theme/ThemeProvider";

const LOGO_HOEHE = 22;

export function Kopf({
  titel,
  name,
  email,
  aufProfil,
}: {
  /** Steht statt der Wortmarke, wenn dieser Screen einen eigenen Titel führt. */
  titel?: string;
  /** Anzeigename für den Avatar. */
  name?: string | null;
  /** Rückfall für die Initialen, wenn kein Name hinterlegt ist. */
  email?: string | null;
  aufProfil?: () => void;
}) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: t.density.pad,
        paddingTop: 6,
        paddingBottom: 12,
      }}
    >
      {titel ? (
        <Txt v="h1">{titel}</Txt>
      ) : (
        <Image
          // Auf dunklem Grund die Negativ-Fassung — sonst steht dunkle Schrift
          // auf dunkler Fläche. Die Breite kommt aus dem Seitenverhältnis der
          // Datei (theme/marke.ts), nie aus einer geschätzten Zahl.
          source={t.dark ? t.marke.logoHell : t.marke.logo}
          style={{ height: LOGO_HOEHE, width: LOGO_HOEHE * t.marke.logoRatio }}
          resizeMode="contain"
          accessibilityLabel={t.marke.name}
        />
      )}
      {aufProfil ? (
        <Pressable
          onPress={aufProfil}
          accessibilityRole="button"
          accessibilityLabel="Profil und Einstellungen"
          hitSlop={8}
        >
          {/* Ohne Name UND ohne E-Mail bleibt es beim Symbol — kein erfundener
              Platzhalter-Buchstabe (lib/initialen.ts). */}
          <Avatar initialen={initialenAus(name, email)} s={32} />
        </Pressable>
      ) : null}
    </View>
  );
}

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
import { useState } from "react";
import { Image, Pressable, ScrollView, View } from "react-native";

import { Blatt, BlattGruppe, BlattOption } from "@/components/ui/Blatt";
import { Avatar, Txt } from "@/components/ui/kit";
import { useSprache } from "@/contexts/SprachContext";
import { SPRACHEN, SPRACH_FLAGGEN, SPRACH_NAMEN } from "@/lib/sprache";
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
  // Die Sprachwahl steht OBEN in jeder Kopfzeile, nicht im Menü (Ansage
  // 08.09.2026): sie ist eine Einstellung, die man sofort sieht und sofort
  // wechselt — wie im Web-Dashboard, wo die Flagge ebenfalls in der Topbar
  // sitzt. Vorbelegt ist sie mit dem, was die Agentur am Eigentümer hinterlegt
  // hat (`owners.language` → `users.preferred_language`).
  const { sprache, spracheSetzen, t: txt } = useSprache();
  const [sprachBlatt, setSprachBlatt] = useState(false);
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
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        {/* Nur die Flagge: neben Wortmarke und Avatar ist für das Endonym kein
            Platz. In der Auswahl darunter steht beides (die Flagge allein ist
            mehrdeutig — Deutsch ist DE/AT/CH). */}
        <Pressable
          onPress={() => setSprachBlatt(true)}
          accessibilityRole="button"
          accessibilityLabel={`${txt("mehr.sprache")}: ${SPRACH_NAMEN[sprache]}`}
          hitSlop={8}
          style={{
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: t.palette.surface2,
          }}
        >
          <Txt v="sm" style={{ fontSize: 17, lineHeight: 21 }}>
            {SPRACH_FLAGGEN[sprache]}
          </Txt>
        </Pressable>

        {aufProfil ? (
          <Pressable
            onPress={aufProfil}
            accessibilityRole="button"
            accessibilityLabel={txt("mehr.profilEinstellungen")}
            hitSlop={8}
          >
            {/* Ohne Name UND ohne E-Mail bleibt es beim Symbol — kein erfundener
                Platzhalter-Buchstabe (lib/initialen.ts). */}
            <Avatar initialen={initialenAus(name, email)} s={32} />
          </Pressable>
        ) : null}
      </View>

      <Blatt
        offen={sprachBlatt}
        titel={txt("mehr.spracheWaehlen")}
        schliessen={() => setSprachBlatt(false)}
      >
        {/* 24 Sprachen passen nicht auf ein Blatt — die Liste rollt. */}
        <ScrollView style={{ maxHeight: 420 }}>
          <BlattGruppe titel={txt("mehr.sprache")}>
            {SPRACHEN.map((sp, i) => (
              <BlattOption
                key={sp}
                label={`${SPRACH_FLAGGEN[sp]}  ${SPRACH_NAMEN[sp]}`}
                aktiv={sp === sprache}
                auf={() => {
                  spracheSetzen(sp);
                  setSprachBlatt(false);
                }}
                erste={i === 0}
              />
            ))}
          </BlattGruppe>
        </ScrollView>
      </Blatt>
    </View>
  );
}

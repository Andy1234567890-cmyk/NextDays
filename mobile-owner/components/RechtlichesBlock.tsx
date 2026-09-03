// Der Abschnitt „Rechtliches" im Konto: Dokumente zum Nachlesen plus die
// Anbieter-Pflichtangaben.
//
// Er ist keine Zierde, sondern Voraussetzung für die Veröffentlichung: Apple
// verlangt den Datenschutz-Link ausdrücklich IN der App (5.1.1(i)), und das
// dänische E-handelslov verlangt Firmenname, CVR-Nummer, Adresse, E-Mail und
// Telefon erreichbar, bevor ein Vertrag zustande kommt.
//
// Die Anbieterangaben stehen als TEXT in der App, nicht nur als Link: sie müssen
// auch ohne Netz lesbar sein. Die langen Dokumente öffnen im Browser — sie in
// die App zu kopieren hieße, dieselben Rechtstexte an zwei Stellen zu pflegen,
// und genau daran veralten sie.
import { Linking, Pressable, View } from "react-native";

import { Icon } from "@/components/ui/Icon";
import { Card, Col, Divider, Row, Txt } from "@/components/ui/kit";
import { ANBIETER, RECHTSDOKUMENTE, anbieterZeilen } from "@/lib/rechtliches";
import { useTheme } from "@/theme/ThemeProvider";

export function RechtlichesBlock() {
  const t = useTheme();

  return (
    <Col gap={10}>
      <Txt v="xs" soft style={{ fontFamily: t.fonts.semibold }}>
        RECHTLICHES
      </Txt>

      <Card>
        {RECHTSDOKUMENTE.map((dok, i) => (
          <View key={dok.url}>
            {i > 0 && <Divider />}
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`${dok.titel} öffnen`}
              onPress={() => Linking.openURL(dok.url)}
              style={({ pressed }) => ({
                paddingVertical: 13,
                paddingHorizontal: 16,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Row gap={12} style={{ alignItems: "center" }}>
                <Col gap={2} style={{ flex: 1 }}>
                  <Txt v="body">{dok.titel}</Txt>
                  <Txt v="xs" soft numberOfLines={2}>
                    {dok.hinweis}
                  </Txt>
                </Col>
                {/* „share" = führt aus der App heraus in den Browser. Ein
                    Vorwärts-Pfeil würde eine Seite IN der App versprechen. */}
                <Icon n="share" s={15} sw={1.9} c={t.palette.faint} />
              </Row>
            </Pressable>
          </View>
        ))}
      </Card>

      {/* Anbieterkennzeichnung — offline lesbar, mit direkt nutzbaren
          Kontaktwegen. Auf dem Telefon ist eine Nummer, die man antippen kann,
          der ganze Sinn der Angabe. */}
      <Card>
        <Col style={{ padding: 16, gap: 10 }}>
          {anbieterZeilen().map((zeile) => (
            <Txt key={zeile} v="sm" soft>
              {zeile}
            </Txt>
          ))}
          <Row gap={8} style={{ flexWrap: "wrap" }}>
            <KontaktKnopf
              icon="send"
              label={ANBIETER.email}
              onPress={() => Linking.openURL(`mailto:${ANBIETER.email}`)}
            />
            <KontaktKnopf
              icon="user"
              label={ANBIETER.telefon}
              onPress={() => Linking.openURL(`tel:${ANBIETER.telefonE164}`)}
            />
          </Row>
        </Col>
      </Card>
    </Col>
  );
}

function KontaktKnopf({
  icon,
  label,
  onPress,
}: {
  icon: Parameters<typeof Icon>[0]["n"];
  label: string;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingVertical: 7,
        paddingHorizontal: 12,
        borderRadius: t.radius.pill,
        borderWidth: 1,
        borderColor: t.palette.line,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <Icon n={icon} s={13} sw={2} c={t.palette.ink} />
      <Txt v="xs">{label}</Txt>
    </Pressable>
  );
}

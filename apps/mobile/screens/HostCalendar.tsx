// Gastgeber · Kalender (aus host-app.jsx HostCalendar): Timeline mit Objekten
// und Belegungsbalken, Detail-Karte für eine Buchung.
import { useState } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/Icon";
import { Btn, Card, Chip, Col, IconBtn, Photo, Row, Segmented, Txt } from "@/components/ui/kit";
import { ND_PHOTOS as P, PH } from "@/lib/photos";
import { useTheme } from "@/theme/ThemeProvider";

const PROPS = [
  { name: "Villa Solnedgang", photo: P.villa, grad: "grad1" as const, start: 8, len: 58, label: "Berg", isNew: false },
  { name: "Lys Loft", photo: P.loft, grad: "grad3" as const, start: 0, len: 36, label: "Hansen", isNew: false },
  { name: "Hytte ved Skoven", photo: P.cabin, grad: "grad2" as const, start: 44, len: 40, label: "Neu", isNew: true },
];
const DAYS = ["16", "17", "18", "19", "20", "21", "22"];

export default function Calendar() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [seg, setSeg] = useState(0);

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
      <Col style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12, gap: 14 }}>
        <Row style={{ justifyContent: "space-between" }}>
          <Txt v="h1">Kalender</Txt>
          <IconBtn icon="plus" bg={t.palette.accent} color="#fff" />
        </Row>
        <Segmented options={["Timeline", "Monat", "Liste"]} value={seg} onChange={setSeg} />
      </Col>

      <Col style={{ paddingHorizontal: 20, paddingTop: 8, gap: 16 }}>
        <Row style={{ justifyContent: "space-between" }}>
          <Txt v="sm" style={{ fontFamily: t.type.semibold.fontFamily }}>
            Juni 2026
          </Txt>
          <Row gap={14}>
            <Icon n="back" s={17} sw={2} c={t.palette.soft} />
            <Icon n="fwd" s={17} sw={2} c={t.palette.soft} />
          </Row>
        </Row>

        <Row style={{ paddingLeft: 96, justifyContent: "space-between" }}>
          {DAYS.map((d, i) => (
            <Txt key={d} v="xs" accent={i === 2} faint={i !== 2} style={{ width: 24, textAlign: "center", fontFamily: t.type.bold.fontFamily }}>
              {d}
            </Txt>
          ))}
        </Row>

        <Col gap={12}>
          {PROPS.map((p) => (
            <Row key={p.name} gap={10}>
              <Row style={{ width: 86 }} gap={8}>
                <Photo src={PH(p.photo, 120)} grad={p.grad} h={34} w={34} r={9} />
                <Txt v="xs" numberOfLines={1} style={{ width: 44, fontFamily: t.type.semibold.fontFamily }}>
                  {p.name}
                </Txt>
              </Row>
              <View style={{ flex: 1, height: 34, backgroundColor: t.palette.surface2, borderRadius: 9 }}>
                <View
                  style={{
                    position: "absolute",
                    top: 4,
                    bottom: 4,
                    left: `${p.start}%`,
                    width: `${p.len}%`,
                    backgroundColor: p.isNew ? t.palette.accentSoft : t.palette.accent,
                    borderWidth: p.isNew ? 1.5 : 0,
                    borderColor: t.palette.accent,
                    borderStyle: "dashed",
                    borderRadius: 7,
                    justifyContent: "center",
                    paddingLeft: 9,
                  }}
                >
                  <Txt v="xs" numberOfLines={1} color={p.isNew ? t.palette.accent : "#fff"} style={{ fontFamily: t.type.bold.fontFamily }}>
                    {p.label}
                  </Txt>
                </View>
              </View>
            </Row>
          ))}
        </Col>

        <Card style={{ padding: 16, gap: 12 }}>
          <Row style={{ justifyContent: "space-between" }}>
            <Txt v="title">Villa Solnedgang</Txt>
            <Chip variant="accent">€189/N</Chip>
          </Row>
          <Txt v="sm" soft>
            18.–22. Juni · belegt · Familie Berg
          </Txt>
          <Row gap={10}>
            <Btn variant="ghost" block icon="euro">
              Preis
            </Btn>
            <Btn variant="outline" block icon="plus">
              Blockieren
            </Btn>
          </Row>
        </Card>
      </Col>
    </View>
  );
}

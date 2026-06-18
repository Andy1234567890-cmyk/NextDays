// Gastgeber · Übersicht (aus host-app.jsx HostDashboard): KPI-Karten, Umsatz-
// Balken (7 Tage), heutige Anreisen/Abreisen.
import { View } from "react-native";

import { Icon } from "@/components/ui/Icon";
import { Card, Chip, Col, Divider, IconBtn, Photo, Row, Txt } from "@/components/ui/kit";
import { Screen } from "@/components/ui/Screen";
import { ND_PHOTOS as P, PH } from "@/lib/photos";
import { useTheme } from "@/theme/ThemeProvider";

function MiniBars({ data, accentIdx }: { data: number[]; accentIdx: number }) {
  const t = useTheme();
  const max = Math.max(...data);
  return (
    <Row style={{ alignItems: "flex-end", gap: 7, height: 70 }}>
      {data.map((v, i) => (
        <View key={i} style={{ flex: 1, justifyContent: "flex-end", height: "100%" }}>
          <View
            style={{
              height: `${(v / max) * 100}%`,
              borderRadius: 6,
              backgroundColor: i === accentIdx ? t.palette.accent : t.palette.surface2,
            }}
          />
        </View>
      ))}
    </Row>
  );
}

export default function HostDashboard() {
  const days = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  return (
    <Screen contentStyle={{ gap: 18 }}>
      <Row style={{ justifyContent: "space-between" }}>
        <Col gap={2}>
          <Txt v="sm" soft>
            Dienstag, 18. Juni
          </Txt>
          <Txt v="h1">Hej, Mette 👋</Txt>
        </Col>
        <IconBtn icon="bell" badge={3} />
      </Row>

      <Row gap={12}>
        <Kpi icon="chart" value="78%" label="Belegung · Juni" />
        <Kpi icon="euro" value="€12,4k" label="Umsatz · Monat" />
      </Row>

      <Card style={{ padding: 18, gap: 14 }}>
        <Row style={{ justifyContent: "space-between" }}>
          <Txt v="title">Umsatz letzte 7 Tage</Txt>
          <Chip variant="ghost">
            <Row gap={3}>
              <Icon n="arrowup" s={13} sw={2.2} c="#1F8A5B" />
              <Txt v="xs" color="#1F8A5B">
                +14%
              </Txt>
            </Row>
          </Chip>
        </Row>
        <MiniBars data={[5, 7, 4, 8, 6, 9, 7]} accentIdx={5} />
        <Row style={{ justifyContent: "space-between" }}>
          {days.map((d) => (
            <Txt key={d} v="xs" faint style={{ flex: 1, textAlign: "center" }}>
              {d}
            </Txt>
          ))}
        </Row>
      </Card>

      <Row style={{ justifyContent: "space-between" }}>
        <Txt v="h2">Heute</Txt>
        <Txt v="sm" accent>
          Alle
        </Txt>
      </Row>

      <Card style={{ padding: 6 }}>
        <EventRow photo={PH(P.villa, 160)} grad="grad1" title="Anreise · Familie Berg" sub="Villa Solnedgang · 15:00" chip="Check-in" accent />
        <Divider style={{ marginHorizontal: 12 }} />
        <EventRow photo={PH(P.loft, 160)} grad="grad3" title="Abreise · L. Hansen" sub="Lys Loft · 11:00" chip="Check-out" />
      </Card>
    </Screen>
  );
}

function Kpi({ icon, value, label }: { icon: "chart" | "euro"; value: string; label: string }) {
  const t = useTheme();
  return (
    <Card style={{ flex: 1, padding: 16, gap: 4 }}>
      <Icon n={icon} s={18} sw={1.8} c={t.palette.accent} />
      <Txt v="display" style={{ fontSize: 28 }}>
        {value}
      </Txt>
      <Txt v="xs" soft>
        {label}
      </Txt>
    </Card>
  );
}

function EventRow({
  photo,
  grad,
  title,
  sub,
  chip,
  accent,
}: {
  photo: string;
  grad: "grad1" | "grad3";
  title: string;
  sub: string;
  chip: string;
  accent?: boolean;
}) {
  return (
    <Row style={{ padding: 12, gap: 12 }}>
      <Photo src={photo} grad={grad} h={46} w={46} r={12} />
      <Col gap={1} style={{ flex: 1 }}>
        <Txt v="sm" style={{ fontWeight: "600" }}>
          {title}
        </Txt>
        <Txt v="xs" soft>
          {sub}
        </Txt>
      </Col>
      <Chip variant={accent ? "accent" : ""}>{chip}</Chip>
    </Row>
  );
}

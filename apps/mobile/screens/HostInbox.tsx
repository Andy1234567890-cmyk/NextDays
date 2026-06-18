// Gastgeber · Posteingang (aus host-app.jsx HostInbox): Filter-Chips, Nachrichten-
// liste je Kanal (NextDays/Booking/Airbnb), Smart-Antworten-Hinweis.
import { useState } from "react";
import { Fragment } from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/Icon";
import { Avatar, Badge, Card, Chip, Col, Divider, IconBtn, Row, Txt } from "@/components/ui/kit";
import { ND_PHOTOS as P, PH } from "@/lib/photos";
import { useTheme } from "@/theme/ThemeProvider";

const MSGS = [
  { who: "Familie Berg", src: P.bright, unread: 2, ch: "NextDays", txt: "Können wir früher einchecken?", t: "14:02" },
  { who: "Lars Hansen", src: P.city, unread: 0, ch: "Booking", txt: "Vielen Dank, alles super!", t: "11:30" },
  { who: "Sofie Larsen", src: P.coast, unread: 0, ch: "Airbnb", txt: "Gibt es einen Parkplatz?", t: "Gestern" },
];
const FILTERS = ["Alle", "Ungelesen", "NextDays", "Booking"];

export default function Inbox() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [filter] = useState(0);

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
      <Col style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12, gap: 14 }}>
        <Row style={{ justifyContent: "space-between" }}>
          <Txt v="h1">Posteingang</Txt>
          <IconBtn icon="search" flat bg={t.palette.surface2} />
        </Row>
        <Row gap={9}>
          {FILTERS.map((f, i) => (
            <Chip key={f} variant={i === filter ? "on" : i > 1 ? "ghost" : ""} >
              {f}
            </Chip>
          ))}
        </Row>
      </Col>

      <Col style={{ paddingHorizontal: 20, paddingTop: 6, gap: 4 }}>
        {MSGS.map((m, i) => (
          <Fragment key={m.who}>
            {i > 0 && <Divider style={{ marginHorizontal: 4 }} />}
            <Row style={{ paddingVertical: 12, paddingHorizontal: 4, gap: 12, alignItems: "flex-start" }}>
              <Avatar s={48} src={PH(m.src, 100)} />
              <Col gap={3} style={{ flex: 1 }}>
                <Row style={{ justifyContent: "space-between" }}>
                  <Txt v="sm" style={{ fontFamily: t.type.bold.fontFamily }}>
                    {m.who}
                  </Txt>
                  <Txt v="xs" soft>
                    {m.t}
                  </Txt>
                </Row>
                <Txt v="sm" soft={!m.unread} numberOfLines={1}>
                  {m.txt}
                </Txt>
                <Row style={{ justifyContent: "space-between", marginTop: 2 }}>
                  <Chip variant="ghost" style={{ paddingVertical: 3, paddingHorizontal: 9 }}>
                    {m.ch}
                  </Chip>
                  {m.unread > 0 && <Badge>{m.unread}</Badge>}
                </Row>
              </Col>
            </Row>
          </Fragment>
        ))}

        <Card style={{ flexDirection: "row", alignItems: "center", padding: 14, gap: 12, marginTop: 8, backgroundColor: t.palette.accentSoft }}>
          <Icon n="sparkle" s={22} c={t.palette.accent} />
          <Col gap={1} style={{ flex: 1 }}>
            <Txt v="sm" style={{ fontFamily: t.type.bold.fontFamily }}>
              Smart-Antworten
            </Txt>
            <Txt v="xs" soft>
              Vorlagen & Auto-Replies einrichten
            </Txt>
          </Col>
          <Icon n="fwd" s={16} sw={2} c={t.palette.accent} />
        </Card>
      </Col>
    </View>
  );
}

// Gäste · Startseite (Discovery, Booking × Airbnb): Suchkarte mit Reitern
// (Aufenthalte/Erlebnisse/Services), Kategorien, „Suche fortsetzen", beliebte
// Unterkünfte (Querscroll), Treue-Banner, angesagte Reiseziele, Angebote.
// Tippen auf eine Unterkunft führt in unseren ListingDetail-Screen.
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useState } from "react";
import { Image, Pressable, ScrollView, View } from "react-native";

import { Icon, type IconName } from "@/components/ui/Icon";
import { Card, Chip, Col, Divider, Photo, Row, Star, Txt } from "@/components/ui/kit";
import { Screen } from "@/components/ui/Screen";
import { ND_PHOTOS as P, PH } from "@/lib/photos";
import type { GuestTabParamList } from "@/navigation/types";
import type { RootStackParamList } from "@/navigation/types";
import { useTheme } from "@/theme/ThemeProvider";

const logoImg = require("../assets/img/Logo_transparent.png");

// Reiter über der Suche (Airbnb: Unterkünfte/Erlebnisse/Services).
const TABS: { key: string; label: string; icon: IconName; tag?: string }[] = [
  { key: "stays", label: "Aufenthalte", icon: "bed" },
  { key: "exp", label: "Erlebnisse", icon: "beach", tag: "NEU" },
  { key: "svc", label: "Services", icon: "bell", tag: "NEU" },
];

const CATS: { icon: IconName; label: string }[] = [
  { icon: "globe", label: "Alle" },
  { icon: "beach", label: "Strand" },
  { icon: "cabin", label: "Natur" },
  { icon: "city", label: "Stadt" },
  { icon: "pool", label: "Pool" },
  { icon: "cabin", label: "Hütten" },
];

// Booking: zuletzt gesuchte Orte.
const RECENT = [
  { place: "Kopenhagen", sub: "18.–19. Juni · 2 Gäste", src: P.city },
  { place: "Skagen, DK", sub: "18.–19. Juni · 2 Gäste", src: P.coast },
  { place: "Silkeborg", sub: "20.–22. Juni · 2 Gäste", src: P.cabin },
];

// Airbnb: beliebte Unterkünfte mit Favorit-Badge.
const POPULAR = [
  { id: "villa", title: "Villa Solnedgang", place: "Skagen, Dänemark", price: 189, rating: "4,97", src: P.villa, grad: "grad1" as const, fav: true, tag: "Gäste-Favorit" },
  { id: "loft", title: "Lys Loft", place: "Kopenhagen", price: 142, rating: "4,89", src: P.loft, grad: "grad3" as const, fav: false },
  { id: "cabin", title: "Hytte ved Skoven", place: "Silkeborg · Seeblick", price: 132, rating: "4,89", src: P.cabin, grad: "grad2" as const, fav: false, tag: "Gäste-Favorit" },
];

// Airbnb/Booking: angesagte Reiseziele.
const DESTINATIONS = [
  { name: "Kopenhagen", count: "1.240 Unterkünfte", src: P.city },
  { name: "Skagen", count: "320 Unterkünfte", src: P.coast },
  { name: "Aarhus", count: "723 Unterkünfte", src: P.bright },
];

// Booking: Wochenend-Angebote.
const DEALS = [
  { name: "Hotel Nordlys", place: "Kopenhagen", rating: "8,8", note: "Fabelhaft · 3.229 Bew.", src: P.modern, grad: "grad1" as const },
  { name: "Strandhaus Vesterhav", place: "Skagen", rating: "8,0", note: "Sehr gut · 1.471 Bew.", src: P.beach, grad: "grad2" as const },
];

export default function GuestHome() {
  const t = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList & GuestTabParamList>>();
  const [tab, setTab] = useState(0);

  const openListing = (id: string) => navigation.navigate("ListingDetail", { id });

  return (
    <Screen contentStyle={{ gap: 22 }}>
      {/* Kopf */}
      <Row style={{ justifyContent: "space-between", alignItems: "center" }}>
        <Image
          source={logoImg}
          style={{ width: 140, height: 52 }}
          resizeMode="contain"
        />
        <Row gap={6}>
          <RoundIcon icon="chat" />
          <RoundIcon icon="bell" />
        </Row>
      </Row>

      {/* Reiter (Aufenthalte / Erlebnisse / Services) */}
      <Row gap={10}>
        {TABS.map((tb, i) => {
          const on = i === tab;
          return (
            <Pressable key={tb.key} onPress={() => setTab(i)} style={{ flex: 1 }}>
              <Col gap={6} style={{ alignItems: "center", paddingVertical: 4 }}>
                <Row gap={5} style={{ alignItems: "center" }}>
                  <Icon n={tb.icon} s={20} sw={on ? 2.1 : 1.7} c={on ? t.palette.ink : t.palette.soft} />
                  {tb.tag && (
                    <View style={{ backgroundColor: t.palette.ink, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 }}>
                      <Txt v="xs" color={t.palette.bg} style={{ fontSize: 9 }}>
                        {tb.tag}
                      </Txt>
                    </View>
                  )}
                </Row>
                <Txt v="sm" color={on ? t.palette.ink : t.palette.soft} style={{ fontFamily: on ? t.type.bold.fontFamily : t.type.medium.fontFamily }}>
                  {tb.label}
                </Txt>
                <View style={{ height: 2.5, width: on ? 26 : 0, borderRadius: 999, backgroundColor: t.palette.accent }} />
              </Col>
            </Pressable>
          );
        })}
      </Row>

      {/* Such-Box (Booking-Stil: Ort / Datum / Gäste + Button) */}
      <Card style={{ padding: 6, borderWidth: 2, borderColor: t.palette.accent }}>
        <SearchRow icon="search" text="Wohin geht's? · Im Umkreis" />
        <Divider style={{ marginHorizontal: 12 }} />
        <SearchRow icon="cal" text="Do. 18. Juni – Fr. 19. Juni" />
        <Divider style={{ marginHorizontal: 12 }} />
        <SearchRow icon="users" text="1 Zimmer · 2 Erwachsene · keine Kinder" />
        <Pressable
          onPress={() => navigation.navigate("Discover")}
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            marginTop: 6,
            paddingVertical: 14,
            borderRadius: t.radius.btn,
            backgroundColor: t.palette.accent,
          }}
        >
          <Icon n="search" s={18} sw={2.2} c="#fff" />
          <Txt v="title" color="#fff">
            Suche
          </Txt>
        </Pressable>
      </Card>

      {/* Kategorien */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
        {CATS.map((c, i) => (
          <Chip key={c.label} variant={i === 0 ? "on" : ""} icon={c.icon}>
            {c.label}
          </Chip>
        ))}
      </ScrollView>

      {/* Suche fortsetzen (Booking) */}
      <Section title="Suche fortsetzen">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12, paddingRight: 4 }}>
          {RECENT.map((r) => (
            <Card key={r.place} style={{ flexDirection: "row", alignItems: "center", gap: 11, padding: 10, width: 248 }}>
              <Photo src={PH(r.src, 160)} h={48} w={48} r={12} />
              <Col gap={2} style={{ flex: 1 }}>
                <Txt v="title" numberOfLines={1}>
                  {r.place}
                </Txt>
                <Txt v="xs" soft numberOfLines={1}>
                  {r.sub}
                </Txt>
              </Col>
            </Card>
          ))}
        </ScrollView>
      </Section>

      {/* Beliebte Unterkünfte (Airbnb) */}
      <Section title="Beliebte Unterkünfte" action="Alle">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingRight: 4 }}>
          {POPULAR.map((u) => (
            <Pressable key={u.id} onPress={() => openListing(u.id)} style={{ width: 220 }}>
              <Col gap={9}>
                <Photo src={PH(u.src, 500)} grad={u.grad} h={170} r={t.radius.img}>
                  <Row style={{ position: "absolute", top: 10, left: 10, right: 10, justifyContent: "space-between" }}>
                    {u.tag ? (
                      <View style={{ backgroundColor: "rgba(255,255,255,0.94)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5 }}>
                        <Txt v="xs" color={t.palette.ink}>
                          {u.tag}
                        </Txt>
                      </View>
                    ) : (
                      <View />
                    )}
                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: "rgba(255,255,255,0.94)", alignItems: "center", justifyContent: "center" }}>
                      <Icon n="heart" s={17} sw={2} c={u.fav ? t.palette.accent : t.palette.ink} />
                    </View>
                  </Row>
                </Photo>
                <Col gap={2}>
                  <Row style={{ justifyContent: "space-between" }}>
                    <Txt v="title" numberOfLines={1} style={{ flex: 1 }}>
                      {u.title}
                    </Txt>
                    <Row gap={3}>
                      <Star />
                      <Txt v="sm">{u.rating}</Txt>
                    </Row>
                  </Row>
                  <Txt v="xs" soft numberOfLines={1}>
                    {u.place}
                  </Txt>
                  <Row gap={4} style={{ marginTop: 1 }}>
                    <Txt v="title">€{u.price}</Txt>
                    <Txt v="xs" soft>
                      / Nacht
                    </Txt>
                  </Row>
                </Col>
              </Col>
            </Pressable>
          ))}
        </ScrollView>
      </Section>

      {/* Treue-Banner */}
      <Card style={{ flexDirection: "row", overflow: "hidden" }}>
        <Col gap={6} style={{ flex: 1, padding: 18, backgroundColor: t.palette.accent }}>
          <Txt v="h2" color="#fff">
            MyNextDays+
          </Txt>
          <Txt v="sm" color="rgba(255,255,255,0.92)">
            Andy, du bist auf Stufe 3 — sichere dir 10–20 % auf ausgewählte Aufenthalte.
          </Txt>
        </Col>
        <Col gap={2} style={{ width: 132, padding: 16, justifyContent: "center" }}>
          <Txt v="display" accent style={{ fontSize: 26 }}>
            -15%
          </Txt>
          <Txt v="xs" soft>
            auf deine nächste Reise
          </Txt>
        </Col>
      </Card>

      {/* Angesagte Reiseziele */}
      <Section title="Angesagte Reiseziele">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 14, paddingRight: 4 }}>
          {DESTINATIONS.map((d) => (
            <Photo key={d.name} src={PH(d.src, 600)} h={210} w={170} r={t.radius.img}>
              <View style={{ position: "absolute", inset: 0 as never, backgroundColor: "rgba(0,0,0,0.18)" }} />
              <Col gap={1} style={{ position: "absolute", left: 14, bottom: 14, right: 14 }}>
                <Txt v="h2" color="#fff">
                  {d.name}
                </Txt>
                <Txt v="xs" color="rgba(255,255,255,0.92)">
                  {d.count}
                </Txt>
              </Col>
            </Photo>
          ))}
        </ScrollView>
      </Section>

      {/* Wochenend-Angebote */}
      <Section title="Wochenend-Angebote" sub="Sparen Sie vom 19.–21. Juni">
        <Col gap={14}>
          {DEALS.map((d) => (
            <Pressable key={d.name} onPress={() => openListing("villa")}>
              <Card style={{ flexDirection: "row", overflow: "hidden", padding: 10, gap: 12 }}>
                <Photo src={PH(d.src, 300)} grad={d.grad} h={92} w={92} r={14} />
                <Col gap={4} style={{ flex: 1, justifyContent: "center" }}>
                  <Txt v="xs" soft>
                    Hotel
                  </Txt>
                  <Txt v="title" numberOfLines={1}>
                    {d.name}
                  </Txt>
                  <Row gap={8} style={{ alignItems: "center" }}>
                    <View style={{ backgroundColor: t.palette.accent, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 }}>
                      <Txt v="xs" color="#fff">
                        {d.rating}
                      </Txt>
                    </View>
                    <Txt v="xs" soft numberOfLines={1} style={{ flex: 1 }}>
                      {d.note}
                    </Txt>
                  </Row>
                  <Row gap={4} style={{ alignItems: "center" }}>
                    <Icon n="pin" s={13} sw={2} c={t.palette.soft} />
                    <Txt v="xs" soft>
                      {d.place}
                    </Txt>
                  </Row>
                </Col>
              </Card>
            </Pressable>
          ))}
        </Col>
      </Section>
    </Screen>
  );
}

// --- Bausteine --------------------------------------------------------------

function RoundIcon({ icon }: { icon: IconName }) {
  const t = useTheme();
  return (
    <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: t.palette.surface, alignItems: "center", justifyContent: "center", ...t.shadow.sm }}>
      <Icon n={icon} s={20} sw={1.8} c={t.palette.ink} />
    </View>
  );
}

function SearchRow({ icon, text }: { icon: IconName; text: string }) {
  const t = useTheme();
  return (
    <Row gap={12} style={{ paddingVertical: 13, paddingHorizontal: 12 }}>
      <Icon n={icon} s={19} sw={1.9} c={t.palette.soft} />
      <Txt v="sm" numberOfLines={1} style={{ flex: 1, fontFamily: t.type.medium.fontFamily }}>
        {text}
      </Txt>
    </Row>
  );
}

function Section({ title, sub, action, children }: { title: string; sub?: string; action?: string; children: React.ReactNode }) {
  return (
    <Col gap={12}>
      <Row style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
        <Col gap={2} style={{ flex: 1 }}>
          <Txt v="h2">{title}</Txt>
          {sub && (
            <Txt v="sm" soft>
              {sub}
            </Txt>
          )}
        </Col>
        {action && (
          <Txt v="sm" accent>
            {action}
          </Txt>
        )}
      </Row>
      {children}
    </Col>
  );
}
// Gäste · Startseite (Discovery im Booking-/Airbnb-Stil), jetzt vollständig aus
// echten Daten: die Themen-Reihen entstehen aus den aktiven Inseraten des
// booking_engine-Slices (/api/v1/booking-engine/listings), gruppiert nach
// Objekttyp und Stadt. Es werden KEINE Kategorien, Reiseziele, Preise oder
// Bewertungen erfunden — was das Backend nicht liefert, wird nicht gezeigt
// (Wurzel 4). Die Suchkarte reicht Ort/Zeitraum/Gäste an die Suche weiter.
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useEffect, useState } from "react";
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, type IconName } from "@/components/ui/Icon";
import { Card, Col, Divider, Photo, Row, Spinner, Star, Txt } from "@/components/ui/kit";
import { formatCurrency } from "@/lib/currency";
import { heute, istIsoTag, plusTage } from "@/lib/datum";
import {
  listingOrt,
  listingRows,
  searchListings,
  type Listing,
  type ListingRow,
} from "@/lib/listings";
import type { GuestTabParamList, RootStackParamList } from "@/navigation/types";
import { useTheme } from "@/theme/ThemeProvider";

const logoImg = require("../assets/img/Logo_transparent.png");

type Nav = NativeStackNavigationProp<RootStackParamList & GuestTabParamList>;

export default function GuestHome() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();

  const [reihen, setReihen] = useState<ListingRow[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  // Suchfelder: Ort + Zeitraum + Gäste. Der Zeitraum ist optional; ist er
  // gesetzt, filtert der Server auf tatsächlich freie Objekte.
  const [ort, setOrt] = useState("");
  const [von, setVon] = useState("");
  const [bis, setBis] = useState("");
  const [gaeste, setGaeste] = useState("2");

  const load = useCallback(async () => {
    const res = await searchListings();
    if (res.ok) {
      setReihen(listingRows(res.data.items));
      setFehler(null);
    } else {
      setReihen(null);
      setFehler(res.error);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Nur gültige Werte weiterreichen — ein halb getipptes Datum darf nicht als
  // Filter durchrutschen (der Server würde es mit 422 ablehnen).
  const suchen = () => {
    const anzahl = Number.parseInt(gaeste, 10);
    navigation.navigate("Discover", {
      q: ort.trim() || undefined,
      start: istIsoTag(von) ? von : undefined,
      end: istIsoTag(bis) ? bis : undefined,
      guests: Number.isFinite(anzahl) && anzahl > 0 ? anzahl : undefined,
    });
  };

  const openListing = (id: string) =>
    navigation.navigate("ListingDetail", {
      id,
      start: istIsoTag(von) ? von : undefined,
      end: istIsoTag(bis) ? bis : undefined,
    });

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ padding: 20, paddingBottom: 40, gap: 22 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
      >
        <Row style={{ justifyContent: "space-between", alignItems: "center" }}>
          <Image source={logoImg} style={{ width: 140, height: 52 }} resizeMode="contain" />
          <Pressable onPress={() => navigation.navigate("GuestProfile")}>
            <RoundIcon icon="user" />
          </Pressable>
        </Row>

        {/* Such-Box (Ort · Zeitraum · Gäste) */}
        <Card style={{ padding: 6, borderWidth: 2, borderColor: t.palette.accent }}>
          <SearchField
            icon="search"
            value={ort}
            onChange={setOrt}
            placeholder="Wohin geht's? Ort oder Objekt"
          />
          <Divider style={{ marginHorizontal: 12 }} />
          <Row style={{ paddingHorizontal: 12, paddingVertical: 4, gap: 8, alignItems: "center" }}>
            <Icon n="cal" s={19} sw={1.9} c={t.palette.soft} />
            <DateField value={von} onChange={setVon} placeholder="Anreise" />
            <Icon n="fwd" s={14} sw={2} c={t.palette.faint} />
            <DateField value={bis} onChange={setBis} placeholder="Abreise" />
          </Row>
          <Divider style={{ marginHorizontal: 12 }} />
          <Row style={{ paddingHorizontal: 12, paddingVertical: 4, gap: 10, alignItems: "center" }}>
            <Icon n="users" s={19} sw={1.9} c={t.palette.soft} />
            <TextInput
              value={gaeste}
              onChangeText={(v) => setGaeste(v.replace(/[^0-9]/g, ""))}
              keyboardType="number-pad"
              maxLength={2}
              placeholder="Gäste"
              placeholderTextColor={t.palette.faint}
              style={{
                color: t.palette.ink,
                fontFamily: t.type.medium.fontFamily,
                paddingVertical: 12,
                minWidth: 40,
              }}
            />
            <Txt v="sm" soft>
              Gäste
            </Txt>
          </Row>
          <Pressable
            onPress={suchen}
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
          {(von || bis) && !(istIsoTag(von) && istIsoTag(bis)) && (
            <Txt v="xs" soft style={{ paddingHorizontal: 12, paddingBottom: 8 }}>
              Datum im Format JJJJ-MM-TT (z. B. {heute()} bis {plusTage(heute(), 2)}).
            </Txt>
          )}
        </Card>

        {!reihen && !fehler && <Spinner />}

        {reihen && reihen.length === 0 && (
          <Txt v="sm" soft style={{ textAlign: "center", marginTop: 30 }}>
            {fehler ?? "Aktuell sind keine Unterkünfte buchbar."}
          </Txt>
        )}

        {reihen?.map((reihe) => (
          <Section key={reihe.titel} title={reihe.titel}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ gap: 14, paddingRight: 4 }}
            >
              {reihe.listings.map((l) => (
                <ListingKachel key={`${reihe.titel}-${l.id}`} listing={l} onPress={() => openListing(l.id)} />
              ))}
            </ScrollView>
          </Section>
        ))}
      </ScrollView>
    </View>
  );
}

// --- Bausteine --------------------------------------------------------------

function ListingKachel({ listing, onPress }: { listing: Listing; onPress: () => void }) {
  const t = useTheme();
  const ort = listingOrt(listing);
  const bewertung =
    typeof listing.rating === "number" ? listing.rating.toFixed(2).replace(".", ",") : null;

  return (
    <Pressable onPress={onPress} style={{ width: 220 }}>
      <Col gap={9}>
        <Photo src={listing.photos[0]} grad="grad1" h={170} r={t.radius.img} />
        <Col gap={2}>
          <Row style={{ justifyContent: "space-between" }}>
            <Txt v="title" numberOfLines={1} style={{ flex: 1 }}>
              {listing.title}
            </Txt>
            {bewertung && (
              <Row gap={3}>
                <Star />
                <Txt v="sm">{bewertung}</Txt>
              </Row>
            )}
          </Row>
          {ort ? (
            <Txt v="xs" soft numberOfLines={1}>
              {ort}
            </Txt>
          ) : null}
          <Row gap={4} style={{ marginTop: 1, alignItems: "baseline" }}>
            {listing.price_from != null ? (
              <>
                <Txt v="title">{formatCurrency(listing.price_from, listing.currency)}</Txt>
                <Txt v="xs" soft>
                  / Nacht
                </Txt>
              </>
            ) : (
              <Txt v="xs" soft>
                Preis auf Anfrage
              </Txt>
            )}
          </Row>
        </Col>
      </Col>
    </Pressable>
  );
}

function RoundIcon({ icon }: { icon: IconName }) {
  const t = useTheme();
  return (
    <View
      style={{
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: t.palette.surface,
        alignItems: "center",
        justifyContent: "center",
        ...t.shadow.sm,
      }}
    >
      <Icon n={icon} s={20} sw={1.8} c={t.palette.ink} />
    </View>
  );
}

function SearchField({
  icon,
  value,
  onChange,
  placeholder,
}: {
  icon: IconName;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const t = useTheme();
  return (
    <Row gap={12} style={{ paddingVertical: 4, paddingHorizontal: 12, alignItems: "center" }}>
      <Icon n={icon} s={19} sw={1.9} c={t.palette.soft} />
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={t.palette.faint}
        style={{ flex: 1, color: t.palette.ink, fontFamily: t.type.medium.fontFamily, paddingVertical: 13 }}
      />
    </Row>
  );
}

function DateField({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const t = useTheme();
  return (
    <TextInput
      value={value}
      onChangeText={(v) => onChange(v.replace(/[^0-9-]/g, "").slice(0, 10))}
      placeholder={placeholder}
      placeholderTextColor={t.palette.faint}
      keyboardType="numbers-and-punctuation"
      style={{
        flex: 1,
        color: t.palette.ink,
        fontFamily: t.type.medium.fontFamily,
        paddingVertical: 12,
      }}
    />
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Col gap={12}>
      <Txt v="h2">{title}</Txt>
      {children}
    </Col>
  );
}

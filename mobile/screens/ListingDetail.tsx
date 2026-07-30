// Unterkunft-Detail der GAST-Sicht. Quelle ist der öffentliche booking_engine-
// Slice (/api/v1/booking-engine/listings/{id}) — nicht der tenant-geschützte
// properties-Slice: ein Gast hat keine Tenant-Session und bekäme dort 401/403.
//
// Gezeigt werden ausschließlich echte Felder (Titel, Ort, Gäste, Zimmer,
// Ausstattung, Beschreibung, Fotos, Preis). Ist ein Zeitraum gewählt, liefert
// der Server den EFFEKTIVPREIS dieses Zeitraums (`price` + `nights`) und die
// tagesgenaue Verfügbarkeit; ohne Zeitraum steht der „ab"-Preis. Fehlt ein
// Preis, heißt es „Preis auf Anfrage" — nie 0 (Wurzel 4).
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useEffect, useState } from "react";
import { ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, type IconName } from "@/components/ui/Icon";
import { Btn, Card, Chip, Col, Divider, IconBtn, Photo, Row, Spinner, Txt } from "@/components/ui/kit";
import { useGuestAuth } from "@/contexts/GuestAuthContext";
import { formatCurrency } from "@/lib/currency";
import { istIsoTag } from "@/lib/datum";
import { addWishlistItem, createWishlist, listWishlists } from "@/lib/guestWishlist";
import {
  getAvailability,
  getListing,
  listingOrt,
  listingTypeLabel,
  naechte,
  type ListingDetail as ListingDetailTyp,
} from "@/lib/listings";
import type { RootStackParamList } from "@/navigation/types";
import { useTheme } from "@/theme/ThemeProvider";

export default function ListingDetail() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "ListingDetail">>();
  const { id } = route.params;
  const { status: gastStatus } = useGuestAuth();

  const [von, setVon] = useState(route.params.start ?? "");
  const [bis, setBis] = useState(route.params.end ?? "");
  const [gaeste, setGaeste] = useState(String(route.params.guests ?? 2));

  const [listing, setListing] = useState<ListingDetailTyp | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [frei, setFrei] = useState<boolean | null>(null);
  const [merkStatus, setMerkStatus] = useState<string | null>(null);
  const [merkLaeuft, setMerkLaeuft] = useState(false);

  const zeitraumGueltig = istIsoTag(von) && istIsoTag(bis) && naechte(von, bis) > 0;

  const load = useCallback(async () => {
    setLaedt(true);
    const res = await getListing(id, zeitraumGueltig ? { start: von, end: bis } : {});
    if (res.ok) {
      setListing(res.data);
      setFehler(null);
    } else {
      setFehler(res.error);
    }
    setLaedt(false);
  }, [id, von, bis, zeitraumGueltig]);

  useEffect(() => {
    load();
  }, [load]);

  // Verfügbarkeit nur prüfen, wenn ein gültiger Zeitraum gewählt ist. Ergebnis
  // ist die Server-Wahrheit (availability + Reservierungen), keine Schätzung.
  useEffect(() => {
    if (!zeitraumGueltig) {
      setFrei(null);
      return;
    }
    let aktiv = true;
    getAvailability(id, von, bis).then((res) => {
      if (!aktiv) return;
      if (!res.ok) {
        setFrei(null);
        return;
      }
      // check_out ist exklusiv — der Abreisetag muss nicht frei sein.
      const naechteTage = res.data.days.filter((d) => d.date < bis);
      setFrei(naechteTage.length > 0 && naechteTage.every((d) => d.available));
    });
    return () => {
      aktiv = false;
    };
  }, [id, von, bis, zeitraumGueltig]);

  // Merken: braucht ein Gast-Konto (die Merkliste hängt an portal_guests).
  // Ohne Konto führt der Weg zur Gast-Anmeldung statt zu einem stillen Fehler.
  const merken = async () => {
    if (gastStatus !== "signedIn") {
      navigation.navigate("GuestLogin", { modus: "login" });
      return;
    }
    if (merkLaeuft) return; // Doppeltipp-Guard (Wurzel 2)
    setMerkLaeuft(true);
    setMerkStatus(null);
    const listen = await listWishlists();
    if (!listen.ok) {
      setMerkStatus(listen.error);
      setMerkLaeuft(false);
      return;
    }
    let listenId = listen.data.items[0]?.id;
    if (!listenId) {
      const neu = await createWishlist("Meine Merkliste");
      if (!neu.ok) {
        setMerkStatus(neu.error);
        setMerkLaeuft(false);
        return;
      }
      listenId = neu.data.id;
    }
    const res = await addWishlistItem(listenId, id);
    setMerkStatus(res.ok ? "Zur Merkliste hinzugefügt." : res.error);
    setMerkLaeuft(false);
  };

  if (laedt && !listing) {
    return (
      <View style={{ flex: 1, backgroundColor: t.palette.bg }}>
        <Spinner />
      </View>
    );
  }

  if (!listing) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: t.palette.bg,
          paddingTop: insets.top + 20,
          paddingHorizontal: 20,
          gap: 16,
        }}
      >
        <IconBtn icon="back" onPress={() => navigation.goBack()} />
        <Txt v="sm" soft>
          {fehler ?? "Diese Unterkunft ist nicht (mehr) buchbar."}
        </Txt>
      </View>
    );
  }

  const ort = listingOrt(listing);
  const anzahlGaeste = Number.parseInt(gaeste, 10);
  const gaesteGueltig = Number.isFinite(anzahlGaeste) && anzahlGaeste > 0;
  const nights = zeitraumGueltig ? naechte(von, bis) : 0;
  // Preis pro Nacht: mit Zeitraum der Effektivpreis, sonst der „ab"-Preis.
  const proNacht = listing.price ?? listing.price_from;
  const gesamt = proNacht != null && nights > 0 ? proNacht * nights : null;
  const buchbar = zeitraumGueltig && gaesteGueltig && frei === true;

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 170 }}>
        <Photo src={listing.photos[0]} grad="grad1" h={340}>
          <Row
            style={{
              position: "absolute",
              top: insets.top + 8,
              left: 20,
              right: 20,
              justifyContent: "space-between",
            }}
          >
            <IconBtn icon="back" bg="rgba(255,255,255,0.92)" color={t.palette.ink} onPress={() => navigation.goBack()} />
            <IconBtn icon="heart" bg="rgba(255,255,255,0.92)" color={t.palette.ink} onPress={merken} />
          </Row>
          {listing.photos.length > 1 && (
            <Chip
              style={{ position: "absolute", bottom: 16, right: 16, backgroundColor: "rgba(0,0,0,0.5)" }}
              textColor="#fff"
            >
              1 / {listing.photos.length}
            </Chip>
          )}
        </Photo>

        {/* Weitere Fotos (nur echte, keine Platzhalter-Galerie) */}
        {listing.photos.length > 1 && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 10, paddingHorizontal: 20, paddingTop: 14 }}
          >
            {listing.photos.slice(1).map((foto) => (
              <Photo key={foto} src={foto} grad="grad2" h={90} w={120} r={12} />
            ))}
          </ScrollView>
        )}

        <Col style={{ padding: t.density.pad, gap: 16 }}>
          <Col gap={6}>
            <Txt v="h1">{listing.title}</Txt>
            <Row gap={8} style={{ alignItems: "center" }}>
              <Chip variant="ghost">{listingTypeLabel(listing.property_type)}</Chip>
              {ort ? (
                <Txt v="sm" soft>
                  {ort}
                </Txt>
              ) : null}
            </Row>
          </Col>

          <Row gap={18} style={{ flexWrap: "wrap" }}>
            <Merkmal icon="users" text={`${listing.max_guests} Gäste`} />
            {listing.bedrooms != null && <Merkmal icon="bed" text={`${listing.bedrooms} Schlafzimmer`} />}
            {listing.baths != null && <Merkmal icon="pool" text={`${listing.baths} Bäder`} />}
          </Row>

          {merkStatus && (
            <Txt v="xs" soft>
              {merkStatus}
            </Txt>
          )}

          {/* Zeitraum + Gäste (Serverparameter für Preis & Verfügbarkeit) */}
          <Card style={{ padding: 14, gap: 12 }}>
            <Txt v="title">Zeitraum wählen</Txt>
            <Row gap={10} style={{ alignItems: "center" }}>
              <Icon n="cal" s={18} c={t.palette.soft} />
              <DatumFeld value={von} onChange={setVon} placeholder="Anreise" />
              <Icon n="fwd" s={14} sw={2} c={t.palette.faint} />
              <DatumFeld value={bis} onChange={setBis} placeholder="Abreise" />
            </Row>
            <Row gap={10} style={{ alignItems: "center" }}>
              <Icon n="users" s={18} c={t.palette.soft} />
              <TextInput
                value={gaeste}
                onChangeText={(v) => setGaeste(v.replace(/[^0-9]/g, ""))}
                keyboardType="number-pad"
                maxLength={2}
                style={{ color: t.palette.ink, fontFamily: t.type.medium.fontFamily, paddingVertical: 8, minWidth: 40 }}
              />
              <Txt v="sm" soft>
                Gäste (max. {listing.max_guests})
              </Txt>
            </Row>
            {(von || bis) && !zeitraumGueltig && (
              <Txt v="xs" soft>
                Bitte Anreise und Abreise als JJJJ-MM-TT angeben (Abreise nach Anreise).
              </Txt>
            )}
            {zeitraumGueltig && frei === false && (
              <Txt v="sm" style={{ color: "#B02A2A" }}>
                In diesem Zeitraum leider belegt.
              </Txt>
            )}
            {zeitraumGueltig && frei === true && (
              <Txt v="sm" style={{ color: "#1E7A46" }}>
                Frei · {nights} {nights === 1 ? "Nacht" : "Nächte"}
              </Txt>
            )}
          </Card>

          {listing.description ? (
            <>
              <Divider />
              <Txt v="body" soft>
                {listing.description}
              </Txt>
            </>
          ) : null}

          {listing.amenities.length > 0 && (
            <>
              <Divider />
              <Col gap={10}>
                <Txt v="title">Ausstattung</Txt>
                <Row gap={8} style={{ flexWrap: "wrap" }}>
                  {listing.amenities.map((a) => (
                    <Chip key={a} variant="ghost">
                      {a}
                    </Chip>
                  ))}
                </Row>
              </Col>
            </>
          )}

          {listing.addons.length > 0 && (
            <>
              <Divider />
              <Col gap={10}>
                <Txt v="title">Zusatzleistungen</Txt>
                {listing.addons.map((a) => (
                  <Row key={a.id} style={{ justifyContent: "space-between", alignItems: "center" }}>
                    <Txt v="sm" style={{ flex: 1 }} numberOfLines={1}>
                      {a.name.de ?? a.name.en ?? Object.values(a.name)[0] ?? "—"}
                    </Txt>
                    <Txt v="sm" soft>
                      {formatCurrency(a.price, listing.currency)}
                    </Txt>
                  </Row>
                ))}
              </Col>
            </>
          )}
        </Col>
      </ScrollView>

      {/* Sticky-Footer: Preis nur, wenn das Backend einen liefert. */}
      <Row
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          padding: 20,
          paddingBottom: insets.bottom + 16,
          backgroundColor: t.palette.surface,
          borderTopWidth: 1,
          borderTopColor: t.palette.line,
          gap: 14,
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Col>
          {proNacht != null ? (
            <>
              <Row gap={4} style={{ alignItems: "baseline" }}>
                <Txt v="h2">{formatCurrency(proNacht, listing.currency)}</Txt>
                <Txt v="sm" soft>
                  / Nacht
                </Txt>
              </Row>
              {gesamt != null && (
                <Txt v="xs" soft>
                  {formatCurrency(gesamt, listing.currency)} gesamt
                </Txt>
              )}
            </>
          ) : (
            <Txt v="sm" soft>
              Preis auf Anfrage
            </Txt>
          )}
        </Col>
        <Btn
          variant={buchbar ? "primary" : "ghost"}
          iconR="fwd"
          style={{ flex: 1 }}
          onPress={() => {
            if (!buchbar) return;
            navigation.navigate("Checkout", {
              listingId: listing.id,
              checkIn: von,
              checkOut: bis,
              guests: anzahlGaeste,
            });
          }}
        >
          {buchbar ? "Reservieren" : "Zeitraum wählen"}
        </Btn>
      </Row>
    </View>
  );
}

function Merkmal({ icon, text }: { icon: IconName; text: string }) {
  const t = useTheme();
  return (
    <Row gap={7}>
      <Icon n={icon} s={19} c={t.palette.soft} />
      <Txt v="sm" style={{ fontFamily: t.type.semibold.fontFamily }}>
        {text}
      </Txt>
    </Row>
  );
}

function DatumFeld({
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
      style={{ flex: 1, color: t.palette.ink, fontFamily: t.type.medium.fontFamily, paddingVertical: 8 }}
    />
  );
}

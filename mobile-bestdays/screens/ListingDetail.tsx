// Unterkunft-Detail der GAST-Sicht. Quelle ist der öffentliche booking_engine-
// Slice (/api/v1/booking-engine/listings/{id}) — nicht der tenant-geschützte
// properties-Slice: ein Gast hat keine Tenant-Session und bekäme dort 401/403.
//
// Gezeigt werden ausschließlich echte Felder (Titel, Ort, Gäste, Zimmer,
// Ausstattung, Beschreibung, Fotos, Preis). Ist ein Zeitraum gewählt, liefert
// der Server den EFFEKTIVPREIS dieses Zeitraums (`price` + `nights`) und die
// tagesgenaue Verfügbarkeit; ohne Zeitraum steht der „ab"-Preis. Fehlt ein
// Preis, heißt es „Preis auf Anfrage" — nie 0 (Wurzel 4).
//
// Aufbau wie im Detail der Marktplatz-Apps: seitenbreite Galerie mit Zähler,
// Titelblock, durch Linien getrennte Abschnitte, feste Preisleiste unten.
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DateRangePicker } from "@/components/DateRangePicker";
import { Icon, type IconName } from "@/components/ui/Icon";
import { Btn, Col, Photo, Row, Spinner, Txt } from "@/components/ui/kit";
import { EmptyState, Sheet } from "@/components/ui/patterns";
import { useGuestAuth } from "@/contexts/GuestAuthContext";
import { formatCurrency } from "@/lib/currency";
import { formatZeitraum } from "@/lib/datum";
import { addWishlistItem, createWishlist, listWishlists } from "@/lib/guestWishlist";
import {
  getAvailability,
  getListing,
  listingOrt,
  listingTypeLabel,
  naechte,
  type ListingDetail as ListingDetailTyp,
} from "@/lib/listings";
import {
  KATEGORIEN,
  ladeObjektBewertungen,
  type PropertyReviews,
} from "@/lib/objektBewertungen";
import type { RootStackParamList } from "@/navigation/types";
import { useTheme } from "@/theme/ThemeProvider";

export default function ListingDetail() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "ListingDetail">>();
  const { id } = route.params;
  const { status: gastStatus } = useGuestAuth();

  const [von, setVon] = useState<string | null>(route.params.start ?? null);
  const [bis, setBis] = useState<string | null>(route.params.end ?? null);
  const [gaeste, setGaeste] = useState(route.params.guests ?? 2);
  const [datumOffen, setDatumOffen] = useState(false);

  const [listing, setListing] = useState<ListingDetailTyp | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [frei, setFrei] = useState<boolean | null>(null);
  const [merkStatus, setMerkStatus] = useState<string | null>(null);
  const [merkLaeuft, setMerkLaeuft] = useState(false);
  const [bild, setBild] = useState(0);
  const [bewertungen, setBewertungen] = useState<PropertyReviews | null>(null);

  const zeitraumGueltig = !!von && !!bis && naechte(von, bis) > 0;

  const load = useCallback(async () => {
    setLaedt(true);
    const res = await getListing(id, zeitraumGueltig && von && bis ? { start: von, end: bis } : {});
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

  // Bewertungen einmal je Objekt laden. Beiwerk: schlägt es fehl, entfällt nur
  // der Abschnitt — das Detail bleibt nutzbar.
  useEffect(() => {
    let aktiv = true;
    ladeObjektBewertungen(id).then((res) => {
      if (aktiv && res.ok) setBewertungen(res.data);
    });
    return () => {
      aktiv = false;
    };
  }, [id]);

  // Verfügbarkeit nur prüfen, wenn ein gültiger Zeitraum gewählt ist. Ergebnis
  // ist die Server-Wahrheit (availability + Reservierungen), keine Schätzung.
  useEffect(() => {
    if (!zeitraumGueltig || !von || !bis) {
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

  // Merken: braucht ein Gast-Konto (die Wunschliste hängt an portal_guests).
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
      const neu = await createWishlist("Meine Wunschliste");
      if (!neu.ok) {
        setMerkStatus(neu.error);
        setMerkLaeuft(false);
        return;
      }
      listenId = neu.data.id;
    }
    const res = await addWishlistItem(listenId, id);
    setMerkStatus(res.ok ? "Zur Wunschliste hinzugefügt." : res.error);
    setMerkLaeuft(false);
  };

  if (laedt && !listing) {
    return (
      <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top + 40 }}>
        <Spinner />
      </View>
    );
  }

  if (!listing) {
    return (
      <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
        <Row style={{ paddingHorizontal: 12, paddingVertical: 8 }}>
          <RundKnopf icon="back" onPress={() => navigation.goBack()} />
        </Row>
        <EmptyState
          icon="info"
          titel="Nicht verfügbar"
          text={fehler ?? "Diese Unterkunft ist nicht (mehr) buchbar."}
        />
      </View>
    );
  }

  const ort = listingOrt(listing);
  const nights = zeitraumGueltig && von && bis ? naechte(von, bis) : 0;
  // Preis pro Nacht: mit Zeitraum der Effektivpreis, sonst der „ab"-Preis.
  const proNacht = listing.price ?? listing.price_from;
  const gesamt = proNacht != null && nights > 0 ? proNacht * nights : null;
  const buchbar = zeitraumGueltig && gaeste > 0 && frei === true;
  const zeitraumText = von && bis ? formatZeitraum(von, bis) : null;

  const galerie = listing.photos.length > 0 ? listing.photos : [undefined];

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg }}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 180 }}>
        {/* Galerie: seitenbreit, horizontal blätterbar, mit Zähler. */}
        <View>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e: NativeSyntheticEvent<NativeScrollEvent>) =>
              setBild(Math.round(e.nativeEvent.contentOffset.x / width))
            }
          >
            {galerie.map((foto, i) => (
              <Photo key={foto ?? `platzhalter-${i}`} src={foto} grad="grad1" h={width * 0.82} w={width} />
            ))}
          </ScrollView>

          <Row
            style={{
              position: "absolute",
              top: insets.top + 8,
              left: 16,
              right: 16,
              justifyContent: "space-between",
            }}
          >
            <RundKnopf icon="back" onPress={() => navigation.goBack()} />
            <RundKnopf icon="heart" onPress={merken} />
          </Row>

          {galerie.length > 1 && (
            <View
              style={{
                position: "absolute",
                bottom: 16,
                right: 16,
                paddingHorizontal: 12,
                paddingVertical: 5,
                borderRadius: t.radius.pill,
                backgroundColor: "rgba(0,0,0,0.6)",
              }}
            >
              <Txt v="xs" color="#fff">
                {bild + 1} / {galerie.length}
              </Txt>
            </View>
          )}
        </View>

        <Col style={{ paddingHorizontal: 24, paddingTop: 22, gap: 22 }}>
          <Col gap={6}>
            <Txt v="h1">{listing.title}</Txt>
            <Txt v="body" soft>
              {[listingTypeLabel(listing.property_type), ort].filter(Boolean).join(" · ")}
            </Txt>
            <Txt v="sm" soft>
              {[
                `${listing.max_guests} ${listing.max_guests === 1 ? "Gast" : "Gäste"}`,
                listing.bedrooms != null
                  ? `${listing.bedrooms} ${listing.bedrooms === 1 ? "Schlafzimmer" : "Schlafzimmer"}`
                  : null,
                listing.baths != null ? `${listing.baths} ${listing.baths === 1 ? "Bad" : "Bäder"}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </Txt>
            {typeof listing.rating === "number" && (
              <Row gap={5} style={{ marginTop: 2 }}>
                <Icon n="star" s={14} sw={0} c={t.palette.ink} fill={t.palette.ink} />
                <Txt v="sm" style={{ fontFamily: t.fonts.semibold }}>
                  {listing.rating.toFixed(2).replace(".", ",")}
                </Txt>
                {typeof listing.rating_count === "number" && listing.rating_count > 0 && (
                  <Txt v="sm" soft>
                    · {listing.rating_count} Bewertungen
                  </Txt>
                )}
              </Row>
            )}
          </Col>

          {merkStatus && (
            <Txt v="sm" soft>
              {merkStatus}
            </Txt>
          )}

          <Trennlinie />

          {/* Zeitraum + Gäste (Serverparameter für Preis & Verfügbarkeit) */}
          <Col gap={14}>
            <Txt v="h2">Deine Reise</Txt>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Zeitraum wählen"
              onPress={() => setDatumOffen(true)}
              style={({ pressed }) => ({
                borderWidth: 1,
                borderColor: t.palette.line,
                borderRadius: 14,
                paddingHorizontal: 18,
                paddingVertical: 14,
                opacity: pressed ? 0.7 : 1,
              })}
            >
              <Row style={{ justifyContent: "space-between" }}>
                <Col gap={2}>
                  <Txt v="xs" soft>
                    ZEITRAUM
                  </Txt>
                  <Txt v="body">{zeitraumText ?? "Zeitraum hinzufügen"}</Txt>
                </Col>
                <Icon n="cal" s={20} sw={1.7} c={t.palette.soft} />
              </Row>
            </Pressable>

            <Row
              style={{
                justifyContent: "space-between",
                alignItems: "center",
                borderWidth: 1,
                borderColor: t.palette.line,
                borderRadius: 14,
                paddingHorizontal: 18,
                paddingVertical: 14,
              }}
            >
              <Col gap={2}>
                <Txt v="xs" soft>
                  GÄSTE
                </Txt>
                <Txt v="body">
                  {gaeste} {gaeste === 1 ? "Gast" : "Gäste"}
                </Txt>
              </Col>
              <Row gap={16}>
                <ZaehlerKnopf
                  icon="x"
                  label="Weniger Gäste"
                  disabled={gaeste <= 1}
                  onPress={() => setGaeste((n) => Math.max(1, n - 1))}
                />
                <ZaehlerKnopf
                  icon="plus"
                  label="Mehr Gäste"
                  // Obergrenze ist die Kapazität des Objekts, kein freier Wert.
                  disabled={gaeste >= listing.max_guests}
                  onPress={() => setGaeste((n) => Math.min(listing.max_guests, n + 1))}
                />
              </Row>
            </Row>

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
          </Col>

          {listing.description ? (
            <>
              <Trennlinie />
              <Col gap={10}>
                <Txt v="h2">Über diese Unterkunft</Txt>
                <Txt v="body" soft>
                  {listing.description}
                </Txt>
              </Col>
            </>
          ) : null}

          {listing.amenities.length > 0 && (
            <>
              <Trennlinie />
              <Col gap={12}>
                <Txt v="h2">Das bietet dir diese Unterkunft</Txt>
                <Col gap={0}>
                  {listing.amenities.map((a, i) => (
                    <Row
                      key={a}
                      gap={14}
                      style={{
                        paddingVertical: 13,
                        borderTopWidth: i === 0 ? 0 : 1,
                        borderTopColor: t.palette.line,
                      }}
                    >
                      <Icon n="check" s={19} sw={1.8} c={t.palette.ink} />
                      <Txt v="body" style={{ flex: 1 }}>
                        {a}
                      </Txt>
                    </Row>
                  ))}
                </Col>
              </Col>
            </>
          )}

          {listing.addons.length > 0 && (
            <>
              <Trennlinie />
              <Col gap={12}>
                <Txt v="h2">Zusatzleistungen</Txt>
                <Col gap={0}>
                  {listing.addons.map((a, i) => (
                    <Row
                      key={a.id}
                      style={{
                        justifyContent: "space-between",
                        gap: 14,
                        paddingVertical: 13,
                        borderTopWidth: i === 0 ? 0 : 1,
                        borderTopColor: t.palette.line,
                      }}
                    >
                      <Txt v="body" style={{ flex: 1 }} numberOfLines={1}>
                        {a.name.de ?? a.name.en ?? Object.values(a.name)[0] ?? "—"}
                      </Txt>
                      <Txt v="body" soft>
                        {formatCurrency(a.price, listing.currency)}
                      </Txt>
                    </Row>
                  ))}
                </Col>
              </Col>
            </>
          )}

          {bewertungen && bewertungen.count > 0 && bewertungen.average != null && (
            <>
              <Trennlinie />
              <Col gap={14}>
                <Row gap={6} style={{ alignItems: "center" }}>
                  <Icon n="star" s={16} sw={0} c={t.palette.ink} fill={t.palette.ink} />
                  <Txt v="h2">
                    {bewertungen.average.toFixed(2).replace(".", ",")}
                  </Txt>
                  <Txt v="sm" soft>
                    · {bewertungen.count}{" "}
                    {bewertungen.count === 1 ? "Bewertung" : "Bewertungen"}
                  </Txt>
                </Row>

                {/* Kategorie-Durchschnitte. Fehlt eine Kategorie, entfällt die
                    Zeile — es wird keine 0 gezeichnet (Wurzel 4). */}
                {bewertungen.category_averages && (
                  <Col gap={8}>
                    {KATEGORIEN.map((k) => {
                      const wert = bewertungen.category_averages?.[k.key];
                      if (wert == null) return null;
                      return (
                        <Row key={k.key} gap={10} style={{ alignItems: "center" }}>
                          <Txt v="sm" soft style={{ width: 128 }}>
                            {k.label}
                          </Txt>
                          <View
                            style={{
                              flex: 1,
                              height: 4,
                              borderRadius: 2,
                              backgroundColor: t.palette.surface2,
                              overflow: "hidden",
                            }}
                          >
                            <View
                              style={{
                                width: `${(wert / 5) * 100}%`,
                                height: "100%",
                                backgroundColor: t.palette.ink,
                              }}
                            />
                          </View>
                          <Txt v="sm" style={{ width: 34, textAlign: "right" }}>
                            {wert.toFixed(1).replace(".", ",")}
                          </Txt>
                        </Row>
                      );
                    })}
                  </Col>
                )}

                <Col gap={16}>
                  {bewertungen.reviews.map((r) => (
                    <Col key={r.id} gap={6}>
                      <Txt v="sm" style={{ fontFamily: t.fonts.semibold }}>
                        {r.author ?? "Gast"}
                      </Txt>
                      <Row gap={2}>
                        {[1, 2, 3, 4, 5].map((i) => (
                          <Icon
                            key={i}
                            n="star"
                            s={12}
                            sw={i <= r.rating ? 0 : 1.2}
                            c={i <= r.rating ? t.palette.ink : t.palette.faint}
                            fill={i <= r.rating ? t.palette.ink : undefined}
                          />
                        ))}
                      </Row>
                      {r.text ? <Txt v="sm">{r.text}</Txt> : null}
                      {r.host_reply ? (
                        <View
                          style={{
                            backgroundColor: t.palette.surface2,
                            borderRadius: 12,
                            padding: 10,
                          }}
                        >
                          <Txt v="xs" soft>
                            Antwort des Gastgebers
                          </Txt>
                          <Txt v="sm">{r.host_reply}</Txt>
                        </View>
                      ) : null}
                    </Col>
                  ))}
                </Col>
              </Col>
            </>
          )}
        </Col>
      </ScrollView>

      {/* Feste Preisleiste: Preis nur, wenn das Backend einen liefert. */}
      <Row
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          paddingHorizontal: 24,
          paddingTop: 16,
          paddingBottom: insets.bottom + 16,
          backgroundColor: t.palette.surface,
          borderTopWidth: 1,
          borderTopColor: t.palette.line,
          gap: 16,
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Col gap={2} style={{ flexShrink: 1 }}>
          {proNacht != null ? (
            <>
              <Txt v="body" numberOfLines={1}>
                <Txt v="body" style={{ fontFamily: t.fonts.semibold }}>
                  {formatCurrency(gesamt ?? proNacht, listing.currency)}
                </Txt>
                {gesamt != null ? " gesamt" : " pro Nacht"}
              </Txt>
              {zeitraumText ? (
                <Txt v="xs" soft numberOfLines={1}>
                  {zeitraumText}
                </Txt>
              ) : null}
            </>
          ) : (
            <Txt v="body" soft>
              Preis auf Anfrage
            </Txt>
          )}
        </Col>
        <Btn
          variant={buchbar ? "primary" : "ghost"}
          onPress={() => {
            if (!buchbar || !von || !bis) {
              setDatumOffen(true);
              return;
            }
            navigation.navigate("Checkout", {
              listingId: listing.id,
              checkIn: von,
              checkOut: bis,
              guests: gaeste,
            });
          }}
        >
          {buchbar ? "Reservieren" : "Zeitraum wählen"}
        </Btn>
      </Row>

      <Sheet
        open={datumOffen}
        onClose={() => setDatumOffen(false)}
        full
        header={<Txt v="h2">Zeitraum wählen</Txt>}
      >
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 32 }}>
          <DateRangePicker
            von={von}
            bis={bis}
            onChange={(neuVon, neuBis) => {
              setVon(neuVon);
              setBis(neuBis);
              if (neuVon && neuBis) setDatumOffen(false);
            }}
          />
        </ScrollView>
      </Sheet>
    </View>
  );
}

// --- Bausteine --------------------------------------------------------------

function Trennlinie() {
  const t = useTheme();
  return <View style={{ height: 1, backgroundColor: t.palette.line }} />;
}

function RundKnopf({ icon, onPress }: { icon: IconName; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        {
          width: 38,
          height: 38,
          borderRadius: 19,
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "rgba(255,255,255,0.95)",
          opacity: pressed ? 0.8 : 1,
        },
        t.shadow.sm,
      ]}
    >
      <Icon n={icon} s={19} sw={2} c="#181614" />
    </Pressable>
  );
}

function ZaehlerKnopf({
  icon,
  label,
  disabled,
  onPress,
}: {
  icon: IconName;
  label: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: t.palette.line,
        opacity: disabled ? 0.35 : pressed ? 0.6 : 1,
      })}
    >
      <Icon n={icon} s={15} sw={2} c={t.palette.ink} />
    </Pressable>
  );
}

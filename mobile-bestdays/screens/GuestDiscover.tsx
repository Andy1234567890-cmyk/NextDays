// Gäste · Ergebnisliste der Suche. Zeigt AUSSCHLIESSLICH echte Inserate aus
// dem booking_engine-Slice (/api/v1/booking-engine/listings). Suchtext,
// Gästezahl und Zeitraum gehen als Serverparameter mit; gefiltert wird
// serverseitig (die App filtert nichts nach).
//
// Aufbau wie in den Marktplatz-Apps: oben die Such-Pille mit der aktiven
// Suche (öffnet dieselbe Maske wie die Startseite), darunter die Treffer als
// volle Karten. Preise/Währung kommen aus den Objektdaten; fehlt ein Preis,
// steht dort „Preis auf Anfrage" statt 0 (Wurzel 4).
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ListingCard } from "@/components/ListingCard";
import { SearchSheet, UMKREIS_KM, type SucheWerte } from "@/components/SearchSheet";
import { Col, Spinner, Txt } from "@/components/ui/kit";
import { EmptyState, SearchPill } from "@/components/ui/patterns";
import { formatZeitraum } from "@/lib/datum";
import {
  listingOrt,
  listingStaedte,
  listingTypeLabel,
  searchListings,
  type Listing,
} from "@/lib/listings";
import type { GuestTabParamList, RootStackParamList } from "@/navigation/types";
import { useTheme } from "@/theme/ThemeProvider";

export default function GuestDiscover() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<GuestTabParamList, "Discover">>();

  // Die Startseite reicht ihre Suche über die Route herein.
  const [suche, setSuche] = useState<SucheWerte>({
    ort: route.params?.q ?? "",
    von: route.params?.start ?? null,
    bis: route.params?.end ?? null,
    gaeste: route.params?.guests ?? null,
    umkreis:
      route.params?.lat != null && route.params?.lng != null
        ? { lat: route.params.lat, lng: route.params.lng }
        : null,
  });
  const [suchOffen, setSuchOffen] = useState(false);
  const [items, setItems] = useState<Listing[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  // Auf neue Route-Parameter reagieren (erneute Navigation von der Startseite).
  const params = route.params;
  useEffect(() => {
    if (!params) return;
    setSuche({
      ort: params.q ?? "",
      von: params.start ?? null,
      bis: params.end ?? null,
      gaeste: params.guests ?? null,
      umkreis:
        params.lat != null && params.lng != null ? { lat: params.lat, lng: params.lng } : null,
    });
  }, [params]);

  const load = useCallback(async () => {
    const res = await searchListings({
      q: suche.ort.trim() || undefined,
      guests: suche.gaeste ?? undefined,
      start: suche.von ?? undefined,
      end: suche.bis ?? undefined,
      // lat/lng nur gemeinsam mit dem Radius — der Server lehnt Halbangaben
      // mit 422 ab (und würde sonst weltweit sortieren).
      lat: suche.umkreis?.lat,
      lng: suche.umkreis?.lng,
      radius_km: suche.umkreis ? UMKREIS_KM : undefined,
    });
    if (res.ok) {
      setItems(res.data.items);
      setFehler(null);
    } else {
      setItems(null);
      setFehler(res.error);
    }
  }, [suche]);

  useEffect(() => {
    load();
  }, [load]);

  const staedte = useMemo(() => listingStaedte(items ?? []), [items]);

  const zeitraum = suche.von && suche.bis ? formatZeitraum(suche.von, suche.bis) : null;
  const pillDetail = [
    suche.umkreis ? `Umkreis ${UMKREIS_KM} km` : null,
    zeitraum,
    suche.gaeste ? `${suche.gaeste} ${suche.gaeste === 1 ? "Gast" : "Gäste"}` : null,
    items ? `${items.length} ${items.length === 1 ? "Unterkunft" : "Unterkünfte"}` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg }}>
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingBottom: 12,
          borderBottomWidth: 1,
          borderBottomColor: t.palette.line,
        }}
      >
        <SearchPill
          label={suche.ort.trim() || (suche.umkreis ? "In der Nähe" : "Überall suchen")}
          detail={pillDetail || null}
          onPress={() => setSuchOffen(true)}
        />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 20, paddingBottom: 32, gap: 28 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
      >
        {!items && !fehler && <Spinner />}

        {fehler && <EmptyState icon="info" titel="Suche fehlgeschlagen" text={fehler} />}

        {items && items.length === 0 && !fehler && (
          <EmptyState
            icon="search"
            titel="Keine Treffer"
            text="Für diese Suche ist nichts frei. Ändere Reiseziel, Zeitraum oder Gästezahl."
          />
        )}

        {items?.map((l) => (
          <ListingCard
            key={l.id}
            photo={l.photos[0]}
            tag={listingTypeLabel(l.property_type)}
            title={l.title}
            place={listingOrt(l) || null}
            meta={typeof l.max_guests === "number" ? `bis ${l.max_guests} Gäste` : null}
            rating={l.rating}
            price={l.price_from}
            currency={l.currency}
            priceLabel="pro Nacht"
            onPress={() =>
              navigation.navigate("ListingDetail", {
                id: l.id,
                start: suche.von ?? undefined,
                end: suche.bis ?? undefined,
                guests: suche.gaeste ?? undefined,
              })
            }
          />
        ))}

        {items && items.length > 0 && (
          <Col gap={4} style={{ paddingVertical: 8 }}>
            <Txt v="xs" soft style={{ textAlign: "center" }}>
              {suche.von && suche.bis
                ? "Nur Unterkünfte, die im gewählten Zeitraum frei sind."
                : "Wähle einen Zeitraum, um nur freie Unterkünfte zu sehen."}
            </Txt>
          </Col>
        )}
      </ScrollView>

      <SearchSheet
        open={suchOffen}
        onClose={() => setSuchOffen(false)}
        werte={suche}
        onSubmit={(w) => {
          setSuche(w);
          setSuchOffen(false);
        }}
        vorschlaege={staedte}
        // Auf der Ergebnisliste gibt es keine Kategorie-Umschaltung — die
        // Reiterleiste bleibt hier leer statt eine Auswahl vorzutäuschen.
        tabs={[]}
        tab=""
        onTabChange={() => undefined}
      />
    </View>
  );
}

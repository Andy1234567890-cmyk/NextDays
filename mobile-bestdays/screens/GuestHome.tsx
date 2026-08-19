// Gäste · Startseite. Aufbau nach dem Marktplatz-Muster der Referenz-Apps:
// klebende Kopfzeile mit Such-Pille und Kategorie-Reitern, darunter Sektionen
// mit horizontalen Kachel-Karussells.
//
// Alle Inhalte stammen aus echten Inseraten des booking_engine-Slices
// (/api/v1/booking-engine/listings). Es werden KEINE Kategorien, Reiseziele,
// Preise oder Bewertungen erfunden — was das Backend nicht liefert, wird nicht
// gezeigt (Wurzel 4). Die Reiter entstehen aus den vorhandenen Objektarten,
// nicht aus einer festen Wunschliste.
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, useWindowDimensions, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ListingCard } from "@/components/ListingCard";
import { LEERE_SUCHE, SearchSheet, type SucheWerte } from "@/components/SearchSheet";
import { Col, Spinner, Txt } from "@/components/ui/kit";
import {
  Carousel,
  CategoryTabs,
  EmptyState,
  SearchPill,
  SectionHeader,
  type CategoryTab,
} from "@/components/ui/patterns";
import { formatZeitraum } from "@/lib/datum";
import {
  filterKategorie,
  listingKategorie,
  listingOrt,
  listingRows,
  listingStaedte,
  searchListings,
  type Kategorie,
  type Listing,
} from "@/lib/listings";
import type { GuestTabParamList, RootStackParamList } from "@/navigation/types";
import { useTheme } from "@/theme/ThemeProvider";

type Nav = NativeStackNavigationProp<RootStackParamList & GuestTabParamList>;

// Kachelbreite im Karussell als ANTEIL der Bildschirmbreite — dieselbe
// Staffelung wie im mobilen Web (`plattform/components/listing-reihe.tsx`):
// 43 % ergeben ZWEI vollständige Karten plus den Anschnitt der dritten, und der
// Anschnitt sagt dem Gast, dass es seitlich weitergeht.
//
// Vorher stand hier eine feste Breite von 220 pt. Auf einem 393-pt-Telefon sind
// das 56 % der Zeile: eine Karte füllte sie fast allein, pro Wisch sah man ein
// Objekt, und auf kleinen Geräten (SE, 320 pt) ragte sie über den Rand hinaus.
const KACHEL_ANTEIL = 0.43;

export default function GuestHome() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();
  // useWindowDimensions statt Dimensions.get: die Breite ändert sich beim
  // Drehen und auf dem iPad im Splitview.
  const { width: schirmBreite } = useWindowDimensions();
  const kachelBreite = Math.round(schirmBreite * KACHEL_ANTEIL);

  const [alle, setAlle] = useState<Listing[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [kategorie, setKategorie] = useState<Kategorie>("alle");
  const [suchOffen, setSuchOffen] = useState(false);
  const [suche, setSuche] = useState<SucheWerte>(LEERE_SUCHE);

  const load = useCallback(async () => {
    const res = await searchListings();
    if (res.ok) {
      setAlle(res.data.items);
      setFehler(null);
    } else {
      setAlle(null);
      setFehler(res.error);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Reiter nur für Kategorien, die es wirklich gibt. Bleibt nur eine übrig,
  // entfällt die Reiterleiste ganz — ein einzelner Reiter wäre Dekoration.
  const tabs = useMemo<CategoryTab[]>(() => {
    if (!alle || alle.length === 0) return [];
    const vorhanden = new Set(alle.map(listingKategorie));
    if (vorhanden.size < 2) return [];
    const liste: CategoryTab[] = [{ key: "alle", label: "Alle", icon: "grid" }];
    if (vorhanden.has("ferienobjekte")) {
      liste.push({ key: "ferienobjekte", label: "Ferienobjekte", icon: "home" });
    }
    if (vorhanden.has("zimmer")) liste.push({ key: "zimmer", label: "Zimmer", icon: "bed" });
    return liste;
  }, [alle]);

  const staedte = useMemo(() => listingStaedte(alle ?? []), [alle]);
  const reihen = useMemo(
    () => (alle ? listingRows(filterKategorie(alle, kategorie)) : []),
    [alle, kategorie],
  );

  const zeitraum = suche.von && suche.bis ? formatZeitraum(suche.von, suche.bis) : null;
  const pillDetail = [zeitraum, suche.gaeste ? `${suche.gaeste} Gäste` : null]
    .filter(Boolean)
    .join(" · ");

  const oeffneSuche = (werte: SucheWerte) => {
    setSuche(werte);
    setSuchOffen(false);
    navigation.navigate("Discover", {
      q: werte.ort.trim() || undefined,
      start: werte.von ?? undefined,
      end: werte.bis ?? undefined,
      guests: werte.gaeste ?? undefined,
      lat: werte.umkreis?.lat,
      lng: werte.umkreis?.lng,
    });
  };

  // Der Pfeil einer Sektion sucht nach deren Begriff — dabei fällt ein zuvor
  // gesetzter Umkreis weg, sonst schnitten sich Ortsname und Position.
  const zeigeReihe = (begriff: string | null) =>
    navigation.navigate("Discover", {
      q: begriff ?? undefined,
      start: suche.von ?? undefined,
      end: suche.bis ?? undefined,
      guests: suche.gaeste ?? undefined,
    });

  const openListing = (id: string) =>
    navigation.navigate("ListingDetail", {
      id,
      start: suche.von ?? undefined,
      end: suche.bis ?? undefined,
      guests: suche.gaeste ?? undefined,
    });

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg }}>
      {/* Kopfzeile: Such-Pille + Kategorie-Reiter, mit Trennkante zum Inhalt. */}
      <View
        style={{
          paddingTop: insets.top + 8,
          paddingBottom: tabs.length > 0 ? 0 : 12,
          backgroundColor: t.palette.bg,
          borderBottomWidth: 1,
          borderBottomColor: t.palette.line,
        }}
      >
        <SearchPill
          label={suche.ort.trim() || (suche.umkreis ? "In der Nähe" : "Jetzt suchen")}
          detail={pillDetail || null}
          onPress={() => setSuchOffen(true)}
        />
        {tabs.length > 0 && (
          <CategoryTabs
            tabs={tabs}
            value={kategorie}
            onChange={(k) => setKategorie(k as Kategorie)}
            style={{ marginTop: 14 }}
          />
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: 20, paddingBottom: 32, gap: 34 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
      >
        {!alle && !fehler && <Spinner />}

        {fehler && (
          <EmptyState icon="info" titel="Unterkünfte nicht geladen" text={fehler} />
        )}

        {alle && !fehler && reihen.length === 0 && (
          <EmptyState
            icon="home"
            titel="Noch keine Unterkünfte"
            text="Aktuell ist in dieser Kategorie nichts buchbar."
          />
        )}

        {reihen.map((reihe) => (
          <Col key={reihe.titel} gap={14}>
            <SectionHeader
              title={reihe.titel}
              onPress={() => zeigeReihe(reihe.suche)}
              style={{ paddingHorizontal: 16 }}
            />
            <Carousel>
              {reihe.listings.map((l) => (
                <ListingCard
                  key={`${reihe.titel}-${l.id}`}
                  width={kachelBreite}
                  photo={l.photos[0]}
                  title={l.title}
                  place={listingOrt(l) || null}
                  rating={l.rating}
                  price={l.price_from}
                  currency={l.currency}
                  priceLabel="pro Nacht"
                  onPress={() => openListing(l.id)}
                />
              ))}
            </Carousel>
          </Col>
        ))}

        {alle && alle.length > 0 && (
          <Txt v="xs" soft style={{ textAlign: "center", paddingHorizontal: 24 }}>
            Alle Preise stammen aus den hinterlegten Raten der Gastgeber.
          </Txt>
        )}
      </ScrollView>

      <SearchSheet
        open={suchOffen}
        onClose={() => setSuchOffen(false)}
        werte={suche}
        onSubmit={oeffneSuche}
        vorschlaege={staedte}
        tabs={tabs}
        tab={kategorie}
        onTabChange={(k) => setKategorie(k as Kategorie)}
      />
    </View>
  );
}

// Reservierungs-Detail: Gast, Objekt, Aufenthalt, Herkunft, Beträge, Notiz.
//
// Maskierungskonform (§4.2): total_amount/paid_amount/due_amount null → „—"
// (nie 0). Die App füllt maskierte Felder NICHT auf und rechnet auch nichts
// daraus — ohne Beträge entfällt der ganze Betragsblock, statt „0 €" zu zeigen.
//
// Statuswerte und Kanäle werden ÜBERSETZT dargestellt (`Abgeschlossen`,
// `myBestDays`) — nie der rohe Enum-Wert aus der Antwort. Die Labels sind
// dieselben wie in der Buchungsliste, damit ein Status in der App überall
// gleich heißt und gleich aussieht.
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, type IconName } from "@/components/ui/Icon";
import { Avatar, Card, Col, Divider, Photo, Progress, Row, Spinner, Txt } from "@/components/ui/kit";
import { EmptyState } from "@/components/ui/patterns";
import { KanalMarke } from "@/components/KanalMarke";
import { channelMeta } from "@/lib/calendar-channels";
import { formatCurrency } from "@/lib/currency";
import { getProperty, type Property } from "@/lib/properties";
import { portalLabel } from "@/lib/portal-logos";
import {
  getReservationDetail,
  type ReservationDetail as Detail,
  type ReservationStatus,
} from "@/lib/reservations";
import type { RootStackParamList } from "@/navigation/types";
import { useTheme } from "@/theme/ThemeProvider";

const WOCHENTAGE = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const MONATE = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

const STATUS_LABEL: Record<ReservationStatus, string> = {
  pending: "Angefragt",
  confirmed: "Bestätigt",
  cancelled: "Storniert",
  completed: "Abgeschlossen",
};

const STATUS_TONE: Record<ReservationStatus, { bg: string; fg: string }> = {
  confirmed: { bg: "#E6F4EA", fg: "#1E7A46" },
  completed: { bg: "#E6F4EA", fg: "#1E7A46" },
  pending: { bg: "#FCF0DA", fg: "#9A6B12" },
  cancelled: { bg: "#FBE4E4", fg: "#B02A2A" },
};

function tagTeile(iso: string): { wochentag: string; tag: string; monat: string } {
  const [y, m, d] = iso.split("-").map(Number);
  // UTC-Konstruktion: die Werte sind Kalendertage ohne Zeitzone.
  const wt = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return { wochentag: WOCHENTAGE[wt], tag: String(d), monat: MONATE[m - 1] };
}

// Betrag maskierungskonform: null → „—" (nie 0). Währung aus den Daten.
function betrag(wert: number | null, waehrung: string): string {
  return wert != null ? formatCurrency(wert, waehrung) : "—";
}

export default function ReservationDetail() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "ReservationDetail">>();
  const { id } = route.params;
  const zurueck = useZurueck(navigation);

  const [detail, setDetail] = useState<Detail | null>(null);
  const [objekt, setObjekt] = useState<Property | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await getReservationDetail(id);
    if (res.ok) {
      setDetail(res.data);
      setError(null);
      // Das Objektfoto liegt nicht im Reservierungs-Contract — es kommt aus
      // dem properties-Slice. Schlägt das fehl, bleibt der Kopf ohne Bild;
      // die Reservierung selbst wird deswegen NICHT als Fehler dargestellt.
      const prop = await getProperty(res.data.property_id);
      setObjekt(prop.ok ? prop.data : null);
    } else {
      setError(res.error);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top + 40 }}>
        <Spinner />
      </View>
    );
  }

  if (!detail) {
    return (
      <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
        <Row style={{ paddingHorizontal: 12, paddingVertical: 8 }}>
          <ZurueckKnopf onPress={zurueck} />
        </Row>
        <EmptyState icon="info" titel="Nicht gefunden" text={error ?? "Reservierung nicht gefunden."} />
      </View>
    );
  }

  const ort = [detail.property_city, detail.property_country].filter(Boolean).join(", ");
  const kanal = channelMeta(detail.channel);
  const herkunft = portalLabel(detail.ota_name) || kanal.label;
  const ton = STATUS_TONE[detail.status];
  const an = tagTeile(detail.check_in);
  const ab = tagTeile(detail.check_out);
  // Beträge nur zeigen, wenn der Nutzer sie sehen DARF. Ohne Betrags-Sicht ist
  // total_amount null — dann entfällt der Block ganz (kein „—"-Formular).
  // Ein Eigentümer-Aufenthalt hat per Definition keine Beträge (Migration
  // 0241). Statt einer Karte voller Nullen steht dort die Einordnung.
  const zeigeBetraege = detail.total_amount != null && !detail.is_owner_stay;
  const anteilBezahlt =
    detail.total_amount && detail.paid_amount != null && detail.total_amount > 0
      ? Math.min(100, Math.round((detail.paid_amount / detail.total_amount) * 100))
      : 0;

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg }}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Kopf: Objektfoto als Bühne. Ein Detail ohne jedes Bild wirkt wie ein
            Formular — das Foto verankert, um WELCHES Objekt es geht. */}
        <View>
          <Photo src={objekt?.photos?.[0]} grad="grad1" h={200} />
          <View
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              height: 96,
              backgroundColor: "rgba(0,0,0,0.35)",
            }}
          />
          <View style={{ position: "absolute", top: insets.top + 6, left: 12 }}>
            <ZurueckKnopf onPress={zurueck} aufFoto />
          </View>
          <Col gap={2} style={{ position: "absolute", left: 20, right: 20, bottom: 14 }}>
            <Pressable
              accessibilityRole="button"
              onPress={() => navigation.navigate("PropertyDetail", { id: detail.property_id })}
              style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
            >
              <Row gap={6} style={{ alignItems: "center" }}>
                <Txt v="title" color="#FFFFFF" numberOfLines={1} style={{ flex: 1 }}>
                  {detail.property_title}
                </Txt>
                <Icon n="fwd" s={15} sw={2} c="#FFFFFF" />
              </Row>
            </Pressable>
            {ort ? (
              <Txt v="xs" color="rgba(255,255,255,0.85)" numberOfLines={1}>
                {ort}
              </Txt>
            ) : null}
          </Col>
        </View>

        <Col gap={20} style={{ paddingHorizontal: 24, paddingTop: 20 }}>
          {/* Gast + Status */}
          <Row gap={14} style={{ alignItems: "center" }}>
            <View>
              <Avatar s={52} icon="user" />
              <View style={{ position: "absolute", right: -8, bottom: -4 }}>
                <KanalMarke channel={detail.channel} hoehe={20} randfarbe={t.palette.bg} />
              </View>
            </View>
            <Col gap={3} style={{ flex: 1 }}>
              <Txt v="h1" numberOfLines={1}>
                {detail.guest_name || "Gast"}
              </Txt>
              <Txt v="sm" soft numberOfLines={1}>
                {herkunft}
                {detail.external_ref ? ` · ${detail.external_ref}` : ""}
              </Txt>
            </Col>
            <View
              style={{
                paddingHorizontal: 11,
                paddingVertical: 5,
                borderRadius: t.radius.pill,
                backgroundColor: ton.bg,
              }}
            >
              <Txt v="xs" color={ton.fg} style={{ fontFamily: t.fonts.semibold }}>
                {STATUS_LABEL[detail.status]}
              </Txt>
            </View>
          </Row>

          {/* Aufenthalt: An- und Abreise gegenübergestellt, dazwischen die
              Nächte. Zwei Datumsangaben in einer Zeile sind schwerer zu lesen
              als zwei Blöcke mit Wochentag. */}
          <Card style={{ padding: 18 }}>
            <Row style={{ alignItems: "center" }}>
              <Datumsblock titel="Anreise" teile={an} zeit={detail.checkin_time} />
              <Col gap={4} style={{ alignItems: "center", paddingHorizontal: 8 }}>
                <Icon n="fwd" s={16} sw={2} c={t.palette.faint} />
                <Txt v="xs" soft>
                  {detail.nights} {detail.nights === 1 ? "Nacht" : "Nächte"}
                </Txt>
              </Col>
              <Datumsblock titel="Abreise" teile={ab} zeit={detail.checkout_time} rechts />
            </Row>
            <Divider style={{ marginVertical: 16 }} />
            <Row gap={20} style={{ flexWrap: "wrap" }}>
              <Kennzahl icon="users" text={gaesteText(detail)} />
              {detail.pets > 0 ? (
                <Kennzahl icon="hand" text={`${detail.pets} ${detail.pets === 1 ? "Haustier" : "Haustiere"}`} />
              ) : null}
            </Row>
          </Card>

          {/* Beträge: der offene Rest ist die Zahl, die zählt — deshalb steht
              er groß, der Rest als Aufschlüsselung darunter. */}
          {zeigeBetraege && (
            <Card style={{ padding: 18 }}>
              <Col gap={14}>
                <Row style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
                  <Col gap={3}>
                    <Txt v="xs" soft>
                      Offen
                    </Txt>
                    <Txt v="h1">{betrag(detail.due_amount, detail.currency)}</Txt>
                  </Col>
                  <Col gap={3} style={{ alignItems: "flex-end" }}>
                    <Txt v="xs" soft>
                      Gesamt
                    </Txt>
                    <Txt v="title">{betrag(detail.total_amount, detail.currency)}</Txt>
                  </Col>
                </Row>
                <Progress pct={anteilBezahlt} />
                <Txt v="xs" soft>
                  {betrag(detail.paid_amount, detail.currency)} bezahlt · {anteilBezahlt} %
                </Txt>

                {detail.quote_items.length > 0 && (
                  <>
                    <Divider />
                    <Col gap={9}>
                      {detail.quote_items.map((z, i) => (
                        <Row key={`${z.label}-${i}`} style={{ justifyContent: "space-between" }}>
                          <Txt v="sm" soft style={{ flex: 1 }} numberOfLines={1}>
                            {z.label}
                          </Txt>
                          <Txt v="sm">{formatCurrency(z.amount, detail.currency)}</Txt>
                        </Row>
                      ))}
                    </Col>
                  </>
                )}
              </Col>
            </Card>
          )}

          {detail.is_owner_stay ? (
            <Card style={{ padding: 18 }}>
              <Row gap={10} style={{ alignItems: "center" }}>
                <Icon n="home" s={18} sw={1.8} c={t.palette.soft} />
                <Col gap={2} style={{ flex: 1 }}>
                  <Txt v="title">Eigentümer-Aufenthalt</Txt>
                  <Txt v="sm" soft>
                    Kein Umsatz — weder Rechnung noch Provision, nicht in der
                    Eigentümer-Abrechnung.
                  </Txt>
                </Col>
              </Row>
            </Card>
          ) : null}

          {detail.note ? (
            <Card style={{ padding: 18 }}>
              <Col gap={8}>
                <Row gap={7} style={{ alignItems: "center" }}>
                  <Icon n="doc" s={15} sw={1.8} c={t.palette.soft} />
                  <Txt v="sm" soft>
                    Notiz
                  </Txt>
                </Row>
                <Txt v="body">{detail.note}</Txt>
              </Col>
            </Card>
          ) : null}
        </Col>
      </ScrollView>
    </View>
  );
}

function gaesteText(d: Detail): string {
  const teile = [`${d.adults} ${d.adults === 1 ? "Erwachsener" : "Erwachsene"}`];
  if (d.children > 0) teile.push(`${d.children} ${d.children === 1 ? "Kind" : "Kinder"}`);
  if (d.infants > 0) teile.push(`${d.infants} ${d.infants === 1 ? "Baby" : "Babys"}`);
  return teile.join(" · ");
}

// --- Bausteine --------------------------------------------------------------

function Datumsblock({
  titel,
  teile,
  zeit,
  rechts,
}: {
  titel: string;
  teile: { wochentag: string; tag: string; monat: string };
  zeit?: string | null;
  rechts?: boolean;
}) {
  return (
    <Col gap={3} style={{ flex: 1, alignItems: rechts ? "flex-end" : "flex-start" }}>
      <Txt v="xs" soft>
        {titel}
      </Txt>
      <Txt v="h2">
        {teile.tag}. {teile.monat}
      </Txt>
      <Txt v="xs" soft>
        {teile.wochentag}
        {/* Uhrzeit nur, wenn sie hinterlegt ist — keine erfundene Standardzeit. */}
        {zeit ? ` · ${zeit}` : ""}
      </Txt>
    </Col>
  );
}

function Kennzahl({ icon, text }: { icon: IconName; text: string }) {
  const t = useTheme();
  return (
    <Row gap={8} style={{ alignItems: "center" }}>
      <Icon n={icon} s={16} sw={1.8} c={t.palette.soft} />
      <Txt v="sm">{text}</Txt>
    </Row>
  );
}

// Zurück. Über einen Deep-Link ist dieser Screen der EINZIGE im Stack — dann
// gibt es kein „zurück", und React Navigation meldet „GO_BACK was not handled".
// In dem Fall führt der Knopf ins Erlebnis statt ins Leere.
function useZurueck(navigation: NativeStackNavigationProp<RootStackParamList>) {
  return useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate("HostTabs", { screen: "Reservations" });
  }, [navigation]);
}

function ZurueckKnopf({ onPress, aufFoto }: { onPress: () => void; aufFoto?: boolean }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Zurück"
      onPress={onPress}
      hitSlop={10}
      style={({ pressed }) => ({
        opacity: pressed ? 0.6 : 1,
        ...(aufFoto
          ? {
              width: 36,
              height: 36,
              borderRadius: 18,
              backgroundColor: "rgba(255,255,255,0.92)",
              alignItems: "center",
              justifyContent: "center",
            }
          : { padding: 8 }),
      })}
    >
      <Icon n="back" s={20} sw={2} c={t.palette.ink} />
    </Pressable>
  );
}

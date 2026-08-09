// Gastgeber · Übersicht. Echte KPIs + heutige An-/Abreisen + Anstehendes aus
// GET /api/v1/reservations/dashboard (dieselbe Quelle wie das Web-Dashboard).
// Lade-/Fehler-/Leerzustand getrennt. KEIN Demo-Fallback: eine Übersicht mit
// lauter Nullen ist von einem echten ruhigen Tag nicht zu unterscheiden und
// gibt dem Gastgeber falsche Sicherheit über seinen Betrieb (Wurzel 4). Ist das
// Backend nicht erreichbar, steht das da — mit Wiederholen.
// Beträge/Währung aus den Daten (§4.2: revenue_30d = null → keine Umsatz-Kachel).
//
// Der Screen zeigt ALLE Felder, die der Endpoint liefert: bis Juli 2026 fielen
// `checkins_30d` sowie Kanal, Status und der zweite Datumswert jeder Zeile
// stillschweigend unter den Tisch — die Übersicht wirkte leer, obwohl die
// Antwort voll war.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Image, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, type IconName } from "@/components/ui/Icon";
import { Avatar, Btn, Card, Col, Divider, Row, Spinner, Txt } from "@/components/ui/kit";
import { EmptyState } from "@/components/ui/patterns";
import { KanalMarke } from "@/components/KanalMarke";
import { useAuth } from "@/contexts/AuthContext";
import { channelMeta } from "@/lib/calendar-channels";
import { formatCurrency } from "@/lib/currency";
import { getDashboard, type Dashboard, type DashboardEntry } from "@/lib/dashboard";
import type { ReservationStatus } from "@/lib/reservations";
import { useRealtime } from "@/lib/realtime";
import { portalLabel } from "@/lib/portal-logos";
import { useTheme } from "@/theme/ThemeProvider";

// Wie viele Zeilen je Block direkt sichtbar sind. „Anstehend" umfasst beim
// echten Betrieb dreistellig viele Buchungen — die alle in eine ScrollView zu
// rendern ist weder lesbar noch flüssig. Der Rest führt in die Buchungsliste.
const MAX_ZEILEN = 5;

const MONATE = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

const STATUS_LABEL: Record<ReservationStatus, string> = {
  pending: "Angefragt",
  confirmed: "Bestätigt",
  cancelled: "Storniert",
  completed: "Abgeschlossen",
};

// Status → Badge-Farbe, identisch zur Buchungsliste (ein Statusbild in der App).
const STATUS_TONE: Record<ReservationStatus, { bg: string; fg: string }> = {
  confirmed: { bg: "#E6F4EA", fg: "#1E7A46" },
  completed: { bg: "#E6F4EA", fg: "#1E7A46" },
  pending: { bg: "#FCF0DA", fg: "#9A6B12" },
  cancelled: { bg: "#FBE4E4", fg: "#B02A2A" },
};

function tagKurz(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${Number(d)}. ${MONATE[Number(m) - 1]}`;
}

function heuteLabel(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

// Nächte aus den beiden ISO-Tagen. Reine UTC-Rechnung: die Daten sind Kalender-
// tage ohne Zeitzone, `new Date("2026-08-01")` ist bereits UTC-Mitternacht.
function naechte(inIso: string, outIso: string): number {
  const ms = Date.parse(outIso) - Date.parse(inIso);
  return Math.max(0, Math.round(ms / 86_400_000));
}

export default function HostDashboard({ navigation }: { navigation: any }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { me } = useAuth();
  const [data, setData] = useState<Dashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await getDashboard();
    if (res.ok) {
      setData(res.data);
      setError(null);
    } else {
      // Kein Ersatzdatensatz: sonst zeigt die App „0 Buchungen" für einen
      // Betrieb, dessen Zahlen sie schlicht nicht kennt.
      setData(null);
      setError(res.error);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime: Buchungsänderungen → KPIs/Listen debounced neu laden (400ms wie
  // Web). reservations speist alle Zahlen dieser Übersicht.
  useRealtime({ table: "reservations", onChange: load });

  const zuBuchungen = useCallback(() => navigation.navigate("Reservations"), [navigation]);
  const zurBuchung = useCallback(
    (id: string) => navigation.navigate("ReservationDetail", { id }),
    [navigation],
  );

  // Anstehendes wird chronologisch erwartet, nicht in Antwortreihenfolge —
  // sonst steht in „die nächsten fünf" irgendetwas aus dem Herbst.
  const anstehend = useMemo(
    () => [...(data?.upcoming ?? [])].sort((a, b) => a.check_in.localeCompare(b.check_in)),
    [data],
  );

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top + 12 }}>
        <EmptyState icon="info" titel="Übersicht nicht geladen" text={error}>
          <Btn variant="outline" onPress={load} style={{ marginTop: 6 }}>
            Erneut versuchen
          </Btn>
        </EmptyState>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top + 40 }}>
        <Spinner />
      </View>
    );
  }

  const revenue = data.revenue_30d;

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg }}>
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 24,
          // Echte Safe-Area statt hartkodierter 60 — sonst rutscht die
          // Titelzeile unter Notch/Dynamic Island (gerätabhängig).
          paddingTop: insets.top + 12,
          gap: 22,
          paddingBottom: insets.bottom + 40,
        }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Markenkopf: die App ist die myNextDays-App, das gehört auf die
            Startseite. Logo und Name kommen aus theme/marke.ts — kein
            Bild-require und kein Markenname im Screen (ADR-0019). */}
        <Col gap={14}>
          <Row style={{ alignItems: "center", justifyContent: "space-between" }}>
            <Image
              source={t.marke.logo}
              style={{ height: 26, width: 26 * 3.87 }}
              resizeMode="contain"
              accessibilityLabel={t.marke.name}
            />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Konto"
              onPress={() => navigation.navigate("HostProfile")}
              hitSlop={10}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            >
              <Avatar s={34} icon="user" />
            </Pressable>
          </Row>
          <Col gap={4}>
            <Txt v="display">Übersicht</Txt>
            <Txt v="body" soft numberOfLines={1}>
              {[heuteLabel(data.today), me?.email].filter(Boolean).join(" · ")}
            </Txt>
          </Col>
        </Col>

        {/* Drei Kennzahlen, EIN Bauplan: gleiche Kachel, gleiche Schriftgröße,
            gleicher Innenabstand. Der Umsatz steht oben und über die volle
            Breite, weil ein formatierter Betrag nicht in eine Drittelspalte
            passt — nicht, weil er größer gesetzt wäre. Fehlt die
            Betrags-Sicht (§4.2), entfällt die Kachel ersatzlos (kein 0-Betrag). */}
        {/* Der Zeitraum gilt für alle drei Kennzahlen — einmal genannt statt
            dreimal in Labels, die dann abgeschnitten werden. */}
        <Col gap={12}>
          <Txt v="eyebrow" soft>
            Letzte 30 Tage
          </Txt>

          {revenue && (
            <KpiKarte
              icon="euro"
              wert={formatCurrency(revenue.value, data.currency)}
              label="Umsatz"
              change={revenue.change_pct}
            />
          )}

        {/* alignItems: "stretch" hebt die Zentrierung aus `Row` auf — sonst wird
            die Kachel ohne Trend-Zeile kürzer als ihre Nachbarin. */}
          <Row gap={12} style={{ alignItems: "stretch" }}>
            <KpiKarte
              icon="key"
              wert={`${Math.round(data.checkins_30d.value)}`}
              label="Check-ins"
              change={data.checkins_30d.change_pct}
            />
            <KpiKarte
              icon="check"
              wert={`${Math.round(data.confirmed_30d.value)}`}
              label="Bestätigt"
              change={data.confirmed_30d.change_pct}
            />
          </Row>
        </Col>

        <Block
          titel="Heute · Anreisen"
          icon="key"
          eintraege={data.checkins_today}
          leer="Heute reist niemand an."
          datumsfeld="check_in"
          onZeile={zurBuchung}
        />
        <Block
          titel="Heute · Abreisen"
          icon="logout"
          eintraege={data.checkouts_today}
          leer="Heute reist niemand ab."
          datumsfeld="check_out"
          onZeile={zurBuchung}
        />
        <Block
          titel="Anstehend"
          icon="cal"
          eintraege={anstehend}
          leer="Nichts Anstehendes."
          datumsfeld="check_in"
          onZeile={zurBuchung}
          onAlle={zuBuchungen}
        />
      </ScrollView>
    </View>
  );
}

// Kennzahl-Kachel — EIN Bauplan für alle drei. `flex: 1` greift nur, wenn sie
// in einer Row steht (die beiden unteren); über die volle Breite (Umsatz) hat
// es keine Wirkung. So sehen alle Kennzahlen gleich aus, egal wo sie stehen.
function KpiKarte({
  icon,
  wert,
  label,
  change,
}: {
  icon: IconName;
  wert: string;
  label: string;
  change: number | null;
}) {
  const t = useTheme();
  return (
    <Card style={{ flex: 1, padding: 16 }}>
      <Col gap={6}>
        <Row gap={6} style={{ alignItems: "center" }}>
          <Icon n={icon} s={15} sw={1.8} c={t.palette.soft} />
          <Txt v="xs" soft numberOfLines={1} style={{ flex: 1 }}>
            {label}
          </Txt>
        </Row>
        <Txt v="h1" numberOfLines={1}>
          {wert}
        </Txt>
        <Trend change={change} />
      </Col>
    </Card>
  );
}

// Vergleich zur Vorperiode. `null` heißt: es GIBT keine Vorperiode — dann steht
// hier nichts statt eines erfundenen 0-%-Werts (Wurzel 4).
function Trend({ change }: { change: number | null }) {
  const t = useTheme();
  if (change === null) return null;
  const rauf = change >= 0;
  return (
    <Row gap={4} style={{ alignItems: "center" }}>
      {/* Icon kennt keine style-Prop — das Drehen für „abwärts" passiert im
          umschließenden View. */}
      <View style={rauf ? undefined : { transform: [{ rotate: "180deg" }] }}>
        <Icon n="arrowup" s={12} sw={2.2} c={rauf ? "#1F8A5B" : t.palette.accent} />
      </View>
      <Txt v="xs" color={rauf ? "#1F8A5B" : t.palette.accent}>
        {Math.abs(Math.round(change))} % zur Vorperiode
      </Txt>
    </Row>
  );
}

function Block({
  titel,
  icon,
  eintraege,
  leer,
  datumsfeld,
  onZeile,
  onAlle,
}: {
  titel: string;
  icon: IconName;
  eintraege: DashboardEntry[];
  leer: string;
  datumsfeld: "check_in" | "check_out";
  onZeile: (id: string) => void;
  onAlle?: () => void;
}) {
  const t = useTheme();
  const sichtbar = eintraege.slice(0, MAX_ZEILEN);
  const rest = eintraege.length - sichtbar.length;

  return (
    <Col gap={12}>
      <Row gap={8} style={{ alignItems: "center" }}>
        <Icon n={icon} s={18} sw={1.8} c={t.palette.ink} />
        <Txt v="h2" style={{ flex: 1 }}>
          {titel}
        </Txt>
        {/* Die Anzahl gehört in die Überschrift: sonst sieht der Block mit 5
            gezeigten Zeilen aus wie „5", obwohl 172 anstehen. */}
        <Txt v="sm" soft>
          {eintraege.length}
        </Txt>
      </Row>

      {eintraege.length === 0 ? (
        <Txt v="body" soft>
          {leer}
        </Txt>
      ) : (
        <Card>
          {sichtbar.map((e, i) => (
            <View key={e.reservation_id}>
              {i > 0 && <Divider />}
              <Zeile eintrag={e} datumsfeld={datumsfeld} onPress={() => onZeile(e.reservation_id)} />
            </View>
          ))}
          {rest > 0 && onAlle && (
            <>
              <Divider />
              <Pressable
                accessibilityRole="button"
                onPress={onAlle}
                style={({ pressed }) => ({
                  paddingVertical: 14,
                  paddingHorizontal: 16,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Row gap={6} style={{ alignItems: "center", justifyContent: "center" }}>
                  <Txt v="sm" style={{ fontFamily: t.fonts.semibold }}>
                    Weitere {rest} in den Buchungen
                  </Txt>
                  <Icon n="fwd" s={14} sw={2} c={t.palette.ink} />
                </Row>
              </Pressable>
            </>
          )}
        </Card>
      )}
    </Col>
  );
}

// Eine Buchungszeile. Zeigt alles, was der Endpoint je Eintrag liefert:
// Gast, Objekt, Zeitraum + Nächte, Herkunft (ota_name vor Kanal-Label) und
// Status. Tippen führt ins Buchungsdetail.
function Zeile({
  eintrag,
  datumsfeld,
  onPress,
}: {
  eintrag: DashboardEntry;
  datumsfeld: "check_in" | "check_out";
  onPress: () => void;
}) {
  const t = useTheme();
  const kanal = channelMeta(eintrag.channel);
  // Echte Herkunft zuerst: „Booking.com" statt des internen Kanal-Kürzels.
  const herkunft = portalLabel(eintrag.ota_name) || kanal.label;
  const tone = STATUS_TONE[eintrag.status];
  const n = naechte(eintrag.check_in, eintrag.check_out);

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({ paddingVertical: 14, paddingHorizontal: 16, opacity: pressed ? 0.7 : 1 })}
    >
      <Row gap={12} style={{ alignItems: "center" }}>
        <View>
          <Avatar s={40} icon="user" />
          {/* Herkunft als Marke — derselbe Baustein wie in Buchungsliste und
              Buchungsdetail, damit ein Kanal überall gleich aussieht. */}
          <View style={{ position: "absolute", right: -6, bottom: -4 }}>
            <KanalMarke channel={eintrag.channel} hoehe={18} />
          </View>
        </View>

        <Col gap={3} style={{ flex: 1 }}>
          <Row gap={8} style={{ alignItems: "center" }}>
            <Txt v="title" numberOfLines={1} style={{ flex: 1 }}>
              {eintrag.guest_name || "Gast"}
            </Txt>
            <View
              style={{
                paddingHorizontal: 8,
                paddingVertical: 3,
                borderRadius: t.radius.pill,
                backgroundColor: tone.bg,
              }}
            >
              <Txt v="xs" color={tone.fg} style={{ fontFamily: t.fonts.semibold }}>
                {STATUS_LABEL[eintrag.status]}
              </Txt>
            </View>
          </Row>
          <Txt v="sm" soft numberOfLines={1}>
            {eintrag.property_title}
          </Txt>
          <Txt v="xs" soft numberOfLines={1}>
            {tagKurz(eintrag[datumsfeld])} · {n} {n === 1 ? "Nacht" : "Nächte"} · {herkunft}
          </Txt>
        </Col>

        <Icon n="fwd" s={16} sw={2} c={t.palette.faint} />
      </Row>
    </Pressable>
  );
}

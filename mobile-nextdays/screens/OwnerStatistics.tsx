// Eigentümer · Statistiken (GET /public-portal/statistics, Recht
// `pm_nonrevenue_charts`). Belegung, Aufenthaltsdauer, Vorlaufzeit und die
// Kanalverteilung — und KEIN Geld: Umsatz/Preise stehen im Tab „Auszahlungen"
// und unterliegen dort der serverseitigen Maske (Contract). Gleicher Name wie
// im Web (`/portal/statistiken`), damit beide Oberflächen dieselbe Sprache
// sprechen.
//
// Read-only, kein Export, kein Datums-Picker: die App bietet drei feste
// Zeiträume an (3 · 6 · 12 Monate). Das ist auf dem Telefon schneller als eine
// Datumseingabe und hält die Spanne SICHER unter der Server-Obergrenze von 730
// Tagen (Wurzel 8) — eine 422-Antwort kann so gar nicht erst entstehen.
//
// „Balken statt Diagramm-Bibliothek": die Kanalverteilung ist eine Liste mit
// Balkenbreite in Prozent. Kein neues Native-Paket, lesbar bei jeder
// Systemschriftgröße.
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Btn, Card, Col, Divider, Row, Segmented, Spinner, Txt } from "@/components/ui/kit";
import { EmptyState } from "@/components/ui/patterns";
import { KANAELE, channelMeta } from "@/lib/calendar-channels";
import {
  getOwnerProperties,
  getOwnerStatistics,
  statistikSpanneErlaubt,
  statistikZeitraum,
  type PortalProperty,
  type PortalStatistics,
  type PortalStatisticsChannel,
} from "@/lib/ownerPortal";
import type { ReservationChannel } from "@/lib/reservations";
import { useRealtime } from "@/lib/realtime";
import { useUnterkante } from "@/lib/unterkante";
import { useTheme } from "@/theme/ThemeProvider";

// Die drei angebotenen Zeiträume — alle innerhalb der Server-Obergrenze.
const ZEITRAEUME = [3, 6, 12] as const;
const ZEITRAUM_LABEL = ["3 Monate", "6 Monate", "12 Monate"];

// `occupancy_rate` kommt BEREITS in Prozent (0…100, siehe Schema) — hier wird
// nur gerundet, NICHT noch einmal mit 100 multipliziert. `null` heißt „keine
// Kapazität, also nicht messbar" und wird „—", nie 0 % (Wurzel 4): 0 % wäre
// eine Aussage über Leistung, wo nichts messbar ist.
function prozent(wert: number | null | undefined): string {
  if (wert == null || !Number.isFinite(wert)) return "—";
  return `${Math.round(wert)} %`;
}

// Eine Nachkommastelle, aber nur wenn sie etwas aussagt.
function zahl(wert: number | null | undefined, einheit: string): string {
  if (wert == null || !Number.isFinite(wert)) return "—";
  const gerundet = Math.round(wert * 10) / 10;
  return `${gerundet} ${einheit}`;
}

// Der Zeitraum, den der SERVER ausgewertet hat — nicht der lokal gewählte.
// Weichen beide ab (Kappung, Rundung), steht hier der wahre Bezug.
function zeitraumLabel(von: string, bis: string): string {
  const f = (s: string) => {
    const d = new Date(`${s}T00:00:00`);
    return Number.isNaN(d.getTime())
      ? s
      : d.toLocaleDateString("de-DE", { day: "numeric", month: "short", year: "2-digit" });
  };
  return `${f(von)} – ${f(bis)}`;
}

export default function OwnerStatistics() {
  const t = useTheme();
  // Unten frei bleiben MUSS die Tab-Leiste (lib/unterkante).
  const unterkante = useUnterkante();
  const insets = useSafeAreaInsets();

  const [props, setProps] = useState<PortalProperty[] | null>(null);
  // null = „alle Objekte" (der Endpunkt ohne property_id).
  const [objekt, setObjekt] = useState<string | null>(null);
  const [zeitraum, setZeitraum] = useState(2); // Vorgabe: 12 Monate
  const [daten, setDaten] = useState<PortalStatistics | null>(null);
  const [error, setError] = useState<string | null>(null);

  const spanne = useMemo(
    () => statistikZeitraum(ZEITRAEUME[zeitraum], new Date()),
    [zeitraum],
  );

  useEffect(() => {
    getOwnerProperties().then((res) => {
      // Der Objekt-Filter ist Beiwerk: lädt er nicht, bleibt die Auswertung
      // über ALLE Objekte trotzdem nutzbar. Kein Fehlerbanner dafür.
      if (res.ok) setProps(res.data.items);
    });
  }, []);

  const load = useCallback(async () => {
    // Doppelter Boden zur Server-Obergrenze: eine Spanne, die der Server mit
    // 422 abweisen würde, wird gar nicht erst geschickt (Wurzel 8).
    if (!statistikSpanneErlaubt(spanne.from, spanne.to)) {
      setDaten(null);
      setError("Zeitraum zu groß.");
      return;
    }
    const res = await getOwnerStatistics({ ...spanne, propertyId: objekt });
    if (res.ok) {
      setDaten(res.data);
      setError(null);
    } else {
      setDaten(null);
      setError(res.error);
    }
  }, [spanne, objekt]);

  useEffect(() => {
    load();
  }, [load]);

  // Auslastung entsteht aus Buchungen und gesperrten Nächten — beide Tabellen
  // sind für `authenticated` lesbar und RLS-owner-gefiltert.
  useRealtime({ table: "reservations", onChange: load });
  useRealtime({ table: "availability", onChange: load });

  const kanaele = daten?.by_channel ?? [];
  // Bezugsgröße der Kanal-Balken: der stärkste Kanal im Fenster. Ohne
  // Buchungen bleibt die Liste leer, statt 0-Balken zu zeichnen.
  const maxBuchungen = Math.max(...kanaele.map((k) => k.reservations), 1);

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
      <Col style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 12, gap: 12 }}>
        <Txt v="display">Statistiken</Txt>
        <Txt v="sm" soft>
          Belegung und Aufenthalte deiner Objekte. Ohne Geldbeträge.
        </Txt>

        <Segmented options={ZEITRAUM_LABEL} value={zeitraum} onChange={setZeitraum} />

        {props && props.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Row gap={8}>
              <ObjektChip label="Alle Objekte" aktiv={objekt === null} onPress={() => setObjekt(null)} />
              {props.map((p) => (
                <ObjektChip
                  key={p.id}
                  label={p.title}
                  aktiv={objekt === p.id}
                  onPress={() => setObjekt(p.id)}
                />
              ))}
            </Row>
          </ScrollView>
        )}
      </Col>

      {!daten && !error && <Spinner />}

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: unterkante + 24, gap: 22 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
      >
        {error && (
          <EmptyState icon="info" titel="Nicht geladen" text={error}>
            <Btn variant="outline" onPress={load} style={{ marginTop: 6 }}>
              Erneut versuchen
            </Btn>
          </EmptyState>
        )}

        {daten && (
          <>
            <Col gap={4}>
              <Txt v="sm" soft>
                Auslastung · {zeitraumLabel(daten.date_from, daten.date_to)}
              </Txt>
              <Txt v="display">{prozent(daten.occupancy_rate)}</Txt>
              {/* Bezugsgröße ausgeschrieben: „Einheiten-Nächte" sind
                  Einheiten × Tage (0265) — bei fünf gleichen Studios je Tag
                  fünf. Ohne diesen Satz liest man die Zahl als Kalendertage. */}
              <Txt v="sm" soft>
                {daten.nights_booked + daten.owner_stay_nights} von{" "}
                {daten.capacity_unit_nights} Einheiten-Nächten belegt
              </Txt>
            </Col>

            <Card>
              <Kennzahl
                label="Gastnächte"
                wert={`${daten.nights_booked} ${daten.nights_booked === 1 ? "Nacht" : "Nächte"}`}
              />
              {/* Eigennutzung getrennt: sie belegt den Kalender, ist aber keine
                  Vermarktungsleistung. In einer Zahl mit den Gastnächten hielte
                  man die eigene Ferienwoche für Auslastung. */}
              <Kennzahl
                label="Eigennutzung"
                wert={`${daten.owner_stay_nights} ${
                  daten.owner_stay_nights === 1 ? "Nacht" : "Nächte"
                }`}
              />
              <Kennzahl
                label={daten.units_total === 1 ? "Einheit" : "Einheiten"}
                wert={`${daten.units_total}`}
              />
              <Kennzahl label="Buchungen" wert={`${daten.reservations}`} />
              <Kennzahl
                label="Ø Aufenthalt"
                wert={zahl(daten.avg_stay_nights, daten.avg_stay_nights === 1 ? "Nacht" : "Nächte")}
              />
              <Kennzahl
                label="Ø Vorlaufzeit"
                wert={zahl(daten.avg_lead_time_days, daten.avg_lead_time_days === 1 ? "Tag" : "Tage")}
                letzte
              />
            </Card>

            {/* Woran die Vorlaufzeit hängt, gehört sichtbar dazu: sie zählt nur
                Buchungen mit echtem Buchungszeitpunkt aus der Quelle (Wurzel
                5b). Steht dort „auf 0 Buchungen", ist „—" oben die ehrliche
                Auskunft und kein Rechenfehler. */}
            {daten.reservations > 0 && daten.avg_lead_time_basis < daten.reservations && (
              <Txt v="xs" soft>
                Vorlaufzeit beruht auf {daten.avg_lead_time_basis} von {daten.reservations}{" "}
                Buchungen — bei den übrigen hat das Portal keinen Buchungszeitpunkt geliefert.
              </Txt>
            )}

            <Col gap={12}>
              <Txt v="h2">Buchungen je Kanal</Txt>
              {kanaele.length === 0 ? (
                <Txt v="body" soft>
                  In diesem Zeitraum gibt es keine Buchungen.
                </Txt>
              ) : (
                <Col gap={11}>
                  {kanaele.map((k) => (
                    <Kanalzeile
                      key={`${k.channel}-${k.ota_name ?? ""}`}
                      kanal={k}
                      anteil={k.reservations / maxBuchungen}
                    />
                  ))}
                </Col>
              )}
            </Col>
          </>
        )}
      </ScrollView>
    </View>
  );
}

// Eine Kanalzeile: Name, Balken (Anteil an den Buchungen des stärksten Kanals)
// und die Anzahl.
//
// Farbe/Label kommen aus der EINEN Kanal-Meta (lib/calendar-channels.ts) — aber
// nur, wenn der Kanalwert dort auch bekannt ist. `channelMeta` fällt sonst auf
// „Direkt" zurück, und genau das ist der stille Fehler, vor dem die Kanal-Kette
// warnt: eine Expedia-Buchung in Marktplatz-Lila. Unbekannter Kanal →
// neutrale Farbe und sein Rohwert als Name.
function Kanalzeile({ kanal, anteil }: { kanal: PortalStatisticsChannel; anteil: number }) {
  const t = useTheme();
  const bekannt = (KANAELE as string[]).includes(kanal.channel);
  const meta = bekannt ? channelMeta(kanal.channel as ReservationChannel) : null;
  const name = kanal.ota_name ?? meta?.label ?? kanal.channel;
  return (
    <Col gap={5}>
      <Row style={{ justifyContent: "space-between" }}>
        <Txt v="sm" numberOfLines={1} style={{ flex: 1 }}>
          {name}
        </Txt>
        <Txt v="sm" soft>
          {kanal.reservations} · {kanal.nights} Nächte
        </Txt>
      </Row>
      <View
        style={{
          height: 8,
          borderRadius: 999,
          backgroundColor: t.palette.surface2,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            height: "100%",
            width: `${Math.max(2, Math.round(anteil * 100))}%`,
            backgroundColor: meta?.bar ?? t.palette.soft,
            borderRadius: 999,
          }}
        />
      </View>
    </Col>
  );
}

function ObjektChip({
  label,
  aktiv,
  onPress,
}: {
  label: string;
  aktiv: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  // Gleiche Pille wie im Eigentümer-Kalender (screens/OwnerCalendar.tsx) —
  // bewusst kein `Btn`: das ist die große CTA-Pille, hier steht ein Filter.
  return (
    <Pressable accessibilityRole="button" onPress={onPress}>
      <View
        style={{
          paddingVertical: 7,
          paddingHorizontal: 14,
          borderRadius: t.radius.pill,
          backgroundColor: aktiv ? t.palette.accent : t.palette.surface2,
        }}
      >
        <Txt v="sm" color={aktiv ? t.palette.accentInk : t.palette.ink} numberOfLines={1}>
          {label}
        </Txt>
      </View>
    </Pressable>
  );
}

function Kennzahl({ label, wert, letzte }: { label: string; wert: string; letzte?: boolean }) {
  return (
    <View>
      <Row style={{ paddingVertical: 13, paddingHorizontal: 16, justifyContent: "space-between" }}>
        <Txt v="sm" soft>
          {label}
        </Txt>
        <Txt v="sm">{wert}</Txt>
      </Row>
      {!letzte && <Divider />}
    </View>
  );
}

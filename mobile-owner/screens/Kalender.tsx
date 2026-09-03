// Kalender — Monatsbelegung der eigenen Objekte, LESEND.
// GET /public-portal/calendar; der Eigentümer kann ansehen, nichts setzen.
// Wer Nächte freihalten will, stellt einen Sperrantrag (eigener Screen).
//
// Struktur nach der Vorlage: Objektwahl als Pillenleiste, Monatsblatt in einer
// gerahmten Kachel, Legende darunter.
//
// ZWEI ÜBERNOMMENE FALLEN aus dem Vorbild (mobile-nextdays/screens/
// OwnerCalendar.tsx) — beide bleiben bewusst so gelöst:
//  1. Kalenderdatum LOKAL bilden (`iso`), nie `toISOString()`: das verschiebt
//     östlich von UTC auf den Vortag, und der Kalender zeigte dann den
//     falschen Tag als belegt.
//  2. Ladefehler ≠ leerer Bestand: schlägt der Abruf fehl, bleibt die Liste
//     `null` und es erscheint der Fehler — NICHT „keine Objekte zugeordnet"
//     (Wurzel 4).
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/Icon";
import { Kachel, Spinner, Txt } from "@/components/ui/kit";
import { Kopf } from "@/components/ui/Kopf";
import { Aktion } from "@/components/ui/Aktion";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency } from "@/lib/currency";
import {
  getOwnerCalendar,
  getOwnerProperties,
  type PortalCalendarDay,
  type PortalProperty,
} from "@/lib/ownerPortal";
import { useRealtime } from "@/lib/realtime";
import { useUnterkante } from "@/lib/unterkante";
import { KARTE_ABSTAND } from "@/theme/flaechen";
import { useTheme } from "@/theme/ThemeProvider";

const WOCHENTAGE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

/** LOKALES Kalenderdatum — kein `toISOString()` (siehe Kopf, Falle 1). */
export function iso(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Zellen eines Monatsblatts, montagsbeginnend; `null` = Vorlauf. */
export function monatsRaster(jahr: number, monat: number): (Date | null)[] {
  const erster = new Date(jahr, monat, 1);
  const vorlauf = (erster.getDay() + 6) % 7;
  const tage = new Date(jahr, monat + 1, 0).getDate();
  const zellen: (Date | null)[] = [];
  for (let i = 0; i < vorlauf; i++) zellen.push(null);
  for (let d = 1; d <= tage; d++) zellen.push(new Date(jahr, monat, d));
  return zellen;
}

type Nav = { navigate: (name: string, params?: Record<string, unknown>) => void };

export default function Kalender({ navigation }: { navigation: Nav }) {
  const t = useTheme();
  const { me } = useAuth();
  const unterkante = useUnterkante();
  const insets = useSafeAreaInsets();
  const [objekte, setObjekte] = useState<PortalProperty[] | null>(null);
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  const [monat, setMonat] = useState(() => {
    const jetzt = new Date();
    return { jahr: jetzt.getFullYear(), monat: jetzt.getMonth() };
  });
  const [tage, setTage] = useState<Map<string, PortalCalendarDay> | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    void getOwnerProperties().then((res) => {
      if (res.ok) {
        setObjekte(res.data.items);
        if (res.data.items.length > 0) setGewaehlt(res.data.items[0].id);
      } else {
        setObjekte(null);
        setFehler(res.error);
      }
    });
  }, []);

  const zellen = useMemo(() => monatsRaster(monat.jahr, monat.monat), [monat]);

  const monatLaden = useCallback(async () => {
    if (!gewaehlt) return;
    setTage(null);
    const start = iso(new Date(monat.jahr, monat.monat, 1));
    const ende = iso(new Date(monat.jahr, monat.monat + 1, 1));
    const res = await getOwnerCalendar(gewaehlt, start, ende);
    if (res.ok) {
      setTage(new Map(res.data.days.map((d) => [d.date, d])));
      setFehler(null);
    } else {
      setTage(new Map());
      setFehler(res.error);
    }
  }, [gewaehlt, monat]);

  useEffect(() => {
    void monatLaden();
  }, [monatLaden]);

  // Beide Tabellen speisen das Blatt: `availability` die Sperren, `reservations`
  // die Buchungen. Fehlt ein Abo, sieht die Ansicht live aus und aktualisiert
  // nie (CLAUDE.md „Realtime").
  useRealtime({ table: "availability", onChange: monatLaden });
  useRealtime({ table: "reservations", onChange: monatLaden });

  const flaeche = (status: string): string => {
    if (status === "booked") return t.palette.accent;
    if (status === "blocked") return t.palette.ink;
    return t.palette.surface2;
  };
  const schrift = (status: string): string =>
    status === "open" ? t.palette.soft : t.palette.accentInk;

  const monatsName = new Date(monat.jahr, monat.monat, 1).toLocaleDateString("de-DE", {
    month: "long",
    year: "numeric",
  });

  const blaettern = (schritt: number) =>
    setMonat((m) => {
      const d = new Date(m.jahr, m.monat + schritt, 1);
      return { jahr: d.getFullYear(), monat: d.getMonth() };
    });

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
      <Kopf
        titel="Kalender"
        name={me?.full_name}
        email={me?.email}
        aufProfil={() => navigation.navigate("Profil")}
      />

      {objekte && objekte.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: t.density.pad, gap: 8, paddingBottom: 12 }}
        >
          {objekte.map((o) => {
            const aktiv = o.id === gewaehlt;
            return (
              <Pressable key={o.id} onPress={() => setGewaehlt(o.id)}>
                <View
                  style={{
                    paddingVertical: 7,
                    paddingHorizontal: 14,
                    borderRadius: 999,
                    backgroundColor: aktiv ? t.palette.accent : t.palette.surface2,
                  }}
                >
                  <Txt v="sm" color={aktiv ? t.palette.accentInk : t.palette.ink} numberOfLines={1}>
                    {o.title}
                  </Txt>
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      <ScrollView
        contentContainerStyle={{
          padding: t.density.pad,
          paddingTop: 0,
          paddingBottom: unterkante + 24,
          gap: KARTE_ABSTAND,
        }}
      >
        {!objekte && !fehler ? <Spinner /> : null}

        {fehler ? (
          <Kachel>
            <Txt v="title">Kalender nicht geladen</Txt>
            <Txt v="sm" soft style={{ marginTop: 4 }}>
              {fehler}
            </Txt>
          </Kachel>
        ) : null}

        {objekte && objekte.length === 0 ? (
          <Kachel>
            <Txt v="title">Noch kein Objekt zugeordnet</Txt>
            <Txt v="sm" soft style={{ marginTop: 4 }}>
              Sobald Ihre Verwaltung Ihnen ein Objekt zuordnet, erscheint sein Kalender hier.
            </Txt>
          </Kachel>
        ) : null}

        {objekte && objekte.length > 0 ? (
          <Kachel>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 12,
              }}
            >
              <Pressable onPress={() => blaettern(-1)} hitSlop={12} accessibilityLabel="Vorheriger Monat">
                <Icon n="back" s={20} sw={2} c={t.palette.soft} />
              </Pressable>
              <Txt v="title">{monatsName}</Txt>
              <Pressable onPress={() => blaettern(1)} hitSlop={12} accessibilityLabel="Nächster Monat">
                <Icon n="fwd" s={20} sw={2} c={t.palette.soft} />
              </Pressable>
            </View>

            <View style={{ flexDirection: "row", marginBottom: 6 }}>
              {WOCHENTAGE.map((w) => (
                <Txt key={w} v="xs" faint style={{ flex: 1, textAlign: "center" }}>
                  {w}
                </Txt>
              ))}
            </View>

            {!tage ? (
              <Spinner />
            ) : (
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {zellen.map((zelle, i) => {
                  if (!zelle) {
                    return <View key={`leer${i}`} style={{ width: `${100 / 7}%`, height: 52 }} />;
                  }
                  const info = tage.get(iso(zelle));
                  const status = info?.status ?? "open";
                  return (
                    <View key={iso(zelle)} style={{ width: `${100 / 7}%`, padding: 2 }}>
                      <View
                        style={{
                          height: 48,
                          borderRadius: 10,
                          backgroundColor: flaeche(status),
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <Txt v="xs" color={schrift(status)}>
                          {zelle.getDate()}
                        </Txt>
                        {/* Preis nur, wenn der Server ihn liefert (Maske) und
                            der Tag frei ist. Symbollos ohne Währung — der
                            Contract liefert hier keine (Wurzel 4). */}
                        {info?.price != null && status === "open" ? (
                          <Txt v="xs" faint style={{ fontSize: 9 }}>
                            {formatCurrency(info.price, null)}
                          </Txt>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            <View
              style={{ flexDirection: "row", gap: 16, marginTop: 16, justifyContent: "center" }}
            >
              <Legende farbe={t.palette.surface2} label="frei" />
              <Legende farbe={t.palette.accent} label="belegt" />
              <Legende farbe={t.palette.ink} label="gesperrt" />
            </View>
          </Kachel>
        ) : null}
      </ScrollView>

      {objekte && objekte.length > 0 ? (
        <Aktion
          icon="cal"
          label="Zeitraum für die Eigennutzung beantragen"
          auf={() => navigation.navigate("SperrAntrag", { propertyId: gewaehlt ?? undefined })}
        />
      ) : null}
    </View>
  );
}

function Legende({ farbe, label }: { farbe: string; label: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
      <View style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: farbe }} />
      <Txt v="xs" soft>
        {label}
      </Txt>
    </View>
  );
}

// Auszahlungen — der einzige Screen dieser App, der Geld zeigt.
//
// DIE MASKE IST SERVERSEITIG (`/public-portal/earnings`, `/statements`): ohne
// Beträge-Sicht liefert der Server `payout: null` / `total_payout: null`. Das
// wird als „—" gerendert, NIE als 0 und NIE mit einem Ersatzwert (Wurzel 4) —
// „0 kr ausgezahlt" wäre eine Falschaussage, „—" ist die Wahrheit („dürfen Sie
// hier nicht sehen" bzw. „liegt nicht vor").
//
// WÄHRUNG kommt aus der Antwort (`currency`), nie aus einer Konstante: der
// Betrieb kann in Kronen, Zloty oder Forint abrechnen (Wurzel 4, 27 EU-Länder).
import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/Icon";
import { Kachel, KachelKopf, Segmented, Spinner, Txt } from "@/components/ui/kit";
import { Kopf } from "@/components/ui/Kopf";
import { useAuth } from "@/contexts/AuthContext";
import { useT } from "@/contexts/SprachContext";
import { formatCurrency } from "@/lib/currency";
import { getOwnerEarnings, type PortalEarnings } from "@/lib/ownerPortal";
import { useUnterkante } from "@/lib/unterkante";
import { KARTE_ABSTAND } from "@/theme/flaechen";
import { useTheme } from "@/theme/ThemeProvider";

// Zeiträume als ganze Monate/Jahre — kein freier Datumswähler: die Abrechnung
// läuft in Perioden, und ein krummer Zeitraum ergäbe eine Zahl, die zu keinem
// Beleg passt.
// Der Wert ist ein CODE, nicht die Beschriftung: sonst hinge die Rechnung an
// der Sprache der Oberfläche und `zeitraumGrenzen` liefe in einer anderen
// Sprache ins Leere.
const ZEITRAEUME = [
  { wert: "diesesJahr", schluessel: "zeitraum.diesesJahr" },
  { wert: "letztesJahr", schluessel: "zeitraum.letztesJahr" },
  { wert: "zwoelfMonate", schluessel: "zeitraum.zwoelfMonate" },
] as const;

export type Zeitraum = (typeof ZEITRAEUME)[number]["wert"];

/** Zeitraum-Grenzen (lokal gebildet, kein `toISOString()`). */
export function zeitraumGrenzen(
  wahl: Zeitraum,
  heute: Date,
): { von: string; bis: string } {
  const tag = (d: Date) => {
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const t2 = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${m}-${t2}`;
  };
  if (wahl === "diesesJahr") {
    return { von: `${heute.getFullYear()}-01-01`, bis: tag(heute) };
  }
  if (wahl === "letztesJahr") {
    const j = heute.getFullYear() - 1;
    return { von: `${j}-01-01`, bis: `${j}-12-31` };
  }
  const von = new Date(heute.getFullYear(), heute.getMonth() - 11, 1);
  return { von: tag(von), bis: tag(heute) };
}

type Nav = { navigate: (name: string, params?: Record<string, unknown>) => void };

export default function Auszahlungen({ navigation }: { navigation: Nav }) {
  const txt = useT();
  const t = useTheme();
  const { me } = useAuth();
  const insets = useSafeAreaInsets();
  const unterkante = useUnterkante();
  const [wahl, setWahl] = useState<Zeitraum>("diesesJahr");
  const [daten, setDaten] = useState<PortalEarnings | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = useCallback(async () => {
    setFehler(null);
    const { von, bis } = zeitraumGrenzen(wahl, new Date());
    const res = await getOwnerEarnings(von, bis);
    if (res.ok) setDaten(res.data);
    else setFehler(res.error);
    setLaedt(false);
  }, [wahl]);

  useEffect(() => {
    setLaedt(true);
    void laden();
  }, [laden]);

  // Ob Beträge sichtbar sind, entscheidet der Server. Erkennbar daran, dass
  // `total_payout` null ist — dann steht überall „—".
  const maskiert = daten !== null && daten.total_payout === null;

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
      <Kopf
        titel={txt("auszahlung.titel")}
        name={me?.full_name}
        email={me?.email}
        aufProfil={() => navigation.navigate("Mehr")}
      />
      <ScrollView
        contentContainerStyle={{
          padding: t.density.pad,
          paddingTop: 0,
          paddingBottom: unterkante + 24,
          gap: KARTE_ABSTAND,
        }}
        refreshControl={<RefreshControl refreshing={laedt} onRefresh={() => void laden()} />}
      >
        <Segmented
          options={ZEITRAEUME.map((z) => txt(z.schluessel))}
          value={ZEITRAEUME.findIndex((z) => z.wert === wahl)}
          onChange={(i) => setWahl(ZEITRAEUME[i]?.wert ?? "diesesJahr")}
        />

        {fehler ? (
          <Kachel>
            <Txt v="title">{txt("auszahlung.nichtGeladen")}</Txt>
            <Txt v="sm" soft style={{ marginTop: 4 }}>
              {fehler}
            </Txt>
          </Kachel>
        ) : null}

        {laedt && !daten ? (
          <Kachel>
            <Spinner />
          </Kachel>
        ) : null}

        {daten ? (
          <>
            <Kachel>
              <KachelKopf titel={txt("auszahlung.summeZeitraum")} />
              <Txt v="display">
                {daten.total_payout === null
                  ? "—"
                  : formatCurrency(daten.total_payout, daten.currency)}
              </Txt>
              <Txt v="xs" soft style={{ marginTop: 2 }}>
                {daten.period_from} bis {daten.period_to}
              </Txt>
              {maskiert ? (
                <Txt v="xs" faint style={{ marginTop: 8 }}>
                  Beträge sind für Ihren Zugang nicht freigegeben. Ihre Verwaltung kann das
                  ändern.
                </Txt>
              ) : null}
            </Kachel>

            <Kachel>
              <KachelKopf titel={txt("auszahlung.jeObjekt")} />
              {daten.items.length === 0 ? (
                <Txt v="sm" soft>
                  {txt("auszahlung.keineBuchungen")}
                </Txt>
              ) : (
                daten.items.map((zeile, i) => (
                  <View
                    key={zeile.property_id}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      paddingVertical: 10,
                      borderTopWidth: i === 0 ? 0 : 1,
                      borderTopColor: t.palette.line,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Txt v="title" numberOfLines={1}>
                        {zeile.title}
                      </Txt>
                      <Txt v="xs" soft>
                        {zeile.reservations} Buchungen · {zeile.nights} Nächte
                      </Txt>
                    </View>
                    <Txt v="title">
                      {zeile.payout === null
                        ? "—"
                        : formatCurrency(zeile.payout, zeile.currency)}
                    </Txt>
                  </View>
                ))
              )}
            </Kachel>

            <Pressable onPress={() => navigation.navigate("Tabs", { screen: "Abrechnungen" })}>
              <Kachel>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                  <Icon n="doc" s={22} c={t.palette.accent} />
                  <View style={{ flex: 1 }}>
                    <Txt v="title">{txt("auszahlung.abrechnungen")}</Txt>
                    <Txt v="xs" soft>
                      {txt("auszahlung.abrechnungenText")}
                    </Txt>
                  </View>
                  <Icon n="fwd" s={18} c={t.palette.faint} />
                </View>
              </Kachel>
            </Pressable>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

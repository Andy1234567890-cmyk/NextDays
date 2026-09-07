// Aufenthalte — die eigenen Aufenthalte des Eigentümers (Vorlage: Hostaway
// „Stays"): bevorstehend / vergangen, je Karte Objekt, Check-in → Check-out,
// Nächte, Gäste, Status. Unten „Aufenthalt buchen".
//
// FACHLICH ist ein Aufenthalt ein SPERRANTRAG (`/public-portal/block-requests`):
// der Eigentümer sperrt nicht selbst, er beantragt, die Verwaltung entscheidet
// (CLAUDE.md Regel 2). Der Status steht darum auf jeder Karte — „Angefragt" ist
// kein bestätigter Aufenthalt, und die Nacht bleibt bis zur Zusage buchbar.
import { useFocusEffect } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DemoBand } from "@/components/DemoBand";
import { Icon } from "@/components/ui/Icon";
import { Btn, Kachel, Photo, Segmented, Spinner, Txt } from "@/components/ui/kit";
import { Kopf } from "@/components/ui/Kopf";
import { useAuth } from "@/contexts/AuthContext";
import {
  antragStatusName,
  aufenthaltNaechte,
  checkoutAus,
  gaesteText,
  istBevorstehend,
} from "@/lib/aufenthalt";
import {
  type BlockRequest,
  getBlockRequests,
  getOwnerProperties,
  type PortalProperty,
} from "@/lib/ownerPortal";
import { useRealtime } from "@/lib/realtime";
import { useUnterkante } from "@/lib/unterkante";
import { datumKurz, isoLokal } from "@/lib/zeitraum";
import { KARTE_ABSTAND } from "@/theme/flaechen";
import { useTheme } from "@/theme/ThemeProvider";

type Nav = { navigate: (name: string, params?: Record<string, unknown>) => void };

const REITER = ["Bevorstehend", "Vergangen"] as const;

export default function Aufenthalte({ navigation }: { navigation: Nav }) {
  const t = useTheme();
  const { me } = useAuth();
  const insets = useSafeAreaInsets();
  const unterkante = useUnterkante();
  const [reiter, setReiter] = useState(0);
  const [antraege, setAntraege] = useState<BlockRequest[] | null>(null);
  const [objekte, setObjekte] = useState<Map<string, PortalProperty>>(new Map());
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = useCallback(async () => {
    setFehler(null);
    const [a, o] = await Promise.all([getBlockRequests(), getOwnerProperties()]);
    if (a.ok) setAntraege(a.data.items);
    else setFehler(a.error);
    if (o.ok) setObjekte(new Map(o.data.items.map((p) => [p.id, p])));
    setLaedt(false);
  }, []);

  useEffect(() => {
    void laden();
  }, [laden]);

  // KEIN Abo auf `block_requests`: die Tabelle hat seit 0332 bewusst kein
  // SELECT für `authenticated` (Begründung und interne Entscheidungsnotiz
  // stehen in der Zeile, Wurzel 6) — ein Abo darauf wäre eine stumme
  // Attrappe (scripts/realtime/abos-pruefen.sh meldet sie). Gehört wird
  // stattdessen auf `availability`: die ZUSAGE der Verwaltung sperrt Nächte
  // und schreibt dorthin, der Status springt damit live auf „Bestätigt". Der
  // neue Antrag selbst schreibt nichts — ihn holt das Neuladen beim Rückkehren
  // auf diesen Tab (`useFocusEffect`).
  useRealtime({ table: "availability", onChange: laden });
  useFocusEffect(
    useCallback(() => {
      void laden();
    }, [laden]),
  );

  const heute = isoLokal(new Date());
  const liste = useMemo(() => {
    if (!antraege) return [];
    const aktiv = antraege.filter((a) => a.status !== "withdrawn");
    const bevor = aktiv.filter((a) => istBevorstehend(a.end_date, heute)).sort((a, b) => (a.start_date < b.start_date ? -1 : 1));
    const vergangen = aktiv.filter((a) => !istBevorstehend(a.end_date, heute)).sort((a, b) => (a.start_date < b.start_date ? 1 : -1));
    return reiter === 0 ? bevor : vergangen;
  }, [antraege, reiter, heute]);

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
      <Kopf titel="Aufenthalte" name={me?.full_name} email={me?.email} aufProfil={() => navigation.navigate("Mehr")} />
      {me?.is_demo ? <DemoBand /> : null}
      <ScrollView
        contentContainerStyle={{
          padding: t.density.pad,
          paddingTop: 0,
          paddingBottom: unterkante + 96,
          gap: KARTE_ABSTAND,
        }}
        refreshControl={<RefreshControl refreshing={laedt} onRefresh={() => void laden()} />}
      >
        <Segmented options={[...REITER]} value={reiter} onChange={setReiter} />

        {fehler ? (
          <Kachel>
            <Txt v="title">Aufenthalte nicht geladen</Txt>
            <Txt v="sm" soft style={{ marginTop: 4 }}>
              {fehler}
            </Txt>
          </Kachel>
        ) : null}
        {laedt && !antraege ? (
          <Kachel>
            <Spinner />
          </Kachel>
        ) : null}

        {antraege && liste.length === 0 ? (
          <Kachel>
            <Txt v="title">{reiter === 0 ? "Kein bevorstehender Aufenthalt" : "Noch kein vergangener Aufenthalt"}</Txt>
            <Txt v="sm" soft style={{ marginTop: 4 }}>
              {reiter === 0
                ? "Buchen Sie Ihren nächsten Aufenthalt — Ihre Verwaltung bestätigt den Zeitraum."
                : "Abgeschlossene Aufenthalte erscheinen hier."}
            </Txt>
          </Kachel>
        ) : null}

        {liste.map((a) => {
          const obj = objekte.get(a.property_id);
          const checkout = checkoutAus(a.end_date);
          const n = aufenthaltNaechte(a.start_date, checkout);
          return (
            <Kachel key={a.id} pad={12}>
              <View style={{ flexDirection: "row", gap: 12 }}>
                <Photo src={obj?.photo ?? undefined} h={72} w={92} r={10} />
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Txt v="title" numberOfLines={1} style={{ flex: 1 }}>
                      {obj?.title ?? "Objekt"}
                    </Txt>
                    <StatusPille status={a.status} />
                  </View>
                  <Txt v="sm" style={{ marginTop: 4 }}>
                    {datumKurz(a.start_date)} → {datumKurz(checkout)}
                  </Txt>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 }}>
                    <Txt v="xs" soft>
                      {n} {n === 1 ? "Nacht" : "Nächte"}
                    </Txt>
                    {a.guests != null ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Icon n="users" s={13} c={t.palette.soft} />
                        <Txt v="xs" soft>
                          {gaesteText(a.guests)}
                        </Txt>
                      </View>
                    ) : null}
                  </View>
                </View>
              </View>
              {a.reason ? (
                <Txt v="xs" soft style={{ marginTop: 10 }} numberOfLines={2}>
                  {a.reason}
                </Txt>
              ) : null}
              {a.decision_note ? (
                <Txt v="xs" faint style={{ marginTop: 6 }} numberOfLines={2}>
                  Verwaltung: {a.decision_note}
                </Txt>
              ) : null}
            </Kachel>
          );
        })}
      </ScrollView>

      {/* Fest unten über der Tab-Leiste (Vorlage: schwarzer Vollbreiten-Knopf). */}
      <View
        pointerEvents="box-none"
        style={{ position: "absolute", left: t.density.pad, right: t.density.pad, bottom: unterkante + 14 }}
      >
        <Btn variant="dark" block iconR="fwd" onPress={() => navigation.navigate("SperrAntrag")}>
          Aufenthalt buchen
        </Btn>
      </View>
    </View>
  );
}

function StatusPille({ status }: { status: string }) {
  const t = useTheme();
  const bestaetigt = status === "approved";
  const abgelehnt = status === "rejected" || status === "cancelled";
  return (
    <View
      style={{
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: 999,
        backgroundColor: bestaetigt ? t.palette.ink : abgelehnt ? t.palette.accentSoft : t.palette.surface2,
      }}
    >
      <Txt
        v="xs"
        color={bestaetigt ? t.palette.bg : abgelehnt ? t.palette.accent : t.palette.soft}
        style={{ fontFamily: t.fonts.medium, fontSize: 11 }}
      >
        {antragStatusName(status)}
      </Txt>
    </View>
  );
}

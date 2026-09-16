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
import { Alert, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DemoBand } from "@/components/DemoBand";
import { Feld } from "@/components/ui/Feld";
import { Icon } from "@/components/ui/Icon";
import { Btn, Kachel, Photo, Segmented, Spinner, Txt } from "@/components/ui/kit";
import { Kopf } from "@/components/ui/Kopf";
import { useAuth } from "@/contexts/AuthContext";
import { useT } from "@/contexts/SprachContext";
import {
  antragStatusName,
  aufenthaltNaechte,
  checkoutAus,
  gaesteText,
  istBevorstehend,
} from "@/lib/aufenthalt";
import {
  aufhebungBeantragen,
  type BlockRequest,
  getBlockRequests,
  getOwnerProperties,
  type PortalProperty,
} from "@/lib/ownerPortal";
import { useRealtime } from "@/lib/realtime";
import { datumKurz, isoLokal } from "@/lib/zeitraum";
import { KARTE_ABSTAND } from "@/theme/flaechen";
import { useTheme } from "@/theme/ThemeProvider";

type Nav = { navigate: (name: string, params?: Record<string, unknown>) => void };

export default function Aufenthalte({ navigation }: { navigation: Nav }) {
  const txt = useT();
  const t = useTheme();
  const { me } = useAuth();
  const insets = useSafeAreaInsets();
  const [reiter, setReiter] = useState(0);
  const [antraege, setAntraege] = useState<BlockRequest[] | null>(null);
  const [objekte, setObjekte] = useState<Map<string, PortalProperty>>(new Map());
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  // Welcher Aufenthalt gerade sein Aufhebungsformular offen hat (`null` = keiner).
  // Aufklappbar statt dauerhaft sichtbar: der Knopf steht sonst unter JEDEM
  // bestätigten Aufenthalt und drängt sich auf, obwohl er der seltene Fall ist.
  const [aufhebungFuer, setAufhebungFuer] = useState<string | null>(null);
  const [aufhebungGrund, setAufhebungGrund] = useState("");
  const [sendet, setSendet] = useState(false);

  const laden = useCallback(async () => {
    setFehler(null);
    const [a, o] = await Promise.all([getBlockRequests(), getOwnerProperties()]);
    if (a.ok) setAntraege(a.data.items);
    else setFehler(a.error);
    // Stumm bis zum 15.09.2026: scheiterte der Objektabruf, trug JEDE Karte
    // den Platzhalter „Objekt" statt eines Namens, ohne dass irgendetwas auf
    // den Ausfall hinwies (Wurzel 5).
    if (o.ok) setObjekte(new Map(o.data.items.map((p) => [p.id, p])));
    else setFehler((v) => v ?? o.error);
    setLaedt(false);
  }, []);

  // Aufhebung eines GENEHMIGTEN Aufenthalts beantragen. Kein Storno: die
  // Verwaltung entscheidet, der Aufenthalt bleibt bis dahin bestehen (§4.2).
  const aufhebungSenden = useCallback(
    async (antragId: string) => {
      if (sendet) return;
      setSendet(true);
      const res = await aufhebungBeantragen(
        antragId,
        aufhebungGrund.trim() || null,
      );
      setSendet(false);
      if (!res.ok) {
        Alert.alert(txt("auf.aufhebungFehler"), res.error);
        return;
      }
      setAufhebungFuer(null);
      setAufhebungGrund("");
      // Neu laden statt die Zeile lokal zu verbiegen: der Server führt den
      // Zustand, und nur so stimmt die Karte mit ihm überein.
      await laden();
      Alert.alert(txt("auf.aufhebungGesendet"), txt("auf.aufhebungGesendetText"));
    },
    [sendet, aufhebungGrund, laden, txt],
  );

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
          paddingBottom: 90,
          gap: KARTE_ABSTAND,
        }}
        refreshControl={<RefreshControl refreshing={laedt} onRefresh={() => void laden()} />}
      >
        <Segmented
          options={[txt("auf.bevorstehend"), txt("auf.vergangen")]}
          value={reiter}
          onChange={setReiter}
        />

        {fehler ? (
          <Kachel>
            <Txt v="title">{txt("auf.nichtGeladen")}</Txt>
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
            <Txt v="title">{txt(reiter === 0 ? "auf.keinBevorstehender" : "auf.keinVergangener")}</Txt>
            <Txt v="sm" soft style={{ marginTop: 4 }}>
              {reiter === 0
                ? txt("auf.keinBevorstehenderText")
                : txt("auf.keinVergangenerText")}
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
                    {datumKurz(txt, a.start_date)} → {datumKurz(txt, checkout)}
                  </Txt>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 4 }}>
                    <Txt v="xs" soft>
                      {n} {txt(n === 1 ? "allg.nacht" : "allg.naechte")}
                    </Txt>
                    {a.guests != null ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Icon n="users" s={13} c={t.palette.soft} />
                        <Txt v="xs" soft>
                          {gaesteText(txt, a.guests)}
                          {a.children ? ` · ${txt("buchen.kinderHinweis", { anzahl: a.children })}` : ""}
                        </Txt>
                      </View>
                    ) : null}
                    {a.pets ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                        <Icon n="pet" s={13} c={t.palette.soft} />
                        <Txt v="xs" soft>
                          {a.pets === 1
                            ? txt("buchen.einHaustier")
                            : txt("buchen.anzahlHaustiere", { anzahl: a.pets })}
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

              {/* Aufhebung eines bestätigten Aufenthalts (0513). Drei Zustände,
                  die NICHT zusammenfallen dürfen (Wurzel 5): noch keine Bitte,
                  Bitte liegt vor, Verwaltung hat entschieden. „Beantragt" ist
                  ausdrücklich nicht „erledigt" — der Aufenthalt besteht weiter,
                  und wer das nicht liest, plant falsch. */}
              {a.aufhebung === "beantragt" ? (
                <Txt v="xs" soft style={{ marginTop: 10 }}>
                  {txt("auf.aufhebungLaeuft")}
                </Txt>
              ) : a.aufhebung === "abgelehnt" ? (
                <Txt v="xs" soft style={{ marginTop: 10 }}>
                  {txt("auf.aufhebungAbgelehnt")}
                  {a.aufhebung_entscheidungsnotiz
                    ? ` — ${a.aufhebung_entscheidungsnotiz}`
                    : ""}
                </Txt>
              ) : a.aufhebung === "aufgehoben" ? (
                <Txt v="xs" soft style={{ marginTop: 10 }}>
                  {txt("auf.aufhebungErledigt")}
                </Txt>
              ) : a.status === "approved" && istBevorstehend(a.end_date, heute) ? (
                aufhebungFuer === a.id ? (
                  <View style={{ marginTop: 12, gap: 8 }}>
                    <Txt v="xs" soft>
                      {txt("auf.aufhebungHinweis")}
                    </Txt>
                    <Feld
                      label={txt("auf.aufhebungGrund")}
                      wert={aufhebungGrund}
                      aendern={setAufhebungGrund}
                      maxLength={2000}
                    />
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      <Btn
                        variant="primary"
                        style={{ flex: 1 }}
                        disabled={sendet}
                        onPress={() => void aufhebungSenden(a.id)}
                      >
                        {sendet ? txt("auf.aufhebungSendet") : txt("auf.aufhebungSenden")}
                      </Btn>
                      <Btn
                        variant="ghost"
                        disabled={sendet}
                        onPress={() => {
                          setAufhebungFuer(null);
                          setAufhebungGrund("");
                        }}
                      >
                        {txt("allg.abbrechen")}
                      </Btn>
                    </View>
                  </View>
                ) : (
                  <Btn
                    variant="ghost"
                    style={{ marginTop: 10 }}
                    onPress={() => {
                      setAufhebungFuer(a.id);
                      setAufhebungGrund("");
                    }}
                  >
                    {txt("auf.aufhebungAnfragen")}
                  </Btn>
                )
              ) : null}
            </Kachel>
          );
        })}
      </ScrollView>

      {/* Fest unten über der Tab-Leiste (Vorlage: schwarzer Vollbreiten-Knopf). */}
      <View
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 0,
          paddingHorizontal: t.density.pad,
          paddingTop: 10,
          paddingBottom: 10,
          backgroundColor: t.palette.bg,
        }}
      >
        <Btn variant="primary" block iconR="fwd" onPress={() => navigation.navigate("SperrAntrag")}>
          Aufenthalt buchen
        </Btn>
      </View>
    </View>
  );
}

function StatusPille({ status }: { status: string }) {
  const txt = useT();
  const t = useTheme();
  const bestaetigt = status === "approved";
  const abgelehnt = status === "rejected" || status === "cancelled";
  return (
    <View
      style={{
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: 999,
        backgroundColor: bestaetigt
          ? t.palette.positiv
          : abgelehnt
            ? t.palette.accentSoft
            : t.palette.surface2,
      }}
    >
      <Txt
        v="xs"
        // `positiv` ist THEMEABHÄNGIG in der Helligkeit: hell ein dunkles Grün
        // (#2F6B4F), dunkel ein helles (#86BBA1) — es ist als SCHRIFTfarbe
        // gebaut. Als Pillenfläche muss die Schrift darauf deshalb
        // mitdrehen, sonst steht Weiß auf Hellgrün (2,18:1). So sind es
        // 6,29:1 hell und 8,58:1 dunkel.
        color={
          bestaetigt
            ? t.dark
              ? t.palette.bg
              : t.palette.accentInk
            : abgelehnt
              ? t.palette.accentText
              : t.palette.soft
        }
        style={{ fontFamily: t.fonts.medium, fontSize: 11 }}
      >
        {antragStatusName(txt, status)}
      </Txt>
    </View>
  );
}

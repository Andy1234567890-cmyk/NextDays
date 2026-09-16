// Abrechnungen — die finalisierten Abrechnungen des Eigentümers als Tab
// (`GET /public-portal/statements`). Vorlage: Hostaway „Statements":
// Jahres-Chips, „Summe {Jahr}" und „Gesamt", dann je Abrechnung eine Karte
// mit Titel, AUSZAHLUNG, Zeitraum und „Beleg ansehen".
//
// Nur abgeschlossene: Entwürfe der Verwaltung erscheinen hier nicht, sonst
// diskutiert jemand über Zahlen, die noch geändert werden. `owner_payout`
// ist NICHT nullable — eine finalisierte Abrechnung hat einen Betrag. Die
// Währung kommt aus der Zeile; Summen werden JE WÄHRUNG gebildet (Wurzel 4).
import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DemoBand } from "@/components/DemoBand";
import { Icon } from "@/components/ui/Icon";
import { Kachel, Spinner, Txt } from "@/components/ui/kit";
import { Kopf } from "@/components/ui/Kopf";
import { useAuth } from "@/contexts/AuthContext";
import { useT } from "@/contexts/SprachContext";
import { abrechnungTitel, imJahr, jahreAus, summenJeWaehrung, type Summe } from "@/lib/abrechnung";
import { formatCurrency } from "@/lib/currency";
import { getOwnerStatements, type PortalStatement } from "@/lib/ownerPortal";
import { useUnterkante } from "@/lib/unterkante";
import { spanneLesbar } from "@/lib/zeitraum";
import { KARTE_ABSTAND } from "@/theme/flaechen";
import { useTheme } from "@/theme/ThemeProvider";

/** Statusnamen. Unbekannter Status bleibt der rohe Wert (Wurzel 4). */
export function statusName(status: string): string {
  const NAMEN: Record<string, string> = {
    final: "Abgeschlossen",
    finalized: "Abgeschlossen",
    paid: "Bezahlt",
    sent: "Versandt",
  };
  return NAMEN[status] ?? status;
}

type Nav = { navigate: (name: string, params?: Record<string, unknown>) => void };

export default function Abrechnungen({ navigation }: { navigation: Nav }) {
  const txt = useT();
  const t = useTheme();
  const { me } = useAuth();
  const insets = useSafeAreaInsets();
  const unterkante = useUnterkante();
  const [items, setItems] = useState<PortalStatement[] | null>(null);
  const [jahr, setJahr] = useState<number | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = useCallback(async () => {
    setFehler(null);
    const res = await getOwnerStatements();
    if (res.ok) {
      setItems(res.data.items);
      // Neuestes Jahr vorwählen — aber eine bestehende Wahl nicht überschreiben.
      setJahr((alt) => alt ?? jahreAus(res.data.items)[0] ?? null);
    } else setFehler(res.error);
    setLaedt(false);
  }, []);

  useEffect(() => {
    void laden();
  }, [laden]);

  const jahre = items ? jahreAus(items) : [];
  const imGewaehltenJahr = items && jahr !== null ? imJahr(items, jahr) : [];

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
      <Kopf titel="Abrechnungen" name={me?.full_name} email={me?.email} aufProfil={() => navigation.navigate("Mehr")} />
      {me?.is_demo ? <DemoBand /> : null}
      <ScrollView
        contentContainerStyle={{
          padding: t.density.pad,
          paddingTop: 0,
          paddingBottom: unterkante + 24,
          gap: KARTE_ABSTAND,
        }}
        refreshControl={<RefreshControl refreshing={laedt} onRefresh={() => void laden()} />}
      >
        {jahre.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {jahre.map((j) => {
              const aktiv = j === jahr;
              return (
                <Pressable
                  key={j}
                  onPress={() => setJahr(j)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: aktiv }}
                  style={{
                    paddingVertical: 8,
                    paddingHorizontal: 14,
                    borderRadius: 999,
                    backgroundColor: aktiv ? t.palette.accent : t.palette.surface,
                    borderWidth: 1,
                    borderColor: aktiv ? t.palette.accent : t.palette.line,
                  }}
                >
                  <Txt v="xs" color={aktiv ? t.palette.bg : t.palette.ink} style={{ fontFamily: t.fonts.medium }}>
                    {j}
                  </Txt>
                </Pressable>
              );
            })}
          </ScrollView>
        ) : null}

        {fehler ? (
          <Kachel>
            <Txt v="title">{txt("abr.nichtGeladen")}</Txt>
            <Txt v="sm" soft style={{ marginTop: 4 }}>
              {fehler}
            </Txt>
          </Kachel>
        ) : null}

        {laedt && !items ? (
          <Kachel>
            <Spinner />
          </Kachel>
        ) : null}

        {items?.length === 0 ? (
          <Kachel>
            <Txt v="title">{txt("abr.keine")}</Txt>
            <Txt v="sm" soft style={{ marginTop: 4 }}>
              Sobald Ihre Verwaltung eine Abrechnung abgeschlossen hat, steht sie hier.
            </Txt>
          </Kachel>
        ) : null}

        {items && items.length > 0 && jahr !== null ? (
          <>
            <View style={{ flexDirection: "row", gap: KARTE_ABSTAND }}>
              <SummenKachel titel={txt("abr.summeJahr", { jahr })} summen={summenJeWaehrung(imGewaehltenJahr)} />
              <SummenKachel titel={txt("abr.gesamt")} summen={summenJeWaehrung(items)} />
            </View>
            <Txt v="xs" soft>
              {imGewaehltenJahr.length === 1
                ? txt("abr.eineAbrechnung")
                : txt("abr.anzahlAbrechnungen", { anzahl: imGewaehltenJahr.length })}
            </Txt>
          </>
        ) : null}

        {imGewaehltenJahr.map((z) => (
          <Kachel key={z.id}>
            <Txt v="title">{abrechnungTitel(txt, z)}</Txt>
            <Txt v="eyebrow" soft style={{ marginTop: 8 }}>
              {txt("kennzahl.auszahlung")}
            </Txt>
            <Txt v="h1" style={{ marginTop: 2 }}>
              {formatCurrency(z.owner_payout, z.currency, 2)}
            </Txt>
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 12 }}>
              <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Icon n="cal" s={14} c={t.palette.soft} />
                <Txt v="xs" soft numberOfLines={1} style={{ flexShrink: 1 }}>
                  {spanneLesbar(txt, z.period_from, z.period_to)}
                </Txt>
              </View>
              <Pressable
                onPress={() => navigation.navigate("AbrechnungDetail", { id: z.id, titel: abrechnungTitel(txt, z) })}
                accessibilityRole="button"
                accessibilityLabel={`Beleg ansehen: ${abrechnungTitel(txt, z)}`}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingVertical: 8,
                  paddingHorizontal: 12,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: t.palette.line,
                }}
              >
                <Icon n="doc" s={16} c={t.palette.ink} />
                <Txt v="xs" style={{ fontFamily: t.fonts.semibold }}>
                  Beleg ansehen
                </Txt>
              </Pressable>
            </View>
            {z.invoice_number ? (
              <Txt v="xs" faint style={{ marginTop: 8 }}>
                {statusName(z.status)} · {z.invoice_number}
              </Txt>
            ) : null}
          </Kachel>
        ))}
      </ScrollView>
    </View>
  );
}

/** „Summe 2026" / „Gesamt" — je Währung eine Zeile, nie quer addiert. */
function SummenKachel({ titel, summen }: { titel: string; summen: Summe[] }) {
  return (
    <Kachel style={{ flex: 1 }}>
      <Txt v="xs" soft>
        {titel}
      </Txt>
      {summen.length === 0 ? (
        <Txt v="h2" style={{ marginTop: 6 }}>
          —
        </Txt>
      ) : (
        summen.map((s) => (
          <Txt key={s.currency} v={summen.length > 1 ? "title" : "h2"} style={{ marginTop: 6 }} numberOfLines={1}>
            {formatCurrency(s.betrag, s.currency, 2)}
          </Txt>
        ))
      )}
    </Kachel>
  );
}

// Abrechnungen — die finalisierten Abrechnungen des Eigentümers
// (`GET /public-portal/statements`). Nur abgeschlossene: Entwürfe der
// Verwaltung erscheinen hier nicht, sonst diskutiert jemand über Zahlen, die
// noch geändert werden.
//
// `owner_payout` ist hier NICHT nullable (anders als in „Auszahlungen"): eine
// finalisierte Abrechnung hat einen Betrag, sonst wäre sie nicht finalisiert.
// Die Währung kommt trotzdem aus der Zeile, nie aus einer Konstante (Wurzel 4).
import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";

import { Kachel, Spinner, Txt } from "@/components/ui/kit";
import { formatCurrency } from "@/lib/currency";
import { getOwnerStatements, type PortalStatement } from "@/lib/ownerPortal";
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

export default function Abrechnungen() {
  const t = useTheme();
  const [items, setItems] = useState<PortalStatement[] | null>(null);
  const [laedt, setLaedt] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);

  const laden = useCallback(async () => {
    setFehler(null);
    const res = await getOwnerStatements();
    if (res.ok) setItems(res.data.items);
    else setFehler(res.error);
    setLaedt(false);
  }, []);

  useEffect(() => {
    void laden();
  }, [laden]);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.palette.bg }}
      contentContainerStyle={{ padding: t.density.pad, gap: KARTE_ABSTAND }}
      refreshControl={<RefreshControl refreshing={laedt} onRefresh={() => void laden()} />}
    >
      {fehler ? (
        <Kachel>
          <Txt v="title">Abrechnungen nicht geladen</Txt>
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
          <Txt v="title">Noch keine Abrechnung</Txt>
          <Txt v="sm" soft style={{ marginTop: 4 }}>
            Sobald Ihre Verwaltung eine Abrechnung abgeschlossen hat, steht sie hier.
          </Txt>
        </Kachel>
      ) : null}

      {items?.map((z) => (
        <Kachel key={z.id}>
          <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
            <View style={{ flex: 1 }}>
              <Txt v="title">
                {z.period_from} bis {z.period_to}
              </Txt>
              <Txt v="xs" soft style={{ marginTop: 2 }}>
                {statusName(z.status)}
                {z.invoice_number ? ` · ${z.invoice_number}` : ""}
              </Txt>
            </View>
            <Txt v="h2">{formatCurrency(z.owner_payout, z.currency)}</Txt>
          </View>
        </Kachel>
      ))}
    </ScrollView>
  );
}

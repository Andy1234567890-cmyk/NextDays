// Eigentümer · Auszahlungen. Earnings-Übersicht (Zeitraum) + finalisierte
// Statements. Beträge/Währung AUS DEN DATEN (Wurzel 4): payout = null (Maske
// ohne Beträge-Sicht) → „—", nie 0/Fantasiewert. Realtime: reservations
// (speist Earnings) + owner_statements (neue Abrechnung) — RLS-owner-gefiltert.
import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Card, Col, Divider, Row, Spinner, Txt } from "@/components/ui/kit";
import { formatCurrency } from "@/lib/currency";
import {
  getOwnerEarnings,
  getOwnerStatements,
  type PortalEarnings,
  type PortalStatement,
} from "@/lib/ownerPortal";
import { useRealtime } from "@/lib/realtime";
import { useTheme } from "@/theme/ThemeProvider";

// Lokales YYYY-MM-DD (kein UTC-Shift).
function iso(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

// Maskierter Betrag: null → „—" (Wurzel 4), nie 0.
function money(amount: number | null, currency: string): string {
  return amount == null ? "—" : formatCurrency(amount, currency, 2);
}

function periodLabel(from: string, to: string): string {
  const f = (s: string) => new Date(s).toLocaleDateString("de-DE", { day: "numeric", month: "short" });
  return `${f(from)} – ${f(to)}`;
}

export default function OwnerEarnings() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [earnings, setEarnings] = useState<PortalEarnings | null>(null);
  const [statements, setStatements] = useState<PortalStatement[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    // Fenster: laufendes Kalenderjahr bis heute.
    const now = new Date();
    const from = iso(new Date(now.getFullYear(), 0, 1));
    const to = iso(now);
    const [e, s] = await Promise.all([getOwnerEarnings(from, to), getOwnerStatements()]);
    if (e.ok) setEarnings(e.data);
    else setError(e.error);
    setStatements(s.ok ? s.data.items : []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useRealtime({ table: "reservations", onChange: load });
  useRealtime({ table: "owner_statements", onChange: load });

  if (!earnings && !error) {
    return (
      <View style={{ flex: 1, backgroundColor: t.palette.bg }}>
        <Spinner />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
      <Col style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12 }}>
        <Txt v="h1">Auszahlungen</Txt>
      </Col>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 18 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
      >
        {error && (
          <Txt v="sm" color={t.palette.accent}>
            {error}
          </Txt>
        )}

        {earnings && (
          <Col gap={10}>
            <Txt v="h2">
              Einnahmen · {new Date(earnings.period_from).getFullYear()}
            </Txt>
            <Card style={{ padding: 16, gap: 4 }}>
              <Txt v="xs" soft>
                Auszahlung gesamt (bisher)
              </Txt>
              <Txt v="display" style={{ fontSize: 26 }}>
                {money(earnings.total_payout, earnings.currency)}
              </Txt>
            </Card>

            {earnings.items.length > 0 && (
              <Card style={{ padding: 6 }}>
                {earnings.items.map((it, i) => (
                  <View key={it.property_id}>
                    {i > 0 && <Divider style={{ marginHorizontal: 12 }} />}
                    <Row style={{ padding: 12, gap: 12, alignItems: "center" }}>
                      <Col gap={2} style={{ flex: 1 }}>
                        <Txt v="sm" numberOfLines={1} style={{ fontWeight: "600" }}>
                          {it.title}
                        </Txt>
                        <Txt v="xs" soft>
                          {it.reservations} Buchungen · {it.nights} Nächte
                        </Txt>
                      </Col>
                      <Txt v="sm" style={{ fontWeight: "600" }}>
                        {money(it.payout, it.currency)}
                      </Txt>
                    </Row>
                  </View>
                ))}
              </Card>
            )}
          </Col>
        )}

        <Col gap={10}>
          <Txt v="h2">Abrechnungen</Txt>
          {!statements && <Spinner />}
          {statements && statements.length === 0 && (
            <Txt v="sm" soft>
              Noch keine finalisierten Abrechnungen.
            </Txt>
          )}
          {statements && statements.length > 0 && (
            <Card style={{ padding: 6 }}>
              {statements.map((st, i) => (
                <View key={st.id}>
                  {i > 0 && <Divider style={{ marginHorizontal: 12 }} />}
                  <Row style={{ padding: 12, gap: 12, alignItems: "center" }}>
                    <Col gap={2} style={{ flex: 1 }}>
                      <Txt v="sm" style={{ fontWeight: "600" }}>
                        {periodLabel(st.period_from, st.period_to)}
                      </Txt>
                      <Txt v="xs" soft>
                        {st.invoice_number ? `Nr. ${st.invoice_number}` : st.status}
                      </Txt>
                    </Col>
                    <Txt v="sm" style={{ fontWeight: "600" }}>
                      {formatCurrency(st.owner_payout, st.currency, 2)}
                    </Txt>
                  </Row>
                </View>
              ))}
            </Card>
          )}
        </Col>
      </ScrollView>
    </View>
  );
}

// Eigentümer · Auszahlungen. Earnings-Übersicht (Zeitraum) + finalisierte
// Statements. Beträge/Währung AUS DEN DATEN (Wurzel 4): payout = null (Maske
// ohne Beträge-Sicht) → „—", nie 0/Fantasiewert. Realtime: reservations
// (speist Earnings) + owner_statements (neue Abrechnung) — RLS-owner-gefiltert.
import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Col, Row, Spinner, Txt } from "@/components/ui/kit";
import { EmptyState } from "@/components/ui/patterns";
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

  // NUR reservations: owner_statements ist für `authenticated` bewusst ohne
  // SELECT-Grant (Wurzel 6 — Finanzdaten liest nur der Server, 0187). Ein Abo
  // darauf liefert deshalb NIE ein Event und wäre eine stumme Attrappe, die
  // „live" aussieht. Abrechnungen entstehen serverseitig aus Buchungen, also
  // deckt reservations den realen Auslöser ab; ein reiner Monatslauf ohne
  // Buchungsänderung kommt erst per Pull-to-Refresh an.
  useRealtime({ table: "reservations", onChange: load });

  if (!earnings && !error) {
    return (
      <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top + 40 }}>
        <Spinner />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
      <Col style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16 }}>
        <Txt v="display">Auszahlungen</Txt>
      </Col>

      <ScrollView
        contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 40, gap: 26 }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
      >
        {error && <EmptyState icon="info" titel="Nicht geladen" text={error} />}

        {earnings && (
          <Col gap={16}>
            <Col gap={4}>
              <Txt v="sm" soft>
                Auszahlung gesamt · {new Date(earnings.period_from).getFullYear()}
              </Txt>
              <Txt v="display">{money(earnings.total_payout, earnings.currency)}</Txt>
            </Col>

            {earnings.items.length > 0 && (
              <Col gap={0}>
                {earnings.items.map((it, i) => (
                  <View key={it.property_id}>
                    {i > 0 && <View style={{ height: 1, backgroundColor: t.palette.line }} />}
                    <Row gap={12} style={{ paddingVertical: 14, alignItems: "center" }}>
                      <Col gap={3} style={{ flex: 1 }}>
                        <Txt v="title" numberOfLines={1}>
                          {it.title}
                        </Txt>
                        <Txt v="sm" soft>
                          {it.reservations} Buchungen · {it.nights} Nächte
                        </Txt>
                      </Col>
                      <Txt v="body" style={{ fontFamily: t.fonts.semibold }}>
                        {money(it.payout, it.currency)}
                      </Txt>
                    </Row>
                  </View>
                ))}
              </Col>
            )}
          </Col>
        )}

        <View style={{ height: 1, backgroundColor: t.palette.line }} />

        <Col gap={14}>
          <Txt v="h2">Abrechnungen</Txt>
          {!statements && <Spinner />}
          {statements && statements.length === 0 && (
            <Txt v="body" soft>
              Noch keine finalisierten Abrechnungen.
            </Txt>
          )}
          {statements?.map((st, i) => (
            <View key={st.id}>
              {i > 0 && <View style={{ height: 1, backgroundColor: t.palette.line }} />}
              <Row gap={12} style={{ paddingVertical: 14, alignItems: "center" }}>
                <Col gap={3} style={{ flex: 1 }}>
                  <Txt v="title">{periodLabel(st.period_from, st.period_to)}</Txt>
                  <Txt v="sm" soft>
                    {st.invoice_number ? `Nr. ${st.invoice_number}` : st.status}
                  </Txt>
                </Col>
                <Txt v="body" style={{ fontFamily: t.fonts.semibold }}>
                  {formatCurrency(st.owner_payout, st.currency, 2)}
                </Txt>
              </Row>
            </View>
          ))}
        </Col>
      </ScrollView>
    </View>
  );
}

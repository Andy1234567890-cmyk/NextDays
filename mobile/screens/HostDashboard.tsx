// Gastgeber · Übersicht. Echte KPIs + heutige An-/Abreisen + Anstehendes aus
// GET /api/v1/reservations/dashboard (dieselbe Quelle wie das Web-Dashboard).
// Lade-/Fehler-/Leerzustand getrennt. KEIN Demo-Fallback: eine Übersicht mit
// lauter Nullen ist von einem echten ruhigen Tag nicht zu unterscheiden und
// gibt dem Gastgeber falsche Sicherheit über seinen Betrieb (Wurzel 4). Ist das
// Backend nicht erreichbar, steht das da — mit Wiederholen.
// Beträge/Währung aus den Daten (§4.2: revenue_30d = null → keine Umsatz-Kachel).
import { useCallback, useEffect, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/Icon";
import { Btn, Card, Chip, Col, Divider, IconBtn, Row, Spinner, Txt } from "@/components/ui/kit";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency } from "@/lib/currency";
import { getDashboard, type Dashboard, type DashboardEntry } from "@/lib/dashboard";
import { useRealtime } from "@/lib/realtime";
import { useTheme } from "@/theme/ThemeProvider";

function todayLabel(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

function dayShort(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE", { day: "numeric", month: "short" });
}

export default function HostDashboard() {
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

  if (error) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: t.palette.bg,
          paddingTop: insets.top + 12,
          paddingHorizontal: 20,
        }}
      >
        <Card style={{ padding: 16, gap: 12 }}>
          <Txt v="title">Übersicht nicht geladen</Txt>
          <Txt v="sm" soft>
            {error}
          </Txt>
          <Btn variant="outline" onPress={load}>
            Erneut versuchen
          </Btn>
        </Card>
      </View>
    );
  }

  if (!data) {
    return (
      <View style={{ flex: 1, backgroundColor: t.palette.bg }}>
        <Spinner />
      </View>
    );
  }

  const confirmed = Math.round(data.confirmed_30d.value);
  const revenue = data.revenue_30d;

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg }}>
      <ScrollView
        contentContainerStyle={{
          padding: 20,
          // Echte Safe-Area statt hartkodierter 60 — sonst rutscht die
          // Titelzeile unter Notch/Dynamic Island (gerätabhängig).
          paddingTop: insets.top + 12,
          gap: 18,
          paddingBottom: 40,
        }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
      >
        <Row style={{ justifyContent: "space-between", alignItems: "flex-start" }}>
          <Col gap={2}>
            <Txt v="sm" soft>
              {todayLabel(data.today) || "Übersicht"}
            </Txt>
            <Txt v="h1">{me?.email ? me.email : "Übersicht"}</Txt>
          </Col>
          <IconBtn icon="bell" />
        </Row>

        <Row gap={12}>
          <Kpi
            icon="chart"
            value={`${confirmed}`}
            label="Buchungen · 30 Tage"
            change={data.confirmed_30d.change_pct}
          />
          {revenue && (
            <Kpi
              icon="euro"
              value={formatCurrency(revenue.value, data.currency)}
              label="Umsatz · 30 Tage"
              change={revenue.change_pct}
            />
          )}
        </Row>

        <Section
          title="Heute · Anreisen"
          entries={data.checkins_today}
          empty="Keine Anreisen heute."
          chip="Check-in"
          field="check_in"
          accent
        />
        <Section
          title="Heute · Abreisen"
          entries={data.checkouts_today}
          empty="Keine Abreisen heute."
          chip="Check-out"
          field="check_out"
        />
        <Section
          title="Anstehend"
          entries={data.upcoming}
          empty="Nichts Anstehendes."
          chip=""
          field="check_in"
        />
      </ScrollView>
    </View>
  );
}

function Kpi({
  icon,
  value,
  label,
  change,
}: {
  icon: "chart" | "euro";
  value: string;
  label: string;
  change: number | null;
}) {
  const t = useTheme();
  return (
    <Card style={{ flex: 1, padding: 16, gap: 4 }}>
      <Icon n={icon} s={18} sw={1.8} c={t.palette.accent} />
      <Txt v="display" style={{ fontSize: 26 }}>
        {value}
      </Txt>
      <Txt v="xs" soft>
        {label}
      </Txt>
      {change !== null && (
        <Txt v="xs" color={change >= 0 ? "#1F8A5B" : t.palette.accent}>
          {change >= 0 ? "+" : ""}
          {Math.round(change)}%
        </Txt>
      )}
    </Card>
  );
}

function Section({
  title,
  entries,
  empty,
  chip,
  field,
  accent,
}: {
  title: string;
  entries: DashboardEntry[];
  empty: string;
  chip: string;
  field: "check_in" | "check_out";
  accent?: boolean;
}) {
  return (
    <Col gap={10}>
      <Txt v="h2">{title}</Txt>
      {entries.length === 0 ? (
        <Txt v="sm" soft>
          {empty}
        </Txt>
      ) : (
        <Card style={{ padding: 6 }}>
          {entries.map((e, i) => (
            <View key={e.reservation_id}>
              {i > 0 && <Divider style={{ marginHorizontal: 12 }} />}
              <Row style={{ padding: 12, gap: 12, alignItems: "center" }}>
                <Col gap={1} style={{ flex: 1 }}>
                  <Txt v="sm" numberOfLines={1} style={{ fontWeight: "600" }}>
                    {e.guest_name || "Gast"}
                  </Txt>
                  <Txt v="xs" soft numberOfLines={1}>
                    {e.property_title} · {dayShort(e[field])}
                  </Txt>
                </Col>
                {chip ? <Chip variant={accent ? "accent" : ""}>{chip}</Chip> : null}
              </Row>
            </View>
          ))}
        </Card>
      )}
    </Col>
  );
}

// Eigentümer · Kalender (read-only). Monatsbelegung der EIGENEN Objekte aus
// GET /public-portal/calendar; der Owner kann nur ansehen, nichts setzen.
// Preis nur, wenn der Server ihn liefert (Maske) — symbollos ohne Währung
// (Wurzel 4). Realtime: availability + reservations (RLS-owner-gefiltert).
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/Icon";
import { Col, Row, Spinner, Txt } from "@/components/ui/kit";
import { formatCurrency } from "@/lib/currency";
import {
  getOwnerCalendar,
  getOwnerProperties,
  type PortalCalendarDay,
  type PortalProperty,
} from "@/lib/ownerPortal";
import { useRealtime } from "@/lib/realtime";
import { useTheme } from "@/theme/ThemeProvider";

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

// LOKALES Kalenderdatum (kein toISOString → keine UTC-Verschiebung, wie
// HostCalendar/P2.1).
function iso(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function monthGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < lead; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  return cells;
}

export default function OwnerCalendar() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [props, setProps] = useState<PortalProperty[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [days, setDays] = useState<Map<string, PortalCalendarDay> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getOwnerProperties().then((res) => {
      if (res.ok) {
        setProps(res.data.items);
        if (res.data.items.length > 0) setSelected(res.data.items[0].id);
      } else {
        setProps([]);
        setError(res.error);
      }
    });
  }, []);

  const cells = useMemo(() => monthGrid(month.year, month.month), [month]);

  const loadMonth = useCallback(async () => {
    if (!selected) return;
    setDays(null);
    const start = iso(new Date(month.year, month.month, 1));
    const end = iso(new Date(month.year, month.month + 1, 1));
    const res = await getOwnerCalendar(selected, start, end);
    if (res.ok) {
      setDays(new Map(res.data.days.map((d) => [d.date, d])));
      setError(null);
    } else {
      setDays(new Map());
      setError(res.error);
    }
  }, [selected, month]);

  useEffect(() => {
    loadMonth();
  }, [loadMonth]);

  useRealtime({ table: "availability", onChange: loadMonth });
  useRealtime({ table: "reservations", onChange: loadMonth });

  const dayColor = (status: string): string => {
    if (status === "booked") return t.palette.accent;
    if (status === "blocked") return t.palette.ink;
    return t.palette.surface2;
  };
  const dayTextColor = (status: string): string =>
    status === "open" ? t.palette.soft : "#fff";

  const monthLabel = new Date(month.year, month.month, 1).toLocaleDateString("de-DE", {
    month: "long",
    year: "numeric",
  });

  const step = (delta: number) =>
    setMonth((m) => {
      const d = new Date(m.year, m.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
      <Col style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12, gap: 12 }}>
        <Txt v="h1">Kalender</Txt>

        {props && props.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <Row gap={8}>
              {props.map((p) => {
                const active = p.id === selected;
                return (
                  <Pressable key={p.id} onPress={() => setSelected(p.id)}>
                    <View
                      style={{
                        paddingVertical: 7,
                        paddingHorizontal: 14,
                        borderRadius: 999,
                        backgroundColor: active ? t.palette.accent : t.palette.surface2,
                      }}
                    >
                      <Txt v="sm" color={active ? "#fff" : t.palette.ink} numberOfLines={1}>
                        {p.title}
                      </Txt>
                    </View>
                  </Pressable>
                );
              })}
            </Row>
          </ScrollView>
        )}

        <Row style={{ justifyContent: "space-between", alignItems: "center" }}>
          <Pressable onPress={() => step(-1)} hitSlop={12}>
            <Icon n="back" s={20} sw={2} c={t.palette.soft} />
          </Pressable>
          <Txt v="title">{monthLabel}</Txt>
          <Pressable onPress={() => step(1)} hitSlop={12}>
            <Icon n="fwd" s={20} sw={2} c={t.palette.soft} />
          </Pressable>
        </Row>
      </Col>

      {!props && <Spinner />}
      {props && props.length === 0 && (
        <Txt v="sm" soft style={{ textAlign: "center", marginTop: 40 }}>
          {error ?? "Dir sind noch keine Objekte zugeordnet."}
        </Txt>
      )}

      {props && props.length > 0 && (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
          <Row style={{ marginBottom: 6 }}>
            {WEEKDAYS.map((w) => (
              <Txt key={w} v="xs" faint style={{ flex: 1, textAlign: "center" }}>
                {w}
              </Txt>
            ))}
          </Row>

          {!days && <Spinner />}
          {days && (
            <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
              {cells.map((cell, i) => {
                if (!cell) return <View key={`e${i}`} style={{ width: `${100 / 7}%`, height: 52 }} />;
                const info = days.get(iso(cell));
                const status = info?.status ?? "open";
                return (
                  <View key={iso(cell)} style={{ width: `${100 / 7}%`, padding: 2 }}>
                    <View
                      style={{
                        height: 48,
                        borderRadius: 10,
                        backgroundColor: dayColor(status),
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 1,
                      }}
                    >
                      <Txt v="xs" color={dayTextColor(status)} style={{ fontWeight: "600" }}>
                        {cell.getDate()}
                      </Txt>
                      {info?.price != null && status === "open" && (
                        <Txt v="xs" faint style={{ fontSize: 8 }}>
                          {formatCurrency(info.price, null)}
                        </Txt>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )}

          {error && (
            <Txt v="xs" soft style={{ marginTop: 12, textAlign: "center" }}>
              {error}
            </Txt>
          )}

          <Row gap={16} style={{ marginTop: 16, justifyContent: "center" }}>
            <Legend color={t.palette.surface2} label="frei" />
            <Legend color={t.palette.accent} label="belegt" />
            <Legend color={t.palette.ink} label="gesperrt" />
          </Row>
        </ScrollView>
      )}
    </View>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <Row gap={6} style={{ alignItems: "center" }}>
      <View style={{ width: 14, height: 14, borderRadius: 4, backgroundColor: color }} />
      <Txt v="xs" soft>
        {label}
      </Txt>
    </Row>
  );
}

// Eigentümer · Anfragen. Drei gebündelte Aufgaben (kein Tab-Zoo): Sperr-Anfrage
// stellen (Objekt + Zeitraum), Status der eigenen Anfragen, Zählerstand
// erfassen — plus Konto/Logout unten. POST-Aktionen sind gegen Doppel-Submit
// gesperrt (busy-Guard, Wurzel 2). Realtime: block_requests + meter_readings
// (RLS-owner-gefiltert). Datum als YYYY-MM-DD (kein Date-Picker-Package →
// kein neuer Native-Build); ungültig → klar fehlschlagen, nichts erfinden.
import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Btn, Card, Col, Divider, Row, Spinner, Txt } from "@/components/ui/kit";
import { useAuth } from "@/contexts/AuthContext";
import {
  createBlockRequest,
  createMeterReading,
  getBlockRequests,
  getMeterReadings,
  getOwnerProperties,
  type BlockRequest,
  type MeterReading,
  type PortalProperty,
} from "@/lib/ownerPortal";
import { useRealtime } from "@/lib/realtime";
import { useTheme } from "@/theme/ThemeProvider";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Strenge Datumsprüfung: Format UND echter Kalendertag (2026-02-31 wird
// abgelehnt). Kein „reparieren", kein Default (Wurzel 4).
function validDate(s: string): boolean {
  if (!DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00`);
  if (Number.isNaN(d.getTime())) return false;
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}` === s;
}

export default function OwnerRequests() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { me, logout } = useAuth();

  const [props, setProps] = useState<PortalProperty[] | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [requests, setRequests] = useState<BlockRequest[] | null>(null);
  const [readings, setReadings] = useState<MeterReading[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  // Alle drei Ladepfade zeigen Fehler sichtbar an. Vorher wurde jeder Fehler zu
  // einer leeren Liste — der Eigentümer sah „keine Anfragen" / „keine
  // Zählerstände", obwohl die App sie nur nicht laden konnte (Wurzel 4/5).
  const loadProps = useCallback(async () => {
    const res = await getOwnerProperties();
    if (res.ok) {
      setProps(res.data.items);
      setSelected((cur) => cur ?? res.data.items[0]?.id ?? null);
      setFehler(null);
    } else {
      setProps(null);
      setFehler(res.error);
    }
  }, []);

  const loadRequests = useCallback(async () => {
    const res = await getBlockRequests();
    if (res.ok) {
      setRequests(res.data.items);
      setFehler(null);
    } else {
      setRequests(null);
      setFehler(res.error);
    }
  }, []);

  const loadReadings = useCallback(async () => {
    if (!selected) {
      // Kein Objekt gewählt ist echter Leerstand, kein Fehler.
      setReadings([]);
      return;
    }
    const res = await getMeterReadings(selected);
    if (res.ok) {
      setReadings(res.data.items);
      setFehler(null);
    } else {
      setReadings(null);
      setFehler(res.error);
    }
  }, [selected]);

  useEffect(() => {
    loadProps();
  }, [loadProps]);
  useEffect(() => {
    loadRequests();
  }, [loadRequests]);
  useEffect(() => {
    loadReadings();
  }, [loadReadings]);

  useRealtime({ table: "block_requests", onChange: loadRequests });
  useRealtime({ table: "meter_readings", onChange: loadReadings });

  const onRefresh = () => {
    loadProps();
    loadRequests();
    loadReadings();
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
      <Col style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: 12 }}>
        <Txt v="h1">Anfragen</Txt>
      </Col>

      {fehler && (
        <Card style={{ padding: 16, gap: 12 }}>
          <Txt v="title">Nicht geladen</Txt>
          <Txt v="sm" soft>
            {fehler}
          </Txt>
          <Btn variant="outline" onPress={onRefresh}>
            Erneut versuchen
          </Btn>
        </Card>
      )}
      {!props && !fehler && <Spinner />}
      {props && props.length === 0 && (
        <Txt v="sm" soft style={{ textAlign: "center", marginTop: 40 }}>
          Dir sind noch keine Objekte zugeordnet.
        </Txt>
      )}

      {props && props.length > 0 && (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, gap: 22 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={false} onRefresh={onRefresh} />}
        >
          <PropertyPicker props={props} selected={selected} onSelect={setSelected} />

          <BlockForm
            propertyId={selected}
            onDone={loadRequests}
          />

          <RequestList requests={requests} propsById={props} />

          <MeterForm propertyId={selected} onDone={loadReadings} />

          <ReadingList readings={readings} />

          <Btn
            variant="ghost"
            block
            icon="key"
            onPress={() => {
              logout();
            }}
          >
            {me?.email ? `Abmelden (${me.email})` : "Abmelden"}
          </Btn>
        </ScrollView>
      )}
    </View>
  );
}

function PropertyPicker({
  props,
  selected,
  onSelect,
}: {
  props: PortalProperty[];
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const t = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <Row gap={8}>
        {props.map((p) => {
          const active = p.id === selected;
          return (
            <Pressable key={p.id} onPress={() => onSelect(p.id)}>
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
  );
}

function field(t: ReturnType<typeof useTheme>) {
  return {
    backgroundColor: t.palette.surface,
    borderWidth: 1,
    borderColor: t.palette.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: t.palette.ink,
    flex: 1,
  } as const;
}

function BlockForm({ propertyId, onDone }: { propertyId: string | null; onDone: () => void }) {
  const t = useTheme();
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const submit = async () => {
    if (busy) return; // Doppel-Submit-Sperre (Wurzel 2)
    if (!propertyId) {
      setMsg("Bitte ein Objekt wählen.");
      return;
    }
    if (!validDate(start) || !validDate(end)) {
      setMsg("Bitte gültige Daten (JJJJ-MM-TT) eingeben.");
      return;
    }
    if (end < start) {
      setMsg("Enddatum liegt vor dem Startdatum.");
      return;
    }
    setBusy(true);
    setMsg(null);
    const res = await createBlockRequest({
      property_id: propertyId,
      start_date: start,
      end_date: end,
    });
    setBusy(false);
    if (res.ok) {
      setStart("");
      setEnd("");
      setMsg("Anfrage gestellt.");
      onDone();
    } else {
      setMsg(res.error);
    }
  };

  return (
    <Col gap={10}>
      <Txt v="h2">Sperrzeit beantragen</Txt>
      <Row gap={8}>
        <TextInput
          style={field(t)}
          placeholder="Von (JJJJ-MM-TT)"
          placeholderTextColor={t.palette.faint}
          autoCapitalize="none"
          value={start}
          onChangeText={setStart}
          editable={!busy}
        />
        <TextInput
          style={field(t)}
          placeholder="Bis (JJJJ-MM-TT)"
          placeholderTextColor={t.palette.faint}
          autoCapitalize="none"
          value={end}
          onChangeText={setEnd}
          editable={!busy}
        />
      </Row>
      {msg && (
        <Txt v="xs" color={t.palette.accent}>
          {msg}
        </Txt>
      )}
      <Btn variant="primary" block icon="plus" onPress={busy ? undefined : submit}>
        {busy ? "Wird gesendet …" : "Sperrzeit beantragen"}
      </Btn>
    </Col>
  );
}

function RequestList({
  requests,
  propsById,
}: {
  requests: BlockRequest[] | null;
  propsById: PortalProperty[];
}) {
  const t = useTheme();
  const title = (id: string) => propsById.find((p) => p.id === id)?.title ?? "Objekt";
  if (!requests) return null; // Fehler/Ladezustand zeigt der Rahmen oben
  if (requests.length === 0) {
    return (
      <Txt v="sm" soft>
        Noch keine Sperr-Anfragen.
      </Txt>
    );
  }
  return (
    <Card style={{ padding: 6 }}>
      {requests.map((r, i) => (
        <View key={r.id}>
          {i > 0 && <Divider style={{ marginHorizontal: 12 }} />}
          <Row style={{ padding: 12, gap: 12, alignItems: "center" }}>
            <Col gap={2} style={{ flex: 1 }}>
              <Txt v="sm" numberOfLines={1} style={{ fontWeight: "600" }}>
                {title(r.property_id)}
              </Txt>
              <Txt v="xs" soft>
                {r.start_date} – {r.end_date}
              </Txt>
            </Col>
            <Txt v="xs" color={r.status === "approved" ? "#1F8A5B" : t.palette.soft}>
              {r.status}
            </Txt>
          </Row>
        </View>
      ))}
    </Card>
  );
}

function MeterForm({ propertyId, onDone }: { propertyId: string | null; onDone: () => void }) {
  const t = useTheme();
  const [kind, setKind] = useState("");
  const [value, setValue] = useState("");
  const [readAt, setReadAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const submit = async () => {
    if (busy) return; // Doppel-Submit-Sperre (Wurzel 2)
    if (!propertyId) {
      setMsg("Bitte ein Objekt wählen.");
      return;
    }
    const num = Number(value.replace(",", "."));
    if (!kind.trim() || !Number.isFinite(num) || num < 0) {
      setMsg("Zählerart und ein gültiger Wert (≥ 0) sind Pflicht.");
      return;
    }
    if (!validDate(readAt)) {
      setMsg("Bitte ein gültiges Ablesedatum (JJJJ-MM-TT).");
      return;
    }
    setBusy(true);
    setMsg(null);
    const res = await createMeterReading({
      property_id: propertyId,
      meter_kind: kind.trim(),
      value: num,
      read_at: readAt,
    });
    setBusy(false);
    if (res.ok) {
      setKind("");
      setValue("");
      setReadAt("");
      setMsg("Zählerstand erfasst.");
      onDone();
    } else {
      setMsg(res.error);
    }
  };

  return (
    <Col gap={10}>
      <Txt v="h2">Zählerstand erfassen</Txt>
      <TextInput
        style={{ ...field(t), flex: undefined }}
        placeholder="Zählerart (z. B. Strom, Wasser)"
        placeholderTextColor={t.palette.faint}
        value={kind}
        onChangeText={setKind}
        editable={!busy}
      />
      <Row gap={8}>
        <TextInput
          style={field(t)}
          placeholder="Wert"
          placeholderTextColor={t.palette.faint}
          keyboardType="decimal-pad"
          value={value}
          onChangeText={setValue}
          editable={!busy}
        />
        <TextInput
          style={field(t)}
          placeholder="Datum (JJJJ-MM-TT)"
          placeholderTextColor={t.palette.faint}
          autoCapitalize="none"
          value={readAt}
          onChangeText={setReadAt}
          editable={!busy}
        />
      </Row>
      {msg && (
        <Txt v="xs" color={t.palette.accent}>
          {msg}
        </Txt>
      )}
      <Btn variant="primary" block icon="plus" onPress={busy ? undefined : submit}>
        {busy ? "Wird gespeichert …" : "Zählerstand speichern"}
      </Btn>
    </Col>
  );
}

function ReadingList({ readings }: { readings: MeterReading[] | null }) {
  if (!readings) return null; // Fehler/Ladezustand zeigt der Rahmen oben
  if (readings.length === 0) {
    return (
      <Txt v="sm" soft>
        Noch keine Zählerstände für dieses Objekt.
      </Txt>
    );
  }
  return (
    <Card style={{ padding: 6 }}>
      {readings.map((r, i) => (
        <View key={r.id}>
          {i > 0 && <Divider style={{ marginHorizontal: 12 }} />}
          <Row style={{ padding: 12, gap: 12, alignItems: "center" }}>
            <Col gap={2} style={{ flex: 1 }}>
              <Txt v="sm" style={{ fontWeight: "600" }}>
                {r.meter_kind}
              </Txt>
              <Txt v="xs" soft>
                {r.read_at}
              </Txt>
            </Col>
            <Txt v="sm" style={{ fontWeight: "600" }}>
              {r.value}
            </Txt>
          </Row>
        </View>
      ))}
    </Card>
  );
}

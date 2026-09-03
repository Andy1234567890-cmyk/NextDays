// Eigentümer · Anfragen. Drei gebündelte Aufgaben (kein Tab-Zoo): Sperr-Anfrage
// stellen (Objekt + Zeitraum), Status der eigenen Anfragen, Zählerstand
// erfassen — plus Konto/Logout unten. POST-Aktionen sind gegen Doppel-Submit
// gesperrt (busy-Guard, Wurzel 2). Realtime: availability + meter_readings
// (RLS-owner-gefiltert; block_requests ist seit 0332 gesperrt, siehe unten).
// Datum als YYYY-MM-DD (kein Date-Picker-Package →
// kein neuer Native-Build); ungültig → klar fehlschlagen, nichts erfinden.
import { useCallback, useEffect, useState } from "react";
import { Pressable, RefreshControl, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Btn, Col, Row, Spinner, Txt } from "@/components/ui/kit";
import { EmptyState } from "@/components/ui/patterns";
import { useAuth } from "@/contexts/AuthContext";
import {
  type BestellteLeistung,
  createBlockRequest,
  createMeterReading,
  getBestellbareLeistungen,
  getBlockRequests,
  getMeterReadings,
  getOwnerProperties,
  type BlockRequest,
  type MeterReading,
  type PortalProperty,
} from "@/lib/ownerPortal";
import { useRealtime } from "@/lib/realtime";
import { useUnterkante } from "@/lib/unterkante";
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
  // Unten frei bleiben MUSS die Tab-Leiste (lib/unterkante).
  const unterkante = useUnterkante();
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

  // NICHT `block_requests`: seit 0332 hat `authenticated` dort kein SELECT mehr
  // (die Zeilen tragen jetzt Begründung und interne Entscheidungsnotiz, Wurzel
  // 6) — ein Abo darauf wäre eine stumme Attrappe. Erlaubte Ersatz-Quelle ist
  // `availability`: die Genehmigung eines Antrags schreibt dort die gesperrten
  // Nächte, also genau die Wirkung, auf die diese Liste reagieren muss.
  useRealtime({ table: "availability", onChange: loadRequests });
  useRealtime({ table: "meter_readings", onChange: loadReadings });

  const onRefresh = () => {
    loadProps();
    loadRequests();
    loadReadings();
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
      <Col style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 16 }}>
        <Txt v="display">Anfragen</Txt>
      </Col>

      {fehler && (
        <EmptyState icon="info" titel="Nicht geladen" text={fehler}>
          <Btn variant="outline" onPress={onRefresh} style={{ marginTop: 6 }}>
            Erneut versuchen
          </Btn>
        </EmptyState>
      )}
      {!props && !fehler && <Spinner />}
      {props && props.length === 0 && (
        <Txt v="sm" soft style={{ textAlign: "center", marginTop: 40 }}>
          Dir sind noch keine Objekte zugeordnet.
        </Txt>
      )}

      {props && props.length > 0 && (
        <ScrollView
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: unterkante + 24, gap: 22 }}
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
  // Bestellte Leistungen (0510/0538): ohne Bestellung entsteht zur Sperre
  // KEINE Aufgabe; die Verwaltung genehmigt jede bestellte einzeln. Bis 0538
  // kannte diese App das Feld nicht — ein Antrag von hier erzeugte garantiert
  // keine Reinigung.
  const [leistungen, setLeistungen] = useState<BestellteLeistung[]>([]);
  const [bestellt, setBestellt] = useState<string[]>([]);
  const [leistungenFehler, setLeistungenFehler] = useState<string | null>(null);

  useEffect(() => {
    if (!propertyId) {
      setLeistungen([]);
      setBestellt([]);
      return;
    }
    let aktuell = true;
    void getBestellbareLeistungen(propertyId).then((res) => {
      if (!aktuell) return;
      if (res.ok) {
        setLeistungen(res.data.items);
        setLeistungenFehler(null);
      } else {
        // Ladefehler ≠ „nichts bestellbar" (Wurzel 4/5).
        setLeistungen([]);
        setLeistungenFehler(res.error);
      }
      setBestellt([]);
    });
    return () => {
      aktuell = false;
    };
  }, [propertyId]);

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
      bestellte_leistungen: bestellt,
    });
    setBusy(false);
    if (res.ok) {
      setStart("");
      setEnd("");
      setBestellt([]);
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
      {leistungenFehler ? (
        <Txt v="xs" color={t.palette.accent}>
          {leistungenFehler}
        </Txt>
      ) : leistungen.length > 0 ? (
        <Col gap={4}>
          <Txt v="sm">Leistungen bestellen</Txt>
          <Txt v="xs" color={t.palette.faint}>
            Nur was Sie ankreuzen, wird zu Ihrer Sperrung ausgeführt und abgerechnet — sobald
            Ihre Verwaltung es genehmigt hat.
          </Txt>
          {leistungen.map((l) => {
            const aktiv = bestellt.includes(l.rule_id);
            return (
              <Pressable
                key={l.rule_id}
                disabled={busy}
                onPress={() =>
                  setBestellt((alt) =>
                    aktiv ? alt.filter((x) => x !== l.rule_id) : [...alt, l.rule_id],
                  )
                }
                accessibilityRole="checkbox"
                accessibilityState={{ checked: aktiv }}
                accessibilityLabel={l.name}
                style={{ paddingVertical: 6 }}
              >
                <Txt v="sm" color={aktiv ? t.palette.accent : t.palette.ink}>
                  {aktiv ? "☑ " : "☐ "}
                  {l.name}
                </Txt>
              </Pressable>
            );
          })}
        </Col>
      ) : null}
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
    <Col gap={0}>
      {requests.map((r, i) => (
        <View key={r.id}>
          {i > 0 && <View style={{ height: 1, backgroundColor: t.palette.line }} />}
          <Row gap={12} style={{ paddingVertical: 14, alignItems: "center" }}>
            <Col gap={3} style={{ flex: 1 }}>
              <Txt v="title" numberOfLines={1}>
                {title(r.property_id)}
              </Txt>
              <Txt v="sm" soft>
                {r.start_date} – {r.end_date}
              </Txt>
            </Col>
            <Txt v="sm" color={r.status === "approved" ? "#1F8A5B" : t.palette.soft}>
              {r.status}
            </Txt>
          </Row>
        </View>
      ))}
    </Col>
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
  const t = useTheme();
  if (!readings) return null; // Fehler/Ladezustand zeigt der Rahmen oben
  if (readings.length === 0) {
    return (
      <Txt v="sm" soft>
        Noch keine Zählerstände für dieses Objekt.
      </Txt>
    );
  }
  return (
    <Col gap={0}>
      {readings.map((r, i) => (
        <View key={r.id}>
          {i > 0 && <View style={{ height: 1, backgroundColor: t.palette.line }} />}
          <Row gap={12} style={{ paddingVertical: 14, alignItems: "center" }}>
            <Col gap={3} style={{ flex: 1 }}>
              <Txt v="title">{r.meter_kind}</Txt>
              <Txt v="sm" soft>
                {r.read_at}
              </Txt>
            </Col>
            <Txt v="body" style={{ fontFamily: t.fonts.semibold }}>
              {r.value}
            </Txt>
          </Row>
        </View>
      ))}
    </Col>
  );
}

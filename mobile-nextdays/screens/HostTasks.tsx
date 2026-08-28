// Aufgaben — Liste. Zwei Sichten je nach Berechtigung (lib/permissions.can):
//   - VIEW_OWN_TASKS (staff/cleaner): „Meine Aufgaben" (/tasks/mine)
//   - MANAGE_TASKS  (admin/co_admin): zusätzlich „Team" (/tasks/team) und die
//     Filter über Objekt/Person.
// Den Arbeitszustand meldet JEDE zuständige Person (annehmen · anfangen ·
// abschließen): PATCH /status verlangt seit 0360 nur `VIEW_OWN_TASKS`, den
// Objekt-Scope erzwingt der Server (fremde Aufgabe = 404, Wurzel 9). Die App
// hatte den Wechsler auf Verwalter beschränkt — eine Reinigungskraft konnte
// „ich bin dran" nicht sagen, obwohl der Zustand genau für sie gebaut wurde.
//
// Aufbau wie im Web (`/reservierungen/aufgaben/team`): dieselben drei
// Zeit-Reiter AKTUELL · BEVORSTEHENDE · ABGESCHLOSSEN (`status_bucket`, die
// Einteilung nimmt der Server vor) und dieselben Filter (Objekt, Zuständige).
// Die Zeilen sind nach TAG gruppiert und tragen Zeitfenster, Objekt, Buchung,
// Fortschritt — die Referenz-Apps (Breezeway/Turno) machen es ebenso, und ohne
// Datum war die Liste eine Aneinanderreihung gleich aussehender Titel.
//
// Der Aufgaben-Kalender ist dieselbe Datenlage in Wochenansicht; der Umschalter
// oben rechts führt hin (kein sechster Tab, Regel „max 5").
//
// Offene VERTRETUNGSANFRAGEN stehen als Band über der Liste. Sie sind sonst
// unsichtbar: eine Anfrage landet in `task_substitutions`, und es gibt dafür
// weder eine Web-Oberfläche noch eine Benachrichtigung — wer fragt, fragt ins
// Leere, solange niemand die Liste öffnet. Hier ist der richtige Ort, weil die
// Person, die einspringen kann, mit dem Telefon arbeitet.
// TaskListItem trägt KEINE Gast-PII/Beträge (§4.3). Statuswechsel ist gegen
// Doppel-Tap gesperrt (Wurzel 2).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AufgabeKarte } from "@/components/aufgaben/AufgabeKarte";
import { Icon } from "@/components/ui/Icon";
import { Chip, Col, IconBtn, Row, Segmented, Spinner, Txt } from "@/components/ui/kit";
import { EmptyState, Sheet } from "@/components/ui/patterns";
import { useAuth } from "@/contexts/AuthContext";
import { protokolliereAbsturz } from "@/lib/absturzmeldung";
import { aufgabenTag, gruppiereNachTag, tagLabel } from "@/lib/aufgaben-agenda";
import { AUFGABE_STATUS_LABEL, naechsterStatus } from "@/lib/aufgabenstatus";
import { heuteIso } from "@/lib/kalendertag";
import { can } from "@/lib/permissions";
import { listProperties, type Property } from "@/lib/properties";
import { useRealtime } from "@/lib/realtime";
import {
  acceptSubstitution,
  declineSubstitution,
  listMyTasks,
  listSubstitutions,
  listTaskAssignees,
  listTeamTasks,
  mitarbeiterOptionen,
  setTaskStatus,
  type StatusBucket,
  type TaskListItem,
  type Vertretung,
} from "@/lib/tasks";
import { useUnterkante } from "@/lib/unterkante";
import { useTheme } from "@/theme/ThemeProvider";

// Die Reiter des Webs, gleiche Reihenfolge und gleiche Server-Schlüssel.
const BUCKETS: { key: StatusBucket; label: string }[] = [
  { key: "current", label: "Aktuell" },
  { key: "upcoming", label: "Bevorstehend" },
  { key: "done", label: "Erledigt" },
];

export default function HostTasks({ navigation }: { navigation: any }) {
  const t = useTheme();
  // Unten frei bleiben MUSS die Tab-Leiste (lib/unterkante).
  const unterkante = useUnterkante();
  const insets = useSafeAreaInsets();
  const { me } = useAuth();
  const canManage = can(me, "manage_tasks");
  const darfVertretung = can(me, "request_substitute");
  const heute = heuteIso();

  // Verwalter starten in der TEAM-Sicht, Mitarbeiter bei sich selbst.
  //
  // Vorher stand hier `useState(false)`, also „Meine" für jeden. Für einen
  // Verwalter ist das die falsche Frage: er will den Betrieb sehen, nicht seine
  // persönliche Liste. Live gemessen (23.08.2026) sah ein co_admin dadurch 33
  // von 57 offenen Aufgaben — die übrigen 24 hingen an anderen Zuständigen und
  // waren im Einstieg nicht zu erkennen. Gemeldet wurde das als „es werden
  // nicht alle Aufgaben angezeigt", und genau so sah es auch aus.
  //
  // Der Startwert kann nicht direkt `canManage` sein: `me` kommt asynchron und
  // ist im ersten Rendern `null`, `can()` also `false`. Deshalb zieht der
  // Effekt unten einmalig nach, sobald die Rolle da ist — und nur dann, damit
  // eine spätere Wahl des Nutzers nicht überschrieben wird.
  const [team, setTeam] = useState(false);
  const teamVorgabe = useRef(false);
  const [bucket, setBucket] = useState<StatusBucket>("current");
  const [liste, setListe] = useState<TaskListItem[] | null>(null);
  // Grund, warum die Liste leer ist — null = kein Fehler, wirklich leer.
  const [fehler, setFehler] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Filter (wie die drei Auswahlfelder im Web). Objekte kann jede Sicht
  // filtern, Personen nur die Team-Sicht — in „Meine" ist der Zuständige man
  // selbst, ein Personenfilter wäre dort sinnlos.
  const [objekte, setObjekte] = useState<Property[]>([]);
  const [leute, setLeute] = useState<{ value: string; label: string }[]>([]);
  const [objektFilter, setObjektFilter] = useState<string[]>([]);
  const [personFilter, setPersonFilter] = useState<string[]>([]);
  const [filterOffen, setFilterOffen] = useState(false);
  const [vertretungen, setVertretungen] = useState<Vertretung[]>([]);
  const [vertretungenOffen, setVertretungenOffen] = useState(false);
  const [vBusy, setVBusy] = useState<string | null>(null);
  const scroller = useRef<ScrollView | null>(null);

  const load = useCallback(async () => {
    const res = team
      ? await listTeamTasks({
          status_bucket: bucket,
          property_ids: objektFilter,
          assignee_ids: personFilter,
        })
      : await listMyTasks({ status_bucket: bucket, property_ids: objektFilter });
    // Wurzel 5: ein Ladefehler ist NICHT „keine Aufgaben". Vorher stand hier
    // `res.ok ? res.data : []` — ein 401 (abgelaufene Sitzung), 403 oder 503
    // wurde damit zur leeren Liste samt beruhigendem „Dir ist gerade keine
    // Aufgabe zugewiesen". Der Nutzer sieht dann nichts zum Antippen und
    // schließt, die App könne keine Aufgaben bearbeiten.
    if (!res.ok) {
      setFehler(res.error);
      setListe([]);
      return;
    }
    setFehler(null);
    setListe(res.data);
  }, [team, bucket, objektFilter, personFilter]);

  // Einmalig auf „Team" stellen, sobald die Rolle bekannt ist. `teamVorgabe`
  // verhindert, dass ein Nutzer, der bewusst auf „Meine" zurückgeschaltet hat,
  // beim nächsten Rollen-Update wieder umgeworfen wird.
  useEffect(() => {
    if (teamVorgabe.current || !canManage) return;
    teamVorgabe.current = true;
    setTeam(true);
  }, [canManage]);

  useEffect(() => {
    setListe(null);
    load();
  }, [load]);

  // Die Filter-Auswahllisten holt nur, wer sie braucht: ohne `manage_tasks`
  // gibt es weder einen Personenfilter (der Zuständige ist man selbst) noch ein
  // Recht auf die Objektliste — der Aufruf wäre ein sicherer 403.
  useEffect(() => {
    if (!canManage) return;
    listProperties()
      .then((r) => {
        if (r.ok) setObjekte(r.data.items);
      })
      .catch(protokolliereAbsturz);
    listTaskAssignees()
      .then((r) => {
        if (r.ok) setLeute(mitarbeiterOptionen(r.data));
      })
      .catch(protokolliereAbsturz);
  }, [canManage]);

  // Offene Vertretungsanfragen. `request_substitute` haben die Rollen, die
  // einspringen können; ohne das Recht antwortet der Server mit 403, deshalb
  // wird gar nicht gefragt.
  const ladeVertretungen = useCallback(async () => {
    if (!darfVertretung) return;
    const res = await listSubstitutions();
    setVertretungen(res.ok ? res.data : []);
  }, [darfVertretung]);

  useEffect(() => {
    ladeVertretungen();
  }, [ladeVertretungen]);

  // tasks speist beide Listen (eigene + Team). RLS begrenzt auf den Tenant und
  // — für Mitarbeiter — auf die eigenen Zuweisungen.
  useRealtime({ table: "tasks", onChange: load });
  // Eine neue Anfrage soll auftauchen, ohne dass jemand die Seite neu öffnet.
  useRealtime({
    table: "task_substitutions",
    onChange: ladeVertretungen,
    enabled: darfVertretung,
  });

  const vertretungEntscheiden = async (v: Vertretung, uebernehmen: boolean) => {
    if (vBusy) return; // Doppel-Tap-Sperre (Wurzel 2)
    setVBusy(v.id);
    const res = uebernehmen
      ? await acceptSubstitution(v.id)
      : await declineSubstitution(v.id);
    setVBusy(null);
    if (!res.ok) {
      // 409 heißt „schon entschieden" — ein Kollege war schneller. Die Meldung
      // kommt vom Server und wird nicht durch eine eigene ersetzt.
      Alert.alert("Nicht möglich", res.error);
      await ladeVertretungen();
      return;
    }
    await ladeVertretungen();
    // Übernommen heißt: die Aufgabe hängt jetzt an mir — die Liste ändert sich.
    if (uebernehmen) await load();
  };

  const advance = async (task: TaskListItem) => {
    const next = naechsterStatus(task.status);
    if (!next || busyId) return; // Doppel-Tap-Sperre (Wurzel 2)
    setBusyId(task.id);
    const res = await setTaskStatus(task.id, next);
    setBusyId(null);
    if (!res.ok) {
      // Wurzel 5: den Fehler NICHT verschlucken. Vorher stand hier nur
      // `if (res.ok) load()` — schlug der Aufruf fehl (fehlende Berechtigung,
      // Foto-Pflicht 422, fremde Aufgabe 404), passierte sichtbar NICHTS. Der
      // Nutzer tippt, nichts rührt sich, und der Schluss ist: die App ist
      // kaputt. Dieselbe Meldung wie im Detail-Screen.
      Alert.alert("Nicht möglich", res.error);
      return;
    }
    load();
  };

  // Beim Wechsel von Sicht oder Reiter nach oben: sonst behält der ScrollView
  // seinen alten Versatz und die neue Liste beginnt mitten in einer Karte —
  // der Tageskopf war dann nicht zu sehen.
  useEffect(() => {
    scroller.current?.scrollTo({ y: 0, animated: false });
  }, [team, bucket]);

  const gruppen = useMemo(() => gruppiereNachTag(liste ?? []), [liste]);
  const aktiveFilter = objektFilter.length + (team ? personFilter.length : 0);

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
      <Col style={{ paddingHorizontal: 24, paddingTop: 12, paddingBottom: 14, gap: 14 }}>
        <Row style={{ justifyContent: "space-between" }}>
          <Txt v="display">Aufgaben</Txt>
          <Row gap={8}>
            {canManage && (
              <IconBtn
                icon="sliders"
                s={38}
                flat
                badge={aktiveFilter}
                onPress={() => setFilterOffen(true)}
                style={{ borderWidth: 1, borderColor: t.palette.line }}
              />
            )}
            <IconBtn
              icon="cal"
              s={38}
              flat
              onPress={() => navigation.navigate("TaskCalendar")}
              style={{ borderWidth: 1, borderColor: t.palette.line }}
            />
          </Row>
        </Row>

        {canManage && (
          <Segmented
            options={["Meine", "Team"]}
            value={team ? 1 : 0}
            onChange={(i) => setTeam(i === 1)}
          />
        )}

        <Row gap={8}>
          {BUCKETS.map((b) => (
            <Pressable
              key={b.key}
              accessibilityRole="button"
              accessibilityState={{ selected: b.key === bucket }}
              onPress={() => setBucket(b.key)}
              style={{ flexShrink: 1 }}
            >
              <Chip variant={b.key === bucket ? "on" : ""}>{b.label}</Chip>
            </Pressable>
          ))}
        </Row>
      </Col>

      {vertretungen.length > 0 && (
        <Pressable
          accessibilityRole="button"
          onPress={() => setVertretungenOffen(true)}
          style={({ pressed }) => ({
            marginHorizontal: 24,
            marginBottom: 14,
            padding: 14,
            borderRadius: t.radius.card,
            backgroundColor: t.palette.accentSoft,
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Row gap={10}>
            <Icon n="hand" s={18} sw={2} c={t.palette.ink} />
            <Col gap={2} style={{ flex: 1 }}>
              <Txt v="title">
                {vertretungen.length === 1
                  ? "Eine Vertretung gesucht"
                  : `${vertretungen.length} Vertretungen gesucht`}
              </Txt>
              <Txt v="sm" soft numberOfLines={1}>
                {vertretungen[0].title}
                {vertretungen[0].requested_by_name
                  ? ` · ${vertretungen[0].requested_by_name}`
                  : ""}
              </Txt>
            </Col>
            <Icon n="chevron" s={18} sw={2} c={t.palette.soft} />
          </Row>
        </Pressable>
      )}

      {liste === null ? (
        <Spinner />
      ) : (
        <ScrollView
          ref={scroller}
          contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: unterkante + 24, gap: 18 }}
          refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
        >
          {gruppen.length === 0 && fehler ? (
            // Der Grund, statt eines beruhigenden Leerzustands: „keine Aufgabe
            // zugewiesen" wäre hier eine Falschaussage über einen Ladefehler.
            <Col gap={2} style={{ paddingTop: 24 }}>
              {/* Gleiche Form wie im Dashboard (`BuchungsReiter`): eine Marke
                  in der Akzentfarbe plus der Grund darunter. */}
              <Txt v="body" color={t.palette.accent}>
                Aufgaben nicht geladen.
              </Txt>
              <Txt v="xs" soft>
                {fehler}
              </Txt>
            </Col>
          ) : gruppen.length === 0 ? (
            <LeerZustand bucket={bucket} team={team} />
          ) : (
            gruppen.map((gruppe) => (
              <Col key={gruppe.iso ?? "ohne"} gap={10}>
                <Row gap={8}>
                  <Txt v="sm" style={{ fontFamily: t.fonts.semibold }}>
                    {gruppe.iso ? tagLabel(gruppe.iso, heute) : "Ohne Termin"}
                  </Txt>
                  <Txt v="sm" faint>
                    {gruppe.aufgaben.length}
                  </Txt>
                </Row>
                {gruppe.aufgaben.map((task) => {
                  // „Erledigt" führt über /complete (Foto-Pflicht) — der Weg
                  // dorthin liegt im Detail, nicht als Ein-Tipp in der Liste.
                  const next = naechsterStatus(task.status);
                  const zeigeAktion = next !== null && next !== "done";
                  return (
                    <Pressable
                      key={task.id}
                      accessibilityRole="button"
                      onPress={() => navigation.navigate("TaskDetail", { id: task.id })}
                      style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                    >
                      <AufgabeKarte
                        task={task}
                        heuteIso={heute}
                        zeigeZustaendige={team}
                        aktion={
                          zeigeAktion && next
                            ? {
                                label: `Weiter zu „${AUFGABE_STATUS_LABEL[next]}“`,
                                onPress: () => advance(task),
                                busy: busyId === task.id,
                              }
                            : null
                        }
                      />
                    </Pressable>
                  );
                })}
              </Col>
            ))
          )}
        </ScrollView>
      )}

      <Sheet
        open={vertretungenOffen}
        onClose={() => setVertretungenOffen(false)}
        header={<Txt v="h2">Vertretung gesucht</Txt>}
      >
        <Col gap={0} style={{ paddingBottom: 8 }}>
          {vertretungen.map((v, i) => (
            <View key={v.id}>
              {i > 0 && <View style={{ height: 1, backgroundColor: t.palette.line }} />}
              <Col gap={10} style={{ paddingVertical: 16 }}>
                <Col gap={3}>
                  <Txt v="title">{v.title}</Txt>
                  <Txt v="sm" soft>
                    {[
                      v.property_title,
                      // Die Anfrage trägt nur `start_at`/`end_at` der Aufgabe,
                      // keine Fälligkeit — ohne Startzeit steht hier nichts,
                      // statt „heute" zu behaupten (Wurzel 4).
                      v.start_at
                        ? tagLabel(aufgabenTag({ start_at: v.start_at, due_at: null }) ?? heute, heute)
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </Txt>
                  {v.requested_by_name && (
                    <Txt v="sm" soft>
                      Angefragt von {v.requested_by_name}
                    </Txt>
                  )}
                  {v.note && (
                    <Txt v="sm" soft>
                      „{v.note}"
                    </Txt>
                  )}
                </Col>
                <Row gap={10}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={vBusy !== null}
                    onPress={() => vertretungEntscheiden(v, true)}
                    style={({ pressed }) => ({
                      flex: 1,
                      paddingVertical: 12,
                      borderRadius: t.radius.pill,
                      backgroundColor: t.palette.ink,
                      alignItems: "center",
                      opacity: pressed || vBusy === v.id ? 0.6 : 1,
                    })}
                  >
                    <Txt v="sm" color={t.palette.bg} style={{ fontFamily: t.fonts.semibold }}>
                      {vBusy === v.id ? "…" : "Übernehmen"}
                    </Txt>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={vBusy !== null}
                    onPress={() => vertretungEntscheiden(v, false)}
                    style={({ pressed }) => ({
                      flex: 1,
                      paddingVertical: 12,
                      borderRadius: t.radius.pill,
                      borderWidth: 1,
                      borderColor: t.palette.line,
                      alignItems: "center",
                      opacity: pressed || vBusy === v.id ? 0.6 : 1,
                    })}
                  >
                    <Txt v="sm">Ablehnen</Txt>
                  </Pressable>
                </Row>
              </Col>
            </View>
          ))}
        </Col>
      </Sheet>

      <Sheet
        open={filterOffen}
        onClose={() => setFilterOffen(false)}
        header={<Txt v="h2">Filter</Txt>}
      >
        <Col gap={22} style={{ paddingBottom: 12 }}>
          <MehrfachAuswahl
            titel="Objekte"
            optionen={objekte.map((p) => ({ value: p.id, label: p.title }))}
            gewaehlt={objektFilter}
            onToggle={(v) => setObjektFilter(umschalten(objektFilter, v))}
          />
          {canManage && team && (
            <MehrfachAuswahl
              titel="Zuständig"
              // „Nicht zugeordnet" ist der Sonderwert des Servers (`none`) —
              // genau der Filter, mit dem man die unverteilten Aufgaben findet.
              optionen={[{ value: "none", label: "Nicht zugeordnet" }, ...leute]}
              gewaehlt={personFilter}
              onToggle={(v) => setPersonFilter(umschalten(personFilter, v))}
            />
          )}
          {aktiveFilter > 0 && (
            <Pressable
              accessibilityRole="button"
              onPress={() => {
                setObjektFilter([]);
                setPersonFilter([]);
              }}
              style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, paddingVertical: 8 })}
            >
              <Txt v="sm" soft>
                Alles zurücksetzen
              </Txt>
            </Pressable>
          )}
        </Col>
      </Sheet>
    </View>
  );
}

function umschalten(liste: string[], wert: string): string[] {
  return liste.includes(wert) ? liste.filter((v) => v !== wert) : [...liste, wert];
}

function MehrfachAuswahl({
  titel,
  optionen,
  gewaehlt,
  onToggle,
}: {
  titel: string;
  optionen: { value: string; label: string }[];
  gewaehlt: string[];
  onToggle: (value: string) => void;
}) {
  const t = useTheme();
  if (optionen.length === 0) return null;
  return (
    <Col gap={4}>
      <Txt v="sm" soft>
        {titel}
      </Txt>
      {optionen.map((o) => {
        const on = gewaehlt.includes(o.value);
        return (
          <Pressable
            key={o.value}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            onPress={() => onToggle(o.value)}
            style={({ pressed }) => ({ paddingVertical: 13, opacity: pressed ? 0.6 : 1 })}
          >
            <Row gap={10}>
              <Icon
                n={on ? "check" : "dot"}
                s={18}
                sw={2}
                c={on ? t.palette.ink : t.palette.faint}
              />
              <Txt v="title" numberOfLines={1} style={{ flex: 1 }}>
                {o.label}
              </Txt>
            </Row>
          </Pressable>
        );
      })}
    </Col>
  );
}

function LeerZustand({ bucket, team }: { bucket: StatusBucket; team: boolean }) {
  if (bucket === "done") {
    return (
      <EmptyState
        icon="check"
        titel="Noch nichts abgeschlossen"
        text="Erledigte Aufgaben stehen hier, sobald die erste abgeschlossen ist."
      />
    );
  }
  if (bucket === "upcoming") {
    return (
      <EmptyState
        icon="cal"
        titel="Nichts geplant"
        text="Für die kommenden Tage liegt keine Aufgabe vor."
      />
    );
  }
  return team ? (
    <EmptyState icon="list" titel="Keine Team-Aufgaben" text="Es liegt gerade nichts an." />
  ) : (
    <EmptyState
      icon="check"
      titel="Nichts offen"
      text="Dir ist gerade keine Aufgabe zugewiesen."
    />
  );
}

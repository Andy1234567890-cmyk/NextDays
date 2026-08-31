// Aufgaben-Detail — die vollständige Arbeitskarte einer Aufgabe.
//
// Aufbau (Referenz: Breezeway-Aufgabenkarte, Web `/reservierungen/aufgaben`):
//   Kopf      Titel · Zeitfenster · Objekt · Zuständige · Herkunft/Priorität
//   Buchung   Referenz und An-/Abreisetag — die eigentliche Arbeitsangabe
//             („ab wann ist das Objekt frei"), nur Kalendertage (§4.3)
//   Zustand   annehmen · anfangen · abschließen, dazu die QA-Folge
//   Checkliste nach RÄUMEN gruppiert, mit Fortschritt je Raum, ABHAKBAR
//   Auslagen  eigene Auslagen sehen und erfassen; Währung kommt vom Server
//   Rückmeldung „wie ist es gelaufen" (Text) und die Bewertung der Führung
//   Vertretung der Weg der ausführenden Person aus einer Aufgabe
//
// Vorher standen hier nur Titel, Objekt, Zuständige und die Checkliste — bei
// einer Aufgabe ohne Checkliste war der Screen also eine leere weiße Fläche,
// obwohl der Slice Buchungsbezug, Zustände, Auslagen, Rückmeldung und
// Vertretung längst führt.
//
// Foto-Nachweise: pro Checklisten-Punkt und zusätzlich an der Aufgabe selbst
// (auch ohne Checkliste). Aufnehmen oder aus der Galerie wählen läuft über
// `lib/foto.ts`, hochgeladen wird als Multipart; der Server prüft die echten
// Anfangsbytes und die Größe (Wurzel 8) und erzwingt die Foto-Pflicht beim
// Abschluss (422). Die Nachweise sind SICHTBAR — `photo_urls` sind signierte
// URLs; ein Zähler allein hätte die Person vor Ort nie sehen lassen, was sie
// hochgeladen hat.
//
// Rechte: den Arbeitszustand meldet JEDE zuständige Person (VIEW_OWN_TASKS,
// 0360); VERTEILEN (Zuständigen wechseln) und BEWERTEN darf nur
// `manage_tasks`; die QA-Freigabe ebenfalls. Alle schreibenden Wege sind gegen
// Doppel-Tap gesperrt (Wurzel 2), Fehler werden gezeigt und nicht verschluckt
// (Wurzel 5).
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useEffect, useState } from "react";
import { Alert, Image, Pressable, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, type IconName } from "@/components/ui/Icon";
import { Btn, Chip, Col, Progress, Row, Spinner, Txt } from "@/components/ui/kit";
import { EmptyState, Sheet } from "@/components/ui/patterns";
import { useAuth } from "@/contexts/AuthContext";
import { protokolliereAbsturz } from "@/lib/absturzmeldung";
import { zeitfenster } from "@/lib/aufgaben-agenda";
import {
  AUFGABE_STATUS_LABEL,
  AUFGABE_TONE,
  aufgabeTon,
  naechsterStatus,
  zurueckStatus,
} from "@/lib/aufgabenstatus";
import { formatCurrency } from "@/lib/currency";
import { fotoAufnehmen, fotoWaehlen, type FotoErgebnis } from "@/lib/foto";
import { heuteIso, naechte, tagKurz } from "@/lib/kalendertag";
import { can } from "@/lib/permissions";
import { useRealtime } from "@/lib/realtime";
import {
  addTaskCost,
  completeTask,
  deleteTask,
  deleteTaskCost,
  getTaskDetail,
  listTaskAssignees,
  mitarbeiterOptionen,
  requestSubstitution,
  setTaskAssignee,
  setTaskResolution,
  setTaskStatus,
  toggleChecklistItem,
  uploadChecklistPhoto,
  uploadTaskPhoto,
  type Bilddatei,
  type ChecklistItem,
  type TaskDetail as Detail,
} from "@/lib/tasks";
import type { RootStackParamList } from "@/navigation/types";
import { useTheme } from "@/theme/ThemeProvider";

/**
 * Das Sammel-Item, das der SERVER beim „Foto an der Aufgabe" anlegt
 * (`_ensure_photo_item`, Label „Fotos"). Es ist kein Arbeitsschritt, sondern
 * der Ablageort — es gehört in den Abschnitt „Fotos zur Aufgabe" und NICHT in
 * die Checkliste. Ohne diese Trennung stand dasselbe Foto zweimal auf dem
 * Schirm, dazu ein „Ohne Raum · 0 von 1" über einem Sammelplatz.
 */
const SAMMEL_LABEL = "Fotos";

const HERKUNFT: Record<string, string> = {
  manual: "Von Hand angelegt",
  auto: "Aus einer planmäßigen Regel",
  recurring: "Aus einer regelmäßigen Regel",
};

export default function TaskDetail() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const route = useRoute<RouteProp<RootStackParamList, "TaskDetail">>();
  const { id } = route.params;

  const { me } = useAuth();
  const darfZuweisen = can(me, "manage_tasks");
  const darfBenoten = darfZuweisen;
  const darfVertretung = can(me, "request_substitute");

  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [leute, setLeute] = useState<{ value: string; label: string }[]>([]);
  const [auswahlOffen, setAuswahlOffen] = useState(false);
  // Welcher Punkt gerade geschrieben wird — sperrt genau diese Zeile gegen
  // Doppel-Tap, ohne die ganze Liste zu blockieren (Wurzel 2).
  const [punktBusy, setPunktBusy] = useState<string | null>(null);
  const [kostenOffen, setKostenOffen] = useState(false);
  const [betrag, setBetrag] = useState("");
  const [kostenNotiz, setKostenNotiz] = useState("");
  const [rueckmeldungOffen, setRueckmeldungOffen] = useState(false);
  const [notiz, setNotiz] = useState("");
  const [bewertung, setBewertung] = useState<number | null>(null);
  const [vertretungOffen, setVertretungOffen] = useState(false);
  const [vertretungNotiz, setVertretungNotiz] = useState("");
  // Welcher Punkt lädt gerade hoch („_task" = Foto an der Aufgabe). Sperrt nur
  // diese Zeile, nicht den ganzen Screen (Wurzel 2).
  const [fotoBusy, setFotoBusy] = useState<string | null>(null);
  // Für welchen Punkt die Auswahl „Aufnehmen / Aus der Galerie" offen ist.
  const [fotoZiel, setFotoZiel] = useState<string | null>(null);
  // Warum das Detail fehlt — null = die Aufgabe gibt es wirklich nicht.
  const [ladeFehler, setLadeFehler] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await getTaskDetail(id);
    // Wurzel 5: den Grund festhalten. Vorher blieb `detail` bei jedem Fehler
    // null, und der Screen behauptete „Diese Aufgabe gibt es nicht (mehr)" —
    // bei einer abgelaufenen Sitzung (401) oder einem kurzen Serverausfall
    // (503) eine Falschaussage, die den Nutzer zur falschen Schlussfolgerung
    // führt (er sucht die Aufgabe, statt sich neu anzumelden).
    if (!res.ok) {
      setLadeFehler(res.error);
      setLoading(false);
      return;
    }
    setLadeFehler(null);
    setDetail(res.data);
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  // Die Auswahlliste holt nur, wer sie braucht: ohne `manage_tasks` wäre es
  // eine Namensliste des Betriebs ohne Zweck (§4.3).
  useEffect(() => {
    if (!darfZuweisen) return;
    listTaskAssignees()
      .then((r) => {
        if (r.ok) setLeute(mitarbeiterOptionen(r.data));
      })
      .catch(protokolliereAbsturz);
  }, [darfZuweisen]);

  // Genau diese Aufgabe: ändert ein Kollege Status oder Zuweisung, zieht die
  // Ansicht nach, ohne dass der Nutzer zurück und wieder hinein muss.
  useRealtime({ table: "tasks", filter: `id=eq.${id}`, onChange: load });

  // Ein Sheet, KEIN `Alert.alert` mit einem Button je Person: die
  // React-Native-Bridge unterstützt auf Android nur drei Buttons
  // (neutral/negative/positive) und verwirft alles darüber stillschweigend.
  // Bei 25 Mitarbeitern sähe ein Android-Nutzer drei Namen und weder
  // „Niemand" noch „Abbrechen" — auf iOS stapelt der Alert bei so vielen
  // Einträgen zwar, wird aber unbedienbar. Das Sheet gibt es bereits
  // (`components/ui/patterns`), es scrollt und trägt beliebig viele Zeilen.
  const setzeZustaendigen = async (neu: string | null) => {
    setAuswahlOffen(false);
    await schreiben(() => setTaskAssignee(id, neu), "Zuweisung nicht möglich");
  };

  /**
   * Ein Schreibweg für alle Detail-Aktionen: sperren, senden, Antwort
   * übernehmen, Fehler ZEIGEN. Die Serverantwort ist immer das ganze Detail —
   * damit stimmen Status, Fortschritt und Kosten in einem Zug (kein
   * Nachladen, kein halb aktueller Zustand).
   */
  const schreiben = async (
    aktion: () => Promise<{ ok: true; data: Detail } | { ok: false; error: string }>,
    fehlerTitel: string,
  ): Promise<boolean> => {
    if (saving) return false; // Doppel-Tap-Sperre (Wurzel 2)
    setSaving(true);
    const res = await aktion();
    setSaving(false);
    if (!res.ok) {
      Alert.alert(fehlerTitel, res.error);
      return false;
    }
    setDetail(res.data);
    return true;
  };

  const zustandWeiter = async (ziel: Parameters<typeof setTaskStatus>[1]) => {
    await schreiben(() => setTaskStatus(id, ziel), "Zustand nicht geändert");
  };

  const kosteLoeschen = async (costId: string) => {
    await schreiben(() => deleteTaskCost(costId), "Auslage nicht entfernt");
  };

  /**
   * Aufgabe endgültig löschen. Eigener Weg statt `schreiben()`, weil der Server
   * hier 204 ohne Inhalt schickt: es gibt kein Detail zum Übernehmen, und der
   * Screen selbst muss weg — die Aufgabe, die er zeigt, existiert danach nicht
   * mehr. Bliebe er stehen, zeigte er eine gelöschte Zeile und jeder weitere
   * Tap ergäbe 404.
   *
   * Zwei Stufen, weil Löschen NICHT umkehrbar ist (kein `deleted_at` in der
   * Tabelle): erst die Rückfrage, dann der Aufruf. Der Hinweis auf „Abbrechen"
   * steht bewusst darin, damit der schonendere Weg sichtbar ist, statt dass
   * jemand löscht, weil er den anderen Knopf nicht kennt.
   */
  const loeschenAusfuehren = async (): Promise<void> => {
    if (saving) return; // Doppel-Tap-Sperre (Wurzel 2)
    setSaving(true);
    const res = await deleteTask(id);
    setSaving(false);
    if (!res.ok) {
      Alert.alert("Aufgabe nicht gelöscht", res.error);
      return;
    }
    // Zurück zur Liste: sie lädt beim Erscheinen neu, die gelöschte Zeile ist
    // damit auch dort weg.
    navigation.goBack();
  };

  const aufgabeLoeschen = () => {
    Alert.alert(
      "Aufgabe löschen?",
      "Die Aufgabe wird endgültig entfernt — mit Checkliste, Auslagen und "
        + "Foto-Nachweisen. Das lässt sich nicht zurücknehmen. Soll die "
        + "Aufgabe nur vom Tisch, brich hier ab und setze sie stattdessen auf "
        + "„Abgebrochen“ — dann bleibt die Spur erhalten.",
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Endgültig löschen",
          style: "destructive",
          onPress: () => {
            loeschenAusfuehren().catch((e: unknown) =>
              protokolliereAbsturz(e, "aufgabe-loeschen"),
            );
          },
        },
      ],
    );
  };

  /**
   * Ein Bild hochladen — für einen Checklisten-Punkt oder für die Aufgabe
   * selbst („_task"). Nach dem Upload wird das Detail neu geladen: die
   * signierten URLs entstehen serverseitig, ein lokal zusammengesetztes Bild
   * wäre nach dem nächsten Öffnen weg.
   */
  const fotoHochladen = async (ziel: string, bild: Bilddatei) => {
    if (fotoBusy) return; // Doppel-Tap-Sperre (Wurzel 2)
    setFotoBusy(ziel);
    const res =
      ziel === "_task"
        ? await uploadTaskPhoto(id, bild)
        : await uploadChecklistPhoto(ziel, bild);
    setFotoBusy(null);
    if (!res.ok) {
      Alert.alert("Foto nicht gespeichert", res.error);
      return;
    }
    await load();
  };

  /** Auswahl aus dem Sheet: aufnehmen oder aus der Galerie. */
  const fotoHolen = async (quelle: "kamera" | "galerie") => {
    const ziel = fotoZiel;
    setFotoZiel(null);
    if (!ziel) return;
    const ergebnis: FotoErgebnis =
      quelle === "kamera" ? await fotoAufnehmen() : await fotoWaehlen();
    // Ein Abbruch ist kein Fehler und bekommt deshalb keine Meldung.
    if (ergebnis.art === "abgebrochen") return;
    if (ergebnis.art === "fehler") {
      Alert.alert("Kein Foto", ergebnis.text);
      return;
    }
    await fotoHochladen(ziel, ergebnis.bild);
  };

  const punktUmschalten = async (item: ChecklistItem) => {
    if (punktBusy) return; // Doppel-Tap-Sperre (Wurzel 2)
    setPunktBusy(item.id);
    const res = await toggleChecklistItem(item.id, !item.done);
    setPunktBusy(null);
    if (!res.ok) {
      // Der häufigste Fall ist die Foto-Pflicht (422). Die Meldung kommt vom
      // Server und wird nicht durch eine eigene ersetzt — sie sagt genauer,
      // was fehlt.
      Alert.alert("Punkt nicht änderbar", res.error);
      return;
    }
    setDetail(res.data);
  };

  const complete = async () => {
    if (saving) return; // Doppel-Tap-Sperre
    setSaving(true);
    const res = await completeTask(id);
    setSaving(false);
    if (!res.ok) {
      Alert.alert("Abschluss nicht möglich", res.error);
      return;
    }
    navigation.goBack();
  };

  const kosteBuchen = async () => {
    const wert = betrag.replace(",", ".").trim();
    if (!/^\d+(\.\d{1,2})?$/.test(wert)) {
      Alert.alert("Betrag prüfen", "Bitte einen Betrag wie 12,50 eingeben.");
      return;
    }
    const ok = await schreiben(
      () => addTaskCost(id, wert, kostenNotiz.trim() || null),
      "Auslage nicht gespeichert",
    );
    if (ok) {
      setKostenOffen(false);
      setBetrag("");
      setKostenNotiz("");
    }
  };

  const rueckmeldungSpeichern = async () => {
    const ok = await schreiben(
      () => setTaskResolution(id, notiz.trim() || null, darfBenoten ? bewertung : null),
      "Rückmeldung nicht gespeichert",
    );
    if (ok) setRueckmeldungOffen(false);
  };

  const vertretungAnfragen = async () => {
    if (saving) return;
    setSaving(true);
    const res = await requestSubstitution(id, vertretungNotiz.trim() || null);
    setSaving(false);
    if (!res.ok) {
      Alert.alert("Anfrage nicht möglich", res.error);
      return;
    }
    setVertretungOffen(false);
    setVertretungNotiz("");
    Alert.alert(
      "Vertretung angefragt",
      "Kolleginnen und Kollegen können die Aufgabe jetzt übernehmen.",
    );
    load();
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top + 40 }}>
        <Spinner />
      </View>
    );
  }
  if (!detail) {
    return (
      <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
        <Row style={{ paddingHorizontal: 12, paddingVertical: 8 }}>
          <ZurueckKnopf onPress={() => navigation.goBack()} />
        </Row>
        {ladeFehler ? (
          <EmptyState icon="info" titel="Nicht geladen" text={ladeFehler} />
        ) : (
          <EmptyState
            icon="info"
            titel="Nicht gefunden"
            text="Diese Aufgabe gibt es nicht (mehr)."
          />
        )}
      </View>
    );
  }

  // Die Fußleiste zeigt den Abschluss nur, wo er möglich ist. Vorher hing sie
  // allein an `!done` — eine ABGEBROCHENE Aufgabe bot „Aufgabe abschließen“ an,
  // und der Server lehnt diesen Wechsel ab (`cancelled` → nur `open`).
  const abschliessbar =
    detail.status !== "done" && detail.status !== "cancelled";
  const heute = heuteIso();
  const ton = aufgabeTon(detail, heute);
  const tonFarbe = AUFGABE_TONE[ton];
  const eingefaerbt = ton === "done" || ton === "cancelled" || ton === "today";
  const fenster = zeitfenster(detail);
  const tagRoh = detail.start_at ?? detail.due_at;
  // Der Tag steht neben dem Zeitfenster. Fehlt er, bleibt die Zeile leer statt
  // „heute" zu behaupten (Wurzel 4).
  const tag = tagRoh ? tagKurz(tagRoh.slice(0, 10)) : null;
  const weiter = naechsterStatus(detail.status);
  const zurueck = zurueckStatus(detail.status);
  const punkte = detail.checklist.filter((p) => p.label !== SAMMEL_LABEL);
  const offenePflichtfotos = punkte.filter(
    (p) => p.requires_photo && p.photos.length === 0,
  ).length;
  // Das Sammel-Item „Fotos" legt der Server beim ersten Upload an der Aufgabe
  // an; vorher gibt es es nicht — dann ist die Leiste eben leer.
  const sammel = detail.checklist.find((p) => p.label === SAMMEL_LABEL);
  const aufgabenFotos = {
    urls: sammel?.photo_urls ?? [],
    anzahl: sammel?.photos?.length ?? 0,
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
      <Row style={{ paddingHorizontal: 12, paddingVertical: 8, justifyContent: "space-between" }}>
        <ZurueckKnopf onPress={() => navigation.goBack()} />
        <Chip
          variant=""
          style={
            eingefaerbt
              ? { backgroundColor: tonFarbe.bg, borderColor: tonFarbe.bg }
              : undefined
          }
          textColor={eingefaerbt ? tonFarbe.fg : t.palette.ink}
        >
          {AUFGABE_STATUS_LABEL[detail.status]}
        </Chip>
      </Row>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 24, paddingBottom: 140, gap: 24 }}>
        <Col gap={8}>
          <Txt v="display">{detail.title}</Txt>
          {(tag || fenster) && (
            <Zeile icon="clock" text={[tag, fenster].filter(Boolean).join(" · ")} />
          )}
          {detail.property_title && <Zeile icon="home" text={detail.property_title} />}
          <Row gap={6} style={{ flexWrap: "wrap" }}>
            {detail.priority > 0 && <Chip icon="arrowup">Priorität {detail.priority}</Chip>}
            {HERKUNFT[detail.source] && <Chip icon="info">{HERKUNFT[detail.source]}</Chip>}
          </Row>
          {darfZuweisen ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Zuständige Person ändern"
              onPress={() => setAuswahlOffen(true)}
              disabled={saving}
              style={({ pressed }) => ({
                marginTop: 4,
                paddingVertical: 10,
                paddingHorizontal: 14,
                borderRadius: t.radius.pill,
                borderWidth: 1,
                borderColor: t.palette.line,
                alignSelf: "flex-start",
                opacity: pressed || saving ? 0.6 : 1,
              })}
            >
              <Row gap={8}>
                <Icon n="user" s={16} sw={2} c={t.palette.ink} />
                <Txt v="sm">{detail.assignee_name ?? "Niemand zugewiesen"}</Txt>
              </Row>
            </Pressable>
          ) : (
            detail.assignee_name && <Zeile icon="user" text={`Zuständig: ${detail.assignee_name}`} />
          )}
        </Col>

        {/* --- Buchung: Referenz und Zeitraum. Kein Gastname, kein Betrag. --- */}
        {(detail.reservation_ref ||
          detail.reservation_check_in ||
          detail.reservation_check_out) && (
          <Abschnitt titel="Buchung">
            {detail.reservation_ref && <Zeile icon="suitcase" text={detail.reservation_ref} />}
            {detail.reservation_check_in && detail.reservation_check_out && (
              <>
                <Zeile
                  icon="key"
                  text={`Anreise ${tagKurz(detail.reservation_check_in)}`}
                />
                <Zeile
                  icon="logout"
                  text={`Abreise ${tagKurz(detail.reservation_check_out)}`}
                />
                <Txt v="xs" faint>
                  {naechte(detail.reservation_check_in, detail.reservation_check_out)} Nächte
                </Txt>
              </>
            )}
          </Abschnitt>
        )}

        {/* --- Arbeitszustand --- */}
        {(weiter || zurueck || detail.needs_inspection) && (
          <Abschnitt titel="Zustand">
            {detail.needs_inspection && (
              <Zeile
                icon="eye"
                text={
                  detail.inspection_state === "reviewed"
                    ? "QA-Freigabe erteilt"
                    : detail.inspection_state === "to_review"
                      ? "Wartet auf QA-Freigabe"
                      : "Nach Abschluss ist eine QA-Freigabe nötig"
                }
              />
            )}
            {weiter && weiter !== "done" && (
              <Btn
                variant="outline"
                block
                onPress={saving ? undefined : () => zustandWeiter(weiter)}
              >
                {`Auf „${AUFGABE_STATUS_LABEL[weiter]}“ setzen`}
              </Btn>
            )}
            {zurueck && (
              <>
                <Btn
                  variant="outline"
                  block
                  onPress={saving ? undefined : () => zustandWeiter(zurueck)}
                >
                  Wieder öffnen
                </Btn>
                <Txt v="xs" faint>
                  {detail.status === "done"
                    ? "Nimmt den Abschluss zurück — samt Zeitpunkt, Urheber und QA-Stand."
                    : "Holt die abgesagte Aufgabe zurück in die Arbeit."}
                </Txt>
              </>
            )}
          </Abschnitt>
        )}

        {/* --- Checkliste --- */}
        {punkte.length > 0 ? (
          <Abschnitt
            titel="Checkliste"
            rechts={`${punkte.filter((p) => p.done).length} von ${punkte.length}`}
          >
            <Progress
              pct={Math.round((punkte.filter((p) => p.done).length / punkte.length) * 100)}
            />
            {raumGruppen(punkte).map((gruppe, _i, alle) => (
              <Col key={gruppe.raum ?? "ohne"} gap={0}>
                {/* Der Raumkopf steht nur da, wo er etwas unterscheidet: bei
                    einer einzigen namenlosen Gruppe wiederholte „Ohne Raum"
                    bloß die Überschrift darüber. */}
                {(gruppe.raum !== null || alle.length > 1) && (
                  <Row
                    style={{ justifyContent: "space-between", paddingTop: 10, paddingBottom: 2 }}
                  >
                    <Txt v="sm" style={{ fontFamily: t.fonts.semibold }}>
                      {gruppe.raum ?? "Ohne Raum"}
                    </Txt>
                    <Txt v="sm" faint>
                      {gruppe.punkte.filter((p) => p.done).length} von {gruppe.punkte.length}
                    </Txt>
                  </Row>
                )}
                {gruppe.punkte.map((item, i) => (
                  <View key={item.id}>
                    {i > 0 && <View style={{ height: 1, backgroundColor: t.palette.line }} />}
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: item.done }}
                      accessibilityLabel={item.label}
                      onPress={() => punktUmschalten(item)}
                      disabled={punktBusy !== null}
                      style={({ pressed }) => ({
                        opacity: pressed || punktBusy === item.id ? 0.5 : 1,
                      })}
                    >
                      <Row gap={12} style={{ paddingVertical: 14 }}>
                        <Icon
                          n={item.done ? "check" : "dot"}
                          s={19}
                          sw={2}
                          c={item.done ? t.palette.ink : t.palette.faint}
                        />
                        <Col gap={2} style={{ flex: 1 }}>
                          <Txt v="title">{item.label}</Txt>
                          {item.done_by_name && (
                            <Txt v="xs" soft>
                              {item.done_by_name}
                            </Txt>
                          )}
                        </Col>
                        {item.requires_photo && item.photos.length === 0 && (
                          <Chip
                            style={{
                              backgroundColor: AUFGABE_TONE.unassigned.bg,
                              borderColor: AUFGABE_TONE.unassigned.bg,
                            }}
                            textColor={AUFGABE_TONE.unassigned.fg}
                          >
                            Foto nötig
                          </Chip>
                        )}
                      </Row>
                    </Pressable>
                    <Fotoleiste
                      // `?? []`: eine ältere API-Fassung kennt `photo_urls`
                      // nicht — dann bleibt die Leiste leer, statt beim Rendern
                      // zu brechen (Wurzel 5).
                      urls={item.photo_urls ?? []}
                      anzahl={item.photos.length}
                      pflicht={item.requires_photo}
                      laedt={fotoBusy === item.id}
                      onHinzufuegen={() => setFotoZiel(item.id)}
                    />
                  </View>
                ))}
              </Col>
            ))}
            {offenePflichtfotos > 0 && (
              <Txt v="xs" soft>
                {offenePflichtfotos === 1
                  ? "Ein Punkt braucht noch einen Foto-Nachweis"
                  : `${offenePflichtfotos} Punkte brauchen noch einen Foto-Nachweis`}{" "}
                — ohne ihn lehnt der Abschluss ab.
              </Txt>
            )}
          </Abschnitt>
        ) : (
          <Abschnitt titel="Checkliste">
            <Txt v="sm" soft>
              Für diese Aufgabe ist keine Checkliste hinterlegt. Checklisten
              kommen aus den Aufgabenvorlagen und Regeln im Web.
            </Txt>
          </Abschnitt>
        )}

        {/* Fotos direkt an der Aufgabe — auch ohne Checkliste. Sie erscheinen
            im Bilder-Modul als Buchungsbild; der Server hängt sie an ein
            Sammel-Item „Fotos". */}
        <Abschnitt titel="Fotos zur Aufgabe">
          <Fotoleiste
            urls={aufgabenFotos.urls}
            anzahl={aufgabenFotos.anzahl}
            laedt={fotoBusy === "_task"}
            onHinzufuegen={() => setFotoZiel("_task")}
          />
        </Abschnitt>

        {/* --- Auslagen. Ohne Währung KEIN Erfassen-Knopf (Wurzel 4). --- */}
        <Abschnitt
          titel="Auslagen"
          rechts={detail.costs.length > 0 ? `${detail.costs.length}` : undefined}
        >
          {detail.costs.length === 0 && (
            <Txt v="sm" soft>
              Noch keine Auslage erfasst.
            </Txt>
          )}
          {detail.costs.map((k, i) => (
            <View key={k.id}>
              {i > 0 && <View style={{ height: 1, backgroundColor: t.palette.line }} />}
              <Row style={{ paddingVertical: 12, justifyContent: "space-between", gap: 12 }}>
                <Col gap={2} style={{ flex: 1 }}>
                  <Txt v="title">{formatCurrency(Number(k.amount), k.currency, 2)}</Txt>
                  {(k.note || k.created_by_name) && (
                    <Txt v="xs" soft numberOfLines={2}>
                      {[k.note, k.created_by_name].filter(Boolean).join(" · ")}
                    </Txt>
                  )}
                </Col>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Auslage zurücknehmen"
                  hitSlop={8}
                  disabled={saving}
                  onPress={() => kosteLoeschen(k.id)}
                  style={({ pressed }) => ({ padding: 6, opacity: pressed || saving ? 0.5 : 1 })}
                >
                  <Icon n="x" s={16} sw={2} c={t.palette.soft} />
                </Pressable>
              </Row>
            </View>
          ))}
          {detail.cost_currency ? (
            <Btn variant="outline" block onPress={() => setKostenOffen(true)}>
              Auslage erfassen
            </Btn>
          ) : (
            <Txt v="xs" faint>
              Für dieses Objekt ist keine Währung hinterlegt — Auslagen können
              erst danach erfasst werden.
            </Txt>
          )}
        </Abschnitt>

        {/* --- Rückmeldung --- */}
        <Abschnitt titel="Rückmeldung">
          {detail.resolution?.note || detail.resolution?.score != null ? (
            <Col gap={6}>
              {detail.resolution.note && <Txt v="body">{detail.resolution.note}</Txt>}
              {detail.resolution.score != null && (
                <Txt v="sm" soft>
                  Bewertung: {detail.resolution.score} von 5
                </Txt>
              )}
              {detail.resolution.created_by_name && (
                <Txt v="xs" faint>
                  {detail.resolution.created_by_name}
                </Txt>
              )}
            </Col>
          ) : (
            <Txt v="sm" soft>
              Noch keine Rückmeldung.
            </Txt>
          )}
          <Btn
            variant="outline"
            block
            onPress={() => {
              setNotiz(detail.resolution?.note ?? "");
              setBewertung(detail.resolution?.score ?? null);
              setRueckmeldungOffen(true);
            }}
          >
            {detail.resolution ? "Rückmeldung ändern" : "Rückmeldung schreiben"}
          </Btn>
        </Abschnitt>

        {/* --- Vertretung: der Weg der ausführenden Person aus der Aufgabe. --- */}
        {darfVertretung && abschliessbar && (
          <Abschnitt titel="Vertretung">
            <Txt v="sm" soft>
              Wenn du die Aufgabe nicht übernehmen kannst, gib sie zur
              Vertretung frei — Kolleginnen und Kollegen können sie annehmen.
            </Txt>
            <Btn variant="outline" block onPress={() => setVertretungOffen(true)}>
              Vertretung anfragen
            </Btn>
          </Abschnitt>
        )}

        {/* --- Löschen: ganz unten und nur mit `manage_tasks`.
             Die Reinigungskraft sieht den Knopf nicht — sie meldet Zustände,
             sie räumt kein Inventar ab. Der Server lehnt es ohnehin ab (403),
             aber ein Knopf, der nur zum Fehler führt, ist selbst der Fehler. --- */}
        {darfZuweisen && (
          <Abschnitt titel="Aufgabe löschen">
            <Txt v="sm" soft>
              Entfernt die Aufgabe endgültig — samt Checkliste, Auslagen und
              Foto-Nachweisen. Soll die Aufgabe nur vom Tisch, setze sie
              stattdessen auf „Abgebrochen“: dann bleibt nachvollziehbar, dass
              es sie gab.
            </Txt>
            <Btn
              variant="outline"
              block
              onPress={saving ? undefined : aufgabeLoeschen}
            >
              {saving ? "Bitte warten …" : "Aufgabe löschen"}
            </Btn>
          </Abschnitt>
        )}
      </ScrollView>

      <Sheet
        open={auswahlOffen}
        onClose={() => setAuswahlOffen(false)}
        header={<Txt v="h2">Zuständig</Txt>}
      >
        <Col gap={0}>
          {leute.map((u) => (
            <Pressable
              key={u.value}
              accessibilityRole="button"
              onPress={() => setzeZustaendigen(u.value)}
              style={({ pressed }) => ({
                paddingVertical: 15,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Row gap={10}>
                <Icon
                  n={detail.assignee_id === u.value ? "check" : "dot"}
                  s={18}
                  sw={2}
                  c={detail.assignee_id === u.value ? t.palette.ink : t.palette.faint}
                />
                <Txt v="title">{u.label}</Txt>
              </Row>
            </Pressable>
          ))}
          <View style={{ height: 1, backgroundColor: t.palette.line }} />
          <Pressable
            accessibilityRole="button"
            onPress={() => setzeZustaendigen(null)}
            style={({ pressed }) => ({
              paddingVertical: 15,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Txt v="title" soft>
              Niemand zuweisen
            </Txt>
          </Pressable>
        </Col>
      </Sheet>

      <Sheet
        open={fotoZiel !== null}
        onClose={() => setFotoZiel(null)}
        header={<Txt v="h2">Foto hinzufügen</Txt>}
      >
        <Col gap={0} style={{ paddingBottom: 8 }}>
          <Pressable
            accessibilityRole="button"
            onPress={() => fotoHolen("kamera")}
            style={({ pressed }) => ({ paddingVertical: 16, opacity: pressed ? 0.6 : 1 })}
          >
            <Row gap={12}>
              <Icon n="cam" s={20} sw={2} c={t.palette.ink} />
              <Txt v="title">Foto aufnehmen</Txt>
            </Row>
          </Pressable>
          <View style={{ height: 1, backgroundColor: t.palette.line }} />
          <Pressable
            accessibilityRole="button"
            onPress={() => fotoHolen("galerie")}
            style={({ pressed }) => ({ paddingVertical: 16, opacity: pressed ? 0.6 : 1 })}
          >
            <Row gap={12}>
              <Icon n="grid" s={20} sw={2} c={t.palette.ink} />
              <Txt v="title">Aus der Galerie wählen</Txt>
            </Row>
          </Pressable>
        </Col>
      </Sheet>

      <Sheet
        open={kostenOffen}
        onClose={() => setKostenOffen(false)}
        header={<Txt v="h2">Auslage erfassen</Txt>}
      >
        <Col gap={14} style={{ paddingBottom: 8 }}>
          <Txt v="sm" soft>
            {/* Die Währung kommt vom Server, nicht aus der App (Wurzel 4). */}
            Betrag in {detail.cost_currency}
          </Txt>
          <Feld
            wert={betrag}
            setWert={setBetrag}
            platzhalter="12,50"
            numerisch
            bearbeitbar={!saving}
          />
          <Feld
            wert={kostenNotiz}
            setWert={setKostenNotiz}
            platzhalter="Wofür? (optional)"
            mehrzeilig
            bearbeitbar={!saving}
          />
          <Btn variant="dark" block onPress={saving ? undefined : kosteBuchen}>
            {saving ? "Wird gespeichert …" : "Speichern"}
          </Btn>
        </Col>
      </Sheet>

      <Sheet
        open={rueckmeldungOffen}
        onClose={() => setRueckmeldungOffen(false)}
        header={<Txt v="h2">Rückmeldung</Txt>}
      >
        <Col gap={14} style={{ paddingBottom: 8 }}>
          <Feld
            wert={notiz}
            setWert={setNotiz}
            platzhalter="Wie ist es gelaufen?"
            mehrzeilig
            bearbeitbar={!saving}
          />
          {darfBenoten && (
            <Col gap={8}>
              <Txt v="sm" soft>
                Bewertung (nur die Konto-Führung darf sie setzen)
              </Txt>
              <Row gap={8}>
                {[1, 2, 3, 4, 5].map((n) => (
                  <Pressable
                    key={n}
                    accessibilityRole="button"
                    accessibilityState={{ selected: bewertung === n }}
                    onPress={() => setBewertung(bewertung === n ? null : n)}
                  >
                    <Chip variant={bewertung === n ? "on" : ""}>{String(n)}</Chip>
                  </Pressable>
                ))}
              </Row>
            </Col>
          )}
          <Btn variant="dark" block onPress={saving ? undefined : rueckmeldungSpeichern}>
            {saving ? "Wird gespeichert …" : "Speichern"}
          </Btn>
        </Col>
      </Sheet>

      <Sheet
        open={vertretungOffen}
        onClose={() => setVertretungOffen(false)}
        header={<Txt v="h2">Vertretung anfragen</Txt>}
      >
        <Col gap={14} style={{ paddingBottom: 8 }}>
          <Feld
            wert={vertretungNotiz}
            setWert={setVertretungNotiz}
            platzhalter="Grund (optional)"
            mehrzeilig
            bearbeitbar={!saving}
          />
          <Btn variant="dark" block onPress={saving ? undefined : vertretungAnfragen}>
            {saving ? "Wird gesendet …" : "Anfrage stellen"}
          </Btn>
        </Col>
      </Sheet>

      {abschliessbar && (
        <View
          style={{
            position: "absolute",
            left: 0,
            right: 0,
            bottom: 0,
            paddingHorizontal: 24,
            paddingTop: 16,
            paddingBottom: insets.bottom + 16,
            backgroundColor: t.palette.surface,
            borderTopWidth: 1,
            borderTopColor: t.palette.line,
          }}
        >
          <Btn variant="dark" block onPress={saving ? undefined : complete}>
            {saving ? "Wird abgeschlossen …" : "Aufgabe abschließen"}
          </Btn>
        </View>
      )}
    </View>
  );
}

/** Ein Abschnitt mit Überschrift, oben von einer Linie abgesetzt. */
function Abschnitt({
  titel,
  rechts,
  children,
}: {
  titel: string;
  rechts?: string;
  children: React.ReactNode;
}) {
  const t = useTheme();
  return (
    <Col gap={12}>
      <View style={{ height: 1, backgroundColor: t.palette.line }} />
      <Row style={{ justifyContent: "space-between" }}>
        <Txt v="h2">{titel}</Txt>
        {rechts ? (
          <Txt v="sm" soft>
            {rechts}
          </Txt>
        ) : null}
      </Row>
      {children}
    </Col>
  );
}

/**
 * Die Fotos eines Punktes (oder der Aufgabe) samt Knopf zum Hinzufügen.
 *
 * `urls` sind signierte, kurzlebige Links; `anzahl` zählt die tatsächlich
 * gespeicherten Nachweise. Beides kann auseinanderlaufen — schlägt das
 * Signieren eines Bildes fehl, fällt genau dieses Bild aus der Anzeige, statt
 * eine tote URL zu zeigen. Dann sagt die Leiste, wie viele nicht angezeigt
 * werden können, anstatt zu behaupten, es gäbe sie nicht.
 */
function Fotoleiste({
  urls,
  anzahl,
  pflicht,
  laedt,
  onHinzufuegen,
}: {
  urls: string[];
  anzahl: number;
  pflicht?: boolean;
  laedt: boolean;
  onHinzufuegen: () => void;
}) {
  const t = useTheme();
  const fehlend = Math.max(0, anzahl - urls.length);
  if (!pflicht && anzahl === 0 && !laedt) {
    return (
      <Pressable
        accessibilityRole="button"
        onPress={onHinzufuegen}
        style={({ pressed }) => ({ paddingVertical: 8, opacity: pressed ? 0.6 : 1 })}
      >
        <Row gap={8}>
          <Icon n="cam" s={16} sw={2} c={t.palette.soft} />
          <Txt v="sm" soft>
            Foto hinzufügen
          </Txt>
        </Row>
      </Pressable>
    );
  }
  return (
    <Col gap={6} style={{ paddingBottom: 12 }}>
      <Row gap={8} style={{ flexWrap: "wrap" }}>
        {urls.map((url) => (
          <Image
            key={url}
            source={{ uri: url }}
            style={{
              width: 64,
              height: 64,
              borderRadius: 10,
              backgroundColor: t.palette.surface2,
            }}
            resizeMode="cover"
          />
        ))}
        {/* Gespeicherte Nachweise, für die es (noch) keine anzeigbare URL gibt,
            werden als gefüllte Kachel gezeigt — sie sind DA. Ein Satz Prosa an
            dieser Stelle sah nach einem Fehler aus, obwohl das Foto längst im
            Bucket liegt. */}
        {Array.from({ length: fehlend }, (_, i) => (
          <View
            key={`ohne-url-${i}`}
            accessibilityLabel="Gespeicherter Nachweis"
            style={{
              width: 64,
              height: 64,
              borderRadius: 10,
              backgroundColor: t.palette.surface2,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icon n="check" s={18} sw={2} c={t.palette.soft} />
          </View>
        ))}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Foto hinzufügen"
          onPress={laedt ? undefined : onHinzufuegen}
          disabled={laedt}
          style={({ pressed }) => ({
            width: 64,
            height: 64,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: t.palette.line,
            alignItems: "center",
            justifyContent: "center",
            opacity: pressed || laedt ? 0.5 : 1,
          })}
        >
          {laedt ? <Spinner /> : <Icon n="cam" s={20} sw={2} c={t.palette.soft} />}
        </Pressable>
      </Row>
    </Col>
  );
}

function Zeile({ icon, text }: { icon: IconName; text: string }) {
  const t = useTheme();
  return (
    <Row gap={8}>
      <Icon n={icon} s={15} sw={2} c={t.palette.soft} />
      <Txt v="body" soft style={{ flex: 1 }}>
        {text}
      </Txt>
    </Row>
  );
}

function Feld({
  wert,
  setWert,
  platzhalter,
  mehrzeilig,
  numerisch,
  bearbeitbar,
}: {
  wert: string;
  setWert: (v: string) => void;
  platzhalter: string;
  mehrzeilig?: boolean;
  numerisch?: boolean;
  bearbeitbar?: boolean;
}) {
  const t = useTheme();
  return (
    <TextInput
      style={{
        borderWidth: 1,
        borderColor: t.palette.line,
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
        color: t.palette.ink,
        backgroundColor: t.palette.bg,
        minHeight: mehrzeilig ? 84 : undefined,
        textAlignVertical: mehrzeilig ? "top" : "center",
      }}
      placeholder={platzhalter}
      placeholderTextColor={t.palette.faint}
      value={wert}
      onChangeText={setWert}
      multiline={mehrzeilig}
      keyboardType={numerisch ? "decimal-pad" : "default"}
      editable={bearbeitbar}
    />
  );
}

/**
 * Checklistenpunkte nach Raum gruppieren, Reihenfolge wie geliefert
 * (`sort_order` vom Server). Punkte ohne Raum kommen zuletzt in eine eigene
 * Gruppe — sie unter einen fremden Raum zu schieben wäre eine Behauptung.
 */
function raumGruppen(
  punkte: ChecklistItem[],
): { raum: string | null; punkte: ChecklistItem[] }[] {
  const nachRaum = new Map<string, ChecklistItem[]>();
  const ohne: ChecklistItem[] = [];
  for (const p of punkte) {
    if (!p.room) {
      ohne.push(p);
      continue;
    }
    const liste = nachRaum.get(p.room);
    if (liste) liste.push(p);
    else nachRaum.set(p.room, [p]);
  }
  const gruppen: { raum: string | null; punkte: ChecklistItem[] }[] = [
    ...nachRaum.entries(),
  ].map(([raum, liste]) => ({ raum, punkte: liste }));
  if (ohne.length > 0) gruppen.push({ raum: null, punkte: ohne });
  return gruppen;
}

function ZurueckKnopf({ onPress }: { onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Zurück"
      onPress={onPress}
      hitSlop={10}
      style={({ pressed }) => ({ padding: 8, opacity: pressed ? 0.6 : 1 })}
    >
      <Icon n="back" s={22} sw={2} c={t.palette.ink} />
    </Pressable>
  );
}

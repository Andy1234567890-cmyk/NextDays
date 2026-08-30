// Werkzeuge zum Antworten: Vorlage einfügen, KI-Vorschlag, geplantes Senden,
// Anhänge (Etappe 2 der Mobil-Angleichung).
//
// FORM: EIN Knopf im Eingabefeld öffnet diese Liste — wie das „+" bei WhatsApp
// und Airbnb. Vorher stand hier ein Streifen aus vier Chips über dem
// Antwortfeld. Der war aus drei Gründen falsch:
//   * Er kostete zwei Zeilen dauerhaft, im Chat, wo der Verlauf das Wichtige
//     ist — bei offener Tastatur blieben von der Konversation ein paar Zeilen.
//   * Er trug die Optik der FILTER-Chips aus der Liste, war aber eine
//     Aktionsleiste. Gleiches Aussehen für Verschiedenes.
//   * Vier gleich gewichtete Chips für Dinge, die man einmal je Vorgang
//     braucht, während das Eingabefeld darunter optisch abgehängt war.
//
// WAS BEWUSST FEHLT und warum:
//  * Vorlagen ANLEGEN/ÄNDERN — der Web-Editor führt sie mehrsprachig mit
//    Betreff und Autorenformat. Auf dem Telefon wird eine Vorlage benutzt,
//    nicht geschrieben.
//  * Anhänge HOCHLADEN — dafür braucht es eine native Bildauswahl
//    (react-native-image-picker o. ä.), die diese App nicht enthält. Eine neue
//    native Abhängigkeit gehört nicht nebenbei in eine UI-Etappe. Vorhandene
//    Anhänge werden gezeigt und lassen sich öffnen.
//  * Ein Datums-/Zeit-Picker — es gibt keinen im Projekt. Statt einen
//    einzubauen, bietet das Sheet die Zeitpunkte an, die man unterwegs
//    tatsächlich wählt (in einer Stunde, heute Abend, morgen früh). Das ist
//    keine Notlösung, sondern auf einem Telefon die schnellere Bedienung.
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  TextInput,
  View,
} from "react-native";

import { Icon } from "@/components/ui/Icon";
import { Btn, Col, Divider, Row, Txt } from "@/components/ui/kit";
import { Sheet } from "@/components/ui/patterns";
import {
  cancelScheduled,
  createKnowledge,
  deleteAttachment,
  getAiReply,
  istBuchungsThread,
  listAttachments,
  uploadAttachment,
  listScheduled,
  listTemplates,
  renderForThread,
  scheduleMessage,
  type AiReplyResponse,
  type Attachment,
  type MessageTemplate,
  type ScheduledMessage,
} from "@/lib/inbox";
import { dateiWaehlen } from "@/lib/datei";
import { useTheme } from "@/theme/ThemeProvider";

/**
 * Zeitpunkte, die unterwegs gewählt werden — statt eines Kalender-Pickers.
 * Exportiert, weil die Regel „nie ein Zeitpunkt in der Vergangenheit" geprüft
 * wird: der Server weist so etwas ab, und ein Knopf, der garantiert in eine
 * Fehlermeldung führt, ist schlimmer als einer, der fehlt.
 *
 * `jetzt` ist ein Parameter und keine interne `new Date()`, damit der Test die
 * Uhrzeit setzen kann, ohne die Systemzeit zu verbiegen.
 */
export function planVorschlaege(jetzt: Date = new Date()): { label: string; at: Date }[] {
  const inEinerStunde = new Date(jetzt.getTime() + 60 * 60 * 1000);

  const heuteAbend = new Date(jetzt);
  heuteAbend.setHours(18, 0, 0, 0);

  const morgenFrueh = new Date(jetzt);
  morgenFrueh.setDate(morgenFrueh.getDate() + 1);
  morgenFrueh.setHours(9, 0, 0, 0);

  const morgenMittag = new Date(jetzt);
  morgenMittag.setDate(morgenMittag.getDate() + 1);
  morgenMittag.setHours(15, 0, 0, 0);

  return [
    { label: "In einer Stunde", at: inEinerStunde },
    // „Heute 18:00" nur, wenn das noch in der Zukunft liegt — ein Zeitpunkt in
    // der Vergangenheit wird vom Server abgewiesen, und ihn anzubieten wäre ein
    // Klick in eine Fehlermeldung.
    ...(heuteAbend > jetzt ? [{ label: "Heute 18:00", at: heuteAbend }] : []),
    { label: "Morgen 9:00", at: morgenFrueh },
    { label: "Morgen 15:00", at: morgenMittag },
  ];
}

/** Wie im Server (`KnowledgeFactUpsert`) und im Dashboard. */
const MAX_TITEL = 200;
const MAX_FAKT = 2000;

function zeitText(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AntwortWerkzeuge({
  threadId,
  entwurf,
  offen,
  onSchliessen,
  onEntwurf,
  onGeplant,
  onGeplantZahl,
  onEskaliert,
}: {
  threadId: string;
  /** Der aktuelle Text im Antwortfeld — Grundlage fürs Planen. */
  entwurf: string;
  /** Das Werkzeug-Sheet ist offen (Knopf im Eingabefeld). */
  offen: boolean;
  onSchliessen: () => void;
  /** Setzt den Text im Antwortfeld (Vorlage, KI-Vorschlag). */
  onEntwurf: (text: string) => void;
  /** Nach erfolgreichem Planen: Entwurf leeren, Hinweis zeigen. */
  onGeplant: () => void;
  /** Zahl der geplanten Nachrichten — der Composer setzt daran seinen Punkt. */
  onGeplantZahl: (anzahl: number) => void;
  /** Das Modell hat negativen Tenor erkannt und den Verlauf eskaliert — der
   *  Bildschirm lädt den Hinweis daraufhin neu. Optional: nicht jeder Aufrufer
   *  zeigt den Kasten. */
  onEskaliert?: () => void;
}) {
  const t = useTheme();
  const [sheet, setSheet] = useState<
    null | "vorlagen" | "planen" | "anhaenge" | "ki"
  >(null);
  const [vorlagen, setVorlagen] = useState<MessageTemplate[] | null>(null);
  const [geplant, setGeplant] = useState<ScheduledMessage[]>([]);
  const [anhaenge, setAnhaenge] = useState<Attachment[] | null>(null);
  // Warum eine Liste leer ist: „nichts vorhanden" oder „Aufruf fehlgeschlagen"
  // sind zwei verschiedene Auskünfte, und die zweite darf nicht als die erste
  // erscheinen (Wurzel 5).
  const [ladefehler, setLadefehler] = useState<string | null>(null);
  const [kiLaeuft, setKiLaeuft] = useState(false);
  // Das ganze Ergebnis, nicht nur der Text: Quellen und Wissenslücke gehören
  // zum Vorschlag und werden mit ihm gezeigt. Vorher landete der Text im Feld
  // und die Quellen in einem Alert — der ist weg, sobald man ihn wegtippt,
  // also genau dann, wenn man beim Lesen der Antwort nachsehen möchte.
  const [ki, setKi] = useState<AiReplyResponse | null>(null);
  // Der Vorschlag ist ÄNDERBAR, bevor er ins Feld geht: das Telefon ist der
  // Ort, an dem man einen Satz noch schnell umschreibt.
  const [kiText, setKiText] = useState("");
  const [kiQuellenOffen, setKiQuellenOffen] = useState(false);
  // „Der KI beibringen": das Eingabefeld ist zugeklappt, bis jemand es will —
  // die Lücke zu SEHEN ist der häufigere Fall als sie sofort zu füllen.
  const [lernOffen, setLernOffen] = useState(false);
  const [lernText, setLernText] = useState("");
  const [suche, setSuche] = useState("");
  const [busy, setBusy] = useState(false);

  // Die geplanten Nachrichten stehen als Zahl am Werkzeug — sonst weiß niemand,
  // dass für diesen Thread schon etwas in der Warteschlange liegt.
  const geplantLaden = useCallback(async () => {
    // Nur Buchungs-Threads haben geplante Nachrichten. Für Anfragen,
    // Marktplatz-, Übernahme- und WhatsApp-Threads lief hier bei jedem Öffnen
    // ein Aufruf ins Leere.
    if (!istBuchungsThread(threadId)) {
      setGeplant([]);
      onGeplantZahl(0);
      return;
    }
    const res = await listScheduled(threadId);
    const items = res.ok ? res.data.items : [];
    setGeplant(items);
    onGeplantZahl(items.length);
  }, [threadId, onGeplantZahl]);

  useEffect(() => {
    geplantLaden();
  }, [geplantLaden]);

  // Beim Wechsel des Verlaufs alles Vorschlagsbezogene verwerfen. Sonst stünde
  // der Vorschlag für Gast A im Sheet, während Gast B offen ist — und ein
  // Druck auf „Übernehmen" schriebe den fremden Text ins Feld.
  useEffect(() => {
    setKi(null);
    setKiText("");
    setKiQuellenOffen(false);
    setLernOffen(false);
    setLernText("");
  }, [threadId]);

  // Titel-Suche, nicht Volltext: gesucht wird die Vorlage, nicht eine Stelle
  // in ihrem Text.
  const gefilterteVorlagen = (vorlagen ?? []).filter((v) =>
    v.title.toLowerCase().includes(suche.trim().toLowerCase()),
  );

  const vorlagenOeffnen = async () => {
    setSheet("vorlagen");
    setLadefehler(null);
    if (vorlagen) return;
    const res = await listTemplates();
    if (!res.ok) {
      setVorlagen([]);
      setLadefehler(res.error);
      return;
    }
    setVorlagen(res.data.items);
  };

  const anhaengeOeffnen = async () => {
    setSheet("anhaenge");
    setLadefehler(null);
    setAnhaenge(null);
    const res = await listAttachments(threadId);
    if (!res.ok) {
      setAnhaenge([]);
      setLadefehler(res.error);
      return;
    }
    setAnhaenge(res.data.items);
  };

  /**
   * Vorlage einfügen — IMMER über `render`, nie den Rohtext. Sonst stünde
   * `{{guest_name}}` in der Nachricht an den Gast. Scheitert das Auflösen
   * (422: ein benutztes Feld hat keinen Wert), wird NICHTS eingefügt: der
   * Grund steht in der Meldung, und der Text darf so nicht raus.
   */
  const vorlageEinfuegen = async (vorlage: MessageTemplate) => {
    setBusy(true);
    const res = await renderForThread(threadId, vorlage.body);
    setBusy(false);
    if (!res.ok) {
      Alert.alert("Vorlage nicht vollständig", res.error);
      return;
    }
    onEntwurf(res.data.text);
    setSheet(null);
  };

  const kiVorschlag = async () => {
    setKiLaeuft(true);
    const res = await getAiReply(threadId);
    setKiLaeuft(false);
    if (!res.ok) {
      Alert.alert("Kein Vorschlag", res.error);
      return;
    }
    setKi(res.data);
    setKiText(res.data.reply);
    setKiQuellenOffen(false);
    setSheet("ki");
    // Hat das Modell negativen Tenor erkannt, trägt der Verlauf jetzt ein
    // Merkmal — der Bildschirm lädt die Eskalation daraufhin neu.
    if (res.data.eskaliert) onEskaliert?.();
  };

  /** Den Vorschlag ins Antwortfeld übernehmen. Er geht NICHT von selbst an den
   *  Gast: abgeschickt wird von Hand, mit dem regulären Sendeknopf. */
  const kiUebernehmen = () => {
    onEntwurf(kiText);
    setSheet(null);
  };

  /**
   * Die gemeldete Wissenslücke als Fakt speichern — der Punkt, an dem sich die
   * Wissensdatenbank von selbst füllt: der Betrieb sieht die Lücke in dem
   * Moment, in dem sie ihn stört.
   *
   * Die Eingabe steht als Feld IM Sheet, nicht in `Alert.prompt`: das gibt es
   * nur auf iOS. Auf Android wäre der Knopf wirkungslos gewesen — ohne Fehler,
   * ohne Hinweis, also nicht als Fehler erkennbar.
   *
   * `property_id: null` — betriebsweit. Auf dem Telefon fehlt die Objektwahl
   * (das Dashboard hat sie), und betriebsweit ist die sichere Richtung: der
   * Fakt gilt dann überall, statt am falschen Objekt zu hängen.
   */
  const kiBeibringen = async () => {
    const luecke = ki?.fehlende_angabe;
    const text = lernText.trim();
    if (!luecke || !text) return;
    setBusy(true);
    const res = await createKnowledge({
      property_id: null,
      titel: luecke.slice(0, MAX_TITEL),
      fact: text,
      kategorie: "sonstiges",
    });
    setBusy(false);
    if (!res.ok) {
      Alert.alert("Nicht gespeichert", res.error);
      return;
    }
    // Die Lücke ist geschlossen — der Kasten verschwindet, statt beim nächsten
    // Blick erneut nach derselben Angabe zu fragen.
    setKi((prev) => (prev ? { ...prev, fehlende_angabe: null } : prev));
    setLernText("");
    setLernOffen(false);
    Alert.alert("Gespeichert", "Die KI kennt die Angabe ab jetzt.");
  };

  const planen = async (at: Date) => {
    const text = entwurf.trim();
    if (!text) {
      Alert.alert("Kein Text", "Bitte zuerst die Nachricht schreiben.");
      return;
    }
    setBusy(true);
    const res = await scheduleMessage(threadId, text, at.toISOString());
    setBusy(false);
    if (!res.ok) {
      Alert.alert("Nicht geplant", res.error);
      return;
    }
    setSheet(null);
    onGeplant();
    geplantLaden();
  };

  const geplantAbbrechen = async (id: string) => {
    setBusy(true);
    const res = await cancelScheduled(id);
    setBusy(false);
    if (!res.ok) {
      Alert.alert("Nicht abgebrochen", res.error);
      return;
    }
    geplantLaden();
  };

  /**
   * Datei waehlen und hochladen.
   *
   * Bis 28.08.2026 stand hier nur der Satz „Hochladen geht derzeit nur im
   * Dashboard — der App fehlt die Dateiauswahl". Das stimmte, war aber kein
   * Naturgesetz: Auswahl (`lib/foto.ts`), Endpunkt und Multipart-Muster
   * (`lib/tasks.ts`) gab es laengst — es fehlte nur diese Verbindung.
   *
   * Der Waehler bietet genau das an, was der Server annimmt: Bilder UND PDF
   * (`lib/datei.ts`). Ein Waehler, der alles anbietet und danach 422 sagt,
   * waere eine Falle — und ein reiner Bildwaehler haette den haeufigsten
   * Anhang des Betriebs ausgeschlossen (Rechnung, Grundriss, Anfahrtsskizze).
   */
  const anhangWaehlen = async () => {
    const wahl = await dateiWaehlen();
    // Abgebrochen ist KEIN Fehler — kein Alert, der Nutzer hat zurueckgetippt.
    if (wahl.art === "abgebrochen") return;
    if (wahl.art === "fehler") {
      Alert.alert("Datei nicht gewählt", wahl.text);
      return;
    }
    setBusy(true);
    const res = await uploadAttachment(threadId, wahl.datei);
    setBusy(false);
    if (!res.ok) {
      Alert.alert("Nicht hochgeladen", res.error);
      return;
    }
    // Der Kanal kann die Datei abgelehnt haben, obwohl der Upload gelang. Das
    // ist der Normalfall bei Airbnb+PDF und darf nicht als Erfolg durchgehen
    // (Wurzel 5): die Datei liegt bei uns, beim Gast kam sie nie an.
    if (res.data.channel_error) {
      Alert.alert(
        "Beim Portal nicht angekommen",
        `${res.data.channel_error}\n\nDie Datei ist gespeichert, der Gast hat sie aber nicht erhalten.`,
      );
    }
    setAnhaenge((prev) => [...(prev ?? []), res.data]);
  };

  const anhangLoeschen = async (id: string) => {
    setBusy(true);
    const res = await deleteAttachment(id);
    setBusy(false);
    if (!res.ok) {
      Alert.alert("Nicht gelöscht", res.error);
      return;
    }
    setAnhaenge((prev) => (prev ?? []).filter((a) => a.id !== id));
  };

  /** Eine Zeile der Werkzeugliste: Symbol, Beschriftung, erklärender Zusatz. */
  const werkzeug = (
    icon: Parameters<typeof Icon>[0]["n"],
    label: string,
    hinweis: string,
    onPress: () => void,
  ) => (
    <Pressable
      onPress={busy ? undefined : onPress}
      style={({ pressed }) => ({ paddingVertical: 14, opacity: pressed ? 0.6 : 1 })}
    >
      <Row style={{ gap: 12 }}>
        <Icon n={icon} s={20} sw={2} c={t.palette.ink} />
        <Col style={{ flex: 1 }}>
          <Txt v="body">{label}</Txt>
          <Txt v="xs" soft>
            {hinweis}
          </Txt>
        </Col>
      </Row>
      <Divider style={{ marginTop: 12 }} />
    </Pressable>
  );

  return (
    <>
      {/* Der Zugang: eine Liste mit ausgeschriebenen Beschriftungen statt
          Symbolen, die man raten muss. */}
      <Sheet
        open={offen}
        onClose={onSchliessen}
        header={<Txt v="title">Antworten mit …</Txt>}
      >
        <Col>
          {werkzeug("doc", "Vorlage einfügen", "Mit den Daten dieser Buchung gefüllt", () => {
            onSchliessen();
            vorlagenOeffnen();
          })}
          {werkzeug(
            "sparkle",
            kiLaeuft ? "Vorschlag wird erstellt …" : "KI-Vorschlag",
            "Entwurf aus Verlauf und Buchung — du schickst ihn ab",
            () => {
              onSchliessen();
              kiVorschlag();
            },
          )}
          {/* Beides hängt an der Buchung — bei einer Anfrage oder einem
              übernommenen Verlauf gibt es dafür keine Zeile. */}
          {istBuchungsThread(threadId) &&
            werkzeug(
            "clock",
            "Später senden",
            geplant.length
              ? `${geplant.length} bereits geplant`
              : "Zeitpunkt wählen, Text bleibt liegen",
            () => {
              onSchliessen();
              setSheet("planen");
            },
          )}
          {istBuchungsThread(threadId) &&
            werkzeug("share", "Anhänge", "Dateien dieser Konversation", () => {
              onSchliessen();
              anhaengeOeffnen();
            })}
        </Col>
      </Sheet>

      {/* --- Vorlagen ---------------------------------------------------- */}
      <Sheet
        open={sheet === "vorlagen"}
        onClose={() => setSheet(null)}
        full
        header={<Txt v="title">Vorlage einfügen</Txt>}
      >
        {!vorlagen ? (
          <ActivityIndicator color={t.palette.accent} />
        ) : ladefehler ? (
          <Txt v="sm" color={t.palette.accent}>
            {ladefehler}
          </Txt>
        ) : vorlagen.length === 0 ? (
          <Txt v="sm" soft>
            Noch keine Vorlagen. Angelegt werden sie im Dashboard.
          </Txt>
        ) : (
          <Col gap={2}>
            {/* Suche erst, wenn die Liste lang wird — bei fünf Vorlagen wäre
                ein Feld mehr Bedienung als Nutzen. */}
            {vorlagen.length > 8 && (
              <TextInput
                value={suche}
                onChangeText={setSuche}
                placeholder="Vorlage suchen"
                placeholderTextColor={t.palette.faint}
                autoCorrect={false}
                style={{
                  backgroundColor: t.palette.bg,
                  borderWidth: 1,
                  borderColor: t.palette.line,
                  borderRadius: 12,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                  fontSize: 15,
                  color: t.palette.ink,
                  marginBottom: 6,
                }}
              />
            )}
            {/* NUR der Titel. Vorher stand darunter der Anfang des Textes — mit
                rohen Platzhaltern („Dear {{guest_first_name}}") und in der
                Sprache der Vorlage. Das war zwei Zeilen Rauschen je Eintrag,
                machte die Liste doppelt so hoch und beantwortete die einzige
                Frage nicht, die hier zählt: welche Vorlage ist es. Der
                aufgelöste Text erscheint ohnehin sofort im Antwortfeld. */}
            {gefilterteVorlagen.map((v) => (
              <Pressable
                key={v.id}
                onPress={() => vorlageEinfuegen(v)}
                disabled={busy}
                style={({ pressed }) => ({
                  paddingVertical: 15,
                  opacity: pressed ? 0.6 : 1,
                })}
              >
                <Txt v="body" numberOfLines={1}>
                  {v.title}
                </Txt>
                <Divider style={{ marginTop: 13 }} />
              </Pressable>
            ))}
            {gefilterteVorlagen.length === 0 && (
              <Txt v="sm" soft>
                Keine Vorlage passt zu „{suche}".
              </Txt>
            )}
          </Col>
        )}
      </Sheet>

      {/* --- KI-Vorschlag -------------------------------------------------- */}
      {/* Der Vorschlag steht in einem eigenen Sheet, nicht direkt im Feld.
          Grund: er kommt mit QUELLEN und ggf. einer gemeldeten Wissenslücke —
          beides gehört zur Antwort. Vorher landete der Text sofort im Feld und
          die Quellen in einem Alert; wer den wegtippte, konnte nicht mehr
          nachsehen, worauf sich der Satz stützt. Genau das ist aber die Frage
          vor dem Absenden: ist das belegt oder erfunden? */}
      <Sheet
        open={sheet === "ki"}
        onClose={() => setSheet(null)}
        full
        header={<Txt v="title">KI-Vorschlag</Txt>}
      >
        {ki && (
          <Col gap={14}>
            {/* Änderbar, bevor er ins Feld geht — nicht erst danach. */}
            <TextInput
              value={kiText}
              onChangeText={setKiText}
              multiline
              textAlignVertical="top"
              style={{
                minHeight: 140,
                backgroundColor: t.palette.bg,
                borderWidth: 1,
                borderColor: t.palette.line,
                borderRadius: 12,
                paddingHorizontal: 14,
                paddingVertical: 12,
                fontSize: 15,
                lineHeight: 21,
                color: t.palette.ink,
              }}
            />

            {/* Quellen: zugeklappt, weil der Text die Hauptsache ist. Ein
                Eintrag mit Klammer beschreibt etwas, das FEHLT (gekürzt,
                gesperrt, kein Platz) — er bekommt ein anderes Zeichen, damit
                beim Überfliegen sichtbar ist, was die Antwort NICHT wusste. */}
            {ki.sources.length > 0 && (
              <Col gap={8}>
                <Divider />
                <Pressable
                  onPress={() => setKiQuellenOffen((v) => !v)}
                  hitSlop={8}
                  style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
                >
                  <Row style={{ gap: 6 }}>
                    <Icon
                      n={kiQuellenOffen ? "caretdown" : "chevron"}
                      s={14}
                      sw={2}
                      c={t.palette.soft}
                    />
                    <Txt v="xs" soft>
                      Stützt sich auf {ki.sources.length}{" "}
                      {ki.sources.length === 1 ? "Grundlage" : "Grundlagen"}
                    </Txt>
                  </Row>
                </Pressable>
                {kiQuellenOffen &&
                  ki.sources.map((q) => (
                    <Row key={q} style={{ gap: 8, alignItems: "flex-start" }}>
                      <Icon
                        n={q.includes("(") ? "info" : "check"}
                        s={13}
                        sw={2}
                        c={t.palette.soft}
                      />
                      <Txt v="xs" soft style={{ flex: 1 }}>
                        {q}
                      </Txt>
                    </Row>
                  ))}
              </Col>
            )}

            {/* Wissenslücke: DER Punkt, an dem sich die Wissensdatenbank von
                selbst füllt. Ohne diesen Weg bleibt sie leer, egal wie gut die
                Verwaltungsmaske ist — die Lücke fällt hier auf, nicht dort. */}
            {ki.fehlende_angabe && (
              <Col
                gap={10}
                style={{
                  borderWidth: 1,
                  borderColor: t.palette.line,
                  backgroundColor: t.palette.surface2,
                  borderRadius: 14,
                  padding: 14,
                }}
              >
                <Row style={{ gap: 8, alignItems: "flex-start" }}>
                  <Icon n="info" s={16} sw={2} c={t.palette.accent} />
                  <Txt v="sm" style={{ flex: 1 }}>
                    Dazu fehlt der KI eine Angabe: {ki.fehlende_angabe}
                  </Txt>
                </Row>
                {lernOffen ? (
                  <Col gap={8}>
                    <TextInput
                      value={lernText}
                      onChangeText={setLernText}
                      multiline
                      autoFocus
                      maxLength={MAX_FAKT}
                      placeholder="Die richtige Auskunft — sie gilt dann für alle Objekte."
                      placeholderTextColor={t.palette.faint}
                      textAlignVertical="top"
                      style={{
                        minHeight: 80,
                        backgroundColor: t.palette.bg,
                        borderWidth: 1,
                        borderColor: t.palette.line,
                        borderRadius: 12,
                        paddingHorizontal: 12,
                        paddingVertical: 10,
                        fontSize: 14,
                        color: t.palette.ink,
                      }}
                    />
                    <Row style={{ gap: 8, justifyContent: "flex-end" }}>
                      <Btn
                        variant="ghost"
                        onPress={() => {
                          setLernOffen(false);
                          setLernText("");
                        }}
                      >
                        Abbrechen
                      </Btn>
                      <Btn
                        onPress={busy || !lernText.trim() ? undefined : kiBeibringen}
                        disabled={busy || !lernText.trim()}
                      >
                        Speichern
                      </Btn>
                    </Row>
                  </Col>
                ) : (
                  <Btn variant="outline" block onPress={() => setLernOffen(true)}>
                    Der KI beibringen
                  </Btn>
                )}
              </Col>
            )}

            {/* Der Hinweis steht NACH dem Vorschlag: er betrifft den Verlauf,
                nicht den Text. Das Merkmal ist bereits gesetzt — hier steht
                nur, DASS es passiert ist, damit es niemanden überrascht. */}
            {ki.eskaliert && (
              <Row style={{ gap: 8, alignItems: "flex-start" }}>
                <Icon n="bell" s={15} sw={2} c={t.palette.accent} />
                <Txt v="xs" soft style={{ flex: 1 }}>
                  Der Gast klingt verärgert — der Verlauf ist als eskaliert
                  markiert.
                </Txt>
              </Row>
            )}

            <Divider />
            {/* „Übernehmen", nicht „Senden": der Text geht ins Feld, abgeschickt
                wird mit dem regulären Sendeknopf. Ein Sendeknopf hier hiesse,
                dass ein KI-Satz das Telefon ungelesen verlassen kann. */}
            <Btn
              block
              icon="check"
              onPress={kiText.trim() ? kiUebernehmen : undefined}
              disabled={!kiText.trim()}
            >
              In die Antwort übernehmen
            </Btn>
            <Txt v="xs" soft style={{ textAlign: "center" }}>
              Der Text landet im Antwortfeld — gesendet wird von dir.
            </Txt>
          </Col>
        )}
      </Sheet>

      {/* --- Später senden ----------------------------------------------- */}
      <Sheet
        open={sheet === "planen"}
        onClose={() => setSheet(null)}
        header={<Txt v="title">Später senden</Txt>}
      >
        <Col gap={12}>
          {geplant.length > 0 && (
            <Col gap={8}>
              <Txt v="sm" soft>
                Bereits geplant
              </Txt>
              {geplant.map((g) => (
                <Row key={g.id} style={{ justifyContent: "space-between", gap: 12 }}>
                  <Col style={{ flex: 1 }}>
                    <Txt v="sm">{zeitText(g.send_at)}</Txt>
                    <Txt v="xs" soft numberOfLines={1}>
                      {g.body}
                    </Txt>
                  </Col>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Geplante Nachricht abbrechen"
                    onPress={() => geplantAbbrechen(g.id)}
                    hitSlop={8}
                    disabled={busy}
                  >
                    <Icon n="x" s={18} sw={2} c={t.palette.soft} />
                  </Pressable>
                </Row>
              ))}
              <Divider />
            </Col>
          )}

          <Txt v="sm" soft>
            {entwurf.trim()
              ? "Der geschriebene Text wird zum gewählten Zeitpunkt gesendet."
              : "Schreibe zuerst die Nachricht — geplant wird der Text im Feld."}
          </Txt>
          {planVorschlaege().map((v) => (
            <Btn
              key={v.label}
              variant="outline"
              block
              onPress={busy ? undefined : () => planen(v.at)}
            >
              {v.label}
            </Btn>
          ))}
        </Col>
      </Sheet>

      {/* --- Anhänge ------------------------------------------------------ */}
      <Sheet
        open={sheet === "anhaenge"}
        onClose={() => setSheet(null)}
        header={<Txt v="title">Anhänge</Txt>}
      >
        {!anhaenge ? (
          <ActivityIndicator color={t.palette.accent} />
        ) : ladefehler ? (
          <Txt v="sm" color={t.palette.accent}>
            {ladefehler}
          </Txt>
        ) : anhaenge.length === 0 ? (
          <Col gap={10}>
            <Txt v="sm" soft>
              Keine Anhänge in dieser Konversation.
            </Txt>
            <Btn variant="outline" block onPress={busy ? undefined : anhangWaehlen}>
              Datei anhängen
            </Btn>
            {/* Was geht, steht da — nicht was nicht geht. Die Liste ist die
                des Servers (`_dateityp`), nicht eine geratene. */}
            <Txt v="xs" soft>
              Bilder und PDF, bis 10 MB.
            </Txt>
          </Col>
        ) : (
          <Col gap={2}>
            {anhaenge.map((a) => (
              <View key={a.id} style={{ paddingVertical: 12 }}>
                <Row style={{ justifyContent: "space-between", gap: 12 }}>
                  <Pressable
                    style={{ flex: 1 }}
                    disabled={!a.url}
                    onPress={() => a.url && Linking.openURL(a.url)}
                  >
                    <Txt v="body" numberOfLines={1}>
                      {a.filename}
                    </Txt>
                    <Txt v="xs" soft>
                      {Math.max(1, Math.round(a.size / 1024))} KB ·{" "}
                      {a.sent_at ? "gesendet" : "nur bei uns"}
                    </Txt>
                    {/* Der Kanal-Fehler ist die Erklärung, warum eine Datei
                        beim Gast nie ankam (Airbnb nimmt kein PDF). */}
                    {a.channel_error && (
                      <Txt v="xs" color={t.palette.accent}>
                        {a.channel_error}
                      </Txt>
                    )}
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Anhang löschen"
                    onPress={() => anhangLoeschen(a.id)}
                    hitSlop={8}
                    disabled={busy}
                  >
                    <Icon n="x" s={18} sw={2} c={t.palette.soft} />
                  </Pressable>
                </Row>
                <Divider style={{ marginTop: 12 }} />
              </View>
            ))}
            {/* Auch hier, nicht nur im Leerfall: sonst liesse sich genau EINE
                Datei anhaengen und danach nie wieder eine zweite. */}
            <Btn
              variant="outline"
              block
              onPress={busy ? undefined : anhangWaehlen}
            >
              Weitere Datei anhängen
            </Btn>
          </Col>
        )}
      </Sheet>
    </>
  );
}

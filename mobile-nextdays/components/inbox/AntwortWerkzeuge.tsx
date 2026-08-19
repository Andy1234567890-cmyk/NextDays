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
  deleteAttachment,
  getAiReply,
  istBuchungsThread,
  listAttachments,
  listScheduled,
  listTemplates,
  renderForThread,
  scheduleMessage,
  type Attachment,
  type MessageTemplate,
  type ScheduledMessage,
} from "@/lib/inbox";
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
}) {
  const t = useTheme();
  const [sheet, setSheet] = useState<null | "vorlagen" | "planen" | "anhaenge">(null);
  const [vorlagen, setVorlagen] = useState<MessageTemplate[] | null>(null);
  const [geplant, setGeplant] = useState<ScheduledMessage[]>([]);
  const [anhaenge, setAnhaenge] = useState<Attachment[] | null>(null);
  // Warum eine Liste leer ist: „nichts vorhanden" oder „Aufruf fehlgeschlagen"
  // sind zwei verschiedene Auskünfte, und die zweite darf nicht als die erste
  // erscheinen (Wurzel 5).
  const [ladefehler, setLadefehler] = useState<string | null>(null);
  const [kiLaeuft, setKiLaeuft] = useState(false);
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
    // Der Vorschlag landet im Feld, nicht beim Gast: abgeschickt wird von Hand.
    onEntwurf(res.data.reply);
    if (res.data.sources.length) {
      Alert.alert(
        "Vorschlag eingefügt",
        `Stützt sich auf: ${res.data.sources.join(", ")}`,
      );
    }
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
          <Col gap={6}>
            <Txt v="sm" soft>
              Keine Anhänge in dieser Konversation.
            </Txt>
            {/* Ehrlich benennen, statt einen Knopf zu zeigen, der nichts tut. */}
            <Txt v="xs" soft>
              Hochladen geht derzeit nur im Dashboard — der App fehlt die
              Dateiauswahl.
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
          </Col>
        )}
      </Sheet>
    </>
  );
}

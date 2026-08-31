// Posteingang verwalten (Etappe 4): Vorlagen und Wissensfakten pflegen,
// Automationen, KI-Einstellungen und Sprachen einsehen.
//
// DIE AUFTEILUNG IST ABSICHT, nicht Bequemlichkeit:
//   ÄNDERBAR sind Vorlagen und Wissensfakten — kurze Texte, die unterwegs
//   anfallen („der Türcode hat sich geändert", „ab jetzt kein Frühstück").
//   NUR LESEND sind Automationen, KI-Einstellungen und Sprachen. Eine
//   Automation hat Trigger, vorzeichenbehafteten Versatz, Sendezeit, Kanal- und
//   Objektfilter und mehrsprachige Texte; dieses Formular auf ein Telefon zu
//   pressen erzeugt Fehleingaben in einem Automatismus, der danach an echte
//   Gäste schreibt. Gezeigt werden sie trotzdem, weil die Frage unterwegs
//   „läuft dafür schon eine Automation?" lautet — nicht „ich baue sie um".
//
// Der ganze Bereich hängt an `canManageConfig` (`inbox_manage_config`), wie im
// Web. Wer das Recht nicht hat, sieht den Zugang gar nicht.
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, TextInput, View } from "react-native";

import { Icon } from "@/components/ui/Icon";
import { Btn, Chip, Col, Divider, Row, Txt } from "@/components/ui/kit";
import { Sheet } from "@/components/ui/patterns";
import {
  createKnowledge,
  createTemplate,
  deleteKnowledge,
  deleteTemplate,
  getAiSettings,
  listAutomations,
  listKnowledge,
  listMessageLanguages,
  listTemplates,
  updateKnowledge,
  updateTemplate,
  type AiSettings,
  type Automation,
  type KnowledgeFact,
  type MessageLanguage,
  type MessageTemplate,
} from "@/lib/inbox";
import { useTheme } from "@/theme/ThemeProvider";

type Bereich = "start" | "vorlagen" | "wissen" | "automationen" | "ki";

const TRIGGER_TEXT: Record<string, string> = {
  booking_new: "Neue Buchung",
  before_checkin: "Vor der Anreise",
  // Am Tag selbst, kein Abstand (0515). Ohne diese zwei Zeilen zeigte die App
  // den rohen Enum-Wert („on_checkin") — der Fallback in der Liste ist
  // `a.trigger`, also faellt es nicht als Fehler auf, sondern sieht nach
  // Technik aus.
  on_checkin: "Am Anreisetag",
  after_checkin: "Nach der Anreise",
  before_checkout: "Vor der Abreise",
  on_checkout: "Am Abreisetag",
  after_checkout: "Nach der Abreise",
  message_received: "Nachricht des Gastes",
};

/** Auslöser, die AM Ankertag feuern — sie tragen keinen Abstand (0515). */
const TAGES_TRIGGER = ["on_checkin", "on_checkout"];

/**
 * Versatz einer Automation in Worten. Der Wert ist VORZEICHENBEHAFTET — „vor
 * der Anreise" und „nach der Anreise" sind zwei verschiedene Nachrichten an
 * einen echten Gast. Exportiert, weil genau das geprüft wird.
 */
export function versatzText(a: Automation): string {
  const wert = a.offset_value ?? a.offset_days;
  const einheit =
    a.offset_unit === "minutes"
      ? "Min."
      : a.offset_unit === "hours"
        ? "Std."
        : "Tage";
  // Bei den Tages-Auslösern sagt der Auslöser den Zeitpunkt schon vollstaendig
  // („Am Anreisetag"). Ein zusaetzliches „am Stichtag" daneben waere dieselbe
  // Aussage zweimal — die Zeile lautete „Am Anreisetag · am Stichtag".
  if (TAGES_TRIGGER.includes(a.trigger)) return "";
  if (!wert) return "am Stichtag";
  return `${Math.abs(wert)} ${einheit} ${wert < 0 ? "davor" : "danach"}`;
}

export function VerwaltenSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const t = useTheme();
  const [bereich, setBereich] = useState<Bereich>("start");
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const [vorlagen, setVorlagen] = useState<MessageTemplate[] | null>(null);
  const [wissen, setWissen] = useState<KnowledgeFact[] | null>(null);
  const [automationen, setAutomationen] = useState<Automation[] | null>(null);
  const [ki, setKi] = useState<AiSettings | null>(null);
  const [sprachen, setSprachen] = useState<MessageLanguage[] | null>(null);

  // Bearbeitung: `null` = geschlossen, `""`-id = neu.
  const [vorlage, setVorlage] = useState<{ id: string; title: string; body: string } | null>(
    null,
  );
  const [fakt, setFakt] = useState<{ id: string; fact: string } | null>(null);

  useEffect(() => {
    if (!open) {
      setBereich("start");
      setVorlage(null);
      setFakt(null);
      setFehler(null);
    }
  }, [open]);

  const laden = useCallback(async () => {
    setFehler(null);
    if (bereich === "vorlagen") {
      const res = await listTemplates();
      if (!res.ok) return setFehler(res.error);
      setVorlagen(res.data.items);
    } else if (bereich === "wissen") {
      const res = await listKnowledge();
      if (!res.ok) return setFehler(res.error);
      setWissen(res.data.items);
    } else if (bereich === "automationen") {
      const res = await listAutomations();
      if (!res.ok) return setFehler(res.error);
      setAutomationen(res.data.items);
    } else if (bereich === "ki") {
      const [k, s] = await Promise.all([getAiSettings(), listMessageLanguages()]);
      if (!k.ok) return setFehler(k.error);
      setKi(k.data);
      setSprachen(s.ok ? s.data.items : []);
    }
  }, [bereich]);

  useEffect(() => {
    if (open && bereich !== "start") laden();
  }, [open, bereich, laden]);

  const melden = (res: { ok: boolean; error?: string }) => {
    setBusy(false);
    if (!res.ok) {
      Alert.alert("Nicht gespeichert", res.error ?? "Aktion fehlgeschlagen.");
      return false;
    }
    return true;
  };

  const vorlageSpeichern = async () => {
    if (!vorlage) return;
    const titel = vorlage.title.trim();
    const text = vorlage.body.trim();
    if (!titel || !text) {
      Alert.alert("Unvollständig", "Titel und Text sind nötig.");
      return;
    }
    setBusy(true);
    // Reiner Text ist gültiges Autorenformat; den Klartext leitet der Server
    // daraus ab (EINE Umwandlung, nicht zwei).
    const res = vorlage.id
      ? await updateTemplate(vorlage.id, { title: titel, body_html: text })
      : await createTemplate({ title: titel, body_html: text });
    if (!melden(res)) return;
    setVorlage(null);
    laden();
  };

  const vorlageLoeschen = (v: MessageTemplate) =>
    Alert.alert("Vorlage löschen?", v.title, [
      { text: "Abbrechen", style: "cancel" },
      {
        text: "Löschen",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          if (!melden(await deleteTemplate(v.id))) return;
          laden();
        },
      },
    ]);

  const faktSpeichern = async () => {
    if (!fakt) return;
    const text = fakt.fact.trim();
    if (!text) return;
    setBusy(true);
    // `property_id: null` = gilt betriebsweit. Die Zuordnung zu EINEM Objekt
    // braucht die Objektliste und bleibt dem Dashboard vorbehalten; hier wird
    // deshalb nichts geraten (Wurzel 4).
    const res = fakt.id
      ? await updateKnowledge(fakt.id, { property_id: null, fact: text })
      : await createKnowledge({ property_id: null, fact: text });
    if (!melden(res)) return;
    setFakt(null);
    laden();
  };

  const faktLoeschen = (f: KnowledgeFact) =>
    Alert.alert("Fakt löschen?", f.fact.slice(0, 80), [
      { text: "Abbrechen", style: "cancel" },
      {
        text: "Löschen",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          if (!melden(await deleteKnowledge(f.id))) return;
          laden();
        },
      },
    ]);

  const feld = {
    backgroundColor: t.palette.bg,
    borderWidth: 1,
    borderColor: t.palette.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: t.palette.ink,
  } as const;

  const zeile = (
    label: string,
    hinweis: string,
    onPress: () => void,
    nurLesen = false,
  ) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({ paddingVertical: 14, opacity: pressed ? 0.6 : 1 })}
    >
      <Row style={{ gap: 12 }}>
        <Col style={{ flex: 1 }}>
          <Txt v="body">{label}</Txt>
          <Txt v="xs" soft>
            {hinweis}
          </Txt>
        </Col>
        {/* „Nur ansehen" steht am Eintrag, nicht erst im Bereich — sonst tippt
            man sich hinein und sucht dort den Bearbeiten-Knopf. */}
        {nurLesen && <Chip variant="ghost">nur ansehen</Chip>}
        <Icon n="fwd" s={16} sw={2} c={t.palette.faint} />
      </Row>
      <Divider style={{ marginTop: 12 }} />
    </Pressable>
  );

  const kopf =
    bereich === "start"
      ? "Posteingang verwalten"
      : bereich === "vorlagen"
        ? vorlage
          ? vorlage.id
            ? "Vorlage ändern"
            : "Neue Vorlage"
          : "Vorlagen"
        : bereich === "wissen"
          ? fakt
            ? fakt.id
              ? "Fakt ändern"
              : "Neuer Fakt"
            : "Wissen"
          : bereich === "automationen"
            ? "Automationen"
            : "KI-Antworten";

  return (
    <Sheet
      open={open}
      onClose={onClose}
      full={bereich !== "start"}
      header={
        <Row style={{ gap: 10, alignItems: "center" }}>
          {bereich !== "start" && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Zurück"
              onPress={() => {
                if (vorlage) setVorlage(null);
                else if (fakt) setFakt(null);
                else setBereich("start");
              }}
              hitSlop={8}
            >
              <Icon n="back" s={20} sw={2} c={t.palette.ink} />
            </Pressable>
          )}
          <Txt v="title">{kopf}</Txt>
        </Row>
      }
    >
      {fehler && (
        <Txt v="sm" color={t.palette.accent} style={{ marginBottom: 8 }}>
          {fehler}
        </Txt>
      )}

      {bereich === "start" && (
        <Col>
          {zeile("Vorlagen", "Textbausteine für Antworten", () =>
            setBereich("vorlagen"),
          )}
          {zeile("Wissen", "Fakten, auf die sich die KI stützt", () =>
            setBereich("wissen"),
          )}
          {zeile(
            "Automationen",
            "Automatische Nachrichten an Gäste",
            () => setBereich("automationen"),
            true,
          )}
          {zeile(
            "KI-Antworten",
            "Tonfall, Sprache, Unterschrift",
            () => setBereich("ki"),
            true,
          )}
        </Col>
      )}

      {/* --- Vorlagen ----------------------------------------------------- */}
      {bereich === "vorlagen" &&
        (vorlage ? (
          <Col gap={10}>
            <TextInput
              value={vorlage.title}
              onChangeText={(v) => setVorlage({ ...vorlage, title: v })}
              placeholder="Titel"
              placeholderTextColor={t.palette.faint}
              style={feld}
            />
            <TextInput
              value={vorlage.body}
              onChangeText={(v) => setVorlage({ ...vorlage, body: v })}
              placeholder="Text — Platzhalter wie {{guest_first_name}} sind erlaubt"
              placeholderTextColor={t.palette.faint}
              multiline
              style={{ ...feld, minHeight: 180, textAlignVertical: "top" }}
            />
            {/* Was hier NICHT geht, und warum — statt es zu verschweigen. */}
            <Txt v="xs" soft>
              Sprachfassungen und Betreff bleiben unverändert; sie werden im
              Dashboard gepflegt.
            </Txt>
            <Btn variant="dark" block onPress={busy ? undefined : vorlageSpeichern}>
              {busy ? "Speichert …" : "Speichern"}
            </Btn>
          </Col>
        ) : !vorlagen ? (
          <ActivityIndicator color={t.palette.accent} />
        ) : (
          <Col>
            <Btn
              variant="outline"
              block
              onPress={() => setVorlage({ id: "", title: "", body: "" })}
            >
              Neue Vorlage
            </Btn>
            <View style={{ height: 8 }} />
            {vorlagen.map((v) => (
              <View key={v.id} style={{ paddingVertical: 12 }}>
                <Row style={{ gap: 12 }}>
                  <Pressable
                    style={{ flex: 1 }}
                    onPress={() =>
                      setVorlage({ id: v.id, title: v.title, body: v.body })
                    }
                  >
                    <Txt v="body" numberOfLines={1}>
                      {v.title}
                    </Txt>
                    {/* Kein Hinweis auf Sprachfassungen: der Mobile-Typ führt
                        sie nicht (sie werden im Dashboard gepflegt), und eine
                        Zahl zu behaupten, die hier nicht vorliegt, wäre eine
                        Erfindung (Wurzel 4). */}
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Vorlage löschen"
                    onPress={() => vorlageLoeschen(v)}
                    hitSlop={8}
                  >
                    <Icon n="x" s={18} sw={2} c={t.palette.soft} />
                  </Pressable>
                </Row>
                <Divider style={{ marginTop: 12 }} />
              </View>
            ))}
            {vorlagen.length === 0 && (
              <Txt v="sm" soft>
                Noch keine Vorlage angelegt.
              </Txt>
            )}
          </Col>
        ))}

      {/* --- Wissen ------------------------------------------------------- */}
      {bereich === "wissen" &&
        (fakt ? (
          <Col gap={10}>
            <TextInput
              value={fakt.fact}
              onChangeText={(v) => setFakt({ ...fakt, fact: v })}
              placeholder="Ein Fakt, ein Satz — etwa: Check-in ab 16:00"
              placeholderTextColor={t.palette.faint}
              multiline
              autoFocus
              style={{ ...feld, minHeight: 120, textAlignVertical: "top" }}
            />
            <Txt v="xs" soft>
              Gilt für den ganzen Betrieb. Ein Fakt für ein einzelnes Objekt wird
              im Dashboard zugeordnet.
            </Txt>
            <Btn variant="dark" block onPress={busy ? undefined : faktSpeichern}>
              {busy ? "Speichert …" : "Speichern"}
            </Btn>
          </Col>
        ) : !wissen ? (
          <ActivityIndicator color={t.palette.accent} />
        ) : (
          <Col>
            <Btn
              variant="outline"
              block
              onPress={() => setFakt({ id: "", fact: "" })}
            >
              Neuer Fakt
            </Btn>
            <View style={{ height: 8 }} />
            {wissen.map((f) => (
              <View key={f.id} style={{ paddingVertical: 12 }}>
                <Row style={{ gap: 12 }}>
                  <Pressable
                    style={{ flex: 1 }}
                    onPress={() => setFakt({ id: f.id, fact: f.fact })}
                  >
                    <Txt v="sm">{f.fact}</Txt>
                    <Txt v="xs" soft>
                      {f.property_title ?? "gilt betriebsweit"}
                      {f.source !== "manual" ? ` · aus ${f.source}` : ""}
                    </Txt>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Fakt löschen"
                    onPress={() => faktLoeschen(f)}
                    hitSlop={8}
                  >
                    <Icon n="x" s={18} sw={2} c={t.palette.soft} />
                  </Pressable>
                </Row>
                <Divider style={{ marginTop: 12 }} />
              </View>
            ))}
            {wissen.length === 0 && (
              <Txt v="sm" soft>
                Noch kein Fakt hinterlegt.
              </Txt>
            )}
          </Col>
        ))}

      {/* --- Automationen (lesend) ---------------------------------------- */}
      {bereich === "automationen" &&
        (!automationen ? (
          <ActivityIndicator color={t.palette.accent} />
        ) : (
          <Col>
            {automationen.map((a) => (
              <View key={a.id} style={{ paddingVertical: 12 }}>
                <Row style={{ justifyContent: "space-between", gap: 12 }}>
                  <Col style={{ flex: 1 }}>
                    <Txt v="body" numberOfLines={1}>
                      {a.name}
                    </Txt>
                    <Txt v="xs" soft>
                      {/* Aus Teilen zusammensetzen statt fest mit „·": bei
                          den Tages-Auslösern ist `versatzText` leer, und ein
                          fester Trenner hinterliesse „Am Anreisetag · ". */}
                      {[
                        TRIGGER_TEXT[a.trigger] ?? a.trigger,
                        versatzText(a),
                        a.send_time ?? "",
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </Txt>
                  </Col>
                  {/* Der Zustand ist die Angabe, die unterwegs zählt. */}
                  <Chip variant={a.is_active ? "on" : ""}>
                    {a.is_active ? "aktiv" : "aus"}
                  </Chip>
                </Row>
                <Divider style={{ marginTop: 12 }} />
              </View>
            ))}
            {automationen.length === 0 && (
              <Txt v="sm" soft>
                Keine Automation eingerichtet.
              </Txt>
            )}
            <Txt v="xs" soft style={{ marginTop: 12 }}>
              Einrichten und ändern im Dashboard — eine Automation schreibt
              selbstständig an Gäste, das gehört an den Schreibtisch.
            </Txt>
          </Col>
        ))}

      {/* --- KI-Einstellungen (lesend) ------------------------------------ */}
      {bereich === "ki" &&
        (!ki ? (
          <ActivityIndicator color={t.palette.accent} />
        ) : (
          <Col gap={2}>
            {[
              ["Tonfall", ki.tone],
              ["Sprache", ki.language],
              ["Unterschrift", ki.signature ?? "—"],
              ["Vorschlag automatisch", ki.auto_suggest ? "ja" : "nein"],
              [
                "Nachrichten-Sprachen",
                sprachen?.length
                  ? sprachen
                      .map((s) => (s.is_default ? `${s.code} (Standard)` : s.code))
                      .join(", ")
                  : "nur Grundfassung",
              ],
            ].map(([label, wert]) => (
              <View key={label} style={{ paddingVertical: 11 }}>
                <Row style={{ justifyContent: "space-between", gap: 12 }}>
                  <Txt v="sm" soft>
                    {label}
                  </Txt>
                  <Txt v="sm" style={{ flexShrink: 1, textAlign: "right" }}>
                    {wert}
                  </Txt>
                </Row>
                <Divider style={{ marginTop: 11 }} />
              </View>
            ))}
            {ki.extra_prompt ? (
              <Col gap={4} style={{ marginTop: 8 }}>
                <Txt v="xs" soft>
                  Zusätzliche Anweisung
                </Txt>
                <Txt v="sm">{ki.extra_prompt}</Txt>
              </Col>
            ) : null}
          </Col>
        ))}
    </Sheet>
  );
}

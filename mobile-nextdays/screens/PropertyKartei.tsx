// Objektkartei in der App — die Angaben, die beim Kunden VOR ORT fallen.
//
// Der Web-Stepper (web/components/objekte/kartei/dossier-stepper.tsx) hat neun
// Stufen. Hier stehen fünf davon: Prozess, Zugang, Handwerker, Marketing,
// Hausmappe. Nicht gebaut sind bewusst
//   · Objektinformation (Stufe 1): zeigt die Bankverbindung des Eigentümers
//     (IBAN, CPR, Steuernummer). Auf einem Gerät, das beim Kunden auf dem
//     Tisch liegt, hat sie nichts zu suchen.
//   · Inventar (Stufe 8): gezählt wird im Reinigungsdurchgang über die
//     Checkliste der Aufgabe, nicht in der Kartei — das ist die Entscheidung
//     aus Migration 0623 und gilt in der App genauso.
//   · Vermarktung (Stufe 9): Grundpreis, Sperrungen und Portal-Anbindung
//     liegen in Preise/Kalender/Kanäle. Hier wäre nur eine zweite Wahrheit.
//
// Speichern läuft je Stufe direkt gegen den Server (PUT), nicht gesammelt am
// Ende: wer vor Ort steht, wird unterbrochen, und ein Bogen, der alles erst
// beim Abschicken sichert, verliert dann alles.
import { useCallback, useEffect, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  Switch,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/Icon";
import { Btn, Card, Col, Divider, Row, Spinner, Txt } from "@/components/ui/kit";
import { EmptyState } from "@/components/ui/patterns";
import { useAuth } from "@/contexts/AuthContext";
import {
  addHandwerker,
  deleteHandwerker,
  getKartei,
  putHausmappe,
  putMarketing,
  putProzess,
  putZugang,
  type Handwerker,
  type KarteiGesamt,
} from "@/lib/kartei";
import { can } from "@/lib/permissions";
import { useTheme } from "@/theme/ThemeProvider";

// Enum-Werte und Beschriftungen — Zwilling zu web/messages/de.json
// (`dossier.*`). Nur echte Katalogwerte: ein erfundener Schlüssel würde vom
// Server mit 422 abgewiesen bzw. im Web als roher Slug erscheinen.
const KEY_STATUS: { wert: string; label: string }[] = [
  { wert: "agency_extra", label: "Extra-Schlüssel bei Agentur" },
  { wert: "owner_only", label: "Nur beim Eigentümer" },
];

const GEWERKE: { wert: string; label: string }[] = [
  { wert: "electrician", label: "Elektriker" },
  { wert: "plumbing", label: "Sanitär & Heizung" },
  { wert: "carpenter", label: "Zimmermann" },
  { wert: "locksmith", label: "Schlüsseldienst" },
];

const WELCOME_STATUS: { wert: string; label: string }[] = [
  { wert: "received", label: "Erhalten" },
  { wert: "open", label: "Offen" },
];

const PROZESS_FELDER = [
  { key: "first_meeting_at", label: "Erstgespräch" },
  { key: "contract_sent_at", label: "Vertrag versendet" },
  { key: "contract_signed_at", label: "Unterzeichnet retour" },
  { key: "onboarding_invoice_sent_at", label: "Onboarding-Rechnung versendet" },
  { key: "onboarding_invoice_paid_at", label: "Rechnung bezahlt" },
] as const;

const MARKETING_FELDER = [
  { key: "photographer_booked_at", label: "Fotograf beauftragt" },
  { key: "media_received_at", label: "Medien erhalten" },
  { key: "site_walkthrough_at", label: "Hausbegehung" },
  { key: "defects_list_sent_at", label: "Mängelliste übermittelt" },
] as const;

export default function PropertyKartei({
  route,
  navigation,
}: {
  route: any;
  navigation: any;
}) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { me } = useAuth();
  const propertyId: string = route.params.id;
  // Lesen UND Schreiben verlangen serverseitig manage_properties — dieselbe
  // Fähigkeit. Fehlt sie, erscheint gar kein Formular statt eines 403 nach
  // dem Tippen. Die echte Kontrolle bleibt der Server (Wurzel 6).
  const darfBearbeiten = can(me, "manage_properties");

  const [daten, setDaten] = useState<KarteiGesamt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await getKartei(propertyId);
    if (res.ok) {
      setDaten(res.data);
      setError(null);
    } else {
      setDaten(null);
      setError(res.error);
    }
  }, [propertyId]);

  useEffect(() => {
    load();
  }, [load]);

  // Ein Stufen-PUT ersetzt den Datensatz vollständig — deshalb geht IMMER der
  // komplette Bestand mit, nicht nur das geänderte Feld. Der lokale Stand
  // wird erst nach der Server-Antwort übernommen: was der Server nicht
  // bestätigt hat, wird hier nicht als gespeichert angezeigt.
  const speichern = async <K extends keyof KarteiGesamt>(
    bereich: K,
    neu: KarteiGesamt[K],
    put: () => Promise<{ ok: true; data: unknown } | { ok: false; error: string }>,
  ) => {
    if (busy || !darfBearbeiten) return;
    setBusy(true);
    setHinweis(null);
    const res = await put();
    setBusy(false);
    if (!res.ok) {
      setHinweis(res.error);
      return;
    }
    setDaten((alt) => (alt ? { ...alt, [bereich]: neu } : alt));
  };

  if (error) {
    return (
      <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top + 12 }}>
        <Kopf onBack={() => navigation.goBack()} />
        <EmptyState icon="info" titel="Kartei nicht geladen" text={error}>
          <Btn variant="outline" onPress={load} style={{ marginTop: 6 }}>
            Erneut versuchen
          </Btn>
        </EmptyState>
      </View>
    );
  }

  if (!daten) {
    return (
      <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top + 40 }}>
        <Spinner />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <Kopf onBack={() => navigation.goBack()} />

      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingBottom: insets.bottom + 40,
          gap: 24,
        }}
        refreshControl={<RefreshControl refreshing={false} onRefresh={load} />}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* --- Zugang & Technik: die Frage, die vor Ort wirklich gestellt wird --- */}
        <Abschnitt titel="Zugang & Technik" icon="key">
          <Auswahl
            label="Schlüssel-Status"
            werte={KEY_STATUS}
            aktuell={daten.access.key_status}
            gesperrt={!darfBearbeiten || busy}
            onWahl={(w) =>
              speichern("access", { ...daten.access, key_status: w }, () =>
                putZugang(propertyId, { ...daten.access, key_status: w }),
              )
            }
          />
          <TextZeile
            label="Wo liegt der Schlüssel?"
            wert={daten.access.key_placement}
            platzhalter="z. B. Schlüsselbox rechts neben der Haustür"
            gesperrt={!darfBearbeiten || busy}
            onSichern={(v) =>
              speichern("access", { ...daten.access, key_placement: v }, () =>
                putZugang(propertyId, { ...daten.access, key_placement: v }),
              )
            }
          />
        </Abschnitt>

        {/* --- Handwerker: die Liste, die vor Ort entsteht --- */}
        <HandwerkerBlock
          liste={daten.tradespeople}
          gesperrt={!darfBearbeiten || busy}
          onAnlegen={async (eintrag) => {
            setBusy(true);
            setHinweis(null);
            const res = await addHandwerker(propertyId, eintrag);
            setBusy(false);
            if (!res.ok) {
              setHinweis(res.error);
              return false;
            }
            setDaten((alt) =>
              alt ? { ...alt, tradespeople: [...alt.tradespeople, res.data] } : alt,
            );
            return true;
          }}
          onLoeschen={async (id) => {
            setBusy(true);
            setHinweis(null);
            const res = await deleteHandwerker(propertyId, id);
            setBusy(false);
            if (!res.ok) {
              setHinweis(res.error);
              return;
            }
            setDaten((alt) =>
              alt
                ? { ...alt, tradespeople: alt.tradespeople.filter((h) => h.id !== id) }
                : alt,
            );
          }}
        />

        {/* --- Prozess & Vertrag: Datumsangaben als Ja/Nein-Marke --- */}
        <Abschnitt titel="Prozess & Vertrag" icon="doc">
          <Txt v="xs" soft>
            Abhaken setzt das heutige Datum. Was noch nicht passiert ist, bleibt leer.
          </Txt>
          {PROZESS_FELDER.map((f) => (
            <DatumSchalter
              key={f.key}
              label={f.label}
              wert={daten.process[f.key]}
              gesperrt={!darfBearbeiten || busy}
              onUmschalten={(neuerWert) => {
                const neu = { ...daten.process, [f.key]: neuerWert };
                void speichern("process", neu, () => putProzess(propertyId, neu));
              }}
            />
          ))}
        </Abschnitt>

        {/* --- Marketing --- */}
        <Abschnitt titel="Marketing" icon="cam">
          {MARKETING_FELDER.map((f) => (
            <DatumSchalter
              key={f.key}
              label={f.label}
              wert={daten.marketing[f.key]}
              gesperrt={!darfBearbeiten || busy}
              onUmschalten={(neuerWert) => {
                const neu = { ...daten.marketing, [f.key]: neuerWert };
                void speichern("marketing", neu, () => putMarketing(propertyId, neu));
              }}
            />
          ))}
        </Abschnitt>

        {/* --- Hausmappe: die Geheimtipps sind der Grund, hier zu sein --- */}
        <Abschnitt titel="Hausmappe" icon="home">
          <Auswahl
            label="Begrüßungstext"
            werte={WELCOME_STATUS}
            aktuell={daten.housebook.welcome_text_status}
            gesperrt={!darfBearbeiten || busy}
            onWahl={(w) => {
              const neu = { ...daten.housebook, welcome_text_status: w };
              void speichern("housebook", neu, () => putHausmappe(propertyId, neu));
            }}
          />
          <Row style={{ justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <Txt v="sm" style={{ flex: 1 }}>
              Physische Hausmappe platziert
            </Txt>
            <Switch
              value={daten.housebook.physical_folder_placed}
              disabled={!darfBearbeiten || busy}
              onValueChange={(v) => {
                const neu = { ...daten.housebook, physical_folder_placed: v };
                void speichern("housebook", neu, () => putHausmappe(propertyId, neu));
              }}
            />
          </Row>
          <TextZeile
            label="Geheimtipps"
            wert={daten.housebook.secret_tips}
            platzhalter="Restaurants, Strände, Ausflüge — was der Eigentümer empfiehlt."
            mehrzeilig
            gesperrt={!darfBearbeiten || busy}
            onSichern={(v) => {
              const neu = { ...daten.housebook, secret_tips: v };
              void speichern("housebook", neu, () => putHausmappe(propertyId, neu));
            }}
          />
        </Abschnitt>

        {hinweis && (
          <Txt v="sm" soft>
            {hinweis}
          </Txt>
        )}

        {!darfBearbeiten && (
          <Txt v="xs" soft>
            Zum Ändern fehlt deiner Rolle die Berechtigung für Objekte.
          </Txt>
        )}

        <Txt v="xs" soft>
          Eigentümer-Bankdaten, Inventar und Vermarktung stehen bewusst nicht in der App.
          Inventar wird beim Reinigungsdurchgang gezählt, nicht hier.
        </Txt>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Kopf({ onBack }: { onBack: () => void }) {
  const t = useTheme();
  return (
    <Row style={{ paddingHorizontal: 16, paddingVertical: 10, gap: 8 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Zurück"
        onPress={onBack}
        hitSlop={10}
        style={({ pressed }) => ({ padding: 6, opacity: pressed ? 0.6 : 1 })}
      >
        <Icon n="back" s={20} sw={2} c={t.palette.ink} />
      </Pressable>
      <Txt v="h2" style={{ flex: 1 }}>
        Kartei
      </Txt>
    </Row>
  );
}

function Abschnitt({
  titel,
  icon,
  children,
}: {
  titel: string;
  icon: "key" | "doc" | "cam" | "home";
  children: React.ReactNode;
}) {
  const t = useTheme();
  return (
    <Col gap={12}>
      <Row gap={8} style={{ alignItems: "center" }}>
        <Icon n={icon} s={18} sw={2} c={t.palette.soft} />
        <Txt v="h2">{titel}</Txt>
      </Row>
      <Card>
        <Col gap={14} style={{ padding: 16 }}>
          {children}
        </Col>
      </Card>
    </Col>
  );
}

// Auswahl aus festen Katalogwerten. Erneutes Tippen auf die aktive Wahl setzt
// sie zurück auf „nicht erfasst" — ohne das käme man aus einem versehentlich
// gesetzten Wert nicht mehr heraus.
function Auswahl({
  label,
  werte,
  aktuell,
  gesperrt,
  onWahl,
}: {
  label: string;
  werte: { wert: string; label: string }[];
  aktuell: string | null;
  gesperrt: boolean;
  onWahl: (w: string | null) => void;
}) {
  return (
    <Col gap={8}>
      <Txt v="sm" style={{ fontWeight: "600" }}>
        {label}
      </Txt>
      <Row gap={8} style={{ flexWrap: "wrap" }}>
        {werte.map((w) => (
          <Btn
            key={w.wert}
            variant={aktuell === w.wert ? "primary" : "outline"}
            disabled={gesperrt}
            onPress={() => onWahl(aktuell === w.wert ? null : w.wert)}
          >
            {w.label}
          </Btn>
        ))}
      </Row>
    </Col>
  );
}

// Freitext mit eigenem Entwurf: gespeichert wird beim Verlassen des Feldes,
// nicht bei jedem Tastendruck (sonst ein PUT je Buchstabe).
function TextZeile({
  label,
  wert,
  platzhalter,
  mehrzeilig,
  gesperrt,
  onSichern,
}: {
  label: string;
  wert: string | null;
  platzhalter?: string;
  mehrzeilig?: boolean;
  gesperrt: boolean;
  onSichern: (v: string | null) => void;
}) {
  const t = useTheme();
  const [entwurf, setEntwurf] = useState(wert ?? "");

  // Ein fremder Stand (Neuladen, anderer Speichervorgang) gewinnt nur, solange
  // hier nichts Abweichendes getippt steht.
  useEffect(() => {
    setEntwurf(wert ?? "");
  }, [wert]);

  return (
    <Col gap={6}>
      <Txt v="sm" style={{ fontWeight: "600" }}>
        {label}
      </Txt>
      <TextInput
        value={entwurf}
        onChangeText={setEntwurf}
        editable={!gesperrt}
        placeholder={platzhalter}
        placeholderTextColor={t.palette.soft}
        multiline={mehrzeilig}
        onBlur={() => {
          const v = entwurf.trim();
          // Unverändert → kein PUT. Leer → null, nicht "" (Wurzel 4: eine
          // leere Zeichenkette wäre von „nicht erfasst" nicht zu trennen).
          if ((wert ?? "") === v) return;
          onSichern(v || null);
        }}
        style={{
          borderWidth: 1,
          borderColor: t.palette.line,
          borderRadius: mehrzeilig ? t.radius.card : t.radius.pill,
          paddingHorizontal: 16,
          paddingVertical: 12,
          minHeight: mehrzeilig ? 96 : undefined,
          textAlignVertical: mehrzeilig ? "top" : "center",
          color: t.palette.ink,
          fontSize: 15,
          opacity: gesperrt ? 0.6 : 1,
        }}
      />
    </Col>
  );
}

// Ein Vorgang, der passiert ist oder nicht. Angehakt = heute; abgehakt = leer.
// Bewusst KEIN Datumswähler: vor Ort hakt man ab, was gerade geschieht, und
// ein Datum, das niemand gesetzt hat, wäre eine Behauptung über einen Vorgang
// (Wurzel 5b).
function DatumSchalter({
  label,
  wert,
  gesperrt,
  onUmschalten,
}: {
  label: string;
  wert: string | null;
  gesperrt: boolean;
  onUmschalten: (v: string | null) => void;
}) {
  const heute = () => new Date().toISOString().slice(0, 10);
  return (
    <Row style={{ justifyContent: "space-between", alignItems: "center", gap: 12 }}>
      <Col gap={2} style={{ flex: 1 }}>
        <Txt v="sm">{label}</Txt>
        {wert ? (
          <Txt v="xs" soft>
            {wert}
          </Txt>
        ) : null}
      </Col>
      <Switch
        value={Boolean(wert)}
        disabled={gesperrt}
        onValueChange={(v) => onUmschalten(v ? heute() : null)}
      />
    </Row>
  );
}

function HandwerkerBlock({
  liste,
  gesperrt,
  onAnlegen,
  onLoeschen,
}: {
  liste: Handwerker[];
  gesperrt: boolean;
  onAnlegen: (e: Omit<Handwerker, "id">) => Promise<boolean>;
  onLoeschen: (id: string) => void;
}) {
  const t = useTheme();
  const [offen, setOffen] = useState(false);
  const [gewerk, setGewerk] = useState("electrician");
  const [name, setName] = useState("");
  const [telefon, setTelefon] = useState("");

  const label = (k: string) => GEWERKE.find((g) => g.wert === k)?.label ?? k;

  return (
    <Abschnitt titel="Handwerker" icon="doc">
      {liste.length === 0 && !offen ? (
        <Txt v="sm" soft>
          Noch kein Handwerker hinterlegt.
        </Txt>
      ) : null}

      {liste.map((h, i) => (
        <View key={h.id}>
          {i > 0 && <Divider />}
          <Row style={{ alignItems: "center", gap: 12, paddingVertical: 6 }}>
            <Col gap={2} style={{ flex: 1 }}>
              <Txt v="sm" style={{ fontWeight: "600" }}>
                {label(h.trade)}
              </Txt>
              <Txt v="xs" soft>
                {[h.name, h.phone].filter(Boolean).join(" · ") || "—"}
              </Txt>
            </Col>
            {!gesperrt && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${label(h.trade)} entfernen`}
                onPress={() => onLoeschen(h.id)}
                hitSlop={10}
                style={({ pressed }) => ({ padding: 6, opacity: pressed ? 0.6 : 1 })}
              >
                <Icon n="x" s={16} sw={2} c={t.palette.soft} />
              </Pressable>
            )}
          </Row>
        </View>
      ))}

      {offen ? (
        <Col gap={10}>
          <Divider />
          <Row gap={8} style={{ flexWrap: "wrap" }}>
            {GEWERKE.map((g) => (
              <Btn
                key={g.wert}
                variant={gewerk === g.wert ? "primary" : "outline"}
                onPress={() => setGewerk(g.wert)}
              >
                {g.label}
              </Btn>
            ))}
          </Row>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Name oder Firma"
            placeholderTextColor={t.palette.soft}
            style={eingabeStil(t)}
          />
          <TextInput
            value={telefon}
            onChangeText={setTelefon}
            placeholder="Telefon"
            placeholderTextColor={t.palette.soft}
            keyboardType="phone-pad"
            style={eingabeStil(t)}
          />
          <Row gap={8}>
            <Btn
              variant="outline"
              onPress={() => {
                setOffen(false);
                setName("");
                setTelefon("");
              }}
            >
              Abbrechen
            </Btn>
            <Btn
              variant="primary"
              disabled={gesperrt}
              onPress={async () => {
                const ok = await onAnlegen({
                  trade: gewerk,
                  name: name.trim() || null,
                  phone: telefon.trim() || null,
                  notes: null,
                });
                if (ok) {
                  setOffen(false);
                  setName("");
                  setTelefon("");
                }
              }}
            >
              Hinzufügen
            </Btn>
          </Row>
        </Col>
      ) : (
        !gesperrt && (
          <Btn variant="outline" icon="plus" onPress={() => setOffen(true)}>
            Handwerker hinzufügen
          </Btn>
        )
      )}
    </Abschnitt>
  );
}

function eingabeStil(t: ReturnType<typeof useTheme>) {
  return {
    borderWidth: 1,
    borderColor: t.palette.line,
    borderRadius: t.radius.pill,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: t.palette.ink,
    fontSize: 15,
  } as const;
}

// Chat mit der Verwaltung (0611, ADR-0029) — je Objekt ein Gespräch.
//
// VIER ZUSTÄNDE, die es ohne Ende-zu-Ende-Verschlüsselung nicht gäbe und die
// deshalb sichtbar behandelt werden — jeder von ihnen sähe sonst wie ein
// kaputter Chat aus:
//
//   1. Dieses Gerät hat noch keinen Schlüssel → Einrichtung anbieten.
//   2. Eine Nachricht ist ÄLTER als das Gerät → sie bleibt unlesbar. Angezeigt
//      wird das als Tatsache mit Weg (Freigabe erbitten), nicht als leere
//      Blase (Wurzel 5: keine stille Lücke).
//   3. Der Empfängerkreis hat sich zwischen Abholen und Senden geändert →
//      Server antwortet 409, die Nachricht bleibt im Feld stehen.
//   4. Der Sicherungscode wurde nie notiert → nach Gerätewechsel ist der
//      Verlauf verloren. Deshalb wird er beim Einrichten EINMAL gezeigt.
//
// IDEMPOTENZ (Wurzel 2): der Senden-Knopf sperrt, solange die Anfrage läuft —
// ohne das legt ein Doppeldruck zwei gleiche Nachrichten an.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { Icon } from "@/components/ui/Icon";
import { Btn, Kachel, Txt } from "@/components/ui/kit";
import { Blatt, BlattOption } from "@/components/ui/Blatt";
import { useT } from "@/contexts/SprachContext";
import {
  bilderOeffnen,
  chatBeenden,
  chatSenden,
  chatWiederAufnehmen,
  getChatVerlauf,
  nachrichtMelden,
  nachrichtOeffnen,
  type ChatNachricht,
  type Meldegrund,
} from "@/lib/chat";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { istLesbar, seiteIstEigene } from "@/lib/chat-anzeige";
import { bildWaehlen, fotoAufnehmen } from "@/lib/chat-bild";
import { geraeteIdLesen } from "@/lib/chat-krypto";
import { KARTE_ABSTAND } from "@/theme/flaechen";
import { useTheme } from "@/theme/ThemeProvider";


type Props = {
  route: { params: { propertyId: string; threadId: string } };
};

/** Eine Nachricht samt bereits entschlüsseltem Text UND Bildern. */
type Blase = ChatNachricht & {
  klartext: string | null;
  /** data:-URIs der entschlüsselten Bilder, bereit für `<Image>`. */
  bildDaten: string[];
  /** Entschlüsselung schlug TROTZ Schlüssel fehl — der Inhalt wurde verändert. */
  manipuliert: boolean;
};

export function Chat({ route }: Props) {
  const { propertyId } = route.params;
  // VERAENDERLICH, nicht nur Navigationsparameter: Zu einem Objekt ohne
  // bisheriges Gespraech liefert die Fadenliste `thread_id: ""`. Der Faden
  // entsteht erst serverseitig beim ersten Senden — seine ID kommt mit der
  // Antwort zurueck und muss hier ankommen, sonst laedt der Verlauf weiter
  // gegen den leeren String und bleibt leer (Wurzel 1: der Gegenzustand zum
  // Senden ist der nun existierende Faden).
  const [threadId, setThreadId] = useState(route.params.threadId);
  const t = useT();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [blasen, setBlasen] = useState<Blase[]>([]);
  const [nichtLesbar, setNichtLesbar] = useState(0);
  const [laedt, setLaedt] = useState(true);
  const [sendet, setSendet] = useState(false);
  const [text, setText] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [bildLaeuft, setBildLaeuft] = useState(false);
  // Habe ICH dieses Gespräch beendet (0615)? Der Server führt den Zustand;
  // die Oberfläche zeigt ihn nur an und tauscht das Eingabefeld gegen den
  // Weg zurück. Ein lokales Merken wäre eine zweite Wahrheit (Wurzel 4).
  const [gestoppt, setGestoppt] = useState(false);
  const rollen = useRef<ScrollView>(null);

  // Die Geräte-ID, falls dieses Gerät je eingerichtet wurde. Sie sperrt den
  // Chat NICHT mehr (09.09.2026): der Server entschlüsselt selbst, und wer
  // kein Gerät hat, liest trotzdem mit. Gebraucht wird sie allein, um den
  // E2E-Bestand aus der Zeit davor zu öffnen — deshalb `null` statt eines
  // Fehlers, wenn es keine gibt.
  const geraetPruefen = useCallback(async () => {
    setDeviceId(await geraeteIdLesen());
  }, []);

  useEffect(() => {
    void geraetPruefen();
  }, [geraetPruefen]);

  // Die Faden-ID als ARGUMENT, nicht nur aus dem Zustand: Direkt nach dem
  // ersten Senden hat React `setThreadId` noch nicht angewandt, und ein
  // `laden()` ohne Argument liefe gegen den alten, leeren Wert — genau der
  // Grund, aus dem der Verlauf nach der ersten Nachricht leer blieb.
  const laden = useCallback(
    async (faden?: string) => {
    const id = faden ?? threadId;
    if (!id) {
      setLaedt(false);
      return;
    }
    setLaedt(true);
    // Die Geräte-ID geht nur noch MIT, wenn es eine gibt: Der Server
    // entschlüsselt selbst (09.09.2026), und ohne Gerät blieb der Verlauf
    // bisher komplett leer. Gebraucht wird sie allein für den E2E-Bestand.
    const res = await getChatVerlauf(id, deviceId ?? "");
    if (!res.ok) {
      setFehler(t("chat.fehlerLaden"));
      setLaedt(false);
      return;
    }
    // Entschlüsseln passiert HIER, nicht beim Rendern: eine Blase, die sich
    // beim Zeichnen selbst entschlüsselt, tut das bei jedem Rerender erneut.
    const offen: Blase[] = [];
    for (const n of res.data.items) {
      // ZWEI Gründe, die NICHT zusammenfallen dürfen (Wurzel 5): fehlender
      // Schlüssel heißt „älter als dieses Gerät", ein Fehler TROTZ Schlüssel
      // heißt, am Chiffretext wurde manipuliert. Das Zweite als Alterszustand
      // auszugeben wäre eine beruhigende Falschaussage.
      let klartext: string | null = null;
      let bildDaten: string[] = [];
      let manipuliert = false;
      if (istLesbar(n)) {
        try {
          klartext = await nachrichtOeffnen(n);
          bildDaten = await bilderOeffnen(n);
        } catch {
          manipuliert = true;
        }
      }
      offen.push({ ...n, klartext, bildDaten, manipuliert });
    }
    setBlasen(offen);
    setNichtLesbar(res.data.nicht_lesbar);
    setGestoppt(res.data.gestoppt);
    setFehler(null);
    setLaedt(false);
    },
    [threadId, deviceId, t],
  );

  useEffect(() => {
    void laden();
  }, [laden]);

  const senden = useCallback(async () => {
    const inhalt = text.trim();
    if (!inhalt || sendet) return;
    setSendet(true);
    const res = await chatSenden(propertyId, inhalt);
    setSendet(false);
    if (!res.ok) {
      // Der Text BLEIBT im Feld: ihn zu verwerfen, während die Nachricht nicht
      // ankam, wäre Datenverlust im Kleinen.
      setFehler(res.error || t("chat.fehlerSenden"));
      return;
    }
    const faden = res.data.thread_id || threadId;
    if (res.data.thread_id) setThreadId(res.data.thread_id);
    setText("");
    setFehler(null);
    await laden(faden);
    rollen.current?.scrollToEnd({ animated: true });
  }, [text, sendet, propertyId, threadId, laden, t]);

  const bildSenden = useCallback(
    async (quelle: "kamera" | "galerie") => {
      if (bildLaeuft) return;
      const gewaehlt =
        quelle === "kamera" ? await fotoAufnehmen() : await bildWaehlen();
      // Abbrechen ist kein Fehler — kein Hinweis, kein Zustand.
      if (gewaehlt.art === "abgebrochen") return;
      if (gewaehlt.art === "fehler") {
        setFehler(t("chat.fehlerSenden"));
        return;
      }
      setBildLaeuft(true);
      // Bild und Text reisen als EINE Nachricht unter EINEM Schlüssel — sonst
      // wäre das Bild dauerhaft unlesbar (siehe `nachrichtVerschluesseln`).
      // Leerer Text ist zulässig: der CHECK in der DB verlangt Text ODER
      // Anhang.
      const res = await chatSenden(propertyId, text.trim(), [gewaehlt.daten]);
      setBildLaeuft(false);
      if (!res.ok) {
        setFehler(res.error || t("chat.fehlerSenden"));
        return;
      }
      const faden = res.data.thread_id || threadId;
      if (res.data.thread_id) setThreadId(res.data.thread_id);
      setText("");
      setFehler(null);
      await laden(faden);
    },
    [bildLaeuft, propertyId, text, threadId, laden, t],
  );

  const bildMenue = useCallback(() => {
    Alert.alert(t("chat.bildSenden"), undefined, [
      { text: t("chat.bildAufnehmen"), onPress: () => void bildSenden("kamera") },
      { text: t("chat.bildWaehlen"), onPress: () => void bildSenden("galerie") },
      { text: t("chat.abbrechen"), style: "cancel" },
    ]);
  }, [bildSenden, t]);

  // --- Melden und Ausstieg (Google UGC-Policy, 0615) ----------------------
  // Google verlangt für Direktnachrichten in einem geschlossenen Nutzerkreis
  // BEIDES: einen Meldeweg für Inhalte UND Menschen, und einen Weg heraus.
  // Der Wortlaut steht in `apps/api/.../owner_chat/moderation.py`.
  //
  // Frueher `Alert` statt eines Blattes — siehe die Begruendung unten:
  // muss aus JEDER Nachricht heraus erreichbar sein. Ein Bottom-Sheet dafür
  // wäre mehr Bauteil als Nutzen — und der Meldeweg muss vor allem GEFUNDEN
  // werden, nicht schön sein.

  const meldenAusfuehren = useCallback(
    async (grund: Meldegrund, messageId?: string) => {
      const res = await nachrichtMelden(threadId, { grund, messageId });
      // Ehrlich melden, was passiert ist: ein stilles „ok" auf eine Beschwerde
      // ist genau die Stelle, an der jemand denkt, es sei nichts passiert.
      Alert.alert(
        res.ok ? t("chat.meldungGesendet") : t("chat.meldungFehler"),
        res.ok ? t("chat.meldungDanke") : undefined,
      );
    },
    [threadId, t],
  );

  // MELDEN LÄUFT ÜBER EIN BLATT, NICHT ÜBER `Alert` (15.09.2026).
  //
  // `Alert.alert` nimmt auf ANDROID hoechstens DREI Knoepfe entgegen
  // (neutral/negativ/positiv) und verwirft den Rest still
  // (`Libraries/Alert/Alert.js`: `buttons.slice(0, 3)`). Die Auswahl hier ist
  // vier Gruende lang plus Abbrechen — auf der Plattform, die eingereicht
  // wird, fehlten damit "Anderes" und "Abbrechen". Der Meldeweg funktionierte
  // noch, aber abgeschnitten, und ein Pruefer sieht ein halbes Menue.
  //
  // Das Blatt kennt keine Knopfgrenze und ist auf beiden Plattformen dasselbe.
  const [meldeFuer, setMeldeFuer] = useState<{ messageId?: string } | null>(null);

  const meldeMenue = useCallback((messageId?: string) => {
    setMeldeFuer({ messageId });
  }, []);

  const meldeGruende: { schluessel: Meldegrund; label: string }[] = [
    { schluessel: "beleidigung", label: t("chat.grundBeleidigung") },
    { schluessel: "betrug", label: t("chat.grundBetrug") },
    { schluessel: "unerwuenscht", label: t("chat.grundUnerwuenscht") },
    { schluessel: "anderes", label: t("chat.grundAnderes") },
  ];

  const beenden = useCallback(() => {
    Alert.alert(t("chat.beenden"), t("chat.beendenErklaerung"), [
      {
        text: t("chat.beendenBestaetigen"),
        style: "destructive",
        onPress: () => {
          const lauf = async () => {
            const res = await chatBeenden(threadId);
            if (!res.ok) {
              setFehler(res.error);
              return;
            }
            setGestoppt(true);
          };
          void lauf();
        },
      },
      { text: t("chat.abbrechen"), style: "cancel" },
    ]);
  }, [threadId, t]);

  const wiederAufnehmen = useCallback(() => {
    const lauf = async () => {
      const res = await chatWiederAufnehmen(threadId);
      if (!res.ok) {
        setFehler(res.error);
        return;
      }
      setGestoppt(false);
    };
    void lauf();
  }, [threadId]);

  const gespraechsMenue = useCallback(() => {
    Alert.alert(t("chat.optionen"), undefined, [
      { text: t("chat.melden"), onPress: () => meldeMenue() },
      { text: t("chat.beenden"), style: "destructive", onPress: beenden },
      { text: t("chat.abbrechen"), style: "cancel" },
    ]);
  }, [meldeMenue, beenden, t]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.palette.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        ref={rollen}
        contentContainerStyle={{ padding: KARTE_ABSTAND, gap: 8 }}
        refreshControl={
          <RefreshControl refreshing={laedt} onRefresh={() => void laden()} />
        }
        onContentSizeChange={() =>
          rollen.current?.scrollToEnd({ animated: false })
        }
      >
        {/* Der Meldeweg muss GEFUNDEN werden — ein Menü, das nur hinter einem
            langen Druck liegt, findet niemand. Deshalb steht der Zugang auch
            sichtbar über dem Verlauf. */}
        <TouchableOpacity
          onPress={gespraechsMenue}
          accessibilityRole="button"
          accessibilityLabel={t("chat.optionen")}
          style={{ alignSelf: "center", padding: 6 }}
        >
          <Txt v="klein" soft>
            {t("chat.optionen")}
          </Txt>
        </TouchableOpacity>

        {nichtLesbar > 0 ? (
          <Kachel>
            <Txt v="klein">
              {t("chat.nichtLesbarAnzahl", { anzahl: String(nichtLesbar) })}
            </Txt>
            <Txt v="klein" soft>
              {t("chat.freigabeBitten")}
            </Txt>
          </Kachel>
        ) : null}

        {blasen.length === 0 && !laedt ? (
          <Txt v="klein" soft style={{ textAlign: "center" }}>
            {t("chat.leer")}
          </Txt>
        ) : null}

        {blasen.map((b) => (
          <Nachricht
            key={b.id}
            blase={b}
            // Langer Druck auf die Blase = diese Nachricht melden. Das ist die
            // Geste, die Nutzer aus jedem Messenger kennen; der sichtbare
            // Zugang oben bleibt trotzdem, weil man eine Geste nicht sieht.
            melden={() => meldeMenue(b.id)}
          />
        ))}
      </ScrollView>

      {fehler ? (
        <View style={{ paddingHorizontal: KARTE_ABSTAND }}>
          <Txt v="klein" color={theme.palette.star}>
            {fehler}
          </Txt>
        </View>
      ) : null}

      {gestoppt ? (
        /* Kein Eingabefeld mehr: der Server nimmt nichts an (409), und ein
           Feld, dessen Senden immer scheitert, wäre die Attrappe, die Googles
           Anforderung an einen Ausstieg gerade nicht erfüllt. Der Weg zurück
           steht daneben — ein Streit endet (Wurzel 1). */
        <View
          style={{
            gap: 8,
            padding: KARTE_ABSTAND,
            paddingBottom: KARTE_ABSTAND + insets.bottom,
            borderTopWidth: 1,
            borderTopColor: theme.palette.line,
          }}
        >
          <Txt v="klein" soft style={{ textAlign: "center" }}>
            {t("chat.beendetHinweis")}
          </Txt>
          <Btn variant="outline" block onPress={wiederAufnehmen}>
            {t("chat.wiederAufnehmen")}
          </Btn>
        </View>
      ) : (
      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          gap: 8,
          padding: KARTE_ABSTAND,
          // Der Home-Indikator liegt UEBER der App. Ohne diesen Zuschlag
          // klebt die Eingabezeile darauf und der Sendeknopf ist am unteren
          // Rand kaum zu treffen. Bei geoeffneter Tastatur schiebt
          // KeyboardAvoidingView den Block hoch und der Indikator ist weg —
          // deshalb nur der Grundabstand, nicht zusaetzlich zur Tastaturhoehe.
          paddingBottom: KARTE_ABSTAND + insets.bottom,
          borderTopWidth: 1,
          borderTopColor: theme.palette.line,
        }}
      >
        <TouchableOpacity
          onPress={bildMenue}
          disabled={bildLaeuft || sendet}
          accessibilityLabel={t("chat.bildSenden")}
          style={{ padding: 8 }}
        >
          <Icon
            n="cam"
            s={22}
            c={bildLaeuft ? theme.palette.faint : theme.palette.soft}
          />
        </TouchableOpacity>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={t("chat.eingabe")}
          placeholderTextColor={theme.palette.soft}
          multiline
          style={{
            flex: 1,
            maxHeight: 120,
            color: theme.palette.ink,
            backgroundColor: theme.palette.surface,
            borderRadius: 20,
            paddingHorizontal: 14,
            paddingTop: 10,
            paddingBottom: 10,
          }}
        />
        <Btn
          onPress={() => void senden()}
          // Auch gegen den laufenden BILDVERSAND sperren: der schickt den
          // Text mit, ein zweiter Druck währenddessen sendete ihn doppelt
          // (Wurzel 2).
          disabled={sendet || bildLaeuft || text.trim().length === 0}
        >
          {sendet ? t("chat.sendet") : t("chat.senden")}
        </Btn>
      </View>
      )}

      {/* Meldegruende als Blatt. Jede Zeile ist ein eigener Eintrag, kein
          Knopf eines Systemdialogs — damit gibt es keine Dreier-Grenze und
          alle vier Gruende sind auf beiden Plattformen erreichbar. */}
      <Blatt
        offen={meldeFuer !== null}
        titel={t("chat.melden")}
        schliessen={() => setMeldeFuer(null)}
      >
        <Txt v="xs" soft style={{ marginBottom: 10 }}>
          {t("chat.meldenGrund")}
        </Txt>
        {meldeGruende.map((g) => (
          <BlattOption
            key={g.schluessel}
            label={g.label}
            aktiv={false}
            auf={() => {
              const fuer = meldeFuer;
              setMeldeFuer(null);
              void meldenAusfuehren(g.schluessel, fuer?.messageId);
            }}
          />
        ))}
      </Blatt>
    </KeyboardAvoidingView>
  );
}

function Nachricht({ blase, melden }: { blase: Blase; melden: () => void }) {
  const t = useT();
  const theme = useTheme();
  const eigene = seiteIstEigene(blase.sender);
  return (
    <TouchableOpacity
      onLongPress={melden}
      // Kein Kurzdruck: eine Blase ist kein Knopf, und ein versehentliches
      // Melden wäre eine Beschwerde, die niemand gemeint hat.
      activeOpacity={1}
      accessibilityRole="button"
      accessibilityHint={t("chat.melden")}
      style={{
        alignSelf: eigene ? "flex-end" : "flex-start",
        maxWidth: "85%",
        backgroundColor: eigene ? theme.accent : theme.palette.surface,
        borderRadius: 16,
        paddingHorizontal: 12,
        paddingVertical: 8,
        gap: 2,
      }}
    >
      {!eigene ? (
        <Txt v="klein" soft>
          {blase.sender_name}
        </Txt>
      ) : null}
      {/* Die Hinweiszeilen tragen dieselbe Farbregel wie der Text unten:
          auf der EIGENEN Blase steht `accentInk` auf dem Markenrot, sonst der
          gedämpfte Ton auf Weiss. Bis zum 15.09.2026 stand hier fest `soft`
          bzw. `star` — beides ist ein dunkler Grauton und auf der roten Blase
          praktisch unlesbar. Ein Hinweis, den man nicht lesen kann, ist
          derselbe Fehler wie gar keiner. */}
      {blase.manipuliert ? (
        <Txt v="klein" color={eigene ? theme.palette.accentInk : theme.palette.star}>
          {t("chat.manipuliert")}
        </Txt>
      ) : blase.klartext === null ? (
        <Txt
          v="klein"
          color={eigene ? theme.palette.accentInk : theme.palette.soft}
          style={{ fontStyle: "italic", opacity: eigene ? 0.9 : 1 }}
        >
          {t("chat.nichtLesbar")}
        </Txt>
      ) : null}
      {/* Bilder der Nachricht. Sie tragen DENSELBEN Schlüssel wie ihr Text
          (`nachrichtVerschluesseln`) und werden hier entschlüsselt angezeigt.
          Ohne diesen Block wäre eine reine Bildnachricht eine leere Blase —
          genau der Fall, den der Kopf dieses Screens ausschließen soll. */}
      {blase.bildDaten.map((uri, i) => (
        <Image
          key={`${blase.id}-${i}`}
          source={{ uri }}
          style={{ width: 200, height: 200, borderRadius: 12 }}
          resizeMode="cover"
        />
      ))}
      {/* Text NUR wenn vorhanden: eine reine Bildnachricht hat keinen, und
          eine leere Blase wäre der stille Fehler aus Wurzel 5. */}
      {blase.klartext ? (
        <Txt style={{ color: eigene ? theme.palette.accentInk : undefined }}>
          {blase.klartext}
        </Txt>
      ) : null}
    </TouchableOpacity>
  );
}

// Derzeit ungenutzt: sie trug die Zeile „Ende-zu-Ende verschlüsselt" über dem
// Verlauf. Die ist am 09.09.2026 entfallen, weil der Chat seit dem Umbau
// serverseitig verschlüsselt ist (`owner_chat/serverkrypto.py`) und die Zusage
// damit nicht mehr galt. Die Komponente bleibt stehen, weil ein zentrierter
// Hinweis mit Schloss-Symbol über dem Verlauf wiederkommen kann — etwa wenn
// der Chat eine andere Zusicherung bekommt, die belegbar ist.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function Hinweis({ text }: { text: string }) {
  const theme = useTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        alignSelf: "center",
        paddingHorizontal: 12,
        paddingVertical: 6,
      }}
    >
      <Icon n="lock" s={12} c={theme.palette.soft} />
      <Txt v="klein" soft style={{ textAlign: "center" }}>
        {text}
      </Txt>
    </View>
  );
}

export default Chat;

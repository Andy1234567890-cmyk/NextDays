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
import { Btn, Kachel, Spinner, Txt } from "@/components/ui/kit";
import { useT } from "@/contexts/SprachContext";
import {
  bilderOeffnen,
  chatSenden,
  getChatVerlauf,
  nachrichtOeffnen,
  type ChatNachricht,
} from "@/lib/chat";
import { istLesbar, seiteIstEigene } from "@/lib/chat-anzeige";
import { bildWaehlen, fotoAufnehmen } from "@/lib/chat-bild";
import { geraeteIdLesen, identitaetLesen } from "@/lib/chat-krypto";
import { KARTE_ABSTAND } from "@/theme/flaechen";
import { useTheme } from "@/theme/ThemeProvider";

import { ChatEinrichten } from "./ChatEinrichten";

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
  const { propertyId, threadId } = route.params;
  const t = useT();
  const theme = useTheme();

  const [geraetBereit, setGeraetBereit] = useState<boolean | null>(null);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [blasen, setBlasen] = useState<Blase[]>([]);
  const [nichtLesbar, setNichtLesbar] = useState(0);
  const [laedt, setLaedt] = useState(true);
  const [sendet, setSendet] = useState(false);
  const [text, setText] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [bildLaeuft, setBildLaeuft] = useState(false);
  const rollen = useRef<ScrollView>(null);

  // Hat dieses Gerät einen Schlüssel UND eine registrierte ID? Ohne beides
  // ist der Screen sinnlos — deshalb VOR dem ersten Laden geprüft. Ein
  // Schlüssel ohne Registrierung (abgebrochene Einrichtung) zählt als „nicht
  // bereit": der Verlauf käme sonst ohne Schlüssel zurück.
  const geraetPruefen = useCallback(async () => {
    const identitaet = await identitaetLesen();
    const id = await geraeteIdLesen();
    setDeviceId(id);
    setGeraetBereit(identitaet !== null && id !== null);
  }, []);

  useEffect(() => {
    void geraetPruefen();
  }, [geraetPruefen]);

  const laden = useCallback(async () => {
    if (!threadId || !deviceId) {
      setLaedt(false);
      return;
    }
    setLaedt(true);
    const res = await getChatVerlauf(threadId, deviceId);
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
    setFehler(null);
    setLaedt(false);
  }, [threadId, deviceId, t]);

  useEffect(() => {
    if (geraetBereit) void laden();
  }, [geraetBereit, laden]);

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
    setText("");
    setFehler(null);
    await laden();
    rollen.current?.scrollToEnd({ animated: true });
  }, [text, sendet, propertyId, laden, t]);

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
      setText("");
      setFehler(null);
      await laden();
    },
    [bildLaeuft, propertyId, text, laden, t],
  );

  const bildMenue = useCallback(() => {
    Alert.alert(t("chat.bildSenden"), undefined, [
      { text: t("chat.bildAufnehmen"), onPress: () => void bildSenden("kamera") },
      { text: t("chat.bildWaehlen"), onPress: () => void bildSenden("galerie") },
      { text: t("chat.abbrechen"), style: "cancel" },
    ]);
  }, [bildSenden, t]);

  if (geraetBereit === null) {
    return (
      <View style={{ flex: 1, justifyContent: "center" }}>
        <Spinner />
      </View>
    );
  }

  if (!geraetBereit) {
    return (
      <ChatEinrichten
        onFertig={() => {
          // Neu prüfen statt blind auf `true` setzen: die Geräte-ID entsteht
          // erst bei der Registrierung, und ohne sie lädt nichts.
          void geraetPruefen();
        }}
      />
    );
  }

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
        <Hinweis text={t("chat.verschluesseltErklaerung")} />

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
          <Nachricht key={b.id} blase={b} />
        ))}
      </ScrollView>

      {fehler ? (
        <View style={{ paddingHorizontal: KARTE_ABSTAND }}>
          <Txt v="klein" color={theme.palette.star}>
            {fehler}
          </Txt>
        </View>
      ) : null}

      <View
        style={{
          flexDirection: "row",
          alignItems: "flex-end",
          gap: 8,
          padding: KARTE_ABSTAND,
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
    </KeyboardAvoidingView>
  );
}

function Nachricht({ blase }: { blase: Blase }) {
  const t = useT();
  const theme = useTheme();
  const eigene = seiteIstEigene(blase.sender);
  return (
    <View
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
      {blase.manipuliert ? (
        <Txt v="klein" color={theme.palette.star}>
          {t("chat.manipuliert")}
        </Txt>
      ) : blase.klartext === null ? (
        <Txt v="klein" soft style={{ fontStyle: "italic" }}>
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
    </View>
  );
}

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

// Chat auf diesem Gerät einrichten (0611, ADR-0029).
//
// VERWAIST SEIT DEM 09.09.2026 — niemand importiert diesen Screen mehr.
// Mit dem Umstieg auf serverseitige Verschlüsselung braucht der Chat kein
// registriertes Gerät mehr, und die Sperre in `Chat.tsx`, die hierher führte,
// ist entfallen. Die Datei bleibt bewusst stehen statt gelöscht zu werden:
// die Geräteverwaltung (`ChatGeraete.tsx`) ist weiterhin erreichbar, und der
// E2E-Bestand aus der Zeit davor lässt sich NUR mit einem eingerichteten
// Gerät öffnen. Ob dieser Weg wieder gebraucht wird, entscheidet der Betrieb,
// nicht der Aufräumdrang.
//
// DREI SCHRITTE, die zusammengehören und deshalb in EINEM Screen stehen:
//   1. Schlüsselpaar erzeugen (bleibt in der Keychain)
//   2. Gerät beim Server registrieren — mit Besitznachweis, sonst könnte
//      jeder einen fremden Schlüssel eintragen und mitlesen
//   3. Sicherungscode zeigen. EINMAL. Er wird nirgends gespeichert.
//
// WARUM SCHRITT 3 NICHT ÜBERSPRINGBAR IST: Ohne Code ist der Verlauf nach
// einem Gerätewechsel endgültig weg — auch für uns. Diese Folge muss der
// Eigentümer VORHER kennen, nicht im Ernstfall; sonst hält er sie für einen
// Fehler unserer Software.
//
// Wer bereits eine Sicherung hinterlegt hat (zweites Gerät, Neuinstallation),
// bekommt den Weg über den Code angeboten statt neuer Schlüssel — sonst
// entstünde eine zweite Identität, und der alte Verlauf bliebe unlesbar.
import { useCallback, useState } from "react";
import {
  Alert,
  Clipboard,
  Platform,
  ScrollView,
  TextInput,
  View,
} from "react-native";

import { Btn, Kachel, Spinner, Txt } from "@/components/ui/kit";
import { useT } from "@/contexts/SprachContext";
import {
  geraetAufgabeHolen,
  geraetRegistrieren,
  sicherungAblegen,
  sicherungHolen,
} from "@/lib/chat";
import {
  aufgabeSignieren,
  geraeteIdMerken,
  identitaetAnlegen,
  sicherungEinspielen,
  sicherungErzeugen,
} from "@/lib/chat-krypto";
import { KARTE_ABSTAND } from "@/theme/flaechen";
import { useTheme } from "@/theme/ThemeProvider";

type Props = { onFertig: () => void };

type Schritt = "start" | "laeuft" | "code" | "wiederherstellen";

export function ChatEinrichten({ onFertig }: Props) {
  const t = useT();
  const theme = useTheme();
  const [schritt, setSchritt] = useState<Schritt>("start");
  const [code, setCode] = useState("");
  const [eingabe, setEingabe] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [kopiert, setKopiert] = useState(false);
  const [stelltHer, setStelltHer] = useState(false);

  const geraetName = useCallback(() => {
    // Ein sprechender Name, damit der Eigentümer sein Gerät in der Liste
    // wiedererkennt — die Liste ist der Teil des Schutzes, den Kryptografie
    // nicht leisten kann.
    return `${Platform.OS === "ios" ? "iPhone" : "Android"} · ${new Date().toLocaleDateString()}`;
  }, []);

  const registrieren = useCallback(async () => {
    // Der Besitznachweis ist Pflicht: der Server stellt eine Aufgabe, das
    // Gerät signiert sie mit seinem privaten Schlüssel.
    const aufgabe = await geraetAufgabeHolen();
    if (!aufgabe.ok) throw new Error(aufgabe.error);
    const paar = await identitaetAnlegen();
    const signatur = await aufgabeSignieren(aufgabe.data.aufgabe);
    const res = await geraetRegistrieren({
      public_key: paar.publicKey,
      signing_key: paar.signingKey,
      signatur,
      geraet_name: geraetName(),
    });
    if (!res.ok) throw new Error(res.error);
    // Die vergebene ID festhalten: ohne sie liefert der Verlauf keine
    // Schlüssel, und jede Nachricht wäre sichtbar, aber unlesbar.
    await geraeteIdMerken(res.data.id);
  }, [geraetName]);

  const einrichten = useCallback(async () => {
    setSchritt("laeuft");
    setFehler(null);
    try {
      await registrieren();
      const sicherung = await sicherungErzeugen();
      const abgelegt = await sicherungAblegen({
        wrapped_identity: sicherung.wrappedIdentity,
        kdf_params: {
          algorithmus: sicherung.kdfParams.algorithmus,
          memory: sicherung.kdfParams.memory,
          passes: sicherung.kdfParams.passes,
          parallelism: sicherung.kdfParams.parallelism,
          salt: sicherung.kdfParams.salt,
        },
      });
      if (!abgelegt.ok) throw new Error(abgelegt.error);
      setCode(sicherung.code);
      setSchritt("code");
    } catch (e) {
      setFehler(e instanceof Error ? e.message : t("chat.einrichtenFehler"));
      setSchritt("start");
    }
  }, [registrieren, t]);

  const wiederherstellen = useCallback(async () => {
    // Wurzel 2: Argon2id braucht bewusst ~1 Sekunde. Ein zweiter Druck in
    // diesem Fenster liefe alles doppelt durch — inklusive `registrieren()`,
    // was ZWEI Gerätezeilen für dasselbe Telefon anlegte. Die erste bliebe als
    // Karteileiche im Empfängerkreis und sähe in der Geräteliste aus wie ein
    // fremdes Gerät.
    if (stelltHer) return;
    setStelltHer(true);
    setFehler(null);
    const gespeichert = await sicherungHolen();
    if (!gespeichert.ok) {
      setStelltHer(false);
      setFehler(t("chat.sicherungKeine"));
      return;
    }
    try {
      await sicherungEinspielen(eingabe, gespeichert.data.wrapped_identity, {
        algorithmus: "argon2id",
        memory: gespeichert.data.kdf_params.memory,
        passes: gespeichert.data.kdf_params.passes,
        parallelism: gespeichert.data.kdf_params.parallelism,
        salt: gespeichert.data.kdf_params.salt,
      });
      // Nach dem Einspielen ist die Identität dieselbe wie auf dem alten
      // Gerät — dieses Gerät braucht trotzdem einen EIGENEN Eintrag, sonst
      // bekäme es keine neuen Nachrichten verpackt.
      await registrieren();
      setStelltHer(false);
      onFertig();
    } catch (e) {
      setStelltHer(false);
      setFehler(e instanceof Error ? e.message : t("chat.sicherungFalsch"));
    }
  }, [stelltHer, eingabe, registrieren, onFertig, t]);

  if (schritt === "laeuft") {
    return (
      <View style={{ flex: 1, justifyContent: "center", gap: 12 }}>
        <Spinner />
        <Txt v="klein" soft style={{ textAlign: "center" }}>
          {t("chat.richtetEin")}
        </Txt>
      </View>
    );
  }

  if (schritt === "code") {
    return (
      <ScrollView contentContainerStyle={{ padding: KARTE_ABSTAND, gap: 12 }}>
        <Txt v="titel">{t("chat.sicherungTitel")}</Txt>
        <Txt v="klein" soft>
          {t("chat.sicherungText")}
        </Txt>
        <Kachel>
          <Txt
            style={{
              fontFamily: "Courier",
              fontSize: 18,
              letterSpacing: 1,
              textAlign: "center",
            }}
            selectable
          >
            {code}
          </Txt>
        </Kachel>
        {/* Kopieren, damit der Code in einen Passwortmanager wandern kann.
            Abschreiben ist die häufigste Fehlerquelle, und ein Tippfehler
            kostet hier den ganzen Verlauf. Der Text wechselt nach dem Druck —
            ohne Rückmeldung weiß niemand, ob es geklappt hat. */}
        <Btn
          variant="ghost"
          onPress={() => {
            // Clipboard aus dem RN-Kern ist als veraltet markiert (Warnung nur
            // im Dev-Build). Der Ersatz @react-native-clipboard/clipboard ist
            // ein natives Modul und braucht ein `pod install` — bewusst als
            // eigener Schritt, nicht nebenbei hier. Gleiche Entscheidung wie
            // in mobile-nextdays/screens/PropertyDescription.tsx.
            Clipboard.setString(code);
            setKopiert(true);
          }}
        >
          {kopiert ? t("chat.sicherungKopiert") : t("chat.sicherungTitel")}
        </Btn>
        <Btn
          onPress={() => {
            // Bewusst mit Rückfrage: der Code ist ab hier weg. Ein Knopf, der
            // ihn kommentarlos verschwinden lässt, wäre eine Falle.
            Alert.alert(t("chat.sicherungTitel"), t("chat.sicherungText"), [
              { text: t("chat.abbrechen"), style: "cancel" },
              { text: t("chat.sicherungVerstanden"), onPress: onFertig },
            ]);
          }}
        >
          {t("chat.sicherungVerstanden")}
        </Btn>
      </ScrollView>
    );
  }

  if (schritt === "wiederherstellen") {
    return (
      <ScrollView contentContainerStyle={{ padding: KARTE_ABSTAND, gap: 12 }}>
        <Txt v="titel">{t("chat.sicherungEinspielen")}</Txt>
        <TextInput
          value={eingabe}
          onChangeText={setEingabe}
          placeholder={t("chat.sicherungEingabe")}
          autoCapitalize="characters"
          autoCorrect={false}
          style={{
            borderWidth: 1,
            borderRadius: 12,
            padding: 12,
            fontFamily: "Courier",
          }}
        />
        {fehler ? (
          <Txt v="klein" color={theme.palette.star}>
            {fehler}
          </Txt>
        ) : null}
        <Btn onPress={() => void wiederherstellen()} disabled={eingabe.trim().length === 0}>
            {t("chat.sicherungEinspielen")}
          </Btn>
        <Btn
          variant="ghost"
          onPress={() => {
            setSchritt("start");
          }}
        >
          {t("chat.abbrechen")}
        </Btn>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={{ padding: KARTE_ABSTAND, gap: 12 }}>
      <Txt v="titel">{t("chat.einrichten")}</Txt>
      <Txt v="klein" soft>
        {t("chat.einrichtenText")}
      </Txt>
      {fehler ? (
        <Txt v="klein" color={theme.palette.star}>
          {fehler}
        </Txt>
      ) : null}
      <Btn onPress={() => void einrichten()}>{t("chat.einrichtenKnopf")}</Btn>
      <Btn
        variant="ghost"
        onPress={() => {
          setSchritt("wiederherstellen");
        }}
      >
        {t("chat.sicherungEinspielen")}
      </Btn>
    </ScrollView>
  );
}

export default ChatEinrichten;

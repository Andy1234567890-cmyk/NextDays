// Gastgeber-Login. E-Mail + Passwort gegen den FastAPI-auth-Slice (/auth/login)
// — DIESELBE Auth wie das Web-Dashboard, KEINE eigene App-Registrierung. Bei
// Erfolg wird das Token im Schlüsselbund gespeichert und in die Gastgeber-Tabs
// navigiert. Kein Fallback: Fehler werden klar angezeigt.
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useState } from "react";
import { Alert, Image, Linking, Pressable, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon } from "@/components/ui/Icon";
import { Btn, Col, Row, Txt } from "@/components/ui/kit";
import { useAuth } from "@/contexts/AuthContext";
import type { RootStackParamList } from "@/navigation/types";
import { useTheme } from "@/theme/ThemeProvider";

export default function HostLogin() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { login, mfaLoesen, mfaFaktoren, mfaSmsAnfordern } = useAuth();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Startet verborgen. Ein Passwortfeld, das beim Öffnen sichtbar ist, verrät
  // die Eingabe an jeden, der mitliest — die Umschaltung ist die Ausnahme,
  // nicht der Ausgangszustand.
  const [passwortSichtbar, setPasswortSichtbar] = useState(false);
  // Zweiter Schritt (2FA). `faktorId` kommt aus der aal1-Sitzung, nicht aus
  // `mfa_methods` — der Login-Endpunkt liefert nur die TYPEN, die IDs stehen
  // in der Sitzung (lib/mfa-login.ts).
  const [mfaOffen, setMfaOffen] = useState(false);
  const [faktorId, setFaktorId] = useState<string | null>(null);
  const [istSms, setIstSms] = useState(false);
  const [telefon, setTelefon] = useState<string | null>(null);
  const [code, setCode] = useState("");

  // Kein manuelles Navigieren: nach erfolgreichem Login wechselt der Auth-Status
  // auf "signedIn", und die Root-Navigation (App.tsx) rendert automatisch das
  // rollenbasierte Erlebnis (experienceFor). Eine zentrale Stelle, kein
  // verstreutes reset() in Screens.
  const submit = async () => {
    if (!email.trim() || !password) {
      setError("Bitte E-Mail und Passwort eingeben.");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await login(email.trim(), password);
    if (!res.ok && "mfaRequired" in res) {
      // Die factor_id aus der Sitzung holen — ohne sie ist keine Challenge
      // möglich. Scheitert das, bleibt der Nutzer im Passwort-Schritt mit
      // einer echten Fehlermeldung statt in einer leeren Code-Maske.
      const f = await mfaFaktoren();
      setBusy(false);
      if (!f.ok) {
        setError(f.error);
        return;
      }
      // TOTP hat Vorrang: wer beides hat, tippt lieber den Code aus der App
      // als auf eine SMS zu warten.
      const totp = f.data.totp;
      const phone = f.data.phone;
      const gewaehlt = totp ?? phone ?? null;
      if (!gewaehlt) {
        setError("Kein verifizierter zweiter Faktor gefunden.");
        return;
      }
      setFaktorId(gewaehlt);
      setIstSms(!totp && Boolean(phone));
      setTelefon(res.phoneMasked);
      setMfaOffen(true);
      setError(null);
      // Bei SMS den Code gleich anfordern — sonst wartet der Nutzer vor einem
      // leeren Feld auf eine SMS, die niemand ausgelöst hat.
      if (!totp && phone) {
        const sms = await mfaSmsAnfordern(phone);
        if (!sms.ok) setError(sms.error);
      }
      return;
    }
    setBusy(false);
    if (!res.ok) setError(res.error);
  };

  // Schritt 2 abschicken. Kein manuelles Navigieren: mfaLoesen setzt den
  // Auth-Status, die Root-Navigation tauscht die Gruppen (wie beim Login).
  const codeAbschicken = async () => {
    if (!faktorId || !code.trim()) return;
    setBusy(true);
    setError(null);
    const res = await mfaLoesen(faktorId, code);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      setCode("");
    }
  };

  // Der Text IN den Feldern bleibt linksbündig, obwohl der Screen mittig
  // ausgerichtet ist: zentrierter Eingabetext wandert beim Tippen mit jedem
  // Zeichen, und die Einfügemarke sitzt nie da, wo man sie erwartet. Die Felder
  // selbst laufen über die volle Breite und stehen damit ohnehin auf der Mitte.
  // Zweigeteilt, weil das Passwortfeld den Rahmen auf einem umgebenden View
  // braucht (das Auge-Icon sitzt IM Feld) und das TextInput darin rahmenlos
  // bleibt. Die E-Mail-Zeile nutzt weiterhin beides zusammen als `field`,
  // damit beide Felder garantiert gleich aussehen — zwei getrennt gepflegte
  // Stilblöcke wären genau die Stelle, an der sie auseinanderlaufen.
  const feldRahmen = {
    backgroundColor: t.palette.surface,
    borderWidth: 1,
    borderColor: t.palette.line,
    borderRadius: 14,
    paddingHorizontal: 16,
  } as const;
  const feldText = {
    paddingVertical: 14,
    fontSize: 16,
    color: t.palette.ink,
  } as const;
  const field = { ...feldRahmen, ...feldText } as const;

  // Zweiter Schritt: eigene Ansicht statt eines weiteren Feldes im Formular.
  // Wer hier ist, hat das Passwort schon bestanden — E-Mail und Passwort noch
  // zu zeigen, lädt nur zum Neutippen ein.
  if (mfaOffen) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: t.palette.bg,
          paddingTop: insets.top + 40,
          paddingBottom: insets.bottom + 24,
          paddingHorizontal: 28,
          justifyContent: "center",
          gap: 28,
        }}
      >
        <Col gap={10} style={{ alignItems: "center" }}>
          <Icon n="shield" s={40} c={t.palette.accent} />
          <Txt v="display" style={{ textAlign: "center" }}>
            Bestätigung
          </Txt>
          <Txt v="body" soft style={{ textAlign: "center" }}>
            {istSms
              ? `Wir haben einen Code an ${telefon ?? "deine Nummer"} geschickt.`
              : "Gib den 6-stelligen Code aus deiner Authenticator-App ein."}
          </Txt>
        </Col>

        <Col gap={12}>
          <TextInput
            style={{ ...field, textAlign: "center", letterSpacing: 4, fontSize: 22 }}
            placeholder="000000"
            placeholderTextColor={t.palette.faint}
            keyboardType="number-pad"
            autoCapitalize="none"
            autoCorrect={false}
            // 6 Stellen: der TOTP-Code. Wiederherstellungscodes gehen hier
            // bewusst NICHT (lib/mfa-login.ts erklaert warum) — ein Feld, das
            // sie annimmt, aber immer 401 liefert, waere schlechter als keins.
            maxLength={6}
            value={code}
            onChangeText={setCode}
            editable={!busy}
            onSubmitEditing={codeAbschicken}
            returnKeyType="go"
            autoFocus
          />
          {error && (
            <Txt v="sm" color={t.palette.accent} style={{ textAlign: "center" }}>
              {error}
            </Txt>
          )}
          <Btn variant="dark" block onPress={busy ? undefined : codeAbschicken}>
            {busy ? "Wird geprüft …" : "Bestätigen"}
          </Btn>
          {istSms && faktorId && (
            <Pressable
              accessibilityRole="button"
              onPress={
                busy
                  ? undefined
                  : async () => {
                      const r = await mfaSmsAnfordern(faktorId);
                      setError(r.ok ? null : r.error);
                    }
              }
              hitSlop={8}
            >
              <Txt v="sm" color={t.palette.accent} style={{ textAlign: "center" }}>
                Code erneut senden
              </Txt>
            </Pressable>
          )}
          {/* Abbrechen führt zurück zum Passwort-Schritt. Die aal1-Sitzung
              bleibt im Speicher, bis sie abläuft (5 Min) oder der nächste
              Login sie ersetzt — sie öffnet nichts, siehe lib/auth.ts. */}
          <Pressable
            accessibilityRole="button"
            onPress={
              busy
                ? undefined
                : () => {
                    setMfaOffen(false);
                    setCode("");
                    setError(null);
                    setPassword("");
                  }
            }
            hitSlop={8}
          >
            <Txt v="sm" soft style={{ textAlign: "center" }}>
              Abbrechen
            </Txt>
          </Pressable>
        </Col>
      </View>
    );
  }

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: t.palette.bg,
        paddingTop: insets.top + 40,
        paddingBottom: insets.bottom + 24,
        paddingHorizontal: 28,
        justifyContent: "center",
        gap: 28,
      }}
    >
      <Col gap={10} style={{ alignItems: "center" }}>
        <Image
          source={t.marke.logo}
          style={{
            height: 44,
            width: 44 * t.marke.logoRatio,
            resizeMode: "contain",
            alignSelf: "center",
          }}
          accessibilityLabel={t.marke.name}
        />
        <Txt v="display" style={{ textAlign: "center" }}>
          Gastgeber-Login
        </Txt>
        <Txt v="body" soft style={{ textAlign: "center" }}>
          Melde dich mit deinem Betriebskonto an — dasselbe wie im Dashboard.
        </Txt>
      </Col>

      <Col gap={12}>
        <TextInput
          style={field}
          placeholder="E-Mail"
          placeholderTextColor={t.palette.faint}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          editable={!busy}
        />
        {/* Das Icon sitzt IM Feld, nicht daneben: der Rahmen liegt auf dem
            View, das TextInput darin ist rahmenlos. Ein zweites gerahmtes
            Element neben dem Feld waere eine eigene Spalte und wuerde die
            Feldbreite gegenueber der E-Mail-Zeile verkuerzen. */}
        <View style={{ ...feldRahmen, flexDirection: "row", alignItems: "center" }}>
          <TextInput
            style={{ ...feldText, flex: 1 }}
            placeholder="Passwort"
            placeholderTextColor={t.palette.faint}
            secureTextEntry={!passwortSichtbar}
            value={password}
            onChangeText={setPassword}
            editable={!busy}
            onSubmitEditing={submit}
            returnKeyType="go"
          />
          <Pressable
            accessibilityRole="button"
            // Der Label beschreibt die AKTION, nicht den Zustand — ein
            // Screenreader liest sonst "Passwort sichtbar" vor, waehrend das
            // Antippen es verbirgt.
            accessibilityLabel={passwortSichtbar ? "Passwort verbergen" : "Passwort anzeigen"}
            onPress={() => setPasswortSichtbar((v) => !v)}
            // Die Trefferflaeche ist groesser als das 22px-Icon: darunter ist
            // ein Knopf auf dem Telefon nicht zuverlaessig zu treffen.
            hitSlop={12}
            style={{ paddingLeft: 12 }}
          >
            <Icon n={passwortSichtbar ? "eyeoff" : "eye"} s={22} c={t.palette.faint} />
          </Pressable>
        </View>
        {error && (
          <Txt v="sm" color={t.palette.accent} style={{ textAlign: "center" }}>
            {error}
          </Txt>
        )}
        <Btn variant="dark" block onPress={busy ? undefined : submit}>
          {busy ? "Anmeldung läuft …" : "Weiter"}
        </Btn>

        {/* Unter dem Anmelde-Knopf, nicht daneben: hier sucht man ihn,
            nachdem das Passwort nicht funktioniert hat. */}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Passwort vergessen"
          onPress={busy ? undefined : () => navigation.navigate("HostPasswortVergessen")}
          hitSlop={8}
        >
          <Txt v="sm" color={t.palette.accent} style={{ textAlign: "center" }}>
            Passwort vergessen?
          </Txt>
        </Pressable>

        {/* Die Firmenanmeldung findet im WEB statt, nicht hier.
            Ein Betrieb anzulegen heißt: Stammdaten, Steuer- und Zahlungsangaben,
            Vertragsabschluss. Das gehört an den Schreibtisch — und eine zweite,
            schwächere Anmeldestrecke in der App wäre ein zweiter Pfad in
            dieselbe Tabelle, der stiller veraltet als der gepflegte.
            Deshalb öffnet der Link den Browser statt eines App-Screens; der
            Text sagt das vorher, damit der Sprung nicht überrascht. */}
        <Col gap={4} style={{ marginTop: 4, alignItems: "center" }}>
          <Txt v="sm" soft>
            Noch kein Konto?
          </Txt>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Unternehmen im Web anlegen"
            onPress={
              busy
                ? undefined
                : () => {
                    const ziel = `${t.marke.webUrl}/signup`;
                    Linking.openURL(ziel).catch(() =>
                      // Kein stiller Fehlschlag: ohne Browser bleibt die
                      // Adresse lesbar, damit sie am Rechner eingegeben werden
                      // kann.
                      Alert.alert(
                        "Anmeldung im Web",
                        `Ein Betrieb wird am Rechner angelegt:\n\n${ziel}`,
                      ),
                    );
                  }
            }
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
          >
            <Row gap={6} style={{ alignItems: "center" }}>
              <Txt
                v="sm"
                style={{
                  fontFamily: t.fonts.semibold,
                  textDecorationLine: "underline",
                }}
              >
                Unternehmen im Web anlegen
              </Txt>
              <Icon n="fwd" s={13} sw={2.2} c={t.palette.ink} />
            </Row>
          </Pressable>
        </Col>
      </Col>
    </View>
  );
}

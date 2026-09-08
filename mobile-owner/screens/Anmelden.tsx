// Anmeldung. Tenant-Auth (`/auth/login`) — DIESELBE Auth wie PMS und
// Web-Dashboard, keine eigene App-Registrierung. Zugänge legt die Verwaltung
// an; einen „Konto anlegen"-Weg gibt es hier bewusst nicht (ein Eigentümer
// wird einem Objekt zugeordnet, er meldet sich nicht selbst an).
//
// DER 2FA-FLOW IST 1:1 AUS mobile-nextdays/screens/HostLogin.tsx übernommen und
// bewusst NICHT vereinfacht — er ist sicherheitsrelevant und hat drei Feinheiten,
// die man beim Neuschreiben verliert:
//  1. `mfaRequired` liefert nur die TYPEN der Faktoren; die `factor_id` steht in
//     der aal1-Sitzung und braucht einen zweiten Aufruf (`mfaFaktoren`).
//  2. TOTP hat Vorrang vor SMS — wer beides hat, tippt lieber den Code ab, als
//     auf eine SMS zu warten.
//  3. Bei SMS wird der Code SOFORT angefordert, sonst wartet der Nutzer vor
//     einem leeren Feld auf eine SMS, die niemand ausgelöst hat.
// Die serverseitige Prüfung sitzt in Supabase (`aal2`), nicht hier (Wurzel 7).
//
// Kein manuelles Navigieren nach Erfolg: `login`/`mfaLoesen` setzen den
// Auth-Status, und der Root-Navigator tauscht die Gruppen.
import { useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";

import { Feld } from "@/components/ui/Feld";
import { Btn, Kachel, Txt } from "@/components/ui/kit";
import { LogoWortmarke } from "@/components/ui/LogoVektor";
import { useAuth } from "@/contexts/AuthContext";
import { useT } from "@/contexts/SprachContext";
import { KARTE_ABSTAND } from "@/theme/flaechen";
import { useTheme } from "@/theme/ThemeProvider";

export default function Anmelden() {
  const txt = useT();
  const t = useTheme();
  const { login, mfaLoesen, mfaFaktoren, mfaSmsAnfordern } = useAuth();
  const [email, setEmail] = useState("");
  const [passwort, setPasswort] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [mfaOffen, setMfaOffen] = useState(false);
  const [faktorId, setFaktorId] = useState<string | null>(null);
  const [istSms, setIstSms] = useState(false);
  const [telefon, setTelefon] = useState<string | null>(null);
  const [code, setCode] = useState("");

  const anmelden = async () => {
    if (!email.trim() || !passwort) {
      setFehler(txt("login.fehlerLeer"));
      return;
    }
    setLaeuft(true);
    setFehler(null);
    const res = await login(email.trim(), passwort);
    if (!res.ok && "mfaRequired" in res) {
      const f = await mfaFaktoren();
      setLaeuft(false);
      if (!f.ok) {
        setFehler(f.error);
        return;
      }
      const totp = f.data.totp;
      const phone = f.data.phone;
      const gewaehlt = totp ?? phone ?? null;
      if (!gewaehlt) {
        setFehler(txt("login.zweiterFaktorFehlt"));
        return;
      }
      setFaktorId(gewaehlt);
      setIstSms(!totp && Boolean(phone));
      setTelefon(res.phoneMasked);
      setMfaOffen(true);
      setFehler(null);
      if (!totp && phone) {
        const sms = await mfaSmsAnfordern(phone);
        if (!sms.ok) setFehler(sms.error);
      }
      return;
    }
    setLaeuft(false);
    if (!res.ok) setFehler(res.error);
  };

  const codeAbschicken = async () => {
    if (!faktorId || !code.trim()) return;
    setLaeuft(true);
    setFehler(null);
    const res = await mfaLoesen(faktorId, code);
    setLaeuft(false);
    if (!res.ok) {
      setFehler(res.error);
      setCode("");
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.palette.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: "center",
          // SYMMETRISCHES Padding, damit „mittig" auch mittig aussieht.
          //
          // Die Safe-Area-Insets stehen hier BEWUSST NICHT drin: im Emulator
          // gemessen (02.09.2026) sind sie oben 51,8 dp und unten 24 dp. In ein
          // zentriertes Layout eingerechnet, verschieben diese 27,8 dp Differenz
          // den Inhalt um ~14 dp nach unten — sichtbar, und niemand sucht den
          // Grund im Padding. Der Inhalt braucht die Insets auch nicht: bei
          // `justifyContent: "center"` bleiben beide Ränder frei, und der
          // KeyboardAvoidingView haelt die Tastatur ohnehin ab.
          padding: t.density.pad,
          gap: KARTE_ABSTAND,
        }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ alignItems: "center", marginBottom: 8 }}>
          <LogoWortmarke hoehe={30} negativ={t.dark} />
          <Txt v="sm" soft style={{ marginTop: 10 }}>
            {txt("app.eigentuemerZugang")}
          </Txt>
        </View>

        <Kachel>
          {mfaOffen ? (
            <>
              <Txt v="title">Bestätigungscode</Txt>
              <Txt v="xs" soft style={{ marginTop: 2, marginBottom: 12 }}>
                {istSms
                  ? `Wir haben einen Code an ${telefon ?? txt("login.telefon")} geschickt.`
                  : txt("login.codeHinweis")}
              </Txt>
              <Feld
                label="Code"
                wert={code}
                aendern={setCode}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                maxLength={6}
              />
              <Btn
                onPress={() => void codeAbschicken()}
                disabled={laeuft || code.trim().length === 0}
                block
                style={{ marginTop: 14 }}
              >
                {laeuft ? txt("login.wirdGeprueft") : txt("login.bestaetigen")}
              </Btn>
            </>
          ) : (
            <>
              <Feld
                label={txt("login.email")}
                wert={email}
                aendern={setEmail}
                keyboardType="email-address"
                autoComplete="email"
                autoCapitalize="none"
              />
              <View style={{ height: 10 }} />
              <Feld
                label={txt("login.passwort")}
                wert={passwort}
                aendern={setPasswort}
                geheim
                autoComplete="password"
              />
              <Btn
                onPress={() => void anmelden()}
                disabled={laeuft}
                block
                style={{ marginTop: 14 }}
              >
                {laeuft ? txt("login.wirdAngemeldet") : txt("login.anmelden")}
              </Btn>
            </>
          )}

          {fehler ? (
            <Txt v="xs" color={t.palette.accent} style={{ marginTop: 10 }}>
              {fehler}
            </Txt>
          ) : null}
        </Kachel>

        <Txt v="xs" faint style={{ textAlign: "center" }}>
          {txt("login.hinweis")}
        </Txt>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

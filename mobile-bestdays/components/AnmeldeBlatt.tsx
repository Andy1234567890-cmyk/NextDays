// Anmelden oder Konto anlegen — EIN Blatt, drei Schritte, kein Passwort.
//
// VORBILD, live abgelesen am 19.08.2026 (airbnb.de/book/stays/…, nicht
// angemeldet): der Checkout dort besteht aus „1. Logge dich ein oder registriere
// dich → 2. Füge eine Zahlungsart hinzu → 3. Überprüfe deine Anfrage", und
// Schritt 1 öffnet ein Blatt mit GENAU EINEM Feld („Telefonnummer oder
// E-Mail-Adresse") plus Weiter. Dieselbe Maske dient Anmeldung UND
// Registrierung: bekannte Adresse = anmelden, unbekannte = Konto anlegen.
//
// Unser Zuschnitt: nur E-Mail (SMS-Codes verschicken wir nicht — ein Feld
// „Telefonnummer oder E-Mail" wäre eine Attrappe) und kein Google/Apple (dafür
// ist in Supabase kein OAuth eingerichtet; ein Knopf, der nichts tut, ist
// schlimmer als kein Knopf).
//
// Der Name wird ERST NACH dem Code gefragt, und nur, wenn das Konto neu ist —
// vorher wüsste die App gar nicht, ob es ein neues Konto ist, und darf es auch
// nicht wissen (der Server verrät die Existenz einer Adresse nicht).
import { useState } from "react";
import { Platform, TextInput, View } from "react-native";

import { Btn, Col, Row, Txt } from "@/components/ui/kit";
import { Sheet } from "@/components/ui/patterns";
import { useGuestAuth } from "@/contexts/GuestAuthContext";
import { useTheme } from "@/theme/ThemeProvider";

type Schritt = "email" | "code" | "name";

// E-Mail nur grob prüfen; verbindlich prüft Pydantic serverseitig.
function istEmail(wert: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(wert.trim());
}

export function AnmeldeBlatt({
  open,
  onClose,
  onFertig,
}: {
  open: boolean;
  onClose: () => void;
  /** Wird gerufen, wenn der Gast angemeldet UND sein Profil vollständig ist. */
  onFertig: () => void;
}) {
  const t = useTheme();
  const { codeAnfordern, codePruefen, profilAnlegen } = useGuestAuth();

  const [schritt, setSchritt] = useState<Schritt>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [telefon, setTelefon] = useState("");
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const zurueckAufAnfang = () => {
    setSchritt("email");
    setCode("");
    setFehler(null);
  };

  const codeSchicken = async () => {
    if (busy || !istEmail(email)) return;
    setBusy(true);
    setFehler(null);
    const res = await codeAnfordern(email.trim().toLowerCase());
    setBusy(false);
    if (!res.ok) {
      setFehler(res.error);
      return;
    }
    setSchritt("code");
  };

  const codeSenden = async () => {
    if (busy || code.trim().length < 4) return;
    setBusy(true);
    setFehler(null);
    const res = await codePruefen(email.trim().toLowerCase(), code);
    setBusy(false);
    if (!res.ok) {
      setFehler(res.error);
      return;
    }
    if (res.profilFehlt) {
      setSchritt("name");
      return;
    }
    onFertig();
  };

  const namenSpeichern = async () => {
    if (busy || name.trim().length === 0) return;
    setBusy(true);
    setFehler(null);
    const res = await profilAnlegen({
      name: name.trim(),
      phone: telefon.trim() || undefined,
    });
    setBusy(false);
    if (!res.ok) {
      setFehler(res.error);
      return;
    }
    onFertig();
  };

  const feldStil = {
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: t.radius.card,
    borderWidth: 1,
    borderColor: t.palette.line,
    backgroundColor: t.palette.bg,
    fontFamily: t.fonts.regular,
    fontSize: 16,
    color: t.palette.ink,
  } as const;

  return (
    <Sheet open={open} onClose={onClose}>
      <Col gap={14} style={{ paddingHorizontal: 24, paddingTop: 8, paddingBottom: 8 }}>
        {schritt === "email" && (
          <>
            <Txt v="h1">Anmelden oder Konto anlegen</Txt>
            <Txt v="sm" soft>
              Wir schicken dir einen Code an deine E-Mail-Adresse. Ein Passwort
              brauchst du nicht.
            </Txt>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="E-Mail-Adresse"
              placeholderTextColor={t.palette.faint}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoFocus
              style={feldStil}
            />
            {/* Btn kennt kein `disabled` (kit.tsx) — die VARIANTE zeigt den
                Zustand, gesperrt wird im Handler. Dasselbe Muster wie im
                Checkout-Knopf. */}
            <Btn
              variant={istEmail(email) && !busy ? "dark" : "ghost"}
              block
              onPress={codeSchicken}
            >
              {busy ? "Code wird geschickt …" : "Weiter"}
            </Btn>
          </>
        )}

        {schritt === "code" && (
          <>
            <Txt v="h1">Code eingeben</Txt>
            {/* Bewusst KEIN „Konto gefunden"/„neues Konto": die Antwort des
                Servers verrät nicht, ob die Adresse ein Konto hat, und diese
                Oberfläche darf es nicht doch verraten. */}
            <Txt v="sm" soft>
              Wir haben dir einen Code an {email.trim().toLowerCase()} geschickt.
            </Txt>
            <TextInput
              value={code}
              onChangeText={setCode}
              placeholder="6-stelliger Code"
              placeholderTextColor={t.palette.faint}
              keyboardType="number-pad"
              // iOS füllt den Code aus der Mail automatisch aus.
              textContentType={Platform.OS === "ios" ? "oneTimeCode" : "none"}
              autoComplete="one-time-code"
              autoFocus
              style={{ ...feldStil, letterSpacing: 4, fontSize: 20 }}
            />
            <Btn
              variant={code.trim().length >= 4 && !busy ? "dark" : "ghost"}
              block
              onPress={codeSenden}
            >
              {busy ? "Wird geprüft …" : "Anmelden"}
            </Btn>
            <Row gap={16}>
              <Btn variant="ghost" onPress={zurueckAufAnfang}>
                Andere Adresse
              </Btn>
              <Btn variant="ghost" onPress={codeSchicken}>
                Neuen Code schicken
              </Btn>
            </Row>
          </>
        )}

        {schritt === "name" && (
          <>
            <Txt v="h1">Wie heißt du?</Txt>
            <Txt v="sm" soft>
              Der Gastgeber sieht deinen Namen zu der Buchung. Die Telefonnummer
              ist freiwillig — sie hilft bei der Anreise.
            </Txt>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Vor- und Nachname"
              placeholderTextColor={t.palette.faint}
              textContentType="name"
              autoFocus
              style={feldStil}
            />
            <TextInput
              value={telefon}
              onChangeText={setTelefon}
              placeholder="Telefon (optional)"
              placeholderTextColor={t.palette.faint}
              keyboardType="phone-pad"
              textContentType="telephoneNumber"
              style={feldStil}
            />
            <Btn
              variant={name.trim() && !busy ? "dark" : "ghost"}
              block
              onPress={namenSpeichern}
            >
              {busy ? "Wird gespeichert …" : "Fertig"}
            </Btn>
          </>
        )}

        {fehler && (
          <Txt v="sm" style={{ color: t.palette.accent }}>
            {fehler}
          </Txt>
        )}
        <View style={{ height: 4 }} />
      </Col>
    </Sheet>
  );
}

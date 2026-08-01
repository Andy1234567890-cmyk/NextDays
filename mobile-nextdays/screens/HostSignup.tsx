// Tenant-Registrierung (Agentur / eigener Vermieter). Legt Konto + Unternehmen
// über POST /api/v1/auth/register an — DIESELBE Auth-Welt wie das Web-Dashboard.
// Land und Währung sind PFLICHT-Auswahlen OHNE Vorbelegung (Wurzel 4: kein
// stilles „EUR"/„DE"); ohne beide ist „Konto erstellen" gesperrt. Nach Erfolg
// wechselt der Auth-Status auf "signedIn" und die Root-Navigation rendert das
// rollenbasierte Erlebnis (kein manuelles Navigieren).
import { useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Btn, Col, Row, Txt } from "@/components/ui/kit";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/theme/ThemeProvider";

// Auswahllisten (kein Default). Land = ISO-3166-1 alpha-2, Währung = ISO-4217.
// Land und Währung sind bewusst UNABHÄNGIG wählbar (ein Tenant in DK kann in EUR
// abrechnen) — nichts wird aus dem Land „geraten".
const COUNTRIES: { code: string; label: string }[] = [
  { code: "DE", label: "Deutschland" },
  { code: "AT", label: "Österreich" },
  { code: "CH", label: "Schweiz" },
  { code: "DK", label: "Dänemark" },
  { code: "SE", label: "Schweden" },
  { code: "NO", label: "Norwegen" },
  { code: "NL", label: "Niederlande" },
  { code: "FR", label: "Frankreich" },
  { code: "ES", label: "Spanien" },
  { code: "IT", label: "Italien" },
  { code: "PL", label: "Polen" },
  { code: "GB", label: "Vereinigtes Königreich" },
];

const CURRENCIES: { code: string; label: string }[] = [
  { code: "EUR", label: "Euro (EUR)" },
  { code: "DKK", label: "Dänische Krone (DKK)" },
  { code: "SEK", label: "Schwedische Krone (SEK)" },
  { code: "NOK", label: "Norwegische Krone (NOK)" },
  { code: "CHF", label: "Schweizer Franken (CHF)" },
  { code: "PLN", label: "Złoty (PLN)" },
  { code: "GBP", label: "Pfund (GBP)" },
];

const BUSINESS: { code: "agency" | "self_managed"; label: string }[] = [
  { code: "agency", label: "Agentur (fremde Objekte)" },
  { code: "self_managed", label: "Eigener Vermieter" },
];

export default function HostSignup() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { register } = useAuth();

  const [fullName, setFullName] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  // Kein Default (Wurzel 4): null, bis der Nutzer aktiv wählt.
  const [country, setCountry] = useState<string | null>(null);
  const [currency, setCurrency] = useState<string | null>(null);
  const [businessType, setBusinessType] = useState<"agency" | "self_managed" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const complete =
    fullName.trim() !== "" &&
    tenantName.trim() !== "" &&
    email.trim() !== "" &&
    password.length >= 8 &&
    country !== null &&
    currency !== null &&
    businessType !== null;

  const submit = async () => {
    // Doppelte Absicherung: erst der Vollständigkeits-Guard, dann senden.
    if (!complete || busy || !country || !currency || !businessType) {
      setError("Bitte alle Felder ausfüllen (Passwort ≥ 8 Zeichen).");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await register({
      email: email.trim(),
      password,
      full_name: fullName.trim(),
      tenant_name: tenantName.trim(),
      country,
      currency,
      business_type: businessType,
    });
    setBusy(false);
    if (!res.ok) setError(res.error);
    // Erfolg: kein navigate — Root-Navigation übernimmt (signedIn).
  };

  const field = {
    backgroundColor: t.palette.surface,
    borderWidth: 1,
    borderColor: t.palette.line,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: t.palette.ink,
  } as const;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.palette.bg }}
      contentContainerStyle={{
        paddingTop: insets.top + 24,
        paddingBottom: insets.bottom + 32,
        paddingHorizontal: 28,
        gap: 22,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <Col gap={8}>
        <Txt v="display">Unternehmen anlegen</Txt>
        <Txt v="body" soft>
          Erstelle dein Betriebskonto — dieselbe Anmeldung wie im Dashboard.
        </Txt>
      </Col>

      <Col gap={12}>
        <TextInput
          style={field}
          placeholder="Dein Name"
          placeholderTextColor={t.palette.faint}
          value={fullName}
          onChangeText={setFullName}
          editable={!busy}
        />
        <TextInput
          style={field}
          placeholder="Firmen-/Unternehmensname"
          placeholderTextColor={t.palette.faint}
          value={tenantName}
          onChangeText={setTenantName}
          editable={!busy}
        />
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
        <TextInput
          style={field}
          placeholder="Passwort (min. 8 Zeichen)"
          placeholderTextColor={t.palette.faint}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          editable={!busy}
        />
      </Col>

      <Picker
        label="Land"
        options={COUNTRIES}
        selected={country}
        onSelect={setCountry}
        disabled={busy}
      />
      <Picker
        label="Abrechnungswährung"
        options={CURRENCIES}
        selected={currency}
        onSelect={setCurrency}
        disabled={busy}
      />
      <Picker
        label="Art"
        options={BUSINESS}
        selected={businessType}
        onSelect={(c) => setBusinessType(c as "agency" | "self_managed")}
        disabled={busy}
      />

      {error && (
        <Txt v="sm" color={t.palette.accent}>
          {error}
        </Txt>
      )}

      <Btn variant="dark" block onPress={busy || !complete ? undefined : submit}>
        {busy ? "Wird erstellt …" : "Konto erstellen"}
      </Btn>
    </ScrollView>
  );
}

// Pflicht-Auswahl als Chip-Reihe. Nichts ist vorausgewählt — der leere Zustand
// ist gültig, sperrt aber den Submit (kein stiller Default).
function Picker({
  label,
  options,
  selected,
  onSelect,
  disabled,
}: {
  label: string;
  options: { code: string; label: string }[];
  selected: string | null;
  onSelect: (code: string) => void;
  disabled?: boolean;
}) {
  const t = useTheme();
  return (
    <Col gap={8}>
      <Txt v="title">{label}</Txt>
      <Row style={{ flexWrap: "wrap", gap: 8 }}>
        {options.map((o) => {
          const active = o.code === selected;
          return (
            <Pressable
              key={o.code}
              accessibilityRole="button"
              accessibilityState={{ selected: active, disabled }}
              onPress={disabled ? undefined : () => onSelect(o.code)}
            >
              <View
                style={{
                  paddingVertical: 9,
                  paddingHorizontal: 16,
                  borderRadius: t.radius.pill,
                  borderWidth: active ? 0 : 1,
                  borderColor: t.palette.line,
                  backgroundColor: active ? t.palette.ink : t.palette.surface,
                }}
              >
                <Txt v="sm" color={active ? t.palette.bg : t.palette.ink} style={{ fontFamily: t.fonts.semibold }}>
                  {o.label}
                </Txt>
              </View>
            </Pressable>
          );
        })}
      </Row>
    </Col>
  );
}

// Eigenes Konto und Sicherheit (Screen-Name bleibt `HostProfile`: Deep-Link
// `mynextdays://profil` und der Eintrag unter „Mehr" hängen daran).
//
// WAS VORHER HIER STAND: E-Mail, „Rolle: admin" und die rohen
// Berechtigungs-Schlüssel als Chip-Wand („add_meter_reading",
// „manage_billing"). Das war ein Datenabzug, keine Kontoseite — ändern konnte
// man nichts, und die IDs sind interne Schlüssel, die im Dashboard nie so
// erscheinen.
//
// WAS ES JETZT KANN und was bewusst nicht:
//   * Name, Telefon, E-Mail und Passwort ändern. Die E-Mail verlangt das
//     aktuelle Passwort und gilt erst nach dem Doppel-Opt-in an die NEUE
//     Adresse — die App behauptet deshalb nicht, sie sei schon geändert.
//   * Zwei-Faktor: Zustand, TOTP einrichten, Faktor entfernen,
//     Wiederherstellungscodes neu erzeugen.
//   * Geräteverlauf: fremde Sitzungen beenden.
//   * Berechtigungen in benannten Gruppen (`lib/rechte-texte.ts`), nicht als IDs.
//   * NICHT dabei: Betriebsdaten, Nutzerverwaltung, Tarif, Rechnungen,
//     API-Zugang. Das sind Verwaltungsaufgaben des Betriebs, nicht das eigene
//     Konto — sie kommen als eigener Schritt.
//   * WEGGEFALLEN sind die `capabilities` als Chip-Wand. Sie sind die
//     Fähigkeiten der ROLLE; „Rolle: admin" sagt dasselbe in einem Wort. Was
//     bleibt, sind die granularen Berechtigungen — die unterscheiden sich
//     zwischen zwei Nutzern derselben Rolle und sind damit die Auskunft, die
//     jemand hier wirklich sucht.
import { useCallback, useEffect, useState } from "react";
import { Alert, Pressable, ScrollView, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DemoBand } from "@/components/DemoBand";
import { Icon } from "@/components/ui/Icon";
import { KontoLoeschenBlock } from "@/components/KontoLoeschenBlock";
import { RechtlichesBlock } from "@/components/RechtlichesBlock";
import { Avatar, Btn, Chip, Col, Divider, Row, Spinner, Txt } from "@/components/ui/kit";
import { Sheet } from "@/components/ui/patterns";
import { useAuth } from "@/contexts/AuthContext";
import { initialenAus } from "@/lib/initialen";
import {
  andereGeraeteAbmelden,
  faktorEntfernen,
  getKonto,
  getMfaStatus,
  geraetEntfernen,
  listGeraete,
  neueWiederherstellungscodes,
  setzeEmail,
  setzeName,
  setzePasswort,
  setzeProfil,
  type Konto,
  type LoginGeraet,
  type MfaStatus,
} from "@/lib/konto";
import { totpEinrichten, totpBestaetigen } from "@/lib/mfa";
import { RECHTE_GRUPPEN } from "@/lib/rechte-texte";
import { useUnterkante } from "@/lib/unterkante";
import { useTheme } from "@/theme/ThemeProvider";

type Dialog =
  | null
  | "name"
  | "telefon"
  | "email"
  | "passwort"
  | "totp"
  | "codes"
  | "geraete"
  | "rechte";

// Die Rolle in Worten. Roh stand hier „admin" — ein interner Schlüssel, der im
// Dashboard nie so erscheint. Unbekannte Werte werden NICHT geraten, sondern roh
// gezeigt: dann ist erkennbar, dass eine neue Rolle nachzutragen ist (Wurzel 4).
const ROLLE_TEXT: Record<string, string> = {
  admin: "Administrator",
  co_admin: "Co-Administrator",
  owner: "Eigentümer",
  staff: "Mitarbeiter",
  cleaner: "Reinigung",
};

function geraetName(ua: string | null): string {
  if (!ua) return "Unbekanntes Gerät";
  if (/iPhone/i.test(ua)) return "iPhone";
  if (/iPad/i.test(ua)) return "iPad";
  if (/Android/i.test(ua)) return "Android-Gerät";
  if (/Mac/i.test(ua)) return "Mac";
  if (/Windows/i.test(ua)) return "Windows-PC";
  // Kein Ratespiel über die Version: der rohe Wert ist ehrlicher als ein
  // falscher Gerätename.
  return ua.slice(0, 40);
}

function datum(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("de-DE", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
      }) +
        ", " +
        d.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" });
}

export default function HostProfile() {
  const t = useTheme();
  // Unten frei bleiben MUSS die Tab-Leiste (lib/unterkante).
  const unterkante = useUnterkante();
  const insets = useSafeAreaInsets();
  const { logout, reload } = useAuth();

  const [konto, setKonto] = useState<Konto | null>(null);
  const [mfa, setMfa] = useState<MfaStatus | null>(null);
  const [geraete, setGeraete] = useState<LoginGeraet[] | null>(null);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  // Eingaben der Dialoge
  const [name, setName] = useState("");
  const [telefon, setTelefon] = useState("");
  const [email, setEmail] = useState("");
  const [pwAktuell, setPwAktuell] = useState("");
  const [pwNeu, setPwNeu] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [totp, setTotp] = useState<{
    factorId: string;
    secret: string;
    uri: string;
  } | null>(null);
  const [totpCode, setTotpCode] = useState("");

  const laden = useCallback(async () => {
    const [k, m] = await Promise.all([getKonto(), getMfaStatus()]);
    if (k.ok) {
      setKonto(k.data);
      setName(k.data.full_name ?? "");
      setTelefon(k.data.phone ?? "");
      setEmail(k.data.email ?? "");
    } else {
      setFehler(k.error);
    }
    // Der 2FA-Zustand darf fehlen, ohne die Seite zu blockieren — dann steht
    // dort „nicht abrufbar" statt „keine Faktoren" (Wurzel 5).
    setMfa(m.ok ? m.data : null);
  }, []);

  useEffect(() => {
    laden();
  }, [laden]);

  const melde = (res: { ok: boolean; error?: string }, dann?: () => void) => {
    setBusy(false);
    if (!res.ok) {
      Alert.alert("Nicht gespeichert", res.error ?? "Aktion fehlgeschlagen.");
      return false;
    }
    setDialog(null);
    laden();
    reload();
    dann?.();
    return true;
  };

  const geraeteLaden = async () => {
    setDialog("geraete");
    setGeraete(null);
    const res = await listGeraete();
    setGeraete(res.ok ? res.data : []);
    if (!res.ok) setFehler(res.error);
  };

  const totpStarten = async () => {
    setBusy(true);
    setTotpCode("");
    const res = await totpEinrichten();
    setBusy(false);
    if (!res.ok) {
      Alert.alert("Einrichtung nicht möglich", res.error);
      return;
    }
    setTotp(res.data);
    setDialog("totp");
  };

  const totpFertig = async () => {
    if (!totp) return;
    setBusy(true);
    const res = await totpBestaetigen(totp.factorId, totpCode.trim());
    setBusy(false);
    if (!res.ok) {
      Alert.alert("Code nicht angenommen", res.error);
      return;
    }
    setTotp(null);
    setDialog(null);
    laden();
  };

  const codesErzeugen = async () => {
    setBusy(true);
    const res = await neueWiederherstellungscodes();
    setBusy(false);
    if (!res.ok) {
      Alert.alert("Nicht erzeugt", res.error);
      return;
    }
    setCodes(res.data.codes);
    setDialog("codes");
    laden();
  };

  const feld = {
    backgroundColor: t.palette.surface,
    borderWidth: 1,
    borderColor: t.palette.line,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: t.palette.ink,
  } as const;

  const angabe = (label: string, wert: string | null, onPress?: () => void) => (
    <Pressable
      key={label}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => ({
        paddingVertical: 14,
        opacity: pressed && onPress ? 0.6 : 1,
      })}
    >
      <Row style={{ justifyContent: "space-between", gap: 12 }}>
        <Col style={{ flex: 1 }}>
          <Txt v="xs" soft>
            {label}
          </Txt>
          <Txt v="body" numberOfLines={1}>
            {wert || "—"}
          </Txt>
        </Col>
        {onPress && <Icon n="fwd" s={16} sw={2} c={t.palette.faint} />}
      </Row>
      <Divider style={{ marginTop: 12 }} />
    </Pressable>
  );

  if (!konto) {
    return (
      <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
        <DemoBand />
        <Spinner />
        {fehler && (
          <Txt v="sm" color={t.palette.accent} style={{ padding: 24 }}>
            {fehler}
          </Txt>
        )}
      </View>
    );
  }

  const zweiterFaktor = mfa?.factors.filter((f) => f.status === "verified") ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: t.palette.bg, paddingTop: insets.top }}>
      <DemoBand />
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 24,
          paddingTop: 12,
          paddingBottom: unterkante + 24,
          gap: 20,
        }}
      >
        <Txt v="display">Konto</Txt>

        <Row gap={16} style={{ alignItems: "center" }}>
          <Avatar
            s={64}
            src={konto.avatar_url ?? undefined}
            initialen={initialenAus(konto.full_name, konto.email)}
          />
          <Col gap={3} style={{ flex: 1 }}>
            <Txt v="title" numberOfLines={1}>
              {konto.full_name || konto.email || "Konto"}
            </Txt>
            {/* Rolle als ZEILE, nicht als Pille: ein Chip in einer Spalte mit
                `flex: 1` dehnt sich über die ganze Breite und sieht dann aus wie
                ein leeres Eingabefeld — genau so stand hier „admin". */}
            <Txt v="sm" soft numberOfLines={1}>
              {konto.email}
              {konto.role
                ? ` · ${ROLLE_TEXT[konto.role] ?? konto.role}`
                : ""}
            </Txt>
          </Col>
        </Row>

        {/* --- Persönliche Angaben ---------------------------------------- */}
        <Col>
          <Txt v="xs" soft style={{ fontFamily: t.fonts.semibold }}>
            PERSÖNLICH
          </Txt>
          {angabe("Name", konto.full_name, () => setDialog("name"))}
          {angabe("Telefon", konto.phone, () => setDialog("telefon"))}
          {angabe("E-Mail", konto.email, () => setDialog("email"))}
          {/* Ohne Passwort (OAuth-Konto) gibt es nichts zu ändern — dann steht
              das da, statt einen Knopf zu zeigen, der in einen Fehler läuft. */}
          {konto.has_password
            ? angabe("Passwort", "••••••••", () => setDialog("passwort"))
            : angabe("Passwort", "über den Anmeldedienst gesetzt")}
        </Col>

        {/* --- Sicherheit -------------------------------------------------- */}
        <Col>
          <Txt v="xs" soft style={{ fontFamily: t.fonts.semibold }}>
            SICHERHEIT
          </Txt>

          {!mfa ? (
            <Txt v="sm" soft style={{ paddingVertical: 14 }}>
              Zwei-Faktor-Zustand nicht abrufbar.
            </Txt>
          ) : (
            <>
              <View style={{ paddingVertical: 14 }}>
                <Row style={{ justifyContent: "space-between", gap: 12 }}>
                  <Col style={{ flex: 1 }}>
                    <Txt v="body">Zwei-Faktor</Txt>
                    <Txt v="xs" soft>
                      {zweiterFaktor.length
                        ? `${zweiterFaktor.length} Faktor${zweiterFaktor.length > 1 ? "en" : ""} aktiv · Sitzung ${mfa.aal}`
                        : "nicht eingerichtet — freiwillig"}
                    </Txt>
                  </Col>
                  <Chip variant={zweiterFaktor.length ? "on" : ""}>
                    {zweiterFaktor.length ? "aktiv" : "aus"}
                  </Chip>
                </Row>
                <Divider style={{ marginTop: 12 }} />
              </View>

              {zweiterFaktor.map((f) => (
                <View key={f.id} style={{ paddingVertical: 12 }}>
                  <Row style={{ justifyContent: "space-between", gap: 12 }}>
                    <Col style={{ flex: 1 }}>
                      <Txt v="sm">
                        {f.friendly_name ||
                          (f.factor_type === "totp"
                            ? "Authenticator-App"
                            : f.factor_type === "phone"
                              ? "SMS"
                              : f.factor_type)}
                      </Txt>
                      <Txt v="xs" soft>
                        {f.factor_type}
                      </Txt>
                    </Col>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Faktor entfernen"
                      hitSlop={8}
                      onPress={() =>
                        Alert.alert(
                          "Faktor entfernen?",
                          "Danach genügt dein Passwort zum Anmelden.",
                          [
                            { text: "Abbrechen", style: "cancel" },
                            {
                              text: "Entfernen",
                              style: "destructive",
                              onPress: async () => {
                                setBusy(true);
                                melde(await faktorEntfernen(f.id));
                              },
                            },
                          ],
                        )
                      }
                    >
                      <Icon n="x" s={18} sw={2} c={t.palette.soft} />
                    </Pressable>
                  </Row>
                  <Divider style={{ marginTop: 12 }} />
                </View>
              ))}

              <Col gap={8} style={{ paddingTop: 8 }}>
                <Btn variant="outline" block onPress={busy ? undefined : totpStarten}>
                  {zweiterFaktor.length
                    ? "Weiteren Faktor einrichten"
                    : "Zwei-Faktor einrichten"}
                </Btn>
                <Btn
                  variant="ghost"
                  block
                  onPress={busy ? undefined : codesErzeugen}
                >
                  Wiederherstellungscodes ({mfa.recovery_codes_left} übrig)
                </Btn>
              </Col>
            </>
          )}

          <View style={{ height: 8 }} />
          {angabe("Angemeldete Geräte", "Sitzungen verwalten", geraeteLaden)}
          {angabe(
            "Berechtigungen",
            `${konto.permissions.length} Rechte`,
            () => setDialog("rechte"),
          )}
        </Col>

        <Btn variant="ghost" block onPress={logout}>
          Abmelden
        </Btn>


        {/* Rechtliches und Konto-Löschung — beides Voraussetzung für die
            Veröffentlichung im App Store und bei Google Play (Datenschutz-Link
            in der App, Löschweg in der App). Sie stehen NACH dem Abmelden, weil
            sie selten gebraucht werden, aber sie stehen sichtbar da und nicht
            hinter einem weiteren Menü. */}
        <RechtlichesBlock />
        <KontoLoeschenBlock onGeloescht={logout} />
      </ScrollView>

      {/* --- Dialoge ------------------------------------------------------ */}
      <Sheet
        open={dialog === "name"}
        onClose={() => setDialog(null)}
        header={<Txt v="title">Name</Txt>}
      >
        <Col gap={10}>
          <TextInput value={name} onChangeText={setName} style={feld} autoFocus />
          <Btn
            variant="dark"
            block
            onPress={
              busy || !name.trim()
                ? undefined
                : async () => {
                    setBusy(true);
                    melde(await setzeName(name.trim()));
                  }
            }
          >
            {busy ? "Speichert …" : "Speichern"}
          </Btn>
        </Col>
      </Sheet>

      <Sheet
        open={dialog === "telefon"}
        onClose={() => setDialog(null)}
        header={<Txt v="title">Telefon</Txt>}
      >
        <Col gap={10}>
          <TextInput
            value={telefon}
            onChangeText={setTelefon}
            keyboardType="phone-pad"
            style={feld}
            autoFocus
          />
          <Btn
            variant="dark"
            block
            onPress={
              busy
                ? undefined
                : async () => {
                    setBusy(true);
                    // Leeres Feld heisst „keine Nummer" — dafür `null`, nicht
                    // ein leerer String (das Backend unterscheidet das).
                    melde(
                      await setzeProfil({ phone: telefon.trim() || null }),
                    );
                  }
            }
          >
            {busy ? "Speichert …" : "Speichern"}
          </Btn>
        </Col>
      </Sheet>

      <Sheet
        open={dialog === "email"}
        onClose={() => setDialog(null)}
        header={<Txt v="title">E-Mail ändern</Txt>}
      >
        <Col gap={10}>
          <TextInput
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            style={feld}
            placeholder="Neue E-Mail"
            placeholderTextColor={t.palette.faint}
          />
          <TextInput
            value={pwAktuell}
            onChangeText={setPwAktuell}
            secureTextEntry
            style={feld}
            placeholder="Aktuelles Passwort"
            placeholderTextColor={t.palette.faint}
          />
          <Txt v="xs" soft>
            Wir schicken eine Bestätigung an die neue Adresse. Bis du sie
            bestätigst, bleibt die alte gültig.
          </Txt>
          <Btn
            variant="dark"
            block
            onPress={
              busy || !email.trim() || !pwAktuell
                ? undefined
                : async () => {
                    setBusy(true);
                    const res = await setzeEmail(email.trim(), pwAktuell);
                    setPwAktuell("");
                    melde(res, () =>
                      Alert.alert(
                        "Bestätigung unterwegs",
                        "Öffne den Link in der neuen Adresse, dann gilt sie.",
                      ),
                    );
                  }
            }
          >
            {busy ? "Sendet …" : "Bestätigung senden"}
          </Btn>
        </Col>
      </Sheet>

      <Sheet
        open={dialog === "passwort"}
        onClose={() => setDialog(null)}
        header={<Txt v="title">Passwort ändern</Txt>}
      >
        <Col gap={10}>
          <TextInput
            value={pwAktuell}
            onChangeText={setPwAktuell}
            secureTextEntry
            style={feld}
            placeholder="Aktuelles Passwort"
            placeholderTextColor={t.palette.faint}
          />
          <TextInput
            value={pwNeu}
            onChangeText={setPwNeu}
            secureTextEntry
            style={feld}
            placeholder="Neues Passwort (mind. 8 Zeichen)"
            placeholderTextColor={t.palette.faint}
          />
          <Btn
            variant="dark"
            block
            onPress={
              busy || pwNeu.length < 8 || !pwAktuell
                ? undefined
                : async () => {
                    setBusy(true);
                    const res = await setzePasswort(pwNeu, pwAktuell);
                    setPwAktuell("");
                    setPwNeu("");
                    melde(res);
                  }
            }
          >
            {busy ? "Speichert …" : "Passwort ändern"}
          </Btn>
        </Col>
      </Sheet>

      {/* TOTP: auf dem Telefon ist der antippbare otpauth-Link besser als ein
          QR-Code — man kann ihn nicht mit demselben Gerät scannen. */}
      <Sheet
        open={dialog === "totp"}
        onClose={() => {
          setDialog(null);
          setTotp(null);
        }}
        header={<Txt v="title">Authenticator einrichten</Txt>}
      >
        <Col gap={12}>
          <Txt v="sm" soft>
            Öffne deine Authenticator-App mit dem Link oder trage den Schlüssel
            von Hand ein. Danach den Sechser-Code eingeben.
          </Txt>
          {totp && (
            <>
              <Btn
                variant="outline"
                block
                onPress={() => {
                  // Linking öffnet die Authenticator-App direkt. Schlägt es
                  // fehl, bleibt der Schlüssel darunter zum Abtippen.
                  import("react-native").then(({ Linking }) =>
                    Linking.openURL(totp.uri).catch(() =>
                      Alert.alert(
                        "Keine App gefunden",
                        "Trage den Schlüssel von Hand ein.",
                      ),
                    ),
                  );
                }}
              >
                In Authenticator öffnen
              </Btn>
              <Col gap={4}>
                <Txt v="xs" soft>
                  Schlüssel zum Abtippen
                </Txt>
                <Txt v="sm" style={{ fontFamily: t.fonts.semibold }} selectable>
                  {totp.secret}
                </Txt>
              </Col>
            </>
          )}
          <TextInput
            value={totpCode}
            onChangeText={setTotpCode}
            keyboardType="number-pad"
            maxLength={8}
            style={feld}
            placeholder="6-stelliger Code"
            placeholderTextColor={t.palette.faint}
          />
          <Btn
            variant="dark"
            block
            onPress={busy || totpCode.trim().length < 6 ? undefined : totpFertig}
          >
            {busy ? "Prüft …" : "Aktivieren"}
          </Btn>
        </Col>
      </Sheet>

      <Sheet
        open={dialog === "codes"}
        onClose={() => {
          setDialog(null);
          setCodes(null);
        }}
        header={<Txt v="title">Wiederherstellungscodes</Txt>}
      >
        <Col gap={10}>
          <Txt v="sm" soft>
            Jeder Code gilt einmal. Sie erscheinen NUR jetzt — danach sind sie
            nicht mehr lesbar. Alte Codes sind ab sofort ungültig.
          </Txt>
          {codes?.map((c) => (
            <Txt key={c} v="body" selectable style={{ fontFamily: t.fonts.semibold }}>
              {c}
            </Txt>
          ))}
        </Col>
      </Sheet>

      <Sheet
        open={dialog === "geraete"}
        onClose={() => setDialog(null)}
        full
        header={<Txt v="title">Angemeldete Geräte</Txt>}
      >
        {!geraete ? (
          <Spinner />
        ) : (
          <Col>
            {geraete.length === 0 && (
              <Txt v="sm" soft>
                Keine Sitzungen erfasst.
              </Txt>
            )}
            {geraete.map((g) => (
              <View key={g.id} style={{ paddingVertical: 12 }}>
                <Row style={{ justifyContent: "space-between", gap: 12 }}>
                  <Col style={{ flex: 1 }}>
                    <Txt v="sm">{geraetName(g.user_agent)}</Txt>
                    <Txt v="xs" soft>
                      {[g.city, g.country].filter(Boolean).join(", ") || g.ip || "—"}
                      {" · "}
                      {datum(g.last_seen_at)}
                    </Txt>
                  </Col>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Gerät entfernen"
                    hitSlop={8}
                    onPress={async () => {
                      setBusy(true);
                      const res = await geraetEntfernen(g.id);
                      setBusy(false);
                      if (!res.ok) {
                        Alert.alert("Nicht entfernt", res.error);
                        return;
                      }
                      setGeraete((prev) =>
                        (prev ?? []).filter((x) => x.id !== g.id),
                      );
                    }}
                  >
                    <Icon n="x" s={18} sw={2} c={t.palette.soft} />
                  </Pressable>
                </Row>
                <Divider style={{ marginTop: 12 }} />
              </View>
            ))}
            {/* Kein „aktuelles Gerät"-Kennzeichen: der Server liefert es nicht,
                und es zu erraten hiesse, im Zweifel die eigene Sitzung zu
                beenden. Deshalb der eindeutige Sammelweg. */}
            <Btn
              variant="outline"
              block
              onPress={() =>
                Alert.alert(
                  "Andere Sitzungen beenden?",
                  "Alle anderen Geräte werden abgemeldet. Dieses bleibt angemeldet.",
                  [
                    { text: "Abbrechen", style: "cancel" },
                    {
                      text: "Beenden",
                      style: "destructive",
                      onPress: async () => {
                        setBusy(true);
                        const res = await andereGeraeteAbmelden();
                        setBusy(false);
                        if (!res.ok) {
                          Alert.alert("Nicht beendet", res.error);
                          return;
                        }
                        Alert.alert(
                          "Beendet",
                          `${res.data.revoked} Sitzung(en) abgemeldet.`,
                        );
                        geraeteLaden();
                      },
                    },
                  ],
                )
              }
            >
              Andere Sitzungen beenden
            </Btn>
          </Col>
        )}
      </Sheet>

      <Sheet
        open={dialog === "rechte"}
        onClose={() => setDialog(null)}
        full
        header={<Txt v="title">Berechtigungen</Txt>}
      >
        <Col gap={4}>
          <Txt v="sm" soft>
            Was dein Zugang darf. Vergeben wird das im Dashboard.
          </Txt>
          {RECHTE_GRUPPEN.map((gruppe) => {
            const eigene = gruppe.rechte.filter((r) =>
              konto.permissions.includes(r.id),
            );
            if (eigene.length === 0) return null;
            return (
              <Col key={gruppe.titel} gap={2} style={{ marginTop: 14 }}>
                <Txt v="xs" soft style={{ fontFamily: t.fonts.semibold }}>
                  {gruppe.titel.toUpperCase()}
                </Txt>
                {eigene.map((r) => (
                  <View key={r.id} style={{ paddingVertical: 10 }}>
                    <Txt v="sm">{r.label}</Txt>
                    {!!r.hinweis && (
                      <Txt v="xs" soft>
                        {r.hinweis}
                      </Txt>
                    )}
                    <Divider style={{ marginTop: 10 }} />
                  </View>
                ))}
              </Col>
            );
          })}
          {/* Rechte ohne Bezeichnung: lieber die rohe ID zeigen als sie
              verschweigen — dann ist erkennbar, dass die Texte nachzuziehen
              sind (lib/rechte-texte.ts). */}
          {(() => {
            const bekannt = new Set(
              RECHTE_GRUPPEN.flatMap((g) => g.rechte.map((r) => r.id)),
            );
            const rest = konto.permissions.filter((p) => !bekannt.has(p));
            if (rest.length === 0) return null;
            return (
              <Col gap={2} style={{ marginTop: 14 }}>
                <Txt v="xs" soft style={{ fontFamily: t.fonts.semibold }}>
                  WEITERE
                </Txt>
                <Txt v="xs" soft>
                  {rest.join(", ")}
                </Txt>
              </Col>
            );
          })()}
        </Col>
      </Sheet>
    </View>
  );
}

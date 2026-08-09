"use client";

// Zweiter Login-Schritt: Faktor lösen, Faktor wechseln, Wiederherstellungscode.
//
// Seit 0341 läuft das Lösen DIREKT gegen GoTrue (Challenge + Verify im
// Browser). Aus dem Passwort-Schritt liegt eine Session mit `aal1` in den
// Cookies — sie öffnet keine API-Route, taugt aber genau für diese Challenge.
// Die Antwort trägt `aal2` und wird über `sessionUebernehmen` in dieselben
// Cookies geschrieben; erst danach ist die API offen.
//
// Welche Faktoren angeboten werden, sagt AUSSCHLIESSLICH der Server
// (`mfa_methods` aus /auth/login, GoTrue-Typen: totp | phone | webauthn).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";
import { Label } from "@nextdays/ui/label";
import { OtpInput } from "@/components/konto/otp-input";
import { loginMitWiederherstellungscode, sessionUebernehmen } from "@/lib/auth";
import {
  faktorLoesen,
  faktorenDerSitzung,
  passkeyAnmeldenMitSession,
  smsLoginCodeAnfordern,
} from "@/lib/mfa-login";

type Weg = "totp" | "phone" | "webauthn" | "recovery";

export function ZweiterFaktorSchritt({
  methods,
  phoneMasked,
  onErfolg,
  onAbbruch,
}: {
  /** Faktortypen des Kontos, vom Server gemeldet. */
  methods: string[];
  phoneMasked: string | null;
  onErfolg: () => void;
  onAbbruch: () => void;
}) {
  const t = useTranslations("auth.twoFactor");
  const hatTotp = methods.includes("totp");
  const hatSms = methods.includes("phone");
  const hatPasskey = methods.includes("webauthn");

  // Startweg: Passkey zuerst (ein Klick, phishing-resistent), sonst TOTP,
  // sonst SMS. Ohne jede Angabe bleibt der Wiederherstellungscode.
  const [weg, setWeg] = useState<Weg>(
    hatPasskey ? "webauthn" : hatTotp ? "totp" : hatSms ? "phone" : "recovery",
  );
  const [code, setCode] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [hinweis, setHinweis] = useState<string | null>(null);
  // factor_id je Typ — für Challenge/Verify nötig, kommt aus der Sitzung.
  const [faktorIds, setFaktorIds] = useState<Record<string, string>>({});
  const [smsAngefordert, setSmsAngefordert] = useState(false);

  // Die factor_ids einmal aus der aal1-Sitzung holen.
  useEffect(() => {
    let abgebrochen = false;
    (async () => {
      const res = await faktorenDerSitzung();
      if (abgebrochen) return;
      if (res.ok) setFaktorIds(res.data);
      else setFehler(res.error);
    })();
    return () => {
      abgebrochen = true;
    };
  }, []);

  /** Nach erfolgreicher Challenge: aal2-Session in die Cookies übernehmen. */
  const uebernehmen = useCallback(
    async (session: {
      access_token: string;
      refresh_token: string;
      expires_in: number;
    }) => {
      const res = await sessionUebernehmen(session);
      if (!res.ok) {
        setBusy(false);
        setFehler(res.error);
        return;
      }
      onErfolg();
    },
    [onErfolg],
  );

  const codeEinloesen = useCallback(
    async (wert: string, alsWeg: Weg) => {
      if (!wert.trim()) return;
      const factorId = faktorIds[alsWeg];
      if (!factorId) {
        setFehler(t("factorMissing"));
        return;
      }
      setBusy(true);
      setFehler(null);
      const res = await faktorLoesen(factorId, wert.trim());
      if (!res.ok) {
        setBusy(false);
        setFehler(res.error);
        setCode("");
        return;
      }
      await uebernehmen(res.data);
    },
    [faktorIds, t, uebernehmen],
  );

  async function passkeyLoesen() {
    const factorId = faktorIds.webauthn;
    if (!factorId) {
      setFehler(t("factorMissing"));
      return;
    }
    setBusy(true);
    setFehler(null);
    const res = await passkeyAnmeldenMitSession(factorId);
    if (!res.ok) {
      setBusy(false);
      setFehler(res.error);
      return;
    }
    await uebernehmen(res.data);
  }

  async function smsAnfordern() {
    const factorId = faktorIds.phone;
    if (!factorId) {
      setFehler(t("factorMissing"));
      return;
    }
    setBusy(true);
    setFehler(null);
    const res = await smsLoginCodeAnfordern(factorId);
    setBusy(false);
    if (!res.ok) {
      setFehler(res.error);
      return;
    }
    setSmsAngefordert(true);
    setHinweis(t("smsSent"));
  }

  async function recoveryEinloesen() {
    setBusy(true);
    setFehler(null);
    const res = await loginMitWiederherstellungscode(recoveryCode.trim());
    setBusy(false);
    if (!res.ok) {
      setFehler(res.error);
      setRecoveryCode("");
      return;
    }
    // Der Code ist verbraucht, aber er stellt KEINE Session aus (Endpunkt
    // antwortet 204). Ohne aal2 bleibt die API zu — der Nutzer erfährt das
    // hier ehrlich, statt in eine Schleife zu laufen.
    setHinweis(t("recoveryRedeemedHint"));
  }

  function wechsle(neu: Weg) {
    setWeg(neu);
    setCode("");
    setRecoveryCode("");
    setFehler(null);
    setHinweis(null);
    setSmsAngefordert(false);
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-5">
      <h1 className="text-center font-display text-3xl font-extrabold">
        {t("title")}
      </h1>

      {weg === "webauthn" && (
        <>
          <p className="text-center text-sm text-muted-foreground">
            {t("passkeyHint")}
          </p>
          <Button type="button" onClick={passkeyLoesen} disabled={busy}>
            <Icon icon="ph:fingerprint" className="size-4" aria-hidden />
            {busy ? t("checking") : t("passkeyUse")}
          </Button>
        </>
      )}

      {weg === "phone" && (
        <>
          <p className="text-center text-sm text-muted-foreground">
            {phoneMasked
              ? t("smsHintWithPhone", { phone: phoneMasked })
              : t("smsHint")}
          </p>
          {smsAngefordert ? (
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                codeEinloesen(code, "phone");
              }}
            >
              <OtpInput
                label={t("codeLabel")}
                value={code}
                onChange={setCode}
                error={fehler}
                disabled={busy}
                autoFocus
                onComplete={(wert) => codeEinloesen(wert, "phone")}
              />
              <Button type="submit" disabled={busy || code.length < 6}>
                {busy ? t("checking") : t("confirm")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={smsAnfordern}
                disabled={busy}
              >
                {t("resend")}
              </Button>
            </form>
          ) : (
            <Button type="button" onClick={smsAnfordern} disabled={busy}>
              {busy ? t("sending") : t("sendCode")}
            </Button>
          )}
        </>
      )}

      {weg === "totp" && (
        <>
          <p className="text-center text-sm text-muted-foreground">
            {t("totpHint")}
          </p>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              codeEinloesen(code, "totp");
            }}
          >
            <OtpInput
              label={t("codeLabel")}
              value={code}
              onChange={setCode}
              error={fehler}
              disabled={busy}
              autoFocus
              onComplete={(wert) => codeEinloesen(wert, "totp")}
            />
            <Button type="submit" disabled={busy || code.length < 6}>
              {busy ? t("checking") : t("confirm")}
            </Button>
          </form>
        </>
      )}

      {weg === "recovery" && (
        <>
          <p className="text-center text-sm text-muted-foreground">
            {t("recoveryHint")}
          </p>
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              recoveryEinloesen();
            }}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="recovery-code">{t("recoveryLabel")}</Label>
              <Input
                id="recovery-code"
                value={recoveryCode}
                onChange={(e) => setRecoveryCode(e.target.value)}
                autoComplete="one-time-code"
                autoFocus
                required
                aria-describedby="zweiter-faktor-fehler"
                aria-invalid={fehler ? true : undefined}
                className="font-mono"
              />
              <span className="text-xs text-muted-foreground">
                {t("recoverySingleUse")}
              </span>
            </div>
            <Button type="submit" disabled={busy || !recoveryCode.trim()}>
              {busy ? t("checking") : t("confirm")}
            </Button>
          </form>
        </>
      )}

      {/* Fehler und Hinweise: eine Live-Region, die immer im DOM steht. */}
      <p
        id="zweiter-faktor-fehler"
        role="alert"
        aria-live="assertive"
        className="min-h-5 text-center text-sm text-destructive"
      >
        {weg === "totp" || (weg === "phone" && smsAngefordert) ? "" : (fehler ?? "")}
      </p>
      {hinweis && (
        <p role="status" aria-live="polite" className="text-center text-sm">
          {hinweis}
        </p>
      )}

      {/* Anderen Faktor verwenden — nur echte Alternativen anbieten. */}
      <div className="flex flex-col gap-2">
        {weg !== "webauthn" && hatPasskey && (
          <WechselKnopf
            icon="ph:fingerprint"
            label={t("usePasskey")}
            onClick={() => wechsle("webauthn")}
          />
        )}
        {weg !== "totp" && hatTotp && (
          <WechselKnopf
            icon="ph:device-mobile"
            label={t("useTotp")}
            onClick={() => wechsle("totp")}
          />
        )}
        {weg !== "phone" && hatSms && (
          <WechselKnopf
            icon="ph:chat-circle-text"
            label={t("useSms")}
            onClick={() => wechsle("phone")}
          />
        )}
        {weg !== "recovery" && (
          <WechselKnopf
            icon="ph:key"
            label={t("useRecovery")}
            onClick={() => wechsle("recovery")}
          />
        )}
      </div>

      <button
        type="button"
        onClick={onAbbruch}
        className="text-center text-sm font-medium text-accent hover:underline"
      >
        {t("backToLogin")}
      </button>
    </div>
  );
}

function WechselKnopf({
  icon,
  label,
  onClick,
}: {
  icon: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center gap-2 text-sm font-medium text-accent hover:underline"
    >
      <Icon icon={icon} className="size-4" aria-hidden />
      {label}
    </button>
  );
}

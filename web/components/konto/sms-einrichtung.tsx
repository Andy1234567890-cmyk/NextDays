"use client";

// Assistent „SMS-Code" — GoTrue-nativ (0341), drei Schritte:
//   1. Faktor mit der Nummer anlegen (unverifiziert)
//   2. Challenge auslösen → GoTrue verschickt die SMS
//   3. Code prüfen → Faktor ist verifiziert
//
// E.164 wird vorab geprüft, damit der Nutzer den Fehler sofort sieht statt
// erst aus GoTrues Antwort. Es wird KEINE Vorwahl erraten: fehlt das führende
// „+", ist das ein Fehler (Wurzel 4).
//
// Der SIM-Swapping-Hinweis steht VOR der Eingabe: die Wahl des Faktors soll
// informiert getroffen werden.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";
import { Label } from "@nextdays/ui/label";
import {
  smsCodeAnfordern,
  smsCodeBestaetigen,
  smsEnrollen,
} from "@/lib/mfa-client";

import { EinrichtungShell } from "./einrichtung-shell";
import { OtpInput } from "./otp-input";

const E164 = /^\+[1-9]\d{7,14}$/;

export function SmsEinrichtung({
  open,
  onClose,
  onFertig,
}: {
  open: boolean;
  onClose: () => void;
  onFertig: () => void;
}) {
  const t = useTranslations("account.security.twoFactor.sms");
  const [schritt, setSchritt] = useState<"nummer" | "code">("nummer");
  const [nummer, setNummer] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);

  useEffect(() => {
    if (open) return;
    setSchritt("nummer");
    setNummer("");
    setCode("");
    setFehler(null);
    setBusy(false);
    setFactorId(null);
    setChallengeId(null);
  }, [open]);

  async function codeAnfordern() {
    setFehler(null);
    const wert = nummer.trim();
    if (!E164.test(wert)) {
      setFehler(t("invalidNumber"));
      return;
    }
    setBusy(true);
    try {
      // Faktor anlegen (nur beim ersten Mal) …
      let id = factorId;
      if (!id) {
        const enroll = await smsEnrollen(t("friendlyName"), wert);
        if (!enroll.ok) {
          setFehler(enroll.error);
          return;
        }
        id = enroll.data.factorId;
        setFactorId(id);
      }
      // … und die Challenge auslösen, die die SMS verschickt.
      const ch = await smsCodeAnfordern(id);
      if (!ch.ok) {
        setFehler(ch.error);
        return;
      }
      setChallengeId(ch.data.challengeId);
      setSchritt("code");
    } finally {
      // Wurzel 5: Ladezustand endet auf JEDEM Pfad, auch bei einem Wurf.
      setBusy(false);
    }
  }

  const bestaetigen = useCallback(
    async (eingabe: string) => {
      if (!factorId || !challengeId) return;
      setBusy(true);
      setFehler(null);
      try {
        const res = await smsCodeBestaetigen(factorId, challengeId, eingabe);
        if (!res.ok) {
          setFehler(res.error);
          setCode("");
          return;
        }
        onFertig();
        onClose();
      } finally {
        // Wurzel 5: Ladezustand endet auf JEDEM Pfad, auch bei einem Wurf.
        setBusy(false);
      }
    },
    [challengeId, factorId, onClose, onFertig],
  );

  async function erneutSenden() {
    if (!factorId) return;
    setFehler(null);
    setBusy(true);
    let ch;
    try {
      ch = await smsCodeAnfordern(factorId);
    } finally {
      // Wurzel 5: Ladezustand endet auf JEDEM Pfad, auch bei einem Wurf.
      setBusy(false);
    }
    if (!ch.ok) {
      setFehler(ch.error);
      return;
    }
    // Neue Challenge — die alte ist damit gegenstandslos.
    setChallengeId(ch.data.challengeId);
  }

  return (
    <EinrichtungShell
      open={open}
      onClose={onClose}
      title={t("setupTitle")}
      description={schritt === "nummer" ? t("setupHint") : undefined}
    >
      {schritt === "nummer" ? (
        <>
          <div
            className="flex items-start gap-2 rounded-(--radius) border border-border bg-secondary p-3"
            role="note"
          >
            <Icon icon="ph:warning-circle" className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p className="text-sm">{t("simSwapWarning")}</p>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sms-nummer">{t("numberLabel")}</Label>
            <Input
              id="sms-nummer"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+49 …"
              value={nummer}
              onChange={(e) => setNummer(e.target.value)}
              aria-describedby="sms-nummer-hinweis sms-nummer-fehler"
              aria-invalid={fehler ? true : undefined}
            />
            <span id="sms-nummer-hinweis" className="text-xs text-muted-foreground">
              {t("numberHint")}
            </span>
            <p
              id="sms-nummer-fehler"
              role="alert"
              aria-live="assertive"
              className="min-h-5 text-sm text-destructive"
            >
              {fehler ?? ""}
            </p>
          </div>

          <Button type="button" onClick={codeAnfordern} disabled={busy || !nummer.trim()}>
            {busy ? t("sending") : t("sendCode")}
          </Button>
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {t("codeSentTo", { phone: nummer.trim() })}
          </p>
          <OtpInput
            label={t("codeLabel")}
            value={code}
            onChange={setCode}
            error={fehler}
            disabled={busy}
            onComplete={bestaetigen}
            autoFocus
          />
          <Button
            type="button"
            onClick={() => bestaetigen(code)}
            disabled={busy || code.length < 6}
          >
            {busy ? t("checking") : t("confirm")}
          </Button>
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={erneutSenden}
              disabled={busy}
            >
              {t("resend")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setSchritt("nummer");
                setCode("");
                setFehler(null);
              }}
            >
              {t("changeNumber")}
            </Button>
          </div>
        </>
      )}
    </EinrichtungShell>
  );
}

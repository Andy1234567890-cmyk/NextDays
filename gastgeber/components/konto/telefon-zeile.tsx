"use client";

// Telefonnummer mit SMS-Verifizierung (Airbnb-„Confirm account"). Zweistufig:
//   1. Nummer eingeben → „Code senden" (POST /auth/phone/send-code, echte SMS)
//   2. 6-stelligen SMS-Code eingeben → „Bestätigen" (POST /auth/phone/verify)
// Danach ist die Nummer verifiziert (phone_verified_at) — echter Status, kein
// Fake. Zeigt bei bereits verifizierter Nummer den grünen Haken.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";

import type { Account } from "@/lib/konto";
import { sendPhoneCode, verifyPhoneCode } from "@/lib/konto-actions";

import { KontoZeile } from "./konto-zeile";

type Phase = "idle" | "nummer" | "code";

export function TelefonZeile({
  account,
  offen,
  dimmed,
  onOpen,
  onClose,
}: {
  account: Account;
  offen: boolean;
  dimmed: boolean;
  onOpen: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("konto");
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("nummer");
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [phone, setPhone] = useState(account.phone ?? "");
  const [code, setCode] = useState("");

  const verifiziert = !!account.phone_verified_at;

  function schliessen() {
    setPhase("nummer");
    setFehler(null);
    setCode("");
    onClose();
  }

  async function codeSenden() {
    setBusy(true);
    setFehler(null);
    const res = await sendPhoneCode(phone.trim());
    setBusy(false);
    if (res.ok) {
      setPhase("code");
    } else {
      setFehler(res.error);
    }
  }

  async function bestaetigen() {
    setBusy(true);
    setFehler(null);
    const res = await verifyPhoneCode(phone.trim(), code.trim());
    setBusy(false);
    if (res.ok) {
      schliessen();
      router.refresh();
    } else {
      setFehler(res.error);
    }
  }

  return (
    <KontoZeile
      label={t("telefon")}
      value={
        <span className="flex flex-col gap-1">
          <span>{account.phone || t("nichtAngegeben")}</span>
          {account.phone && (
            <span
              className={`inline-flex items-center gap-1.5 text-sm ${
                verifiziert ? "text-emerald-700" : "text-muted-foreground"
              }`}
            >
              <Icon
                icon={
                  verifiziert
                    ? "solar:verified-check-bold"
                    : "solar:shield-cross-line-duotone"
                }
                className="size-4"
              />
              {verifiziert ? t("telefonVerifiziert") : t("telefonUnverifiziert")}
            </span>
          )}
        </span>
      }
      hint={t("telefonHinweis")}
      hasValue={!!account.phone}
      open={offen}
      dimmed={dimmed}
      onOpen={onOpen}
      onClose={schliessen}
    >
      {phase === "nummer" ? (
        <div className="max-w-lg space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium">
              {t("telefonNummerLabel")}
            </label>
            <Input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={busy}
              placeholder="+49…"
              autoFocus
            />
          </div>
          {fehler && <p className="text-sm text-destructive">{fehler}</p>}
          <div className="flex items-center gap-3">
            <Button
              type="button"
              onClick={codeSenden}
              disabled={busy || !/^\+[1-9]\d{7,14}$/.test(phone.trim())}
            >
              {t("telefonCodeSenden")}
            </Button>
            <button
              type="button"
              onClick={schliessen}
              disabled={busy}
              className="text-sm font-medium underline underline-offset-2 hover:opacity-70"
            >
              {t("abbrechen")}
            </button>
          </div>
        </div>
      ) : (
        <div className="max-w-lg space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("telefonCodeGesendet", { phone: phone.trim() })}
          </p>
          <div>
            <label className="mb-1 block text-sm font-medium">
              {t("telefonCodeLabel")}
            </label>
            <Input
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              disabled={busy}
              maxLength={6}
              autoFocus
            />
          </div>
          {fehler && <p className="text-sm text-destructive">{fehler}</p>}
          <div className="flex items-center gap-3">
            <Button
              type="button"
              onClick={bestaetigen}
              disabled={busy || code.length < 6}
            >
              {t("telefonCodePruefen")}
            </Button>
            <button
              type="button"
              onClick={codeSenden}
              disabled={busy}
              className="text-sm font-medium underline underline-offset-2 hover:opacity-70"
            >
              {t("telefonNeuSenden")}
            </button>
          </div>
        </div>
      )}
    </KontoZeile>
  );
}

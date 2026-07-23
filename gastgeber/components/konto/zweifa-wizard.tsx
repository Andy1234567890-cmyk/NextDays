"use client";

// Zwei-Faktor-Wizard im Airbnb-Muster (Vollbild, mehrstufig):
//   intro → nummer (Confirm account) → code (6 Kästchen) → fertig
// Aktiviert SMS-2FA über die echte Nummern-Verifizierung (phone/send-code +
// phone/verify). Kein PIN/Sicherheitsfragen (bewusst, Plan). Nach Erfolg ist
// die Nummer verifiziert und SMS-2FA aktiv.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";

import { sendPhoneCode, verifyPhoneCode } from "@/lib/konto-actions";

import { CodeEingabe } from "./code-eingabe";

type Step = "intro" | "nummer" | "code" | "fertig";

export function ZweiFaWizard({ initialPhone }: { initialPhone: string | null }) {
  const t = useTranslations("zweifa");
  const router = useRouter();
  const [step, setStep] = useState<Step>("intro");
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [phone, setPhone] = useState(initialPhone ?? "");
  const [code, setCode] = useState("");

  const gueltigeNummer = /^\+[1-9]\d{7,14}$/.test(phone.trim());

  async function codeSenden() {
    setBusy(true);
    setFehler(null);
    const res = await sendPhoneCode(phone.trim());
    setBusy(false);
    if (res.ok) {
      setCode("");
      setStep("code");
    } else {
      setFehler(res.error);
    }
  }

  async function bestaetigen(c: string) {
    setBusy(true);
    setFehler(null);
    const res = await verifyPhoneCode(phone.trim(), c);
    setBusy(false);
    if (res.ok) {
      setStep("fertig");
    } else {
      setFehler(res.error);
    }
  }

  function schliessen() {
    router.push("/konto?bereich=sicherheit");
    router.refresh();
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col justify-center px-6 py-12">
      {step === "intro" && (
        <div>
          <BuchIcon />
          <h1 className="mt-8 font-display text-3xl font-bold tracking-tight">
            {t("introTitel")}
          </h1>
          <p className="mt-4 text-[0.9375rem] leading-relaxed text-muted-foreground">
            {t("introText")}
          </p>
          <div className="mt-8 border-t border-border pt-6">
            <Button type="button" onClick={() => setStep("nummer")}>
              {t("weiter")}
            </Button>
          </div>
        </div>
      )}

      {step === "nummer" && (
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {t("nummerTitel")}
          </h1>
          <p className="mt-2 text-[0.9375rem] text-muted-foreground">
            {t("nummerText")}
          </p>
          <div className="mt-6">
            <label className="mb-1 block text-sm font-medium">
              {t("nummerLabel")}
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
          {fehler && <p className="mt-3 text-sm text-destructive">{fehler}</p>}
          <div className="mt-6 flex items-center gap-3">
            <Button
              type="button"
              onClick={codeSenden}
              disabled={busy || !gueltigeNummer}
            >
              {t("codeSenden")}
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
      )}

      {step === "code" && (
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {t("codeTitel")}
          </h1>
          <p className="mt-2 text-[0.9375rem] text-muted-foreground">
            {t("codeText", { phone: phone.trim() })}
          </p>
          <div className="mt-6">
            <CodeEingabe
              onChange={setCode}
              onComplete={bestaetigen}
              disabled={busy}
            />
          </div>
          {fehler && <p className="mt-3 text-sm text-destructive">{fehler}</p>}
          <div className="mt-6 flex items-center gap-3">
            <Button
              type="button"
              onClick={() => bestaetigen(code)}
              disabled={busy || code.length < 6}
            >
              {t("bestaetigen")}
            </Button>
            <button
              type="button"
              onClick={codeSenden}
              disabled={busy}
              className="text-sm font-medium underline underline-offset-2 hover:opacity-70"
            >
              {t("erneutSenden")}
            </button>
          </div>
        </div>
      )}

      {step === "fertig" && (
        <div>
          <span className="flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <Icon icon="solar:verified-check-bold" className="size-8" />
          </span>
          <h1 className="mt-6 font-display text-2xl font-bold tracking-tight">
            {t("fertigTitel")}
          </h1>
          <p className="mt-2 text-[0.9375rem] text-muted-foreground">
            {t("fertigText")}
          </p>
          <div className="mt-8">
            <Button type="button" onClick={schliessen}>
              {t("fertig")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// Airbnb-Buch/Schloss-Anmutung (dezent, theme-fest).
function BuchIcon() {
  return (
    <span className="flex size-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-500">
      <Icon icon="solar:lock-keyhole-bold-duotone" className="size-8" />
    </span>
  );
}

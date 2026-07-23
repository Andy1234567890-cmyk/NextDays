"use client";

// Zwei-Faktor-Authentisierung (TOTP) — echter Enroll-Flow über das Backend:
//   1. „Einrichten" → /totp/enroll liefert Secret + fertigen QR-Code
//   2. QR scannen, 6-stelligen Code eingeben → /totp/verify aktiviert 2FA und
//      gibt EINMALIG die Recovery-Codes zurück
//   3. Recovery-Codes anzeigen → „Fertig"
// Deaktivieren verlangt einen aktuellen Code (Re-Auth, Wurzel 7). Kein Fake:
// der Status kommt aus account.totp_enabled.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";

import {
  type TotpEnroll,
  totpDisable,
  totpEnroll,
  totpVerify,
} from "@/lib/konto-actions";

type Phase = "idle" | "enroll" | "recovery" | "disable";

export function ZweiFaZeile({ enabled }: { enabled: boolean }) {
  const t = useTranslations("konto");
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("idle");
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [enroll, setEnroll] = useState<TotpEnroll | null>(null);
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState<string[]>([]);

  function reset() {
    setPhase("idle");
    setBusy(false);
    setFehler(null);
    setEnroll(null);
    setCode("");
  }

  async function starten() {
    setBusy(true);
    setFehler(null);
    const res = await totpEnroll();
    setBusy(false);
    if (res.ok) {
      setEnroll(res.data);
      setPhase("enroll");
    } else {
      setFehler(res.error);
    }
  }

  async function aktivieren() {
    setBusy(true);
    setFehler(null);
    const res = await totpVerify(code.trim());
    setBusy(false);
    if (res.ok) {
      setRecovery(res.recoveryCodes);
      setCode("");
      setPhase("recovery");
    } else {
      setFehler(res.error);
    }
  }

  async function deaktivieren() {
    setBusy(true);
    setFehler(null);
    const res = await totpDisable(code.trim());
    setBusy(false);
    if (res.ok) {
      reset();
      router.refresh();
    } else {
      setFehler(res.error);
    }
  }

  function fertig() {
    reset();
    router.refresh();
  }

  return (
    <div className="border-b border-border py-6">
      <div className="flex items-start justify-between gap-4">
        <p className="font-medium">{t("zweiFaktor")}</p>
        {phase === "idle" && !enabled && (
          <button
            type="button"
            onClick={starten}
            disabled={busy}
            className="shrink-0 text-sm font-medium underline underline-offset-2 hover:opacity-70 disabled:opacity-60"
          >
            {busy ? "…" : t("zweiFaEinrichten")}
          </button>
        )}
        {phase === "idle" && enabled && (
          <button
            type="button"
            onClick={() => setPhase("disable")}
            className="shrink-0 text-sm font-medium text-destructive underline underline-offset-2 hover:opacity-70"
          >
            {t("zweiFaDeaktivieren")}
          </button>
        )}
      </div>

      {phase === "idle" && (
        <p
          className={`mt-1 inline-flex items-center gap-1.5 text-[0.9375rem] ${
            enabled ? "text-emerald-700" : "text-muted-foreground"
          }`}
        >
          <Icon
            icon={enabled ? "solar:shield-check-bold" : "solar:shield-cross-line-duotone"}
            className="size-4"
          />
          {enabled ? t("zweiFaAn") : t("zweiFaAus")}
        </p>
      )}

      {/* Schritt 1+2: QR scannen + Code eingeben */}
      {phase === "enroll" && enroll && (
        <div className="mt-4 max-w-lg space-y-4">
          <p className="text-sm text-muted-foreground">{t("zweiFaSchritt1")}</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={enroll.qr_data_url}
            alt="QR-Code"
            className="size-44 rounded-xl border border-border bg-white p-2"
          />
          <div className="text-sm text-muted-foreground">
            {t("zweiFaManuell")}
            <code className="mt-1 block break-all rounded-lg bg-muted px-3 py-2 font-mono text-xs text-foreground">
              {enroll.secret}
            </code>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              {t("zweiFaCodeLabel")}
            </label>
            <Input
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              disabled={busy}
              maxLength={8}
              autoFocus
            />
          </div>
          {fehler && <p className="text-sm text-destructive">{fehler}</p>}
          <div className="flex items-center gap-3">
            <Button
              type="button"
              onClick={aktivieren}
              disabled={busy || code.length < 6}
            >
              {t("zweiFaAktivieren")}
            </Button>
            <button
              type="button"
              onClick={reset}
              disabled={busy}
              className="text-sm font-medium underline underline-offset-2 hover:opacity-70"
            >
              {t("abbrechen")}
            </button>
          </div>
        </div>
      )}

      {/* Schritt 3: Recovery-Codes (einmalig) */}
      {phase === "recovery" && (
        <div className="mt-4 max-w-lg space-y-4">
          <div className="rounded-xl bg-amber-50 p-4 text-amber-900">
            <p className="font-semibold">{t("zweiFaRecoveryTitel")}</p>
            <p className="mt-1 text-sm">{t("zweiFaRecoveryText")}</p>
          </div>
          <ul className="grid grid-cols-2 gap-2 rounded-xl border border-border p-4 font-mono text-sm">
            {recovery.map((c) => (
              <li key={c} className="tabular-nums">
                {c}
              </li>
            ))}
          </ul>
          <Button type="button" onClick={fertig}>
            {t("zweiFaFertig")}
          </Button>
        </div>
      )}

      {/* Deaktivieren: Code verlangen (Re-Auth) */}
      {phase === "disable" && (
        <div className="mt-4 max-w-lg space-y-4">
          <label className="block text-sm font-medium">
            {t("zweiFaCodeLabel")}
          </label>
          <Input
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            disabled={busy}
            maxLength={8}
            autoFocus
          />
          {fehler && <p className="text-sm text-destructive">{fehler}</p>}
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="destructive"
              onClick={deaktivieren}
              disabled={busy || code.length < 6}
            >
              {t("zweiFaDeaktivieren")}
            </Button>
            <button
              type="button"
              onClick={reset}
              disabled={busy}
              className="text-sm font-medium underline underline-offset-2 hover:opacity-70"
            >
              {t("abbrechen")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

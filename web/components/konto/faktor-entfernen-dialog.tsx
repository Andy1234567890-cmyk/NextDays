"use client";

// Faktor entfernen (`DELETE /auth/mfa/factors/{factor_id}`).
//
// Re-Auth: Passwort ODER ein aal2-Token — welche der beiden reicht, entscheidet
// der Server. Reine OAuth-Konten (Google) haben kein Passwort; dort entfällt
// das Feld.
//
// AUSSPERR-SCHUTZ liegt im Backend, nicht hier: Der letzte Faktor eines
// Pflicht-Kontos lässt sich nur entfernen, wenn noch Wiederherstellungscodes
// übrig sind — sonst 409. Diese Regel wird bewusst NICHT im Frontend
// nachgebaut (das wäre eine zweite Wahrheit); der Dialog zeigt die
// Server-Antwort und erklärt in dem Fall den Ausweg.
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";
import { Label } from "@nextdays/ui/label";
import { type MfaFactor, deleteMfaFactor } from "@/lib/mfa";

import { EinrichtungShell } from "./einrichtung-shell";

export function FaktorEntfernenDialog({
  faktor,
  hatPasswort,
  onClose,
  onFertig,
}: {
  faktor: MfaFactor | null;
  hatPasswort: boolean;
  onClose: () => void;
  onFertig: () => void;
}) {
  const t = useTranslations("account.security.twoFactor.removeDialog");
  const [passwort, setPasswort] = useState("");
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  // 409 = letzter Faktor ohne Wiederherstellungscodes. Eigener Hinweis, weil
  // der Nutzer hier einen konkreten Ausweg braucht, keine reine Fehlermeldung.
  const [letzterFaktor, setLetzterFaktor] = useState(false);

  useEffect(() => {
    setPasswort("");
    setFehler(null);
    setBusy(false);
    setLetzterFaktor(false);
  }, [faktor]);

  async function entfernen() {
    if (!faktor) return;
    setBusy(true);
    setFehler(null);
    setLetzterFaktor(false);
    let res;
    try {
      res = await deleteMfaFactor(faktor.id, passwort || undefined);
    } finally {
      // Wurzel 5: Ladezustand endet auf JEDEM Pfad, auch bei einem Wurf.
      setBusy(false);
    }
    if (!res.ok) {
      if (res.status === 409) {
        setLetzterFaktor(true);
        return;
      }
      setFehler(res.error);
      return;
    }
    onFertig();
    onClose();
  }

  const titel =
    faktor?.factor_type === "webauthn"
      ? t("passkeyTitle")
      : faktor?.factor_type === "phone"
        ? t("smsTitle")
        : t("totpTitle");

  return (
    <EinrichtungShell
      open={faktor !== null}
      onClose={onClose}
      title={titel}
      description={t("hint")}
    >
      <div
        className="rounded-(--radius) border border-destructive/40 bg-destructive/5 p-3"
        role="note"
      >
        <p className="text-sm text-destructive">{t("warning")}</p>
      </div>

      {letzterFaktor && (
        <div
          className="rounded-(--radius) border border-border bg-secondary p-3"
          role="note"
        >
          <p className="text-sm">{t("lastFactorBlocked")}</p>
        </div>
      )}

      {hatPasswort && (
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="entfernen-pw">{t("passwordLabel")}</Label>
          <Input
            id="entfernen-pw"
            type="password"
            autoComplete="current-password"
            value={passwort}
            onChange={(e) => setPasswort(e.target.value)}
            aria-describedby="entfernen-fehler"
            aria-invalid={fehler ? true : undefined}
          />
        </div>
      )}

      <p
        id="entfernen-fehler"
        role="alert"
        aria-live="assertive"
        className="min-h-5 text-sm text-destructive"
      >
        {fehler ?? ""}
      </p>

      <Button
        type="button"
        variant="destructive"
        onClick={entfernen}
        disabled={busy}
      >
        {busy ? t("removing") : t("remove")}
      </Button>
      <Button type="button" variant="ghost" onClick={onClose} disabled={busy}>
        {t("cancel")}
      </Button>
    </EinrichtungShell>
  );
}

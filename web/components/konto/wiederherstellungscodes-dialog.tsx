"use client";

// Wiederherstellungscodes erzeugen (`POST /auth/mfa/recovery-codes`).
//
// Der Endpunkt ERSETZT immer alle alten Codes — es gibt kein „nachlegen".
// Wer schon welche hat, bekommt deshalb vorher eine klare Warnung, dass die
// bisherigen ungültig werden.
//
// Re-Auth: Passwort ODER ein aal2-Token. Weil die Sicherheits-Seite ohnehin nur
// mit aal2 erreichbar ist (der Guard lässt aal1 nicht durch), reicht dort
// meistens das Token allein. Das Passwortfeld steht trotzdem bereit, weil der
// Server entscheidet, was er verlangt — und ein 401 wegen fehlender Re-Auth
// soll den Nutzer nicht ratlos lassen.
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";
import { Label } from "@nextdays/ui/label";
import { createRecoveryCodes } from "@/lib/mfa";

import { EinrichtungShell } from "./einrichtung-shell";
import { Wiederherstellungscodes } from "./wiederherstellungscodes";

export function WiederherstellungscodesDialog({
  open,
  hatPasswort,
  hatBereitsCodes,
  onClose,
  onFertig,
}: {
  open: boolean;
  hatPasswort: boolean;
  hatBereitsCodes: boolean;
  onClose: () => void;
  onFertig: () => void;
}) {
  const t = useTranslations("account.security.twoFactor.recovery");
  const [passwort, setPasswort] = useState("");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    if (open) return;
    setPasswort("");
    setCodes(null);
    setFehler(null);
    setBusy(false);
  }, [open]);

  async function erzeugen() {
    setBusy(true);
    setFehler(null);
    let res;
    try {
      res = await createRecoveryCodes(passwort || undefined);
    } finally {
      // Wurzel 5: Ladezustand endet auf JEDEM Pfad, auch bei einem Wurf.
      setBusy(false);
    }
    if (!res.ok) {
      setFehler(res.error);
      return;
    }
    if (res.data.codes.length === 0) {
      // Keine Codes = kein Erfolg. Lieber ehrlich melden als eine leere Liste
      // als „fertig" ausgeben (Wurzel 5).
      setFehler(t("noneReturned"));
      return;
    }
    setCodes(res.data.codes);
    onFertig();
  }

  return (
    <EinrichtungShell
      open={open}
      onClose={onClose}
      title={t("dialogTitle")}
      description={codes ? undefined : t("dialogHint")}
    >
      {codes ? (
        <Wiederherstellungscodes
          codes={codes}
          titel={t("createdTitle")}
          onFertig={onClose}
        />
      ) : (
        <>
          {hatBereitsCodes && (
            <div
              className="rounded-(--radius) border border-destructive/40 bg-destructive/5 p-3"
              role="note"
            >
              <p className="text-sm text-destructive">{t("replaceWarning")}</p>
            </div>
          )}

          {hatPasswort && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="recovery-pw">{t("passwordLabel")}</Label>
              <Input
                id="recovery-pw"
                type="password"
                autoComplete="current-password"
                value={passwort}
                onChange={(e) => setPasswort(e.target.value)}
                aria-describedby="recovery-pw-hinweis recovery-fehler"
              />
              <span id="recovery-pw-hinweis" className="text-xs text-muted-foreground">
                {t("passwordHint")}
              </span>
            </div>
          )}

          <p
            id="recovery-fehler"
            role="alert"
            aria-live="assertive"
            className="min-h-5 text-sm text-destructive"
          >
            {fehler ?? ""}
          </p>

          <Button type="button" onClick={erzeugen} disabled={busy}>
            {busy ? t("creating") : t("createNow")}
          </Button>
        </>
      )}
    </EinrichtungShell>
  );
}

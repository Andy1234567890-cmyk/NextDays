"use client";

// Assistent „Authenticator-App" (TOTP) — GoTrue-nativ (0341).
//   1. GoTrue legt einen unverifizierten Faktor an → QR-Code + Secret
//   2. Nutzer scannt und bestätigt mit einem Code (Challenge + Verify)
//
// Der QR kommt von GoTrue als SVG-MARKUP (`totp.qr_code`), nicht als Data-URL.
// Er wird deshalb als Bild über eine data:image/svg+xml-Quelle eingebunden —
// kein `dangerouslySetInnerHTML`, obwohl das Markup vom eigenen Server kommt:
// ein <img> kann per Definition kein Skript ausführen (Wurzel 8).
//
// Sicherheit: Secret und QR leben nur im Zustand dieser Komponente und werden
// beim Schließen verworfen. Weder geloggt noch in der URL.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@nextdays/ui/button";
import {
  type TotpEnrollment,
  faktorBestaetigen,
  totpEnrollen,
} from "@/lib/mfa-client";

import { EinrichtungShell } from "./einrichtung-shell";
import { OtpInput } from "./otp-input";

export function TotpEinrichtung({
  open,
  onClose,
  onFertig,
}: {
  open: boolean;
  onClose: () => void;
  onFertig: () => void;
}) {
  const t = useTranslations("account.security.twoFactor.totp");
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [secretSichtbar, setSecretSichtbar] = useState(false);
  const [secretKopiert, setSecretKopiert] = useState(false);

  useEffect(() => {
    if (!open) {
      setEnrollment(null);
      setCode("");
      setFehler(null);
      setBusy(false);
      setSecretSichtbar(false);
      setSecretKopiert(false);
      return;
    }
    let abgebrochen = false;
    (async () => {
      // friendly_name: für den Nutzer erkennbar, wenn mehrere Faktoren
      // nebeneinander stehen. Kein Geheimnis.
      const res = await totpEnrollen(t("friendlyName"));
      if (abgebrochen) return;
      if (res.ok) setEnrollment(res.data);
      else setFehler(res.error);
    })();
    return () => {
      abgebrochen = true;
    };
  }, [open, t]);

  const pruefen = useCallback(
    async (eingabe: string) => {
      if (!enrollment) return;
      setBusy(true);
      setFehler(null);
      try {
        const res = await faktorBestaetigen(enrollment.factorId, eingabe);
        if (!res.ok) {
          setFehler(res.error);
          setCode("");
          return;
        }
        onFertig();
        onClose();
      } finally {
        // Wurzel 5: Der Ladezustand endet auf JEDEM Pfad. Wirft der Aufruf
        // (Netzfehler, abgelaufene Sitzung), bliebe der Knopf sonst dauerhaft
        // auf „Wird geprüft …" stehen — eine Sackgasse ohne Meldung.
        setBusy(false);
      }
    },
    [enrollment, onClose, onFertig],
  );

  async function secretKopieren() {
    if (!enrollment) return;
    try {
      await navigator.clipboard.writeText(enrollment.secret);
      setSecretKopiert(true);
    } catch {
      setFehler(t("copyFailed"));
    }
  }

  // SVG-Markup → data-URL. encodeURIComponent, damit auch Umlaute/#-Zeichen
  // im Markup die URL nicht zerlegen.
  const qrSrc = enrollment
    ? `data:image/svg+xml;utf8,${encodeURIComponent(enrollment.qrCode)}`
    : null;

  return (
    <EinrichtungShell
      open={open}
      onClose={onClose}
      title={t("setupTitle")}
      description={t("setupHint")}
    >
      {enrollment && qrSrc ? (
        <>
          <ol className="flex flex-col gap-4">
            <li className="flex flex-col gap-2">
              <span className="text-sm font-semibold">{t("step1")}</span>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrSrc}
                alt={t("qrAlt")}
                className="mx-auto size-44 rounded-(--radius) border border-border bg-white p-2"
              />
              <p className="text-xs text-muted-foreground">{t("qrHint")}</p>
            </li>

            <li className="flex flex-col gap-2">
              <span className="text-sm font-semibold">{t("manualTitle")}</span>
              <p className="text-xs text-muted-foreground">{t("manualHint")}</p>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 break-all rounded-(--radius) bg-secondary px-2 py-1 font-mono text-xs">
                  {secretSichtbar ? enrollment.secret : "•".repeat(32)}
                </code>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={secretSichtbar ? t("hideSecret") : t("showSecret")}
                  onClick={() => setSecretSichtbar((v) => !v)}
                >
                  <Icon
                    icon={secretSichtbar ? "ph:eye-slash" : "ph:eye"}
                    className="size-4"
                  />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={t("copySecret")}
                  onClick={secretKopieren}
                >
                  <Icon
                    icon={secretKopiert ? "ph:check" : "ph:copy"}
                    className="size-4"
                  />
                </Button>
              </div>
            </li>

            <li className="flex flex-col gap-2">
              <span className="text-sm font-semibold">{t("step2")}</span>
              <OtpInput
                label={t("codeLabel")}
                value={code}
                onChange={setCode}
                error={fehler}
                disabled={busy}
                onComplete={pruefen}
              />
            </li>
          </ol>

          <Button
            type="button"
            onClick={() => pruefen(code)}
            disabled={busy || code.length < 6}
          >
            {busy ? t("checking") : t("activate")}
          </Button>
        </>
      ) : (
        <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
          {fehler ?? t("preparing")}
        </p>
      )}
    </EinrichtungShell>
  );
}

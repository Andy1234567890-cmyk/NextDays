"use client";

// Assistent „Passkey" (WebAuthn) — GoTrue-nativ (0341), voll angebunden.
//
// Die Registrierung ist eine Zeremonie aus vier Schritten, die
// `supabase.auth.mfa.webauthn.register()` in einem Aufruf erledigt:
//   1. Faktor bei GoTrue anlegen (unverifiziert)
//   2. Challenge holen (die MUSS vom Server kommen)
//   3. `navigator.credentials.create()` — der Browser fragt Fingerabdruck,
//      Gesichtserkennung oder den Sicherheitsschlüssel ab
//   4. Antwort zurück an GoTrue, das sie gegen die Challenge prüft
//
// rpId/rpOrigins werden bewusst NICHT gesetzt: supabase-js leitet sie aus der
// aktuellen Herkunft ab. Ein selbst gesetzter Wert, der nicht zur Domain passt,
// wird vom Browser ohnehin abgelehnt — und wäre ein Hardcode (Wurzel 4).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

import { Button } from "@nextdays/ui/button";
import {
  type PasskeyFaehigkeit,
  passkeyFaehigkeitPruefen,
  passkeyRegistrieren,
} from "@/lib/mfa-client";

import { EinrichtungShell } from "./einrichtung-shell";

export function PasskeyEinrichtung({
  open,
  onClose,
  onFertig,
}: {
  open: boolean;
  onClose: () => void;
  onFertig: () => void;
}) {
  const t = useTranslations("account.security.twoFactor.passkey");
  const [faehigkeit, setFaehigkeit] = useState<PasskeyFaehigkeit | "pruefe">(
    "pruefe",
  );
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  // Fähigkeits-Erkennung bei jedem Öffnen (der Nutzer kann den Browser wechseln).
  useEffect(() => {
    if (!open) {
      setFaehigkeit("pruefe");
      setFehler(null);
      setBusy(false);
      return;
    }
    let abgebrochen = false;
    (async () => {
      const f = await passkeyFaehigkeitPruefen();
      if (!abgebrochen) setFaehigkeit(f);
    })();
    return () => {
      abgebrochen = true;
    };
  }, [open]);

  async function anlegen() {
    setBusy(true);
    setFehler(null);
    try {
      const res = await passkeyRegistrieren(t("friendlyName"));
      if (!res.ok) {
        // Bricht der Nutzer den Systemdialog ab, läuft die Frist ab oder passt
        // die Domain nicht, wird der Grund BENANNT — statt einen Erfolg
        // vorzutäuschen oder den Ladezustand stehen zu lassen.
        // `code` trägt einen unserer Schlüssel, `error` eine Server-Meldung
        // (z. B. abgelaufene Sitzung); beides wird sauber unterschieden.
        setFehler("code" in res ? t(`errors.${res.code}`) : res.error);
        return;
      }
      onFertig();
      onClose();
    } finally {
      // Wurzel 5: Der Ladezustand endet auf JEDEM Pfad — auch wenn oben etwas
      // Unerwartetes wirft. Ein hängender Knopf ohne Meldung ist eine
      // Sackgasse für den Nutzer.
      setBusy(false);
    }
  }

  const kannAnlegen = faehigkeit === "bereit" || faehigkeit === "ohnePlattform";

  return (
    <EinrichtungShell
      open={open}
      onClose={onClose}
      title={t("setupTitle")}
      description={t("setupHint")}
    >
      {faehigkeit === "pruefe" && (
        <p role="status" aria-live="polite" className="text-sm text-muted-foreground">
          {t("checkingSupport")}
        </p>
      )}

      {faehigkeit === "fehlt" && (
        <div
          className="flex items-start gap-2 rounded-(--radius) border border-border bg-secondary p-3"
          role="note"
        >
          <Icon icon="ph:x-circle" className="mt-0.5 size-4 shrink-0" aria-hidden />
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold">{t("unsupportedTitle")}</p>
            <p className="text-sm text-muted-foreground">{t("unsupportedHint")}</p>
          </div>
        </div>
      )}

      {faehigkeit === "ohnePlattform" && (
        <div
          className="flex items-start gap-2 rounded-(--radius) border border-border bg-secondary p-3"
          role="note"
        >
          <Icon icon="ph:usb" className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p className="text-sm">{t("securityKeyOnly")}</p>
        </div>
      )}

      {kannAnlegen && (
        <>
          <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <Icon icon="ph:check" className="mt-0.5 size-4 shrink-0" aria-hidden />
              {t("benefitPhishing")}
            </li>
            <li className="flex items-start gap-2">
              <Icon icon="ph:check" className="mt-0.5 size-4 shrink-0" aria-hidden />
              {t("benefitNoCode")}
            </li>
          </ul>
          <Button type="button" onClick={anlegen} disabled={busy}>
            <Icon icon="ph:fingerprint" className="size-4" aria-hidden />
            {busy ? t("creating") : t("create")}
          </Button>
        </>
      )}

      <p role="alert" aria-live="assertive" className="min-h-5 text-sm text-destructive">
        {fehler ?? ""}
      </p>
    </EinrichtungShell>
  );
}

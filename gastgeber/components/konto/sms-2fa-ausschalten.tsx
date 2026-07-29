"use client";

// SMS-Zweitfaktor entfernen — der Gegenzustand zur Nummern-Bestätigung.
//
// Ohne diesen Weg liesse sich die Nummer bestätigen, aber nie lösen (Wurzel 1):
// Wer sein Telefon verliert oder die Nummer wechselt, wäre ausgesperrt.
//
// Re-Auth über das PASSWORT, nicht über einen SMS-Code: Wer das Telefon nicht
// mehr hat, kann keinen Code empfangen — eine Code-Abfrage wäre genau in dem
// Fall unbenutzbar, für den man den Ausschalter braucht (Wurzel 7).
//
// Doppelte Bestätigung, weil hier eine Sicherheitsstufe fällt: erst die
// Rückfrage mit dem konkreten Nachteil, dann das Passwort.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";

import { phoneDisable } from "@/lib/konto-actions";

type Phase = "zu" | "frage" | "passwort";

export function Sms2FaAusschalten({
  hatPasswort,
  totpAktiv,
}: {
  /** OAuth-Konten ohne Passwort können sich nicht per Passwort ausweisen. */
  hatPasswort: boolean;
  /** Ist zusätzlich eine Authenticator-App aktiv? Dann bleibt ein zweiter
   *  Faktor bestehen — das ändert die Warnung. */
  totpAktiv: boolean;
}) {
  const t = useTranslations("konto");
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("zu");
  const [passwort, setPasswort] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  function schliessen() {
    setPhase("zu");
    setPasswort("");
    setFehler(null);
  }

  async function entfernen() {
    setLaeuft(true);
    setFehler(null);
    const res = await phoneDisable(hatPasswort ? passwort : null);
    setLaeuft(false);
    if (!res.ok) {
      setFehler(res.error);
      return;
    }
    schliessen();
    router.refresh();
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setPhase("frage")}
        className="shrink-0 text-sm font-medium text-destructive underline underline-offset-2 hover:opacity-70"
      >
        {t("smsAusEntfernen")}
      </button>

      {phase !== "zu" && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="sms-aus-titel"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6"
          onClick={schliessen}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-background p-8 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            {phase === "frage" ? (
              <>
                <h2
                  id="sms-aus-titel"
                  className="text-center font-display text-2xl font-bold"
                >
                  {t("smsAusFrageTitel")}
                </h2>
                {/* Die Warnung sagt, was WIRKLICH passiert — sie hängt davon
                    ab, ob noch ein zweiter Faktor übrig bleibt. Ein pauschaler
                    Text wäre in einem der beiden Fälle falsch. */}
                <p className="mt-3 text-center text-[0.9375rem] text-muted-foreground">
                  {totpAktiv
                    ? t("smsAusWarnungTotp")
                    : t("smsAusWarnungOhne")}
                </p>
                {/* Ohne Passwort-Schritt endet der Vorgang hier — dann muss
                    ein Serverfehler auch hier sichtbar sein. */}
                {fehler && (
                  <p className="mt-4 flex items-center gap-2 text-sm text-destructive">
                    <Icon
                      icon="solar:danger-triangle-line-duotone"
                      className="size-4"
                    />
                    {fehler}
                  </p>
                )}
                <div className="mt-7 flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={schliessen}
                  >
                    {t("smsAusAbbrechen")}
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() =>
                      hatPasswort ? setPhase("passwort") : void entfernen()
                    }
                    disabled={laeuft}
                  >
                    {laeuft ? t("smsAusLaeuftKurz") : t("smsAusWeiter")}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <h2
                  id="sms-aus-titel"
                  className="text-center font-display text-2xl font-bold"
                >
                  {t("smsAusPasswortTitel")}
                </h2>
                <p className="mt-3 text-center text-[0.9375rem] text-muted-foreground">
                  {t("smsAusPasswortText")}
                </p>
                <label className="mt-6 flex flex-col gap-2">
                  <span className="text-sm font-medium">
                    {t("smsAusPasswortLabel")}
                  </span>
                  <Input
                    type="password"
                    value={passwort}
                    onChange={(e) => setPasswort(e.target.value)}
                    disabled={laeuft}
                    autoFocus
                  />
                </label>
                {fehler && (
                  <p className="mt-3 flex items-center gap-2 text-sm text-destructive">
                    <Icon
                      icon="solar:danger-triangle-line-duotone"
                      className="size-4"
                    />
                    {fehler}
                  </p>
                )}
                <div className="mt-7 flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={schliessen}
                    disabled={laeuft}
                  >
                    {t("smsAusAbbrechen")}
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => void entfernen()}
                    disabled={laeuft || passwort.length === 0}
                  >
                    {laeuft ? t("smsAusEntfernenLaeuft") : t("smsAusEntfernen")}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

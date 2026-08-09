"use client";

// Zwei-Faktor-Authentifizierung: Übersicht aller Faktoren + Einrichtungs-
// Assistenten. Vier Wege, wie vom Nutzer entschieden:
//   1. Authenticator-App (TOTP)         — GoTrue `factor_type: totp`
//   2. SMS an eine Telefonnummer        — GoTrue `factor_type: phone`
//   3. Passkey (WebAuthn)               — GoTrue `factor_type: webauthn`
//   4. Wiederherstellungscodes          — FastAPI `/auth/mfa/recovery-codes`
//
// Quelle der Wahrheit ist AUSSCHLIESSLICH `GET /auth/mfa/status`: welche
// Faktoren es gibt, ob die Rolle einen verlangt, wie lange die Frist noch
// läuft und wie viele Wiederherstellungscodes übrig sind. Nichts davon wird
// hier abgeleitet oder geraten.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import type { MfaFactor, MfaStatus } from "@/lib/mfa";

import { FaktorEntfernenDialog } from "./faktor-entfernen-dialog";
import { PasskeyEinrichtung } from "./passkey-einrichtung";
import { SmsEinrichtung } from "./sms-einrichtung";
import { TotpEinrichtung } from "./totp-einrichtung";
import { WiederherstellungscodesDialog } from "./wiederherstellungscodes-dialog";

type Assistent = null | "totp" | "phone" | "webauthn" | "recovery";

export function ZweiFaktorSection({
  status,
  hatPasswort,
  onGeaendert,
}: {
  status: MfaStatus;
  hatPasswort: boolean;
  onGeaendert: () => void;
}) {
  const t = useTranslations("account.security.twoFactor");
  const [assistent, setAssistent] = useState<Assistent>(null);
  const [zuEntfernen, setZuEntfernen] = useState<MfaFactor | null>(null);

  // Verifizierte Faktoren je Typ. GoTrue kennt auch unverifizierte
  // (abgebrochene Einrichtung) — die zählen nicht als Schutz.
  const verifiziert = status.factors.filter((f) => f.status === "verified");
  const vonTyp = (typ: string) => verifiziert.find((f) => f.factor_type === typ);
  const totp = vonTyp("totp");
  const sms = vonTyp("phone");
  const passkey = vonTyp("webauthn");

  const frist = status.mfa_grace_until;

  return (
    <section className="flex flex-col gap-3">
      <div>
        <h3 className="font-display text-lg font-extrabold">{t("title")}</h3>
        <p className="text-sm text-muted-foreground">{t("intro")}</p>
      </div>

      {/* Pflicht-Hinweis mit ECHTER Frist aus dem Backend. Fehlt sie, wird
          kein Datum erfunden (Wurzel 4) — dann nur der Hinweis ohne Frist. */}
      {status.mfa_required && !status.mfa_enrolled && (
        <div
          className="flex items-start gap-2 rounded-(--radius) border border-destructive/40 bg-destructive/5 p-3"
          role="note"
        >
          <Icon
            icon="ph:shield-warning"
            className="mt-0.5 size-4 shrink-0 text-destructive"
            aria-hidden
          />
          <p className="text-sm text-destructive">
            {frist
              ? t("requiredWithDeadline", { date: datumFormatieren(frist) })
              : t("requiredNotice")}
          </p>
        </div>
      )}

      {!status.mfa_required && !status.mfa_enrolled && (
        <div
          className="flex items-start gap-2 rounded-(--radius) border border-border bg-secondary p-3"
          role="note"
        >
          <Icon icon="ph:shield-check" className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p className="text-sm">{t("noneActive")}</p>
        </div>
      )}

      {/* 1. Passkey zuerst: der phishing-resistente Weg. */}
      <FaktorKarte
        icon="ph:fingerprint"
        titel={t("passkey.title")}
        beschreibung={t("passkey.description")}
        empfehlung={t("passkey.recommended")}
        faktor={passkey}
        aktivLabel={t("active")}
        setUpLabel={t("setUp")}
        removeLabel={t("remove")}
        onSetUp={() => setAssistent("webauthn")}
        onRemove={() => passkey && setZuEntfernen(passkey)}
      />

      {/* 2. Authenticator-App. Der Zusatzhinweis nennt die bekannte Grenze
          sachlich: ein TOTP-Code bleibt sein Zeitfenster über gültig und ist
          darin mehrfach einlösbar (GoTrue merkt den Verbrauch nicht vor).
          Praktisch heißt das: gegen Echtzeit-Phishing schützt der Passkey,
          nicht der Code. Ein Satz, keine Angstmache. */}
      <FaktorKarte
        icon="ph:device-mobile"
        titel={t("totp.title")}
        beschreibung={t("totp.description")}
        hinweis={t("totp.replayNote")}
        faktor={totp}
        aktivLabel={t("active")}
        setUpLabel={t("setUp")}
        removeLabel={t("remove")}
        onSetUp={() => setAssistent("totp")}
        onRemove={() => totp && setZuEntfernen(totp)}
      />

      {/* 3. SMS. Ob dieser Weg überhaupt gangbar ist, entscheidet der Server
          (`sms_available`) — ohne konfigurierten SMS-Anbieter beantwortet
          GoTrue die Challenge mit 500. Dann wird die Karte nicht versteckt,
          sondern sichtbar als nicht verfügbar geführt: Wer die Option sucht,
          soll erfahren, warum es sie hier nicht gibt, statt in eine Sackgasse
          zu laufen. Ein bereits eingerichteter Faktor bleibt bedienbar —
          entfernen muss immer möglich sein, sonst säße der Nutzer darauf fest. */}
      <FaktorKarte
        icon="ph:chat-circle-text"
        titel={t("sms.title")}
        beschreibung={t("sms.description")}
        hinweis={!status.sms_available && !sms ? t("sms.unavailable") : undefined}
        faktor={sms}
        nichtVerfuegbar={!status.sms_available}
        aktivLabel={t("active")}
        setUpLabel={t("setUp")}
        unavailableLabel={t("sms.unavailableBadge")}
        removeLabel={t("remove")}
        onSetUp={() => setAssistent("phone")}
        onRemove={() => sms && setZuEntfernen(sms)}
      />

      {/* 4. Wiederherstellungscodes */}
      <Card className="flex flex-col gap-3 p-5">
        <div className="flex flex-row items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Icon
              icon="ph:key"
              className="mt-0.5 size-5 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <div className="flex flex-col gap-1">
              <span className="text-sm font-semibold">{t("recovery.title")}</span>
              <span className="text-sm text-muted-foreground">
                {t("recovery.description")}
              </span>
              <span className="text-sm text-muted-foreground">
                {t("recovery.left", { count: status.recovery_codes_left })}
              </span>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="shrink-0"
            onClick={() => setAssistent("recovery")}
          >
            {status.recovery_codes_left > 0
              ? t("recovery.regenerate")
              : t("recovery.create")}
          </Button>
        </div>
        {status.recovery_codes_left > 0 && (
          <p className="text-xs text-muted-foreground">
            {t("recovery.regenerateHint")}
          </p>
        )}
      </Card>

      {/* Assistenten */}
      <TotpEinrichtung
        open={assistent === "totp"}
        onClose={() => setAssistent(null)}
        onFertig={onGeaendert}
      />
      <SmsEinrichtung
        open={assistent === "phone"}
        onClose={() => setAssistent(null)}
        onFertig={onGeaendert}
      />
      <PasskeyEinrichtung
        open={assistent === "webauthn"}
        onClose={() => setAssistent(null)}
        onFertig={onGeaendert}
      />
      <WiederherstellungscodesDialog
        open={assistent === "recovery"}
        hatPasswort={hatPasswort}
        hatBereitsCodes={status.recovery_codes_left > 0}
        onClose={() => setAssistent(null)}
        onFertig={onGeaendert}
      />
      <FaktorEntfernenDialog
        faktor={zuEntfernen}
        hatPasswort={hatPasswort}
        onClose={() => setZuEntfernen(null)}
        onFertig={onGeaendert}
      />
    </section>
  );
}

/** ISO-Datum → lokale Kurzform. Bewusst ohne Bibliothek und ohne Annahme über
 *  das Format: ist der Wert nicht lesbar, wird er unverändert gezeigt statt
 *  ein „Invalid Date" zu behaupten. */
function datumFormatieren(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function FaktorKarte({
  icon,
  titel,
  beschreibung,
  empfehlung,
  hinweis,
  faktor,
  nichtVerfuegbar = false,
  aktivLabel,
  setUpLabel,
  unavailableLabel,
  removeLabel,
  onSetUp,
  onRemove,
}: {
  icon: string;
  titel: string;
  beschreibung: string;
  empfehlung?: string;
  /** Sachliche Einordnung unter der Karte (z. B. bekannte Grenze des Faktors). */
  hinweis?: string;
  faktor: MfaFactor | undefined;
  /** Dieser Weg ist auf diesem Server nicht einrichtbar. Die Karte bleibt
   *  sichtbar (der Nutzer soll den Grund erfahren), der Einrichten-Knopf wird
   *  aber deaktiviert, statt in einen Serverfehler zu führen. */
  nichtVerfuegbar?: boolean;
  aktivLabel: string;
  setUpLabel: string;
  /** Beschriftung des deaktivierten Knopfes. Nur nötig, wenn `nichtVerfuegbar`
   *  gesetzt sein kann. */
  unavailableLabel?: string;
  removeLabel: string;
  onSetUp: () => void;
  onRemove: () => void;
}) {
  const aktiv = Boolean(faktor);
  // Entfernen bleibt IMMER erlaubt: ein bereits eingerichteter Faktor muss
  // abwählbar sein, auch wenn der Weg neu nicht mehr angeboten wird.
  const gesperrt = nichtVerfuegbar && !aktiv;
  return (
    <Card className="flex flex-col gap-2 p-5">
      <div className="flex flex-row items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Icon
            icon={icon}
            className="mt-0.5 size-5 shrink-0 text-muted-foreground"
            aria-hidden
          />
          <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold">{titel}</span>
            <span className="text-sm text-muted-foreground">{beschreibung}</span>
            {empfehlung && !aktiv && (
              <span className="text-sm text-muted-foreground">{empfehlung}</span>
            )}
            {hinweis && (
              <span className="text-xs text-muted-foreground">{hinweis}</span>
            )}
            {aktiv && (
              <span className="mt-1 inline-flex w-fit items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                <Icon icon="ph:check-circle" className="size-3.5" aria-hidden />
                {aktivLabel}
                {faktor?.friendly_name ? ` · ${faktor.friendly_name}` : ""}
              </span>
            )}
          </div>
        </div>
        <Button
          variant={aktiv ? "outline" : "accent"}
          size="sm"
          className={aktiv ? "shrink-0 text-destructive" : "shrink-0"}
          onClick={aktiv ? onRemove : onSetUp}
          disabled={gesperrt}
        >
          {aktiv ? removeLabel : gesperrt ? (unavailableLabel ?? setUpLabel) : setUpLabel}
        </Button>
      </div>
    </Card>
  );
}

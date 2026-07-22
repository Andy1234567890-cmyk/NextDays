"use client";

// Zahlungs-Aktivierung (Stripe Connect) — NUR Status + Aktivieren.
// Es gibt KEINE doppelten Eingabefelder: Name, Adresse, E-Mail, Telefon, IBAN,
// Geburtsdatum, Website kommen alle aus den Stammdaten/dem Firmenprofil und
// werden beim Profil-Speichern automatisch an Stripe übertragen
// (buchhaltung.update_company_profile → _ensure_connect_account). Hier bleibt
// nur, was Stripe zusätzlich braucht und nicht „Daten" ist: die ausdrückliche
// ToS-Zustimmung (mit echter Nutzer-IP) — der „Zahlungen aktivieren"-Klick.
//
// Realtime-Pflicht: der KYC-Status wird über den account.updated-Webhook in
// tenant_billing_profile gespiegelt; wir abonnieren die Tabelle (useRealtime,
// WebSocket) und laden bei jeder Änderung live nach — kein Polling.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import {
  acceptConnectTos,
  getConnectStatus,
  type ConnectStatus,
} from "@/lib/payments";

// Offene Requirements lesbar machen (statt roher Stripe-Pfade wie
// „individual.dob.day") UND direkt auf das passende Formularfeld auf /konto
// verweisen (fieldId = id-Attribut des Eingabefelds). So springt der Nutzer per
// Klick genau dorthin, wo er die Angabe nachträgt.
const REQUIREMENT_HINTS: {
  match: (r: string) => boolean;
  label: string;
  fieldId: string;
}[] = [
  // Gesellschafts-spezifische Requirements ZUERST (die erste passende match
  // gewinnt) — sonst schlucken die generischen address/name-Muster sie.
  // Stripe DE führt die Handelsregisternummer im Feld company.tax_id (nicht die
  // Steuernummer) — beide Muster verweisen daher auf das HRB-Feld.
  { match: (r) => r.includes("registration_number") || r.includes("company.tax_id"), label: "Handelsregisternummer", fieldId: "companyRegister" },
  { match: (r) => r.includes("company.name"), label: "Firmenname", fieldId: "companyName" },
  { match: (r) => r.includes("verification.document"), label: "Ausweis-/Registerdokument (im Zahlungskonto hochladen)", fieldId: "" },
  { match: (r) => r.includes("relationship.representative") || r.includes(".representative"), label: "Vertretungsberechtigte Person (Geschäftsführer)", fieldId: "firstName" },
  { match: (r) => r.includes("relationship.director") || r.includes("directors"), label: "Geschäftsführer", fieldId: "firstName" },
  { match: (r) => r.includes("relationship.owner") || r.includes("owners"), label: "Wirtschaftlich Berechtigte(r)", fieldId: "firstName" },
  { match: (r) => r.startsWith("individual.dob") || r.includes("dob"), label: "Geburtsdatum", fieldId: "ownerDob" },
  { match: (r) => r.includes("address"), label: "Adresse", fieldId: "street" },
  { match: (r) => r.includes("first_name") || r.includes("last_name"), label: "Name", fieldId: "firstName" },
  { match: (r) => r.includes("email"), label: "E-Mail", fieldId: "email" },
  { match: (r) => r.includes("phone"), label: "Telefon", fieldId: "phone1" },
  { match: (r) => r.includes("external_account"), label: "Bankverbindung (IBAN)", fieldId: "iban" },
  { match: (r) => r.includes("business_profile.url"), label: "Website", fieldId: "website" },
  { match: (r) => r.includes("tos_acceptance"), label: "Zustimmung zu den Nutzungsbedingungen", fieldId: "" },
];

type MissingField = { label: string; fieldId: string };

function humanizeRequirements(reqs: string[]): MissingField[] {
  const seen = new Set<string>();
  const out: MissingField[] = [];
  for (const r of reqs) {
    const hint = REQUIREMENT_HINTS.find((h) => h.match(r));
    // tos_acceptance kommt über den Aktivieren-Button — nicht als „fehlende
    // Stammdaten" auflisten.
    if (hint && !r.includes("tos_acceptance") && !seen.has(hint.label)) {
      seen.add(hint.label);
      out.push({ label: hint.label, fieldId: hint.fieldId });
    }
  }
  return out;
}

// Zum Formularfeld scrollen und es kurz hervorheben, damit der Nutzer sofort
// sieht, WO er die fehlende Angabe einträgt.
function focusField(fieldId: string): void {
  if (!fieldId) return;
  const el = document.getElementById(fieldId);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  // Kurzes visuelles Hervorheben (Ring), dann wieder entfernen.
  el.classList.add("ring-2", "ring-destructive", "ring-offset-2");
  window.setTimeout(() => {
    el.classList.remove("ring-2", "ring-destructive", "ring-offset-2");
  }, 2200);
  if (
    el instanceof HTMLInputElement ||
    el instanceof HTMLSelectElement ||
    el instanceof HTMLTextAreaElement
  ) {
    el.focus({ preventScroll: true });
  }
}

// Stripe `disabled_reason` ist ein technischer Enum-Code (z. B.
// „requirements.past_due"). Roh angezeigt hilft er dem Nutzer nicht — hier in
// eine klare Erklärung mit Handlungshinweis übersetzen. Feste Stripe-Enum-Werte;
// unbekannte fallen auf einen allgemeinen, verständlichen Satz zurück (kein
// roher Code mehr, aber auch kein erfundener Grund).
function explainDisabledReason(reason: string): string {
  const MAP: Record<string, string> = {
    "requirements.past_due":
      "Es fehlen noch Pflichtangaben. Klicke unten auf ein fehlendes Feld, um direkt dorthin zu springen, trage es ein und speichere — danach ist die Freischaltung abgeschlossen.",
    "requirements.pending_verification":
      "Deine Angaben werden gerade von Stripe geprüft. Das dauert meist wenige Minuten bis zu einem Werktag — hier ist nichts weiter zu tun.",
    "rejected.fraud":
      "Das Zahlungskonto wurde abgelehnt (Betrugsverdacht). Bitte kontaktiere den Support.",
    "rejected.terms_of_service":
      "Das Zahlungskonto wurde wegen Verstoßes gegen die Nutzungsbedingungen abgelehnt. Bitte kontaktiere den Support.",
    "rejected.listed":
      "Das Zahlungskonto wurde abgelehnt (Sanktions-/Prüfliste). Bitte kontaktiere den Support.",
    "rejected.other":
      "Das Zahlungskonto wurde abgelehnt. Bitte kontaktiere den Support.",
    "listed":
      "Dein Konto wird derzeit von Stripe geprüft. Bitte warte, bis die Prüfung abgeschlossen ist.",
    "under_review":
      "Dein Konto wird derzeit von Stripe geprüft. Das kann kurz dauern — hier ist nichts weiter zu tun.",
    "other":
      "Die Zahlungsfreischaltung ist noch nicht abgeschlossen. Ergänze fehlende Angaben in den Stammdaten und schließe die Einrichtung ab.",
  };
  return (
    MAP[reason] ??
    "Die Zahlungsfreischaltung ist noch nicht abgeschlossen. Ergänze offene Angaben in den Stammdaten und schließe die Einrichtung ab."
  );
}

function StatusBadge({ label, on }: { label: string; on: boolean }) {
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium " +
        (on
          ? "bg-secondary text-secondary-foreground"
          : "bg-muted text-muted-foreground")
      }
    >
      <Icon
        icon={on ? "ph:check-circle-fill" : "ph:circle-dashed"}
        className={"size-3.5 " + (on ? "text-emerald-600" : "")}
      />
      {label}
    </span>
  );
}

type Props = {
  accountId: string;
  initialStatus: ConnectStatus | null;
  initialStatusError: string | null;
};

export function PaymentsActivation({
  accountId,
  initialStatus,
  initialStatusError,
}: Props) {
  const t = useTranslations("legal");
  const [status, setStatus] = useState<ConnectStatus | null>(initialStatus);
  const [statusError, setStatusError] = useState<string | null>(
    initialStatusError,
  );
  const [accepting, startAccept] = useTransition();
  // Einwilligung als Popup: der AGB-/Stripe-Vertragstext wird NICHT mehr
  // dauerhaft in der Fläche gezeigt, sondern beim Klick auf „Zahlungen
  // aktivieren" abgefragt — Zustimmung erst im Dialog (Stripe-Pflicht: AGB +
  // Connected Account Agreement müssen im Moment der Zustimmung sichtbar
  // verlinkt sein).
  const [consentOpen, setConsentOpen] = useState(false);

  const reloadStatus = useCallback(async () => {
    const res = await getConnectStatus(accountId);
    if (res.ok) {
      setStatus(res.data);
      setStatusError(null);
    } else {
      setStatusError(res.error);
    }
  }, [accountId]);

  useEffect(() => {
    if (!status && !statusError) void reloadStatus();
  }, [status, statusError, reloadStatus]);

  // account.updated-Webhook schreibt tenant_billing_profile → Status nachladen.
  // KEIN Realtime-Abo mehr: tenant_billing_profile ist am anon-/authenticated-
  // Direktpfad gesperrt (Wurzel 6, Migration 0169) → der Client bekäme ohnehin
  // keine Events. Stattdessen kurzes Polling, SOLANGE noch nicht freigeschaltet
  // (der Status kommt aus dem live-Stripe-Call über die API). Sobald aktiv:
  // Poll stoppt (kein Dauer-Poll).
  useEffect(() => {
    if (status?.charges_enabled) return;
    const id = setInterval(() => void reloadStatus(), 8000);
    return () => clearInterval(id);
  }, [status?.charges_enabled, reloadStatus]);

  function handleAcceptTos() {
    startAccept(async () => {
      const res = await acceptConnectTos(accountId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setStatus(res.data);
      setConsentOpen(false);
      toast.success("Zahlungen aktiviert.");
    });
  }

  if (statusError) {
    return (
      <div className="flex flex-col gap-2 rounded-(--radius) border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
        <span className="flex items-center gap-2 font-medium">
          <Icon icon="ph:warning-circle" className="size-5 shrink-0" />
          Zahlungs-Status nicht abrufbar
        </span>
        <span className="text-destructive/90">{statusError}</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void reloadStatus()}
          className="self-start"
        >
          <Icon icon="ph:arrow-clockwise" className="size-4" />
          Erneut versuchen
        </Button>
      </div>
    );
  }

  if (!status) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon icon="ph:spinner" className="size-4 animate-spin" />
        Status wird geladen …
      </p>
    );
  }

  const missing = humanizeRequirements(status.requirements);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        <StatusBadge label="Zahlungen aktiv" on={status.charges_enabled} />
        <StatusBadge label="Auszahlungen aktiv" on={status.payouts_enabled} />
        <StatusBadge label="Angaben vollständig" on={status.details_submitted} />
      </div>

      {status.disabled_reason && (
        <p className="rounded-(--radius) border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
          <Icon
            icon="ph:warning"
            className="mr-1.5 inline size-4 align-text-bottom"
          />
          {explainDisabledReason(status.disabled_reason)}
        </p>
      )}

      {status.charges_enabled ? (
        <div className="flex items-center gap-2 rounded-(--radius) border border-emerald-600/40 bg-emerald-50 p-3 text-sm font-medium text-emerald-700">
          <Icon
            icon="ph:check-circle-fill"
            className="size-5 shrink-0 text-emerald-600"
          />
          Zahlungen aktiv — du kannst Gästezahlungen empfangen.
        </div>
      ) : (
        <>
          {missing.length > 0 && (
            <div className="flex flex-col gap-2">
              <h4 className="text-sm font-medium">
                Fehlende Angaben — klicke ein Feld an, um direkt dorthin zu
                springen:
              </h4>
              <ul className="flex flex-wrap gap-2">
                {missing.map((m) => (
                  <li key={m.label}>
                    <button
                      type="button"
                      onClick={() => focusField(m.fieldId)}
                      className="flex items-center gap-1.5 rounded-full border border-destructive/30 bg-destructive/5 px-2.5 py-1 text-xs font-medium text-destructive transition-colors hover:bg-destructive/10"
                    >
                      <Icon icon="ph:arrow-down" className="size-3.5" />
                      {m.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <Button
            type="button"
            variant="accent"
            onClick={() => setConsentOpen(true)}
            disabled={accepting}
            className="self-start"
          >
            <Icon icon="ph:rocket-launch" className="size-4" />
            Zahlungen aktivieren
          </Button>
        </>
      )}

      {/* Einwilligungs-Popup: AGB + Stripe Connected Account Agreement müssen
          im Moment der Zustimmung sichtbar verlinkt sein (Stripe-Pflicht für
          Custom Accounts, Wortlaut folgt Stripes Empfehlungstext). */}
      {consentOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/40"
            role="presentation"
            onClick={() => !accepting && setConsentOpen(false)}
          />
          <div className="relative z-10 flex w-full max-w-lg flex-col rounded-2xl bg-card shadow-xl">
            <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
              <h2 className="font-display text-lg font-extrabold">
                Zahlungen aktivieren
              </h2>
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setConsentOpen(false)}
                disabled={accepting}
                aria-label="Schließen"
              >
                <Icon icon="ph:x" className="size-4" />
              </Button>
            </div>
            <div className="px-5 py-4 text-sm">
              {t.rich("stripeConsent", {
                agb: (chunks) => (
                  <Link
                    href="/agb"
                    target="_blank"
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    {chunks}
                  </Link>
                ),
                stripe: (chunks) => (
                  <a
                    href="https://stripe.com/connect-account/legal/full"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    {chunks}
                  </a>
                ),
              })}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setConsentOpen(false)}
                disabled={accepting}
              >
                Abbrechen
              </Button>
              <Button
                type="button"
                variant="accent"
                onClick={handleAcceptTos}
                disabled={accepting}
              >
                <Icon
                  icon={accepting ? "ph:spinner" : "ph:check-circle"}
                  className={"size-4 " + (accepting ? "animate-spin" : "")}
                />
                {accepting ? "Wird aktiviert …" : "Zustimmen & aktivieren"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

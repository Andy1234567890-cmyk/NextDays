"use client";

// Stripe-Einrichtung des Gastgebers (Reiter „Zahlungen").
//
// Vorher stand hier nur „Kartenzahlungen — Noch nicht verbunden" ohne einen
// Weg, das zu ändern; Stripe fehlte im Gastgeber-Konto komplett. Jetzt ist die
// Karte der EINE Ort, an dem der Gastgeber sieht, was für die Freischaltung
// fehlt und wo er es erledigt — nach dem Airbnb-Muster „Schritte bis zur
// ersten Auszahlung":
//   1. Vermieterdaten (privat oder gewerblich) → /konto?bereich=unternehmen
//   2. Bankverbindung → Reiter Auszahlungen
//   3. Zustimmung zur Stripe-Vereinbarung → Knopf hier (eigene Willenserklärung)
//   4. Prüfung durch Stripe → Status
//
// Regel des Marktplatzes: ohne freigeschaltetes Stripe-Konto geht KEIN Objekt
// auf myBestDays live (Backend-Gate `_require_payments_ready`, 409). Objekte
// eines myNextDays-Betriebs folgen einem anderen Ablauf und tauchen hier nicht
// auf — das Gastgeber-Dashboard kennt nur Marktplatz-Konten.
//
// Debugging ist eingebaut, nicht nachgerüstet: jede offene Anforderung steht
// mit ihrem ROHEN Stripe-Pfad da, dazu Ablehnungen (requirements.errors), der
// Sperrgrund, die Frist und die Kontokennung — im Support-Fall ist damit ohne
// Nachfrage klar, was Stripe wirklich verlangt.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@nextdays/ui/dialog";

import {
  aktiviereAuszahlungen,
  ladeAuszahlungsStatus,
  synceStammdaten,
} from "@/lib/auszahlung-actions";
import type { AuszahlungsStatus } from "@/lib/payments";
import type { Unternehmensprofil } from "@/lib/unternehmen";

type Uebersetzer = ReturnType<typeof useTranslations<"konto">>;

const DATEN_HREF = "/konto?bereich=unternehmen";
const BANK_HREF = "/konto?bereich=zahlungen&tab=auszahlungen";
// Stripe verlangt, dass die Vereinbarung im Moment der Zustimmung verlinkt ist.
const STRIPE_VEREINBARUNG = "https://stripe.com/connect-account/legal/full";

/**
 * Roher Stripe-Feldpfad → Textschlüssel + Sprungziel. Spezifische Muster
 * ZUERST (die erste Übereinstimmung gewinnt), sonst schluckt „address" auch
 * „company.address". `href` leer = es gibt bei uns kein Feld dafür → `hinweis`
 * sagt, wo die Angabe hingehört, statt den Nutzer suchen zu lassen.
 */
const FELDER: {
  passt: (r: string) => boolean;
  key: string;
  href: string;
  hinweis?: string;
}[] = [
  { passt: (r) => r.includes("tos_acceptance"), key: "seFeldTos", href: "" , hinweis: "seFeldTosHinweis" },
  { passt: (r) => r.includes("external_account"), key: "azFeldExternalAccount", href: BANK_HREF },
  { passt: (r) => r.includes("id_number") || r.includes("ssn_last_4"), key: "seFeldKennnummer", href: DATEN_HREF },
  { passt: (r) => r.includes("verification.document") || r.includes("verification.additional_document"), key: "azFeldAusweis", href: "", hinweis: "seHinweisAusweis" },
  { passt: (r) => r.includes("registration_number") || r.includes("company.tax_id"), key: "azFeldRegisternummer", href: DATEN_HREF },
  { passt: (r) => r.includes("company.vat_id"), key: "utFeldUstId", href: DATEN_HREF },
  { passt: (r) => r.includes("company.name"), key: "azFeldFirmenname", href: DATEN_HREF },
  { passt: (r) => r.includes("company.structure"), key: "utFeldRechtsform", href: DATEN_HREF },
  { passt: (r) => r.includes("owners_provided") || r.includes("directors_provided") || r.includes("executives_provided") || r.includes("representative") || r.includes("directors") || r.includes("owners"), key: "utZeileVertretung", href: DATEN_HREF },
  { passt: (r) => r.includes("dob"), key: "azFeldDob", href: DATEN_HREF },
  { passt: (r) => r.includes("address"), key: "azFeldAdresse", href: DATEN_HREF },
  { passt: (r) => r.includes("first_name") || r.includes("last_name"), key: "azFeldName", href: DATEN_HREF },
  { passt: (r) => r.includes("email"), key: "azFeldEmail", href: DATEN_HREF },
  { passt: (r) => r.includes("phone"), key: "azFeldTelefon", href: DATEN_HREF },
  { passt: (r) => r.includes("business_profile.url"), key: "azFeldWebsite", href: DATEN_HREF },
  { passt: (r) => r.includes("business_profile.mcc") || r.includes("business_profile.product_description"), key: "seFeldMcc", href: "", hinweis: "seFeldMccHinweis" },
];

type Anforderung = { label: string; href: string; pfad: string; hinweis?: string };

/**
 * JEDE Anforderung wird abgebildet — auch eine ohne bekanntes Muster. Ein stumm
 * verschlucktes Requirement war im PMS der Grund, warum die Karte „es fehlen
 * Angaben" behauptete und darunter nichts stand (Wurzel 5). Unbekanntes
 * erscheint mit seinem Stripe-Pfad und dem Hinweis auf den Support.
 */
function lesbar(pfade: string[], t: Uebersetzer): Anforderung[] {
  const gesehen = new Set<string>();
  const aus: Anforderung[] = [];
  for (const pfad of pfade) {
    const feld = FELDER.find((f) => f.passt(pfad));
    const label = feld ? t(feld.key) : pfad;
    if (gesehen.has(label)) continue;
    gesehen.add(label);
    aus.push({
      label,
      href: feld?.href ?? "",
      pfad,
      hinweis: feld
        ? feld.hinweis
          ? t(feld.hinweis)
          : undefined
        : t("seFeldUnbekannt"),
    });
  }
  return aus;
}

/**
 * Beanstandungen buendeln: EIN Befund, eine Zeile.
 *
 * Stripe meldet dieselbe Ursache je betroffenem Feld erneut. Eine gescheiterte
 * Identitaetspruefung kam so neunmal wortgleich untereinander an — dreimal
 * „Adresse", dreimal „Geburtsdatum", zweimal „Name", einmal „Telefonnummer",
 * jedes Mal mit demselben Satz. Das las sich wie neun Probleme und war eines.
 * Gebuendelt wird nach Ursache (Code + Begruendung); davor stehen die
 * betroffenen Felder.
 */
function gebuendelt(
  fehler: { requirement: string; code: string; reason: string }[],
  t: Uebersetzer,
): { code: string; reason: string; felder: string }[] {
  const nach = new Map<string, { code: string; reason: string; felder: string[] }>();
  for (const f of fehler) {
    const schluessel = `${f.code}|${f.reason}`;
    const eintrag = nach.get(schluessel) ?? {
      code: f.code,
      reason: f.reason,
      felder: [],
    };
    const label = lesbar([f.requirement], t)[0]?.label ?? f.requirement;
    if (!eintrag.felder.includes(label)) eintrag.felder.push(label);
    nach.set(schluessel, eintrag);
  }
  return [...nach.values()].map((e) => ({
    code: e.code,
    reason: e.reason,
    felder: e.felder.join(" · "),
  }));
}

/**
 * Stripes `disabled_reason` ist ein Enum-Code. Roh hilft er niemandem — hier
 * die Erklärung mit Handlungshinweis. Fehlt NUR die Zustimmung, ist es kein
 * Datenmangel, sondern ein Klick: der alte Text schickte den Nutzer sonst auf
 * die Suche nach Feldern, die es nicht auszufüllen gab.
 */
function grund(reason: string | null, nurTos: boolean, t: Uebersetzer): string | null {
  if (nurTos) return t("seGrundNurTos");
  if (!reason) return null;
  if (reason === "requirements.past_due") return t("seGrundPastDue");
  if (reason === "requirements.pending_verification") return t("seGrundPending");
  if (reason.startsWith("rejected")) return t("seGrundRejected");
  if (reason === "under_review" || reason === "listed") return t("seGrundReview");
  return t("seGrundSonst");
}

/** Sind die Vermieterdaten für den gewählten Kontotyp vollständig? */
export function vermieterdatenVollstaendig(p: Unternehmensprofil | null): boolean {
  if (!p) return false;
  const person = !!p.firstName && !!p.lastName && !!p.ownerDob;
  const basis =
    !!p.email && !!p.companyCountry && !!p.companyStreet && !!p.companyCity;
  if (p.accountType === "company") return basis && !!p.companyName && person;
  return basis && person;
}

export function StripeEinrichtung({
  kontoId,
  status: initial,
  profil,
}: {
  kontoId: string | null;
  /** Live-Status beim Zahlungsanbieter; null, wenn kein Konto besteht oder
   *  der Abruf scheiterte. */
  status: AuszahlungsStatus | null;
  profil: Unternehmensprofil | null;
}) {
  const t = useTranslations("konto");
  const router = useRouter();
  const [status, setStatus] = useState<AuszahlungsStatus | null>(initial);
  const [statusFehler, setStatusFehler] = useState<string | null>(
    kontoId && !initial ? t("seStatusNichtAbrufbar") : null,
  );
  const [syncFehler, setSyncFehler] = useState<string | null>(
    profil?.stripeSyncError ?? null,
  );
  const [zustimmungOffen, setZustimmungOffen] = useState(false);
  const [laeuft, setLaeuft] = useState(false);

  const nachladen = useCallback(async () => {
    if (!kontoId) return;
    const res = await ladeAuszahlungsStatus(kontoId);
    if (res.ok) {
      setStatus(res.data);
      setStatusFehler(null);
    } else {
      setStatusFehler(res.fehler);
    }
  }, [kontoId]);

  // Der KYC-Stand kommt per Webhook in tenant_billing_profile — die Tabelle ist
  // für authenticated bewusst gesperrt (Wurzel 6, 0169), ein Realtime-Abo wäre
  // eine Attrappe. Deshalb Polling, aber sparsam: jeder Tick ist ein echter
  // Stripe-Aufruf. 60 s, nur bei sichtbarem Tab, nur solange nicht aktiv.
  useEffect(() => {
    if (!kontoId || status?.charges_enabled) return;
    const tick = () => {
      if (document.visibilityState === "visible") void nachladen();
    };
    const id = setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [kontoId, status?.charges_enabled, nachladen]);

  /**
   * Die gespeicherten Angaben erneut an Stripe senden und den Stand neu lesen.
   *
   * Ohne diesen Knopf war die Karte eine Einbahnstrasse: Stripe pruefte einmal,
   * lehnte ab, und der Gastgeber hatte keinen Weg, eine korrigierte Angabe
   * erneut einzureichen — die Zustimmung war ja schon erteilt, der Knopf dafuer
   * damit verschwunden. Uebertragen wird der GESPEICHERTE Stand; es wird nichts
   * neu erfasst und nichts geraten (17.09.2026).
   */
  async function erneutPruefen() {
    setLaeuft(true);
    const res = await synceStammdaten();
    if (!res.ok) {
      setLaeuft(false);
      toast.error(res.fehler);
      return;
    }
    setSyncFehler(res.data.stripeSyncError ?? null);
    await nachladen();
    setLaeuft(false);
    // Kein „fertig", solange Stripe nicht freigeschaltet hat — sonst behauptet
    // der Hinweis einen Zustand, den die Liste darunter widerlegt.
    if (res.data.stripeSyncError) toast.error(res.data.stripeSyncError);
    else toast.info(t("seEingereicht"));
    router.refresh();
  }

  async function aktivieren() {
    if (!kontoId) return;
    setLaeuft(true);
    const res = await aktiviereAuszahlungen(kontoId);
    setLaeuft(false);
    if (!res.ok) {
      toast.error(res.fehler);
      return;
    }
    setStatus(res.data);
    setSyncFehler(res.syncFehler ?? null);
    setZustimmungOffen(false);
    // „Aktiviert" nur melden, wenn Stripe wirklich freigeschaltet hat — sonst
    // sagt der Toast „fertig", während das Konto weiter eingeschränkt ist.
    if (res.data.charges_enabled) toast.success(t("seAktiviert"));
    else if (res.syncFehler) toast.error(res.syncFehler);
    else toast.info(t("seEingereicht"));
    router.refresh();
  }

  const aktiv = !!status?.charges_enabled;
  // Eine BEANSTANDETE Angabe fehlt nicht — sie steht bei Stripe und wurde
  // geprueft und verworfen. Stripe stellt sie trotzdem wieder in
  // `currently_due`, weil sie erneut gebraucht wird. Sie unter „Jetzt faellig"
  // aufzufuehren behauptet, der Gastgeber habe etwas vergessen, und schickt ihn
  // auf die Suche nach Feldern, die er laengst ausgefuellt hat. Der Befund
  // steht stattdessen einmal unter „Von Stripe abgelehnt" (17.09.2026).
  const beanstandet = new Set((status?.errors ?? []).map((e) => e.requirement));
  const offenePfade = (
    status ? [...status.past_due, ...status.requirements] : []
  ).filter((r) => !beanstandet.has(r));
  const nurTos =
    offenePfade.length > 0 && offenePfade.every((r) => r.includes("tos_acceptance"));
  const offen = lesbar(offenePfade, t);
  const spaeter = lesbar(status?.eventually_due ?? [], t).filter(
    (s) => !offen.some((o) => o.label === s.label),
  );
  const pruefung = lesbar(status?.pending_verification ?? [], t);
  const bankOffen =
    !status ||
    [...status.past_due, ...status.requirements, ...status.eventually_due].some((r) =>
      r.includes("external_account"),
    );

  const schritte: {
    key: string;
    erledigt: boolean;
    href?: string;
    aktion?: "aktivieren";
  }[] = [
    {
      key: "seSchritt1",
      erledigt: vermieterdatenVollstaendig(profil),
      href: DATEN_HREF,
    },
    { key: "seSchritt2", erledigt: !!kontoId && !bankOffen, href: BANK_HREF },
    {
      key: "seSchritt3",
      erledigt: !!status && (status.details_submitted || aktiv),
      aktion: "aktivieren",
    },
    { key: "seSchritt4", erledigt: aktiv },
  ];

  const pill = aktiv
    ? { text: t("seStatusAktiv"), ton: "bg-emerald-100 text-emerald-800", icon: "solar:check-circle-bold" }
    : status?.past_due.length
      ? { text: t("seStatusGesperrt"), ton: "bg-rose-100 text-rose-800", icon: "solar:danger-bold" }
      : status?.pending_verification.length && !offen.length
        ? { text: t("seStatusPruefung"), ton: "bg-sky-100 text-sky-800", icon: "solar:hourglass-bold" }
        : { text: t("seStatusOffen"), ton: "bg-amber-100 text-amber-800", icon: "solar:clock-circle-bold" };

  const frist =
    status?.current_deadline != null
      ? new Date(status.current_deadline * 1000).toLocaleDateString(undefined, {
          day: "2-digit",
          month: "long",
          year: "numeric",
        })
      : null;
  // „Es fehlen noch Pflichtangaben" waere falsch, wenn nichts fehlt und alles
  // Faellige beanstandet ist: dann ist Stripes eigene Begruendung im Block
  // darunter die Aussage, und ein zweiter, widersprechender Satz daneben
  // verwirrt nur.
  const nurBeanstandet = offen.length === 0 && (status?.errors.length ?? 0) > 0;
  const grundText =
    status && !nurBeanstandet ? grund(status.disabled_reason, nurTos, t) : null;

  return (
    <section className="border-b border-border py-6">
      <div className="flex items-center justify-between gap-4">
        <p className="font-medium">{t("seTitel")}</p>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${pill.ton}`}
        >
          <Icon icon={pill.icon} className="size-3.5" />
          {pill.text}
        </span>
      </div>
      <p className="mt-1 max-w-xl text-[0.9375rem] text-muted-foreground">
        {t("seEinleitung")}
      </p>

      {/* Schritte */}
      <ol className="mt-6 space-y-3">
        {schritte.map((s, i) => (
          <li
            key={s.key}
            className="flex items-start gap-4 rounded-2xl border border-border p-4"
          >
            <span
              className={`flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                s.erledigt
                  ? "bg-emerald-100 text-emerald-800"
                  : "bg-muted text-foreground"
              }`}
            >
              {s.erledigt ? <Icon icon="ph:check-bold" className="size-4" /> : i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{t(s.key)}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {t(`${s.key}Text`)}
              </p>
            </div>
            {/* Schritt 2 fuehrt IMMER zur Bankverbindung — auch ohne Konto.
                Vorher stand hier ohne Konto nur der Satz „dein Konto entsteht,
                sobald E-Mail und Land in den Vermieterdaten stehen", und der
                Schritt war nicht anklickbar: ein Onboarding-Schritt ohne Weg
                nach vorn. Das Konto entsteht jetzt beim Speichern der
                Bankverbindung (16.09.2026). */}
            {!s.erledigt && s.href && (
              <Link
                href={s.href}
                className="shrink-0 text-[0.9375rem] font-medium underline underline-offset-4 hover:opacity-70"
              >
                {s.key === "seSchritt1" ? t("seZuDenDaten") : t("seZurBank")}
              </Link>
            )}
            {!s.erledigt && s.aktion === "aktivieren" && kontoId && status && (
              <button
                type="button"
                onClick={() => setZustimmungOffen(true)}
                disabled={laeuft}
                className="shrink-0 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {laeuft ? t("seAktivierenLaeuft") : t("seAktivieren")}
              </button>
            )}
          </li>
        ))}
      </ol>

      {/* Status-/Fehlerdetails — sichtbar, nie verschluckt */}
      {statusFehler && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-rose-50 p-4 text-[0.9375rem] text-rose-900">
          <span>{statusFehler}</span>
          <button
            type="button"
            onClick={() => void nachladen()}
            className="text-sm font-medium underline underline-offset-4"
          >
            {t("seErneutLaden")}
          </button>
        </div>
      )}

      {syncFehler && !aktiv && (
        <p className="mt-4 rounded-2xl bg-amber-50 p-4 text-[0.9375rem] text-amber-900">
          {t("seSyncFehler", { fehler: syncFehler })}
        </p>
      )}

      {grundText && !aktiv && (
        <p className="mt-4 text-[0.9375rem] text-muted-foreground">
          {grundText}
          {frist && <> {t("seFrist", { datum: frist })}</>}
        </p>
      )}

      {/* Erneut einreichen — auch dann, wenn die Zustimmung laengst erteilt
          ist und der Schritt-3-Knopf deshalb weg ist. */}
      {kontoId && !aktiv && status && status.details_submitted && (
        <button
          type="button"
          onClick={() => void erneutPruefen()}
          disabled={laeuft}
          className="mt-4 rounded-full bg-foreground px-7 py-3 text-sm font-medium text-background outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-foreground/20 disabled:opacity-40"
        >
          {laeuft ? t("seAktivierenLaeuft") : t("seAktivieren")}
        </button>
      )}

      {!aktiv && offen.length > 0 && !nurTos && (
        <Liste titel={t("seJetztFaellig")} eintraege={offen} ton="offen" />
      )}
      {!aktiv && pruefung.length > 0 && (
        <Liste titel={t("seInPruefung")} eintraege={pruefung} ton="pruefung" />
      )}
      {!aktiv && spaeter.length > 0 && (
        <Liste titel={t("seSpaeterFaellig")} eintraege={spaeter} ton="spaeter" />
      )}

      {status && status.errors.length > 0 && (
        <div className="mt-4 rounded-2xl border border-rose-200 p-4">
          <p className="text-sm font-medium text-rose-900">{t("seFehlerTitel")}</p>
          <ul className="mt-2 space-y-1.5 text-sm">
            {gebuendelt(status.errors, t).map((e) => (
              <li key={`${e.felder}-${e.code}`}>
                <span className="font-medium">{e.felder}</span>
                {" — "}
                <span className="text-muted-foreground">{e.reason}</span>{" "}
                <code className="text-[0.6875rem] text-muted-foreground/70">{e.code}</code>
              </li>
            ))}
          </ul>
        </div>
      )}

      {kontoId && (
        <p className="mt-4 text-xs text-muted-foreground/70">
          {t("seKontoKennung", { id: kontoId })}
        </p>
      )}

      {/* Zustimmung als Dialog: die Vereinbarung muss im Moment der Zustimmung
          sichtbar verlinkt sein (Stripe-Pflicht). Die IP für den Nachweis
          ermittelt das Backend aus dem Request — käme sie vom Client, wäre der
          Nachweis wertlos. */}
      <Dialog open={zustimmungOffen} onOpenChange={setZustimmungOffen}>
        <DialogContent>
          <div className="space-y-2">
            <DialogTitle>{t("seZustimmungTitel")}</DialogTitle>
            <DialogDescription>
              {t.rich("seZustimmungText", {
                link: (chunks) => (
                  <a
                    href={STRIPE_VEREINBARUNG}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2"
                  >
                    {chunks}
                  </a>
                ),
              })}
            </DialogDescription>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setZustimmungOffen(false)}
              className="rounded-full px-5 py-2.5 text-sm font-medium underline underline-offset-4 hover:opacity-70"
            >
              {t("abbrechen")}
            </button>
            <button
              type="button"
              onClick={() => void aktivieren()}
              disabled={laeuft}
              className="rounded-full bg-foreground px-6 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-90 disabled:opacity-40"
            >
              {laeuft ? t("seAktivierenLaeuft") : t("seZustimmungBestaetigen")}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

const TOENE = {
  offen: "border-rose-200 bg-rose-50/60",
  pruefung: "border-border bg-muted/40",
  spaeter: "border-border bg-muted/20",
} as const;

function Liste({
  titel,
  eintraege,
  ton,
}: {
  titel: string;
  eintraege: Anforderung[];
  ton: keyof typeof TOENE;
}) {
  return (
    <div className={`mt-4 rounded-2xl border p-4 ${TOENE[ton]}`}>
      <p className="text-sm font-medium">{titel}</p>
      <ul className="mt-2 space-y-2">
        {eintraege.map((e) => (
          <li key={e.pfad} className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
            {e.href && ton !== "pruefung" ? (
              <Link href={e.href} className="font-medium underline underline-offset-4 hover:opacity-70">
                {e.label}
              </Link>
            ) : (
              <span className="font-medium">{e.label}</span>
            )}
            {e.hinweis && <span className="text-muted-foreground">{e.hinweis}</span>}
            {/* Roher Stripe-Pfad: Debug-Angabe für den Support-Fall. */}
            <code className="text-[0.6875rem] text-muted-foreground/70">{e.pfad}</code>
          </li>
        ))}
      </ul>
    </div>
  );
}

"use client";

// Reservierungs-Assistent (3 Schritte): eigenständiger Drawer.
//  1) Reservierungsdetails: Art, Objekt, Zeitraum, Quelle, Gäste, Kontakt
//  2) Preise & Extras: Grundpreis, Aktion, Gebühren, Steuern, Add-ons → Summe
//  3) Richtlinien: Policy-Automation + Übersicht, dann Bestätigen
// Speichert über createReservation; das Backend belegt die Kalendertage.
// Art „Eigennutzung" (0241): der Aufenthalt belegt den Kalender wie eine
// Buchung, ist aber per Definition kein Umsatz — der Preis-Schritt entfällt
// vollständig, den Betrag 0 erzwingt der Server (DB-CHECK).
// Der Personenbezug einer Eigennutzung ist der hinterlegte EIGENTÜMER (0353,
// `reservations.owner_id`), nicht ein abgetippter Kontakt: jedes Objekt hat
// genau einen Eigentümer (unique, 0073), er ist damit aus dem gewählten Objekt
// eindeutig ableitbar und wird nur noch bestätigt, nicht erfasst.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";
import { Label } from "@nextdays/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@nextdays/ui/select";
import { Switch } from "@nextdays/ui/switch";
import { formatCurrency } from "@/lib/currency";
import { type Owner, getPropertyOwner } from "@/lib/owners";
import { type Quote, getQuote } from "@/lib/pricing";
import {
  type GuestBreakdown,
  type GuestContact,
  type ReservationChannel,
  createReservation,
} from "@/lib/reservations";

type WizardProp = {
  id: string;
  title: string;
};

// Schritte als Schlüssel statt als Index — bei Eigennutzung fällt „prices" weg.
type StepKey = "details" | "prices" | "policy";

// Der Kontakt-Block des Anlege-Contracts ist Pflicht, bei Eigennutzung aber
// gegenstandslos: leer heisst hier „kein Gast" — der Server erkennt daran, dass
// keine Gast-Zeile anzulegen ist, und nimmt den Eigentümer.
const LEERER_KONTAKT: GuestContact = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  country: "",
  language: "",
};

/** Vorbefüllbarer Kontakt (z. B. aus der Gästekarte). */
export type WizardInitialGuest = {
  first_name?: string | null;
  last_name?: string | null;
  email?: string | null;
  phone?: string | null;
  country?: string | null;
  language?: string | null;
};

export function ReservationWizard({
  open,
  onClose,
  onSaved,
  properties,
  initialPropertyId,
  checkIn,
  checkOut,
  basePrice,
  initialGuest,
  guestId,
  editableDates = false,
  initialOwnerStay = false,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  properties: WizardProp[];
  initialPropertyId: string;
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD (exklusiv)
  basePrice: number; // Grundpreis (Summe Übernachtungen) – Platzhalter erlaubt
  // Optional: aus der Gästekarte geöffnet → Kontakt vorbefüllen, festen Gast
  // verknüpfen (keine Dublette) und Zeitraum im Wizard wählbar machen.
  initialGuest?: WizardInitialGuest;
  guestId?: string;
  editableDates?: boolean;
  /** Aus dem Aktionsmenü „Eigennutzung eintragen" → Art vorbelegen. */
  initialOwnerStay?: boolean;
}) {
  const t = useTranslations("calendar");
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Schritt 1
  // Art des Aufenthalts: Gastbuchung oder Eigennutzung des Eigentümers (0241).
  const [ownerStay, setOwnerStay] = useState(initialOwnerStay);
  const [propertyId, setPropertyId] = useState(initialPropertyId);
  // Zeitraum: aus dem Kalender vorgegeben; aus der Gästekarte im Wizard wählbar.
  const [checkInState, setCheckInState] = useState(checkIn);
  const [checkOutState, setCheckOutState] = useState(checkOut);
  const [channel, setChannel] = useState<ReservationChannel>("direct");
  const [source, setSource] = useState("");
  // Wer wohnt da wirklich? Eine Eigennutzung ist NICHT zwangsläufig der
  // Eigentümer selbst — er sperrt den Zeitraum genauso für seine Kinder, für
  // Freunde oder für Handwerker. Der Eigentümer ist nur der Vorschlag; steht
  // hier ein anderer Name, gilt der. Ohne dieses Feld zeigte der Balken bei
  // jeder Eigennutzung dasselbe „Eigentümer-Aufenthalt", und ein Objekt ohne
  // hinterlegten Eigentümer liess sich gar nicht belegen.
  const [aufenthaltName, setAufenthaltName] = useState("");
  const [aufenthaltNotiz, setAufenthaltNotiz] = useState("");
  const [guests, setGuests] = useState<GuestBreakdown>({
    adults: 1,
    children: 0,
    infants: 0,
    pets: 0,
  });
  const [contact, setContact] = useState<GuestContact>({
    first_name: initialGuest?.first_name ?? "",
    last_name: initialGuest?.last_name ?? "",
    email: initialGuest?.email ?? "",
    phone: initialGuest?.phone ?? "",
    country: initialGuest?.country ?? "",
    language: initialGuest?.language ?? "",
  });

  // Der hinterlegte Eigentümer des gewählten Objekts (Art „Eigennutzung").
  // Genau einer je Objekt (unique 0073) — er wird ermittelt und bestätigt,
  // nicht gesucht oder eingetippt.
  //
  // Drei Zustände, die NICHT zusammenfallen dürfen: am Laden, Ladefehler
  // (fehlende Berechtigung → 403, Netzfehler) und geladen. `owner === null`
  // heisst „für dieses Objekt ist keiner hinterlegt"; einen Ladefehler als
  // genau diese Aussage auszugeben wäre eine Falschaussage (Wurzel 4/5).
  const [owner, setOwner] = useState<Owner | null>(null);
  const [ownerLoading, setOwnerLoading] = useState(false);
  const [ownerError, setOwnerError] = useState<string | null>(null);

  // Erst laden, wenn „Eigennutzung" wirklich gewählt ist — eine Gastbuchung
  // braucht die Eigentümer-Stammdaten nicht. Beim Objektwechsel neu auflösen:
  // ein stehengebliebener Eigentümer gehörte zum vorherigen Objekt.
  useEffect(() => {
    if (!open || !ownerStay || !propertyId) return;
    let cancelled = false;
    setOwnerLoading(true);
    setOwnerError(null);
    setOwner(null);
    getPropertyOwner(propertyId).then((res) => {
      if (cancelled) return;
      setOwnerLoading(false);
      if (res.ok) setOwner(res.data);
      else setOwnerError(res.error);
    });
    return () => {
      cancelled = true;
    };
  }, [open, ownerStay, propertyId]);

  // Eine Eigennutzung ohne Eigentümer gibt es nicht: das Backend verlangt
  // entweder einen Gast oder einen Eigentümer (0353, CHECK
  // `reservations_owner_stay_person`). Solange keiner feststeht, geht es nicht
  // weiter — statt den Nutzer erst am Ende in einen 422 laufen zu lassen.
  // Ohne hinterlegten Eigentümer geht es trotzdem, SOFERN ein Name dasteht:
  // eine Eigennutzung ist nicht zwangsläufig der Eigentümer selbst (Kinder,
  // Freunde, Handwerker), und ein Objekt ohne gepflegten Eigentümer war sonst
  // gar nicht belegbar. Ganz ohne Personenbezug bleibt es gesperrt — dann
  // stünde auf dem Balken wieder nur „Eigentümer-Aufenthalt" (Wurzel 4: kein
  // erfundener Platzhalter).
  const ownerBlockiert = ownerStay && !owner && !aufenthaltName.trim();

  // Schritt 2 (Preise) — automatisch aus dem zentralen Resolver (Quote). Der
  // Nutzer kann jeden Wert weiterhin manuell überschreiben; `touched` schützt
  // editierte Felder davor, vom nächsten Quote überschrieben zu werden.
  const [roomRate, setRoomRate] = useState(basePrice);
  const [promotion, setPromotion] = useState(0);
  const [fees, setFees] = useState(0);
  const [taxes, setTaxes] = useState(0);
  const [touched, setTouched] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoting, setQuoting] = useState(false);

  // Quote laden, sobald Objekt/Zeitraum/Gäste/Kanal feststehen (und solange der
  // Nutzer die Preisfelder nicht selbst angefasst hat). Eine Preis-Wahrheit:
  // dieselbe Berechnung wie Kalender + Buchung.
  useEffect(() => {
    // Eigennutzung hat keinen Preis — dann gar nicht erst quoten.
    if (!open || touched || ownerStay) return;
    const validNights = countNights(checkInState, checkOutState) > 0;
    if (!propertyId || !validNights) return;
    let cancelled = false;
    setQuoting(true);
    getQuote({
      property_id: propertyId,
      check_in: checkInState,
      check_out: checkOutState,
      guests: guests.adults + guests.children + guests.infants,
      pets: guests.pets,
      channel,
    }).then((res) => {
      if (cancelled) return;
      setQuoting(false);
      if (!res.ok) return;
      setQuote(res.data);
      // Quote-Positionen auf die vier Anzeige-Felder abbilden (Übernachtung+
      // Aufschläge = Grundpreis; Rabatt; Gebühren; Steuern).
      const sum = (pred: (l: { label: string; amount: number }) => boolean) =>
        res.data.lines.filter(pred).reduce((s, l) => s + l.amount, 0);
      const isTax = (l: { label: string }) =>
        /steuer|mwst|ust|vat/i.test(l.label);
      const isFee = (l: { label: string }) =>
        /gebühr|reinigung|fee|kurtaxe/i.test(l.label);
      const isDiscount = (l: { amount: number }) => l.amount < 0;
      setPromotion(-sum(isDiscount));
      setFees(sum((l) => isFee(l) && l.amount > 0));
      setTaxes(sum((l) => isTax(l) && l.amount > 0));
      setRoomRate(
        sum(
          (l) => l.amount > 0 && !isFee(l) && !isTax(l),
        ),
      );
    });
    return () => {
      cancelled = true;
    };
  }, [open, touched, ownerStay, propertyId, checkInState, checkOutState, guests, channel]);

  // Eigennutzung ist per Definition 0 — der Server erzwingt das zusätzlich.
  const total = useMemo(
    () => (ownerStay ? 0 : Math.max(0, roomRate - promotion + fees + taxes)),
    [ownerStay, roomRate, promotion, fees, taxes],
  );

  // Schritt 3 (Policy)
  const [policyOn, setPolicyOn] = useState(true);

  if (!open) return null;

  const nights = countNights(checkInState, checkOutState);
  const rangeLabel = `${fmt(checkInState)} – ${fmt(checkOutState)} · ${nights} Nacht${nights > 1 ? "e" : ""}`;
  const datesValid = nights > 0;

  async function confirm() {
    if (!datesValid) {
      setError("Bitte einen gültigen Zeitraum wählen (Abreise nach Anreise).");
      setStep(0);
      return;
    }
    // Eigennutzung ohne aufgelösten Eigentümer wird gar nicht erst abgeschickt:
    // ohne Personenbezug lehnt der Server ab (0353), und stillschweigend auf
    // einen Gast auszuweichen wäre die falsche Belegungsart.
    if (ownerBlockiert) {
      setError(ownerError ?? t("wizard.ownerMissing"));
      setStep(0);
      return;
    }
    setSaving(true);
    setError(null);
    const res = await createReservation({
      property_id: propertyId,
      check_in: checkInState,
      check_out: checkOutState,
      // Eigennutzung ist keine Portalbuchung — sie läuft immer über „direct".
      channel: ownerStay ? "direct" : channel,
      source,
      guests,
      // Bei Eigennutzung gibt es keinen Gast-Kontakt: der Personenbezug ist
      // `owner_id`. Ein mitgeschickter Kontakt legte sonst neben dem
      // Eigentümer noch eine Gast-Zeile in der Gästekartei an.
      contact: ownerStay ? LEERER_KONTAKT : contact,
      total_amount: total,
      status: "confirmed",
      ...(ownerStay
        ? {
          is_owner_stay: true as const,
          // Der Eigentümer bleibt der VERTRAGLICHE Bezug (Abrechnung,
          // Kontingent) — auch wenn die anwesende Person eine andere ist.
          ...(owner ? { owner_id: owner.id } : {}),
          // WER wirklich da wohnt und WARUM. Leer lassen heisst leer, nicht
          // „Eigentümer" (Wurzel 4) — der Balken zeigt dann sein Status-Label.
          ...(aufenthaltName.trim()
            ? { stay_name: aufenthaltName.trim() }
            : {}),
          ...(aufenthaltNotiz.trim()
            ? { stay_note: aufenthaltNotiz.trim() }
            : {}),
        }
        : {}),
      // Aus der Gästekarte: festen Gast verknüpfen (keine Dublette). Bei
      // Eigennutzung nicht — dort ist der Eigentümer die Person.
      ...(guestId && !ownerStay ? { guest_id: guestId } : {}),
    });
    setSaving(false);
    if (res.ok) {
      onSaved();
      onClose();
    } else {
      setError(res.error);
    }
  }

  // Schrittfolge: bei Eigennutzung entfällt „Preise & Extras" komplett — es gibt
  // dort nichts einzugeben, der Betrag ist per Definition 0.
  const STEP_KEYS: StepKey[] = ownerStay
    ? ["details", "policy"]
    : ["details", "prices", "policy"];
  const STEPS = STEP_KEYS.map((k) => t(`wizard.steps.${k}`));
  // Nach dem Umschalten auf Eigennutzung kann `step` hinter der kürzeren Folge
  // liegen — auf den letzten gültigen Schritt klemmen statt leer zu rendern.
  const stepIndex = Math.min(step, STEP_KEYS.length - 1);
  const stepKey = STEP_KEYS[stepIndex];
  const isLastStep = stepIndex === STEP_KEYS.length - 1;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Overlay */}
      <button
        type="button"
        aria-label={t("wizard.close")}
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative z-10 flex h-full w-full max-w-[28rem] flex-col bg-card shadow-xl">
        {/* Kopf */}
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div>
            <h2 className="font-display text-xl font-extrabold">
              {t(`wizard.headings.${stepKey}`)}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{rangeLabel}</p>
          </div>
          <Button variant="outline" size="icon" onClick={onClose} aria-label={t("wizard.close")}>
            <Icon icon="ph:x" className="size-4" />
          </Button>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-2 px-5 py-3">
          {STEPS.map((label, i) => (
            <div key={label} className="flex flex-1 items-center gap-2">
              <span
                className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${i < stepIndex
                    ? "bg-accent text-white"
                    : i === stepIndex
                      ? "border-2 border-accent text-accent"
                      : "border-2 border-muted text-muted-foreground"
                  }`}
              >
                {i < stepIndex ? <Icon icon="ph:check" className="size-3.5" /> : i + 1}
              </span>
              {i < STEPS.length - 1 && (
                <span className={`h-0.5 flex-1 rounded ${i < stepIndex ? "bg-accent" : "bg-muted"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Inhalt */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {stepKey === "details" && (
            <div className="flex flex-col gap-5">
              {/* Art des Aufenthalts (0241): Gastbuchung oder Eigennutzung. Die
                  Wahl entscheidet, ob es überhaupt einen Preis-Schritt gibt. */}
              <Section title={t("wizard.stayKind")}>
                <div className="grid grid-cols-2 gap-2">
                  <KindOption
                    icon="ph:user-circle"
                    label={t("wizard.stayKindGuest")}
                    active={!ownerStay}
                    onClick={() => setOwnerStay(false)}
                  />
                  <KindOption
                    icon="ph:house-line"
                    label={t("wizard.stayKindOwner")}
                    active={ownerStay}
                    onClick={() => setOwnerStay(true)}
                  />
                </div>
                {ownerStay && (
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    {t("wizard.ownerStayHint")}
                  </p>
                )}
              </Section>

              <Section title="Buchungsinformationen">
                <Field label="Objekt">
                  <Select value={propertyId} onValueChange={setPropertyId}>
                    <SelectTrigger>
                      <SelectValue placeholder={t("wizard.chooseProperty")} />
                    </SelectTrigger>
                    <SelectContent>
                      {properties.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                {editableDates ? (
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Anreise">
                      <Input
                        type="date"
                        value={checkInState}
                        onChange={(e) => setCheckInState(e.target.value)}
                      />
                    </Field>
                    <Field label="Abreise">
                      <Input
                        type="date"
                        value={checkOutState}
                        min={checkInState}
                        onChange={(e) => setCheckOutState(e.target.value)}
                      />
                    </Field>
                  </div>
                ) : (
                  <Field label="Zeitraum">
                    <div className="rounded-(--radius) border bg-muted/30 px-3 py-2 text-sm">
                      {fmt(checkInState)} – {fmt(checkOutState)}
                    </div>
                  </Field>
                )}
                {/* Kanal nur bei Gastbuchungen — eine Eigennutzung kommt von
                    keinem Vertriebskanal. */}
                {!ownerStay && (
                  <Field label="Quelle">
                    <Select value={channel} onValueChange={(v) => setChannel(v as ReservationChannel)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="direct">Direkt</SelectItem>
                        <SelectItem value="booking">Booking.com</SelectItem>
                        <SelectItem value="airbnb">Airbnb</SelectItem>
                        <SelectItem value="vrbo">Vrbo</SelectItem>
                        <SelectItem value="portal">Portal</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                )}
                <Field label={t("wizard.sourceNote")}>
                  <Input
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    placeholder={t("wizard.sourceNotePlaceholder")}
                  />
                </Field>
              </Section>

              <Section title={t("wizard.guestsLabel")}>
                <Counter label="Erwachsene" hint="ab 13 Jahre" value={guests.adults} min={1} onChange={(v) => setGuests((g) => ({ ...g, adults: v }))} />
                <Counter label="Kinder" hint="2–12 Jahre" value={guests.children} onChange={(v) => setGuests((g) => ({ ...g, children: v }))} />
                <Counter label="Kleinkinder" hint="unter 2" value={guests.infants} onChange={(v) => setGuests((g) => ({ ...g, infants: v }))} />
                <Counter label="Haustiere" value={guests.pets} onChange={(v) => setGuests((g) => ({ ...g, pets: v }))} />
              </Section>

              {/* Eigennutzung: der Eigentümer steht in den Stammdaten und wird
                  hier nur BESTÄTIGT. Ein Eingabeformular an dieser Stelle hieße,
                  eine bereits gepflegte Person ein zweites Mal zu erfassen. */}
              {ownerStay ? (
                <Section title={t("wizard.ownerSection")}>
                  {ownerLoading && (
                    <p className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Icon icon="ph:circle-notch" className="size-3.5 animate-spin" />
                      {t("wizard.ownerLoading")}
                    </p>
                  )}
                  {!ownerLoading && ownerError && (
                    <div className="rounded-(--radius) border border-destructive/40 bg-destructive/10 p-3">
                      <p className="text-xs font-semibold text-destructive">
                        {t("wizard.ownerLoadFailed")}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {ownerError}
                      </p>
                    </div>
                  )}
                  {/* „Keiner hinterlegt" wird NUR nach erfolgreichem Laden
                      gesagt — nach einem Fehler wissen wir es schlicht nicht. */}
                  {!ownerLoading && !ownerError && !owner && (
                    <div className="rounded-(--radius) border border-amber-500/40 bg-amber-500/10 p-3">
                      <p className="text-xs font-semibold">
                        {t("wizard.ownerMissing")}
                      </p>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {t("wizard.ownerMissingHint")}
                      </p>
                      <Link
                        href="/eigentuemer"
                        className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-accent underline underline-offset-2"
                      >
                        <Icon icon="ph:arrow-square-out" className="size-3.5" />
                        {t("wizard.ownerMissingLink")}
                      </Link>
                    </div>
                  )}
                  {!ownerLoading && !ownerError && owner && (
                    <div className="flex flex-col gap-2 rounded-(--radius) border bg-muted/30 p-3">
                      <div className="flex items-center gap-2">
                        <Icon icon="ph:house-line" className="size-4 text-muted-foreground" />
                        <p className="text-sm font-semibold">{owner.name}</p>
                      </div>
                      {owner.company && (
                        <OwnerDetailRow
                          icon="ph:buildings"
                          value={owner.company}
                        />
                      )}
                      {owner.email && (
                        <OwnerDetailRow icon="ph:envelope-simple" value={owner.email} />
                      )}
                      {owner.phone && (
                        <OwnerDetailRow icon="ph:phone" value={owner.phone} />
                      )}
                      {owner.country && (
                        <OwnerDetailRow icon="ph:globe-hemisphere-west" value={owner.country} />
                      )}
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {t("wizard.ownerFromRecord")}
                      </p>
                    </div>
                  )}
                  {/* WER wohnt da — und WARUM. Der Eigentümer oben ist der
                      Vertragspartner, nicht zwingend die anwesende Person:
                      derselbe Zeitraum geht an seine Kinder, an Freunde oder
                      an einen Handwerker. Beides steht später auf dem
                      Kalenderbalken, damit man im Juli noch weiss, warum das
                      Objekt im August zu ist. */}
                  <Field label={t("wizard.stayNameLabel")}>
                    <Input
                      value={aufenthaltName}
                      onChange={(e) => setAufenthaltName(e.target.value)}
                      placeholder={owner?.name ?? t("wizard.stayNamePlaceholder")}
                      maxLength={120}
                    />
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {t("wizard.stayNameHint")}
                    </p>
                  </Field>
                  <Field label={t("wizard.stayNoteLabel")}>
                    <Input
                      value={aufenthaltNotiz}
                      onChange={(e) => setAufenthaltNotiz(e.target.value)}
                      placeholder={t("wizard.stayNotePlaceholder")}
                      maxLength={500}
                    />
                  </Field>
                </Section>
              ) : (
                <Section title={t("wizard.guestContact")}>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Vorname">
                      <Input value={contact.first_name} onChange={(e) => setContact((c) => ({ ...c, first_name: e.target.value }))} />
                    </Field>
                    <Field label="Nachname">
                      <Input value={contact.last_name} onChange={(e) => setContact((c) => ({ ...c, last_name: e.target.value }))} />
                    </Field>
                  </div>
                  <Field label="E-Mail">
                    <Input type="email" value={contact.email} onChange={(e) => setContact((c) => ({ ...c, email: e.target.value }))} />
                  </Field>
                  <Field label="Telefon">
                    <Input value={contact.phone} onChange={(e) => setContact((c) => ({ ...c, phone: e.target.value }))} />
                  </Field>
                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Land">
                      <Input value={contact.country} onChange={(e) => setContact((c) => ({ ...c, country: e.target.value }))} />
                    </Field>
                    <Field label="Sprache">
                      <Input value={contact.language} onChange={(e) => setContact((c) => ({ ...c, language: e.target.value }))} placeholder="Deutsch" />
                    </Field>
                  </div>
                </Section>
              )}
            </div>
          )}

          {stepKey === "prices" && (
            <div className="flex flex-col gap-4">
              {quoting && !touched && (
                <p className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Icon icon="ph:circle-notch" className="size-3.5 animate-spin" />
                  Preis wird berechnet…
                </p>
              )}
              {quote?.priceless && !touched && (
                <p className="rounded-(--radius) bg-amber-50 p-3 text-xs text-amber-900">
                  Für dieses Objekt ist im Zeitraum kein Preis hinterlegt (kein
                  Basispreis/Saisonpreis). Bitte manuell festlegen.
                </p>
              )}
              <PriceRow
                label="Grundpreis"
                hint={`${nights} Nacht${nights > 1 ? "e" : ""}${quote && !touched ? " · automatisch berechnet" : ""}`}
                value={roomRate}
                onChange={(v) => { setTouched(true); setRoomRate(v); }}
              />
              <PriceRow label={t("wizard.actionDiscount")} value={promotion} onChange={(v) => { setTouched(true); setPromotion(v); }} negative />
              <PriceRow label={t("wizard.fees")} hint={t("wizard.feesHint")} value={fees} onChange={(v) => { setTouched(true); setFees(v); }} />
              <PriceRow label="Steuern" hint="USt." value={taxes} onChange={(v) => { setTouched(true); setTaxes(v); }} />
              {quote && !touched && quote.lines.length > 0 && (
                <div className="mt-1 flex flex-col gap-1 rounded-(--radius) border bg-muted/30 p-3">
                  <p className="mb-1 text-xs font-semibold text-muted-foreground">{t("wizard.breakdown")}</p>
                  {quote.lines.map((l) => (
                    <div key={l.label} className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{l.label}</span>
                      <span className={l.amount < 0 ? "text-emerald-700" : ""}>{formatCurrency(l.amount, quote.currency)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {stepKey === "policy" && (
            <div className="flex flex-col gap-5">
              {/* Richtlinien steuern Anzahlung/Mahnung — bei einer Eigennutzung
                  gibt es weder das eine noch das andere. */}
              {!ownerStay && (
                <Section title="Richtlinien-Automatik">
                  <label className="flex cursor-pointer items-center justify-between gap-3 rounded-(--radius) border p-3 text-sm">
                    <span>{t("wizard.quotePolicyAdmin")}</span>
                    <Switch checked={policyOn} onCheckedChange={setPolicyOn} />
                  </label>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Bei aktivierten Richtlinien verwaltet myNextDays den Ablauf automatisch:
                    Anzahlungen berechnen, an überfällige Zahlungen erinnern und über
                    Statusänderungen informieren.
                  </p>
                </Section>
              )}

              <Section title={t("wizard.overview")}>
                <SummaryRow
                  label={t("wizard.stayKind")}
                  value={ownerStay ? t("wizard.stayKindOwner") : t("wizard.stayKindGuest")}
                />
                <SummaryRow label="Objekt" value={properties.find((p) => p.id === propertyId)?.title ?? "—"} />
                <SummaryRow label="Zeitraum" value={`${fmt(checkInState)} – ${fmt(checkOutState)}`} />
                <SummaryRow label={t("wizard.guests")} value={t("wizard.personsValue", { count: guests.adults + guests.children })} />
                <SummaryRow
                  label={ownerStay ? t("wizard.ownerLabel") : "Gast"}
                  value={
                    ownerStay
                      ? (owner?.name ?? "—")
                      : `${contact.first_name} ${contact.last_name}`.trim() || "—"
                  }
                />
              </Section>

              {ownerStay && (
                <p className="rounded-(--radius) border bg-secondary/40 p-3 text-xs leading-relaxed text-muted-foreground">
                  {t("wizard.ownerStayHint")}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Fußzeile: Total + Navigation. Bei Eigennutzung entfällt die Summe —
            sie ist per Definition 0, eine „0,00 €"-Zeile suggeriert dagegen
            einen Preis, der nur gerade nicht gefüllt ist. */}
        <div className="border-t px-5 py-4">
          {!ownerStay && (
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Gesamt</span>
              <span className="font-display text-lg font-extrabold">{formatCurrency(total, quote?.currency)}</span>
            </div>
          )}
          {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
          <div className="flex gap-3">
            {stepIndex > 0 ? (
              <Button variant="outline" className="flex-1" onClick={() => setStep(stepIndex - 1)} disabled={saving}>
                Zurück
              </Button>
            ) : (
              <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>
                Abbrechen
              </Button>
            )}
            {!isLastStep ? (
              <Button
                className="flex-1"
                onClick={() => setStep(stepIndex + 1)}
                disabled={ownerBlockiert}
              >
                Weiter
              </Button>
            ) : (
              <Button
                className="flex-1"
                onClick={confirm}
                disabled={saving || ownerBlockiert}
              >
                {saving ? "Speichern…" : "Bestätigen"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Hilfs-Bausteine -------------------------------------------------------

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <p className="text-sm font-semibold">{title}</p>
      {children}
    </section>
  );
}

/** Auswahlkachel für die Art des Aufenthalts (Gastbuchung / Eigennutzung). */
function KindOption({
  icon,
  label,
  active,
  onClick,
}: {
  icon: string;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex flex-col items-start gap-1.5 rounded-(--radius) border-2 p-3 text-left text-sm font-medium transition-colors ${
        active
          ? "border-accent bg-accent/10 text-foreground"
          : "border-border text-muted-foreground hover:bg-secondary/60"
      }`}
    >
      <Icon icon={icon} className="size-5" />
      {label}
    </button>
  );
}

/** Eine Kontaktzeile des ermittelten Eigentümers — Anzeige, keine Eingabe. */
function OwnerDetailRow({ icon, value }: { icon: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <Icon icon={icon} className="size-3.5 shrink-0" />
      <span className="break-all">{value}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function Counter({
  label,
  hint,
  value,
  min = 0,
  onChange,
}: {
  label: string;
  hint?: string;
  value: number;
  min?: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="leading-tight">
        <p className="text-sm">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" className="size-8" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label="weniger">
          <Icon icon="ph:minus" className="size-4" />
        </Button>
        <span className="w-5 text-center text-sm">{value}</span>
        <Button variant="outline" size="icon" className="size-8" onClick={() => onChange(value + 1)} aria-label="mehr">
          <Icon icon="ph:plus" className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function PriceRow({
  label,
  hint,
  value,
  onChange,
  negative,
}: {
  label: string;
  hint?: string;
  value: number;
  onChange: (v: number) => void;
  negative?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b pb-3">
      <div className="leading-tight">
        <p className="text-sm font-medium">{label}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="flex items-center gap-1">
        {negative && value > 0 && <span className="text-sm text-muted-foreground">−</span>}
        <Input
          type="number"
          min={0}
          value={value}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="w-28 text-right"
        />
      </div>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

// --- Format-Helfer ---------------------------------------------------------

function countNights(checkIn: string, checkOut: string): number {
  const a = new Date(checkIn);
  const b = new Date(checkOut);
  return Math.max(1, Math.round((b.getTime() - a.getTime()) / 86400000));
}

function fmt(iso: string): string {
  const d = new Date(iso);
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()}`;
}

"use client";

// Reservierungs-Assistent (3 Schritte): eigenständiger Drawer.
//  1) Reservierungsdetails: Objekt, Zeitraum, Quelle, Gäste, Kontakt
//  2) Preise & Extras: Grundpreis, Aktion, Gebühren, Steuern, Add-ons → Summe
//  3) Richtlinien: Policy-Automation + Übersicht, dann Bestätigen
// Speichert über createReservation; das Backend belegt die Kalendertage.
import { Icon } from "@iconify/react";
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
}) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Schritt 1
  const [propertyId, setPropertyId] = useState(initialPropertyId);
  // Zeitraum: aus dem Kalender vorgegeben; aus der Gästekarte im Wizard wählbar.
  const [checkInState, setCheckInState] = useState(checkIn);
  const [checkOutState, setCheckOutState] = useState(checkOut);
  const [channel, setChannel] = useState<ReservationChannel>("direct");
  const [source, setSource] = useState("");
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
    if (!open || touched) return;
    const validNights = countNights(checkInState, checkOutState) > 0;
    if (!propertyId || !validNights) return;
    let cancelled = false;
    setQuoting(true);
    getQuote({
      property_id: propertyId,
      check_in: checkInState,
      check_out: checkOutState,
      guests: guests.adults + guests.children + guests.infants,
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
  }, [open, touched, propertyId, checkInState, checkOutState, guests, channel]);

  const total = useMemo(
    () => Math.max(0, roomRate - promotion + fees + taxes),
    [roomRate, promotion, fees, taxes],
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
    setSaving(true);
    setError(null);
    const res = await createReservation({
      property_id: propertyId,
      check_in: checkInState,
      check_out: checkOutState,
      channel,
      source,
      guests,
      contact,
      total_amount: total,
      status: "confirmed",
      // Aus der Gästekarte: festen Gast verknüpfen (keine Dublette).
      ...(guestId ? { guest_id: guestId } : {}),
    });
    setSaving(false);
    if (res.ok) {
      onSaved();
      onClose();
    } else {
      setError(res.error);
    }
  }

  const STEPS = ["Details", "Preise & Extras", "Richtlinien"];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Overlay */}
      <button
        type="button"
        aria-label="Schließen"
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative z-10 flex h-full w-full max-w-[28rem] flex-col bg-card shadow-xl">
        {/* Kopf */}
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div>
            <h2 className="font-display text-xl font-extrabold">
              {step === 0 && "Reservierungsdetails"}
              {step === 1 && "Preise & Extras festlegen"}
              {step === 2 && "Richtlinien festlegen"}
            </h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{rangeLabel}</p>
          </div>
          <Button variant="outline" size="icon" onClick={onClose} aria-label="Schließen">
            <Icon icon="ph:x" className="size-4" />
          </Button>
        </div>

        {/* Stepper */}
        <div className="flex items-center gap-2 px-5 py-3">
          {STEPS.map((label, i) => (
            <div key={label} className="flex flex-1 items-center gap-2">
              <span
                className={`flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${i < step
                    ? "bg-accent text-white"
                    : i === step
                      ? "border-2 border-accent text-accent"
                      : "border-2 border-muted text-muted-foreground"
                  }`}
              >
                {i < step ? <Icon icon="ph:check" className="size-3.5" /> : i + 1}
              </span>
              {i < STEPS.length - 1 && (
                <span className={`h-0.5 flex-1 rounded ${i < step ? "bg-accent" : "bg-muted"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Inhalt */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {step === 0 && (
            <div className="flex flex-col gap-5">
              <Section title="Buchungsinformationen">
                <Field label="Objekt">
                  <Select value={propertyId} onValueChange={setPropertyId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Objekt wählen" />
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
                <Field label="Notiz zur Quelle (optional)">
                  <Input
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    placeholder="z. B. Telefon, Stammgast …"
                  />
                </Field>
              </Section>

              <Section title="Gäste">
                <Counter label="Erwachsene" hint="ab 13 Jahre" value={guests.adults} min={1} onChange={(v) => setGuests((g) => ({ ...g, adults: v }))} />
                <Counter label="Kinder" hint="2–12 Jahre" value={guests.children} onChange={(v) => setGuests((g) => ({ ...g, children: v }))} />
                <Counter label="Kleinkinder" hint="unter 2" value={guests.infants} onChange={(v) => setGuests((g) => ({ ...g, infants: v }))} />
                <Counter label="Haustiere" value={guests.pets} onChange={(v) => setGuests((g) => ({ ...g, pets: v }))} />
              </Section>

              <Section title="Kontaktdaten des Gastes">
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
            </div>
          )}

          {step === 1 && (
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
              <PriceRow label="Aktion / Rabatt" value={promotion} onChange={(v) => { setTouched(true); setPromotion(v); }} negative />
              <PriceRow label="Gebühren" hint="Reinigung etc." value={fees} onChange={(v) => { setTouched(true); setFees(v); }} />
              <PriceRow label="Steuern" hint="USt." value={taxes} onChange={(v) => { setTouched(true); setTaxes(v); }} />
              {quote && !touched && quote.lines.length > 0 && (
                <div className="mt-1 flex flex-col gap-1 rounded-(--radius) border bg-muted/30 p-3">
                  <p className="mb-1 text-xs font-semibold text-muted-foreground">Aufschlüsselung</p>
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

          {step === 2 && (
            <div className="flex flex-col gap-5">
              <Section title="Richtlinien-Automatik">
                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-(--radius) border p-3 text-sm">
                  <span>Angebots- und Richtlinien-Verwaltung</span>
                  <Switch checked={policyOn} onCheckedChange={setPolicyOn} />
                </label>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Bei aktivierten Richtlinien verwaltet myNextDays den Ablauf automatisch:
                  Anzahlungen berechnen, an überfällige Zahlungen erinnern und über
                  Statusänderungen informieren.
                </p>
              </Section>

              <Section title="Übersicht">
                <SummaryRow label="Objekt" value={properties.find((p) => p.id === propertyId)?.title ?? "—"} />
                <SummaryRow label="Zeitraum" value={`${fmt(checkInState)} – ${fmt(checkOutState)}`} />
                <SummaryRow label="Gäste" value={`${guests.adults + guests.children} Pers.`} />
                <SummaryRow label="Gast" value={`${contact.first_name} ${contact.last_name}`.trim() || "—"} />
              </Section>
            </div>
          )}
        </div>

        {/* Fußzeile: Total + Navigation */}
        <div className="border-t px-5 py-4">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Gesamt</span>
            <span className="font-display text-lg font-extrabold">{formatCurrency(total, quote?.currency)}</span>
          </div>
          {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
          <div className="flex gap-3">
            {step > 0 ? (
              <Button variant="outline" className="flex-1" onClick={() => setStep((s) => s - 1)} disabled={saving}>
                Zurück
              </Button>
            ) : (
              <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>
                Abbrechen
              </Button>
            )}
            {step < 2 ? (
              <Button className="flex-1" onClick={() => setStep((s) => s + 1)}>
                Weiter
              </Button>
            ) : (
              <Button className="flex-1" onClick={confirm} disabled={saving}>
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

"use client";

// Angebots-Assistent (Lastenheft §2.2, 0586): ein Drawer, ein Schritt.
//
// WARUM NICHT DER RESERVIERUNGS-WIZARD MIT EINEM SCHALTER: Der legt eine
// BUCHUNG an — Kalendertage werden belegt, Aufgaben entstehen, Automails
// laufen los. Ein Angebot tut nichts davon: es reserviert nichts und ist
// jederzeit noch keine Buchung. Bis 07.09.2026 fiel die Menü-Aktion „Angebot"
// genau in diesen Wizard (der Dispatch behandelte `reservation_quote` nicht),
// und wer ein Angebot schicken wollte, buchte fest.
//
// Der Preis wird NICHT eingegeben, sondern angezeigt: er kommt aus demselben
// zentralen Resolver, der auch das Angebot serverseitig rechnet (Wurzel 3).
// Die Vorschau hier ist reine Anzeige — verbindlich ist, was der Server beim
// Anlegen in den Snapshot schreibt.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";
import { Label } from "@nextdays/ui/label";
import { Textarea } from "@nextdays/ui/textarea";
import { createOffer, sendOffer } from "@/lib/booking-offers";
import { formatCurrency } from "@/lib/currency";
import { type Quote, getQuote } from "@/lib/pricing";

type WizardProp = { id: string; title: string };

// Vorschlag für die Gültigkeit. Sieben Tage sind die übliche Verhandlungsfrist
// und der Standardwert des Backends (`BookingOfferCreate.gueltig_tage`).
const GUELTIG_VORGABE = 7;

export function AngebotsWizard({
  open,
  onClose,
  onSaved,
  properties,
  initialPropertyId,
  checkIn,
  checkOut,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  properties: WizardProp[];
  initialPropertyId: string;
  checkIn: string;
  checkOut: string;
}) {
  const t = useTranslations("angebote");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [pets, setPets] = useState(0);
  const [gueltigTage, setGueltigTage] = useState(GUELTIG_VORGABE);
  const [anzahlung, setAnzahlung] = useState("");
  const [notiz, setNotiz] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteFehler, setQuoteFehler] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [speichert, setSpeichert] = useState(false);

  const objekt = useMemo(
    () => properties.find((p) => p.id === initialPropertyId),
    [properties, initialPropertyId],
  );
  const naechte = useMemo(() => {
    const von = new Date(`${checkIn}T00:00:00Z`).getTime();
    const bis = new Date(`${checkOut}T00:00:00Z`).getTime();
    return Math.max(Math.round((bis - von) / 86_400_000), 0);
  }, [checkIn, checkOut]);

  // Vorschau laden, sobald Objekt, Zeitraum oder Gästezahl feststehen. Der
  // Kanal ist „website" wie beim Server — ein anderer Kanal hätte einen
  // anderen Markup und damit eine Vorschau, die nicht zum Angebot passt.
  useEffect(() => {
    if (!open) return;
    let aktuell = true;
    setQuoteFehler(null);
    getQuote({
      property_id: initialPropertyId,
      check_in: checkIn,
      check_out: checkOut,
      guests: Math.max(adults + children, 1),
      pets,
      channel: "website",
    }).then((res) => {
      if (!aktuell) return;
      if (res.ok) {
        setQuote(res.data);
        // Ein Objekt ohne bepreisbaren Tag: kein Angebot möglich, und die
        // Vorschau zeigt keine 0 (kein erfundener Preis, Wurzel 4).
        if (res.data.priceless) setQuoteFehler(t("fehler.keinPreis"));
      } else {
        setQuote(null);
        setQuoteFehler(res.error);
      }
    });
    return () => {
      aktuell = false;
    };
  }, [open, initialPropertyId, checkIn, checkOut, adults, children, pets, t]);

  if (!open) return null;

  const anzahlungZahl = anzahlung.trim() === "" ? null : Number(anzahlung);
  const anzahlungUngueltig =
    anzahlungZahl !== null &&
    (Number.isNaN(anzahlungZahl) ||
      anzahlungZahl <= 0 ||
      (quote != null && anzahlungZahl > quote.total));
  const bereit =
    name.trim().length > 0 &&
    email.includes("@") &&
    naechte > 0 &&
    quote != null &&
    !quote.priceless &&
    !anzahlungUngueltig;

  async function senden() {
    setSpeichert(true);
    setFehler(null);
    const angelegt = await createOffer({
      property_id: initialPropertyId,
      check_in: checkIn,
      check_out: checkOut,
      adults,
      children,
      pets,
      guest_name: name.trim(),
      guest_email: email.trim(),
      guest_phone: phone.trim() || null,
      gueltig_tage: gueltigTage,
      deposit_amount: anzahlungZahl,
      internal_note: notiz.trim() || null,
    });
    if (!angelegt.ok) {
      setFehler(angelegt.error);
      setSpeichert(false);
      return;
    }
    // Anlegen und Senden sind zwei Schritte im Backend (ein Angebot kann als
    // Entwurf liegen bleiben). Hier gehören sie zusammen: der Betrieb klickt
    // „Angebot senden", nicht „Entwurf anlegen". Scheitert der Versand, bleibt
    // das Angebot als Entwurf bestehen — der Fehler sagt, was zu tun ist.
    const verschickt = await sendOffer(angelegt.data.id);
    setSpeichert(false);
    if (!verschickt.ok) {
      setFehler(t("fehler.entwurfAngelegt", { grund: verschickt.error }));
      onSaved();
      return;
    }
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label={t("schliessen")}
        className="absolute inset-0 bg-black/30"
        onClick={onClose}
      />
      <div className="relative z-10 flex h-full w-full max-w-[28rem] flex-col bg-card shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b px-5 py-4">
          <div>
            <h2 className="font-display text-xl font-extrabold">{t("wizard.titel")}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {objekt?.title} · {t("wizard.naechte", { anzahl: naechte })}
            </p>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={onClose}
            aria-label={t("schliessen")}
          >
            <Icon icon="ph:x" className="size-4" />
          </Button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-4">
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">{t("wizard.gast")}</h3>
            <div className="space-y-1.5">
              <Label htmlFor="angebot-name">{t("felder.name")}</Label>
              <Input
                id="angebot-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("felder.namePlatzhalter")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="angebot-email">{t("felder.email")}</Label>
              <Input
                id="angebot-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="gast@example.com"
              />
              <p className="text-xs text-muted-foreground">{t("felder.emailHinweis")}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="angebot-phone">{t("felder.telefon")}</Label>
              <Input
                id="angebot-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1.5">
                <Label htmlFor="angebot-adults">{t("felder.erwachsene")}</Label>
                <Input
                  id="angebot-adults"
                  type="number"
                  min={1}
                  value={adults}
                  onChange={(e) => setAdults(Math.max(Number(e.target.value) || 1, 1))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="angebot-children">{t("felder.kinder")}</Label>
                <Input
                  id="angebot-children"
                  type="number"
                  min={0}
                  value={children}
                  onChange={(e) => setChildren(Math.max(Number(e.target.value) || 0, 0))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="angebot-pets">{t("felder.tiere")}</Label>
                <Input
                  id="angebot-pets"
                  type="number"
                  min={0}
                  value={pets}
                  onChange={(e) => setPets(Math.max(Number(e.target.value) || 0, 0))}
                />
              </div>
            </div>
          </section>

          <section className="space-y-2 rounded-(--radius) border bg-secondary/30 p-3">
            <h3 className="text-sm font-semibold">{t("wizard.preis")}</h3>
            {quoteFehler && (
              <p className="text-sm text-destructive">{quoteFehler}</p>
            )}
            {quote && !quote.priceless && (
              <>
                <ul className="space-y-1 text-sm">
                  {quote.lines.map((zeile) => (
                    <li key={`${zeile.label}-${zeile.amount}`} className="flex justify-between gap-3">
                      <span className="text-muted-foreground">{zeile.label}</span>
                      <span>{formatCurrency(zeile.amount, quote.currency)}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex justify-between gap-3 border-t pt-2 text-sm font-semibold">
                  <span>{t("wizard.summe")}</span>
                  <span>{formatCurrency(quote.total, quote.currency)}</span>
                </div>
                <p className="text-xs text-muted-foreground">{t("wizard.preisHinweis")}</p>
              </>
            )}
            {!quote && !quoteFehler && (
              <p className="text-sm text-muted-foreground">{t("wizard.preisLaedt")}</p>
            )}
          </section>

          <section className="space-y-3">
            <h3 className="text-sm font-semibold">{t("wizard.bedingungen")}</h3>
            <div className="space-y-1.5">
              <Label htmlFor="angebot-frist">{t("felder.gueltigTage")}</Label>
              <Input
                id="angebot-frist"
                type="number"
                min={1}
                max={90}
                value={gueltigTage}
                onChange={(e) =>
                  setGueltigTage(Math.min(Math.max(Number(e.target.value) || 1, 1), 90))
                }
              />
              <p className="text-xs text-muted-foreground">{t("felder.gueltigHinweis")}</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="angebot-anzahlung">{t("felder.anzahlung")}</Label>
              <Input
                id="angebot-anzahlung"
                type="number"
                min={0}
                step="0.01"
                value={anzahlung}
                onChange={(e) => setAnzahlung(e.target.value)}
                placeholder={t("felder.anzahlungPlatzhalter")}
              />
              {anzahlungUngueltig ? (
                <p className="text-xs text-destructive">{t("fehler.anzahlung")}</p>
              ) : (
                <p className="text-xs text-muted-foreground">{t("felder.anzahlungHinweis")}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="angebot-notiz">{t("felder.notiz")}</Label>
              <Textarea
                id="angebot-notiz"
                value={notiz}
                onChange={(e) => setNotiz(e.target.value)}
                rows={2}
              />
              <p className="text-xs text-muted-foreground">{t("felder.notizHinweis")}</p>
            </div>
          </section>

          <p className="rounded-(--radius) border border-dashed px-3 py-2 text-xs text-muted-foreground">
            {t("wizard.keineReservierung")}
          </p>
        </div>

        <div className="space-y-2 border-t px-5 py-4">
          {fehler && <p className="text-sm text-destructive">{fehler}</p>}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} className="flex-1">
              {t("abbrechen")}
            </Button>
            <Button onClick={senden} disabled={!bereit || speichert} className="flex-1">
              {speichert ? t("wizard.sendet") : t("wizard.senden")}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

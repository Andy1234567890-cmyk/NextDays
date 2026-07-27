"use client";

// Wizard „Steuerinformationen hinzufügen" (Airbnb-Vorbild: Modal → Schritte).
//
// Drei Schritte:
//   1. Land/Region wählen
//   2. Natürliche Person oder Unternehmen?
//   3. Die Felder, die für diese Kombination nötig sind
//
// Die fachliche Prüfung macht der SERVER (Pydantic + DB-Constraint 0226) — die
// UI führt nur durch die Schritte und zeigt die Backend-Meldung, wenn etwas
// fehlt. So kann die UI nicht behaupten, etwas sei in Ordnung, was der Server
// ablehnt.
import { Icon } from "@iconify/react";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@nextdays/ui/button";
import { Dialog, DialogClose, DialogContent } from "@nextdays/ui/dialog";
import { Input } from "@nextdays/ui/input";

import { SuchAuswahl } from "@/components/ui/such-auswahl";
import { alleLaender, landName } from "@/lib/laender";
import type {
  LandRegel,
  TaxpayerEntry,
  TaxpayerInput,
  TaxpayerKind,
} from "@/lib/steuern";
import { getLaenderRegeln } from "@/lib/steuern";
import { speichereSteuerangaben } from "@/lib/steuern-actions";
import type { TaxpayerOverview } from "@/lib/steuern";

type Schritt = "land" | "art" | "felder";

/** Reihenfolge der Schritte — daraus wird der Fortschritt abgeleitet, statt
 *  ihn an zweiter Stelle zu pflegen (sonst laufen beide auseinander). */
const SCHRITTE: readonly Schritt[] = ["land", "art", "felder"] as const;

export function SteuerWizard({
  offen,
  onClose,
  onGespeichert,
  vorbelegtesLand,
  bearbeiten,
}: {
  offen: boolean;
  onClose: () => void;
  onGespeichert: (uebersicht: TaxpayerOverview) => void;
  /** Vorauswahl, wenn der Nutzer auf ein fehlendes Land klickt. */
  vorbelegtesLand?: string;
  /** Gesetzt = Korrektur eines bestehenden Eintrags (Land steht dann fest). */
  bearbeiten?: TaxpayerEntry;
}) {
  const [schritt, setSchritt] = useState<Schritt>(
    bearbeiten ? "felder" : vorbelegtesLand ? "art" : "land",
  );
  const [land, setLand] = useState(bearbeiten?.country ?? vorbelegtesLand ?? "");
  const [art, setArt] = useState<TaxpayerKind>(bearbeiten?.kind ?? "entity");
  const [werte, setWerte] = useState<Partial<TaxpayerInput>>(
    bearbeiten
      ? {
          tin: bearbeiten.tin,
          first_name: bearbeiten.first_name,
          last_name: bearbeiten.last_name,
          date_of_birth: bearbeiten.date_of_birth,
          birth_place_city: bearbeiten.birth_place_city,
          birth_place_country: bearbeiten.birth_place_country,
          legal_name: bearbeiten.legal_name,
          business_registration_number: bearbeiten.business_registration_number,
          address_line1: bearbeiten.address_line1,
          address_line2: bearbeiten.address_line2,
          postal_code: bearbeiten.postal_code,
          city: bearbeiten.city,
        }
      : {},
  );
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  // Die wählbaren Steuerländer kommen aus `tax_country_rules` — eine zweite
  // Liste im Frontend liefe zwangsläufig auseinander (Wurzel 4). Der Name wird
  // aus dem ISO-Code gerendert, gespeichert bleibt nur der Code.
  const [regeln, setRegeln] = useState<LandRegel[] | null>(null);
  useEffect(() => {
    if (!offen) return;
    let aktiv = true;
    void getLaenderRegeln().then((r) => {
      if (aktiv) setRegeln(r);
    });
    return () => {
      aktiv = false;
    };
  }, [offen]);

  const steuerLaender = useMemo(
    () =>
      (regeln ?? [])
        .map((r) => ({ code: r.country, name: landName(r.country) }))
        .sort((a, b) => a.name.localeCompare(b.name, "de")),
    [regeln],
  );

  // Geburtsland ist NICHT auf die Steuerländer begrenzt: wer in Brasilien
  // geboren ist und in Spanien vermietet, muss beides angeben können.
  const geburtsLaender = useMemo(() => alleLaender(), []);

  function setzeWert(feld: keyof TaxpayerInput, wert: string) {
    setWerte((v) => ({ ...v, [feld]: wert || null }));
  }

  async function speichern() {
    setLaeuft(true);
    setFehler(null);
    const res = await speichereSteuerangaben({
      ...werte,
      country: land,
      kind: art,
    } as TaxpayerInput);
    setLaeuft(false);
    if (!res.ok) {
      setFehler(res.error);
      return;
    }
    onGespeichert(res.uebersicht);
    onClose();
  }

  const istPerson = art === "individual";

  // Nur die Schritte zählen, die dieser Durchlauf wirklich hat: kommt der
  // Nutzer über „Land ergänzen", ist die Landauswahl schon erledigt. Sonst
  // stünde dauerhaft „Schritt 2 von 3", ohne dass Schritt 1 je erscheint.
  const aktiveSchritte = vorbelegtesLand
    ? SCHRITTE.filter((s) => s !== "land")
    : SCHRITTE;
  const schrittNr = aktiveSchritte.indexOf(schritt) + 1;

  // Beim Bearbeiten steht das Land fest, und ein vorbelegtes Land überspringt
  // Schritt 1 — in beiden Fällen gibt es dahinter nichts, wohin man zurück
  // könnte. Ein Pfeil, der nur schließt, wäre irreführend.
  const zurueckMoeglich =
    !bearbeiten &&
    (schritt === "felder" || (schritt === "art" && !vorbelegtesLand));

  function zurueck() {
    setFehler(null);
    if (schritt === "felder") setSchritt("art");
    else if (schritt === "art") setSchritt("land");
  }

  return (
    <Dialog open={offen} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="max-w-[34rem] rounded-3xl p-0"
        showCloseButton={false}
      >
        {/* Kopf wie bei Airbnb: links zurück im Fluss, rechts schließen —
            zwei getrennte Bedeutungen, darum zwei getrennte Stellen. Ein
            zweites X neben dem des Dialogs wäre doppelt. */}
        <div className="flex items-center justify-between gap-2 px-6 pb-3 pt-4">
          {zurueckMoeglich ? (
            <button
              type="button"
              onClick={zurueck}
              aria-label="Zurück"
              className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Icon icon="ph:arrow-left" className="size-5" />
            </button>
          ) : (
            <span className="size-7" />
          )}
          <h3 className="font-display text-base font-bold">
            {bearbeiten
              ? "Steuerinformationen bearbeiten"
              : "Steuerinformationen hinzufügen"}
          </h3>
          <DialogClose
            aria-label="Schließen"
            className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Icon icon="ph:x" className="size-5" />
          </DialogClose>
        </div>

        {/* Fortschritt. Beim Bearbeiten entfällt er: dort gibt es nur einen
            Schritt, ein Balken bei 100 % wäre eine Attrappe. */}
        {!bearbeiten && (
          <div className="px-6 pb-4">
            <div
              className="h-1 overflow-hidden rounded-full bg-muted"
              role="progressbar"
              aria-valuenow={schrittNr}
              aria-valuemin={1}
              aria-valuemax={aktiveSchritte.length}
              aria-label={`Schritt ${schrittNr} von ${aktiveSchritte.length}`}
            >
              <div
                className="h-full rounded-full bg-foreground transition-[width] duration-300"
                style={{ width: `${(schrittNr / aktiveSchritte.length) * 100}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Schritt {schrittNr} von {aktiveSchritte.length}
            </p>
          </div>
        )}

        <div className="max-h-[60vh] overflow-y-auto border-t border-border px-6 py-6">
          {schritt === "land" && (
            <div className="flex flex-col gap-4">
              <p className="text-[0.9375rem] text-foreground">
                Wähle zuerst das Land oder die Region, für die du deine
                Steuerinformationen hinterlegst.
              </p>
              <p className="text-sm text-muted-foreground">
                Als Buchungsplattform sind wir verpflichtet, diese Angaben zu
                erheben und jährlich an die Steuerbehörde zu melden.
              </p>
              <label className="flex flex-col gap-2">
                <span className="text-sm font-medium">Land/Region</span>
                <SuchAuswahl
                  optionen={steuerLaender.map((l) => ({
                    wert: l.code,
                    label: l.name,
                    stichworte: l.code,
                  }))}
                  wert={land}
                  onChange={setLand}
                  platzhalter={regeln === null ? "Wird geladen …" : "Bitte wählen"}
                  suchPlatzhalter="Land suchen …"
                />
              </label>
            </div>
          )}

          {schritt === "art" && (
            <div className="flex flex-col gap-4">
              <p className="text-[0.9375rem] text-foreground">
                Vermietest du als Privatperson oder als Unternehmen?
              </p>
              {(
                [
                  {
                    wert: "individual" as const,
                    titel: "Privatperson",
                    text: "Du vermietest als natürliche Person.",
                  },
                  {
                    wert: "entity" as const,
                    titel: "Unternehmen",
                    text: "Du vermietest über eine Firma oder Gesellschaft.",
                  },
                ] satisfies { wert: TaxpayerKind; titel: string; text: string }[]
              ).map((o) => (
                <button
                  key={o.wert}
                  type="button"
                  onClick={() => setArt(o.wert)}
                  className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors ${
                    art === o.wert
                      ? "border-foreground bg-muted"
                      : "border-border hover:bg-muted/60"
                  }`}
                >
                  <span
                    className={`mt-1 size-4 shrink-0 rounded-full border-2 ${
                      art === o.wert
                        ? "border-foreground bg-foreground"
                        : "border-muted-foreground"
                    }`}
                  />
                  <span className="flex flex-col gap-1">
                    <span className="text-[0.9375rem] font-medium">
                      {o.titel}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {o.text}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          )}

          {schritt === "felder" && (
            <div className="flex flex-col gap-4">
              {istPerson ? (
                <>
                  <Feld
                    label="Vorname"
                    wert={werte.first_name}
                    onChange={(v) => setzeWert("first_name", v)}
                  />
                  <Feld
                    label="Nachname"
                    wert={werte.last_name}
                    onChange={(v) => setzeWert("last_name", v)}
                  />
                  <Feld
                    label="Geburtsdatum"
                    typ="date"
                    wert={werte.date_of_birth}
                    onChange={(v) => setzeWert("date_of_birth", v)}
                  />
                </>
              ) : (
                <>
                  <Feld
                    label="Firmenname"
                    wert={werte.legal_name}
                    onChange={(v) => setzeWert("legal_name", v)}
                  />
                  <Feld
                    label="Handelsregisternummer"
                    hinweis="Optional, z. B. HRB 12345"
                    wert={werte.business_registration_number}
                    onChange={(v) =>
                      setzeWert("business_registration_number", v)
                    }
                  />
                </>
              )}

              <Feld
                label="Steueridentifikationsnummer"
                hinweis={
                  istPerson
                    ? "Falls dein Land keine vergibt, gib stattdessen den Geburtsort an."
                    : undefined
                }
                wert={werte.tin}
                onChange={(v) => setzeWert("tin", v)}
              />

              {istPerson && !werte.tin && (
                <div className="flex flex-col gap-4 rounded-2xl bg-muted/60 p-4">
                  <p className="text-sm text-muted-foreground">
                    Ohne Steueridentifikationsnummer brauchen wir deinen
                    Geburtsort.
                  </p>
                  <Feld
                    label="Geburtsort"
                    wert={werte.birth_place_city}
                    onChange={(v) => setzeWert("birth_place_city", v)}
                  />
                  <label className="flex flex-col gap-2">
                    <span className="text-sm font-medium">Geburtsland</span>
                    <SuchAuswahl
                      optionen={geburtsLaender.map((l) => ({
                        wert: l.code,
                        label: l.name,
                        stichworte: l.code,
                      }))}
                      wert={werte.birth_place_country ?? ""}
                      onChange={(v) => setzeWert("birth_place_country", v)}
                      suchPlatzhalter="Land suchen …"
                    />
                  </label>
                </div>
              )}

              <div className="mt-2 border-t border-border pt-4">
                <p className="mb-4 text-sm font-medium">Anschrift</p>
                <div className="flex flex-col gap-4">
                  <Feld
                    label="Straße und Hausnummer"
                    wert={werte.address_line1}
                    onChange={(v) => setzeWert("address_line1", v)}
                  />
                  <Feld
                    label="Adresszusatz"
                    hinweis="Optional"
                    wert={werte.address_line2}
                    onChange={(v) => setzeWert("address_line2", v)}
                  />
                  <div className="flex gap-4">
                    <div className="w-1/3">
                      <Feld
                        label="PLZ"
                        wert={werte.postal_code}
                        onChange={(v) => setzeWert("postal_code", v)}
                      />
                    </div>
                    <div className="flex-1">
                      <Feld
                        label="Ort"
                        wert={werte.city}
                        onChange={(v) => setzeWert("city", v)}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Mit dem Speichern bestätigst du, dass diese Angaben richtig und
                vollständig sind.
              </p>
            </div>
          )}

          {fehler && (
            <p className="mt-4 flex items-start gap-2 text-sm text-destructive">
              <Icon
                icon="solar:danger-triangle-line-duotone"
                className="mt-0.5 size-4 shrink-0"
              />
              {fehler}
            </p>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-border px-6 py-4">
          <button
            type="button"
            onClick={() => (zurueckMoeglich ? zurueck() : onClose())}
            className="text-sm font-medium underline underline-offset-4"
          >
            {zurueckMoeglich ? "Zurück" : "Abbrechen"}
          </button>
          {schritt === "felder" ? (
            <Button onClick={() => void speichern()} disabled={laeuft}>
              {laeuft ? "Wird gespeichert …" : "Speichern"}
            </Button>
          ) : (
            <Button
              onClick={() => setSchritt(schritt === "land" ? "art" : "felder")}
              disabled={schritt === "land" && !land}
            >
              Weiter
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Feld({
  label,
  hinweis,
  wert,
  typ = "text",
  onChange,
}: {
  label: string;
  hinweis?: string;
  wert?: string | null;
  typ?: string;
  onChange: (wert: string) => void;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      <Input
        type={typ}
        value={wert ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
      {hinweis && (
        <span className="text-xs text-muted-foreground">{hinweis}</span>
      )}
    </label>
  );
}

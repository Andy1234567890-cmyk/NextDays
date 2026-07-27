"use client";

// Der Vollbild-Wizard für Steuerangaben (Airbnb-Vorbild
// /account-settings/taxes/taxpayers/global/create).
//
// Aufbau wie dort: „Beenden" oben links, der Inhalt zentriert in der
// Bildmitte, eine feste Fußleiste mit Fortschritt links und „Weiter" rechts.
//
// Die FACHLICHEN Regeln kommen vom Server (`/taxpayer/laender`), nicht aus
// diesem Code: welche Nummer ein Land erwartet, ob der Geburtsort sie
// ersetzen darf und was eine fehlende Nummer kostet, ist geldwirksam und
// ändert sich per Gesetz. Eine zweite Kopie im Client liefe auseinander
// (Wurzel 4).
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";

import { SuchAuswahl } from "@/components/ui/such-auswahl";
import { alleLaender, landName } from "@/lib/laender";
import type { LandRegel, TaxpayerInput, TaxpayerKind } from "@/lib/steuern";
import { speichereSteuerangaben } from "@/lib/steuern-actions";

type Schritt = "land" | "art" | "felder" | "bestaetigen";

// Der letzte Schritt ist die SELBSTAUSKUNFT. DAC7 verlangt sie ausdrücklich:
// der Anbieter erklärt, dass die Angaben richtig sind. Ohne diesen Schritt
// wäre `confirmed_at` in der Datenbank eine Behauptung ohne Grundlage.
//
// Airbnb löst das mit einer GETIPPTEN Namenssignatur, nicht mit einer
// Checkbox (Hilfeartikel 3166: „Typing your name acts as your signature and
// certifies that you have capacity to sign"). Das ist bewusst höherschwellig
// als ein Haken — man muss den eigenen Namen schreiben.
const SCHRITTE: readonly Schritt[] = [
  "land",
  "art",
  "felder",
  "bestaetigen",
] as const;

/** Anzeigename der erwarteten Nummer. Ein Mexikaner kennt keine „TIN". */
const ID_NAME: Record<string, string> = {
  tin: "Steueridentifikationsnummer",
  ssn: "Social Security Number (SSN)",
  itin: "ITIN",
  ein: "Employer Identification Number (EIN)",
  rfc: "RFC",
  curp: "CURP",
  pan: "PAN",
  gstin: "GSTIN",
  rut: "RUT",
  abn: "ABN",
  vat: "Umsatzsteuer-Identifikationsnummer",
};

/** Basispunkte lesbar machen: 10 → „0,1 %", 2000 → „20 %". */
function satz(bps: number): string {
  return `${(bps / 100).toLocaleString("de-DE", { maximumFractionDigits: 2 })} %`;
}

export function SteuerVollbildWizard({
  laender,
  gruppe,
}: {
  laender: LandRegel[];
  /** Vorauswahl aus dem Start-Popup: us | national | global. */
  gruppe: string;
}) {
  const router = useRouter();

  // Die Auswahl im Popup schränkt die Länderliste ein — sie ersetzt sie
  // nicht: welches Land welchem Regime zugeordnet ist, weiß der Server.
  const auswahl = useMemo(() => {
    const passt = (r: LandRegel) =>
      gruppe === "us"
        ? r.regime === "us_irs"
        : gruppe === "national"
          ? r.regime === "national" && r.required_ids.length > 0
          : r.regime === "oecd_dpi";
    return laender
      .filter(passt)
      .map((r) => ({ ...r, name: landName(r.country) }))
      .sort((a, b) => a.name.localeCompare(b.name, "de"));
  }, [laender, gruppe]);

  // Geburtsland kennt keine Regime-Grenze — jemand kann in Brasilien geboren
  // sein und in Spanien vermieten. Deshalb die volle ISO-Liste.
  const geburtsLaender = useMemo(() => alleLaender(), []);

  const [schritt, setSchritt] = useState<Schritt>(
    auswahl.length === 1 ? "art" : "land",
  );
  const [land, setLand] = useState(
    auswahl.length === 1 ? auswahl[0].country : "",
  );
  const [art, setArt] = useState<TaxpayerKind>("entity");
  const [werte, setWerte] = useState<Partial<TaxpayerInput>>({});
  const [fehler, setFehler] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  const regel = auswahl.find((r) => r.country === land) ?? null;
  const istPerson = art === "individual";

  // Bleibt nur EIN Land übrig (z. B. „United States"), entfällt die Auswahl —
  // ein Schritt mit genau einer Option wäre eine leere Klickstrecke.
  const aktiveSchritte = useMemo(
    () =>
      auswahl.length === 1
        ? SCHRITTE.filter((s) => s !== "land")
        : SCHRITTE,
    [auswahl.length],
  );
  const schrittNr = aktiveSchritte.indexOf(schritt) + 1;
  // Die Selbstauskunft: der getippte Name gilt als Unterschrift.
  const [signatur, setSignatur] = useState("");
  // Rückfrage beim Abbruch (Airbnb-Muster): Wer den Wizard verlässt, verliert
  // seine Eingaben — und ohne Steuernummer greift in vielen Ländern der höhere
  // Satz. Das ist zu teuer für einen versehentlichen Klick.
  const [abbruchOffen, setAbbruchOffen] = useState(false);

  function setzeWert(feld: keyof TaxpayerInput, wert: string) {
    setWerte((v) => ({ ...v, [feld]: wert || null }));
  }

  // Navigation über die Schrittliste statt fest verdrahteter Übergänge:
  // ein neuer Schritt in SCHRITTE wird so automatisch erreichbar, statt an
  // zwei Stellen nachgezogen werden zu müssen (Wurzel 1).
  function weiter() {
    setFehler(null);
    const naechster = aktiveSchritte[aktiveSchritte.indexOf(schritt) + 1];
    if (naechster) setSchritt(naechster);
  }

  function zurueck() {
    setFehler(null);
    const vorheriger = aktiveSchritte[aktiveSchritte.indexOf(schritt) - 1];
    if (vorheriger) setSchritt(vorheriger);
    else setAbbruchOffen(true);
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
    router.push("/konto?bereich=steuern");
  }

  const weiterMoeglich =
    schritt === "land" ? Boolean(land) : schritt === "art" ? Boolean(art) : true;

  // Die Signatur muss zum angegebenen Namen passen. Ein beliebiges Zeichen
  // würde die Selbstauskunft zur Formalie machen — sie soll bewusst sein.
  const erwarteterName = (
    istPerson
      ? `${werte.first_name ?? ""} ${werte.last_name ?? ""}`
      : (werte.legal_name ?? "")
  )
    .trim()
    .toLowerCase();
  const signaturPasst =
    erwarteterName.length > 0 &&
    signatur.trim().toLowerCase() === erwarteterName;

  return (
    <div className="flex min-h-screen flex-col">
      {/* Kopf: nur „Beenden" — kein Menü, aus dem man wegklicken kann. */}
      <header className="px-6 py-6">
        <button
          type="button"
          onClick={() => setAbbruchOffen(true)}
          className="rounded-full bg-muted px-5 py-2.5 text-sm font-semibold transition-colors hover:bg-muted/70"
        >
          Beenden
        </button>
      </header>

      {/* Inhalt: zentriert in der Bildmitte wie bei Airbnb. */}
      <main className="flex flex-1 justify-center px-6">
        <div className="w-full max-w-2xl pt-12">
          {schritt === "land" && (
            <>
              <h1 className="font-display text-[2.5rem] font-bold leading-tight tracking-tight">
                Wähle dein Land oder deine Region
              </h1>
              <p className="mt-3 text-[1.0625rem] text-muted-foreground">
                Sag uns, wo du steuerlich ansässig bist oder wo deine Objekte
                liegen.
              </p>

              <label className="mt-10 flex flex-col gap-2">
                <span className="text-sm font-medium">Land/Region</span>
                {/* Suche statt nativer Liste: Der ISO-Code kommt als
                    Stichwort mit, damit „DE" genauso findet wie
                    „Deutschland". */}
                <SuchAuswahl
                  optionen={auswahl.map((l) => ({
                    wert: l.country,
                    label: l.name,
                    stichworte: l.country,
                  }))}
                  wert={land}
                  onChange={setLand}
                  suchPlatzhalter="Land suchen …"
                />
              </label>
            </>
          )}

          {schritt === "art" && (
            <>
              <h1 className="font-display text-[2.5rem] font-bold leading-tight tracking-tight">
                Vermietest du privat oder als Unternehmen?
              </h1>
              <p className="mt-3 text-[1.0625rem] text-muted-foreground">
                Danach richtet sich, welche Angaben wir brauchen.
              </p>

              <div className="mt-10 flex flex-col">
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
                      text: "Du vermietest über eine Firma oder einen anderen Rechtsträger.",
                    },
                  ]
                ).map((o) => (
                  <label
                    key={o.wert}
                    className="flex cursor-pointer items-start gap-4 border-b border-border py-5 last:border-b-0"
                  >
                    <input
                      type="radio"
                      name="art"
                      checked={art === o.wert}
                      onChange={() => setArt(o.wert)}
                      className="mt-0.5 size-5 shrink-0 accent-foreground"
                    />
                    <span className="flex flex-col gap-1">
                      <span className="text-[1.0625rem] font-medium">
                        {o.titel}
                      </span>
                      <span className="text-[0.9375rem] text-muted-foreground">
                        {o.text}
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            </>
          )}

          {schritt === "felder" && regel && (
            <>
              <h1 className="font-display text-[2.5rem] font-bold leading-tight tracking-tight">
                Deine Steuerangaben für {landName(land)}
              </h1>

              {/* Was eine fehlende Nummer KOSTET — der Gastgeber soll das
                  wissen, bevor er das Feld leer lässt, nicht danach.
                  Wir behalten NICHTS ein: der höhere Satz trifft ihn beim
                  Finanzamt, nicht bei uns. Genau so muss es dastehen. */}
              {regel.host_tax_bps_without_id != null &&
                regel.host_tax_bps_without_id > 0 && (
                  <p className="mt-4 flex items-start gap-2 rounded-2xl bg-amber-500/10 p-4 text-[0.9375rem]">
                    <Icon
                      icon="solar:danger-triangle-line-duotone"
                      className="mt-0.5 size-5 shrink-0"
                    />
                    <span>
                      Ohne gültige Nummer schuldest du in{" "}
                      {landName(land)}{" "}
                      <strong>{satz(regel.host_tax_bps_without_id)}</strong>{" "}
                      auf deine Einnahmen
                      {regel.host_tax_bps_with_id != null &&
                        ` statt ${satz(regel.host_tax_bps_with_id)}`}
                      . Wir ziehen davon nichts ab — du führst die Steuer
                      selbst ab.
                    </span>
                  </p>
                )}

              <div className="mt-10 flex flex-col gap-6">
                {istPerson ? (
                  <>
                    <Feld label="Vorname">
                      <Input
                        value={werte.first_name ?? ""}
                        onChange={(e) => setzeWert("first_name", e.target.value)}
                      />
                    </Feld>
                    <Feld label="Nachname">
                      <Input
                        value={werte.last_name ?? ""}
                        onChange={(e) => setzeWert("last_name", e.target.value)}
                      />
                    </Feld>
                    <Feld label="Geburtsdatum">
                      <Input
                        type="date"
                        value={werte.date_of_birth ?? ""}
                        onChange={(e) =>
                          setzeWert("date_of_birth", e.target.value)
                        }
                      />
                    </Feld>
                  </>
                ) : (
                  <>
                    <Feld label="Firmenname">
                      <Input
                        value={werte.legal_name ?? ""}
                        onChange={(e) => setzeWert("legal_name", e.target.value)}
                      />
                    </Feld>
                    <Feld
                      label="Handelsregisternummer"
                      hinweis="Optional, z. B. HRB 12345"
                    >
                      <Input
                        value={werte.business_registration_number ?? ""}
                        onChange={(e) =>
                          setzeWert(
                            "business_registration_number",
                            e.target.value,
                          )
                        }
                      />
                    </Feld>
                  </>
                )}

                {/* Die erwartete Nummer kommt aus der Landesregel — in Ländern
                    ohne geforderte ID erscheint das Feld gar nicht. */}
                {regel.required_ids.length > 0 && (
                  <Feld
                    label={ID_NAME[regel.required_ids[0]] ?? "Steuernummer"}
                    hinweis={
                      regel.birthplace_substitutes_id && istPerson
                        ? "Wenn du keine hast, gib stattdessen deinen Geburtsort an."
                        : undefined
                    }
                  >
                    <Input
                      value={werte.tin ?? ""}
                      onChange={(e) => setzeWert("tin", e.target.value)}
                    />
                  </Feld>
                )}

                {/* Geburtsort NUR dort, wo er die Nummer wirklich ersetzen
                    darf (OECD/DAC7). In den USA gäbe es hier nichts zu
                    ersetzen — das Feld erschiene fälschlich als Ausweg. */}
                {regel.birthplace_substitutes_id && istPerson && !werte.tin && (
                  <div className="grid gap-6 sm:grid-cols-2">
                    <Feld label="Geburtsort">
                      <Input
                        value={werte.birth_place_city ?? ""}
                        onChange={(e) =>
                          setzeWert("birth_place_city", e.target.value)
                        }
                      />
                    </Feld>
                    <Feld label="Geburtsland">
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
                    </Feld>
                  </div>
                )}

                <div className="border-t border-border pt-6">
                  <h2 className="font-display text-xl font-bold">Anschrift</h2>
                  <div className="mt-4 flex flex-col gap-6">
                    <Feld label="Straße und Hausnummer">
                      <Input
                        value={werte.address_line1 ?? ""}
                        onChange={(e) =>
                          setzeWert("address_line1", e.target.value)
                        }
                      />
                    </Feld>
                    <div className="grid gap-6 sm:grid-cols-[10rem_1fr]">
                      <Feld label="Postleitzahl">
                        <Input
                          value={werte.postal_code ?? ""}
                          onChange={(e) =>
                            setzeWert("postal_code", e.target.value)
                          }
                        />
                      </Feld>
                      <Feld label="Ort">
                        <Input
                          value={werte.city ?? ""}
                          onChange={(e) => setzeWert("city", e.target.value)}
                        />
                      </Feld>
                    </div>
                  </div>
                </div>
              </div>

              {regel.legal_basis && (
                <p className="mt-8 text-xs text-muted-foreground">
                  Rechtsgrundlage: {regel.legal_basis}
                  {regel.reporting_authority &&
                    ` · Meldung an ${regel.reporting_authority}`}
                </p>
              )}
            </>
          )}

          {schritt === "bestaetigen" && regel && (
            <>
              <h1 className="font-display text-[2.5rem] font-bold leading-tight tracking-tight">
                Prüfe deine Angaben
              </h1>
              <p className="mt-3 text-[1.0625rem] text-muted-foreground">
                Wir melden diese Daten an die Steuerbehörde. Prüfe sie bitte,
                bevor du sie bestätigst.
              </p>

              <dl className="mt-10 divide-y divide-border rounded-2xl border border-border px-6">
                <Zeile label="Land" wert={landName(land)} />
                <Zeile
                  label="Art"
                  wert={istPerson ? "Privatperson" : "Unternehmen"}
                />
                {istPerson ? (
                  <>
                    <Zeile
                      label="Name"
                      wert={`${werte.first_name ?? ""} ${werte.last_name ?? ""}`.trim()}
                    />
                    <Zeile label="Geburtsdatum" wert={werte.date_of_birth} />
                  </>
                ) : (
                  <>
                    <Zeile label="Firmenname" wert={werte.legal_name} />
                    <Zeile
                      label="Handelsregisternummer"
                      wert={werte.business_registration_number}
                    />
                  </>
                )}
                {regel.required_ids.length > 0 && (
                  <Zeile
                    label={ID_NAME[regel.required_ids[0]] ?? "Steuernummer"}
                    wert={werte.tin}
                  />
                )}
                {werte.birth_place_city && (
                  <Zeile
                    label="Geburtsort"
                    wert={[
                      werte.birth_place_city,
                      werte.birth_place_country
                        ? landName(werte.birth_place_country)
                        : null,
                    ]
                      .filter(Boolean)
                      .join(", ")}
                  />
                )}
                <Zeile
                  label="Anschrift"
                  wert={[
                    werte.address_line1,
                    [werte.postal_code, werte.city].filter(Boolean).join(" "),
                  ]
                    .filter(Boolean)
                    .join(", ")}
                />
              </dl>

              {/* Die Selbstauskunft. DAC7 verlangt, dass der Anbieter die
                  Richtigkeit ERKLÄRT — ein stilles Speichern genügt nicht.
                  Der getippte Name ist bewusst höherschwelliger als ein
                  Haken (Airbnb-Vorbild, Hilfeartikel 3166). */}
              <div className="mt-10 rounded-2xl border border-border p-6">
                <h2 className="font-display text-xl font-bold">Bestätigung</h2>
                <p className="mt-3 text-[0.9375rem] text-muted-foreground">
                  Ich erkläre, dass die oben gemachten Angaben vollständig und
                  richtig sind. Ändert sich etwas daran, teile ich es
                  unverzüglich mit.
                </p>
                <label className="mt-6 flex flex-col gap-2">
                  <span className="text-sm font-medium">
                    Vollständiger Name als Unterschrift
                  </span>
                  <Input
                    value={signatur}
                    onChange={(e) => setSignatur(e.target.value)}
                    placeholder={
                      istPerson
                        ? `${werte.first_name ?? ""} ${werte.last_name ?? ""}`.trim()
                        : werte.legal_name ?? ""
                    }
                  />
                  <span className="text-xs text-muted-foreground">
                    Dein getippter Name gilt als Unterschrift.
                  </span>
                </label>
              </div>
            </>
          )}

          {fehler && (
            <p className="mt-6 flex items-start gap-2 text-[0.9375rem] text-destructive">
              <Icon
                icon="solar:danger-triangle-line-duotone"
                className="mt-0.5 size-5 shrink-0"
              />
              {fehler}
            </p>
          )}

          <div className="h-32" />
        </div>
      </main>

      {/* Feste Fußleiste mit Fortschritt — wie bei Airbnb. */}
      <footer className="sticky bottom-0 border-t border-border bg-background">
        <div
          className="h-1 bg-foreground transition-[width] duration-300"
          style={{ width: `${(schrittNr / SCHRITTE.length) * 100}%` }}
        />
        <div className="flex items-center justify-between px-6 py-4">
          <button
            type="button"
            onClick={zurueck}
            className="text-[0.9375rem] font-medium underline underline-offset-4"
          >
            Zurück
          </button>
          {schritt === "bestaetigen" ? (
            <Button
              size="lg"
              disabled={laeuft || !signaturPasst}
              onClick={() => void speichern()}
            >
              {laeuft ? "Wird gespeichert …" : "Bestätigen und senden"}
            </Button>
          ) : (
            <Button size="lg" disabled={!weiterMoeglich} onClick={weiter}>
              Weiter
            </Button>
          )}
        </div>
      </footer>

      {/* Rückfrage beim Abbruch (Airbnb-Vorbild „Are you sure you want to
          exit?"). Bewusst mit dem konkreten NACHTEIL im Text, nicht nur
          „Änderungen gehen verloren": ohne Steuernummer greift in vielen
          Ländern der höhere Satz — das soll man vor dem Klick wissen. */}
      {abbruchOffen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="abbruch-titel"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-6"
          onClick={() => setAbbruchOffen(false)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-background p-8 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="abbruch-titel"
              className="text-center font-display text-2xl font-bold"
            >
              Wirklich beenden?
            </h2>
            <p className="mt-3 text-center text-[0.9375rem] text-muted-foreground">
              Deine Angaben wurden noch nicht gespeichert.
              {regel?.host_tax_bps_without_id != null &&
                regel.host_tax_bps_without_id > 0 &&
                ` Ohne Steuernummer schuldest du in ${landName(land)} ${satz(
                  regel.host_tax_bps_without_id,
                )} statt ${satz(regel.host_tax_bps_with_id ?? 0)} auf deine Einnahmen.`}
            </p>
            <div className="mt-7 flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setAbbruchOffen(false)}
              >
                Abbrechen
              </Button>
              <Button
                className="flex-1"
                onClick={() => router.push("/konto?bereich=steuern")}
              >
                Ja, beenden
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Feld({
  label,
  hinweis,
  children,
}: {
  label: string;
  hinweis?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="text-sm font-medium">{label}</span>
      {children}
      {hinweis && (
        <span className="text-xs text-muted-foreground">{hinweis}</span>
      )}
    </label>
  );
}

/** Eine Zeile der Zusammenfassung. Leere Werte als „—", nie erfunden. */
function Zeile({ label, wert }: { label: string; wert?: string | null }) {
  return (
    <div className="flex justify-between gap-4 py-3">
      <dt className="shrink-0 text-sm text-muted-foreground">{label}</dt>
      <dd className="text-right text-sm font-medium">{wert || "—"}</dd>
    </div>
  );
}

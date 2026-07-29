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
import { useTranslations } from "next-intl";
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

/** Welche Nummern einen eigenen Anzeigenamen haben. Ein Mexikaner kennt keine
 *  „TIN" — der Name kommt je Code aus `steuern.idName.<code>`. Codes ausserhalb
 *  dieser Liste fallen auf die allgemeine Bezeichnung zurück. */
const ID_CODES = [
  "tin",
  "ssn",
  "itin",
  "ein",
  "rfc",
  "curp",
  "pan",
  "gstin",
  "rut",
  "abn",
  "vat",
] as const;

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
  const t = useTranslations("steuern");
  const router = useRouter();

  function idName(code: string): string {
    return (ID_CODES as readonly string[]).includes(code)
      ? t(`idName.${code}`)
      : t("steuernummer");
  }

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
          {t("beenden")}
        </button>
      </header>

      {/* Inhalt: zentriert in der Bildmitte wie bei Airbnb. */}
      <main className="flex flex-1 justify-center px-6">
        <div className="w-full max-w-2xl pt-12">
          {schritt === "land" && (
            <>
              <h1 className="font-display text-[2.5rem] font-bold leading-tight tracking-tight">
                {t("landSchrittTitel")}
              </h1>
              <p className="mt-3 text-[1.0625rem] text-muted-foreground">
                {t("landSchrittText")}
              </p>

              <label className="mt-10 flex flex-col gap-2">
                <span className="text-sm font-medium">{t("landLabel")}</span>
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
                  suchPlatzhalter={t("landSuchen")}
                />
              </label>
            </>
          )}

          {schritt === "art" && (
            <>
              <h1 className="font-display text-[2.5rem] font-bold leading-tight tracking-tight">
                {t("artSchrittTitel")}
              </h1>
              <p className="mt-3 text-[1.0625rem] text-muted-foreground">
                {t("artSchrittText")}
              </p>

              <div className="mt-10 flex flex-col">
                {(["individual", "entity"] satisfies TaxpayerKind[]).map(
                  (wert) => (
                    <label
                      key={wert}
                      className="flex cursor-pointer items-start gap-4 border-b border-border py-5 last:border-b-0"
                    >
                      <input
                        type="radio"
                        name="art"
                        checked={art === wert}
                        onChange={() => setArt(wert)}
                        className="mt-0.5 size-5 shrink-0 accent-foreground"
                      />
                      <span className="flex flex-col gap-1">
                        <span className="text-[1.0625rem] font-medium">
                          {t(`art.${wert}.titel`)}
                        </span>
                        <span className="text-[0.9375rem] text-muted-foreground">
                          {t(`art.${wert}.textLang`)}
                        </span>
                      </span>
                    </label>
                  ),
                )}
              </div>
            </>
          )}

          {schritt === "felder" && regel && (
            <>
              <h1 className="font-display text-[2.5rem] font-bold leading-tight tracking-tight">
                {t("felderSchrittTitel", { land: landName(land) })}
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
                      {/* Zwei Varianten statt eines zusammengesetzten Satzes:
                          der Vergleichssatz ist optional, und ein Übersetzer
                          muss den ganzen Satz am Stück umstellen können. */}
                      {regel.host_tax_bps_with_id != null
                        ? t.rich("ohneNummerSatzVergleich", {
                            land: landName(land),
                            satzOhne: satz(regel.host_tax_bps_without_id),
                            satzMit: satz(regel.host_tax_bps_with_id),
                            stark: (c) => <strong>{c}</strong>,
                          })
                        : t.rich("ohneNummerSatz", {
                            land: landName(land),
                            satzOhne: satz(regel.host_tax_bps_without_id),
                            stark: (c) => <strong>{c}</strong>,
                          })}
                    </span>
                  </p>
                )}

              <div className="mt-10 flex flex-col gap-6">
                {istPerson ? (
                  <>
                    <Feld label={t("vorname")}>
                      <Input
                        value={werte.first_name ?? ""}
                        onChange={(e) => setzeWert("first_name", e.target.value)}
                      />
                    </Feld>
                    <Feld label={t("nachname")}>
                      <Input
                        value={werte.last_name ?? ""}
                        onChange={(e) => setzeWert("last_name", e.target.value)}
                      />
                    </Feld>
                    <Feld label={t("geburtsdatum")}>
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
                    <Feld label={t("firmenname")}>
                      <Input
                        value={werte.legal_name ?? ""}
                        onChange={(e) => setzeWert("legal_name", e.target.value)}
                      />
                    </Feld>
                    <Feld
                      label={t("handelsregisternummer")}
                      hinweis={t("handelsregisternummerHinweis")}
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
                    label={idName(regel.required_ids[0])}
                    hinweis={
                      regel.birthplace_substitutes_id && istPerson
                        ? t("steuerIdHinweisGeburtsort")
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
                    <Feld label={t("geburtsort")}>
                      <Input
                        value={werte.birth_place_city ?? ""}
                        onChange={(e) =>
                          setzeWert("birth_place_city", e.target.value)
                        }
                      />
                    </Feld>
                    <Feld label={t("geburtsland")}>
                      <SuchAuswahl
                        optionen={geburtsLaender.map((l) => ({
                          wert: l.code,
                          label: l.name,
                          stichworte: l.code,
                        }))}
                        wert={werte.birth_place_country ?? ""}
                        onChange={(v) => setzeWert("birth_place_country", v)}
                        suchPlatzhalter={t("landSuchen")}
                      />
                    </Feld>
                  </div>
                )}

                <div className="border-t border-border pt-6">
                  <h2 className="font-display text-xl font-bold">
                    {t("anschrift")}
                  </h2>
                  <div className="mt-4 flex flex-col gap-6">
                    <Feld label={t("strasseHausnummer")}>
                      <Input
                        value={werte.address_line1 ?? ""}
                        onChange={(e) =>
                          setzeWert("address_line1", e.target.value)
                        }
                      />
                    </Feld>
                    <div className="grid gap-6 sm:grid-cols-[10rem_1fr]">
                      <Feld label={t("postleitzahl")}>
                        <Input
                          value={werte.postal_code ?? ""}
                          onChange={(e) =>
                            setzeWert("postal_code", e.target.value)
                          }
                        />
                      </Feld>
                      <Feld label={t("ort")}>
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
                  {t("rechtsgrundlage", { grundlage: regel.legal_basis })}
                  {regel.reporting_authority &&
                    t("meldungAn", { behoerde: regel.reporting_authority })}
                </p>
              )}
            </>
          )}

          {schritt === "bestaetigen" && regel && (
            <>
              <h1 className="font-display text-[2.5rem] font-bold leading-tight tracking-tight">
                {t("pruefenTitel")}
              </h1>
              <p className="mt-3 text-[1.0625rem] text-muted-foreground">
                {t("pruefenText")}
              </p>

              <dl className="mt-10 divide-y divide-border rounded-2xl border border-border px-6">
                <Zeile label={t("landKurz")} wert={landName(land)} />
                <Zeile
                  label={t("artKurz")}
                  wert={
                    istPerson
                      ? t("art.individual.titel")
                      : t("art.entity.titel")
                  }
                />
                {istPerson ? (
                  <>
                    <Zeile
                      label={t("name")}
                      wert={`${werte.first_name ?? ""} ${werte.last_name ?? ""}`.trim()}
                    />
                    <Zeile
                      label={t("geburtsdatum")}
                      wert={werte.date_of_birth}
                    />
                  </>
                ) : (
                  <>
                    <Zeile label={t("firmenname")} wert={werte.legal_name} />
                    <Zeile
                      label={t("handelsregisternummer")}
                      wert={werte.business_registration_number}
                    />
                  </>
                )}
                {regel.required_ids.length > 0 && (
                  <Zeile
                    label={idName(regel.required_ids[0])}
                    wert={werte.tin}
                  />
                )}
                {werte.birth_place_city && (
                  <Zeile
                    label={t("geburtsort")}
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
                  label={t("anschrift")}
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
                <h2 className="font-display text-xl font-bold">
                  {t("bestaetigungTitel")}
                </h2>
                <p className="mt-3 text-[0.9375rem] text-muted-foreground">
                  {t("selbstauskunftErklaerung")}
                </p>
                <label className="mt-6 flex flex-col gap-2">
                  <span className="text-sm font-medium">
                    {t("unterschriftLabel")}
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
                    {t("unterschriftHinweis")}
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
            {t("zurueck")}
          </button>
          {schritt === "bestaetigen" ? (
            <Button
              size="lg"
              disabled={laeuft || !signaturPasst}
              onClick={() => void speichern()}
            >
              {laeuft ? t("wirdGespeichert") : t("bestaetigenUndSenden")}
            </Button>
          ) : (
            <Button size="lg" disabled={!weiterMoeglich} onClick={weiter}>
              {t("weiter")}
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
              {t("abbruchTitel")}
            </h2>
            <p className="mt-3 text-center text-[0.9375rem] text-muted-foreground">
              {t("abbruchText")}
              {regel?.host_tax_bps_without_id != null &&
                regel.host_tax_bps_without_id > 0 &&
                ` ${t("abbruchSatzHinweis", {
                  land: landName(land),
                  satzOhne: satz(regel.host_tax_bps_without_id),
                  satzMit: satz(regel.host_tax_bps_with_id ?? 0),
                })}`}
            </p>
            <div className="mt-7 flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setAbbruchOffen(false)}
              >
                {t("abbrechen")}
              </Button>
              <Button
                className="flex-1"
                onClick={() => router.push("/konto?bereich=steuern")}
              >
                {t("jaBeenden")}
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

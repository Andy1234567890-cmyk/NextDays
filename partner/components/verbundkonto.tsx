"use client";

// Verbundkonto (Stripe Connect, 0522) — einziger Auszahlungsweg.
//
// Warum ein eigenes, mehrstufiges Formular statt Stripes eingebettetem
// Onboarding: das Dashboard bleibt white-label, der Partner sieht nie ein
// fremdes Markenelement (dieselbe Entscheidung wie bei den Betrieben).
//
// Die Stufen sind ABSICHTLICH sichtbar getrennt und zeigen ihren Zustand: ein
// Partner, dessen Auszahlung hängt, soll auf einen Blick sehen, WORAN — nicht
// nur „noch nicht bereit". Stripes offene Anforderungen (`offene_felder`)
// stehen deshalb im Klartext darunter (Debugging-Pflicht).
import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import type { ConnectStand, Profil } from "@/lib/partner";
import {
  connectAnlegen,
  connectBankSetzen,
  connectBedingungenAnnehmen,
  connectDatenSenden,
  connectIdentitaetsLink,
} from "@/lib/partner-actions";

const EINGABE =
  "rounded-full border border-border bg-transparent px-4 py-2 outline-none focus-visible:border-foreground";

function Schritt({
  nummer,
  titel,
  fertig,
  children,
}: {
  nummer: number;
  titel: string;
  fertig: boolean;
  children?: React.ReactNode;
}) {
  return (
    <li className="flex gap-4">
      <span
        aria-hidden
        className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
          fertig ? "bg-foreground text-background" : "border border-border text-muted-foreground"
        }`}
      >
        {fertig ? "✓" : nummer}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{titel}</p>
        {children}
      </div>
    </li>
  );
}

export function Verbundkonto({
  profil,
  stand,
  pflicht,
}: {
  profil: Profil;
  stand: ConnectStand;
  /** Stripes `verification_fields.minimum` für Land + Rechtsform, live. */
  pflicht: string[];
}) {
  const t = useTranslations("verbundkonto");
  const [laeuft, starte] = useTransition();
  const [offen, setOffen] = useState(false);
  const firma = profil.legal_form === "company";
  // Bei Unternehmen läuft der Mensch als `representative` über die Persons-API,
  // bei Privatpersonen als `individual` — die Pflichtliste ist danach benannt.
  const person = firma ? "representative" : "individual";
  const noetig = (feld: string) => pflicht.includes(feld);

  // Personendaten
  const [vorname, setVorname] = useState("");
  const [nachname, setNachname] = useState("");
  const [telefon, setTelefon] = useState("");
  const [tag, setTag] = useState("");
  const [monat, setMonat] = useState("");
  const [jahr, setJahr] = useState("");
  const [strasse, setStrasse] = useState("");
  const [plz, setPlz] = useState("");
  const [ort, setOrt] = useState("");
  const [nation, setNation] = useState(profil.country);
  const [idNummer, setIdNummer] = useState("");
  const [bundesland, setBundesland] = useState("");
  const [webseite, setWebseite] = useState(profil.channels[0]?.url ?? "");
  // Firmendaten
  const [firmenname, setFirmenname] = useState(profil.company ?? "");
  const [steuernummer, setSteuernummer] = useState("");
  const [registernummer, setRegisternummer] = useState("");
  const [ustId, setUstId] = useState(profil.vat_id ?? "");
  const [firmenBundesland, setFirmenBundesland] = useState("");
  const [firmenStrasse, setFirmenStrasse] = useState("");
  const [firmenPlz, setFirmenPlz] = useState("");
  const [firmenOrt, setFirmenOrt] = useState("");
  // Bank
  const [iban, setIban] = useState("");
  const [inhaber, setInhaber] = useState("");
  const [waehrung, setWaehrung] = useState("EUR");

  function melde(res: { ok: boolean; fehler?: string }, gut: string) {
    if (res.ok) toast.success(gut);
    else toast.error(res.fehler ?? t("fehler"));
  }

  return (
    <section className="rounded-2xl border border-border p-6">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {t("titel")}
      </h2>

      {stand.auszahlbar ? (
        <p className="mt-2 text-sm text-muted-foreground">{t("bereit")}</p>
      ) : (
        <p className="mt-2 text-sm text-muted-foreground">{t("hinweis")}</p>
      )}

      {/* Stripes offene Anforderungen im Klartext — sonst rät der Partner. */}
      {stand.verbunden && !stand.auszahlbar && stand.offene_felder.length > 0 && (
        <div className="mt-4 rounded-xl border border-border bg-muted/40 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {t("offeneFelder")}
          </p>
          <ul className="mt-2 space-y-1">
            {stand.offene_felder.map((feld) => (
              <li key={feld} className="font-mono text-xs text-muted-foreground">
                {feld}
              </li>
            ))}
          </ul>
        </div>
      )}
      {stand.gesperrt_grund && (
        <p className="mt-3 text-sm text-destructive">
          {t("gesperrt", { grund: stand.gesperrt_grund })}
        </p>
      )}

      <ol className="mt-6 space-y-5">
        <Schritt nummer={1} titel={t("schrittKonto")} fertig={stand.verbunden}>
          {!stand.verbunden && (
            <button
              type="button"
              disabled={laeuft}
              onClick={() =>
                starte(async () => melde(await connectAnlegen(), t("kontoAngelegt")))
              }
              className="mt-2 rounded-full bg-foreground px-5 py-2 text-sm font-semibold text-background disabled:opacity-50"
            >
              {t("kontoAnlegen")}
            </button>
          )}
        </Schritt>

        <Schritt
          nummer={2}
          titel={firma ? t("schrittDatenFirma") : t("schrittDaten")}
          fertig={stand.daten_vollstaendig}
        >
          {stand.verbunden && (
            <>
              <button
                type="button"
                onClick={() => setOffen((o) => !o)}
                className="mt-1 text-sm font-semibold underline-offset-4 hover:underline"
              >
                {offen ? t("zuklappen") : t("datenBearbeiten")}
              </button>
              {offen && (
                <form
                  className="mt-3 grid gap-3 sm:grid-cols-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    starte(async () => {
                      const res = await connectDatenSenden({
                        url: webseite.trim(),
                        person: {
                          first_name: vorname.trim(),
                          last_name: nachname.trim(),
                          email: profil.email,
                          phone: telefon.trim() || undefined,
                          dob: { day: Number(tag), month: Number(monat), year: Number(jahr) },
                          address: {
                            line1: strasse.trim(),
                            postal_code: plz.trim(),
                            city: ort.trim(),
                            state: bundesland.trim() || undefined,
                          },
                          nationality: nation.toUpperCase() || undefined,
                          id_number: idNummer.trim() || undefined,
                        },
                        ...(firma
                          ? {
                              company_name: firmenname.trim(),
                              company_tax_id: steuernummer.trim() || undefined,
                              company_registration_number: registernummer.trim() || undefined,
                              company_vat_id: ustId.trim() || undefined,
                              company_phone: telefon.trim() || undefined,
                              company_address: {
                                line1: firmenStrasse.trim(),
                                postal_code: firmenPlz.trim(),
                                city: firmenOrt.trim(),
                                state: firmenBundesland.trim() || undefined,
                              },
                            }
                          : {}),
                      });
                      melde(res, t("datenGesendet"));
                    });
                  }}
                >
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium">{t("vorname")}</span>
                    <input value={vorname} onChange={(e) => setVorname(e.target.value)} required maxLength={100} className={EINGABE} />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium">{t("nachname")}</span>
                    <input value={nachname} onChange={(e) => setNachname(e.target.value)} required maxLength={100} className={EINGABE} />
                  </label>
                  <fieldset className="flex flex-col gap-1 text-sm sm:col-span-2">
                    <legend className="font-medium">{t("geburtsdatum")}</legend>
                    <div className="flex gap-2">
                      <input value={tag} onChange={(e) => setTag(e.target.value)} required inputMode="numeric" placeholder={t("tag")} className={`${EINGABE} w-20`} />
                      <input value={monat} onChange={(e) => setMonat(e.target.value)} required inputMode="numeric" placeholder={t("monat")} className={`${EINGABE} w-20`} />
                      <input value={jahr} onChange={(e) => setJahr(e.target.value)} required inputMode="numeric" placeholder={t("jahr")} className={`${EINGABE} w-28`} />
                    </div>
                  </fieldset>
                  <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                    <span className="font-medium">{t("strasse")}</span>
                    <input value={strasse} onChange={(e) => setStrasse(e.target.value)} required maxLength={200} className={EINGABE} />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium">{t("plz")}</span>
                    <input value={plz} onChange={(e) => setPlz(e.target.value)} required maxLength={20} className={EINGABE} />
                  </label>
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium">{t("ort")}</span>
                    <input value={ort} onChange={(e) => setOrt(e.target.value)} required maxLength={100} className={EINGABE} />
                  </label>
                  {noetig(`${person}.address.state`) && (
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="font-medium">{t("bundesland")}</span>
                      <input value={bundesland} onChange={(e) => setBundesland(e.target.value)} required maxLength={100} className={EINGABE} />
                    </label>
                  )}
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium">{t("nationalitaet")}</span>
                    <input value={nation} onChange={(e) => setNation(e.target.value.toUpperCase())} required={noetig(`${person}.nationality`)} maxLength={2} className={`${EINGABE} font-mono`} />
                  </label>
                  {noetig(`${person}.id_number`) && (
                    <label className="flex flex-col gap-1 text-sm">
                      <span className="font-medium">{t("idNummer")}</span>
                      <input value={idNummer} onChange={(e) => setIdNummer(e.target.value)} required maxLength={40} className={`${EINGABE} font-mono`} />
                      <span className="text-xs text-muted-foreground">{t("idNummerHinweis")}</span>
                    </label>
                  )}
                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium">{t("telefon")}</span>
                    <input value={telefon} onChange={(e) => setTelefon(e.target.value)} type="tel" required={noetig(`${person}.phone`) || noetig("company.phone")} maxLength={40} className={EINGABE} />
                  </label>
                  <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                    <span className="font-medium">{t("webseite")}</span>
                    <input value={webseite} onChange={(e) => setWebseite(e.target.value)} required maxLength={500} className={EINGABE} />
                    <span className="text-xs text-muted-foreground">{t("webseiteHinweis")}</span>
                  </label>

                  {firma && (
                    <>
                      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                        <span className="font-medium">{t("firmenname")}</span>
                        <input value={firmenname} onChange={(e) => setFirmenname(e.target.value)} required maxLength={200} className={EINGABE} />
                      </label>
                      <label className="flex flex-col gap-1 text-sm">
                        <span className="font-medium">{t("registernummer")}</span>
                        <input value={registernummer} onChange={(e) => setRegisternummer(e.target.value)} required={noetig("company.registration_number")} maxLength={60} className={`${EINGABE} font-mono`} />
                      </label>
                      <label className="flex flex-col gap-1 text-sm">
                        <span className="font-medium">{t("steuernummer")}</span>
                        <input value={steuernummer} onChange={(e) => setSteuernummer(e.target.value)} required={noetig("company.tax_id")} maxLength={40} className={`${EINGABE} font-mono`} />
                      </label>
                      <label className="flex flex-col gap-1 text-sm">
                        <span className="font-medium">{t("ustId")}</span>
                        <input value={ustId} onChange={(e) => setUstId(e.target.value.toUpperCase())} required={noetig("company.vat_id")} maxLength={40} className={`${EINGABE} font-mono`} />
                      </label>
                      <label className="flex flex-col gap-1 text-sm">
                        <span className="font-medium">{t("firmenStrasse")}</span>
                        <input value={firmenStrasse} onChange={(e) => setFirmenStrasse(e.target.value)} required maxLength={200} className={EINGABE} />
                      </label>
                      <label className="flex flex-col gap-1 text-sm">
                        <span className="font-medium">{t("plz")}</span>
                        <input value={firmenPlz} onChange={(e) => setFirmenPlz(e.target.value)} required maxLength={20} className={EINGABE} />
                      </label>
                      <label className="flex flex-col gap-1 text-sm">
                        <span className="font-medium">{t("ort")}</span>
                        <input value={firmenOrt} onChange={(e) => setFirmenOrt(e.target.value)} required maxLength={100} className={EINGABE} />
                      </label>
                      {noetig("company.address.state") && (
                        <label className="flex flex-col gap-1 text-sm">
                          <span className="font-medium">{t("bundesland")}</span>
                          <input value={firmenBundesland} onChange={(e) => setFirmenBundesland(e.target.value)} required maxLength={100} className={EINGABE} />
                        </label>
                      )}
                      <p className="text-xs text-muted-foreground sm:col-span-2">{t("firmaHinweis")}</p>
                    </>
                  )}

                  <button
                    type="submit"
                    disabled={laeuft}
                    className="mt-1 w-fit rounded-full bg-foreground px-5 py-2 text-sm font-semibold text-background disabled:opacity-50 sm:col-span-2"
                  >
                    {t("speichern")}
                  </button>
                </form>
              )}
            </>
          )}
        </Schritt>

        <Schritt nummer={3} titel={t("schrittBank")} fertig={stand.auszahlbar}>
          {stand.verbunden && (
            <form
              className="mt-2 grid gap-3 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                starte(async () => {
                  const res = await connectBankSetzen({
                    iban: iban.replace(/\s/g, "").toUpperCase(),
                    account_holder: inhaber.trim(),
                    currency: waehrung,
                  });
                  if (res.ok) setIban("");
                  melde(res, t("bankGesetzt"));
                });
              }}
            >
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">IBAN</span>
                <input value={iban} onChange={(e) => setIban(e.target.value.toUpperCase())} required maxLength={40} className={`${EINGABE} font-mono`} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">{t("kontoinhaber")}</span>
                <input value={inhaber} onChange={(e) => setInhaber(e.target.value)} required maxLength={200} className={EINGABE} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium">{t("waehrung")}</span>
                <input value={waehrung} onChange={(e) => setWaehrung(e.target.value.toUpperCase())} required maxLength={3} className={`${EINGABE} font-mono`} />
                <span className="text-xs text-muted-foreground">{t("waehrungHinweis")}</span>
              </label>
              <button
                type="submit"
                disabled={laeuft}
                className="mt-1 w-fit self-end rounded-full bg-foreground px-5 py-2 text-sm font-semibold text-background disabled:opacity-50"
              >
                {t("bankSpeichern")}
              </button>
            </form>
          )}
        </Schritt>

        <Schritt nummer={4} titel={t("schrittBedingungen")} fertig={stand.auszahlbar}>
          {stand.verbunden && !stand.auszahlbar && (
            <button
              type="button"
              disabled={laeuft}
              onClick={() =>
                starte(async () =>
                  melde(await connectBedingungenAnnehmen(), t("bedingungenAngenommen")),
                )
              }
              className="mt-2 rounded-full border border-border px-5 py-2 text-sm font-semibold disabled:opacity-50"
            >
              {t("bedingungenAnnehmen")}
            </button>
          )}
        </Schritt>
        <Schritt nummer={5} titel={t("schrittIdentitaet")} fertig={stand.auszahlbar}>
          {stand.verbunden && !stand.auszahlbar && (
            <>
              <p className="mt-1 text-sm text-muted-foreground">{t("identitaetHinweis")}</p>
              <button
                type="button"
                disabled={laeuft}
                onClick={() =>
                  starte(async () => {
                    const res = await connectIdentitaetsLink();
                    if (res.ok) window.location.href = res.data.url;
                    else toast.error(res.fehler ?? t("fehler"));
                  })
                }
                className="mt-2 rounded-full bg-foreground px-5 py-2 text-sm font-semibold text-background disabled:opacity-50"
              >
                {t("identitaetStarten")}
              </button>
            </>
          )}
        </Schritt>
      </ol>
    </section>
  );
}

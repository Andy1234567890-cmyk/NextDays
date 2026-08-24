"use client";

// Assistent „Preisplan anlegen" (SiteMinder-Modell, ans myNextDays-Branding
// angeglichen). Vier Schritte: Allgemein → Aufenthalt → Preisgestaltung →
// Prüfen. Ein Plan ist entweder MANUELL (eigener Grundpreis) oder ABGELEITET
// (Preis = Basis-Plan + Betrag, dann Prozent). Datumsgenaue Pflege läuft danach
// im Kalender („Preise & Bestand"), nicht hier.
//
// SCHRITT 1 IST EINE AUSWAHL, KEIN TEXTFELD MEHR (23.08.2026). Der Grund ist
// keine Bequemlichkeit, sondern ein live aufgetretener Fehler: die Zuordnung
// eines Preisplans zu einer Portal-Rate läuft AUSSCHLIESSLICH über
// Namensgleichheit (`portal_raten_plaene.paar_fuer_portal_plan` sucht die EINE
// Rate, deren Titel gleich dem Plannamen ist, und ordnet fail-closed gar nicht
// zu, wenn keine oder mehrere passen). Wer „Wochenpreis" tippt, während
// Booking.com „Wochenrate" führt, legt einen Plan an, der NIE beim Portal
// ankommt: er steht unter „Preise", `send_to_portals` ist gesetzt, und trotzdem
// trägt keine Rate seine Restriktionen. Eine Attrappe ohne Fehlermeldung.
// Deshalb übernimmt der Nutzer den Portal-Titel, statt ihn abzuschreiben — und
// im Portal-Weg gibt es KEIN Namensfeld: der Titel der gewählten Rate IST der
// Planname. Ein editierbares (oder auch nur gesperrt aussehendes) Feld daneben
// wäre die Einladung zurück in dieselbe Attrappe. Der Weg zu einem freien Namen
// bleibt offen, aber als bewusster Wechsel auf „Eigener Preisplan".
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";
import { NativeSelect } from "@nextdays/ui/native-select";
import { channelLogoLoose } from "@/lib/channel-logos";
import {
  getPortalRatenAuswahl,
  type PortalRateAuswahl,
  type PortalRatenAuswahlPortal,
} from "@/lib/channex";
import { formatCurrency } from "@/lib/currency";
import { CURRENCY_OPTIONS, type Currency } from "@/lib/pricing-meta";
import { updateProperty } from "@/lib/properties";
import { createRatePlan, type RatePlan } from "@/lib/rates";

type Step = "general" | "stay" | "pricing" | "review";
const STEPS: Step[] = ["general", "stay", "pricing", "review"];

// Richtung getrennt vom Betrag (SiteMinder: Wert ohne Vorzeichen + Dropdown
// Increase/Decrease) — verhindert das „−-25 = +25"-Missverständnis.
type Direction = "increase" | "decrease";

/** Vorschau-Basis für die Live-Rechnung im Ableitungs-Schritt. */
const PREVIEW_BASE = 100;

// Welcher der zwei Wege in Schritt „Allgemein": eine Rate übernehmen, die ein
// Portal führt, oder einen eigenen Plan benennen. Getrennt statt „Textfeld mit
// Vorschlägen", weil die Folgen unterschiedlich sind: die übernommene Rate ist
// beim Portal die Rate (ihr Preis MUSS dorthin), der eigene Plan ist eine
// hausinterne Preisvariante (deren Portal-Versand eine Frage ist).
type NameQuelle = "portal" | "eigen";

/** Die übernommene Portal-Rate samt ihrem Portal — beides wird gebraucht: der
 *  Titel als Zuordnungs-Schlüssel, das Portal für die Tatsachen-Aussage
 *  „Dieser Preis geht an <Portal>". */
type GewaehlteRate = {
  rate: PortalRateAuswahl;
  portalLabel: string;
};

/** (basis + betrag) × (1 + prozent/100), kaufmännisch auf 2 Stellen — dieselbe
 *  Reihenfolge wie der Server-Resolver (erst Betrag, dann Prozent). */
export function previewDerived(
  base: number,
  amount: number,
  percent: number,
): number {
  return Math.round((base + amount) * (1 + percent / 100) * 100) / 100;
}

export function RatePlanWizard({
  propertyId,
  plans,
  currency,
  onDone,
  onClose,
}: {
  propertyId: string;
  plans: RatePlan[];
  // Währung des Objekts (aus dem bestehenden Plan) — nie erfunden, nur angezeigt.
  currency: string;
  onDone: () => void;
  onClose: () => void;
}) {
  const t = useTranslations("objects");
  const [step, setStep] = useState<Step>("general");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [minStay, setMinStay] = useState("1");

  // --- Schritt „Allgemein": Portal-Rate übernehmen oder eigener Name ---------
  //
  // Der Abruf darf den Dialog NIE blockieren. Er geht an die Portale (zwei
  // Lesecalls je Verbindung) und kann langsam sein oder scheitern; wer dann
  // keinen eigenen Namen mehr eintippen könnte, stünde vor einem toten Dialog.
  // Deshalb: `quelle` startet auf „eigen", und der Portal-Block erscheint erst,
  // wenn wirklich etwas zu zeigen ist.
  const [ratenLaden, setRatenLaden] = useState(true);
  const [portale, setPortale] = useState<PortalRatenAuswahlPortal[] | null>(
    null,
  );
  const [quelle, setQuelle] = useState<NameQuelle>("eigen");
  const [gewaehlt, setGewaehlt] = useState<GewaehlteRate | null>(null);

  const ratenAbrufen = useCallback(async () => {
    const res = await getPortalRatenAuswahl(propertyId);
    setRatenLaden(false);
    // Scheitert der Abruf komplett (nicht angemeldet, Backend weg), bleibt die
    // Liste NULL und der Dialog läuft als reiner „eigener Name" weiter. Kein
    // leerer Kasten und keine Behauptung „keine Raten vorhanden" — wir wissen
    // es nicht (Wurzel 4/5).
    setPortale(res.ok ? res.data.portals : null);
  }, [propertyId]);
  useEffect(() => {
    void ratenAbrufen();
  }, [ratenAbrufen]);

  // Der Portal-Block erscheint nur, wenn es überhaupt ein verbundenes Portal
  // mit Raten-Ebene gibt. Kein Portal verbunden → gar kein Block (statt eines
  // leeren Kastens, der nach einem Fehler aussieht).
  const hatPortalBlock = (portale?.length ?? 0) > 0;
  // Eine Rate ist wählbar, solange sie NICHT belegt ist. `belegt: null` heißt
  // „Belegung unbekannt" und bleibt wählbar — nur mit Hinweis. Aus einem
  // fehlgeschlagenen Kanal-Lesen ein „gesperrt" zu machen wäre so falsch wie
  // ein „frei" daraus zu machen.
  const istWaehlbar = (r: PortalRateAuswahl): boolean => r.belegt !== true;
  // Führt das Objekt (noch) keine Währung, wird sie HIER abgefragt statt den
  // Anlegen-Knopf in einen 422 laufen zu lassen („currency: String should have
  // at least 1 character"). Genau das passierte live am 07.08.2026 an einem
  // selbst angelegten Objekt: der Schritt sagte „Währung: (aus dem Objekt
  // übernommen)" — und dahinter stand nichts. Beim Anlegen gesetzt wird sie am
  // OBJEKT (properties.currency ist die eine Quelle), nicht nur am Plan.
  const [waehrungNeu, setWaehrungNeu] = useState<Currency | "">("");
  const effektiveWaehrung = currency || waehrungNeu;
  // An die Buchungsportale senden. Der Grundpreis geht immer; dieser zusätzliche
  // Preis nur, wenn der Kunde es hier einschaltet.
  const [sendToPortals, setSendToPortals] = useState(false);
  const [derive, setDerive] = useState(false);
  const [basePrice, setBasePrice] = useState("");
  // Nur MANUELLE Pläne können Basis sein — keine Kaskade (Server: 422).
  const manualPlans = useMemo(
    () => plans.filter((p) => p.rate_mode === "manual"),
    [plans],
  );
  const [parentId, setParentId] = useState(manualPlans[0]?.id ?? "");
  const [amount, setAmount] = useState("");
  const [amountDir, setAmountDir] = useState<Direction>("increase");
  const [percent, setPercent] = useState("");
  const [percentDir, setPercentDir] = useState<Direction>("increase");

  // Eine Portal-Rate übernehmen: der Titel wird EXAKT der Plannamen (kein trim
  // über die Rand-Leerzeichen hinaus, keine Groß-/Kleinschreibungs-Korrektur —
  // er ist der Zuordnungs-Schlüssel). `min_stay` ist ein VORSCHLAG; `null` heißt
  // „aus dem Titel nicht erkannt" und lässt den bestehenden Wert stehen, statt
  // eine 1 zu erfinden (Wurzel 4).
  const rateUebernehmen = (rate: PortalRateAuswahl, portalLabel: string) => {
    setGewaehlt({ rate, portalLabel });
    setQuelle("portal");
    setName(rate.title);
    if (rate.min_stay != null) setMinStay(String(rate.min_stay));
    // Eine Portal-Rate IST beim Portal die Rate — ihr Preis muss dorthin. Das
    // ist keine Frage mehr, sondern eine Tatsache; der Schalter verschwindet und
    // das Flag steht fest auf true.
    setSendToPortals(true);
  };

  // Zurück auf „eigener Name": die Übernahme wird vollständig aufgehoben
  // (Wurzel 1 — der Gegenzustand). Bliebe der Portal-Titel im Feld stehen,
  // entstünde später ein Plan, der namensgleich zu einer Rate ist, ohne dass der
  // Nutzer das noch wollte.
  const aufEigenWechseln = () => {
    setQuelle("eigen");
    setGewaehlt(null);
    setName("");
    setSendToPortals(false);
  };

  const nameTaken = plans.some(
    (p) => p.name.trim().toLowerCase() === name.trim().toLowerCase(),
  );
  const signedAmount =
    (Number(amount) || 0) * (amountDir === "decrease" ? -1 : 1);
  const signedPercent =
    (Number(percent) || 0) * (percentDir === "decrease" ? -1 : 1);
  const parent = manualPlans.find((p) => p.id === parentId) ?? null;
  const previewOut = previewDerived(PREVIEW_BASE, signedAmount, signedPercent);

  const canNext =
    step === "general"
      ? // Im Portal-Weg muss eine Rate wirklich GEWÄHLT sein — der Name allein
        // reicht nicht, weil erst die Wahl das Portal (und damit die
        // Tatsachen-Aussage im nächsten Schritt) festlegt. `nameTaken` gilt in
        // BEIDEN Wegen: trägt eine Portal-Rate denselben Titel wie ein
        // bestehender Plan, wäre der Name nicht mehr eindeutig und
        // `paar_fuer_portal_plan` ordnete fail-closed GAR NICHTS mehr zu.
        (quelle === "portal" ? gewaehlt !== null : true) &&
        name.trim().length > 0 &&
        !nameTaken
      : step === "stay"
        ? Number(minStay) >= 1
        : step === "pricing"
          ? // Ohne Währung geht es nicht weiter: der Server lehnt den Plan sonst
            // mit 422 ab, und der Fehler erschiene erst nach „Anlegen".
            !!effektiveWaehrung &&
            (derive
              ? !!parentId
              : basePrice !== "" && Number(basePrice) >= 0)
          : true;

  const submit = async () => {
    setBusy(true);
    setErr(null);
    // Eine hier neu gewählte Währung gehört ans OBJEKT, nicht nur an diesen
    // Plan: `properties.currency` ist die eine Quelle (0161), aus der jeder
    // weitere Plan und die Portale sie beziehen. Erst setzen, dann anlegen —
    // scheitert das Setzen, gibt es auch keinen Plan mit hängender Währung.
    if (!currency && waehrungNeu) {
      const objekt = await updateProperty(propertyId, {
        currency: waehrungNeu,
      });
      if (!objekt.ok) {
        setBusy(false);
        setErr(objekt.error);
        return;
      }
    }
    const res = await createRatePlan(
      derive
        ? {
            propertyId,
            name: name.trim(),
            // Bei Ableitung erbt das Kind Basis + Währung vom Parent (Server
            // erzwingt) — die Felder sind nur Formalität der API.
            basePrice: 0,
            currency: effektiveWaehrung,
            minStay: Number(minStay),
            rateMode: "derived",
            derivedFromRatePlanId: parentId,
            offsetAmount: amount === "" ? null : signedAmount,
            offsetPercent: percent === "" ? null : signedPercent,
            sendToPortals,
          }
        : {
            propertyId,
            name: name.trim(),
            basePrice: Number(basePrice),
            currency: effektiveWaehrung,
            minStay: Number(minStay),
            rateMode: "manual",
            sendToPortals,
          },
    );
    setBusy(false);
    if (!res.ok) {
      setErr(res.error);
      return;
    }
    onDone();
  };

  const idx = STEPS.indexOf(step);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col gap-5 overflow-y-auto rounded-2xl border border-border bg-card p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-extrabold">
            {t("ratePlanWizard.title")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label={t("ratePlanWizard.close")}
          >
            <Icon icon="ph:x" className="size-5" />
          </button>
        </div>

        {/* Schritt-Anzeige */}
        <div className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <span
              key={s}
              className={`h-1.5 flex-1 rounded-full ${
                i <= idx ? "bg-accent" : "bg-muted"
              }`}
            />
          ))}
        </div>

        {step === "general" && (
          <div className="flex flex-col gap-4">
            {/* Ladezustand: benannt, nicht als leerer Kasten. Der Abruf geht an
                die Portale und kann dauern — solange sagt der Dialog, WAS er
                holt, statt kurz „keine Raten" zu behaupten. Der eigene Weg ist
                dabei schon benutzbar (der Abruf blockiert nichts). */}
            {ratenLaden && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Icon
                  icon="ph:circle-notch"
                  className="size-4 animate-spin"
                  aria-hidden
                />
                {t("ratePlanWizard.portalRatesLoading")}
              </p>
            )}

            {/* Der Portal-Block erscheint NUR bei mindestens einem verbundenen
                Portal mit Raten-Ebene. Ohne Portal-Verbindung bleibt allein das
                Namensfeld — kein leerer Kasten, der nach einem Fehler aussieht. */}
            {hatPortalBlock && (
              <div className="flex flex-col gap-3">
                <label className="flex items-start gap-3 text-sm">
                  <input
                    type="radio"
                    name="rp-namequelle"
                    className="mt-1"
                    checked={quelle === "portal"}
                    onChange={() => setQuelle("portal")}
                  />
                  <span className="flex flex-col gap-0.5">
                    <span className="font-medium">
                      {t("ratePlanWizard.sourcePortalLabel")}
                    </span>
                    <span className="text-muted-foreground">
                      {t("ratePlanWizard.sourcePortalHint")}
                    </span>
                  </span>
                </label>

                {quelle === "portal" && (
                  <div className="flex flex-col gap-4 pl-6">
                    {portale?.map((pt) => (
                      <PortalRatenBlock
                        key={pt.portal}
                        portal={pt}
                        gewaehltCode={
                          gewaehlt?.rate.portal === pt.portal
                            ? gewaehlt.rate.rate_plan_code
                            : null
                        }
                        istWaehlbar={istWaehlbar}
                        onWaehlen={rateUebernehmen}
                      />
                    ))}
                    {/* Der übernommene Titel ist der PLANNAME — das muss
                        dastehen, sonst weiß der Nutzer nicht, wie sein Plan
                        gleich heißt. Als Tatsache, nicht als Eingabefeld: ein
                        gesperrtes Textfeld sähe nach Eingabe aus. */}
                    {gewaehlt && (
                      <p className="text-sm text-muted-foreground">
                        {t("ratePlanWizard.nameLockedHint")}
                      </p>
                    )}
                    {/* Kollidiert der Portal-Titel mit einem bestehenden Plan,
                        wäre der Name mehrdeutig und `paar_fuer_portal_plan`
                        ordnete fail-closed GAR NICHTS mehr zu — deshalb hier
                        derselbe harte Stopp wie im eigenen Weg. */}
                    {gewaehlt && nameTaken && (
                      <p className="text-sm text-destructive">
                        {t("ratePlanWizard.nameTaken")}
                      </p>
                    )}
                  </div>
                )}

                <label className="flex items-start gap-3 text-sm">
                  <input
                    type="radio"
                    name="rp-namequelle"
                    className="mt-1"
                    checked={quelle === "eigen"}
                    onChange={aufEigenWechseln}
                  />
                  <span className="flex flex-col gap-0.5">
                    <span className="font-medium">
                      {t("ratePlanWizard.sourceOwnLabel")}
                    </span>
                    <span className="text-muted-foreground">
                      {t("ratePlanWizard.sourceOwnHint")}
                    </span>
                  </span>
                </label>

                {/* Das Namensfeld gehört zum WEG „eigener Preisplan" und steht
                    deshalb unter dessen Radio — nicht unter beiden. Im
                    Portal-Weg zeigt der übernommene Titel darüber in der
                    gewählten Rate; ein zusätzliches (gesperrtes) Textfeld sähe
                    dort nach einer Eingabe aus, die es nicht ist. */}
                {quelle === "eigen" && (
                  <div className="flex flex-col gap-2 pl-6">
                    <NamensFeld
                      name={name}
                      nameTaken={nameTaken}
                      onChange={setName}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Ohne Portal-Verbindung gibt es keinen zweiten Weg und damit auch
                keine Auswahl — dann steht das Namensfeld allein und ohne
                Einrückung, genau wie vorher. */}
            {!hatPortalBlock && (
              <div className="flex flex-col gap-2">
                <NamensFeld
                  name={name}
                  nameTaken={nameTaken}
                  onChange={setName}
                />
              </div>
            )}
          </div>
        )}

        {step === "stay" && (
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium" htmlFor="rp-minstay">
              {t("ratePlanWizard.minStayLabel")}
            </label>
            <Input
              id="rp-minstay"
              type="number"
              min={1}
              value={minStay}
              onChange={(e) => setMinStay(e.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              {gewaehlt && gewaehlt.rate.min_stay != null
                ? // Bei erkanntem Vorschlag wird gesagt, WOHER die Zahl kommt.
                  // Ein stillschweigend vorbelegtes Feld sähe aus wie eine
                  // Nutzereingabe, und niemand prüfte sie nach.
                  t("ratePlanWizard.minStaySuggested", {
                    nights: gewaehlt.rate.min_stay,
                    title: gewaehlt.rate.title,
                  })
                : t("ratePlanWizard.minStayHint")}
            </p>

            {/* Portal-Versand. ZWEI verschiedene Aussagen, weil es zwei
                verschiedene Sachverhalte sind — dieselbe Trennung, die
                `pricing-form.tsx` in der Plan-Liste schon fährt (dort ist der
                Schalter bei einer Portal-Rate ausgeblendet und stattdessen ein
                Kennzeichen sichtbar):

                (a) ÜBERNOMMENE PORTAL-RATE: keine Frage, sondern eine Tatsache.
                    Die Rate IST beim Portal die Rate; ihr Preis MUSS dorthin,
                    sonst verkauft das Portal sie weiter ohne unseren Preis und
                    ohne unsere Restriktionen (live belegt 23.08.2026: eine
                    1-Nacht-Buchung über die „Wochenrate" an einem Objekt mit
                    Mindestaufenthalt 3). Ein abschaltbarer Schalter hier wäre
                    eine Lüge — und würde der Plan-Liste widersprechen.

                (b) EIGENER PLAN: bleibt die Frage, die er war. Der Grundpreis
                    geht ohnehin an die Portale, dieser zusätzliche Preis nur auf
                    Wunsch (`sendToPortalsHint` gilt unverändert weiter). */}
            {gewaehlt ? (
              <div className="mt-2 flex items-start gap-3 rounded-(--radius) border border-border bg-secondary/40 p-3">
                <PortalMarke
                  code={gewaehlt.rate.portal}
                  name={gewaehlt.portalLabel}
                />
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">
                    {t("ratePlanWizard.goesToPortalFact", {
                      portal: gewaehlt.portalLabel,
                    })}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {t("ratePlanWizard.goesToPortalHint", {
                      title: gewaehlt.rate.title,
                    })}
                  </span>
                </span>
              </div>
            ) : (
              <label className="mt-2 flex items-start gap-3 rounded-(--radius) border border-border p-3">
                <input
                  type="checkbox"
                  className="mt-1 size-4"
                  checked={sendToPortals}
                  onChange={(e) => setSendToPortals(e.target.checked)}
                />
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">
                    {t("ratePlanWizard.sendToPortalsLabel")}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {t("ratePlanWizard.sendToPortalsHint")}
                  </span>
                </span>
              </label>
            )}
          </div>
        )}

        {step === "pricing" && (
          <div className="flex flex-col gap-4">
            {currency ? (
              <p className="text-sm text-muted-foreground">
                {t("ratePlanWizard.currencyFixed", { currency })}
              </p>
            ) : (
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="rp-currency"
                  className="text-sm font-medium"
                >
                  {t("ratePlanWizard.currencyLabel")}
                </label>
                <NativeSelect
                  id="rp-currency"
                  value={waehrungNeu}
                  onChange={(e) =>
                    setWaehrungNeu(e.target.value as Currency | "")
                  }
                >
                  <option value="">{t("ratePlanWizard.currencyChoose")}</option>
                  {CURRENCY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </NativeSelect>
                <p className="text-sm text-muted-foreground">
                  {t("ratePlanWizard.currencyHint")}
                </p>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="rp-mode"
                  checked={!derive}
                  onChange={() => setDerive(false)}
                />
                {t("ratePlanWizard.modeManual")}
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="rp-mode"
                  checked={derive}
                  disabled={manualPlans.length === 0}
                  onChange={() => setDerive(true)}
                />
                {t("ratePlanWizard.modeDerived")}
              </label>
              {manualPlans.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  {t("ratePlanWizard.noParentAvailable")}
                </p>
              )}
            </div>

            {!derive ? (
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium" htmlFor="rp-base">
                  {t("ratePlanWizard.basePriceLabel")}
                </label>
                <Input
                  id="rp-base"
                  type="number"
                  min={0}
                  step="0.01"
                  value={basePrice}
                  onChange={(e) => setBasePrice(e.target.value)}
                />
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium" htmlFor="rp-parent">
                    {t("ratePlanWizard.parentLabel")}
                  </label>
                  <NativeSelect
                    id="rp-parent"
                    value={parentId}
                    onChange={(e) => setParentId(e.target.value)}
                  >
                    {manualPlans.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </NativeSelect>
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium">
                    {t("ratePlanWizard.amountLabel")}
                  </span>
                  <div className="flex gap-2">
                    <NativeSelect
                      value={amountDir}
                      onChange={(e) => setAmountDir(e.target.value as Direction)}
                      className="w-auto"
                      aria-label={t("ratePlanWizard.amountLabel")}
                    >
                      <option value="increase">
                        {t("ratePlanWizard.increase")}
                      </option>
                      <option value="decrease">
                        {t("ratePlanWizard.decrease")}
                      </option>
                    </NativeSelect>
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium">
                    {t("ratePlanWizard.percentLabel")}
                  </span>
                  <div className="flex gap-2">
                    <NativeSelect
                      value={percentDir}
                      onChange={(e) =>
                        setPercentDir(e.target.value as Direction)
                      }
                      className="w-auto"
                      aria-label={t("ratePlanWizard.percentLabel")}
                    >
                      <option value="increase">
                        {t("ratePlanWizard.increase")}
                      </option>
                      <option value="decrease">
                        {t("ratePlanWizard.decrease")}
                      </option>
                    </NativeSelect>
                    <Input
                      type="number"
                      min={0}
                      step="0.001"
                      value={percent}
                      onChange={(e) => setPercent(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                </div>

                <p className="text-sm text-muted-foreground">
                  {t("ratePlanWizard.orderHint")}
                </p>

                {/* Live-Vorschau: macht „erst Betrag, dann Prozent" greifbar. */}
                <div className="rounded-xl bg-secondary/50 p-3 text-sm">
                  {t("ratePlanWizard.previewLine", {
                    base: formatCurrency(PREVIEW_BASE, effektiveWaehrung),
                    result: formatCurrency(previewOut, effektiveWaehrung),
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {step === "review" && (
          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">
                {t("ratePlanWizard.nameLabel")}
              </dt>
              <dd className="font-medium">{name}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">
                {t("ratePlanWizard.minStayLabel")}
              </dt>
              <dd className="font-medium">{minStay}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">
                {t("ratePlanWizard.pricingTitle")}
              </dt>
              <dd className="text-right font-medium">
                {derive
                  ? t("ratePlanWizard.reviewDerived", {
                      parent: parent?.name ?? "",
                      result: formatCurrency(previewOut, effektiveWaehrung),
                      base: formatCurrency(PREVIEW_BASE, effektiveWaehrung),
                    })
                  : formatCurrency(Number(basePrice) || 0, effektiveWaehrung)}
              </dd>
            </div>
            {/* Bei übernommener Rate steht im Prüfschritt, WOHIN der Preis geht.
                Der Plan heißt wie die Portal-Rate; ohne diese Zeile wäre am
                Ende nicht mehr erkennbar, dass der Name kein freier Text war. */}
            {gewaehlt && (
              <div className="flex justify-between gap-4">
                <dt className="text-muted-foreground">
                  {t("ratePlanWizard.reviewPortalRate")}
                </dt>
                <dd className="flex items-center justify-end gap-2 text-right font-medium">
                  <PortalMarke
                    code={gewaehlt.rate.portal}
                    name={gewaehlt.portalLabel}
                  />
                </dd>
              </div>
            )}
          </dl>
        )}

        {err && <p className="text-sm text-destructive">{err}</p>}

        <div className="flex justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              idx === 0 ? onClose() : setStep(STEPS[idx - 1] as Step)
            }
            disabled={busy}
          >
            {idx === 0 ? t("ratePlanWizard.cancel") : t("ratePlanWizard.back")}
          </Button>
          {step === "review" ? (
            <Button type="button" onClick={() => void submit()} disabled={busy}>
              {busy ? t("ratePlanWizard.saving") : t("ratePlanWizard.save")}
            </Button>
          ) : (
            <Button
              type="button"
              onClick={() => setStep(STEPS[idx + 1] as Step)}
              disabled={!canNext || busy}
            >
              {t("ratePlanWizard.next")}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

// Das Namensfeld des Wegs „eigener Preisplan". Eigener Baustein, weil es an
// zwei Stellen steht (mit und ohne Portal-Block) und beide Stellen dasselbe
// zeigen müssen — eine zweite Kopie wäre die Stelle, an der ein Hinweis fehlt.
function NamensFeld({
  name,
  nameTaken,
  onChange,
}: {
  name: string;
  nameTaken: boolean;
  onChange: (wert: string) => void;
}) {
  const t = useTranslations("objects");
  return (
    <>
      <label className="text-sm font-medium" htmlFor="rp-name">
        {t("ratePlanWizard.nameLabel")}
      </label>
      <Input
        id="rp-name"
        value={name}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("ratePlanWizard.namePlaceholder")}
      />
      {nameTaken && (
        <p className="text-sm text-destructive">
          {t("ratePlanWizard.nameTaken")}
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        {t("ratePlanWizard.nameHint")}
      </p>
    </>
  );
}

// Portal-Logo + Name. Dieselbe Regel wie überall sonst (`lib/channel-logos`,
// gleiches Muster wie `PortalMarke` in `pricing-form.tsx`): NUR echte, offiziell
// beschaffte Markenlogos, KEIN generisches Ersatz-Icon und kein nachgezeichnetes
// Logo. Hat ein Portal kein echtes Logo im Katalog, steht dort nur sein Name —
// besser als ein Platzhalter-Symbol, das nach „irgendein Kanal" aussieht.
function PortalMarke({ code, name }: { code: string; name: string }) {
  const logo = channelLogoLoose(code) ?? channelLogoLoose(name);
  return (
    <span className="flex min-w-0 shrink-0 items-center gap-2">
      {logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={logo}
          alt=""
          className="size-4 shrink-0 rounded-sm object-contain"
        />
      )}
      <span className="truncate text-sm font-medium">{name}</span>
    </span>
  );
}

// Die Raten EINES Portals. Die vier Zustände des Endpunkts werden hier
// AUSEINANDERGEHALTEN — das ist der eigentliche Zweck dieses Blocks:
//
//  * `abruf_ok: false` → „die Raten konnten nicht abgerufen werden". NIEMALS
//    „keine Raten vorhanden": in einer leeren Liste sehen beide gleich aus, und
//    genau diese Verwechslung ließe den Nutzer den Titel wieder abtippen — also
//    genau der Fehler zurück, den der Dialog beheben soll (Wurzel 5).
//  * `kanal_lesbar: false` → die Raten sind bekannt, ihre BELEGUNG nicht. Alle
//    tragen dann `belegt: null` und bleiben wählbar, aber mit Hinweis.
//  * `belegt: true` → angezeigt, aber ausgegraut und mit sichtbarem Grund. Nicht
//    weggefiltert: der Nutzer sucht sonst eine Rate, die er im Portal sieht, und
//    findet sie nicht. Ein zweiter Plan mit demselben Namen wäre außerdem
//    schädlich — dann ist der Name mehrdeutig und `paar_fuer_portal_plan` ordnet
//    fail-closed GAR NICHTS mehr zu.
//  * `truncated: true` → die Liste ist gekappt, und das steht dort.
function PortalRatenBlock({
  portal,
  gewaehltCode,
  istWaehlbar,
  onWaehlen,
}: {
  portal: PortalRatenAuswahlPortal;
  gewaehltCode: string | null;
  istWaehlbar: (r: PortalRateAuswahl) => boolean;
  onWaehlen: (r: PortalRateAuswahl, portalLabel: string) => void;
}) {
  const t = useTranslations("objects");
  return (
    <div className="flex flex-col gap-2">
      <PortalMarke code={portal.portal} name={portal.portal_label} />

      {!portal.abruf_ok ? (
        // Der Abruf ist FEHLGESCHLAGEN. Benannt als das, was es ist, plus der
        // Weg, der trotzdem offen steht.
        <p className="rounded-(--radius) border border-border bg-secondary/40 p-3 text-sm text-muted-foreground">
          {t("ratePlanWizard.portalRatesFailed", {
            portal: portal.portal_label,
          })}
        </p>
      ) : (
        <>
          {!portal.kanal_lesbar && (
            <p className="text-sm text-muted-foreground">
              {t("ratePlanWizard.portalRatesOccupancyUnknown")}
            </p>
          )}
          <ul className="flex flex-col gap-1.5">
            {portal.rates.map((r) => {
              const waehlbar = istWaehlbar(r);
              const aktiv = gewaehltCode === r.rate_plan_code;
              return (
                <li key={`${r.portal}-${r.rate_plan_code}`}>
                  <button
                    type="button"
                    disabled={!waehlbar}
                    onClick={() => onWaehlen(r, portal.portal_label)}
                    className={`flex w-full items-center justify-between gap-3 rounded-(--radius) border p-2.5 text-left transition-colors ${
                      aktiv
                        ? "border-accent bg-accent/10"
                        : "border-border hover:bg-secondary/50"
                    } disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent`}
                  >
                    <span className="flex min-w-0 flex-col gap-0.5">
                      {/* Der Titel EXAKT wie das Portal ihn führt — er ist der
                          Zuordnungs-Schlüssel, kein Anzeigetext. */}
                      <span className="truncate text-sm font-medium">
                        {r.title}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {r.belegt === true
                          ? t("ratePlanWizard.rateOccupied")
                          : r.belegt === null
                            ? t("ratePlanWizard.rateOccupancyUnknown")
                            : r.min_stay != null
                              ? t("ratePlanWizard.rateMinStayHint", {
                                  nights: r.min_stay,
                                })
                              : t("ratePlanWizard.rateFree")}
                      </span>
                    </span>
                    {aktiv && (
                      <Icon
                        icon="ph:check-circle-fill"
                        className="size-5 shrink-0 text-accent"
                        aria-hidden
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          {portal.truncated && (
            <p className="text-xs text-muted-foreground">
              {t("ratePlanWizard.portalRatesTruncated")}
            </p>
          )}
        </>
      )}
    </div>
  );
}

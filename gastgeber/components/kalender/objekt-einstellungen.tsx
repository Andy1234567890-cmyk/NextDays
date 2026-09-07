"use client";

// Rechtes Panel des Objekt-Kalenders — 1:1 nach Airbnbs Seitenleiste in
// `/multicalendar/{listing_id}`, am 06.09.2026 im Browser AUSGEMESSEN
// (docs/AIRBNB-MULTIKALENDER-ANALYSE.md, Abschnitt M). Die Werte stehen hier
// als Zahlen, nicht als Gefühl:
//
//   Panel                339 px breit
//   Zurück-Knopf         44 × 44, rund, gefüllt (kein Rahmen)
//   Titel                26 px / 30 px, Gewicht 600
//   Untertitel           16 px / 20 px, Gewicht 400, grau
//   Karte                Radius 16 px, Innenabstand 24 px, Rahmen 1 px
//     Beschriftung       14 px / 18 px, Gewicht 500, schwarz
//     Unterzeile         14 px / 18 px, Gewicht 400, grau
//     Wert               22 px / 26 px, Gewicht 600  (lange Werte 18 / 24)
//     Trennlinie + Zeile mit Chevron am Fuß der Karte
//   gewählte Karte       2 px Rahmen + graue Fläche (kein Radio, kein Haken)
//   Fuß                  „Speichern" volle Breite, darunter „Abbrechen" als
//                        Umriss — nicht nebeneinander
//   Fußnote              14 px / 20 px, grau, ZENTRIERT
//
// Ebenen — wie dort, jede IM Panel, nicht auf einer neuen Seite:
//
//   Übersicht ─▸ Preisgestaltung ─▸ Basispreis
//               │                 └▸ Wochenendaufschlag
//               ├▸ Rabatte
//               ├▸ Verfügbarkeit
//               └▸ Stornierungen ─▸ Richtlinie wählen
//
// Zwei Stellen, an denen unser Datenmodell etwas anderes hergibt als das
// Vorbild — beide benannt, keine erfundene Fassade:
//   • Airbnb trennt „Kurzzeit-" und „Langzeitaufenthalte" (28 Nächte). Bei uns
//     hängt EINE Buchungsbedingung am Preisplan; zwei Karten mit demselben
//     Wert wären eine Attrappe.
//   • „Gebühren" und „Preistipps" fehlen: Reinigung/Haustiere/zusätzliche
//     Gäste liegen nicht am Objekt des Gastgebers, und eine Empfehlungs-Engine
//     haben wir nicht.
import { Icon } from "@iconify/react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@nextdays/ui/dialog";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";

import { currencySymbol, formatCurrency } from "@nextdays/currency";

import {
  geltendeBedingung,
  type Buchungsbedingung,
} from "@/lib/buchungsbedingungen";
import {
  legeBuchungsbedingungAn,
  setzeBuchungsbedingung,
} from "@/lib/buchungsbedingungen-actions";
import { PANEL_REM } from "@/lib/kalender-mass";
import type { Discount, PreisStand } from "@/lib/preise";
import {
  setBasePrice,
  setLengthDiscount,
  updateSmartPricing,
} from "@/lib/preise-actions";
import type { Property } from "@/lib/properties";
import {
  LANGZEIT_AB_NAECHTEN,
  NICHT_ERSTATTBAR,
  STORNO_RICHTLINIEN,
  STORNO_RICHTLINIEN_LANG,
  type StornoRichtlinie,
} from "@/lib/storno-richtlinien";

type Ansicht =
  | "uebersicht"
  | "preis"
  | "basispreis"
  | "wochenende"
  | "rabatte"
  | "verfuegbarkeit"
  | "storno"
  | "stornoWahlKurz"
  | "stornoWahlLang";

/** Eine Zeile der Übersicht: Titel 16/20 Gewicht 500, Werte grau, Chevron. */
function Zeile({
  titel,
  werte,
  onOeffnen,
}: {
  titel: string;
  werte: string[];
  onOeffnen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOeffnen}
      className="flex min-h-[4.5rem] w-full items-center gap-3 border-b border-border py-4 text-start transition-colors hover:bg-muted/40"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-base font-medium leading-5">{titel}</span>
        {werte.map((w) => (
          <span key={w} className="mt-1 block text-base leading-5 text-muted-foreground">
            {w}
          </span>
        ))}
      </span>
      <Icon
        icon="ph:caret-right"
        className="size-4 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
    </button>
  );
}

/** Eine Karte der zweiten Ebene (Radius 16, Innenabstand 24). */
function Karte({
  label,
  unterzeile,
  wert,
  punkte,
  aktion,
  onOeffnen,
}: {
  label: string;
  unterzeile?: string;
  wert?: string;
  punkte?: string[];
  /** Zeile unter einer Trennlinie am Fuß der Karte (mit Chevron). */
  aktion?: { text: string; onKlick: () => void };
  onOeffnen?: () => void;
}) {
  // Ein langer Wert fällt im Vorbild von 22 px auf 18 px, damit er zweizeilig
  // noch in die Karte passt.
  const kleinerWert = (wert?.length ?? 0) > 22;
  const inhalt = (
    <>
      <p className="text-sm font-medium leading-[1.125rem]">{label}</p>
      {unterzeile && (
        <p className="mt-1 text-sm leading-[1.125rem] text-muted-foreground">
          {unterzeile}
        </p>
      )}
      {wert && (
        <p
          className={
            kleinerWert
              ? "mt-3 text-[1.125rem] font-semibold leading-6"
              : "mt-3 text-[1.375rem] font-semibold leading-[1.625rem]"
          }
        >
          {wert}
        </p>
      )}
      {punkte && punkte.length > 0 && (
        <ul className="mt-2 space-y-1">
          {punkte.map((z) => (
            <li
              key={z}
              className="flex gap-2 text-sm leading-[1.125rem] text-muted-foreground"
            >
              <span aria-hidden="true">·</span>
              <span>{z}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
  const klasse = "w-full rounded-2xl border border-border p-6 text-start";
  if (aktion) {
    return (
      <div className={klasse}>
        {inhalt}
        <div className="mt-4 border-t border-border pt-4">
          <button
            type="button"
            onClick={aktion.onKlick}
            className="flex w-full items-center justify-between gap-3 text-start text-sm font-medium"
          >
            {aktion.text}
            <Icon icon="ph:caret-right" className="size-4 shrink-0" aria-hidden="true" />
          </button>
        </div>
      </div>
    );
  }
  return onOeffnen ? (
    <button
      type="button"
      onClick={onOeffnen}
      className={`${klasse} transition-colors hover:bg-muted/30`}
    >
      {inhalt}
    </button>
  ) : (
    <div className={klasse}>{inhalt}</div>
  );
}

/**
 * Eine wählbare Richtlinie: Titel 18/24 Gewicht 600, rechts das (i), darunter
 * die Sätze. Das (i) ist im Vorbild KEIN Tooltip, sondern öffnet einen kleinen
 * Dialog „Infos zu anteiliger Rückerstattung" — es erklärt genau den Fall, den
 * die zwei Zeilen offenlassen: was passiert, wenn während des Aufenthalts
 * storniert wird.
 */
function RichtlinienKarte({
  titel,
  punkte,
  gewaehlt,
  onWaehlen,
  onInfo,
  infoLabel,
  laeuft,
}: {
  titel: string;
  punkte: string[];
  gewaehlt: boolean;
  onWaehlen: () => void;
  onInfo: () => void;
  infoLabel: string;
  laeuft: boolean;
}) {
  return (
    <div
      className={`relative w-full rounded-2xl transition-colors ${
        gewaehlt
          ? "border-2 border-foreground bg-muted/50"
          : "border border-border hover:bg-muted/30"
      }`}
    >
      <button
        type="button"
        onClick={onWaehlen}
        disabled={laeuft}
        aria-pressed={gewaehlt}
        className="w-full p-6 text-start disabled:opacity-60"
      >
        <p className="pe-8 text-[1.125rem] font-semibold leading-6">{titel}</p>
        <ul className="mt-2 space-y-1">
          {punkte.map((z) => (
            <li key={z} className="flex gap-2 text-sm leading-5 text-muted-foreground">
              <span aria-hidden="true">·</span>
              <span>{z}</span>
            </li>
          ))}
        </ul>
      </button>
      <button
        type="button"
        onClick={onInfo}
        aria-label={infoLabel}
        className="absolute end-5 top-6 flex size-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground"
      >
        <Icon icon="ph:info" className="size-5" aria-hidden="true" />
      </button>
    </div>
  );
}

/** Der Info-Dialog: X oben links, Titel und Text zentriert, ein voller Knopf. */
function InfoDialog({
  offen,
  titel,
  text,
  schliessenLabel,
  knopf,
  onSchliessen,
}: {
  offen: boolean;
  titel: string;
  text: string;
  schliessenLabel: string;
  knopf: string;
  onSchliessen: () => void;
}) {
  return (
    <Dialog open={offen} onOpenChange={(o) => !o && onSchliessen()}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogClose
          aria-label={schliessenLabel}
          className="absolute start-5 top-5 flex size-6 items-center justify-center rounded-full transition-colors hover:bg-muted"
        >
          <Icon icon="ph:x" className="size-4" aria-hidden="true" />
        </DialogClose>
        <DialogTitle className="mt-6 text-center text-[1.5rem] font-semibold leading-8">
          {titel}
        </DialogTitle>
        <DialogDescription className="mt-3 text-center text-base leading-6">
          {text}
        </DialogDescription>
        <button
          type="button"
          onClick={onSchliessen}
          className="mt-6 w-full rounded-xl bg-foreground py-4 text-base font-medium text-background transition-opacity hover:opacity-90"
        >
          {knopf}
        </button>
      </DialogContent>
    </Dialog>
  );
}

export function ObjektEinstellungen({
  objekt,
  preisStand,
  bedingungen,
  waehrung,
  onGeaendert,
}: {
  objekt: Property;
  /** null = der Preis-Stand ließ sich nicht laden (Panel bleibt sachlich leer). */
  preisStand: PreisStand | null;
  /** Buchungsbedingungen des Betriebs (Storno, Zahlungsplan, Kaution). */
  bedingungen: Buchungsbedingung[];
  waehrung: string | null;
  /** Nach einer Änderung: Kalender neu laden (Preise ändern sich je Tag). */
  onGeaendert: () => void;
}) {
  const t = useTranslations("kalender");
  const [ansicht, setAnsicht] = useState<Ansicht>("uebersicht");
  const [stand, setStand] = useState(preisStand);
  const [liste, setListe] = useState(bedingungen);
  const [laeuft, setLaeuft] = useState(false);
  // Welche Richtlinie ihren Info-Dialog offen hat (null = keiner).
  const [info, setInfo] = useState<StornoRichtlinie | null>(null);

  // Eingaben der Bearbeiten-Ebenen. Sie starten leer und werden beim Öffnen aus
  // dem Ist-Stand gefüllt — so ist „nichts eingegeben" von „0 eingegeben"
  // unterscheidbar (Wurzel 4).
  const [basisEingabe, setBasisEingabe] = useState("");
  const [wochenendEingabe, setWochenendEingabe] = useState("");
  const [wocheEingabe, setWocheEingabe] = useState("");
  const [monatEingabe, setMonatEingabe] = useState("");

  const av = objekt.type_attributes.availability ?? {};
  const geld = (betrag: number) => formatCurrency(betrag, stand?.currency ?? waehrung);
  const kurzBedingung = geltendeBedingung(liste, stand?.bookingConditionId ?? null);
  // Für lange Aufenthalte gilt die eigene Bedingung; ohne sie die der kurzen —
  // das ist der Bestand aus 0165 und keine erfundene Regel.
  const langBedingung = stand?.bookingConditionLongId
    ? (liste.find((b) => b.id === stand.bookingConditionLongId) ?? null)
    : null;
  const istNichtErstattbar = kurzBedingung?.cancellation_mode === "non_refundable";

  function oeffne(neu: Ansicht) {
    if (neu === "basispreis") setBasisEingabe(stand?.basePrice?.toString() ?? "");
    if (neu === "wochenende") {
      setWochenendEingabe(stand?.smart.weekend_uplift_pct?.toString() ?? "");
    }
    if (neu === "rabatte") {
      setWocheEingabe(
        stand?.weeklyDiscount ? String(stand.weeklyDiscount.discount_bps / 100) : "",
      );
      setMonatEingabe(
        stand?.monthlyDiscount ? String(stand.monthlyDiscount.discount_bps / 100) : "",
      );
    }
    setAnsicht(neu);
  }

  async function basispreisSpeichern() {
    const wert = Number(basisEingabe.replace(",", "."));
    const w = stand?.currency ?? waehrung;
    // Ohne Währung kein Preis: sie kommt aus den Daten und wird nie geraten
    // (Wurzel 4). Fehlt sie, ist das ein Datenfehler, kein Anlass für „EUR".
    if (!w) {
      toast.error(t("einstKeineWaehrung"));
      return;
    }
    if (!(wert > 0)) {
      toast.error(t("einstPreisUngueltig"));
      return;
    }
    setLaeuft(true);
    const res = await setBasePrice(objekt.id, wert, w);
    setLaeuft(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setStand(stand ? { ...stand, basePrice: res.data.base_price } : stand);
    toast.success(t("gespeichert"));
    setAnsicht("preis");
    onGeaendert();
  }

  async function wochenendeSpeichern() {
    const wert = Number(wochenendEingabe.replace(",", "."));
    if (Number.isNaN(wert)) {
      toast.error(t("einstProzentUngueltig"));
      return;
    }
    setLaeuft(true);
    const res = await updateSmartPricing(objekt.id, { weekend_uplift_pct: wert });
    setLaeuft(false);
    if (!res.ok) {
      toast.error(res.error);
      return;
    }
    setStand(stand ? { ...stand, smart: res.data } : stand);
    toast.success(t("gespeichert"));
    setAnsicht("preis");
    onGeaendert();
  }

  async function rabatteSpeichern() {
    setLaeuft(true);
    const woche = await setLengthDiscount(
      objekt.id,
      7,
      wocheEingabe ? Number(wocheEingabe.replace(",", ".")) : undefined,
      stand?.weeklyDiscount ?? null,
    );
    const monat = await setLengthDiscount(
      objekt.id,
      28,
      monatEingabe ? Number(monatEingabe.replace(",", ".")) : undefined,
      stand?.monthlyDiscount ?? null,
    );
    setLaeuft(false);
    if (!woche.ok || !monat.ok) {
      toast.error(!woche.ok ? woche.error : (monat as { error: string }).error);
      return;
    }
    setStand(
      stand
        ? {
            ...stand,
            weeklyDiscount: woche.data as Discount | null,
            monthlyDiscount: monat.data as Discount | null,
          }
        : stand,
    );
    toast.success(t("gespeichert"));
    setAnsicht("uebersicht");
    onGeaendert();
  }

  /**
   * Eine Stornorichtlinie wählen — EIN Klick, wie im Vorbild, kein Formular.
   *
   * Gibt es die Bedingung mit diesem Namen schon, wird sie wiederverwendet;
   * zweimal „Moderat" anzulegen wäre kein zweiter Zustand, sondern eine
   * Dublette (Wurzel 2). Danach hängt sie am Preisplan dieses Objekts.
   */
  async function richtlinieWaehlen(r: StornoRichtlinie, ziel: "kurz" | "lang") {
    if (!stand?.ratePlanId) {
      toast.error(t("stornoOhnePreisplan"));
      return;
    }
    setLaeuft(true);
    let bed = liste.find((b) => b.internal_name === r.name) ?? null;
    if (!bed) {
      const res = await legeBuchungsbedingungAn({
        internal_name: r.name,
        cancellation_mode: r.modus,
        refund_rules: r.staffel,
        // Die erste Bedingung des Betriebs wird sein Standard — sonst gälte für
        // alle übrigen Objekte weiterhin „keine".
        is_default: liste.length === 0,
      });
      if (!res.ok) {
        setLaeuft(false);
        toast.error(res.fehler);
        return;
      }
      bed = {
        id: res.data.id,
        internal_name: r.name,
        is_default: liste.length === 0,
        cancellation_mode: r.modus,
        refund_rules: r.staffel,
        deposit_required: false,
        deposit_amount: null,
        deposit_currency: null,
      };
      setListe([...liste, bed]);
    }
    const zu = await setzeBuchungsbedingung(
      stand.ratePlanId,
      objekt.id,
      bed.id,
      ziel,
    );
    setLaeuft(false);
    if (!zu.ok) {
      toast.error(zu.fehler);
      return;
    }
    setStand(
      ziel === "lang"
        ? { ...stand, bookingConditionLongId: bed.id }
        : { ...stand, bookingConditionId: bed.id },
    );
    toast.success(t("gespeichert"));
    setAnsicht("storno");
    onGeaendert();
  }

  /**
   * Den Schalter „Nicht erstattungsfähig" umlegen.
   *
   * An: die Kurzzeit-Bedingung wird auf die nicht erstattungsfähige Vorlage
   * gesetzt. Aus: sie fällt auf „Moderat" zurück — irgendwohin MUSS sie
   * fallen, sonst stünde nach dem Ausschalten keine Bedingung mehr da, und
   * der Gast wüsste gar nicht, was gilt (Gegenzustand, Wurzel 1).
   */
  async function nichtErstattbarUmschalten() {
    const ziel = istNichtErstattbar
      ? (STORNO_RICHTLINIEN.find((r) => r.key === "moderat") ?? STORNO_RICHTLINIEN[0])
      : NICHT_ERSTATTBAR;
    await richtlinieWaehlen(ziel, "kurz");
  }

  /** Kopf einer Unterseite: Zurück-Knopf 44 × 44, Titel 26/30, Untertitel grau. */
  function Kopf({
    titel,
    unterzeile,
    zurueck,
    zentriert = false,
  }: {
    titel: string;
    unterzeile?: string;
    zurueck: Ansicht;
    zentriert?: boolean;
  }) {
    return (
      <>
        <button
          type="button"
          onClick={() => setAnsicht(zurueck)}
          aria-label={t("zurueck")}
          className="flex size-11 items-center justify-center rounded-full bg-muted transition-colors hover:bg-border"
        >
          <Icon icon="ph:arrow-left" className="size-4" aria-hidden="true" />
        </button>
        <h2
          className={`mt-4 text-[1.625rem] font-semibold leading-[1.875rem] ${
            zentriert ? "text-center" : ""
          }`}
        >
          {titel}
        </h2>
        {unterzeile && (
          <p
            className={`mt-2 text-base leading-5 text-muted-foreground ${
              zentriert ? "text-center" : ""
            }`}
          >
            {unterzeile}
          </p>
        )}
      </>
    );
  }

  /** Fuß: „Speichern" volle Breite, darunter „Abbrechen" als Umriss. */
  function Fuss({ onSpeichern, zurueck }: { onSpeichern: () => void; zurueck: Ansicht }) {
    return (
      <div className="mt-8 space-y-3">
        <button
          type="button"
          onClick={onSpeichern}
          disabled={laeuft}
          className="w-full rounded-xl bg-foreground py-4 text-base font-medium text-background transition-opacity hover:opacity-90 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
        >
          {laeuft ? t("wirdGespeichert") : t("speichern")}
        </button>
        <button
          type="button"
          onClick={() => setAnsicht(zurueck)}
          disabled={laeuft}
          className="w-full rounded-xl border border-foreground py-4 text-base font-medium transition-colors hover:bg-muted"
        >
          {t("abbrechen")}
        </button>
      </div>
    );
  }

  const preisWerte: string[] = [];
  if (stand?.basePrice != null) {
    preisWerte.push(t("einstBasispreis", { betrag: geld(stand.basePrice) }));
  }
  if (stand?.smart.enabled) preisWerte.push(t("einstSmartAn"));

  const rabattWerte: string[] = [];
  if (stand?.weeklyDiscount) {
    rabattWerte.push(t("einstWoche", { prozent: stand.weeklyDiscount.discount_bps / 100 }));
  }
  if (stand?.monthlyDiscount) {
    rabattWerte.push(t("einstMonat", { prozent: stand.monthlyDiscount.discount_bps / 100 }));
  }

  const min = stand?.minStay ?? av.minStay;
  const max = av.maxStay;
  const verfuegbarkeitWerte: string[] = [];
  if (min && max) verfuegbarkeitWerte.push(t("einstAufenthalte", { min, max }));
  else if (min) verfuegbarkeitWerte.push(t("einstMindestens", { naechte: min }));
  else if (max) verfuegbarkeitWerte.push(t("einstHoechstens", { naechte: max }));
  if (av.cutOffDays != null) {
    verfuegbarkeitWerte.push(t("einstVorlauf", { tage: av.cutOffDays }));
  }
  if (av.maxDayAdvance != null) {
    verfuegbarkeitWerte.push(t("einstFenster", { tage: av.maxDayAdvance }));
  }

  return (
    <aside
      style={{ width: `${PANEL_REM}rem` }}
      className="flex shrink-0 flex-col overflow-y-auto border-s border-border px-6 py-6"
    >
      {ansicht === "uebersicht" && (
        <>
          <Zeile
            titel={t("einstPreisgestaltung")}
            werte={preisWerte}
            onOeffnen={() => oeffne("preis")}
          />
          <Zeile
            titel={t("einstRabatte")}
            werte={rabattWerte}
            onOeffnen={() => oeffne("rabatte")}
          />
          <Zeile
            titel={t("verfuegbarkeit")}
            werte={verfuegbarkeitWerte}
            onOeffnen={() => oeffne("verfuegbarkeit")}
          />
          <Zeile
            titel={t("stornoTitel")}
            werte={kurzBedingung ? [kurzBedingung.internal_name] : []}
            onOeffnen={() => oeffne("storno")}
          />
        </>
      )}

      {ansicht === "preis" && (
        <>
          <Kopf
            titel={t("einstPreisgestaltung")}
            unterzeile={t("einstHinweis")}
            zurueck="uebersicht"
          />
          <div className="mt-6 space-y-3">
            <Karte
              label={t("einstBasispreisLabel")}
              unterzeile={t("einstBasispreisUnterzeile")}
              wert={
                stand?.basePrice != null
                  ? geld(stand.basePrice)
                  : t("einstNichtsHinterlegt")
              }
              onOeffnen={() => oeffne("basispreis")}
            />
            <Karte
              label={t("einstWochenendLabel")}
              unterzeile={t("einstWochenendTage")}
              wert={
                stand && stand.smart.weekend_uplift_pct !== 0
                  ? t("einstProzent", { prozent: stand.smart.weekend_uplift_pct })
                  : t("einstNichtsHinterlegt")
              }
              onOeffnen={() => oeffne("wochenende")}
            />
          </div>
        </>
      )}

      {ansicht === "basispreis" && (
        <>
          <Kopf titel={t("einstBasispreisLabel")} zurueck="preis" />
          <div className="mt-10 text-center">
            <div className="flex items-end justify-center gap-2">
              <input
                value={basisEingabe}
                onChange={(e) => setBasisEingabe(e.target.value)}
                inputMode="decimal"
                aria-label={t("einstBasispreisLabel")}
                className="w-44 border-b border-border bg-transparent pb-1 text-center text-[3rem] font-bold leading-[3.875rem] tabular-nums outline-none focus-visible:border-foreground"
              />
              <span className="pb-4 text-xl text-muted-foreground">
                {currencySymbol(stand?.currency ?? waehrung)}
              </span>
            </div>
            <p className="mt-4 text-sm leading-5 text-muted-foreground">
              {t("einstBasispreisHinweis")}
            </p>
          </div>
          <Fuss onSpeichern={() => void basispreisSpeichern()} zurueck="preis" />
        </>
      )}

      {ansicht === "wochenende" && (
        <>
          <Kopf
            titel={t("einstWochenendLabel")}
            unterzeile={t("einstWochenendTage")}
            zurueck="preis"
          />
          <div className="mt-10 text-center">
            <div className="flex items-end justify-center gap-2">
              <input
                value={wochenendEingabe}
                onChange={(e) => setWochenendEingabe(e.target.value)}
                inputMode="decimal"
                aria-label={t("einstWochenendLabel")}
                className="w-32 border-b border-border bg-transparent pb-1 text-center text-[3rem] font-bold leading-[3.875rem] tabular-nums outline-none focus-visible:border-foreground"
              />
              <span className="pb-4 text-xl text-muted-foreground">%</span>
            </div>
            <p className="mt-4 text-sm leading-5 text-muted-foreground">
              {t("einstWochenendHinweis")}
            </p>
          </div>
          <Fuss onSpeichern={() => void wochenendeSpeichern()} zurueck="preis" />
        </>
      )}

      {ansicht === "rabatte" && (
        <>
          <Kopf
            titel={t("einstRabatte")}
            unterzeile={t("einstHinweis")}
            zurueck="uebersicht"
          />
          <div className="mt-6 space-y-3">
            {(
              [
                [
                  "einstWochenrabatt",
                  "einstWochenrabattHinweis",
                  wocheEingabe,
                  setWocheEingabe,
                ],
                [
                  "einstMonatsrabatt",
                  "einstMonatsrabattHinweis",
                  monatEingabe,
                  setMonatEingabe,
                ],
              ] as const
            ).map(([label, hinweis, wert, setzen]) => (
              <div key={label} className="rounded-2xl border border-border p-6">
                <p className="text-sm font-medium leading-[1.125rem]">{t(label)}</p>
                <p className="mt-1 text-sm leading-[1.125rem] text-muted-foreground">
                  {t(hinweis)}
                </p>
                <div className="mt-3 flex items-center gap-2">
                  <input
                    value={wert}
                    onChange={(e) => setzen(e.target.value.replace(/[^\d.,]/g, ""))}
                    inputMode="decimal"
                    aria-label={t(label)}
                    className="h-11 w-24 rounded-xl border border-border bg-background px-3 tabular-nums outline-none focus-visible:border-foreground"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              </div>
            ))}
          </div>
          <Fuss onSpeichern={() => void rabatteSpeichern()} zurueck="uebersicht" />
        </>
      )}

      {ansicht === "verfuegbarkeit" && (
        <>
          <Kopf
            titel={t("verfuegbarkeit")}
            unterzeile={t("einstHinweis")}
            zurueck="uebersicht"
          />
          <div className="mt-6 space-y-3">
            <Karte
              label={t("einstMindestLabel")}
              wert={
                min ? t("einstNaechteWert", { naechte: min }) : t("einstNichtsHinterlegt")
              }
            />
            <Karte
              label={t("einstHoechstLabel")}
              wert={
                max ? t("einstNaechteWert", { naechte: max }) : t("einstNichtsHinterlegt")
              }
            />
            <Karte
              label={t("einstVorlaufLabel")}
              wert={
                av.cutOffDays != null
                  ? t("einstTageWert", { tage: av.cutOffDays })
                  : t("einstNichtsHinterlegt")
              }
            />
            <Karte
              label={t("einstFensterLabel")}
              wert={
                av.maxDayAdvance != null
                  ? t("einstTageWert", { tage: av.maxDayAdvance })
                  : t("einstNichtsHinterlegt")
              }
            />
          </div>
          {/* Geändert wird die Verfügbarkeit dort, wo ihre Felder leben — sie
              hängen an Rate-Plan und Objekt, nicht am Kalendertag. */}
          <Link
            href={`/objekte/${objekt.id}?bereich=verfuegbarkeit`}
            className="mt-6 flex items-center justify-center gap-2 rounded-xl border border-foreground py-4 text-base font-medium transition-colors hover:bg-muted"
          >
            <Icon icon="ph:pencil-simple" className="size-4" aria-hidden="true" />
            {t("einstImEditorAendern")}
          </Link>
        </>
      )}

      {ansicht === "storno" && (
        <>
          <Kopf
            titel={t("stornoTitel")}
            unterzeile={t("einstHinweis")}
            zurueck="uebersicht"
          />
          <div className="mt-6 space-y-3">
            {/* Drei Karten wie im Vorbild: kurze Aufenthalte, lange
                Aufenthalte, und die nicht erstattungsfähige Option als
                Schalter. Die Schwelle von 28 Nächten steht in
                `LANGZEIT_AB_NAECHTEN`, damit sie nicht in drei Texten
                auseinanderläuft. */}
            <Karte
              label={t("stornoKurz")}
              unterzeile={t("stornoKurzUnterzeile", { naechte: LANGZEIT_AB_NAECHTEN })}
              wert={kurzBedingung ? kurzBedingung.internal_name : t("stornoKeine")}
              onOeffnen={() => setAnsicht("stornoWahlKurz")}
            />
            <Karte
              label={t("stornoLang")}
              unterzeile={t("stornoLangUnterzeile", { naechte: LANGZEIT_AB_NAECHTEN })}
              wert={
                langBedingung
                  ? langBedingung.internal_name
                  : t("stornoWieKurz")
              }
              onOeffnen={() => setAnsicht("stornoWahlLang")}
            />
            <div className="w-full rounded-2xl border border-border p-6">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-medium leading-[1.125rem]">
                  {t("stornoNichtErstattbar")}
                </p>
                {/* Der Schalter stellt die KURZZEIT-Bedingung auf „nicht
                    erstattungsfähig" um. Airbnbs Zusatz („Gäste zahlen 10 %
                    weniger") steht hier NICHT: einen Rabatt, den niemand
                    berechnet, zu versprechen wäre eine Falschaussage. */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={istNichtErstattbar}
                  aria-label={t("stornoNichtErstattbar")}
                  disabled={laeuft}
                  onClick={() => void nichtErstattbarUmschalten()}
                  className={`relative h-6 w-9 shrink-0 overflow-hidden rounded-full transition-colors disabled:opacity-60 ${
                    istNichtErstattbar ? "bg-foreground" : "bg-muted-foreground/40"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`absolute left-0.5 top-0.5 size-5 rounded-full bg-background transition-transform ${
                      istNichtErstattbar ? "translate-x-3" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
              <p className="mt-2 text-sm leading-[1.125rem] text-muted-foreground">
                {t("stornoNichtErstattbarText")}
              </p>
            </div>
          </div>
          <p className="mt-6 text-center text-sm leading-5 text-muted-foreground">
            {t("stornoFussnote")}
          </p>
        </>
      )}

      {(ansicht === "stornoWahlKurz" || ansicht === "stornoWahlLang") && (
        <>
          <Kopf
            titel={
              ansicht === "stornoWahlLang" ? t("stornoLang") : t("stornoKurz")
            }
            unterzeile={
              ansicht === "stornoWahlLang"
                ? t("stornoLangUnterzeile", { naechte: LANGZEIT_AB_NAECHTEN })
                : t("stornoKurzUnterzeile", { naechte: LANGZEIT_AB_NAECHTEN })
            }
            zurueck="storno"
            zentriert
          />
          <div className="mt-6 space-y-3">
            {(ansicht === "stornoWahlLang"
              ? STORNO_RICHTLINIEN_LANG
              : STORNO_RICHTLINIEN
            ).map((r) => (
              <RichtlinienKarte
                key={r.key}
                titel={t(`richtlinie_${r.key}`)}
                punkte={[t(`richtlinie_${r.key}_1`), t(`richtlinie_${r.key}_2`)]}
                gewaehlt={
                  (ansicht === "stornoWahlLang" ? langBedingung : kurzBedingung)
                    ?.internal_name === r.name
                }
                onWaehlen={() =>
                  void richtlinieWaehlen(
                    r,
                    ansicht === "stornoWahlLang" ? "lang" : "kurz",
                  )
                }
                onInfo={() => setInfo(r)}
                infoLabel={t("richtlinieInfoLabel")}
                laeuft={laeuft}
              />
            ))}
          </div>
        </>
      )}

      <InfoDialog
        offen={info !== null}
        titel={t("richtlinieInfoTitel")}
        text={info ? t(`richtlinie_${info.key}_info`) : ""}
        schliessenLabel={t("schliessen")}
        knopf={t("richtlinieInfoKnopf")}
        onSchliessen={() => setInfo(null)}
      />
    </aside>
  );
}

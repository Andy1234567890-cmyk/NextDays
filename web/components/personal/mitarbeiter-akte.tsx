"use client";

// Personalakte einer Person — Kartei nach der Taskilo-Vorlage (Kopf mit
// Kurzinfo-Karten, Reiter Grunddaten, Vertrag & Arbeitszeit, Verträge,
// Qualifikationen, Dokumente, Compliance, Urlaub & Anträge, Arbeitszeit,
// Verfügbarkeit, Gespräche, Disziplin, Zugang), gegen unser Modell gesiebt
// (docs/PERSONAL-DIENSTPLAN-KONZEPT.md §2, ADR-0023 Punkt 8).
//
// Sensible Kennungen (Steuer-ID, SV-Nummer, IBAN) kommen MASKIERT vom Server;
// ein neuer Wert wird verschlüsselt gespeichert, der alte nie im Klartext
// angezeigt. Löschen eines Feldes läuft über `geleert` (Weglassen ≠ Löschen).
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { DatePicker } from "@nextdays/ui/date-picker";
import { Input } from "@nextdays/ui/input";
import { Label } from "@nextdays/ui/label";
import { NativeSelect } from "@nextdays/ui/native-select";
import { OverflowTabs } from "@nextdays/ui/overflow-tabs";
import { Switch } from "@nextdays/ui/switch";
import { Textarea } from "@nextdays/ui/textarea";
import {
  abwesenheitEntscheiden,
  abwesenheitStornieren,
  azkBuchen,
  createVerfuegbarkeit,
  deleteVerfuegbarkeit,
  dokumentAendern,
  dokumentAnfragen,
  dokumentLoeschen,
  dokumentUploadZiel,
  saveAkte,
  setQualifikationen,
  setUrlaubskonto,
} from "@/lib/personal";
import type { AkteAenderung, AktePlus } from "@/lib/personal-betrieb-typen";
import {
  type Abwesenheit,
  type Akte,
  type AkteUpdate,
  type Arbeitsbereich,
  type Arbeitszeitkonto,
  BESCHAEFTIGUNGSARTEN,
  DOKUMENT_ARTEN,
  type Dokument,
  FAMILIENSTAENDE,
  type Fremdfirma,
  type Gespraech,
  type Massnahme,
  type MitarbeiterListItem,
  type Nachweis,
  type Paar,
  type PersonUebersicht,
  type PlanPerson,
  type Qualifikation,
  type Schulung,
  type Urlaubskonto,
  type Verfuegbarkeit,
  type Vertrag,
  type Vorfall,
  type ZeitListe,
  stunden,
} from "@/lib/personal-typen";
import { formatDate, formatDateTime } from "@/lib/utils";

import { AntragDialog, StatusBadge } from "./abwesenheiten";
import { AkteAenderungen } from "./akte-aenderungen";
import { AkteArbeitszeit } from "./akte-arbeitszeit";
import { AkteCompliance } from "./akte-compliance";
import { AkteDisziplin } from "./akte-disziplin";
import { AkteGespraeche } from "./akte-gespraeche";
import { AkteKopf } from "./akte-kopf";
import { AkteNachweise } from "./akte-nachweise";
import { AkteVertraege } from "./akte-vertraege";
import { AkteZugang } from "./akte-zugang";
import { Feld, PaarFeld, minorZuText, textOderNull, textZuMinor, zahlOderNull } from "./kartei-helfer";

type Reiter =
  | "grund"
  | "vertrag"
  | "vertraege"
  | "quali"
  | "dokumente"
  | "compliance"
  | "urlaub"
  | "arbeitszeit"
  | "verfuegbar"
  | "gespraeche"
  | "disziplin"
  | "aenderungen"
  | "zugang";

const WOCHENTAGE = [0, 1, 2, 3, 4, 5, 6] as const;

export function MitarbeiterAkte({
  person,
  uebersicht,
  akte,
  qualifikationen,
  dokumente,
  fremdfirmen,
  arbeitsbereiche,
  objekte,
  urlaubskonto,
  urlaubFehler,
  arbeitszeitkonto,
  verfuegbarkeiten,
  abwesenheiten,
  vertraege,
  massnahmen,
  vorfaelle,
  gespraeche,
  nachweise,
  schulungen,
  zeiten,
  aenderungen,
  zone,
  tenantCountry,
  jahr,
  kannAkte,
  kannBestaetigen,
  kannEntscheiden,
  eigeneId,
}: {
  person: MitarbeiterListItem;
  uebersicht: PersonUebersicht;
  /** `AktePlus` = `Akte` plus die optionalen Felder aus §3.1 (Verdienstgrenze,
   *  `stempel_id`, `hat_terminal_pin`). Optional, weil der Server sie erst mit
   *  dem Akte-Recht liefert — ohne Recht bleibt die Vorlage leer statt zu raten. */
  akte: AktePlus;
  qualifikationen: Qualifikation[];
  dokumente: Dokument[];
  fremdfirmen: Fremdfirma[];
  arbeitsbereiche: Arbeitsbereich[];
  objekte: { id: string; title: string }[];
  urlaubskonto: Urlaubskonto | null;
  urlaubFehler: string | null;
  arbeitszeitkonto: Arbeitszeitkonto | null;
  verfuegbarkeiten: Verfuegbarkeit[];
  abwesenheiten: Abwesenheit[];
  vertraege: Vertrag[];
  massnahmen: Massnahme[];
  vorfaelle: Vorfall[];
  gespraeche: Gespraech[];
  nachweise: Nachweis[];
  schulungen: Schulung[];
  zeiten: ZeitListe;
  /** Terminierte Akte-Änderungen (§3.1). Leer, solange die Route sie nicht
   *  liefert — der Reiter zeigt dann „keine", nicht einen Fehler. */
  aenderungen: AkteAenderung[];
  zone: string;
  tenantCountry: string | null;
  jahr: number;
  kannAkte: boolean;
  kannBestaetigen: boolean;
  kannEntscheiden: boolean;
  eigeneId: string | null;
}) {
  const t = useTranslations("personal");
  const [reiter, setReiter] = useState<Reiter>("grund");
  const zaehler = (n: number) => (n > 0 ? ` (${n})` : "");
  const tabs: { key: Reiter; label: string }[] = [
    { key: "grund", label: t("akte.tabs.grund") },
    { key: "vertrag", label: t("akte.tabs.vertrag") },
    ...(kannAkte ? [{ key: "vertraege" as Reiter, label: t("akte.tabs.vertraege") + zaehler(uebersicht.vertraege) }] : []),
    { key: "quali", label: t("akte.tabs.quali") },
    { key: "dokumente", label: t("akte.tabs.dokumente") + zaehler(dokumente.length) },
    { key: "compliance", label: t("akte.tabs.compliance") },
    { key: "urlaub", label: t("akte.tabs.urlaub") + zaehler(uebersicht.offene_antraege) },
    { key: "arbeitszeit", label: t("akte.tabs.arbeitszeit") },
    { key: "verfuegbar", label: t("akte.tabs.verfuegbar") },
    ...(kannAkte
      ? [
          { key: "gespraeche" as Reiter, label: t("akte.tabs.gespraeche") + zaehler(uebersicht.gespraeche) },
          { key: "disziplin" as Reiter, label: t("akte.tabs.disziplin") + zaehler(uebersicht.massnahmen_offen) },
          {
            key: "aenderungen" as Reiter,
            label:
              t("akte.tabs.aenderungen") +
              zaehler(aenderungen.filter((a) => !a.angewendet_am).length),
          },
          { key: "zugang" as Reiter, label: t("akte.tabs.zugang") },
        ]
      : []),
  ];
  const personAlsPlan: PlanPerson = {
    user_id: person.user_id,
    full_name: person.full_name,
    role: person.role,
    avatar_url: person.avatar_url,
    beschaeftigungsart: person.beschaeftigungsart,
    wochenstunden_soll: person.wochenstunden,
    arbeitsbereiche: person.arbeitsbereiche,
  };
  return (
    <div className="flex flex-1 flex-col gap-4 pb-20">
      <AkteKopf u={uebersicht} akte={akte} kannAkte={kannAkte} />
      <OverflowTabs tabs={tabs} active={reiter} onSelect={(k) => setReiter(k as Reiter)} />
      {reiter === "grund" && <Grunddaten akte={akte} land={tenantCountry} />}
      {reiter === "vertrag" && <Vertrag akte={akte} fremdfirmen={fremdfirmen} />}
      {reiter === "vertraege" && <AkteVertraege userId={akte.user_id} vertraege={vertraege} dokumente={dokumente} />}
      {reiter === "quali" && (
        <div className="flex flex-col gap-6">
          <Qualifikationen userId={akte.user_id} eintraege={qualifikationen} bereiche={arbeitsbereiche} objekte={objekte} />
          <AkteNachweise userId={akte.user_id} nachweise={nachweise} dokumente={dokumente} kannBearbeiten={kannAkte} />
        </div>
      )}
      {reiter === "dokumente" && <Dokumente userId={akte.user_id} dokumente={dokumente} />}
      {reiter === "compliance" && <AkteCompliance userId={akte.user_id} dokumente={dokumente} schulungen={schulungen} kannBearbeiten={kannAkte} />}
      {reiter === "urlaub" && (
        <UrlaubUndKonten
          person={personAlsPlan}
          konto={urlaubskonto}
          fehler={urlaubFehler}
          azk={arbeitszeitkonto}
          jahr={jahr}
          extern={akte.beschaeftigungsart === "extern"}
          abwesenheiten={abwesenheiten}
          kannEntscheiden={kannEntscheiden}
          eigeneId={eigeneId}
        />
      )}
      {reiter === "arbeitszeit" && <AkteArbeitszeit u={uebersicht} zeiten={zeiten} zone={zone} objekte={objekte} kannBestaetigen={kannBestaetigen} />}
      {reiter === "verfuegbar" && <Verfuegbarkeiten userId={akte.user_id} eintraege={verfuegbarkeiten} />}
      {reiter === "gespraeche" && <AkteGespraeche userId={akte.user_id} gespraeche={gespraeche} />}
      {reiter === "disziplin" && <AkteDisziplin userId={akte.user_id} massnahmen={massnahmen} vorfaelle={vorfaelle} dokumente={dokumente} />}
      {reiter === "aenderungen" && (
        <AkteAenderungen
          userId={akte.user_id}
          initial={aenderungen}
          fremdfirmen={fremdfirmen}
          currency={akte.currency}
          kannBearbeiten={kannAkte}
        />
      )}
      {reiter === "zugang" && (
        <AkteZugang
          u={uebersicht}
          stempelId={akte.stempel_id ?? null}
          hatTerminalPin={akte.hat_terminal_pin ?? false}
          kannVerwalten={kannAkte}
        />
      )}
    </div>
  );
}

// --- Helfer ---------------------------------------------------------------

function useAkteSpeichern(userId: string) {
  const t = useTranslations("personal");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function speichern(body: AkteUpdate) {
    setBusy(true);
    const res = await saveAkte(userId, body);
    setBusy(false);
    if (!res.ok) {
      toast.error(res.error);
      return false;
    }
    toast.success(t("akte.gespeichert"));
    router.refresh();
    return true;
  }
  return { speichern, busy };
}

// --- Grunddaten ------------------------------------------------------------

function Grunddaten({ akte, land }: { akte: Akte; land: string | null }) {
  const t = useTranslations("personal");
  const { speichern, busy } = useAkteSpeichern(akte.user_id);
  const [f, setF] = useState({
    employee_number: akte.employee_number ?? "",
    position: akte.position ?? "",
    geburtsdatum: akte.geburtsdatum ?? "",
    geburtsort: akte.geburtsort ?? "",
    staatsangehoerigkeit: akte.staatsangehoerigkeit ?? "",
    familienstand: akte.familienstand ?? "",
    kinder_anzahl: akte.kinder_anzahl?.toString() ?? "",
    strasse: akte.strasse ?? "",
    hausnummer: akte.hausnummer ?? "",
    plz: akte.plz ?? "",
    ort: akte.ort ?? "",
    land: akte.land ?? land ?? "",
    notfall_name: akte.notfall_name ?? "",
    notfall_beziehung: akte.notfall_beziehung ?? "",
    notfall_telefon: akte.notfall_telefon ?? "",
    steuer_id: "",
    sv_nummer: "",
    krankenkasse: akte.krankenkasse ?? "",
    iban: "",
    bic: akte.bic ?? "",
    bank_name: akte.bank_name ?? "",
    kontoinhaber: akte.kontoinhaber ?? "",
    notiz: akte.notiz ?? "",
  });
  const [lohnmerkmale, setLohnmerkmale] = useState<Paar[]>(akte.lohnmerkmale);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF((x) => ({ ...x, [k]: e.target.value }));

  async function absenden(e: React.FormEvent) {
    e.preventDefault();
    const body: AkteUpdate = { beschaeftigungsart: akte.beschaeftigungsart, geleert: [] };
    const geleert: string[] = [];
    const text = (k: keyof typeof f, ziel: keyof AkteUpdate) => {
      const v = textOderNull(f[k]);
      if (v === null) geleert.push(String(ziel));
      else (body as Record<string, unknown>)[ziel] = k === "land" || k === "staatsangehoerigkeit" ? v.toUpperCase() : v;
    };
    text("employee_number", "employee_number");
    text("position", "position");
    text("geburtsdatum", "geburtsdatum");
    text("geburtsort", "geburtsort");
    text("staatsangehoerigkeit", "staatsangehoerigkeit");
    text("familienstand", "familienstand");
    text("strasse", "strasse");
    text("hausnummer", "hausnummer");
    text("plz", "plz");
    text("ort", "ort");
    text("land", "land");
    text("notfall_name", "notfall_name");
    text("notfall_beziehung", "notfall_beziehung");
    text("notfall_telefon", "notfall_telefon");
    text("krankenkasse", "krankenkasse");
    text("bic", "bic");
    text("bank_name", "bank_name");
    text("kontoinhaber", "kontoinhaber");
    text("notiz", "notiz");
    const kinder = zahlOderNull(f.kinder_anzahl);
    if (kinder === null) geleert.push("kinder_anzahl");
    else body.kinder_anzahl = Math.round(kinder);
    body.lohnmerkmale = lohnmerkmale.filter((p) => p.schluessel.trim());
    // Kennungen: nur setzen, wenn NEU eingegeben — leer heißt „unverändert",
    // nicht „löschen" (die maskierte Anzeige lässt sich nicht zurückschreiben).
    if (f.steuer_id.trim()) body.steuer_id = f.steuer_id.trim();
    if (f.sv_nummer.trim()) body.sv_nummer = f.sv_nummer.trim();
    if (f.iban.trim()) body.iban = f.iban.replace(/\s+/g, "").toUpperCase();
    body.geleert = geleert;
    if (await speichern(body)) setF((x) => ({ ...x, steuer_id: "", sv_nummer: "", iban: "" }));
  }

  return (
    <form onSubmit={absenden} className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border bg-card p-4">
        <h2 className="mb-3 font-display text-lg font-extrabold">{t("akte.person")}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Feld label={t("akte.felder.employee_number")}><Input value={f.employee_number} onChange={set("employee_number")} /></Feld>
          <Feld label={t("akte.felder.position")}><Input value={f.position} onChange={set("position")} /></Feld>
          <Feld label={t("akte.felder.geburtsdatum")}>
            <DatePicker value={f.geburtsdatum} onChange={(v) => setF((x) => ({ ...x, geburtsdatum: v }))} />
          </Feld>
          <Feld label={t("akte.felder.geburtsort")}><Input value={f.geburtsort} onChange={set("geburtsort")} /></Feld>
          <Feld label={t("akte.felder.staatsangehoerigkeit")} hint="ISO-2, z. B. DK">
            <Input value={f.staatsangehoerigkeit} onChange={set("staatsangehoerigkeit")} maxLength={2} />
          </Feld>
          <Feld label={t("akte.felder.familienstand")}>
            <NativeSelect value={f.familienstand} onChange={set("familienstand")}>
              <option value="">—</option>
              {FAMILIENSTAENDE.map((s) => <option key={s} value={s}>{t(`familienstand.${s}`)}</option>)}
            </NativeSelect>
          </Feld>
          <Feld label={t("akte.felder.kinder_anzahl")}>
            <Input inputMode="numeric" value={f.kinder_anzahl} onChange={set("kinder_anzahl")} />
          </Feld>
        </div>
      </section>
      <section className="rounded-2xl border bg-card p-4">
        <h2 className="mb-3 font-display text-lg font-extrabold">{t("akte.adresse")}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Feld label={t("akte.felder.strasse")}><Input value={f.strasse} onChange={set("strasse")} /></Feld>
          <Feld label={t("akte.felder.hausnummer")}><Input value={f.hausnummer} onChange={set("hausnummer")} /></Feld>
          <Feld label={t("akte.felder.plz")}><Input value={f.plz} onChange={set("plz")} /></Feld>
          <Feld label={t("akte.felder.ort")}><Input value={f.ort} onChange={set("ort")} /></Feld>
          <Feld label={t("akte.felder.land")} hint="ISO-2"><Input value={f.land} onChange={set("land")} maxLength={2} /></Feld>
        </div>
        <h3 className="mb-2 mt-4 font-medium">{t("akte.notfall")}</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <Feld label={t("akte.felder.notfall_name")}><Input value={f.notfall_name} onChange={set("notfall_name")} /></Feld>
          <Feld label={t("akte.felder.notfall_beziehung")}><Input value={f.notfall_beziehung} onChange={set("notfall_beziehung")} /></Feld>
          <Feld label={t("akte.felder.notfall_telefon")}><Input value={f.notfall_telefon} onChange={set("notfall_telefon")} /></Feld>
        </div>
      </section>
      <section className="rounded-2xl border bg-card p-4">
        <h2 className="mb-1 font-display text-lg font-extrabold">{t("akte.kennungen")}</h2>
        <p className="mb-3 text-xs text-muted-foreground">{t("akte.kennungenHint")}</p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Feld label={t("akte.felder.steuer_id")} hint={akte.steuer_id_maskiert ?? t("akte.nichtErfasst")}>
            <Input value={f.steuer_id} onChange={set("steuer_id")} placeholder={t("akte.neuEingeben")} autoComplete="off" />
          </Feld>
          <Feld label={t("akte.felder.sv_nummer")} hint={akte.sv_nummer_maskiert ?? t("akte.nichtErfasst")}>
            <Input value={f.sv_nummer} onChange={set("sv_nummer")} placeholder={t("akte.neuEingeben")} autoComplete="off" />
          </Feld>
          <Feld label={t("akte.felder.krankenkasse")}><Input value={f.krankenkasse} onChange={set("krankenkasse")} /></Feld>
        </div>
        <div className="mt-4">
          <PaarFeld label={t("akte.felder.lohnmerkmale")} hint={t("akte.lohnmerkmaleHint")} werte={lohnmerkmale} onChange={setLohnmerkmale} />
        </div>
      </section>
      <section className="rounded-2xl border bg-card p-4">
        <h2 className="mb-3 font-display text-lg font-extrabold">{t("akte.bank")}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Feld label={t("akte.felder.iban")} hint={akte.iban_maskiert ?? t("akte.nichtErfasst")}>
            <Input value={f.iban} onChange={set("iban")} placeholder={t("akte.neuEingeben")} autoComplete="off" />
          </Feld>
          <Feld label={t("akte.felder.bic")}><Input value={f.bic} onChange={set("bic")} /></Feld>
          <Feld label={t("akte.felder.bank_name")}><Input value={f.bank_name} onChange={set("bank_name")} /></Feld>
          <Feld label={t("akte.felder.kontoinhaber")}><Input value={f.kontoinhaber} onChange={set("kontoinhaber")} /></Feld>
        </div>
        <Feld label={t("akte.felder.notiz")}>
          <Textarea value={f.notiz} onChange={set("notiz")} rows={3} />
        </Feld>
      </section>
      <div className="lg:col-span-2">
        <Button type="submit" disabled={busy} className="rounded-full">
          {t("speichern")}
        </Button>
      </div>
    </form>
  );
}

// --- Vertrag & Arbeitszeit ---------------------------------------------------

function Vertrag({ akte, fremdfirmen }: { akte: Akte; fremdfirmen: Fremdfirma[] }) {
  const t = useTranslations("personal");
  const { speichern, busy } = useAkteSpeichern(akte.user_id);
  const [f, setF] = useState({
    beschaeftigungsart: akte.beschaeftigungsart,
    firma_id: akte.firma_id ?? "",
    eintritt: akte.eintritt ?? "",
    austritt: akte.austritt ?? "",
    probezeit_bis: akte.probezeit_bis ?? "",
    wochenstunden: akte.wochenstunden?.toString() ?? "",
    tagesstunden: akte.tagesstunden?.toString() ?? "",
    arbeitstage_je_woche: akte.arbeitstage_je_woche?.toString() ?? "",
    stundenlohn: minorZuText(akte.stundenlohn_minor),
    gehalt: minorZuText(akte.gehalt_minor),
    currency: akte.currency ?? "",
    urlaubsanspruch_tage: akte.urlaubsanspruch_tage?.toString() ?? "",
    arbeitgeber_aufschlag_pct: akte.arbeitgeber_aufschlag_pct?.toString() ?? "",
  });
  const extern = f.beschaeftigungsart === "extern";

  async function absenden(e: React.FormEvent) {
    e.preventDefault();
    const geleert: string[] = [];
    const body: AkteUpdate = { beschaeftigungsart: f.beschaeftigungsart };
    const zahl = (k: "wochenstunden" | "tagesstunden" | "arbeitstage_je_woche" | "urlaubsanspruch_tage" | "arbeitgeber_aufschlag_pct") => {
      const v = zahlOderNull(f[k]);
      if (v === null) geleert.push(k);
      else (body as Record<string, unknown>)[k] = v;
    };
    const datum = (k: "eintritt" | "austritt" | "probezeit_bis") => {
      if (f[k]) body[k] = f[k];
      else geleert.push(k);
    };
    datum("eintritt");
    datum("austritt");
    datum("probezeit_bis");
    zahl("wochenstunden");
    zahl("tagesstunden");
    zahl("arbeitstage_je_woche");
    if (extern) {
      body.firma_id = f.firma_id || null;
      geleert.push("stundenlohn_minor", "gehalt_minor", "urlaubsanspruch_tage", "currency", "arbeitgeber_aufschlag_pct");
    } else {
      geleert.push("firma_id");
      zahl("urlaubsanspruch_tage");
      zahl("arbeitgeber_aufschlag_pct");
      const lohn = textZuMinor(f.stundenlohn);
      const gehalt = textZuMinor(f.gehalt);
      if (lohn === null) geleert.push("stundenlohn_minor");
      else body.stundenlohn_minor = lohn;
      if (gehalt === null) geleert.push("gehalt_minor");
      else body.gehalt_minor = gehalt;
      if (f.currency.trim()) body.currency = f.currency.trim().toUpperCase();
      else geleert.push("currency");
    }
    body.geleert = geleert;
    await speichern(body);
  }

  return (
    <form onSubmit={absenden} className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl border bg-card p-4">
        <h2 className="mb-3 font-display text-lg font-extrabold">{t("akte.beschaeftigung")}</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Feld label={t("akte.felder.beschaeftigungsart")}>
            <NativeSelect
              value={f.beschaeftigungsart}
              onChange={(e) => setF((x) => ({ ...x, beschaeftigungsart: e.target.value as Akte["beschaeftigungsart"] }))}
            >
              {BESCHAEFTIGUNGSARTEN.map((a) => (
                <option key={a} value={a}>{t(`beschaeftigungsart.${a}`)}</option>
              ))}
            </NativeSelect>
          </Feld>
          {extern && (
            <Feld label={t("akte.felder.firma")} hint={fremdfirmen.length === 0 ? t("akte.keineFirma") : undefined}>
              <NativeSelect value={f.firma_id} onChange={(e) => setF((x) => ({ ...x, firma_id: e.target.value }))}>
                <option value="">—</option>
                {fremdfirmen.filter((x) => !x.archived_at).map((x) => (
                  <option key={x.id} value={x.id}>{x.name}</option>
                ))}
              </NativeSelect>
            </Feld>
          )}
          <Feld label={t("akte.felder.eintritt")}>
            <DatePicker value={f.eintritt} onChange={(v) => setF((x) => ({ ...x, eintritt: v }))} />
          </Feld>
          <Feld label={t("akte.felder.austritt")}>
            <DatePicker value={f.austritt} onChange={(v) => setF((x) => ({ ...x, austritt: v }))} />
          </Feld>
          <Feld label={t("akte.felder.probezeit_bis")}>
            <DatePicker value={f.probezeit_bis} onChange={(v) => setF((x) => ({ ...x, probezeit_bis: v }))} />
          </Feld>
        </div>
      </section>
      <section className="rounded-2xl border bg-card p-4">
        <h2 className="mb-3 font-display text-lg font-extrabold">{t("akte.arbeitszeit")}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Feld label={t("akte.felder.wochenstunden")}>
            <Input inputMode="decimal" value={f.wochenstunden} onChange={(e) => setF((x) => ({ ...x, wochenstunden: e.target.value }))} />
          </Feld>
          <Feld label={t("akte.felder.tagesstunden")}>
            <Input inputMode="decimal" value={f.tagesstunden} onChange={(e) => setF((x) => ({ ...x, tagesstunden: e.target.value }))} />
          </Feld>
          <Feld label={t("akte.felder.arbeitstage_je_woche")} hint={t("akte.arbeitstageHint")}>
            <Input inputMode="numeric" value={f.arbeitstage_je_woche} onChange={(e) => setF((x) => ({ ...x, arbeitstage_je_woche: e.target.value }))} />
          </Feld>
        </div>
        {!extern && (
          <>
            <h3 className="mb-2 mt-4 font-medium">{t("akte.lohn")}</h3>
            <div className="grid gap-3 sm:grid-cols-3">
              <Feld label={t("akte.felder.stundenlohn")}>
                <Input inputMode="decimal" value={f.stundenlohn} onChange={(e) => setF((x) => ({ ...x, stundenlohn: e.target.value }))} />
              </Feld>
              <Feld label={t("akte.felder.gehalt")}>
                <Input inputMode="decimal" value={f.gehalt} onChange={(e) => setF((x) => ({ ...x, gehalt: e.target.value }))} />
              </Feld>
              <Feld label={t("akte.felder.currency")} hint={t("akte.currencyHint")}>
                <Input value={f.currency} onChange={(e) => setF((x) => ({ ...x, currency: e.target.value }))} maxLength={3} />
              </Feld>
              <Feld label={t("akte.felder.urlaubsanspruch_tage")}>
                <Input inputMode="decimal" value={f.urlaubsanspruch_tage} onChange={(e) => setF((x) => ({ ...x, urlaubsanspruch_tage: e.target.value }))} />
              </Feld>
              <Feld label={t("akte.felder.arbeitgeber_aufschlag_pct")} hint={t("akte.aufschlagHint")}>
                <Input inputMode="decimal" value={f.arbeitgeber_aufschlag_pct} onChange={(e) => setF((x) => ({ ...x, arbeitgeber_aufschlag_pct: e.target.value }))} />
              </Feld>
            </div>
          </>
        )}
        {extern && <p className="mt-4 text-sm text-muted-foreground">{t("akte.externHint")}</p>}
      </section>
      <div className="lg:col-span-2">
        <Button type="submit" disabled={busy} className="rounded-full">{t("speichern")}</Button>
      </div>
    </form>
  );
}

// --- Qualifikationen (Einsatz) ----------------------------------------------

function Qualifikationen({
  userId,
  eintraege,
  bereiche,
  objekte,
}: {
  userId: string;
  eintraege: Qualifikation[];
  bereiche: Arbeitsbereich[];
  objekte: { id: string; title: string }[];
}) {
  const t = useTranslations("personal");
  const router = useRouter();
  const [liste, setListe] = useState(eintraege.map((q) => ({ ...q })));
  const [busy, setBusy] = useState(false);

  function toggle(bereichId: string) {
    setListe((l) =>
      l.some((q) => q.arbeitsbereich_id === bereichId && !q.property_id)
        ? l.filter((q) => !(q.arbeitsbereich_id === bereichId && !q.property_id))
        : [...l, { id: "", user_id: userId, arbeitsbereich_id: bereichId, property_id: null, stufe: "selbststaendig" }],
    );
  }

  async function speichern() {
    setBusy(true);
    const res = await setQualifikationen(
      userId,
      liste.map((q) => ({ arbeitsbereich_id: q.arbeitsbereich_id, property_id: q.property_id, stufe: q.stufe })),
    );
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(t("akte.gespeichert"));
    router.refresh();
  }

  return (
    <section className="rounded-2xl border bg-card p-4">
      <h2 className="mb-1 font-display text-lg font-extrabold">{t("akte.einsatzQuali")}</h2>
      <p className="mb-3 text-sm text-muted-foreground">{t("akte.qualiHint")}</p>
      {bereiche.length === 0 && (
        <p className="text-sm">
          {t("akte.keineBereiche")} <Link href="/hr/einstellungen" className="underline">{t("einstellungen.title")}</Link>
        </p>
      )}
      <ul className="divide-y">
        {bereiche.map((b) => {
          const aktiv = liste.find((q) => q.arbeitsbereich_id === b.id && !q.property_id);
          return (
            <li key={b.id} className="flex flex-wrap items-center gap-3 py-2">
              <span className="size-3 rounded-full" style={{ backgroundColor: b.farbe }} />
              <span className="flex-1 font-medium">{b.name}</span>
              {aktiv && (
                <NativeSelect
                  value={aktiv.stufe}
                  onChange={(e) =>
                    setListe((l) => l.map((q) => (q === aktiv ? { ...q, stufe: e.target.value as Qualifikation["stufe"] } : q)))
                  }
                  className="w-44"
                >
                  {(["lernend", "selbststaendig", "anleitend"] as const).map((s) => (
                    <option key={s} value={s}>{t(`stufe.${s}`)}</option>
                  ))}
                </NativeSelect>
              )}
              <Switch checked={Boolean(aktiv)} onCheckedChange={() => toggle(b.id)} />
            </li>
          );
        })}
      </ul>
      {objekte.length > 0 && (
        <p className="mt-3 text-xs text-muted-foreground">{t("akte.qualiObjektHint")}</p>
      )}
      <Button onClick={speichern} disabled={busy || bereiche.length === 0} className="mt-4 rounded-full">
        {t("speichern")}
      </Button>
    </section>
  );
}

// --- Dokumente -------------------------------------------------------------

function Dokumente({ userId, dokumente }: { userId: string; dokumente: Dokument[] }) {
  const t = useTranslations("personal");
  const locale = useLocale();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [neu, setNeu] = useState({ art: "vertrag", titel: "", ablauf_am: "", dokument_nummer: "", behoerde: "", ausgestellt_am: "" });
  const [datei, setDatei] = useState<File | null>(null);

  async function anfragen() {
    if (!neu.titel.trim()) return;
    setBusy(true);
    const res = await dokumentAnfragen(userId, {
      art: neu.art,
      titel: neu.titel.trim(),
      ablauf_am: neu.ablauf_am || null,
      dokument_nummer: neu.dokument_nummer.trim() || null,
      behoerde: neu.behoerde.trim() || null,
      ausgestellt_am: neu.ausgestellt_am || null,
    });
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(t("akte.dokAngefragt"));
    setNeu({ art: "vertrag", titel: "", ablauf_am: "", dokument_nummer: "", behoerde: "", ausgestellt_am: "" });
    router.refresh();
  }

  async function hochladen(dokumentId?: string) {
    if (!datei) return;
    setBusy(true);
    const ziel = await dokumentUploadZiel(userId, {
      art: neu.art,
      titel: neu.titel.trim() || datei.name,
      ablauf_am: neu.ablauf_am || undefined,
      dokument_id: dokumentId,
    });
    if (!ziel.ok) {
      setBusy(false);
      return void toast.error(ziel.error);
    }
    const form = new FormData();
    form.append("file", datei);
    try {
      const res = await fetch(ziel.data.url, {
        method: "POST",
        headers: { Authorization: `Bearer ${ziel.data.token}` },
        body: form,
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const detail = typeof body?.detail === "string" ? body.detail : body?.detail?.message;
        throw new Error(detail || `Fehler ${res.status}`);
      }
      // Compliance-Felder gehören zum Eintrag, nicht zur Datei — nachziehen.
      const angelegt = (await res.json().catch(() => null)) as Dokument | null;
      if (!dokumentId && angelegt?.id && (neu.dokument_nummer || neu.behoerde || neu.ausgestellt_am)) {
        await dokumentAendern(angelegt.id, {
          dokument_nummer: neu.dokument_nummer.trim() || null,
          behoerde: neu.behoerde.trim() || null,
          ausgestellt_am: neu.ausgestellt_am || null,
        });
      }
      toast.success(t("akte.dokHochgeladen"));
      setDatei(null);
      router.refresh();
    } catch (exc) {
      toast.error(exc instanceof Error ? exc.message : t("fehler"));
    } finally {
      setBusy(false);
    }
  }

  async function pruefen(d: Dokument) {
    const res = await dokumentAendern(d.id, { geprueft: !d.geprueft_am });
    if (!res.ok) return void toast.error(res.error);
    router.refresh();
  }

  async function loeschen(d: Dokument) {
    if (!window.confirm(t("akte.dokLoeschenFrage", { titel: d.titel }))) return;
    const res = await dokumentLoeschen(d.id);
    if (!res.ok) return void toast.error(res.error);
    router.refresh();
  }

  const zustandFarbe: Record<Dokument["zustand"], string> = {
    offen: "bg-secondary text-muted-foreground",
    abgelaufen: "bg-destructive/10 text-destructive",
    laeuft_ab: "bg-amber-100 text-amber-800",
    gueltig: "bg-emerald-100 text-emerald-800",
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <section className="rounded-2xl border bg-card p-4">
        <h2 className="mb-3 font-display text-lg font-extrabold">{t("akte.tabs.dokumente")}</h2>
        {dokumente.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("akte.keineDokumente")}</p>
        ) : (
          <ul className="divide-y">
            {dokumente.map((d) => (
              <li key={d.id} className="flex flex-wrap items-center gap-3 py-2 text-sm">
                <span className={`rounded-full px-2 py-0.5 text-xs ${zustandFarbe[d.zustand]}`}>
                  {t(`dokZustand.${d.zustand}`)}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{d.titel}</div>
                  <div className="text-xs text-muted-foreground">
                    {t(`dokArt.${d.art}`)}
                    {d.dokument_nummer ? ` · ${d.dokument_nummer}` : ""}
                    {d.behoerde ? ` · ${d.behoerde}` : ""}
                    {d.ablauf_am ? ` · ${t("akte.ablauf", { datum: formatDate(d.ablauf_am, locale) })}` : ""}
                    {d.eingereicht_am ? ` · ${t("akte.eingereicht", { datum: formatDateTime(d.eingereicht_am, locale) })}` : ""}
                    {d.geprueft_am ? ` · ${t("akte.geprueft")}` : ""}
                  </div>
                </div>
                {d.download_url && (
                  <a href={d.download_url} target="_blank" rel="noreferrer" className="underline">
                    {t("akte.oeffnen")}
                  </a>
                )}
                {!d.eingereicht && (
                  <Button variant="outline" size="sm" className="rounded-full" disabled={!datei || busy} onClick={() => hochladen(d.id)}>
                    {t("akte.dateiZuordnen")}
                  </Button>
                )}
                {d.eingereicht && (
                  <Button variant="ghost" size="sm" onClick={() => pruefen(d)}>
                    {d.geprueft_am ? t("akte.pruefungZurueck") : t("akte.alsGeprueft")}
                  </Button>
                )}
                <Button variant="ghost" size="icon" onClick={() => loeschen(d)} aria-label={t("loeschen")}>
                  <Icon icon="ph:trash" className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="rounded-2xl border bg-card p-4">
        <h2 className="mb-3 font-display text-lg font-extrabold">{t("akte.dokNeu")}</h2>
        <div className="flex flex-col gap-3">
          <Feld label={t("akte.felder.dokArt")}>
            <NativeSelect value={neu.art} onChange={(e) => setNeu((x) => ({ ...x, art: e.target.value }))}>
              {DOKUMENT_ARTEN.map((a) => (
                <option key={a} value={a}>{t(`dokArt.${a}`)}</option>
              ))}
            </NativeSelect>
          </Feld>
          <Feld label={t("akte.felder.dokTitel")}>
            <Input value={neu.titel} onChange={(e) => setNeu((x) => ({ ...x, titel: e.target.value }))} />
          </Feld>
          <div className="grid grid-cols-2 gap-2">
            <Feld label={t("kartei.ausgestelltAm")}>
              <DatePicker value={neu.ausgestellt_am} onChange={(v) => setNeu((x) => ({ ...x, ausgestellt_am: v }))} />
            </Feld>
            <Feld label={t("akte.felder.ablauf_am")}>
              <DatePicker value={neu.ablauf_am} onChange={(v) => setNeu((x) => ({ ...x, ablauf_am: v }))} />
            </Feld>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Feld label={t("kartei.dokumentNummer")}>
              <Input value={neu.dokument_nummer} onChange={(e) => setNeu((x) => ({ ...x, dokument_nummer: e.target.value }))} />
            </Feld>
            <Feld label={t("kartei.behoerde")}>
              <Input value={neu.behoerde} onChange={(e) => setNeu((x) => ({ ...x, behoerde: e.target.value }))} />
            </Feld>
          </div>
          <Feld label={t("akte.felder.datei")} hint={t("akte.dateiHint")}>
            <Input type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(e) => setDatei(e.target.files?.[0] ?? null)} />
          </Feld>
          <div className="flex flex-wrap gap-2">
            <Button onClick={() => hochladen()} disabled={!datei || busy} className="rounded-full">
              {t("akte.hochladen")}
            </Button>
            <Button variant="outline" onClick={anfragen} disabled={!neu.titel.trim() || busy} className="rounded-full">
              {t("akte.anfragen")}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">{t("akte.anfragenHint")}</p>
        </div>
      </section>
    </div>
  );
}

// --- Urlaub, Konten & Anträge -----------------------------------------------------

function UrlaubUndKonten({
  person,
  konto,
  fehler,
  azk,
  jahr,
  extern,
  abwesenheiten,
  kannEntscheiden,
  eigeneId,
}: {
  person: PlanPerson;
  konto: Urlaubskonto | null;
  fehler: string | null;
  azk: Arbeitszeitkonto | null;
  jahr: number;
  extern: boolean;
  abwesenheiten: Abwesenheit[];
  kannEntscheiden: boolean;
  eigeneId: string | null;
}) {
  const t = useTranslations("personal");
  const locale = useLocale();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [neu, setNeu] = useState(false);
  const [f, setF] = useState({
    anspruch: konto?.anspruch.toString() ?? "",
    uebertrag: konto?.uebertrag.toString() ?? "0",
    verfall_am: konto?.verfall_am ?? "",
    korrektur: konto?.korrektur.toString() ?? "0",
    korrektur_grund: konto?.korrektur_grund ?? "",
  });
  const [azkNeu, setAzkNeu] = useState({ minuten: "", grund: "abbau" as "abbau" | "auszahlung" | "korrektur", notiz: "" });
  const userId = person.user_id;

  async function kontoSpeichern(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await setUrlaubskonto(userId, jahr, {
      anspruch: zahlOderNull(f.anspruch) ?? 0,
      uebertrag: zahlOderNull(f.uebertrag) ?? 0,
      verfall_am: f.verfall_am || null,
      korrektur: zahlOderNull(f.korrektur) ?? 0,
      korrektur_grund: textOderNull(f.korrektur_grund),
    });
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(t("akte.gespeichert"));
    router.refresh();
  }

  async function azkSpeichern(e: React.FormEvent) {
    e.preventDefault();
    const minuten = Math.round((zahlOderNull(azkNeu.minuten) ?? 0) * 60);
    if (!minuten) return;
    setBusy(true);
    const res = await azkBuchen({
      user_id: userId,
      datum: new Date().toISOString().slice(0, 10),
      minuten,
      grund: azkNeu.grund,
      notiz: textOderNull(azkNeu.notiz),
    });
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    setAzkNeu({ minuten: "", grund: "abbau", notiz: "" });
    router.refresh();
  }

  async function entscheiden(a: Abwesenheit, genehmigen: boolean) {
    const res = await abwesenheitEntscheiden(a.id, genehmigen);
    if (!res.ok) return void toast.error(res.error);
    router.refresh();
  }
  async function stornieren(a: Abwesenheit) {
    if (!window.confirm(t("abwesenheit.stornierenFrage"))) return;
    const res = await abwesenheitStornieren(a.id);
    if (!res.ok) return void toast.error(res.error);
    router.refresh();
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {!extern && (
        <section className="rounded-2xl border bg-card p-4">
          <h2 className="mb-3 font-display text-lg font-extrabold">{t("akte.urlaubskonto", { jahr })}</h2>
          {fehler && <p className="mb-3 text-sm text-destructive">{fehler}</p>}
          {konto && (
            <dl className="mb-4 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
              <div><dt className="text-muted-foreground">{t("urlaub.anspruch")}</dt><dd className="font-medium">{konto.anspruch}{konto.anteilig ? ` (${t("urlaub.anteilig")})` : ""}</dd></div>
              <div><dt className="text-muted-foreground">{t("urlaub.genommen")}</dt><dd className="font-medium">{konto.genommen}</dd></div>
              <div><dt className="text-muted-foreground">{t("urlaub.geplant")}</dt><dd className="font-medium">{konto.geplant}</dd></div>
              <div><dt className="text-muted-foreground">{t("urlaub.rest")}</dt><dd className="font-display text-lg font-extrabold">{konto.rest}</dd></div>
            </dl>
          )}
          <form onSubmit={kontoSpeichern} className="grid gap-3 sm:grid-cols-2">
            <Feld label={t("urlaub.anspruch")} hint={t("urlaub.anspruchHint")}>
              <Input inputMode="decimal" value={f.anspruch} onChange={(e) => setF((x) => ({ ...x, anspruch: e.target.value }))} />
            </Feld>
            <Feld label={t("urlaub.uebertrag")}>
              <Input inputMode="decimal" value={f.uebertrag} onChange={(e) => setF((x) => ({ ...x, uebertrag: e.target.value }))} />
            </Feld>
            <Feld label={t("urlaub.verfall")}>
              <DatePicker value={f.verfall_am} onChange={(v) => setF((x) => ({ ...x, verfall_am: v }))} />
            </Feld>
            <Feld label={t("urlaub.korrektur")}>
              <Input inputMode="decimal" value={f.korrektur} onChange={(e) => setF((x) => ({ ...x, korrektur: e.target.value }))} />
            </Feld>
            <Feld label={t("urlaub.korrekturGrund")}>
              <Input value={f.korrektur_grund} onChange={(e) => setF((x) => ({ ...x, korrektur_grund: e.target.value }))} />
            </Feld>
            <div className="sm:col-span-2">
              <Button type="submit" disabled={busy} className="rounded-full">{t("speichern")}</Button>
            </div>
          </form>
        </section>
      )}
      {!extern && (
        <section className="rounded-2xl border bg-card p-4">
          <h2 className="mb-1 font-display text-lg font-extrabold">{t("akte.arbeitszeitkonto")}</h2>
          <p className="mb-3 font-display text-2xl font-extrabold">{stunden(azk?.saldo_minuten ?? 0)} h</p>
          <form onSubmit={azkSpeichern} className="mb-4 grid gap-3 sm:grid-cols-3">
            <Feld label={t("azk.stunden")}>
              <Input inputMode="decimal" value={azkNeu.minuten} onChange={(e) => setAzkNeu((x) => ({ ...x, minuten: e.target.value }))} />
            </Feld>
            <Feld label={t("azk.grund")}>
              <NativeSelect value={azkNeu.grund} onChange={(e) => setAzkNeu((x) => ({ ...x, grund: e.target.value as typeof azkNeu.grund }))}>
                {(["abbau", "auszahlung", "korrektur"] as const).map((g) => (
                  <option key={g} value={g}>{t(`azk.gruende.${g}`)}</option>
                ))}
              </NativeSelect>
            </Feld>
            <Feld label={t("azk.notiz")}>
              <Input value={azkNeu.notiz} onChange={(e) => setAzkNeu((x) => ({ ...x, notiz: e.target.value }))} />
            </Feld>
            <div className="sm:col-span-3">
              <Button type="submit" variant="outline" disabled={busy} className="rounded-full">{t("azk.buchen")}</Button>
            </div>
          </form>
          <ul className="divide-y text-sm">
            {(azk?.buchungen ?? []).slice().reverse().slice(0, 30).map((b) => (
              <li key={b.id} className="flex items-center gap-3 py-1.5">
                <span className="w-24 text-muted-foreground">{formatDate(b.datum, locale)}</span>
                <span className="flex-1">{t(`azk.gruende.${b.grund}`)}{b.notiz ? ` · ${b.notiz}` : ""}</span>
                <span className={`font-medium ${b.minuten < 0 ? "text-destructive" : "text-emerald-700"}`}>{stunden(b.minuten)} h</span>
              </li>
            ))}
          </ul>
        </section>
      )}
      {extern && <p className="rounded-2xl border bg-card p-4 text-sm text-muted-foreground lg:col-span-2">{t("akte.externKonten")}</p>}

      <section className="rounded-2xl border bg-card p-4 lg:col-span-2">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-lg font-extrabold">{t("akte.antraege", { jahr })}</h2>
          {kannEntscheiden && (
            <Button size="sm" className="rounded-full" onClick={() => setNeu(true)}>
              <Icon icon="ph:plus" className="mr-1 size-4" />
              {t("abwesenheit.neu")}
            </Button>
          )}
        </div>
        {abwesenheiten.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("akte.keineAntraege")}</p>
        ) : (
          <ul className="divide-y text-sm">
            {abwesenheiten.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-3 py-2">
                <StatusBadge status={a.status} />
                <span className="font-medium">{t(`abwesenheitArt.${a.art}`)}</span>
                <span className="flex-1">
                  {formatDate(a.von, locale)} – {formatDate(a.bis, locale)} · {t("abwesenheit.tage", { tage: a.tage_berechnet })}
                  {a.grund ? <span className="block text-xs text-muted-foreground">{a.grund}</span> : null}
                </span>
                {a.schichten_im_zeitraum > 0 && a.status === "beantragt" && (
                  <span className="text-xs text-amber-700">{t("abwesenheit.schichtenBetroffen", { anzahl: a.schichten_im_zeitraum })}</span>
                )}
                {kannEntscheiden && a.status === "beantragt" && (
                  <>
                    <Button size="sm" className="rounded-full" onClick={() => entscheiden(a, true)}>{t("genehmigen")}</Button>
                    <Button size="sm" variant="outline" className="rounded-full" onClick={() => entscheiden(a, false)}>{t("ablehnen")}</Button>
                  </>
                )}
                {(a.status === "genehmigt" || a.status === "beantragt") && (kannEntscheiden || a.user_id === eigeneId) && (
                  <Button size="sm" variant="ghost" onClick={() => stornieren(a)}>{t("stornieren")}</Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
      {neu && (
        <AntragDialog
          personen={[person]}
          eigeneId={eigeneId}
          vorbelegt={userId}
          onClose={() => setNeu(false)}
          onSaved={() => {
            setNeu(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

// --- Verfügbarkeit -----------------------------------------------------------

export function Verfuegbarkeiten({
  userId,
  eintraege,
  eigene = false,
}: {
  userId: string;
  eintraege: Verfuegbarkeit[];
  /** Mitarbeitersicht (ohne user_id im Antrag). */
  eigene?: boolean;
}) {
  const t = useTranslations("personal");
  const locale = useLocale();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState({
    art: "gesperrt" as "wunsch" | "gesperrt",
    form: "woechentlich" as "woechentlich" | "zeitraum",
    wochentag: 6,
    datum_von: "",
    datum_bis: "",
    ganztags: true,
    zeit_von: "08:00",
    zeit_bis: "16:00",
    notiz: "",
  });

  async function anlegen(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res = await createVerfuegbarkeit({
      user_id: eigene ? null : userId,
      art: f.art,
      wiederkehrend_wochentag: f.form === "woechentlich" ? f.wochentag : null,
      datum_von: f.form === "zeitraum" ? f.datum_von || null : null,
      datum_bis: f.form === "zeitraum" ? f.datum_bis || f.datum_von || null : null,
      ganztags: f.ganztags,
      zeit_von: f.ganztags ? null : f.zeit_von,
      zeit_bis: f.ganztags ? null : f.zeit_bis,
      notiz: textOderNull(f.notiz),
    });
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    router.refresh();
  }

  async function entfernen(id: string) {
    const res = await deleteVerfuegbarkeit(id);
    if (!res.ok) return void toast.error(res.error);
    router.refresh();
  }

  const wochentagName = (n: number) =>
    new Intl.DateTimeFormat(locale, { weekday: "long" }).format(new Date(Date.UTC(2024, 0, 1 + n)));

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_22rem]">
      <section className="rounded-2xl border bg-card p-4">
        <h2 className="mb-1 font-display text-lg font-extrabold">{t("akte.tabs.verfuegbar")}</h2>
        <p className="mb-3 text-sm text-muted-foreground">{t("verfuegbar.hint")}</p>
        {eintraege.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t("verfuegbar.keine")}</p>
        ) : (
          <ul className="divide-y text-sm">
            {eintraege.map((v) => (
              <li key={v.id} className="flex items-center gap-3 py-2">
                <span className={`rounded-full px-2 py-0.5 text-xs ${v.art === "gesperrt" ? "bg-destructive/10 text-destructive" : "bg-emerald-100 text-emerald-800"}`}>
                  {t(`verfuegbar.art.${v.art}`)}
                </span>
                <span className="flex-1">
                  {v.wiederkehrend_wochentag !== null
                    ? t("verfuegbar.jeden", { tag: wochentagName(v.wiederkehrend_wochentag) })
                    : `${formatDate(v.datum_von, locale)} – ${formatDate(v.datum_bis, locale)}`}
                  {v.ganztags ? ` · ${t("verfuegbar.ganztags")}` : ` · ${v.zeit_von?.slice(0, 5)}–${v.zeit_bis?.slice(0, 5)}`}
                  {v.notiz ? ` · ${v.notiz}` : ""}
                </span>
                <Button variant="ghost" size="icon" onClick={() => entfernen(v.id)} aria-label={t("loeschen")}>
                  <Icon icon="ph:trash" className="size-4" />
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <form onSubmit={anlegen} className="flex flex-col gap-3 rounded-2xl border bg-card p-4">
        <h2 className="font-display text-lg font-extrabold">{t("verfuegbar.neu")}</h2>
        <Feld label={t("verfuegbar.artLabel")}>
          <NativeSelect value={f.art} onChange={(e) => setF((x) => ({ ...x, art: e.target.value as typeof f.art }))}>
            <option value="gesperrt">{t("verfuegbar.art.gesperrt")}</option>
            <option value="wunsch">{t("verfuegbar.art.wunsch")}</option>
          </NativeSelect>
        </Feld>
        <Feld label={t("verfuegbar.form")}>
          <NativeSelect value={f.form} onChange={(e) => setF((x) => ({ ...x, form: e.target.value as typeof f.form }))}>
            <option value="woechentlich">{t("verfuegbar.woechentlich")}</option>
            <option value="zeitraum">{t("verfuegbar.zeitraum")}</option>
          </NativeSelect>
        </Feld>
        {f.form === "woechentlich" ? (
          <Feld label={t("verfuegbar.wochentag")}>
            <NativeSelect value={String(f.wochentag)} onChange={(e) => setF((x) => ({ ...x, wochentag: Number(e.target.value) }))}>
              {WOCHENTAGE.map((n) => (
                <option key={n} value={n}>{wochentagName(n)}</option>
              ))}
            </NativeSelect>
          </Feld>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            <Feld label={t("von")}><DatePicker value={f.datum_von} onChange={(v) => setF((x) => ({ ...x, datum_von: v }))} /></Feld>
            <Feld label={t("bis")}><DatePicker value={f.datum_bis} onChange={(v) => setF((x) => ({ ...x, datum_bis: v }))} /></Feld>
          </div>
        )}
        <div className="flex items-center justify-between text-sm">
          <Label>{t("verfuegbar.ganztags")}</Label>
          <Switch checked={f.ganztags} onCheckedChange={(v) => setF((x) => ({ ...x, ganztags: v }))} />
        </div>
        {!f.ganztags && (
          <div className="grid grid-cols-2 gap-2">
            <Feld label={t("von")}><Input type="time" value={f.zeit_von} onChange={(e) => setF((x) => ({ ...x, zeit_von: e.target.value }))} /></Feld>
            <Feld label={t("bis")}><Input type="time" value={f.zeit_bis} onChange={(e) => setF((x) => ({ ...x, zeit_bis: e.target.value }))} /></Feld>
          </div>
        )}
        <Feld label={t("notiz")}><Input value={f.notiz} onChange={(e) => setF((x) => ({ ...x, notiz: e.target.value }))} /></Feld>
        <Button type="submit" disabled={busy || (f.form === "zeitraum" && !f.datum_von)} className="rounded-full">
          {t("anlegen")}
        </Button>
      </form>
    </div>
  );
}

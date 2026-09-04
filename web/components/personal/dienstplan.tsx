"use client";

// Dienstplan (Vertrag §5): der EINE Ort, an dem der Zustand der Planungs-
// oberfläche lebt. Die Darstellung selbst liegt in den Nachbardateien —
// `dienstplan-grid` (Wochenraster), `-tag`, `-monat`, `-liste`, `-kopf`,
// `-bereich`, `-filter`, `-mehrfach`, `-legende`, `tausch-*`.
//
// DREI ANSICHTEN, ZWEI DARSTELLUNGEN: Tag / Woche / Monat × Grid / Liste. Der
// Zeitraum ist deshalb keine Woche mehr, sondern ein FENSTER (`von`–`bis`);
// die Woche ist nur der Sonderfall „Montag + 7 Tage". Geladen wird über
// `getPlanZeitraum`; für die Woche bleibt `getPlanWoche` in Gebrauch, weil die
// Antwortform identisch ist (§1.3) und der Endpunkt die KW-Zusatzfelder
// (Lesebestätigungen, Veröffentlichung) unverändert liefert.
//
// FILTER IN DER URL: `ansicht`, `dar`, `anker` und die vier Filterfelder
// stehen als Query-Parameter — ein gefilterter Plan ist damit verlinkbar, ein
// Reload behält die Sicht. Der Zustand wird an EINER Stelle geschrieben
// (`urlSetzen`) und an EINER Stelle gelesen (`useMemo` über `params`).
//
// Drag & Drop: dieselbe Lösung wie im Aufgabenkalender — der `dragstart`-
// Handler setzt KEINEN State synchron (Chrome bricht den Drag sonst ab),
// sondern eine Ref und einen `setTimeout(0)`.
//
// Live über useRealtime auf personal_schichten, personal_abwesenheiten,
// personal_veroeffentlichungen, personal_schicht_tausch und personal_bedarf
// (alle fünf haben `grant select` + Publikation — echte Abos, keine
// Attrappen); jede eigene Aktion lädt zusätzlich still nach.
import { useRouter, useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import {
  bedarfAusAufgaben,
  bewerbungEntscheiden,
  createSchicht,
  deleteSchicht,
  schichtBewerbungen,
  updateSchicht,
  wocheKopieren,
  wocheVeroeffentlichen,
} from "@/lib/personal";
import {
  type Arbeitsbereich,
  type Konflikt,
  type PlanPerson,
  type Regeln,
  type Schicht,
  type SchichtCreate,
  type Schichtvorlage,
  heuteIso,
  montagVon,
  stunden,
  tagePlus,
} from "@/lib/personal-typen";
import { uhrzeitInZone, umTageVerschieben, utcFuerOrtszeit } from "@/lib/personal-zeit";
import { tagKurz } from "@/lib/personal-zeit";
import { useRealtime } from "@/lib/use-realtime";

import {
  dienstplanCsv,
  getBedarf,
  getKennzahlen,
  getPlanWoche,
  getPlanZeitraum,
  listTausch,
  schichtenMehrfach,
  setBedarfTage,
  setBedarfVorlagen,
  tauschAblehnen,
  tauschAnfragen,
  tauschAnnehmen,
  tauschEntscheiden,
  tauschZurueckziehen,
  wocheLeeren,
} from "@/lib/personal-planung";
import {
  type Ansicht,
  type BedarfDaten,
  type BedarfZeile,
  type Darstellung,
  type Filterzustand,
  type KennzahlBereichTag,
  type KennzahlTag,
  type KennzahlZeile,
  type Kennzahlen,
  type MehrfachAktion,
  type PlanDaten,
  type PlanPersonPlus,
  type SchichtPlus,
  type Tausch,
  type Verfuegbarkeitstag,
  ANSICHTEN,
  DARSTELLUNGEN,
  KENNZAHL_ZEILEN,
  monatsErster,
  monatsRasterStart,
  tageDiff,
} from "@/lib/personal-planung-typen";

import { BedarfEditor } from "./bedarf-editor";
import { useDienstplanKi } from "./dienstplan-ki";
import { useDienstplanVorlagen } from "./dienstplan-vorlagen";
import { DienstplanDebug, type DebugEintrag } from "./dienstplan-debug";
import { downloadDienstplanPdf } from "./dienstplan-druck";
import { DienstplanFilter } from "./dienstplan-filter";
import { OFFEN, DienstplanGrid, type Rasterblock, type Rasterzeile } from "./dienstplan-grid";
import { DienstplanKopf } from "./dienstplan-kopf";
import { DienstplanLeiste } from "./dienstplan-leiste";
import { DienstplanLegende } from "./dienstplan-legende";
import { DienstplanListe } from "./dienstplan-liste";
import { MehrfachLeiste } from "./dienstplan-mehrfach";
import { DienstplanMonat } from "./dienstplan-monat";
import { DienstplanTag } from "./dienstplan-tag";
import { KiPanel } from "./ki-panel";
import { konfliktText } from "./konflikte";
import { SchichtDialog, type SchichtDialogWerte } from "./schicht-dialog";
import { TauschDialog } from "./tausch-dialog";
import { TauschListe } from "./tausch-liste";
import { WochenvorlagenDialog } from "./wochenvorlagen-dialog";

/** ISO-Kalenderwoche eines Montags (yyyy-MM-dd). */
function isoWoche(montag: string): number {
  const d = new Date(`${montag}T00:00:00Z`);
  const donnerstag = new Date(d);
  donnerstag.setUTCDate(d.getUTCDate() + 3);
  const jahrStart = new Date(Date.UTC(donnerstag.getUTCFullYear(), 0, 1));
  return Math.ceil(
    ((donnerstag.getTime() - jahrStart.getTime()) / 86400000 + jahrStart.getUTCDay() + 1) / 7,
  );
}

type Drag = { schichtId: string; vonUser: string | null; vonTag: string };

/**
 * Betriebsregeln mit den Feldern, die der Vertrag §1.1 hinzufügt.
 * `personal-typen.ts` gehört niemandem (Vertrag §0) und wird nicht angefasst;
 * bis B1 die Basisdatei nachzieht, gilt die Schnittmenge hier.
 */
type RegelnPlus = Regeln & {
  kennzahlen_zeilen?: string[] | null;
  wetter_anzeigen?: boolean | null;
};

/** Das sichtbare Zeitfenster einer Ansicht (von/bis inklusive). */
function fenster(ansicht: Ansicht, anker: string): { von: string; bis: string } {
  if (ansicht === "tag") return { von: anker, bis: anker };
  if (ansicht === "woche") {
    const m = montagVon(anker);
    return { von: m, bis: tagePlus(m, 6) };
  }
  // Monat: das 6×7-Raster ab dem Montag vor dem Ersten — genau 42 Tage, also
  // die Obergrenze des Endpunkts (§1.3, sonst 422 `zeitraum_zu_lang`).
  const start = monatsRasterStart(anker);
  return { von: start, bis: tagePlus(start, 41) };
}

export function Dienstplan({
  initial,
  regeln,
  arbeitsbereiche,
  vorlagen,
  objekte,
  kennzahlenInitial,
  tauschInitial,
  kannPlanen,
  eigeneId = null,
  betrieb = null,
}: {
  initial: PlanDaten;
  /** Betriebsregeln — Quelle für `kennzahlen_zeilen` und `wetter_anzeigen`. */
  regeln: RegelnPlus | null;
  arbeitsbereiche: Arbeitsbereich[];
  vorlagen: Schichtvorlage[];
  objekte: { id: string; title: string }[];
  /** Kennzahlen des ersten Fensters (serverseitig geladen, danach im Client). */
  kennzahlenInitial: Kennzahlen | null;
  tauschInitial: Tausch[];
  kannPlanen: boolean;
  /** Eigene user_id — entscheidet, wer bei einem Tausch annehmen/zurückziehen darf. */
  eigeneId?: string | null;
  /** Betriebsname für den Kopf des Druck-Aushangs (`tenant_name`). */
  betrieb?: string | null;
}) {
  const t = useTranslations("personal");
  const locale = useLocale();
  const router = useRouter();
  const params = useSearchParams();
  const [plan, setPlan] = useState<PlanDaten>(initial);
  const [kennzahlen, setKennzahlen] = useState<Kennzahlen | null>(kennzahlenInitial);
  const [tausche, setTausche] = useState<Tausch[]>(tauschInitial);
  const [laden, setLaden] = useState(false);
  const [dialog, setDialog] = useState<SchichtDialogWerte | null>(null);
  const [tauschFuer, setTauschFuer] = useState<SchichtPlus | null>(null);
  const [bewerber, setBewerber] = useState<{ schicht: Schicht; personen: PlanPerson[] } | null>(
    null,
  );
  const [debug, setDebug] = useState<DebugEintrag[]>([]);
  // --- Ansicht, Darstellung, Filter (alles aus der URL) ----------------------
  // Angreiferkontrollierte Werte: ein `?ansicht=foo` darf nicht als Ansicht
  // durchlaufen (Wurzel 3) — geprueft gegen die Listen, sonst der Normalfall.
  const ansicht: Ansicht = ANSICHTEN.includes(params.get("ansicht") as Ansicht)
    ? (params.get("ansicht") as Ansicht)
    : "woche";
  const darstellung: Darstellung = DARSTELLUNGEN.includes(params.get("dar") as Darstellung)
    ? (params.get("dar") as Darstellung)
    : "grid";
  const anker = useMemo(() => {
    const a = params.get("anker") ?? params.get("woche");
    return a && /^\d{4}-\d{2}-\d{2}$/.test(a) ? a : heuteIso();
  }, [params]);
  const filter = useMemo<Filterzustand>(
    () => ({
      arbeitsbereich_id: params.get("bereich") ?? "",
      property_id: params.get("objekt") ?? "",
      user_id: params.get("person") ?? "",
      suche: params.get("q") ?? "",
    }),
    [params],
  );
  // --- Auswahl, Gruppierung -------------------------------------------------
  const [auswahlModus, setAuswahlModus] = useState(false);
  const [ausgewaehlt, setAusgewaehlt] = useState<Set<string>>(new Set());
  const letzteAuswahl = useRef<string | null>(null);
  const [eingeklappt, setEingeklappt] = useState<Set<string>>(new Set());
  // Gruppierung nach Arbeitsbereich ist gesetzt (Vertrag §5: einklappbare
  // Bloecke mit KPI-Zeilen) — nur ohne Bereiche fehlt die Ebene und das
  // Raster laeuft flach.
  const gruppiert = arbeitsbereiche.some((b) => !b.archived_at);
  // --- Paket F1: Wochenvorlagen, Bedarf, KI, Druck ---------------------------
  const [bedarfOffen, setBedarfOffen] = useState(false);
  const [bedarfDaten, setBedarfDaten] = useState<BedarfDaten | null>(null);
  const [bedarfLaden, setBedarfLaden] = useState(false);
  // EIN Laufzeichen für alle F1-Aktionen: sie laufen nie gleichzeitig, und ein
  // eigenes Flag je Aktion wäre nur Zustand, der auseinanderlaufen kann.
  const [f1Laeuft, setF1Laeuft] = useState(false);
  const dragRef = useRef<Drag | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [ziel, setZiel] = useState<string | null>(null);

  const zone = plan.zeitzone;
  const heute = heuteIso();
  const { von, bis } = useMemo(() => fenster(ansicht, anker), [ansicht, anker]);
  /** Die Woche, an der wochenbezogene Aktionen hängen (Veröffentlichen, CSV …). */
  const woche = useMemo(() => montagVon(anker), [anker]);
  const tage = useMemo(
    () => Array.from({ length: tageDiff(von, bis) + 1 }, (_, i) => tagePlus(von, i)),
    [von, bis],
  );
  /** Die sieben Tage des Rasters bzw. Kopfes — der Monat rendert eigenes Raster. */
  const kopfTage = useMemo(
    () => (ansicht === "woche" ? tage : ansicht === "tag" ? [anker] : tage.slice(0, 7)),
    [ansicht, tage, anker],
  );
  const wochenende = useCallback(
    (index: number) => {
      const tag = kopfTage[index];
      if (!tag) return false;
      const wt = (new Date(`${tag}T00:00:00Z`).getUTCDay() + 6) % 7;
      return wt >= 5;
    },
    [kopfTage],
  );
  const currency = kennzahlen?.currency ?? "";
  const kennzahlZeilen = useMemo<readonly KennzahlZeile[]>(() => {
    const roh = regeln?.kennzahlen_zeilen;
    if (!Array.isArray(roh)) return ["besetzung", "stundenlimit"];
    // Nur bekannte Namen und in der Reihenfolge der Regel — ein unbekannter
    // Wert wäre ein MISSING_MESSAGE, kein stiller Fallback (Wurzel 4/5).
    return roh.filter((z): z is KennzahlZeile =>
      (KENNZAHL_ZEILEN as readonly string[]).includes(z),
    );
  }, [regeln?.kennzahlen_zeilen]);
  const wetterAnzeigen = regeln?.wetter_anzeigen !== false;

  const protokoll = useCallback((art: string, text: string, daten?: unknown) => {
    setDebug((d) => [{ zeit: new Date().toISOString(), art, text, daten }, ...d].slice(0, 60));
  }, []);

  /** URL an EINER Stelle schreiben — Ansicht, Darstellung, Anker, Filter. */
  const urlSetzen = useCallback(
    (
      neu: Partial<{
        ansicht: Ansicht;
        dar: Darstellung;
        anker: string;
        filter: Filterzustand;
      }>,
    ) => {
      const s = new URLSearchParams();
      const a = neu.ansicht ?? ansicht;
      const d = neu.dar ?? darstellung;
      const ank = neu.anker ?? anker;
      const f = neu.filter ?? filter;
      if (a !== "woche") s.set("ansicht", a);
      if (d !== "grid") s.set("dar", d);
      s.set("anker", ank);
      if (f.arbeitsbereich_id) s.set("bereich", f.arbeitsbereich_id);
      if (f.property_id) s.set("objekt", f.property_id);
      if (f.user_id) s.set("person", f.user_id);
      if (f.suche) s.set("q", f.suche);
      router.replace(`/hr/schichtplan?${s.toString()}`);
    },
    [ansicht, darstellung, anker, filter, router],
  );

  // --- Laden -----------------------------------------------------------------
  const nachladen = useCallback(
    async (zielVon: string, zielBis: string, still = false) => {
      if (!still) setLaden(true);
      // Für die Kalenderwoche bleibt `/dienstplan?woche=` in Gebrauch (gleiche
      // Antwortform, §1.3); jedes andere Fenster läuft über `/zeitraum`.
      const istWoche = zielVon === montagVon(zielVon) && tageDiff(zielVon, zielBis) === 6;
      const res = istWoche
        ? await getPlanWoche(zielVon)
        : await getPlanZeitraum(zielVon, zielBis);
      if (!still) setLaden(false);
      if (!res.ok) {
        toast.error(res.error);
        protokoll("fehler", `Plan ${zielVon}–${zielBis}: ${res.status ?? ""} ${res.error}`, res.details);
        return;
      }
      setPlan(res.data);
      protokoll(
        "laden",
        `${zielVon}–${zielBis}: ${res.data.schichten.length} Schichten, ${res.data.personen.length} Personen`,
        {
          quelle: istWoche ? "/dienstplan" : "/dienstplan/zeitraum",
          regeln_bestaetigt: res.data.regeln_bestaetigt,
          veroeffentlicht_am: res.data.veroeffentlicht_am,
          verfuegbarkeiten: res.data.verfuegbarkeiten?.length ?? 0,
          wetter: Object.keys(res.data.wetter ?? {}).length,
          tausch: res.data.tausch?.length ?? 0,
        },
      );
    },
    [protokoll],
  );

  const kennzahlenLaden = useCallback(
    async (zielVon: string, zielBis: string) => {
      const res = await getKennzahlen(zielVon, zielBis);
      if (!res.ok) {
        // Kein Ausfall des Plans: die Kennzahlen sind ein Aufsatz. Der Kopf
        // zeigt dann seinen eigenen Hinweis (`kennzahlen.nichtGeladen`).
        setKennzahlen(null);
        protokoll("fehler", `Kennzahlen: ${res.status ?? ""} ${res.error}`, res.details);
        return;
      }
      setKennzahlen(res.data);
      protokoll("kennzahlen", `${zielVon}–${zielBis}: ${res.data.tage.length} Tage`, {
        currency: res.data.currency,
        hinweise: res.data.hinweise,
        bereiche: res.data.bereiche.length,
        summe: res.data.summe,
      });
    },
    [protokoll],
  );

  const tauscheLaden = useCallback(async () => {
    const res = await listTausch(woche);
    if (res.ok) setTausche(res.data);
    else protokoll("fehler", `Tausch: ${res.error}`, res.details);
  }, [woche, protokoll]);

  const still = useCallback(() => {
    void nachladen(von, bis, true);
    void kennzahlenLaden(von, bis);
  }, [nachladen, kennzahlenLaden, von, bis]);

  // Wochenvorlagen als eigener Hook — sie haengen an der Woche, nicht am
  // Fenster (dienstplan-vorlagen.ts). Die 409-Rueckfrage bleibt die des Plans.
  const wv = useDienstplanVorlagen({
    woche,
    setLaeuft: setF1Laeuft,
    protokoll,
    konfliktFrage: (k) => konfliktFrage(k),
    onAngewendet: () => still(),
  });

  // KI (Prognose, Autoplan, Assistent) als eigener Hook — sein Zustand haengt
  // nur an der Woche, nicht am Fenster des Plans (dienstplan-ki.ts).
  const ki = useDienstplanKi({
    woche,
    setLaeuft: setF1Laeuft,
    protokoll,
    onUebernommen: () => {
      void bedarfNachladen();
      still();
    },
  });

  useRealtime({ table: "personal_schichten", onChange: still });
  useRealtime({ table: "personal_abwesenheiten", onChange: still });
  useRealtime({ table: "personal_veroeffentlichungen", onChange: still });
  // Zusätzlich (Vertrag §5): beide Tabellen haben `grant select` + Publikation
  // (0544/0545) — echte Abos, keine Attrappen.
  useRealtime({ table: "personal_schicht_tausch", onChange: () => void tauscheLaden() });
  useRealtime({ table: "personal_bedarf", onChange: () => void kennzahlenLaden(von, bis) });

  // Fensterwechsel (Ansicht, Anker) → Plan und Kennzahlen neu holen.
  //
  // Das ERSTE Fenster kommt serverseitig (page.tsx rechnet es identisch), es
  // darf hier also nicht sofort ein zweites Mal geholt werden. Der Anker ist
  // deshalb das Fenster, mit dem die Seite gerendert wurde — `/zeitraum` und
  // `/dienstplan` setzen beide `woche_start = von` (schichten.py), sodass der
  // Vergleich in allen drei Ansichten trägt.
  const geladenRef = useRef(`${von}|${bis}`);
  useEffect(() => {
    const schluessel = `${von}|${bis}`;
    if (geladenRef.current === schluessel) return;
    geladenRef.current = schluessel;
    void nachladen(von, bis);
    void kennzahlenLaden(von, bis);
    void tauscheLaden();
  }, [von, bis, nachladen, kennzahlenLaden, tauscheLaden]);

  function wechseln(delta: number) {
    const neu =
      ansicht === "tag"
        ? tagePlus(anker, delta)
        : ansicht === "woche"
          ? tagePlus(montagVon(anker), delta * 7)
          : monatsErster(tagePlus(monatsErster(anker), delta > 0 ? 31 : -1));
    urlSetzen({ anker: neu });
  }

  // --- Filter ----------------------------------------------------------------
  /** Trifft eine Schicht den Filter? Der Filter wirkt in ALLEN Ansichten. */
  const trifft = useCallback(
    (s: SchichtPlus): boolean => {
      if (filter.arbeitsbereich_id && s.arbeitsbereich_id !== filter.arbeitsbereich_id)
        return false;
      if (filter.property_id && s.property_id !== filter.property_id) return false;
      if (filter.user_id && s.user_id !== filter.user_id) return false;
      if (filter.suche) {
        const person = plan.personen.find((p) => p.user_id === s.user_id)?.full_name ?? "";
        const heu = [person, s.property_title ?? "", s.notiz ?? ""].join(" ").toLowerCase();
        if (!heu.includes(filter.suche.toLowerCase())) return false;
      }
      return true;
    },
    [filter, plan.personen],
  );

  const schichten = useMemo(() => plan.schichten.filter(trifft), [plan.schichten, trifft]);

  /** Personen des Fensters nach Filter (Person + Bereich schränken sie ein). */
  const personen = useMemo<PlanPersonPlus[]>(() => {
    let liste = plan.personen;
    if (filter.user_id) liste = liste.filter((p) => p.user_id === filter.user_id);
    if (filter.arbeitsbereich_id)
      liste = liste.filter((p) => p.arbeitsbereiche.includes(filter.arbeitsbereich_id));
    if (filter.suche)
      liste = liste.filter((p) =>
        (p.full_name ?? "").toLowerCase().includes(filter.suche.toLowerCase()),
      );
    return liste;
  }, [plan.personen, filter]);

  // --- Gruppierung und Karten ------------------------------------------------
  const zellen = useMemo(() => {
    const m = new Map<string, SchichtPlus[]>();
    for (const s of schichten) {
      if (s.status === "abgesagt" && s.quelle !== "abwesenheit") continue;
      const key = `${s.user_id ?? OFFEN}|${s.datum}`;
      m.set(key, [...(m.get(key) ?? []), s]);
    }
    return m;
  }, [schichten]);

  const abwesend = useMemo(() => {
    const m = new Map<string, { art: string; status: string }>();
    for (const a of plan.abwesenheiten) {
      if (a.status === "abgelehnt" || a.status === "storniert") continue;
      let tag = a.von;
      while (tag <= a.bis) {
        m.set(`${a.user_id}|${tag}`, { art: a.art, status: a.status });
        tag = tagePlus(tag, 1);
      }
    }
    return m;
  }, [plan.abwesenheiten]);

  const verfuegbarJeZelle = useMemo(() => {
    const m = new Map<string, Verfuegbarkeitstag[]>();
    for (const v of plan.verfuegbarkeiten ?? []) {
      const key = `${v.user_id}|${v.datum}`;
      m.set(key, [...(m.get(key) ?? []), v]);
    }
    return m;
  }, [plan.verfuegbarkeiten]);

  const kennzahlTage = useMemo(
    () => new Map<string, KennzahlTag>((kennzahlen?.tage ?? []).map((k) => [k.datum, k])),
    [kennzahlen],
  );
  const kennzahlBereiche = useMemo(() => {
    const m = new Map<string, Map<string, KennzahlBereichTag>>();
    for (const b of kennzahlen?.bereiche ?? []) {
      m.set(b.arbeitsbereich_id, new Map(b.tage.map((x) => [x.datum, x])));
    }
    return m;
  }, [kennzahlen]);

  const offeneSchichten = useMemo(
    () => schichten.filter((s) => !s.user_id && s.status !== "abgesagt"),
    [schichten],
  );

  /** Blöcke je Arbeitsbereich; eine Person steht in jedem ihrer Bereiche. */
  const blocks = useMemo<Rasterblock[]>(() => {
    if (!gruppiert) return [{ bereich: null, zeilen: personen.map((p) => ({ key: p.user_id, user: p })) }];
    const aktiv = arbeitsbereiche
      .filter((b) => !b.archived_at)
      .filter((b) => !filter.arbeitsbereich_id || b.id === filter.arbeitsbereich_id)
      .sort((a, b) => a.sort - b.sort);
    const aus: Rasterblock[] = aktiv.map((b) => ({
      bereich: b,
      zeilen: personen
        .filter((p) => p.arbeitsbereiche.includes(b.id))
        .map((p) => ({ key: `${b.id}|${p.user_id}`, user: p })),
    }));
    const ohne = personen.filter(
      (p) => !p.arbeitsbereiche.some((id) => aktiv.some((b) => b.id === id)),
    );
    if (ohne.length > 0 && !filter.arbeitsbereich_id) {
      aus.push({ bereich: null, zeilen: ohne.map((p) => ({ key: `__ohne__|${p.user_id}`, user: p })) });
    }
    return aus.filter((b) => b.zeilen.length > 0);
  }, [gruppiert, personen, arbeitsbereiche, filter.arbeitsbereich_id]);

  const offeneZeile = useMemo<Rasterzeile | null>(
    () =>
      (kannPlanen || offeneSchichten.length > 0) && !filter.user_id
        ? { key: OFFEN, user: null }
        : null,
    [kannPlanen, offeneSchichten.length, filter.user_id],
  );

  // --- Auswahl ---------------------------------------------------------------
  /** Chronologische Reihenfolge — Grundlage für Shift-Klick (Bereichswahl). */
  const auswahlReihe = useMemo(
    () =>
      [...schichten]
        .filter((s) => s.status !== "abgesagt")
        .sort((a, b) => a.start_at.localeCompare(b.start_at) || a.id.localeCompare(b.id))
        .map((s) => s.id),
    [schichten],
  );

  const auswaehlen = useCallback(
    (id: string, shift: boolean) => {
      setAusgewaehlt((alt) => {
        const neu = new Set(alt);
        if (shift && letzteAuswahl.current) {
          const a = auswahlReihe.indexOf(letzteAuswahl.current);
          const b = auswahlReihe.indexOf(id);
          if (a >= 0 && b >= 0) {
            for (let i = Math.min(a, b); i <= Math.max(a, b); i += 1) neu.add(auswahlReihe[i]);
            return neu;
          }
        }
        if (neu.has(id)) neu.delete(id);
        else neu.add(id);
        return neu;
      });
      letzteAuswahl.current = id;
    },
    [auswahlReihe],
  );

  function auswahlBeenden() {
    setAuswahlModus(false);
    setAusgewaehlt(new Set());
    letzteAuswahl.current = null;
  }

  // --- Aktionen -------------------------------------------------------------
  async function schnellAnlegen(userId: string | null, tag: string, vorlageId: string) {
    const v = vorlagen.find((x) => x.id === vorlageId);
    if (!v) return;
    const start = utcFuerOrtszeit(tag, v.start_zeit.slice(0, 5), zone);
    const endeTag = v.end_zeit <= v.start_zeit ? tagePlus(tag, 1) : tag;
    const ende = utcFuerOrtszeit(endeTag, v.end_zeit.slice(0, 5), zone);
    await speichern({
      user_id: userId ?? "",
      start_at: start,
      end_at: ende,
      tag,
      pause_min: v.pause_min,
      arbeitsbereich_id: v.arbeitsbereich_id ?? "",
      property_id: "",
      vorlage_id: v.id,
      notiz: "",
    });
  }

  /** Der EINE Konfliktfluss: 409 = Rückfrage, 422 = Fehlermeldung. */
  function konfliktFrage(konflikte: Konflikt[]): boolean {
    return window.confirm(
      `${t("dienstplan.hinweiseFrage")}\n${konflikte.map((k) => konfliktText(t, k)).join("\n")}`,
    );
  }

  async function speichern(werte: SchichtDialogWerte, warnungenOk = false) {
    const body: SchichtCreate = {
      user_id: werte.user_id || null,
      start_at: werte.start_at,
      end_at: werte.end_at,
      pause_min: werte.pause_min,
      arbeitsbereich_id: werte.arbeitsbereich_id || null,
      property_id: werte.property_id || null,
      vorlage_id: werte.vorlage_id || null,
      notiz: werte.notiz || null,
      warnungen_akzeptieren: warnungenOk,
    };
    const res = werte.id
      ? await updateSchicht(werte.id, {
          user_id: body.user_id,
          user_id_leeren: !body.user_id,
          start_at: body.start_at,
          end_at: body.end_at,
          pause_min: body.pause_min,
          arbeitsbereich_id: body.arbeitsbereich_id,
          property_id: body.property_id,
          notiz: body.notiz,
          warnungen_akzeptieren: warnungenOk,
        })
      : await createSchicht(body);
    if (!res.ok) {
      protokoll("fehler", `Speichern: ${res.status} ${res.error}`, res.details);
      if (res.status === 409 && res.details?.konflikte) {
        if (konfliktFrage(res.details.konflikte as Konflikt[])) return speichern(werte, true);
        return;
      }
      if (res.status === 422 && res.details?.konflikte) {
        const konflikte = res.details.konflikte as Konflikt[];
        toast.error(`${res.error} ${konflikte.map((k) => konfliktText(t, k)).join(" · ")}`);
        return;
      }
      toast.error(res.error);
      return;
    }
    protokoll("gespeichert", `${werte.id ? "geändert" : "angelegt"}: ${res.data.id}`, res.data);
    toast.success(t("dienstplan.gespeichert"));
    setDialog(null);
    still();
  }

  async function loeschen(id: string) {
    const res = await deleteSchicht(id);
    if (!res.ok) return void toast.error(res.error);
    protokoll("geloescht", id);
    setDialog(null);
    still();
  }

  async function veroeffentlichen() {
    const res = await wocheVeroeffentlichen(woche);
    if (!res.ok) return void toast.error(res.error);
    toast.success(
      t("dienstplan.veroeffentlicht", {
        anzahl: res.data.anzahl,
        personen: res.data.benachrichtigt,
      }),
    );
    protokoll("veroeffentlicht", `${res.data.anzahl} Schichten, ${res.data.benachrichtigt} Personen`);
    still();
  }

  async function kopieren() {
    const res = await wocheKopieren(tagePlus(woche, -7), woche, true);
    if (!res.ok) return void toast.error(res.error);
    toast.success(
      t("dienstplan.kopiert", { angelegt: res.data.angelegt, vorhanden: res.data.vorhanden }),
    );
    still();
  }

  async function bedarf() {
    const res = await bedarfAusAufgaben(woche);
    if (!res.ok) return void toast.error(res.error);
    toast.success(
      t("dienstplan.bedarfErzeugt", { angelegt: res.data.angelegt, vorhanden: res.data.vorhanden }),
    );
    still();
  }

  // --- §1.4 Woche leeren -----------------------------------------------------
  async function leeren() {
    // Rueckfrage mit ZAHLEN (Vertrag §5): was hier steht, ist das Fenster —
    // die Zahlen der Wirkung liefert der Server danach in der Meldung.
    if (
      !window.confirm(
        `${t("loeschen")} — ${t("dienstplan.woche", {
          von: tagKurz(woche, locale),
          bis: tagKurz(tagePlus(woche, 6), locale),
        })}?`,
      )
    )
      return;
    setF1Laeuft(true);
    const res = await wocheLeeren(woche, filter.arbeitsbereich_id || undefined);
    setF1Laeuft(false);
    if (!res.ok) {
      protokoll("fehler", `Leeren: ${res.status} ${res.error}`, res.details);
      return void toast.error(res.error);
    }
    toast.success(
      `${t("loeschen")}: ${res.data.geloescht} · ${res.data.abgesagt}`,
    );
    protokoll("geleert", `${res.data.geloescht} gelöscht, ${res.data.abgesagt} abgesagt`);
    still();
  }

  // --- §1.4 Mehrfachaktion ---------------------------------------------------
  async function mehrfach(
    aktion: MehrfachAktion,
    opts: { tage?: number; user_id?: string },
    warnungenOk = false,
  ) {
    const ids = [...ausgewaehlt];
    if (ids.length === 0) return;
    if (aktion === "loeschen" && !warnungenOk) {
      if (!window.confirm(`${t("mehrfach.loeschen")} — ${t("mehrfach.ausgewaehlt", { anzahl: ids.length })}?`))
        return;
    }
    setF1Laeuft(true);
    const res = await schichtenMehrfach({
      ids,
      aktion,
      tage: opts.tage ?? null,
      user_id: opts.user_id ?? null,
      warnungen_akzeptieren: warnungenOk,
    });
    setF1Laeuft(false);
    if (!res.ok) {
      protokoll("fehler", `Mehrfach ${aktion}: ${res.status} ${res.error}`, res.details);
      // Derselbe Fluss wie bei der Einzelschicht: 409 = Rückfrage, 422 = Fehler.
      if (res.status === 409 && res.details?.konflikte) {
        const liste = res.details.konflikte as { schicht_id: string; konflikte: Konflikt[] }[];
        if (konfliktFrage(liste.flatMap((x) => x.konflikte))) {
          return mehrfach(aktion, opts, true);
        }
        return;
      }
      if (res.status === 422 && res.details?.konflikte) {
        const liste = res.details.konflikte as { schicht_id: string; konflikte: Konflikt[] }[];
        toast.error(
          `${res.error} ${liste
            .flatMap((x) => x.konflikte)
            .map((k) => konfliktText(t, k))
            .join(" · ")}`,
        );
        return;
      }
      return void toast.error(res.error);
    }
    toast.success(t("mehrfach.ausgewaehlt", { anzahl: res.data.geaendert }));
    protokoll("mehrfach", `${aktion}: ${res.data.geaendert} geändert`, res.data);
    auswahlBeenden();
    still();
  }

  // --- §1.4 Tausch -----------------------------------------------------------
  async function tauschSenden(werte: {
    an_user_id: string;
    gegen_schicht_id: string | null;
    grund: string;
  }) {
    if (!tauschFuer) return;
    setF1Laeuft(true);
    const res = await tauschAnfragen(tauschFuer.id, {
      an_user_id: werte.an_user_id,
      gegen_schicht_id: werte.gegen_schicht_id,
      grund: werte.grund || null,
    });
    setF1Laeuft(false);
    if (!res.ok) {
      protokoll("fehler", `Tausch anfragen: ${res.status} ${res.error}`, res.details);
      return void toast.error(res.error);
    }
    protokoll("tausch", `angefragt ${res.data.id}`, res.data);
    toast.success(t("tausch.anfragen"));
    setTauschFuer(null);
    await tauscheLaden();
    still();
  }

  /** Alle vier Zustandswechsel eines Tauschs über EINEN Weg. */
  async function tauschAktion(
    id: string,
    was: "annehmen" | "ablehnen" | "zurueckziehen" | "freigeben" | "verwerfen",
    warnungenOk = false,
  ) {
    setF1Laeuft(true);
    const res =
      was === "annehmen"
        ? await tauschAnnehmen(id)
        : was === "ablehnen"
          ? await tauschAblehnen(id)
          : was === "zurueckziehen"
            ? await tauschZurueckziehen(id)
            : await tauschEntscheiden(id, {
                freigeben: was === "freigeben",
                warnungen_akzeptieren: warnungenOk,
              });
    setF1Laeuft(false);
    if (!res.ok) {
      protokoll("fehler", `Tausch ${was}: ${res.status} ${res.error}`, res.details);
      // Die Freigabe schreibt BEIDE Schichten — sie kann deshalb wie eine
      // Schicht mit 409/422 antworten (§1.4).
      if (res.status === 409 && res.details?.konflikte) {
        if (konfliktFrage(res.details.konflikte as Konflikt[])) {
          return tauschAktion(id, was, true);
        }
        return;
      }
      if (res.status === 422 && res.details?.konflikte) {
        const konflikte = res.details.konflikte as Konflikt[];
        toast.error(`${res.error} ${konflikte.map((k) => konfliktText(t, k)).join(" · ")}`);
        return;
      }
      return void toast.error(res.error);
    }
    protokoll("tausch", `${was} ${id} → ${res.data.status}`, res.data);
    await tauscheLaden();
    still();
  }

  // --- §1.4 CSV --------------------------------------------------------------
  async function csvHolen() {
    setF1Laeuft(true);
    const res = await dienstplanCsv(woche);
    setF1Laeuft(false);
    if (!res.ok) {
      protokoll("fehler", `CSV: ${res.status} ${res.error}`, res.details);
      return void toast.error(res.error);
    }
    // Base64 → Blob → Download; der Server liefert Semikolon, BOM und CRLF.
    const rohe = atob(res.data.inhalt_base64);
    const bytes = new Uint8Array(rohe.length);
    for (let i = 0; i < rohe.length; i += 1) bytes[i] = rohe.charCodeAt(i);
    const url = URL.createObjectURL(new Blob([bytes], { type: res.data.mime }));
    const a = document.createElement("a");
    a.href = url;
    a.download = res.data.name;
    a.click();
    URL.revokeObjectURL(url);
    protokoll("csv", `${res.data.name} (${bytes.length} Bytes)`);
  }

  async function bewerbungenOeffnen(s: Schicht) {
    const res = await schichtBewerbungen(s.id);
    if (!res.ok) return void toast.error(res.error);
    setBewerber({ schicht: s, personen: res.data });
  }

  async function bewerbungEntscheidung(s: Schicht, userId: string, annehmen: boolean) {
    const res = await bewerbungEntscheiden(s.id, userId, annehmen);
    if (!res.ok) return void toast.error(res.error);
    setBewerber(null);
    still();
  }

  // --- Paket F1: Bedarf --------------------------------------------------------
  async function bedarfOeffnen() {
    setBedarfOffen(true);
    setBedarfLaden(true);
    const res = await getBedarf(von, bis);
    setBedarfLaden(false);
    if (!res.ok) {
      protokoll("fehler", `Bedarf: ${res.error}`, res.details);
      return void toast.error(res.error);
    }
    setBedarfDaten(res.data);
    protokoll("laden", `Bedarf: ${res.data.vorlagen.length} Vorlagen, ${res.data.tage.length} Tageszeilen`);
  }

  async function bedarfNachladen() {
    const res = await getBedarf(von, bis);
    if (res.ok) setBedarfDaten(res.data);
  }

  async function bedarfVorlagenSpeichern(zeilen: BedarfZeile[]) {
    setF1Laeuft(true);
    const res = await setBedarfVorlagen(zeilen);
    setF1Laeuft(false);
    if (!res.ok) {
      protokoll("fehler", `Bedarf-Vorlagen: ${res.error}`, res.details);
      return void toast.error(res.error);
    }
    toast.success(t("bedarf.vorlagenGespeichert", { anzahl: res.data.length }));
    await bedarfNachladen();
  }

  async function bedarfTageSpeichern(zeilen: BedarfZeile[]) {
    setF1Laeuft(true);
    const res = await setBedarfTage(von, bis, zeilen);
    setF1Laeuft(false);
    if (!res.ok) {
      protokoll("fehler", `Bedarf-Tage: ${res.error}`, res.details);
      return void toast.error(res.error);
    }
    toast.success(t("bedarf.tageGespeichert", { anzahl: res.data.length }));
    await bedarfNachladen();
  }

  // --- Paket F1: Druck (A4 quer, OHNE Finanzzahlen) ---------------------------
  async function drucken() {
    setF1Laeuft(true);
    try {
      await downloadDienstplanPdf({
        betrieb,
        woche,
        tage: Array.from({ length: 7 }, (_, i) => tagePlus(woche, i)),
        // Bewusst nur die Felder des Aushangs — kein Geld (§4.3).
        personen: plan.personen.map((p) => ({ user_id: p.user_id, full_name: p.full_name })),
        schichten: plan.schichten.map((s) => ({
          id: s.id,
          user_id: s.user_id,
          datum: s.datum,
          start_at: s.start_at,
          end_at: s.end_at,
          status: s.status,
          arbeitsbereich_id: s.arbeitsbereich_id,
          property_title: s.property_title,
          notiz: s.notiz,
        })),
        bereiche: arbeitsbereiche.map((b) => ({ id: b.id, kurz: b.kurz, farbe: b.farbe })),
        feiertage: plan.feiertage,
        zone,
        locale,
        texte: {
          titel: t("dienstplan.title"),
          kw: t("drucken.kw"),
          person: t("dienstplan.person"),
          offeneSchichten: t("dienstplan.offen"),
          keineSchichten: t("drucken.keineSchichten"),
          erzeugtAm: t("drucken.erzeugtAm", {
            zeitpunkt: new Intl.DateTimeFormat(locale, {
              dateStyle: "medium",
              timeStyle: "short",
            }).format(new Date()),
          }),
          entwurf: t("drucken.entwurfHinweis"),
        },
      });
      protokoll("drucken", `PDF für Woche ${woche}`);
    } catch (exc) {
      protokoll("fehler", `Drucken: ${exc instanceof Error ? exc.message : "unbekannt"}`);
      toast.error(t("drucken.fehler"));
    } finally {
      setF1Laeuft(false);
    }
  }

  // --- Drag & Drop -------------------------------------------------------------
  function dragStart(e: React.DragEvent, s: Schicht) {
    if (!kannPlanen) return;
    const d = { schichtId: s.id, vonUser: s.user_id, vonTag: s.datum };
    dragRef.current = d;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", s.id);
    window.setTimeout(() => setDrag(d), 0);
  }
  function dragEnde() {
    dragRef.current = null;
    setDrag(null);
    setZiel(null);
  }
  async function drop(userId: string | null, tag: string) {
    const d = dragRef.current;
    dragEnde();
    if (!d) return;
    const s = plan.schichten.find((x) => x.id === d.schichtId);
    if (!s) return;
    if (s.user_id === userId && s.datum === tag) return;
    const tagDiff = (Date.parse(`${tag}T00:00:00Z`) - Date.parse(`${s.datum}T00:00:00Z`)) / 86400000;
    const start = tagDiff ? umTageVerschieben(s.start_at, tagDiff, zone) : s.start_at;
    const ende = tagDiff ? umTageVerschieben(s.end_at, tagDiff, zone) : s.end_at;
    protokoll("drag", `${s.id}: ${s.user_id ?? "offen"}/${s.datum} → ${userId ?? "offen"}/${tag}`, {
      start,
      ende,
    });
    await speichern(
      {
        id: s.id,
        user_id: userId ?? "",
        start_at: start,
        end_at: ende,
        tag,
        pause_min: s.pause_min,
        arbeitsbereich_id: s.arbeitsbereich_id ?? "",
        property_id: s.property_id ?? "",
        vorlage_id: s.vorlage_id ?? "",
        notiz: s.notiz ?? "",
      },
      false,
    );
  }

  /** Eine Schicht öffnen — im Auswahlmodus wählt der Klick statt zu öffnen. */
  function schichtOeffnen(s: SchichtPlus) {
    if (auswahlModus) return auswaehlen(s.id, false);
    if (!kannPlanen) return;
    if (!s.user_id && s.bewerbungen > 0) return void bewerbungenOeffnen(s);
    setDialog({
      id: s.id,
      user_id: s.user_id ?? "",
      start_at: s.start_at,
      end_at: s.end_at,
      tag: s.datum,
      pause_min: s.pause_min,
      arbeitsbereich_id: s.arbeitsbereich_id ?? "",
      property_id: s.property_id ?? "",
      vorlage_id: s.vorlage_id ?? "",
      notiz: s.notiz ?? "",
      status: s.status,
      konflikte: s.konflikte,
    });
  }

  function schichtNeu(userId: string | null, tag: string) {
    if (!kannPlanen || !plan.regeln_bestaetigt) return;
    setDialog({
      user_id: userId ?? "",
      start_at: "",
      end_at: "",
      tag,
      pause_min: 0,
      arbeitsbereich_id: "",
      property_id: "",
      vorlage_id: "",
      notiz: "",
    });
  }

  // --- Render -------------------------------------------------------------------
  const zeitraumText =
    ansicht === "tag"
      ? tagKurz(anker, locale)
      : ansicht === "woche"
        ? t("dienstplan.woche", { von: tagKurz(von, locale), bis: tagKurz(bis, locale) })
        : new Intl.DateTimeFormat(locale, { month: "long", year: "numeric" }).format(
            new Date(`${monatsErster(anker)}T12:00:00Z`),
          );

  return (
    <div className="flex flex-1 flex-col gap-3 pb-20">
      <DienstplanLeiste
        zeitraumText={zeitraumText}
        statusText={
          plan.veroeffentlicht_am
            ? t("dienstplan.statusVeroeffentlicht")
            : t("dienstplan.statusEntwurf")
        }
        ansicht={ansicht}
        darstellung={darstellung}
        laden={laden}
        laeuft={f1Laeuft}
        kannPlanen={kannPlanen}
        regelnBestaetigt={plan.regeln_bestaetigt}
        auswahlModus={auswahlModus}
        onZurueck={() => wechseln(-1)}
        onVor={() => wechseln(1)}
        onHeute={() => urlSetzen({ anker: heute })}
        onAnsicht={(a) => urlSetzen({ ansicht: a })}
        onDarstellung={(d) => urlSetzen({ dar: d })}
        onDrucken={() => void drucken()}
        onCsv={() => void csvHolen()}
        onVorlagen={() => void wv.oeffnen()}
        onAuswahlToggle={() => (auswahlModus ? auswahlBeenden() : setAuswahlModus(true))}
        onBedarfEditor={() => void bedarfOeffnen()}
        onBedarfAusAufgaben={() => void bedarf()}
        onKopieren={() => void kopieren()}
        onLeeren={() => void leeren()}
        onVeroeffentlichen={() => void veroeffentlichen()}
      />
      {!plan.regeln_bestaetigt && (
        <p className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          {t("dienstplan.regelnFehlen")}{" "}
          <a href="/hr/einstellungen" className="underline">
            {t("einstellungen.title")}
          </a>
        </p>
      )}

      <DienstplanFilter
        wert={filter}
        onChange={(neu) => urlSetzen({ filter: neu })}
        arbeitsbereiche={arbeitsbereiche}
        objekte={objekte}
        personen={plan.personen}
      />

      <DienstplanKopf
        kennzahlen={kennzahlen}
        tage={kopfTage}
        wetter={plan.wetter ?? {}}
        heute={heute}
        wochenende={wochenende}
        wetterAnzeigen={wetterAnzeigen}
      />

      {ansicht === "monat" ? (
        <DienstplanMonat
          monat={monatsErster(anker)}
          rasterStart={von}
          schichten={schichten}
          abwesenheiten={plan.abwesenheiten}
          personen={personen}
          arbeitsbereiche={arbeitsbereiche}
          feiertage={plan.feiertage}
          wetter={wetterAnzeigen ? (plan.wetter ?? {}) : {}}
          zone={zone}
          heute={heute}
          onTagOeffnen={(tag) => urlSetzen({ ansicht: "tag", anker: tag })}
        />
      ) : darstellung === "liste" ? (
        <DienstplanListe
          schichten={schichten}
          personen={plan.personen}
          arbeitsbereiche={arbeitsbereiche}
          zone={zone}
          heute={heute}
          auswahlModus={auswahlModus}
          ausgewaehlt={ausgewaehlt}
          onAuswahl={auswaehlen}
          onOeffnen={schichtOeffnen}
          onTausch={setTauschFuer}
          konfliktText={(k) => konfliktText(t, k)}
          kannPlanen={kannPlanen}
        />
      ) : ansicht === "tag" ? (
        <DienstplanTag
          tag={anker}
          schichten={schichten}
          personen={personen}
          abwesenheiten={plan.abwesenheiten}
          verfuegbarkeiten={plan.verfuegbarkeiten ?? []}
          arbeitsbereiche={arbeitsbereiche}
          zone={zone}
          kannPlanen={kannPlanen}
          auswahlModus={auswahlModus}
          ausgewaehlt={ausgewaehlt}
          onAuswahl={auswaehlen}
          onOeffnen={schichtOeffnen}
          onNeu={schichtNeu}
          konfliktText={(k) => konfliktText(t, k)}
        />
      ) : (
        <>
          <DienstplanGrid
            woche={von}
            tage={kopfTage}
            heute={heute}
            wochenende={wochenende}
            zone={zone}
            blocks={blocks}
            gruppiert={gruppiert}
            offeneZeile={offeneZeile}
            zellen={zellen}
            abwesend={abwesend}
            verfuegbarkeiten={verfuegbarJeZelle}
            feiertage={plan.feiertage}
            arbeitsbereiche={arbeitsbereiche}
            vorlagen={vorlagen}
            minutenJePerson={plan.minuten_je_person}
            lesebestaetigungen={plan.lesebestaetigungen}
            offeneAnzahl={offeneSchichten.length}
            kwLabel={t("dienstplan.kw", { kw: isoWoche(montagVon(von)) })}
            kannPlanen={kannPlanen}
            regelnBestaetigt={plan.regeln_bestaetigt}
            auswahlModus={auswahlModus}
            ausgewaehlt={ausgewaehlt}
            eingeklappt={eingeklappt}
            kennzahlZeilen={kennzahlZeilen}
            kennzahlBereiche={kennzahlBereiche}
            kennzahlTage={kennzahlTage}
            currency={currency}
            drag={drag}
            ziel={ziel}
            onZiel={setZiel}
            onBereichToggle={(id) =>
              setEingeklappt((alt) => {
                const neu = new Set(alt);
                if (neu.has(id)) neu.delete(id);
                else neu.add(id);
                return neu;
              })
            }
            onAuswahl={auswaehlen}
            onOeffnen={schichtOeffnen}
            onTausch={setTauschFuer}
            onNeu={schichtNeu}
            onSchnellAnlegen={(u, tag, v) => void schnellAnlegen(u, tag, v)}
            onDragStart={dragStart}
            onDragEnde={dragEnde}
            onDrop={(u, tag) => void drop(u, tag)}
            konfliktText={(k) => konfliktText(t, k)}
          />
          {/* Betriebsfußzeile: geplante Stunden und Personen je Tag. */}
          <TagesSummen
            tage={kopfTage}
            kennzahlTage={kennzahlTage}
            personenGesamt={plan.personen.length}
          />
        </>
      )}

      <TauschListe
        tausche={tausche}
        eigeneId={eigeneId}
        kannEntscheiden={kannPlanen}
        zone={zone}
        onAnnehmen={(id) => void tauschAktion(id, "annehmen")}
        onAblehnen={(id) => void tauschAktion(id, "ablehnen")}
        onZurueckziehen={(id) => void tauschAktion(id, "zurueckziehen")}
        onEntscheiden={(id, freigeben) =>
          void tauschAktion(id, freigeben ? "freigeben" : "verwerfen")
        }
      />

      <DienstplanLegende arbeitsbereiche={arbeitsbereiche} />

      <KiPanel
        woche={woche}
        status={ki.status}
        prognose={ki.prognose}
        lauf={ki.lauf}
        assistent={ki.assistent}
        arbeitsbereiche={arbeitsbereiche}
        currency={kennzahlen?.currency ?? null}
        laeuft={f1Laeuft}
        kannPlanen={kannPlanen}
        prognoseFehlercode={ki.prognoseFehlercode}
        onPrognose={() => void ki.prognoseErzeugen()}
        onPrognoseUebernehmen={(id) => void ki.prognoseUebernehmen(id)}
        onAutoplan={(w) => void ki.autoplan(w)}
        onVarianteUebernehmen={(id, v) => void ki.varianteUebernehmen(id, v)}
        onLaufVerwerfen={(id) => void ki.laufVerwerfen(id)}
        onFrage={(f) => void ki.frage(f)}
      />

      {auswahlModus && (
        <MehrfachLeiste
          anzahl={ausgewaehlt.size}
          personen={plan.personen}
          onAktion={(aktion, opts) => void mehrfach(aktion, opts)}
          onAbbrechen={auswahlBeenden}
          laeuft={f1Laeuft}
        />
      )}

      {tauschFuer && (
        <TauschDialog
          schicht={tauschFuer}
          personen={plan.personen}
          alleSchichten={plan.schichten}
          arbeitsbereiche={arbeitsbereiche}
          zone={zone}
          onClose={() => setTauschFuer(null)}
          onSenden={(w) => void tauschSenden(w)}
        />
      )}

      {wv.offen && (
        <WochenvorlagenDialog
          woche={woche}
          vorlagen={wv.liste}
          laden={wv.laden}
          laeuft={f1Laeuft}
          kannPlanen={kannPlanen}
          onClose={wv.schliessen}
          onSpeichern={(w) => void wv.speichern(w)}
          onUmbenennen={(id, w) => void wv.umbenennen(id, w)}
          onLoeschen={(id) => void wv.loeschen(id)}
          onAnwenden={(id, mit) => void wv.anwenden(id, mit)}
        />
      )}

      {bedarfOffen && (
        <BedarfEditor
          von={von}
          bis={bis}
          daten={bedarfDaten}
          arbeitsbereiche={arbeitsbereiche}
          objekte={objekte}
          laden={bedarfLaden}
          laeuft={f1Laeuft}
          kannPlanen={kannPlanen}
          onClose={() => setBedarfOffen(false)}
          onVorlagenSpeichern={(z) => void bedarfVorlagenSpeichern(z)}
          onTageSpeichern={(z) => void bedarfTageSpeichern(z)}
        />
      )}

      {dialog && (
        <SchichtDialog
          werte={dialog}
          zone={zone}
          personen={plan.personen}
          arbeitsbereiche={arbeitsbereiche}
          vorlagen={vorlagen}
          objekte={objekte}
          onClose={() => setDialog(null)}
          onSave={(w) => void speichern(w)}
          onDelete={dialog.id ? () => void loeschen(dialog.id!) : undefined}
        />
      )}

      {bewerber && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setBewerber(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-card p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-lg font-extrabold">{t("dienstplan.bewerbungen")}</h2>
            <p className="mb-3 text-sm text-muted-foreground">
              {tagKurz(bewerber.schicht.datum, locale)} ·{" "}
              {uhrzeitInZone(bewerber.schicht.start_at, zone)}–
              {uhrzeitInZone(bewerber.schicht.end_at, zone)}
              {bewerber.schicht.property_title ? ` · ${bewerber.schicht.property_title}` : ""}
            </p>
            <ul className="divide-y text-sm">
              {bewerber.personen.map((p) => (
                <li key={p.user_id} className="flex items-center gap-2 py-2">
                  <span className="flex-1">{p.full_name ?? "—"}</span>
                  <Button
                    size="sm"
                    className="rounded-full"
                    onClick={() => bewerbungEntscheidung(bewerber.schicht, p.user_id, true)}
                  >
                    {t("annehmen")}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => bewerbungEntscheidung(bewerber.schicht, p.user_id, false)}
                  >
                    {t("ablehnen")}
                  </Button>
                </li>
              ))}
              {bewerber.personen.length === 0 && (
                <li className="py-2 text-muted-foreground">{t("dienstplan.keineBewerber")}</li>
              )}
            </ul>
            <div className="mt-3 flex justify-end">
              <Button
                variant="outline"
                className="rounded-full"
                onClick={() => setBewerber(null)}
              >
                {t("schliessen")}
              </Button>
            </div>
          </div>
        </div>
      )}

      <DienstplanDebug
        eintraege={debug}
        plan={plan}
        fenster={{ ansicht, darstellung, von, bis, gruppiert }}
        kennzahlen={kennzahlen}
        tausche={tausche}
        kiStatus={ki.status}
        planungslauf={ki.lauf}
      />
    </div>
  );
}

/** Stunden und Personen je Tag unter dem Raster (bisherige `tfoot`-Zeilen). */
function TagesSummen({
  tage,
  kennzahlTage,
  personenGesamt,
}: {
  tage: string[];
  kennzahlTage: Map<string, KennzahlTag>;
  personenGesamt: number;
}) {
  const t = useTranslations("personal");
  const werte = tage.map((tag) => kennzahlTage.get(tag));
  const max = Math.max(1, ...werte.map((k) => k?.plan_minuten ?? 0));
  const summe = werte.reduce((n, k) => n + (k?.plan_minuten ?? 0), 0);
  return (
    <div className="overflow-x-auto rounded-2xl border bg-secondary/30 text-xs">
      <table className="w-full min-w-[56rem] table-fixed border-collapse">
        <colgroup>
          <col className="w-48" />
          {tage.map((tag) => (
            <col key={tag} />
          ))}
          <col className="w-24" />
        </colgroup>
        <tbody>
          <tr>
            <th scope="row" className="p-2 text-left font-normal text-muted-foreground">
              {t("dienstplan.stundenJeTag")}
            </th>
            {tage.map((tag) => {
              const k = kennzahlTage.get(tag);
              return (
                <td key={tag} className="p-2 text-center">
                  <div className="font-medium tabular-nums">{stunden(k?.plan_minuten ?? 0)}</div>
                  <div className="mt-1 h-1 rounded bg-secondary">
                    <div
                      className="h-1 rounded bg-primary"
                      style={{ width: `${Math.round(((k?.plan_minuten ?? 0) / max) * 100)}%` }}
                    />
                  </div>
                </td>
              );
            })}
            <td className="p-2 text-right font-medium tabular-nums">{stunden(summe)} h</td>
          </tr>
          <tr>
            <th scope="row" className="p-2 text-left font-normal text-muted-foreground">
              {t("dienstplan.personenJeTag")}
            </th>
            {tage.map((tag) => (
              <td key={tag} className="p-2 text-center tabular-nums">
                {kennzahlTage.get(tag)?.personen ?? 0} / {personenGesamt}
              </td>
            ))}
            <td className="p-2 text-right text-muted-foreground">{t("dienstplan.summe")}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

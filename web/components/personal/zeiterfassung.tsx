"use client";

// Personal → Zeiterfassung (Leitung): Zeiten des Teams je Zeitraum, Korrektur
// mit Pflichtgrund, Bestätigung, Nachtrag, Monatsabschluss. Live über
// useRealtime auf personal_zeiterfassung.
//
// AUSBAU NACH VERTRAG §6
// ----------------------
// Vier Sichten auf denselben Zeitraum, umgeschaltet über die Tab-Pille:
// „Liste" (die Zeilen wie bisher), „Zusammenfassung" (`GET
// /zeiterfassung/zusammenfassung`, Soll/Ist je Person), „Unbestätigt &
// verpasst" (`GET /zeiterfassung/unbestaetigt`) und „Überstundenanträge" (die
// bestehende `<UeberstundenListe>` in der Team-Sicht). Dazu der Segmented-
// Umschalter Tag / Woche / Monat, der `von`/`bis` setzt, statt die Datumsfelder
// von Hand zu füllen.
//
// WARUM DER ZEITRAUM DIE QUELLE BLEIBT UND NICHT DIE ANSICHT
// ----------------------------------------------------------
// Tag/Woche/Monat sind nur eine bequeme Art, `von`/`bis` zu setzen — der
// Zeitraum selbst bleibt frei wählbar. Wer nach dem Umschalten ein Datumsfeld
// anfasst, verlässt damit die Ansicht (`sicht = "frei"`); die Pille zeigt dann
// keine Auswahl als aktiv, statt eine zu behaupten, die nicht stimmt.
//
// WARUM „SOLL" LEER BLEIBEN DARF
// ------------------------------
// `soll_minuten` ist `null`, wenn die Akte keine Wochenstunden trägt. Dann
// steht „—" in der Zelle und die Überstunden-Spalte bleibt, was der Server
// sagt — kein 0-Soll, aus dem eine erfundene Überstundenzahl folgt (Wurzel 4).
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { DatePicker } from "@nextdays/ui/date-picker";
import { Input } from "@nextdays/ui/input";
import { NativeSelect } from "@nextdays/ui/native-select";
import { Segmented } from "@nextdays/ui/segmented";
import { Textarea } from "@nextdays/ui/textarea";
import { listZeiten, monatAbschliessen, zeitBestaetigen, zeitKorrigieren, zeitLoeschen, zeitNachtragen } from "@/lib/personal";
import { getZeitUnbestaetigt, getZeitZusammenfassung } from "@/lib/personal-betrieb";
import {
  minutenAlsStunden,
  monatsErster,
  monatsLetzter,
  type Ueberstundenantrag,
  type ZeitUnbestaetigt,
  type ZeitZusammenfassung,
} from "@/lib/personal-betrieb-typen";
import {
  type KommendeSchicht,
  type Monatsabschluss,
  type ZeitListe,
  type Zeiterfassung,
  montagVon,
  stunden,
  tagePlus,
} from "@/lib/personal-typen";
import { tagInZone, uhrzeitInZone, utcFuerOrtszeit } from "@/lib/personal-zeit";
import { useRealtime } from "@/lib/use-realtime";
import { formatDate } from "@/lib/utils";

import { Stempeluhr } from "./stempeluhr";
import { UeberstundenListe } from "./ueberstunden";

/** Die vier Sichten aus §6 auf denselben Zeitraum. */
type Tab = "liste" | "zusammenfassung" | "unbestaetigt" | "ueberstunden";

/** Tag / Woche / Monat setzen `von`/`bis`; „frei" heißt handgesetzter Zeitraum. */
type Ansicht = "tag" | "woche" | "monat" | "frei";

/** `von`/`bis` einer Ansicht, ausgehend von einem Anker-Tag. */
function fenster(ansicht: Exclude<Ansicht, "frei">, anker: string): { von: string; bis: string } {
  if (ansicht === "tag") return { von: anker, bis: anker };
  if (ansicht === "woche") {
    const montag = montagVon(anker);
    return { von: montag, bis: tagePlus(montag, 6) };
  }
  return { von: monatsErster(anker), bis: monatsLetzter(anker) };
}

/** Ein Fenster um `n` Einheiten verschieben (Pfeile „Zurück"/„Vor"). */
function verschieben(ansicht: Exclude<Ansicht, "frei">, anker: string, n: number): string {
  if (ansicht === "tag") return tagePlus(anker, n);
  if (ansicht === "woche") return tagePlus(anker, n * 7);
  const jahr = Number(anker.slice(0, 4));
  const monat = Number(anker.slice(5, 7));
  return new Date(Date.UTC(jahr, monat - 1 + n, 1)).toISOString().slice(0, 10);
}

export function ZeiterfassungTeam({
  initial,
  von,
  bis,
  zone,
  kannBestaetigen,
  eigeneId,
  monatsabschluesse,
  objekte,
  zusammenfassung = [],
  unbestaetigt = [],
  ueberstunden = [],
  eigeneOffeneZeit = null,
  eigeneSchichtHeute = null,
  kannEigeneZeit = false,
  gpsPflicht = false,
  gpsRadiusM = 250,
}: {
  initial: ZeitListe;
  von: string;
  bis: string;
  zone: string;
  kannBestaetigen: boolean;
  eigeneId: string | null;
  monatsabschluesse: Monatsabschluss[];
  objekte: { id: string; title: string }[];
  /** §3.4 Zusammenfassung des anfangs geladenen Zeitraums. */
  zusammenfassung?: ZeitZusammenfassung[];
  /** §3.4 Unbestätigt & verpasst (zeitraumunabhängig, letzte 14 Tage). */
  unbestaetigt?: ZeitUnbestaetigt[];
  /** §3.5 Überstundenanträge im Zeitraum (Team-Sicht). */
  ueberstunden?: Ueberstundenantrag[];
  /** Offene Stempelung der AUFRUFENDEN Person (§6 Stempeluhr-Karte). */
  eigeneOffeneZeit?: Zeiterfassung | null;
  eigeneSchichtHeute?: KommendeSchicht | null;
  /** `track_own_time` — nur dann trägt der Kopf die Stempeluhr. */
  kannEigeneZeit?: boolean;
  gpsPflicht?: boolean;
  gpsRadiusM?: number;
}) {
  const t = useTranslations("personal");
  const locale = useLocale();
  const router = useRouter();
  const [zeitraum, setZeitraum] = useState({ von, bis });
  const [ansicht, setAnsicht] = useState<Ansicht>("monat");
  const [anker, setAnker] = useState(von);
  const [tab, setTab] = useState<Tab>("liste");
  const [daten, setDaten] = useState(initial);
  const [summenZeilen, setSummenZeilen] = useState(zusammenfassung);
  const [offeneZeilen, setOffeneZeilen] = useState(unbestaetigt);
  const [person, setPerson] = useState("");
  const [korrektur, setKorrektur] = useState<Zeiterfassung | null>(null);
  const [nachtrag, setNachtrag] = useState(false);

  const nachladen = useCallback(async () => {
    const res = await listZeiten(zeitraum.von, zeitraum.bis);
    if (res.ok) setDaten(res.data);
  }, [zeitraum]);
  useRealtime({ table: "personal_zeiterfassung", onChange: nachladen });

  // Zusammenfassung hängt am Zeitraum: sie wird nachgezogen, sobald der Tab
  // sichtbar ist ODER der Zeitraum sich ändert, während er sichtbar ist. Kein
  // Abruf für einen Tab, den niemand ansieht.
  const summenLaden = useCallback(async () => {
    const res = await getZeitZusammenfassung(zeitraum.von, zeitraum.bis);
    if (res.ok) setSummenZeilen(res.data);
    else toast.error(res.error);
  }, [zeitraum]);
  useEffect(() => {
    if (tab === "zusammenfassung") void summenLaden();
  }, [tab, summenLaden]);

  const offeneLaden = useCallback(async () => {
    const res = await getZeitUnbestaetigt();
    if (res.ok) setOffeneZeilen(res.data);
    else toast.error(res.error);
  }, []);
  useEffect(() => {
    if (tab === "unbestaetigt" && kannBestaetigen) void offeneLaden();
  }, [tab, kannBestaetigen, offeneLaden]);

  /** Ansicht wechseln: Fenster neu rechnen und die Liste nachziehen. */
  function ansichtSetzen(neu: Ansicht) {
    setAnsicht(neu);
    if (neu === "frei") return;
    const f = fenster(neu, anker);
    setZeitraum(f);
    void listZeiten(f.von, f.bis).then((res) => {
      if (res.ok) setDaten(res.data);
    });
  }

  /** Pfeile und „Heute": denselben Ansichtstyp, anderer Anker. */
  function ankerSetzen(neuerAnker: string) {
    if (ansicht === "frei") return;
    setAnker(neuerAnker);
    const f = fenster(ansicht, neuerAnker);
    setZeitraum(f);
    void listZeiten(f.von, f.bis).then((res) => {
      if (res.ok) setDaten(res.data);
    });
  }

  /** Handgesetztes Datum verlässt die Ansicht — sie stimmte danach nicht mehr. */
  function datumSetzen(feld: "von" | "bis", wert: string) {
    setAnsicht("frei");
    setZeitraum((z) => ({ ...z, [feld]: wert }));
  }

  const name = (id: string) => daten.personen.find((p) => p.user_id === id)?.full_name ?? "—";
  const liste = daten.items.filter((z) => !person || z.user_id === person);
  const summe = liste.reduce((n, z) => n + (z.end_at ? z.netto_minuten : 0), 0);

  /** Sprung aus „Unbestätigt & verpasst" in die Liste einer Person. */
  function zurPerson(zeile: ZeitUnbestaetigt) {
    setPerson(zeile.user_id);
    setTab("liste");
    // Das älteste offene Datum liegt oft vor dem gewählten Fenster — sonst
    // springt man in eine leere Liste und hält es für einen Fehler.
    if (zeile.aelteste && (zeile.aelteste < zeitraum.von || zeile.aelteste > zeitraum.bis)) {
      setAnsicht("monat");
      setAnker(zeile.aelteste);
      const f = fenster("monat", zeile.aelteste);
      setZeitraum(f);
      void listZeiten(f.von, f.bis).then((res) => {
        if (res.ok) setDaten(res.data);
      });
      toast.info(t("zeit.offen.sprungHinweis"));
    }
  }

  async function bestaetigen(z: Zeiterfassung) {
    const res = await zeitBestaetigen(z.id);
    if (!res.ok) return void toast.error(res.error);
    void nachladen();
  }

  async function loeschen(z: Zeiterfassung) {
    const grund = window.prompt(t("zeit.loeschGrund"));
    if (!grund || grund.trim().length < 3) return;
    const res = await zeitLoeschen(z.id, grund.trim());
    if (!res.ok) return void toast.error(res.error);
    void nachladen();
  }

  async function monat() {
    const d = new Date(`${zeitraum.von}T00:00:00Z`);
    const jahr = d.getUTCFullYear();
    const monatNr = d.getUTCMonth() + 1;
    const ids = daten.personen.map((p) => p.user_id);
    if (!window.confirm(t("zeit.monatFrage", { monat: `${monatNr}/${jahr}`, anzahl: ids.length }))) return;
    const res = await monatAbschliessen(ids, jahr, monatNr);
    if (!res.ok) return void toast.error(res.error);
    toast.success(t("zeit.monatAbgeschlossen", { anzahl: res.data.length }));
    router.refresh();
  }

  const offenSumme = offeneZeilen.reduce((n, z) => n + z.unbestaetigt + z.verpasst, 0);

  return (
    <div className="flex flex-1 flex-col gap-4 pb-20">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold">{t("zeit.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("zeit.subtitle", { summe: stunden(summe) })}</p>
        </div>
        <div className="flex flex-wrap items-end gap-2 text-sm">
          <Segmented<Ansicht>
            value={ansicht}
            onChange={ansichtSetzen}
            options={[
              { value: "tag", label: t("zeit.ansicht.tag") },
              { value: "woche", label: t("zeit.ansicht.woche") },
              { value: "monat", label: t("zeit.ansicht.monat") },
            ]}
          />
          {ansicht !== "frei" && (
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="rounded-full" title={t("zeit.zurueck")} onClick={() => ankerSetzen(verschieben(ansicht, anker, -1))}>
                <Icon icon="ph:caret-left" className="size-4" />
              </Button>
              <Button variant="outline" size="sm" className="rounded-full" onClick={() => ankerSetzen(new Date().toISOString().slice(0, 10))}>
                {t("zeit.heute")}
              </Button>
              <Button variant="outline" size="sm" className="rounded-full" title={t("zeit.vor")} onClick={() => ankerSetzen(verschieben(ansicht, anker, 1))}>
                <Icon icon="ph:caret-right" className="size-4" />
              </Button>
            </div>
          )}
          <label className="flex flex-col gap-1"><span className="text-xs text-muted-foreground">{t("von")}</span><DatePicker value={zeitraum.von} onChange={(v) => datumSetzen("von", v)} /></label>
          <label className="flex flex-col gap-1"><span className="text-xs text-muted-foreground">{t("bis")}</span><DatePicker value={zeitraum.bis} onChange={(v) => datumSetzen("bis", v)} /></label>
          <Button variant="outline" className="rounded-full" onClick={() => void nachladen()}>{t("anzeigen")}</Button>
          <NativeSelect value={person} onChange={(e) => setPerson(e.target.value)} className="w-44">
            <option value="">{t("zeit.allePersonen")}</option>
            {daten.personen.map((p) => <option key={p.user_id} value={p.user_id}>{p.full_name ?? p.user_id}</option>)}
          </NativeSelect>
          {kannBestaetigen && (
            <>
              <Button variant="outline" className="rounded-full" onClick={() => setNachtrag(true)}>
                <Icon icon="ph:plus" className="mr-1 size-4" />{t("zeit.nachtragen")}
              </Button>
              <Button className="rounded-full" onClick={monat}>
                <Icon icon="ph:lock" className="mr-1 size-4" />{t("zeit.monatAbschliessen")}
              </Button>
            </>
          )}
        </div>
      </div>

      {kannEigeneZeit && (
        <Stempeluhr
          initial={eigeneOffeneZeit}
          zone={zone}
          objekte={objekte}
          schichtHeute={eigeneSchichtHeute}
          gpsPflicht={gpsPflicht}
          gpsRadiusM={gpsRadiusM}
          onGestempelt={() => void nachladen()}
        />
      )}

      {monatsabschluesse.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {t("zeit.abgeschlossenHinweis", { anzahl: monatsabschluesse.length })}
        </p>
      )}

      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[
          { value: "liste", label: t("zeit.tabs.liste") },
          { value: "zusammenfassung", label: t("zeit.tabs.zusammenfassung") },
          // „Unbestätigt & verpasst" hängt am Confirm-Guard — ohne
          // `confirm_time` gibt es die Liste nicht, also auch keinen Tab, der
          // leer aussieht und Ruhe vortäuscht.
          ...(kannBestaetigen
            ? [
                {
                  value: "unbestaetigt" as Tab,
                  label: t("zeit.tabs.unbestaetigt") + (offenSumme > 0 ? ` (${offenSumme})` : ""),
                },
              ]
            : []),
          { value: "ueberstunden", label: t("zeit.tabs.ueberstunden") },
        ]}
      />

      {tab === "liste" && (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full min-w-[48rem] text-sm">
            <thead className="bg-secondary/40 text-left">
              <tr>
                <th className="p-2">{t("dienstplan.person")}</th>
                <th className="p-2">{t("datum")}</th>
                <th className="p-2">{t("zeit.zeitraum")}</th>
                <th className="p-2 text-right">{t("zeit.pause")}</th>
                <th className="p-2 text-right">{t("zeit.netto")}</th>
                <th className="p-2 text-right">{t("zeit.planAbweichung")}</th>
                <th className="p-2">{t("objekt")}</th>
                <th className="p-2">{t("dienstplan.status")}</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {liste.map((z) => (
                <tr key={z.id} className="border-t">
                  <td className="p-2">{name(z.user_id)}</td>
                  <td className="p-2">{formatDate(tagInZone(z.start_at, zone), locale)}</td>
                  <td className="p-2 tabular-nums">
                    {uhrzeitInZone(z.start_at, zone)}–{z.end_at ? uhrzeitInZone(z.end_at, zone) : "…"}
                    {z.quelle === "korrektur" && <span title={t("zeit.nachgetragen")}><Icon icon="ph:pencil-simple" className="ml-1 inline size-3 text-muted-foreground" /></span>}
                    {z.korrekturen > 0 && <span className="ml-1 text-xs text-muted-foreground">({z.korrekturen}×)</span>}
                  </td>
                  <td className="p-2 text-right tabular-nums">{z.pause_minuten} min</td>
                  <td className="p-2 text-right font-medium tabular-nums">{z.end_at ? `${stunden(z.netto_minuten)} h` : t(`zeit.zustand.${z.zustand}`)}</td>
                  <td className={`p-2 text-right tabular-nums ${z.plan_abweichung_min && Math.abs(z.plan_abweichung_min) > 15 ? "text-amber-700" : "text-muted-foreground"}`}>
                    {z.plan_abweichung_min === null ? "—" : `${z.plan_abweichung_min > 0 ? "+" : ""}${z.plan_abweichung_min} min`}
                  </td>
                  <td className="p-2">{z.property_title ?? "—"}</td>
                  <td className="p-2"><ZeitStatus status={z.status} /></td>
                  <td className="p-2 text-right">
                    {kannBestaetigen && z.end_at && (
                      <div className="flex justify-end gap-1">
                        {z.status === "abgeschlossen" && z.user_id !== eigeneId && (
                          <Button size="sm" variant="ghost" onClick={() => bestaetigen(z)} title={t("zeit.bestaetigen")}><Icon icon="ph:check" className="size-4" /></Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => setKorrektur(z)} title={t("zeit.korrigieren")}><Icon icon="ph:pencil-simple" className="size-4" /></Button>
                        <Button size="sm" variant="ghost" onClick={() => loeschen(z)} title={t("loeschen")}><Icon icon="ph:trash" className="size-4" /></Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {liste.length === 0 && <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">{t("zeit.keine")}</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === "zusammenfassung" && <Zusammenfassung zeilen={summenZeilen} />}
      {tab === "unbestaetigt" && kannBestaetigen && (
        <UnbestaetigtListe zeilen={offeneZeilen} locale={locale} onSprung={zurPerson} />
      )}
      {tab === "ueberstunden" && (
        <UeberstundenListe
          initial={ueberstunden}
          von={zeitraum.von}
          bis={zeitraum.bis}
          kannEntscheiden={kannBestaetigen}
        />
      )}

      {korrektur && (
        <KorrekturDialog z={korrektur} zone={zone} objekte={objekte} onClose={() => setKorrektur(null)} onSaved={() => { setKorrektur(null); void nachladen(); }} />
      )}
      {nachtrag && (
        <NachtragDialog personen={daten.personen} zone={zone} objekte={objekte} onClose={() => setNachtrag(false)} onSaved={() => { setNachtrag(false); void nachladen(); }} />
      )}
    </div>
  );
}

/**
 * §3.4 Zusammenfassung je Person: Arbeitstage, Ist, Soll, Überstunden, Krank,
 * Urlaub, Unbestätigt, Verspätungen.
 *
 * `soll_minuten === null` heißt „die Akte trägt keine Wochenstunden" — dann
 * „—", nicht 0 (Wurzel 4). Die Überstunden-Spalte zeigt trotzdem, was der
 * Server geliefert hat: ohne Soll rechnet er sie nicht, mit Soll schon.
 */
function Zusammenfassung({ zeilen }: { zeilen: ZeitZusammenfassung[] }) {
  const t = useTranslations("personal");
  return (
    <section className="flex flex-col gap-2">
      <div>
        <h2 className="font-display text-lg font-extrabold">{t("zeit.zusammenfassung.titel")}</h2>
        <p className="text-sm text-muted-foreground">{t("zeit.zusammenfassung.hint")}</p>
      </div>
      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full min-w-[52rem] text-sm">
          <thead className="bg-secondary/40 text-left">
            <tr>
              <th className="p-2">{t("dienstplan.person")}</th>
              <th className="p-2 text-right">{t("zeit.zusammenfassung.arbeitstage")}</th>
              <th className="p-2 text-right">{t("zeit.zusammenfassung.netto")}</th>
              <th className="p-2 text-right">{t("zeit.zusammenfassung.soll")}</th>
              <th className="p-2 text-right">{t("zeit.zusammenfassung.ueberstunden")}</th>
              <th className="p-2 text-right">{t("zeit.zusammenfassung.krankTage")}</th>
              <th className="p-2 text-right">{t("zeit.zusammenfassung.urlaubTage")}</th>
              <th className="p-2 text-right">{t("zeit.zusammenfassung.unbestaetigt")}</th>
              <th className="p-2 text-right">{t("zeit.zusammenfassung.verspaetungen")}</th>
            </tr>
          </thead>
          <tbody>
            {zeilen.map((z) => (
              <tr key={z.user_id} className="border-t">
                <td className="p-2">{z.full_name ?? "—"}</td>
                <td className="p-2 text-right tabular-nums">{z.arbeitstage}</td>
                <td className="p-2 text-right font-medium tabular-nums">{minutenAlsStunden(z.netto_minuten)}</td>
                <td className="p-2 text-right tabular-nums text-muted-foreground">
                  {z.soll_minuten === null ? "—" : minutenAlsStunden(z.soll_minuten)}
                </td>
                <td className={`p-2 text-right tabular-nums ${z.ueberstunden_minuten > 0 ? "text-amber-700" : z.ueberstunden_minuten < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                  {z.soll_minuten === null ? "—" : minutenAlsStunden(z.ueberstunden_minuten)}
                </td>
                <td className="p-2 text-right tabular-nums">{z.krank_tage}</td>
                <td className="p-2 text-right tabular-nums">{z.urlaub_tage}</td>
                <td className={`p-2 text-right tabular-nums ${z.unbestaetigt > 0 ? "text-amber-700" : "text-muted-foreground"}`}>{z.unbestaetigt}</td>
                <td className={`p-2 text-right tabular-nums ${z.verspaetungen > 0 ? "text-amber-700" : "text-muted-foreground"}`}>{z.verspaetungen}</td>
              </tr>
            ))}
            {zeilen.length === 0 && (
              <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">{t("zeit.zusammenfassung.keine")}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/**
 * §3.4 Unbestätigt & verpasst je Person, mit Sprung in die Liste dieser Person.
 *
 * „Verpasst" rechnet der Server (veröffentlichte/bestätigte Schichten der
 * letzten 14 Tage ohne überlappende Stempelung) — die Oberfläche zeigt die
 * Zahl, sie leitet sie nicht selbst ab.
 */
function UnbestaetigtListe({
  zeilen,
  locale,
  onSprung,
}: {
  zeilen: ZeitUnbestaetigt[];
  locale: string;
  onSprung: (z: ZeitUnbestaetigt) => void;
}) {
  const t = useTranslations("personal");
  return (
    <section className="flex flex-col gap-2">
      <div>
        <h2 className="font-display text-lg font-extrabold">{t("zeit.offen.titel")}</h2>
        <p className="text-sm text-muted-foreground">{t("zeit.offen.hint")}</p>
      </div>
      <div className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full min-w-[36rem] text-sm">
          <thead className="bg-secondary/40 text-left">
            <tr>
              <th className="p-2">{t("dienstplan.person")}</th>
              <th className="p-2 text-right">{t("zeit.offen.unbestaetigt")}</th>
              <th className="p-2 text-right">{t("zeit.offen.verpasst")}</th>
              <th className="p-2">{t("zeit.offen.aelteste")}</th>
              <th className="p-2" />
            </tr>
          </thead>
          <tbody>
            {zeilen.map((z) => (
              <tr key={z.user_id} className="border-t">
                <td className="p-2">{z.full_name ?? "—"}</td>
                <td className={`p-2 text-right tabular-nums ${z.unbestaetigt > 0 ? "text-amber-700" : "text-muted-foreground"}`}>{z.unbestaetigt}</td>
                <td className={`p-2 text-right tabular-nums ${z.verpasst > 0 ? "text-destructive" : "text-muted-foreground"}`}>{z.verpasst}</td>
                <td className="p-2">{z.aelteste ? formatDate(z.aelteste, locale) : "—"}</td>
                <td className="p-2 text-right">
                  <Button size="sm" variant="outline" className="rounded-full" onClick={() => onSprung(z)}>
                    {t("zeit.offen.zeigen")}
                  </Button>
                </td>
              </tr>
            ))}
            {zeilen.length === 0 && (
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">{t("zeit.offen.keine")}</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function ZeitStatus({ status }: { status: Zeiterfassung["status"] }) {
  const t = useTranslations("personal");
  const farbe = { offen: "bg-amber-100 text-amber-800", abgeschlossen: "bg-secondary", bestaetigt: "bg-emerald-100 text-emerald-800" }[status];
  return <span className={`rounded-full px-2 py-0.5 text-xs ${farbe}`}>{t(`zeit.status.${status}`)}</span>;
}

function KorrekturDialog({ z, zone, objekte, onClose, onSaved }: { z: Zeiterfassung; zone: string; objekte: { id: string; title: string }[]; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("personal");
  const [tag, setTag] = useState(tagInZone(z.start_at, zone));
  const [von, setVon] = useState(uhrzeitInZone(z.start_at, zone));
  const [bis, setBis] = useState(z.end_at ? uhrzeitInZone(z.end_at, zone) : "");
  const [pause, setPause] = useState(String(z.pause_minuten));
  const [property, setProperty] = useState(z.property_id ?? "");
  const [grund, setGrund] = useState("");
  const [busy, setBusy] = useState(false);

  async function absenden(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const start = utcFuerOrtszeit(tag, von, zone);
    const endeTag = bis <= von ? tagePlus(tag, 1) : tag;
    const ende = utcFuerOrtszeit(endeTag, bis, zone);
    const pauseMin = Number(pause) || 0;
    // Pause als EIN Block ab Start + Hälfte der Arbeitszeit — die Lage ist bei
    // einer Korrektur nicht bekannt, die Dauer schon.
    const pausen = pauseMin > 0
      ? [{ start: new Date((Date.parse(start) + Date.parse(ende)) / 2 - (pauseMin * 60000) / 2).toISOString(), end: new Date((Date.parse(start) + Date.parse(ende)) / 2 + (pauseMin * 60000) / 2).toISOString() }]
      : [];
    const res = await zeitKorrigieren(z.id, { start_at: start, end_at: ende, pausen, property_id: property || null, grund: grund.trim() });
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(t("zeit.korrigiert"));
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose} role="dialog" aria-modal="true">
      <form onSubmit={absenden} className="w-full max-w-md rounded-2xl bg-card p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-3 font-display text-lg font-extrabold">{t("zeit.korrigieren")}</h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <label className="col-span-2 flex flex-col gap-1"><span className="font-medium">{t("datum")}</span><DatePicker value={tag} onChange={setTag} /></label>
          <label className="flex flex-col gap-1"><span className="font-medium">{t("von")}</span><Input type="time" value={von} onChange={(e) => setVon(e.target.value)} required /></label>
          <label className="flex flex-col gap-1"><span className="font-medium">{t("bis")}</span><Input type="time" value={bis} onChange={(e) => setBis(e.target.value)} required /></label>
          <label className="flex flex-col gap-1"><span className="font-medium">{t("pauseMin")}</span><Input inputMode="numeric" value={pause} onChange={(e) => setPause(e.target.value)} /></label>
          <label className="flex flex-col gap-1"><span className="font-medium">{t("objekt")}</span>
            <NativeSelect value={property} onChange={(e) => setProperty(e.target.value)}><option value="">—</option>{objekte.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}</NativeSelect>
          </label>
          <label className="col-span-2 flex flex-col gap-1"><span className="font-medium">{t("zeit.grundPflicht")}</span><Textarea rows={2} value={grund} onChange={(e) => setGrund(e.target.value)} required minLength={3} /></label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" className="rounded-full" onClick={onClose}>{t("abbrechen")}</Button>
          <Button type="submit" disabled={busy || grund.trim().length < 3 || !bis} className="rounded-full">{t("speichern")}</Button>
        </div>
      </form>
    </div>
  );
}

export function NachtragDialog({ personen, zone, objekte, onClose, onSaved }: { personen: ZeitListe["personen"]; zone: string; objekte: { id: string; title: string }[]; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("personal");
  const [user, setUser] = useState(personen[0]?.user_id ?? "");
  const [tag, setTag] = useState(new Date().toISOString().slice(0, 10));
  const [von, setVon] = useState("08:00");
  const [bis, setBis] = useState("12:00");
  const [pause, setPause] = useState("0");
  const [property, setProperty] = useState("");
  const [grund, setGrund] = useState("");
  const [busy, setBusy] = useState(false);

  async function absenden(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const start = utcFuerOrtszeit(tag, von, zone);
    const ende = utcFuerOrtszeit(bis <= von ? tagePlus(tag, 1) : tag, bis, zone);
    const pauseMin = Number(pause) || 0;
    const mitte = (Date.parse(start) + Date.parse(ende)) / 2;
    const pausen = pauseMin > 0 ? [{ start: new Date(mitte - (pauseMin * 60000) / 2).toISOString(), end: new Date(mitte + (pauseMin * 60000) / 2).toISOString() }] : [];
    const res = await zeitNachtragen({ user_id: user, start_at: start, end_at: ende, pausen, property_id: property || null, grund: grund.trim() });
    setBusy(false);
    if (!res.ok) return void toast.error(res.error);
    toast.success(t("zeit.nachgetragenMeldung"));
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose} role="dialog" aria-modal="true">
      <form onSubmit={absenden} className="w-full max-w-md rounded-2xl bg-card p-4 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="mb-3 font-display text-lg font-extrabold">{t("zeit.nachtragen")}</h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <label className="col-span-2 flex flex-col gap-1"><span className="font-medium">{t("dienstplan.person")}</span>
            <NativeSelect value={user} onChange={(e) => setUser(e.target.value)}>{personen.map((p) => <option key={p.user_id} value={p.user_id}>{p.full_name ?? p.user_id}</option>)}</NativeSelect>
          </label>
          <label className="col-span-2 flex flex-col gap-1"><span className="font-medium">{t("datum")}</span><DatePicker value={tag} onChange={setTag} /></label>
          <label className="flex flex-col gap-1"><span className="font-medium">{t("von")}</span><Input type="time" value={von} onChange={(e) => setVon(e.target.value)} required /></label>
          <label className="flex flex-col gap-1"><span className="font-medium">{t("bis")}</span><Input type="time" value={bis} onChange={(e) => setBis(e.target.value)} required /></label>
          <label className="flex flex-col gap-1"><span className="font-medium">{t("pauseMin")}</span><Input inputMode="numeric" value={pause} onChange={(e) => setPause(e.target.value)} /></label>
          <label className="flex flex-col gap-1"><span className="font-medium">{t("objekt")}</span>
            <NativeSelect value={property} onChange={(e) => setProperty(e.target.value)}><option value="">—</option>{objekte.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}</NativeSelect>
          </label>
          <label className="col-span-2 flex flex-col gap-1"><span className="font-medium">{t("zeit.grundPflicht")}</span><Textarea rows={2} value={grund} onChange={(e) => setGrund(e.target.value)} required minLength={3} /></label>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <Button type="button" variant="outline" className="rounded-full" onClick={onClose}>{t("abbrechen")}</Button>
          <Button type="submit" disabled={busy || !user || grund.trim().length < 3} className="rounded-full">{t("speichern")}</Button>
        </div>
      </form>
    </div>
  );
}

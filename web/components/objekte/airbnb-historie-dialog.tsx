"use client";

// Buchungshistorie EINES Objekts von Airbnb holen — Zeitraum wählen, Etappen
// laufen sehen.
//
// WARUM ETAPPEN UND WARUM SICHTBAR: Airbnbs Reservierungs-Abruf reicht ab dem
// Startdatum nur 12 Monate weit, dann bricht er ab. Ein Zeitraum „01.01.2020
// bis heute" ist deshalb nicht ein Aufruf, sondern 27 — mit rund 60 Anfragen
// und entsprechend Zeit. Ohne diesen Dialog säße der Betrieb vor einem Knopf,
// der scheinbar nichts tut, und klickte ihn ein zweites Mal.
//
// Die Etappen überlappen bewusst (12 Monate Reichweite, 3 Monate Schritt), damit
// an den Rändern nichts durchfällt. Deshalb steht in der Liste je Zeile
// „gefunden" UND „neu": dieselbe Buchung taucht mehrfach auf, gespeichert wird
// sie einmal. Das ist kein Fehler, sondern der Schutz — und muss erklärt sein,
// sonst sieht es nach Doppelarbeit aus.
//
// Ein Lauf, der eine Etappe verliert, meldet NICHT „fertig": `vollstaendig`
// entscheidet, ob hier ein grüner Haken oder eine Warnung steht. Ein
// stillschweigend unvollständiger Import wäre das Schlimmste, was dieser
// Dialog tun kann — dann fehlen Buchungen und niemand weiß es.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useRef, useState } from "react";

import { Button } from "@nextdays/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@nextdays/ui/dialog";
import { Input } from "@nextdays/ui/input";
import {
  type EtappenLauf,
  airbnbHistorieEtappe,
  airbnbHistoriePlan,
} from "@/lib/channex";

type Schritt = "zeitraum" | "laeuft" | "ergebnis";

/** Der laufende Stand — das, was der Betrieb während des Laufs sieht. */
type Stand = {
  /** true = es wird übernommen, false = nur geprüft (Vorschau). */
  uebernimmt: boolean;
  gesamt: number;
  fertig: number;
  gefunden: number;
  angelegt: number;
  aktualisiert: number;
  uebersprungen: number;
  mitNachrichten: number;
  fremde: number;
  jahre: Record<string, number>;
  gruende: string[];
  zeilen: EtappenLauf[];
  abgebrochen: boolean;
};

function leererStand(uebernimmt: boolean, gesamt: number): Stand {
  return {
    uebernimmt,
    gesamt,
    fertig: 0,
    gefunden: 0,
    angelegt: 0,
    aktualisiert: 0,
    uebersprungen: 0,
    mitNachrichten: 0,
    fremde: 0,
    jahre: {},
    gruende: [],
    zeilen: [],
    abgebrochen: false,
  };
}

/** Startvorschlag: der 1. Januar vor sechs Jahren — deckt die übliche
 *  Vermietungshistorie ab. Bewusst nur ein VORSCHLAG im Feld, kein stiller
 *  Standard: der Zeitraum ist die Entscheidung des Betriebs. */
function standardVon(): string {
  return `${new Date().getFullYear() - 6}-01-01`;
}

function heute(): string {
  return new Date().toISOString().slice(0, 10);
}

export function AirbnbHistorieDialog({
  propertyId,
  offen,
  onSchliessen,
}: {
  propertyId: string;
  offen: boolean;
  onSchliessen: () => void;
}) {
  const t = useTranslations("objects.sync.airbnbHistorie");
  const [schritt, setSchritt] = useState<Schritt>("zeitraum");
  const [von, setVon] = useState(standardVon());
  const [bis, setBis] = useState(heute());
  const [stand, setStand] = useState<Stand | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  // Abbruch-Signal: ein 27-Etappen-Lauf muss stoppbar sein, ohne den Tab zu
  // schließen. `useRef`, weil die laufende Schleife den aktuellen Wert lesen
  // muss — ein State-Wert wäre in ihrer Closure eingefroren.
  const abbruch = useRef(false);

  function schliessen() {
    abbruch.current = true;
    setSchritt("zeitraum");
    setStand(null);
    setFehler(null);
    onSchliessen();
  }

  /** Die Etappen-Kette fahren und nach JEDER Etappe den Stand zeigen.
   *
   *  Bewusst sequenziell, nicht parallel: Airbnb bekommt sonst 27 Anfragen auf
   *  einmal, und der Fortschritt wäre wieder ein Sprung von 0 auf 100.
   */
  async function lauf(uebernimmt: boolean) {
    setFehler(null);
    abbruch.current = false;

    const plan = await airbnbHistoriePlan(propertyId, von, bis);
    if (!plan.ok) {
      setFehler(plan.error);
      return;
    }
    const gesamt = plan.data.etappen.length;
    let s = leererStand(uebernimmt, gesamt);
    setStand(s);
    setSchritt("laeuft");

    // Die Codes ALLER bisherigen Etappen. Die Etappen überlappen vierfach —
    // ohne diese Liste zählte derselbe Aufenthalt viermal als „neu".
    const bekannt: string[] = [];

    for (let n = 1; n <= gesamt; n++) {
      if (abbruch.current) {
        s = { ...s, abgebrochen: true };
        setStand(s);
        return;
      }
      const res = await airbnbHistorieEtappe(
        propertyId,
        von,
        bis,
        n,
        uebernimmt,
        bekannt,
      );
      if (!res.ok) {
        // Ein harter Fehler (kein Token, kein Objekt) betrifft alle Etappen —
        // dann weiterzulaufen hieße 26-mal denselben Fehler zu erzeugen.
        setFehler(res.error);
        setStand({ ...s, abgebrochen: true });
        return;
      }
      const e = res.data;
      bekannt.push(...e.codes);
      const jahre = { ...s.jahre };
      for (const [jahr, anzahl] of Object.entries(e.jahre)) {
        jahre[jahr] = (jahre[jahr] ?? 0) + anzahl;
      }
      s = {
        ...s,
        fertig: n,
        gefunden: s.gefunden + e.neu,
        angelegt: s.angelegt + e.angelegt,
        aktualisiert: s.aktualisiert + e.aktualisiert,
        uebersprungen: s.uebersprungen + e.uebersprungen,
        mitNachrichten: s.mitNachrichten + e.mit_nachrichten,
        fremde: Math.max(s.fremde, e.fremde),
        jahre,
        gruende: [...new Set([...s.gruende, ...e.gruende])],
        zeilen: [...s.zeilen, e],
      };
      setStand(s);
    }
    setSchritt("ergebnis");
  }

  const laeuft = schritt === "laeuft";

  return (
    <Dialog open={offen} onOpenChange={(o) => !o && schliessen()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogTitle className="font-display text-xl font-extrabold">
          {t("title")}
        </DialogTitle>

        {schritt === "zeitraum" && (
          <ZeitraumSchritt
            von={von}
            bis={bis}
            setVon={setVon}
            setBis={setBis}
            laeuft={false}
            onWeiter={() => void lauf(false)}
          />
        )}

        {(laeuft || schritt === "ergebnis") && stand && (
          <LaufAnsicht
            stand={stand}
            laeuft={laeuft}
            onAbbrechen={() => {
              abbruch.current = true;
            }}
            onZurueck={() => {
              setSchritt("zeitraum");
              setStand(null);
            }}
            onUebernehmen={() => void lauf(true)}
            onFertig={schliessen}
          />
        )}

        {fehler && (
          <p className="flex items-start gap-2 rounded-2xl bg-destructive/10 p-3 text-sm text-destructive">
            <Icon icon="ph:warning-circle-fill" className="mt-0.5 size-4 shrink-0" />
            <span>{fehler}</span>
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ZeitraumSchritt({
  von,
  bis,
  setVon,
  setBis,
  laeuft,
  onWeiter,
}: {
  von: string;
  bis: string;
  setVon: (v: string) => void;
  setBis: (v: string) => void;
  laeuft: boolean;
  onWeiter: () => void;
}) {
  const t = useTranslations("objects.sync.airbnbHistorie");
  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground">{t("zeitraumHint")}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t("von")}</span>
          <Input type="date" value={von} onChange={(e) => setVon(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="font-medium">{t("bis")}</span>
          <Input type="date" value={bis} onChange={(e) => setBis(e.target.value)} />
        </label>
      </div>
      {/* Der Hinweis auf die Dauer steht VOR dem Klick, nicht danach: ein
          6-Jahres-Zeitraum braucht spürbar Zeit, und wer das vorher weiß,
          bricht nicht mittendrin ab. */}
      <p className="rounded-2xl bg-muted/50 p-3 text-sm text-muted-foreground">
        {t("etappenErklaerung")}
      </p>
      <div className="flex justify-end gap-2">
        <Button onClick={onWeiter} disabled={laeuft || !von || !bis}>
          {laeuft && <Icon icon="ph:spinner" className="size-4 animate-spin" />}
          {t("pruefen")}
        </Button>
      </div>
    </div>
  );
}

/** Der laufende Lauf und sein Ergebnis — dieselbe Ansicht, nur ein Zustand
 *  weiter. Bewusst NICHT zwei getrennte Schritte: der Betrieb soll die Zahlen,
 *  die er während des Laufs wachsen sah, am Ende an derselben Stelle
 *  wiederfinden, statt auf eine neue Maske geworfen zu werden. */
function LaufAnsicht({
  stand,
  laeuft,
  onAbbrechen,
  onZurueck,
  onUebernehmen,
  onFertig,
}: {
  stand: Stand;
  laeuft: boolean;
  onAbbrechen: () => void;
  onZurueck: () => void;
  onUebernehmen: () => void;
  onFertig: () => void;
}) {
  const t = useTranslations("objects.sync.airbnbHistorie");
  const prozent = stand.gesamt
    ? Math.round((stand.fertig / stand.gesamt) * 100)
    : 0;
  const aktuell = stand.zeilen[stand.zeilen.length - 1];
  const kaputt = stand.zeilen.filter((z) => z.fehler);
  const jahre = Object.entries(stand.jahre);
  const fertig = !laeuft && !stand.abgebrochen;

  return (
    <div className="flex flex-col gap-4">
      {/* Der Fortschritt: Balken, Etappenzähler und die Etappe, die GERADE
          läuft. Genau das fehlte — ein Spinner allein beantwortet weder
          „wie weit" noch „was passiert eigentlich". */}
      <div className="flex flex-col gap-2 rounded-2xl border border-border p-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-medium">
            {laeuft
              ? t("laeuftTitel", { nummer: stand.fertig + 1, gesamt: stand.gesamt })
              : t("etappenGeprueft", { count: stand.fertig })}
          </p>
          <span className="text-sm text-muted-foreground">{prozent} %</span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-300"
            style={{ width: `${prozent}%` }}
          />
        </div>
        {aktuell && (
          <p className="text-sm text-muted-foreground">
            {aktuell.von} … {aktuell.bis}
          </p>
        )}
      </div>

      {/* Die Zahlen wachsen mit — nicht erst am Ende. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kennzahl label={t("kpiGefunden")} wert={stand.gefunden} gross />
        {stand.uebernimmt ? (
          <>
            <Kennzahl label={t("kpiAngelegt")} wert={stand.angelegt} />
            <Kennzahl label={t("kpiAktualisiert")} wert={stand.aktualisiert} />
            <Kennzahl label={t("kpiUebersprungen")} wert={stand.uebersprungen} />
          </>
        ) : (
          <>
            <Kennzahl label={t("kpiNachrichten")} wert={stand.mitNachrichten} />
            <Kennzahl label={t("kpiFremde")} wert={stand.fremde} />
            <Kennzahl label={t("kpiEtappen")} wert={stand.gesamt} />
          </>
        )}
      </div>

      {jahre.length > 0 && (
        <details className="rounded-2xl border border-border p-3 text-sm" open>
          <summary className="cursor-pointer font-medium">{t("jahre")}</summary>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1">
            {jahre.map(([jahr, anzahl]) => (
              <span key={jahr} className="text-muted-foreground">
                <span className="font-medium text-foreground">{jahr}</span>{" "}
                {t("anzahlBuchungen", { count: anzahl })}
              </span>
            ))}
          </div>
        </details>
      )}

      {/* Fremde Buchungen benennen statt verschweigen: der Airbnb-Kanal trägt
          alle Objekte des Kontos, und der Betrieb soll sehen, dass sie
          bewusst NICHT angefasst werden. */}
      {stand.fremde > 0 && (
        <p className="text-sm text-muted-foreground">
          {t("fremde", { count: stand.fremde })}
        </p>
      )}

      {stand.gruende.length > 0 && (
        <div className="flex flex-col gap-1 rounded-2xl border border-border p-3 text-sm">
          <p className="font-medium">
            {t("uebersprungen", { count: stand.uebersprungen })}
          </p>
          {/* Die Gründe stehen da, entdoppelt. „5 übersprungen" ohne Grund
              wäre eine verschluckte Fehlermeldung. */}
          {stand.gruende.map((g) => (
            <p key={g} className="text-muted-foreground">
              {g}
            </p>
          ))}
        </div>
      )}

      {kaputt.length > 0 && <Unvollstaendig etappen={kaputt} />}

      {stand.abgebrochen && (
        <p className="rounded-2xl border border-amber-500/40 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-400">
          {t("abgebrochen", { fertig: stand.fertig, gesamt: stand.gesamt })}
        </p>
      )}

      {/* Erst wenn alle Etappen durch sind und nichts schiefging, darf hier
          „vollständig" stehen (Wurzel 5). */}
      {fertig && stand.uebernimmt && kaputt.length === 0 && (
        <p className="flex items-center gap-2 rounded-2xl border border-emerald-500/40 bg-emerald-500/5 p-3 font-medium">
          <Icon icon="ph:check-circle-fill" className="size-5 text-emerald-600" />
          {t("fertig")}
        </p>
      )}

      {stand.zeilen.length > 0 && <Etappenliste etappen={stand.zeilen} />}

      <div className="flex justify-end gap-2">
        {laeuft ? (
          <Button variant="outline" onClick={onAbbrechen}>
            <Icon icon="ph:spinner" className="size-4 animate-spin" />
            {t("abbrechen")}
          </Button>
        ) : stand.uebernimmt ? (
          <Button onClick={onFertig}>{t("schliessen")}</Button>
        ) : (
          <>
            <Button variant="outline" onClick={onZurueck}>
              {t("zurueck")}
            </Button>
            <Button onClick={onUebernehmen} disabled={stand.gefunden === 0}>
              {t("uebernehmen", { count: stand.gefunden })}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function Kennzahl({
  label,
  wert,
  gross,
}: {
  label: string;
  wert: number;
  gross?: boolean;
}) {
  return (
    <div className="rounded-2xl border border-border p-3">
      <p
        className={
          gross
            ? "font-display text-2xl font-extrabold"
            : "font-display text-xl font-bold"
        }
      >
        {wert}
      </p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

/** Die Warnung, die einen unvollständigen Lauf von einem fertigen trennt. */
function Unvollstaendig({ etappen }: { etappen: { von: string; fehler: string | null }[] }) {
  const t = useTranslations("objects.sync.airbnbHistorie");
  const kaputt = etappen.filter((e) => e.fehler);
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-amber-500/40 bg-amber-500/5 p-3 text-sm">
      <p className="font-medium text-amber-700 dark:text-amber-400">
        {t("luecke", { count: kaputt.length })}
      </p>
      {kaputt.slice(0, 5).map((e) => (
        <p key={e.von} className="text-muted-foreground">
          {e.von}: {e.fehler}
        </p>
      ))}
    </div>
  );
}

function Etappenliste({
  etappen,
}: {
  etappen: { nummer: number; von: string; bis: string; gefunden: number; neu: number }[];
}) {
  const t = useTranslations("objects.sync.airbnbHistorie");
  return (
    <details className="rounded-2xl border border-border p-3 text-sm">
      <summary className="cursor-pointer font-medium">
        {t("etappenZeigen", { count: etappen.length })}
      </summary>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full text-sm">
          <tbody>
            {etappen.map((e) => (
              <tr key={e.nummer} className="border-b border-border/60 last:border-0">
                <td className="py-1 pr-3 text-muted-foreground">{e.nummer}</td>
                <td className="py-1 pr-3">
                  {e.von} … {e.bis}
                </td>
                <td className="py-1 text-muted-foreground">
                  {t("etappeZahlen", { gefunden: e.gefunden, neu: e.neu })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

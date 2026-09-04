"use client";

// KI-Panel des Dienstplans (Vertrag §2.3): Prognose, Autoplanung, Assistent.
//
// JEDE KI-AUSGABE IST GEKENNZEICHNET. Erklärung, Variantenvergleich und
// Assistentenantwort tragen `ph:sparkle` samt dem Wort „KI-erzeugt" — nicht
// als Zierde, sondern weil der Planer sonst nicht unterscheiden kann, was der
// Solver deterministisch gerechnet hat (Stunden, Kosten, Fairness — Zahlen des
// Servers) und was ein Sprachmodell dazu ERZÄHLT. Die Zahlen sind belastbar,
// der Fließtext ist ein Vorschlag.
//
// DER STATUS ENTSCHEIDET, WAS ÜBERHAUPT ANGEBOTEN WIRD. Ohne Vertex
// (`konfiguriert: false`) erscheint ein Hinweis statt der Knöpfe — ein Knopf,
// der zuverlässig 503 liefert, ist eine Attrappe. Mit Vertex steht der
// Tagesverbrauch daneben („3 von 50 Aufrufen heute"), damit ein erschöpfter
// Deckel nicht als Fehler ankommt.
//
// `produktivitaet_fehlt` IST KEIN FEHLER, SONDERN EINE FEHLENDE EINGABE. Die
// Prognose rechnet Stunden aus Produktivitätsannahmen je Bereich (§2.3); ohne
// eine einzige davon kann sie nichts liefern und antwortet 422 mit diesem
// Code. Als roter Fehlerbalken wäre das eine Sackgasse — deshalb ein Hinweis
// mit dem Weg dorthin (/hr/einstellungen).
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@nextdays/ui/button";
import { NativeSelect } from "@nextdays/ui/native-select";
import { Textarea } from "@nextdays/ui/textarea";
import { formatCurrency } from "@/lib/currency";
import type {
  AssistentAntwort,
  KiStatus,
  PlanVariante,
  Planungslauf,
  Planungstyp,
  Prognose,
} from "@/lib/personal-planung-typen";
import { PLANUNGSTYPEN } from "@/lib/personal-planung-typen";
import type { Arbeitsbereich } from "@/lib/personal-typen";
import { tagKurz } from "@/lib/personal-zeit";

/** Höchstlänge der Assistentenfrage — dieselbe Grenze wie der Server (§2.3). */
const FRAGE_MAX = 500;

type Abschnitt = "prognose" | "autoplan" | "assistent";

/** Kleines Kennzeichen für alles, was ein Sprachmodell geschrieben hat. */
function KiMarke() {
  const t = useTranslations("personal");
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-700">
      <Icon icon="ph:sparkle" className="size-3" />
      {t("ki.kennzeichen")}
    </span>
  );
}

export function KiPanel({
  woche,
  status,
  prognose,
  lauf,
  assistent,
  arbeitsbereiche,
  currency,
  laeuft,
  kannPlanen,
  /** Code aus `details.code` einer 422-Antwort der Prognose, z. B. `produktivitaet_fehlt`. */
  prognoseFehlercode,
  onPrognose,
  onPrognoseUebernehmen,
  onAutoplan,
  onVarianteUebernehmen,
  onLaufVerwerfen,
  onFrage,
}: {
  woche: string;
  status: KiStatus | null;
  prognose: Prognose | null;
  lauf: Planungslauf | null;
  assistent: AssistentAntwort | null;
  arbeitsbereiche: Arbeitsbereich[];
  currency: string | null;
  laeuft: boolean;
  kannPlanen: boolean;
  prognoseFehlercode: string | null;
  onPrognose: () => void;
  onPrognoseUebernehmen: (id: string) => void;
  onAutoplan: (werte: {
    planungstyp: Planungstyp;
    varianten: number;
    zeitlimit_s: number;
    nur_offene: boolean;
  }) => void;
  onVarianteUebernehmen: (id: string, variante: number) => void;
  onLaufVerwerfen: (id: string) => void;
  onFrage: (frage: string) => void;
}) {
  const t = useTranslations("personal");
  const locale = useLocale();

  const [offen, setOffen] = useState(false);
  const [abschnitt, setAbschnitt] = useState<Abschnitt>("prognose");
  const [typ, setTyp] = useState<Planungstyp>("alleskoenner");
  const [varianten, setVarianten] = useState(2);
  const [zeitlimit, setZeitlimit] = useState(15);
  const [nurOffene, setNurOffene] = useState(true);
  const [frage, setFrage] = useState("");

  const bereichName = (id: string | null) =>
    arbeitsbereiche.find((b) => b.id === id)?.name ?? t("dienstplan.ohneBereich");

  const geld = (minor: number | null | undefined, waehrung: string | null) =>
    minor === null || minor === undefined ? "—" : formatCurrency(minor / 100, waehrung, locale);

  const stunden = (wert: number) =>
    t("ki.stundenWert", { wert: new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(wert) });

  const prozent = (wert: number) =>
    `${new Intl.NumberFormat(locale, { maximumFractionDigits: 0 }).format(wert)} %`;

  const nichtKonfiguriert = status !== null && !status.konfiguriert;

  return (
    <section className="rounded-2xl border bg-card">
      <button
        type="button"
        onClick={() => setOffen((o) => !o)}
        aria-expanded={offen}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-secondary/40"
      >
        <Icon icon={offen ? "ph:caret-down" : "ph:caret-right"} className="size-3.5" />
        <Icon icon="ph:sparkle" className="size-4 text-violet-600" />
        <span className="font-medium">{t("ki.titel")}</span>
        {status && (
          <span className="ml-auto text-xs text-muted-foreground">
            {status.konfiguriert
              ? t("ki.verbrauch", {
                  verbrauch: status.verbrauch_heute,
                  limit: status.tageslimit,
                })
              : t("ki.nichtKonfiguriertKurz")}
          </span>
        )}
      </button>

      {offen && (
        <div className="border-t p-3">
          {nichtKonfiguriert ? (
            <p className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
              <Icon icon="ph:info" className="mt-0.5 size-4 shrink-0" />
              <span>{t("ki.nichtKonfiguriert")}</span>
            </p>
          ) : (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-2">
                {(["prognose", "autoplan", "assistent"] as const).map((a) => (
                  <Button
                    key={a}
                    variant={abschnitt === a ? "default" : "outline"}
                    size="sm"
                    className="rounded-full"
                    onClick={() => setAbschnitt(a)}
                  >
                    {t(`ki.abschnitt.${a}`)}
                  </Button>
                ))}
                {status && (
                  <span className="ml-auto text-xs text-muted-foreground">
                    {t("ki.solver", { solver: status.solver })}
                  </span>
                )}
              </div>

              {/* --- (a) Prognose -------------------------------------------- */}
              {abschnitt === "prognose" && (
                <div className="grid gap-3">
                  <p className="text-sm text-muted-foreground">{t("ki.prognoseHint")}</p>

                  {kannPlanen && (
                    <div>
                      <Button
                        size="sm"
                        className="rounded-full"
                        disabled={laeuft}
                        onClick={onPrognose}
                      >
                        <Icon icon="ph:chart-line-up" className="mr-1 size-4" />
                        {t("ki.prognoseErzeugen")}
                      </Button>
                    </div>
                  )}

                  {prognoseFehlercode === "produktivitaet_fehlt" && (
                    <p className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                      <Icon icon="ph:warning" className="mt-0.5 size-4 shrink-0" />
                      <span>
                        {t("fehlercode.produktivitaet_fehlt")}{" "}
                        <a href="/hr/einstellungen" className="underline">
                          {t("ki.zuDenAnnahmen")}
                        </a>
                      </span>
                    </p>
                  )}
                  {prognoseFehlercode && prognoseFehlercode !== "produktivitaet_fehlt" && (
                    <p className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                      {t("ki.prognoseFehler")}
                    </p>
                  )}

                  {prognose?.ausgabe && (
                    <div className="overflow-x-auto rounded-xl border">
                      <table className="w-full min-w-[34rem] text-sm">
                        <thead>
                          <tr className="border-b bg-secondary/40 text-left text-xs text-muted-foreground">
                            <th className="p-2 font-medium">{t("datum")}</th>
                            <th className="p-2 font-medium">{t("arbeitsbereich")}</th>
                            <th className="p-2 font-medium">{t("ki.stunden")}</th>
                            <th className="p-2 font-medium">{t("bedarf.anzahl")}</th>
                            <th className="p-2 font-medium">{t("ki.basis")}</th>
                          </tr>
                        </thead>
                        <tbody>
                          {prognose.ausgabe.tage.flatMap((tag) =>
                            tag.bereiche.map((b, i) => (
                              <tr
                                key={`${tag.datum}|${b.arbeitsbereich_id}`}
                                className="border-b last:border-b-0"
                              >
                                <td className="p-2 whitespace-nowrap">
                                  {i === 0 ? tagKurz(tag.datum, locale) : ""}
                                </td>
                                <td className="p-2">{bereichName(b.arbeitsbereich_id)}</td>
                                <td className="p-2 tabular-nums">{stunden(b.stunden)}</td>
                                <td className="p-2 tabular-nums">{b.anzahl}</td>
                                <td className="p-2 text-xs text-muted-foreground">
                                  {t("ki.basisWert", { basis: b.basis, wert: b.basis_wert })}
                                </td>
                              </tr>
                            )),
                          )}
                          {prognose.ausgabe.tage.every((tg) => tg.bereiche.length === 0) && (
                            <tr>
                              <td colSpan={5} className="p-4 text-center text-muted-foreground">
                                {t("ki.prognoseLeer")}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {prognose?.ausgabe?.tage.some((tg) => tg.hinweise.length > 0) && (
                    <ul className="space-y-1 text-xs text-muted-foreground">
                      {prognose.ausgabe.tage.flatMap((tg) =>
                        tg.hinweise.map((h) => (
                          <li key={`${tg.datum}|${h}`} className="flex items-start gap-1.5">
                            <Icon icon="ph:info" className="mt-0.5 size-3.5 shrink-0" />
                            {tagKurz(tg.datum, locale)}: {h}
                          </li>
                        )),
                      )}
                    </ul>
                  )}

                  {prognose?.erklaerung && (
                    <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-3">
                      <div className="mb-1 flex items-center gap-2">
                        <KiMarke />
                        <span className="text-xs text-muted-foreground">
                          {t("ki.erklaerung")}
                          {prognose.modell ? ` · ${prognose.modell}` : ""}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-line">{prognose.erklaerung}</p>
                    </div>
                  )}

                  {prognose && prognose.status === "fehler" && prognose.fehler && (
                    <p className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                      {prognose.fehler}
                    </p>
                  )}

                  {prognose?.ausgabe && kannPlanen && (
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-full"
                        disabled={laeuft || prognose.uebernommen_am !== null}
                        onClick={() => onPrognoseUebernehmen(prognose.id)}
                      >
                        <Icon icon="ph:download-simple" className="mr-1 size-4" />
                        {t("ki.alsBedarfUebernehmen")}
                      </Button>
                      {prognose.uebernommen_am && (
                        <span className="text-xs text-muted-foreground">
                          {t("ki.schonUebernommen", {
                            datum: tagKurz(prognose.uebernommen_am.slice(0, 10), locale),
                          })}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* --- (b) Autoplanung ---------------------------------------- */}
              {abschnitt === "autoplan" && (
                <div className="grid gap-3">
                  <p className="text-sm text-muted-foreground">{t("ki.autoplanHint")}</p>

                  {kannPlanen && (
                    <div className="grid gap-3 rounded-xl border p-3 sm:grid-cols-2">
                      <label className="flex flex-col gap-1 text-sm sm:col-span-2">
                        <span className="font-medium">{t("ki.planungstyp")}</span>
                        <NativeSelect
                          value={typ}
                          onChange={(e) => setTyp(e.target.value as Planungstyp)}
                        >
                          {PLANUNGSTYPEN.map((p) => (
                            <option key={p} value={p}>
                              {t(`ki.typ.${p}.name`)}
                            </option>
                          ))}
                        </NativeSelect>
                        <span className="text-xs text-muted-foreground">
                          {t(`ki.typ.${typ}.beschreibung`)}
                        </span>
                      </label>

                      <label className="flex flex-col gap-1 text-sm">
                        <span className="font-medium">{t("ki.varianten")}</span>
                        <NativeSelect
                          value={String(varianten)}
                          onChange={(e) => setVarianten(Number(e.target.value))}
                        >
                          {[1, 2, 3].map((n) => (
                            <option key={n} value={n}>
                              {n}
                            </option>
                          ))}
                        </NativeSelect>
                      </label>

                      <label className="flex flex-col gap-1 text-sm">
                        <span className="font-medium">{t("ki.zeitlimit")}</span>
                        <NativeSelect
                          value={String(zeitlimit)}
                          onChange={(e) => setZeitlimit(Number(e.target.value))}
                        >
                          {[5, 10, 15, 20, 30].map((n) => (
                            <option key={n} value={n}>
                              {t("ki.sekunden", { n })}
                            </option>
                          ))}
                        </NativeSelect>
                      </label>

                      <label className="flex items-center gap-2 text-sm sm:col-span-2">
                        <input
                          type="checkbox"
                          className="size-4 rounded border"
                          checked={nurOffene}
                          onChange={(e) => setNurOffene(e.target.checked)}
                        />
                        <span>{t("ki.nurOffene")}</span>
                      </label>

                      <div className="sm:col-span-2">
                        <Button
                          size="sm"
                          className="rounded-full"
                          disabled={laeuft}
                          onClick={() =>
                            onAutoplan({
                              planungstyp: typ,
                              varianten,
                              zeitlimit_s: zeitlimit,
                              nur_offene: nurOffene,
                            })
                          }
                        >
                          <Icon icon="ph:magic-wand" className="mr-1 size-4" />
                          {t("ki.autoplanStarten")}
                        </Button>
                        {laeuft && (
                          <span className="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
                            <Icon icon="ph:circle-notch" className="size-3.5 animate-spin" />
                            {t("ki.rechnet")}
                          </span>
                        )}
                      </div>
                    </div>
                  )}

                  {lauf?.fehler && (
                    <p className="rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                      {lauf.fehler}
                    </p>
                  )}

                  {lauf && lauf.varianten.length > 0 && (
                    <>
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {lauf.varianten.map((v, i) => (
                          <VariantenKarte
                            key={`${lauf.id}|${i}`}
                            variante={v}
                            index={i}
                            currency={currency}
                            gewaehlt={lauf.gewaehlte_variante === i}
                            laeuft={laeuft}
                            kannPlanen={kannPlanen}
                            uebernommen={lauf.uebernommen_am !== null}
                            geld={geld}
                            stunden={stunden}
                            prozent={prozent}
                            onUebernehmen={() => onVarianteUebernehmen(lauf.id, i)}
                          />
                        ))}
                      </div>

                      {lauf.erklaerung && (
                        <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-3">
                          <div className="mb-1 flex items-center gap-2">
                            <KiMarke />
                            <span className="text-xs text-muted-foreground">
                              {t("ki.variantenErklaerung")}
                            </span>
                          </div>
                          <p className="text-sm whitespace-pre-line">{lauf.erklaerung}</p>
                        </div>
                      )}

                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {lauf.dauer_ms !== null && (
                          <span>{t("ki.dauer", { ms: lauf.dauer_ms })}</span>
                        )}
                        {kannPlanen && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="ml-auto rounded-full text-destructive"
                            disabled={laeuft}
                            onClick={() => {
                              if (window.confirm(t("ki.verwerfenFrage"))) onLaufVerwerfen(lauf.id);
                            }}
                          >
                            <Icon icon="ph:trash" className="mr-1 size-4" />
                            {t("ki.laufVerwerfen")}
                          </Button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* --- (c) Assistent ------------------------------------------- */}
              {abschnitt === "assistent" && (
                <div className="grid gap-3">
                  <p className="text-sm text-muted-foreground">
                    {t("ki.assistentHint", { woche: tagKurz(woche, locale) })}
                  </p>

                  <label className="flex flex-col gap-1 text-sm">
                    <span className="font-medium">{t("ki.frage")}</span>
                    <Textarea
                      rows={3}
                      maxLength={FRAGE_MAX}
                      value={frage}
                      placeholder={t("ki.fragePlatzhalter")}
                      onChange={(e) => setFrage(e.target.value)}
                    />
                    <span className="text-right text-xs text-muted-foreground tabular-nums">
                      {frage.length} / {FRAGE_MAX}
                    </span>
                  </label>

                  <div>
                    <Button
                      size="sm"
                      className="rounded-full"
                      disabled={laeuft || frage.trim().length === 0}
                      onClick={() => onFrage(frage.trim())}
                    >
                      <Icon icon="ph:paper-plane-tilt" className="mr-1 size-4" />
                      {t("ki.fragen")}
                    </Button>
                  </div>

                  {assistent && (
                    <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-3">
                      <div className="mb-1 flex items-center gap-2">
                        <KiMarke />
                        <span className="text-xs text-muted-foreground">{t("ki.antwort")}</span>
                      </div>
                      <p className="text-sm whitespace-pre-line">{assistent.antwort}</p>
                      {assistent.quellen.length > 0 && (
                        <div className="mt-2 border-t border-violet-200 pt-2">
                          <div className="mb-1 text-xs font-medium">{t("ki.quellen")}</div>
                          <ul className="space-y-0.5 text-xs text-muted-foreground">
                            {assistent.quellen.map((q) => (
                              <li key={q} className="flex items-start gap-1.5">
                                <Icon icon="ph:link-simple" className="mt-0.5 size-3 shrink-0" />
                                {q}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </section>
  );
}

/** Eine Autoplan-Variante mit ihren Kennzahlen — die Zahlen kommen vom Solver. */
function VariantenKarte({
  variante,
  index,
  currency,
  gewaehlt,
  laeuft,
  kannPlanen,
  uebernommen,
  geld,
  stunden,
  prozent,
  onUebernehmen,
}: {
  variante: PlanVariante;
  index: number;
  currency: string | null;
  gewaehlt: boolean;
  laeuft: boolean;
  kannPlanen: boolean;
  uebernommen: boolean;
  geld: (minor: number | null | undefined, waehrung: string | null) => string;
  stunden: (wert: number) => string;
  prozent: (wert: number) => string;
  onUebernehmen: () => void;
}) {
  const t = useTranslations("personal");
  const k = variante.kennzahlen;

  const zeilen: { label: string; wert: string; ton?: string }[] = [
    { label: t("ki.kennzahl.schichten"), wert: String(variante.schichten.length) },
    { label: t("ki.kennzahl.stunden"), wert: stunden(k.stunden) },
    {
      label: t("ki.kennzahl.unbesetzt"),
      wert: String(k.unbesetzt),
      ton: k.unbesetzt > 0 ? "text-amber-700" : "text-emerald-700",
    },
    // Wurzel 4: die Währung kommt aus der Variante bzw. dem Betrieb — nie EUR.
    { label: t("ki.kennzahl.kosten"), wert: geld(k.kosten_minor, k.currency ?? currency) },
    { label: t("ki.kennzahl.fairness"), wert: prozent(k.fairness_pct) },
    { label: t("ki.kennzahl.wunsch"), wert: prozent(k.wunsch_erfuellt_pct) },
  ];

  return (
    <div className={`rounded-xl border p-3 ${gewaehlt ? "border-primary bg-primary/5" : ""}`}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="font-medium">{variante.name || t("ki.variante", { n: index + 1 })}</span>
        {k.konflikte > 0 && (
          <span
            className="inline-flex items-center gap-1 text-xs text-amber-700"
            title={t("ki.kennzahl.konflikte")}
          >
            <Icon icon="ph:warning" className="size-3.5" />
            {k.konflikte}
          </span>
        )}
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
        {zeilen.map((z) => (
          <div key={z.label} className="contents">
            <dt className="text-muted-foreground">{z.label}</dt>
            <dd className={`text-right font-medium tabular-nums ${z.ton ?? ""}`}>{z.wert}</dd>
          </div>
        ))}
      </dl>
      {kannPlanen && (
        <Button
          size="sm"
          variant={gewaehlt ? "default" : "outline"}
          className="mt-3 w-full rounded-full"
          disabled={laeuft || uebernommen}
          onClick={onUebernehmen}
        >
          <Icon icon="ph:check" className="mr-1 size-4" />
          {uebernommen ? t("ki.bereitsUebernommen") : t("ki.varianteUebernehmen")}
        </Button>
      )}
    </div>
  );
}

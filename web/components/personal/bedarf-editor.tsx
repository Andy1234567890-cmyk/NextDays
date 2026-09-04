"use client";

// Bedarfsplanung (Vertrag §2.2): wie viele Personen braucht welcher Bereich
// wann. Das ist die Soll-Besetzung, gegen die der Plan gemessen wird
// (Kennzahlen §2.1) und aus der der Autoplan seine Hüllen nimmt (§2.3).
//
// ZWEI EBENEN, EINE REGEL — die Tageszeile ERSETZT die Wochentag-Vorlage
// desselben Bereichs an diesem Tag (sie addiert sich NICHT dazu). Das ist die
// Stelle, an der man sich verrechnet: „Mo 2 Personen" plus „Mo, 14.09. 1
// Person" ergibt nicht 3, sondern 1. Deshalb steht der Satz nicht im Tooltip,
// sondern als Hinweisleiste über dem unteren Block.
//
// BEIDE PUTs ERSETZEN. `PUT /bedarf/vorlagen` schreibt ALLE Vorlagen des
// Betriebs, `PUT /bedarf/tage?von&bis` alle manuellen Tageszeilen des
// Fensters. Wer eine Zeile entfernt und speichert, hat sie gelöscht — darum
// hat jeder Block seinen EIGENEN Speichern-Knopf mit eigener Zählung, und der
// untere nennt das Fenster, das er überschreibt. Prognose-Zeilen (`quelle`
// `prognose`) bleiben serverseitig unberührt; sie werden hier angezeigt, aber
// nicht mitgesendet — sonst wandelte ein Speichern sie stillschweigend in
// Handarbeit um.
import { Icon } from "@iconify/react";
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useMemo, useState } from "react";

import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";
import { NativeSelect } from "@nextdays/ui/native-select";
import type { BedarfDaten, BedarfZeile } from "@/lib/personal-planung-typen";
import type { Arbeitsbereich } from "@/lib/personal-typen";
import { tagKurz } from "@/lib/personal-zeit";

/** Wochentage 0 = Montag … 6 = Sonntag (wie `personal_bedarf.wochentag`). */
const WOCHENTAGE = [0, 1, 2, 3, 4, 5, 6] as const;

/** Zeile im Editor — dieselben Felder wie `BedarfZeile`, plus lokaler Schlüssel. */
type Entwurf = BedarfZeile & { _key: string };

let zaehler = 0;
function neuerKey(): string {
  zaehler += 1;
  return `neu-${zaehler}`;
}

function alsEntwurf(z: BedarfZeile): Entwurf {
  return { ...z, _key: z.id ?? neuerKey() };
}

export function BedarfEditor({
  von,
  bis,
  daten,
  arbeitsbereiche,
  objekte,
  laden,
  laeuft,
  kannPlanen,
  onClose,
  onVorlagenSpeichern,
  onTageSpeichern,
}: {
  /** Erster Tag des angezeigten Fensters (Montag der Woche). */
  von: string;
  /** Letzter Tag des angezeigten Fensters. */
  bis: string;
  daten: BedarfDaten | null;
  arbeitsbereiche: Arbeitsbereich[];
  objekte: { id: string; title: string }[];
  laden: boolean;
  laeuft: boolean;
  kannPlanen: boolean;
  onClose: () => void;
  onVorlagenSpeichern: (zeilen: BedarfZeile[]) => void;
  onTageSpeichern: (zeilen: BedarfZeile[]) => void;
}) {
  const t = useTranslations("personal");
  const locale = useLocale();

  const [vorlagen, setVorlagen] = useState<Entwurf[]>([]);
  const [tage, setTage] = useState<Entwurf[]>([]);

  const aktiveBereiche = useMemo(
    () => arbeitsbereiche.filter((b) => !b.archived_at),
    [arbeitsbereiche],
  );

  // Serverstand übernehmen. Prognose-Zeilen bleiben sichtbar, sind aber nicht
  // bearbeitbar (der Block unten sendet sie nicht mit).
  useEffect(() => {
    setVorlagen((daten?.vorlagen ?? []).map(alsEntwurf));
    setTage((daten?.tage ?? []).map(alsEntwurf));
  }, [daten]);

  const standardBereich = aktiveBereiche[0]?.id ?? "";

  function zeileHinzu(art: "vorlage" | "tag") {
    const basis: BedarfZeile = {
      arbeitsbereich_id: standardBereich,
      property_id: null,
      wochentag: art === "vorlage" ? 0 : null,
      datum: art === "tag" ? von : null,
      zeit_von: "09:00",
      zeit_bis: "17:00",
      anzahl: 1,
      quelle: "manuell",
      notiz: null,
    };
    if (art === "vorlage") setVorlagen((z) => [...z, alsEntwurf(basis)]);
    else setTage((z) => [...z, alsEntwurf(basis)]);
  }

  function aendern(art: "vorlage" | "tag", key: string, patch: Partial<BedarfZeile>) {
    const f = (z: Entwurf[]) => z.map((x) => (x._key === key ? { ...x, ...patch } : x));
    if (art === "vorlage") setVorlagen(f);
    else setTage(f);
  }

  function entfernen(art: "vorlage" | "tag", key: string) {
    const f = (z: Entwurf[]) => z.filter((x) => x._key !== key);
    if (art === "vorlage") setVorlagen(f);
    else setTage(f);
  }

  /** `_key` abstreifen — der Server kennt nur `BedarfZeile`. */
  function nutzlast(z: Entwurf[]): BedarfZeile[] {
    return z
      .filter((x) => x.quelle !== "prognose" && x.arbeitsbereich_id)
      .map(({ _key: _weg, ...rest }) => rest);
  }

  // Tage im Fenster für die Datumsauswahl der unteren Tabelle.
  const fensterTage = useMemo(() => {
    const liste: string[] = [];
    let tag = von;
    // Harte Obergrenze, damit ein kaputtes Fenster keine Endlosschleife baut.
    for (let i = 0; i < 60 && tag <= bis; i += 1) {
      liste.push(tag);
      const d = new Date(`${tag}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + 1);
      tag = d.toISOString().slice(0, 10);
    }
    return liste;
  }, [von, bis]);

  const vorlagenZuSenden = nutzlast(vorlagen).length;
  const tageZuSenden = nutzlast(tage).length;

  function BereichWahl({ zeile, art }: { zeile: Entwurf; art: "vorlage" | "tag" }) {
    return (
      <NativeSelect
        aria-label={t("arbeitsbereich")}
        value={zeile.arbeitsbereich_id}
        disabled={!kannPlanen || zeile.quelle === "prognose"}
        onChange={(e) => aendern(art, zeile._key, { arbeitsbereich_id: e.target.value })}
      >
        {aktiveBereiche.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </NativeSelect>
    );
  }

  function ZeitFelder({ zeile, art }: { zeile: Entwurf; art: "vorlage" | "tag" }) {
    const gesperrt = !kannPlanen || zeile.quelle === "prognose";
    return (
      <div className="flex items-center gap-1">
        <Input
          type="time"
          className="w-28"
          aria-label={t("von")}
          value={zeile.zeit_von.slice(0, 5)}
          disabled={gesperrt}
          onChange={(e) => aendern(art, zeile._key, { zeit_von: e.target.value })}
        />
        <span className="text-muted-foreground">–</span>
        <Input
          type="time"
          className="w-28"
          aria-label={t("bis")}
          value={zeile.zeit_bis.slice(0, 5)}
          disabled={gesperrt}
          onChange={(e) => aendern(art, zeile._key, { zeit_bis: e.target.value })}
        />
      </div>
    );
  }

  function AnzahlFeld({ zeile, art }: { zeile: Entwurf; art: "vorlage" | "tag" }) {
    return (
      <Input
        type="number"
        min={0}
        max={99}
        className="w-20 tabular-nums"
        aria-label={t("bedarf.anzahl")}
        value={zeile.anzahl}
        disabled={!kannPlanen || zeile.quelle === "prognose"}
        onChange={(e) => aendern(art, zeile._key, { anzahl: Number(e.target.value) })}
      />
    );
  }

  function ObjektWahl({ zeile, art }: { zeile: Entwurf; art: "vorlage" | "tag" }) {
    return (
      <NativeSelect
        aria-label={t("objekt")}
        value={zeile.property_id ?? ""}
        disabled={!kannPlanen || zeile.quelle === "prognose"}
        onChange={(e) => aendern(art, zeile._key, { property_id: e.target.value || null })}
      >
        <option value="">{t("bedarf.alleObjekte")}</option>
        {objekte.map((o) => (
          <option key={o.id} value={o.id}>
            {o.title}
          </option>
        ))}
      </NativeSelect>
    );
  }

  function EntfernenKnopf({ zeile, art }: { zeile: Entwurf; art: "vorlage" | "tag" }) {
    if (!kannPlanen || zeile.quelle === "prognose") return null;
    return (
      <Button
        variant="ghost"
        size="icon"
        className="rounded-full text-destructive"
        aria-label={t("bedarf.zeileEntfernen")}
        title={t("bedarf.zeileEntfernen")}
        onClick={() => entfernen(art, zeile._key)}
      >
        <Icon icon="ph:minus-circle" className="size-4" />
      </Button>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="my-4 w-full max-w-4xl rounded-2xl bg-card p-4 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 flex items-start justify-between gap-2">
          <h2 className="font-display text-lg font-extrabold">{t("bedarf.titel")}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("schliessen")}
            className="text-muted-foreground"
          >
            <Icon icon="ph:x" className="size-5" />
          </button>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">{t("bedarf.hint")}</p>

        {laden && (
          <p className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
            <Icon icon="ph:circle-notch" className="size-4 animate-spin" />
            {t("bedarf.laden")}
          </p>
        )}

        {aktiveBereiche.length === 0 ? (
          <p className="rounded-2xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            {t("bedarf.keineBereiche")}{" "}
            <a href="/hr/einstellungen" className="underline">
              {t("einstellungen.title")}
            </a>
          </p>
        ) : (
          <>
            {/* --- Oben: Wochentag-Vorlagen ----------------------------------- */}
            <section className="rounded-2xl border">
              <header className="flex flex-wrap items-center justify-between gap-2 border-b bg-secondary/40 px-3 py-2">
                <div>
                  <h3 className="font-medium">{t("bedarf.vorlagenTitel")}</h3>
                  <p className="text-xs text-muted-foreground">{t("bedarf.vorlagenHint")}</p>
                </div>
                {kannPlanen && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    disabled={laeuft}
                    onClick={() => zeileHinzu("vorlage")}
                  >
                    <Icon icon="ph:plus" className="mr-1 size-4" />
                    {t("bedarf.zeileHinzu")}
                  </Button>
                )}
              </header>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[46rem] text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="p-2 font-medium">{t("arbeitsbereich")}</th>
                      <th className="p-2 font-medium">{t("bedarf.wochentag")}</th>
                      <th className="p-2 font-medium">{t("bedarf.zeitfenster")}</th>
                      <th className="p-2 font-medium">{t("bedarf.anzahl")}</th>
                      <th className="p-2 font-medium">{t("objekt")}</th>
                      <th className="w-10 p-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {vorlagen.map((z) => (
                      <tr key={z._key} className="border-b last:border-b-0">
                        <td className="p-2">
                          <BereichWahl zeile={z} art="vorlage" />
                        </td>
                        <td className="p-2">
                          <NativeSelect
                            aria-label={t("bedarf.wochentag")}
                            value={String(z.wochentag ?? 0)}
                            disabled={!kannPlanen}
                            onChange={(e) =>
                              aendern("vorlage", z._key, { wochentag: Number(e.target.value) })
                            }
                          >
                            {WOCHENTAGE.map((w) => (
                              <option key={w} value={w}>
                                {t(`bedarf.wochentage.${w}`)}
                              </option>
                            ))}
                          </NativeSelect>
                        </td>
                        <td className="p-2">
                          <ZeitFelder zeile={z} art="vorlage" />
                        </td>
                        <td className="p-2">
                          <AnzahlFeld zeile={z} art="vorlage" />
                        </td>
                        <td className="p-2">
                          <ObjektWahl zeile={z} art="vorlage" />
                        </td>
                        <td className="p-2 text-right">
                          <EntfernenKnopf zeile={z} art="vorlage" />
                        </td>
                      </tr>
                    ))}
                    {vorlagen.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-4 text-center text-muted-foreground">
                          {t("bedarf.keineVorlagen")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {kannPlanen && (
                <footer className="flex flex-wrap items-center justify-end gap-2 border-t px-3 py-2">
                  <span className="mr-auto text-xs text-muted-foreground">
                    {t("bedarf.ersetztAlleVorlagen", { anzahl: vorlagenZuSenden })}
                  </span>
                  <Button
                    size="sm"
                    className="rounded-full"
                    disabled={laeuft}
                    onClick={() => onVorlagenSpeichern(nutzlast(vorlagen))}
                  >
                    <Icon icon="ph:floppy-disk" className="mr-1 size-4" />
                    {t("bedarf.vorlagenSpeichern")}
                  </Button>
                </footer>
              )}
            </section>

            {/* --- Unten: Tagesübersteuerung ---------------------------------- */}
            <section className="mt-4 rounded-2xl border">
              <header className="flex flex-wrap items-center justify-between gap-2 border-b bg-secondary/40 px-3 py-2">
                <div>
                  <h3 className="font-medium">{t("bedarf.tageTitel")}</h3>
                  <p className="text-xs text-muted-foreground">
                    {t("bedarf.tageZeitraum", {
                      von: tagKurz(von, locale),
                      bis: tagKurz(bis, locale),
                    })}
                  </p>
                </div>
                {kannPlanen && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    disabled={laeuft}
                    onClick={() => zeileHinzu("tag")}
                  >
                    <Icon icon="ph:plus" className="mr-1 size-4" />
                    {t("bedarf.zeileHinzu")}
                  </Button>
                )}
              </header>

              <p className="flex items-start gap-2 border-b bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <Icon icon="ph:warning" className="mt-0.5 size-4 shrink-0" />
                {t("bedarf.ersetztHinweis")}
              </p>

              <div className="overflow-x-auto">
                <table className="w-full min-w-[46rem] text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-muted-foreground">
                      <th className="p-2 font-medium">{t("arbeitsbereich")}</th>
                      <th className="p-2 font-medium">{t("datum")}</th>
                      <th className="p-2 font-medium">{t("bedarf.zeitfenster")}</th>
                      <th className="p-2 font-medium">{t("bedarf.anzahl")}</th>
                      <th className="p-2 font-medium">{t("objekt")}</th>
                      <th className="w-10 p-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {tage.map((z) => (
                      <tr key={z._key} className="border-b last:border-b-0">
                        <td className="p-2">
                          <BereichWahl zeile={z} art="tag" />
                        </td>
                        <td className="p-2">
                          <div className="flex items-center gap-1">
                            <NativeSelect
                              aria-label={t("datum")}
                              value={z.datum ?? ""}
                              disabled={!kannPlanen || z.quelle === "prognose"}
                              onChange={(e) => aendern("tag", z._key, { datum: e.target.value })}
                            >
                              {/* Ein Datum ausserhalb des Fensters bleibt wählbar,
                                  sonst verlöre eine geladene Zeile ihren Wert. */}
                              {!z.datum || fensterTage.includes(z.datum) ? null : (
                                <option value={z.datum}>{tagKurz(z.datum, locale)}</option>
                              )}
                              {fensterTage.map((d) => (
                                <option key={d} value={d}>
                                  {tagKurz(d, locale)}
                                </option>
                              ))}
                            </NativeSelect>
                            {z.quelle === "prognose" && (
                              <span
                                className="inline-flex items-center gap-0.5 rounded-full bg-violet-100 px-1.5 py-0.5 text-[10px] font-medium text-violet-700"
                                title={t("bedarf.prognoseZeileHint")}
                              >
                                <Icon icon="ph:sparkle" className="size-3" />
                                {t("ki.kennzeichen")}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="p-2">
                          <ZeitFelder zeile={z} art="tag" />
                        </td>
                        <td className="p-2">
                          <AnzahlFeld zeile={z} art="tag" />
                        </td>
                        <td className="p-2">
                          <ObjektWahl zeile={z} art="tag" />
                        </td>
                        <td className="p-2 text-right">
                          <EntfernenKnopf zeile={z} art="tag" />
                        </td>
                      </tr>
                    ))}
                    {tage.length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-4 text-center text-muted-foreground">
                          {t("bedarf.keineTage")}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {kannPlanen && (
                <footer className="flex flex-wrap items-center justify-end gap-2 border-t px-3 py-2">
                  <span className="mr-auto text-xs text-muted-foreground">
                    {t("bedarf.ersetztAlleTage", {
                      anzahl: tageZuSenden,
                      von: tagKurz(von, locale),
                      bis: tagKurz(bis, locale),
                    })}
                  </span>
                  <Button
                    size="sm"
                    className="rounded-full"
                    disabled={laeuft}
                    onClick={() => onTageSpeichern(nutzlast(tage))}
                  >
                    <Icon icon="ph:floppy-disk" className="mr-1 size-4" />
                    {t("bedarf.tageSpeichern")}
                  </Button>
                </footer>
              )}
            </section>
          </>
        )}

        <div className="mt-4 flex justify-end">
          <Button variant="outline" className="rounded-full" onClick={onClose}>
            {t("schliessen")}
          </Button>
        </div>
      </div>
    </div>
  );
}

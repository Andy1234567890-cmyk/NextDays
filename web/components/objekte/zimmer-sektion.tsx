"use client";

// Zimmer eines Objekts — Karte + Editor (0246).
//
// Vorher war das ein Zählwerk ("2× Schlafzimmer"). Ein Zählwerk kann nicht
// sagen, WELCHES Schlafzimmer welche Betten hat, welche Ausstattung darin liegt
// und welches Bad an welches Schlafzimmer grenzt. Deshalb ist jedes Zimmer eine
// eigene Zeile (Tabelle property_rooms).
//
// Die OBERFLÄCHE folgt Lodgify (live abgeglichen 01.08.2026,
// /rental/{id}/overview/rooms): zwei Gruppen — Privat und Gemeinschaftlich —,
// darin JEDER Zimmertyp mit einem Zähler „− Zahl +". Der Zähler ist kein
// zweites Datenmodell: er legt Zimmerzeilen an bzw. löscht sie. Wer mehr als
// die Anzahl pflegen will (Betten, Ausstattung, en suite), öffnet das Zimmer
// über seinen Namen — diese Ebene hat Lodgify an dieser Stelle nicht, wir
// brauchen sie für 0247/0248.
//
// Was davon zu den Portalen geht: nur die Ausstattung, und zwar als
// Vereinigungsmenge über alle Zimmer — der Aggregator kennt je Objekt genau
// einen Room-Type. Betten und die en-suite-Kopplung verwirft er (live gemessen,
// docs/CHANNEX-FELDER.md); sie bleiben lokal und auf myBestDays.

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import { Input } from "@nextdays/ui/input";
import { Label } from "@nextdays/ui/label";
import { NativeSelect } from "@nextdays/ui/native-select";
import { Switch } from "@nextdays/ui/switch";

import { BETT_ILLUSTRATION } from "@/components/objekte/bett-illustrationen";
import { EditorShell, Footer } from "@/components/objekte/editor-primitives";
import {
  addPropertyRoom,
  deletePropertyRoom,
  listPropertyRooms,
  updatePropertyRoom,
  type PropertyRoom,
} from "@/lib/properties";
import {
  BED_SLUGS,
  ROOM_AMENITY_SLUGS,
  ZIMMER_SLUGS,
} from "@/lib/property-meta";
import { useRoomAmenityLabels } from "@/lib/use-amenity-labels";
import { useRealtime } from "@/lib/use-realtime";

// Gleiche Listen wie im Service (BETT_RAUMTYPEN/ENSUITE_RAUMTYPEN): ein Bett im
// Badezimmer wäre ein Eingabefehler, kein Sonderfall. Der Server lehnt es mit
// 422 ab — die UI zeigt die Felder gar nicht erst an.
const BETT_RAUMTYPEN = new Set<string>([
  "schlafzimmer",
  "wohnzimmer",
  "schlafbereich",
]);
const ENSUITE_RAUMTYPEN = new Set<string>(["badezimmer", "wc"]);

// Obergrenze je Zimmertyp und Gruppe. Ohne Deckel macht eine getippte 999 aus
// einem Tastendreher 999 Inserts (Wurzel 8).
const MAX_JE_TYP = 20;

/** Zimmer eines Typs in einer Gruppe, in Anzeigereihenfolge. */
function zimmerVonTyp(
  alle: PropertyRoom[],
  raumTyp: string,
  privat: boolean,
): PropertyRoom[] {
  return alle
    .filter((r) => r.raum_typ === raumTyp && r.privat === privat)
    .sort((a, b) => a.position - b.position);
}

/** Trägt das Zimmer Angaben, die beim Löschen verloren gingen? */
function hatInhalt(r: PropertyRoom): boolean {
  return Boolean(
    r.name ||
      Object.values(r.betten).some((n) => n > 0) ||
      r.ausstattung.length ||
      r.en_suite,
  );
}

export function ZimmerSektion({ propertyId }: { propertyId: string }) {
  const t = useTranslations("objects");
  const tz = useTranslations("zimmer");
  const tb = useTranslations("beds");
  const [zimmer, setZimmer] = useState<PropertyRoom[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [offen, setOffen] = useState(false);

  const laden = useCallback(async () => {
    const res = await listPropertyRooms(propertyId);
    // Ein Ladefehler darf nicht als leere Liste erscheinen: "keine Zimmer" und
    // "konnte nicht laden" sind zwei verschiedene Aussagen (Wurzel 4).
    if (res.ok) {
      setZimmer(res.data.items);
      setFehler(null);
    } else {
      setZimmer(null);
      setFehler(res.error);
    }
  }, [propertyId]);

  useEffect(() => {
    void laden();
  }, [laden]);

  // Schlafplätze über alle Zimmer aufaddiert, in der Reihenfolge des
  // Bettenkatalogs (nicht alphabetisch — die gängigen Betten zuerst).
  const bettenSumme = BED_SLUGS.map(
    (slug) =>
      [
        slug,
        (zimmer ?? []).reduce((s, r) => s + (r.betten[slug] ?? 0), 0),
      ] as const,
  ).filter(([, anzahl]) => anzahl > 0);

  // Karte wie bei Lodgify: eine Zeile je Zimmertyp mit Anzahl und Gruppe
  // ("2 Schlafzimmer (privat)"), nicht eine Zeile je einzelnem Zimmer.
  const kartenZeilen = [true, false].flatMap((privat) =>
    ZIMMER_SLUGS.map((slug) => {
      const anzahl = zimmerVonTyp(zimmer ?? [], slug, privat).length;
      return { slug, privat, anzahl };
    }).filter((z) => z.anzahl > 0),
  );

  // Realtime statt manuellem Nachladen nach eigenen Aktionen.
  useRealtime({
    table: "property_rooms",
    filter: `property_id=eq.${propertyId}`,
    onChange: () => void laden(),
  });

  return (
    <>
      <Card className="flex flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-lg font-extrabold">
              {t("propertyOverview.roomsCardTitle")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("propertyOverview.roomsCardHint")}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("propertyOverview.editCardAriaLabel", {
              title: t("propertyOverview.roomsCardTitle"),
            })}
            onClick={() => setOffen(true)}
          >
            <Icon icon="ph:pencil-simple" className="size-4" />
          </Button>
        </div>

        {fehler ? (
          <div className="flex items-center gap-2 rounded-(--radius) border p-3 text-sm">
            <Icon icon="ph:warning" className="size-4 shrink-0" />
            <span className="flex-1">{fehler}</span>
            <Button variant="ghost" onClick={() => void laden()}>
              {t("propertyOverview.zimmerErneutLaden")}
            </Button>
          </div>
        ) : zimmer === null ? (
          <p className="text-sm text-muted-foreground">
            {t("propertyOverview.zimmerLaedt")}
          </p>
        ) : kartenZeilen.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("propertyOverview.noRooms")}
          </p>
        ) : (
          <ul className="flex flex-col gap-1 text-sm text-muted-foreground">
            {kartenZeilen.map(({ slug, privat, anzahl }) => (
              <li key={`${privat ? "p" : "g"}-${slug}`}>
                {anzahl > 1 ? `${anzahl} ` : ""}
                {tz(slug)} (
                {privat
                  ? t("propertyOverview.zimmerSuffixPrivat")
                  : t("propertyOverview.zimmerSuffixGemeinschaftlich")}
                )
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Schlafgelegenheiten sind die Summe über alle Zimmer — sie werden am
          Zimmer gepflegt (0247), nicht daneben. Eine zweite, objektweite
          Bettenliste wäre eine zweite Wahrheit über dieselbe Aussage. */}
      <Card className="flex flex-col gap-3 p-5">
        <div className="flex flex-col gap-1">
          <h2 className="font-display text-lg font-extrabold">
            {t("propertyOverview.bedsCardTitle")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("propertyOverview.bettenAusZimmern")}
          </p>
        </div>
        {zimmer === null ? null : bettenSumme.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("propertyOverview.noBeds")}
          </p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
            {bettenSumme.map(([slug, anzahl]) => {
              const Illustration = BETT_ILLUSTRATION[slug];
              return (
                <li key={slug} className="flex items-center gap-2">
                  {Illustration ? <Illustration className="size-4" /> : null}
                  <span>
                    {anzahl}× {tb(slug)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {offen ? (
        <ZimmerEditor
          propertyId={propertyId}
          zimmer={zimmer ?? []}
          onClose={() => setOffen(false)}
        />
      ) : null}
    </>
  );
}

/** Welche Ebene der Editor gerade zeigt. */
type Ansicht =
  | { art: "gruppen" }
  | { art: "liste"; raumTyp: string; privat: boolean }
  | { art: "detail"; id: string };

function ZimmerEditor({
  propertyId,
  zimmer,
  onClose,
}: {
  propertyId: string;
  zimmer: PropertyRoom[];
  onClose: () => void;
}) {
  const t = useTranslations("objects");
  const tz = useTranslations("zimmer");
  const [ansicht, setAnsicht] = useState<Ansicht>({ art: "gruppen" });
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const aktuell =
    ansicht.art === "detail"
      ? (zimmer.find((r) => r.id === ansicht.id) ?? null)
      : null;

  // Wurde das offene Zimmer gelöscht (auch von einem zweiten Gerät), zurück auf
  // die Gruppen statt auf einen leeren Detailbereich.
  useEffect(() => {
    if (ansicht.art === "detail" && !zimmer.some((r) => r.id === ansicht.id)) {
      setAnsicht({ art: "gruppen" });
    }
  }, [ansicht, zimmer]);

  // Zähler auf einen Zielwert bringen: die Differenz wird angelegt bzw.
  // gelöscht. Beim Löschen zuerst die leeren Zimmer — sonst risse ein Klick auf
  // „−" ein gepflegtes Zimmer samt Betten und Ausstattung mit (Wurzel 1).
  async function anzahlSetzen(
    raumTyp: string,
    privat: boolean,
    ziel: number,
  ): Promise<void> {
    const vorhanden = zimmerVonTyp(zimmer, raumTyp, privat);
    const gekappt = Math.max(0, Math.min(MAX_JE_TYP, ziel));
    if (gekappt === vorhanden.length) return;
    setBusy(true);
    setFehler(null);
    if (gekappt > vorhanden.length) {
      for (let i = vorhanden.length; i < gekappt; i += 1) {
        const res = await addPropertyRoom(propertyId, {
          raum_typ: raumTyp,
          privat,
        });
        if (!res.ok) {
          setFehler(res.error);
          break;
        }
      }
    } else {
      // Zuletzt angelegte zuerst, leere vor gepflegten.
      const reihenfolge = [...vorhanden]
        .reverse()
        .sort((a, b) => Number(hatInhalt(a)) - Number(hatInhalt(b)));
      for (const r of reihenfolge.slice(0, vorhanden.length - gekappt)) {
        const res = await deletePropertyRoom(propertyId, r.id);
        if (!res.ok) {
          setFehler(res.error);
          break;
        }
      }
    }
    setBusy(false);
    // Kein manuelles Nachladen — das Realtime-Abo der Sektion pflegt die Liste.
  }

  function oeffnen(raumTyp: string, privat: boolean): void {
    const vorhanden = zimmerVonTyp(zimmer, raumTyp, privat);
    if (vorhanden.length === 1) setAnsicht({ art: "detail", id: vorhanden[0].id });
    else if (vorhanden.length > 1) setAnsicht({ art: "liste", raumTyp, privat });
  }

  const titel =
    aktuell !== null
      ? aktuell.name || tz(aktuell.raum_typ)
      : ansicht.art === "liste"
        ? tz(ansicht.raumTyp)
        : t("propertyOverview.roomsEditorTitle");

  return (
    <EditorShell
      title={titel}
      subtitle={
        ansicht.art === "gruppen"
          ? t("propertyOverview.zimmerHinweis")
          : undefined
      }
      onClose={onClose}
      footer={
        ansicht.art === "gruppen" ? (
          <Footer
            busy={busy}
            error={fehler}
            onCancel={onClose}
            onSave={onClose}
            saveLabel={t("propertyOverview.zimmerFertig")}
          />
        ) : (
          <div className="flex w-full items-center gap-3">
            <Button
              variant="ghost"
              onClick={() =>
                setAnsicht(
                  aktuell && zimmerVonTyp(zimmer, aktuell.raum_typ, aktuell.privat).length > 1
                    ? {
                        art: "liste",
                        raumTyp: aktuell.raum_typ,
                        privat: aktuell.privat,
                      }
                    : { art: "gruppen" },
                )
              }
            >
              <Icon icon="ph:arrow-left" className="mr-2 size-4" />
              {t("propertyOverview.zimmerZurueck")}
            </Button>
            <Button className="ml-auto" onClick={onClose}>
              {t("propertyOverview.zimmerFertig")}
            </Button>
          </div>
        )
      }
    >
      {aktuell ? (
        <ZimmerDetail
          propertyId={propertyId}
          zimmer={aktuell}
          alleZimmer={zimmer}
        />
      ) : ansicht.art === "liste" ? (
        <ZimmerListe
          zimmer={zimmerVonTyp(zimmer, ansicht.raumTyp, ansicht.privat)}
          onOeffnen={(id) => setAnsicht({ art: "detail", id })}
        />
      ) : (
        <>
          <ZimmerGruppe
            icon="ph:user"
            titel={t("propertyOverview.zimmerPrivat")}
            privat
            alleZimmer={zimmer}
            busy={busy}
            onAnzahl={anzahlSetzen}
            onOeffnen={oeffnen}
          />
          <ZimmerGruppe
            icon="ph:users"
            titel={t("propertyOverview.zimmerGemeinschaftlich")}
            privat={false}
            alleZimmer={zimmer}
            busy={busy}
            onAnzahl={anzahlSetzen}
            onOeffnen={oeffnen}
          />
        </>
      )}
    </EditorShell>
  );
}

/** Eine aufklappbare Gruppe (privat / gemeinschaftlich) mit allen Zimmertypen. */
function ZimmerGruppe({
  icon,
  titel,
  privat,
  alleZimmer,
  busy,
  onAnzahl,
  onOeffnen,
}: {
  icon: string;
  titel: string;
  privat: boolean;
  alleZimmer: PropertyRoom[];
  busy: boolean;
  onAnzahl: (raumTyp: string, privat: boolean, ziel: number) => Promise<void>;
  onOeffnen: (raumTyp: string, privat: boolean) => void;
}) {
  // Gemeinschaftliche Zimmer sind der Sonderfall — zu wie bei Lodgify, außer es
  // steht schon etwas darin.
  const [offen, setOffen] = useState(
    privat || alleZimmer.some((r) => !r.privat),
  );

  return (
    <div className="flex flex-col border-b last:border-b-0">
      <button
        type="button"
        className="flex items-center gap-3 py-4 text-left"
        aria-expanded={offen}
        onClick={() => setOffen((o) => !o)}
      >
        <Icon icon={icon} className="size-5 text-muted-foreground" />
        <span className="flex-1 text-[0.9375rem] font-semibold">{titel}</span>
        <Icon
          icon={offen ? "ph:caret-up" : "ph:caret-down"}
          className="size-4 text-muted-foreground"
        />
      </button>

      {offen ? (
        <div className="flex flex-col pb-2">
          {ZIMMER_SLUGS.map((slug) => (
            <ZimmerZeile
              key={slug}
              raumTyp={slug}
              privat={privat}
              zimmer={zimmerVonTyp(alleZimmer, slug, privat)}
              busy={busy}
              onAnzahl={onAnzahl}
              onOeffnen={onOeffnen}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Eine Zeile: Zimmertyp links, Zähler „− Zahl +" rechts. */
function ZimmerZeile({
  raumTyp,
  privat,
  zimmer,
  busy,
  onAnzahl,
  onOeffnen,
}: {
  raumTyp: string;
  privat: boolean;
  zimmer: PropertyRoom[];
  busy: boolean;
  onAnzahl: (raumTyp: string, privat: boolean, ziel: number) => Promise<void>;
  onOeffnen: (raumTyp: string, privat: boolean) => void;
}) {
  const t = useTranslations("objects");
  const tz = useTranslations("zimmer");
  const anzahl = zimmer.length;
  // Getippte Zahl bis zum Verlassen des Feldes; erst dann wird angelegt oder
  // gelöscht. Sonst legte jeder Tastenanschlag Zimmer an.
  const [entwurf, setEntwurf] = useState<string | null>(null);

  function uebernehmen(): void {
    const wert = entwurf;
    setEntwurf(null);
    if (wert === null || wert === "") return;
    const ziel = Number.parseInt(wert, 10);
    if (Number.isNaN(ziel)) return;
    void onAnzahl(raumTyp, privat, ziel);
  }

  return (
    <div className="flex items-center gap-3 py-2.5">
      {anzahl > 0 ? (
        <button
          type="button"
          className="flex flex-1 items-center gap-1.5 text-left text-[0.9375rem]"
          onClick={() => onOeffnen(raumTyp, privat)}
        >
          {tz(raumTyp)}
          <Icon
            icon="ph:caret-right"
            className="size-3.5 shrink-0 text-muted-foreground"
            aria-label={t("propertyOverview.zimmerDetailsOeffnen", {
              room: tz(raumTyp),
            })}
          />
        </button>
      ) : (
        <span className="flex-1 text-[0.9375rem]">{tz(raumTyp)}</span>
      )}

      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="size-8 bg-secondary text-secondary-foreground disabled:opacity-40"
          disabled={anzahl === 0 || busy}
          aria-label={t("propertyOverview.zimmerVerringern", {
            room: tz(raumTyp),
          })}
          onClick={() => void onAnzahl(raumTyp, privat, anzahl - 1)}
        >
          <Icon icon="ph:minus" className="size-4" />
        </Button>
        <Input
          inputMode="numeric"
          className="h-8 w-12 px-1 text-center tabular-nums"
          aria-label={t("propertyOverview.zimmerAnzahl", { room: tz(raumTyp) })}
          disabled={busy}
          value={entwurf ?? String(anzahl)}
          onChange={(e) => setEntwurf(e.target.value.replace(/\D/g, ""))}
          onBlur={uebernehmen}
          onKeyDown={(e) => {
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
        <Button
          variant="ghost"
          size="icon"
          className="size-8 bg-secondary text-secondary-foreground disabled:opacity-40"
          disabled={anzahl >= MAX_JE_TYP || busy}
          aria-label={t("propertyOverview.zimmerErhoehen", {
            room: tz(raumTyp),
          })}
          onClick={() => void onAnzahl(raumTyp, privat, anzahl + 1)}
        >
          <Icon icon="ph:plus" className="size-4" />
        </Button>
      </div>
    </div>
  );
}

/** Die einzelnen Zimmer eines Typs — nur nötig, wenn es mehrere davon gibt. */
function ZimmerListe({
  zimmer,
  onOeffnen,
}: {
  zimmer: PropertyRoom[];
  onOeffnen: (id: string) => void;
}) {
  const t = useTranslations("objects");
  const tz = useTranslations("zimmer");
  return (
    <ul className="flex flex-col divide-y rounded-2xl border">
      {zimmer.map((r, i) => (
        <li key={r.id}>
          <button
            type="button"
            className="flex w-full items-center gap-3 px-5 py-4 text-left"
            onClick={() => onOeffnen(r.id)}
          >
            <span className="flex-1 text-[0.9375rem]">
              {r.name ||
                t("propertyOverview.zimmerNummeriert", {
                  room: tz(r.raum_typ),
                  index: i + 1,
                })}
            </span>
            <Icon
              icon="ph:caret-right"
              className="size-4 shrink-0 text-muted-foreground"
            />
          </button>
        </li>
      ))}
    </ul>
  );
}

function ZimmerDetail({
  propertyId,
  zimmer,
  alleZimmer,
}: {
  propertyId: string;
  zimmer: PropertyRoom;
  alleZimmer: PropertyRoom[];
}) {
  const t = useTranslations("objects");
  const tz = useTranslations("zimmer");
  const tb = useTranslations("beds");
  const { roomAmenityLabel } = useRoomAmenityLabels();
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const schlafzimmer = alleZimmer.filter(
    (r) => r.raum_typ === "schlafzimmer" && r.id !== zimmer.id,
  );

  async function speichern(
    input: Parameters<typeof updatePropertyRoom>[2],
  ): Promise<void> {
    setBusy(true);
    const res = await updatePropertyRoom(propertyId, zimmer.id, input);
    setBusy(false);
    setFehler(res.ok ? null : res.error);
  }

  async function loeschen(): Promise<void> {
    setBusy(true);
    const res = await deletePropertyRoom(propertyId, zimmer.id);
    setBusy(false);
    if (!res.ok) setFehler(res.error);
  }

  function bettSetzen(slug: string, delta: number) {
    const naechste = Math.max(0, (zimmer.betten[slug] ?? 0) + delta);
    const kopie = { ...zimmer.betten };
    if (naechste === 0) delete kopie[slug];
    else kopie[slug] = naechste;
    void speichern({ betten: kopie });
  }

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="zimmer-name">
          {t("propertyOverview.zimmerNameLabel")}
        </Label>
        <Input
          id="zimmer-name"
          defaultValue={zimmer.name ?? ""}
          placeholder={tz(zimmer.raum_typ)}
          onBlur={(e) => void speichern({ name: e.target.value || null })}
        />
        <p className="text-xs text-muted-foreground">
          {t("propertyOverview.zimmerNameHinweis")}
        </p>
      </div>

      <div className="flex items-center justify-between gap-4 rounded-2xl border p-4">
        <div className="flex flex-col gap-0.5">
          <span className="text-[0.9375rem] font-medium">
            {t("propertyOverview.zimmerPrivat")}
          </span>
          <span className="text-xs text-muted-foreground">
            {t("propertyOverview.zimmerPrivatHinweis")}
          </span>
        </div>
        <Switch
          checked={zimmer.privat}
          disabled={busy}
          onCheckedChange={(v) => void speichern({ privat: v })}
        />
      </div>

      {BETT_RAUMTYPEN.has(zimmer.raum_typ) ? (
        <div className="flex flex-col gap-2 rounded-2xl border p-4">
          <span className="text-[0.9375rem] font-medium">
            {t("propertyOverview.bedsCardTitle")}
          </span>
          <p className="text-xs text-muted-foreground">
            {t("propertyOverview.zimmerBettenHinweis")}
          </p>
          <div className="flex flex-col divide-y">
            {BED_SLUGS.map((slug) => {
              const anzahl = zimmer.betten[slug] ?? 0;
              const Illustration = BETT_ILLUSTRATION[slug];
              return (
                <div key={slug} className="flex items-center gap-3 py-2">
                  {Illustration ? <Illustration className="size-5" /> : null}
                  <span className="flex-1 text-[0.9375rem]">{tb(slug)}</span>
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 bg-secondary text-secondary-foreground disabled:opacity-40"
                      disabled={anzahl === 0 || busy}
                      aria-label={t("propertyOverview.bedsDecrease", { bed: tb(slug) })}
                      onClick={() => bettSetzen(slug, -1)}
                    >
                      <Icon icon="ph:minus" className="size-4" />
                    </Button>
                    <span className="w-5 text-center tabular-nums">
                      {anzahl}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 bg-secondary text-secondary-foreground"
                      disabled={busy}
                      aria-label={t("propertyOverview.bedsIncrease", { bed: tb(slug) })}
                      onClick={() => bettSetzen(slug, 1)}
                    >
                      <Icon icon="ph:plus" className="size-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* Eigene Ausstattung des Zimmers. Lodgify bietet sie für jeden Raumtyp
          außer dem Schlafbereich an — der ist nur eine Schlafecke, keine
          eigene Fläche mit eigener Ausstattung. */}
      {zimmer.raum_typ === "schlafbereich" ? null : (
        <div className="flex flex-col gap-2 rounded-2xl border p-4">
          <span className="text-[0.9375rem] font-medium">
            {t("propertyOverview.zimmerAusstattung")}
          </span>
          <p className="text-xs text-muted-foreground">
            {t("propertyOverview.zimmerAusstattungHinweis")}
          </p>
          <div className="flex flex-wrap gap-2">
            {ROOM_AMENITY_SLUGS.map((slug) => {
              const an = zimmer.ausstattung.includes(slug);
              return (
                <button
                  key={slug}
                  type="button"
                  disabled={busy}
                  aria-pressed={an}
                  onClick={() =>
                    void speichern({
                      ausstattung: an
                        ? zimmer.ausstattung.filter((x) => x !== slug)
                        : [...zimmer.ausstattung, slug],
                    })
                  }
                  className={
                    "rounded-full border px-3 py-1 text-xs " +
                    (an ? "bg-secondary text-secondary-foreground" : "")
                  }
                >
                  {roomAmenityLabel(slug)}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {ENSUITE_RAUMTYPEN.has(zimmer.raum_typ) ? (
        <div className="flex flex-col gap-3 rounded-2xl border p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-[0.9375rem] font-medium">
                {t("propertyOverview.zimmerEnSuite")}
              </span>
              <span className="text-xs text-muted-foreground">
                {t("propertyOverview.zimmerEnSuiteHinweis")}
              </span>
            </div>
            <Switch
              checked={zimmer.en_suite}
              disabled={busy}
              onCheckedChange={(v) => void speichern({ en_suite: v })}
            />
          </div>
          {zimmer.en_suite ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="zimmer-ensuite-ziel">
                {t("propertyOverview.zimmerEnSuiteZiel")}
              </Label>
              <NativeSelect
                id="zimmer-ensuite-ziel"
                value={zimmer.en_suite_schlafzimmer_id ?? ""}
                disabled={busy || schlafzimmer.length === 0}
                onChange={(e) =>
                  void speichern({
                    en_suite_schlafzimmer_id: e.target.value || null,
                  })
                }
              >
                <option value="">
                  {t("propertyOverview.zimmerEnSuiteOhneZiel")}
                </option>
                {schlafzimmer.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name || tz(r.raum_typ)}
                  </option>
                ))}
              </NativeSelect>
              {schlafzimmer.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {t("propertyOverview.zimmerEnSuiteKeinSchlafzimmer")}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      {fehler ? <p className="text-sm text-destructive">{fehler}</p> : null}

      <Button
        variant="ghost"
        className="self-start text-destructive"
        disabled={busy}
        onClick={() => void loeschen()}
      >
        <Icon icon="ph:trash" className="mr-2 size-4" />
        {t("propertyOverview.zimmerLoeschen")}
      </Button>
    </>
  );
}

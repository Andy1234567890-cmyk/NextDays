"use client";

// Zimmer und Schlafgelegenheiten eines Objekts.
//
// Beide Karten folgen der echten Lodgify-Oberfläche (live abgeglichen am
// 01.08.2026 unter /rental/{id}/overview, dasselbe Konto):
//
//   Zimmer              zwei Gruppen — Privat und Gemeinschaftlich —, darin
//                       JEDER Zimmertyp mit einem Zähler „− Zahl +". Kein
//                       Detail, kein Eigenname, keine Angaben je Zimmer.
//   Schlafgelegenheiten ein objektweiter Zähler je Bettentyp, eigener Editor.
//
// Der Zimmer-Zähler ist kein zweites Datenmodell: er legt Zeilen in
// property_rooms an bzw. löscht sie. Eine Zeile = ein Zimmer. Die Betten hängen
// dagegen am Objekt (properties.type_attributes.beds) — 0251 hat sie von den
// Zimmern dorthin zurückgeholt.
//
// An die Portale geht von alledem nichts: Channex verwirft am Room-Type beds,
// bed_configuration, bedrooms und bathrooms (live gemessen,
// docs/CHANNEX-FELDER.md). Die Angaben bleiben lokal und auf myBestDays.

import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useState } from "react";

import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import { Input } from "@nextdays/ui/input";

import { BETT_ILLUSTRATION } from "@/components/objekte/bett-illustrationen";
import { EditorShell, Footer } from "@/components/objekte/editor-primitives";
import {
  addPropertyRoom,
  deletePropertyRoom,
  listPropertyRooms,
  type PropertyRoom,
} from "@/lib/properties";
import { BED_SLUGS, ZIMMER_SLUGS } from "@/lib/property-meta";
import { useRealtime } from "@/lib/use-realtime";

// Obergrenze je Zimmertyp und Gruppe bzw. je Bettentyp. Ohne Deckel macht eine
// getippte 999 aus einem Tastendreher 999 Inserts (Wurzel 8).
const MAX_ANZAHL = 20;

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

export function ZimmerSektion({ propertyId }: { propertyId: string }) {
  const t = useTranslations("objects");
  const tz = useTranslations("zimmer");
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

  // Karte wie bei Lodgify: eine Zeile je Zimmertyp mit Anzahl und Gruppe
  // ("2 Schlafzimmer (privat)"), nicht eine Zeile je einzelnem Zimmer.
  const kartenZeilen = [true, false].flatMap((privat) =>
    ZIMMER_SLUGS.map((slug) => ({
      slug,
      privat,
      anzahl: zimmerVonTyp(zimmer ?? [], slug, privat).length,
    })).filter((z) => z.anzahl > 0),
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
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  // Zähler auf einen Zielwert bringen: die Differenz wird angelegt bzw.
  // gelöscht — beim Löschen die zuletzt angelegten zuerst.
  async function anzahlSetzen(
    raumTyp: string,
    privat: boolean,
    ziel: number,
  ): Promise<void> {
    const vorhanden = zimmerVonTyp(zimmer, raumTyp, privat);
    const gekappt = Math.max(0, Math.min(MAX_ANZAHL, ziel));
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
      for (const r of [...vorhanden].reverse().slice(0, vorhanden.length - gekappt)) {
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

  return (
    <EditorShell
      title={t("propertyOverview.roomsEditorTitle")}
      subtitle={t("propertyOverview.zimmerHinweis")}
      onClose={onClose}
      footer={
        <Footer
          busy={busy}
          error={fehler}
          onCancel={onClose}
          onSave={onClose}
          saveLabel={t("propertyOverview.zimmerFertig")}
        />
      }
    >
      <ZimmerGruppe
        icon="ph:user"
        titel={t("propertyOverview.zimmerPrivat")}
        privat
        alleZimmer={zimmer}
        busy={busy}
        onAnzahl={anzahlSetzen}
      />
      <ZimmerGruppe
        icon="ph:users"
        titel={t("propertyOverview.zimmerGemeinschaftlich")}
        privat={false}
        alleZimmer={zimmer}
        busy={busy}
        onAnzahl={anzahlSetzen}
      />
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
}: {
  icon: string;
  titel: string;
  privat: boolean;
  alleZimmer: PropertyRoom[];
  busy: boolean;
  onAnzahl: (raumTyp: string, privat: boolean, ziel: number) => Promise<void>;
}) {
  const tz = useTranslations("zimmer");
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
            <Zaehlzeile
              key={slug}
              label={tz(slug)}
              anzahl={zimmerVonTyp(alleZimmer, slug, privat).length}
              busy={busy}
              onSetzen={(ziel) => onAnzahl(slug, privat, ziel)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** Schlafgelegenheiten des Objekts: ein Zähler je Bettentyp (0251). */
export function BettenSektion({
  beds,
  onSave,
}: {
  beds: Record<string, number>;
  onSave: (beds: Record<string, number>) => Promise<true | string>;
}) {
  const t = useTranslations("objects");
  const tb = useTranslations("beds");
  const [offen, setOffen] = useState(false);

  const vorhanden = BED_SLUGS.map(
    (slug) => [slug, beds[slug] ?? 0] as const,
  ).filter(([, anzahl]) => anzahl > 0);

  return (
    <>
      <Card className="flex flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="font-display text-lg font-extrabold">
              {t("propertyOverview.bedsCardTitle")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("propertyOverview.bedsCardHint")}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("propertyOverview.editCardAriaLabel", {
              title: t("propertyOverview.bedsCardTitle"),
            })}
            onClick={() => setOffen(true)}
          >
            <Icon icon="ph:pencil-simple" className="size-4" />
          </Button>
        </div>

        {vorhanden.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {t("propertyOverview.noBeds")}
          </p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm text-muted-foreground">
            {vorhanden.map(([slug, anzahl]) => {
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
        <BettenEditor
          beds={beds}
          onClose={() => setOffen(false)}
          onSave={onSave}
        />
      ) : null}
    </>
  );
}

function BettenEditor({
  beds,
  onClose,
  onSave,
}: {
  beds: Record<string, number>;
  onClose: () => void;
  onSave: (beds: Record<string, number>) => Promise<true | string>;
}) {
  const t = useTranslations("objects");
  const tb = useTranslations("beds");
  // Der Editor arbeitet auf einem Entwurf und speichert am Stück — anders als
  // beim Zimmer-Zähler gibt es hier keine Zeile in der DB, die sofort entstünde.
  const [entwurf, setEntwurf] = useState<Record<string, number>>(beds);
  const [busy, setBusy] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  function setzen(slug: string, ziel: number): void {
    const gekappt = Math.max(0, Math.min(MAX_ANZAHL, ziel));
    setEntwurf((alt) => {
      const kopie = { ...alt };
      // 0 ist kein Bett, sondern die Abwesenheit eines Bettes — der Eintrag
      // fliegt raus, statt als „vorhanden" durch jede Zählung zu laufen.
      if (gekappt === 0) delete kopie[slug];
      else kopie[slug] = gekappt;
      return kopie;
    });
  }

  async function speichern(): Promise<void> {
    setBusy(true);
    setFehler(null);
    const res = await onSave(entwurf);
    setBusy(false);
    if (res === true) onClose();
    else setFehler(res);
  }

  return (
    <EditorShell
      title={t("propertyOverview.bedsEditorTitle")}
      subtitle={t("propertyOverview.bedsEditorHint")}
      onClose={onClose}
      footer={
        <Footer
          busy={busy}
          error={fehler}
          onCancel={onClose}
          onSave={() => void speichern()}
        />
      }
    >
      <p className="text-xs text-muted-foreground">
        {t("propertyOverview.zimmerBettenHinweis")}
      </p>
      <div className="flex flex-col">
        {BED_SLUGS.map((slug) => {
          const Illustration = BETT_ILLUSTRATION[slug];
          return (
            <Zaehlzeile
              key={slug}
              label={tb(slug)}
              icon={Illustration ? <Illustration className="size-5" /> : null}
              anzahl={entwurf[slug] ?? 0}
              busy={busy}
              onSetzen={async (ziel) => setzen(slug, ziel)}
            />
          );
        })}
      </div>
    </EditorShell>
  );
}

/** Eine Zeile „Label … − Zahl +". Gemeinsam für Zimmer und Betten. */
function Zaehlzeile({
  label,
  icon,
  anzahl,
  busy,
  onSetzen,
}: {
  label: string;
  icon?: React.ReactNode;
  anzahl: number;
  busy: boolean;
  onSetzen: (ziel: number) => Promise<void>;
}) {
  const t = useTranslations("objects");
  // Getippte Zahl bis zum Verlassen des Feldes; erst dann wird übernommen.
  // Sonst wirkte jeder Tastenanschlag sofort.
  const [entwurf, setEntwurf] = useState<string | null>(null);

  function uebernehmen(): void {
    const wert = entwurf;
    setEntwurf(null);
    if (wert === null || wert === "") return;
    const ziel = Number.parseInt(wert, 10);
    if (!Number.isNaN(ziel)) void onSetzen(ziel);
  }

  return (
    <div className="flex items-center gap-3 py-2.5">
      {icon}
      <span className="flex-1 text-[0.9375rem]">{label}</span>
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="size-8 bg-secondary text-secondary-foreground disabled:opacity-40"
          disabled={anzahl === 0 || busy}
          aria-label={t("propertyOverview.zimmerVerringern", { room: label })}
          onClick={() => void onSetzen(anzahl - 1)}
        >
          <Icon icon="ph:minus" className="size-4" />
        </Button>
        <Input
          inputMode="numeric"
          className="h-8 w-12 px-1 text-center tabular-nums"
          aria-label={t("propertyOverview.zimmerAnzahl", { room: label })}
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
          disabled={anzahl >= MAX_ANZAHL || busy}
          aria-label={t("propertyOverview.zimmerErhoehen", { room: label })}
          onClick={() => void onSetzen(anzahl + 1)}
        >
          <Icon icon="ph:plus" className="size-4" />
        </Button>
      </div>
    </div>
  );
}

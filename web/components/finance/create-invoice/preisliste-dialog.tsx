'use client';

// „Aus Preisliste" des Beleg-Editors (0698): Artikelstamm des Betriebs plus
// Zusatzleistungen seiner Objekte in EINER durchsuchbaren Liste, jede Zeile
// mit Basis (je Nacht, je Person …) und eigenem Steuersatz. Ersetzt „Aus
// Inventar hinzufügen" (Lagerartikel, sieben Pfade ins Leere) und „Leistung
// suchen oder neu erstellen" (Stub-Endpunkt, der nie speicherte).
// „Neu anlegen" schreibt in den Artikelstamm (POST /buchhaltung/items) — die
// Leistung steht danach in jedem weiteren Beleg zur Verfügung.
import { Icon } from '@iconify/react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
} from '@tasko/ui';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { api } from '@/lib/api-client';
import type {
  PreislisteDaten,
  PreislisteEintrag,
  PreislisteQuelle,
} from './use-preisliste';
import { formatCurrency } from '@/lib/currency';
import { POSITIONS_BASEN, type PositionsBasis, istPositionsBasis } from '@/lib/positions-basis';
import { NativeSelect } from '@nextdays/ui/native-select';

export type { PreislisteEintrag, PreislisteObjekt, PreislisteQuelle } from './use-preisliste';

// Reihenfolge und Überschriften der Gruppen — wie Hostaways „Prices & Fees".
const GRUPPEN: readonly PreislisteQuelle[] = ['gebuehr', 'zusatzleistung', 'abgabe', 'artikel'];

export type PreislisteUebernahme = {
  description: string;
  extendedDescription?: string;
  unitPrice: number;
  /** Prozent vom Übernachtungspreis — die Karte rechnet den Betrag aus den Aufenthaltszeilen. */
  percent: number | null;
  taxRate: number | null;
  basis: PositionsBasis;
  unit: string;
  quelleId: string;
  quelle: PreislisteQuelle;
  currency: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onUebernehmen: (eintrag: PreislisteUebernahme) => void;
  belegWaehrung?: string;
  /** Vorbelegter Steuersatz für neue Artikel (Regelsatz des Betriebs); null = leer lassen. */
  standardTaxRate: number | null;
  basisLabel: (basis: PositionsBasis) => string;
  /** Vorbelegter Suchbegriff (aus dem Suchfeld der Positionskarte). */
  vorgabeSuche?: string;
  /** Objekt, dessen Gebühren/Zusatzleistungen/Abgaben gezeigt werden; null = alle. */
  objektId: string | null;
  setObjektId: (id: string | null) => void;
  /** Geladene Preisliste (usePreisliste) — der Dialog lädt nicht selbst. */
  daten: PreislisteDaten;
  /** Nur diese Gruppe zeigen (z. B. 'abgabe' vom Knopf „Kurtaxe / Abgabe"). */
  gruppeFilter?: PreislisteQuelle | null;
};

type NeuerArtikel = {
  name: string;
  description: string;
  unitPrice: string;
  taxRate: string;
  basis: PositionsBasis;
  unit: string;
};

// Zustand und Aktionen des Dialogs — getrennt vom JSX, damit beide Teile lesbar bleiben.
function usePreislisteDialog({
  open,
  onClose,
  onUebernehmen,
  belegWaehrung,
  standardTaxRate,
  basisLabel,
  vorgabeSuche,
  daten,
  gruppeFilter,
}: Props) {
  const t = useTranslations('finance');
  const { objekte, eintraege, laden, fehler, laden_ } = daten;
  const [suche, setSuche] = useState('');
  const [neuOffen, setNeuOffen] = useState(false);
  const [speichern, setSpeichern] = useState(false);
  const leererArtikel = useMemo<NeuerArtikel>(
    () => ({
      name: '',
      description: '',
      unitPrice: '',
      taxRate: standardTaxRate === null ? '' : String(standardTaxRate),
      basis: 'per_unit',
      unit: '',
    }),
    [standardTaxRate],
  );
  const [neu, setNeu] = useState<NeuerArtikel>(leererArtikel);

  useEffect(() => {
    if (open) {
      void laden_();
      setSuche(vorgabeSuche ?? '');
      setNeuOffen(false);
      setNeu({ ...leererArtikel, name: vorgabeSuche ?? '' });
    }
  }, [open, laden_, vorgabeSuche, leererArtikel]);

  const gefiltert = useMemo(() => {
    const wort = suche.trim().toLowerCase();
    const liste = (eintraege ?? []).filter(e => !gruppeFilter || e.quelle === gruppeFilter);
    if (!wort) return liste;
    return liste.filter(e =>
      [e.name, e.description, e.category ?? '', e.propertyTitle ?? ''].some(f =>
        f.toLowerCase().includes(wort),
      ),
    );
  }, [eintraege, suche, gruppeFilter]);

  function uebernehmen(e: PreislisteEintrag) {
    onUebernehmen({
      description: e.name,
      extendedDescription: e.description || undefined,
      unitPrice: Number(e.unitPrice) || 0,
      percent: e.percent === null ? null : Number(e.percent),
      taxRate: e.taxRate === null ? null : Number(e.taxRate),
      basis: istPositionsBasis(e.basis) ? e.basis : 'per_unit',
      unit: e.unit,
      quelleId: e.id,
      quelle: e.quelle,
      currency: e.currency,
    });
    if (e.quelle === 'artikel') {
      // Nutzungszähler: best-effort, blockiert die Übernahme nicht.
      void api.post(`/api/v1/buchhaltung/items/${e.id}/used`).catch((err: unknown) => {
        console.warn('artikel_verwendung_nicht_gezaehlt', e.id, err);
      });
    }
    onClose();
  }

  async function neuAnlegen() {
    const preis = Number(neu.unitPrice);
    const satz = neu.taxRate.trim() === '' ? NaN : Number(neu.taxRate);
    if (!neu.name.trim() || !Number.isFinite(preis) || !Number.isFinite(satz)) {
      toast.error(t('preisliste.newIncomplete'));
      return;
    }
    setSpeichern(true);
    try {
      const angelegt = await api.post<PreislisteEintrag & { unitPrice: string; taxRate: string }>(
        '/api/v1/buchhaltung/items',
        {
          name: neu.name.trim(),
          description: neu.description.trim() || null,
          unit: neu.unit.trim() || basisLabel(neu.basis),
          basis: neu.basis,
          unitPrice: preis.toFixed(2),
          taxRate: satz.toFixed(2),
          currency: belegWaehrung || null,
        },
      );
      toast.success(t('preisliste.newSaved'));
      void laden_(true);
      onUebernehmen({
        description: neu.name.trim(),
        extendedDescription: neu.description.trim() || undefined,
        unitPrice: preis,
        percent: null,
        taxRate: satz,
        basis: neu.basis,
        unit: neu.unit.trim() || basisLabel(neu.basis),
        quelleId: angelegt?.id ?? '',
        quelle: 'artikel',
        currency: belegWaehrung || null,
      });
      onClose();
    } catch (err) {
      console.error('artikel_anlegen_fehlgeschlagen', err);
      toast.error(err instanceof Error ? err.message : t('preisliste.newError'));
    } finally {
      setSpeichern(false);
    }
  }

  return {
    t,
    eintraege,
    objekte,
    laden,
    fehler,
    suche,
    setSuche,
    neuOffen,
    setNeuOffen,
    speichern,
    neu,
    setNeu,
    laden_,
    gefiltert,
    uebernehmen,
    neuAnlegen,
  };
}

export function PreislisteDialog(props: Props) {
  const { open, onClose, belegWaehrung, basisLabel, objektId, setObjektId } = props;
  const {
    t,
    eintraege,
    objekte,
    laden,
    fehler,
    suche,
    setSuche,
    neuOffen,
    setNeuOffen,
    speichern,
    neu,
    setNeu,
    laden_,
    gefiltert,
    uebernehmen,
    neuAnlegen,
  } = usePreislisteDialog(props);
  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="flex max-h-[85vh] flex-col gap-3 sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('preisliste.title')}</DialogTitle>
          <DialogDescription>{t('preisliste.description')}</DialogDescription>
        </DialogHeader>

        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Icon
              icon="lucide:search"
              className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-gray-400"
            />
            <Input
              autoFocus
              value={suche}
              onChange={e => setSuche(e.target.value)}
              placeholder={t('preisliste.searchPlaceholder')}
              className="pl-9"
            />
          </div>
          <Button
            type="button"
            variant={neuOffen ? 'default' : 'outline'}
            className={neuOffen ? 'bg-accent text-white hover:bg-accent/90' : ''}
            onClick={() => {
              setNeuOffen(v => !v);
              setNeu(n => ({ ...n, name: n.name || suche.trim() }));
            }}
          >
            <Icon icon="lucide:plus" className="mr-1 h-4 w-4" />
            {t('preisliste.newButton')}
          </Button>
        </div>

        {neuOffen && (
          <NeuerArtikelFormular
            neu={neu}
            setNeu={setNeu}
            belegWaehrung={belegWaehrung}
            basisLabel={basisLabel}
            speichern={speichern}
            onAbbrechen={() => setNeuOffen(false)}
            onSpeichern={() => void neuAnlegen()}
          />
        )}

        {objekte.length > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <Label className="shrink-0 text-gray-600">{t('preisliste.property')}</Label>
            <NativeSelect
              value={objektId ?? ''}
              onChange={e => setObjektId(e.target.value || null)}
              aria-label={t('preisliste.property')}
            >
              <option value="">{t('preisliste.allProperties')}</option>
              {objekte.map(o => (
                <option key={o.id} value={o.id}>
                  {o.title}
                </option>
              ))}
            </NativeSelect>
          </div>
        )}

        <PreislisteListe
          laden={laden}
          fehler={fehler}
          eintraege={eintraege}
          gefiltert={gefiltert}
          belegWaehrung={belegWaehrung}
          basisLabel={basisLabel}
          onRetry={() => void laden_(true)}
          onUebernehmen={uebernehmen}
        />

        {!laden && !fehler && eintraege !== null && (
          <ObjektOhnePreiseHinweis
            objektId={objektId}
            eintraege={eintraege}
            gruppeFilter={props.gruppeFilter ?? null}
          />
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t('preisliste.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type FormularProps = {
  neu: NeuerArtikel;
  setNeu: (n: NeuerArtikel) => void;
  belegWaehrung?: string;
  basisLabel: (basis: PositionsBasis) => string;
  speichern: boolean;
  onAbbrechen: () => void;
  onSpeichern: () => void;
};

// Formular „Neu anlegen": schreibt in den Artikelstamm des Betriebs.
function NeuerArtikelFormular({
  neu,
  setNeu,
  belegWaehrung,
  basisLabel,
  speichern,
  onAbbrechen,
  onSpeichern,
}: FormularProps) {
  const t = useTranslations('finance');
  return (
          <div className="grid grid-cols-1 gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label className="text-sm">{t('preisliste.newName')}</Label>
              <Input value={neu.name} onChange={e => setNeu({ ...neu, name: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-sm">{t('preisliste.newDescription')}</Label>
              <Input
                value={neu.description}
                onChange={e => setNeu({ ...neu, description: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-sm">{t('preisliste.newBasis')}</Label>
              <NativeSelect
                value={neu.basis}
                onChange={e => setNeu({ ...neu, basis: e.target.value as PositionsBasis })}
              >
                {POSITIONS_BASEN.map(b => (
                  <option key={b} value={b}>
                    {basisLabel(b)}
                  </option>
                ))}
              </NativeSelect>
            </div>
            <div>
              <Label className="text-sm">{t('preisliste.newUnit')}</Label>
              <Input
                value={neu.unit}
                placeholder={basisLabel(neu.basis)}
                onChange={e => setNeu({ ...neu, unit: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-sm">
                {t('preisliste.newPrice')} {belegWaehrung ? `(${belegWaehrung})` : ''}
              </Label>
              <Input
                type="number"
                min={0}
                step="0.01"
                value={neu.unitPrice}
                onChange={e => setNeu({ ...neu, unitPrice: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-sm">{t('preisliste.newTaxRate')}</Label>
              <Input
                type="number"
                min={0}
                max={100}
                step="0.1"
                value={neu.taxRate}
                onChange={e => setNeu({ ...neu, taxRate: e.target.value })}
                className={neu.taxRate.trim() === '' ? 'border-red-400' : ''}
              />
            </div>
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => onAbbrechen()}>
                {t('preisliste.cancel')}
              </Button>
              <Button
                type="button"
                className="bg-accent text-white hover:bg-accent/90"
                disabled={speichern}
                onClick={onSpeichern}
              >
                {speichern ? t('preisliste.saving') : t('preisliste.saveAndAdd')}
              </Button>
            </div>
          </div>
  );
}

// Hinweis unter der Liste, wenn am gewählten Objekt nichts gepflegt ist, was
// die Liste zeigen könnte: Zusatzleistungen (Objekt → Zusatzleistungen) bzw.
// Gebühren und Abgaben (Objekt → Preise). Ohne diesen Hinweis sah der Dialog
// nur den Artikelstamm und niemand erkannte, WO die fehlenden Einträge
// entstehen (14.09.2026: Betrieb mit 11 Objekten, 0 Zusatzleistungen, keine
// Preiskonfiguration — die Liste wirkte defekt, war aber nur leer).
function ObjektOhnePreiseHinweis({
  objektId,
  eintraege,
  gruppeFilter,
}: {
  objektId: string | null;
  eintraege: PreislisteEintrag[];
  gruppeFilter: PreislisteQuelle | null;
}) {
  const t = useTranslations('finance');
  if (!objektId) return null;
  const vomObjekt = eintraege.filter(e => e.propertyId === objektId);
  const hatZusatz = vomObjekt.some(e => e.quelle === 'zusatzleistung');
  const hatPreise = vomObjekt.some(e => e.quelle === 'gebuehr' || e.quelle === 'abgabe');
  const zeigeZusatz = !hatZusatz && (gruppeFilter === null || gruppeFilter === 'zusatzleistung');
  const zeigePreise =
    !hatPreise && (gruppeFilter === null || gruppeFilter === 'gebuehr' || gruppeFilter === 'abgabe');
  if (!zeigeZusatz && !zeigePreise) return null;
  const linkKlasse = 'inline-flex items-center gap-1 font-medium text-accent hover:underline';
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900 text-xs">
      <Icon icon="lucide:info" className="h-3.5 w-3.5 shrink-0" />
      {zeigeZusatz && (
        <span>
          {t('preisliste.objektOhneZusatzleistungen')}{' '}
          <Link
            href={`/objekte/${objektId}/zusatzleistungen`}
            target="_blank"
            rel="noopener"
            className={linkKlasse}
          >
            {t('preisliste.zusatzleistungenAnlegen')}
            <Icon icon="lucide:external-link" className="h-3 w-3" />
          </Link>
        </span>
      )}
      {zeigePreise && (
        <span>
          {t('preisliste.objektOhneGebuehren')}{' '}
          <Link href={`/objekte/${objektId}/preise`} target="_blank" rel="noopener" className={linkKlasse}>
            {t('preisliste.gebuehrenAnlegen')}
            <Icon icon="lucide:external-link" className="h-3 w-3" />
          </Link>
        </span>
      )}
    </div>
  );
}

type ListeProps = {
  laden: boolean;
  fehler: string | null;
  eintraege: PreislisteEintrag[] | null;
  gefiltert: PreislisteEintrag[];
  belegWaehrung?: string;
  basisLabel: (basis: PositionsBasis) => string;
  onRetry: () => void;
  onUebernehmen: (e: PreislisteEintrag) => void;
};

// Trefferliste der Preisliste (Artikel + Zusatzleistungen).
function PreislisteListe({
  laden,
  fehler,
  eintraege,
  gefiltert,
  belegWaehrung,
  basisLabel,
  onRetry,
  onUebernehmen,
}: ListeProps) {
  const t = useTranslations('finance');
  return (
        <div className="min-h-40 flex-1 overflow-y-auto rounded-lg border border-gray-200">
          {laden ? (
            <div className="flex items-center justify-center gap-2 p-8 text-gray-500 text-sm">
              <Icon icon="lucide:loader-circle" className="h-4 w-4 animate-spin" />
              {t('preisliste.loading')}
            </div>
          ) : fehler ? (
            <div className="flex flex-col items-center gap-2 p-8 text-center text-red-600 text-sm">
              {fehler}
              <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                {t('preisliste.retry')}
              </Button>
            </div>
          ) : gefiltert.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              {eintraege && eintraege.length === 0
                ? t('preisliste.empty')
                : t('preisliste.noMatch')}
            </div>
          ) : (
            <div>
              {GRUPPEN.map(gruppe => {
                const zeilen = gefiltert.filter(e => e.quelle === gruppe);
                if (zeilen.length === 0) return null;
                return (
                  <div key={gruppe}>
                    <div className="sticky top-0 bg-gray-50 px-4 py-1.5 font-medium text-gray-600 text-xs uppercase tracking-wide">
                      {t(`preisliste.group.${gruppe}`)}
                    </div>
                    <ul className="divide-y divide-gray-100">
                      {zeilen.map(e => (
                        <PreislisteZeile
                          key={`${e.quelle}-${e.id}`}
                          e={e}
                          belegWaehrung={belegWaehrung}
                          basisLabel={basisLabel}
                          onUebernehmen={onUebernehmen}
                        />
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </div>
  );
}

type ZeileProps = {
  e: PreislisteEintrag;
  belegWaehrung?: string;
  basisLabel: (basis: PositionsBasis) => string;
  onUebernehmen: (e: PreislisteEintrag) => void;
};

type Uebersetzer = ReturnType<typeof useTranslations<'finance'>>;

// Untertitel einer Zeile: Basis/Prozent · USt · Herkunft (· optional).
function zeilenDetails(
  e: PreislisteEintrag,
  t: Uebersetzer,
  basisLabel: (basis: PositionsBasis) => string,
): string {
  const herkunft =
    e.propertyTitle && e.quelle !== 'artikel'
      ? e.propertyTitle
      : e.category || t('preisliste.fromCatalog');
  const details = [
    e.percent !== null
      ? t('preisliste.percentOfStay', { percent: Number(e.percent) })
      : basisLabel(e.basis),
    e.taxRate === null
      ? t('preisliste.taxMissing')
      : t('preisliste.taxRate', { rate: Number(e.taxRate) }),
    herkunft,
  ];
  if (e.quelle === 'gebuehr' && e.optional) details.push(t('preisliste.optionalFee'));
  return details.join(' · ');
}

// Eine Zeile der Preisliste: Name, Basis · USt · Herkunft, rechts Betrag oder Prozent.
function PreislisteZeile({ e, belegWaehrung, basisLabel, onUebernehmen }: ZeileProps) {
  const t = useTranslations('finance');
  const fremdWaehrung = !!belegWaehrung && !!e.currency && e.currency !== belegWaehrung;
  return (
    <li>
      <button
        type="button"
        onClick={() => onUebernehmen(e)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-gray-50"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 font-medium">
            {e.isFavorite && <Icon icon="lucide:star" className="h-3.5 w-3.5 text-accent" />}
            <span className="truncate">{e.name}</span>
          </div>
          <div className="truncate text-gray-500 text-xs">{zeilenDetails(e, t, basisLabel)}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="font-medium">
            {e.percent !== null
              ? `${Number(e.percent)} %`
              : formatCurrency(Number(e.unitPrice) || 0, e.currency || belegWaehrung || '')}
          </div>
          {fremdWaehrung && (
            <div className="text-amber-700 text-xs">
              {t('preisliste.foreignCurrency', { currency: e.currency ?? '' })}
            </div>
          )}
        </div>
      </button>
    </li>
  );
}

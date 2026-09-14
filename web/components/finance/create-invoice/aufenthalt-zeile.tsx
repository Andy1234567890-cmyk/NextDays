'use client';

// Die Übernachtungsposition IST der Aufenthalt (0702): statt Freitext, Basis
// und Menge stehen in der Zeile Objekt, Anreise, Abreise, Nächte und Preis je
// Nacht — dieselben Angaben, die Hostaway/Guesty an der Unterkunftszeile eines
// Angebots führen. Die Nächte sind gerechnet, nicht getippt; die Menge der
// Position folgt ihnen (items-card `mengenNachfuehren`).
//
// Rot wird nur, was wirklich falsch ist: fehlendes Objekt/Zeitraum erst, wenn
// die Zeile schon einen Preis trägt, ein Zeitraum sofort, wenn Abreise ≤
// Anreise. Leer bleibt leer — nichts wird erfunden (Wurzel 4).
//
// Personen stehen MIT auf der Zeile (14.09.2026): der Ratenplan-Preis hängt
// an der Belegung, und Kinderzeilen „je Person" brauchen die Zahl. Vorher lag
// sie nur im Belegkopf, stand dort bei einem frischen Angebot auf 0, und
// weder Preis noch Frühstücksmenge konnten folgen — ohne dass die Zeile
// zeigte, woran es lag. Der Wert ist der des Kopfes (ein Beleg, eine
// Personenzahl); 0 heißt „fehlt" und wird rot, wie der Steuersatz.

import { Icon } from '@iconify/react';
import type { ReactNode } from 'react';
import { Button, Input } from '@tasko/ui';
import { useTranslations } from 'next-intl';
import { NativeSelect } from '@nextdays/ui/native-select';

import { aufenthaltZustand } from '@/components/finance/create-invoice/aufenthalt-zeilen';
import type { PreislisteObjekt } from '@/components/finance/create-invoice/use-preisliste';
import type { QuoteItem } from '@/services/quoteService';

/** Spalten: Objekt · Anreise · Abreise · Personen · Nächte · Preis/Nacht · USt · [Rabatt] · Betrag · ✕ */
const RASTER =
  'grid grid-cols-2 gap-3 lg:grid-cols-[minmax(10rem,1fr)_8.5rem_8.5rem_4.5rem_4rem_7rem_4.5rem_6rem_2.25rem]';
const RASTER_RABATT =
  'grid grid-cols-2 gap-3 lg:grid-cols-[minmax(10rem,1fr)_8.5rem_8.5rem_4.5rem_4rem_7rem_4.5rem_4.5rem_6rem_2.25rem]';
const FEHLT = 'border-destructive bg-destructive/10 ring-1 ring-destructive/40';

function Feld({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1 block truncate text-muted-foreground text-xs">{label}</span>
      {children}
    </label>
  );
}

export type AufenthaltPatch = Pick<QuoteItem, 'propertyId' | 'checkIn' | 'checkOut'>;

export function AufenthaltZeile({
  item,
  objekte,
  personen,
  onPersonen,
  anzeigeArt,
  preisAnzeige,
  betragAnzeige,
  rabattAktiv,
  entfernenGesperrt,
  onAufenthalt,
  onPreis,
  onSteuer,
  onRabatt,
  onEntfernen,
}: {
  item: QuoteItem;
  objekte: readonly PreislisteObjekt[];
  /** Personen des Belegs (0 = fehlt). */
  personen: number;
  onPersonen: (n: number) => void;
  /** „Netto" / „Brutto" — Beschriftung des Preisfelds. */
  anzeigeArt: string;
  /** Preis je Nacht in der gewählten Darstellung (netto/brutto), gerundet. */
  preisAnzeige: number;
  /** Formatierter Zeilenbetrag in der gewählten Darstellung. */
  betragAnzeige: string;
  rabattAktiv: boolean;
  entfernenGesperrt: boolean;
  onAufenthalt: (patch: AufenthaltPatch) => void;
  onPreis: (wert: number) => void;
  /** `undefined` = Feld geleert (Satz fehlt, rot). */
  onSteuer: (wert: number | undefined) => void;
  onRabatt: (wert: number) => void;
  onEntfernen: () => void;
}) {
  const t = useTranslations('finance');
  const { naechte, verdreht, objektFehlt, zeitraumFehlt } = aufenthaltZustand(item);
  const zeitraumKlasse = zeitraumFehlt ? FEHLT : '';
  const zeitraumHinweis = verdreht ? t('itemsCard.zeitraumFehlt') : undefined;
  const anreise = item.checkIn ?? '';
  const patch = (teil: Partial<AufenthaltPatch>) =>
    onAufenthalt({
      propertyId: item.propertyId,
      checkIn: item.checkIn,
      checkOut: item.checkOut,
      ...teil,
    });

  return (
    <div className={`${rabattAktiv ? RASTER_RABATT : RASTER} items-end p-4`}>
      <div className="col-span-2 lg:col-span-1">
        <Feld label={t('itemsCard.objektLabel')}>
          <NativeSelect
            value={item.propertyId ?? ''}
            error={objektFehlt}
            className="h-9"
            onChange={e => patch({ propertyId: e.target.value || undefined })}
          >
            <option value="">{t('itemsCard.objektFehlt')}</option>
            {objekte.map(o => (
              <option key={o.id} value={o.id}>
                {o.title}
              </option>
            ))}
          </NativeSelect>
        </Feld>
      </div>
      <Feld label={t('itemsCard.anreiseLabel')}>
        <Input
          type="date"
          value={anreise}
          className={zeitraumKlasse}
          onChange={e => patch({ checkIn: e.target.value || undefined })}
        />
      </Feld>
      <Feld label={t('itemsCard.abreiseLabel')}>
        <Input
          type="date"
          min={anreise || undefined}
          value={item.checkOut ?? ''}
          className={zeitraumKlasse}
          onChange={e => patch({ checkOut: e.target.value || undefined })}
        />
      </Feld>
      <Feld label={t('itemsCard.personenLabel')}>
        <Input
          type="number"
          min={1}
          step={1}
          value={personen > 0 ? personen : ''}
          placeholder={personen > 0 ? undefined : t('itemsCard.taxMissingShort')}
          className={personen > 0 ? '' : FEHLT}
          title={personen > 0 ? undefined : t('itemsCard.personenFehltHint')}
          onChange={e => {
            const n = Math.floor(Number(e.target.value));
            onPersonen(Number.isFinite(n) && n > 0 ? n : 0);
          }}
        />
      </Feld>
      <Feld label={t('itemsCard.naechteLabel')}>
        <div
          className={`flex h-9 items-center rounded-md border border-input bg-muted/40 px-3 text-sm tabular-nums ${zeitraumKlasse}`}
          title={zeitraumHinweis}
        >
          {naechte || '–'}
        </div>
      </Feld>
      <AufenthaltBetraege
        item={item}
        anzeigeArt={anzeigeArt}
        preisAnzeige={preisAnzeige}
        betragAnzeige={betragAnzeige}
        rabattAktiv={rabattAktiv}
        entfernenGesperrt={entfernenGesperrt}
        onPreis={onPreis}
        onSteuer={onSteuer}
        onRabatt={onRabatt}
        onEntfernen={onEntfernen}
      />
    </div>
  );
}

/** 0–100 aus einem Zahlenfeld; `undefined`, wenn leer oder unlesbar. */
function prozent(roh: string): number | undefined {
  if (roh === '') return undefined;
  const v = parseFloat(roh);
  return Number.isFinite(v) ? Math.max(0, Math.min(100, v)) : undefined;
}

/** Preis je Nacht · USt · [Rabatt] · Betrag · ✕ — die rechte Hälfte der Aufenthaltszeile. */
function AufenthaltBetraege({
  item,
  anzeigeArt,
  preisAnzeige,
  betragAnzeige,
  rabattAktiv,
  entfernenGesperrt,
  onPreis,
  onSteuer,
  onRabatt,
  onEntfernen,
}: {
  item: QuoteItem;
  anzeigeArt: string;
  preisAnzeige: number;
  betragAnzeige: string;
  rabattAktiv: boolean;
  entfernenGesperrt: boolean;
  onPreis: (wert: number) => void;
  onSteuer: (wert: number | undefined) => void;
  onRabatt: (wert: number) => void;
  onEntfernen: () => void;
}) {
  const t = useTranslations('finance');
  const satzFehlt = item.taxRate === undefined || item.taxRate === null;
  return (
    <>
      <Feld
        label={`${t('itemsCard.preisJeNacht')} · ${anzeigeArt}`}
      >
        <Input
          type="number"
          min="0"
          step="0.01"
          value={Number.isFinite(preisAnzeige) ? preisAnzeige : 0}
          onChange={e => onPreis(parseFloat(e.target.value) || 0)}
        />
      </Feld>
      <Feld label={t('itemsCard.vatPercent')}>
        <Input
          type="number"
          min={0}
          max={100}
          step={0.1}
          value={satzFehlt ? '' : item.taxRate}
          placeholder={satzFehlt ? t('itemsCard.taxMissingShort') : undefined}
          className={satzFehlt ? FEHLT : ''}
          title={satzFehlt ? t('itemsCard.taxMissingHint') : undefined}
          onChange={e => {
            // Leer = Satz fehlt (rot); Unlesbares lässt den Satz stehen.
            const v = prozent(e.target.value);
            if (e.target.value === '' || v !== undefined) onSteuer(v);
          }}
        />
      </Feld>
      {rabattAktiv && (
        <Feld label={t('itemsCard.discountPercent')}>
          <Input
            type="number"
            min={0}
            max={100}
            step={0.1}
            value={item.discountPercent ?? 0}
            onChange={e => onRabatt(prozent(e.target.value) ?? 0)}
          />
        </Feld>
      )}
      <Feld label={t('itemsCard.columnAmount')}>
        <div className="flex h-9 items-center justify-end font-medium text-sm tabular-nums">
          {betragAnzeige}
        </div>
      </Feld>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onEntfernen}
        className="h-9 w-full text-destructive hover:bg-destructive/10"
        disabled={entfernenGesperrt}
        aria-label={t('itemsCard.removeItem')}
      >
        <Icon icon="lucide:x" className="h-4 w-4" />
      </Button>
    </>
  );
}

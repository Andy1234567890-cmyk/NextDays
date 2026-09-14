'use client';

// „+ Zusatzleistung" unter einer Aufenthaltsgruppe (0702).
//
// Angeboten wird AUSSCHLIESSLICH, was am Objekt der Zeile hinterlegt ist
// (Preisliste, Quelle `zusatzleistung` = `property_addons`) — kein Katalog des
// ganzen Betriebs, kein Freitext. Hat das Objekt nichts hinterlegt, gibt es
// keinen Knopf, der eine leere Liste öffnet (Attrappe), sondern einen Link
// dorthin, wo Zusatzleistungen angelegt werden (Objekt → Zusatzleistungen) —
// bis zum 14.09.2026 stand hier gar nichts, und niemand konnte sehen, WARUM
// keine Leistungen wählbar sind (Betrieb ohne einen einzigen Eintrag in
// `property_addons`). Mehrere Leistungen nacheinander wählen bleibt möglich:
// das Popover schließt nach der Auswahl nicht.
//
// Overlay aus DEMSELBEN Paket wie die übrigen Overlays dieser Karte
// (items-card nutzt @tasko/ui): zwei Radix-Kopien an einer Stelle lassen
// `body` auf `pointer-events: none` stehen, sobald sich beide überlagern.

import { Icon } from '@iconify/react';
import { Input, Popover, PopoverContent, PopoverTrigger } from '@tasko/ui';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';

import type { PreislisteEintrag } from '@/components/finance/create-invoice/use-preisliste';
import { formatCurrency } from '@/lib/currency';
import type { PositionsBasis } from '@/lib/positions-basis';

/** Ab so vielen Einträgen bekommt die Liste ein Suchfeld. */
const SUCHE_AB = 6;

export function ZusatzleistungAuswahl({
  eintraege,
  propertyId,
  belegWaehrung,
  basisLabel,
  onWaehlen,
}: {
  /** Bereits auf das Objekt der Zeile gefiltert; leer = Link zum Anlegen statt Knopf. */
  eintraege: readonly PreislisteEintrag[];
  /** Objekt der Zeile — Ziel des Anlege-Links, wenn nichts hinterlegt ist. */
  propertyId: string;
  belegWaehrung?: string;
  basisLabel: (basis: PositionsBasis) => string;
  onWaehlen: (eintrag: PreislisteEintrag) => void;
}) {
  const t = useTranslations('finance');
  const [offen, setOffen] = useState(false);
  const [suche, setSuche] = useState('');
  if (eintraege.length === 0) {
    return (
      <Link
        href={`/objekte/${propertyId}/zusatzleistungen`}
        target="_blank"
        rel="noopener"
        className="text-muted-foreground hover:text-accent"
        title={t('itemsCard.zusatzleistungAnlegenHinweis')}
      >
        <Icon icon="lucide:plus" className="mr-1 inline h-3.5 w-3.5" />
        {t('itemsCard.zusatzleistungAnlegen')}
        <Icon icon="lucide:external-link" className="ml-1 inline h-3 w-3" />
      </Link>
    );
  }
  const begriff = suche.trim().toLowerCase();
  const sichtbar = begriff
    ? eintraege.filter(
        e => e.name.toLowerCase().includes(begriff) || e.description.toLowerCase().includes(begriff),
      )
    : eintraege;
  return (
    <Popover
      open={offen}
      onOpenChange={o => {
        setOffen(o);
        if (!o) setSuche('');
      }}
    >
      <PopoverTrigger asChild>
        <button type="button" className="text-muted-foreground hover:text-accent">
          <Icon icon="lucide:plus" className="mr-1 inline h-3.5 w-3.5" />
          {t('itemsCard.zusatzleistungHinzufuegen')}
        </button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="start" className="w-80 p-0">
        {eintraege.length >= SUCHE_AB && (
          <div className="border-border border-b p-2">
            <Input
              autoFocus
              value={suche}
              onChange={e => setSuche(e.target.value)}
              placeholder={t('itemsCard.zusatzleistungSuche')}
              className="h-8 text-sm"
            />
          </div>
        )}
        <ul className="max-h-64 divide-y divide-border overflow-y-auto">
          {sichtbar.map(e => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => onWaehlen(e)}
                className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left hover:bg-muted"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-sm">{e.name}</span>
                  <span className="mt-0.5 inline-block rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
                    {basisLabel(e.basis)}
                  </span>
                </span>
                <span className="shrink-0 font-medium text-sm tabular-nums">
                  {formatCurrency(Number(e.unitPrice) || 0, e.currency || belegWaehrung || '')}
                </span>
              </button>
            </li>
          ))}
          {sichtbar.length === 0 && (
            <li className="px-3 py-3 text-muted-foreground text-sm">{t('itemsCard.zusatzleistungKeine')}</li>
          )}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

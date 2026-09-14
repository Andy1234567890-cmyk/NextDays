'use client';

// Aufenthalt bepreisen (0701): Objekt/Zimmer, Anreise–Abreise, Personen →
// der zentrale Preis-Resolver liefert Übernachtung, Gebühren, Zuschläge,
// Rabatte und Abgaben — dieselbe Rechnung wie Buchungsstrecke und Kalender-
// Angebot (Wurzel 3: kein von Hand getippter Übernachtungspreis mehr).
// Die Zeilen landen als Positionen im Beleg, Objekt und Zeitraum im Kopf.
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, Input, Label } from '@tasko/ui';
import { NativeSelect } from '@nextdays/ui/native-select';

import { usePreisliste } from '@/components/finance/create-invoice/use-preisliste';
import { formatCurrency } from '@/lib/currency';
import { type Quote, getQuote } from '@/lib/pricing';

export type AufenthaltErgebnis = {
  propertyId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  quote: Quote;
};

export function AufenthaltDialog({
  open,
  onClose,
  onUebernehmen,
  objektId,
  von,
  bis,
  personen,
  documentLanguage,
}: {
  open: boolean;
  onClose: () => void;
  onUebernehmen: (e: AufenthaltErgebnis) => void;
  objektId: string | null;
  von: string;
  bis: string;
  personen: number;
  documentLanguage?: string;
}) {
  const t = useTranslations('finance');
  const { objekte, laden_ } = usePreisliste(null, documentLanguage);
  const [objekt, setObjekt] = useState(objektId ?? '');
  const [checkIn, setCheckIn] = useState(von);
  const [checkOut, setCheckOut] = useState(bis);
  const [gaeste, setGaeste] = useState(personen > 0 ? personen : 2);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(false);

  useEffect(() => {
    if (open) void laden_();
  }, [open, laden_]);
  useEffect(() => {
    if (open) {
      setObjekt(objektId ?? '');
      setCheckIn(von);
      setCheckOut(bis);
      setGaeste(personen > 0 ? personen : 2);
      setQuote(null);
      setFehler(null);
    }
  }, [open, objektId, von, bis, personen]);

  // Vorschau, sobald alles gesetzt ist — derselbe Aufruf wie im Angebots-Assistenten.
  useEffect(() => {
    if (!open || !objekt || !checkIn || !checkOut || checkOut <= checkIn) {
      setQuote(null);
      return;
    }
    let aktuell = true;
    setLaedt(true);
    setFehler(null);
    getQuote({ property_id: objekt, check_in: checkIn, check_out: checkOut, guests: gaeste, channel: 'website' })
      .then(res => {
        if (!aktuell) return;
        if (res.ok) {
          setQuote(res.data);
          if (res.data.priceless) setFehler(t('itemsCard.aufenthalt.keinPreis'));
        } else {
          setQuote(null);
          setFehler(res.error);
        }
      })
      .finally(() => {
        if (aktuell) setLaedt(false);
      });
    return () => {
      aktuell = false;
    };
  }, [open, objekt, checkIn, checkOut, gaeste, t]);

  const bereit = !!quote && !quote.priceless && !laedt;
  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('itemsCard.aufenthalt.titel')}</DialogTitle>
          <DialogDescription>{t('itemsCard.aufenthalt.hinweis')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="aufenthalt-objekt">{t('itemsCard.aufenthalt.objekt')}</Label>
            <NativeSelect id="aufenthalt-objekt" value={objekt} onChange={e => setObjekt(e.target.value)}>
              <option value="">{t('generalInfoCard.propertyNone')}</option>
              {objekte.map(o => (
                <option key={o.id} value={o.id}>
                  {o.title}
                </option>
              ))}
            </NativeSelect>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="aufenthalt-von">{t('itemsCard.aufenthalt.anreise')}</Label>
              <Input id="aufenthalt-von" type="date" value={checkIn} onChange={e => setCheckIn(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="aufenthalt-bis">{t('itemsCard.aufenthalt.abreise')}</Label>
              <Input id="aufenthalt-bis" type="date" min={checkIn} value={checkOut} onChange={e => setCheckOut(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="aufenthalt-gaeste">{t('generalInfoCard.guests')}</Label>
              <Input
                id="aufenthalt-gaeste"
                type="number"
                min={1}
                value={gaeste}
                onChange={e => setGaeste(Math.max(Number(e.target.value) || 1, 1))}
              />
            </div>
          </div>
          <div className="rounded-(--radius) border bg-secondary/30 p-3 text-sm">
            {fehler && <p className="text-destructive">{fehler}</p>}
            {laedt && !fehler && <p className="text-muted-foreground">{t('itemsCard.aufenthalt.rechnet')}</p>}
            {quote && !quote.priceless && (
              <>
                <ul className="space-y-1">
                  {quote.lines.map((z, i) => (
                    <li key={`${z.label}-${i}`} className="flex justify-between gap-3">
                      <span className="text-muted-foreground">{z.label}</span>
                      <span>{formatCurrency(z.amount, quote.currency)}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex justify-between gap-3 border-t pt-2 font-semibold">
                  <span>{t('itemsCard.aufenthalt.gesamt', { naechte: quote.nights })}</span>
                  <span>{formatCurrency(quote.total, quote.currency)}</span>
                </div>
              </>
            )}
            {!quote && !laedt && !fehler && (
              <p className="text-muted-foreground">{t('itemsCard.aufenthalt.leer')}</p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('itemsCard.aufenthalt.abbrechen')}
          </Button>
          <Button
            disabled={!bereit}
            onClick={() =>
              quote && onUebernehmen({ propertyId: objekt, checkIn, checkOut, guests: gaeste, quote })
            }
          >
            {t('itemsCard.aufenthalt.uebernehmen')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

'use client';

// Untere Karten der Rechnungserstellung (aus create-invoice-page.tsx extrahiert):
// Fuß-Text, „Mehr Optionen" (Währung/Skonto/Steuerregel), Summen, Interne Notizen.
// Reine Darstellung — alle geteilten States kommen als Props aus dem Container;
// showDetailedOptions ist lokaler UI-State (lebte vorher im selben JSX-Block).

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
} from '@tasko/ui';
import { type Dispatch, type SetStateAction, useState } from 'react';
import FooterTextEditor from '@/components/finance/FooterTextEditor';
import { TaxRuleSelector } from '@/components/finance/TaxRuleSelector';
import { getAllCurrencies } from '@/data/currencies';
import type { CreateInvoiceFormData } from '@/types/formData';

// Währungen: alle ISO-4217 Codes mit lokalisierten Namen (deps-frei → Modul-Konstante)
const allCurrencies = getAllCurrencies('de-DE');

type SecondaryCardsProps = {
  uid: string;
  formData: CreateInvoiceFormData;
  setFormData: Dispatch<SetStateAction<CreateInvoiceFormData>>;
  showNet: boolean;
  taxRate: number;
  subtotal: number;
  vat: number;
  grandTotal: number;
  taxGrouped: Array<{ rate: number; netAmount: number; taxAmount: number }>;
  skontoEnabled: boolean;
  setSkontoEnabled: Dispatch<SetStateAction<boolean>>;
  skontoDays: number | undefined;
  setSkontoDays: Dispatch<SetStateAction<number | undefined>>;
  skontoPercentage: number | undefined;
  setSkontoPercentage: Dispatch<SetStateAction<number | undefined>>;
  skontoText: string;
  setSkontoText: Dispatch<SetStateAction<string>>;
  formatCurrency: (amount: number) => string;
};

export default function SecondaryCards({
  uid,
  formData,
  setFormData,
  showNet,
  taxRate,
  subtotal,
  vat,
  grandTotal,
  taxGrouped,
  skontoEnabled,
  setSkontoEnabled,
  skontoDays,
  setSkontoDays,
  skontoPercentage,
  setSkontoPercentage,
  skontoText,
  setSkontoText,
  formatCurrency,
}: SecondaryCardsProps) {
  // Lokaler UI-State: Ein-/Ausblenden der weiteren Optionen
  const [showDetailedOptions, setShowDetailedOptions] = useState(false);

  return (
    <>
      {/* Fuß-Text (unter Positionen) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">Fuß-Text</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="footerText">Fuß-Text mit Platzhaltern</Label>
          <FooterTextEditor
            value={formData.footerText}
            onChange={(html: string) => setFormData(prev => ({ ...prev, footerText: html }))}
            companyId={uid}
            objectType="INVOICE"
            textType="FOOT"
          />
        </CardContent>
      </Card>

      {/* Mehr Optionen */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Mehr Optionen</CardTitle>
            <Button
              type="button"
              variant="link"
              className="px-0 text-accent"
              onClick={() => setShowDetailedOptions(v => !v)}
            >
              {!showDetailedOptions
                ? 'Weitere Optionen einblenden'
                : 'Weitere Optionen ausblenden'}
            </Button>
          </div>
        </CardHeader>
        {showDetailedOptions && (
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Währung</Label>
                  <Select
                    value={formData.currency}
                    onValueChange={val => setFormData(prev => ({ ...prev, currency: val }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Bitte auswählen" />
                    </SelectTrigger>
                    <SelectContent
                      className="max-h-96 overflow-y-auto"
                      style={{ scrollbarGutter: 'stable' }}
                    >
                      {allCurrencies.map(c => (
                        <SelectItem key={c.code} value={c.code}>
                          {c.name} ({c.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Interne Kontaktperson</Label>
                  <Input
                    value={formData.internalContactPerson}
                    onChange={e =>
                      setFormData(p => ({ ...p, internalContactPerson: e.target.value }))
                    }
                    placeholder="Name der Kontaktperson"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Lieferbedingungen</Label>
                  <Input
                    value={formData.deliveryTerms}
                    onChange={e => setFormData(p => ({ ...p, deliveryTerms: e.target.value }))}
                    placeholder="z.B. Lieferung innerhalb von 14 Tagen"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Zahlungsbedingungen</Label>
                  <Input
                    value={formData.paymentTerms}
                    onChange={e => setFormData(p => ({ ...p, paymentTerms: e.target.value }))}
                    placeholder="z.B. 14 Tage netto"
                  />
                </div>

                {/* Skonto-Einstellungen */}
                <div className="space-y-2 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <Label className="font-medium">Skonto</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600 text-xs">aktivieren</span>
                      <Switch checked={skontoEnabled} onCheckedChange={setSkontoEnabled} />
                    </div>
                  </div>
                  {skontoEnabled && (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <div className="space-y-1">
                        <Label>Skontotage</Label>
                        <Input
                          type="number"
                          min={1}
                          value={skontoDays ?? ''}
                          onChange={e => {
                            const v = parseInt(e.target.value, 10);
                            setSkontoDays(Number.isFinite(v) ? Math.max(1, v) : undefined);
                          }}
                          placeholder="z.B. 10"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>Skonto %</Label>
                        <Input
                          type="number"
                          min={0}
                          step={0.1}
                          value={skontoPercentage ?? ''}
                          onChange={e => {
                            const v = parseFloat(e.target.value);
                            setSkontoPercentage(Number.isFinite(v) ? Math.max(0, v) : undefined);
                          }}
                          placeholder="z.B. 2"
                        />
                      </div>
                      <div className="space-y-1 md:col-span-1">
                        <Label>Text (optional)</Label>
                        <Input
                          value={skontoText}
                          onChange={e => setSkontoText(e.target.value)}
                          placeholder="Bei Zahlung binnen X Tagen Y% Skonto"
                        />
                      </div>
                    </div>
                  )}
                  {skontoEnabled && (
                    <div className="text-gray-500 text-xs">
                      Vorschau:{' '}
                      {skontoText?.trim() ||
                        (skontoDays && skontoPercentage
                          ? `Bei Zahlung binnen ${skontoDays} Tagen ${skontoPercentage}% Skonto`
                          : '—')}
                    </div>
                  )}
                </div>
              </div>

              {/* Umsatzsteuerregelung */}
              <div className="space-y-3">
                <Label className="font-semibold">Umsatzsteuerregelung</Label>

                <TaxRuleSelector
                  value={formData.taxRule}
                  onChange={value => setFormData(p => ({ ...p, taxRule: value }))}
                />
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Summen */}
      <Card>
        <CardHeader>
          <CardTitle>Summen</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm">
            <li className="flex justify-between border-b py-2">
              <span>Gesamtsumme Netto (inkl. Rabatte / Aufschläge)</span>
              <span>{formatCurrency(subtotal)}</span>
            </li>
            {!showNet && taxGrouped.length > 0
              ? // SevDesk-style: Show multiple tax rates
              taxGrouped
                .filter(tax => tax.taxAmount > 0)
                .map((tax, index) => (
                  <li key={index} className="flex justify-between border-b py-2">
                    <span>Umsatzsteuer {tax.rate}%</span>
                    <span>{formatCurrency(tax.taxAmount)}</span>
                  </li>
                ))
              : // Fallback: Single tax rate display
              !showNet &&
              taxRate > 0 && (
                <li className="flex justify-between border-b py-2">
                  <span>Umsatzsteuer {taxRate}%</span>
                  <span>{formatCurrency(vat)}</span>
                </li>
              )}
            <li className="flex justify-between py-2">
              <span className="font-semibold text-lg">
                {showNet ? 'Gesamt (Netto)' : 'Gesamt (Brutto)'}
              </span>
              <span className="font-semibold text-lg">
                {formatCurrency(showNet ? subtotal : grandTotal)}
              </span>
            </li>
          </ul>
        </CardContent>
      </Card>

      {/* Interne Notizen */}
      <Card>
        <CardHeader>
          <CardTitle>Interne Notizen</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={formData.notes}
            onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            placeholder="Interne Notizen (werden nicht im Angebot angezeigt)..."
            rows={3}
          />
        </CardContent>
      </Card>
    </>
  );
}

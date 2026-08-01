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
import { useLocale, useTranslations } from 'next-intl';
import { type Dispatch, type SetStateAction, useState, useMemo } from 'react';
import FooterTextEditor from '@/components/finance/FooterTextEditor';
import { TaxRuleSelector } from '@/components/finance/TaxRuleSelector';
import { getAllCurrencies } from '@/data/currencies';
import type { CreateInvoiceFormData } from '@/types/formData';


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
  const t = useTranslations('finance');
  const locale = useLocale();
  // Währungsnamen in der Sprache der Oberfläche (kein festes de-DE).
  const allCurrencies = useMemo(() => getAllCurrencies(locale), [locale]);

  return (
    <>
      {/* Fuß-Text (unter Positionen) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">{t('secondaryCards.footerText.title')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label htmlFor="footerText">{t('secondaryCards.footerText.label')}</Label>
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
            <CardTitle>{t('secondaryCards.moreOptions.title')}</CardTitle>
            <Button
              type="button"
              variant="link"
              className="px-0 text-accent"
              onClick={() => setShowDetailedOptions(v => !v)}
            >
              {!showDetailedOptions
                ? t('secondaryCards.moreOptions.show')
                : t('secondaryCards.moreOptions.hide')}
            </Button>
          </div>
        </CardHeader>
        {showDetailedOptions && (
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t('secondaryCards.moreOptions.currency')}</Label>
                  <Select
                    value={formData.currency}
                    onValueChange={val => setFormData(prev => ({ ...prev, currency: val }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('secondaryCards.moreOptions.pleaseSelect')} />
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
                  <Label>{t('secondaryCards.moreOptions.internalContactPerson')}</Label>
                  <Input
                    value={formData.internalContactPerson}
                    onChange={e =>
                      setFormData(p => ({ ...p, internalContactPerson: e.target.value }))
                    }
                    placeholder={t('secondaryCards.moreOptions.internalContactPersonPlaceholder')}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t('secondaryCards.moreOptions.deliveryTerms')}</Label>
                  <Input
                    value={formData.deliveryTerms}
                    onChange={e => setFormData(p => ({ ...p, deliveryTerms: e.target.value }))}
                    placeholder={t('secondaryCards.moreOptions.deliveryTermsPlaceholder')}
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t('secondaryCards.moreOptions.paymentTerms')}</Label>
                  <Input
                    value={formData.paymentTerms}
                    onChange={e => setFormData(p => ({ ...p, paymentTerms: e.target.value }))}
                    placeholder={t('secondaryCards.moreOptions.paymentTermsPlaceholder')}
                  />
                </div>

                {/* Skonto-Einstellungen */}
                <div className="space-y-2 border-t pt-4">
                  <div className="flex items-center justify-between">
                    <Label className="font-medium">{t('secondaryCards.skonto.title')}</Label>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600 text-xs">{t('secondaryCards.skonto.enable')}</span>
                      <Switch checked={skontoEnabled} onCheckedChange={setSkontoEnabled} />
                    </div>
                  </div>
                  {skontoEnabled && (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                      <div className="space-y-1">
                        <Label>{t('secondaryCards.skonto.days')}</Label>
                        <Input
                          type="number"
                          min={1}
                          value={skontoDays ?? ''}
                          onChange={e => {
                            const v = parseInt(e.target.value, 10);
                            setSkontoDays(Number.isFinite(v) ? Math.max(1, v) : undefined);
                          }}
                          placeholder={t('secondaryCards.skonto.daysPlaceholder')}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label>{t('secondaryCards.skonto.percentage')}</Label>
                        <Input
                          type="number"
                          min={0}
                          step={0.1}
                          value={skontoPercentage ?? ''}
                          onChange={e => {
                            const v = parseFloat(e.target.value);
                            setSkontoPercentage(Number.isFinite(v) ? Math.max(0, v) : undefined);
                          }}
                          placeholder={t('secondaryCards.skonto.percentagePlaceholder')}
                        />
                      </div>
                      <div className="space-y-1 md:col-span-1">
                        <Label>{t('secondaryCards.skonto.textLabel')}</Label>
                        <Input
                          value={skontoText}
                          onChange={e => setSkontoText(e.target.value)}
                          placeholder={t('secondaryCards.skonto.textPlaceholder')}
                        />
                      </div>
                    </div>
                  )}
                  {skontoEnabled && (
                    <div className="text-gray-500 text-xs">
                      {t('secondaryCards.skonto.previewLabel')}{' '}
                      {skontoText?.trim() ||
                        (skontoDays && skontoPercentage
                          ? t('secondaryCards.skonto.previewText', {
                              days: skontoDays,
                              percentage: skontoPercentage,
                            })
                          : '—')}
                    </div>
                  )}
                </div>
              </div>

              {/* Umsatzsteuerregelung */}
              <div className="space-y-3">
                <Label className="font-semibold">{t('secondaryCards.taxRule.title')}</Label>

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
          <CardTitle>{t('secondaryCards.totals.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm">
            <li className="flex justify-between border-b py-2">
              <span>{t('secondaryCards.totals.netTotal')}</span>
              <span>{formatCurrency(subtotal)}</span>
            </li>
            {!showNet && taxGrouped.length > 0
              ? // SevDesk-style: Show multiple tax rates
              taxGrouped
                .filter(tax => tax.taxAmount > 0)
                .map((tax, index) => (
                  <li key={index} className="flex justify-between border-b py-2">
                    <span>{t('secondaryCards.totals.vat', { rate: tax.rate })}</span>
                    <span>{formatCurrency(tax.taxAmount)}</span>
                  </li>
                ))
              : // Fallback: Single tax rate display
              !showNet &&
              taxRate > 0 && (
                <li className="flex justify-between border-b py-2">
                  <span>{t('secondaryCards.totals.vat', { rate: taxRate })}</span>
                  <span>{formatCurrency(vat)}</span>
                </li>
              )}
            <li className="flex justify-between py-2">
              <span className="font-semibold text-lg">
                {showNet
                  ? t('secondaryCards.totals.grandTotalNet')
                  : t('secondaryCards.totals.grandTotalGross')}
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
          <CardTitle>{t('secondaryCards.internalNotes.title')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={formData.notes}
            onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
            placeholder={t('secondaryCards.internalNotes.placeholder')}
            rows={3}
          />
        </CardContent>
      </Card>
    </>
  );
}

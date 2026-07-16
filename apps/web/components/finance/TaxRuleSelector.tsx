import { Icon } from '@iconify/react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@tasko/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { TaxRuleType } from '@/types/taxRules';

interface TaxRuleSelectorProps {
  value: TaxRuleType;
  onChange: (value: TaxRuleType) => void;
  className?: string;
}

export function TaxRuleSelector({ value, onChange, className }: TaxRuleSelectorProps) {
  const t = useTranslations('finance');
  const [taxDEOpen, setTaxDEOpen] = useState(true);
  const [taxEUOpen, setTaxEUOpen] = useState(false);
  const [taxNonEUOpen, setTaxNonEUOpen] = useState(false);

  return (
    <div className={className}>
      <div className="space-y-3">
        {/* In Deutschland */}
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <button
            type="button"
            className="flex w-full items-center justify-between bg-muted/30 px-3 py-2 transition hover:bg-muted/50"
            onClick={() => setTaxDEOpen(v => !v)}
          >
            <span className="font-medium text-sm">{t('TaxRuleSelector.groupDe')}</span>
            <Icon
              icon="lucide:chevron-down"
              className={`h-4 w-4 transition-transform ${taxDEOpen ? 'rotate-180' : ''}`}
            />
          </button>
          {taxDEOpen && (
            <div className="space-y-2 p-3">
              {[
                {
                  key: TaxRuleType.DE_TAXABLE,
                  label: t('TaxRuleSelector.deTaxableLabel'),
                  hint: t('TaxRuleSelector.deTaxableHint'),
                },
                {
                  key: TaxRuleType.DE_EXEMPT_4_USTG,
                  label: t('TaxRuleSelector.deExempt4UstgLabel'),
                  hint: t('TaxRuleSelector.deExempt4UstgHint'),
                },
                {
                  key: TaxRuleType.DE_REVERSE_13B,
                  label: t('TaxRuleSelector.deReverse13bLabel'),
                  hint: t('TaxRuleSelector.deReverse13bHint'),
                },
              ].map(opt => (
                <label
                  key={opt.key}
                  className={`flex items-center justify-between gap-3 rounded border p-2 ${
                    value === opt.key ? 'border-accent bg-accent/5' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="taxRule"
                      className="accent-accent"
                      checked={value === opt.key}
                      onChange={() => onChange(opt.key)}
                    />
                    <span>{opt.label}</span>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Icon icon="lucide:info" className="h-4 w-4 text-gray-500" />
                    </TooltipTrigger>
                    <TooltipContent>{opt.hint}</TooltipContent>
                  </Tooltip>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* EU */}
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <button
            type="button"
            className="flex w-full items-center justify-between bg-muted/30 px-3 py-2 transition hover:bg-muted/50"
            onClick={() => setTaxEUOpen(v => !v)}
          >
            <span className="font-medium text-sm">{t('TaxRuleSelector.groupEu')}</span>
            <Icon
              icon="lucide:chevron-down"
              className={`h-4 w-4 transition-transform ${taxEUOpen ? 'rotate-180' : ''}`}
            />
          </button>
          {taxEUOpen && (
            <div className="space-y-2 p-3">
              {[
                {
                  key: TaxRuleType.EU_REVERSE_18B,
                  label: t('TaxRuleSelector.euReverse18bLabel'),
                  hint: t('TaxRuleSelector.euReverse18bHint'),
                },
                {
                  key: TaxRuleType.EU_INTRACOMMUNITY_SUPPLY,
                  label: t('TaxRuleSelector.euIntracommunitySupplyLabel'),
                  hint: t('TaxRuleSelector.euIntracommunitySupplyHint'),
                },
                {
                  key: TaxRuleType.EU_OSS,
                  label: t('TaxRuleSelector.euOssLabel'),
                  hint: t('TaxRuleSelector.euOssHint'),
                },
              ].map(opt => (
                <label
                  key={opt.key}
                  className={`flex items-center justify-between gap-3 rounded border p-2 ${
                    value === opt.key ? 'border-accent bg-accent/5' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="taxRule"
                      className="accent-accent"
                      checked={value === opt.key}
                      onChange={() => onChange(opt.key)}
                    />
                    <span>{opt.label}</span>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Icon icon="lucide:info" className="h-4 w-4 text-gray-500" />
                    </TooltipTrigger>
                    <TooltipContent>{opt.hint}</TooltipContent>
                  </Tooltip>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Außerhalb der EU */}
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <button
            type="button"
            className="flex w-full items-center justify-between bg-muted/30 px-3 py-2 transition hover:bg-muted/50"
            onClick={() => setTaxNonEUOpen(v => !v)}
          >
            <span className="font-medium text-sm">{t('TaxRuleSelector.groupNonEu')}</span>
            <Icon
              icon="lucide:chevron-down"
              className={`h-4 w-4 transition-transform ${taxNonEUOpen ? 'rotate-180' : ''}`}
            />
          </button>
          {taxNonEUOpen && (
            <div className="space-y-2 p-3">
              {[
                {
                  key: TaxRuleType.NON_EU_EXPORT,
                  label: t('TaxRuleSelector.nonEuExportLabel'),
                  hint: t('TaxRuleSelector.nonEuExportHint'),
                },
                {
                  key: TaxRuleType.NON_EU_OUT_OF_SCOPE,
                  label: t('TaxRuleSelector.nonEuOutOfScopeLabel'),
                  hint: t('TaxRuleSelector.nonEuOutOfScopeHint'),
                },
              ].map(opt => (
                <label
                  key={opt.key}
                  className={`flex items-center justify-between gap-3 rounded border p-2 ${
                    value === opt.key ? 'border-accent bg-accent/5' : 'border-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="taxRule"
                      className="accent-accent"
                      checked={value === opt.key}
                      onChange={() => onChange(opt.key)}
                    />
                    <span>{opt.label}</span>
                  </div>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Icon icon="lucide:info" className="h-4 w-4 text-gray-500" />
                    </TooltipTrigger>
                    <TooltipContent>{opt.hint}</TooltipContent>
                  </Tooltip>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="text-gray-500 text-xs">{t('TaxRuleSelector.footnote')}</div>
      </div>
    </div>
  );
}

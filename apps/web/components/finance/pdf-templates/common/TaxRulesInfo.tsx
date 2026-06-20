import type React from 'react';
import { useDocumentTranslation } from '@/hooks/pdf/useDocumentTranslation';
import type { ProcessedPDFData } from '@/hooks/pdf/usePDFTemplateData';

interface TaxRulesInfoProps {
  data: ProcessedPDFData;
  color: string;
  language?: string;
}

export const TaxRulesInfo: React.FC<TaxRulesInfoProps> = ({
  data,
  color: _color,
  language = 'de',
}) => {
  const { t } = useDocumentTranslation(language);
  if (!data.taxRule) return null;

  const taxRuleLabels = {
    de: {
      DE_TAXABLE:
        'Steuerpflichtiger Umsatz (Regelsteuersatz 19 %, § 1 Abs. 1 Nr. 1 i.V.m. § 12 Abs. 1 UStG)',
      DE_TAXABLE_REDUCED: 'Steuerpflichtiger Umsatz (ermäßigter Steuersatz 7 %, § 12 Abs. 2 UStG)',
      DE_EXEMPT_4_USTG: 'Steuerfreie Lieferung/Leistung gemäß § 4 UStG',
      DE_REVERSE_13B: 'Reverse-Charge – Steuerschuldnerschaft des Leistungsempfängers (§ 13b UStG)',
      EU_REVERSE_18B:
        'Reverse-Charge – Steuerschuldnerschaft des Leistungsempfängers (Art. 196 MwStSystRL, § 18b UStG)',
      EU_INTRACOMMUNITY_SUPPLY:
        'Innergemeinschaftliche Lieferung, steuerfrei gemäß § 4 Nr. 1b i.V.m. § 6a UStG',
      EU_OSS: 'Fernverkauf über das OSS-Verfahren (§ 18j UStG)',
      NON_EU_EXPORT: 'Steuerfreie Ausfuhrlieferung (§ 4 Nr. 1a i.V.m. § 6 UStG)',
      NON_EU_OUT_OF_SCOPE:
        'Nicht im Inland steuerbare Leistung (Leistungsort außerhalb Deutschlands, § 3a Abs. 2 UStG)',
    },
    en: {
      DE_TAXABLE:
        'Taxable revenue (standard rate 19%, § 1 para. 1 no. 1 in conjunction with § 12 para. 1 VAT Act)',
      DE_TAXABLE_REDUCED: 'Taxable revenue (reduced rate 7%, § 12 para. 2 VAT Act)',
      DE_EXEMPT_4_USTG: 'Tax-exempt delivery/service according to § 4 VAT Act',
      DE_REVERSE_13B: 'Reverse charge – Tax liability of the service recipient (§ 13b VAT Act)',
      EU_REVERSE_18B:
        'Reverse charge – Tax liability of the service recipient (Art. 196 VAT Directive, § 18b VAT Act)',
      EU_INTRACOMMUNITY_SUPPLY:
        'Intra-Community supply, tax-exempt according to § 4 No. 1b in conjunction with § 6a VAT Act',
      EU_OSS: 'Distance selling via OSS procedure (§ 18j VAT Act)',
      NON_EU_EXPORT: 'Tax-exempt export delivery (§ 4 No. 1a in conjunction with § 6 VAT Act)',
      NON_EU_OUT_OF_SCOPE:
        'Service not taxable in Germany (place of service outside Germany, § 3a para. 2 VAT Act)',
    },
  };

  return (
    <div className="p-3">
      <div className="mb-1 font-semibold text-gray-800 text-sm">{t('taxTreatment')}:</div>
      <div className="text-gray-700 text-xs">
        {taxRuleLabels[language as keyof typeof taxRuleLabels]?.[
          data.taxRule as keyof typeof taxRuleLabels.de
        ] ||
          taxRuleLabels.de?.[data.taxRule as keyof typeof taxRuleLabels.de] ||
          data.taxRule}
      </div>
    </div>
  );
};

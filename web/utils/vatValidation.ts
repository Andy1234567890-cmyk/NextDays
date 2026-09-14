/**
 * VAT Number Validation Utiliti
 * Validates VAT numbers for EU countries
 */

export interface VATValidationResult {
  isValid: boolean;
  country: string;
  message: string;
}

// VAT number patterns for different countries
const VAT_PATTERNS: Record<string, RegExp> = {
  // Europa
  DE: /^DE[0-9]{9}$/, // Deutschland
  AT: /^ATU[0-9]{8}$/, // Österreich
  CH: /^CHE[0-9]{9}(MWST|TVA|IVA)?$/, // Schweiz
  NL: /^NL[0-9]{9}B[0-9]{2}$/, // Niederlande
  BE: /^BE[0-9]{10}$/, // Belgien
  FR: /^FR[0-9A-Z]{2}[0-9]{9}$/, // Frankreich
  IT: /^IT[0-9]{11}$/, // Italien
  ES: /^ES[0-9A-Z][0-9]{7}[0-9A-Z]$/, // Spanien
  PL: /^PL[0-9]{10}$/, // Polen
  CZ: /^CZ[0-9]{8,10}$/, // Tschechien
  SK: /^SK[0-9]{10}$/, // Slowakei
  HU: /^HU[0-9]{8}$/, // Ungarn
  SI: /^SI[0-9]{8}$/, // Slowenien
  HR: /^HR[0-9]{11}$/, // Kroatien
  RO: /^RO[0-9]{2,10}$/, // Rumänien
  BG: /^BG[0-9]{9,10}$/, // Bulgarien
  LT: /^LT[0-9]{9}([0-9]{3})?$/, // Litauen
  LV: /^LV[0-9]{11}$/, // Lettland
  EE: /^EE[0-9]{9}$/, // Estland
  FI: /^FI[0-9]{8}$/, // Finnland
  SE: /^SE[0-9]{12}$/, // Schweden
  DK: /^DK[0-9]{8}$/, // Dänemark
  NO: /^NO[0-9]{9}(MVA)?$/, // Norwegen
  IS: /^IS[0-9]{5,6}$/, // Island
  GB: /^GB([0-9]{9}([0-9]{3})?|[0-9]{12})$/, // Großbritannien
  IE: /^IE([0-9]{7}[A-Z]{1,2}|[0-9]S[0-9]{5}L)$/, // Irland - verschiedene Formate
  PT: /^PT[0-9]{9}$/, // Portugal
  GR: /^(EL|GR)[0-9]{9}$/, // Griechenland
  MT: /^MT[0-9]{8}$/, // Malta
  CY: /^CY[0-9]{8}L$/, // Zypern
  LU: /^LU[0-9]{8}$/, // Luxemburg

  // Nordamerika
  US: /^[0-9]{2}[0-9]{7}$/, // USA (Federal Tax ID)
  CA: /^[0-9]{9}(RT[0-9]{4})?$/, // Kanada (GST/HST)
  MX: /^[A-Z&Ñ]{3,4}[0-9]{6}[A-Z0-9]{3}$/, // Mexiko (RFC)

  // Asien-Pazifik
  AU: /^[0-9]{11}$/, // Australien (ABN)
  NZ: /^[0-9]{8,9}$/, // Neuseeland (GST)
  JP: /^T[0-9]{13}$/, // Japan
  SG: /^[0-9]{8}[A-Z]$/, // Singapur (GST)
  HK: /^[0-9]{8}$/, // Hongkong
  IN: /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][0-9][A-Z][0-9]$/, // Indien (GSTIN)
  MY: /^[0-9]{12}$/, // Malaysia (GST)
  TH: /^[0-9]{13}$/, // Thailand
  PH: /^[0-9]{12}$/, // Philippinen
  ID: /^[0-9]{15}$/, // Indonesien (NPWP)
  KR: /^[0-9]{10}$/, // Südkorea
  TW: /^[0-9]{8}$/, // Taiwan

  // Südamerika
  BR: /^[0-9]{2}[0-9]{3}[0-9]{3}[0-9]{4}[0-9]{2}$/, // Brasilien (CNPJ)
  AR: /^[0-9]{11}$/, // Argentinien (CUIT)
  CL: /^[0-9]{8}[0-9K]$/, // Chile (RUT)
  CO: /^[0-9]{9,10}$/, // Kolumbien (NIT)
  PE: /^[0-9]{11}$/, // Peru (RUC)
  UY: /^[0-9]{12}$/, // Uruguay (RUT)

  // Afrika & Naher Osten
  ZA: /^[0-9]{10}$/, // Südafrika (VAT)
  AE: /^[0-9]{15}$/, // VAE (TRN)
  SA: /^[0-9]{15}$/, // Saudi-Arabien
  IL: /^[0-9]{9}$/, // Israel
  TR: /^[0-9]{10}$/, // Türkei (VKN)
  EG: /^[0-9]{9}$/, // Ägypten

  // Andere
  RU: /^[0-9]{10}([0-9]{2})?$/, // Russland (INN)
  CN: /^[0-9A-Z]{15,20}$/, // China (Tax ID)
};

const COUNTRY_NAMES: Record<string, string> = {
  // Europa
  DE: 'Deutschland',
  AT: 'Österreich',
  CH: 'Schweiz',
  NL: 'Niederlande',
  BE: 'Belgien',
  FR: 'Frankreich',
  IT: 'Italien',
  ES: 'Spanien',
  PL: 'Polen',
  CZ: 'Tschechien',
  SK: 'Slowakei',
  HU: 'Ungarn',
  SI: 'Slowenien',
  HR: 'Kroatien',
  RO: 'Rumänien',
  BG: 'Bulgarien',
  LT: 'Litauen',
  LV: 'Lettland',
  EE: 'Estland',
  FI: 'Finnland',
  SE: 'Schweden',
  DK: 'Dänemark',
  NO: 'Norwegen',
  IS: 'Island',
  GB: 'Großbritannien',
  IE: 'Irland',
  PT: 'Portugal',
  GR: 'Griechenland',
  MT: 'Malta',
  CY: 'Zypern',
  LU: 'Luxemburg',

  // Nordamerika
  US: 'USA',
  CA: 'Kanada',
  MX: 'Mexiko',

  // Asien-Pazifik
  AU: 'Australien',
  NZ: 'Neuseeland',
  JP: 'Japan',
  SG: 'Singapur',
  HK: 'Hongkong',
  IN: 'Indien',
  MY: 'Malaysia',
  TH: 'Thailand',
  PH: 'Philippinen',
  ID: 'Indonesien',
  KR: 'Südkorea',
  TW: 'Taiwan',

  // Südamerika
  BR: 'Brasilien',
  AR: 'Argentinien',
  CL: 'Chile',
  CO: 'Kolumbien',
  PE: 'Peru',
  UY: 'Uruguay',

  // Afrika & Naher Osten
  ZA: 'Südafrika',
  AE: 'VAE',
  SA: 'Saudi-Arabien',
  IL: 'Israel',
  TR: 'Türkei',
  EG: 'Ägypten',

  // Andere
  RU: 'Russland',
  CN: 'China',
};

/**
 * Validates a VAT number format
 */
export function validateVATNumber(vatNumber: string): VATValidationResult {
  if (!vatNumber) {
    return {
      isValid: false,
      country: '',
      message: 'VAT-Nummer ist erforderlich',
    };
  }

  // Remove spaces and convert to uppercase
  const cleanVat = vatNumber.replace(/\s/g, '').toUpperCase();

  // Extract country code (first 2 characters)
  const countryCode = cleanVat.substring(0, 2);

  if (!VAT_PATTERNS[countryCode]) {
    return {
      isValid: false,
      country: countryCode,
      message: `Unbekanntes Länderformat: ${countryCode}`,
    };
  }

  const pattern = VAT_PATTERNS[countryCode];
  const isValid = pattern.test(cleanVat);

  return {
    isValid,
    country: COUNTRY_NAMES[countryCode] || countryCode,
    message: isValid
      ? `Gültiges ${COUNTRY_NAMES[countryCode]} VAT-Format`
      : `Ungültiges ${COUNTRY_NAMES[countryCode]} VAT-Format`,
  };
}

/**
 * Gets the expected VAT format for a country
 */
export function getVATFormat(countryName: string): string {
  const formats: Record<string, string> = {
    // Europa
    Deutschland: 'DE + 9 Ziffern (z.B. DE123456789)',
    Österreich: 'ATU + 8 Ziffern (z.B. ATU12345678)',
    Schweiz: 'CHE + 9 Ziffern (z.B. CHE123456789)',
    Niederlande: 'NL + 9 Ziffern + B + 2 Ziffern (z.B. NL123456789B01)',
    Belgien: 'BE + 10 Ziffern (z.B. BE1234567890)',
    Frankreich: 'FR + 2 Zeichen + 9 Ziffern (z.B. FR12345678901)',
    Italien: 'IT + 11 Ziffern (z.B. IT12345678901)',
    Spanien: 'ES + 1 Zeichen + 7 Ziffern + 1 Zeichen (z.B. ESA12345674)',
    Polen: 'PL + 10 Ziffern (z.B. PL1234567890)',
    Tschechien: 'CZ + 8-10 Ziffern (z.B. CZ12345678)',
    Slowakei: 'SK + 10 Ziffern (z.B. SK1234567890)',
    Ungarn: 'HU + 8 Ziffern (z.B. HU12345678)',
    Großbritannien: 'GB + 9 oder 12 Ziffern (z.B. GB123456789)',
    Irland: 'IE + 7 Ziffern + 1-2 Buchstaben (z.B. IE3668997OH)',
    Norwegen: 'NO + 9 Ziffern + MVA (z.B. NO123456789MVA)',

    // Nordamerika
    USA: 'XX-XXXXXXX (z.B. 12-3456789)',
    Kanada: '9 Ziffern + RT#### (z.B. 123456789RT0001)',
    Mexiko: 'RFC Format (z.B. ABC123456789)',

    // Asien-Pazifik
    Australien: '11 Ziffern ABN (z.B. 12345678901)',
    Neuseeland: '8-9 Ziffern GST (z.B. 123456789)',
    Japan: 'T + 13 Ziffern (z.B. T1234567890123)',
    Singapur: '8 Ziffern + Buchstabe (z.B. 12345678A)',
    Indien: 'GSTIN 15 Zeichen (z.B. 12ABCDE3456F7G8)',
    Südkorea: '10 Ziffern (z.B. 1234567890)',

    // Südamerika
    Brasilien: 'CNPJ Format (z.B. 12.345.678/0001-90)',
    Argentinien: 'CUIT 11 Ziffern (z.B. 12345678901)',
    Chile: 'RUT Format (z.B. 12345678-9)',

    // Afrika & Naher Osten
    Südafrika: '10 Ziffern VAT (z.B. 1234567890)',
    VAE: 'TRN 15 Ziffern (z.B. 123456789012345)',
    Türkei: 'VKN 10 Ziffern (z.B. 1234567890)',
    Israel: '9 Ziffern (z.B. 123456789)',

    // Andere
    Russland: 'INN 10-12 Ziffern (z.B. 1234567890)',
    China: 'Tax ID 15-20 Zeichen (z.B. 12345678901234567890)',
  };

  return formats[countryName] || 'Länderkürzel + Nummer';
}

/**
 * Deutscher Klarname zu einem ISO-3166-1-alpha-2-Code ("DK" → "Dänemark").
 *
 * Warum das exportiert wird statt in den Masken nachgebaut zu werden: Der
 * BESTAND speichert das Kundenland als deutschen Klarnamen, und `getVATFormat`
 * (unten) ist auf genau diese Namen verschluesselt. Wer eine Laenderauswahl aus
 * `lib/laender.LAENDER` (ISO-Codes) aufbaut, braucht deshalb die Ruecksetzung
 * auf den gespeicherten Namen — aus DIESER Tabelle, nicht aus einer elften
 * Kopie. Ist der Code unbekannt, kommt er unveraendert zurueck: kein
 * erfundener Ersatzname (Wurzel 4).
 */
export function laendernameDeutsch(countryCode: string): string {
  const code = (countryCode || '').trim().toUpperCase();
  return COUNTRY_NAMES[code] || code;
}

/**
 * Detects the country based on VAT number
 */
export function detectCountryFromVAT(vatNumber: string): string | null {
  if (!vatNumber || vatNumber.length < 2) return null;

  const countryCode = vatNumber.replace(/\s/g, '').toUpperCase().substring(0, 2);
  return COUNTRY_NAMES[countryCode] || null;
}

/**
 * Formats a VAT number by adding spaces for better readability
 */
export function formatVATNumber(vatNumber: string): string {
  if (!vatNumber) return '';

  const clean = vatNumber.replace(/\s/g, '').toUpperCase();
  const countryCode = clean.substring(0, 2);

  // Add formatting based on country
  switch (countryCode) {
    case 'DE':
      return clean.replace(/^(DE)([0-9]{9})$/, '$1 $2');
    case 'AT':
      return clean.replace(/^(ATU)([0-9]{8})$/, '$1 $2');
    case 'CH':
      return clean.replace(/^(CHE)([0-9]{9})(.*)$/, '$1 $2 $3');
    case 'NL':
      return clean.replace(/^(NL)([0-9]{9})(B[0-9]{2})$/, '$1 $2 $3');
    case 'BE':
      return clean.replace(/^(BE)([0-9]{10})$/, '$1 $2');
    case 'FR':
      return clean.replace(/^(FR)([0-9A-Z]{2})([0-9]{9})$/, '$1 $2 $3');
    case 'IT':
      return clean.replace(/^(IT)([0-9]{11})$/, '$1 $2');
    case 'ES':
      return clean.replace(/^(ES)([0-9A-Z])([0-9]{7})([0-9A-Z])$/, '$1 $2$3$4');
    case 'GB':
      return clean.replace(/^(GB)([0-9]+)$/, '$1 $2');
    case 'US':
      return clean.replace(/^([0-9]{2})([0-9]{7})$/, '$1-$2');
    case 'BR':
      return clean.replace(
        /^([0-9]{2})([0-9]{3})([0-9]{3})([0-9]{4})([0-9]{2})$/,
        '$1.$2.$3/$4-$5',
      );
    case 'CL':
      return clean.replace(/^([0-9]{8})([0-9K])$/, '$1-$2');
    case 'AU':
      return clean.replace(/^([0-9]{2})([0-9]{3})([0-9]{3})([0-9]{3})$/, '$1 $2 $3 $4');
    case 'CA':
      return clean.replace(/^([0-9]{9})(RT[0-9]{4})$/, '$1 $2');
    case 'JP':
      return clean.replace(/^(T)([0-9]{4})([0-9]{2})([0-9]{7})$/, '$1$2-$3-$4');
    case 'SG':
      return clean.replace(/^([0-9]{8})([A-Z])$/, '$1$2');
    case 'IN':
      return clean.replace(
        /^([0-9]{2})([A-Z]{5})([0-9]{4})([A-Z])([0-9])([A-Z])([0-9])$/,
        '$1$2$3$4$5$6$7',
      );
    default:
      return clean;
  }
}

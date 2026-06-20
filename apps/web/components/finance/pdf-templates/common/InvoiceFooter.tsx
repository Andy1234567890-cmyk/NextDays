import type React from 'react';

interface FooterData {
  // Firmendaten
  company?: {
    name?: string;
    address?: {
      street?: string;
      zipCode?: string;
      city?: string;
      houseNumber?: string;
    };
    phone?: string;
    email?: string;
    website?: string;
    vatId?: string;
    taxNumber?: string;
    bankDetails?: {
      iban?: string;
      bic?: string;
    };
  };

  // Direkte Firmenfelder (aus der Datenbank)
  companyName?: string;
  companySuffix?: string;
  companyStreet?: string;
  companyHouseNumber?: string;
  companyPostalCode?: string;
  companyCity?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyWebsite?: string;
  phoneNumber?: string;
  email?: string;
  website?: string;
  iban?: string;
  bic?: string;
  vatId?: string;
  taxNumber?: string;

  // Rechtliche Daten
  districtCourt?: string;
  companyRegister?: string;
  legalForm?: string;

  // Geschäftsführer/Inhaber Daten
  managingDirectors?: Array<{
    firstName?: string;
    lastName?: string;
    name?: string;
    isMainDirector?: boolean;
  }>;

  // Zusätzliche Daten aus Steps
  step1?: {
    managingDirectors?: Array<{
      firstName?: string;
      lastName?: string;
      name?: string;
      isMainDirector?: boolean;
    }>;
    personalData?: {
      firstName?: string;
      lastName?: string;
    };
  };
  step2?: {
    legalForm?: string;
    companySuffix?: string;
  };
  step4?: {
    iban?: string;
    bic?: string;
  };

  // Direkte Felder
  firstName?: string;
  lastName?: string;
}

interface InvoiceFooterProps {
  data: FooterData;
  color?: string;
  preview?: boolean;
}

/**
 * Invoice Footer Component - Immer am Ende der A4-Seite positioniert
 * Zeigt alle Firmendaten, Kontaktdaten und rechtlichen Informationen
 */
export const InvoiceFooter: React.FC<InvoiceFooterProps> = ({
  data,
  color = '#b82028',
  preview = false,
}) => {
  // Sammle alle Footer-Informationen basierend auf der neuen Datenbankstruktur
  const footerParts: string[] = [];

  // Firmenname + Suffix
  const companyName = (data as any).companyName || (data as any).company?.name;
  const companySuffix = (data as any).companySuffix || (data as any).step2?.companySuffix;
  if (companyName) {
    const fullCompanyName = companySuffix ? `${companyName} ${companySuffix}` : companyName;
    footerParts.push(fullCompanyName);
  }

  // Straße + Hausnummer
  const street = (data as any).companyStreet || (data as any).company?.address?.street;
  const houseNumber =
    (data as any).companyHouseNumber || (data as any).company?.address?.houseNumber;
  if (street) {
    const fullStreet = houseNumber ? `${street} ${houseNumber}` : street;
    footerParts.push(fullStreet);
  }

  // PLZ + Stadt
  const postalCode = (data as any).companyPostalCode || (data as any).company?.address?.zipCode;
  const city = (data as any).companyCity || (data as any).company?.address?.city;
  if (postalCode && city) {
    footerParts.push(`${postalCode} ${city}`);
  }

  // Land (immer DE für deutsche Unternehmen)
  footerParts.push('DE');

  // Telefon
  const phone =
    (data as any).phoneNumber || (data as any).companyPhone || (data as any).company?.phone;
  if (phone) {
    footerParts.push(`Tel.: ${phone}`);
  }

  // E-Mail
  const email = (data as any).email || (data as any).companyEmail || (data as any).company?.email;
  if (email) {
    footerParts.push(`E-Mail: ${email}`);
  }

  // Website
  const website =
    (data as any).website || (data as any).companyWebsite || (data as any).company?.website;
  if (website) {
    footerParts.push(`Web: ${website}`);
  }

  // IBAN
  const iban =
    (data as any).iban || (data as any).company?.bankDetails?.iban || (data as any).step4?.iban;
  if (iban) {
    footerParts.push(`IBAN: ${iban}`);
  }

  // BIC
  const bic =
    (data as any).bic || (data as any).company?.bankDetails?.bic || (data as any).step4?.bic;
  if (bic) {
    footerParts.push(`BIC: ${bic}`);
  }

  // USt-IdNr
  const vatId = (data as any).vatId || (data as any).company?.vatId;
  if (vatId) {
    footerParts.push(`USt-IdNr.: ${vatId}`);
  }

  // Rechtsform
  const legalForm = (data as any).legalForm || (data as any).step2?.legalForm;
  if (legalForm) {
    footerParts.push(`Rechtsform: ${legalForm}`);
  }

  // Handelsregister (HRB)
  const companyRegister = (data as any).companyRegister || (data as any).step3?.companyRegister;
  if (companyRegister) {
    footerParts.push(`HRB: ${companyRegister}`);
  }

  // Amtsgericht
  const districtCourt = (data as any).districtCourt || (data as any).step3?.districtCourt;
  if (districtCourt) {
    footerParts.push(`Amtsgericht: ${districtCourt}`);
  }

  // Steuernummer (falls vorhanden)
  const taxNumber = (data as any).taxNumber || (data as any).step3?.taxNumber;
  if (taxNumber) {
    footerParts.push(`Steuernr.: ${taxNumber}`);
  }

  // Geschäftsführer/Inhaber
  const legalFormLower = legalForm?.toLowerCase() || '';
  let directorName = '';

  // 1. Prüfe managingDirectors Array (direkt)
  if ((data as any).managingDirectors && (data as any).managingDirectors.length > 0) {
    const mainDirector =
      (data as any).managingDirectors.find((dir: any) => dir.isMainDirector) ||
      (data as any).managingDirectors[0];
    if (mainDirector?.firstName && mainDirector.lastName) {
      directorName = `${mainDirector.firstName} ${mainDirector.lastName}`;
    } else if (mainDirector?.name) {
      directorName = mainDirector.name;
    }
  }

  // 2. Prüfe step1.managingDirectors Array
  if (
    !directorName &&
    (data as any).step1?.managingDirectors &&
    (data as any).step1.managingDirectors.length > 0
  ) {
    const mainDirector =
      (data as any).step1.managingDirectors.find((dir: any) => dir.isMainDirector) ||
      (data as any).step1.managingDirectors[0];
    if (mainDirector?.firstName && mainDirector.lastName) {
      directorName = `${mainDirector.firstName} ${mainDirector.lastName}`;
    } else if (mainDirector?.name) {
      directorName = mainDirector.name;
    }
  }

  // 3. Prüfe step1.personalData
  if (
    !directorName &&
    (data as any).step1?.personalData?.firstName &&
    (data as any).step1?.personalData?.lastName
  ) {
    directorName = `${(data as any).step1.personalData.firstName} ${(data as any).step1.personalData.lastName}`;
  }

  // 4. Fallback zu direkten personalData Feldern
  if (!directorName && (data as any).firstName && (data as any).lastName) {
    directorName = `${(data as any).firstName} ${(data as any).lastName}`;
  }

  // Für GmbH, UG, AG, KG ist Geschäftsführer PFLICHT
  const requiresDirector =
    legalFormLower.includes('gmbh') ||
    legalFormLower.includes('ug') ||
    legalFormLower.includes('ag') ||
    legalFormLower.includes('kg');

  if (directorName.trim()) {
    if (requiresDirector) {
      footerParts.push(`Geschäftsführer: ${directorName.trim()}`);
    } else {
      footerParts.push(`Inhaber: ${directorName.trim()}`);
    }
  }

  return (
    <div
      className="w-full border-t-2"
      style={{
        borderColor: color,
        paddingTop: '2px', // Force minimal padding for PDF
        marginTop: '0px', // Force no margin for PDF
      }}
    >
      {preview ? (
        <div
          className="text-center text-[11px] text-gray-700 leading-none print:text-base print:leading-none"
          style={{ lineHeight: '1', margin: '0', padding: '0' }}
        >
          <div>{footerParts.join(' | ')}</div>
        </div>
      ) : (
        <div
          className="text-center text-[10px] text-gray-700 leading-none print:text-[11px] print:leading-none"
          style={{
            lineHeight: '1',
            margin: '0',
            padding: '0',
            marginTop: '2px', // Minimal space for PDF generation
          }}
        >
          {footerParts.join(' | ')}
        </div>
      )}
    </div>
  );
};

export default InvoiceFooter;

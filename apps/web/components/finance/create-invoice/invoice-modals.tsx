'use client';

// Banner, Compliance-Sheets und Modals der Rechnungserstellung (aus
// create-invoice-page.tsx extrahiert). Drei Render-Positionen bleiben erhalten:
// CompanySettingsBanner und ComplianceSheetInline leben im Hauptcontainer-Div,
// InvoiceModals danach ("Außerhalb des Hauptcontainers").
// Inline-Logik mit Container-Abhängigkeiten (Produkt speichern, Kundenliste
// neu laden, Versand) kommt als Props-Callbacks aus dem Container.

import { Icon } from '@iconify/react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@tasko/ui';
import {
  type ComponentProps,
  type Dispatch,
  type SetStateAction,
  useState,
} from 'react';
import { toast } from 'sonner';
import { LivePreviewModal } from '@/components/finance/LivePreviewModal';
import NewCustomerModal from '@/components/finance/NewCustomerModal';
import { SendDocumentModal } from '@/components/finance/SendDocumentModal';
import { generateNumberPreview } from '@/components/finance/create-invoice/calc';
import type { CompanySettingsFormData } from '@/components/finance/create-invoice/use-invoice-loaders';
import NewProductModal, { type NewProductValues } from '@/components/inventory/NewProductModal';
import type { CreateInvoiceFormData } from '@/types/formData';
import type { InvoiceData, InvoiceData as InvoiceType } from '@/types/invoiceTypes';

// Company Settings Warning Banner — wird im Hauptcontainer zwischen Header und
// „Allgemeine Angaben" gerendert (Position ist Teil des Layouts, kein Portal)
export function CompanySettingsBanner({
  showCompanySettingsBanner,
  setShowCompanySettingsBanner,
  setShowCompanySettingsModal,
}: {
  showCompanySettingsBanner: boolean;
  setShowCompanySettingsBanner: Dispatch<SetStateAction<boolean>>;
  setShowCompanySettingsModal: Dispatch<SetStateAction<boolean>>;
}) {
  if (!showCompanySettingsBanner) return null;
  return (
    <div className="mb-6 rounded-lg border border-orange-200 bg-orange-50 p-4">
      <div className="flex items-start gap-3">
        <Icon
          icon="lucide:alert-triangle"
          className="mt-0.5 h-6 w-6 shrink-0 text-orange-600"
        />
        <div className="flex-1">
          <div className="mb-1 font-medium text-orange-800">
            Angaben zu deinem Unternehmen
          </div>
          <div className="mb-3 text-orange-700 text-sm">
            Damit deine Rechnungen rechtssicher und GoBD-konform sind, ergänze noch Angaben zu
            dir und deinem Unternehmen.
          </div>
          <Button
            onClick={() => setShowCompanySettingsModal(true)}
            className="bg-accent text-white hover:bg-accent/90"
            size="sm"
          >
            Angaben vervollständigen
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowCompanySettingsBanner(false)}
          className="h-auto p-1"
        >
          <Icon icon="lucide:x" className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// E-Rechnung Compliance Panel (Inline-Variante im Hauptcontainer).
// Bewusst DOPPELT zum Sheet in InvoiceModals — beide hingen schon vorher am
// selben showCompliancePanel-State; Duplikat-Bereinigung ist NICHT Teil dieser Phase.
export function ComplianceSheetInline({
  showCompliancePanel,
  setShowCompliancePanel,
  complianceErrors,
}: {
  showCompliancePanel: boolean;
  setShowCompliancePanel: Dispatch<SetStateAction<boolean>>;
  complianceErrors: string[];
}) {
  if (!showCompliancePanel) return null;
  return (
    <Sheet open={showCompliancePanel} onOpenChange={setShowCompliancePanel}>
      <SheetContent className="w-100 border-accent/20 border-l bg-white sm:w-135">
        <SheetHeader className="border-accent/10 border-b pb-4">
          <SheetTitle className="flex items-center gap-2 text-accent">
            <Icon icon="lucide:alert-triangle" className="h-5 w-5 text-accent" />
            E-Rechnung Compliance Prüfung
          </SheetTitle>
          <SheetDescription className="font-medium text-gray-600">
            Folgende Probleme verhindern die Aktivierung der E-Rechnung:
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-3">
          {complianceErrors.length > 0 && (
            <div className="rounded-lg border border-accent/20 bg-accent/5 p-3">
              <div className="mb-2 flex items-center gap-2">
                <div className="flex h-4 w-4 items-center justify-center rounded-full bg-accent font-bold text-white text-xs">
                  !
                </div>
                <h4 className="font-semibold text-accent text-sm">
                  Erforderliche Angaben
                </h4>
                <span className="rounded bg-accent/10 px-1.5 py-0.5 text-accent text-xs">
                  {complianceErrors.length}
                </span>
              </div>
              <div className="space-y-1 text-gray-700 text-xs">
                {complianceErrors.map((error, index) => (
                  <div key={index} className="flex items-start gap-1.5">
                    <span className="mt-0.5 text-accent text-xs">•</span>
                    <span className="leading-tight">{error}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 rounded-lg border border-accent/20 bg-accent/5 p-3">
          <h4 className="mb-1 flex items-center gap-2 font-medium text-accent text-sm">
            <Icon icon="lucide:info" className="h-3 w-3" />
            E-Rechnung Mindestanforderungen
          </h4>
          <div className="text-gray-700 text-xs leading-tight">
            Vollständige Firmen- und Kundendaten, Steuer-ID, Bankverbindung, gültige
            E-Mail-Adressen
          </div>
        </div>

        <SheetFooter className="mt-6 border-accent/10 border-t pt-4">
          <Button
            onClick={() => setShowCompliancePanel(false)}
            variant="default"
            className="w-full bg-accent text-white hover:bg-accent/90"
            size="sm"
            style={{
              backgroundColor: 'var(--accent)',
              color: 'white',
              border: 'none',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = '#129488';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = 'var(--accent)';
            }}
          >
            Schließen
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

type InvoiceModalsProps = {
  uid: string;
  formData: CreateInvoiceFormData;
  setFormData: Dispatch<SetStateAction<CreateInvoiceFormData>>;
  contactType: 'organisation' | 'person';
  // Neues Produkt
  createProductOpen: boolean;
  setCreateProductOpen: Dispatch<SetStateAction<boolean>>;
  newProduct: NewProductValues;
  creatingProduct: boolean;
  onSaveNewProduct: NonNullable<ComponentProps<typeof NewProductModal>['onSave']>;
  // Company Settings
  showCompanySettingsModal: boolean;
  setShowCompanySettingsModal: Dispatch<SetStateAction<boolean>>;
  companySettingsFormData: CompanySettingsFormData;
  setCompanySettingsFormData: Dispatch<SetStateAction<CompanySettingsFormData>>;
  handleCompanySettingsSave: () => Promise<void>;
  // Neuer Kunde
  createCustomerOpen: boolean;
  setCreateCustomerOpen: Dispatch<SetStateAction<boolean>>;
  creatingCustomer: boolean;
  onCustomerSaved: NonNullable<ComponentProps<typeof NewCustomerModal>['onSaved']>;
  // Nummernkreis
  showNumberingModal: boolean;
  setShowNumberingModal: Dispatch<SetStateAction<boolean>>;
  numberingFormat: string;
  setNumberingFormat: Dispatch<SetStateAction<string>>;
  nextNumber: number;
  setNextNumber: Dispatch<SetStateAction<number>>;
  // Compliance-Sheet (zweite Instanz)
  showCompliancePanel: boolean;
  setShowCompliancePanel: Dispatch<SetStateAction<boolean>>;
  complianceErrors: string[];
  // Versand
  showSendDocumentModal: boolean;
  setShowSendDocumentModal: Dispatch<SetStateAction<boolean>>;
  createdDocument: InvoiceType | null;
  setCreatedDocument: Dispatch<SetStateAction<InvoiceType | null>>;
  onSendDocument: NonNullable<ComponentProps<typeof SendDocumentModal>['onSend']>;
  // Live-Vorschau
  showLivePreview: boolean;
  setShowLivePreview: Dispatch<SetStateAction<boolean>>;
  buildInvoiceDataForPreview: () => InvoiceData;
  handleSubmit: (asDraft?: boolean) => Promise<void>;
};

// Modals außerhalb des Hauptcontainers (Portale — Reihenfolge wie zuvor)
export default function InvoiceModals({
  uid,
  formData,
  setFormData,
  contactType,
  createProductOpen,
  setCreateProductOpen,
  newProduct,
  creatingProduct,
  onSaveNewProduct,
  showCompanySettingsModal,
  setShowCompanySettingsModal,
  companySettingsFormData,
  setCompanySettingsFormData,
  handleCompanySettingsSave,
  createCustomerOpen,
  setCreateCustomerOpen,
  creatingCustomer,
  onCustomerSaved,
  showNumberingModal,
  setShowNumberingModal,
  numberingFormat,
  setNumberingFormat,
  nextNumber,
  setNextNumber,
  showCompliancePanel,
  setShowCompliancePanel,
  complianceErrors,
  showSendDocumentModal,
  setShowSendDocumentModal,
  createdDocument,
  setCreatedDocument,
  onSendDocument,
  showLivePreview,
  setShowLivePreview,
  buildInvoiceDataForPreview,
  handleSubmit,
}: InvoiceModalsProps) {
  // Lokaler UI-State: Dialog lebte vorher im selben JSX-Block (kein Trigger von außen)
  const [showTemplateModal, setShowTemplateModal] = useState(false);

  return (
    <>
      {/* Modal: Neues Produkt */}
      <NewProductModal
        open={createProductOpen}
        onOpenChange={setCreateProductOpen}
        defaultValues={newProduct}
        saving={creatingProduct}
        onSave={onSaveNewProduct}
      />

      {/* Company Settings Modal */}
      <Dialog open={showCompanySettingsModal} onOpenChange={setShowCompanySettingsModal}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Deine Angaben</DialogTitle>
            <DialogDescription>Bearbeite deine Firmendaten und Einstellungen</DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            {/* Pflichtangaben */}
            <div>
              <h3 className="mb-4 font-medium text-lg">Pflichtangaben</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Inhaber</Label>
                  <Input
                    value={companySettingsFormData.companyOwner}
                    onChange={e =>
                      setCompanySettingsFormData(prev => ({
                        ...prev,
                        companyOwner: e.target.value,
                      }))
                    }
                    placeholder="Inhaber"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Firma</Label>
                  <Input
                    value={companySettingsFormData.companyName}
                    onChange={e =>
                      setCompanySettingsFormData(prev => ({ ...prev, companyName: e.target.value }))
                    }
                    placeholder="Firma"
                  />
                </div>
              </div>

              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label>Anschrift</Label>
                  <Input
                    value={companySettingsFormData.street}
                    onChange={e =>
                      setCompanySettingsFormData(prev => ({ ...prev, street: e.target.value }))
                    }
                    placeholder="Straße und Hausnummer"
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Input
                      value={companySettingsFormData.zip}
                      onChange={e =>
                        setCompanySettingsFormData(prev => ({ ...prev, zip: e.target.value }))
                      }
                      placeholder="PLZ"
                    />
                  </div>
                  <div className="space-y-2">
                    <Input
                      value={companySettingsFormData.city}
                      onChange={e =>
                        setCompanySettingsFormData(prev => ({ ...prev, city: e.target.value }))
                      }
                      placeholder="Ort"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Steuernummer</Label>
                  <Input
                    value={companySettingsFormData.taxNumber}
                    onChange={e =>
                      setCompanySettingsFormData(prev => ({ ...prev, taxNumber: e.target.value }))
                    }
                    placeholder="Steuernummer"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Umsatzsteuer-ID</Label>
                  <Input
                    value={companySettingsFormData.vatNumber}
                    onChange={e =>
                      setCompanySettingsFormData(prev => ({ ...prev, vatNumber: e.target.value }))
                    }
                    placeholder="Umsatzsteuer-ID"
                  />
                </div>
              </div>

              {/* USt-Satz Übernachtung (0092): Pflicht für die automatische
                  Rechnung beim Check-out — ohne ihn schlägt sie mit klarer
                  Meldung fehl (kein stiller Standardsatz, 27 EU-Länder). */}
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>USt-Satz Übernachtung (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step="0.1"
                    value={companySettingsFormData.lodgingTaxRate}
                    onChange={e =>
                      setCompanySettingsFormData(prev => ({
                        ...prev,
                        lodgingTaxRate: e.target.value,
                      }))
                    }
                    placeholder="z. B. 7"
                  />
                  <p className="text-gray-500 text-xs">
                    Steuersatz für Übernachtungs-Positionen bei Rechnungen aus
                    Buchungen (z. B. 7 % in Deutschland). Ohne Angabe kann beim
                    Check-out keine automatische Rechnung erstellt werden.
                  </p>
                </div>
              </div>
            </div>

            {/* Optionale Angaben */}
            <div>
              <h3 className="mb-4 font-medium text-lg">Optionale Angaben</h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>E-Mail</Label>
                  <Input
                    type="email"
                    value={companySettingsFormData.email}
                    onChange={e =>
                      setCompanySettingsFormData(prev => ({ ...prev, email: e.target.value }))
                    }
                    placeholder="marie@musterfrau.de"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Telefon</Label>
                  <Input
                    value={companySettingsFormData.phone}
                    onChange={e =>
                      setCompanySettingsFormData(prev => ({ ...prev, phone: e.target.value }))
                    }
                    placeholder="07821 127384"
                  />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>IBAN</Label>
                  <Input
                    value={companySettingsFormData.iban}
                    onChange={e =>
                      setCompanySettingsFormData(prev => ({ ...prev, iban: e.target.value }))
                    }
                    placeholder="DE01100100000010101010"
                  />
                </div>
                <div className="space-y-2">
                  <Label>BIC</Label>
                  <Input
                    value={companySettingsFormData.bic}
                    onChange={e =>
                      setCompanySettingsFormData(prev => ({ ...prev, bic: e.target.value }))
                    }
                    placeholder="BELADEBE"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between border-t pt-4">
            <Button variant="outline" onClick={() => setShowCompanySettingsModal(false)}>
              Abbrechen
            </Button>
            <Button
              onClick={handleCompanySettingsSave}
              className="bg-accent text-white hover:bg-accent/90"
            >
              Speichern
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Neuer Kunde */}
      <NewCustomerModal
        open={createCustomerOpen}
        onOpenChange={setCreateCustomerOpen}
        defaultValues={{
          name: formData.customerName || '',
          firstName: contactType === 'person' ? formData.customerFirstName : undefined,
          lastName: contactType === 'person' ? formData.customerLastName : undefined,
        }}
        contactType={contactType}
        saving={creatingCustomer}
        persistDirectly={true}
        companyId={uid}
        onSaved={onCustomerSaved}
      />

      {/* Modal: Textvorlagen verwalten */}
      <Dialog open={showTemplateModal} onOpenChange={setShowTemplateModal}>
        <DialogContent className="w-full max-w-200">
          <DialogHeader>
            <DialogTitle>Textvorlagen verwalten</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-gray-600 text-sm">
              Hier können Sie neue Textvorlagen für Kopf- und Fußtexte erstellen und verwalten.
            </p>
            <div className="py-8 text-center text-gray-500">
              <Icon icon="lucide:file-text" className="mx-auto mb-2 h-12 w-12 opacity-50" />
              <p>Textvorlagen-Verwaltung wird in Kürze verfügbar sein.</p>
              <p className="mt-1 text-xs">
                Navigieren Sie zu Finance → Textvorlagen für die vollständige Verwaltung.
              </p>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => setShowTemplateModal(false)}>Schließen</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal: Nummernkreis bearbeiten */}
      <Dialog open={showNumberingModal} onOpenChange={setShowNumberingModal}>
        <DialogContent className="w-80 max-w-none sm:w-80">
          <DialogHeader>
            <DialogTitle>Nummernkreis bearbeiten</DialogTitle>
          </DialogHeader>
          <div className="space-y-6">
            {/* Format */}
            <div className="space-y-2">
              <Label className="font-medium text-gray-700 text-sm">Format</Label>
              <Input
                value={numberingFormat}
                onChange={e => setNumberingFormat(e.target.value)}
                placeholder="RE-%NUMBER"
              />
            </div>

            {/* Nächste Zahl */}
            <div className="space-y-2">
              <Label className="font-medium text-gray-700 text-sm">Nächste Zahl</Label>
              <Input
                type="number"
                value={nextNumber}
                onChange={e => setNextNumber(parseInt(e.target.value, 10) || 0)}
                placeholder="1000"
              />
            </div>

            {/* Vorschau */}
            <div className="space-y-2">
              <Label className="font-medium text-gray-700 text-sm">Vorschau</Label>
              <div className="rounded-md border bg-gray-50 p-3">
                <code className="font-mono text-gray-800 text-sm">
                  {generateNumberPreview(numberingFormat, nextNumber)}
                </code>
              </div>
            </div>

            {/* Verfügbare Variablen */}
            <div className="space-y-2">
              <Label className="font-medium text-gray-700 text-sm">
                Folgende Variablen stehen für das Format zur Verfügung:
              </Label>
              <div className="space-y-1 text-gray-600 text-xs">
                <div>
                  <code className="rounded bg-gray-100 px-1">%NUMBER</code> - Nächste Zahl{' '}
                  <span className="text-red-500">Obligatorisch</span>
                </div>
                <div>
                  <code className="rounded bg-gray-100 px-1">%YYYY</code> - Aktuelles Jahr (2025)
                </div>
                <div>
                  <code className="rounded bg-gray-100 px-1">%YY</code> - Aktuelles Jahr (25)
                </div>
                <div>
                  <code className="rounded bg-gray-100 px-1">%MM</code> - Aktueller Monat (09)
                </div>
                <div>
                  <code className="rounded bg-gray-100 px-1">%M</code> - Aktueller Monat (9)
                </div>
                <div>
                  <code className="rounded bg-gray-100 px-1">%DD</code> - Aktueller Tag (15)
                </div>
                <div>
                  <code className="rounded bg-gray-100 px-1">%D</code> - Aktueller Tag (15)
                </div>
              </div>
            </div>

            {/* Buttons */}
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setShowNumberingModal(false)}>
                Abbrechen
              </Button>
              <Button
                className="bg-accent text-white hover:bg-accent/90"
                onClick={async () => {
                  try {
                    // Nummernkreis-Einstellungen werden jetzt automatisch durch NumberSequenceService verwaltet
                    // Keine manuellen Updates der invoiceNumbering Felder mehr nötig

                    // Aktualisiere das Rechnungsnummer-Feld mit der neuen Vorschau
                    setFormData(prev => ({
                      ...prev,
                      title: generateNumberPreview(numberingFormat, nextNumber),
                    }));

                    setShowNumberingModal(false);
                    toast.success('Nummernkreis-Einstellungen gespeichert');
                  } catch (error) {
                    console.error('Fehler beim Speichern der Nummernkreis-Einstellungen:', error);
                    toast.error('Fehler beim Speichern der Einstellungen');
                  }
                }}
              >
                Übernehmen
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* E-Rechnung Compliance Panel - von rechts ausfahrend
          (bewusst zweite Instanz neben ComplianceSheetInline — Bereinigung ist NICHT Teil dieser Phase) */}
      <Sheet open={showCompliancePanel} onOpenChange={setShowCompliancePanel}>
        <SheetContent side="right" className="w-100 sm:w-135">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Icon icon="lucide:alert-triangle" className="h-5 w-5 text-red-500" />
              E-Rechnung Compliance Prüfung
            </SheetTitle>
            <SheetDescription>
              Folgende Probleme verhindern die Aktivierung der E-Rechnung:
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-3">
            {(() => {
              // Kategorisiere die Compliance-Fehler in Pflicht und Empfohlen
              const criticalErrors = complianceErrors.filter(
                error =>
                  !error.includes('empfohlen') &&
                  !error.includes('Website') &&
                  !error.includes('Logo') &&
                  !error.includes('Branchenangabe') &&
                  !error.includes('Geschäftsbeschreibung') &&
                  !error.includes('Telefonnummer'),
              );

              const recommendedErrors = complianceErrors.filter(
                error =>
                  error.includes('empfohlen') ||
                  error.includes('Website') ||
                  error.includes('Logo') ||
                  error.includes('Branchenangabe') ||
                  error.includes('Geschäftsbeschreibung') ||
                  error.includes('Telefonnummer'),
              );

              return (
                <>
                  {/* Kritische Fehler - Kompakt */}
                  {criticalErrors.length > 0 && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <div className="flex h-4 w-4 items-center justify-center rounded-full bg-red-500 font-bold text-white text-xs">
                          !
                        </div>
                        <h4 className="font-semibold text-red-800 text-sm">
                          Erforderliche Angaben
                        </h4>
                        <span className="rounded bg-red-100 px-1.5 py-0.5 text-red-700 text-xs">
                          {criticalErrors.length}
                        </span>
                      </div>
                      <div className="space-y-1 text-red-700 text-xs">
                        {criticalErrors.slice(0, 5).map((error, index) => (
                          <div key={index} className="flex items-start gap-1.5">
                            <span className="mt-0.5 text-red-400 text-xs">•</span>
                            <span className="leading-tight">{error}</span>
                          </div>
                        ))}
                        {criticalErrors.length > 5 && (
                          <div className="mt-1 font-medium text-red-600 text-xs">
                            ... und {criticalErrors.length - 5} weitere
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Empfehlungen - Kollapsible */}
                  {recommendedErrors.length > 0 && (
                    <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-3">
                      <div className="mb-2 flex items-center gap-2">
                        <div className="flex h-4 w-4 items-center justify-center rounded-full bg-yellow-500 text-white text-xs">
                          i
                        </div>
                        <h4 className="font-semibold text-sm text-yellow-800">Empfehlungen</h4>
                        <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-xs text-yellow-700">
                          {recommendedErrors.length}
                        </span>
                      </div>
                      <div className="text-xs text-yellow-700">
                        <div className="leading-tight">
                          {recommendedErrors.slice(0, 2).join(', ')}
                          {recommendedErrors.length > 2 &&
                            ` und ${recommendedErrors.length - 2} weitere Verbesserungen`}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>

          {/* Kompakte Hilfe-Section */}
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-3">
            <h4 className="mb-1 flex items-center gap-2 font-medium text-blue-800 text-sm">
              <Icon icon="lucide:info" className="h-3 w-3" />
              E-Rechnung Mindestanforderungen
            </h4>
            <div className="text-blue-700 text-xs leading-tight">
              Vollständige Firmen- und Kundendaten, Steuer-ID, Bankverbindung, gültige
              E-Mail-Adressen
            </div>
          </div>

          <SheetFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => setShowCompliancePanel(false)}
              className="h-8 w-full text-sm"
            >
              Schließen
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {/* Send Document Modal - IMMER gerendert für html2pdf.js Preload */}
      <SendDocumentModal
        isOpen={showSendDocumentModal && !!createdDocument}
        onClose={() => {
          setShowSendDocumentModal(false);
          setCreatedDocument(null);
        }}
        document={createdDocument || ({} as InvoiceData)}
        documentType="invoice"
        companyId={uid}
        redirectAfterAction={`/dashboard/company/${uid}/finance/invoices`}
        onSend={onSendDocument}
      />

      {/* Live Preview Modal - NUTZT JETZT DIE GLEICHEN DATEN WIE SendDocumentModal! */}
      <LivePreviewModal
        isOpen={showLivePreview}
        onClose={() => setShowLivePreview(false)}
        document={buildInvoiceDataForPreview()}
        documentType="invoice"
        companyId={uid}
        mode="preview"
        onSaveAsDraft={() => {
          setShowLivePreview(false);
          handleSubmit(true); // Als Entwurf speichern
        }}
      />
    </>
  );
}

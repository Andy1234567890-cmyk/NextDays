'use client';

import { Icon } from '@iconify/react';
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Switch,
} from '@tasko/ui';
import { format } from 'date-fns';
import { useState } from 'react';
import { toast } from 'sonner';

import { useNewAuth } from '@/contexts/NewAuthContext';
import { GoBDService } from '@/services/gobdService';

interface SevDeskLockManagerProps {
  companyId: string;
  onLockComplete?: () => void;
}

export function SevDeskLockManager({ companyId, onLockComplete }: SevDeskLockManagerProps) {
  const { user } = useNewAuth();

  // Datumsbereiche
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Dokumenttyp-Optionen (wie in SevDesk)
  const [includeInvoices, setIncludeInvoices] = useState(true);
  const [includeVouchers, setIncludeVouchers] = useState(true);
  const [includePayments, setIncludePayments] = useState(true);
  const [includeCreditNotes, setIncludeCreditNotes] = useState(true);

  // Loading State
  const [isLocking, setIsLocking] = useState(false);

  const handleSubmit = async () => {
    if (!user) {
      toast.error('Benutzer nicht authentifiziert');
      return;
    }

    if (!startDate && !endDate) {
      toast.error('Bitte wählen Sie mindestens ein Datum aus');
      return;
    }

    // Validierung: Wenn nur ein Datum gesetzt, nutze aktueller Monat als Fallback
    const _actualStartDate = startDate || format(new Date(), 'yyyy-MM-01');
    const _actualEndDate = endDate || format(new Date(), 'yyyy-MM-dd');

    try {
      setIsLocking(true);

      // Bestimme zu sperrende Periode basierend auf Datum
      const period = startDate ? startDate.substring(0, 7) : format(new Date(), 'yyyy-MM');

      const userName =
        `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email || 'Unbekannt';

      const periodLock = await GoBDService.lockPeriod(companyId, period, user.uid, userName);

      if (periodLock) {
        toast.success(`Festschreibung für Periode ${period} erfolgreich abgeschlossen`);
        onLockComplete?.();

        // Formular zurücksetzen
        setStartDate('');
        setEndDate('');
      } else {
        toast.error('Festschreibung fehlgeschlagen');
      }
    } catch (error) {
      console.error('Lock period error:', error);
      toast.error(`Fehler bei der Festschreibung: ${(error as Error).message}`);
    } finally {
      setIsLocking(false);
    }
  };

  const isFormValid = includeInvoices || includeVouchers || includePayments || includeCreditNotes;

  return (
    <div className="space-y-6">
      {/* Haupttitel */}
      <div>
        <h3 className="mb-4 font-semibold text-2xl text-gray-900">Festschreibungseinstellungen</h3>

        {/* Info-Box (wie SevDesk) */}
        <Alert className="mb-6 border-blue-200 bg-blue-50">
          <Icon icon="lucide:info" className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-blue-800">
            Bitte gib an, welche Dokumente festgeschrieben werden sollen. Nach der
            <br />
            Festschreibung sind diese Dokumente nicht mehr löschbar oder bearbeitbar.
            <br />
            <br />
            Benötigst du weitere Informationen?
            <br />
            <a
              href="https://docs.nextdays.de/gobd-festschreibung"
              target="_blank"
              className="mt-1 inline-flex items-center gap-1 text-blue-600 underline hover:text-blue-800"
              rel="noopener"
            >
              Weitere Informationen <Icon icon="lucide:external-link" className="h-3 w-3" />
            </a>
          </AlertDescription>
        </Alert>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        {/* Linke Spalte: Datumsbereiche */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Zeitraum</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <Label htmlFor="startDate" className="font-medium text-gray-700 text-sm">
                  Startdatum
                </Label>
                <div className="relative mt-1">
                  <Input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    placeholder="Optional"
                    className="pr-10"
                  />
                  <Icon
                    icon="lucide:calendar"
                    className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 transform text-gray-400"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="endDate" className="font-medium text-gray-700 text-sm">
                  Enddatum
                </Label>
                <div className="relative mt-1">
                  <Input
                    id="endDate"
                    type="date"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    placeholder="Optional"
                    className="pr-10"
                  />
                  <Icon
                    icon="lucide:calendar"
                    className="absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 transform text-gray-400"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Rechte Spalte: Dokumenttypen & Festschreiben-Button */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Dokumenttypen</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Toggle-Switches (wie in SevDesk) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="invoices" className="font-medium text-gray-700 text-sm">
                  Rechnungen
                </Label>
                <Switch
                  id="invoices"
                  checked={includeInvoices}
                  onCheckedChange={setIncludeInvoices}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="vouchers" className="font-medium text-gray-700 text-sm">
                  Belege
                </Label>
                <Switch
                  id="vouchers"
                  checked={includeVouchers}
                  onCheckedChange={setIncludeVouchers}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="payments" className="font-medium text-gray-700 text-sm">
                  Zahlungen
                </Label>
                <Switch
                  id="payments"
                  checked={includePayments}
                  onCheckedChange={setIncludePayments}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="creditNotes" className="font-medium text-gray-700 text-sm">
                  Gutschriften
                </Label>
                <Switch
                  id="creditNotes"
                  checked={includeCreditNotes}
                  onCheckedChange={setIncludeCreditNotes}
                />
              </div>
            </div>

            {/* Festschreiben-Button */}
            <div className="border-t pt-4">
              <Button
                onClick={handleSubmit}
                disabled={!isFormValid || isLocking}
                className="w-full bg-accent py-3 font-medium text-white hover:bg-accent/90"
                size="lg"
              >
                {isLocking ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-white border-b-2"></div>
                    Wird festgeschrieben...
                  </>
                ) : (
                  <>
                    <Icon icon="lucide:lock" className="mr-2 h-4 w-4" />
                    Festschreiben
                  </>
                )}
              </Button>

              {!isFormValid && (
                <p className="mt-2 text-red-600 text-xs">
                  Bitte wählen Sie mindestens einen Dokumenttyp aus.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

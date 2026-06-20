'use client';

import { Icon } from '@iconify/react';
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
  Label,
} from '@tasko/ui';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import { useNewAuth } from '@/contexts/NewAuthContext';
import { GoBDService } from '@/services/gobdService';
import type { GoBDDocument, GoBDPeriodLock } from '@/types/gobdTypes';

interface ManualLockManagerProps {
  companyId: string;
  onLockComplete?: (periodLock: GoBDPeriodLock) => void;
}

export function ManualLockManager({ companyId, onLockComplete }: ManualLockManagerProps) {
  const { user } = useNewAuth();
  const [selectedPeriod, setSelectedPeriod] = useState(() => {
    const now = new Date();
    return format(now, 'yyyy-MM');
  });

  const [documents, setDocuments] = useState<GoBDDocument[]>([]);
  const [selectedDocuments, setSelectedDocuments] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [lockingPeriod, setLockingPeriod] = useState(false);
  const [lockingIndividual, setLockingIndividual] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'locked' | 'unlocked'>('unlocked');

  const loadDocuments = useCallback(async () => {
    try {
      setLoading(true);
      const mockDocuments: GoBDDocument[] = [
        {
          id: '1',
          documentNumber: 'RE-MOCK-001',
          documentType: 'invoice',
          createdAt: new Date('2025-10-15'),
          amount: 1190.0,
          customerId: 'customer1',
          companyId,
          gobdStatus: { isLocked: false },
        },
        {
          id: '2',
          documentNumber: 'RE-MOCK-002',
          documentType: 'invoice',
          createdAt: new Date('2025-10-20'),
          amount: 595.0,
          customerId: 'customer2',
          companyId,
          gobdStatus: {
            isLocked: true,
            lockedAt: new Date('2025-10-21'),
            lockedBy: 'user1',
            lockReason: 'auto',
          },
        },
      ];

      setDocuments(mockDocuments);
    } catch (error) {
      console.error('Failed to load documents:', error);
      toast.error('Dokumente konnten nicht geladen werden');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const lockPeriod = async () => {
    if (!user) {
      toast.error('Benutzer nicht authentifiziert');
      return;
    }

    try {
      setLockingPeriod(true);
      const periodLock = await GoBDService.lockPeriod(
        companyId,
        selectedPeriod,
        user.uid,
        `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email || 'Unbekannt',
      );

      if (periodLock) {
        onLockComplete?.(periodLock);
        loadDocuments(); // Reload to show updated status
      }
    } catch (error) {
      console.error('Period lock failed:', error);
    } finally {
      setLockingPeriod(false);
    }
  };

  const lockSelectedDocuments = async () => {
    if (!user || selectedDocuments.size === 0) return;

    try {
      setLockingIndividual(true);
      const promises = Array.from(selectedDocuments).map(docId =>
        GoBDService.lockDocument(
          companyId,
          docId,
          user?.uid || 'unknown',
          `${user?.first_name} ${user?.last_name}` || 'Unknown User',
          'Manuell festgeschrieben',
        ),
      );

      await Promise.all(promises);
      setSelectedDocuments(new Set());
      loadDocuments();
    } catch (error) {
      console.error('Individual lock failed:', error);
    } finally {
      setLockingIndividual(false);
    }
  };

  const toggleDocumentSelection = (docId: string) => {
    const newSelection = new Set(selectedDocuments);
    if (newSelection.has(docId)) {
      newSelection.delete(docId);
    } else {
      newSelection.add(docId);
    }
    setSelectedDocuments(newSelection);
  };

  const selectAllUnlocked = () => {
    const unlockedDocs = documents.filter(doc => !doc.gobdStatus.isLocked).map(doc => doc.id);
    setSelectedDocuments(new Set(unlockedDocs));
  };

  const filteredDocuments = documents.filter(doc => {
    const matchesSearch =
      searchTerm === '' || doc.documentNumber.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter =
      filterStatus === 'all' ||
      (filterStatus === 'locked' && doc.gobdStatus.isLocked) ||
      (filterStatus === 'unlocked' && !doc.gobdStatus.isLocked);

    return matchesSearch && matchesFilter;
  });

  const unlockedCount = documents.filter(doc => !doc.gobdStatus.isLocked).length;
  const totalAmount = documents
    .filter(doc => !doc.gobdStatus.isLocked)
    .reduce((sum, doc) => sum + doc.amount, 0);

  return (
    <div className="space-y-6">
      {/* Periode auswählen */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon icon="lucide:calendar" className="h-5 w-5 text-accent" />
            Zeitraum-Festschreibung
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="period">Monat auswählen</Label>
              <Input
                id="period"
                type="month"
                value={selectedPeriod}
                onChange={e => setSelectedPeriod(e.target.value)}
                max={format(new Date(), 'yyyy-MM')}
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={lockPeriod}
                disabled={lockingPeriod || unlockedCount === 0}
                className="bg-accent text-white hover:bg-accent/90"
              >
                {lockingPeriod ? (
                  <>
                    <Icon icon="lucide:loader2" className="mr-2 h-4 w-4 animate-spin" />
                    Schreibe fest...
                  </>
                ) : (
                  <>
                    <Icon icon="lucide:lock" className="mr-2 h-4 w-4" />
                    Monat festschreiben
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Periode-Statistiken */}
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-center">
              <div className="font-bold text-2xl text-blue-600">{documents.length}</div>
              <p className="text-blue-700 text-sm">Gesamt-Dokumente</p>
            </div>
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-4 text-center">
              <div className="font-bold text-2xl text-orange-600">{unlockedCount}</div>
              <p className="text-orange-700 text-sm">Noch nicht festgeschrieben</p>
            </div>
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-center">
              <div className="font-bold text-2xl text-green-600">
                {totalAmount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
              </div>
              <p className="text-green-700 text-sm">Offener Betrag</p>
            </div>
          </div>

          {unlockedCount === 0 && (
            <Alert className="border-green-200 bg-green-50">
              <Icon icon="lucide:check-circle" className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Alle Dokumente für{' '}
                {format(new Date(`${selectedPeriod}-01`), 'MMMM yyyy', { locale: de })}
                sind bereits festgeschrieben.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Einzelne Dokumente verwalten */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon icon="lucide:file-text" className="h-5 w-5 text-accent" />
              Dokumente verwalten
            </div>
            <div className="flex gap-2">
              {selectedDocuments.size > 0 && (
                <Button
                  onClick={lockSelectedDocuments}
                  disabled={lockingIndividual}
                  size="sm"
                  className="bg-accent text-white hover:bg-accent/90"
                >
                  {lockingIndividual ? (
                    <>
                      <Icon icon="lucide:loader2" className="mr-2 h-4 w-4 animate-spin" />
                      Schreibe fest...
                    </>
                  ) : (
                    <>
                      <Icon icon="lucide:lock" className="mr-2 h-4 w-4" />
                      Auswahl festschreiben ({selectedDocuments.size})
                    </>
                  )}
                </Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filter und Suche */}
          <div className="flex flex-col gap-4 md:flex-row">
            <div className="flex-1">
              <div className="relative">
                <Icon
                  icon="lucide:search"
                  className="absolute top-3 left-3 h-4 w-4 text-gray-400"
                />
                <Input
                  placeholder="Dokumentnummer suchen..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                variant={filterStatus === 'all' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus('all')}
              >
                Alle
              </Button>
              <Button
                variant={filterStatus === 'unlocked' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus('unlocked')}
              >
                Offen
              </Button>
              <Button
                variant={filterStatus === 'locked' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFilterStatus('locked')}
              >
                Festgeschrieben
              </Button>
            </div>
          </div>

          {/* Bulk-Aktionen */}
          {filterStatus === 'unlocked' &&
            filteredDocuments.some(doc => !doc.gobdStatus.isLocked) && (
              <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3">
                <Button variant="outline" size="sm" onClick={selectAllUnlocked}>
                  Alle offenen auswählen
                </Button>
                <span className="text-gray-600 text-sm">
                  {selectedDocuments.size} von {unlockedCount} ausgewählt
                </span>
              </div>
            )}

          {/* Dokumentenliste */}
          <div className="space-y-2">
            {loading ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div
                    key={i}
                    className="flex animate-pulse items-center space-x-4 rounded-lg border p-4"
                  >
                    <div className="h-4 w-4 rounded bg-gray-200"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-1/3 rounded bg-gray-200"></div>
                      <div className="h-3 w-1/4 rounded bg-gray-200"></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredDocuments.length === 0 ? (
              <div className="py-8 text-center text-gray-500">
                <Icon icon="lucide:file-text" className="mx-auto mb-4 h-12 w-12 text-gray-300" />
                <p>Keine Dokumente gefunden</p>
              </div>
            ) : (
              filteredDocuments.map(doc => (
                <div
                  key={doc.id}
                  className={`flex items-center space-x-4 rounded-lg border p-4 transition-colors ${
                    selectedDocuments.has(doc.id)
                      ? 'border-accent bg-accent/5'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  {!doc.gobdStatus.isLocked && (
                    <Checkbox
                      checked={selectedDocuments.has(doc.id)}
                      onCheckedChange={() => toggleDocumentSelection(doc.id)}
                    />
                  )}

                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <span className="font-medium">{doc.documentNumber}</span>
                      <Badge variant="outline" className="text-xs">
                        {doc.documentType}
                      </Badge>
                      {doc.gobdStatus.isLocked ? (
                        <Badge className="border-green-200 bg-green-100 text-green-700">
                          <Icon icon="lucide:lock" className="mr-1 h-3 w-3" />
                          Festgeschrieben
                        </Badge>
                      ) : (
                        <Badge className="border-orange-200 bg-orange-100 text-orange-700">
                          <Icon icon="lucide:alert-triangle" className="mr-1 h-3 w-3" />
                          Offen
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-4 text-gray-600 text-sm">
                      <span>{format(doc.createdAt, 'dd.MM.yyyy')}</span>
                      <span>
                        {doc.amount.toLocaleString('de-DE', { style: 'currency', currency: 'EUR' })}
                      </span>
                      {doc.gobdStatus.isLocked && doc.gobdStatus.lockedAt && (
                        <span>
                          Festgeschrieben: {format(doc.gobdStatus.lockedAt, 'dd.MM.yyyy HH:mm')}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

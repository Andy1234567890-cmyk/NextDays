'use client';

import { Icon } from '@iconify/react';

import { formatCurrency } from '@/lib/currency';
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Label,
  Textarea,
} from '@tasko/ui';
import { format } from 'date-fns';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'sonner';

import { useNewAuth } from '@/contexts/NewAuthContext';
import { GoBDService } from '@/services/gobdService';
import type { CreditNoteRequest, GoBDDocument, StornoRequest } from '@/types/gobdTypes';

interface StornoManagerProps {
  companyId: string;
  document: GoBDDocument;
  onStornoCreated?: (stornoId: string) => void;
  onCreditNoteCreated?: (creditNoteId: string) => void;
}

export function StornoManager({
  companyId,
  document,
  onStornoCreated,
  onCreditNoteCreated,
}: StornoManagerProps) {
  const t = useTranslations('finance');
  const { user } = useNewAuth();
  const [stornoDialogOpen, setStornoDialogOpen] = useState(false);
  const [creditDialogOpen, setCreditDialogOpen] = useState(false);
  const [stornoReason, setStornoReason] = useState('');
  const [stornoDate, setStornoDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [creditReason, setCreditReason] = useState('');
  const [creditAmount, setCreditAmount] = useState(document.amount.toString());
  const [creditDate, setCreditDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [processing, setProcessing] = useState(false);

  const canCreateStorno = document.gobdStatus.isLocked && !document.stornoDocumentId;
  const canCreateCredit = document.gobdStatus.isLocked && !document.creditNoteId;

  const handleStorno = async () => {
    if (!user || !stornoReason.trim()) {
      toast.error(t('StornoManager.stornoReasonRequired'));
      return;
    }

    try {
      setProcessing(true);

      const stornoRequest: StornoRequest = {
        originalDocumentId: document.id,
        reason: stornoReason.trim(),
        stornoDate: new Date(stornoDate),
      };

      const stornoId = await GoBDService.createStorno(
        companyId,
        stornoRequest,
        user.uid,
        `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email || 'Unbekannt',
      );

      if (stornoId) {
        setStornoDialogOpen(false);
        setStornoReason('');
        onStornoCreated?.(stornoId);
        toast.success(t('StornoManager.stornoCreatedSuccess'));
      }
    } catch (error) {
      console.error('Storno creation failed:', error);
      toast.error(t('StornoManager.stornoCreatedError'));
    } finally {
      setProcessing(false);
    }
  };

  const handleCreditNote = async () => {
    if (!user || !creditReason.trim()) {
      toast.error(t('StornoManager.creditReasonRequired'));
      return;
    }

    const amount = parseFloat(creditAmount);
    if (Number.isNaN(amount) || amount <= 0 || amount > document.amount) {
      toast.error(t('StornoManager.creditAmountInvalid'));
      return;
    }

    try {
      setProcessing(true);

      const _creditRequest: CreditNoteRequest = {
        originalDocumentId: document.id,
        reason: creditReason.trim(),
        creditAmount: amount,
        creditDate: new Date(creditDate),
      };

      // Gutschriften-Erstellung via GoBDService geplant

      // Temporary success simulation
      setTimeout(() => {
        setCreditDialogOpen(false);
        setCreditReason('');
        setCreditAmount(document.amount.toString());
        onCreditNoteCreated?.(`credit-${Date.now()}`);
        toast.success(t('StornoManager.creditCreatedSuccess'));
        setProcessing(false);
      }, 1000);
    } catch (error) {
      console.error('Credit note creation failed:', error);
      toast.error(t('StornoManager.creditCreatedError'));
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Status-Übersicht */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon icon="lucide:file-text" className="h-5 w-5 text-accent" />
            {t('StornoManager.documentStatus')}
            <Badge className="border-blue-200 bg-blue-100 text-blue-700">
              {document.documentNumber}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600 text-sm">{t('StornoManager.statusLabel')}</span>
                  <Badge
                    className={
                      document.gobdStatus.isLocked
                        ? 'border-green-200 bg-green-100 text-green-700'
                        : 'border-orange-200 bg-orange-100 text-orange-700'
                    }
                  >
                    {document.gobdStatus.isLocked
                      ? t('StornoManager.statusLocked')
                      : t('StornoManager.statusOpen')}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 text-sm">{t('StornoManager.amountLabel')}</span>
                  <span className="font-medium">
                    {formatCurrency(document.amount, document.currency)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 text-sm">{t('StornoManager.createdLabel')}</span>
                  <span>{format(document.createdAt, 'dd.MM.yyyy')}</span>
                </div>
                {document.gobdStatus.lockedAt && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 text-sm">
                      {t('StornoManager.lockedAtLabel')}
                    </span>
                    <span>{format(document.gobdStatus.lockedAt, 'dd.MM.yyyy HH:mm')}</span>
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600 text-sm">
                    {t('StornoManager.stornoedLabel')}
                  </span>
                  <Badge variant={document.stornoDocumentId ? 'destructive' : 'secondary'}>
                    {document.stornoDocumentId ? t('StornoManager.yes') : t('StornoManager.no')}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600 text-sm">
                    {t('StornoManager.creditNoteLabel')}
                  </span>
                  <Badge variant={document.creditNoteId ? 'default' : 'secondary'}>
                    {document.creditNoteId
                      ? t('StornoManager.creditNoteCreated')
                      : t('StornoManager.creditNoteNone')}
                  </Badge>
                </div>
                {document.stornoDocumentId && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 text-sm">
                      {t('StornoManager.stornoNumberLabel')}
                    </span>
                    <span className="font-mono text-sm">{document.stornoDocumentId}</span>
                  </div>
                )}
                {document.creditNoteId && (
                  <div className="flex justify-between">
                    <span className="text-gray-600 text-sm">
                      {t('StornoManager.creditNumberLabel')}
                    </span>
                    <span className="font-mono text-sm">{document.creditNoteId}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Aktionen */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {/* Storno */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon icon="lucide:file-x" className="h-5 w-5 text-red-500" />
              {t('StornoManager.stornoCardTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-gray-600 text-sm">{t('StornoManager.stornoCardDescription')}</p>

            {!document.gobdStatus.isLocked ? (
              <Alert className="border-orange-200 bg-orange-50">
                <Icon icon="lucide:alert-triangle" className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-orange-800">
                  {t('StornoManager.stornoRequiresLockedHint')}
                </AlertDescription>
              </Alert>
            ) : document.stornoDocumentId ? (
              <Alert className="border-green-200 bg-green-50">
                <Icon icon="lucide:check-circle" className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  {t('StornoManager.stornoAlreadyCreated', {
                    stornoId: document.stornoDocumentId,
                  })}
                </AlertDescription>
              </Alert>
            ) : (
              <Dialog open={stornoDialogOpen} onOpenChange={setStornoDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    className="w-full bg-red-500 text-white hover:bg-red-600"
                    disabled={!canCreateStorno}
                  >
                    <Icon icon="lucide:file-x" className="mr-2 h-4 w-4" />
                    {t('StornoManager.createStornoButton')}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t('StornoManager.createStornoButton')}</DialogTitle>
                    <DialogDescription>
                      {t('StornoManager.stornoDialogDescription')}
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="storno-date">{t('StornoManager.stornoDateLabel')}</Label>
                      <Input
                        id="storno-date"
                        type="date"
                        value={stornoDate}
                        onChange={e => setStornoDate(e.target.value)}
                      />
                    </div>

                    <div>
                      <Label htmlFor="storno-reason">
                        {t('StornoManager.stornoReasonLabel')}
                      </Label>
                      <Textarea
                        id="storno-reason"
                        placeholder={t('StornoManager.stornoReasonPlaceholder')}
                        value={stornoReason}
                        onChange={e => setStornoReason(e.target.value)}
                        rows={3}
                      />
                    </div>

                    <Alert className="border-red-200 bg-red-50">
                      <Icon icon="lucide:alert-triangle" className="h-4 w-4 text-red-600" />
                      <AlertDescription className="text-red-800">
                        <strong>{t('StornoManager.attentionLabel')}</strong>{' '}
                        {t('StornoManager.stornoLockedHint')}
                      </AlertDescription>
                    </Alert>

                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => setStornoDialogOpen(false)}
                        disabled={processing}
                      >
                        {t('StornoManager.cancel')}
                      </Button>
                      <Button
                        className="flex-1 bg-red-500 text-white hover:bg-red-600"
                        onClick={handleStorno}
                        disabled={processing || !stornoReason.trim()}
                      >
                        {processing ? (
                          <>
                            <Icon icon="lucide:loader2" className="mr-2 h-4 w-4 animate-spin" />
                            {t('StornoManager.creating')}
                          </>
                        ) : (
                          <>
                            <Icon icon="lucide:file-x" className="mr-2 h-4 w-4" />
                            {t('StornoManager.createStornoSubmit')}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </CardContent>
        </Card>

        {/* Gutschrift */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon icon="lucide:credit-card" className="h-5 w-5 text-blue-500" />
              {t('StornoManager.creditCardTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4 text-gray-600 text-sm">{t('StornoManager.creditCardDescription')}</p>

            {!document.gobdStatus.isLocked ? (
              <Alert className="border-orange-200 bg-orange-50">
                <Icon icon="lucide:alert-triangle" className="h-4 w-4 text-orange-600" />
                <AlertDescription className="text-orange-800">
                  {t('StornoManager.creditRequiresLockedHint')}
                </AlertDescription>
              </Alert>
            ) : document.creditNoteId ? (
              <Alert className="border-green-200 bg-green-50">
                <Icon icon="lucide:check-circle" className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800">
                  {t('StornoManager.creditAlreadyCreated', {
                    creditId: document.creditNoteId,
                  })}
                </AlertDescription>
              </Alert>
            ) : (
              <Dialog open={creditDialogOpen} onOpenChange={setCreditDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    className="w-full bg-blue-500 text-white hover:bg-blue-600"
                    disabled={!canCreateCredit}
                  >
                    <Icon icon="lucide:credit-card" className="mr-2 h-4 w-4" />
                    {t('StornoManager.createCreditButton')}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{t('StornoManager.createCreditButton')}</DialogTitle>
                    <DialogDescription>
                      {t('StornoManager.creditDialogDescription')}
                    </DialogDescription>
                  </DialogHeader>

                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="credit-date">{t('StornoManager.creditDateLabel')}</Label>
                      <Input
                        id="credit-date"
                        type="date"
                        value={creditDate}
                        onChange={e => setCreditDate(e.target.value)}
                      />
                    </div>

                    <div>
                      <Label htmlFor="credit-amount">
                        {t('StornoManager.creditAmountLabel')}
                      </Label>
                      <div className="relative">
                        <Icon
                          icon="lucide:euro"
                          className="absolute top-3 left-3 h-4 w-4 text-gray-400"
                        />
                        <Input
                          id="credit-amount"
                          type="number"
                          min="0.01"
                          max={document.amount}
                          step="0.01"
                          value={creditAmount}
                          onChange={e => setCreditAmount(e.target.value)}
                          className="pl-10"
                        />
                      </div>
                      <p className="mt-1 text-gray-500 text-xs">
                        {t('StornoManager.creditMaximum', {
                          amount: formatCurrency(document.amount, document.currency),
                        })}
                      </p>
                    </div>

                    <div>
                      <Label htmlFor="credit-reason">
                        {t('StornoManager.creditReasonLabel')}
                      </Label>
                      <Textarea
                        id="credit-reason"
                        placeholder={t('StornoManager.creditReasonPlaceholder')}
                        value={creditReason}
                        onChange={e => setCreditReason(e.target.value)}
                        rows={3}
                      />
                    </div>

                    <Alert className="border-blue-200 bg-blue-50">
                      <Icon icon="lucide:check-circle" className="h-4 w-4 text-blue-600" />
                      <AlertDescription className="text-blue-800">
                        {t('StornoManager.creditLockedHint')}
                      </AlertDescription>
                    </Alert>

                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        className="flex-1"
                        onClick={() => setCreditDialogOpen(false)}
                        disabled={processing}
                      >
                        {t('StornoManager.cancel')}
                      </Button>
                      <Button
                        className="flex-1 bg-blue-500 text-white hover:bg-blue-600"
                        onClick={handleCreditNote}
                        disabled={processing || !creditReason.trim() || !creditAmount}
                      >
                        {processing ? (
                          <>
                            <Icon icon="lucide:loader2" className="mr-2 h-4 w-4 animate-spin" />
                            {t('StornoManager.creating')}
                          </>
                        ) : (
                          <>
                            <Icon icon="lucide:credit-card" className="mr-2 h-4 w-4" />
                            {t('StornoManager.createCreditSubmit')}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

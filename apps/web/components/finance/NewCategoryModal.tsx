'use client';

import { Icon } from '@iconify/react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@tasko/ui';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

interface CategoryValues {
  name: string;
  categoryType: string;
  contact: string;
  color: string;
  abbreviation: string;
  categoryKind: string;
}

export interface NewCategoryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  saving?: boolean;
  onSave?: (values: CategoryValues) => Promise<void>;
  companyId?: string;
  onSaved?: (categoryId: string, categoryData: CategoryValues) => void;
}

const DEFAULT_VALUES: CategoryValues = {
  name: '',
  categoryType: '',
  contact: '',
  color: '#000000',
  abbreviation: '',
  categoryKind: 'Verkauf',
};

export default function NewCategoryModal({
  open,
  onOpenChange,
  saving,
  onSave,
  companyId: _companyId,
  onSaved,
}: NewCategoryModalProps) {
  const t = useTranslations('finance');
  const [values, setValues] = useState<CategoryValues>(DEFAULT_VALUES);

  useEffect(() => {
    if (open) {
      setValues(DEFAULT_VALUES);
    }
  }, [open]);

  const isValid = () => {
    return values.name.trim() && values.categoryType.trim();
  };

  const handleSave = async () => {
    if (!isValid()) return;

    try {
      // Import API function dynamically
      const { createCategory } = await import('@/utils/api/companyApi');

      const response = await createCategory(values);
      if (response.success && response.categoryId) {
        if (onSaved) onSaved(response.categoryId, values);
        onOpenChange(false);
        return;
      }

      // Fallback: Eltern-Handler verwenden
      if (onSave) {
        await onSave(values);
      }
    } catch (error) {
      console.error('Fehler beim Speichern der Kategorie:', error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('NewCategoryModal.title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t('NewCategoryModal.nameLabel')}</Label>
            <Input
              value={values.name}
              onChange={e => setValues(p => ({ ...p, name: e.target.value }))}
              placeholder={t('NewCategoryModal.namePlaceholder')}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('NewCategoryModal.categoryTypeLabel')}</Label>
            <Input
              value={values.categoryType}
              onChange={e => setValues(p => ({ ...p, categoryType: e.target.value }))}
              placeholder={t('NewCategoryModal.categoryTypePlaceholder')}
            />
          </div>

          <div className="space-y-2">
            <Label>{t('NewCategoryModal.contactLabel')}</Label>
            <Input
              value={values.contact}
              onChange={e => setValues(p => ({ ...p, contact: e.target.value }))}
              placeholder={t('NewCategoryModal.contactPlaceholder')}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{t('NewCategoryModal.colorLabel')}</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="color"
                  value={values.color}
                  onChange={e => setValues(p => ({ ...p, color: e.target.value }))}
                  className="h-10 w-12 rounded border p-1"
                />
                <Input
                  type="text"
                  value={values.color}
                  onChange={e => setValues(p => ({ ...p, color: e.target.value }))}
                  placeholder="#000000"
                  className="flex-1"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('NewCategoryModal.abbreviationLabel')}</Label>
              <Input
                value={values.abbreviation}
                onChange={e => setValues(p => ({ ...p, abbreviation: e.target.value }))}
                placeholder={t('NewCategoryModal.abbreviationPlaceholder')}
                maxLength={5}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('NewCategoryModal.categoryKindLabel')}</Label>
            <Select
              value={values.categoryKind}
              onValueChange={val => setValues(p => ({ ...p, categoryKind: val }))}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('NewCategoryModal.categoryKindPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Verkauf">{t('NewCategoryModal.categoryKindSales')}</SelectItem>
                <SelectItem value="Einkauf">{t('NewCategoryModal.categoryKindPurchasing')}</SelectItem>
                <SelectItem value="Service">{t('NewCategoryModal.categoryKindService')}</SelectItem>
                <SelectItem value="Intern">{t('NewCategoryModal.categoryKindInternal')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-3 border-t pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {t('NewCategoryModal.cancel')}
            </Button>
            <Button
              className="bg-accent text-white hover:bg-accent/90"
              disabled={Boolean(saving) || !isValid()}
              onClick={handleSave}
            >
              {saving ? <Icon icon="lucide:loader2" className="mr-2 h-4 w-4 animate-spin" /> : null}
              {t('NewCategoryModal.submit')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

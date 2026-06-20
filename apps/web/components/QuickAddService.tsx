import { Button, Input } from '@tasko/ui';
import { useState } from 'react';
import { toast } from 'sonner';

import { api } from '@/lib/api-client';

interface QuickAddServiceProps {
  companyId: string;
  onServiceAdded: (service: {
    id: string;
    description: string;
    quantity: number;
    unitPrice: number;
    unit: string;
    total: number;
    category: string;
    inventoryItemId: string;
  }) => void;
}

interface ProductCreateResponse {
  id: string;
  name?: string;
  description?: string;
  price?: number;
  unit?: string;
}

export function QuickAddService({ companyId, onServiceAdded }: QuickAddServiceProps) {
  const [serviceName, setServiceName] = useState('');
  const [servicePrice, setServicePrice] = useState('');
  const [saving, setSaving] = useState(false);

  const handleAddService = async () => {
    if (!companyId || !serviceName.trim()) {
      toast.error('Bitte geben Sie einen Namen für die Dienstleistung ein');
      return;
    }

    setSaving(true);
    try {
      const serviceData = {
        name: serviceName.trim(),
        description: '',
        price: parseFloat(servicePrice) || 0,
        unit: 'Std',
        company_id: companyId,
        category: 'Dienstleistung',
      };

      const result = await api.post<ProductCreateResponse>('/api/v1/products', serviceData);

      const newItem = {
        id: crypto.randomUUID(),
        description: serviceData.name,
        quantity: 1,
        unitPrice: serviceData.price,
        unit: serviceData.unit,
        total: serviceData.price,
        category: 'Dienstleistung',
        inventoryItemId: result.id,
      };

      onServiceAdded(newItem);

      setServiceName('');
      setServicePrice('');
      toast.success('Dienstleistung hinzugefügt');
    } catch (e) {
      console.error('Fehler beim Hinzufügen der Dienstleistung:', e);
      toast.error('Fehler beim Speichern der Dienstleistung');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Input
        placeholder="Neue Dienstleistung (z.B. Beratung)"
        value={serviceName}
        onChange={e => setServiceName(e.target.value)}
        className="min-w-50"
      />
      <Input
        placeholder="Preis"
        type="number"
        step="0.01"
        value={servicePrice}
        onChange={e => setServicePrice(e.target.value)}
        className="w-24"
      />
      <Button
        onClick={handleAddService}
        disabled={saving || !serviceName.trim()}
        className="bg-accent text-white hover:bg-accent/90"
      >
        {saving ? (
          <span className="flex items-center gap-2">
            <span className="animate-spin">⌛</span> Speichert...
          </span>
        ) : (
          'Hinzufügen'
        )}
      </Button>
    </div>
  );
}

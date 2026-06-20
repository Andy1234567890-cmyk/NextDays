import { Icon } from '@iconify/react';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@tasko/ui';
import { QuickAddService } from '@/components/QuickAddService';

import { cn } from '@/lib/utils';

interface InvoiceItemsCardProps {
  uid: string;
  showNet: boolean;
  setShowNet: (value: boolean) => void;
  onAddItem: () => void;
  onAddInventoryItem: () => void;
  onAddDiscount: () => void;
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

export function InvoiceItemsCard({
  uid,
  showNet,
  setShowNet,
  onAddItem,
  onAddInventoryItem,
  onAddDiscount,
  onServiceAdded,
}: InvoiceItemsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Icon icon="lucide:calculator" className="mr-2 h-5 w-5 text-accent" />
          Produkte
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="mb-3 flex items-center justify-between">
          <div className="text-gray-600 text-sm">Preisanzeige</div>
          <div className="flex gap-2">
            <Button
              className={cn(showNet ? 'bg-accent text-white hover:bg-accent/90' : 'border')}
              onClick={() => setShowNet(true)}
            >
              Netto
            </Button>
            <Button
              className={cn(!showNet ? 'bg-accent text-white hover:bg-accent/90' : 'border')}
              onClick={() => setShowNet(false)}
            >
              Brutto
            </Button>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Button variant="link" className="text-accent" onClick={onAddItem}>
            + Position hinzufügen
          </Button>

          <Button
            variant="outline"
            className="border-accent text-accent hover:bg-accent hover:text-white"
            onClick={onAddInventoryItem}
          >
            <Icon icon="lucide:package" className="mr-2 h-4 w-4" />
            Aus Inventar hinzufügen
          </Button>

          <Button variant="link" className="text-accent" onClick={onAddDiscount}>
            + Gesamtrabatt hinzufügen
          </Button>

          <div className="ml-2 flex items-center gap-2 border-gray-200 border-l pl-4">
            <QuickAddService companyId={uid} onServiceAdded={onServiceAdded} />
          </div>
        </div>

        {/* Hier kommen die Rechnungspositionen */}
      </CardContent>
    </Card>
  );
}

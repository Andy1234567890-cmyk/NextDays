'use client';

// Card „Positionen" der Rechnungserstellung (aus create-invoice-page.tsx extrahiert):
// Brutto/Netto-Schalter, Positions-Steuerleiste (InventorySelector, Rabatt,
// Dienstleistungs-Suche + Anlage-Dialog), Positions-Tabelle mit
// Produkt-anlegen-Popover. Geteilte States/Handler kommen als Props;
// showPopover und newServiceName sind lokale UI-States (lebten vorher im selben JSX-Block).

import { Icon } from '@iconify/react';
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Popover,
  PopoverAnchor,
  PopoverContent,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@tasko/ui';
import { type Dispatch, type SetStateAction, useState } from 'react';
import { toast } from 'sonner';
import {
  computeItemTotalNet,
  syncGrossFromNet,
  UNIT_OPTIONS,
} from '@/components/finance/create-invoice/calc';
import type { InvoiceService } from '@/components/finance/create-invoice/use-invoice-loaders';
import type { NewProductValues } from '@/components/inventory/NewProductModal';
import InventorySelector from '@/components/quotes/InventorySelector';
import { NativeSelect } from '@/components/ui/native-select';
import type { QuoteItem } from '@/services/quoteService';

type ItemsCardProps = {
  uid: string;
  items: QuoteItem[];
  setItems: Dispatch<SetStateAction<QuoteItem[]>>;
  taxRate: number;
  showNet: boolean;
  setShowNet: Dispatch<SetStateAction<boolean>>;
  formatCurrency: (amount: number) => string;
  // Belegwährung — für die Preisanzeige im Inventar-Auswähler (kein €-Hardcode).
  currency?: string;
  savedServices: InvoiceService[];
  loadingSavedServices: boolean;
  serviceModalOpen: boolean;
  setServiceModalOpen: Dispatch<SetStateAction<boolean>>;
  serviceDraft: { name: string; description: string; price: string; unit: string };
  setServiceDraft: Dispatch<
    SetStateAction<{ name: string; description: string; price: string; unit: string }>
  >;
  saveServiceToSubcollection: () => Promise<void>;
  popoverOpenIds: Set<string>;
  handleDescriptionChange: (index: number, id: string, value: string) => void;
  handleItemChange: (
    index: number,
    field: keyof QuoteItem,
    value: string | number | boolean,
  ) => void;
  removeItem: (index: number) => void;
  setDismissedCreatePromptIds: Dispatch<SetStateAction<Set<string>>>;
  setNewProduct: Dispatch<SetStateAction<NewProductValues>>;
  setCreateProductForIndex: Dispatch<SetStateAction<number | null>>;
  setCreateProductOpen: Dispatch<SetStateAction<boolean>>;
};

export default function ItemsCard({
  uid,
  items,
  setItems,
  taxRate,
  showNet,
  setShowNet,
  formatCurrency,
  currency,
  savedServices,
  loadingSavedServices,
  serviceModalOpen,
  setServiceModalOpen,
  serviceDraft,
  setServiceDraft,
  saveServiceToSubcollection,
  popoverOpenIds,
  handleDescriptionChange,
  handleItemChange,
  removeItem,
  setDismissedCreatePromptIds,
  setNewProduct,
  setCreateProductForIndex,
  setCreateProductOpen,
}: ItemsCardProps) {
  // Lokale UI-States (lebten vorher im selben JSX-Block)
  const [showPopover, setShowPopover] = useState(false);
  const [newServiceName, setNewServiceName] = useState<string>('');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Icon icon="lucide:calculator" className="mr-2 h-5 w-5 text-accent" />
          Positionen
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Brutto/Netto Schalter */}
        <div className="mb-3 flex items-center justify-between">
          <div className="text-gray-600 text-sm">Preisanzeige</div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant={showNet ? 'default' : 'outline'}
              className={showNet ? 'bg-accent text-white hover:bg-accent/90' : ''}
              onClick={() => setShowNet(true)}
              size="sm"
            >
              Netto
            </Button>
            <Button
              type="button"
              variant={!showNet ? 'default' : 'outline'}
              className={!showNet ? 'bg-accent text-white hover:bg-accent/90' : ''}
              onClick={() => setShowNet(false)}
              size="sm"
            >
              Brutto
            </Button>
          </div>
        </div>

        {/* Positions-Steuerleiste */}
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="link"
            onClick={() => {
              const newItem: QuoteItem = {
                id:
                  typeof crypto !== 'undefined' && 'randomUUID' in crypto
                    ? crypto.randomUUID()
                    : Math.random().toString(36).slice(2),
                description: '',
                quantity: 1,
                unitPrice: 0,
                total: 0,
                taxRate: taxRate, // Verwende globalen Steuersatz als Standard
              };
              setItems(prev => [...prev, newItem]);
            }}
            className="px-0 text-accent"
          >
            + Position hinzufügen
          </Button>
          <InventorySelector
            companyId={uid}
            currency={currency}
            onSelectItem={(invItem, quantity) => {
              const qty = Math.max(1, quantity || 1);
              const unitPriceNet = invItem.sellingPrice || 0;
              const newItem: QuoteItem = {
                id:
                  typeof crypto !== 'undefined' && 'randomUUID' in crypto
                    ? crypto.randomUUID()
                    : Math.random().toString(36).slice(2),
                description: invItem.name,
                quantity: qty,
                unitPrice: unitPriceNet,
                total: computeItemTotalNet(qty, unitPriceNet),
                unit: invItem.unit,
                inventoryItemId: invItem.id,
                discountPercent: 0,
                taxRate: taxRate, // Verwende globalen Steuersatz als Standard
              };
              setItems(prev => [...prev, newItem]);
            }}
            selectedItems={items.map(i => i.inventoryItemId).filter(Boolean) as string[]}
          />

          <Button
            type="button"
            variant="link"
            onClick={() => {
              const newItem: QuoteItem = {
                id:
                  typeof crypto !== 'undefined' && 'randomUUID' in crypto
                    ? crypto.randomUUID()
                    : Math.random().toString(36).slice(2),
                description: 'Gesamtrabatt',
                quantity: 1,
                unitPrice: 0,
                total: 0,
                category: 'discount',
                // KEIN fester Steuersatz: der Rabatt mindert die Bemessungs-
                // grundlage mit dem geltenden Satz (?? taxRate in calc/Payload)
                // — fest 0 % ließe die USt auf der unrabattierten Basis stehen
                // (überhöhter Ausweis, §14c-Risiko).
              };
              setItems(prev => [...prev, newItem]);
            }}
            className="px-0 text-accent"
          >
            + Gesamtrabatt hinzufügen
          </Button>

          {/* Dienstleistung anlegen */}
          <div className="ml-2 flex items-center gap-2 border-gray-200 border-l pl-4">
            <div className="relative w-125">
              <Input
                type="text"
                value={newServiceName || ''}
                onChange={e => {
                  const value = e.target.value;
                  setNewServiceName(value);
                  // Zeige Dropdown ab 2 Zeichen
                  if (value.trim().length >= 2) {
                    setShowPopover(true);
                  } else {
                    setShowPopover(false);
                  }
                }}
                placeholder="Leistung suchen oder neu erstellen (Frühstück, Wellness, Parkplatz …)"
                className="w-full"
              />

              {/* Dropdown für Vorschläge */}
              {showPopover && (
                <div className="absolute right-0 left-0 z-50 mt-1 rounded-lg border bg-white shadow-lg">
                  <div className="max-h-100 overflow-y-auto p-4">
                    {loadingSavedServices ? (
                      <div className="flex items-center gap-2 p-2">
                        <Icon icon="lucide:loader2" className="h-4 w-4 animate-spin" />
                        <span>Lade Leistungen...</span>
                      </div>
                    ) : (
                      <>
                        {/* Vorhandene Dienstleistungen */}
                        {(savedServices || [])
                          .filter(
                            service =>
                              !newServiceName ||
                              service.name.toLowerCase().includes(newServiceName.toLowerCase()),
                          )
                          .map(service => (
                            <div
                              key={service.id}
                              className="flex cursor-pointer items-center justify-between rounded-md p-2 hover:bg-gray-100"
                              onClick={() => {
                                const price =
                                  typeof service.price === 'string'
                                    ? parseFloat(service.price)
                                    : service.price;
                                setItems(prev => [
                                  ...prev,
                                  {
                                    id: crypto.randomUUID(),
                                    description: service.name,
                                    quantity: 1,
                                    unitPrice: price,
                                    total: price,
                                    unit: service.unit || 'Stk',
                                    taxRate: taxRate, // Verwende globalen Steuersatz als Standard
                                  },
                                ]);
                                setNewServiceName('');
                                setShowPopover(false);
                                toast.success('Leistung zur Rechnung hinzugefügt');
                              }}
                            >
                              <div>
                                <div className="font-medium">{service.name}</div>
                                <div className="text-gray-500 text-sm">{service.unit}</div>
                              </div>
                              <div className="font-medium">
                                {formatCurrency(
                                  typeof service.price === 'string'
                                    ? parseFloat(service.price)
                                    : service.price,
                                )}
                              </div>
                            </div>
                          ))}

                        {/* Option zum Erstellen einer neuen Dienstleistung */}
                        {newServiceName && newServiceName.trim().length >= 2 && (
                          <div
                            className={
                              savedServices.filter(service =>
                                service.name
                                  .toLowerCase()
                                  .includes(newServiceName.toLowerCase()),
                              ).length > 0
                                ? 'mt-2 border-gray-200 border-t pt-2'
                                : ''
                            }
                          >
                            <div
                              className="cursor-pointer rounded-md p-2 hover:bg-gray-100"
                              onClick={() => {
                                setServiceDraft({
                                  name: newServiceName,
                                  description: '',
                                  price: '',
                                  unit: 'Stk',
                                });
                                setServiceModalOpen(true);
                                setNewServiceName('');
                                setShowPopover(false);
                              }}
                            >
                              <div className="flex items-center gap-2 text-gray-600 text-sm">
                                <Icon icon="lucide:plus" className="h-4 w-4" />
                                <span>
                                  Neue Leistung &quot;{newServiceName}&quot; erstellen
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
          {/* Modal für neue Dienstleistung */}
          <Dialog open={serviceModalOpen} onOpenChange={setServiceModalOpen}>
            <DialogContent className="max-w-md" aria-describedby="service-dialog-description">
              <DialogHeader>
                <DialogTitle>Neue Leistung anlegen</DialogTitle>
                <div id="service-dialog-description" className="sr-only">
                  Dialog zum Anlegen einer neuen Leistung mit Name und weiteren Details
                </div>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className="mb-1 block font-medium text-sm">Name *</label>
                  <input
                    type="text"
                    className="w-full rounded border px-2 py-1"
                    value={serviceDraft.name}
                    onChange={e => setServiceDraft(d => ({ ...d, name: e.target.value }))}
                    required
                  />
                </div>
                <div>
                  <label className="mb-1 block font-medium text-sm">Beschreibung</label>
                  <textarea
                    className="w-full rounded border px-2 py-1"
                    value={serviceDraft.description}
                    onChange={e =>
                      setServiceDraft(d => ({ ...d, description: e.target.value }))
                    }
                    rows={2}
                  />
                </div>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="mb-1 block font-medium text-sm">Preis *</label>
                    <input
                      type="number"
                      className="w-full rounded border px-2 py-1"
                      value={serviceDraft.price}
                      onChange={e => setServiceDraft(d => ({ ...d, price: e.target.value }))}
                      min="0"
                      required
                    />
                  </div>
                  <div>
                    <label className="mb-1 block font-medium text-sm">Einheit</label>
                    <NativeSelect
                      value={serviceDraft.unit}
                      onChange={e => setServiceDraft(d => ({ ...d, unit: e.target.value }))}
                    >
                      <option value="Stk">Stk</option>
                      <option value="Std">Std</option>
                      <option value="Pauschale">Pauschale</option>
                      <option value="%">%</option>
                      <option value="Tag(e)">Tag(e)</option>
                    </NativeSelect>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  className="bg-accent text-white hover:bg-accent/90"
                  onClick={async () => {
                    if (!serviceDraft.name.trim() || !serviceDraft.price) return;

                    // 1. Zuerst via API speichern
                    await saveServiceToSubcollection();

                    // 2. Dann als Position zur Rechnung hinzufügen
                    setItems(prev => [
                      ...prev,
                      {
                        id:
                          typeof crypto !== 'undefined' && 'randomUUID' in crypto
                            ? crypto.randomUUID()
                            : Math.random().toString(36).slice(2),
                        description:
                          serviceDraft.name +
                          (serviceDraft.description ? `: ${serviceDraft.description}` : ''),
                        quantity: 1,
                        unitPrice: parseFloat(serviceDraft.price),
                        total: parseFloat(serviceDraft.price),
                        unit: serviceDraft.unit,
                        taxRate: taxRate, // Verwende globalen Steuersatz als Standard
                      },
                    ]);

                    // 3. Dialog schließen und Form zurücksetzen
                    setServiceModalOpen(false);
                    setServiceDraft({ name: '', description: '', price: '', unit: 'Stk' });
                    toast.success('Leistung zur Rechnung hinzugefügt');
                  }}
                  disabled={!serviceDraft.name.trim() || !serviceDraft.price}
                >
                  Speichern & hinzufügen
                </Button>
                <DialogClose asChild>
                  <Button variant="outline" type="button">
                    Abbrechen
                  </Button>
                </DialogClose>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Header-Zeile für Spalten (nur einmal anzeigen) */}
        {items.length > 0 && (
          <div className="flex gap-3 rounded-lg bg-gray-50 px-4 py-2 font-medium text-gray-700 text-sm">
            <div style={{ flex: 1 }}>
              <label className="block">Leistung / Position</label>
            </div>
            <div style={{ width: '80px' }}>
              <label className="block">Menge</label>
            </div>
            <div style={{ width: '100px' }}>
              <label className="block">Einheit</label>
            </div>
            <div style={{ width: '120px' }}>
              <label className="block">
                Preis <small>({showNet ? 'Netto' : 'Brutto'})</small>
              </label>
            </div>
            <div style={{ width: '80px' }}>
              <label className="block">USt.</label>
            </div>
            <div style={{ width: '80px' }}>
              <label className="block">Rabatt</label>
            </div>
            <div style={{ width: '100px', textAlign: 'right' }}>
              <label className="block">Betrag</label>
            </div>
            <div style={{ width: '36px' }}></div>
          </div>
        )}

        {/* Positionsliste */}
        <div className="space-y-2">
          {items.map((item, index) => {
            const itemTaxRate = item.taxRate ?? taxRate;
            const unitPriceDisplay = showNet
              ? item.unitPrice
              : item.unitPrice * (1 + itemTaxRate / 100);
            // Rabatt-Positionen als negative Beträge darstellen
            const baseTotalNet = item.total || 0;
            const sign = item.category === 'discount' ? -1 : 1;
            // Positions-Rabatt anwenden, außer bei speziellen Rabatt-Positionszeilen
            const discountFactor =
              item.category === 'discount'
                ? 1
                : 1 - Math.max(0, Math.min(100, item.discountPercent || 0)) / 100;
            const totalNet = baseTotalNet * sign * discountFactor;
            const totalGross = totalNet * (1 + itemTaxRate / 100);
            return (
              <div key={item.id} className="rounded-lg border border-gray-200">
                {/* Hauptzeile mit allen Feldern */}
                <div className="flex items-end gap-3 p-4 hover:bg-gray-50">
                  <div style={{ flex: 1 }}>
                    <div className="sr-only">
                      <Label>Beschreibung</Label>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            aria-label="Hinweis zur Beschreibung"
                            className="inline-flex cursor-help"
                          >
                            <Icon icon="lucide:info" className="h-4 w-4 text-accent" />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="top" align="start" className="max-w-xs text-sm">
                          <p>
                            Hinweis: Die Beschreibung ist für den Kunden sichtbar. Du kannst
                            auch die SKU oder den exakten Produktnamen eingeben, um Werte
                            automatisch aus dem Inventar zu übernehmen.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                    <Popover
                      open={popoverOpenIds.has(item.id)}
                      onOpenChange={open => {
                        if (!open) {
                          setDismissedCreatePromptIds(prev => new Set(prev).add(item.id));
                        }
                      }}
                    >
                      <div className="relative">
                        <Input
                          value={item.description}
                          onChange={e =>
                            handleDescriptionChange(index, item.id, e.target.value)
                          }
                          placeholder={
                            item.category === 'discount'
                              ? 'Rabatt / Nachlass'
                              : 'Leistungsbeschreibung'
                          }
                        />

                        <PopoverAnchor />
                      </div>
                      <PopoverContent side="bottom" align="start">
                        <div className="text-sm">
                          <div className="mb-2 font-medium">Als Produkt speichern?</div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              className="bg-accent text-white hover:bg-accent/90"
                              onClick={() => {
                                const rate = Number.isFinite(taxRate) ? taxRate : 19;
                                const name = item.description || '';
                                const unit = (item.unit as string) || 'Stk';
                                const sellingNet = Number.isFinite(item.unitPrice)
                                  ? item.unitPrice
                                  : 0;
                                setNewProduct({
                                  name,
                                  imageUrl: '',
                                  sku: '',
                                  category: 'Artikel',
                                  unit,
                                  stock: 0,
                                  taxRate: rate,
                                  purchaseNet: 0,
                                  purchaseGross: 0,
                                  sellingNet,
                                  sellingGross: Number(
                                    syncGrossFromNet(sellingNet, rate).toFixed(2),
                                  ),
                                  description: '',
                                  internalNote: '',
                                });
                                setCreateProductForIndex(index);
                                setCreateProductOpen(true);
                                setDismissedCreatePromptIds(prev => new Set(prev).add(item.id));
                              }}
                            >
                              Produkt erstellen
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() =>
                                setDismissedCreatePromptIds(prev => new Set(prev).add(item.id))
                              }
                            >
                              Später
                            </Button>
                          </div>
                        </div>
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div style={{ width: '80px' }}>
                    <div className="sr-only">
                      <Label>Menge</Label>
                    </div>
                    <Input
                      type="number"
                      value={item.quantity}
                      onChange={e =>
                        handleItemChange(index, 'quantity', parseFloat(e.target.value) || 0)
                      }
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div style={{ width: '100px' }}>
                    <div className="sr-only">
                      <Label>Einheit</Label>
                    </div>
                    <Select
                      value={(item.unit as string) ?? 'Stk'}
                      onValueChange={val => {
                        const mapped = val === 'none' ? '' : val;
                        setItems(prev =>
                          prev.map((it, i) => (i === index ? { ...it, unit: mapped } : it)),
                        );
                      }}
                      disabled={item.category === 'discount'}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Einheit" />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        {UNIT_OPTIONS.map(u => (
                          <SelectItem key={u.value || 'blank'} value={u.value}>
                            {u.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div style={{ width: '120px' }}>
                    <div className="sr-only">
                      <Label>
                        Preis
                        <small className="font-normal text-gray-500">
                          {' '}
                          ({showNet ? 'Netto' : 'Brutto'})
                        </small>
                      </Label>
                    </div>
                    <Input
                      type="number"
                      value={
                        Number.isFinite(unitPriceDisplay)
                          ? Number(unitPriceDisplay.toFixed(2))
                          : 0
                      }
                      onChange={e =>
                        handleItemChange(index, 'unitPrice', parseFloat(e.target.value) || 0)
                      }
                      min="0"
                      step="0.01"
                      className="h-8 w-28 px-2 text-sm md:w-32"
                    />
                  </div>
                  <div style={{ width: '80px' }}>
                    <div className="sr-only">
                      <Label>USt. %</Label>
                    </div>
                    <Select
                      value={(item.taxRate ?? taxRate).toString()}
                      onValueChange={val => {
                        const newTaxRate = parseFloat(val);
                        setItems(prev =>
                          prev.map((it, i) =>
                            i === index ? { ...it, taxRate: newTaxRate } : it,
                          ),
                        );
                      }}
                      disabled={item.category === 'discount'}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">0%</SelectItem>
                        <SelectItem value="7">7%</SelectItem>
                        <SelectItem value="19">19%</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div style={{ width: '80px' }}>
                    <div className="sr-only">
                      <Label>Rabatt %</Label>
                    </div>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={0.1}
                      value={item.category === 'discount' ? 0 : (item.discountPercent ?? 0)}
                      onChange={e => {
                        const v = parseFloat(e.target.value);
                        setItems(prev =>
                          prev.map((it, i) =>
                            i === index
                              ? {
                                ...it,
                                discountPercent: Number.isFinite(v)
                                  ? Math.max(0, Math.min(100, v))
                                  : 0,
                              }
                              : it,
                          ),
                        );
                      }}
                      disabled={item.category === 'discount'}
                    />
                  </div>
                  <div style={{ width: '100px', textAlign: 'right' }}>
                    <div className="sr-only">
                      <Label>Betrag</Label>
                    </div>
                    <div
                      className={`flex h-10 items-center justify-end font-medium text-sm ${item.category === 'discount' ? 'text-red-600' : ''}`}
                    >
                      {formatCurrency(showNet ? totalNet : totalGross)}
                    </div>
                  </div>
                  <div style={{ width: '36px' }} className="flex items-end">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => removeItem(index)}
                      className="w-full text-red-600 hover:bg-red-50 hover:text-red-700"
                      disabled={items.length === 1}
                    >
                      <Icon icon="lucide:x" className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                {/* Erweiterte Beschreibung - Automatisch anzeigen wenn Beschreibung vorhanden */}
                {item.description && item.description.trim().length > 0 && (
                  <div className="px-4 pb-4">
                    <textarea
                      placeholder="Erweiterte Beschreibung (optional) - wird auf der Rechnung unter der Position angezeigt"
                      value={item.extendedDescription || ''}
                      onChange={e => {
                        setItems(prev =>
                          prev.map((it, i) =>
                            i === index ? { ...it, extendedDescription: e.target.value } : it,
                          ),
                        );
                      }}
                      className="w-full resize-none rounded-md border border-gray-200 px-3 py-2 text-sm focus:border-transparent focus:outline-none focus:ring-2 focus:ring-accent"
                      rows={4}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

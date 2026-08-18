'use client';

import { Icon } from '@iconify/react';
import { useTranslations } from "next-intl";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@tasko/ui';
import { useCallback, useEffect, useState } from 'react';

import { formatCurrency } from '@/lib/currency';
import { type InventoryItem, InventoryService } from '@/services/inventoryService';

interface InventorySelectorProps {
  companyId: string;
  onSelectItem: (item: InventoryItem, quantity: number) => void;
  selectedItems?: string[]; // IDs bereits ausgewählter Items
  quickAddOnClick?: boolean; // optional: beim Klick sofort ersten verfügbaren Artikel hinzufügen
  // Währung des Belegs/der Rechnung — der Artikelpreis wird darin angezeigt
  // (kein währungsloser Betrag). Optional: fehlt sie, zeigt formatCurrency die
  // reine Zahl (kein erfundenes €-Symbol).
  currency?: string;
}

export default function InventorySelector({
  companyId,
  onSelectItem,
  selectedItems = [],
  quickAddOnClick = false,
  currency,
}: InventorySelectorProps) {
  const t = useTranslations("quotes");
  const [isOpen, setIsOpen] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedQuantities, setSelectedQuantities] = useState<{ [key: string]: number }>({});

  // Inventar-Items laden
  // Stabil per useCallback, damit die Funktion in die Effect-Deps darf.
  const loadInventoryItems = useCallback(async () => {
    if (!companyId) return;

    setLoading(true);
    try {
      const items = await InventoryService.getInventoryItems(companyId);
      // Debug-Log
      // Alle Items anzeigen, nur discontinued ausschließen
      const availableItems = items.filter(item => item.status !== 'discontinued');
      setInventoryItems(availableItems);
      setFilteredItems(availableItems);
    } catch (fehler) {
      // Bestand konnte nicht geladen werden: die Liste bleibt leer. Nicht
      // stillschweigend verschlucken — sonst sieht ein Ladefehler aus wie
      // "kein Inventar vorhanden".
      console.error('Inventar konnte nicht geladen werden:', fehler);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  // Items filtern basierend auf Suchbegriff
  useEffect(() => {
    if (!searchTerm.trim()) {
      setFilteredItems(inventoryItems);
      return;
    }

    const filtered = inventoryItems.filter(
      item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.category.toLowerCase().includes(searchTerm.toLowerCase()),
    );
    setFilteredItems(filtered);
  }, [searchTerm, inventoryItems]);

  // Items laden wenn Modal geöffnet wird
  useEffect(() => {
    if (isOpen && inventoryItems.length === 0) {
      void loadInventoryItems();
    }
  }, [isOpen, inventoryItems.length, loadInventoryItems]);

  // Item zur Auswahl hinzufügen
  const handleSelectItem = (item: InventoryItem) => {
    const quantity = selectedQuantities[item.id] || 1;
    onSelectItem(item, quantity);
    setIsOpen(false);

    // Menge zurücksetzen
    setSelectedQuantities(prev => ({
      ...prev,
      [item.id]: 1,
    }));
  };

  // Menge für Item ändern
  const handleQuantityChange = (itemId: string, quantity: number) => {
    setSelectedQuantities(prev => ({
      ...prev,
      [itemId]: Math.max(1, quantity),
    }));
  };

  // Quick-Add-Logik: beim Klick auf den Trigger direkt ersten verfügbaren Artikel hinzufügen
  const handleTriggerClick = async () => {
    if (!quickAddOnClick) {
      setIsOpen(true);
      return;
    }
    // Quick-Add: optional, nur wenn explizit gesetzt
    let items: InventoryItem[] = inventoryItems;
    if (items.length === 0) {
      try {
        items = await InventoryService.getInventoryItems(companyId);
      } catch {
        setIsOpen(true);
        return;
      }
    }
    const candidate = items.find(it => {
      const availableStock = it.currentStock - (it.reservedStock || 0);
      return it.status !== 'discontinued' && availableStock > 0;
    });
    if (candidate) {
      onSelectItem(candidate, 1);
      return;
    }
    setIsOpen(true);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="outline"
          onClick={handleTriggerClick}
          className="border-accent text-accent hover:bg-accent hover:text-white"
        >
          <Icon icon="lucide:package" className="mr-2 h-4 w-4" />
          Aus Inventar hinzufügen
        </Button>
      </DialogTrigger>

      <DialogContent
        className="max-h-[90vh] w-[95vw] max-w-none overflow-hidden"
        style={{ minWidth: '1200px', width: '95vw' }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon icon="lucide:package" className="h-5 w-5 text-accent" />
            Artikel aus Inventar auswählen
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Suchfeld */}
          <div className="relative">
            <Icon
              icon="lucide:search"
              className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-gray-400"
            />
            <Input
              placeholder={t("searchItems")}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-10 focus:border-accent focus:ring-accent"
            />
          </div>

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Icon icon="lucide:loader-circle" className="h-6 w-6 animate-spin text-accent" />
              <span className="ml-2 text-gray-600">{t("loadingInventory")}</span>
            </div>
          )}

          {/* Keine Items gefunden */}
          {!loading && filteredItems.length === 0 && (
            <div className="py-8 text-center">
              <Icon icon="lucide:package" className="mx-auto mb-3 h-12 w-12 text-gray-400" />
              <p className="text-gray-600">
                {searchTerm ? 'Keine Artikel gefunden' : 'Keine Artikel im Inventar'}
              </p>
              {searchTerm && (
                <p className="mt-1 text-gray-500 text-sm">
                  Versuchen Sie einen anderen Suchbegriff
                </p>
              )}
              {!searchTerm && (
                <p className="mt-1 text-gray-500 text-sm">
                  Fügen Sie Artikel in Ihrem Inventar hinzu, um sie hier auszuwählen
                </p>
              )}
            </div>
          )}

          {/* Inventar-Tabelle */}
          {!loading && filteredItems.length > 0 && (
            <div className="overflow-hidden rounded-lg border">
              <div className="max-h-[60vh] overflow-x-auto overflow-y-auto">
                <Table className="min-w-285">
                  <TableHeader className="sticky top-0 bg-gray-50">
                    <TableRow>
                      <TableHead className="w-75 min-w-75">Artikel</TableHead>
                      <TableHead className="w-35 min-w-35">SKU</TableHead>
                      <TableHead className="w-37 min-w-37">Kategorie</TableHead>
                      <TableHead className="w-45 min-w-45">{t("available")}</TableHead>
                      <TableHead className="w-30 min-w-30">Preis</TableHead>
                      <TableHead className="w-25 min-w-25">Menge</TableHead>
                      <TableHead className="w-37 min-w-37">Aktion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.map(item => {
                      const availableStock = item.currentStock - (item.reservedStock || 0);

                      return (
                        <TableRow
                          key={item.id}
                          className={selectedItems.includes(item.id) ? 'bg-green-50' : ''}
                        >
                          <TableCell>
                            <div>
                              <div className="font-medium text-gray-900">{item.name}</div>
                              {item.description && (
                                <div className="mt-1 break-words text-gray-500 text-sm">
                                  {item.description}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <code className="rounded bg-gray-100 px-2 py-1 font-mono text-xs">
                              {item.sku}
                            </code>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="px-2 py-1 text-xs">
                              {item.category}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              <div className="flex items-center gap-1">
                                <span
                                  className={`font-medium ${
                                    availableStock <= 0
                                      ? 'text-red-600'
                                      : availableStock <= item.minStock
                                        ? 'text-orange-600'
                                        : 'text-green-600'
                                  }`}
                                >
                                  {availableStock}
                                </span>
                                <span className="text-gray-500 text-xs">{t("availableLower")}</span>
                                {availableStock <= 0 && (
                                  <Icon
                                    icon="lucide:alert-circle"
                                    className="h-3 w-3 text-red-500"
                                    aria-label={t("notAvailable")}
                                  />
                                )}
                                {availableStock > 0 && availableStock <= item.minStock && (
                                  <Icon
                                    icon="lucide:alert-circle"
                                    className="h-3 w-3 text-orange-500"
                                    aria-label={t("lowStock")}
                                  />
                                )}
                              </div>
                              {item.reservedStock && item.reservedStock > 0 && (
                                <div className="text-gray-500 text-xs">
                                  {item.reservedStock} reserviert
                                </div>
                              )}
                              <div className="text-gray-500 text-xs">
                                Gesamt: {item.currentStock} {item.unit}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="font-medium">
                              {formatCurrency(item.sellingPrice, currency)}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="1"
                              value={selectedQuantities[item.id] || 1}
                              onChange={e =>
                                handleQuantityChange(item.id, parseInt(e.target.value, 10) || 1)
                              }
                              className="w-16 text-center text-sm"
                              disabled={availableStock <= 0}
                            />
                          </TableCell>
                          <TableCell>
                            {selectedItems.includes(item.id) ? (
                              <div className="flex items-center gap-1 text-green-600">
                                <Icon icon="lucide:check" className="h-4 w-4" />
                                <span className="text-xs">{t("added")}</span>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                onClick={() => handleSelectItem(item)}
                                className="bg-accent text-white hover:bg-accent/90"
                                disabled={availableStock <= 0}
                              >
                                <Icon icon="lucide:plus" className="mr-1 h-3 w-3" />
                                {availableStock <= 0 ? 'Nicht verfügbar' : 'Hinzufügen'}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {/* Info-Text */}
          <div className="rounded-lg bg-blue-50 p-3 text-gray-500 text-xs">
            <div className="flex items-start gap-2">
              <Icon icon="lucide:alert-circle" className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
              <div>
                <p className="font-medium text-blue-800">Hinweise:</p>
                <ul className="mt-1 list-inside list-disc space-y-1">
                  <li>{t("hint1")}</li>
                  <li>{t("hint2")}</li>
                  <li>{t("hint3")}</li>
                  <li>{t("hint4")}</li>
                  <li>{t("hint5")}</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

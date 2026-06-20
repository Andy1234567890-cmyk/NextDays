'use client';

import { api, apiClient } from '@/lib/api-client';

// Gewichts- und Volumeneinheiten für Inventur
export type WeightVolumeUnit = 'kg' | 'g' | 'mg' | 'L' | 'ml' | 'cl' | 'm' | 'cm' | 'mm' | 'Stück';

// Verkaufs-/Lagereinheiten
export type SalesUnit =
  | 'Stück'
  | 'Flasche'
  | 'Dose'
  | 'Packung'
  | 'Karton'
  | 'Kiste'
  | 'Palette'
  | 'Beutel'
  | 'Sack'
  | 'Rolle'
  | 'Meter'
  | 'Liter'
  | 'kg';

// Verpackungshierarchie für Gebinde (z.B. 0,33L Flaschen in 24er Kasten)
export interface PackagingUnit {
  name: string; // z.B. "6er-Pack", "24er-Kasten", "Palette"
  quantity: number; // Anzahl der Basiseinheiten pro Verpackung
  barcode?: string; // EAN für diese Verpackungseinheit
  weight?: number; // Gewicht der Verpackungseinheit inkl. Verpackung
  dimensions?: {
    length: number;
    width: number;
    height: number;
    unit: 'cm' | 'mm' | 'm';
  };
}

export interface InventoryItem {
  id: string;
  name: string;
  description?: string;
  sku: string; // Artikelnummer/SKU
  category: string;
  unit: string; // Basiseinheit (Stück, Flasche, Dose, etc.)
  currentStock: number; // Bestand in Basiseinheiten
  reservedStock: number; // Reserviert für offene Angebote
  availableStock: number; // currentStock - reservedStock
  minStock: number; // Mindestbestand
  maxStock?: number; // Maximalbestand
  purchasePrice: number; // Einkaufspreis pro Basiseinheit
  sellingPrice: number; // Verkaufspreis pro Basiseinheit
  supplierName?: string;
  supplierId?: string; // Referenz zum Lieferanten in customers Collection
  supplierEmail?: string; // E-Mail für Nachbestellungen
  supplierContact?: string;
  location?: string; // Lagerort
  barcode?: string; // EAN/Barcode der Basiseinheit
  image?: string;
  images?: string[]; // Array für mehrere Artikelbilder
  status: 'active' | 'inactive' | 'discontinued';
  createdAt: Date;
  updatedAt: Date;
  companyId: string;

  // === INHALT PRO EINHEIT (für Flaschen, Dosen, etc.) ===
  contentAmount?: number; // Inhaltsmenge pro Basiseinheit (z.B. 0.33, 0.5, 1)
  contentUnit?: WeightVolumeUnit; // Einheit des Inhalts (L, ml, kg, g, etc.)
  totalContent?: number; // Gesamtinhalt (berechnet: contentAmount * currentStock)

  // === VERPACKUNGSHIERARCHIE ===
  packagingUnits?: PackagingUnit[]; // z.B. [{name: "6er-Pack", quantity: 6}, {name: "Kasten", quantity: 24}]

  // === GEWICHT/VOLUMEN DER VERPACKUNG ===
  unitWeight?: number; // Gewicht pro Basiseinheit inkl. Verpackung (z.B. Flasche mit Inhalt)
  weightUnit?: WeightVolumeUnit; // Einheit für Gewicht (kg, g)
  totalWeight?: number; // Gesamtgewicht (berechnet: unitWeight * currentStock)

  // === INVENTUR-FELDER ===
  batchNumber?: string; // Chargennummer / Lot
  expiryDate?: Date; // Mindesthaltbarkeitsdatum (MHD)
  productionDate?: Date; // Herstellungsdatum
  serialNumbers?: string[]; // Seriennummern für einzelne Einheiten

  // === ABMESSUNGEN ===
  dimensions?: {
    length: number;
    width: number;
    height: number;
    unit: 'cm' | 'mm' | 'm';
  };

  // === ZUSÄTZLICHE FELDER ===
  notes?: string;
  taxRate?: number; // Steuersatz (7% oder 19%)
  origin?: string; // Herkunftsland
  manufacturer?: string; // Hersteller

  // Automatisch berechnete Felder
  stockValue: number; // currentStock * purchasePrice
  isLowStock: boolean; // currentStock <= minStock
  isOutOfStock: boolean; // currentStock === 0
}

export interface InventoryStats {
  totalItems: number;
  totalValue: number;
  lowStockItems: number;
  outOfStockItems: number;
  totalCategories: number;
  averageValue: number;
  lastUpdate: Date;
}

export interface StockMovement {
  id: string;
  itemId: string;
  itemName: string;
  type: 'in' | 'out' | 'adjustment' | 'transfer';
  quantity: number;
  previousStock: number;
  newStock: number;
  unit: string;
  reason?: string;
  reference?: string; // Referenz zu Bestellung, Rechnung, etc.
  createdAt: Date;
  createdBy: string;
  companyId: string;
}

export interface InventoryCategory {
  id: string;
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  companyId: string;
  itemCount: number;
}

// Konstante für erlaubte Gewichts-/Volumeneinheiten (für Inhalt und Gewicht)
export const WEIGHT_VOLUME_UNITS: {
  value: WeightVolumeUnit;
  label: string;
  type: 'weight' | 'volume' | 'length' | 'count';
}[] = [
  { value: 'kg', label: 'Kilogramm (kg)', type: 'weight' },
  { value: 'g', label: 'Gramm (g)', type: 'weight' },
  { value: 'mg', label: 'Milligramm (mg)', type: 'weight' },
  { value: 'L', label: 'Liter (L)', type: 'volume' },
  { value: 'ml', label: 'Milliliter (ml)', type: 'volume' },
  { value: 'cl', label: 'Zentiliter (cl)', type: 'volume' },
  { value: 'm', label: 'Meter (m)', type: 'length' },
  { value: 'cm', label: 'Zentimeter (cm)', type: 'length' },
  { value: 'mm', label: 'Millimeter (mm)', type: 'length' },
  { value: 'Stück', label: 'Stück', type: 'count' },
];

// Konstante für Basiseinheiten (Verkaufs-/Lagereinheit)
export const SALES_UNITS: { value: SalesUnit; label: string }[] = [
  { value: 'Stück', label: 'Stück' },
  { value: 'Flasche', label: 'Flasche' },
  { value: 'Dose', label: 'Dose' },
  { value: 'Packung', label: 'Packung' },
  { value: 'Karton', label: 'Karton' },
  { value: 'Kiste', label: 'Kiste/Kasten' },
  { value: 'Palette', label: 'Palette' },
  { value: 'Beutel', label: 'Beutel' },
  { value: 'Sack', label: 'Sack' },
  { value: 'Rolle', label: 'Rolle' },
  { value: 'Meter', label: 'Meter' },
  { value: 'Liter', label: 'Liter' },
  { value: 'kg', label: 'Kilogramm' },
];

// Vordefinierte Verpackungsgrößen für Getränke
export const COMMON_CONTENT_SIZES = [
  { amount: 0.2, unit: 'L', label: '0,2 L (200 ml)' },
  { amount: 0.25, unit: 'L', label: '0,25 L (250 ml)' },
  { amount: 0.33, unit: 'L', label: '0,33 L (330 ml)' },
  { amount: 0.5, unit: 'L', label: '0,5 L (500 ml)' },
  { amount: 0.7, unit: 'L', label: '0,7 L (700 ml)' },
  { amount: 0.75, unit: 'L', label: '0,75 L (750 ml)' },
  { amount: 1, unit: 'L', label: '1 L (1000 ml)' },
  { amount: 1.5, unit: 'L', label: '1,5 L (1500 ml)' },
  { amount: 2, unit: 'L', label: '2 L (2000 ml)' },
];

// Vordefinierte Gebindegrößen
export const COMMON_PACKAGING_SIZES = [
  { name: '6er-Pack', quantity: 6 },
  { name: '12er-Pack', quantity: 12 },
  { name: '20er-Kasten', quantity: 20 },
  { name: '24er-Kasten', quantity: 24 },
  { name: 'Palette (kleine)', quantity: 480 },
  { name: 'Europalette', quantity: 960 },
];

export class InventoryService {
  /**
   * Bild für Inventarartikel hochladen (Supabase Storage via Backend)
   */
  static async uploadItemImage(
    companyId: string,
    itemId: string,
    file: File,
    imageIndex: number,
  ): Promise<string> {
    // Validiere Dateityp
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Ungültiger Dateityp. Erlaubt: JPEG, PNG, WebP, GIF');
    }

    // Validiere Dateigröße (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new Error('Datei zu groß. Maximale Größe: 5 MB');
    }

    const formData = new FormData();
    formData.append('file', file);
    formData.append('imageIndex', String(imageIndex));

    const response = await apiClient<{ url: string }>(
      `/api/v1/inventory/${companyId}/${itemId}/images`,
      {
        method: 'POST',
        body: formData,
        headers: {},
      },
    );
    return response.url;
  }

  /**
   * Bild für Inventarartikel löschen (Supabase Storage via Backend)
   */
  static async deleteItemImage(companyId: string, itemId: string, imageUrl: string): Promise<void> {
    const params = new URLSearchParams({ imageUrl });
    await api.delete(`/api/v1/inventory/${companyId}/${itemId}/images?${params}`);
  }

  /**
   * Berechne Gesamtgewicht/-volumen basierend auf Einzelgewicht und Bestand
   */
  static calculateTotalWeight(unitWeight: number | undefined, currentStock: number): number {
    if (!unitWeight || unitWeight <= 0) return 0;
    return Math.round(unitWeight * currentStock * 1000) / 1000;
  }

  /**
   * Berechne Gesamtinhalt basierend auf Inhalt pro Einheit und Bestand
   * z.B. 100 Flaschen à 0,33L = 33L Gesamtinhalt
   */
  static calculateTotalContent(contentAmount: number | undefined, currentStock: number): number {
    if (!contentAmount || contentAmount <= 0) return 0;
    return Math.round(contentAmount * currentStock * 1000) / 1000;
  }

  /**
   * Konvertiere Bestand zwischen Einheiten
   * z.B. 2 Kästen à 24 Flaschen = 48 Flaschen
   */
  static convertToBaseUnits(quantity: number, packagingQuantity: number): number {
    return quantity * packagingQuantity;
  }

  /**
   * Konvertiere Basiseinheiten zu Verpackungseinheiten
   * z.B. 48 Flaschen ÷ 24 = 2 Kästen
   */
  static convertToPackagingUnits(
    baseQuantity: number,
    packagingQuantity: number,
  ): { full: number; remainder: number } {
    const full = Math.floor(baseQuantity / packagingQuantity);
    const remainder = baseQuantity % packagingQuantity;
    return { full, remainder };
  }

  /**
   * Alle Inventar-Artikel einer Firma abrufen
   */
  static async getInventoryItems(companyId: string): Promise<InventoryItem[]> {
    return await api.get<InventoryItem[]>(`/api/v1/inventory/${companyId}`);
  }

  /**
   * Einzelnen Inventar-Artikel laden
   */
  static async getInventoryItemById(
    companyId: string,
    itemId: string,
  ): Promise<InventoryItem | null> {
    try {
      return await api.get<InventoryItem>(`/api/v1/inventory/${companyId}/${itemId}`);
    } catch {
      return null;
    }
  }

  /**
   * Einzelnen Inventar-Artikel laden (DEPRECATED - verwendet alte Collection)
   */
  static async getInventoryItem(companyId: string, itemId: string): Promise<InventoryItem | null> {
    return InventoryService.getInventoryItemById(companyId, itemId);
  }

  /**
   * Inventar-Artikel nach SKU oder Name finden
   */
  static async findInventoryItems(companyId: string, searchTerm: string): Promise<InventoryItem[]> {
    const params = new URLSearchParams({ search: searchTerm });
    return await api.get<InventoryItem[]>(`/api/v1/inventory/${companyId}/search?${params}`);
  }

  /**
   * Einzelnen Inventar-Artikel nach SKU finden
   */
  static async getInventoryItemBySku(
    companyId: string,
    sku: string,
  ): Promise<InventoryItem | null> {
    try {
      const items = await InventoryService.findInventoryItems(companyId, sku);
      const exactMatch = items.find(item => item.sku.toLowerCase() === sku.toLowerCase());
      return exactMatch || items[0] || null;
    } catch {
      return null;
    }
  }

  /**
   * Inventar-Artikel nach Name finden
   */
  static async getInventoryItemByName(
    companyId: string,
    name: string,
  ): Promise<InventoryItem | null> {
    try {
      const items = await InventoryService.findInventoryItems(companyId, name);
      const exactMatch = items.find(item => item.name.toLowerCase() === name.toLowerCase());
      return exactMatch || items[0] || null;
    } catch {
      return null;
    }
  }

  /**
   * Inventar-Statistiken berechnen
   */
  static async getInventoryStats(companyId: string): Promise<InventoryStats> {
    const items = await InventoryService.getInventoryItems(companyId);

    const stats: InventoryStats = {
      totalItems: items.length,
      totalValue: items.reduce((sum, item) => sum + item.stockValue, 0),
      lowStockItems: items.filter(item => item.isLowStock && !item.isOutOfStock).length,
      outOfStockItems: items.filter(item => item.isOutOfStock).length,
      totalCategories: [...new Set(items.map(item => item.category))].length,
      averageValue:
        items.length > 0 ? items.reduce((sum, item) => sum + item.stockValue, 0) / items.length : 0,
      lastUpdate: new Date(),
    };

    return stats;
  }

  /**
   * Neuen Inventar-Artikel hinzufügen
   */
  static async addInventoryItem(
    companyId: string,
    itemData: Omit<
      InventoryItem,
      'id' | 'createdAt' | 'updatedAt' | 'companyId' | 'stockValue' | 'isLowStock' | 'isOutOfStock'
    >,
  ): Promise<string> {
    const response = await api.post<{ id: string }>(`/api/v1/inventory/${companyId}`, itemData);
    return response.id;
  }

  /**
   * Inventar-Artikel aktualisieren
   */
  static async updateInventoryItem(
    companyId: string,
    itemId: string,
    updates: Partial<Omit<InventoryItem, 'id' | 'createdAt' | 'updatedAt' | 'companyId'>>,
  ): Promise<void> {
    await api.patch(`/api/v1/inventory/${companyId}/${itemId}`, updates);
  }

  /**
   * Lagerbestand anpassen
   */
  static async adjustStock(
    companyId: string,
    itemId: string,
    itemName: string,
    newStock: number,
    unit: string,
    reason: string,
    type: 'in' | 'out' | 'adjustment' = 'adjustment',
    reference?: string,
  ): Promise<void> {
    await api.post(`/api/v1/inventory/${companyId}/${itemId}/adjust-stock`, {
      itemName,
      newStock,
      unit,
      reason,
      type,
      reference,
    });
  }

  /**
   * Stock-Movement hinzufügen
   */
  static async addStockMovement(
    companyId: string,
    movementData: Omit<StockMovement, 'id' | 'createdAt' | 'companyId'>,
  ): Promise<string> {
    const response = await api.post<{ id: string }>(
      `/api/v1/inventory/${companyId}/stock-movements`,
      movementData,
    );
    return response.id;
  }

  /**
   * Stock-Movements für einen Artikel laden
   */
  static async getStockMovements(companyId: string, itemId?: string): Promise<StockMovement[]> {
    const params = itemId ? `?itemId=${itemId}` : '';
    return await api.get<StockMovement[]>(
      `/api/v1/inventory/${companyId}/stock-movements${params}`,
    );
  }

  /**
   * Inventar-Artikel löschen
   */
  static async deleteInventoryItem(companyId: string, itemId: string): Promise<void> {
    await api.delete(`/api/v1/inventory/${companyId}/${itemId}`);
  }

  /**
   * Artikel für Angebot reservieren
   */
  static async reserveItemsForQuote(
    companyId: string,
    quoteId: string,
    items: { itemId: string; quantity: number }[],
  ): Promise<void> {
    await api.post(`/api/v1/inventory/${companyId}/reserve`, { quoteId, items });
  }

  /**
   * Reservierung für abgelehntes Angebot freigeben
   */
  static async releaseReservationForQuote(
    companyId: string,
    quoteId: string,
    items: { itemId: string; quantity: number }[],
  ): Promise<void> {
    await api.post(`/api/v1/inventory/${companyId}/release-reservation`, { quoteId, items });
  }

  /**
   * Reservierte Artikel als verkauft markieren (Angebot angenommen)
   */
  static async sellReservedItems(
    companyId: string,
    quoteId: string,
    items: { itemId: string; quantity: number }[],
  ): Promise<void> {
    await api.post(`/api/v1/inventory/${companyId}/sell-reserved`, { quoteId, items });
  }

  /**
   * Kategorien laden
   */
  static async getCategories(companyId: string): Promise<InventoryCategory[]> {
    const items = await InventoryService.getInventoryItems(companyId);
    const categoryMap = new Map<string, number>();

    items.forEach(item => {
      const count = categoryMap.get(item.category) || 0;
      categoryMap.set(item.category, count + 1);
    });

    const categories: InventoryCategory[] = [];
    categoryMap.forEach((itemCount, name) => {
      categories.push({
        id: name.toLowerCase().replace(/\s+/g, '-'),
        name,
        companyId,
        itemCount,
      });
    });

    return categories.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * Eindeutige Lagerorte laden
   */
  static async getUniqueLocations(companyId: string): Promise<string[]> {
    const items = await InventoryService.getInventoryItems(companyId);
    const locationSet = new Set<string>();

    items.forEach(item => {
      if (item.location?.trim()) {
        locationSet.add(item.location.trim());
      }
    });

    return Array.from(locationSet).sort((a, b) => a.localeCompare(b, 'de'));
  }

  /**
   * Lagerbestand für Lieferschein reduzieren
   */
  static async reduceStockForDeliveryNote(
    companyId: string,
    items: Array<{ name: string; sku?: string; quantity: number; unit: string }>,
    deliveryNoteId: string,
  ): Promise<{ success: boolean; errors: string[] }> {
    try {
      return await api.post<{ success: boolean; errors: string[] }>(
        `/api/v1/inventory/${companyId}/reduce-for-delivery-note`,
        { items, deliveryNoteId },
      );
    } catch (error: unknown) {
      return {
        success: false,
        errors: [
          `Allgemeiner Fehler: ${error instanceof Error ? error.message : 'Unbekannter Fehler'}`,
        ],
      };
    }
  }
}

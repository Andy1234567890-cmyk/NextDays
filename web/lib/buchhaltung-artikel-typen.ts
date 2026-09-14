// Typen des Buchhaltungs-Bereichs „Artikel" (Artikelstamm `billing_items`).
// Getrennt von den "use server"-Actions in buchhaltung-artikel.ts, weil ein
// "use server"-Modul AUSSCHLIESSLICH async functions exportieren darf.
//
// Feldnamen camelCase — so kommen sie vom Backend (`alias_generator=to_camel`).
// Beträge als STRING (Decimal-Serialisierung), nie als float weiterrechnen.

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number };

export type BillingItem = {
  id: string;
  tenantId: string;
  itemNumber: string;
  name: string;
  description: string | null;
  unit: string;
  unitPrice: string;
  taxRate: string;
  currency: string;
  category: string | null;
  isActive: boolean;
  isFavorite: boolean;
  usageCount: number;
  lastUsedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BillingItemInput = {
  name: string;
  description?: string | null;
  unit: string;
  unitPrice: string;
  /** Pflicht — kein Default. Kommt aus dem Formular (vorbelegt mit dem
   *  Betriebssatz, wenn hinterlegt). */
  taxRate: string;
  /** Leer → Mandanten-Währung; fehlt auch die, antwortet der Server 422. */
  currency?: string | null;
  category?: string | null;
  isActive?: boolean;
  isFavorite?: boolean;
  /** Leer → der Server zieht aus dem Nummernkreis „Artikel" (ART-). */
  itemNumber?: string | null;
};

export type BillingItemUpdate = Partial<Omit<BillingItemInput, "itemNumber">>;

export type BillingItemCategory = {
  name: string;
  itemCount: number;
};

export type BillingItemUsed = {
  id: string;
  usageCount: number;
  lastUsedAt: string | null;
};

export type ListItemsFilter = {
  search?: string;
  category?: string;
  onlyActive?: boolean;
  favoritesOnly?: boolean;
  limit?: number;
};

/** Was der Positions-Editor beim Übernehmen erhält — die Felder einer
 *  `LineItemInput` (lib/buchhaltung.ts) plus Herkunft. */
export type ArtikelPosition = {
  artikelId: string;
  itemNumber: string;
  description: string;
  unit: string;
  unit_price: string;
  tax_rate: string;
  currency: string;
};

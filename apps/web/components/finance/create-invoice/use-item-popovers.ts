'use client';

// Popover-Cluster der Positionszeilen (aus create-invoice-page.tsx extrahiert):
// Debounce-Timer pro Item, „Als Produkt speichern?"-Prompt und Inventar-Auto-Mapping.
// itemsRef + Timer-Callbacks gehören zusammen — der Cluster teilt Refs und muss
// deshalb komplett in diesem Hook leben.
// Kein automatisches Modal mehr – wir nutzen einen kleinen Popover unter dem Feld.

import { type Dispatch, type SetStateAction, useEffect, useRef, useState } from 'react';
import { computeItemTotalNet } from '@/components/finance/create-invoice/calc';
import { InventoryService } from '@/services/inventoryService';
import type { QuoteItem } from '@/services/quoteService';

type UseItemPopoversArgs = {
  uid: string;
  items: QuoteItem[];
  setItems: Dispatch<SetStateAction<QuoteItem[]>>;
  dismissedCreatePromptIds: Set<string>;
  createProductOpen: boolean;
  // In der Hauptdatei deklariert — wird durchgereicht, nicht dupliziert
  handleItemChange: (
    index: number,
    field: keyof QuoteItem,
    value: string | number | boolean,
  ) => void;
};

export function useItemPopovers({
  uid,
  items,
  setItems,
  dismissedCreatePromptIds,
  createProductOpen,
  handleItemChange,
}: UseItemPopoversArgs) {
  // Popover-Open-Status pro Zeile und Debounce-Timer pro Item
  const itemsRef = useRef<QuoteItem[]>([]);
  const [popoverOpenIds, setPopoverOpenIds] = useState<Set<string>>(new Set());
  const popoverTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Debounced onChange für Beschreibung
  const handleDescriptionChange = (index: number, id: string, value: string) => {
    handleItemChange(index, 'description', value);
    const timers = popoverTimersRef.current;
    const existing = timers.get(id);
    if (existing) clearTimeout(existing);
    const t = setTimeout(() => {
      const list = itemsRef.current;
      const current = list.find(i => i.id === id);
      const shouldOpen =
        Boolean(current) &&
        current?.category !== 'discount' &&
        Boolean((current?.description || '').trim()) &&
        !current?.inventoryItemId &&
        !dismissedCreatePromptIds.has(id) &&
        !createProductOpen;
      setPopoverOpenIds(prev => {
        const next = new Set(prev);
        if (shouldOpen) next.add(id);
        else next.delete(id);
        return next;
      });

      // Auto-Mapping aus Inventar: Wenn Beschreibung wie Name oder SKU passt, Produktdaten übernehmen
      (async () => {
        try {
          const row = itemsRef.current.find(i => i.id === id);
          if (!row || row.inventoryItemId) return;
          const term = (row.description || '').trim();
          if (!term || term.length < 2) return;
          const results = await InventoryService.findInventoryItems(uid, term);
          if (!results || results.length === 0) return;
          const lower = term.toLowerCase();
          const exactSku = results.find(r => (r.sku || '').toLowerCase() === lower);
          const exactName = results.find(r => (r.name || '').toLowerCase() === lower);
          const match = exactSku || exactName || (results.length === 1 ? results[0] : undefined);
          if (!match) return;
          setItems(prev =>
            prev.map((it, i) => {
              if (i !== index) return it;
              const unitPriceNet = Number(match.sellingPrice) || 0;
              const qty = Number.isFinite(it.quantity) ? it.quantity : 1;
              return {
                ...it,
                description: match.name || it.description,
                unit: match.unit || 'Stk',
                unitPrice: unitPriceNet,
                total: computeItemTotalNet(qty, unitPriceNet),
                inventoryItemId: match.id,
              };
            }),
          );
          setPopoverOpenIds(prev => {
            const next = new Set(prev);
            next.delete(id);
            return next;
          });
        } catch {
          // ignoriere Fehler in der Auto-Suche
        }
      })();
    }, 2000); // 2 Sekunden Delay - weniger aufdringlich
    timers.set(id, t);
  };

  // Konsistenz: Wenn Items/Modal/“dismissed” sich ändern, Popover neu bewerten
  useEffect(() => {
    setPopoverOpenIds(prev => {
      const next = new Set(prev);
      const list = itemsRef.current;
      for (const id of Array.from(prev)) {
        const current = list.find(i => i.id === id);
        const shouldOpen =
          Boolean(current) &&
          current?.category !== 'discount' &&
          Boolean((current?.description || '').trim()) &&
          !current?.inventoryItemId &&
          !dismissedCreatePromptIds.has(id) &&
          !createProductOpen;
        if (!shouldOpen) next.delete(id);
      }
      return next;
    });
  }, [dismissedCreatePromptIds, createProductOpen]);

  // Cleanup: ausstehende Timer beim Unmount löschen
  useEffect(() => {
    const timers = popoverTimersRef.current;
    return () => {
      for (const t of timers.values()) clearTimeout(t);
      timers.clear();
    };
  }, []);

  // Halte itemsRef synchron, damit Debounce/Popover-Logik nicht vor Deklaration auf items zugreift
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  // Bei jeder Items-Änderung Popover-Entscheidungen neu evaluieren
  useEffect(() => {
    setPopoverOpenIds(prev => {
      const next = new Set(prev);
      for (const id of Array.from(prev)) {
        const current = items.find(i => i.id === id);
        const shouldOpen =
          Boolean(current) &&
          current?.category !== 'discount' &&
          Boolean((current?.description || '').trim()) &&
          !current?.inventoryItemId &&
          !dismissedCreatePromptIds.has(id) &&
          !createProductOpen;
        if (!shouldOpen) next.delete(id);
      }
      return next;
    });
  }, [items, dismissedCreatePromptIds, createProductOpen]);

  return { popoverOpenIds, handleDescriptionChange };
}

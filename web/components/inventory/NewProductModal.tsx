'use client';

import { Icon } from '@iconify/react';
import { useTranslations } from "next-intl";
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
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
} from '@tasko/ui';
import { useEffect, useMemo, useState } from 'react';

import { InventoryService } from '@/services/inventoryService';

export type NewProductValues = {
  name: string;
  imageUrl: string;
  sku: string;
  category: string;
  unit: string;
  stock: number;
  taxRate: number;
  purchaseNet: number;
  purchaseGross: number;
  sellingNet: number;
  sellingGross: number;
  description: string;
  internalNote: string;
};

export interface NewProductModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultValues?: Partial<NewProductValues>;
  saving?: boolean;
  onSave?: (values: NewProductValues) => Promise<void> | void;
  // Optional: direkt in die DB speichern, ohne Eltern-Handler
  persistDirectly?: boolean;
  companyId?: string;
  onSaved?: (id: string) => void; // Rückgabe der neuen ID nach direkter Persistierung
}

const DEFAULT_VALUES: NewProductValues = {
  name: '',
  imageUrl: '',
  sku: '',
  category: 'Artikel',
  unit: 'Stk',
  stock: 0,
  taxRate: 19,
  purchaseNet: 0,
  purchaseGross: 0,
  sellingNet: 0,
  sellingGross: 0,
  description: '',
  internalNote: '',
};

export default function NewProductModal({
  open,
  onOpenChange,
  defaultValues,
  saving,
  onSave,
  persistDirectly,
  companyId,
  onSaved,
}: NewProductModalProps) {
  const t = useTranslations("inventory");
  const [values, setValues] = useState<NewProductValues>(DEFAULT_VALUES);
  const [stockEnabled, setStockEnabled] = useState<boolean>(false);
  const [reorderEnabled, setReorderEnabled] = useState<boolean>(false);
  type PartUnity = { id: string; unit: string; factor: number; priceNet: number };
  const [partUnities, setPartUnities] = useState<PartUnity[]>([]);
  const [categoryOptions, setCategoryOptions] = useState<string[]>(['Artikel', 'Dienstleistung']);

  useEffect(() => {
    if (open) {
      setValues({ ...DEFAULT_VALUES, ...(defaultValues || {}) } as NewProductValues);
      setStockEnabled(false);
      setReorderEnabled(false);
      setPartUnities([]);
    }
  }, [open, defaultValues]);

  // Kategorien laden (sofern companyId verfügbar), mit sinnvollen Defaults (ohne "Allgemein")
  useEffect(() => {
    const loadCategories = async () => {
      if (!companyId || !open) return;
      try {
        const cats = await InventoryService.getCategories(companyId);
        const names = cats.map(c => c.name).filter(n => Boolean(n) && n !== 'Allgemein');
        const base = ['Artikel', 'Dienstleistung'];
        const unique = Array.from(new Set([...base, ...names])).sort((a, b) =>
          a.localeCompare(b, 'de'),
        );
        setCategoryOptions(unique);
      } catch {
        // Im Fehlerfall Defaults belassen
      }
    };
    loadCategories();
  }, [companyId, open]);

  const UNIT_OPTIONS = useMemo(
    () => ['Stk', 'pauschal', 'Std', '%', 'Tag(e)', 'm²', 'm', 'kg', 't', 'lfm', 'm³', 'km', 'L'],
    [],
  );

  const syncGrossFromNet = (net: number, rate: number) =>
    Number.isFinite(net) ? net * (1 + Math.max(0, rate) / 100) : 0;
  const syncNetFromGross = (gross: number, rate: number) =>
    Number.isFinite(gross) ? gross / (1 + Math.max(0, rate) / 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] w-full max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("newProduct")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>{t("productName")}</Label>
              <Input
                value={values.name}
                onChange={e => setValues(p => ({ ...p, name: e.target.value }))}
                placeholder={t("productNamePlaceholder")}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("sku")}</Label>
              <Input
                value={values.sku}
                onChange={e => setValues(p => ({ ...p, sku: e.target.value }))}
                placeholder="1001"
              />
            </div>
            <div className="space-y-2">
              <Label>Kategorie</Label>
              <Select
                value={values.category}
                onValueChange={val => setValues(p => ({ ...p, category: val }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("chooseCategory")} />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {categoryOptions.map(cat => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("purchaseNet")}</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={values.purchaseNet}
                onChange={e => {
                  const v = parseFloat(e.target.value) || 0;
                  setValues(p => ({
                    ...p,
                    purchaseNet: v,
                    purchaseGross: Number(syncGrossFromNet(v, p.taxRate).toFixed(2)),
                  }));
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("purchaseGross")}</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={values.purchaseGross}
                onChange={e => {
                  const v = parseFloat(e.target.value) || 0;
                  setValues(p => ({
                    ...p,
                    purchaseGross: v,
                    purchaseNet: Number(syncNetFromGross(v, p.taxRate).toFixed(2)),
                  }));
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>Standardeinheit</Label>
              <Select
                value={values.unit}
                onValueChange={val => setValues(p => ({ ...p, unit: val }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Stk" />
                </SelectTrigger>
                <SelectContent>
                  {UNIT_OPTIONS.map(u => (
                    <SelectItem key={u} value={u}>
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("stockPcs")}</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={values.stock}
                onChange={e => setValues(p => ({ ...p, stock: parseFloat(e.target.value) || 0 }))}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("vatPercent")}</Label>
              <Input
                type="number"
                min={0}
                step={0.1}
                value={values.taxRate}
                onChange={e => {
                  const rate = parseFloat(e.target.value) || 0;
                  setValues(p => ({
                    ...p,
                    taxRate: rate,
                    purchaseGross: Number(syncGrossFromNet(p.purchaseNet, rate).toFixed(2)),
                    sellingGross: Number(syncGrossFromNet(p.sellingNet, rate).toFixed(2)),
                  }));
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("sellNet")}</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={values.sellingNet}
                onChange={e => {
                  const v = parseFloat(e.target.value) || 0;
                  setValues(p => ({
                    ...p,
                    sellingNet: v,
                    sellingGross: Number(syncGrossFromNet(v, p.taxRate).toFixed(2)),
                  }));
                }}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("sellGross")}</Label>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={values.sellingGross}
                onChange={e => {
                  const v = parseFloat(e.target.value) || 0;
                  setValues(p => ({
                    ...p,
                    sellingGross: v,
                    sellingNet: Number(syncNetFromGross(v, p.taxRate).toFixed(2)),
                  }));
                }}
              />
            </div>
          </div>

          {/* Tabs werden außerhalb des 2-Spalten-Grids gerendert */}

          {/* Tabs: 1) Beschreibung & Interne Bemerkung, 2) Weitere Einheiten, 3) Weitere Einstellungen */}
          <Tabs defaultValue="desc" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="desc">Beschreibung</TabsTrigger>
              <TabsTrigger value="units">{t("moreUnits")}</TabsTrigger>
              <TabsTrigger value="settings">{t("moreSettings")}</TabsTrigger>
            </TabsList>

            <TabsContent value="desc" className="mt-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Produktbeschreibung</Label>
                  <Textarea
                    value={values.description}
                    onChange={e => setValues(p => ({ ...p, description: e.target.value }))}
                    placeholder="Produktbeschreibung"
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>{t("internalNote")}</Label>
                  </div>
                  <Textarea
                    value={values.internalNote}
                    onChange={e => setValues(p => ({ ...p, internalNote: e.target.value }))}
                    placeholder={t("internalOnly")}
                    rows={3}
                  />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="units" className="mt-4">
              <div className="w-full space-y-3">
                {/* Kopfzeile über den Feldern */}
                <div
                  className="grid w-full gap-3 font-medium text-gray-600 text-sm"
                  style={{ gridTemplateColumns: '4fr 1fr 2rem 3fr 6ch 2rem' }}
                >
                  <div>Einheit</div>
                  <div>Faktor</div>
                  <div className="invisible text-center">×</div>
                  <div>{t("priceNet")}</div>
                  <div className="invisible text-right">=</div>
                  <div />
                </div>
                {partUnities.map((u, idx) => (
                  <div
                    key={u.id}
                    className="grid w-full items-center gap-3"
                    style={{ gridTemplateColumns: '4fr 1fr 2rem 3fr 6ch 2rem' }}
                  >
                    <div>
                      <Select
                        value={u.unit}
                        onValueChange={val =>
                          setPartUnities(list =>
                            list.map((it, i) => (i === idx ? { ...it, unit: val } : it)),
                          )
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Einheit" />
                        </SelectTrigger>
                        <SelectContent>
                          {UNIT_OPTIONS.map(opt => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={u.factor}
                        className="w-full"
                        onChange={e => {
                          const v = parseFloat(e.target.value);
                          setPartUnities(list =>
                            list.map((it, i) =>
                              i === idx ? { ...it, factor: Number.isFinite(v) ? v : 0 } : it,
                            ),
                          );
                        }}
                      />
                    </div>
                    <div className="text-center">×</div>
                    <div>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={u.priceNet}
                        className="w-full"
                        onChange={e => {
                          const v = parseFloat(e.target.value);
                          setPartUnities(list =>
                            list.map((it, i) =>
                              i === idx ? { ...it, priceNet: Number.isFinite(v) ? v : 0 } : it,
                            ),
                          );
                        }}
                      />
                    </div>
                    <div className="text-right">
                      <div className="font-medium text-sm">
                        {Number.isFinite(u.factor) && Number.isFinite(u.priceNet)
                          ? (u.factor * u.priceNet).toFixed(2)
                          : '0.00'}
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={t("removeUnit")}
                        onClick={() => setPartUnities(list => list.filter((_, i) => i !== idx))}
                      >
                        <Icon icon="lucide:trash-2" className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
                <div>
                  <Button
                    type="button"
                    variant="link"
                    className="px-0 text-accent"
                    onClick={() =>
                      setPartUnities(list => [
                        ...list,
                        {
                          id: crypto.randomUUID
                            ? crypto.randomUUID()
                            : Math.random().toString(36).slice(2),
                          unit: 'Stk',
                          factor: 1,
                          priceNet: 0,
                        },
                      ])
                    }
                  >
                    + Einheit hinzufügen
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="settings" className="mt-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between rounded-md border p-3">
                  <Label className="font-medium">{t("stockEnabled")}</Label>
                  <Switch checked={stockEnabled} onCheckedChange={setStockEnabled} />
                </div>
                <div className="flex items-center justify-between rounded-md border p-3">
                  <Label className="font-medium">Meldebestand</Label>
                  <Switch checked={reorderEnabled} onCheckedChange={setReorderEnabled} />
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button
              className="bg-accent text-white hover:bg-accent/90"
              disabled={Boolean(saving) || !values.name.trim()}
              onClick={async () => {
                // Wenn direkte Persistierung gewünscht und companyId vorhanden
                if (persistDirectly && companyId) {
                  const payload = {
                    name: values.name.trim(),
                    description: values.description || undefined,
                    sku: values.sku || '',
                    category: values.category || 'Artikel',
                    unit: values.unit || 'Stk',
                    currentStock: values.stock || 0,
                    reservedStock: 0,
                    availableStock: (values.stock || 0) - 0,
                    minStock: 0,
                    purchasePrice: Number(values.purchaseNet) || 0,
                    sellingPrice: Number(values.sellingNet) || 0,
                    image: values.imageUrl || undefined,
                    status: 'active',
                    notes: values.internalNote || undefined,
                  } as const;
                  const cleaned = Object.fromEntries(
                    Object.entries(payload).filter(([, v]) => v !== undefined),
                  );
                  const id = await InventoryService.addInventoryItem(companyId, cleaned as any);
                  if (onSaved) onSaved(id);
                  onOpenChange(false);
                  return;
                }

                // Fallback: Eltern-Handler verwenden
                if (onSave) {
                  await onSave(values);
                }
              }}
            >
              {saving ? <Icon icon="lucide:loader-circle" className="mr-2 h-4 w-4 animate-spin" /> : null}
              Speichern
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

"use client";

// Zusatzleistungen/Upsells je Objekt verwalten (wie Hostaway/Guesty). Liste +
// Anlegen/Bearbeiten/Löschen mit mehrsprachigem Namen/Beschreibung (de/en),
// Medien-Upload, Preis + Abrechnungsbasis, optional/pflicht, „erscheint in",
// „wann anzeigen", aktiv, Reihenfolge. Echtes Realtime (Supabase WebSocket,
// kein Polling) auf property_addons.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Card } from "@nextdays/ui/card";
import { Input } from "@nextdays/ui/input";
import { NativeSelect } from "@nextdays/ui/native-select";
import { Textarea } from "@nextdays/ui/textarea";
import {
  createAddon,
  deleteAddon,
  listAddons,
  updateAddon,
  uploadAddonMedia,
  type Addon,
  type AddonInput,
  type AddonSurface,
} from "@/lib/addons";
import { formatCurrency } from "@/lib/currency";
import { useRealtime } from "@/lib/use-realtime";

type TFunc = ReturnType<typeof useTranslations>;

function getBasisOptions(t: TFunc): { value: Addon["basis"]; label: string }[] {
  return [
    { value: "per_stay", label: t("addonsManager.basisPerStay") },
    { value: "per_night", label: t("addonsManager.basisPerNight") },
    { value: "per_guest", label: t("addonsManager.basisPerGuest") },
    { value: "per_unit", label: t("addonsManager.basisPerUnit") },
  ];
}
function getSurfaces(t: TFunc): { value: AddonSurface; label: string }[] {
  return [
    { value: "booking_engine", label: t("addonsManager.surfaceBookingEngine") },
    { value: "guest_portal", label: t("addonsManager.surfaceGuestPortal") },
    { value: "checkin", label: t("addonsManager.surfaceCheckin") },
  ];
}
function getAvailability(
  t: TFunc,
): { value: Addon["available_until"]; label: string }[] {
  return [
    { value: "anytime", label: t("addonsManager.availabilityAnytime") },
    { value: "before_checkin", label: t("addonsManager.availabilityBeforeCheckin") },
  ];
}

function emptyDraft(sortOrder: number): AddonInput {
  return {
    name: { de: "", en: "" },
    description: { de: "", en: "" },
    media: [],
    price: 0,
    basis: "per_stay",
    mandatory: false,
    appears_in: ["booking_engine", "guest_portal"],
    available_until: "anytime",
    tax_rate: null,
    active: true,
    sort_order: sortOrder,
  };
}

export function AddonsManager({
  propertyId,
  initial,
  currency,
}: {
  propertyId: string;
  initial: Addon[];
  // Objekt-Währung (aus dem Rate-Plan); null = keine hinterlegt → kein €-Fallback.
  currency: string | null;
}) {
  const t = useTranslations("objects");
  const router = useRouter();
  const [items, setItems] = useState<Addon[]>(initial);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<AddonInput | null>(null);
  const [busy, setBusy] = useState(false);
  const basisOptions = getBasisOptions(t);
  const surfaces = getSurfaces(t);

  // Betrag in Objekt-Währung; ohne hinterlegte Währung nur der nackte Wert
  // (nie € erfinden — Mehrwährung über 27 EU-Länder).
  const money = (v: number) =>
    currency ? formatCurrency(v, currency) : v.toLocaleString("de-DE");

  // Echtes Realtime (Supabase WebSocket): bei jeder Änderung an property_addons
  // die Liste direkt aus dem Backend neu in den State laden (kein Reload-Flackern).
  useRealtime({
    table: "property_addons",
    filter: `property_id=eq.${propertyId}`,
    onChange: () => {
      void listAddons(propertyId).then((res) => {
        if (res.ok) setItems(res.data.items);
      });
    },
  });

  function startCreate() {
    setEditing("new");
    setDraft(emptyDraft(items.length));
  }

  function startEdit(a: Addon) {
    setEditing(a.id);
    setDraft({
      name: { ...a.name },
      description: { ...a.description },
      media: [...a.media],
      price: a.price,
      basis: a.basis,
      mandatory: a.mandatory,
      appears_in: [...a.appears_in],
      available_until: a.available_until,
      tax_rate: a.tax_rate,
      active: a.active,
      sort_order: a.sort_order,
    });
  }

  function cancel() {
    setEditing(null);
    setDraft(null);
  }

  function patch<K extends keyof AddonInput>(key: K, value: AddonInput[K]) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }

  function toggleSurface(s: AddonSurface) {
    setDraft((d) => {
      if (!d) return d;
      const cur = d.appears_in ?? [];
      const next = cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s];
      return { ...d, appears_in: next };
    });
  }

  async function save() {
    if (!draft) return;
    setBusy(true);
    const res =
      editing === "new"
        ? await createAddon(propertyId, draft)
        : await updateAddon(editing as string, draft);
    setBusy(false);
    if (res.ok) {
      toast.success(t("addonsManager.toastSaved"));
      cancel();
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  async function remove(id: string) {
    if (!window.confirm(t("addonsManager.confirmDelete"))) return;
    const res = await deleteAddon(id);
    if (res.ok) {
      setItems((xs) => xs.filter((x) => x.id !== id));
      toast.success(t("addonsManager.toastDeleted"));
      router.refresh();
    } else {
      toast.error(res.error);
    }
  }

  async function onMedia(addonId: string, file: File | undefined) {
    if (!file) return;
    const res = await uploadAddonMedia(addonId, file);
    if (res.ok) {
      patch("media", res.data.media);
      toast.success(t("addonsManager.toastMediaUploaded"));
    } else {
      toast.error(res.error);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-2xl font-extrabold">
            {t("addonsManager.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("addonsManager.subtitle")}
          </p>
        </div>
        {editing === null && (
          <Button onClick={startCreate}>
            <Icon icon="ph:plus" className="size-4" />
            {t("addonsManager.new")}
          </Button>
        )}
      </div>

      {editing !== null && draft && (
        <AddonForm
          draft={draft}
          editingId={editing === "new" ? null : (editing as string)}
          busy={busy}
          currency={currency}
          onPatch={patch}
          onToggleSurface={toggleSurface}
          onMedia={onMedia}
          onSave={() => void save()}
          onCancel={cancel}
        />
      )}

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {t("addonsManager.emptyState")}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map((a) => (
            <Card
              key={a.id}
              className="flex flex-wrap items-center gap-4 p-4"
            >
              <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-(--radius) bg-secondary">
                {a.media[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={a.media[0]} alt="" className="size-full object-cover" />
                ) : (
                  <Icon icon="ph:plus-circle" className="size-5 text-muted-foreground" />
                )}
              </span>
              <div className="flex min-w-40 flex-1 flex-col">
                <span className="font-medium">
                  {a.name.de || a.name.en || t("addonsManager.unnamed")}
                  {a.mandatory && (
                    <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-xs">
                      {t("addonsManager.mandatoryBadge")}
                    </span>
                  )}
                  {!a.active && (
                    <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                      {t("addonsManager.inactiveBadge")}
                    </span>
                  )}
                </span>
                <span className="text-sm text-muted-foreground">
                  {money(a.price)}{" "}
                  {basisOptions.find((b) => b.value === a.basis)?.label}
                  {" · "}
                  {a.appears_in
                    .map((s) => surfaces.find((x) => x.value === s)?.label)
                    .filter(Boolean)
                    .join(", ")}
                </span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => startEdit(a)}>
                  {t("addonsManager.edit")}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => void remove(a.id)}
                  aria-label={t("addonsManager.delete")}
                >
                  <Icon icon="ph:trash" className="size-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function AddonForm({
  draft,
  editingId,
  busy,
  currency,
  onPatch,
  onToggleSurface,
  onMedia,
  onSave,
  onCancel,
}: {
  draft: AddonInput;
  editingId: string | null;
  busy: boolean;
  currency: string | null;
  onPatch: <K extends keyof AddonInput>(key: K, value: AddonInput[K]) => void;
  onToggleSurface: (s: AddonSurface) => void;
  onMedia: (addonId: string, file: File | undefined) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("objects");
  const basisOptions = getBasisOptions(t);
  const surfaces = getSurfaces(t);
  const availability = getAvailability(t);
  return (
    <Card className="flex flex-col gap-4 p-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t("addonsManager.nameDe")}>
          <Input
            value={draft.name?.de ?? ""}
            onChange={(e) =>
              onPatch("name", { ...draft.name, de: e.target.value })
            }
          />
        </Field>
        <Field label={t("addonsManager.nameEn")}>
          <Input
            value={draft.name?.en ?? ""}
            onChange={(e) =>
              onPatch("name", { ...draft.name, en: e.target.value })
            }
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label={t("addonsManager.descriptionDe")}>
          <Textarea
            value={draft.description?.de ?? ""}
            onChange={(e) =>
              onPatch("description", { ...draft.description, de: e.target.value })
            }
          />
        </Field>
        <Field label={t("addonsManager.descriptionEn")}>
          <Textarea
            value={draft.description?.en ?? ""}
            onChange={(e) =>
              onPatch("description", { ...draft.description, en: e.target.value })
            }
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field
          label={
            currency
              ? t("addonsManager.priceWithCurrency", { currency })
              : t("addonsManager.price")
          }
        >
          <Input
            type="number"
            min={0}
            step={0.5}
            value={draft.price ?? 0}
            onChange={(e) => onPatch("price", Number(e.target.value))}
          />
        </Field>
        <Field label={t("addonsManager.basisLabel")}>
          <NativeSelect
            value={draft.basis}
            onChange={(e) => onPatch("basis", e.target.value as Addon["basis"])}
          >
            {basisOptions.map((b) => (
              <option key={b.value} value={b.value}>
                {b.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={t("addonsManager.taxRateLabel")}>
          <Input
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={draft.tax_rate ?? ""}
            onChange={(e) =>
              onPatch("tax_rate", e.target.value === "" ? null : Number(e.target.value))
            }
          />
        </Field>
      </div>

      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-muted-foreground">
          {t("addonsManager.appearsIn")}
        </span>
        <div className="flex flex-wrap gap-4">
          {surfaces.map((s) => (
            <label key={s.value} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                className="size-4 accent-[var(--color-accent)]"
                checked={(draft.appears_in ?? []).includes(s.value)}
                onChange={() => onToggleSurface(s.value)}
              />
              {s.label}
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label={t("addonsManager.availableUntilLabel")}>
          <NativeSelect
            value={draft.available_until}
            onChange={(e) =>
              onPatch("available_until", e.target.value as Addon["available_until"])
            }
          >
            {availability.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </NativeSelect>
        </Field>
        <Field label={t("addonsManager.sortOrderLabel")}>
          <Input
            type="number"
            min={0}
            value={draft.sort_order ?? 0}
            onChange={(e) => onPatch("sort_order", Number(e.target.value))}
          />
        </Field>
        <div className="flex flex-col justify-end gap-2 pb-1">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-[var(--color-accent)]"
              checked={draft.mandatory ?? false}
              onChange={(e) => onPatch("mandatory", e.target.checked)}
            />
            {t("addonsManager.mandatoryCheckbox")}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 accent-[var(--color-accent)]"
              checked={draft.active ?? true}
              onChange={(e) => onPatch("active", e.target.checked)}
            />
            {t("addonsManager.activeCheckbox")}
          </label>
        </div>
      </div>

      {/* Medien: Upload nur möglich, wenn das Add-on schon existiert (braucht ID). */}
      <div className="flex flex-col gap-2">
        <span className="text-sm font-medium text-muted-foreground">
          {t("addonsManager.mediaCount", { count: (draft.media ?? []).length })}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          {(draft.media ?? []).map((url) => (
            <span
              key={url}
              className="size-16 overflow-hidden rounded-(--radius) bg-secondary"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="size-full object-cover" />
            </span>
          ))}
          {editingId ? (
            <label className="flex size-16 cursor-pointer items-center justify-center rounded-(--radius) border border-dashed text-muted-foreground hover:text-foreground">
              <Icon icon="ph:plus" className="size-5" />
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => onMedia(editingId, e.target.files?.[0])}
              />
            </label>
          ) : (
            <span className="text-xs text-muted-foreground">
              {t("addonsManager.mediaUploadHint")}
            </span>
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>
          {t("addonsManager.cancel")}
        </Button>
        <Button onClick={onSave} disabled={busy}>
          {busy ? t("addonsManager.saving") : t("addonsManager.save")}
        </Button>
      </div>
    </Card>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-sm font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

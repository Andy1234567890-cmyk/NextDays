"use client";

// Eigentümer-Liste + Anlage-Dialog (Agentur-Sicht). Karten je Eigentümer mit
// Stammdaten-Kurzinfo, Provision und Objekt-Anzahl; Klick öffnet das Detail.
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createOwner, type OwnerListItem } from "@/lib/owners";

export function OwnersList({
  initial,
  loadError,
}: {
  initial: OwnerListItem[];
  loadError: string | null;
}) {
  const t = useTranslations("owners");
  const router = useRouter();
  const [owners] = useState<OwnerListItem[]>(initial);
  const [creating, setCreating] = useState(false);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-3xl font-extrabold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button onClick={() => setCreating(true)}>
          <Icon icon="ph:plus" className="size-4" />
          {t("new")}
        </Button>
      </div>

      {loadError ? (
        <Card className="p-5 text-sm text-destructive">{loadError}</Card>
      ) : owners.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
          <span className="flex size-14 items-center justify-center rounded-full bg-secondary">
            <Icon icon="ph:user-circle-gear" className="size-7 text-muted-foreground" />
          </span>
          <p className="font-display text-lg font-extrabold">{t("emptyTitle")}</p>
          <p className="max-w-sm text-sm text-muted-foreground">{t("emptyHint")}</p>
          <Button onClick={() => setCreating(true)}>
            <Icon icon="ph:plus" className="size-4" />
            {t("new")}
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {owners.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => router.push(`/eigentuemer/${o.id}`)}
              className="text-left"
            >
              <Card className="flex flex-col gap-2 p-5 transition-shadow hover:shadow-md">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 items-center justify-center rounded-full bg-secondary">
                    <Icon icon="ph:user" className="size-5 text-muted-foreground" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{o.name}</p>
                    {o.company && (
                      <p className="truncate text-xs text-muted-foreground">
                        {o.company}
                      </p>
                    )}
                  </div>
                </div>
                <p className="truncate text-sm text-muted-foreground">
                  {o.email ?? "—"}
                </p>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {t("commissionShort")}: {commissionLabel(o)}
                  </span>
                  <span>
                    {t("propertyCount", { count: o.property_count })}
                  </span>
                </div>
              </Card>
            </button>
          ))}
        </div>
      )}

      {creating && (
        <CreateOwnerDialog
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            toast.success(t("created"));
            router.push(`/eigentuemer/${id}`);
          }}
        />
      )}
    </div>
  );
}

function CreateOwnerDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const t = useTranslations("owners");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!name.trim()) return;
    setBusy(true);
    const res = await createOwner({ name: name.trim(), email: email.trim() || null });
    setBusy(false);
    if (res.ok) onCreated(res.data.id);
    else toast.error(res.error);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
      onClick={onClose}
    >
      <Card
        className="flex w-full max-w-md flex-col gap-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-display text-xl font-extrabold">{t("newTitle")}</h2>
        <div className="flex flex-col gap-1">
          <Label htmlFor="owner-name">{t("fields.name")}</Label>
          <Input
            id="owner-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("placeholders.name")}
            autoFocus
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="owner-email">{t("fields.email")}</Label>
          <Input
            id="owner-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("placeholders.email")}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {t("cancel")}
          </Button>
          <Button onClick={() => void submit()} disabled={busy || !name.trim()}>
            {busy ? t("saving") : t("create")}
          </Button>
        </div>
      </Card>
    </div>
  );
}

// Effektive Provision für die Karte: einheitlich → ein Wert, sonst Spanne.
// Ohne zugeordnete Objekte (min/max null) der Owner-Default.
function commissionLabel(o: OwnerListItem): string {
  const lo = o.commission_min;
  const hi = o.commission_max;
  if (lo == null || hi == null) return `${o.default_commission_pct}%`;
  return lo === hi ? `${lo}%` : `${lo}–${hi}%`;
}

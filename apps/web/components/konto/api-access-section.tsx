"use client";

// API-Zugang (Booking-„Machine Account"-Modell): Liste der API-Clients + Dialog
// zum Anlegen (Name · Umgebung · Berechtigungs-Matrix Lesen/Schreiben je Bereich
// · Objekt-Auswahl). Beim Erzeugen/Rotieren wird das Client-Secret GENAU EINMAL
// gezeigt (show-once). Widerrufen/Rotieren pro Client.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import {
  createApiClient,
  revokeApiClient,
  rotateApiClientSecret,
  type ApiClient,
  type ApiClientCreated,
} from "@/lib/api-clients";
import { API_SCOPE_CATALOG } from "@/lib/api-scopes";

type PropertyOpt = { id: string; title: string };

export function ApiAccessSection({
  clients,
  properties,
}: {
  clients: ApiClient[];
  properties: PropertyOpt[];
}) {
  const t = useTranslations("apiAccess");
  const router = useRouter();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [secret, setSecret] = useState<ApiClientCreated | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function handleRevoke(c: ApiClient) {
    if (!window.confirm(t("revokeConfirm"))) return;
    setBusy(c.id);
    const res = await revokeApiClient(c.id);
    setBusy(null);
    if (res.ok) {
      toast.success(t("revokeOk"));
      router.refresh();
    } else {
      toast.error(t("revokeErr"));
    }
  }

  async function handleRotate(c: ApiClient) {
    if (!window.confirm(t("rotateConfirm"))) return;
    setBusy(c.id);
    const res = await rotateApiClientSecret(c.id);
    setBusy(null);
    if (res.ok) {
      setSecret(res.data);
      toast.success(t("rotateOk"));
      router.refresh();
    } else {
      toast.error(t("rotateErr"));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-extrabold">{t("title")}</h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {t("subtitle")}
          </p>
        </div>
        <Button type="button" onClick={() => setDialogOpen(true)}>
          <Icon icon="ph:plus" className="size-4" />
          {t("newClient")}
        </Button>
      </div>

      {clients.length === 0 ? (
        <Card className="p-6 text-sm text-muted-foreground">
          {t("noClients")}
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="grid grid-cols-[1.5fr_0.7fr_1.5fr_1fr_auto] gap-3 border-b border-border bg-secondary/40 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <span>{t("colName")}</span>
            <span>{t("colEnv")}</span>
            <span>{t("colScopes")}</span>
            <span>{t("colLastUsed")}</span>
            <span />
          </div>
          {clients.map((c) => (
            <div
              key={c.id}
              className="grid grid-cols-[1.5fr_0.7fr_1.5fr_1fr_auto] items-center gap-3 border-b border-border px-4 py-3 text-sm last:border-b-0"
            >
              <div className="min-w-0">
                <div className="truncate font-medium">{c.name}</div>
                <div className="truncate font-mono text-xs text-muted-foreground">
                  {c.client_id}
                </div>
                {c.revoked_at && (
                  <span className="text-xs text-destructive">
                    {t("revoked")}
                  </span>
                )}
              </div>
              <span>
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    c.is_test
                      ? "bg-amber-500/15 text-amber-600"
                      : "bg-emerald-500/15 text-emerald-600"
                  }`}
                >
                  {c.is_test ? t("test") : t("live")}
                </span>
              </span>
              <span className="truncate text-xs text-muted-foreground">
                {c.scopes.join(", ")}
              </span>
              <span className="text-xs text-muted-foreground">
                {c.last_used_at
                  ? new Date(c.last_used_at).toLocaleDateString()
                  : t("never")}
              </span>
              <div className="flex items-center gap-1">
                {!c.revoked_at && (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={busy === c.id}
                      onClick={() => void handleRotate(c)}
                    >
                      <Icon icon="ph:arrows-clockwise" className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-destructive"
                      disabled={busy === c.id}
                      onClick={() => void handleRevoke(c)}
                    >
                      <Icon icon="ph:trash" className="size-4" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </Card>
      )}

      <p className="text-xs text-muted-foreground">{t("docsHint")}</p>

      {dialogOpen && (
        <CreateDialog
          properties={properties}
          onClose={() => setDialogOpen(false)}
          onCreated={(created) => {
            setDialogOpen(false);
            setSecret(created);
            router.refresh();
          }}
        />
      )}

      {secret && <SecretDialog client={secret} onClose={() => setSecret(null)} />}
    </div>
  );
}

function CreateDialog({
  properties,
  onClose,
  onCreated,
}: {
  properties: PropertyOpt[];
  onClose: () => void;
  onCreated: (c: ApiClientCreated) => void;
}) {
  const t = useTranslations("apiAccess");
  const [name, setName] = useState("");
  const [isTest, setIsTest] = useState(false);
  const [scopes, setScopes] = useState<Set<string>>(new Set());
  const [objectMode, setObjectMode] = useState<"all" | "selected">("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  function toggleScope(key: string) {
    setScopes((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }
  function toggleObject(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function submit() {
    if (!name.trim()) return;
    if (scopes.size === 0) {
      toast.error(t("needScope"));
      return;
    }
    setSaving(true);
    const res = await createApiClient({
      name: name.trim(),
      isTest,
      scopes: [...scopes],
      propertyIds: objectMode === "all" ? [] : [...selectedIds],
    });
    setSaving(false);
    if (res.ok) {
      toast.success(t("createOk"));
      onCreated(res.data);
    } else {
      toast.error(res.error || t("createErr"));
    }
  }

  return (
    <Overlay onClose={onClose}>
      <h3 className="mb-4 font-display text-lg font-extrabold">
        {t("newClient")}
      </h3>
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">{t("name")}</span>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("namePlaceholder")}
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium">{t("environment")}</span>
          <NativeSelect
            value={isTest ? "test" : "live"}
            onChange={(e) => setIsTest(e.target.value === "test")}
          >
            <option value="live">{t("live")}</option>
            <option value="test">{t("test")}</option>
          </NativeSelect>
        </label>

        {/* Berechtigungs-Matrix: Lesen/Schreiben je Bereich */}
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">{t("scopesLabel")}</span>
          <div className="rounded-(--radius) border border-border">
            <div className="grid grid-cols-[1fr_auto_auto] gap-2 border-b border-border px-3 py-1.5 text-xs text-muted-foreground">
              <span />
              <span className="w-16 text-center">{t("scopeRead")}</span>
              <span className="w-16 text-center">{t("scopeWrite")}</span>
            </div>
            {API_SCOPE_CATALOG.map((s) => {
              const readKey = `${s.key}:read`;
              const writeKey = `${s.key}:write`;
              const label =
                s.labelKey === "calendarSync"
                  ? t("scopeCalendarSync")
                  : t(
                      `scope${s.labelKey.charAt(0).toUpperCase()}${s.labelKey.slice(1)}` as never,
                    );
              return (
                <div
                  key={s.key}
                  className="grid grid-cols-[1fr_auto_auto] items-center gap-2 border-b border-border px-3 py-2 text-sm last:border-b-0"
                >
                  <span>{label}</span>
                  <input
                    type="checkbox"
                    className="mx-auto w-16"
                    checked={scopes.has(readKey)}
                    onChange={() => toggleScope(readKey)}
                  />
                  <input
                    type="checkbox"
                    className="mx-auto w-16"
                    checked={scopes.has(writeKey)}
                    onChange={() => toggleScope(writeKey)}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* Objekt-Beschränkung */}
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">{t("objectsLabel")}</span>
          <NativeSelect
            value={objectMode}
            onChange={(e) => setObjectMode(e.target.value as "all" | "selected")}
          >
            <option value="all">{t("allObjects")}</option>
            <option value="selected">{t("selectedObjects")}</option>
          </NativeSelect>
          {objectMode === "selected" && (
            <div className="max-h-40 overflow-y-auto rounded-(--radius) border border-border p-2">
              {properties.map((p) => (
                <label
                  key={p.id}
                  className="flex items-center gap-2 px-1 py-1 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(p.id)}
                    onChange={() => toggleObject(p.id)}
                  />
                  <span className="truncate">{p.title}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onClose}>
          {t("cancel")}
        </Button>
        <Button
          type="button"
          disabled={saving || !name.trim() || scopes.size === 0}
          onClick={() => void submit()}
        >
          {t("create")}
        </Button>
      </div>
    </Overlay>
  );
}

function SecretDialog({
  client,
  onClose,
}: {
  client: ApiClientCreated;
  onClose: () => void;
}) {
  const t = useTranslations("apiAccess");
  async function copy(v: string) {
    await navigator.clipboard.writeText(v);
    toast.success(t("copied"));
  }
  return (
    <Overlay onClose={onClose}>
      <h3 className="mb-2 font-display text-lg font-extrabold">
        {t("secretTitle")}
      </h3>
      <p className="mb-4 rounded-(--radius) bg-amber-500/10 px-3 py-2 text-sm text-amber-700">
        {t("secretWarn")}
      </p>
      <div className="flex flex-col gap-3">
        <Field label={t("clientId")} value={client.client_id} onCopy={copy} />
        <Field
          label={t("clientSecret")}
          value={client.client_secret}
          onCopy={copy}
        />
      </div>
      <div className="mt-6 flex justify-end">
        <Button type="button" onClick={onClose}>
          {t("done")}
        </Button>
      </div>
    </Overlay>
  );
}

function Field({
  label,
  value,
  onCopy,
}: {
  label: string;
  value: string;
  onCopy: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-(--radius) bg-secondary/60 px-2 py-1.5 font-mono text-xs">
          {value}
        </code>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onCopy(value)}
        >
          <Icon icon="ph:copy" className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function Overlay({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg rounded-(--radius) bg-background p-6 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

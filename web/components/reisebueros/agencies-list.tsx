"use client";

// Partner-Liste (Reisebüros/Veranstalter): Suche, Inaktiv-Filter, Neuanlage.
// Zeilen verlinken auf die Kartei (/reisebueros/[id]).
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { type Agency, type AgencyKind, createAgency } from "@/lib/travel-agencies";

const KIND_ICONS: Record<AgencyKind, string> = {
  travel_agent: "ph:handshake",
  tour_operator: "ph:airplane-tilt",
  company: "ph:buildings",
  source: "ph:funnel",
};

export function AgenciesList({ initial }: { initial: Agency[] }) {
  const t = useTranslations("travelAgencies");
  const router = useRouter();
  const [q, setQ] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newKind, setNewKind] = useState<AgencyKind>("travel_agent");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return initial.filter(
      (a) =>
        (showInactive || a.is_active) &&
        (!needle || a.name.toLowerCase().includes(needle)),
    );
  }, [initial, q, showInactive]);

  function onCreate() {
    if (!newName.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await createAgency({ name: newName.trim(), kind: newKind });
      if (res.ok) {
        setCreating(false);
        setNewName("");
        router.push(`/reisebueros/${res.data.id}`);
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("subtitle")}</p>
        </div>
        <Button onClick={() => setCreating((v) => !v)}>
          <Icon icon="ph:plus" className="size-4" />
          {t("new")}
        </Button>
      </header>

      {creating && (
        <div className="flex flex-wrap items-end gap-3 rounded-(--radius) border border-border bg-card p-4">
          <label className="flex min-w-56 flex-1 flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">{t("name")}</span>
            <Input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") onCreate(); }}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted-foreground">{t("kind")}</span>
            <NativeSelect value={newKind} onChange={(e) => setNewKind(e.target.value as AgencyKind)}>
              <option value="travel_agent">{t("kind_travel_agent")}</option>
              <option value="tour_operator">{t("kind_tour_operator")}</option>
              <option value="company">{t("kind_company")}</option>
              <option value="source">{t("kind_source")}</option>
            </NativeSelect>
          </label>
          <Button onClick={onCreate} disabled={pending || !newName.trim()}>
            {t("create")}
          </Button>
          {error && <p className="w-full text-xs text-destructive">{error}</p>}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("search")}
          className="max-w-xs"
        />
        <label className="flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
            className="size-4 accent-primary"
          />
          {t("showInactive")}
        </label>
      </div>

      {rows.length === 0 ? (
        <p className="rounded-(--radius) border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {t("empty")}
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-border rounded-(--radius) border border-border">
          {rows.map((a) => (
            <li key={a.id}>
              <Link
                href={`/reisebueros/${a.id}`}
                className="flex items-center gap-3 p-3 transition hover:bg-secondary/50"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-secondary">
                  <Icon icon={KIND_ICONS[a.kind]} className="size-5 text-muted-foreground" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium">
                    {a.name}
                    {!a.is_active && (
                      <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                        {t("inactive")}
                      </span>
                    )}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {t(`kind_${a.kind}`)}
                    {a.city ? ` · ${a.city}` : ""}
                    {a.email ? ` · ${a.email}` : ""}
                  </span>
                </div>
                {a.commission_pct != null && (
                  <span className="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium">
                    {a.commission_pct} %
                  </span>
                )}
                <Icon icon="ph:caret-right" className="size-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

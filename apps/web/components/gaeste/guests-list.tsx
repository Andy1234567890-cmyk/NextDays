"use client";

// Gästeliste mit Suche + Filtern (VIP/blockiert). Zeilen verlinken auf die
// Gästekarte. Felder sind serverseitig maskiert — wir rendern nur, was kommt
// (null → „—"). Neuanlage öffnet einen schlanken Dialog.
import { Icon } from "@iconify/react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import type { GuestAccess } from "@/lib/guests-access";
import { type GuestListItem, createGuest, listGuests } from "@/lib/guests";

export function GuestsList({
  guests,
  total,
  error,
  access,
}: {
  guests: GuestListItem[];
  total: number;
  error: string | null;
  access: GuestAccess;
}) {
  const t = useTranslations("guests");
  const router = useRouter();
  const [rows, setRows] = useState<GuestListItem[]>(guests);
  const [q, setQ] = useState("");
  const [onlyBlocked, setOnlyBlocked] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [pending, start] = useTransition();

  const reload = (opts: { q?: string; blocked?: boolean }) =>
    start(async () => {
      const res = await listGuests(opts);
      if (res.ok) setRows(res.data.items);
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-bold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">
            {t("count", { count: total })}
          </p>
        </div>
        {access.canEdit && (
          <Button type="button" onClick={() => setShowNew(true)}>
            <Icon icon="ph:plus" className="size-4" />
            {t("new")}
          </Button>
        )}
      </div>

      {/* Suche + Filter */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-60">
          <Icon
            icon="ph:magnifying-glass"
            className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && reload({ q, blocked: onlyBlocked || undefined })}
            placeholder={t("searchPlaceholder")}
            className="w-full rounded-full border border-border bg-background py-2 pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-accent/40"
          />
        </div>
        <label className="flex items-center gap-2 rounded-full border border-border px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={onlyBlocked}
            onChange={(e) => {
              setOnlyBlocked(e.target.checked);
              reload({ q: q || undefined, blocked: e.target.checked || undefined });
            }}
            className="size-4 accent-[var(--color-accent)]"
          />
          {t("filterBlocked")}
        </label>
        <Button
          type="button"
          variant="outline"
          onClick={() => reload({ q: q || undefined, blocked: onlyBlocked || undefined })}
          disabled={pending}
        >
          {t("search")}
        </Button>
      </div>

      {error && (
        <p className="rounded-(--radius) bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* Tabelle */}
      <div className="overflow-hidden rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">{t("colName")}</th>
              {access.contact && <th className="px-4 py-2 font-medium">{t("colContact")}</th>}
              <th className="px-4 py-2 font-medium">{t("colCompany")}</th>
              <th className="px-4 py-2 font-medium">{t("colVip")}</th>
              <th className="px-4 py-2 font-medium">{t("colStays")}</th>
              <th className="px-4 py-2 font-medium">{t("colLastStay")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  {t("empty")}
                </td>
              </tr>
            ) : (
              rows.map((g) => (
                <tr
                  key={g.id}
                  onClick={() => router.push(`/gaeste/${g.id}`)}
                  className="cursor-pointer border-t border-border hover:bg-muted/30"
                >
                  <td className="px-4 py-2.5">
                    <span className="flex items-center gap-2">
                      {g.is_blocked && (
                        <Icon icon="ph:prohibit" className="size-4 text-destructive" />
                      )}
                      {g.name ?? "—"}
                    </span>
                  </td>
                  {access.contact && (
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {g.email ?? g.phone ?? "—"}
                    </td>
                  )}
                  <td className="px-4 py-2.5 text-muted-foreground">{g.company ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    {g.vip_code ? (
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                        {g.vip_code}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{g.stays_count}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">
                    {g.last_stay_at ?? "—"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {showNew && (
        <NewGuestDialog
          onClose={() => setShowNew(false)}
          onCreated={(id) => router.push(`/gaeste/${id}`)}
        />
      )}
    </div>
  );
}

function NewGuestDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const t = useTranslations("guests");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const submit = () =>
    start(async () => {
      setError(null);
      const res = await createGuest({
        first_name: firstName || null,
        last_name: lastName || null,
        email: email || null,
      });
      if (res.ok) onCreated(res.data.id);
      else setError(res.error);
    });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">{t("newTitle")}</h2>
          <button type="button" aria-label={t("close")} onClick={onClose}>
            <Icon icon="ph:x" className="size-5 text-muted-foreground" />
          </button>
        </div>
        <div className="flex flex-col gap-3">
          <Field label={t("firstName")} value={firstName} onChange={setFirstName} />
          <Field label={t("lastName")} value={lastName} onChange={setLastName} />
          <Field label={t("email")} value={email} onChange={setEmail} />
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button type="button" onClick={submit} disabled={pending}>
            {t("create")}
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-(--radius) border border-border bg-background px-3 py-2 outline-none focus:ring-2 focus:ring-accent/40"
      />
    </label>
  );
}

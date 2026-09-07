"use client";

// Partner-Liste (B2B-Deals): Suche, Neuanlage mit getrennter Anschrift,
// Zeilen verlinken auf die Kartei (/crm/partner/[id]).
import { Icon } from "@iconify/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";
import { createPartner } from "@/lib/crm";
import type { Partner } from "@/lib/crm-meta";

import { type Adresse, AdresseFelder, adresseZeile } from "./adresse-felder";

const LEERE_ADRESSE: Adresse = {
  street: null,
  house_number: null,
  postal_code: null,
  city: null,
  country: null,
};

export function PartnersList({ initial }: { initial: Partner[] }) {
  const t = useTranslations("crm");
  const router = useRouter();
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [adresse, setAdresse] = useState<Adresse>(LEERE_ADRESSE);
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return initial.filter(
      (p) =>
        !needle ||
        p.name.toLowerCase().includes(needle) ||
        (p.city ?? "").toLowerCase().includes(needle) ||
        (p.contact_name ?? "").toLowerCase().includes(needle),
    );
  }, [initial, q]);

  function anlegen() {
    if (!name.trim()) return;
    setError(null);
    startTransition(async () => {
      const res = await createPartner({
        name: name.trim(),
        ...adresse,
        contact_name: contactName.trim() || null,
        contact_email: contactEmail.trim() || null,
        contact_phone: contactPhone.trim() || null,
      });
      if (res.ok) {
        setCreating(false);
        setName("");
        setAdresse(LEERE_ADRESSE);
        router.push(`/crm/partner/${res.data.id}`);
      } else setError(res.error);
    });
  }

  const feld = "flex flex-col gap-1";
  const label = "text-xs font-medium text-muted-foreground";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("partner.suche")}
          className="max-w-xs"
        />
        <Button className="ml-auto" onClick={() => setCreating((v) => !v)}>
          <Icon icon="ph:plus" className="size-4" />
          {t("partner.neu")}
        </Button>
      </div>

      {creating && (
        <div className="flex flex-col gap-3 rounded-(--radius) border border-border bg-card p-4">
          <label className={feld}>
            <span className={label}>{t("partner.name")}</span>
            <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <AdresseFelder wert={adresse} onChange={(p) => setAdresse((a) => ({ ...a, ...p }))} />
          <div className="grid grid-cols-3 gap-3">
            <label className={feld}>
              <span className={label}>{t("partner.ansprechpartner")}</span>
              <Input value={contactName} onChange={(e) => setContactName(e.target.value)} />
            </label>
            <label className={feld}>
              <span className={label}>{t("partner.kontaktEmail")}</span>
              <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
            </label>
            <label className={feld}>
              <span className={label}>{t("partner.kontaktTelefon")}</span>
              <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
            </label>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={anlegen} disabled={pending || !name.trim()}>
              {t("partner.anlegen")}
            </Button>
            <Button variant="outline" onClick={() => setCreating(false)} disabled={pending}>
              {t("allgemein.abbrechen")}
            </Button>
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="rounded-(--radius) border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {t("partner.leer")}
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-(--radius) border border-border bg-card">
          {rows.map((p) => (
            <li key={p.id}>
              <Link
                href={`/crm/partner/${p.id}`}
                className="flex items-center gap-3 px-4 py-3 text-sm transition-colors hover:bg-secondary/60"
              >
                <span className="flex size-9 items-center justify-center rounded-full bg-secondary">
                  <Icon icon="ph:storefront" className="size-4" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-medium">{p.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {adresseZeile(p) ?? p.address ?? "—"}
                  </span>
                </span>
                {p.contact_name && (
                  <span className="hidden text-xs text-muted-foreground sm:block">
                    <Icon icon="ph:user" className="mr-1 inline size-3" />
                    {p.contact_name}
                  </span>
                )}
                <Icon icon="ph:caret-right" className="size-4 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

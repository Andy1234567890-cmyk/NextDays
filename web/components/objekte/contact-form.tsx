"use client";

// Kontakt-Seite eines Objekts (Contact page):
//  Wähle einen Hauptkontakt (Nutzer des eigenen Tenants), der Reservierungen
//  und Anfragen bearbeitet. Suche + Auswahl per Klick; die Auswahl wird in
//  type_attributes.contact.userId des Objekts gespeichert. „Bearbeiten" öffnet
//  das Profil des Kontakts (Slide-over „Kontaktdaten bearbeiten").
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { Button } from "@nextdays/ui/button";
import { Input } from "@nextdays/ui/input";
import { type Account, type TenantUser } from "@/lib/account";
import { type Property, updateProperty } from "@/lib/properties";
import { ContactProfileEditor } from "@/components/objekte/contact-profile-editor";

function useRoleLabels(): Record<string, string> {
  const t = useTranslations("objects");
  return {
    admin: t("contactForm.roleAdmin"),
    co_admin: t("contactForm.roleCoAdmin"),
    owner: t("contactForm.roleOwner"),
    staff: t("contactForm.roleStaff"),
    cleaner: t("contactForm.roleCleaner"),
  };
}

export function ContactForm({
  initial,
  users,
  usersError = null,
  account,
}: {
  initial: Property;
  users: TenantUser[];
  usersError?: string | null;
  account: Account;
}) {
  const t = useTranslations("objects");
  const ROLE_LABELS = useRoleLabels();
  const [p, setP] = useState<Property>(initial);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState(false);

  const selectedId =
    (p.type_attributes?.contact as { userId?: string } | undefined)?.userId ??
    null;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      [u.full_name, u.email, u.phone]
        .filter(Boolean)
        .some((v) => v!.toLowerCase().includes(q)),
    );
  }, [users, query]);

  async function selectContact(userId: string) {
    const res = await updateProperty(p.id, {
      type_attributes: {
        ...p.type_attributes,
        contact: { ...(p.type_attributes?.contact as object), userId },
      },
    });
    if (res.ok) setP(res.data);
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-extrabold">
          {t("contactForm.title")}
        </h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          {t("contactForm.description")}
        </p>
      </header>

      <div className="flex flex-col gap-4">
        {/* Suche */}
        <div className="relative">
          <Icon
            icon="ph:magnifying-glass"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("contactForm.searchPlaceholder")}
            className="pl-9"
          />
        </div>

        {/* Kontaktliste */}
        <div className="flex flex-col divide-y rounded-(--radius) border">
          {usersError ? (
            <p className="p-5 text-sm text-destructive">
              {t("contactForm.loadError", { error: usersError })}
            </p>
          ) : filtered.length === 0 ? (
            <p className="p-5 text-sm text-muted-foreground/70">
              {users.length === 0
                ? t("contactForm.noEligibleUsers")
                : t("contactForm.noSearchResults")}
            </p>
          ) : (
            filtered.map((u) => {
              const selected = u.user_id === selectedId;
              const isSelf = u.user_id === account.user_id;
              return (
                <div
                  key={u.user_id}
                  className="flex items-center gap-4 p-4 transition-colors hover:bg-muted/40"
                >
                  <Avatar name={u.full_name} url={u.avatar_url} t={t} />
                  <button
                    type="button"
                    onClick={() => selectContact(u.user_id)}
                    className="flex flex-1 flex-col items-start text-left leading-tight"
                  >
                    <span className="font-semibold">
                      {u.full_name ?? t("contactForm.unnamedUser")}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {[u.email, u.phone].filter(Boolean).join(" · ")}
                      {u.role && (
                        <> — {ROLE_LABELS[u.role] ?? u.role}</>
                      )}
                    </span>
                  </button>

                  {selected && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent/15 px-2.5 py-1 text-xs font-medium text-accent">
                      <Icon icon="ph:check-circle" className="size-3.5" />
                      {t("contactForm.mainContact")}
                    </span>
                  )}

                  {/* „Bearbeiten" führt zum Profil (nur eigenes Profil editierbar). */}
                  {isSelf && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditing(true)}
                    >
                      {t("contactForm.edit")}
                    </Button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {editing && (
        <ContactProfileEditor
          account={account}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}

function Avatar({
  name,
  url,
  t,
}: {
  name: string | null;
  url: string | null;
  t: ReturnType<typeof useTranslations>;
}) {
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={url}
        alt={name ?? t("contactForm.avatarAlt")}
        className="size-10 shrink-0 rounded-full object-cover"
      />
    );
  }
  const initials = (name ?? "?")
    .split(" ")
    .map((s) => s[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-semibold text-muted-foreground">
      {initials}
    </span>
  );
}

"use client";

// Objekte-Übersicht im Lodgify-Look: Suchleiste (Name/ID) + Typ- und
// Status-Filter oben, darunter ein 4er-Kartenraster. Jede Karte zeigt Titel,
// Typ · Gäste, Adresszeile und die interne Objekt-ID (wie Lodgify „ID: …"),
// dazu die drei Kanal-Chips. Filterung ist rein clientseitig.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { ChannelChips } from "@/components/objekte/channel-chips";
import { Card } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Icon } from "@iconify/react";
import {
  deleteProperty,
  duplicateProperty,
  unlistPropertyWebsite,
  type Property,
} from "@/lib/properties";
import {
  STATUS_LABELS,
  STATUS_OPTIONS,
  TYPE_LABELS,
  typeOptionsFor,
} from "@/lib/property-meta";

export function ObjectsList({
  items,
  accommodationType,
}: {
  items: Property[];
  accommodationType: "vacation_rental" | "hotel" | null;
}) {
  const t = useTranslations("objects");
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState<"default" | "az" | "za">("default");
  const [busyId, setBusyId] = useState<string | null>(null);

  async function handleDelete(p: Property) {
    if (!window.confirm(t("objektePage.deleteConfirm", { title: p.title }))) {
      return;
    }
    setBusyId(p.id);
    const res = await deleteProperty(p.id);
    setBusyId(null);
    if (res.ok) {
      toast.success(t("objektePage.deleteOk"));
      router.refresh();
    } else {
      toast.error(t("objektePage.deleteErr"));
    }
  }

  async function handleDuplicate(p: Property) {
    setBusyId(p.id);
    const res = await duplicateProperty(p.id);
    setBusyId(null);
    if (res.ok) {
      toast.success(t("objektePage.duplicateOk"));
      router.refresh();
    } else {
      toast.error(t("objektePage.duplicateErr"));
    }
  }

  async function handleUnlistWebsite(p: Property) {
    setBusyId(p.id);
    const res = await unlistPropertyWebsite(p.id);
    setBusyId(null);
    if (res.ok) {
      toast.success(t("objektePage.unlistOk"));
      router.refresh();
    } else {
      toast.error(t("objektePage.unlistErr"));
    }
  }

  const typeOptions = typeOptionsFor(accommodationType);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = items.filter((p) => {
      if (type && p.property_type !== type) return false;
      if (status && p.status !== status) return false;
      if (!q) return true;
      const addr = [p.postal_code, p.city, p.street, p.house_number]
        .filter(Boolean)
        .join(" ");
      return (
        p.title.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q) ||
        addr.toLowerCase().includes(q)
      );
    });
    if (sort === "az" || sort === "za") {
      const dir = sort === "az" ? 1 : -1;
      list.sort((a, b) => dir * a.title.localeCompare(b.title));
    }
    return list;
  }, [items, query, type, status, sort]);

  return (
    <div className="flex flex-col gap-4">
      {/* Filterleiste: Dropdowns (Status · Typ · Sortierung) links, Suchfeld
          nimmt den restlichen Platz — alles in einer Zeile. */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <NativeSelect
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-auto min-w-36"
        >
          <option value="">{t("objektePage.filterAllStatus")}</option>
          {STATUS_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="w-auto min-w-36"
        >
          <option value="">{t("objektePage.filterAllTypes")}</option>
          {typeOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </NativeSelect>
        <NativeSelect
          value={sort}
          onChange={(e) => setSort(e.target.value as "default" | "az" | "za")}
          className="w-auto min-w-36"
        >
          <option value="default">{t("objektePage.sortDefault")}</option>
          <option value="az">{t("objektePage.sortAz")}</option>
          <option value="za">{t("objektePage.sortZa")}</option>
        </NativeSelect>
        <div className="relative flex-1">
          <Icon
            icon="ph:magnifying-glass"
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("objektePage.searchPlaceholder")}
            className="pl-9"
          />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        {t("objektePage.resultCount", { count: filtered.length })}
      </p>

      {filtered.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          {t("objektePage.noMatch")}
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {filtered.map((p) => (
            <Link key={p.id} href={`/objekte/${p.id}`}>
              <Card className="overflow-hidden transition-shadow hover:shadow-md">
                <div className="relative flex h-40 items-center justify-center bg-secondary">
                  {p.photos[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.photos[0]}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Icon
                      icon="ph:house-line"
                      className="size-10 text-muted-foreground"
                    />
                  )}
                  <span className="absolute left-2 top-2 rounded-full bg-background/90 px-2 py-0.5 text-xs font-medium">
                    {STATUS_LABELS[p.status]}
                  </span>
                  {/* Aktionsmenü (Lodgify-Stil) oben rechts. Trigger darf die
                      Karten-Navigation nicht auslösen → preventDefault. */}
                  <div className="absolute right-2 top-2">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          aria-label={t("objektePage.menuOpen")}
                          disabled={busyId === p.id}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                          }}
                          className="flex size-8 items-center justify-center rounded-full bg-background/90 text-foreground shadow-sm transition-colors hover:bg-background disabled:opacity-50"
                        >
                          <Icon icon="ph:dots-three" className="size-5" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DropdownMenuItem asChild>
                          <Link href={`/objekte/${p.id}`}>
                            <Icon icon="ph:pencil-simple" className="size-4" />
                            {t("objektePage.menuEdit")}
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          disabled={p.channels?.website !== "active"}
                          onSelect={(e) => {
                            e.preventDefault();
                            void handleUnlistWebsite(p);
                          }}
                        >
                          <Icon icon="ph:link-break" className="size-4" />
                          {t("objektePage.menuUnlistWebsite")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={(e) => {
                            e.preventDefault();
                            void handleDuplicate(p);
                          }}
                        >
                          <Icon icon="ph:copy" className="size-4" />
                          {t("objektePage.menuDuplicate")}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onSelect={(e) => {
                            e.preventDefault();
                            void handleDelete(p);
                          }}
                        >
                          <Icon icon="ph:trash" className="size-4" />
                          {t("objektePage.menuDelete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                <div className="flex flex-col gap-1 p-4">
                  <span className="truncate font-semibold">{p.title}</span>
                  <span className="text-sm text-muted-foreground">
                    {TYPE_LABELS[p.property_type]} ·{" "}
                    {t("objektePage.guestsCount", { count: p.max_guests })}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {[p.postal_code, p.city].filter(Boolean).join(" ") || "—"}
                  </span>
                  {/* Interne Objekt-ID (Lodgify-Stil „ID: …") — für die
                      Suche/Zuordnung durch den Betrieb. */}
                  <span className="mt-0.5 font-mono text-[0.6875rem] text-muted-foreground/70">
                    {t("objektePage.idLabel")}: {p.id.slice(0, 8)}
                  </span>
                  {p.channels && (
                    <div className="mt-2">
                      <ChannelChips channels={p.channels} status={p.status} />
                    </div>
                  )}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

"use client";

// Konto → Benutzer → Detailseite: „Objekt zuweisen".
//
// Zwei Rollen, zwei Bedeutungen — deshalb wird die Zielrolle mitgegeben und
// nicht geraten:
//   * owner   → Portal-Sicht (Lastenheft §4.2): welche Objekte der Eigentümer
//               in seinem read-only-Portal sieht.
//   * staff/cleaner → operative Freigabe (§4.3): welche Objekte er bearbeiten
//               darf.
// admin/co_admin haben Zugriff auf alle Objekte des Kontos; für sie gibt es
// keine Zuweisung, und die Detailseite zeigt diesen Abschnitt gar nicht.
//
// Replace-Semantik wie im Backend: die abgeschickte Liste IST die neue
// Zuordnung. Der Alt/Neu-Diff passiert serverseitig (Wurzel 1) — hier wird
// nichts inline nachgebaut.
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Icon } from "@iconify/react";
import { toast } from "sonner";

import { Button } from "@nextdays/ui/button";
import { Checkbox } from "@nextdays/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@nextdays/ui/sheet";
import {
  type UserRole,
  setOwnerProperties,
  setStaffProperties,
} from "@/lib/account";
import type { Property } from "@/lib/properties";

/** Adresszeile eines Objekts, so weit sie erfasst ist. Kein Platzhalter. */
export function objektAdresse(p: Property): string {
  return [
    [p.street, p.house_number].filter(Boolean).join(" "),
    [p.postal_code, p.city].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join(", ");
}

export function BenutzerObjekteSheet({
  userId,
  role,
  properties,
  zugewiesen,
  onClose,
}: {
  userId: string;
  role: UserRole;
  properties: Property[];
  zugewiesen: string[];
  onClose: () => void;
}) {
  const t = useTranslations("account");
  const [gewaehlt, setGewaehlt] = useState<Set<string>>(
    () => new Set(zugewiesen),
  );
  const [suche, setSuche] = useState("");
  const [busy, setBusy] = useState(false);

  const gefiltert = useMemo(() => {
    const q = suche.trim().toLowerCase();
    if (!q) return properties;
    return properties.filter(
      (p) =>
        p.title.toLowerCase().includes(q) ||
        objektAdresse(p).toLowerCase().includes(q),
    );
  }, [properties, suche]);

  function umschalten(id: string, an: boolean) {
    setGewaehlt((prev) => {
      const next = new Set(prev);
      if (an) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function speichern() {
    setBusy(true);
    const ids = [...gewaehlt];
    const res =
      role === "owner"
        ? await setOwnerProperties(userId, ids)
        : await setStaffProperties(userId, ids);
    setBusy(false);
    if (res.ok) {
      toast.success(t("userDetail.assignmentSaved"));
      onClose();
    } else {
      toast.error(res.error);
    }
  }

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex h-full w-full flex-col gap-0 p-0 sm:max-w-md">
        <SheetHeader className="border-b">
          <SheetTitle className="font-display text-lg font-extrabold">
            {t("userDetail.assignProperty")}
          </SheetTitle>
          <SheetDescription>
            {role === "owner"
              ? t("userDetail.assignHintOwner")
              : t("userDetail.assignHintStaff")}
          </SheetDescription>
        </SheetHeader>

        <div className="flex items-center gap-2 border-b px-4">
          <Icon
            icon="ph:magnifying-glass"
            className="size-4 shrink-0 text-muted-foreground"
          />
          <input
            type="search"
            value={suche}
            onChange={(e) => setSuche(e.target.value)}
            placeholder={t("userDetail.searchProperty")}
            className="w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground"
          />
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-2">
          {properties.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              {t("userWizard.noProperties")}
            </p>
          ) : gefiltert.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">
              {t("userDetail.noPropertyFound")}
            </p>
          ) : (
            gefiltert.map((p) => (
              <label
                key={p.id}
                className="flex cursor-pointer items-center gap-3 rounded-(--radius) p-2 hover:bg-secondary/50"
              >
                <ObjektBild property={p} />
                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                  <span className="truncate text-sm font-medium">{p.title}</span>
                  {objektAdresse(p) && (
                    <span className="truncate text-xs text-muted-foreground">
                      {objektAdresse(p)}
                    </span>
                  )}
                </span>
                <Checkbox
                  className="shrink-0"
                  checked={gewaehlt.has(p.id)}
                  onCheckedChange={(c) => umschalten(p.id, c === true)}
                />
              </label>
            ))
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t p-4">
          <span className="text-xs text-muted-foreground">
            {t("userWizard.selectedCount", { count: gewaehlt.size })}
          </span>
          <div className="flex items-center gap-3">
            <Button variant="ghost" onClick={onClose} disabled={busy}>
              {t("userWizard.cancel")}
            </Button>
            <Button onClick={speichern} disabled={busy}>
              {busy ? t("userDetail.saving") : t("userDetail.save")}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/** Erstes Objektfoto als Vorschau; ohne Foto ein neutrales Haus-Symbol. */
export function ObjektBild({ property }: { property: Property }) {
  const foto = property.photos?.[0];
  if (!foto) {
    return (
      <span className="flex size-10 shrink-0 items-center justify-center rounded-(--radius) bg-secondary">
        <Icon icon="ph:house-line" className="size-5 text-muted-foreground" />
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={foto}
      alt=""
      aria-hidden
      className="size-10 shrink-0 rounded-(--radius) object-cover"
    />
  );
}

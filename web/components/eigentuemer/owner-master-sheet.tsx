"use client";

// Slide-over mit den Stammdaten/Auszahlungs-Einstellungen + Objekt-Zuordnung
// eines Eigentümers (die frühere Detail-Maske). Von der Eigentümer-Statement-
// Seite aus über „Stammdaten" erreichbar.
import { OwnerDetail } from "@/components/eigentuemer/owner-detail";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useTranslations } from "next-intl";

import type { Owner } from "@/lib/owners";

type PropOption = { id: string; title: string };

export function OwnerMasterSheet({
  owner,
  open,
  onClose,
  properties,
}: {
  owner: Owner;
  open: boolean;
  onClose: () => void;
  properties: PropOption[];
}) {
  const t = useTranslations("ownerStatements");
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-full flex-col gap-4 overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{t("masterData")}</SheetTitle>
          <SheetDescription>{owner.name}</SheetDescription>
        </SheetHeader>
        <OwnerDetail initial={owner} properties={properties} embedded />
      </SheetContent>
    </Sheet>
  );
}

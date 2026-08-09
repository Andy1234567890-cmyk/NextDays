"use client";

// Slide-over mit den Stammdaten/Auszahlungs-Einstellungen + Objekt-Zuordnung
// eines Eigentümers (die frühere Detail-Maske). Von der Eigentümer-Statement-
// Seite aus über „Stammdaten" erreichbar.
//
// Darunter der ABRECHNUNGSVERTRAG mit Zeitachse. Er steht bewusst hier und
// nicht auf einer eigenen Seite: der Provisionssatz gehört zu den
// Auszahlungs-Einstellungen, die direkt darüber gepflegt werden. Getrennt
// bliebe für die Agentur unklar, welche der beiden Angaben gilt.
import { Abrechnungsvertrag } from "@/components/eigentuemer/abrechnungsvertrag";
import { OwnerDetail } from "@/components/eigentuemer/owner-detail";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@nextdays/ui/sheet";
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
  // Siehe Kommentar am `Abrechnungsvertrag` unten: `properties` ist die
  // ZUORDENBARE Liste (seine + herrenlose), `owner.properties` die echte
  // Zuordnung. Titel aus der Liste, ID als Rückfall — kein Platzhalter.
  const titelById = new Map(properties.map((p) => [p.id, p.title]));
  const eigeneObjekte: PropOption[] = owner.properties.map((l) => ({
    id: l.property_id,
    title: titelById.get(l.property_id) ?? l.property_id,
  }));
  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="flex w-full flex-col gap-4 overflow-y-auto sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{t("masterData")}</SheetTitle>
          <SheetDescription>{owner.name}</SheetDescription>
        </SheetHeader>
        <OwnerDetail initial={owner} properties={properties} embedded />
        {/* Der Vertrag bekommt NUR die zugeordneten Objekte, die
            Zuordnungs-Maske darüber die volle zuordenbare Liste. `properties`
            ist „frei ODER seins" — ein Provisionssatz auf einem gerade
            herrenlosen fremden Objekt wäre eine Vereinbarung über etwas, das
            diesem Eigentümer nicht gehört (Wurzel 3/9). */}
        <Abrechnungsvertrag ownerId={owner.id} properties={eigeneObjekte} />
      </SheetContent>
    </Sheet>
  );
}

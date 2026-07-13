"use client";

// PDF-Export der Objektkartei. Lädt die Kartei frisch und rendert sie mit den
// aktiven i18n-Labels komplett clientseitig via @react-pdf/renderer (kein
// HTML→PDF-Dienst, kein Backend). Kein Zustand am Objekt wird verändert.
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { type DossierLabels, buildDossierPdf } from "@/lib/dossier-pdf";
import { getDossier } from "@/lib/property-dossier";
import { type Property, listPropertyPhotos } from "@/lib/properties";

// Feld-Labels (PDF-Key → i18n-Pfad) und verschachtelte Enum-/Struktur-Keys, die
// das PDF mit vollem Pfad auflöst (z. B. "serviceType.caretaker").
const FIELD_MAP: Record<string, string> = {
  title: "title", brand: "brand", empty: "empty", noOwner: "noOwner", yes: "yes", no: "no",
  name: "objectInfo.name", type: "objectInfo.type",
  capacityPersons: "objectInfo.capacityPersons", capacitySqm: "objectInfo.capacitySqm",
  bfeNumber: "objectInfo.bfeNumber",
  firstMeeting: "process.firstMeeting", contractSent: "process.contractSent",
  contractSigned: "process.contractSigned", invoiceSent: "process.invoiceSent",
  invoicePaid: "process.invoicePaid",
  keyStatus: "access.keyStatus", keyPlacement: "access.keyPlacement",
  serviceType: "service.serviceType", frequency: "service.frequency", price: "service.price",
  currency: "service.currency", notes: "service.notes",
  trade: "trades.trade", phone: "trades.phone",
  authorityHeading: "trades.authorityHeading", authorityMode: "trades.authorityMode",
  authorityLimit: "trades.authorityLimit",
  photographerBooked: "marketing.photographerBooked", mediaReceived: "marketing.mediaReceived",
  siteWalkthrough: "marketing.siteWalkthrough", defectsListSent: "marketing.defectsListSent",
  welcomeStatus: "housebook.welcomeStatus", physicalPlaced: "housebook.physicalPlaced",
  platform: "listing.platform", launchAt: "listing.launchAt", status: "listing.status",
};
const NESTED: Record<string, readonly string[]> = {
  step: ["object_info", "process", "access", "service_agreements", "tradespeople", "marketing", "housebook", "listing"],
  owner: ["heading", "name", "company", "email", "phone", "iban", "bic", "bankName", "accountHolder", "taxId", "vatId", "cprNumber", "ownershipShare"],
  keyStatus: ["agency_extra", "owner_only"],
  serviceType: ["caretaker", "window_cleaning", "lawn_mowing"],
  trade: ["electrician", "plumbing", "carpenter", "locksmith"],
  authorityMode: ["up_to_amount", "always_owner"],
  welcomeStatus: ["received", "open"],
  platform: ["native", "airbnb", "booking", "vrbo"],
};

export function DossierPdfButton({ property }: { property: Property }) {
  const t = useTranslations("dossier");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function buildLabels(): DossierLabels {
    const L: DossierLabels = {};
    for (const [flat, path] of Object.entries(FIELD_MAP)) L[flat] = t(path);
    for (const [ns, keys] of Object.entries(NESTED)) {
      for (const key of keys) L[`${ns}.${key}`] = t(`${ns}.${key}`);
    }
    return L;
  }

  async function exportPdf() {
    setBusy(true);
    setError(null);
    try {
      const res = await getDossier(property.id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      // Cover-Foto (falls vorhanden) fürs Deckblatt — best effort, ohne Cover
      // fällt das PDF auf den schlichten dunklen Kopf zurück.
      let coverUrl: string | null = null;
      const photos = await listPropertyPhotos(property.id);
      if (photos.ok) {
        const cover = photos.data.items.find((p) => p.is_cover) ?? photos.data.items[0];
        coverUrl = cover?.url ?? null;
      }
      const blob = await buildDossierPdf(property, res.data, buildLabels(), coverUrl);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${t("title")}-${property.title.replace(/[^\w-]+/g, "_")}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (exc) {
      setError(exc instanceof Error ? exc.message : "PDF");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        size="sm"
        className="gap-2 bg-card text-foreground hover:bg-card/90"
        onClick={exportPdf}
        disabled={busy}
      >
        <Icon icon="ph:file-pdf" className="size-4" />
        {busy ? t("pdfBuilding") : t("pdfExport")}
      </Button>
      {error && <span className="text-xs text-white/90">{error}</span>}
    </div>
  );
}

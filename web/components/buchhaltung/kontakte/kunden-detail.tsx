"use client";

// Kundendetail: Kopf (Name, Nummer, Art, Kontakt) + Reiter Belege /
// Ansprechpartner / Adressen / Notizen. Alle Daten kommen aus der Server-
// Component (page.tsx); hier nur der Reiterwechsel. Zähler in den Reiter-
// Labels kommen aus der Übersicht (serverseitig gezählt).
import { Icon } from "@iconify/react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { type ReactNode, useState } from "react";

import { Avatar, AvatarFallback } from "@nextdays/ui/avatar";
import { Card } from "@nextdays/ui/card";
import { Segmented } from "@nextdays/ui/segmented";
import type {
  Anschrift,
  Ansprechpartner,
  KundeDetail,
  KundenUebersicht,
  Notiz,
} from "@/lib/buchhaltung-kontakte-typen";

import { AdressenTab } from "./adressen-tab";
import { AnsprechpartnerTab } from "./ansprechpartner-tab";
import { BelegeTab } from "./belege-tab";
import { NotizenTab } from "./notizen-tab";

type Reiter = "belege" | "ansprechpartner" | "adressen" | "notizen";

function initialen(name: string): string {
  const teile = name.trim().split(/\s+/).filter(Boolean);
  if (teile.length >= 2) return (teile[0][0] + teile[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

export function KundenDetail({
  kunde,
  uebersicht,
  kontakte,
  anschriften,
  notizen,
  kennzahlen,
}: {
  kunde: KundeDetail;
  uebersicht: KundenUebersicht;
  kontakte: Ansprechpartner[];
  anschriften: Anschrift[];
  notizen: Notiz[];
  /** Serverseitig gerenderter Kennzahlen-Block (Kennzahlen-Komponente). */
  kennzahlen: ReactNode;
}) {
  const t = useTranslations("finance");
  const [reiter, setReiter] = useState<Reiter>("belege");

  const optionen: readonly { value: Reiter; label: string }[] = [
    { value: "belege", label: `${t("kontaktePage.tabs.belege")} (${uebersicht.invoiceCount})` },
    {
      value: "ansprechpartner",
      label: `${t("kontaktePage.tabs.ansprechpartner")} (${uebersicht.contactCount})`,
    },
    { value: "adressen", label: `${t("kontaktePage.tabs.adressen")} (${uebersicht.addressCount})` },
    { value: "notizen", label: `${t("kontaktePage.tabs.notizen")} (${uebersicht.noteCount})` },
  ];

  const hauptkontakt = kontakte.find((k) => k.isPrimary) ?? null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Link
          href={kunde.is_supplier ? "/buchhaltung/lieferanten" : "/buchhaltung/kunden"}
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <Icon icon="ph:arrow-left" className="size-4" />
          {kunde.is_supplier ? t("kontaktePage.backToSuppliers") : t("kontaktePage.backToCustomers")}
        </Link>
        <KundenKopf kunde={kunde} uebersicht={uebersicht} hauptkontakt={hauptkontakt} />
        {kennzahlen}
      </div>

      <Segmented<Reiter> value={reiter} options={optionen} onChange={setReiter} block />

      {reiter === "belege" && <BelegeTab belege={uebersicht.invoices} gesamt={uebersicht.invoiceCount} />}
      {reiter === "ansprechpartner" && <AnsprechpartnerTab customerId={kunde.id} kontakte={kontakte} />}
      {reiter === "adressen" && <AdressenTab customerId={kunde.id} kunde={kunde} anschriften={anschriften} />}
      {reiter === "notizen" && <NotizenTab customerId={kunde.id} notizen={notizen} />}
    </div>
  );
}

/** Der Kopf der Kundenakte: Name, Kennzeichen, Erreichbarkeit, Schlagwörter. */
function KundenKopf({
  kunde,
  uebersicht,
  hauptkontakt,
}: {
  kunde: KundeDetail;
  uebersicht: KundenUebersicht;
  hauptkontakt: Ansprechpartner | null;
}) {
  const t = useTranslations("finance");
  return (
      <Card className="flex flex-wrap items-center gap-4 p-4">
        <Avatar className="size-14">
          <AvatarFallback className="text-lg">{initialen(kunde.name)}</AvatarFallback>
        </Avatar>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-2xl font-extrabold">{kunde.name}</h2>
            {kunde.customer_number && (
              <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
                {kunde.customer_number}
              </span>
            )}
            <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
              {kunde.customer_type === "private" ? t("kundenPage.typePrivate") : t("kundenPage.typeBusiness")}
            </span>
            {kunde.is_supplier && (
              <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
                {t("kundenPage.supplier")}
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {kunde.email && (
              <a href={`mailto:${kunde.email}`} className="inline-flex items-center gap-1 hover:text-foreground">
                <Icon icon="ph:envelope-simple" className="size-4" />
                {kunde.email}
              </a>
            )}
            {kunde.phone && (
              <a href={`tel:${kunde.phone}`} className="inline-flex items-center gap-1 hover:text-foreground">
                <Icon icon="ph:phone" className="size-4" />
                {kunde.phone}
              </a>
            )}
            {kunde.vat_id && (
              <span className="inline-flex items-center gap-1">
                <Icon icon="ph:identification-card" className="size-4" />
                {kunde.vat_id}
              </span>
            )}
            {hauptkontakt && (
              <span className="inline-flex items-center gap-1">
                <Icon icon="ph:user" className="size-4" />
                {t("kontaktePage.primaryContact")}: {hauptkontakt.name}
              </span>
            )}
          </div>
          {uebersicht.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {uebersicht.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-medium text-accent"
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </Card>
  );
}

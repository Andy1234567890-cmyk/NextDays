// Objekt-Detailseite (Server Component). Grunddaten + Publish. Fotos/Preise/
// Kalender/Policies folgen hier mit den jeweiligen Bereichen. Der Data-Layer
// (getProperty) ist tenant-/owner-gescopet — fremde Objekte → 404 im Backend.
import { formatCurrency } from "@nextdays/currency";
import { getTranslations } from "next-intl/server";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Card } from "@nextdays/ui/card";

import { ObjektPublish } from "@/components/objekt-publish";
import { ApiError } from "@/lib/api-server";
import { getProperty } from "@/lib/properties";

export default async function ObjektDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations("objektDetail");
  const tt = await getTranslations("onboarding.typen");

  let prop;
  try {
    prop = await getProperty(id);
  } catch (exc) {
    if (exc instanceof ApiError && (exc.status === 404 || exc.status === 403)) {
      notFound();
    }
    throw exc;
  }

  const adresse =
    [prop.street, prop.house_number].filter(Boolean).join(" ") +
    (prop.city ? `, ${prop.postal_code ?? ""} ${prop.city}`.trim() : "");

  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <Link
        href="/objekte"
        className="mb-4 inline-block text-sm text-muted-foreground hover:underline"
      >
        ← {t("zurueck")}
      </Link>

      <header className="mb-6 flex items-start justify-between gap-4">
        <h1 className="font-display text-2xl font-semibold">{prop.title}</h1>
        <ObjektPublish id={prop.id} status={prop.status} />
      </header>

      <Card className="mb-4 p-6">
        <h2 className="mb-4 font-medium">{t("grunddaten")}</h2>
        <dl className="grid gap-3 sm:grid-cols-2 text-sm">
          <Row label={t("typ")} value={tt(prop.property_type)} />
          <Row label={t("gaeste")} value={String(prop.max_guests)} />
          <Row label={t("adresse")} value={adresse || "—"} />
          <Row
            label={t("waehrung")}
            value={
              prop.currency
                ? `${prop.currency} (${formatCurrency(0, prop.currency, "de-DE", 0)})`
                : "—"
            }
          />
        </dl>
      </Card>

      <Card className="p-6">
        <h2 className="mb-2 font-medium">{t("naechsteSchritte")}</h2>
        <p className="text-sm text-muted-foreground">{t("naechsteSchritteText")}</p>
      </Card>
    </main>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

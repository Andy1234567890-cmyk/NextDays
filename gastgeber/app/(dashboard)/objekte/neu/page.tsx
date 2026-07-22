// Neues Objekt anlegen (Server Component). Auth-Guard sitzt im Group-Layout.
// Grunddaten-Form legt ein Draft-Objekt an; Fotos/Preise/Publish folgen auf der
// Objekt-Detailseite.
import { getTranslations } from "next-intl/server";

import { Card } from "@nextdays/ui/card";

import { NeuesObjektForm } from "@/components/neues-objekt-form";

export default async function NeuesObjektPage() {
  const t = await getTranslations("onboarding");
  return (
    <main className="mx-auto max-w-2xl px-6 py-8">
      <header className="mb-6">
        <h1 className="font-display text-2xl font-semibold">{t("titel")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("untertitel")}</p>
      </header>
      <Card className="p-6">
        <NeuesObjektForm />
      </Card>
    </main>
  );
}

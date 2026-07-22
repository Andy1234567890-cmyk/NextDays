// Objekte-Übersicht (Server Component). Lädt die Objekte des Gastgebers server-
// zu-server und rendert die Realtime-Liste. Auth-Guard sitzt im Group-Layout.
import { getTranslations } from "next-intl/server";
import Link from "next/link";

import { ObjekteListe } from "@/components/objekte-liste";
import { getProperties } from "@/lib/properties";

export default async function ObjektePage() {
  const [items, t] = await Promise.all([
    getProperties(),
    getTranslations("objekte"),
  ]);

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">{t("titel")}</h1>
        {items.length > 0 && (
          <Link
            href="/objekte/neu"
            className="inline-flex rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background"
          >
            {t("neu")}
          </Link>
        )}
      </header>
      <ObjekteListe items={items} />
    </main>
  );
}

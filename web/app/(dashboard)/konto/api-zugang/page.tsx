// Konto → API-Zugang: Entwickler-API-Clients (Booking-„Machine Account"-Modell).
// Lädt die Clients + die Objekte des Tenants (für die Objekt-Beschränkung) und
// übergibt sie an die Client-Komponente. Nur manage_tenant (der Endpunkt erzwingt
// es serverseitig — 403 wird als „Kein Zugriff" gerendert, kein toter Tab).
import { getTranslations } from "next-intl/server";

import { ApiAccessSection } from "@/components/konto/api-access-section";
import { listApiClients } from "@/lib/api-clients";
import { listProperties } from "@/lib/properties";

export default async function ApiZugangPage() {
  const [clientsRes, propsRes, t] = await Promise.all([
    listApiClients(),
    listProperties(),
    getTranslations("apiAccess"),
  ]);

  if (!clientsRes.ok && clientsRes.status === 403) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
        <h2 className="font-display text-lg font-extrabold">{t("noAccess")}</h2>
        <p className="text-sm text-muted-foreground">
          Nur Administratoren und Kontoinhaber können den API-Zugang verwalten.
        </p>
      </div>
    );
  }

  const clients = clientsRes.ok ? clientsRes.data : [];
  const properties = propsRes.ok
    ? propsRes.data.items.map((p) => ({ id: p.id, title: p.title }))
    : [];

  return (
    <div className="flex flex-1 flex-col gap-4">
      {!clientsRes.ok ? (
        <p className="text-sm text-destructive">{t("loadErr")}</p>
      ) : (
        <ApiAccessSection clients={clients} properties={properties} />
      )}
    </div>
  );
}

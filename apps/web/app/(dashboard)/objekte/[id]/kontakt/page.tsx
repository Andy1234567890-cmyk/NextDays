// Objekt → Kontakt (wie Lodgify „Contact page"): Hauptkontakt für das Objekt
// wählen (Nutzer des eigenen Tenants); „Bearbeiten" öffnet das Profil
// („Kontaktdaten bearbeiten"). Server Component lädt Objekt, Nutzerliste und
// das eigene Konto; der Client-Teil rendert Liste, Suche und Editor.
import { ContactForm } from "@/components/objekte/contact-form";
import { getAccount, listTenantUsers } from "@/lib/account";
import { getProperty } from "@/lib/properties";

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [propertyRes, usersRes, accountRes] = await Promise.all([
    getProperty(id),
    listTenantUsers(),
    getAccount(),
  ]);

  if (!propertyRes.ok) {
    return (
      <div className="text-sm text-destructive">
        Objekt konnte nicht geladen werden: {propertyRes.error}
      </div>
    );
  }
  if (!accountRes.ok) {
    return (
      <div className="text-sm text-destructive">
        Konto konnte nicht geladen werden: {accountRes.error}
      </div>
    );
  }

  return (
    <ContactForm
      initial={propertyRes.data}
      users={usersRes.ok ? usersRes.data : []}
      account={accountRes.data}
    />
  );
}

// Konto → Nutzer → <Person> → Benachrichtigungen.
//
// Der Betrieb stellt ein, was bei seinen Leuten ankommt. Eigene Seite statt
// eines weiteren Abschnitts auf der Detailseite: es sind 40 Kategorien in acht
// Gruppen — als Karte zwischen Kontaktdaten und Objektzuweisung wäre die
// Detailseite nicht mehr lesbar (und die Komponente eine der längsten im Repo).
//
// Der Schutz liegt NICHT hier: dass diese Seite nur über die Nutzerliste
// erreichbar ist, hält niemanden auf. Der Server verlangt MANAGE_STAFF und
// scopt die ID auf den eigenen Tenant (`_nutzer_im_tenant`, Wurzel 3/9) — eine
// fremde ID in der Adresszeile führt deshalb auf `notFound`, nicht auf fremde
// Daten.
import { notFound } from "next/navigation";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

import { BenachrichtigungsEinstellungen } from "@/components/konto/benachrichtigungs-einstellungen";
import { getFuerNutzer } from "@/lib/benachrichtigungen";
import { getManagedUser } from "@/lib/account";
import { getMe } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function NutzerBenachrichtigungenPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const [nutzerRes, me, t] = await Promise.all([
    getManagedUser(userId),
    getMe(),
    getTranslations("account.notifications"),
  ]);
  // 403 (fehlende Rolle) und 404 (fremder Tenant) führen beide hierher: die
  // Existenz eines fremden Nutzers ist keine Auskunft, die wir geben.
  if (!nutzerRes.ok) notFound();
  // Ein `owner` kommt bis hierher — er darf die Nutzerliste lesen. Ändern darf
  // er fremde Zustellwege nicht, und der Server sagt das auch (403). Ohne
  // diese Zeile stünde hier eine vollständige Seite mit einem roten Kasten
  // statt einer Antwort; die Kante gehört vor die Seite, nicht hinein.
  const darf =
    me?.role === "admin" ||
    (me?.capabilities ?? []).includes("manage_staff") ||
    (me?.permissions ?? []).includes("manage_staff");
  if (!darf) notFound();

  const res = await getFuerNutzer(userId);
  const name = nutzerRes.data.full_name || nutzerRes.data.email || userId;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <Link
          href={`/konto/nutzer/${userId}`}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← {name}
        </Link>
        <h1 className="font-display text-2xl font-extrabold">{t("title")}</h1>
        <p className="text-sm text-muted-foreground">
          {t("forUserHint", { name })}
        </p>
      </header>
      <BenachrichtigungsEinstellungen
        overview={res.ok ? res.data : null}
        error={res.ok ? null : res.error}
        userId={userId}
      />
    </div>
  );
}

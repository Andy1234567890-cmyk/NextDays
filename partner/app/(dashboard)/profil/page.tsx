// Profil, Steuerdaten und Verbundkonto (Auszahlungsweg).
import { getLocale, getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";

import { KanalVerbindungen } from "@/components/kanal-verbindungen";
import { ProfilFormular } from "@/components/profil-formular";
import { SteuerdatenFormular } from "@/components/steuerdaten-formular";
import { Verbundkonto } from "@/components/verbundkonto";
import { datum } from "@/lib/format";
import { getConnect, getConnectPflichtfelder, getMe } from "@/lib/partner";
import { getKanaele } from "@/lib/reichweite";

export default async function ProfilSeite() {
  const [t, locale, me] = await Promise.all([getTranslations("profil"), getLocale(), getMe()]);
  if (!me) redirect("/anmelden");
  const freigegeben = me.status === "approved";
  // Kanalanbindung (0521) und Verbundkonto (0522) gibt es erst nach der Freigabe
  // — der Server verlangt approved. Der Stand kommt LIVE von Stripe, nicht aus
  // dem Spiegel im Profil: ein veralteter Stand würde hier „bereit" zeigen,
  // während der Auszahlungslauf längst sperrt.
  // Die Pflichtfelder für Land und Rechtsform kommen LIVE aus Stripes
  // Ländervorgabe; das Formular macht daraus seine Pflichtmarkierungen. Ist
  // Stripe nicht erreichbar, bleibt das Formular offen — der Server prüft
  // dieselbe Liste noch einmal und lehnt Unvollständiges mit Feldnamen ab.
  const [kanaele, connect, pflicht] = await Promise.all([
    freigegeben ? getKanaele() : null,
    freigegeben ? getConnect() : null,
    freigegeben ? getConnectPflichtfelder().catch(() => null) : null,
  ]);

  return (
    <div>
      <h1 className="font-sans text-[1.75rem] font-bold tracking-tight">{t("titel")}</h1>
      <p className="mt-2 text-muted-foreground">
        {me.email} · {t("seit", { datum: datum(me.created_at, locale) })}
      </p>
      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <ProfilFormular profil={me} />
        <SteuerdatenFormular profil={me} />
      </div>
      {connect && (
        <div className="mt-8">
          <Verbundkonto profil={me} stand={connect} pflicht={pflicht?.minimum ?? []} />
        </div>
      )}
      {kanaele && (
        <div className="mt-8">
          <KanalVerbindungen uebersicht={kanaele} />
        </div>
      )}
    </div>
  );
}

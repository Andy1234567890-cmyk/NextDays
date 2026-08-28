// Einstellungen → Adresse: eigene Domains der Kunden-Website.
//
// KEIN Realtime-Abo. `tenant_custom_domains` ist per 0337 bewusst vom
// DB-Direktpfad ausgenommen (Betriebs-Stammdaten inkl. Domain-Konfiguration:
// `revoke select` für `authenticated`, nicht in `supabase_realtime`). Ein Abo
// darauf wäre eine stumme Attrappe — die Oberfläche sähe live aus und würde nie
// aktualisieren.
//
// Der Domain-Status ändert sich ohne unser Zutun (DNS-Propagierung,
// Zertifikatsausstellung). Aktualisiert wird er deshalb dort, wo der Kunde ihn
// anstößt: „Status prüfen" holt ihn vom Backend und macht danach ein
// `router.refresh()` (siehe adresse-leiste).
import { AdresseLeiste } from "@/components/website/adresse/adresse-leiste";

import { ladeBaukasten } from "../../daten";

export default async function AdresseSeite() {
  const { domains } = await ladeBaukasten();
  return <AdresseLeiste domains={domains} />;
}

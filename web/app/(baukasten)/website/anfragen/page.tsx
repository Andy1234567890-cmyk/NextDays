// Website → Anfragen: die Einsendungen aus den Formular-Abschnitten (0436).
import { AnfragenListe } from "@/components/website/anfragen-liste";
import { listFormEinsendungen } from "@/lib/site-weiterleitungen";

import { KeinZugriff } from "../kein-zugriff";

export default async function AnfragenSeite() {
  const res = await listFormEinsendungen(100);
  // 403 heißt: dieser Rolle fehlt MANAGE_SITE_CONFIG. Das wird NICHT zu einer
  // leeren Liste — „kein Zugriff" sähe sonst aus wie „keine Anfragen", und
  // gerade hier wäre das die falsche Auskunft.
  if (!res.ok && res.status === 403) return <KeinZugriff />;
  return <AnfragenListe items={res.ok ? res.data.items : []} />;
}

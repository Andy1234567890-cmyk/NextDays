import type { HelpCategory } from "../types";

export const ucMietpreise: HelpCategory = {
  slug: "anwendungsfaelle-mietpreise",
  title: "Prețuri de închiriere",
  description: "Stabiliți prețurile de închiriere în mod optim.",
  icon: "ph:tag",
  collection: "usecases",
  sections: [
    {
      heading: "Prețuri de închiriere",
      articles: [
        {
          slug: "hochsaison-preise",
          title: "Optimizarea prețurilor pentru sezonul de vârf",
          excerpt: "Cum vă creșteți în mod țintit prețurile pentru perioadele cu cerere mare.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "h2",
              text: "Situația de plecare",
            },
            {
              type: "p",
              text: "În sezonul de vârf, cererea crește semnificativ, în timp ce prețul dvs. de bază folosește aceleași valori ca în restul anului. Fără o ajustare sezonieră, pierdeți venituri tocmai în cea mai puternică perioadă a anului — ajustarea se face prin planul de tarifare al obiectului dvs., nu prin suprascrierea manuală a zilelor individuale.",
            },
            {
              type: "steps",
              items: [
                "Deschideți planul de tarifare al obiectului afectat și adăugați o regulă sezonieră pentru perioada dorită.",
                "Stabiliți suplimentul ca valoare procentuală sau sumă fixă peste prețul de bază — planul de tarifare preia automat moneda obiectului.",
                "Verificați în calendar dacă noul preț este afișat corect pentru perioada de sezon de vârf, înainte de a-l activa.",
                "Verificați sejurul minim pentru sezonul de vârf — adesea este utilă o durată minimă de rezervare mai mare, pentru a menține ocuparea previzibilă.",
                "Observați, după activare, situația rezervărilor în primele zile și ajustați suplimentul, dacă este necesar.",
              ],
            },
            {
              type: "note",
              variant: "tip",
              text: "O regulă sezonieră acționează transversal, pe portaluri, platformă și site web în mod egal. Detalii despre structura regulilor găsiți la [Planuri de tarifare](/hilfe/preise-raten/rate-plaene).",
            },
          ],
        },
        {
          slug: "laengere-aufenthalte-rabatt",
          title: "Stimularea sejururilor mai lungi cu reducere",
          excerpt: "Cum recompensați oaspeții cu sejur mai lung și reduceți efortul de schimb.",
          updated: "Actualizat: iulie 2026",
          body: [
            {
              type: "h2",
              text: "Situația de plecare",
            },
            {
              type: "p",
              text: "Sejururile scurte înseamnă mai multe sosiri și plecări, mai multe curățenii și un risc mai mare de perioade libere între rezervări. O reducere pentru sejur eșalonată face rezervările mai lungi mai atractive pentru oaspeți și reduce sensibil acest efort.",
            },
            {
              type: "steps",
              items: [
                "Deschideți planul de tarifare al obiectului și adăugați o reducere pentru sejur.",
                "Definiți cel puțin o treaptă, de exemplu de la 7 nopți sau de la 28 de nopți, cu procentul de reducere respectiv.",
                "Verificați ca treptele să nu se suprapună și ca reducerea să se aplice doar de la durata minimă respectivă.",
                "Testați în calendar o rezervare exemplu, care depășește pragul reducerii, pentru a confirma aplicarea corectă.",
                "Activați reducerea și observați efectul asupra duratei medii a sejurului și asupra ocupării.",
              ],
            },
            {
              type: "note",
              variant: "info",
              text: "Reducerile pentru sejur pot fi combinate cu regulile sezoniere — planul de tarifare calculează ambele ajustări împreună. Mai multe la [Planuri de tarifare](/hilfe/preise-raten/rate-plaene).",
            },
          ],
        },
      ],
    },
  ],
};
